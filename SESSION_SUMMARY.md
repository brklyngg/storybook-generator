# Storybook Generator - Session History

## 2025-11-26 - Fix Image Generation Reliability with Retry Logic

### Overview
Added exponential backoff retry logic to API routes handling AI image generation to address intermittent 503 "Service Unavailable" errors from Google's Gemini 3.0 Pro Image model. The model was frequently returning overloaded/rate-limit errors, causing placeholder images to appear in generated storybooks.

### Problem Analysis
- **Root Cause**: Google's `gemini-3-pro-image-preview` model experiencing severe load issues
- **Impact**: Character reference images and page illustrations failing with 503 errors
- **User Experience**: Books generated with placeholder images instead of AI-generated illustrations
- **Frequency**: Intermittent but frequent enough to affect most generation attempts

### Solution Implemented
Added `retryWithBackoff` helper function with intelligent retry logic:
- **Retry Count**: 3 attempts maximum
- **Backoff Strategy**: Exponential (1.5s, 3s, 6s for page generation; 2s, 4s, 8s for character generation)
- **Error Detection**: Automatically detects 503 status codes, "overloaded", and "rate limit" messages
- **Logging**: Console logs retry attempts for debugging

### Files Modified

#### `/src/app/api/generate/route.ts`
- Added `retryWithBackoff` helper function (lines 14-43)
- Wrapped `model.generateContent()` call with retry logic (lines 345-349)
- Configuration: 3 retries with 1.5s base delay
- Purpose: Handles main page illustration generation

#### `/src/app/api/stories/[id]/characters/generate/route.ts`
- Added identical `retryWithBackoff` helper function (lines 7-38)
- Wrapped character reference generation with retry logic (lines 105-109)
- Configuration: 3 retries with 2s base delay
- Purpose: Handles character reference portrait generation during planning phase

### Testing Results
- Successfully generated character reference images after multiple retry attempts
- Observed retry logic working correctly with console logging
- Characters "Patroclus" and "King Priam" generated successfully after retries
- Dev server remained stable throughout testing

### Technical Details

**Retry Logic Implementation:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T>
```

**Retryable Error Conditions:**
- HTTP 503 status codes
- Error messages containing "overloaded"
- Error messages containing "rate limit"
- Error status property equals 503

**Backoff Calculation:**
- Delay = baseDelayMs * 2^attempt
- Attempt 1: 1x base delay
- Attempt 2: 2x base delay
- Attempt 3: 4x base delay

### Architectural Impact
- **No breaking changes**: Existing API contracts unchanged
- **Backward compatible**: Works with existing client-side code
- **Performance**: Adds latency only when retries needed (typically 0-15 seconds)
- **Reliability**: Significantly improves success rate for image generation

### Known Limitations
- Does not address underlying Google API capacity issues
- Maximum 3 retries means some requests may still fail if service is severely degraded
- Adds latency to failed requests (can take up to 15s for 3 failed retries)
- No circuit breaker pattern implemented (every request attempts full retry sequence)

### Future Considerations
1. **Model Migration**: Consider switching to `gemini-2.5-flash` or newer models when available
2. **Circuit Breaker**: Implement circuit breaker to stop retrying during prolonged outages
3. **Fallback Models**: Add logic to fall back to alternative models if primary fails
4. **Rate Limiting**: Add client-side rate limiting to reduce API pressure
5. **Caching**: Cache generated character reference images to avoid regeneration

### Cost Impact
- Minimal cost increase (only for retry attempts)
- Failed retries don't consume API quota
- Successful retries prevent wasted planning work (would need full regeneration)

### Next Session Priorities
1. Monitor production logs for retry frequency and success rates
2. Consider implementing fallback to `gemini-2.0-flash` if 3.0 remains unstable
3. Review and potentially implement circuit breaker pattern
4. Test with various story types to ensure retry logic handles all edge cases
5. Update user-facing documentation to explain potential delays during high load

### Related Files
- `/src/app/api/generate/route.ts` - Page image generation
- `/src/app/api/stories/[id]/characters/generate/route.ts` - Character reference generation
- `/src/lib/gemini.ts` - Gemini API configuration (not modified this session)
- `CLAUDE.md` - Project documentation (should be updated with retry behavior)

### Development Environment
- Next.js dev server running at http://localhost:3000
- Using Google Gemini 3.0 Pro Image model
- Testing with "The Iliad" story (Patroclus and King Priam characters)
