import { z } from 'zod';

export const BookSettingsSchema = z.object({
  targetAge: z.enum(['3-5', '6-8', '9-12']),
  harshness: z.number().min(0).max(10),
  aestheticStyle: z.string().min(1),
  freeformNotes: z.string(),
  desiredPageCount: z.number().min(10).max(30),
  characterConsistency: z.boolean(),
});

export type BookSettings = z.infer<typeof BookSettingsSchema>;

export interface StoryPage {
  index: number;
  caption: string;
  prompt: string;
  imageUrl?: string;
  warnings?: string[];
  metadata?: {
    generatedAt: number;
    model: string;
    tokensUsed: number;
  };
}

export interface BookSession {
  id: string;
  sourceText: string;
  fileName?: string;
  settings: BookSettings;
  timestamp: number;
  pages?: StoryPage[];
  metadata?: {
    version: string;
    totalTokensUsed?: number;
    estimatedCost?: number;
  };
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
}

export interface CharacterSheet {
  name: string;
  seedDescription: string;
  keyFeatures: string[];
  poses: string[];
  consistencyPrompt: string;
  referenceImage?: string; // Base64 data URL for character reference
}

export interface PagePrompt {
  sceneGoal: string;
  caption: string;
  cameraAngle: 'wide shot' | 'medium shot' | 'close-up';
  layoutHint: string;
  characterRefs: string[];
  styleConsistency: string;
  safetyConstraints: string;
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