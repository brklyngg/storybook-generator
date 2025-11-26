# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered children's picture book generator that transforms any story (PDF, EPUB, or text) into beautifully illustrated children's books using Google Gemini 2.0 Flash AI. The application generates age-appropriate content with consistent character designs and intricate backgrounds.

**Tech Stack:** Next.js 15, TypeScript, Google Gemini 2.0/3.0 Pro, shadcn/ui, Tailwind CSS

**Key Features:**
- Multi-format story parsing (PDF, EPUB, TXT)
- Age-customized content (3-5, 6-8, 9-12 years)
- AI-powered character consistency with reference images
- Interactive page editing and reordering
- Export to PDF and ZIP with manifest files

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

### Generation Pipeline

The story-to-book transformation follows this multi-stage pipeline:

```
File Upload → Parse → Plan → Generate → Edit → Export
```

1. **Parse** (`/api/parse`): Extract text from PDF/EPUB/TXT files
2. **Plan** (`/api/plan`): Generate story structure with exact page count
   - Creates character sheets with AI-generated reference images
   - Builds style bible from aesthetic preferences
   - Produces page-by-page captions and prompts
3. **Generate** (`/api/generate`): Create illustrations for each page
   - Uses character reference images for visual consistency
   - Applies style bible to all generations
4. **Edit**: Interactive studio for page reordering and caption editing
5. **Export**: PDF or ZIP download with manifest

### Character Consistency System

The app maintains visual consistency across pages using a sophisticated reference image system:

1. **Character Sheets** (`src/lib/prompting.ts:createCharacterSheet`):
   - Extract key features from character descriptions
   - Generate poses and consistency prompts

2. **Reference Image Generation** (`/api/plan`):
   - Creates portrait-style character reference images during planning
   - Stores as base64 data URLs in character sheets
   - Used in subsequent image generations

3. **Image Generation with References** (`/api/generate`):
   - When `characterConsistency: true`, includes character reference images
   - Passes references as `inlineData` to Gemini API
   - Model uses references to maintain visual consistency

**Key Code Path:**
- `src/app/api/plan/route.ts:117-158` - Reference image generation
- `src/app/api/generate/route.ts:144-161` - Using references in generation
- `src/components/Storyboard.tsx:42-83` - Passing references on regeneration

### AI Model Usage

**Gemini 3.0 Pro** is used throughout the application:
- Text generation and planning (`/api/plan`)
- Image generation (`/api/generate`)
- Character reference portraits

**Important:** The code references "gemini-3.0-pro" but actual deployment may use "gemini-2.0-flash" or "gemini-2.5-flash" depending on API availability. The model selection is centralized in API routes.

**Retry Logic (Added 2025-11-26):**
Both image generation endpoints now implement exponential backoff retry logic to handle intermittent 503 errors from Google's Gemini API:
- `/api/generate` - 3 retries with 1.5s base delay (1.5s, 3s, 6s)
- `/api/stories/[id]/characters/generate` - 3 retries with 2s base delay (2s, 4s, 8s)
- Automatically retries on: 503 status codes, "overloaded" messages, "rate limit" errors
- See `SESSION_SUMMARY.md` for implementation details

### Page Count Enforcement

The planning prompt includes multiple reinforcements to ensure exact page count:
- Explicit instructions repeated 4 times (src/app/api/plan/route.ts:49-69)
- Validation logging after generation (src/app/api/plan/route.ts:112)
- Age-appropriate intensity clamping (src/app/api/plan/route.ts:44)

### Storage Architecture

Dual-layer client-side persistence (src/lib/storage.ts):
- **Primary:** IndexedDB (large binary data like images)
- **Fallback:** localStorage (if IndexedDB unavailable)
- **Auto-cleanup:** 7-day retention policy

Session data includes:
- Source text and filename
- Book settings (age, intensity, style)
- Generated pages with images (base64)
- Character sheets with reference images
- Metadata (tokens used, estimated cost)

## API Routes

### POST /api/parse
Extracts text from uploaded files.

**Request:**
```typescript
{
  file: File, // PDF, EPUB, or TXT
  fileType: 'pdf' | 'epub' | 'txt'
}
```

**Response:**
```typescript
{
  text: string,
  metadata: { pages?: number, title?: string }
}
```

### POST /api/plan
Generates complete story structure with character references.

**Request:**
```typescript
{
  text: string,
  settings: {
    targetAge: '3-5' | '6-8' | '9-12',
    harshness: number, // 0-10
    aestheticStyle: string,
    freeformNotes: string,
    desiredPageCount: number, // 10-30
    characterConsistency: boolean
  }
}
```

**Response:**
```typescript
{
  pages: Array<{
    pageNumber: number,
    caption: string,
    prompt: string
  }>,
  characters: Array<CharacterSheet>, // Includes referenceImage
  styleBible: StyleBible,
  theme: string
}
```

**Critical Implementation Detail:**
Character reference images are generated during planning (lines 117-158). Each character gets an AI-generated portrait stored as `referenceImage` in the character sheet. This is essential for character consistency.

### POST /api/generate
Generates a single page illustration with character consistency.

**Request:**
```typescript
{
  pageIndex: number,
  caption: string,
  stylePrompt: string,
  characterConsistency: boolean,
  characterReferences?: Array<{
    name: string,
    referenceImage: string // base64 data URL
  }>
}
```

**Response:**
```typescript
{
  imageUrl: string, // base64 data URL
  prompt: string,
  warnings: string[],
  metadata: {
    model: string,
    timestamp: number,
    pageIndex: number
  }
}
```

**Character Consistency Logic:**
- When `characterConsistency: true`, extracts base64 from `characterReferences`
- Adds each reference as `inlineData` to Gemini API call (lines 144-161)
- Model uses these references to maintain consistent character appearance

### POST /api/export/pdf
Exports complete book as PDF with embedded images.

### POST /api/export/zip
Exports as ZIP archive with individual image files and JSON manifest.

## Key Components

### Controls.tsx
Settings panel for book generation with form validation:
- Age group selector
- Intensity slider (0-10)
- Art style input
- Page count input (10-30, enforced)
- Character consistency toggle

### Storyboard.tsx
Main editing interface with drag-and-drop page reordering:
- Uses `react-sortablejs` for drag-and-drop (client-side only)
- Handles page updates and regeneration
- **Critical:** Passes character references to regeneration API (lines 44-50)

### PageCard.tsx
Individual page editor card:
- Caption editing
- Image display
- Regenerate button
- Metadata display

### Reader.tsx
Full-screen reading mode for generated books.

## Prompting System

All AI prompts are centralized in `src/lib/prompting.ts`:

**Style Bible Creation** (`createStyleBible`):
- Extracts art style, color palette, lighting from user input
- Enforces child-friendly composition rules
- Includes "do nots" for safety

**Character Sheets** (`createCharacterSheet`):
- Defines consistency prompts
- Extracts key visual features
- Suggests common poses

**Page Prompts** (`createPagePrompt`):
- Combines scene goal, composition, character refs, and style
- Includes safety constraints
- Specifies technical requirements

## Common Development Tasks

### Adding a New Age Group
1. Update `BookSettingsSchema` in `src/lib/types.ts`
2. Add age guidelines in `/api/plan/route.ts:38-42`
3. Update UI select in `src/components/Controls.tsx`

### Changing AI Models
Update model strings in:
- `src/lib/gemini.ts` (if using direct imports)
- `src/app/api/plan/route.ts:36`
- `src/app/api/generate/route.ts:41`

### Modifying Safety Settings
Edit safety thresholds in:
- `src/lib/gemini.ts:35-52`
- `src/app/api/generate/route.ts:47-64`

### Adjusting Page Count Limits
Update constraints in:
- `src/lib/types.ts:8` (Zod schema)
- `src/app/api/plan/route.ts:19` (validation)
- UI controls in `src/components/Controls.tsx`

## Cost Monitoring

Current cost model (~$0.80 per 20-page book):
- Text processing: ~$0.02
- Image generation: 20 × $0.039 = ~$0.78

Costs are estimated and logged in session metadata:
```typescript
metadata: {
  totalTokensUsed: number,
  estimatedCost: number
}
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

### Character Reference Images
The character consistency feature depends on base64-encoded reference images:
- Generated during initial planning phase
- Stored in character sheets as data URLs
- Passed to Gemini API as `inlineData` in subsequent generations
- **Do not remove** reference image generation from `/api/plan` without updating the entire consistency system

### Model Capabilities
The code assumes Gemini 3.0 Pro supports both text and image generation. If actual API access differs:
- Fallback to placeholder images is implemented
- Warnings are returned to the user
- Check console logs for "Image generation not available" messages

### File Parsing
- PDF parsing uses `unpdf` (serverless-friendly)
- EPUB parsing uses `epub2`
- Both are marked as `serverExternalPackages` in Next.js config

### Client-Side Storage Limits
IndexedDB/localStorage can store substantial data, but monitor storage usage:
- Each base64 image: ~500KB-1MB
- 20-page book: ~10-20MB total
- Use `storage.getStorageUsage()` to monitor
- Auto-cleanup runs for sessions older than 7 days

### Drag-and-Drop
`react-sortablejs` is dynamically imported with `ssr: false` because it requires DOM access. Do not attempt SSR for Storyboard component.
