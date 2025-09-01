import { z } from 'zod';

export interface CopyrightCheck {
  isProtected: boolean;
  confidence: number;
  warning?: string;
  suggestedAction?: string;
}

export interface ContentSafety {
  isAppropriate: boolean;
  ageRating: string;
  concerns: string[];
  suggestions: string[];
}

const PUBLIC_DOMAIN_BOOKS = [
  'alice in wonderland',
  'the time machine',
  'treasure island',
  'the jungle book',
  'peter pan',
  'the wonderful wizard of oz',
  'moby dick',
  'pride and prejudice',
  'jane eyre',
  'the adventures of tom sawyer',
];

const COPYRIGHT_INDICATORS = [
  'harry potter',
  'lord of the rings',
  'chronicles of narnia',
  'percy jackson',
  'hunger games',
  'twilight',
  'game of thrones',
];

export async function validateBookText(text: string): Promise<CopyrightCheck> {
  const sample = text.toLowerCase().slice(0, 2000);
  
  const publicDomainMatch = PUBLIC_DOMAIN_BOOKS.some(book => 
    sample.includes(book) || detectBookByUniquePassages(sample, book)
  );
  
  if (publicDomainMatch) {
    return {
      isProtected: false,
      confidence: 0.8,
      warning: 'This appears to be public domain content',
    };
  }
  
  const copyrightMatch = COPYRIGHT_INDICATORS.some(indicator => 
    sample.includes(indicator)
  );
  
  if (copyrightMatch) {
    return {
      isProtected: true,
      confidence: 0.9,
      warning: 'This content may be under copyright protection',
      suggestedAction: 'Please confirm you have rights to use this content or use public domain alternatives',
    };
  }
  
  const recentPublicationPattern = /copyright.*20[0-2][0-9]|published.*20[0-2][0-9]/i;
  if (recentPublicationPattern.test(sample)) {
    return {
      isProtected: true,
      confidence: 0.7,
      warning: 'This content appears to be recently published and may be copyrighted',
      suggestedAction: 'Verify copyright status before use',
    };
  }
  
  return {
    isProtected: false,
    confidence: 0.3,
    warning: 'Copyright status unclear - please verify rights to use this content',
  };
}

function detectBookByUniquePassages(text: string, bookTitle: string): boolean {
  const uniquePassages: Record<string, string[]> = {
    'the time machine': ['time traveller', 'fourth dimension', 'eloi', 'morlocks'],
    'alice in wonderland': ['white rabbit', 'cheshire cat', 'mad hatter', 'queen of hearts'],
    'treasure island': ['long john silver', 'pieces of eight', 'black spot'],
  };
  
  const passages = uniquePassages[bookTitle];
  if (!passages) return false;
  
  return passages.some(passage => text.includes(passage));
}

export function validateContentSafety(
  text: string, 
  targetAge: '3-5' | '6-8' | '9-12',
  intensityLevel: number
): ContentSafety {
  const concerns: string[] = [];
  const suggestions: string[] = [];
  
  const ageConstraints = {
    '3-5': {
      maxIntensity: 3,
      bannedWords: ['scary', 'death', 'violence', 'nightmare', 'monster'],
      preferredThemes: ['friendship', 'family', 'learning', 'playing'],
    },
    '6-8': {
      maxIntensity: 6,
      bannedWords: ['death', 'violence', 'war', 'murder'],
      preferredThemes: ['adventure', 'problem-solving', 'teamwork', 'discovery'],
    },
    '9-12': {
      maxIntensity: 8,
      bannedWords: ['explicit violence', 'inappropriate content'],
      preferredThemes: ['coming of age', 'moral lessons', 'challenges', 'growth'],
    },
  };
  
  const constraints = ageConstraints[targetAge];
  const textLower = text.toLowerCase();
  
  const foundBannedWords = constraints.bannedWords.filter(word => 
    textLower.includes(word)
  );
  
  if (foundBannedWords.length > 0) {
    concerns.push(`Contains age-inappropriate content: ${foundBannedWords.join(', ')}`);
    suggestions.push('Consider removing or softening these elements');
  }
  
  if (intensityLevel > constraints.maxIntensity) {
    concerns.push(`Intensity level ${intensityLevel} may be too high for ages ${targetAge}`);
    suggestions.push(`Consider reducing intensity to ${constraints.maxIntensity} or lower`);
  }
  
  const hasPositiveThemes = constraints.preferredThemes.some(theme => 
    textLower.includes(theme)
  );
  
  if (!hasPositiveThemes) {
    suggestions.push(`Consider incorporating themes like: ${constraints.preferredThemes.join(', ')}`);
  }
  
  return {
    isAppropriate: concerns.length === 0,
    ageRating: targetAge,
    concerns,
    suggestions,
  };
}

export function sanitizeContentForAge(
  text: string, 
  targetAge: '3-5' | '6-8' | '9-12'
): string {
  let sanitized = text;
  
  const replacements: Record<'3-5' | '6-8' | '9-12', Record<string, string>> = {
    '3-5': {
      'scary': 'surprising',
      'frightening': 'exciting',
      'dangerous': 'challenging',
      'monster': 'creature',
      'died': 'went away',
    },
    '6-8': {
      'terrifying': 'very scary',
      'killed': 'defeated',
      'destroyed': 'changed',
    },
    '9-12': {
      'murdered': 'defeated',
      'torture': 'trouble',
    },
  };
  
  const ageReplacements = replacements[targetAge];
  
  Object.entries(ageReplacements).forEach(([original, replacement]) => {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  });
  
  return sanitized;
}

export function generateContentWarning(
  concerns: string[],
  targetAge: string
): string | null {
  if (concerns.length === 0) return null;
  
  return `Content Advisory for Ages ${targetAge}: ${concerns.join('; ')}. Please review and consider adjustments for age-appropriateness.`;
}