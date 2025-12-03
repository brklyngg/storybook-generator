Last updated: 2025-12-03T20:30:00Z • Source: current repo state

# How It Works

## Summary

The Storybook Generator is an AI-powered children's book creation platform that transforms any story (PDF, EPUB, TXT, or searched classic text) into beautifully illustrated children's books with consistent character designs. The application uses Google Gemini 3.0 Pro for text generation, Gemini 3.0 Pro Image for illustrations, and includes sophisticated features like intelligent long-text summarization, cultural validation, character consistency enforcement (Nano Banana Pro), and unified reality prompting for proportional consistency.

Users can sign in with Google to save stories to their account, customize age-appropriateness (3-18 years), select art styles, choose quality tiers (Standard Flash, Premium 2K, Professional 4K), and export finished books as PDF or ZIP. The app handles everything from classic novels (The Iliad, Peter Pan) to custom uploaded stories, using a two-stage AI pipeline to preserve narrative integrity for long texts while ensuring culturally iconic moments are captured.

## Feature → Power Map

| Feature | Front-end Route/View | Backend Service/Handler | Data Stores | Third-party/AI Used |
|---------|---------------------|------------------------|-------------|---------------------|
| **Google Authentication** | `/` (Header), `/auth/callback` | `/api/auth/callback` | Supabase Auth, `stories.user_id` | Supabase Auth (Google OAuth) |
| **Story Search** | `/` (StorySearch.tsx) | `/api/story-search` | `stories` table | Gemini 2.0 Flash + Google Search grounding |
| **Long-Text Summarization** | Transparent (planning stage) | `/api/stories/[id]/plan` (pre-planning step) | None (in-memory) | Gemini 2.5 Pro (extraction), Gemini 2.0 Flash + Search (validation) |
| **Story Planning** | `/studio` (StudioClient.tsx) | `/api/stories/[id]/plan` | `stories`, `characters`, `pages` tables (auto-extracts title if "Untitled Story") | Gemini 3.0 Pro (prompts: `src/lib/prompting.ts`) |
| **Character Generation** | `/studio` (UnifiedStoryPreview.tsx) | `/api/stories/[id]/characters/generate` | `characters.reference_image` | Gemini 3.0 Pro Image (Nano Banana Pro, 14 refs) |
| **Unified Reality (Proportional Consistency)** | Transparent (page gen) | `/api/generate` (crowd detection layer) | None | Regex + proportional guidance extraction |
| **Page Illustration** | `/studio` (Storyboard.tsx) | `/api/generate` | `pages.image_url` | Gemini 3.0 Pro Image (character refs, previous pages, style bible) |
| **Consistency Check** | `/studio` (auto-trigger) | `/api/stories/[id]/consistency/analyze` | `pages` (update status) | Gemini 3.0 Pro (multi-image analysis) |
| **PDF Export** | `/studio` (ExportBar.tsx) | `/api/export/pdf` | Temp buffer | jsPDF library |
| **ZIP Export** | `/studio` (ExportBar.tsx) | `/api/export/zip` | Temp buffer | jszip library |
| **Story Library** | `/my-stories` | `/api/stories` (GET all user stories) | `stories` table (filtered by `user_id`) | None |

## Architecture Overview

**Framework**: Next.js 15.3 (App Router) with React 19 and TypeScript
**Runtime**: Node.js (serverless functions via Vercel)
**Styling**: Tailwind CSS v4 + shadcn/ui components
**Typography**: Fraunces serif (headings), Inter sans-serif (body)
**Database**: Supabase (PostgreSQL with RLS policies)
**Authentication**: Supabase Auth with Google OAuth
**AI Provider**: Google Gemini API (multiple models)
**Deployment**: Vercel (recommended)

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER INTERFACE (Next.js 15 App Router)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Home (/) → [Story Search / Upload / Paste] → Settings (Controls)  │
│     │                                                               │
│     ├─► Story found? → Store in localStorage (large texts)         │
│     │                                                               │
│     └─► "Generate Book" clicked                                    │
│            │                                                        │
│            ▼                                                        │
│  Studio (/studio?session={id})                                     │
│     │                                                               │
│     ├─► PHASE 1: Planning (POST /api/stories/[id]/plan)            │
│     │      ├─► Long text? (>15K) → Summarization Pipeline          │
│     │      │     ├─► Step 1: Literary Extract (Gemini 2.5 Pro)     │
│     │      │     └─► Step 2: Cultural Validation (Flash + Search)  │
│     │      ├─► Extract title (if "Untitled Story") → Update DB     │
│     │      └─► Generate page structure + characters list           │
│     │                                                               │
│     ├─► PHASE 2: Character Gen (POST /api/.../characters/generate) │
│     │      └─► Generate reference images (progressive loading)     │
│     │                                                               │
│     ├─► PHASE 3: Page Illustration (POST /api/generate)            │
│     │      ├─► Crowd detection → Unified Reality layer            │
│     │      ├─► Character refs (up to 14) + previous pages         │
│     │      └─► Generate image (Flash/2K/4K quality tier)           │
│     │                                                               │
│     └─► PHASE 4: Consistency Check (POST /api/.../consistency/...)│
│            └─► Analyze all images → Auto-fix issues               │
│                                                                     │
│  Export → [PDF | ZIP]                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
           ▲                                  │
           │                                  ▼
    ┌──────────────┐                 ┌────────────────┐
    │   Supabase   │                 │  Gemini API    │
    │   PostgreSQL │                 │  (Google AI)   │
    ├──────────────┤                 ├────────────────┤
    │ • stories    │                 │ • 3.0 Pro      │
    │ • characters │                 │ • 3.0 Pro Image│
    │ • pages      │                 │ • 2.5 Pro      │
    │ • user_id    │                 │ • 2.0 Flash    │
    └──────────────┘                 └────────────────┘
```

## Data & Storage

### Supabase Tables

**`stories`** — Primary story metadata
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users) — NULL for anonymous
- `title` (text) — Story title (auto-extracted by AI during planning if initially "Untitled Story")
- `source_text` (text) — Original story text (or localStorage ref)
- `settings` (jsonb) — Age, intensity, art style, page count, quality tier, etc.
- `status` (text) — "planning" | "story_preview" | "pages_generating" | "complete" | "error"
- `current_step` (text) — Progress message (e.g., "Generating character 3 of 5...")
- `theme` (text) — Story theme extracted during planning
- `story_arc_summary` (text[]) — 3-5 bullet points summarizing narrative
- `style_bible` (jsonb) — Art direction parameters
- `created_at` (timestamp)
- `updated_at` (timestamp)

**`characters`** — Character definitions with reference images
- `id` (uuid, primary key)
- `story_id` (uuid, foreign key to stories)
- `name` (text) — Character name
- `description` (text) — Visual description (used in Unified Reality)
- `role` (text) — "main" | "supporting" | "background"
- `reference_image` (text) — Base64 data URL (up to 14 refs supported)
- `created_at` (timestamp)

**`pages`** — Individual page data
- `id` (uuid, primary key)
- `story_id` (uuid, foreign key to stories)
- `page_number` (integer) — Sequence order (1-30)
- `caption` (text) — User-facing text (editable)
- `prompt` (text) — Full AI prompt for image generation
- `image_url` (text) — Base64 data URL of generated image
- `status` (text) — "pending" | "generating" | "complete" | "error"
- `created_at` (timestamp)

### Row-Level Security (RLS)

All tables have RLS policies:
- Users can only read/update/delete their own stories (WHERE user_id = auth.uid())
- Anonymous users can create stories (user_id = NULL) but cannot retrieve them after session ends
- Service role client bypasses RLS for admin operations

### Storage Strategy

**Images**: Stored as base64 data URLs directly in database columns (`image_url`, `reference_image`)
**Large Texts**: Stored temporarily in browser localStorage with `__LARGE_TEXT_REF__` prefix during upload/search, retrieved and cleaned up during planning phase
**Session Data**: For anonymous users, session data is ephemeral (not persisted to database after page reload)

## AI Components

### Models Used

| Model | Purpose | Context Window | Cost (Input/Output) | Features |
|-------|---------|----------------|---------------------|----------|
| **gemini-3-pro-preview** | Story planning, text generation | ~128K tokens | ~$0.001/1K in, ~$0.003/1K out | Long-form reasoning |
| **gemini-3-pro-image-preview** | Image generation (characters, pages) | N/A (multimodal) | ~$0.04 (Flash), ~$0.13 (2K), ~$0.24 (4K) per image | Nano Banana Pro (14 ref images) |
| **gemini-2.5-pro-preview-06-05** | Long-text summarization (extraction) | 1M+ tokens | ~$0.0025/1K in, ~$0.01/1K out | Massive context for complete novels |
| **gemini-2.0-flash** | Story search, cultural validation | ~32K tokens | ~$0.0002/1K in, ~$0.0008/1K out | Fast, Google Search grounding |

### Prompt System

All prompts centralized in `src/lib/prompting.ts`:

**`createStyleBible(settings)`** — Art direction prompt
- Converts user settings (art style, intensity, target age) into visual style guide
- Includes color palettes, rendering techniques, composition rules
- Used in all image generation calls

**`createCharacterSheet(character)`** — Character consistency prompt
- Generates detailed visual description with proportional guidance
- Used as system instruction for character reference generation
- Extracts proportional markers (e.g., "adult male proportions", "child proportions")

**`createPagePrompt(pageData, characters, previousPages, styleBible)`** — Full page illustration prompt
- Combines: caption, character references, previous page context, style bible
- **Unified Reality Layer** (if crowd detected):
  - Applies proportional guidance from all characters
  - Enforces consistent scale and style across all figures
  - Prevents main characters from having different proportions than background figures
- Includes safety guidelines, cultural sensitivity, age-appropriateness

**`createUnifiedRealityPrompt(characters, caption)`** — Proportional consistency layer
- Detects crowd scenes via keyword analysis ("crowd", "soldiers", "many people")
- Extracts proportional guidance from character descriptions
- Creates unified prompt enforcing same proportions for all figures

### Summarization Pipeline (`src/lib/summarize.ts`)

**When**: Triggered automatically for texts over 15,000 characters (~30 printed pages)

**Step 1: Literary Extraction** (Gemini 2.5 Pro)
- Input: Complete story text (50K-200K+ characters)
- Output: `LiterarySummary` object with:
  - 400-500 word narrative arc (beginning → middle → end)
  - 8-12 key visual scenes with:
    - Title, description (60-80 words), narrative position (0.0-1.0)
    - Characters present, emotional tone, visual elements
  - Scene distribution enforcement: at least 2 from final third, includes climax/ending
  - Character essences (visual descriptions, roles, arcs)
  - 8-10 memorable quotes
  - Thematic core, setting details
- Cost: ~$0.02-0.04 per extraction
- Time: 15-25 seconds

**Step 2: Cultural Validation** (Gemini 2.0 Flash + Google Search)
- Input: `LiterarySummary` + story title
- Process: Searches web for "most iconic moments from [title]"
- Output: `EnhancedSummary` with:
  - Iconic markers: Scenes marked as [MUST-INCLUDE] in prompts
  - Missing iconic moments: Additional scenes to add (e.g., Glass Slipper in Cinderella)
- Optional step (requires title, non-blocking on failure)
- Cost: ~$0.01 per validation
- Time: 5-10 seconds

**Fallback**: If summarization fails, falls back to beginning + ending truncation (8K chars total)

### Safety & Content Moderation

- Age-appropriate intensity capping (young ages = lower max intensity)
- Cultural sensitivity guidelines in prompts
- Gemini API has built-in safety filters (hate speech, violence, sexual content)
- No explicit content generation
- PG-rated output enforced via system instructions

## AuthN/AuthZ & Entitlements

### Authentication Flow

1. **Sign In**: User clicks "Sign in with Google" → Redirects to Google OAuth → Callback to `/auth/callback`
2. **Session Management**: Supabase stores session token in HTTP-only cookie, auto-refreshes
3. **Sign Out**: Clears session cookie, redirects to home

### Authorization

**Logged-in Users**:
- Can create stories (saved to account via `user_id`)
- Can access story library (`/my-stories`)
- Can retrieve stories from any device
- Can delete own stories

**Anonymous Users**:
- Can create stories (user_id = NULL)
- Stories NOT saved to library (ephemeral)
- Must complete generation in single session
- Cannot access `/my-stories` page

**Database-Level Security**: RLS policies prevent users from accessing other users' stories

### Entitlements (Freemium Model — Not Yet Implemented)

**Planned**:
- Free tier: 3 stories per month
- Pro tier: Unlimited stories
- Quality tier access: Free users limited to Standard Flash, Pro users get 2K/4K
- Usage tracking via `stories` table count per user

## Integrations & Webhooks

**Google OAuth**: Supabase Auth handles token exchange, no webhooks needed
**Gemini API**: RESTful API calls, no webhooks (synchronous request/response)
**Supabase Realtime**: Not currently used (could enable live collaboration in future)

**External Services**:
- **Google AI Studio**: For Gemini API key generation (manual setup)
- **Google Cloud**: Billing for Gemini API usage (pay-as-you-go)

## Observability & Ops

### Logging

**Console Logging** (development):
- `console.log()` for debugging (all phases)
- `console.error()` for API errors
- `console.warn()` for fallback scenarios (e.g., summarization failure)

**Production Logging** (Vercel):
- Serverless function logs captured automatically
- View in Vercel dashboard under Functions → Logs

### Metrics & Monitoring

**Not Yet Implemented**:
- AI cost tracking per story (calculate from model usage)
- Generation time metrics
- Error rate monitoring
- User engagement analytics

**Planned**:
- Sentry for error tracking
- Posthog for product analytics
- Custom metrics dashboard for AI costs

### Health Checks

**API Route Health**: No dedicated health endpoint
**Database Health**: Supabase status page: https://status.supabase.com
**AI Service Health**: Gemini API status: https://status.cloud.google.com

### Feature Flags

**Environment Variables**:
- `ENABLE_NANO_BANANA_PRO` (default: true) — Enable quality tiers
- `FORCE_QUALITY_TIER` (optional) — Override quality for testing ("standard-flash" | "premium-2k" | "professional-4k")

### Migrations

**Database Migrations**: Managed via Supabase SQL editor (manual)
**No ORM**: Direct SQL for schema changes
**Version Control**: Schema changes tracked in `supabase/migrations` directory (if using Supabase CLI)

## Change Log

| Date | Summary | Affected Sections |
|------|---------|-------------------|
| 2025-12-03 | Added real-time progress polling during planning phase (1.5s interval, reads `current_step` from Supabase); improved Reader caption formatting (left-aligned, smaller font, sentence-based paragraph splitting) | Feature → Power Map, Architecture Overview (client polling), UI Components (Reader.tsx) |
| 2025-12-03 | Added AI-powered title extraction for pasted/uploaded stories during planning phase; titles auto-update from "Untitled Story" to AI-generated 2-6 word titles | Feature → Power Map (Story Planning), How It Works (Phase 1), Data & Storage (stories.title) |
| 2025-12-03 | Restored warm storybook aesthetic (amber/sage/terracotta palette) and WorkflowStepper component; reverted editorial design (ink black/sand) from commit 036c41b | Design System (implicit - not yet documented in this file) |
| 2025-12-03 | Added intelligent long-text summarization pipeline with cultural validation; added unified reality prompt system for proportional consistency | Feature → Power Map, Architecture Overview, AI Components, Data & Storage |
| 2025-11-26 | UI/UX redesign with modern editorial aesthetic; numeric age input; functional intensity settings | (Previous documentation not tracked) |

<!-- MANUAL-NOTES: keep -->
## Notes

**Testing Recommendations**:
- Test with classic literature (The Iliad, Peter Pan, Alice in Wonderland)
- Validate summarization quality with 50K+ character texts
- Test proportional consistency with crowd scenes
- Verify cultural validation captures iconic moments
- Test title extraction with paste/upload flow (verify "Untitled Story" → AI-generated title)

**Known Limitations**:
- Gemini 2.5 Pro model name may be outdated (`gemini-2.5-pro-preview-06-05`)
- Cultural validation is best-effort (non-blocking)
- Summarization adds 15-30 seconds for long texts
- AI-extracted titles may not always match user expectations (no manual editing UI yet)

**Future Enhancements**:
- Integrate WorkflowStepper, CharacterReviewPanel, PlanReviewPanel into checkpoint workflow
- Add user-facing summarization progress indicator
- Cache summarization results for re-used stories
- Update to latest Gemini model names
- Add manual title editing UI in story library and studio header
- Show title extraction step in WorkflowStepper progress indicator
<!-- /MANUAL-NOTES -->
