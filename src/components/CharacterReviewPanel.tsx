'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowStepper } from '@/components/WorkflowStepper';
import { cn } from '@/lib/utils';
import {
  Users,
  Image,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  User,
  MessageSquare,
  Check,
  Loader2,
} from 'lucide-react';

interface CharacterWithImage {
  id: string;
  name: string;
  description: string;
  role: 'main' | 'supporting' | 'background';
  referenceImage?: string;
}

interface FirstPagePreview {
  pageNumber: number;
  caption: string;
  imageUrl: string;
}

export interface CharacterFeedback {
  characterId: string;
  feedback: string;
}

interface CharacterReviewPanelProps {
  characters: CharacterWithImage[];
  firstPage: FirstPagePreview | null;
  storyTitle: string;
  onApprove: () => void;
  onRerollCharacters: () => void;
  onRerollFirstPage: () => void;
  onBack: () => void;
  isRerolling?: boolean;
  rerollingWhat?: 'characters' | 'firstPage' | null;
  /** Total expected characters (for showing placeholders) */
  totalExpectedCharacters?: number;
  /** Whether we're still generating characters */
  isGenerating?: boolean;
  /** Current step message */
  currentStep?: string;
  /** First page feedback callback */
  onFirstPageFeedback?: (feedback: string) => void;
  /** Character feedback callback */
  onCharacterFeedback?: (feedback: CharacterFeedback[]) => void;
}

export function CharacterReviewPanel({
  characters,
  firstPage,
  storyTitle,
  onApprove,
  onRerollCharacters,
  onRerollFirstPage,
  onBack,
  isRerolling = false,
  rerollingWhat = null,
  totalExpectedCharacters,
  isGenerating = false,
  currentStep = '',
  onFirstPageFeedback,
  onCharacterFeedback,
}: CharacterReviewPanelProps) {
  // Track feedback for each character
  const [characterFeedback, setCharacterFeedback] = useState<Record<string, string>>({});
  const [firstPageFeedbackText, setFirstPageFeedbackText] = useState('');
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  // Get role badge color
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'main':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'supporting':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      default:
        return 'bg-stone-100 text-stone-600 border-stone-300';
    }
  };

  const charactersWithImages = characters.filter((c) => c.referenceImage);
  const isGeneratingCharacters = rerollingWhat === 'characters' || isGenerating;
  const isGeneratingFirstPage = rerollingWhat === 'firstPage';

  // Calculate placeholder count for characters still loading
  const expectedCount = totalExpectedCharacters || characters.length;
  const pendingCount = Math.max(0, expectedCount - characters.length);

  // All content is ready when we have all characters with images AND first page
  const allReady = charactersWithImages.length === expectedCount && firstPage !== null;

  // Handle character feedback change
  const handleCharacterFeedbackChange = (characterId: string, feedback: string) => {
    const newFeedback = { ...characterFeedback, [characterId]: feedback };
    setCharacterFeedback(newFeedback);

    // Notify parent if callback provided
    if (onCharacterFeedback) {
      const feedbackArray = Object.entries(newFeedback)
        .filter(([_, text]) => text.trim())
        .map(([id, text]) => ({ characterId: id, feedback: text }));
      onCharacterFeedback(feedbackArray);
    }
  };

  // Handle first page feedback change
  const handleFirstPageFeedbackChange = (feedback: string) => {
    setFirstPageFeedbackText(feedback);
    if (onFirstPageFeedback) {
      onFirstPageFeedback(feedback);
    }
  };

  // Toggle feedback expansion for a character
  const toggleFeedback = (characterId: string) => {
    setExpandedFeedback(expandedFeedback === characterId ? null : characterId);
  };

  return (
    <div className="min-h-screen bg-stone-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header with Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-stone-800">
                Review Characters & Style
              </h1>
              <p className="text-stone-600 mt-1">
                {storyTitle}
              </p>
            </div>
            {isGenerating && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">{currentStep || 'Generating...'}</span>
              </div>
            )}
          </div>
          <WorkflowStepper currentState={isGenerating ? "characters_generating" : "character_review"} showCharacterReview={true} />
        </div>

        {/* Character Reference Images */}
        <Card className="mb-6 border-l-4 border-l-emerald-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Character References
                  <Badge variant="secondary" className="ml-2">
                    {charactersWithImages.length} characters
                  </Badge>
                </CardTitle>
                <CardDescription>
                  These reference images will ensure visual consistency throughout your book
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRerollCharacters}
                disabled={isRerolling}
                className="border-stone-300"
              >
                <RefreshCw
                  className={cn('w-4 h-4 mr-2', isGeneratingCharacters && 'animate-spin')}
                />
                Re-roll All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Render actual characters */}
              {characters.map((character) => (
                <div
                  key={character.id}
                  className={cn(
                    'rounded-xl overflow-hidden border bg-white',
                    'transition-all',
                    character.referenceImage
                      ? 'border-stone-200 hover:shadow-md'
                      : 'border-dashed border-stone-300'
                  )}
                >
                  {/* Character Image */}
                  <div className="aspect-square relative bg-stone-100">
                    {character.referenceImage ? (
                      <>
                        <img
                          src={character.referenceImage}
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Ready indicator */}
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
                          <span className="text-sm text-stone-500">Generating...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Character Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-stone-800 truncate">
                        {character.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize flex-shrink-0', getRoleBadgeClass(character.role))}
                      >
                        {character.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-stone-600 line-clamp-2 mb-3">
                      {character.description}
                    </p>

                    {/* Feedback section - always visible once image is ready */}
                    {character.referenceImage && (
                      <div className="border-t border-stone-100 pt-3">
                        {expandedFeedback === character.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Add notes about this character (e.g., 'make hair darker', 'add glasses')..."
                              value={characterFeedback[character.id] || ''}
                              onChange={(e) => handleCharacterFeedbackChange(character.id, e.target.value)}
                              className="text-sm min-h-[80px] resize-none"
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFeedback(character.id)}
                                className="text-xs"
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleFeedback(character.id)}
                            className={cn(
                              'w-full flex items-center gap-2 text-sm py-1.5 px-2 rounded-md transition-colors',
                              characterFeedback[character.id]
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                            )}
                          >
                            <MessageSquare className="w-4 h-4" />
                            {characterFeedback[character.id]
                              ? <span className="truncate">{characterFeedback[character.id]}</span>
                              : 'Add feedback'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Render placeholder slots for characters still being generated */}
              {pendingCount > 0 && Array.from({ length: pendingCount }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="rounded-xl overflow-hidden border-2 border-dashed border-stone-200 bg-stone-50"
                >
                  <div className="aspect-square relative flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-stone-200 mx-auto mb-3 flex items-center justify-center">
                        <User className="w-8 h-8 text-stone-400" />
                      </div>
                      <p className="text-sm text-stone-400">Waiting...</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="h-5 w-24 bg-stone-200 rounded animate-pulse mb-2" />
                    <div className="h-4 w-full bg-stone-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* First Page Style Sample */}
        <Card className="mb-8 border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Image className="w-5 h-5 text-orange-600" />
                  Style Sample
                </CardTitle>
                <CardDescription>
                  First page preview to confirm the visual aesthetic
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRerollFirstPage}
                disabled={isRerolling || !firstPage}
                className="border-stone-300"
              >
                <RefreshCw
                  className={cn('w-4 h-4 mr-2', isGeneratingFirstPage && 'animate-spin')}
                />
                Re-roll Style
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!firstPage ? (
              <div className="aspect-[2/3] max-w-md mx-auto rounded-xl bg-stone-100 border-2 border-dashed border-stone-200 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-3" />
                  <p className="text-stone-500">Generating style sample...</p>
                  <p className="text-xs text-stone-400 mt-1">This may take a moment</p>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="rounded-xl overflow-hidden border border-stone-200 shadow-sm">
                  <div className="aspect-[2/3] relative bg-stone-100">
                    <img
                      src={firstPage.imageUrl}
                      alt="First page preview"
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-3 left-3 bg-stone-800/70 text-white">
                      Page 1
                    </Badge>
                    {/* Ready indicator */}
                    <div className="absolute top-3 right-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-stone-700 text-center leading-relaxed mb-3">
                      &ldquo;{firstPage.caption}&rdquo;
                    </p>
                    {/* First page feedback */}
                    <div className="border-t border-stone-100 pt-3">
                      <Textarea
                        placeholder="Add notes about the style (e.g., 'make colors more vibrant', 'simplify backgrounds')..."
                        value={firstPageFeedbackText}
                        onChange={(e) => handleFirstPageFeedbackChange(e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isRerolling || isGenerating}
            className="text-stone-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plan
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-sm text-stone-600 mr-4 hidden sm:block">
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {charactersWithImages.length} of {expectedCount} characters ready
                </span>
              ) : (
                <>
                  {charactersWithImages.length} character{charactersWithImages.length !== 1 ? 's' : ''} ready
                  {firstPage && ' • Style sample ready'}
                </>
              )}
            </div>
            <Button
              onClick={onApprove}
              disabled={isRerolling || isGenerating || !allReady}
              className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Approve & Generate Book
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
