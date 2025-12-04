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

## How It Works (User Flow)

### Step 1: Story Input (Home Page)
User enters a story in one of three ways:
1. **Search by Title (Primary)** — Type a public domain story title (e.g., "The Velveteen Rabbit", "Peter Pan") and click "Find Story". The app uses Gemini 2.0 Flash with Google Search grounding to fetch the **full, long-form text** from sources like Project Gutenberg, Wikisource, and Standard Ebooks. Stories are automatically saved to the user's library for future use.
2. **Choose from Library** — For logged-in users, previously searched or saved stories can be re-used.
3. **Upload/Paste** — Upload a .txt file or paste story text directly.

### Step 2: Configure Settings
On the home page, user sets:
- **Child's Age** (3-18) — affects vocabulary, themes, and intensity cap
- **Intensity** (0-10) — how dramatic/vivid the imagery should be (auto-capped for young readers)
- **Art Style** — Watercolor, Paper Cutout, Pixar-style 3D, etc., or custom
- **Page Count** (5-30) — more pages = more detailed adaptation
- **Quality Tier** — Standard Flash (~$0.04/page), Premium 2K (~$0.13/page), Professional 4K (~$0.24/page)
- **Character Consistency** (on/off) — uses reference images for visual consistency
- **Optional**: Hero photo upload, search grounding, character review checkpoint, auto-consistency fix

### Step 3: Generate Storybook (Studio Page)
Clicking "Generate Book" navigates to `/studio?session={id}` and triggers a multi-phase pipeline:

**Phase 1: Planning** (`/api/stories/[id]/plan`)
- **Long-text check**: If story exceeds 15,000 characters (~30 pages), runs summarization pipeline:
  - **Step 1**: Gemini 2.5 Pro extracts narrative arc, key scenes, character essences (preserves beginning → middle → end)
  - **Step 2**: Gemini 2.0 Flash + Google Search validates culturally iconic moments, marks [MUST-INCLUDE] scenes
  - Fallback: Intelligent truncation (beginning + ending) if summarization fails
- Gemini 3.0 Pro analyzes the story text (or summary for long texts)
- Creates a **story arc summary** (3-5 bullet points)
- Identifies and describes all **characters** with roles (main/supporting/background)
- Generates **page-by-page captions and visual prompts** (exact page count enforced, respects [MUST-INCLUDE] markers)
- Creates a **style bible** for consistent art direction
- Saves everything to Supabase (story, characters, pages)

**Phase 2: Character Generation** (`/api/stories/[id]/characters/generate`)
- For each character, generates a portrait reference image using Gemini 3.0 Pro Image
- These reference images are stored and used in all subsequent page generations
- UI shows progressive loading — characters appear as they're generated

**Phase 3: Story Preview** (Automatic, No User Gate)
- User sees: Story arc, character cards with images appearing progressively
- Characters appear one-by-one as they're generated
- Generation continues automatically - no "Generate Storybook" button required
- User can click "Stop" at any time to halt generation

**Phase 4: Page Illustration** (`/api/generate`)
- **Scene-based clothing consistency**: Characters wear same outfit within a scene, can change between scenes (supports epic tales)
- **Unified Reality layer**: Detects crowd scenes and applies proportional consistency across all figures
- For each page, calls Gemini 3.0 Pro Image with:
  - The caption and visual prompt
  - Character reference images (up to 14 refs supported)
  - Scene-specific outfit descriptions (from planning phase)
  - Previous page images (for scene continuity)
  - Style bible parameters
  - Unified reality prompt (if crowd detected) — ensures main characters have same proportions as background figures
- Images are generated sequentially and appear in the UI as they complete
- User can stop generation mid-way

**Phase 5: Consistency Check** (`/api/stories/[id]/consistency/analyze`)
- If enabled, analyzes all generated images for inconsistencies
- Looks for: character appearance drift, timeline issues, style drift, object continuity, **intra-scene proportional consistency** (all figures same scale)
- Automatically regenerates problematic pages with enhanced prompts
- User sees pages update in real-time as fixes are applied

### Step 4: Edit & Export
- **Storyboard View** — Drag-and-drop page reordering, caption editing, individual page regeneration
- **Preview Mode** — Full-screen book reader
- **Export** — Download as PDF (embedded images) or ZIP (images + manifest.json)

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
- Output: pages array, characters array, storyArcSummary, theme, styleBible
- Saves to Supabase automatically

**POST `/api/generate`** — Page illustration endpoint
- Input: pageIndex, caption, stylePrompt, characterReferences (up to 14 images)
- Output: imageUrl (base64), warnings, metadata with cost
- Supports: qualityTier, aspectRatio, consistencyFix prompts

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
