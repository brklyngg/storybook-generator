import type { StyleBible, CharacterSheet, PagePrompt } from './types';

export function createStyleBible(aestheticStyle: string, targetAge?: number, qualityTier?: string): StyleBible {
  const components = aestheticStyle.toLowerCase();

  return {
    artStyle: extractArtStyle(components),
    colorPalette: extractColorPalette(components),
    lighting: extractLighting(components),
    composition: 'child-friendly perspective, clear focal points, intricate and beautiful backgrounds with rich details',
    doNots: [
      'dark shadows',
      'scary elements',
      'violent imagery',
      'complex details that distract',
      'adult themes',
      'photorealistic people (use stylized illustrations)'
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

export function createCharacterSheet(
  name: string,
  description: string,
  role?: 'main' | 'supporting' | 'background',
  storyContext?: string
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
    distinctiveProps,
    emotionalRange,
    interactionGuidelines: {},
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
  
  if (desc.includes('coat')) features.push('distinctive coat');
  if (desc.includes('hat')) features.push('characteristic hat');
  if (desc.includes('goggles')) features.push('round goggles');
  if (desc.includes('boots')) features.push('sturdy boots');
  
  if (desc.includes('beard')) features.push('facial hair');
  if (desc.includes('tall')) features.push('tall stature');
  if (desc.includes('young')) features.push('youthful appearance');
  
  return features.length > 0 ? features : ['distinctive appearance', 'memorable outfit'];
}

export function createPagePrompt(config: {
  sceneGoal: string;
  caption: string;
  cameraAngle: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worm\'s eye' | 'dutch angle' | 'over shoulder' | 'point of view';
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

${transitionInstructions}

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
- Clear composition suitable for text overlay
- Engaging and child-friendly visual storytelling
- Rich, intricate backgrounds with beautiful details
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
    case 'worm\'s eye':
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