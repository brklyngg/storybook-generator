# Storybook Generator - How It Works

**Documentation Date:** November 26, 2025

This document explains the internal logic of the Storybook Generator, detailing how user inputs flow through the system to create stories, text, and images.

---

## Table of Contents

1. [High-Level Pipeline](#high-level-pipeline)
2. [User Inputs and Their Effects](#user-inputs-and-their-effects)
3. [Story and Text Generation](#story-and-text-generation)
4. [Image Generation Logic](#image-generation-logic)
5. [Composition and Visual Variety](#composition-and-visual-variety)
6. [Current Gaps and Limitations](#current-gaps-and-limitations)
7. [Key Files Reference](#key-files-reference)

---

## High-Level Pipeline

```
Upload → Parse → Plan → Character Refs → Generate Images → Edit → Export
```

| Stage | API Route | Purpose |
|-------|-----------|---------|
| Parse | `/api/parse` | Extract text from PDF/EPUB/TXT |
| Plan | `/api/plan` | Generate story structure, page captions, image prompts, character list |
| Character Refs | `/api/stories/[id]/characters/generate` | Create reference portraits for visual consistency |
| Generate | `/api/generate` | Create illustration for each page |
| Export | `/api/export/pdf` or `/api/export/zip` | Package final book |

---

## User Inputs and Their Effects

All user inputs are collected in `/src/components/Controls.tsx` and defined in `/src/lib/types.ts`.

### Story Settings

| Input | Type | Range | Effect | Code Location |
|-------|------|-------|--------|---------------|
| **Target Age** | number | 3-18 | Affects language complexity, visual density, content appropriateness, intensity capping | `Controls.tsx`, `plan/route.ts:55-71` |
| **Intensity** | number | 0-10 | Controls dramatic content level (capped by age) | `plan/route.ts:69-71, 93, 106, 136` |
| **Page Count** | number | 5-30 | Determines how many scenes to extract from story | `plan/route.ts:97, 128, 148-150` |

### Visual Style Settings

| Input | Type | Effect | Code Location |
|-------|------|--------|---------------|
| **Aesthetic Style** | string | Art style, color palette, lighting style | `prompting.ts:3-93` |
| **Creative Notes** | string | Additional themes/elements to emphasize | `plan/route.ts:94` |
| **Character Consistency** | boolean | Whether to use reference images | `generate/route.ts:255-275` |

### Technical Settings

| Input | Type | Default | Effect | Code Location |
|-------|------|---------|--------|---------------|
| **Quality Tier** | enum | standard-flash | Resolution (1K/2K/4K) | `generate/route.ts:126-127` |
| **Aspect Ratio** | enum | 2:3 | Image dimensions | `generate/route.ts:213` |

---

## Story and Text Generation

### How the Story is Broken into Pages

**Location:** `/src/app/api/plan/route.ts` lines 74-157

The planning phase sends the source text to Gemini with instructions to:

1. **Analyze the story** (lines 79-85):
   - Identify core emotional arc and theme
   - Determine protagonist's journey
   - Find visually compelling scenes
   - Consider what moments the target age would find engaging
   - Think about pacing

2. **Apply age-appropriate guidelines** (lines 55-67):
```typescript
const getAgeGuidelines = (age: number): string => {
  if (age <= 5) {
    return 'Very simple language, basic concepts, gentle themes, no scary elements, bright and cheerful imagery';
  } else if (age <= 8) {
    return 'Simple sentences, adventure themes, mild challenges, positive outcomes, engaging action';
  } else if (age <= 12) {
    return 'More complex plots, character development, moral lessons, age-appropriate conflicts, sophisticated storytelling';
  } else {
    return 'Advanced narratives, nuanced themes, complex emotional depth, mature conflict resolution, sophisticated visual storytelling';
  }
}
```

3. **Cap intensity based on age** (lines 69-71):
```typescript
const maxIntensityForAge = settings.targetAge <= 5 ? 5 : settings.targetAge <= 8 ? 7 : 10;
const intensityLevel = Math.min(settings.harshness, maxIntensityForAge);
```

4. **Select scenes using 8 strategic principles** (lines 96-106):
   - NARRATIVE ESSENTIALS: Pivotal plot moments
   - EMOTIONAL PEAKS: Joy, discovery, challenge, resolution
   - VISUAL IMPACT: Strong visual potential and variety
   - CHARACTER DEVELOPMENT: Growth and relationships
   - PACING: Balance action, reflection, emotional beats
   - ICONIC MOMENTS: Expected scenes from known stories
   - AGE APPROPRIATENESS: Resonates with target age
   - INTENSITY: Match dramatic level to setting

5. **Handle story length mismatches** (lines 108-117):
   - **Short stories:** Break moments into multiple pages, add emotional beats, expand world-building
   - **Long stories:** Combine related moments, focus on high-value beats, summarize in captions

### Caption Generation

**Location:** `/src/app/api/plan/route.ts` lines 135-136

For each page, the AI generates:

```json
{
  "caption": "Engaging caption appropriate for a [age]-year-old reader
              (adjust complexity to age: simpler for younger, more sophisticated for older)"
}
```

The caption complexity is entirely determined by the AI based on the `targetAge` instruction.

### Character Extraction

**Location:** `/src/app/api/plan/route.ts` lines 139-143

Characters are extracted with descriptions:

```json
{
  "name": "Character name",
  "description": "PRECISE visual description: [physical features], [clothing and colors],
                  [distinctive props], [approximate age/size]"
}
```

**Role Assignment** (lines 189-197):
- First 2 characters → **Main** (highest consistency priority)
- Next 3 characters → **Supporting** (high consistency)
- Remaining → **Background** (basic consistency)

---

## Image Generation Logic

### How Image Prompts are Created

#### Step 1: Style Bible Creation

**Location:** `/src/lib/prompting.ts` lines 3-34

The style bible establishes consistent visual rules from the aesthetic style input:

```typescript
{
  artStyle: extractArtStyle(aestheticStyle),      // watercolor, cartoon, digital, sketch
  colorPalette: extractColorPalette(aestheticStyle), // warm, pastel, bright, muted
  lighting: extractLighting(aestheticStyle),      // soft, golden, bright, natural
  composition: 'child-friendly perspective, clear focal points, intricate backgrounds',
  doNots: ['dark shadows', 'scary elements', 'violent imagery', ...],
  visualDensity: extractVisualDensity(targetAge), // Age-based detail level
}
```

**Visual Density by Age** (`prompting.ts:56-69`):
| Age | Visual Density |
|-----|----------------|
| ≤5 | Simple, bold elements, large shapes, minimal background, high contrast |
| 6-8 | Moderate detail, engaging backgrounds, balanced complexity |
| 9-12 | Rich, intricate details, layered compositions, complex backgrounds |
| 13+ | Advanced visual complexity, mature artistic techniques |

#### Step 2: Planning Phase Creates Page Prompts

**Location:** `/src/app/api/plan/route.ts` line 136

The AI generates a `prompt` field for each page containing:

```
"prompt": "Detailed visual description including:
  - scene setting
  - character positions and expressions
  - environmental details
  - lighting/mood
  - action/moment
  - composition

  At intensity [X]/10, make this [dramatic/moderate/gentle].
  Use [aesthetic style] style."
```

**This is where most composition decisions are made** - the AI decides character poses, placement, and scene layout during planning.

#### Step 3: Character Reference Generation

**Location:** `/src/app/api/stories/[id]/characters/generate/route.ts`

For each character, reference images are generated:
- **Main characters:** 3 images (front portrait, side profile, expression sheet)
- **Supporting characters:** 2 images
- **Background characters:** 1 image

These references are used to maintain visual consistency across pages.

#### Step 4: Page Prompt Assembly

**Location:** `/src/lib/prompting.ts` lines 259-323 (`createPagePrompt` function)

The final prompt for each page includes:

```
SCENE OBJECTIVE: [caption]

COMPOSITION (Nano Banana Pro):
- Camera: [camera angle description]
- Layout: left space for text
- Focus on clear storytelling and strong emotional connection
- Use the rule of thirds for dynamic composition
- Create depth with foreground, midground, and background layers

CHARACTER CONSISTENCY (CRITICAL):
[character reference prompts]
MATCH PROVIDED REFERENCE IMAGES EXACTLY

STYLE REQUIREMENTS:
[style bible rules]
Professional children's book illustration quality

SAFETY & CONTENT:
child-friendly, no scary or inappropriate content
Appropriate for young children, positive emotional tone

TECHNICAL SPECS:
- High resolution, publication-ready quality
- Clear composition suitable for text overlay
- Rich, intricate backgrounds with beautiful details
```

#### Step 5: Image Generation with References

**Location:** `/src/app/api/generate/route.ts` lines 247-343

Up to 14 reference images are assembled in priority order:

| Priority | Type | Purpose |
|----------|------|---------|
| 1 | Character references | Visual consistency for characters |
| 2 | Previous 2 pages | Scene continuity and style consistency |
| 3 | Environment references | Consistent setting appearance |
| 4 | Object references | Consistent prop appearance |

These are sent to Gemini as `inlineData`:

```typescript
const contentParts = [
  { text: imageGenerationPrompt },
  { inlineData: { mimeType: 'image/jpeg', data: characterRef1 } },
  { inlineData: { mimeType: 'image/jpeg', data: characterRef2 } },
  // ... up to 14 references
];

const result = await model.generateContent(contentParts);
```

---

## Composition and Visual Variety

### Camera Angle Selection

**Location:** `/src/app/api/generate/route.ts` line 200

Camera angles are determined by a **simple modulo rotation**:

```typescript
cameraAngle: pageIndex % 3 === 0 ? 'wide shot' : pageIndex % 2 === 0 ? 'medium shot' : 'close-up'
```

This creates a fixed pattern:
| Page | Camera Angle |
|------|--------------|
| 1 | wide shot |
| 2 | close-up |
| 3 | medium shot |
| 4 | wide shot |
| 5 | close-up |
| 6 | medium shot |
| ... | ... |

**Camera Angle Descriptions** (`prompting.ts:326-346`):
| Angle | Description |
|-------|-------------|
| wide shot | Full scene and environment, context and scale |
| medium shot | Waist up, balancing character detail with environment |
| close-up | Facial expressions and emotional details |
| aerial | Bird's-eye view, spatial relationships |
| worm's eye | Low angle, subjects appear larger |
| dutch angle | Tilted for dynamic energy or tension |
| over shoulder | Interaction between characters |
| point of view | From character's perspective |

### Layout Hint

**Location:** `/src/app/api/generate/route.ts` line 201

Every page gets the same static layout hint:

```typescript
layoutHint: 'left space for text'
```

### Character Poses

**Location:** `/src/lib/prompting.ts` lines 200-241

Character sheets include a list of possible poses:

```typescript
// Universal poses
poses.push('standing confidently', 'walking forward');

// Context-specific poses
if (context.includes('adventure')) {
  poses.push('pointing ahead', 'looking into distance', 'climbing or exploring');
}

if (context.includes('magic')) {
  poses.push('casting spell or using magic', 'reading ancient text', 'discovering something magical');
}

// Character-type poses
if (desc.includes('warrior')) {
  poses.push('in battle stance', 'raising weapon victoriously');
}
```

**Important:** These poses are stored but **NOT actively assigned** to specific pages. The AI decides poses during planning.

### Visual Variety Guidance

**Location:** `/src/app/api/plan/route.ts` lines 152-153

The only explicit guidance about visual variety is in the validation section:

```
- Visual variety: mix of wide shots, medium shots, and close-ups
- Emotional variety: balance quiet and dynamic moments
```

This is a **vague suggestion** to the AI, not an enforced rule.

---

## Current Gaps and Limitations

### What's NOT Explicitly Controlled

| Aspect | Current Behavior | Gap |
|--------|------------------|-----|
| **Character poses** (sitting/standing) | AI decides during planning | No explicit assignment or variety tracking |
| **Foreground/background placement** | AI decides during planning | No explicit instructions |
| **Visual variety between pages** | Vague guideline to AI | No tracking or enforcement |
| **Scene distance** | Simple camera angle rotation | Not narrative-driven |
| **Avoiding similar-looking pages** | No mechanism | Could have repetitive compositions |
| **Layout** | Always "left space for text" | No variation |

### Key Limitations

1. **Composition is delegated to AI** - The planning phase tells the AI to include "composition" in the prompt but doesn't specify what it should be

2. **Camera angles are mechanical** - A simple `pageIndex % 3` rotation, not based on story content or emotional beats

3. **Poses are defined but unused** - Character sheets have pose lists but pages don't reference them

4. **No page-to-page tracking** - System doesn't track previous page compositions to ensure variety

5. **Intensity affects tone, not composition** - High intensity = "dramatic" descriptions, but doesn't change camera angles or layout

---

## Key Files Reference

### Core Logic Files

| File | Purpose | Key Functions/Lines |
|------|---------|---------------------|
| `/src/lib/types.ts` | TypeScript interfaces and Zod schemas | `BookSettingsSchema`, `StoryPlan` |
| `/src/lib/prompting.ts` | Prompt construction | `createStyleBible()`, `createCharacterSheet()`, `createPagePrompt()` |
| `/src/app/api/plan/route.ts` | Story planning and page structure | Lines 55-71 (age guidelines), 96-118 (scene selection), 128-157 (output format) |
| `/src/app/api/generate/route.ts` | Image generation | Lines 197-227 (prompt assembly), 247-343 (reference images) |
| `/src/app/api/stories/[id]/characters/generate/route.ts` | Character reference generation | Reference image creation |

### UI Components

| File | Purpose |
|------|---------|
| `/src/components/Controls.tsx` | User input collection |
| `/src/components/Storyboard.tsx` | Page display and editing |
| `/src/components/Reader.tsx` | Full-screen reading mode |
| `/src/components/PageCard.tsx` | Individual page editor |

### Supporting Files

| File | Purpose |
|------|---------|
| `/src/lib/storage.ts` | Client-side persistence (IndexedDB/localStorage) |
| `/src/lib/safety.ts` | Content safety utilities |
| `/src/lib/gemini.ts` | Gemini API configuration |

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INPUTS                                    │
│  Age (3-18) | Intensity (0-10) | Style | Notes | Pages | Consistency    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNING PHASE                                   │
│  /api/plan/route.ts                                                      │
│                                                                          │
│  1. Apply age guidelines (language, themes, visual density)              │
│  2. Cap intensity based on age                                           │
│  3. AI analyzes story and selects scenes (8 principles)                  │
│  4. AI generates caption + prompt for each page                          │
│  5. AI extracts characters with descriptions                             │
│                                                                          │
│  OUTPUT: pages[], characters[], styleBible, theme                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHARACTER REFERENCE GENERATION                        │
│  /api/stories/[id]/characters/generate/route.ts                          │
│                                                                          │
│  For each character:                                                     │
│  - Main: 3 reference images (front, side, expressions)                   │
│  - Supporting: 2 reference images                                        │
│  - Background: 1 reference image                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      IMAGE GENERATION (per page)                         │
│  /api/generate/route.ts                                                  │
│                                                                          │
│  1. Create page prompt using createPagePrompt()                          │
│  2. Determine camera angle (pageIndex % 3 rotation)                      │
│  3. Assemble up to 14 reference images:                                  │
│     - Character references (priority 1)                                  │
│     - Previous pages (priority 2)                                        │
│     - Environment refs (priority 3)                                      │
│     - Object refs (priority 4)                                           │
│  4. Send to Gemini with retry logic                                      │
│  5. Return generated image                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           STORYBOARD                                     │
│  /src/components/Storyboard.tsx                                          │
│                                                                          │
│  - Display all pages with images and captions                            │
│  - Allow drag-and-drop reordering                                        │
│  - Allow caption editing                                                 │
│  - Allow individual page regeneration                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             EXPORT                                       │
│  /api/export/pdf or /api/export/zip                                      │
│                                                                          │
│  - PDF: All pages with embedded images                                   │
│  - ZIP: Individual images + JSON manifest                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Model

**Estimated cost:** ~$0.80 per 20-page book
- Text processing: ~$0.02
- Image generation: 20 × $0.039 = ~$0.78

Costs are tracked in session metadata.

---

## Potential Improvements

To gain more control over image composition:

1. **Add composition variety tracking** - Track what was used on previous pages, require something different
2. **Make camera angles narrative-driven** - Wide shots for establishing, close-ups for emotional beats
3. **Assign specific poses per page** - Use character pose lists actively
4. **Add explicit placement instructions** - "Character A in foreground left, Character B in background right"
5. **Track scene similarity** - Detect if consecutive pages look too similar
6. **Vary layout hints** - Different text placement options per page
