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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const ageGuidelines = {
      '3-5': 'Very simple language, basic concepts, gentle themes, no scary elements',
      '6-8': 'Simple sentences, adventure themes, mild challenges, positive outcomes',
      '9-12': 'More complex plots, character development, moral lessons, age-appropriate conflicts'
    };

    const intensityLevel = Math.min(settings.harshness, settings.targetAge === '3-5' ? 5 : 10);

    const prompt = `
Transform this story into a ${settings.desiredPageCount}-page children's picture book for ages ${settings.targetAge}.

CONTENT GUIDELINES:
- Age appropriateness: ${ageGuidelines[settings.targetAge]}
- Intensity level: ${intensityLevel}/10 (0=very gentle, 10=adventurous)
- Additional notes: ${settings.freeformNotes}

STORY TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '...' : ''}

SCENE SELECTION STRATEGY:
- Focus on the parts of the story that are key to stringing the narrative together.
- Include any major highlights and salient moments that the story is widely known for.
- Ensure the pacing feels natural for a children's book.

Create exactly ${settings.desiredPageCount} pages. For each page, provide:
1. A simple, engaging caption (1-2 sentences for ages 3-5, 2-3 for older)
2. A detailed image generation prompt that includes:
   - Scene description
   - Character details (ALWAYS maintain consistency with defined characters)
   - Setting/environment with intricate beautiful backgrounds
   - Emotional tone
   - Visual style: ${settings.aestheticStyle}

Format as JSON:
{
  "pages": [
    {
      "pageNumber": 1,
      "caption": "Simple text for the page",
      "prompt": "Detailed image generation prompt"
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "Consistent visual description"
    }
  ],
  "theme": "Overall story theme"
}

Ensure the story is complete, age-appropriate, and maintains narrative flow across all pages.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }

    const planData = JSON.parse(jsonMatch[0]);
    console.log('📋 Planned characters:', planData.characters?.length || 0, 'characters');

    const styleBible = createStyleBible(settings.aestheticStyle);

    // Generate character reference images for consistency
    const characterSheets = await Promise.all(
      (planData.characters || []).map(async (char: any) => {
        const characterSheet = createCharacterSheet(char.name, char.description);

        try {
          // Generate character reference portrait
          const referencePrompt = `Create a character reference portrait: ${char.description}

Style: ${settings.aestheticStyle}
- Character design sheet style
- Clear, front-facing portrait
- Consistent lighting
- Child-friendly appearance
- Professional children's book illustration style
- Include SynthID watermark for AI content identification

This will be used as a reference for maintaining character consistency across multiple illustrations.`;

          const referenceResult = await model.generateContent(referencePrompt);
          const referenceResponse = await referenceResult.response;

          if (referenceResponse.candidates && referenceResponse.candidates[0]?.content?.parts) {
            const parts = referenceResponse.candidates[0].content.parts;

            // Look for image data in the response
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                characterSheet.referenceImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                console.log('✅ Generated reference image for character:', char.name);
                console.log('Reference image data length:', part.inlineData.data.length);
                break;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to generate reference image for ${char.name}:`, error);
          // Continue without reference image
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