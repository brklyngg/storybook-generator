# Clothing Consistency Fix - Implementation Plan

## Problem Summary

Characters in generated storybooks appear with different clothing across pages that should depict the same scene or event. For example, Odysseus wears different clothing on page 3 vs pages 1, 2, 4 - even though all pages show the same evening feast.

**Root Causes Identified:**
1. Character reference images are portrait-focused (face, expressions) - they do NOT show full outfits
2. Visual descriptions in planning include clothing text, but this is not passed to page generation
3. No concept of "scene grouping" exists - pages are generated independently
4. The consistency checker lacks scene/temporal awareness

---

## Chosen Solution: "Inline Outfit Anchoring" (Zero Additional API Calls)

The elegant solution leverages **existing data that isn't being used**:

### Key Insight
The planning phase already generates `visualDescription` containing outfit details (e.g., "bronze armor, red cape, leather sandals"), but this description is **dropped** when passing character references to page generation. The model only sees `{ name, referenceImage }` - no outfit text.

### The Fix
Pass the character description (containing outfit info) through to page generation, and use it to create "outfit anchoring" text in the prompt. This creates **text+image double-reinforcement**.

**Before:** Model sees reference image + "Odysseus"
**After:** Model sees reference image + "Odysseus: bronze Corinthian helmet, red tunic, leather sandals - EXACT OUTFIT FROM REFERENCE"

---

## Implementation (Minimal Changes)

### Change 1: Enhance Planning Prompt for Canonical Outfits

**File:** `src/app/api/stories/[id]/plan/route.ts`

Update the visualDescription instruction:

```
"visualDescription": "PRECISE visual details: [physical features], CANONICAL OUTFIT: [specific clothing with colors and materials that character wears THROUGHOUT the story], [distinctive props]"
```

### Change 2: Pass Character Descriptions to Page Generation

**File:** `src/app/studio/StudioClient.tsx` (line ~494-502)

```typescript
// BEFORE
const characterReferences = chars
  .filter(c => c.referenceImage || c.referenceImages?.length)
  .flatMap(c => {
    const refs = c.referenceImages?.length ? c.referenceImages : [c.referenceImage!];
    return refs.map((ref, idx) => ({
      name: `${c.name}${refs.length > 1 ? ` (ref ${idx + 1}/${refs.length})` : ''}`,
      referenceImage: ref
    }));
  });

// AFTER - Add description field
const characterReferences = chars
  .filter(c => c.referenceImage || c.referenceImages?.length)
  .flatMap(c => {
    const refs = c.referenceImages?.length ? c.referenceImages : [c.referenceImage!];
    return refs.map((ref, idx) => ({
      name: `${c.name}${refs.length > 1 ? ` (ref ${idx + 1}/${refs.length})` : ''}`,
      description: c.visualDescription || c.description, // ADD THIS
      referenceImage: ref
    }));
  });
```

### Change 3: Update Generate API Schema

**File:** `src/app/api/generate/route.ts`

```typescript
// Add to schema
characterReferences: z.array(z.object({
  name: z.string(),
  description: z.string().optional(), // ADD THIS
  referenceImage: z.string(),
})).optional(),
```

### Change 4: Use Description in Consistency Prompt

**File:** `src/app/api/generate/route.ts` (around line 227-237)

```typescript
if (characterConsistency && characterReferences && characterReferences.length > 0) {
  // Build per-character outfit anchors from descriptions
  const characterDetails = characterReferences
    .filter((c, i, arr) => arr.findIndex(x => x.name.split(' (ref ')[0] === c.name.split(' (ref ')[0]) === i)
    .map(c => {
      const baseName = c.name.split(' (ref ')[0];
      const outfitMatch = c.description?.match(/CANONICAL OUTFIT:\s*([^.]+)/i);
      const outfit = outfitMatch ? outfitMatch[1].trim() : null;
      return outfit ? `${baseName}: ${outfit}` : baseName;
    });

  consistencyPrompt = `
CHARACTER CONSISTENCY REQUIREMENTS (Nano Banana Pro):
- MATCH THE PROVIDED CHARACTER REFERENCE IMAGES EXACTLY
- Preserve exact facial features, hair style/color, clothing, and body proportions from references

OUTFIT ANCHORING (CRITICAL - clothing MUST match references):
${characterDetails.map(c => `- ${c}`).join('\n')}

- Characters MUST wear the EXACT clothing shown in their reference images
- Do NOT change, add, or remove any clothing items between scenes
- Do NOT vary armor, capes, hats, or accessories unless the story explicitly describes a change
...
`;
}
```

---

## Why This Solution Is Elegant

| Criterion | Assessment |
|-----------|------------|
| **API calls** | Zero additional calls |
| **Code changes** | ~15 lines total |
| **Failure risk** | Very low (description is optional, backwards compatible) |
| **Speed impact** | None |
| **Effectiveness** | High (text+image double-reinforcement) |

---

## Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `src/app/api/stories/[id]/plan/route.ts` | Add CANONICAL OUTFIT to visualDescription prompt | Low |
| `src/app/studio/StudioClient.tsx` | Pass description in characterReferences | Low |
| `src/app/api/generate/route.ts` | Accept description, build outfit anchoring prompt | Low |

---

## Testing Strategy

1. Generate a new story with 2+ characters
2. Verify `visualDescription` includes "CANONICAL OUTFIT:" text
3. Verify characters maintain consistent clothing across all pages
4. Test regeneration - should maintain outfit from description

---

## Future Enhancement (Optional)

If stories genuinely need outfit changes at specific points:

```json
{
  "pageNumber": 15,
  "outfitOverride": {
    "Odysseus": "ragged beggar's cloak, walking staff"
  }
}
```

But for 95% of children's books, characters wear the same outfit throughout.

---

## Alternative: Full Scene-Aware System (Higher Effort)

If the minimal fix isn't sufficient, a more comprehensive approach involves:

1. **Scene grouping in planning:** Add `sceneId` to pages, group pages by event
2. **Per-scene outfits:** Define character outfits per scene
3. **Scene-aware consistency checking:** Flag outfit changes within scenes

This is documented in detail in the scalability roadmap but requires more significant changes.
