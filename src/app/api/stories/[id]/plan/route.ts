import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createStyleBible } from '@/lib/prompting';
import { supabase } from '@/lib/supabase';

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
        qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).optional(),
        aspectRatio: z.enum(['1:1', '3:2', '16:9', '9:16', '21:9']).optional(),
        enableSearchGrounding: z.boolean().optional(),
    }),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const storyId = params.id;

    if (!genAI) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    if (!supabase) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const { text, settings } = PlanRequestSchema.parse(body);

        // Update story status
        await supabase.from('stories').update({
            status: 'planning',
            current_step: 'Generating story structure...'
        }).eq('id', storyId);

        const modelName = 'gemini-3-pro-preview';
        const model = genAI.getGenerativeModel({ model: modelName });

        const ageGuidelines = {
            '3-5': 'Very simple language, basic concepts, gentle themes, no scary elements',
            '6-8': 'Simple sentences, adventure themes, mild challenges, positive outcomes',
            '9-12': 'More complex plots, character development, moral lessons, age-appropriate conflicts'
        };

        const intensityLevel = Math.min(settings.harshness, settings.targetAge === '3-5' ? 5 : 10);

        const prompt = `
You are an expert children's book author and visual storyteller. Use your advanced reasoning to transform this story into a ${settings.desiredPageCount}-page children's picture book for ages ${settings.targetAge}.

CRITICAL REQUIREMENT: You MUST create exactly ${settings.desiredPageCount} pages.

STEP 1: ANALYZE THE STORY
... (Analysis logic) ...

STORY TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '...' : ''}

CONTENT GUIDELINES:
- Age appropriateness: ${ageGuidelines[settings.targetAge]}
- Intensity level: ${intensityLevel}/10
- Additional creative direction: ${settings.freeformNotes}

STEP 2: STRATEGIC SCENE SELECTION
... (Scene selection logic) ...

STEP 3: CHARACTER CONSISTENCY PLANNING
... (Character planning logic) ...

STEP 4: OUTPUT FORMAT
Generate exactly ${settings.desiredPageCount} pages following this JSON structure:
{
  "reasoning": "Brief explanation...",
  "pages": [
    {
      "pageNumber": 1,
      "caption": "Engaging caption...",
      "prompt": "Detailed visual description..."
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "PRECISE visual description...",
      "role": "main" | "supporting" | "background"
    }
  ],
  "theme": "The story's central theme"
}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format from AI');

        const planData = JSON.parse(jsonMatch[0]);

        // Save Theme
        await supabase.from('stories').update({ theme: planData.theme }).eq('id', storyId);

        // Save Characters
        const charactersToInsert = (planData.characters || []).map((char: any, index: number) => ({
            story_id: storyId,
            name: char.name,
            description: char.description,
            role: char.role || (index < 2 ? 'main' : index < 5 ? 'supporting' : 'background'),
            status: 'pending'
        }));

        const { data: savedCharacters, error: charError } = await supabase
            .from('characters')
            .insert(charactersToInsert)
            .select();

        if (charError) throw charError;

        // Save Pages
        const pagesToInsert = (planData.pages || []).map((page: any) => ({
            story_id: storyId,
            page_number: page.pageNumber,
            caption: page.caption,
            prompt: page.prompt,
            status: 'pending'
        }));

        const { error: pageError } = await supabase
            .from('pages')
            .insert(pagesToInsert);

        if (pageError) throw pageError;

        const styleBible = createStyleBible(
            settings.aestheticStyle,
            settings.targetAge,
            settings.qualityTier || 'standard-flash'
        );

        return NextResponse.json({
            characters: savedCharacters, // Returns IDs for client to iterate
            pageCount: planData.pages.length,
            styleBible
        });

    } catch (error: any) {
        console.error('Planning error:', error);
        await supabase?.from('stories').update({ status: 'error', current_step: 'Failed to plan story' }).eq('id', storyId);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
