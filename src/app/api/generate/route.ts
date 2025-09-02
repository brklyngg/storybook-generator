import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createPagePrompt } from '@/lib/prompting';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not configured');
}

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const GenerateRequestSchema = z.object({
  pageIndex: z.number(),
  caption: z.string(),
  stylePrompt: z.string(),
  characterConsistency: z.boolean(),
  previousPages: z.array(z.object({
    index: z.number(),
    imageUrl: z.string().optional(),
  })).optional(),
  characterReferences: z.array(z.object({
    name: z.string(),
    referenceImage: z.string(),
  })).optional(),
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
    const { pageIndex, caption, stylePrompt, characterConsistency, previousPages, characterReferences } = 
      GenerateRequestSchema.parse(body);

    // Use Gemini 2.5 Flash Image specifically for image generation
    const selectedModel = 'gemini-2.5-flash-image-preview';
    
    let model;
    try {
      model = genAI.getGenerativeModel({ 
        model: selectedModel,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH', 
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      });
    } catch (error) {
      console.warn('Failed to initialize Gemini 2.5 Flash Image, using fallback');
      // Fallback to regular Gemini 2.5 Flash for text generation only
      const fallbackModel = 'gemini-2.5-flash';
      model = genAI.getGenerativeModel({ model: fallbackModel });
    }

    let consistencyPrompt = '';
    if (characterConsistency && characterReferences && characterReferences.length > 0) {
      const characterNames = characterReferences.map(c => c.name).join(', ');
      consistencyPrompt = `
CHARACTER CONSISTENCY REQUIREMENTS:
- Use the provided character reference images to maintain exact visual consistency
- Keep the same character designs, facial features, clothing, and proportions as shown in references
- Characters included: ${characterNames}
- Match the reference images exactly for character appearance
- Use consistent color palette and artistic approach across all characters
`;
    } else if (characterConsistency && previousPages && previousPages.length > 0) {
      consistencyPrompt = `
CONSISTENCY REQUIREMENTS:
- Maintain the same character designs, clothing, and visual style as previous illustrations
- Use consistent color palette and artistic approach
- Keep the same art style and composition principles
`;
    }

    const fullPrompt = createPagePrompt({
      sceneGoal: caption,
      caption,
      cameraAngle: pageIndex % 3 === 0 ? 'wide shot' : pageIndex % 2 === 0 ? 'medium shot' : 'close-up',
      layoutHint: 'left space for text',
      characterRefs: previousPages?.map(p => `Reference page ${p.index}`) || [],
      styleConsistency: stylePrompt,
      safetyConstraints: 'child-friendly, no scary or inappropriate content',
    });

    const imagePrompt = `
${fullPrompt}
${consistencyPrompt}

TECHNICAL REQUIREMENTS:
- High quality children's book illustration
- Safe for ages 3-12
- Clear, engaging composition with intricate beautiful backgrounds
- Professional picture book style
- ${stylePrompt}

CONTENT DESCRIPTION:
${caption}

Generate a detailed, beautiful children's book illustration for this scene.
`;

    let imageUrl = '';
    let warnings: string[] = [];

    try {
      // Try to generate actual image with Gemini 2.5 Flash Image Preview
      console.log('Attempting Gemini 2.5 Flash Image Preview generation for page', pageIndex + 1);
      
      // Use the proper image generation prompt format for Gemini 2.5 Flash Image
      const imageGenerationPrompt = `Create a children's book illustration: ${imagePrompt}

Style requirements:
- Children's book illustration style
- Safe for ages 3-12
- ${stylePrompt}
- Professional quality suitable for publication
- Include SynthID watermark for AI content identification`;

      // Prepare content parts for generation
      const contentParts: any[] = [{ text: imageGenerationPrompt }];
      
      // Add character reference images if available and character consistency is enabled
      console.log('🔍 Debug - characterConsistency:', characterConsistency);
      console.log('🔍 Debug - characterReferences:', characterReferences?.length || 0);
      
      if (characterConsistency && characterReferences && characterReferences.length > 0) {
        console.log(`✨ Adding ${characterReferences.length} character reference(s) for consistency`);
        
        for (const charRef of characterReferences) {
          if (charRef.referenceImage && charRef.referenceImage.startsWith('data:image/')) {
            // Extract base64 data from data URL
            const base64Data = charRef.referenceImage.split(',')[1];
            const mimeType = charRef.referenceImage.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
            
            contentParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }

      const result = await model.generateContent(contentParts);
      const response = await result.response;
      
      console.log('Gemini 2.5 Flash Image response candidates:', response.candidates?.length || 0);
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        console.log('Response parts:', parts.length, 'parts');
        
        // Look for image data in the response
        let foundImage = false;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
            // We got actual image data!
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('✅ Successfully generated AI image for page', pageIndex + 1);
            foundImage = true;
            break;
          }
        }
        
        if (!foundImage) {
          // The model is not configured for image generation or access is limited
          console.log('⚠️ Model returned text instead of image data');
          const colors = ['8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444', 'F97316'];
          const bgColor = colors[pageIndex % colors.length];
          imageUrl = `https://via.placeholder.com/512x512/${bgColor}/FFFFFF?text=Page+${pageIndex + 1}+Text+Only`;
          warnings.push('Image generation not available with current API access - contact Google AI for Gemini 2.5 Flash Image Preview access');
        }
      } else {
        throw new Error('No valid response from Gemini 2.5 Flash Image Preview');
      }
      
    } catch (error: any) {
      console.warn('AI image generation failed, using placeholder:', error.message);
      
      // Fallback to placeholder
      const colors = ['8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444', 'F97316'];
      const bgColor = colors[pageIndex % colors.length];
      const textColor = 'FFFFFF';
      imageUrl = `https://via.placeholder.com/512x512/${bgColor}/${textColor}?text=Page+${pageIndex + 1}+Fallback`;
      
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        warnings.push('Rate limit reached - using placeholder image');
      } else {
        warnings.push('Image generation unavailable - using placeholder');
      }
    }

    return NextResponse.json({
      imageUrl,
      prompt: imagePrompt,
      warnings,
      metadata: {
        model: selectedModel,
        timestamp: Date.now(),
        pageIndex,
      },
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}