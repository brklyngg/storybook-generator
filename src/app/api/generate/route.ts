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
    const { pageIndex, caption, stylePrompt, characterConsistency, previousPages } = 
      GenerateRequestSchema.parse(body);

    // Try different models in order of preference
    const models = [
      'gemini-2.0-flash-thinking-exp-01-21',  // Latest model
      'gemini-1.5-flash',                      // Stable model
      'gemini-1.5-pro'                        // Fallback
    ];
    
    let model;
    let selectedModel = models[0]; // Default to first model
    
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
      console.warn('Failed to initialize model, using fallback');
      selectedModel = 'gemini-1.5-flash';
      model = genAI.getGenerativeModel({ model: selectedModel });
    }

    let consistencyPrompt = '';
    if (characterConsistency && previousPages && previousPages.length > 0) {
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
      // Try to generate actual image with AI
      console.log('Attempting AI image generation for page', pageIndex + 1);
      
      const result = await model.generateContent([{
        text: imagePrompt + '\n\nPlease generate a detailed image description that could be used to create a children\'s book illustration.'
      }]);

      const response = await result.response;
      const generatedDescription = response.text();
      
      // For now, we'll use the description but still show placeholder
      // In the future, this is where you'd call an actual image generation service
      console.log('Generated image description:', generatedDescription.substring(0, 100) + '...');
      
      // Generate colorful placeholder with the page info
      const colors = ['8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444', 'F97316'];
      const bgColor = colors[pageIndex % colors.length];
      const textColor = 'FFFFFF';
      imageUrl = `https://via.placeholder.com/512x512/${bgColor}/${textColor}?text=Page+${pageIndex + 1}+AI+Ready`;
      
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