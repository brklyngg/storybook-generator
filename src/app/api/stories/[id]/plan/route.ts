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
        targetAge: z.number().min(3).max(18),
        harshness: z.number().min(0).max(10),
        aestheticStyle: z.string(),
        freeformNotes: z.string(),
        desiredPageCount: z.number().min(5).max(30),
        characterConsistency: z.boolean(),
        qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).optional(),
        aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).optional(),
        enableSearchGrounding: z.boolean().optional(),
        customHeroImage: z.string().optional(), // Base64 hero photo
    }),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: storyId } = await params;

    if (!genAI) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    if (!supabase) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        
        // Validate and parse with user-friendly errors
        const parseResult = PlanRequestSchema.safeParse(body);
        if (!parseResult.success) {
            const issues = parseResult.error.issues;
            const ageIssue = issues.find(i => i.path.includes('targetAge'));
            if (ageIssue) {
                return NextResponse.json({ 
                    error: `Child's age must be between 3 and 18 years. You entered: ${body.settings?.targetAge}` 
                }, { status: 400 });
            }
            return NextResponse.json({ 
                error: `Invalid settings: ${issues.map(i => i.message).join(', ')}` 
            }, { status: 400 });
        }
        const { text, settings } = parseResult.data;

        // Update story status
        await supabase.from('stories').update({
            status: 'planning',
            current_step: 'Generating story structure...'
        }).eq('id', storyId);

        const modelName = 'gemini-3-pro-preview';
        const model = genAI.getGenerativeModel({ model: modelName });

        // Generate age-appropriate content guidelines based on numeric age
        const getAgeGuidelines = (age: number): string => {
            if (age <= 5) {
                return 'Very simple language, basic concepts, gentle themes, no scary elements, bright and cheerful imagery';
            } else if (age <= 8) {
                return 'Simple sentences, adventure themes, mild challenges, positive outcomes, engaging action';
            } else if (age <= 12) {
                return 'More complex plots, character development, moral lessons, age-appropriate conflicts, sophisticated storytelling';
            } else {
                return 'Advanced narratives, nuanced themes, complex emotional depth, mature conflict resolution, sophisticated visual storytelling';
            }
        };

        const ageGuidelines = getAgeGuidelines(settings.targetAge);

        // Cap intensity for younger children, allow full range for older readers
        const maxIntensityForAge = settings.targetAge <= 5 ? 5 : settings.targetAge <= 8 ? 7 : 10;
        const intensityLevel = Math.min(settings.harshness, maxIntensityForAge);

        const prompt = `
You are an expert children's book author and visual storyteller. Use your advanced reasoning to transform this story into a ${settings.desiredPageCount}-page picture book for a ${settings.targetAge}-year-old reader.

CRITICAL REQUIREMENT: You MUST create exactly ${settings.desiredPageCount} pages.

STEP 1: ANALYZE THE STORY
(Analyze complete narrative structure, identify core emotional arc, determine protagonist's journey, find visually compelling scenes, consider what ${settings.targetAge}-year-olds find engaging)

STORY TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '...' : ''}

CONTENT GUIDELINES:
- Target reader age: ${settings.targetAge} years old
- Age appropriateness: ${ageGuidelines}
- Intensity level: ${intensityLevel}/10 (This is CRITICAL - at level ${settings.harshness}, you should create imagery that is as intense and dramatic as is appropriate for a ${settings.targetAge}-year-old American reader. Level 10 means MAXIMUM intensity - vivid action, dramatic moments, intense emotions, challenging themes - while remaining age-appropriate. Do NOT hold back if intensity is high.)
- Additional creative direction: ${settings.freeformNotes}

STEP 2: STRATEGIC SCENE SELECTION (Use your reasoning capabilities)
Apply these principles to select exactly ${settings.desiredPageCount} scenes:

1. NARRATIVE ESSENTIALS: Include pivotal plot moments that drive the story forward
2. EMOTIONAL PEAKS: Capture moments of highest emotional impact (joy, discovery, challenge, resolution)
3. VISUAL IMPACT: Choose scenes with strong visual potential and variety - different locations, times of day, weather, indoor/outdoor settings
4. CHARACTER DEVELOPMENT: Show character growth and relationships
5. PACING: Balance action, reflection, and emotional beats - vary quiet moments with dynamic scenes
6. ICONIC MOMENTS: If this story is well-known, include the scenes readers expect
7. AGE APPROPRIATENESS: Select moments that resonate with ${settings.targetAge}-year-olds
8. INTENSITY: At intensity level ${settings.harshness}/10, include dramatic, vivid, emotionally intense moments appropriate for this age
9. NARRATIVE ENRICHMENT & HISTORICAL ACCURACY: For each scene:
   - Include period-accurate elements (clothing, architecture, objects, art styles appropriate to the setting)
   - Add background details that convey story context and world-building
   - For well-known stories, include subtle nods to iconic elements ONLY if they have already occurred in the story up to that page
   - STRICT CHRONOLOGY: Never include visual references to future events or elements not yet established
   - No anachronisms - every detail must be historically/culturally appropriate to the setting
   - Create visually rich scenes that reward careful, repeated viewing

For stories SHORTER than ${settings.desiredPageCount} scenes:
- Break complex moments into multiple pages (setup → action → result)
- Add emotional reaction beats between major events
- Expand world-building moments (show the environment, daily life, relationships)
- Include transition scenes that maintain narrative flow

For stories LONGER than ${settings.desiredPageCount} scenes:
- Combine related moments into single impactful pages
- Focus on the highest-value narrative beats
- Summarize less critical events in captions while showing the most important visual

STEP 3: CHARACTER CONSISTENCY PLANNING (Critical for Nano Banana Pro)
For each character that appears:
- Create a PRECISE visual description that will remain consistent
- Note distinctive features (clothing, hair, props, colors, physical traits)
- Specify scale/size relative to other characters
- Identify any props or accessories they always carry
- Maximum 5 main characters for optimal Nano Banana Pro consistency

STEP 4: OUTPUT FORMAT
Generate exactly ${settings.desiredPageCount} pages following this JSON structure:
{
  "reasoning": "Brief explanation of your scene selection strategy for this story",
  "storyArcSummary": [
    "First major story beat or turning point (one sentence)",
    "Second major story beat (one sentence)",
    "Third major story beat (one sentence)",
    "Fourth major story beat or resolution (one sentence)"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "caption": "Engaging caption appropriate for a ${settings.targetAge}-year-old reader",
      "prompt": "FULL-PAGE illustration (no text/typography in image) with: [specific scene setting - location, time of day, weather/atmosphere], [character positions, actions, and expressions], [historically/culturally accurate period elements - clothing, architecture, objects], [environmental details that convey world-building and setting], [background details that reward careful observation]. CHRONOLOGY: Only reference story elements established up to this page - no foreshadowing. NO ANACHRONISMS - every detail must be period-appropriate. Ensure image fills entire canvas edge-to-edge. At intensity ${settings.harshness}/10, make this ${settings.harshness >= 7 ? 'dramatic, vivid, and emotionally intense' : settings.harshness >= 4 ? 'moderately engaging with some tension' : 'gentle and calm'}. Use ${settings.aestheticStyle} style.",
      "cameraAngle": "wide shot | medium shot | close-up | aerial | worms eye | over shoulder | point of view (select the most appropriate for this specific scene's emotional content and narrative purpose)"
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "PRECISE visual description: [physical features], [clothing and colors], [distinctive props], [approximate age/size]",
      "role": "main" | "supporting" | "background"
    }
  ],
  "theme": "The story's central theme"
}

IMPORTANT REQUIREMENTS:
- The "storyArcSummary" must be an array of 3-5 concise bullet points (one sentence each) that capture the major story beats
- Each page's "prompt" must include SPECIFIC details: exact location name, time of day, weather/lighting, character positions and actions, period-accurate elements
- Each page's "cameraAngle" must be chosen to match the scene's emotional content (e.g., wide shot for establishing scenes, close-up for emotional moments, aerial for journey scenes)
- VISUAL VARIETY: Vary locations, times of day, camera angles, and atmospheres across pages. Do NOT repeat the same setting for consecutive pages unless narratively essential.
- Count your pages: You must have exactly ${settings.desiredPageCount} page objects
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format from AI');

        const planData = JSON.parse(jsonMatch[0]);

        // Determine which character should be the hero (uses uploaded photo)
        // The hero is the first "main" character when a custom hero image is provided
        const hasHeroImage = !!settings.customHeroImage;
        let heroAssigned = false;

        // Save everything in parallel to save time
        const [themeUpdate, charactersResult, pagesResult] = await Promise.all([
            // 1. Save Theme
            supabase.from('stories').update({ theme: planData.theme }).eq('id', storyId),

            // 2. Save Characters (mark first main character as hero if hero image exists)
            supabase.from('characters').insert(
                (planData.characters || []).map((char: any, index: number) => {
                    const role = char.role || (index < 2 ? 'main' : index < 5 ? 'supporting' : 'background');
                    // Mark the first main character as the hero if we have a hero image
                    const isHero = hasHeroImage && role === 'main' && !heroAssigned;
                    if (isHero) heroAssigned = true;

                    return {
                        story_id: storyId,
                        name: char.name,
                        description: char.description,
                        role,
                        is_hero: isHero, // Database column
                        status: 'pending'
                    };
                })
            ).select(),

            // 3. Save Pages (include cameraAngle for story-driven visual variety)
            supabase.from('pages').insert(
                (planData.pages || []).map((page: any) => ({
                    story_id: storyId,
                    page_number: page.pageNumber,
                    caption: page.caption,
                    prompt: page.prompt,
                    camera_angle: page.cameraAngle || 'medium shot', // Default fallback
                    status: 'pending'
                }))
            )
        ]);

        if (charactersResult.error) throw charactersResult.error;
        if (pagesResult.error) throw pagesResult.error;

        const savedCharacters = charactersResult.data;

        const styleBible = createStyleBible(
            settings.aestheticStyle,
            settings.targetAge,
            settings.qualityTier || 'standard-flash'
        );

        // Generate fallback storyArcSummary if AI didn't provide one
        const storyArcSummary = planData.storyArcSummary && planData.storyArcSummary.length > 0
            ? planData.storyArcSummary
            : planData.pages.slice(0, Math.min(4, planData.pages.length)).map((p: any) => p.caption);

        return NextResponse.json({
            characters: savedCharacters, // Returns IDs for client to iterate
            pages: planData.pages, // Full page data for plan review
            pageCount: planData.pages.length,
            storyArcSummary, // 3-5 bullet points for story overview
            theme: planData.theme,
            styleBible
        });

    } catch (error: any) {
        console.error('Planning error:', error);
        await supabase?.from('stories').update({ status: 'error', current_step: 'Failed to plan story' }).eq('id', storyId);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
