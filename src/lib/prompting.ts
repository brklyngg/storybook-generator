import type { StyleBible, CharacterSheet, PagePrompt } from './types';

/**
 * PROMPTING STRATEGY DOCUMENTATION
 *
 * This module constructs prompts for AI image generation with these goals:
 *
 * 1. FULL-PAGE IMAGES: Images should fill the entire canvas with no space
 *    reserved for text. Text/captions are displayed separately in the UI.
 *
 * 2. NO TEXT IN IMAGES: We explicitly instruct the AI not to include any
 *    typography, captions, or text within the generated images.
 *
 * 3. NARRATIVE ENRICHMENT: Images should include contextual details that:
 *    - Convey story context beyond the immediate scene
 *    - Are historically/culturally accurate to the setting
 *    - Reward careful, repeated viewing
 *    - Reference iconic elements from well-known stories (only if already
 *      established in the narrative - no foreshadowing)
 *
 * 4. CHRONOLOGICAL ACCURACY: Details in images may be carefully reviewed,
 *    so we emphasize accuracy and appropriateness within the story's timeline.
 *    Only reference events that have already occurred - never foreshadow.
 *
 * 5. HISTORICAL ACCURACY: No anachronisms. Every object, garment, and
 *    architectural element must be period-appropriate to the story's setting.
 */

export function createStyleBible(aestheticStyle: string, targetAge?: number, qualityTier?: string): StyleBible {
  const components = aestheticStyle.toLowerCase();

  return {
    artStyle: extractArtStyle(components),
    colorPalette: extractColorPalette(components),
    lighting: extractLighting(components),
    composition: 'child-friendly perspective, clear focal points, intricate and beautiful backgrounds with rich details',
    /**
     * doNots: Elements the AI should avoid in generated images.
     *
     * IMPORTANT: We explicitly prohibit text/typography in images because:
     * - Text will be displayed separately below each image in the UI
     * - AI-generated text often has errors or is illegible
     * - Full-page illustrations should fill the entire canvas
     */
    doNots: [
      'dark shadows',
      'scary elements',
      'violent imagery',
      'overwhelming details that obscure the main subject',
      'adult themes',
      'photorealistic people (use stylized illustrations)',
      // Prevent any text appearing within the image itself
      'any text, captions, titles, or typography within the image',
      'speech bubbles or word balloons',
      'signs with readable text (use symbolic imagery instead)',
    ],
    consistency: {
      characterSeeds: {},
      environmentStyle: components.includes('steampunk') ? 'gentle steampunk' : 'whimsical fantasy',
    },
    // Nano Banana Pro enhancements
    lightingAtmosphere: extractLightingAtmosphere(components),
    visualDensity: extractVisualDensity(targetAge),
    cameraMovementStyle: components.includes('dynamic') || components.includes('cinematic') ?
      'dynamic camera with varied angles and perspectives' :
      'stable, clear framing with consistent perspective',
    resolutionQuality: qualityTier === 'premium-4k' ?
      'Ultra-high resolution 4K quality suitable for professional print publication' :
      qualityTier === 'premium-2k' ?
        'High resolution 2K quality suitable for digital and standard print' :
        'Standard 1K quality suitable for digital viewing',
  };
}

function extractLightingAtmosphere(style: string): string {
  if (style.includes('golden hour') || style.includes('sunset')) {
    return 'Warm golden hour lighting with long shadows, amber and orange tones, peaceful atmosphere';
  }
  if (style.includes('morning') || style.includes('dawn')) {
    return 'Fresh morning light, soft and cool, hopeful and energetic atmosphere';
  }
  if (style.includes('magical') || style.includes('fantasy')) {
    return 'Ethereal, magical lighting with subtle glows, sparkles, and enchanted atmosphere';
  }
  if (style.includes('bright') || style.includes('cheerful')) {
    return 'Bright, even lighting with vibrant clarity, optimistic and uplifting atmosphere';
  }
  if (style.includes('soft') || style.includes('gentle')) {
    return 'Soft diffused lighting with gentle shadows, calm and soothing atmosphere';
  }
  return 'Natural, balanced lighting with clear visibility, warm and inviting atmosphere';
}

function extractVisualDensity(targetAge?: number): string {
  if (!targetAge) {
    return 'Age-appropriate visual complexity with clear focal points and engaging details';
  }

  if (targetAge <= 5) {
    return 'Simple, bold visual elements with clear separation. Large, easy-to-identify shapes. Minimal background complexity. High contrast for easy viewing.';
  } else if (targetAge <= 8) {
    return 'Moderate detail with engaging backgrounds. Clear main subjects with interesting but not overwhelming secondary elements. Balanced complexity.';
  } else if (targetAge <= 12) {
    return 'Rich, intricate details with layered compositions. Complex backgrounds that reward closer inspection. Sophisticated visual storytelling.';
  } else {
    return 'Advanced visual complexity with mature artistic techniques. Detailed, nuanced compositions suitable for teen and young adult readers.';
  }
}

function extractArtStyle(style: string): string {
  if (style.includes('watercolor')) return 'watercolor illustration';
  if (style.includes('cartoon')) return 'cartoon style';
  if (style.includes('digital')) return 'digital art';
  if (style.includes('sketch')) return 'sketch illustration';
  return 'children\'s book illustration style';
}

function extractColorPalette(style: string): string {
  if (style.includes('warm')) return 'warm, inviting colors';
  if (style.includes('pastel')) return 'soft pastel tones';
  if (style.includes('bright')) return 'bright, cheerful colors';
  if (style.includes('muted')) return 'muted, gentle tones';
  return 'child-friendly color palette';
}

function extractLighting(style: string): string {
  if (style.includes('soft')) return 'soft, diffused lighting';
  if (style.includes('golden')) return 'warm golden hour lighting';
  if (style.includes('bright')) return 'bright, even lighting';
  return 'gentle, natural lighting';
}

/**
 * Creates prompt instructions for unified aesthetic across all figures in a scene.
 * This ensures main characters, supporting characters, and crowd members share
 * the same proportional system and artistic treatment.
 *
 * DESIGN INTENT: Prevents the common AI image generation issue where main characters
 * are rendered in one style (e.g., semi-realistic) while background/crowd figures
 * are rendered in another style (e.g., cartoon-like with smaller heads).
 */
export function createUnifiedRealityPrompt(artStyle: string): string {
  const style = artStyle.toLowerCase();
  const renderingInstruction = style.includes('watercolor')
    ? 'Soft, feathered edges with consistent wash technique for all figures'
    : style.includes('cartoon') || style.includes('pixar') || style.includes('3d')
    ? 'Consistent line weight and stylization level across all characters'
    : 'Uniform rendering technique applied equally to all figures';

  return `
UNIFIED REALITY REQUIREMENTS (CRITICAL - ALL FIGURES IN SCENE):
Every character in this scene—heroes, supporting characters, crowd members, and background figures—MUST appear as if they are from the SAME animated production. This is non-negotiable.

PROPORTIONAL SYSTEM (apply to ALL figures):
- Adults: 6-7 head-heights tall (heroic protagonists at 7, average adults at 6)
- Children: 4-5 head-heights tall depending on age
- Elderly: 5.5-6 head-heights (slightly compressed stance)
- CRITICAL: Distant figures are SMALLER in scale but maintain IDENTICAL head-to-body ratios
- A soldier 50 feet away has the same proportions as one 5 feet away—just rendered smaller

AESTHETIC UNITY ACROSS DEPTH:
- ${renderingInstruction}
- Color saturation: Use atmospheric perspective (slight desaturation with distance) but NOT a style change
- Detail density: Reduce surface detail with distance (fewer wrinkles, simpler folds) but NOT proportions
- Eye and facial feature style: If main characters have stylized large eyes, ALL characters have stylized large eyes

ANTI-HYBRIDIZATION (CRITICAL):
- DO NOT mix realistic and cartoon aesthetics in the same image
- DO NOT render main characters in one style and crowd in another
- Peripheral figures are NOT "less important" stylistically—they are part of the same visual world
- Background soldiers/villagers/crowd use the SAME head shape, feature style, and proportional system as named characters

CROWD/GROUP CONSISTENCY:
- Unnamed figures should look like they could be named characters if the camera focused on them
- Vary crowd through: poses, clothing colors, expressions, accessories
- DO NOT vary crowd through: proportions, head sizes, facial feature styles, or rendering technique
`;
}

export function createCharacterSheet(
  name: string,
  description: string,
  role?: 'main' | 'supporting' | 'background',
  storyContext?: string,
  age?: string
): CharacterSheet {
  const keyFeatures = extractKeyFeatures(description);
  const distinctiveProps = extractDistinctiveProps(description);
  const emotionalRange = extractEmotionalRange(role);
  const storySpecificPoses = generateStorySpecificPoses(description, storyContext);

  return {
    name,
    seedDescription: description,
    keyFeatures,
    poses: storySpecificPoses,
    consistencyPrompt: createEnhancedConsistencyPrompt(name, description, keyFeatures, role),
    // Nano Banana Pro enhancements
    characterRole: role || 'supporting',
    scaleReference: extractScaleReference(description),
    proportionalGuidance: extractProportionalGuidance(role, age),
    distinctiveProps,
    emotionalRange,
    interactionGuidelines: {},
    age,
  };
}

function createEnhancedConsistencyPrompt(
  name: string,
  description: string,
  keyFeatures: string[],
  role?: string
): string {
  const priority = role === 'main' ? 'PRIMARY CHARACTER - CRITICAL CONSISTENCY' :
    role === 'supporting' ? 'SUPPORTING CHARACTER - HIGH CONSISTENCY' :
      'BACKGROUND CHARACTER - BASIC CONSISTENCY';

  return `
${priority}: "${name}"

DESCRIPTION: ${description}

KEY IDENTIFYING FEATURES (must remain identical):
${keyFeatures.map(f => `- ${f}`).join('\n')}

CONSISTENCY REQUIREMENTS FOR NANO BANANA PRO:
- Use reference images as absolute source of truth
- Maintain exact facial structure, proportions, and features
- Keep identical clothing, colors, and accessories
- Preserve distinctive visual elements that make this character recognizable
- Ensure character looks identical whether close-up or distant
- Match lighting and art style to reference while adapting to new scenes
`.trim();
}

function extractScaleReference(description: string): string {
  const desc = description.toLowerCase();

  if (desc.includes('giant') || desc.includes('enormous')) return 'Very large, towers over normal-sized characters';
  if (desc.includes('tall') || desc.includes('towering')) return 'Tall adult, noticeably taller than average';
  if (desc.includes('small') || desc.includes('tiny') || desc.includes('little')) return 'Small, below average height';
  if (desc.includes('child') || desc.includes('young')) return 'Child-sized, smaller than adults';
  if (desc.includes('baby') || desc.includes('toddler')) return 'Very small, toddler proportions';

  return 'Average human proportions';
}

/**
 * Determines the proportional guidance (head-heights) for a character based on role and age.
 * This establishes a consistent proportional system across all characters in the story.
 */
function extractProportionalGuidance(role?: string, age?: string): string {
  if (age) {
    // Try to extract numeric age
    const ageNum = parseInt(age.replace(/\D/g, ''));
    if (!isNaN(ageNum)) {
      if (ageNum < 6) return '3.5-4 head-heights (toddler proportions)';
      if (ageNum < 12) return '4.5-5 head-heights (child proportions)';
      if (ageNum < 18) return '5.5-6 head-heights (teen proportions)';
    }
    // Check for descriptive age terms
    const ageLower = age.toLowerCase();
    if (ageLower.includes('elderly') || ageLower.includes('old') || ageLower.includes('aged')) {
      return '5.5 head-heights (elderly, slightly compressed stance)';
    }
    if (ageLower.includes('child') || ageLower.includes('young') || ageLower.includes('kid')) {
      return '4.5-5 head-heights (child proportions)';
    }
    if (ageLower.includes('teen') || ageLower.includes('adolescent')) {
      return '5.5-6 head-heights (teen proportions)';
    }
    if (ageLower.includes('baby') || ageLower.includes('toddler') || ageLower.includes('infant')) {
      return '3.5-4 head-heights (toddler proportions)';
    }
  }
  // Default based on role
  if (role === 'main') return '7 head-heights (heroic adult proportions)';
  return '6 head-heights (standard adult proportions)';
}

function extractDistinctiveProps(description: string): string[] {
  const props: string[] = [];
  const desc = description.toLowerCase();

  if (desc.includes('sword')) props.push('sword');
  if (desc.includes('wand') || desc.includes('staff')) props.push('magical wand/staff');
  if (desc.includes('hat') || desc.includes('cap')) props.push('distinctive headwear');
  if (desc.includes('bag') || desc.includes('backpack')) props.push('bag/backpack');
  if (desc.includes('glasses') || desc.includes('goggles')) props.push('eyewear');
  if (desc.includes('necklace') || desc.includes('amulet')) props.push('necklace/amulet');
  if (desc.includes('book') || desc.includes('tome')) props.push('book');

  return props;
}

function extractEmotionalRange(role?: string): string[] {
  if (role === 'main') {
    return [
      'determined and confident',
      'curious and wondering',
      'joyful and excited',
      'worried or concerned',
      'surprised or shocked',
      'peaceful and content',
      'brave and resolute'
    ];
  } else if (role === 'supporting') {
    return [
      'friendly and helpful',
      'cheerful',
      'concerned',
      'surprised',
      'content'
    ];
  } else {
    return ['neutral', 'pleasant'];
  }
}

function generateStorySpecificPoses(description: string, storyContext?: string): string[] {
  const desc = description.toLowerCase();
  const context = (storyContext || '').toLowerCase();

  const poses: string[] = [];

  // Universal poses
  poses.push('standing confidently', 'walking forward');

  // Context-specific poses
  if (context.includes('adventure') || context.includes('journey')) {
    poses.push('pointing ahead', 'looking into distance', 'climbing or exploring');
  }

  if (context.includes('magic') || context.includes('fantasy')) {
    poses.push('casting spell or using magic', 'reading ancient text', 'discovering something magical');
  }

  if (context.includes('friend') || context.includes('together')) {
    poses.push('talking with others', 'helping someone', 'sharing something');
  }

  // Character-specific poses
  if (desc.includes('warrior') || desc.includes('knight')) {
    poses.push('in battle stance', 'raising weapon victoriously');
  }

  if (desc.includes('wizard') || desc.includes('mage')) {
    poses.push('studying spellbook', 'brewing potion', 'meditating with magic');
  }

  if (desc.includes('animal') || desc.includes('creature')) {
    poses.push('on all fours', 'sitting attentively', 'in motion');
  }

  // Fill to at least 5 poses
  while (poses.length < 5) {
    poses.push('looking curious', 'sitting thoughtfully', 'reacting with emotion');
  }

  return poses.slice(0, 7); // Max 7 poses
}

function extractKeyFeatures(description: string): string[] {
  const features: string[] = [];
  const desc = description.toLowerCase();

  // Hair colors - CRITICAL for consistency (emphasize exact shade)
  const hairColors = ['blonde', 'blond', 'brunette', 'brown hair', 'black hair', 'red hair', 'auburn', 'ginger', 'silver hair', 'white hair', 'gray hair', 'grey hair', 'golden hair', 'dark hair', 'light hair', 'chestnut'];
  for (const color of hairColors) {
    if (desc.includes(color)) {
      features.push(`MUST maintain exact shade: ${color} hair`);
      break; // Only one hair color
    }
  }

  // Eye colors - important for character recognition
  const eyeColors = ['blue eyes', 'green eyes', 'brown eyes', 'hazel eyes', 'gray eyes', 'grey eyes', 'amber eyes', 'violet eyes', 'dark eyes', 'bright eyes'];
  for (const color of eyeColors) {
    if (desc.includes(color)) {
      features.push(`${color}`);
      break;
    }
  }

  // Skin tones
  const skinTones = ['pale skin', 'fair skin', 'olive skin', 'tan skin', 'dark skin', 'brown skin', 'freckled'];
  for (const tone of skinTones) {
    if (desc.includes(tone)) {
      features.push(`${tone}`);
      break;
    }
  }

  // Clothing and accessories
  if (desc.includes('coat')) features.push('distinctive coat');
  if (desc.includes('hat')) features.push('characteristic hat');
  if (desc.includes('goggles')) features.push('round goggles');
  if (desc.includes('boots')) features.push('sturdy boots');
  if (desc.includes('armor') || desc.includes('armour')) features.push('distinctive armor');
  if (desc.includes('cloak') || desc.includes('cape')) features.push('flowing cloak/cape');
  if (desc.includes('crown') || desc.includes('tiara')) features.push('royal crown/tiara');
  if (desc.includes('robe')) features.push('distinctive robe');
  if (desc.includes('dress')) features.push('characteristic dress');
  if (desc.includes('uniform')) features.push('distinctive uniform');

  // Physical features
  if (desc.includes('beard')) features.push('facial hair (beard)');
  if (desc.includes('mustache') || desc.includes('moustache')) features.push('mustache');
  if (desc.includes('scar')) features.push('distinctive scar');
  if (desc.includes('tattoo')) features.push('visible tattoo');
  if (desc.includes('tall')) features.push('tall stature');
  if (desc.includes('short') && !desc.includes('short hair')) features.push('short stature');
  if (desc.includes('muscular') || desc.includes('strong build')) features.push('muscular build');
  if (desc.includes('slender') || desc.includes('slim')) features.push('slender build');
  if (desc.includes('young')) features.push('youthful appearance');
  if (desc.includes('elderly') || desc.includes('old') || desc.includes('aged')) features.push('elderly appearance');

  // Distinctive accessories
  if (desc.includes('glasses') || desc.includes('spectacles')) features.push('eyeglasses');
  if (desc.includes('earring')) features.push('earrings');
  if (desc.includes('necklace') || desc.includes('pendant')) features.push('necklace/pendant');
  if (desc.includes('ring') && !desc.includes('earring')) features.push('distinctive ring');

  return features.length > 0 ? features : ['distinctive appearance', 'memorable outfit'];
}

/**
 * Creates the detailed prompt for a single page illustration.
 *
 * DESIGN INTENT:
 * - Full-page images: layoutHint instructs AI to fill entire canvas
 * - No embedded text: Explicit instructions prevent text in image
 * - Narrative depth: Enrichment section adds contextual storytelling
 * - Chronological accuracy: Only reference events already established in the story
 * - Historical accuracy: Period-appropriate details with no anachronisms
 *
 * The resulting images should be detailed enough that readers can study
 * them for extended periods and discover new meaningful details.
 */
export function createPagePrompt(config: {
  sceneGoal: string;
  caption: string;
  cameraAngle: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worms eye' | 'dutch angle' | 'over shoulder' | 'point of view';
  layoutHint: string;
  characterRefs: string[];
  styleConsistency: string;
  safetyConstraints: string;
  // Nano Banana Pro enhancements
  previousPageReferences?: string[];
  sceneTransition?: any;
  searchGrounding?: string[];
  resolution?: '1K' | '2K' | '4K';
  aspectRatio?: '1:1' | '3:2' | '16:9' | '9:16' | '21:9';
  artStyle?: string; // Art style for unified reality prompt (e.g. "watercolor", "cartoon")
}): string {
  const cameraDescription = getCameraAngleDescription(config.cameraAngle);
  const transitionInstructions = config.sceneTransition ?
    createTransitionInstructions(config.sceneTransition) : '';
  const groundingInstructions = config.searchGrounding && config.searchGrounding.length > 0 ?
    `\nFACTUAL ACCURACY REQUIRED: ${config.searchGrounding.join(', ')}` : '';
  const resolutionSpecs = config.resolution ?
    `Resolution: ${config.resolution} at ${config.aspectRatio || '1:1'} aspect ratio` : '';

  return `
SCENE OBJECTIVE: ${config.sceneGoal}

COMPOSITION (Nano Banana Pro):
- Camera: ${cameraDescription}
- Layout: ${config.layoutHint}
- ${resolutionSpecs}
- Focus on clear storytelling and strong emotional connection
- Use the rule of thirds for dynamic composition
- Create depth with foreground, midground, and background layers

/**
 * NARRATIVE ENRICHMENT: These instructions ensure images contain meaningful
 * contextual details from classic stories. Key principles:
 * - CHRONOLOGICAL ACCURACY: Only reference events already established
 * - HISTORICAL ACCURACY: No anachronisms in any visual details
 * - SUBTLETY: Background references should be tasteful, not obvious
 */
NARRATIVE ENRICHMENT (Critical for story depth):
- Fill the entire canvas edge-to-edge with meaningful visual content
- Include environmental details that convey the world and setting authentically
- Add historically/culturally accurate period elements (architecture, clothing, objects, art styles)
- Use background details to show context about the world and characters
- Include subtle visual elements that reward careful observation
- For well-known stories, include tasteful nods to iconic elements ONLY if they have already occurred in the narrative up to this page
- Keep background references subtle unless the element is central to the current scene
- Ensure every detail serves the narrative - no arbitrary decoration
- Create images fascinating enough to study for extended periods

STRICT CHRONOLOGICAL & HISTORICAL ACCURACY:
- Only depict story elements that have already been established up to this page
- Do NOT foreshadow future events or include elements that haven't happened yet
- All visual details must be accurate to the story's time period and setting
- No anachronisms - every object, garment, and architectural element must be period-appropriate
- Character appearances must match their descriptions consistently
- Environmental elements must reflect established world-building accurately

${transitionInstructions}

${config.artStyle ? createUnifiedRealityPrompt(config.artStyle) : ''}

CHARACTER CONSISTENCY (CRITICAL):
${config.characterRefs.length > 0 ? config.characterRefs.join('\n') : 'No specific characters in this scene.'}
${config.characterRefs.length > 0 ? 'MATCH PROVIDED REFERENCE IMAGES EXACTLY - facial features, clothing, proportions must be identical.' : ''}

${config.previousPageReferences && config.previousPageReferences.length > 0 ? `
VISUAL CONTINUITY:
- Reference the provided previous page images for consistency
- Maintain the same artistic style, lighting quality, and color palette
- Ensure smooth visual flow from previous scene to this one
` : ''}

STYLE REQUIREMENTS:
${config.styleConsistency}
Professional children's book illustration quality suitable for print publication.
${groundingInstructions}

SAFETY & CONTENT:
${config.safetyConstraints}
Appropriate for young children, positive emotional tone, educational value.

TECHNICAL SPECS (Nano Banana Pro):
- High resolution, publication-ready quality
- FULL-PAGE illustration that fills the entire canvas edge-to-edge
- DO NOT include any text, captions, titles, or typography within the image itself
- DO NOT leave empty space for text overlay - the image IS the full page
- Engaging and child-friendly visual storytelling
- Rich, intricate backgrounds with beautiful details that reward careful viewing
- Professional color grading and lighting
- Include SynthID watermark for AI content identification
- Optimized for ${config.aspectRatio || '1:1'} aspect ratio
`;
}

function getCameraAngleDescription(angle: string): string {
  switch (angle) {
    case 'wide shot':
      return 'Wide establishing shot showing full scene and environment, giving context and scale';
    case 'medium shot':
      return 'Medium shot framing characters from waist up, balancing character detail with environment';
    case 'close-up':
      return 'Close-up shot focusing on facial expressions and emotional details';
    case 'aerial':
      return 'Aerial bird\'s-eye view looking down from above, showing spatial relationships';
    case 'worms eye':
      return 'Low angle looking up, making subjects appear larger and more impressive';
    case 'dutch angle':
      return 'Tilted dutch angle for dynamic energy or tension (use sparingly for drama)';
    case 'over shoulder':
      return 'Over-the-shoulder perspective showing interaction between characters';
    case 'point of view':
      return 'Point-of-view shot from a character\'s perspective, immersing reader in the moment';
    default:
      return 'Standard framing with clear focal point';
  }
}

function createTransitionInstructions(transition: any): string {
  if (!transition) return '';

  let instructions = 'SCENE TRANSITION:';

  if (transition.timeProgression) {
    instructions += `\n- Time: ${transition.timeProgression}`;
  }

  if (transition.locationChange) {
    instructions += `\n- Location: Transitioning from "${transition.locationChange.from}" to "${transition.locationChange.to}"`;
    instructions += `\n- Show the change clearly but maintain visual continuity`;
  }

  if (transition.lightingChange) {
    instructions += `\n- Lighting: Shifting from ${transition.lightingChange.from} to ${transition.lightingChange.to}`;
  }

  if (transition.weatherChange) {
    instructions += `\n- Weather: Changing from ${transition.weatherChange.from} to ${transition.weatherChange.to}`;
  }

  return instructions;
}

export function createEditPrompt(
  originalPrompt: string,
  editInstructions: string,
  preserveElements: string[]
): string {
  return `
EDIT REQUEST: ${editInstructions}

PRESERVE THESE ELEMENTS:
${preserveElements.join('\n- ')}

ORIGINAL CONTEXT:
${originalPrompt}

EDIT CONSTRAINTS:
- Keep the same art style and composition principles
- Maintain character consistency and recognizability  
- Preserve the child-friendly, safe-for-all-ages content
- Ensure the edit enhances rather than detracts from storytelling
`;
}

export function generateCharacterConsistencyPrompt(
  characterName: string,
  previousDescriptions: string[]
): string {
  return `
CHARACTER: ${characterName}

ESTABLISHED APPEARANCE:
${previousDescriptions.join('\n')}

CONSISTENCY REQUIREMENTS:
- Maintain exact same facial features, hair, and body proportions
- Keep identical clothing, accessories, and color scheme
- Preserve character's distinctive visual elements
- Use the same art style and rendering approach
- Ensure character is immediately recognizable as the same person
`;
}

// Nano Banana Pro: Helper functions for environment and object references
export function createEnvironmentReferencePrompt(locationName: string, description: string, aestheticStyle: string): string {
  return `
Create a reference image for a recurring location in a children's book: "${locationName}"

LOCATION DESCRIPTION: ${description}

REQUIREMENTS:
- Establish a clear, memorable visual identity for this location
- Show key architectural or environmental features
- Create a versatile view that can be referenced from multiple angles
- Style: ${aestheticStyle}
- Professional children's book illustration quality
- Child-friendly and inviting atmosphere
- Include enough detail to maintain consistency across multiple scenes
- Optimize for use as a reference image in Nano Banana Pro

TECHNICAL:
- Clear, well-lit view showing characteristic features
- Suitable for reference in various lighting conditions and angles
- Include SynthID watermark for AI content identification
`;
}

export function createObjectReferencePrompt(objectName: string, description: string, aestheticStyle: string): string {
  return `
Create a reference image for a recurring object in a children's book: "${objectName}"

OBJECT DESCRIPTION: ${description}

REQUIREMENTS:
- Show the object clearly from a neutral angle
- Establish distinctive visual features (color, shape, details, ornamentation)
- Create a reference that works in any scene context
- Style: ${aestheticStyle}
- Professional children's book illustration quality
- Child-friendly and appealing design
- Include enough detail to maintain consistency when object appears in scenes
- Optimize for use as a reference image in Nano Banana Pro

TECHNICAL:
- Clear, isolated view with neutral background or simple context
- Well-lit to show all important features
- Suitable for matching in various scene contexts
- Include SynthID watermark for AI content identification
`;
}

export function identifyRecurringElements(pages: Array<{ caption: string; prompt: string }>): {
  locations: Array<{ name: string; count: number; pages: number[] }>;
  objects: Array<{ name: string; count: number; pages: number[] }>;
} {
  const locationMap = new Map<string, { count: number; pages: number[] }>();
  const objectMap = new Map<string, { count: number; pages: number[] }>();

  // Common location keywords
  const locationKeywords = ['forest', 'castle', 'village', 'house', 'cave', 'mountain', 'beach', 'ocean', 'kingdom', 'palace', 'garden', 'room', 'kitchen', 'bedroom'];

  // Common object keywords
  const objectKeywords = ['sword', 'wand', 'staff', 'crown', 'treasure', 'map', 'book', 'key', 'mirror', 'potion', 'ring', 'amulet', 'lantern', 'bag', 'backpack'];

  pages.forEach((page, index) => {
    const text = `${page.caption} ${page.prompt}`.toLowerCase();

    // Check for locations
    locationKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        if (!locationMap.has(keyword)) {
          locationMap.set(keyword, { count: 0, pages: [] });
        }
        const entry = locationMap.get(keyword)!;
        entry.count++;
        entry.pages.push(index);
      }
    });

    // Check for objects
    objectKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        if (!objectMap.has(keyword)) {
          objectMap.set(keyword, { count: 0, pages: [] });
        }
        const entry = objectMap.get(keyword)!;
        entry.count++;
        entry.pages.push(index);
      }
    });
  });

  // Filter to only recurring elements (appearing 2+ times)
  const locations = Array.from(locationMap.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // Top 3 recurring locations

  const objects = Array.from(objectMap.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // Top 3 recurring objects

  return { locations, objects };
}