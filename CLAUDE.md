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
1. **Search by Title** — Type "The Velveteen Rabbit" and click Search. The app calls `/api/story-search` which asks Gemini to fetch/summarize the story text.
2. **Upload File** — Upload a PDF, EPUB, or TXT file. Text is extracted client-side.
3. **Paste Text** — Expand "Advanced" and paste story text directly.

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
- Gemini 3.0 Pro analyzes the story text
- Creates a **story arc summary** (3-5 bullet points)
- Identifies and describes all **characters** with roles (main/supporting/background)
- Generates **page-by-page captions and visual prompts** (exact page count enforced)
- Creates a **style bible** for consistent art direction
- Saves everything to Supabase (story, characters, pages)

**Phase 2: Character Generation** (`/api/stories/[id]/characters/generate`)
- For each character, generates a portrait reference image using Gemini 3.0 Pro Image
- These reference images are stored and used in all subsequent page generations
- UI shows progressive loading — characters appear as they're generated

**Phase 3: Story Preview** (User Checkpoint)
- User sees: Story arc, character cards with images, editable page captions
- Can regenerate the plan, re-roll individual characters with feedback, or edit captions
- Click "Generate Storybook" to proceed

**Phase 4: Page Illustration** (`/api/generate`)
- For each page, calls Gemini 3.0 Pro Image with:
  - The caption and visual prompt
  - Character reference images (up to 14 refs supported)
  - Previous page images (for scene continuity)
  - Style bible parameters
- Images are generated sequentially and appear in the UI as they complete
- User can stop generation mid-way

**Phase 5: Consistency Check** (`/api/stories/[id]/consistency/analyze`)
- If enabled, analyzes all generated images for inconsistencies
- Looks for: character appearance drift, timeline issues, style drift, object continuity
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
- Pages store: page number, caption, prompt, image URL, status
- **RLS policies** protect user data at database level

### API Routes
| Route | Purpose |
|-------|---------|
| `/auth/callback` | OAuth callback handler for Google login |
| `/api/story-search` | AI story lookup by title |
| `/api/parse` | Extract text from PDF/EPUB/TXT |
| `/api/stories` | Create new story in DB (with optional user_id) |
| `/api/stories/[id]` | Get story with pages/characters |
| `/api/stories/[id]/plan` | Generate story structure |
| `/api/stories/[id]/characters/generate` | Generate character reference image |
| `/api/stories/[id]/pages/update` | Update page captions |
| `/api/stories/[id]/consistency/analyze` | Check for visual inconsistencies |
| `/api/generate` | Generate single page illustration |
| `/api/export/pdf` | Export as PDF |
| `/api/export/zip` | Export as ZIP |

### AI Models Used
- **gemini-3-pro-preview** — Text generation (planning, story search)
- **gemini-3-pro-image-preview** — Image generation (characters, pages)
- Both include retry logic with exponential backoff for 503 errors

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
- Handles plan generation, character generation, page generation, consistency checking
- Progressive UI updates as content generates

### UnifiedStoryPreview.tsx
- Displays story arc summary and character cards
- Allows caption editing before generation
- Character regeneration with feedback
- "Generate Storybook" button to proceed

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
- `createCharacterSheet()` — Character consistency prompts  
- `createPagePrompt()` — Full page illustration prompts

## Design System

**Colors:** Amber primary, sage green secondary, stone-50 background, terracotta accents
**Typography:** Fraunces serif headings (`.font-heading`), Inter sans-serif body
**Patterns:** Left-border status messages, soft shadows, warm hover states

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

## Important Technical Notes

### Character Consistency System
- Reference images generated via `/api/stories/[id]/characters/generate`
- Up to 14 reference images supported per generation (Nano Banana Pro)
- Images passed as `inlineData` to Gemini API
- Fallback placeholders if image generation fails

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
