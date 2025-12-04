# Scalability Roadmap

This document consolidates findings from two deep-dive analyses on scaling the Storybook Generator for thousands of users.

---

## Part 1: Image Generation Scaling

### Current Problem
- Single Gemini API key exhausts quota after ~10 images
- 429 errors: "Quota exceeded for generate_requests_per_model_per_day"
- A single 15-page book uses 18-24 API calls

### Current Capacity
| Tier | Daily Limit | Books/Day |
|------|-------------|-----------|
| Free | 25 requests | ~1 book |
| Tier 1 (Paid) | 1,000 requests | ~40-50 books |
| Tier 2 | 2,500 requests | ~100 books |

### Recommended Architecture
```
User Request → Rate Limiter → Job Queue → Provider Pool → Webhook Response
                                              ↓
                                    Gemini → xAI → Stability
                                    (fallback chain)
```

### Provider Fallback Chain
| Provider | Cost/Image | Supports Refs | Use Case |
|----------|-----------|---------------|----------|
| Vertex AI (Gemini 3) | $0.04-0.24 | Yes (14 refs) | Primary |
| xAI Grok Aurora | $0.07 | No | Simple scenes fallback |
| Stability AI SD 3.5 | $0.04-0.08 | No | Third fallback |

**Critical:** Only Gemini supports reference images. Character consistency pages have NO fallback.

### Implementation Steps

**Immediate (This Week):**
1. Enable Google Cloud billing → 40x quota increase
2. Install Upstash via Vercel Marketplace for rate limiting
3. Implement xAI fallback for non-character-ref pages (spec in `docs/xai-fallback-spec.md`)

**Next 2 Weeks:**
1. Migrate from Gemini API to Vertex AI (dynamic quotas)
2. Implement job queue with Upstash QStash
3. Add Supabase Realtime for live progress

**Before Launch:**
1. Implement Stripe subscriptions
2. Add all three fallback providers
3. Build usage tracking dashboard
4. Load test with 100+ concurrent generations

### Recommended Pricing Model
| Plan | Price | Books/Mo | Margin |
|------|-------|----------|--------|
| Free | $0 | 1 (watermarked) | Marketing |
| Starter | $9.99/mo | 5 books | 75% |
| Creator | $24.99/mo | 15 books | 70% |
| Pay-per-book | $2.99-12.99 | n/a | 63-73% |

### Cost Projections
- **1,000 books/month:** ~$835/month (break-even: 84 subscribers at $9.99)
- **10,000 books/month:** ~$6,200/month → ~$12,475 revenue (50% margin)

---

## Part 2: Long-Text Processing Scaling

### Current Problem
Processing "The Odyssey" (690K characters):
- Literary extraction: **74.1 seconds**
- Total planning: **~3 minutes**
- Actual cost: **~$0.25** (not $0.02-0.05 as documented)

### Critical Issue: Timeout Failure
| Timeout | Source | Status |
|---------|--------|--------|
| 26s | Netlify config | **FAIL** |
| 60s | Vercel Pro default | **FAIL** |
| 300s | Vercel Pro max | **PASS** |

**Long texts fail 100% in current production configuration.**

### Issues Summary
| Issue | Severity | Impact |
|-------|----------|--------|
| Timeout too short | CRITICAL | Long texts fail 100% |
| No caching | HIGH | Re-summarize same story (~$0.25 waste) |
| Cost docs inaccurate | MEDIUM | Budget surprises |
| No max text length | MEDIUM | Could exceed context window |

### Implementation Steps

**Immediate (Deploy-blocking):**

1. **Fix timeout** - Create `vercel.json`:
```json
{
  "functions": {
    "src/app/api/stories/[id]/plan/route.ts": {
      "maxDuration": 300
    }
  }
}
```

2. **Add text length cap** in `summarize.ts`:
```typescript
const MAX_TEXT_LENGTH = 1_000_000;
if (text.length > MAX_TEXT_LENGTH) {
  throw new Error(`Text exceeds maximum length`);
}
```

**Short-term:**

3. **Implement summary caching**:
```typescript
const textHash = crypto.createHash('md5').update(text).digest('hex').slice(0, 12);
const cacheKey = `summary:${title}:${textHash}`;
// Check Supabase for cached summary before processing
```

4. **Tiered model selection**:
```typescript
function selectModel(textLength: number) {
  if (textLength < 50_000) return 'gemini-2.0-flash';
  if (textLength < 200_000) return 'gemini-2.5-flash';
  return 'gemini-2.5-pro';
}
```

**Long-term:**

5. Background job processing for texts >100K chars
6. Chunked summarization for texts >500K chars

### Updated Cost Estimates
| Text Size | Characters | Example | Cost | Time |
|-----------|------------|---------|------|------|
| Short | <15K | Short story | $0.00 | 0s |
| Medium | 15K-50K | Novella | $0.02-0.05 | 15-25s |
| Long | 50K-200K | Novel | $0.05-0.15 | 30-50s |
| Epic | 200K-700K | War & Peace | $0.15-0.30 | 60-90s |
| Max | 700K-1M | Multi-volume | $0.30-0.40 | 90-120s |

---

## Priority Order

### Phase 1: Critical Fixes (Before any production traffic)
- [ ] Fix serverless timeout (26s → 300s)
- [ ] Enable Google Cloud billing (25 → 1,000 requests/day)
- [ ] Add 1M character cap

### Phase 2: Quick Wins (Next 2 weeks)
- [ ] Implement xAI fallback for non-character pages
- [ ] Add summary caching for popular stories
- [ ] Use cheaper models for moderately long texts

### Phase 3: Scale Architecture (Before launch)
- [ ] Migrate to Vertex AI (dynamic quotas)
- [ ] Implement Upstash job queue
- [ ] Add multi-provider fallback chain
- [ ] Implement Stripe subscriptions

### Phase 4: Optimization (Post-launch)
- [ ] Background processing for long texts
- [ ] Chunked summarization
- [ ] Usage analytics dashboard
- [ ] Load testing suite

---

## Sources
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Vertex AI Dynamic Shared Quota](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/quotas)
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Upstash Vercel Integration](https://upstash.com/docs/redis/howto/vercelintegration)
- [Discord Scales Midjourney](https://www.infoq.com/news/2024/01/discord-midjourney-performance/)
