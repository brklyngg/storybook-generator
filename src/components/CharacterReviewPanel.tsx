'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WorkflowStepper } from '@/components/WorkflowStepper';
import { cn } from '@/lib/utils';
import {
  Users,
  Image,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  User,
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
}: CharacterReviewPanelProps) {
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
  const isGeneratingCharacters = rerollingWhat === 'characters';
  const isGeneratingFirstPage = rerollingWhat === 'firstPage';

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
          </div>
          <WorkflowStepper currentState="character_review" showCharacterReview={true} />
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
            {charactersWithImages.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Generating character references...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className={cn(
                      'rounded-xl overflow-hidden border border-stone-200 bg-white',
                      'transition-all hover:shadow-md'
                    )}
                  >
                    {/* Character Image */}
                    <div className="aspect-square relative bg-stone-100">
                      {character.referenceImage ? (
                        <img
                          src={character.referenceImage}
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <RefreshCw className="w-8 h-8 text-stone-400 animate-spin mx-auto mb-2" />
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
                      <p className="text-sm text-stone-600 line-clamp-2">
                        {character.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <div className="aspect-[2/3] max-w-md mx-auto rounded-xl bg-stone-100 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-10 h-10 text-stone-400 animate-spin mx-auto mb-3" />
                  <p className="text-stone-500">Generating style sample...</p>
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
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-stone-700 text-center leading-relaxed">
                      &ldquo;{firstPage.caption}&rdquo;
                    </p>
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
            disabled={isRerolling}
            className="text-stone-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plan
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-sm text-stone-600 mr-4 hidden sm:block">
              {charactersWithImages.length} character{charactersWithImages.length !== 1 ? 's' : ''} ready
              {firstPage && ' • Style sample ready'}
            </div>
            <Button
              onClick={onApprove}
              disabled={isRerolling || charactersWithImages.length === 0 || !firstPage}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Approve & Generate Book
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
