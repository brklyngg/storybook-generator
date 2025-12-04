# xAI Grok Aurora Fallback Implementation Spec

## Overview

Add xAI Grok Aurora as a fallback image generation model when Gemini 3 Pro Image Preview returns 503 "overloaded" errors. The fallback should be seamless to the user.

---

## Current Limitation (Important)

**xAI's reference image input is NOT yet available via the public API.** The Aurora model supports image-to-image on the X platform, but the API currently only exposes:
- Text-to-image generation (`grok-2-image`)
- Image understanding/vision (`grok-2-vision-latest`)

This means:
- **With character references**: Gemini 3 Pro remains the only option (retry until success)
- **Without character references**: xAI can serve as a reliable fallback

### Recommended Strategy
```
If characterConsistency enabled AND characterReferences.length > 0:
    → Use Gemini 3 Pro only (extended retries)
Else:
    → Try Gemini 3 Pro → Fall back to xAI after 3 failures
```

---

## Architecture

### New Dependencies

```bash
npm install openai
```

The `openai` package is used because xAI's API is OpenAI SDK-compatible.

### Environment Variables

Add to `.env.local`:
```
XAI_API_KEY=xai-xxxxx
```

Optional configuration:
```
ENABLE_XAI_FALLBACK=true          # Feature flag (default: true)
XAI_FALLBACK_THRESHOLD=3          # Gemini failures before fallback (default: 3)
```

### File Changes

| File | Change |
|------|--------|
| `src/lib/xai-client.ts` | **NEW** - xAI client wrapper |
| `src/app/api/generate/route.ts` | Add fallback logic after Gemini retries fail |
| `CLAUDE.md` | Document the fallback behavior |

---

## Implementation Details

### 1. xAI Client (`src/lib/xai-client.ts`)

```typescript
import OpenAI from 'openai';

const xaiClient = process.env.XAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })
  : null;

export interface XAIImageResponse {
  imageUrl: string;  // base64 data URL
  model: string;
  cost: number;
}

export async function generateImageWithXAI(
  prompt: string,
  options?: {
    n?: number;  // 1-10 images
  }
): Promise<XAIImageResponse> {
  if (!xaiClient) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const response = await xaiClient.images.generate({
    model: 'grok-2-image',
    prompt,
    n: options?.n || 1,
    response_format: 'b64_json',  // Get base64 instead of URL
  });

  const imageData = response.data[0];

  return {
    imageUrl: `data:image/jpeg;base64,${imageData.b64_json}`,
    model: 'grok-2-image',
    cost: 0.07,  // $0.07 per image
  };
}

export function isXAIAvailable(): boolean {
  return !!xaiClient;
}
```

### 2. Fallback Logic in `/api/generate/route.ts`

```typescript
import { generateImageWithXAI, isXAIAvailable } from '@/lib/xai-client';

// Inside the POST handler, after the Gemini try/catch block:

} catch (error: any) {
  console.warn('Gemini image generation failed:', error.message);

  const isOverloaded = error.message?.includes('503') ||
                       error.message?.includes('overloaded');

  // Attempt xAI fallback if:
  // 1. Gemini is overloaded (not a content policy rejection)
  // 2. xAI is configured
  // 3. No character references needed (xAI doesn't support them yet)
  const canUseXAIFallback = isOverloaded &&
                            isXAIAvailable() &&
                            process.env.ENABLE_XAI_FALLBACK !== 'false' &&
                            (!characterConsistency || !characterReferences?.length);

  if (canUseXAIFallback) {
    console.log('⚡ Falling back to xAI Grok Aurora...');

    try {
      const xaiResult = await generateImageWithXAI(
        `${caption}\n\nStyle: ${stylePrompt}\n\nCreate a children's book illustration.`
      );

      imageUrl = xaiResult.imageUrl;
      warnings.push('Generated with xAI fallback (Gemini was overloaded)');
      selectedModel = 'grok-2-image (fallback)';

    } catch (xaiError: any) {
      console.error('xAI fallback also failed:', xaiError.message);
      // Fall through to placeholder
    }
  }

  // If we still don't have an image, use placeholder
  if (!imageUrl) {
    const colors = ['8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444'];
    const bgColor = colors[pageIndex % colors.length];
    imageUrl = `https://via.placeholder.com/512x512/${bgColor}/FFFFFF?text=Page+${pageIndex + 1}`;
    warnings.push('Image generation unavailable - using placeholder');
  }
}
```

### 3. Extended Retries for Character Consistency

When character references are present, we can't fall back to xAI, so extend retries:

```typescript
// Determine retry strategy based on whether we can fallback
const hasCharacterRefs = characterConsistency && characterReferences?.length > 0;
const maxRetries = hasCharacterRefs ? 5 : 3;  // More retries if no fallback available
const baseDelayMs = hasCharacterRefs ? 2000 : 1500;

const result = await retryWithBackoff(
  () => model.generateContent(contentParts),
  maxRetries,
  baseDelayMs
);
```

---

## API Response Changes

The response metadata will indicate which model was used:

```json
{
  "imageUrl": "data:image/jpeg;base64,...",
  "warnings": ["Generated with xAI fallback (Gemini was overloaded)"],
  "metadata": {
    "model": "grok-2-image (fallback)",
    "cost": 0.07,
    "fallbackUsed": true,
    "originalModel": "gemini-3-pro-image-preview"
  }
}
```

---

## Cost Comparison

| Model | Cost/Image | Quality | Character Refs |
|-------|-----------|---------|----------------|
| Gemini 3 Pro Image | ~$0.04 | Highest | Up to 14 |
| xAI Grok Aurora | ~$0.07 | High | Not via API |

**Estimated impact**: If 20% of requests fall back to xAI, average cost increases from $0.04 to ~$0.046/image.

---

## UI Considerations

Optionally show a subtle indicator when fallback was used:

```tsx
// In Storyboard.tsx or page display
{page.metadata?.fallbackUsed && (
  <span className="text-xs text-amber-600">
    Generated with backup model
  </span>
)}
```

---

## Testing Plan

1. **Unit test xAI client**
   - Mock successful generation
   - Mock API errors

2. **Integration test fallback logic**
   - Simulate Gemini 503 → verify xAI is called
   - Simulate both failing → verify placeholder

3. **Manual test**
   - Set `FORCE_GEMINI_503=true` env var to simulate overload
   - Verify fallback works end-to-end

---

## Rollout Plan

1. **Phase 1**: Add xAI client and feature flag (disabled by default)
2. **Phase 2**: Enable for non-character-ref generations only
3. **Phase 3**: Monitor success rates and costs
4. **Future**: When xAI adds reference image API support, expand fallback

---

## Open Questions

1. **Should we notify users** when fallback is used, or keep it seamless?
2. **Should xAI fallback be opt-in** via a user setting?
3. **Rate limiting**: xAI allows 5 requests/second - is this sufficient?

---

## References

- [xAI Image Generation Docs](https://docs.x.ai/docs/guides/image-generations)
- [xAI API Models](https://docs.x.ai/docs/models)
- [Grok Image Generation Release](https://x.ai/news/grok-image-generation-release/)
