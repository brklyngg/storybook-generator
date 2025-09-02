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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
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

    // Generate placeholder image for demo (avoiding rate limits)
    const colors = ['8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444', 'F97316'];
    const bgColor = colors[pageIndex % colors.length];
    const textColor = 'FFFFFF';
    const imageUrl = `https://via.placeholder.com/512x512/${bgColor}/${textColor}?text=Page+${pageIndex + 1}+Illustration`;

    // Comment out the actual API call to avoid rate limiting
    // const result = await model.generateContent([{ text: imagePrompt }]);
    // const response = await result.response;

    return NextResponse.json({
      imageUrl,
      prompt: imagePrompt,
      warnings: [],
      metadata: {
        model: 'gemini-2.0-flash-exp',
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