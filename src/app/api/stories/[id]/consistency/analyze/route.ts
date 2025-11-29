import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { buildConsistencyAnalysisPrompt } from '@/lib/consistency-prompts';
import type { ConsistencyAnalysis, ConsistencyIssue } from '@/lib/types';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not configured');
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Retry helper with exponential backoff
async function withRetry<T>(
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
      const isRetryable =
        error.status === 503 ||
        error.message?.includes('overloaded') ||
        error.message?.includes('rate limit');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Consistency analysis attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// Extract base64 data from data URL
function extractBase64(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!genAI) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured' },
      { status: 500 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    // Fetch all pages with images
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('page_number, caption, prompt, image_url')
      .eq('story_id', storyId)
      .order('page_number', { ascending: true });

    if (pagesError) throw pagesError;

    // Filter to only pages that have images
    const pagesWithImages = (pages || []).filter((p) => p.image_url);

    if (pagesWithImages.length === 0) {
      return NextResponse.json({
        issues: [],
        pagesNeedingRegeneration: [],
      } as ConsistencyAnalysis);
    }

    // Fetch characters for reference (including is_hero flag)
    const { data: characters, error: charsError } = await supabase
      .from('characters')
      .select('name, description, role, reference_image, is_hero')
      .eq('story_id', storyId);

    if (charsError) throw charsError;

    // Fetch style bible and settings from story
    const { data: story } = await supabase
      .from('stories')
      .select('settings')
      .eq('id', storyId)
      .single();

    // Check if there's a hero photo uploaded
    const hasHeroPhoto = !!story?.settings?.customHeroImage;

    // Build the analysis prompt with hero photo awareness
    const analysisPrompt = buildConsistencyAnalysisPrompt(
      (characters || []).map((c) => ({
        name: c.name,
        description: c.description,
        role: c.role,
        isHero: c.is_hero,
      })),
      pagesWithImages.length,
      story?.settings?.styleBible,
      hasHeroPhoto
    );

    // Build content parts: text prompt + all page images
    const contentParts: any[] = [{ text: analysisPrompt }];

    // Add hero photo first if it exists (for protagonist comparison)
    if (hasHeroPhoto && story?.settings?.customHeroImage) {
      const heroChar = (characters || []).find(c => c.is_hero);
      contentParts.push({
        text: `[HERO PHOTO REFERENCE${heroChar ? `: ${heroChar.name}` : ''}] - The protagonist MUST match this photo's appearance (especially hair color and facial features) on ALL pages.`,
      });
      contentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: extractBase64(story.settings.customHeroImage),
        },
      });
    }

    // Add character reference images (for comparison)
    for (const char of characters || []) {
      if (char.reference_image) {
        const heroMarker = char.is_hero ? ' [HERO]' : '';
        contentParts.push({
          text: `[CHARACTER REFERENCE: ${char.name}${heroMarker}]`,
        });
        contentParts.push({
          inlineData: {
            mimeType: 'image/png',
            data: extractBase64(char.reference_image),
          },
        });
      }
    }

    // Add all page images in order
    for (const page of pagesWithImages) {
      contentParts.push({
        text: `[PAGE ${page.page_number}]`,
      });
      contentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: extractBase64(page.image_url),
        },
      });
    }

    // Call Gemini with retry logic
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await withRetry(async () => {
      const response = await model.generateContent(contentParts);
      return response;
    });

    const responseText = result.response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in consistency analysis response');
      return NextResponse.json({
        issues: [],
        pagesNeedingRegeneration: [],
      } as ConsistencyAnalysis);
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    // Validate and sanitize the response
    const issues: ConsistencyIssue[] = (analysisResult.issues || []).map(
      (issue: any) => ({
        pageNumber: Number(issue.pageNumber) || 0,
        type: issue.type || 'character_appearance',
        description: String(issue.description || ''),
        characterInvolved: issue.characterInvolved
          ? String(issue.characterInvolved)
          : undefined,
        fixPrompt: String(issue.fixPrompt || 'Ensure visual consistency with character references'),
      })
    );

    const pagesNeedingRegeneration: number[] = (
      analysisResult.pagesNeedingRegeneration || []
    )
      .map((p: any) => Number(p))
      .filter((p: number) => p > 0 && p <= pagesWithImages.length);

    console.log(
      `Consistency analysis complete: ${issues.length} issues found, ${pagesNeedingRegeneration.length} pages to regenerate`
    );

    return NextResponse.json({
      issues,
      pagesNeedingRegeneration,
    } as ConsistencyAnalysis);
  } catch (error: any) {
    console.error('Consistency analysis error:', error);
    // Return empty analysis on error (fail gracefully)
    return NextResponse.json({
      issues: [],
      pagesNeedingRegeneration: [],
    } as ConsistencyAnalysis);
  }
}
