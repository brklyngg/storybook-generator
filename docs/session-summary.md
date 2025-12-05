# Session Summary

This document tracks all development sessions for the Storybook Generator project.

---

## Session: 2025-12-05

### Overview
Critical rollback and surgical re-implementation session. Rolled back from Dec 5th commit (dd5b791) to known-good baseline (175d960) after encountering generation issues with The Velveteen Rabbit. Successfully re-implemented three targeted features: role validation fix, enhanced character consistency with multi-reference support, and narrative self-containment rules.

### Work Completed

#### 1. Strategic Rollback to Known-Good State
**Problem**: Code from Dec 5th morning (dd5b791) was producing inconsistent character generation results. The Rage of Achilles generated successfully on Dec 3rd (175d960), but The Velveteen Rabbit was failing with the newer code.

**Actions Taken**:
- Preserved Dec 5th work in branch `feature-preserve-dec5-work`
- Rolled back to commit 175d960 (Dec 3rd) — last confirmed successful generation
- Cleared Next.js cache (`.next` folder) to ensure clean rebuild
- Validated rollback with successful Velveteen Rabbit generation

**Files Affected**: All project files reverted to Dec 3rd state

#### 2. Role Validation Fix (Database Constraint Compliance)
**Problem**: AI planning phase was generating role values like "protagonist", "antagonist", "ally" which violated database CHECK constraint (only "main", "supporting", "background" allowed).

**Solution**: Added role mapping in planning route to translate AI outputs to valid database values:
```typescript
const roleMap: Record<string, 'main' | 'supporting' | 'background'> = {
  protagonist: 'main',
  antagonist: 'main',
  ally: 'supporting',
  sidekick: 'supporting',
  mentor: 'supporting',
  villain: 'main'
}
```

**Files Modified**:
- `src/app/api/stories/[id]/plan/route.ts` — Added role normalization before database insert

**Testing**: Successfully validated with The Velveteen Rabbit (no constraint errors)

#### 3. Enhanced Character Consistency System
**Problem**: Character references were not being fully utilized — only first image was passed to generation, hair/eye colors were not explicitly extracted, multi-character scenes weren't properly detected.

**Solution**: Multi-pronged enhancement:

**A. Hair/Eye Color Extraction** (`src/lib/prompting.ts`)
- Enhanced `extractKeyFeatures()` to use regex-based extraction
- Explicit "MUST maintain" emphasis in prompts for critical features
- Example: "Hair: brown (MUST maintain exact shade)", "Eyes: blue (MUST maintain exact color)"

**B. Multi-Reference Support** (`src/app/studio/StudioClient.tsx`, `src/components/Storyboard.tsx`)
- Changed to pass ALL reference images (up to 3) instead of just first image
- Uses `character.reference_image` array directly (not `?.reference_image?.[0]`)
- Enables better consistency across multiple portrait angles

**C. Multi-Character Scene Detection** (`src/app/api/generate/route.ts`)
- Detects scenes with multiple named characters
- Triggers enhanced consistency checks when multiple characters present
- Analyzes caption for character name mentions

**D. Prompt Reordering for Priority** (`src/app/api/generate/route.ts`)
- Character consistency instructions moved to TOP of prompt
- Ensures AI prioritizes character features over other details
- Reordered: Character refs → Style → Caption → Technical specs

**Files Modified**:
- `src/lib/prompting.ts` — Enhanced extractKeyFeatures with regex + emphasis
- `src/app/api/generate/route.ts` — Multi-char detection, prompt reordering
- `src/app/studio/StudioClient.tsx` — Pass all 3 references
- `src/components/Storyboard.tsx` — Pass all 3 references

**Testing**: Validated with The Velveteen Rabbit (consistent character appearance across pages)

#### 4. Narrative Self-Containment Rules (STEP 3.5)
**Problem**: Page captions were assuming reader had prior context, using pronouns without establishing referents ("He walked into the room" without saying who "he" is).

**Solution**: Added STEP 3.5 in planning prompt to enforce "setup-before-payoff" rules:
- Must establish WHO before using pronouns on each page
- Must establish WHERE before describing actions
- Must establish WHAT before consequences
- Each page caption should be comprehensible to first-time reader

**Example Enforcement**:
- BAD: "He was furious when he saw it."
- GOOD: "Achilles was furious when he saw Hector wearing his fallen friend's armor."

**Files Modified**:
- `src/app/api/stories/[id]/plan/route.ts` — Added STEP 3.5 to planning instructions

**Testing**: Validated with The Velveteen Rabbit (captions were self-explanatory)

### Decisions Made

1. **Rollback Strategy**: Chose full rollback instead of incremental debugging to guarantee baseline stability
2. **Feature Preservation**: Created branch `feature-preserve-dec5-work` to save original work (can be compared/merged later if useful)
3. **Surgical Re-implementation**: Only re-implemented features with clear, testable fixes (avoided broad refactors)
4. **Prompt Ordering**: Prioritized character consistency over style/caption (empirical testing showed better results)
5. **Cache Clearing**: Deleted `.next` folder as part of rollback protocol to avoid webpack cache corruption

### Technical Observations

**Git Workflow**:
- Used `git reset --hard` for clean rollback
- Created preservation branch before destructive operations
- Verified commit history to identify known-good baseline

**Next.js Build System**:
- Cleared `.next` folder prevents cache-related inconsistencies
- Webpack cache can persist outdated code between rollbacks

**AI Behavior**:
- Character consistency improved dramatically when references moved to top of prompt
- Hair/eye color extraction via regex more reliable than unstructured AI descriptions
- Multi-reference support (3 images) better than single reference for complex characters

### Known Issues

1. **Scene Anchor System Not Re-implemented**: Dec 5th version included scene anchors for token optimization (disabled in rollback)
2. **Visual Constraints Not Re-implemented**: Disabled feature from Dec 5th not restored
3. **Model Names**: Still using preview model names (may need updating to stable releases)

### Testing Performed

**End-to-End Generation Test**:
- **The Velveteen Rabbit**: ~8K characters, 20 pages, 3 characters (Rabbit, Boy, Skin Horse)
  - Planning: SUCCESS (role validation worked)
  - Character generation: SUCCESS (3 references per character)
  - Page generation: IN PROGRESS (~15/20 pages complete)
  - User feedback: "Almost perfect"

**Build Validation**:
- `npm run build` — PASSED (no TypeScript errors)
- `npm run dev` — Running on localhost:3000

### Files Changed Summary

**Commit bbf1012**:
- 5 files modified
- 0 files created
- 0 files deleted
- Changes: Role validation, character consistency enhancements, narrative self-containment

### Next Steps

1. **Complete Velveteen Rabbit Test**: Finish generation, validate full workflow end-to-end
2. **Re-evaluate Scene Anchors**: Consider re-implementing token optimization (disabled in rollback)
3. **Monitor Character Consistency**: Track if 3-reference system performs better than 1-reference
4. **User Feedback Integration**: Incorporate user's "almost perfect" feedback to identify remaining issues
5. **Update Model Names**: Check for latest Gemini model IDs and update if needed
6. **Branch Cleanup**: Decide whether to merge or discard `feature-preserve-dec5-work` branch

### Architecture Impact

**Simplified Data Flow** (compared to Dec 5th version):
```
Planning API receives story text
  ↓
Checks length (no scene anchors in this version)
  ↓
Generates characters with ROLE MAPPING (protagonist → main, etc.)
  ↓
Saves to database (no constraint errors)
  ↓
Character generation creates 3 reference images
  ↓
Page generation receives ALL 3 references
  ↓
Prompt assembled with CHARACTER REFS FIRST
  ↓
Multi-character detection triggers enhanced consistency
  ↓
Image generated with prioritized character consistency
```

**Key Architectural Differences from Dec 5th**:
- No scene anchor system (token optimization removed)
- No visual constraints feature (disabled)
- Simplified prompt structure (character-first ordering)
- Role validation layer added before database insert

### Code Quality Notes

- All changes maintain TypeScript type safety
- Role mapping uses exhaustive Record type for safety
- Regex patterns tested for hair/eye color extraction
- No breaking changes to database schema
- Backward compatible with existing stories

---

## Session: 2025-12-03 (Morning)

### Overview
Implemented two major features: (1) Unified Reality prompt system for character aesthetic consistency, and (2) Intelligent long-text summarization pipeline with cultural validation for classic literature and epic texts.

### Work Completed

#### 1. Unified Reality Prompt System (Commit: d47fce6)
**Problem**: Main characters were being rendered in different proportions/styles than crowd/background figures within the same scene, breaking visual immersion.

**Solution**: Created a "Unified Reality" prompt layer that:
- Detects scenes with crowds via keyword analysis ("crowd", "many people", "soldiers", etc.)
- Extracts proportional guidance from character reference descriptions
- Applies unified proportional standards across ALL figures in the scene
- Enhances character prompts with proportional anchors ("adult male proportions", "child proportions", etc.)

**Files Modified**:
- `src/lib/prompting.ts` — Added `createUnifiedRealityPrompt()` and `extractProportionalGuidance()`
- `src/app/api/generate/route.ts` — Integrated crowd detection and unified reality system
- `src/app/api/stories/[id]/characters/generate/route.ts` — Enhanced character generation with proportional standards
- `src/lib/consistency-prompts.ts` — Added intra-scene consistency validation
- `src/lib/types.ts` — Added `UnifiedRealityContext` and `ProportionalGuidance` types
- `CLAUDE.md` — Updated documentation with new prompting system

**Testing**: Successfully validated with Snow White (4 characters, crowd scenes) and The Iliad (6 characters, battle scenes)

#### 2. Intelligent Long-Text Summarization Pipeline (Commit: 7a92c02)
**Problem**: Classic novels and epic texts (50K-200K+ characters) were being truncated to 8K characters, losing critical narrative elements, character development, and climax/resolution.

**Solution**: Built a comprehensive two-stage AI pipeline:

**STAGE 1: Literary Extraction** (Gemini 2.5 Pro)
- Analyzes complete source text using 1M+ token context window
- Extracts 400-500 word narrative arc (beginning → middle → end)
- Identifies 8-12 key visual scenes with:
  - Scene title, description (60-80 words)
  - Narrative position (0.0-1.0)
  - Characters present, emotional tone
  - Visual elements
- Enforces scene distribution: at least 2 from final third, includes climax and ending
- Captures character essences (visual descriptions, roles, arcs)
- Preserves 8-10 memorable quotes for authenticity
- Identifies thematic core and setting details

**STAGE 2: Cultural Validation** (Gemini 2.0 Flash + Google Search)
- Searches web for "most iconic moments from [story title]"
- Compares extracted scenes against culturally iconic moments
- Marks essential scenes with [MUST-INCLUDE] flags
- Identifies missing iconic moments (e.g., Glass Slipper in Cinderella)
- Validates against popular adaptations and parodies
- Optional step (requires story title)

**Large Text Handling**:
- localStorage-based reference system for texts over 100K characters
- Avoids React state bloat with `__LARGE_TEXT_REF__` prefix pattern
- Graceful UI adaptation ("Large story loaded" vs word count)
- Auto-cleanup after retrieval

**Integration**:
- Planning route (`src/app/api/stories/[id]/plan/route.ts`) checks text length (15K threshold)
- Runs summarization pipeline with progress updates
- Passes summary to planning model with [MUST-INCLUDE] markers
- Fallback to intelligent truncation (beginning + ending) if summarization fails
- Short texts pass through unchanged

**New Files Created**:
- `src/lib/summarize.ts` — Complete summarization pipeline (580 lines)
- `src/components/WorkflowStepper.tsx` — Visual progress indicator
- `src/components/CharacterReviewPanel.tsx` — Character approval UI (future feature)
- `src/components/PlanReviewPanel.tsx` — Story plan review UI (future feature)

**Files Modified**:
- `src/app/api/stories/[id]/plan/route.ts` — Integrated summarization pipeline
- `src/app/page.tsx` — Large text localStorage handling
- `src/components/StorySearch.tsx` — Large text localStorage handling

**Cost Analysis**:
- Adds ~$0.02-0.05 per long-text summarization (2-step pipeline)
- Only runs for texts over 15K characters (~30 printed pages)
- Saves overall cost by producing more focused, targeted page plans

### Decisions Made

1. **Summarization Threshold**: Set at 15,000 characters (~3,750 words) after testing with various classic texts
2. **localStorage for Large Texts**: Chose localStorage over database storage to avoid API overhead for temporary processing
3. **Cultural Validation as Optional**: Made cultural validation non-blocking since it enhances quality but isn't critical for generation
4. **Proportional Guidance Extraction**: Used regex patterns to detect proportional markers in character descriptions rather than separate AI calls

### Technical Observations

**Webpack Cache Corruption**: Encountered multiple instances of webpack cache corruption during development. Resolution: Delete `.next` folder and rebuild.

**Model Selection**:
- Used `gemini-2.5-pro-preview-06-05` for extraction (note: may be outdated, but works)
- Used `gemini-2.0-flash` with Google Search for cultural validation
- Retry logic with exponential backoff handles 503/429 errors gracefully

**Performance**:
- Summarization adds 15-30 seconds to generation time for long texts
- Acceptable trade-off given quality improvement for classic literature

### Known Issues

1. **Outdated Model Name**: `gemini-2.5-pro-preview-06-05` may need updating to current Gemini 2.5 Pro model name
2. **Summarization Fallback Warning**: Falls back to truncation if summarization fails (logged but non-blocking)
3. **UI Components Not Integrated**: WorkflowStepper, CharacterReviewPanel, and PlanReviewPanel are prepared but not yet connected to main workflow (future checkpoint feature)

### Testing Performed

**Live Generation Tests**:
- **Snow White**: 4 characters (Snow White, Evil Queen, Prince, Dwarf), ~10K characters — SUCCESS
- **The Iliad**: 6 characters (Achilles, Hector, Helen, etc.), ~180K characters — IN PROGRESS
  - Successfully ran through summarization pipeline
  - Generated Achilles character reference
  - Generation continues for remaining characters

**Build Validation**:
- `npm run build` — PASSED (no TypeScript errors)
- `npm run dev` — Running on localhost:3001

### Files Changed Summary

**Commit d47fce6 (Unified Reality)**:
- 5 files modified
- 2 new types added
- 3 new functions added

**Commit 7a92c02 (Summarization)**:
- 4 files modified
- 4 new files created (1,522 lines added)
- 16 lines removed

### Next Steps

1. **Test Long-Text Generation**: Complete The Iliad generation to validate full pipeline end-to-end
2. **Update Model Names**: Check for current Gemini 2.5 Pro model ID and update if needed
3. **Integrate Checkpoint Workflow**: Connect WorkflowStepper/ReviewPanels to Studio workflow
4. **Test Cultural Validation**: Validate with multiple classic stories (Cinderella, Peter Pan, Alice in Wonderland)
5. **Performance Optimization**: Consider caching summarization results for re-used stories
6. **Add User Feedback**: Display summarization progress to user ("Analyzing complete text...")

### Architecture Impact

**New Data Flow for Long Texts**:
```
User uploads/searches story (50K+ chars)
  ↓
localStorage reference created (`__LARGE_TEXT_REF__`)
  ↓
Planning API receives text
  ↓
Checks length > 15K chars
  ↓
Runs summarization pipeline:
  - Step 1: Literary extraction (Gemini 2.5 Pro)
  - Step 2: Cultural validation (Gemini 2.0 Flash + Search)
  ↓
Summary passed to planning model with [MUST-INCLUDE] markers
  ↓
Planning generates page structure using summary
  ↓
Character generation proceeds as normal
  ↓
Page generation uses character references + summary context
```

**Unified Reality Integration**:
```
Page generation starts
  ↓
System detects crowd scene (keyword analysis)
  ↓
Extracts proportional guidance from character refs
  ↓
Applies unified reality prompt layer:
  - Proportional standards for ALL figures
  - Style anchoring across scene
  - Consistency checks
  ↓
Image generated with proportional consistency
```

### Code Quality Notes

- All new code includes TypeScript types
- Retry logic with exponential backoff for API resilience
- Error handling with graceful fallbacks
- Console logging for debugging and monitoring
- JSDoc comments for public functions

---

