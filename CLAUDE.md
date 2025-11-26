# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered children's picture book generator that transforms any story (PDF, EPUB, or text) into beautifully illustrated children's books using Google Gemini AI. The application generates age-appropriate content with consistent character designs and intricate backgrounds.

**Tech Stack:** Next.js 15, TypeScript, Google Gemini 3.0 Pro, shadcn/ui, Tailwind CSS, Supabase

**Key Features:**
- Multi-format story parsing (PDF, EPUB, TXT)
- Age-customized content (3-5, 6-8, 9-12 years)
- AI-powered character consistency with reference images
- Multiple quality tiers (standard-flash, premium-2k, premium-4k)
- Aspect ratio options (1:1, 3:2, 16:9, 9:16, 21:9)
- Interactive page editing and reordering
- Export to PDF and ZIP with manifest files
- Server-side persistence with Supabase

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

Required environment variables in `.env.local`:
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - Supabase persistence
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# OR
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Feature flags
ENABLE_NANO_BANANA_PRO=true          # Enable premium features (default: true)
DEFAULT_QUALITY_TIER=standard-flash  # Default quality tier
FORCE_QUALITY_TIER=premium-2k        # Override quality tier for testing
```

The app will warn but continue without the API key (generation features will fail gracefully with placeholders). Without Supabase, the app falls back to localStorage for session persistence.

## Core Architecture

### Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── parse/route.ts           # File parsing (PDF, EPUB, TXT)
│   │   ├── plan/route.ts            # Story planning (standalone mode)
│   │   ├── generate/route.ts        # Image generation
│   │   ├── stories/
│   │   │   ├── route.ts             # Create story (POST)
│   │   │   └── [id]/
│   │   │       ├── route.ts         # Get story (GET)
│   │   │       ├── plan/route.ts    # Plan story with DB persistence
│   │   │       └── characters/
│   │   │           └── generate/route.ts  # Generate character references
│   │   ├── story-search/route.ts    # Story search
│   │   └── export/
│   │       ├── pdf/route.ts         # PDF export
│   │       └── zip/route.ts         # ZIP export
│   ├── studio/
│   │   ├── page.tsx                 # Studio page wrapper
│   │   └── StudioClient.tsx         # Main client-side generation logic
│   ├── layout.tsx
│   └── page.tsx                     # Landing page
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── Controls.tsx                 # Settings panel
│   ├── Storyboard.tsx               # Main editing interface
│   ├── PageCard.tsx                 # Individual page editor
│   ├── Reader.tsx                   # Full-screen reading mode
│   └── ExportBar.tsx                # Export options
└── lib/
    ├── types.ts                     # TypeScript types and Zod schemas
    ├── prompting.ts                 # AI prompt generation
    ├── storage.ts                   # Client-side storage (IndexedDB/localStorage)
    ├── supabase.ts                  # Supabase client
    ├── safety.ts                    # Copyright and content safety
    ├── gemini.ts                    # Gemini AI configuration
    ├── text.ts                      # Text utilities
    └── utils.ts                     # General utilities
```

### Generation Pipeline

The story-to-book transformation follows this multi-stage pipeline:

```
File Upload → Parse → Create Story → Plan → Generate Characters → Generate Pages → Edit → Export
```

1. **Parse** (`/api/parse`): Extract text from PDF/EPUB/TXT files
2. **Create Story** (`/api/stories` POST): Initialize story record in Supabase
3. **Plan** (`/api/stories/[id]/plan`): Generate story structure
   - Creates character sheets and page prompts
   - Saves characters and pages to database
   - Returns character IDs for sequential generation
4. **Generate Characters** (`/api/stories/[id]/characters/generate`):
   - Sequential generation to avoid timeouts
   - Creates reference images for each character
   - Main characters get 3 references, supporting get 2, background get 1
5. **Generate Pages** (`/api/generate`): Create illustrations for each page
   - Uses character reference images for visual consistency
   - Supports up to 14 reference images per generation
   - Applies style bible to all generations
6. **Edit**: Interactive studio for page reordering and caption editing
7. **Export**: PDF or ZIP download with manifest

### Database Schema (Supabase)

```sql
-- Stories table
stories (
  id: uuid PRIMARY KEY,
  source_text: text,
  settings: jsonb,
  theme: text,
  status: text,        -- 'planning', 'generating', 'completed', 'error'
  current_step: text,
  created_at: timestamp
)

-- Characters table
characters (
  id: uuid PRIMARY KEY,
  story_id: uuid REFERENCES stories(id),
  name: text,
  description: text,
  role: text,          -- 'main', 'supporting', 'background'
  reference_image: text,      -- Base64 data URL (primary)
  reference_images: text[],   -- Multiple reference angles
  status: text         -- 'pending', 'generating', 'completed', 'error'
)

-- Pages table
pages (
  id: uuid PRIMARY KEY,
  story_id: uuid REFERENCES stories(id),
  page_number: integer,
  caption: text,
  prompt: text,
  image_url: text,     -- Base64 data URL
  status: text         -- 'pending', 'generating', 'completed', 'completed_with_warnings'
)
```

### Character Consistency System

The app maintains visual consistency across pages using a sophisticated reference image system:

1. **Character Sheets** (`src/lib/prompting.ts:createCharacterSheet`):
   - Extract key features from character descriptions
   - Generate poses and consistency prompts
   - Assign role-based priority (main > supporting > background)

2. **Reference Image Generation** (`/api/stories/[id]/characters/generate`):
   - Creates portrait-style character reference images
   - Main characters: 3 references (front, side, expressions)
   - Supporting characters: 2 references
   - Background characters: 1 reference
   - Stores as base64 data URLs in database

3. **Image Generation with References** (`/api/generate`):
   - Supports up to 14 reference images (Nano Banana Pro)
   - Priority order: characters → previous pages → environment → objects
   - Passes references as `inlineData` to Gemini API

**Key Code Paths:**
- `src/app/api/stories/[id]/characters/generate/route.ts` - Reference image generation
- `src/app/api/generate/route.ts:224-310` - Reference image assembly
- `src/app/studio/StudioClient.tsx:163-190` - Sequential character generation

### AI Model Usage

**Models used:**
- `gemini-3-pro-preview`: Text generation and planning
- `gemini-3-pro-image-preview`: Image generation

**Important:** Model availability may vary by region. The code includes fallback handling for unavailable models.

### Quality Tiers (Nano Banana Pro)

| Tier | Resolution | Cost/Image | Use Case |
|------|-----------|-----------|----------|
| `standard-flash` | 1K | $0.039 | Digital viewing |
| `premium-2k` | 2K | $0.134 | Digital + standard print |
| `premium-4k` | 4K | $0.240 | Professional print |

Feature flag: `ENABLE_NANO_BANANA_PRO` (default: true)

### Storage Architecture

**Server-side (Supabase):**
- Stories, characters, and pages tables
- Base64 images stored directly in text columns
- Status tracking for async generation

**Client-side (fallback):**
- IndexedDB (primary) / localStorage (fallback)
- 7-day auto-cleanup policy
- Used for legacy sessions or when Supabase unavailable

## API Routes

### POST /api/stories
Creates a new story record in database.

**Request:**
```typescript
{
  sourceText: string,
  settings: BookSettings
}
```

**Response:**
```typescript
{
  id: string,           // UUID
  source_text: string,
  settings: BookSettings,
  status: 'planning',
  created_at: string
}
```

### GET /api/stories/[id]
Fetches complete story with characters and pages.

**Response:**
```typescript
{
  story: Story,
  characters: Character[],
  pages: Page[]
}
```

### POST /api/stories/[id]/plan
Generates story structure and saves to database.

**Request:**
```typescript
{
  text: string,
  settings: BookSettings
}
```

**Response:**
```typescript
{
  characters: Character[],  // With database IDs
  pageCount: number,
  styleBible: StyleBible
}
```

### POST /api/stories/[id]/characters/generate
Generates reference images for a single character.

**Request:**
```typescript
{
  characterId: string  // UUID
}
```

**Response:**
```typescript
{
  success: boolean,
  references: number  // Count of generated images
}
```

### POST /api/generate
Generates a single page illustration.

**Request:**
```typescript
{
  storyId?: string,
  pageIndex: number,
  caption: string,
  stylePrompt: string,
  characterConsistency: boolean,
  previousPages?: Array<{ index: number, imageUrl?: string }>,
  characterReferences?: Array<{ name: string, referenceImage: string }>,
  qualityTier: 'standard-flash' | 'premium-2k' | 'premium-4k',
  aspectRatio: '1:1' | '3:2' | '16:9' | '9:16' | '21:9',
  enableSearchGrounding?: boolean,
  environmentReference?: { locationName: string, referenceImage: string },
  objectReferences?: Array<{ objectName: string, referenceImage: string }>,
  sceneTransition?: SceneTransition
}
```

**Response:**
```typescript
{
  imageUrl: string,
  prompt: string,
  warnings: string[],
  metadata: {
    model: string,
    timestamp: number,
    pageIndex: number,
    qualityTier: string,
    aspectRatio: string,
    resolution: string,
    cost: number,
    referenceImagesUsed: number,
    nanoBananaProEnabled: boolean
  }
}
```

### POST /api/parse
Extracts text from uploaded files.

**Request:** FormData with `file` and `fileType`

**Response:**
```typescript
{
  text: string,
  metadata: { pages?: number, title?: string }
}
```

### POST /api/export/pdf
Exports complete book as PDF.

### POST /api/export/zip
Exports as ZIP archive with images and JSON manifest.

## Key Components

### StudioClient.tsx
Main client-side orchestrator (`src/app/studio/StudioClient.tsx`):
- Manages generation workflow state
- Coordinates API calls sequentially
- Handles both Supabase and localStorage sessions
- Shows progress during generation

### Controls.tsx
Settings panel for book generation:
- Age group selector (3-5, 6-8, 9-12)
- Intensity slider (0-10)
- Art style input
- Page count input (10-30)
- Character consistency toggle
- Quality tier selector
- Aspect ratio selector

### Storyboard.tsx
Main editing interface:
- Uses `react-sortablejs` for drag-and-drop (client-side only)
- Handles page updates and regeneration
- Passes character references to regeneration API

### PageCard.tsx
Individual page editor:
- Caption editing
- Image display
- Regenerate button
- Metadata display

## Prompting System

All AI prompts are centralized in `src/lib/prompting.ts`:

### createStyleBible
Creates comprehensive style guide including:
- Art style, color palette, lighting
- Age-appropriate visual density
- Resolution quality settings
- Camera movement style
- Safety "do nots"

### createCharacterSheet
Generates character consistency data:
- Key features extraction
- Role-based consistency prompts
- Scale references
- Distinctive props
- Emotional range
- Story-specific poses

### createPagePrompt
Builds complete page generation prompt:
- Scene objective
- Camera angle descriptions
- Transition instructions
- Character consistency requirements
- Technical specifications

## Safety System

Located in `src/lib/safety.ts`:

### Copyright Detection
- Identifies public domain works (Alice in Wonderland, etc.)
- Flags potentially copyrighted content
- Detects recent publication patterns

### Content Safety
- Age-appropriate content validation
- Banned word detection by age group
- Intensity level enforcement
- Content sanitization helpers

## Common Development Tasks

### Adding a New Age Group
1. Update `BookSettingsSchema` in `src/lib/types.ts`
2. Add age guidelines in API routes
3. Update `extractVisualDensity()` in `src/lib/prompting.ts`
4. Add safety constraints in `src/lib/safety.ts`
5. Update UI select in `src/components/Controls.tsx`

### Changing AI Models
Update model strings in:
- `src/app/api/plan/route.ts` - `gemini-3-pro-preview`
- `src/app/api/stories/[id]/plan/route.ts` - `gemini-3-pro-preview`
- `src/app/api/stories/[id]/characters/generate/route.ts` - `gemini-3-pro-preview`
- `src/app/api/generate/route.ts` - `gemini-3-pro-image-preview`

### Adding New Quality Tiers
1. Update `BookSettingsSchema.qualityTier` in `src/lib/types.ts`
2. Add resolution mapping in `src/app/api/generate/route.ts`
3. Add cost calculation
4. Update `createStyleBible()` in `src/lib/prompting.ts`

### Adding Database Tables
1. Create migration in Supabase dashboard
2. Update types in `src/lib/types.ts`
3. Add queries in relevant API routes

## Cost Monitoring

Current cost model (per image):
- Standard Flash (1K): $0.039
- Premium 2K: $0.134
- Premium 4K: $0.240

Example 20-page book:
- Standard: ~$0.78
- Premium 2K: ~$2.68
- Premium 4K: ~$4.80

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Add environment variables
3. Deploy (auto-deploys on push to main)

### Netlify
- Character reference generation moved to separate endpoint to avoid 10s timeout
- Plan API uses parallel DB writes to minimize latency
- Consider increasing function timeout if available

### Build Configuration
- Static export not supported (uses API routes)
- Server-side rendering required for API endpoints
- `serverExternalPackages: ['unpdf', 'epub2']` in next.config.mjs
- Webpack excludes `canvas` and `encoding`

## Important Technical Notes

### Character Reference Images
- Generated separately from planning to avoid timeouts
- Main characters: 3 angles (front, side, expressions)
- Stored as base64 in database
- **Do not remove** sequential character generation without addressing timeout issues

### Reference Image Limits
- Maximum 14 reference images per generation request
- Priority: characters > previous pages > environment > objects
- Logged during generation for debugging

### Next.js 15 Route Handlers
- Dynamic params accessed via `{ params }: { params: Promise<{ id: string }> }`
- Must `await params` before using

### Model Availability
- Models may vary by region (`gemini-3-pro-preview` may not be available everywhere)
- Fallback to placeholder images implemented
- Check console for model initialization errors

### Client-Side Storage
- IndexedDB primary, localStorage fallback
- Each base64 image: ~500KB-1MB
- 20-page book: ~10-20MB total
- Auto-cleanup for sessions older than 7 days

### Drag-and-Drop
`react-sortablejs` dynamically imported with `ssr: false` - do not attempt SSR for Storyboard component.

### SynthID Watermarks
All AI-generated images include SynthID watermarks for content identification as per Google AI guidelines.
