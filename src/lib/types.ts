import { z } from 'zod';

export const BookSettingsSchema = z.object({
  targetAge: z.number().min(3).max(18),
  harshness: z.number().min(0).max(10),
  aestheticStyle: z.string().min(1),
  freeformNotes: z.string(),
  desiredPageCount: z.number().min(5).max(30),
  characterConsistency: z.boolean(),
  // Nano Banana Pro enhancements
  qualityTier: z.enum(['standard-flash', 'premium-2k', 'premium-4k']).default('standard-flash'),
  aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('2:3'),
  enableSearchGrounding: z.boolean().default(false),
  // Workflow checkpoint options
  enableCharacterReviewCheckpoint: z.boolean().default(false),
  // Auto consistency check (on by default)
  // Auto consistency check (on by default)
  enableConsistencyCheck: z.boolean().default(true),
  // Custom hero image (base64)
  customHeroImage: z.string().optional(),
});

export type BookSettings = z.infer<typeof BookSettingsSchema>;

export interface StoryPage {
  index: number;
  caption: string;
  prompt: string;
  cameraAngle?: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worms eye' | 'over shoulder' | 'point of view';
  imageUrl?: string;
  warnings?: string[];
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  metadata?: {
    generatedAt: number;
    model: string;
    tokensUsed: number;
  };
}

export interface BookSession {
  id: string;
  sourceText: string;
  title?: string;
  fileName?: string;
  settings: BookSettings;
  timestamp: number;
  theme?: string;
  pages?: StoryPage[];
  metadata?: {
    version: string;
    totalTokensUsed?: number;
    estimatedCost?: number;
  };
  // Nano Banana Pro enhancements
  environmentReferences?: EnvironmentReference[]; // Recurring locations
  objectReferences?: ObjectReference[]; // Recurring props/items
  characters?: CharacterSheet[]; // Character sheets with references
  styleBible?: StyleBible; // Style guide for consistency
}

export interface StyleBible {
  artStyle: string;
  colorPalette: string;
  lighting: string;
  composition: string;
  doNots: string[];
  consistency: {
    characterSeeds: Record<string, string>;
    environmentStyle: string;
  };
  // Nano Banana Pro enhancements
  lightingAtmosphere?: string; // Detailed lighting mood and time-of-day
  visualDensity?: string; // Age-specific detail level
  cameraMovementStyle?: string; // Static, dynamic, cinematic
  resolutionQuality?: string; // Technical quality requirements
}

export interface CharacterSheet {
  name: string;
  seedDescription: string;
  keyFeatures: string[];
  poses: string[];
  consistencyPrompt: string;
  referenceImage?: string; // Base64 data URL for character reference (legacy, single image)
  // Nano Banana Pro enhancements
  referenceImages?: string[]; // Multiple reference images: [front, side, expressions]
  characterRole?: 'main' | 'supporting' | 'background'; // Priority for consistency
  scaleReference?: string; // Size relative to environment ("tall adult", "small child", etc.)
  distinctiveProps?: string[]; // Recurring objects associated with character
  emotionalRange?: string[]; // Key emotions to express
  interactionGuidelines?: Record<string, string>; // How this character relates to others
  age?: string; // Explicit age description (e.g. "8 years old", "ancient")
}

export interface PagePrompt {
  sceneGoal: string;
  caption: string;
  cameraAngle: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worm\'s eye' | 'dutch angle' | 'over shoulder' | 'point of view';
  layoutHint: string;
  characterRefs: string[];
  styleConsistency: string;
  safetyConstraints: string;
  // Nano Banana Pro enhancements
  previousPageReferences?: string[]; // Base64 image data from previous pages
  sceneTransition?: SceneTransition; // Transition info from previous scene
  searchGrounding?: string[]; // Elements requiring factual accuracy
  resolution?: '1K' | '2K' | '4K';
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
}

// New interfaces for Nano Banana Pro features
export interface EnvironmentReference {
  locationName: string; // e.g., "Enchanted Forest", "Castle Throne Room"
  description: string;
  referenceImage?: string; // Base64 data URL
  lightingDefault?: string; // Default lighting for this location
  appearingOnPages: number[]; // Which pages feature this location
}

export interface ObjectReference {
  objectName: string; // e.g., "Magic Wand", "Flying Carpet"
  description: string;
  referenceImage?: string; // Base64 data URL
  associatedCharacter?: string; // Character who primarily uses/carries this
  appearingOnPages: number[]; // Which pages feature this object
}

export interface SceneTransition {
  fromPage: number;
  toPage: number;
  timeProgression?: 'immediate' | 'minutes later' | 'hours later' | 'next day';
  locationChange?: {
    from: string;
    to: string;
    transitionType: 'cut' | 'pan' | 'journey'; // How to handle the visual transition
  };
  lightingChange?: {
    from: string;
    to: string;
  };
  weatherChange?: {
    from: string;
    to: string;
  };
}

export interface ExportManifest {
  title: string;
  author: string;
  generatedAt: string;
  pages: Array<{
    index: number;
    caption: string;
    prompt: string;
    filename: string;
  }>;
  metadata: {
    generator: string;
    version: string;
    aiModel: string;
    settings: BookSettings;
  };
}

export interface GenerationProgress {
  currentStep: string;
  completedPages: number;
  totalPages: number;
  estimatedTimeRemaining?: number;
  errors?: string[];
}

// Workflow state machine types for plan/character review checkpoints
export type WorkflowState =
  | 'idle'
  | 'plan_pending'
  | 'plan_review'
  | 'story_preview'
  | 'characters_generating'
  | 'character_review'
  | 'pages_generating'
  | 'complete'
  | 'error';

// Plan data returned from /api/stories/[id]/plan for user review
export interface PlanData {
  pages: Array<{
    pageNumber: number;
    caption: string;
    prompt: string;
    cameraAngle?: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worms eye' | 'over shoulder' | 'point of view';
  }>;
  characters: Array<{
    id: string;
    name: string;
    description: string; // Visual description for image generation
    displayDescription?: string; // Story role description shown to users
    approximateAge?: string; // Approximate age for display
    role: 'main' | 'supporting' | 'background';
    age?: string; // Legacy field
    isHero?: boolean; // True if this character uses the uploaded hero photo
  }>;
  storyArcSummary: string[];
  theme: string;
  styleBible: StyleBible;
}

// Edited page state during plan review
export interface EditedPage {
  pageNumber: number;
  caption: string;
  prompt: string;
  cameraAngle?: 'wide shot' | 'medium shot' | 'close-up' | 'aerial' | 'worms eye' | 'over shoulder' | 'point of view';
  isModified: boolean;
}

// Consistency check types for auto-fix feature
export interface ConsistencyIssue {
  pageNumber: number;
  type: 'character_appearance' | 'timeline_logic' | 'style_drift' | 'object_continuity';
  description: string;
  characterInvolved?: string;
  fixPrompt: string; // AI-generated prompt addition for regeneration
}

export interface ConsistencyAnalysis {
  issues: ConsistencyIssue[];
  pagesNeedingRegeneration: number[];
}

export interface CharacterWithImage {
  id: string;
  name: string;
  description: string; // Visual description for image generation
  displayDescription?: string; // Story role description shown to users (e.g., "The proud king whose arrogance...")
  approximateAge?: string; // Approximate age for display (e.g., "~40s", "young adult", "elderly")
  role: 'main' | 'supporting' | 'background';
  isHero?: boolean; // True if this character uses the uploaded hero photo
  referenceImage?: string;
  referenceImages?: string[];
}