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

        // Update status before main AI call
        await supabase.from('stories').update({
            current_step: 'Generating pages and characters...'
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

STEP 2.5: SCENE GROUPING (FOR CLOTHING CONSISTENCY)

Group pages into SCENES for clothing consistency. Characters should wear the SAME outfit within a scene, but CAN change outfits between scenes (for epic tales spanning years).

### WHAT IS A SCENE?
A scene is a continuous sequence of pages sharing:
- Same location OR same event (e.g., "the feast", "the battle", "the journey home")
- Same time frame (same day or continuous event)

### SCENE RULES:
1. Assign each page a sceneId: "scene_{number}_{brief_location}"
   Examples: "scene_1_trojan_camp", "scene_2_at_sea", "scene_3_ithaca_palace"

2. For EACH scene, define character outfits in sceneOutfits:
   - Include EVERY character appearing in that scene
   - Be SPECIFIC: colors, materials, accessories
   - Outfits should be story-appropriate for that scene's context

3. Scene boundaries occur when:
   - Significant time passes (days, months, years)
   - Major location change
   - Story explicitly describes clothing change
   - Major story arc shift ("ten years later...")

### SCENE EXAMPLE (20-page Odyssey):
- Pages 1-3: sceneId: "scene_1_trojan_camp"
  sceneOutfits: {"Odysseus": "bronze Corinthian helmet, crimson cloak over bronze breastplate", "Athena": "shimmering golden robes, owl-crested helmet"}
- Pages 4-8: sceneId: "scene_2_at_sea"
  sceneOutfits: {"Odysseus": "simple sailor's tunic, sun-weathered cloak, no armor"}
- Pages 9-12: sceneId: "scene_3_calypso_island"
  sceneOutfits: {"Odysseus": "white linen tunic, relaxed sandals", "Calypso": "flowing sea-green gown"}
- Pages 16-20: sceneId: "scene_4_ithaca_disguise"
  sceneOutfits: {"Odysseus": "ragged beggar's cloak, wooden walking staff, hunched posture"}

### SHORT STORIES:
For stories in a single setting (e.g., "The Velveteen Rabbit"), use ONE scene for all pages.

### SCENE ANCHORS (FOR VISUAL CONTINUITY):
For EACH unique scene, generate a sceneAnchor object with:
- **locationDescription**: 15-20 word vivid description of the setting (e.g., "The marble throne room of Ithaca, with towering columns and woven tapestries catching the afternoon light")
- **lightingAtmosphere**: Time of day, mood, light quality (e.g., "Warm golden afternoon light streaming through high windows, long dramatic shadows")
- **colorPalette**: 3-4 dominant colors for this scene (e.g., "Deep burgundy, gold accents, warm stone whites, bronze metallics")
- **keyVisualElements**: 3-5 defining visual elements as array (e.g., ["Ornate marble columns", "Woven tapestries", "Bronze braziers", "Mosaic floor"])

This sceneAnchor helps maintain visual consistency across all pages in the scene without sending full images.

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

STEP 3.5: NARRATIVE SELF-CONTAINMENT (CRITICAL - READ CAREFULLY)

The reader has NEVER heard this story before. They do NOT know the source material. Every caption must be comprehensible to someone encountering this narrative for the FIRST TIME.

### SETUP-BEFORE-PAYOFF RULE:
If ANY page references a trick, plan, scheme, or clever action, the SETUP must appear in an EARLIER page.

BAD EXAMPLE (Page 8):
"It was a victory won not with a sword, but with a sharpened stick and the name 'Noman.'"
→ PROBLEM: No prior page explained the "Noman" trick or why it mattered.

GOOD EXAMPLE (Page 6):
"When the monstrous Cyclops demanded his name, Odysseus thought quickly. 'I am called Noman,' he lied, his voice steady despite his fear. If his plan worked, this trick would save them all."

GOOD EXAMPLE (Page 8):
"The blinded giant roared for help, but when the other Cyclopes asked who hurt him, he could only cry, 'Noman! Noman attacks me!' The confused giants left him alone—Odysseus's clever lie had worked."

### CONTEXT DISTRIBUTION STRATEGY:

1. **Opening Pages (1-3)**: Establish WHO the characters are, WHERE they are, WHAT their situation is
   - Don't info-dump everything on page 1
   - Introduce context as it becomes relevant to the action
   - Example: "Odysseus had been sailing for ten long years, desperate to reach his home in Ithaca..."

2. **Middle Pages (4 to N-3)**: Provide backstory and context BEFORE it's needed
   - If page 8 shows a payoff, pages 5-7 should set it up
   - Use dialogue and action to reveal context naturally
   - Example: "'We must escape before he eats the rest of us,' whispered Odysseus to his terrified men..."

3. **Climax Pages (N-2 to N)**: Deliver payoffs that were SET UP earlier
   - References are now clear because setup happened
   - Callbacks feel satisfying, not confusing
   - Example: "The giant oak door—the same one they'd watched him seal every night—now stood open..."

### REFERENCE ACCOUNTABILITY CHECKLIST:

Before writing ANY page's caption, ask:
1. **Does this reference a character?** → Have they been introduced and described?
2. **Does this reference a plan or trick?** → Has the plan been explained in an earlier page?
3. **Does this reference a past event?** → Has that event been shown or narrated in an earlier page?
4. **Does this reference a relationship?** → Has the relationship been established?
5. **Does this use a nickname or title?** → Has the real name been given first?

If the answer to ANY question is "no", you MUST revise the caption to be self-explanatory OR add the missing setup to an earlier page.

### FORBIDDEN PATTERNS (DO NOT DO THESE):

- "Years prior, in the suffocating darkness of a cave, Odysseus had learned that brute strength yields only to cunning."
  → PROBLEM: Assumes reader knows what happened "years prior"
  → FIX: Either show the cave scene in earlier pages, or narrate it now: "Trapped in the Cyclops's cave with his men being devoured one by one, Odysseus learned that brute strength would not save them—only cunning could..."

- "The name 'Noman' proved its worth once again."
  → PROBLEM: When was it explained? How did it prove its worth before?
  → FIX: "The clever lie he'd told the giant—'My name is Noman'—now proved its worth..."

- "The Trojan Horse stood massive and hollow."
  → PROBLEM: Only acceptable if EARLIER pages showed it being built or explained its purpose
  → FIX: If first mention, explain: "The Greeks had left behind a towering wooden horse, claiming it was a gift for the gods..."

- "She wept for the loss."
  → PROBLEM: What loss? Readers don't know what she lost or why it matters.
  → FIX: "She wept for her father, lost to the sea in the storm that had raged three days prior..."

### MASTER STORYTELLER TEST:

Imagine a ${settings.targetAge}-year-old child who has NEVER heard of this story before. Read your captions in order from Page 1 to Page ${settings.desiredPageCount}.

Ask yourself:
- Would they understand WHAT is happening on each page?
- Would they know WHO the characters are?
- Would they understand WHY characters are doing things?
- Would clever moments feel clever, or just confusing?
- Would emotional moments land, or feel arbitrary?

If the answer is "no" to any question, REVISE those pages to provide necessary context.

Write as if you are a master children's author sitting with a child at bedtime, telling them this tale for the FIRST time. You would:
- Start with WHO and WHERE
- Introduce characters before they do important things
- Explain plans BEFORE showing results
- Build tension by showing stakes
- Make clever moments FEEL clever by showing the setup
- Ensure the child can follow the entire narrative thread

This is the standard for these captions. Meet it.

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

### BACKGROUND CHARACTER DIVERSITY (CRITICAL FOR VISUAL VARIETY):

When creating supporting or background characters (warriors, servants, townspeople, sailors, etc.):
- Give EACH character DISTINCT physical features in their visualDescription
- VARY: hair color/style, beard/clean-shaven, skin tone, body type, age, facial features
- Do NOT make background characters look like copies of the main character
- If the main character has a brown beard and curly hair, give background characters contrasting features:
  - Blond straight hair, no beard
  - Gray hair, thick mustache
  - Bald head, dark skin
  - Red hair, young clean-shaven face

EXAMPLE for Odysseus's crew (each VISUALLY DISTINCT):
- "Eurylochus: Tall, gray-bearded elder with weathered face, bald head, and deep-set eyes"
- "Polites: Young, clean-shaven man with blond wavy hair and bright blue eyes"
- "Elpenor: Stocky, dark-skinned warrior with ritual tattoos and tightly braided black hair"
- "Perimedes: Lean, red-haired man with freckles and a prominent hooked nose"

ANTI-PATTERN (DO NOT DO THIS):
- "Greek Warrior 1: Strong warrior with brown beard"
- "Greek Warrior 2: Strong warrior with brown beard"
- "Greek Warrior 3: Strong warrior with brown beard"
→ This creates visual clones that all look identical to the main character!

STEP 5: EXTRACT VISUAL CONSTRAINTS (CRITICAL FOR ACCURACY)

For EACH page, analyze the caption and extract HARD VISUAL REQUIREMENTS:

1. **MYTHOLOGICAL/TEXTUAL TRAITS** - Physical requirements that MUST appear in the image:
   - If caption mentions mythological creatures, extract their DEFINING physical traits
   - Examples:
     - "Cyclops" → "Polyphemus has EXACTLY ONE large eye in the center of his forehead, NOT two eyes"
     - "Centaur" → "Human torso attached to horse body at the waist"
     - "Medusa" → "Hair made of living snakes, serpents visible in her hair"
     - "Hydra" → "Multiple serpent heads on one body"
   - These are NON-NEGOTIABLE - the image MUST show these exact traits
   - Also extract any explicit physical descriptions from the text (e.g., "his single eye")

2. **STATE CHANGES** - Things that change ON THIS PAGE and must persist:
   - If the caption describes removal, destruction, or transformation, note it
   - Examples:
     - "tears off his rags" → "Odysseus removes his beggar disguise - he is now bare-chested/in simple tunic"
     - "the ship breaks apart" → "The ship is now destroyed - only wreckage remains"
     - "she transforms them into pigs" → "The men are now pigs, not humans"
   - State changes PERSIST within the same scene - later pages in the scene inherit them

3. **NARRATIVE DETAILS** - Specific visual elements described in poetic text:
   - If the caption describes something specific that should be visible, extract it
   - Examples:
     - "blade reflecting the terror in her eyes" → "The sword blade should show Circe's terrified face reflected in its surface"
     - "tears streaming down her cheeks" → "Visible tears on the character's face"
     - "clutching the golden fleece" → "Character must be physically holding the golden fleece"
   - These add narrative depth but may be harder for AI to achieve - prioritize when possible

STEP 6: OUTPUT FORMAT
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
  "sceneAnchors": [
    {
      "sceneId": "scene_1_location (must match sceneId used in pages)",
      "locationDescription": "15-20 word vivid description of the setting",
      "lightingAtmosphere": "Time of day, mood, light quality description",
      "colorPalette": "3-4 dominant colors for this scene",
      "keyVisualElements": ["Element 1", "Element 2", "Element 3", "Element 4"]
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "caption": "${textLengthReq.sentences} of beautifully written story text (${textLengthReq.min}-${textLengthReq.max} words) that advances the plot and is a joy to read aloud",
      "prompt": "FULL-PAGE illustration (no text/typography in image) with: [specific scene setting - location, time of day, weather/atmosphere], [character IN MID-ACTION with visible emotion - describe the exact dynamic pose], [historically/culturally accurate period elements], [environmental details that convey world-building]. FREEZE-FRAME MOMENT: Capture the peak of the action, not before or after. Ensure image fills entire canvas edge-to-edge. At intensity ${settings.harshness}/10, make this ${settings.harshness >= 7 ? 'dramatic, vivid, and emotionally intense' : settings.harshness >= 4 ? 'moderately engaging with some tension' : 'gentle and calm'}. Use ${settings.aestheticStyle} style.",
      "cameraAngle": "wide shot | medium shot | close-up | aerial | worms eye | over shoulder | point of view (MUST vary across pages per the distribution rules)",
      "sceneId": "scene_1_location (from STEP 2.5 - pages in same scene share same sceneId)",
      "sceneOutfits": {"CharacterName": "specific outfit for this scene (colors, materials, accessories)"},
      "visualConstraints": {
        "mythologicalTraits": ["Array of creature physical traits that MUST appear - e.g., 'Cyclops has ONE eye in forehead'"],
        "stateChanges": ["Array of state changes ON THIS PAGE - e.g., 'Odysseus removes clothing'"],
        "narrativeDetails": ["Array of specific visual details from caption - e.g., 'Blade reflection shows Circe face'"]
      }
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
- [ ] Each page has a sceneId (consecutive pages in same scene share the same sceneId)
- [ ] Each page has sceneOutfits with SPECIFIC outfit descriptions for all characters in that scene
- [ ] sceneAnchors array contains ONE entry per unique sceneId with locationDescription, lightingAtmosphere, colorPalette, keyVisualElements
- [ ] Each page has visualConstraints with mythologicalTraits (for creatures), stateChanges (for transformations), narrativeDetails (for specific visuals)
- [ ] Mythological creatures have their defining traits extracted (Cyclops = ONE eye, Centaur = horse body, etc.)
- [ ] Any state change (clothing removed, object destroyed, transformation) is captured in stateChanges
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();

        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format from AI');

        const planData = JSON.parse(jsonMatch[0]);

        // ENFORCE page count - truncate if AI didn't respect constraint
        if (planData.pages && planData.pages.length !== settings.desiredPageCount) {
            console.warn(`⚠️ AI generated ${planData.pages.length} pages, expected ${settings.desiredPageCount}. Truncating to requested count.`);
            planData.pages = planData.pages.slice(0, settings.desiredPageCount);
            // Re-number pages to ensure sequential ordering
            planData.pages.forEach((page: any, i: number) => { page.pageNumber = i + 1; });
        }

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
                    // Normalize role to valid values (main, supporting, background)
                    let rawRole = char.role || (index < 2 ? 'main' : index < 5 ? 'supporting' : 'background');

                    // Sanitize role: map common AI-generated values to valid database values
                    const roleMapping: Record<string, string> = {
                        'protagonist': 'main',
                        'antagonist': 'main',
                        'hero': 'main',
                        'villain': 'main',
                        'major': 'main',
                        'secondary': 'supporting',
                        'minor': 'supporting',
                        'side': 'supporting',
                        'extra': 'background',
                        'crowd': 'background',
                        'unnamed': 'background',
                    };

                    const normalizedRole = roleMapping[rawRole.toLowerCase()] || rawRole.toLowerCase();

                    // Final validation: ensure it's one of the allowed values
                    const validRoles = ['main', 'supporting', 'background'];
                    const role = validRoles.includes(normalizedRole) ? normalizedRole : 'background';

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

            // 3. Save Pages (include cameraAngle and scene data for clothing consistency)
            supabase.from('pages').insert(
                (planData.pages || []).map((page: any) => ({
                    story_id: storyId,
                    page_number: page.pageNumber,
                    caption: page.caption,
                    prompt: page.prompt,
                    camera_angle: page.cameraAngle || 'medium shot', // Default fallback
                    scene_id: page.sceneId || null, // Scene grouping for clothing consistency
                    scene_outfits: page.sceneOutfits || null, // Per-character outfits for this scene
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

        // Process visual constraints with state change inheritance within scenes
        // State changes from earlier pages in the same scene should persist to later pages
        const processedPages = (planData.pages || []).map((page: any, idx: number) => {
            const currentSceneId = page.sceneId;
            const rawConstraints = page.visualConstraints || {};

            // Collect all state changes from PREVIOUS pages in the SAME scene
            const inheritedStateChanges: string[] = [];
            if (currentSceneId) {
                for (let i = 0; i < idx; i++) {
                    const prevPage = planData.pages[i];
                    if (prevPage.sceneId === currentSceneId) {
                        const prevStateChanges = prevPage.visualConstraints?.stateChanges || [];
                        inheritedStateChanges.push(...prevStateChanges);
                    }
                }
            }

            return {
                pageNumber: page.pageNumber,
                caption: page.caption,
                prompt: page.prompt,
                cameraAngle: page.cameraAngle,
                sceneId: currentSceneId || null,
                sceneOutfits: page.sceneOutfits || null,
                visualConstraints: {
                    mythologicalTraits: rawConstraints.mythologicalTraits || [],
                    stateChanges: rawConstraints.stateChanges || [],
                    inheritedStateChanges: inheritedStateChanges.length > 0 ? inheritedStateChanges : undefined,
                    narrativeDetails: rawConstraints.narrativeDetails || [],
                },
            };
        });

        // Log visual constraints for debugging
        const constraintsSummary = processedPages.filter((p: typeof processedPages[number]) =>
            p.visualConstraints?.mythologicalTraits?.length ||
            p.visualConstraints?.stateChanges?.length ||
            p.visualConstraints?.inheritedStateChanges?.length ||
            p.visualConstraints?.narrativeDetails?.length
        );
        if (constraintsSummary.length > 0) {
            console.log(`🎯 Visual constraints extracted for ${constraintsSummary.length} pages:`,
                constraintsSummary.map((p: typeof processedPages[number]) => ({
                    page: p.pageNumber,
                    myths: p.visualConstraints?.mythologicalTraits?.length || 0,
                    states: p.visualConstraints?.stateChanges?.length || 0,
                    inherited: p.visualConstraints?.inheritedStateChanges?.length || 0,
                    details: p.visualConstraints?.narrativeDetails?.length || 0,
                }))
            );
        }

        // Alias for backward compatibility (pagesWithSceneData is used in return)
        const pagesWithSceneData = processedPages;

        // Extract and validate sceneAnchors from AI response
        const sceneAnchors = (planData.sceneAnchors || []).map((anchor: any) => ({
            sceneId: anchor.sceneId,
            locationDescription: anchor.locationDescription || '',
            lightingAtmosphere: anchor.lightingAtmosphere || '',
            colorPalette: anchor.colorPalette || '',
            keyVisualElements: anchor.keyVisualElements || [],
        }));

        console.log(`🎬 Generated ${sceneAnchors.length} scene anchors for visual continuity`);

        return NextResponse.json({
            title: finalTitle, // AI-extracted title for client to update session
            characters: savedCharacters, // Returns IDs for client to iterate
            pages: pagesWithSceneData, // Full page data with scene info for clothing consistency
            pageCount: planData.pages.length,
            storyArcSummary, // 3-5 bullet points for story overview
            theme: planData.theme,
            styleBible,
            sceneAnchors, // Scene anchors for visual continuity (reduces token usage ~45%)
        });

    } catch (error: any) {
        console.error('Planning error:', error);
        await supabase?.from('stories').update({ status: 'error', current_step: 'Failed to plan story' }).eq('id', storyId);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
