import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createStyleBible, createCharacterSheet } from '@/lib/prompting';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not configured');
}

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const PlanRequestSchema = z.object({
  text: z.string(),
  settings: z.object({
    targetAge: z.number().min(3).max(18),
    harshness: z.number().min(0).max(10),
    aestheticStyle: z.string(),
    freeformNotes: z.string(),
    desiredPageCount: z.number().min(5).max(30),
    characterConsistency: z.boolean(),
    // Nano Banana Pro enhancements
    qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).optional(),
    aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).optional(),
    enableSearchGrounding: z.boolean().optional(),
  }),
});

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { text, settings } = PlanRequestSchema.parse(body);

    const modelName = 'gemini-3-pro-preview';
    console.log(`📝 Planning with model: ${modelName}`);

    let model;
    try {
      model = genAI.getGenerativeModel({ model: modelName });
    } catch (modelError: any) {
      console.error('Model initialization error:', modelError);
      return NextResponse.json(
        { error: `Failed to initialize model ${modelName}: ${modelError.message}` },
        { status: 500 }
      );
    }

    // Generate age-appropriate content guidelines based on numeric age
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
    };

    const ageGuidelines = getAgeGuidelines(settings.targetAge);

    // Cap intensity for younger children, allow full range for older readers
    const maxIntensityForAge = settings.targetAge <= 5 ? 5 : settings.targetAge <= 8 ? 7 : 10;
    const intensityLevel = Math.min(settings.harshness, maxIntensityForAge);

    // Enhanced prompt for Nano Banana Pro's reasoning capabilities
    const prompt = `
You are an expert children's book author and visual storyteller. Use your advanced reasoning to transform this story into a ${settings.desiredPageCount}-page picture book for a ${settings.targetAge}-year-old reader.

CRITICAL REQUIREMENT: You MUST create exactly ${settings.desiredPageCount} pages.

STEP 1: ANALYZE THE STORY (Think through this carefully)
First, analyze the complete narrative structure:
- Identify the story's core emotional arc and theme
- Determine the protagonist's journey and key character moments
- Find the most visually compelling and narratively essential scenes
- Consider which moments a ${settings.targetAge}-year-old would find most engaging
- Think about pacing: which scenes need more space, which can be condensed

STORY TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '...' : ''}

CONTENT GUIDELINES:
- Target reader age: ${settings.targetAge} years old
- Age appropriateness: ${ageGuidelines}
- Intensity level: ${intensityLevel}/10 (This is CRITICAL - at level ${settings.harshness}, you should create imagery that is as intense and dramatic as is appropriate for a ${settings.targetAge}-year-old American reader. Level 10 means MAXIMUM intensity - vivid action, dramatic moments, intense emotions, challenging themes - while remaining age-appropriate. Do NOT hold back if intensity is high.)
- Additional creative direction: ${settings.freeformNotes}

STEP 2: STRATEGIC SCENE SELECTION (Use your reasoning capabilities)
Apply these principles to select exactly ${settings.desiredPageCount} scenes:

1. NARRATIVE ESSENTIALS: Include pivotal plot moments that drive the story forward
2. EMOTIONAL PEAKS: Capture moments of highest emotional impact (joy, discovery, challenge, resolution)
3. VISUAL IMPACT: Choose scenes with strong visual potential and variety
4. CHARACTER DEVELOPMENT: Show character growth and relationships
5. PACING: Balance action, reflection, and emotional beats
6. ICONIC MOMENTS: If this story is well-known, include the scenes readers expect
7. AGE APPROPRIATENESS: Select moments that resonate with ${settings.targetAge}-year-olds
8. INTENSITY: At intensity level ${settings.harshness}/10, include dramatic, vivid, emotionally intense moments appropriate for this age
9. NARRATIVE ENRICHMENT & HISTORICAL ACCURACY: For each scene:
   - Include period-accurate elements (clothing, architecture, objects, art styles appropriate to the setting)
   - Add background details that convey story context and world-building
   - For well-known stories, include subtle nods to iconic elements ONLY if they have already occurred in the story up to that page
   - STRICT CHRONOLOGY: Never include visual references to future events or elements not yet established
   - No anachronisms - every detail must be historically/culturally appropriate to the setting
   - Create visually rich scenes that reward careful, repeated viewing

For stories SHORTER than ${settings.desiredPageCount} scenes:
- Break complex moments into multiple pages (setup → action → result)
- Add emotional reaction beats between major events
- Expand world-building moments (show the environment, daily life, relationships)
- Include transition scenes that maintain narrative flow

For stories LONGER than ${settings.desiredPageCount} scenes:
- Combine related moments into single impactful pages
- Focus on the highest-value narrative beats
- Summarize less critical events in captions while showing the most important visual

STEP 3: CHARACTER CONSISTENCY PLANNING (Critical for Nano Banana Pro)
For each character that appears:
- Create a PRECISE visual description that will remain consistent
- Note distinctive features (clothing, hair, props, colors, physical traits)
- Specify scale/size relative to other characters
- Identify any props or accessories they always carry
- Maximum 5 main characters for optimal Nano Banana Pro consistency

STEP 4: OUTPUT FORMAT
Generate exactly ${settings.desiredPageCount} pages following this JSON structure:

{
  "reasoning": "Brief explanation of your scene selection strategy for this story",
  "pages": [
    {
      "pageNumber": 1,
      "caption": "Engaging caption appropriate for a ${settings.targetAge}-year-old reader (adjust complexity to age: simpler for younger, more sophisticated for older)",
      "prompt": "FULL-PAGE illustration (no text/typography in image) with: scene setting, character positions and expressions, historically/culturally accurate period elements (clothing, architecture, objects), environmental details that convey world-building, background details that reward careful observation. CHRONOLOGY: Only reference story elements established up to this page - no foreshadowing. NO ANACHRONISMS - every detail must be period-appropriate. Ensure image fills entire canvas edge-to-edge. At intensity ${settings.harshness}/10, make this ${settings.harshness >= 7 ? 'dramatic, vivid, and emotionally intense' : settings.harshness >= 4 ? 'moderately engaging with some tension' : 'gentle and calm'}. Use ${settings.aestheticStyle} style."
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "PRECISE visual description: [physical features], [clothing and colors], [distinctive props], [approximate age/size]"
    }
  ],
  "theme": "The story's central theme or message"
}

VALIDATION:
- Count your pages: You must have exactly ${settings.desiredPageCount} page objects
- NOT ${settings.desiredPageCount - 1}, NOT ${settings.desiredPageCount + 1}, EXACTLY ${settings.desiredPageCount}
- Each page should advance the story meaningfully
- Visual variety: mix of wide shots, medium shots, and close-ups
- Emotional variety: balance quiet and dynamic moments
- Character consistency: use exact same descriptions across all prompts

Use your reasoning to create the most compelling ${settings.desiredPageCount}-page visual narrative possible.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }

    const planData = JSON.parse(jsonMatch[0]);

    // Log Nano Banana Pro's reasoning
    if (planData.reasoning) {
      console.log('🧠 Nano Banana Pro Reasoning:', planData.reasoning);
    }

    console.log('📋 Planned characters:', planData.characters?.length || 0, 'characters');
    console.log('📋 Planned pages:', planData.pages?.length || 0, 'pages (Requested:', settings.desiredPageCount, ')');

    // Validate page count
    if (planData.pages?.length !== settings.desiredPageCount) {
      console.warn(`⚠️ Page count mismatch: Generated ${planData.pages?.length}, expected ${settings.desiredPageCount}`);
    }

    const styleBible = createStyleBible(
      settings.aestheticStyle,
      settings.targetAge,
      settings.qualityTier || 'standard-flash'
    );

    // Determine character roles (first 2 are main, next 3 are supporting, rest are background)
    // Nano Banana Pro supports up to 5 characters with high consistency
    const totalChars = planData.characters?.length || 0;
    const characterRoles: ('main' | 'supporting' | 'background')[] = [];
    for (let i = 0; i < totalChars; i++) {
      if (i < 2) characterRoles.push('main');
      else if (i < 5) characterRoles.push('supporting');
      else characterRoles.push('background');
    }

    // Feature flag: Check if Nano Banana Pro is enabled
    const nanoBananaProEnabled = process.env.ENABLE_NANO_BANANA_PRO !== 'false';

    // Generate character reference images for consistency (Nano Banana Pro optimized)
    const characterSheets = await Promise.all(
      (planData.characters || []).map(async (char: any, index: number) => {
        const role = characterRoles[index];
        const characterSheet = createCharacterSheet(
          char.name,
          char.description,
          role,
          planData.theme
        );

        // Note: We used to generate reference images here, but it takes too long for Netlify functions (10s limit).
        // The client (StudioClient) now handles generating these images sequentially via the /api/stories/[id]/characters/generate endpoint.
        // We just return the skeleton here.

        return characterSheet;
      })
    );

    return NextResponse.json({
      pages: planData.pages,
      characters: characterSheets,
      styleBible,
      theme: planData.theme,
    });

  } catch (error: any) {
    console.error('Planning error:', error);

    // Extract meaningful error message
    let errorMessage = 'Failed to plan story structure';
    if (error?.message) {
      errorMessage = error.message;
    }
    if (error?.status === 404 || error?.message?.includes('not found')) {
      errorMessage = `Model not found: gemini-3-pro-preview. Please check if this model is available in your region.`;
    }
    if (error?.status === 403 || error?.message?.includes('permission')) {
      errorMessage = 'API key does not have permission to access this model.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}