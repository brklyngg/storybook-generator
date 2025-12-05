# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered children's picture book generator that transforms any story (PDF, EPUB, or text) into beautifully illustrated children's books using Google Gemini 3.0 Pro AI. The application generates age-appropriate content with consistent character designs and intricate backgrounds.

**Tech Stack:** Next.js 15, TypeScript, Google Gemini 3.0 Pro, Supabase, shadcn/ui, Tailwind CSS, Fraunces font

**Key Features:**
- **Google Login** — Sign in to save storybooks to your account, access from any device
- Story search (AI fetches classic stories) or file upload (PDF/EPUB/TXT)
- Age-customized content (ages 3-18) with intensity capping
- AI-powered character consistency with reference images ("Nano Banana Pro")
- Quality tiers: Standard (Flash), Premium 2K, Professional 4K
- Interactive page editing, caption editing, and drag-and-drop reordering
- Auto-consistency check that detects and fixes visual inconsistencies
- Export to PDF or ZIP with manifest
- Supabase backend for persistent story storage with user accounts

---

## How It Works

### Overview
The app transforms any story into an illustrated children's book through a 4-phase pipeline: **Story Input** → **Planning & Adaptation** → **Character & Page Generation** → **Export**. All generation is automatic with no user approval gates.

---

### Phase 1: Story Input

**User provides story via one of three methods:**
1. **AI Search** — User types a title (e.g., "Peter Pan"). Backend calls `/api/story-search` which uses **Gemini 2.0 Flash + Google Search** to find the story, extract its Project Gutenberg ID, and fetch the **complete full text** directly from Gutenberg's servers.
2. **Library** — Logged-in users can re-use previously fetched stories.
3. **Upload/Paste** — User uploads PDF/EPUB/TXT or pastes text directly.

**User configures settings:**
- Age (3-18), Intensity (0-10), Art Style, Page Count (5-30), Quality Tier (Standard/Premium 2K/4K)
- Optional: Hero photo, character consistency, auto-fix toggle

**Backend:** Story metadata saved to Supabase `stories` table. User clicks "Generate" → redirects to `/studio?session={id}`.

---

### Phase 2: Planning & Adaptation (`/api/stories/[id]/plan`)

**Model:** Gemini 3.0 Pro (text generation)

**Long-text handling:** If story > 15K chars, triggers 2-step summarization:
1. **Gemini 2.5 Pro** extracts 400-500 word narrative arc + key scenes
2. **Gemini 2.0 Flash + Google Search** validates culturally iconic moments, marks [MUST-INCLUDE]
3. Fallback: Intelligent truncation (beginning + ending) if AI fails

**Planning phase outputs:**
- **Story arc** (5-point structure: Setup → Rising Action → Midpoint → Climax → Resolution)
- **Characters** with roles (main/supporting/background), visual descriptions, story roles, approximate ages
- **Pages** with captions (rich prose, 50-200 words/page), visual prompts, camera angles
- **Scene grouping** — Pages grouped into scenes (sceneId) for clothing consistency
- **Scene anchors** — For each scene: location description, lighting, color palette, key visual elements (enables token-efficient continuity)
- **Style bible** — Art direction parameters derived from user settings

**Database:** All data saved to Supabase (`stories`, `characters`, `pages` tables). Generation proceeds automatically.

**Cost:** ~$0.02-0.05 for long texts (summarization pipeline), ~$0.01 for short texts

---

### Phase 3: Character & Page Generation

#### 3A: Character Reference Generation (`/api/stories/[id]/characters/generate`)

**Model:** Gemini 3.0 Pro Image

**Process:**
- For each character, generates 1-3 portrait reference images (main characters get 3 refs, supporting get 2, background get 1)
- If user uploaded hero photo, blends it with requested art style for protagonist
- Applies "Unified Reality" system — ensures all characters share identical proportional standards (adults 6-7 head-heights, children 4-5)
- Images stored as base64 in Supabase `characters.reference_image`

**UI:** Character cards appear progressively as generation completes. No user gate — generation continues automatically.

**Cost:** ~$0.13 per character reference (2K quality)

#### 3B: Page Illustration (`/api/generate`)

**Model:** Gemini 3.0 Pro Image (all quality tiers)

**Process for each page:**
1. Assembles prompt with caption, style bible, camera angle, scene anchor
2. Adds up to 14 reference images in priority order:
   - Character references (with scene-specific outfits from planning phase)
   - Scene anchor image (first page of current scene) OR fallback to 2 previous pages
   - Environment/object references (if provided)
3. Detects crowd/multi-character scenes → applies "Unified Reality" prompt layer to enforce proportional consistency
4. Calls Gemini API with assembled content parts
5. Saves base64 image to Supabase `pages.image_url`

**Scene anchor optimization:** Uses 1 scene anchor image + text description instead of 2 full images → ~45% token reduction for continuity

**Retry logic:** Exponential backoff for 503/429 errors (max 3 retries)

**Cost:** $0.04/page (Standard Flash), $0.13/page (Premium 2K), $0.24/page (Professional 4K)

---

### Phase 4: Consistency Check (Optional, `/api/stories/[id]/consistency/analyze`)

**Model:** Gemini 2.0 Flash (vision)

**Process:**
- Sends all page images + character references + hero photo (if exists) to AI
- Analyzes for: character appearance drift, style inconsistencies, proportional issues, timeline errors
- Returns: list of issues, pages needing regeneration, fix prompts
- Auto-regenerates flagged pages with enhanced consistency instructions

**UI:** Pages update in real-time as fixes complete

**Cost:** ~$0.01 per analysis (entire book analyzed in one call)

---

### Phase 5: Edit & Export

**Editing:**
- Drag-and-drop page reordering (client-side)
- Caption editing → saves to Supabase `pages.caption`
- Individual page regeneration → calls `/api/generate` with updated settings

**Export:**
- **PDF** (`/api/export/pdf`) — Embeds images directly in PDF document
- **ZIP** (`/api/export/zip`) — Downloads images + manifest.json with metadata

---

### Key Backend Patterns

**Data flow:**
```
User Input → Supabase (metadata) → Planning (Gemini 3.0 Pro) → Supabase (pages/chars) →
Character Gen (Gemini 3.0 Pro Image) → Supabase (refs) →
Page Gen (Gemini 3.0 Pro Image) → Supabase (images) →
Consistency Check (Gemini 2.0 Flash) → Supabase (fixes) → Export
```

**Token efficiency strategies:**
1. **Scene anchors** — 1 image + text vs 2 images (45% savings)
2. **Long-text summarization** — 6K-8K summary vs 50K+ raw text (80%+ savings)
3. **Reference prioritization** — Max 14 refs, prioritize characters > continuity > props

**Cost management:**
- Standard Flash tier: ~$0.80 per 20-page book
- Premium 2K tier: ~$2.85 per 20-page book
- Professional 4K tier: ~$5.00 per 20-page book

**Error handling:**
- All AI calls wrapped in retry logic (exponential backoff)
- Graceful degradation (placeholders if generation fails)
- Database status tracking (`pending` → `generating` → `completed` → `error`)

---

## Backend Architecture

### Authentication (Supabase Auth)
- **Google OAuth** for one-click sign-in
- **Browser client** (`src/lib/supabase-browser.ts`) handles auth flows
- **Service client** (`src/lib/supabase.ts`) for server-side API routes
- **Session persistence** with automatic token refresh
- **Optional login** — App works without account, login enables story persistence

### Database (Supabase)
Tables: `stories`, `characters`, `pages`
- Stories store: user_id, source text, title, settings, theme, status
- Characters store: name, description, role, reference images
- Pages store: page number, caption, prompt, image URL, status, scene_id, scene_outfits
- **RLS policies** protect user data at database level
- **Migration required**: `ALTER TABLE pages ADD COLUMN scene_id text, ADD COLUMN scene_outfits jsonb;`

### API Routes
| Route | Purpose |
|-------|---------|
| `/auth/callback` | OAuth callback handler for Google login |
| `/api/story-search` | AI web search for full public domain story text (uses Gemini 2.0 Flash + Google Search) |
| `/api/parse` | Extract text from PDF/EPUB/TXT |
| `/api/stories` | Create new story in DB (with optional user_id) |
| `/api/stories/[id]` | Get story with pages/characters |
| `/api/stories/[id]/plan` | Generate story structure (includes long-text summarization pipeline for 15K+ chars, groups pages into scenes for clothing consistency) |
| `/api/stories/[id]/characters/generate` | Generate character reference image (includes proportional guidance) |
| `/api/stories/[id]/pages/update` | Update page captions |
| `/api/stories/[id]/consistency/analyze` | Check for visual inconsistencies (includes intra-scene proportional checks) |
| `/api/generate` | Generate single page illustration (includes Unified Reality layer for crowds) |
| `/api/export/pdf` | Export as PDF |
| `/api/export/zip` | Export as ZIP |

### AI Models Used
- **gemini-3-pro-preview** — Text generation (planning)
- **gemini-3-pro-image-preview** — Image generation (characters, pages)
- **gemini-2.5-pro-preview-06-05** — Long-text summarization (extraction phase, 1M+ tokens)
- **gemini-2.0-flash** — Story search, cultural validation (with Google Search grounding)
- All include retry logic with exponential backoff for 503/429 errors

## Development Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build
npm run build        # Production build

# Testing
npm run test         # Run vitest tests

# Linting
npm run lint         # ESLint check

# Production
npm run start        # Start production server (after build)
```

## Environment Setup

Required environment variable in `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

The app will warn but continue without the API key (generation features will fail gracefully with placeholders).

## Core Architecture

### Storage Architecture

**Primary: Supabase (cloud database)**
- Stories, characters, and pages stored in PostgreSQL
- Images stored as base64 in `image_url` / `reference_image` columns
- User authentication via Supabase Auth with Google OAuth
- **user_id** links stories to accounts for cross-device access
- **RLS policies** ensure users can only modify their own stories

**Fallback: localStorage**
- Legacy session support for pre-Supabase sessions
- Session data stored as JSON with `session_` prefix
- Anonymous users can still generate books (not persisted to account)

## API Routes Reference

See "Backend Architecture" in "How It Works" section above for the complete route table.

### Key Routes:

**POST `/api/stories/[id]/plan`** — Main planning endpoint
- Input: story text + settings
- Output: pages array, characters array, storyArcSummary, theme, styleBible, sceneAnchors
- Generates scene anchors for token-efficient visual continuity
- Saves to Supabase automatically

**POST `/api/generate`** — Page illustration endpoint
- Input: pageIndex, caption, stylePrompt, characterReferences (up to 14 images), sceneAnchor (optional)
- Output: imageUrl (base64), warnings, metadata with cost
- Supports: qualityTier, aspectRatio, consistencyFix prompts, hybrid scene continuity
- **Scene Anchor Optimization**: Uses 1 scene anchor image + text description instead of 2 full previous images (~45% token reduction)

**POST `/api/stories/[id]/characters/generate`** — Character portrait endpoint
- Input: characterId, optional feedback for regeneration
- Output: references array (base64 images)

**POST `/api/stories/[id]/consistency/analyze`** — Consistency check
- Analyzes all page images for visual inconsistencies
- Returns: issues array with fix prompts, pagesNeedingRegeneration list

## Key Components

### Home Page (`src/app/page.tsx`)
- **Header** with Google login and user dropdown
- **Recent Stories** section for logged-in users (3 most recent)
- **Login Banner** prompting guests to sign in
- Story search bar with Gemini-powered title lookup
- File upload (PDF/EPUB/TXT) or text paste
- Settings panel via `Controls.tsx`
- Session creation and redirect to Studio

### My Stories Page (`src/app/my-stories/page.tsx`)
- **Card grid** of user's stories with cover thumbnails
- **Status badges** (Complete, Generating, Draft)
- **Delete functionality** with confirmation
- **Empty state** with friendly CTA

### Header Component (`src/components/Header.tsx`)
- **Two variants**: Full (home page) and Minimal (studio)
- **Google sign-in** button for guests
- **Avatar dropdown** with My Stories link and logout
- **Freemium indicators**: Story count, usage bar

### Studio Page (`src/app/studio/StudioClient.tsx`)
- **Workflow State Machine** — Manages phases: plan_pending → story_preview → pages_generating → complete
- **Fully automatic workflow** — No user approval gates, continuous generation from plan to pages
- **Session override pattern** — Passes session data explicitly through call chain to avoid async React state issues
- Handles plan generation, character generation, page generation, consistency checking
- Progressive UI updates as content generates
- AbortController integration for clean stop functionality

### UnifiedStoryPreview.tsx
- Displays story arc summary and character cards
- Progressive character loading with placeholders
- Always-visible progress indicator showing current step and percentage
- Stop button for halting generation mid-process
- No manual approval gate - generation proceeds automatically

### Storyboard.tsx
- Drag-and-drop page reordering (`react-sortablejs`, client-side only)
- Individual page regeneration with character references
- Integrates with ExportBar

### Controls.tsx
- Hero photo upload (optional custom main character)
- Age input, intensity slider, art style selector
- Quality tier selection with cost estimates
- Feature toggles: character consistency, search grounding, consistency check

### Reader.tsx
- Full-screen book preview mode

## Prompting System

All AI prompts are centralized in `src/lib/prompting.ts`:
- `createStyleBible()` — Art direction from user preferences
- `createCharacterSheet()` — Character consistency prompts with proportional guidance
- `createPagePrompt()` — Full page illustration prompts (includes Unified Reality layer)
- `createUnifiedRealityPrompt()` — Proportional consistency enforcement for crowd scenes
- `extractProportionalGuidance()` — Extracts proportional markers from character descriptions

Long-text summarization prompts in `src/lib/summarize.ts`:
- `extractLiterarySummary()` — 400-500 word narrative arc + key scenes extraction
- `validateWithCulturalContext()` — Web search for iconic moments validation
- `summaryToPromptText()` — Formats summary for planning model

### Proportional Consistency System
The "Unified Reality" prompt layer ensures all figures in a scene share the same art style and proportions:
- **Head-heights system**: Adults 6-7 heads tall, children 4-5 heads tall
- **Same-production rule**: All characters (named and unnamed) must look like they're from the same animated movie
- **Anti-hybridization**: Prevents mixing realistic and cartoon styles within a single image
- **Crowd consistency**: Unnamed background figures use identical style as main characters

## Design System

**Current Design Philosophy:** Warm storybook aesthetic (restored 2025-12-03)

**Colors:**
- **Primary:** Warm amber (hsl 35 65% 55%) — Conveys warmth, creativity, storytelling
- **Secondary:** Soft sage green (hsl 145 25% 88%) — Calming, literary, complements amber
- **Accent:** Muted terracotta (hsl 15 45% 65%) — Playful, earthy, child-friendly
- **Background:** Warm cream (hsl 40 25% 97%) — Softer than white, book-like
- **Avoid:** Ink black, pure white, cool grays (too editorial/corporate)

**Typography:**
- **Headings:** Fraunces (serif, variable weight 300-900) — Literary, book-oriented
- **Body:** Inter (sans-serif) — Clean, readable
- **Usage:** `.font-heading` class for headings, default font-sans for body
- **Avoid:** Playfair Display (too formal), Source Serif 4 (removed), DM Sans (removed)

**Patterns:**
- Left-border status messages (info/warning/error with semantic colors)
- Soft shadows (warm, subtle depth)
- Warm hover states (amber/terracotta highlights)
- WorkflowStepper for generation progress visualization

**Design History:**
- Original: Warm storybook aesthetic (amber/sage/terracotta)
- 2025-11-26 (commit 036c41b): Editorial redesign (ink black/sand) ← REVERTED
- 2025-12-03 (commit 5835dc3): Restored warm aesthetic + WorkflowStepper

## Common Development Tasks

### Changing AI Models
Update model strings in:
- `src/app/api/stories/[id]/plan/route.ts` — text model
- `src/app/api/generate/route.ts` — image model
- `src/app/api/stories/[id]/characters/generate/route.ts` — character image model

### Adjusting Settings Bounds
Update in `src/lib/types.ts` (BookSettingsSchema):
- Age: min 3, max 18
- Page count: min 5, max 30
- Intensity: 0-10

### Environment Variables
```
GEMINI_API_KEY=your_key          # Required
NEXT_PUBLIC_SUPABASE_URL=...     # For database
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # For database
ENABLE_NANO_BANANA_PRO=true      # Enable quality tiers (default: true)
FORCE_QUALITY_TIER=standard-flash # Override quality for testing
```

## Deployment

**Vercel (Recommended):**
1. Connect GitHub repository
2. Add `GEMINI_API_KEY` environment variable
3. Deploy (auto-deploys on push to main)

**Build Configuration:**
- Static export not supported (uses API routes)
- Server-side rendering required for API endpoints
- Webpack config excludes `canvas` and `encoding` (see `next.config.mjs`)

---

## Important Technical Notes

### AI Model Policy (User Preference)
- **DO NOT downgrade from `gemini-3-pro-image-preview`** for image generation
- If the model returns 503 "overloaded" errors, use extended retries rather than falling back to lower-quality Gemini models (e.g., `gemini-2.5-flash-image-preview`)
- **Approved fallback**: xAI Grok Aurora (`grok-2-image`) can be used as a fallback, but ONLY when character references are not being used (xAI API doesn't support reference images yet)
- See `docs/xai-fallback-spec.md` for implementation details

### Character Consistency System
- Reference images generated via `/api/stories/[id]/characters/generate`
- Up to 14 reference images supported per generation (Nano Banana Pro)
- Images passed as `inlineData` to Gemini API
- **Proportional guidance** extracted from character descriptions (e.g., "adult male proportions", "child proportions")
- **Unified Reality layer** detects crowd scenes and enforces consistent proportions across ALL figures
- Fallback placeholders if image generation fails

### Scene Anchor System (Token Optimization)
- **Problem**: Previously sent 2 full previous page images (~3,500 tokens/page) for visual continuity
- **Solution**: Hybrid approach using 1 scene anchor image + text description (~1,900 tokens/page)
- **Token savings**: ~45% reduction in continuity-related token usage
- **How it works**:
  - Planning phase generates scene anchors for each unique scene (sceneId, locationDescription, lightingAtmosphere, colorPalette, keyVisualElements)
  - During page generation, if sceneAnchor is provided, uses first page of scene as anchor image + text prompt
  - If no sceneAnchor available, falls back to original 2-image behavior
- **Impact**: For a 20-page book, reduces continuity tokens from 60K-80K to 35K-45K (~20% reduction in total generation cost)

### Long-Text Summarization System
- Triggered automatically for texts over 15,000 characters (~30 printed pages)
- Two-stage pipeline:
  1. **Literary Extraction** (Gemini 2.5 Pro) — Captures complete narrative arc, key scenes, character essences
  2. **Cultural Validation** (Gemini 2.0 Flash + Search) — Identifies iconic moments, marks [MUST-INCLUDE] scenes
- Output: 6,000-8,000 character summary preserving narrative integrity
- Fallback: Intelligent truncation (beginning + ending) if summarization fails
- Cost: ~$0.02-0.05 per long text (2-step pipeline)
- Time: 15-30 seconds additional processing

### Large Text Handling
- Texts over 100K characters stored in localStorage with `__LARGE_TEXT_REF__` prefix
- Avoids React state bloat and browser memory issues
- Auto-cleanup after retrieval
- Transparent to user (UI shows "Large story loaded")

### File Parsing
- PDF: `unpdf` (serverless-friendly)
- EPUB: `epub2`
- Both in `serverExternalPackages` (next.config.mjs)

### Drag-and-Drop
`react-sortablejs` dynamically imported with `ssr: false` — requires DOM access.

### Cost Estimation
- Standard Flash: ~$0.80 per 20-page book
- Premium 2K: ~$2.85 per 20-page book
- Professional 4K: ~$5.00 per 20-page book
