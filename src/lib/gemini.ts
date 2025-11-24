import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not configured');
}

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export interface GeminiImageRequest {
  prompt: string;
  referenceImage?: string;
  stylePrompt?: string;
  safetySettings?: 'strict' | 'default';
}

export interface GeminiImageResponse {
  imageUrl: string;
  prompt: string;
  metadata: {
    model: string;
    timestamp: number;
    tokensUsed: number;
  };
  warnings?: string[];
}

export async function generateImage(request: GeminiImageRequest): Promise<GeminiImageResponse> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-image-preview',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    let fullPrompt = request.prompt;
    if (request.stylePrompt) {
      fullPrompt += `\n\nSTYLE: ${request.stylePrompt}`;
    }

    fullPrompt += '\n\nSAFETY: Child-friendly, appropriate for ages 3-12, no scary or inappropriate content';
    fullPrompt += '\n\nPlease include SynthID watermark for AI content identification';

    const parts: any[] = [{ text: fullPrompt }];

    if (request.referenceImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: request.referenceImage,
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;

    const imageData = response.candidates?.[0]?.content?.parts?.[0];

    if (!imageData) {
      throw new Error('No image generated in response');
    }

    const imageUrl = convertImageDataToUrl(imageData);

    return {
      imageUrl,
      prompt: fullPrompt,
      metadata: {
        model: 'gemini-3-pro-image-preview',
        timestamp: Date.now(),
        tokensUsed: 1290,
      },
      warnings: extractSafetyWarnings(response),
    };

  } catch (error: any) {
    console.error('Gemini image generation error:', error);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

export async function editImage(
  baseImageUrl: string,
  editPrompt: string,
  options?: { preserveStyle?: boolean }
): Promise<GeminiImageResponse> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

    const imageData = await urlToBase64(baseImageUrl);

    let fullPrompt = `Edit this image: ${editPrompt}`;
    if (options?.preserveStyle) {
      fullPrompt += '\n\nPreserve the original art style, color palette, and composition';
    }

    const parts: any[] = [
      { text: fullPrompt },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      },
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;

    const editedImageData = response.candidates?.[0]?.content?.parts?.[0];
    const editedImageUrl = convertImageDataToUrl(editedImageData);

    return {
      imageUrl: editedImageUrl,
      prompt: fullPrompt,
      metadata: {
        model: 'gemini-3-pro-image-preview',
        timestamp: Date.now(),
        tokensUsed: 1290,
      },
    };

  } catch (error: any) {
    console.error('Gemini image edit error:', error);
    throw new Error(`Failed to edit image: ${error.message}`);
  }
}

function convertImageDataToUrl(imageData: any): string {
  if (imageData.inlineData?.data) {
    return `data:image/jpeg;base64,${imageData.inlineData.data}`;
  }
  if (imageData.text) {
    return `data:image/svg+xml;base64,${Buffer.from(imageData.text).toString('base64')}`;
  }
  return `data:image/jpeg;base64,${Buffer.from('placeholder').toString('base64')}`;
}

function extractSafetyWarnings(response: any): string[] {
  const warnings: string[] = [];

  if (response.promptFeedback?.safetyRatings) {
    response.promptFeedback.safetyRatings.forEach((rating: any) => {
      if (rating.probability !== 'NEGLIGIBLE') {
        warnings.push(`Safety concern: ${rating.category}`);
      }
    });
  }

  return warnings;
}

async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

export { genAI };