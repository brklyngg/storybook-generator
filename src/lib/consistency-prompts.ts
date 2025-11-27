import type { StyleBible } from './types';

interface CharacterForAnalysis {
  name: string;
  description: string;
  role: 'main' | 'supporting' | 'background';
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
  styleBible?: StyleBible
): string {
  const characterDescriptions = characters
    .map((char, idx) => {
      const features = char.keyFeatures?.length
        ? `\n   Key features: ${char.keyFeatures.join(', ')}`
        : '';
      return `${idx + 1}. ${char.name} (${char.role}): ${char.description}${features}`;
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

  return `You are a professional children's book editor analyzing a ${pageCount}-page picture book for visual consistency.

CHARACTER REFERENCES:
${characterDescriptions}
${styleContext}
ANALYSIS TASK:
Review all ${pageCount} page images provided (in order from page 1 to ${pageCount}) and identify any consistency issues.

CHECK FOR:

1. CHARACTER APPEARANCE CONSISTENCY (Critical)
   - Does each character look the same across all their appearances?
   - Check: facial features, hair color/style, clothing, accessories, body proportions
   - Compare against the character descriptions above
   - Flag any page where a character looks noticeably different

2. TIMELINE LOGIC (Critical)
   - State changes should persist until explicitly changed
   - Examples: If a character gets wet, they should stay wet until dried off
   - If an object breaks, it should stay broken
   - If it's nighttime, subsequent pages should be night unless time passes
   - Flag any page that violates logical continuity

3. STYLE DRIFT (Moderate)
   - Art style should be consistent across all pages
   - Color palette should remain cohesive
   - Level of detail should be similar
   - Flag pages that look noticeably different in style

4. OBJECT CONTINUITY (Moderate)
   - Recurring objects should look the same each time they appear
   - Items characters carry should remain consistent
   - Background elements in the same location should match

OUTPUT FORMAT:
Return ONLY valid JSON in this exact format:

{
  "issues": [
    {
      "pageNumber": 7,
      "type": "character_appearance",
      "description": "Brief description of the issue",
      "characterInvolved": "Character Name",
      "fixPrompt": "Specific instruction for regenerating this page to fix the issue"
    }
  ],
  "pagesNeedingRegeneration": [7, 12]
}

IMPORTANT RULES:
- Only flag OBVIOUS, NOTICEABLE issues that would bother a reader
- Do not flag minor artistic variations that are within normal bounds
- The "fixPrompt" should be specific and actionable (e.g., "Ensure the father character has his brown beard visible" not just "fix character")
- pagesNeedingRegeneration should list page numbers (1-indexed) that have issues worth fixing
- If everything looks consistent, return: { "issues": [], "pagesNeedingRegeneration": [] }

Analyze the images now and return your JSON response.`;
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
