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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

Create exactly ${settings.desiredPageCount} pages. For each page, provide:
1. A simple, engaging caption (1-2 sentences for ages 3-5, 2-3 for older)
2. A detailed image generation prompt that includes:
   - Scene description
   - Character details
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

    const styleBible = createStyleBible(settings.aestheticStyle);
    const characterSheets = planData.characters?.map((char: any) => 
      createCharacterSheet(char.name, char.description)
    ) || [];

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