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
    targetAge: z.enum(['3-5', '6-8', '9-12']),
    harshness: z.number().min(0).max(10),
    aestheticStyle: z.string(),
    freeformNotes: z.string(),
    desiredPageCount: z.number().min(10).max(30),
    characterConsistency: z.boolean(),
    // Nano Banana Pro enhancements
    qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).optional(),
    aspectRatio: z.enum(['1:1', '3:2', '16:9', '9:16', '21:9']).optional(),
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ageGuidelines = {
      '3-5': 'Very simple language, basic concepts, gentle themes, no scary elements',
      '6-8': 'Simple sentences, adventure themes, mild challenges, positive outcomes',
      '9-12': 'More complex plots, character development, moral lessons, age-appropriate conflicts'
    };

    const intensityLevel = Math.min(settings.harshness, settings.targetAge === '3-5' ? 5 : 10);

    // Enhanced prompt for Nano Banana Pro's reasoning capabilities
    const prompt = `
You are an expert children's book author and visual storyteller. Use your advanced reasoning to transform this story into a ${settings.desiredPageCount}-page children's picture book for ages ${settings.targetAge}.

CRITICAL REQUIREMENT: You MUST create exactly ${settings.desiredPageCount} pages.

STEP 1: ANALYZE THE STORY (Think through this carefully)
First, analyze the complete narrative structure:
- Identify the story's core emotional arc and theme
- Determine the protagonist's journey and key character moments
- Find the most visually compelling and narratively essential scenes
- Consider which moments children of this age would find most engaging
- Think about pacing: which scenes need more space, which can be condensed

STORY TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '...' : ''}

CONTENT GUIDELINES:
- Age appropriateness: ${ageGuidelines[settings.targetAge]}
- Intensity level: ${intensityLevel}/10 (0=very gentle, 10=adventurous)
- Additional creative direction: ${settings.freeformNotes}

STEP 2: STRATEGIC SCENE SELECTION (Use your reasoning capabilities)
Apply these principles to select exactly ${settings.desiredPageCount} scenes:

1. NARRATIVE ESSENTIALS: Include pivotal plot moments that drive the story forward
2. EMOTIONAL PEAKS: Capture moments of highest emotional impact (joy, discovery, challenge, resolution)
3. VISUAL IMPACT: Choose scenes with strong visual potential and variety
4. CHARACTER DEVELOPMENT: Show character growth and relationships
5. PACING: Balance action, reflection, and emotional beats
6. ICONIC MOMENTS: If this story is well-known, include the scenes readers expect
7. AGE APPROPRIATENESS: Select moments that resonate with ${settings.targetAge} year-olds

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
      "caption": "Engaging caption appropriate for ages ${settings.targetAge} (1-2 sentences for 3-5, 2-3 for older)",
      "prompt": "Detailed visual description including: scene setting, character positions and expressions, environmental details, lighting/mood, action/moment, composition (${settings.aestheticStyle} style)"
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

        try {
          console.log(`🎨 Generating references for ${char.name} (${role} character)...`);

          // For Nano Banana Pro, generate multiple reference angles for main characters
          const numReferences = role === 'main' ? 3 : role === 'supporting' ? 2 : 1;
          const referenceAngles = ['front-facing portrait', 'side profile', 'expression sheet (happy, neutral, surprised)'];
          const generatedReferences: string[] = [];

          for (let i = 0; i < numReferences; i++) {
            const angle = referenceAngles[i];
            const referencePrompt = `Create a character reference for children's book illustration - ${angle}:

CHARACTER: ${char.name}
DESCRIPTION: ${char.description}

STYLE: ${settings.aestheticStyle}
TARGET AGE: ${settings.targetAge}

REQUIREMENTS (Nano Banana Pro):
- ${angle}
- Character design sheet style with clear, consistent lighting
- Child-friendly appearance suitable for ages ${settings.targetAge}
- Professional children's book illustration quality
- Show distinctive features clearly for reference matching
- Optimized for use as reference in Nano Banana Pro multi-image generation
- Include SynthID watermark for AI content identification

This reference will be used to maintain perfect visual consistency across multiple book pages.`;

            try {
              const referenceResult = await model.generateContent(referencePrompt);
              const referenceResponse = await referenceResult.response;

              if (referenceResponse.candidates && referenceResponse.candidates[0]?.content?.parts) {
                const parts = referenceResponse.candidates[0].content.parts;

                for (const part of parts) {
                  if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                    const imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    generatedReferences.push(imageData);
                    console.log(`  ✅ Generated ${angle} for ${char.name} (${part.inlineData.data.length} bytes)`);
                    break;
                  }
                }
              }
            } catch (angleError) {
              console.warn(`  ⚠️ Failed to generate ${angle} for ${char.name}:`, angleError);
            }
          }

          // Store references (both new array format and legacy single image for backwards compatibility)
          if (generatedReferences.length > 0) {
            characterSheet.referenceImages = generatedReferences;
            characterSheet.referenceImage = generatedReferences[0]; // Legacy: use first reference
            console.log(`✅ Total references for ${char.name}: ${generatedReferences.length}`);
          }
        } catch (error) {
          console.warn(`Failed to generate reference images for ${char.name}:`, error);
          // Continue without reference images
        }

        return characterSheet;
      })
    );

    return NextResponse.json({
      pages: planData.pages,
      characters: characterSheets,
      styleBible,
      theme: planData.theme,
    });

  } catch (error) {
    console.error('Planning error:', error);
    return NextResponse.json(
      { error: 'Failed to plan story structure' },
      { status: 500 }
    );
  }
}