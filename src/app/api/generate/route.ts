import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { z } from 'zod';
import { createPagePrompt, createUnifiedRealityPrompt } from '@/lib/prompting';
import type { BookSettings } from '@/lib/types';
import { supabase } from '@/lib/supabase';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not configured');
}

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

const GenerateRequestSchema = z.object({
  storyId: z.string().optional(),
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
  // Nano Banana Pro enhancements
  qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).default('standard-flash'),
  aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('2:3'),
  enableSearchGrounding: z.boolean().default(false),
  environmentReference: z.object({
    locationName: z.string(),
    referenceImage: z.string(),
  }).optional(),
  objectReferences: z.array(z.object({
    objectName: z.string(),
    referenceImage: z.string(),
  })).optional(),
  sceneTransition: z.object({
    fromPage: z.number(),
    timeProgression: z.string().optional(),
    locationChange: z.object({
      from: z.string(),
      to: z.string(),
    }).optional(),
  }).optional(),
  // Consistency fix instruction from auto-fix system
  consistencyFix: z.string().optional(),
  // Story-driven camera angle from planning phase (accepts descriptive text, will be normalized)
  cameraAngle: z.string().optional(),
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
    const {
      storyId,
      pageIndex,
      caption,
      stylePrompt,
      characterConsistency,
      previousPages,
      characterReferences,
      qualityTier: requestedQualityTier,
      aspectRatio,
      enableSearchGrounding,
      environmentReference,
      objectReferences,
      sceneTransition,
      consistencyFix,
      cameraAngle: requestedCameraAngle
    } = GenerateRequestSchema.parse(body);

    // Helper function to extract valid camera angle from potentially descriptive text
    const extractCameraAngle = (angle: string | undefined): 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worms eye' | 'dutch angle' | 'over shoulder' | 'point of view' | undefined => {
      if (!angle) return undefined;
      
      const normalized = angle.toLowerCase();
      
      // Map common variations and extract core camera angle
      if (normalized.includes('wide shot') || normalized.includes('wide-shot')) return 'wide shot';
      if (normalized.includes('medium shot') || normalized.includes('medium-shot')) return 'medium shot';
      if (normalized.includes('close-up') || normalized.includes('closeup')) return 'close-up';
      if (normalized.includes('aerial') || normalized.includes('bird') || normalized.includes('high angle')) return 'aerial';
      if (normalized.includes('worm') || normalized.includes('low angle') || normalized.includes('looking up')) return 'worms eye';
      if (normalized.includes('dutch')) return 'dutch angle';
      if (normalized.includes('over shoulder') || normalized.includes('over-shoulder')) return 'over shoulder';
      if (normalized.includes('point of view') || normalized.includes('pov') || normalized.includes('first person')) return 'point of view';
      
      // If no match, return undefined to use default
      return undefined;
    };

    // Extract and normalize camera angle
    // First try to extract from potentially descriptive text, then use fallback pattern
    const normalizedAngle = extractCameraAngle(requestedCameraAngle);
    const effectiveCameraAngle = normalizedAngle ||
      (pageIndex % 5 === 0 ? 'wide shot' :
       pageIndex % 5 === 1 ? 'medium shot' :
       pageIndex % 5 === 2 ? 'close-up' :
       pageIndex % 5 === 3 ? 'over shoulder' : 'aerial');

    // Detect if this is a crowd/group scene requiring extra consistency guidance
    const detectCrowdScene = (text: string): boolean => {
      const crowdKeywords = [
        'crowd', 'soldiers', 'army', 'gathered', 'assembly', 'meeting',
        'group of', 'many people', 'villagers', 'warriors', 'court', 'audience',
        'surrounded by', 'onlookers', 'spectators', 'people watching', 'council',
        'gathering', 'citizens', 'troops', 'guards', 'servants', 'attendants',
        'followers', 'companions', 'crew', 'people'
      ];
      return crowdKeywords.some(kw => text.toLowerCase().includes(kw));
    };

    // Detect multi-character scenes (2+ named characters mentioned in caption)
    const isMultiCharacterScene = (text: string, charRefs: typeof characterReferences): boolean => {
      if (!charRefs || charRefs.length < 2) return false;
      const lowerText = text.toLowerCase();
      // Extract unique character names (strip " (ref X/Y)" suffix if present)
      const uniqueNames = [...new Set(charRefs.map(c => c.name.split(' (ref ')[0].toLowerCase()))];
      const mentionedCount = uniqueNames.filter(name => lowerText.includes(name)).length;
      return mentionedCount >= 2;
    };

    const isCrowdScene = detectCrowdScene(caption);
    const hasMultipleCharacters = isMultiCharacterScene(caption, characterReferences);
    const needsStyleUnityGuidance = isCrowdScene || hasMultipleCharacters;

    // Feature flag: Check if Nano Banana Pro is enabled
    const nanoBananaProEnabled = process.env.ENABLE_NANO_BANANA_PRO !== 'false';

    // Allow environment variable to force quality tier (for testing)
    const qualityTier = process.env.FORCE_QUALITY_TIER as BookSettings['qualityTier'] ||
      requestedQualityTier ||
      (process.env.DEFAULT_QUALITY_TIER as BookSettings['qualityTier']) ||
      'standard-flash';

    // If Nano Banana Pro is disabled, force standard-flash
    const effectiveQualityTier = nanoBananaProEnabled ? qualityTier : 'standard-flash';

    if (!nanoBananaProEnabled && qualityTier !== 'standard-flash') {
      console.warn('⚠️ Nano Banana Pro is disabled. Falling back to standard-flash.');
    }

    // Select model based on quality tier - using Gemini 3 Pro Image for all tiers
    const selectedModel = 'gemini-3-pro-image-preview';

    const imageSize = effectiveQualityTier === 'premium-4k' ? '4K' :
      (effectiveQualityTier === 'premium-2k' ? '2K' : '1K');

    console.log(`📸 Generation request: page ${pageIndex + 1}, quality: ${effectiveQualityTier}, model: ${selectedModel}`);

    let model;
    try {
      model = genAI.getGenerativeModel({
        model: selectedModel,
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
    } catch (error) {
      console.warn('Failed to initialize Gemini 3 Pro Image, using fallback');
      // Fallback to Gemini 3 Pro for text generation only
      const fallbackModel = 'gemini-3-pro-preview';
      model = genAI.getGenerativeModel({ model: fallbackModel });
    }

    // Build enhanced consistency prompt for Nano Banana Pro
    let consistencyPrompt = '';
    if (characterConsistency && characterReferences && characterReferences.length > 0) {
      const characterNames = characterReferences.map(c => c.name).join(', ');
      consistencyPrompt = `
CHARACTER CONSISTENCY REQUIREMENTS (Nano Banana Pro):
- MATCH THE PROVIDED CHARACTER REFERENCE IMAGES EXACTLY
- Preserve exact facial features, hair style/color, clothing, and body proportions from references
- Characters: ${characterNames}
- Use the reference images as the SOURCE OF TRUTH for character appearance
- Maintain consistent color palette and artistic approach
- Ensure characters are immediately recognizable across all scenes
`;
    }

    // Add scene transition instructions
    if (sceneTransition) {
      consistencyPrompt += `
SCENE TRANSITION (from page ${sceneTransition.fromPage} to ${pageIndex + 1}):
${sceneTransition.timeProgression ? `- Time: ${sceneTransition.timeProgression}` : ''}
${sceneTransition.locationChange ? `- Location: Moving from "${sceneTransition.locationChange.from}" to "${sceneTransition.locationChange.to}"` : ''}
- Maintain visual continuity while showing the progression
`;
    }

    // Add Google Search grounding if enabled
    let groundingPrompt = '';
    if (enableSearchGrounding) {
      groundingPrompt = `
FACTUAL ACCURACY (Google Search Grounding):
- Use Google Search to verify accurate appearance of real-world elements (animals, locations, objects, cultural items)
- Ensure authentic representation of any historical, geographic, or cultural elements
- Prioritize real-world accuracy for educational value
`;
    }

    /**
     * layoutHint: Changed from 'left space for text' to 'full-page illustration'
     *
     * DESIGN INTENT: Images should fill the entire canvas edge-to-edge.
     * Text/captions are displayed separately below each image in the UI,
     * not overlaid on the image itself. This ensures:
     * - Maximum visual impact and detail
     * - No awkward empty spaces in illustrations
     * - Clean separation between image and text content
     */
    const fullPrompt = createPagePrompt({
      sceneGoal: caption,
      caption,
      cameraAngle: effectiveCameraAngle,
      layoutHint: 'full-page illustration filling entire canvas edge-to-edge',
      characterRefs: previousPages?.map(p => `Reference page ${p.index}`) || [],
      styleConsistency: stylePrompt,
      safetyConstraints: 'child-friendly, no scary or inappropriate content',
      artStyle: stylePrompt, // Pass art style for unified reality prompt
    });

    // Generate style unity guidance for multi-character or crowd scenes
    const styleUnityGuidance = needsStyleUnityGuidance ? `
STYLE UNITY - MULTI-CHARACTER SCENE (CRITICAL):
${isCrowdScene ? '- This scene contains a CROWD - apply UNIFIED REALITY rules strictly' : '- This scene shows MULTIPLE NAMED CHARACTERS together - style consistency is essential'}
- ALL characters (named and unnamed) MUST share identical artistic DNA
- Every face uses the SAME stylization level as the protagonist
- All figures use the SAME head-to-body ratio (6-7 head-heights for adults, 4-5 for children)
- Distant figures are SMALLER in scale but NOT proportionally different
- MATCH the provided character references EXACTLY - same faces, same clothing, same features
- Vary individuals through pose, expression, action—NEVER through proportions or rendering style
- Characters interacting should look like they inhabit the SAME visual world
` : '';

    // Add consistency fix instruction if provided (from auto-fix system)
    const consistencyFixPrompt = consistencyFix
      ? `
IMPORTANT CONSISTENCY FIX REQUIRED:
${consistencyFix}
- This page is being regenerated to fix a visual consistency issue
- Pay EXTRA attention to matching character references exactly
`
      : '';

    // PROMPT ORDER STRATEGY: Character consistency FIRST (highest priority for Gemini)
    // then style unity, then scene details, then technical specs
    const imagePrompt = `
${consistencyPrompt}
${styleUnityGuidance}
${consistencyFixPrompt}${fullPrompt}
${groundingPrompt}

TECHNICAL REQUIREMENTS (Nano Banana Pro):
- Resolution: ${imageSize} (${aspectRatio} aspect ratio)
- High quality children's book illustration
- Safe for ages 3-12
- Clear, engaging composition with intricate beautiful backgrounds
- Professional picture book style suitable for print publication
- ${stylePrompt}

CONTENT DESCRIPTION:
${caption}

${environmentReference ? `LOCATION: ${environmentReference.locationName} - match the provided environment reference image` : ''}
${objectReferences && objectReferences.length > 0 ? `OBJECTS: ${objectReferences.map(o => o.objectName).join(', ')} - match the provided object reference images` : ''}

Generate a detailed, beautiful children's book illustration for this scene using Nano Banana Pro capabilities.
`;

    let imageUrl = '';
    let warnings: string[] = [];
    let referenceCount = 0;

    try {
      // Try to generate actual image with Gemini 3.0 Pro
      console.log('Attempting Gemini 3.0 Pro image generation for page', pageIndex + 1);

      /**
       * IMAGE GENERATION PROMPT
       *
       * DESIGN INTENT: This prompt explicitly instructs the AI to:
       * 1. Create FULL-PAGE images (no space reserved for text)
       * 2. NOT include any text, captions, or typography in the image
       * 3. Include historically/culturally accurate period details
       * 4. Create detailed backgrounds that reward careful viewing
       *
       * Text/captions are displayed separately below each image in the UI.
       */
      const imageGenerationPrompt = `Create a FULL-PAGE children's book illustration: ${imagePrompt}

CRITICAL IMAGE REQUIREMENTS:
- FULL-PAGE illustration that fills the entire canvas edge-to-edge
- DO NOT include any text, captions, titles, or typography in the image
- DO NOT leave space for text overlay - the image IS the full page
- Text will be displayed separately below the image in the app

Style requirements:
- Children's book illustration style
- Safe for ages 3-12
- ${stylePrompt}
- Professional quality suitable for publication
- Extremely detailed backgrounds that reward careful viewing
- Include historically/culturally accurate details appropriate to the story setting
- Every visual element should serve the narrative - no arbitrary decoration
- Include SynthID watermark for AI content identification`;

      // Prepare content parts for generation (Nano Banana Pro supports up to 14 reference images)
      const contentParts: any[] = [{ text: imageGenerationPrompt }];
      let referenceCount = 0;
      const MAX_REFERENCES = 14;

      console.log('🎨 Nano Banana Pro: Assembling reference images (max 14)');

      // Priority 1: Character reference images (most important for consistency)
      if (characterConsistency && characterReferences && characterReferences.length > 0) {
        console.log(`✨ Adding ${characterReferences.length} character reference(s)`);

        for (const charRef of characterReferences) {
          if (referenceCount >= MAX_REFERENCES) break;

          if (charRef.referenceImage && charRef.referenceImage.startsWith('data:image/')) {
            const base64Data = charRef.referenceImage.split(',')[1];
            const mimeType = charRef.referenceImage.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

            contentParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
            referenceCount++;
            console.log(`  ✓ Character: ${charRef.name} (${referenceCount}/${MAX_REFERENCES})`);
          }
        }
      }

      // Priority 2: Previous page(s) for scene continuity
      if (previousPages && previousPages.length > 0 && referenceCount < MAX_REFERENCES) {
        const pagesToInclude = previousPages.slice(-2).filter(p => p.imageUrl); // Last 2 pages with images
        console.log(`📄 Adding ${pagesToInclude.length} previous page(s) for continuity`);

        for (const prevPage of pagesToInclude) {
          if (referenceCount >= MAX_REFERENCES) break;

          if (prevPage.imageUrl && prevPage.imageUrl.startsWith('data:image/')) {
            const base64Data = prevPage.imageUrl.split(',')[1];
            const mimeType = prevPage.imageUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

            contentParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
            referenceCount++;
            console.log(`  ✓ Previous page ${prevPage.index + 1} (${referenceCount}/${MAX_REFERENCES})`);
          }
        }
      }

      // Priority 3: Environment reference (recurring location)
      if (environmentReference && referenceCount < MAX_REFERENCES) {
        console.log(`🏞️ Adding environment reference: ${environmentReference.locationName}`);

        if (environmentReference.referenceImage && environmentReference.referenceImage.startsWith('data:image/')) {
          const base64Data = environmentReference.referenceImage.split(',')[1];
          const mimeType = environmentReference.referenceImage.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

          contentParts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
          referenceCount++;
          console.log(`  ✓ Environment: ${environmentReference.locationName} (${referenceCount}/${MAX_REFERENCES})`);
        }
      }

      // Priority 4: Object references (recurring props)
      if (objectReferences && objectReferences.length > 0 && referenceCount < MAX_REFERENCES) {
        console.log(`🎁 Adding ${objectReferences.length} object reference(s)`);

        for (const objRef of objectReferences) {
          if (referenceCount >= MAX_REFERENCES) break;

          if (objRef.referenceImage && objRef.referenceImage.startsWith('data:image/')) {
            const base64Data = objRef.referenceImage.split(',')[1];
            const mimeType = objRef.referenceImage.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

            contentParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
            referenceCount++;
            console.log(`  ✓ Object: ${objRef.objectName} (${referenceCount}/${MAX_REFERENCES})`);
          }
        }
      }

      console.log(`📊 Total references: ${referenceCount}/${MAX_REFERENCES} slots used`);

      const result = await retryWithBackoff(
        () => model.generateContent(contentParts),
        3,
        1500
      );
      const response = await result.response;

      console.log('Gemini 3.0 Pro response candidates:', response.candidates?.length || 0);

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
          warnings.push('Image generation not available with current API access - contact Google AI for Gemini 3.0 Pro access');
        }
      } else {
        throw new Error('No valid response from Gemini 3.0 Pro');
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

    // Calculate cost based on effective quality tier
    const costPerImage = effectiveQualityTier === 'standard-flash' ? 0.039 :
      effectiveQualityTier === 'premium-2k' ? 0.134 :
        0.24; // premium-4k

    // Update Supabase if storyId is present
    if (storyId && supabase) {
      await supabase.from('pages').update({
        image_url: imageUrl,
        status: warnings.length > 0 ? 'completed_with_warnings' : 'completed'
      })
        .eq('story_id', storyId)
        .eq('page_number', pageIndex + 1); // pageIndex is 0-based, page_number is 1-based
    }

    return NextResponse.json({
      imageUrl,
      prompt: imagePrompt,
      warnings,
      metadata: {
        model: selectedModel,
        timestamp: Date.now(),
        pageIndex,
        qualityTier: effectiveQualityTier,
        aspectRatio,
        resolution: imageSize,
        cost: costPerImage,
        referenceImagesUsed: referenceCount,
        nanoBananaProEnabled,
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