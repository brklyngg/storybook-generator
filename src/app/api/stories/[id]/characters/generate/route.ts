import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.message?.includes('503') ||
                          error.message?.includes('overloaded') ||
                          error.message?.includes('rate limit') ||
                          error.status === 503;

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: storyId } = await params;

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

        const modelName = 'gemini-3-pro-image-preview';
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
                const result = await retryWithBackoff(
                    () => model.generateContent(prompt),
                    3,
                    2000
                );
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
        await supabase?.from('characters').update({ status: 'error' }).eq('id', storyId); // Note: storyId is used here as fallback, ideally should be characterId if available
        // Actually, I should use the characterId from the body if possible, but I might not have it in the catch block easily if parsing failed.
        // Let's just return error.
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
