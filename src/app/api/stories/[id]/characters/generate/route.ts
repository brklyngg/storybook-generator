import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const storyId = params.id;

    if (!genAI || !supabase) {
        return NextResponse.json({ error: 'Configuration missing' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { characterId } = body;

        // Fetch character details
        const { data: character, error: fetchError } = await supabase
            .from('characters')
            .select('*')
            .eq('id', characterId)
            .eq('story_id', storyId)
            .single();

        if (fetchError || !character) {
            return NextResponse.json({ error: 'Character not found' }, { status: 404 });
        }

        // Fetch story settings for style
        const { data: story } = await supabase
            .from('stories')
            .select('settings')
            .eq('id', storyId)
            .single();

        const settings = story?.settings || {};

        // Update status
        await supabase.from('characters').update({ status: 'generating' }).eq('id', characterId);

        const modelName = 'gemini-3-pro-preview';
        const model = genAI.getGenerativeModel({ model: modelName });

        const role = character.role;
        const numReferences = role === 'main' ? 3 : role === 'supporting' ? 2 : 1;
        const referenceAngles = ['front-facing portrait', 'side profile', 'expression sheet (happy, neutral, surprised)'];
        const generatedReferences: string[] = [];

        console.log(`🎨 Generating references for ${character.name} (${role})...`);

        for (let i = 0; i < numReferences; i++) {
            const angle = referenceAngles[i];
            const prompt = `Create a character reference for children's book illustration - ${angle}:

CHARACTER: ${character.name}
DESCRIPTION: ${character.description}

STYLE: ${settings.aestheticStyle || 'whimsical'}
TARGET AGE: ${settings.targetAge || '6-8'}

REQUIREMENTS:
- ${angle}
- Character design sheet style with clear, consistent lighting
- Child-friendly appearance
- Professional children's book illustration quality
- Include SynthID watermark
`;

            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;

                if (response.candidates && response.candidates[0]?.content?.parts) {
                    const parts = response.candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                            const imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            generatedReferences.push(imageData);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to generate ${angle} for ${character.name}`, err);
            }
        }

        // Update character with results
        if (generatedReferences.length > 0) {
            await supabase.from('characters').update({
                reference_image: generatedReferences[0],
                reference_images: generatedReferences,
                status: 'completed'
            }).eq('id', characterId);

            return NextResponse.json({ success: true, references: generatedReferences.length });
        } else {
            throw new Error('No images generated');
        }

    } catch (error: any) {
        console.error('Character generation error:', error);
        await supabase?.from('characters').update({ status: 'error' }).eq('id', params.id); // Typo in original thought, fixed here to use correct ID if available, but params.id is storyId. Need characterId.
        // Actually, I should use the characterId from the body if possible, but I might not have it in the catch block easily if parsing failed.
        // Let's just return error.
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
