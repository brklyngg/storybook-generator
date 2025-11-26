# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered children's picture book generator that transforms any story (PDF, EPUB, or text) into beautifully illustrated children's books using Google Gemini 2.0 Flash AI. The application generates age-appropriate content with consistent character designs and intricate backgrounds.

**Tech Stack:** Next.js 15, TypeScript, Google Gemini 2.0/3.0 Pro, shadcn/ui, Tailwind CSS, Fraunces font (Google Fonts)

**Key Features:**
- Multi-format story parsing (PDF, EPUB, TXT)
- Age-customized content (ages 3-18, numeric input)
- AI-powered character consistency with reference images
- Interactive page editing and reordering
- Export to PDF and ZIP with manifest files
- Book-friendly aspect ratios (default 2:3 portrait)
- Functional intensity settings with age-appropriate capping
- Warm, book-oriented design aesthetic (amber/sage/terracotta palette)

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

**Age Range and Intensity (Updated 2025-11-26):**
- Age input changed from enum dropdown to numeric input (3-18)
- Intensity now functionally impacts AI prompts with age-appropriate capping:
  - Ages ≤5: Max intensity 5/10 (gentle content)
  - Ages 6-8: Max intensity 7/10 (moderate drama)
  - Ages 9+: Full range 0-10
- Intensity affects tone descriptors in prompts (gentle/moderate/dramatic)

**Aspect Ratio Options (Updated 2025-11-26):**
- Expanded from 1:1 only to: 1:1, 2:3, 3:4, 4:3, 4:5, 5:4
- Default changed from 1:1 to 2:3 (portrait book page)
- Currently hidden from UI by user request (default 2:3 applied)
- Can be restored by uncommenting aspect ratio section in Controls.tsx

### Page Count Enforcement

The planning prompt includes multiple reinforcements to ensure exact page count:
- Explicit instructions repeated 4 times (src/app/api/plan/route.ts:49-69)
- Validation logging after generation (src/app/api/plan/route.ts:112)
- Age-appropriate intensity clamping (src/app/api/plan/route.ts:44)
- Page count range: 5-30 pages (reduced from 10-30 to support board books)

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
    targetAge: number, // 3-18
    harshness: number, // 0-10 (age-capped)
    aestheticStyle: string,
    freeformNotes: string,
    desiredPageCount: number, // 5-30
    characterConsistency: boolean,
    aspectRatio?: '1:1' | '2:3' | '3:4' | '4:3' | '4:5' | '5:4' // defaults to 2:3
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
- Age numeric input (3-18 years)
- Intensity slider (0-10, age-capped for younger audiences)
- Art style input
- Page count input (5-30, enforced)
- Character consistency toggle
- Organized into logical sections: Story Settings, Visual Style, Technical Settings
- Aspect ratio selector hidden by default (uncomment lines 189-208 to restore)

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

## Design System (Updated 2025-11-26)

The UI follows a warm, book-oriented aesthetic:

**Color Palette:**
- Primary: Amber (amber-600/700/800) - warm, inviting
- Secondary: Sage green (emerald-600) - natural, calming
- Accent: Terracotta (orange-600/700) - creative energy
- Background: Soft cream (stone-50) - paper-like
- Avoid: Blue/purple gradients (old design)

**Typography:**
- Headings: Fraunces serif (via Google Fonts)
- Body: Inter sans-serif
- Use `.font-heading` utility for serif headings

**Motion:**
- Transitions: `.transition-smooth` (300ms cubic-bezier)
- Hover effects: `.hover-lift` (subtle translateY + shadow)
- Avoid: Heavy animations, complex transitions

**Component Patterns:**
- Left-border accents on status messages (4px border-l)
- Soft shadows (shadow-sm, shadow-md)
- Warm hover states (amber-100/200 backgrounds)
- Section groupings with visual hierarchy

## Common Development Tasks

### Adjusting Age Range
1. Update min/max bounds in `BookSettingsSchema` (src/lib/types.ts)
2. Adjust age-capping logic in `/api/plan/route.ts:44` and `/api/stories/[id]/plan/route.ts`
3. Update numeric input bounds in `src/components/Controls.tsx`
4. Consider adding new intensity cap thresholds for extended age ranges

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
- `src/lib/types.ts` (Zod schema - currently min 5, max 30)
- `src/app/api/plan/route.ts:19` (validation)
- UI controls in `src/components/Controls.tsx`

### Restoring Aspect Ratio Selector
To re-enable aspect ratio selection in the UI:
1. Uncomment lines 189-208 in `src/components/Controls.tsx`
2. Consider adding presets (e.g., "Board Book," "Chapter Book") for better UX
3. Update form submission to include `aspectRatio` field

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
