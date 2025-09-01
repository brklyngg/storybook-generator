import type { StyleBible, CharacterSheet, PagePrompt } from './types';

export function createStyleBible(aestheticStyle: string): StyleBible {
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
  };
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

export function createCharacterSheet(name: string, description: string): CharacterSheet {
  return {
    name,
    seedDescription: description,
    keyFeatures: extractKeyFeatures(description),
    poses: [
      'standing confidently',
      'walking forward',
      'looking curious',
      'pointing at something',
      'sitting thoughtfully'
    ],
    consistencyPrompt: `Character "${name}": ${description}. Maintain consistent appearance, clothing, and proportions across all scenes.`,
  };
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
  cameraAngle: 'wide shot' | 'medium shot' | 'close-up';
  layoutHint: string;
  characterRefs: string[];
  styleConsistency: string;
  safetyConstraints: string;
}): string {
  return `
SCENE OBJECTIVE: ${config.sceneGoal}

COMPOSITION:
- Camera angle: ${config.cameraAngle}
- Layout: ${config.layoutHint}
- Focus on clear storytelling and emotional connection

CHARACTER CONSISTENCY:
${config.characterRefs.join('\n')}
Maintain the same visual design, clothing, and proportions as established.

STYLE REQUIREMENTS:
${config.styleConsistency}
Professional children's book illustration quality.

SAFETY & CONTENT:
${config.safetyConstraints}
Appropriate for young children, positive emotional tone.

TECHNICAL SPECS:
- High resolution, publication-ready quality
- Clear composition suitable for text overlay
- Engaging and child-friendly visual storytelling
- Include SynthID watermark for AI content identification
`;
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