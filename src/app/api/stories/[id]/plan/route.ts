import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createStyleBible } from '@/lib/prompting';
import { supabase } from '@/lib/supabase';
import {
    requiresSummarization,
    summarizeForAdaptation,
    summaryToPromptText,
    EnhancedSummary
} from '@/lib/summarize';

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
            current_step: 'Analyzing story structure...'
        }).eq('id', storyId);

        // Fetch current title to check if we need to update it later
        const { data: storyRecord } = await supabase
            .from('stories')
            .select('title')
            .eq('id', storyId)
            .single();
        const currentStoryTitle = storyRecord?.title;

        // ==============================================
        // PRE-SUMMARIZATION PIPELINE FOR LONG TEXTS
        // ==============================================
        let storyContentForPrompt: string;
        let enhancedSummary: EnhancedSummary | null = null;

        if (requiresSummarization(text)) {
            console.log(`📖 Text exceeds 15K chars (${text.length.toLocaleString()}), running summarization pipeline...`);

            // Update status to show we're summarizing
            await supabase.from('stories').update({
                current_step: 'Extracting narrative arc from long text...'
            }).eq('id', storyId);

            try {
                enhancedSummary = await summarizeForAdaptation(text, {
                    title: currentStoryTitle,
                    targetAge: settings.targetAge,
                    desiredPageCount: settings.desiredPageCount,
                    enableCulturalValidation: !!currentStoryTitle, // Only if we know the title
                });

                // Convert summary to prompt-friendly text
                storyContentForPrompt = summaryToPromptText(enhancedSummary);

                console.log(`✅ Summary generated: ${storyContentForPrompt.length.toLocaleString()} chars (from ${text.length.toLocaleString()})`);

                // Update status
                await supabase.from('stories').update({
                    current_step: 'Generating story structure from summary...'
                }).eq('id', storyId);

            } catch (summarizationError: unknown) {
                const err = summarizationError as Error;
                console.error('⚠️ Summarization failed, falling back to truncation:', err.message);

                // Fallback: beginning + ending truncation to preserve story arc
                const CONTEXT_SIZE = 4000;
                if (text.length > CONTEXT_SIZE * 2) {
                    const beginning = text.substring(0, CONTEXT_SIZE);
                    const ending = text.substring(text.length - CONTEXT_SIZE);
                    storyContentForPrompt = `${beginning}\n\n[... middle sections omitted for length ...]\n\n${ending}`;
                } else {
                    storyContentForPrompt = text.substring(0, 8000);
                }
            }
        } else {
            // Short text, use directly without truncation
            storyContentForPrompt = text;
        }

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

${enhancedSummary
    ? `LITERARY SUMMARY (extracted from ${enhancedSummary.metadata.originalLength.toLocaleString()}-character original text):

${storyContentForPrompt}

NOTE: This summary was extracted from the COMPLETE story. Pay special attention to scenes marked [MUST-INCLUDE] - these are culturally iconic moments that should be prioritized.`
    : `STORY TEXT:
${storyContentForPrompt}`}

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
  "title": "A concise, evocative title for this story (2-6 words that capture the essence - e.g., 'The Velveteen Rabbit', 'Where the Wild Things Are')",
  "reasoning": "Brief explanation of your scene selection strategy, noting how you ensured visual variety",
  "storyArcSummary": [
    "Setup: One sentence (10-20 words) summarizing the story beginning - WHO the main character is, WHERE they are, WHAT their normal world looks like",
    "Rising Action: One sentence (10-20 words) summarizing the inciting incident - WHAT happens to disrupt the normal world, WHAT journey begins",
    "Midpoint: One sentence (10-20 words) summarizing the key turning point - WHAT major event or discovery happens in the middle of the story",
    "Climax: One sentence (10-20 words) summarizing the dramatic peak - WHAT is the biggest challenge, confrontation, or crisis the character faces",
    "Resolution: One sentence (10-20 words) summarizing how it ends - HOW the story concludes, WHAT has changed, WHERE the character ends up"
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
- [ ] Title is 2-6 words, evocative, captures the story essence
- [ ] Exactly ${settings.desiredPageCount} pages created
- [ ] Each caption is ${textLengthReq.min}-${textLengthReq.max} words of beautiful prose (NOT short)
- [ ] Camera angles vary (2+ wide, 2+ close-up, 1+ dramatic, rest medium)
- [ ] No two consecutive pages have similar compositions
- [ ] Every scene shows MID-ACTION with visible emotion
- [ ] Characters have both visualDescription AND displayDescription
- [ ] Each character has an approximateAge
- [ ] storyArcSummary contains EXACTLY 5 plot summaries (NOT page caption excerpts), each 10-20 words covering Setup → Rising Action → Midpoint → Climax → Resolution
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format from AI');

        const planData = JSON.parse(jsonMatch[0]);

        // DEBUG: Log character data to see if displayDescription is being returned
        console.log('📋 Characters from AI:', JSON.stringify(planData.characters?.map((c: any) => ({
            name: c.name,
            hasVisualDesc: !!c.visualDescription,
            hasDisplayDesc: !!c.displayDescription,
            hasDescription: !!c.description,
            displayDesc: c.displayDescription?.substring(0, 50)
        })), null, 2));

        // Determine which character should be the hero (uses uploaded photo)
        // The hero is the first "main" character when a custom hero image is provided
        const hasHeroImage = !!settings.customHeroImage;
        let heroAssigned = false;

        // Save everything in parallel to save time
        const [themeUpdate, charactersResult, pagesResult] = await Promise.all([
            // 1. Save Theme AND Title (only update title if it's currently "Untitled Story")
            supabase.from('stories').update({
                theme: planData.theme,
                ...(currentStoryTitle === 'Untitled Story' && planData.title ? { title: planData.title } : {})
            }).eq('id', storyId),

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

        // DEBUG: Log what Supabase returned for characters
        console.log('📦 Saved characters from Supabase:', JSON.stringify(savedCharacters?.map((c: any) => ({
            id: c.id,
            name: c.name,
            hasDisplayDesc: !!c.display_description,
            displayDesc: c.display_description?.substring(0, 50)
        })), null, 2));

        const styleBible = createStyleBible(
            settings.aestheticStyle,
            settings.targetAge,
            settings.qualityTier || 'standard-flash'
        );

        // Validate storyArcSummary - must have exactly 5 beats, each brief (10-30 words)
        const isValidStoryArc = (beats: string[]): boolean => {
            if (!beats || beats.length !== 5) return false;
            return beats.every(beat => {
                const wordCount = beat.split(/\s+/).length;
                // Each beat should be 10-30 words (brief but descriptive)
                return wordCount >= 10 && wordCount <= 30;
            });
        };

        // Generate intelligent fallback storyArcSummary if AI didn't provide valid 5-point arc
        let storyArcSummary: string[];
        if (planData.storyArcSummary && isValidStoryArc(planData.storyArcSummary)) {
            storyArcSummary = planData.storyArcSummary;
        } else {
            // Fallback: generate a proper 5-point arc from page captions
            console.log('⚠️ AI returned invalid storyArcSummary, generating intelligent fallback');
            const totalPages = planData.pages.length;

            // Helper to create a plot summary from a caption (extract key action, not full prose)
            const summarizeCaption = (caption: string): string => {
                // Take first sentence but limit to 20 words max
                const firstSentence = caption.match(/^[^.!?]*[.!?]/)?.[0] || caption;
                const words = firstSentence.trim().split(/\s+/);
                if (words.length > 20) {
                    return words.slice(0, 20).join(' ') + '...';
                }
                return firstSentence.trim();
            };

            // Map pages to story beats (Setup → Rising → Midpoint → Climax → Resolution)
            const setupIdx = 0; // First page
            const risingIdx = Math.floor(totalPages * 0.25); // ~25% through
            const midpointIdx = Math.floor(totalPages * 0.5); // ~50% through
            const climaxIdx = Math.floor(totalPages * 0.75); // ~75% through
            const resolutionIdx = totalPages - 1; // Last page

            storyArcSummary = [
                summarizeCaption(planData.pages[setupIdx]?.caption || 'The story begins...'),
                summarizeCaption(planData.pages[risingIdx]?.caption || 'The adventure starts...'),
                summarizeCaption(planData.pages[midpointIdx]?.caption || 'A turning point occurs...'),
                summarizeCaption(planData.pages[climaxIdx]?.caption || 'The climax arrives...'),
                summarizeCaption(planData.pages[resolutionIdx]?.caption || 'The story concludes...')
            ];
        }

        // Return the final title (AI-generated if was untitled, otherwise keep original)
        const finalTitle = (currentStoryTitle === 'Untitled Story' && planData.title)
            ? planData.title
            : currentStoryTitle;

        return NextResponse.json({
            title: finalTitle, // AI-extracted title for client to update session
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
