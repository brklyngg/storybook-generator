import type { StyleBible } from './types';

interface CharacterForAnalysis {
  name: string;
  description: string;
  role: 'main' | 'supporting' | 'background';
  isHero?: boolean;
  keyFeatures?: string[];
}

/**
 * Builds a prompt for AI to analyze all book pages for consistency issues.
 * The AI will compare each page against character references and identify
 * visual inconsistencies, timeline logic problems, and style drift.
 */
export function buildConsistencyAnalysisPrompt(
  characters: CharacterForAnalysis[],
  pageCount: number,
  styleBible?: StyleBible,
  hasHeroPhoto?: boolean
): string {
  // Identify the hero/protagonist for special attention
  const heroCharacter = characters.find(c => c.isHero) || characters.find(c => c.role === 'main');
  const heroName = heroCharacter?.name || 'the protagonist';

  const characterDescriptions = characters
    .map((char, idx) => {
      const features = char.keyFeatures?.length
        ? `\n   Key features: ${char.keyFeatures.join(', ')}`
        : '';
      const heroMarker = char.isHero ? ' [HERO - based on uploaded photo]' : '';
      return `${idx + 1}. ${char.name} (${char.role})${heroMarker}: ${char.description}${features}`;
    })
    .join('\n');

  const styleContext = styleBible
    ? `
STYLE BIBLE:
- Art Style: ${styleBible.artStyle}
- Color Palette: ${styleBible.colorPalette}
- Lighting: ${styleBible.lighting}
`
    : '';

  const heroPhotoContext = hasHeroPhoto
    ? `
HERO PHOTO REFERENCE:
A real photo was uploaded for ${heroName}. The hero character's face, hair color, and key features 
should closely match this photo throughout ALL pages. Any deviation from the photo reference 
(especially hair color, facial features, or skin tone) is a CRITICAL issue that MUST be flagged.
`
    : '';

  return `You are a professional children's book editor analyzing a ${pageCount}-page picture book for visual consistency.

CHARACTER REFERENCES:
${characterDescriptions}
${styleContext}${heroPhotoContext}
CRITICAL BASELINE RULE:
**PAGE 1 IS THE VISUAL BASELINE.** All subsequent pages must match Page 1's depiction of each character.
If a character has brown hair on Page 1, they MUST have brown hair on ALL pages.
If a character wears glasses on Page 1, they MUST wear glasses on ALL pages.
Any character who looks different from their Page 1 appearance is an issue.

ANALYSIS TASK:
Review all ${pageCount} page images provided (in order from page 1 to ${pageCount}) and identify any consistency issues.

CHECK FOR (IN ORDER OF PRIORITY):

1. **PROTAGONIST/HERO CONSISTENCY (CRITICAL - HIGHEST PRIORITY)**
   - ${heroName} MUST look identical across ALL pages
   - HAIR COLOR is the #1 thing to check - it must NEVER change
   - Check: exact hair color, hair style, facial features, skin tone, eye color
   - If ${heroName} has brown hair on page 1, they MUST have brown hair on every other page
   - Grey hair when it should be brown = CRITICAL ISSUE
   - Different hair color between ANY two pages = CRITICAL ISSUE
   - Flag ANY page where ${heroName} looks different from Page 1

2. CHARACTER APPEARANCE CONSISTENCY (Critical)
   - Does each character look the same across all their appearances?
   - Compare EVERY appearance to how the character looks on their FIRST appearance
   - Check: hair color (exact shade!), hair style, facial features, clothing, accessories, body proportions
   - Hair color changes are ALWAYS a bug, not artistic variation
   - Flag any page where a character looks noticeably different

3. TIMELINE LOGIC (Critical)
   - State changes should persist until explicitly changed
   - Examples: If a character gets wet, they should stay wet until dried off
   - If an object breaks, it should stay broken
   - If it's nighttime, subsequent pages should be night unless time passes
   - Flag any page that violates logical continuity

4. STYLE DRIFT (Moderate)
   - Art style should be consistent across all pages
   - Color palette should remain cohesive
   - Level of detail should be similar
   - Flag pages that look noticeably different in style

5. OBJECT CONTINUITY (Moderate)
   - Recurring objects should look the same each time they appear
   - Items characters carry should remain consistent
   - Background elements in the same location should match

6. **INTRA-SCENE PROPORTIONAL CONSISTENCY (Important)**
   - Within EACH image, do ALL figures share the same proportional system?
   - Are crowd/background figures rendered in the SAME art style as main characters?
   - Do distant figures have the same head-to-body ratio as foreground figures (just smaller)?
   - Flag any page where:
     * Main characters and background characters have visibly different stylization
     * Head sizes are disproportionate between figures at similar distances
     * Crowd members look like they're from a different "movie" than the protagonist
     * Foreground is realistic but background is cartoon-like (or vice versa)
   - This checks consistency WITHIN each image, not just across pages
   - All figures in a scene should look like they belong in the same animated production

OUTPUT FORMAT:
Return ONLY valid JSON in this exact format:

{
  "issues": [
    {
      "pageNumber": 7,
      "type": "character_appearance | timeline_logic | style_drift | object_continuity | intra_scene_consistency",
      "description": "Brief description of the issue",
      "characterInvolved": "Character Name (optional for intra_scene_consistency)",
      "fixPrompt": "Specific instruction for regenerating this page to fix the issue"
    }
  ],
  "pagesNeedingRegeneration": [7, 12]
}

IMPORTANT RULES:
- Hair color changes are NEVER acceptable - always flag them
- Protagonist inconsistencies should ALWAYS be flagged and regenerated
- The "fixPrompt" should be very specific (e.g., "Ensure ${heroName} has BROWN hair matching Page 1, not grey hair" not just "fix character")
- pagesNeedingRegeneration should list page numbers (1-indexed) that have issues worth fixing
- If everything looks consistent, return: { "issues": [], "pagesNeedingRegeneration": [] }

Analyze the images now, comparing each page to Page 1 as the baseline. Return your JSON response.`;
}

/**
 * Builds a simpler prompt for quick consistency check without full analysis.
 * Used when we just need to verify a regenerated page matches the others.
 */
export function buildQuickConsistencyCheckPrompt(
  characterName: string,
  characterDescription: string,
  pageNumber: number
): string {
  return `You are checking if the character "${characterName}" on page ${pageNumber} matches their description.

CHARACTER DESCRIPTION: ${characterDescription}

Does the character in this image match the description? Look for:
- Facial features
- Hair color and style
- Clothing and accessories
- Body proportions

Respond with JSON:
{
  "matches": true/false,
  "issues": "description of any differences found, or empty string if matches"
}`;
}
