# UI/UX Redesign Specification

## Executive Summary

Transform the Storybook Generator from a generic AI tool into a warm, purposeful creative workspace that evokes the craftsmanship of children's book illustration. Focus on establishing a coherent visual language rooted in storytelling traditions while maintaining modern usability standards.

---

## API Constraints (Gemini 3 Pro Image)

**Model:** `gemini-3-pro-image-preview`

### Technical Limits
- **Max images per prompt:** 14 (for character/environment references)
- **Max image size:** 7 MB each
- **Max input tokens:** 65,536
- **Max output tokens:** 32,768
- **Accepted formats:** PNG, JPEG, WebP, HEIC, HEIF

### Supported Aspect Ratios
```
1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
```
**Recommendation:** Add `2:3`, `3:4`, `4:3`, `4:5`, `5:4` to UI options. Portrait ratios (`2:3`, `3:4`) are ideal for traditional storybook pages.

### Supported Features
- Google Search grounding (for factual accuracy)
- System instructions
- Thinking mode
- Multi-image input (character references)

### NOT Supported
- Function calling
- Code execution
- Fine-tuning
- Context caching

### Pricing (approximate)
- Text input: $2 per 1M tokens
- Image output: ~$0.134 per image (varies by resolution)

---

## Current State Analysis

### What's Working Well
- **Reader component** - Full-screen immersion with auto-hiding controls
- **Drag-and-drop storyboard** - Intuitive with good visual feedback
- **Progress tracking** - Clear and reassuring during generation
- **Dual search/upload approach** - Smart UX pattern
- **Character consistency system** - Properly uses up to 14 reference images

### What Needs Improvement
- Gradient background (green-to-blue) feels like AI template
- "BOOKS BOOKS BOOKS" hero heading is confusing
- Controls form lacks visual hierarchy
- Purple primary color doesn't connect to "storybook" concept
- Too many decorative Sparkle icons
- Inconsistent card shadows and borders
- Missing useful aspect ratios (2:3, 3:4 for book pages)

---

## Global Changes

### Color System Refinement

**New Palette for `globals.css`:**

```css
:root {
  /* Primary: Warm storybook tan/amber (evokes aged paper, warmth) */
  --primary: 35 65% 55%;
  --primary-foreground: 0 0% 100%;

  /* Secondary: Soft sage green (natural, calming, illustrative) */
  --secondary: 145 25% 88%;
  --secondary-foreground: 145 45% 25%;

  /* Accent: Muted terracotta (warmth, creativity) */
  --accent: 15 45% 65%;
  --accent-foreground: 15 45% 15%;

  /* Background: Soft cream instead of pure white */
  --background: 40 25% 97%;
  --foreground: 25 15% 20%;

  /* Card: Slightly warmer white */
  --card: 40 20% 99%;
  --card-foreground: 25 15% 20%;

  /* Muted tones: warmer grays */
  --muted: 35 15% 92%;
  --muted-foreground: 25 10% 45%;

  /* Border: softer, less stark */
  --border: 35 15% 88%;
  --input: 35 15% 88%;
  --ring: 35 65% 55%;
}
```

### Typography Hierarchy

**Add to `globals.css`:**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

:root {
  --font-heading: 'Fraunces', serif;
  --font-body: 'Inter', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading), serif;
  font-weight: 600;
  letter-spacing: -0.02em;
}

body {
  font-family: var(--font-body), sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

.text-display {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.font-heading {
  font-family: var(--font-heading), serif;
}
```

### Motion & Interaction

```css
:root {
  --ease-smooth: cubic-bezier(0.33, 1, 0.68, 1);
  --duration-normal: 250ms;
}

.transition-smooth {
  transition: all var(--duration-normal) var(--ease-smooth);
}

.hover-lift {
  transition: transform var(--duration-normal) var(--ease-smooth),
              box-shadow var(--duration-normal) var(--ease-smooth);
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.12);
}
```

---

## Component Specifications

### 1. HomePage Hero Section

**File:** `src/app/page.tsx`

**Remove gradient background:**
```tsx
// Replace
className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50"
// With
className="min-h-screen bg-background"
```

**Redesign hero heading:**
```tsx
<h1 className="text-display font-heading text-foreground max-w-3xl mx-auto">
  Turn Stories Into
  <span className="block text-primary mt-2">Illustrated Picture Books</span>
</h1>
<p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-6">
  AI-powered illustration tool for parents, educators, and storytellers.
  Upload any story and watch it transform into a custom children's book.
</p>
```

**Simplify brand badge:**
```tsx
<div className="mb-6">
  <span className="inline-block text-sm font-medium text-muted-foreground tracking-wide uppercase">
    Storybook Generator
  </span>
</div>
```

---

### 2. Search Interface

**File:** `src/app/page.tsx`

```tsx
<form
  onSubmit={handleStorySearch}
  className="relative flex items-center gap-3 bg-card rounded-xl border-2 border-border p-3 transition-smooth focus-within:border-primary focus-within:shadow-md"
>
  <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
  <Input
    className="flex-1 border-none shadow-none focus-visible:ring-0 text-base h-12 bg-transparent"
    placeholder="Search for a classic tale (e.g., The Tortoise and the Hare)"
    value={storyTitle}
    onChange={(e) => setStoryTitle(e.target.value)}
  />
  <Button type="submit" disabled={isSearching} size="lg" className="rounded-lg px-6 h-11">
    {isSearching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching</> : 'Search'}
  </Button>
</form>
```

**Key changes:**
- Remove gradient glow wrapper
- Change `rounded-full` to `rounded-xl`
- Remove Sparkles icon from button
- Change "Find Story" → "Search"

---

### 3. Status Messages

**Use left-border accent pattern:**

```tsx
// Error
<div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 text-red-900">
  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
  <div className="text-sm"><strong>Search Failed:</strong> {searchError}</div>
</div>

// Success
<div className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-center gap-3 text-green-900">
  <CheckCircle className="h-5 w-5 flex-shrink-0" />
  <span className="font-medium text-sm">Story loaded! {textInput.length} characters ready.</span>
</div>
```

---

### 4. Controls Component

**File:** `src/components/Controls.tsx`

**Group settings into sections:**

```tsx
<div className="space-y-8">
  {/* STORY SETTINGS */}
  <div>
    <h3 className="text-base font-semibold text-foreground mb-4">Story Settings</h3>
    <div className="space-y-5">
      {/* Age Group */}
      {/* Intensity */}
    </div>
  </div>

  {/* VISUAL STYLE */}
  <div className="border-t border-border pt-8">
    <h3 className="text-base font-semibold text-foreground mb-4">Visual Style</h3>
    <div className="space-y-5">
      {/* Art Style */}
      {/* Creative Notes */}
    </div>
  </div>

  {/* TECHNICAL SETTINGS */}
  <div className="border-t border-border pt-8">
    <h3 className="text-base font-semibold text-foreground mb-4">Technical Settings</h3>
    <div className="space-y-5">
      {/* Quality Tier */}
      {/* Aspect Ratio - ADD NEW OPTIONS */}
      {/* Character Consistency */}
      {/* Search Grounding */}
    </div>
  </div>

  {/* COST ESTIMATE */}
  <div className="border-t border-border pt-6">
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Estimated Cost</span>
        <span className="text-3xl font-bold font-heading">${cost}</span>
      </div>
    </div>
  </div>
</div>
```

**Update aspect ratio options (API supports all of these):**

```tsx
// In src/lib/types.ts - update the enum
aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('2:3'),

// In Controls.tsx - add book-friendly options
<Select value={settings.aspectRatio} onValueChange={(v) => updateSetting('aspectRatio', v)}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="2:3">2:3 Portrait (Book Page)</SelectItem>
    <SelectItem value="3:4">3:4 Portrait</SelectItem>
    <SelectItem value="1:1">1:1 Square</SelectItem>
    <SelectItem value="4:3">4:3 Landscape</SelectItem>
    <SelectItem value="3:2">3:2 Landscape</SelectItem>
    <SelectItem value="16:9">16:9 Widescreen</SelectItem>
  </SelectContent>
</Select>
```

**Simplify labels:**
- "Target Age Group" → "Age Group"
- "Content Intensity Level" → "Intensity"
- "Visual Art Style" → "Art Style"
- "Additional Creative Notes" → "Creative Notes"
- "Image Quality (Nano Banana Pro)" → "Image Quality"

---

### 5. Main Settings Card

**File:** `src/app/page.tsx`

```tsx
<Card className="border border-border shadow-sm bg-card">
  <CardHeader className="border-b border-border">
    <CardTitle className="text-lg font-semibold font-heading">
      Book Settings
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-6">
    <Controls ... />
  </CardContent>
</Card>
```

**Remove:** backdrop-blur, shadow-xl, Sparkles icon, CardDescription

---

### 6. Sidebar CTA Card

**File:** `src/app/page.tsx`

```tsx
<Card className="bg-accent border-2 border-accent-foreground/20 shadow-lg">
  <CardHeader>
    <CardTitle className="font-heading">Create Your Book</CardTitle>
    <CardDescription>Review settings before generating</CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Status indicators */}
    <div className="space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <span>Story</span>
        {textInput ? (
          <Badge className="bg-green-100 text-green-800">Ready</Badge>
        ) : (
          <Badge variant="secondary">Waiting</Badge>
        )}
      </div>
      <div className="flex justify-between items-center">
        <span>Pages</span>
        <span className="font-semibold">{settings.desiredPageCount}</span>
      </div>
    </div>

    <Button onClick={handleSubmit} disabled={isProcessing} size="lg" className="w-full h-12">
      {isProcessing ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Creating...</> : 'Generate Book'}
    </Button>
  </CardContent>
</Card>
```

**Remove:** gradient background, blur circles, Sparkles icon

---

### 7. Inspiration Card

**File:** `src/app/page.tsx`

```tsx
<Card className="bg-card border border-border shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      Popular Stories
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    {['The Velveteen Rabbit', 'Alice in Wonderland', 'Peter Pan'].map((story) => (
      <button
        key={story}
        onClick={() => { setStoryTitle(story); handleStorySearch(); }}
        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-smooth flex items-center gap-2"
      >
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        {story}
      </button>
    ))}
  </CardContent>
</Card>
```

---

### 8. Studio Page Header

**File:** `src/app/studio/StudioClient.tsx`

```tsx
<div className="bg-card border-b border-border sticky top-0 z-10">
  <div className="max-w-7xl mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      {/* Left: Back + Title */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="border-l border-border pl-4">
          <h1 className="text-lg font-semibold font-heading">
            {session?.fileName || 'Untitled Story'}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>Ages {session.settings.targetAge}</span>
            <span>•</span>
            <span>{pages.length} pages</span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setIsReading(true)} disabled={pages.length === 0}>
          <Play className="h-4 w-4 mr-2" />Preview
        </Button>
        <ExportBar pages={pages} />
      </div>
    </div>
  </div>
</div>
```

**Remove:** "AI Generated Content" badge, Share button

---

### 9. Progress Card

**File:** `src/app/studio/StudioClient.tsx`

```tsx
<Card className="mb-6 border-2 border-primary/30 bg-primary/5">
  <CardHeader>
    <CardTitle className="flex items-center gap-3 text-lg">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      Generating Your Picture Book
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {currentStep && <p className="text-base font-medium">{currentStep}</p>}
      <div
        className="w-full bg-muted rounded-full h-3"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Processing...</span>
        <span className="font-semibold">{Math.round(progress)}%</span>
      </div>
    </div>
  </CardContent>
</Card>
```

---

### 10. Reader Component

**File:** `src/components/Reader.tsx`

```tsx
// Soften background
className="fixed inset-0 z-50 bg-gray-950 ..."

// Use heading font for captions
<p className="text-xl md:text-2xl font-heading leading-relaxed text-center text-white">
  {currentPage.caption}
</p>

// Larger navigation buttons
<Button className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md">
  <ChevronLeft className="h-7 w-7" />
</Button>
```

---

## Copy Rewrites

| Location | Before | After |
|----------|--------|-------|
| Hero heading | "BOOKS BOOKS BOOKS" | "Turn Stories Into Illustrated Picture Books" |
| Search button | "Find Story" | "Search" |
| Settings card | "Customize Your Book" | "Book Settings" |
| Sidebar CTA | "Ready to Create?" | "Create Your Book" |
| CTA button | "Create Book" | "Generate Book" |
| Inspiration | "Inspiration" | "Popular Stories" |
| Studio header | "Story Studio" | {fileName} (dynamic) |
| Read button | "Read Book" | "Preview" |
| Storyboard | "Story Pages" | "Your Story" |

---

## Elements to Delete

### Gradient Backgrounds
- `bg-gradient-to-br from-green-50 via-white to-blue-50`
- Gradient glow wrapper around search
- Decorative blur circles in sidebar CTA

### Decorative Icons
- BookOpen icon in brand badge
- Sparkles icon in search button
- Sparkles icon in settings card title
- Sparkles icon in CTA button

### Unnecessary Elements
- Share button (not implemented)
- "AI Generated Content" badge
- CardDescription "Tailor the experience..."
- "Try searching for:" text

### Visual Effects
- `backdrop-blur-sm` on opaque cards
- `shadow-xl` (use `shadow-sm`)
- Gradient text effects

---

## Code Changes Required

### 1. Update Aspect Ratio Options

**File:** `src/lib/types.ts`

```typescript
// Line 12 - expand enum to match API
aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('2:3'),
```

**File:** `src/app/api/generate/route.ts`

```typescript
// Line 61 - match types.ts
aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('2:3'),
```

**File:** `src/app/api/plan/route.ts`

```typescript
// Line 23 - match types.ts
aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).optional(),
```

### 2. Update Default Aspect Ratio

**File:** `src/app/page.tsx`

```typescript
// Line 37 - change default to portrait for book pages
aspectRatio: '2:3',
```

---

## Implementation Priority

### Phase 1: Foundational (Highest Impact)
1. Update color system in `globals.css`
2. Replace hero heading and description
3. Remove all gradient backgrounds
4. Add Fraunces font
5. Simplify search bar

### Phase 2: Component Refinement
6. Restructure Controls with sections
7. Update aspect ratio options (add 2:3, 3:4, etc.)
8. Redesign sidebar CTA
9. Add back navigation to Studio header
10. Simplify all form labels

### Phase 3: Polish
11. Refine status messages
12. Update Reader typography
13. Enhance progress card
14. Improve Inspiration card
15. Add ARIA accessibility attributes

---

## Files to Modify

1. `src/app/globals.css` - Colors, typography, animations
2. `src/app/page.tsx` - Hero, search, sidebar, copy
3. `src/lib/types.ts` - Aspect ratio enum
4. `src/components/Controls.tsx` - Sections, labels, aspect options
5. `src/app/api/generate/route.ts` - Aspect ratio enum
6. `src/app/api/plan/route.ts` - Aspect ratio enum
7. `src/app/studio/StudioClient.tsx` - Header, progress
8. `src/components/PageCard.tsx` - Drag handle, caption
9. `src/components/Reader.tsx` - Typography
10. `src/components/Storyboard.tsx` - Header
