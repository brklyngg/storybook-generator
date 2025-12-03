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

        // Calculate story text length requirements based on age
        const getStoryTextLength = (age: number): { min: number; max: number; sentences: string } => {
            if (age <= 7) {
                return { min: 50, max: 100, sentences: '2-3 rich, evocative sentences' };
            } else if (age <= 12) {
                return { min: 75, max: 150, sentences: '3-5 well-crafted sentences' };
            } else {
                return { min: 100, max: 200, sentences: '4-6 sophisticated sentences' };
            }
        };
        const textLengthReq = getStoryTextLength(settings.targetAge);

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

STEP 2: STRATEGIC SCENE SELECTION - CHOOSE THE MOST VISUALLY COMPELLING MOMENTS

You are selecting the ${settings.desiredPageCount} MOST VISUALLY SPECTACULAR moments from the entire story.

### MANDATORY VARIETY RULES (ENFORCE STRICTLY):

1. **CAMERA ANGLE DISTRIBUTION** - Across ${settings.desiredPageCount} pages, you MUST use:
   - At least 2 WIDE/ESTABLISHING shots (show full environment, multiple characters)
   - At least 2 CLOSE-UPS on faces/emotions (intimate, powerful moments)
   - At least 1 DRAMATIC ANGLE (bird's eye view, worm's eye view, dutch angle, over-shoulder)
   - Fill remaining slots with varied MEDIUM shots showing dynamic action
   - NEVER use the same camera angle on consecutive pages

2. **NO SIMILAR COMPOSITIONS** - Each page MUST have DIFFERENT:
   - Camera angle (as distributed above)
   - Character positioning (solo portrait → duo → group → crowd → distant figures)
   - Action type (confrontation → pursuit → discovery → reflection → celebration)
   - Setting/location (indoor → outdoor → different rooms → different times of day)

3. **PIVOTAL MOMENTS ONLY** - Select scenes that are:
   - TURNING POINTS in the narrative (decisions that change everything)
   - EMOTIONAL PEAKS (maximum joy, fear, triumph, loss, surprise)
   - VISUAL SPECTACLES (battles, transformations, revelations, arrivals)
   - CHARACTER-DEFINING ACTIONS (showing who they truly are through deeds, not words)

4. **MID-ACTION REQUIREMENT** - Every scene must show characters:
   - IN THE MIDDLE of doing something dramatic (not before, not after)
   - With VISIBLE EMOTION on their faces (not neutral expressions)
   - In DYNAMIC POSES (running, leaping, reaching, embracing - NOT standing still)
   - Like a FREEZE-FRAME from the most exciting moment of a movie scene

### ANTI-PATTERNS - DO NOT DO THESE:
- ❌ Characters standing and talking (BORING - show action instead)
- ❌ Same setting for multiple consecutive pages (vary locations)
- ❌ Similar character groupings repeatedly (vary who's in frame)
- ❌ Static poses without motion or emotion (show movement)
- ❌ Redundant scenes that could be combined (each page must be essential)
- ❌ Mostly medium shots (actively vary camera angles)

### SCENE SELECTION PROCESS:
1. Identify the story's 3-5 most DRAMATIC turning points
2. Identify 2-3 emotional peaks (maximum joy, fear, triumph, loss)
3. Identify 2-3 visually spectacular settings or events
4. Distribute across ${settings.desiredPageCount} pages, ensuring NO two consecutive pages have similar compositions
5. For EACH scene, describe a DYNAMIC action happening at that exact moment

STEP 3: STORY TEXT (THE "CAPTIONS") - WRITE BEAUTIFUL PROSE

CRITICAL: These are NOT image captions. This is the STORY TEXT that a parent will read aloud as a bedtime story, or a child will read for the first time in their lives. Write with the care and beauty of classic children's literature.

### LENGTH REQUIREMENTS:
- Write ${textLengthReq.sentences} per page (${textLengthReq.min}-${textLengthReq.max} words)
- The text must be substantial enough to convey the full story even without images
- Short, choppy text is UNACCEPTABLE - write rich, flowing prose

### PROSE QUALITY REQUIREMENTS:
- Write with the beauty and rhythm of classic children's literature (think Maurice Sendak, Roald Dahl, E.B. White)
- Use VIVID, age-appropriate vocabulary that delights the ear when read aloud
- Include DIALOGUE where it adds drama (use quotation marks: "I will never give up!" she cried)
- Capture EMOTIONS, SENSORY DETAILS, and ATMOSPHERE (sounds, smells, textures, temperatures)
- VARY SENTENCE STRUCTURE for rhythm (mix short punchy sentences with longer flowing ones)
- Create sentences that are a JOY to read aloud

### NARRATIVE FUNCTION:
- Each page's text must ADVANCE THE PLOT meaningfully
- Include character THOUGHTS, FEELINGS, and MOTIVATIONS
- Use TRANSITIONS between scenes ("The next morning...", "Meanwhile, far away...", "But little did she know...")
- BUILD TENSION and deliver PAYOFFS across the page sequence

### EXAMPLE TRANSFORMATION:
BAD (too short, boring): "The rabbit was scared."

GOOD (rich, evocative, age-appropriate for 6-year-old):
"Peter's heart pounded like a drum in his small furry chest as he squeezed beneath the garden gate. Behind him, the farmer's heavy boots thundered closer and closer. 'I must find the way out,' Peter whispered to himself, his whiskers trembling. He remembered what his mother had told him that very morning: 'Stay away from Mr. McGregor's garden, or you'll end up in a pie!' But it was far too late for that now."

STEP 4: CHARACTER CONSISTENCY PLANNING

For each character, provide TWO types of descriptions:

1. **visualDescription**: PRECISE physical details for image generation
   - Physical features (hair, eyes, skin, build, age appearance)
   - Clothing and colors (specific, consistent)
   - Distinctive props or accessories (always carries...)
   - Scale/size relative to others

2. **displayDescription**: WHO they are in the STORY (shown to readers)
   - Their role and importance in the narrative
   - Their relationships to other characters
   - Their personality or defining trait
   - Their arc or what happens to them
   - Example: "The proud king whose arrogance brings plague upon his army. His clash with Achilles will shatter their alliance forever."

Also provide **approximateAge** for each character (e.g., "~40s", "young adult", "elderly", "child ~8", "teenager")

STEP 5: OUTPUT FORMAT
Generate exactly ${settings.desiredPageCount} pages following this JSON structure:
{
  "reasoning": "Brief explanation of your scene selection strategy, noting how you ensured visual variety",
  "storyArcSummary": [
    "First major story beat or turning point (one sentence)",
    "Second major story beat (one sentence)",
    "Third major story beat (one sentence)",
    "Fourth major story beat or resolution (one sentence)"
  ],
  "pages": [
    {
      "pageNumber": 1,
      "caption": "${textLengthReq.sentences} of beautifully written story text (${textLengthReq.min}-${textLengthReq.max} words) that advances the plot and is a joy to read aloud",
      "prompt": "FULL-PAGE illustration (no text/typography in image) with: [specific scene setting - location, time of day, weather/atmosphere], [character IN MID-ACTION with visible emotion - describe the exact dynamic pose], [historically/culturally accurate period elements], [environmental details that convey world-building]. FREEZE-FRAME MOMENT: Capture the peak of the action, not before or after. Ensure image fills entire canvas edge-to-edge. At intensity ${settings.harshness}/10, make this ${settings.harshness >= 7 ? 'dramatic, vivid, and emotionally intense' : settings.harshness >= 4 ? 'moderately engaging with some tension' : 'gentle and calm'}. Use ${settings.aestheticStyle} style.",
      "cameraAngle": "wide shot | medium shot | close-up | aerial | worms eye | over shoulder | point of view (MUST vary across pages per the distribution rules)"
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "visualDescription": "PRECISE visual details for image generation: [physical features], [clothing and colors], [distinctive props], [approximate age/size]",
      "displayDescription": "STORY ROLE for readers: [who they are], [their importance], [their relationships], [their arc]. 1-2 sentences.",
      "approximateAge": "~30s | young adult | elderly | child ~8 | teenager | etc.",
      "role": "main | supporting | background"
    }
  ],
  "theme": "The story's central theme"
}

FINAL CHECKLIST:
- [ ] Exactly ${settings.desiredPageCount} pages created
- [ ] Each caption is ${textLengthReq.min}-${textLengthReq.max} words of beautiful prose (NOT short)
- [ ] Camera angles vary (2+ wide, 2+ close-up, 1+ dramatic, rest medium)
- [ ] No two consecutive pages have similar compositions
- [ ] Every scene shows MID-ACTION with visible emotion
- [ ] Characters have both visualDescription AND displayDescription
- [ ] Each character has an approximateAge
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

                    // Use visualDescription for image generation (backward compat: fall back to description)
                    const visualDesc = char.visualDescription || char.description;
                    // displayDescription is the story role for users to see
                    const displayDesc = char.displayDescription || '';
                    const approxAge = char.approximateAge || '';

                    return {
                        story_id: storyId,
                        name: char.name,
                        description: visualDesc, // Visual description for image generation
                        display_description: displayDesc, // Story role for UI display
                        approximate_age: approxAge, // Age for UI display
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
