/**
 * Long-text summarization pipeline for the Storybook Generator.
 *
 * For texts exceeding 15,000 characters, this module runs a two-step pipeline:
 * 1. EXTRACTION: Use Gemini 2.5 Pro (1M+ context) to extract narrative arc, key scenes, characters
 * 2. CULTURAL VALIDATION: Use Gemini 2.0 Flash + Google Search to identify iconic moments
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================
// CONSTANTS
// ============================================

const SUMMARIZATION_THRESHOLD = 15_000; // Characters
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

// ============================================
// INTERFACES
// ============================================

/**
 * Key scene extracted from the story for visual adaptation
 */
export interface KeyScene {
  /** Brief title for the scene (e.g., "The Trojan Horse Enters Troy") */
  title: string;
  /** Scene description for visual adaptation (60-80 words) */
  description: string;
  /** Approximate position in narrative (0.0 = beginning, 1.0 = end) */
  narrativePosition: number;
  /** Characters prominently featured in this scene */
  characters: string[];
  /** Emotional tone (e.g., "triumphant", "tense", "melancholic") */
  emotionalTone: string;
  /** Visual elements that make this scene iconic */
  visualElements: string[];
}

/**
 * Character essence extracted from the story
 */
export interface CharacterEssence {
  /** Character name */
  name: string;
  /** Core visual description (physical appearance, clothing, props) */
  visualDescription: string;
  /** Character's role in the story */
  role: 'protagonist' | 'antagonist' | 'supporting' | 'mentor' | 'sidekick';
  /** Key personality traits */
  traits: string[];
  /** Character's arc or transformation */
  arc: string;
}

/**
 * Memorable quote with context
 */
export interface MemorableQuote {
  /** The quote text */
  text: string;
  /** Who says it */
  speaker: string;
  /** Brief context of when/why this is said */
  context: string;
}

/**
 * Setting details for the story
 */
export interface SettingDetails {
  /** When the story takes place */
  timePeriod: string;
  /** Array of main settings */
  primaryLocations: string[];
  /** Historical/cultural background */
  culturalContext: string;
}

/**
 * Processing metadata
 */
export interface SummarizationMetadata {
  /** Original text length in characters */
  originalLength: number;
  /** Timestamp when extraction occurred */
  extractedAt: number;
  /** Model used for extraction */
  modelUsed: string;
}

/**
 * Output from Step 1: Literary Extraction
 */
export interface LiterarySummary {
  /** Story title */
  title: string;
  /** Author name (if detected) */
  author?: string;
  /** 400-500 word narrative arc summary */
  narrativeArc: string;
  /** 8-12 key visual scenes in chronological order */
  keyScenes: KeyScene[];
  /** Main and supporting character essences */
  characters: CharacterEssence[];
  /** 8-10 memorable quotes from the text */
  memorableQuotes: MemorableQuote[];
  /** Core thematic elements (3-5 themes) */
  thematicCore: string[];
  /** Historical/cultural setting details */
  settingDetails: SettingDetails;
  /** Processing metadata */
  metadata: SummarizationMetadata;
}

/**
 * Cultural validation marker for iconic scenes
 */
export interface IconicMarker {
  /** Which scene this applies to */
  sceneTitle: string;
  /** Cultural significance level (1-10) */
  significance: number;
  /** Why this is culturally iconic */
  reason: string;
}

/**
 * Missing iconic moment not captured in initial extraction
 */
export interface MissingIconicMoment {
  /** Title for the missing scene */
  title: string;
  /** Description of what happens */
  description: string;
  /** Why this is culturally essential */
  culturalReason: string;
  /** Suggested position (0.0-1.0) */
  suggestedPosition: number;
}

/**
 * Output from Step 2: Cultural Validation (Enhanced Summary)
 */
export interface EnhancedSummary extends LiterarySummary {
  /** Scenes marked as culturally iconic (must-include) */
  iconicMarkers: IconicMarker[];
  /** Missing iconic moments not captured in keyScenes */
  missingIconicMoments: MissingIconicMoment[];
  /** Whether cultural validation was successfully performed */
  culturallyValidated: boolean;
}

/**
 * Configuration for summarization
 */
export interface SummarizationConfig {
  /** Story title (helps with cultural validation) */
  title?: string;
  /** Target audience age (affects scene selection) */
  targetAge?: number;
  /** Desired number of pages (affects scene count) */
  desiredPageCount?: number;
  /** Enable cultural validation step (default: true if title provided) */
  enableCulturalValidation?: boolean;
}

// ============================================
// RETRY HELPER
// ============================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = BASE_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      lastError = err;

      const isRetryable =
        err.message?.includes('503') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('rate limit') ||
        err.message?.includes('429') ||
        err.status === 503 ||
        err.status === 429;

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Summarization retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// STEP 1: LITERARY EXTRACTION
// ============================================

/**
 * Extract comprehensive literary summary from full story text.
 * Uses Gemini 2.5 Pro for its 1M+ token context window.
 */
export async function extractLiterarySummary(
  text: string,
  config: SummarizationConfig = {}
): Promise<LiterarySummary> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Use gemini-2.5-pro for large context window (1M+ tokens)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
  });

  const sceneCount = config.desiredPageCount
    ? Math.min(Math.max(config.desiredPageCount, 8), 12)
    : 10;

  const prompt = `You are a literary analyst and visual storytelling expert. Analyze this COMPLETE story text and extract a comprehensive summary suitable for adaptation into a ${config.desiredPageCount || 10}-page illustrated children's book for a ${config.targetAge || 7}-year-old reader.

STORY TITLE: ${config.title || 'Unknown'}

COMPLETE STORY TEXT:
${text}

---

EXTRACTION REQUIREMENTS:

1. NARRATIVE ARC (400-500 words MAXIMUM):
   Write a COMPLETE summary covering the ENTIRE story from beginning to end:
   - All major plot points and turning points
   - Character motivations and transformations
   - The climax and resolution
   CRITICAL: Do NOT skip the ending. Include how the story concludes.

2. KEY VISUAL SCENES (exactly ${sceneCount} scenes):
   Select the ${sceneCount} MOST visually compelling and narratively essential scenes.
   For EACH scene:
   - title: A memorable title (e.g., "The Trojan Horse Enters Troy")
   - description: 60-80 words of vivid visual detail
   - narrativePosition: Number from 0.0 (beginning) to 1.0 (end)
   - characters: Array of character names in this scene
   - emotionalTone: Single word (e.g., "triumphant", "terrifying")
   - visualElements: Array of 3-5 specific visual elements

   SCENE DISTRIBUTION REQUIREMENT:
   - At least 2 scenes from the final third (position > 0.66)
   - Include the climactic moment
   - Include the resolution/ending scene

3. CHARACTER ESSENCES (main characters only, max 6):
   For each main character:
   - name: Full name
   - visualDescription: Physical appearance, clothing, distinctive features (40-60 words)
   - role: protagonist | antagonist | supporting | mentor | sidekick
   - traits: 3-4 personality traits
   - arc: Their transformation in 10-15 words

4. MEMORABLE QUOTES (8-10 quotes):
   Select the most powerful lines. For each:
   - text: The exact quote (keep short, under 20 words)
   - speaker: Who says it
   - context: When/why (5-10 words)

5. THEMATIC CORE (3-5 themes):
   List central themes as brief phrases (e.g., "the corrupting nature of pride")

6. SETTING DETAILS:
   - timePeriod: When the story takes place
   - primaryLocations: Array of 2-4 main settings
   - culturalContext: Historical/cultural background (1 sentence)

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure:
{
  "title": "Story Title",
  "author": "Author Name or null",
  "narrativeArc": "400-500 word complete summary...",
  "keyScenes": [
    {
      "title": "Scene Title",
      "description": "60-80 word visual description...",
      "narrativePosition": 0.1,
      "characters": ["Character1", "Character2"],
      "emotionalTone": "tone",
      "visualElements": ["element1", "element2", "element3"]
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "visualDescription": "40-60 word physical description...",
      "role": "protagonist",
      "traits": ["trait1", "trait2", "trait3"],
      "arc": "10-15 word transformation"
    }
  ],
  "memorableQuotes": [
    {
      "text": "Quote under 20 words",
      "speaker": "Character Name",
      "context": "5-10 word context"
    }
  ],
  "thematicCore": ["theme1", "theme2", "theme3"],
  "settingDetails": {
    "timePeriod": "Time period",
    "primaryLocations": ["location1", "location2"],
    "culturalContext": "One sentence cultural background"
  }
}`;

  console.log(`📚 Extracting literary summary from ${text.length.toLocaleString()} characters...`);
  const startTime = Date.now();

  const result = await retryWithBackoff(async () => {
    return await model.generateContent(prompt);
  });

  const response = result.response;
  const generatedText = response.text();

  // Parse JSON from response
  const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract valid JSON from literary summary response');
  }

  const summaryData = JSON.parse(jsonMatch[0]);

  const elapsedMs = Date.now() - startTime;
  console.log(`✅ Literary extraction complete in ${(elapsedMs / 1000).toFixed(1)}s`);

  return {
    ...summaryData,
    metadata: {
      originalLength: text.length,
      extractedAt: Date.now(),
      modelUsed: 'gemini-2.5-pro',
    },
  };
}

// ============================================
// STEP 2: CULTURAL VALIDATION
// ============================================

/**
 * Validate and enhance literary summary with cultural context.
 * Uses Gemini 2.0 Flash with Google Search grounding.
 */
export async function validateWithCulturalContext(
  summary: LiterarySummary,
  title: string
): Promise<EnhancedSummary> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Use gemini-2.0-flash with Google Search grounding
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    // Enable Google Search grounding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} }] as any,
  });

  const sceneList = summary.keyScenes
    .map((s, i) => `${i + 1}. "${s.title}" (position: ${Math.round(s.narrativePosition * 100)}%)`)
    .join('\n');

  const prompt = `You are a cultural and literary expert. Search the web for information about the most iconic and famous moments from "${title}".

CURRENT SCENE LIST (extracted from the full text):
${sceneList}

TASK:
1. Search for "most iconic moments from ${title}" and "famous scenes in ${title}"
2. Compare web results against the current scene list
3. Identify which scenes are culturally iconic (widely referenced in adaptations, parodies, or popular culture)
4. Flag any MISSING iconic moments that SHOULD be included in a children's book adaptation

OUTPUT FORMAT (JSON only):
{
  "iconicMarkers": [
    {
      "sceneTitle": "Exact scene title from list above",
      "significance": 8,
      "reason": "Why this is culturally iconic (10-20 words)"
    }
  ],
  "missingIconicMoments": [
    {
      "title": "Missing Scene Title",
      "description": "What happens in this scene (60-80 words)",
      "culturalReason": "Why this is essential to include (10-20 words)",
      "suggestedPosition": 0.75
    }
  ]
}

IMPORTANT:
- Only mark scenes that are GENUINELY iconic (frequently referenced/adapted)
- Only add missing moments that are TRULY essential for cultural literacy
- Keep missingIconicMoments to maximum 2-3 scenes`;

  console.log(`🔍 Validating cultural context for "${title}"...`);

  try {
    const result = await retryWithBackoff(async () => {
      return await model.generateContent(prompt);
    });

    const response = result.response;
    const generatedText = response.text();

    // Parse JSON from response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ Could not parse cultural validation response, returning unvalidated');
      return {
        ...summary,
        iconicMarkers: [],
        missingIconicMoments: [],
        culturallyValidated: false,
      };
    }

    const validationData = JSON.parse(jsonMatch[0]);

    console.log(
      `✅ Cultural validation complete: ${validationData.iconicMarkers?.length || 0} iconic markers, ${validationData.missingIconicMoments?.length || 0} missing moments`
    );

    return {
      ...summary,
      iconicMarkers: validationData.iconicMarkers || [],
      missingIconicMoments: validationData.missingIconicMoments || [],
      culturallyValidated: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.warn('⚠️ Cultural validation failed, continuing without:', err.message);
    return {
      ...summary,
      iconicMarkers: [],
      missingIconicMoments: [],
      culturallyValidated: false,
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if text requires summarization based on length.
 */
export function requiresSummarization(text: string): boolean {
  return text.length > SUMMARIZATION_THRESHOLD;
}

/**
 * Get the summarization threshold (exported for display in UI).
 */
export function getSummarizationThreshold(): number {
  return SUMMARIZATION_THRESHOLD;
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Complete summarization pipeline: extraction + optional cultural validation.
 */
export async function summarizeForAdaptation(
  text: string,
  config: SummarizationConfig = {}
): Promise<EnhancedSummary> {
  // Step 1: Literary Extraction
  const summary = await extractLiterarySummary(text, config);

  // Step 2: Cultural Validation (optional, requires title)
  const shouldValidate = config.enableCulturalValidation !== false && config.title;

  if (shouldValidate) {
    return await validateWithCulturalContext(summary, config.title!);
  }

  // Return as EnhancedSummary without cultural validation
  return {
    ...summary,
    iconicMarkers: [],
    missingIconicMoments: [],
    culturallyValidated: false,
  };
}

// ============================================
// OUTPUT FORMATTING
// ============================================

/**
 * Convert EnhancedSummary to a condensed format suitable for the planning prompt.
 * Target output: 6,000-8,000 characters.
 */
export function summaryToPromptText(summary: EnhancedSummary): string {
  const iconicSceneTitles = new Set(summary.iconicMarkers.map(m => m.sceneTitle));

  // Format scenes (condensed)
  const scenesText = summary.keyScenes
    .map((scene, i) => {
      const isIconic = iconicSceneTitles.has(scene.title);
      const marker = isIconic ? ' [MUST-INCLUDE]' : '';
      const chars = scene.characters.slice(0, 3).join(', ');
      return `${i + 1}. "${scene.title}" (${Math.round(scene.narrativePosition * 100)}%)${marker} — ${scene.description.substring(0, 200)} [Characters: ${chars}] [Tone: ${scene.emotionalTone}]`;
    })
    .join('\n');

  // Add missing iconic moments
  const missingText =
    summary.missingIconicMoments.length > 0
      ? `\n\nADDITIONAL ICONIC MOMENTS TO INCLUDE:\n${summary.missingIconicMoments
          .map(
            m =>
              `- "${m.title}" (${Math.round(m.suggestedPosition * 100)}%) [MUST-INCLUDE] — ${m.description}`
          )
          .join('\n')}`
      : '';

  // Format characters (condensed)
  const charactersText = summary.characters
    .slice(0, 6)
    .map(c => `- ${c.name} (${c.role}): ${c.visualDescription} | Traits: ${c.traits.join(', ')} | Arc: ${c.arc}`)
    .join('\n');

  // Format quotes (condensed)
  const quotesText = summary.memorableQuotes
    .slice(0, 8)
    .map(q => `"${q.text}" — ${q.speaker}`)
    .join('\n');

  // Build final output
  return `STORY: ${summary.title}${summary.author ? ` by ${summary.author}` : ''}
SETTING: ${summary.settingDetails.timePeriod}, ${summary.settingDetails.primaryLocations.join(', ')} | Themes: ${summary.thematicCore.join(', ')}

NARRATIVE ARC:
${summary.narrativeArc}

KEY SCENES (${summary.keyScenes.length}):
${scenesText}${missingText}

CHARACTERS:
${charactersText}

MEMORABLE QUOTES:
${quotesText}`.trim();
}
