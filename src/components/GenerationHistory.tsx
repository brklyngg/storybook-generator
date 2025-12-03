'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Users,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanData, CharacterWithImage } from '@/lib/types';

interface GenerationHistoryProps {
  planData: PlanData;
  characters: CharacterWithImage[];
  onRerollCharacter?: (characterId: string, feedback?: string) => void;
}

export function GenerationHistory({
  planData,
  characters,
  onRerollCharacter
}: GenerationHistoryProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    characters: true,
    storyArc: true,
  });

  // Track feedback state for character regeneration
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [regeneratingChars, setRegeneratingChars] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleRegenerateCharacter = (id: string) => {
    if (!onRerollCharacter) return;
    setRegeneratingChars(prev => ({ ...prev, [id]: true }));
    onRerollCharacter(id, feedbackMap[id]);
    setTimeout(() => {
      setRegeneratingChars(prev => ({ ...prev, [id]: false }));
      setExpandedFeedback(null);
    }, 3000);
  };

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

  const charactersWithImages = characters.filter(c => c.referenceImage);

  return (
    <div className="space-y-6 mt-8">
      {/* Section Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm font-medium text-stone-500">
            Generation Steps
          </span>
        </div>
      </div>

      {/* Characters Section */}
      <Card className="border-l-4 border-l-emerald-500 overflow-hidden">
        <CardHeader
          className="cursor-pointer hover:bg-stone-50/50 transition-colors"
          onClick={() => toggleSection('characters')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {expandedSections.characters ? (
                <ChevronDown className="w-5 h-5 text-stone-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-stone-400" />
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Cast of Characters</CardTitle>
                  <CardDescription className="text-xs">
                    Step 2: Character reference portraits generated for consistency
                  </CardDescription>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              {charactersWithImages.length} characters
            </Badge>
          </div>
        </CardHeader>
        {expandedSections.characters && (
          <CardContent className="pt-0 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {characters.map((character) => (
                <div
                  key={character.id}
                  className={cn(
                    "group relative rounded-xl overflow-hidden border transition-all duration-300",
                    character.referenceImage
                      ? "border-stone-200 bg-white shadow-sm hover:shadow-md"
                      : "border-dashed border-stone-200 bg-stone-50"
                  )}
                >
                  {/* Image Area */}
                  <div className="aspect-square relative bg-stone-100 overflow-hidden">
                    {character.referenceImage ? (
                      <>
                        <img
                          src={character.referenceImage}
                          alt={character.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <Users className="w-6 h-6 text-stone-300 mb-1" />
                        <span className="text-[10px] text-stone-400">No image</span>
                      </div>
                    )}
                  </div>

                  {/* Info Area */}
                  <div className="p-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="font-semibold text-stone-800 text-xs truncate" title={character.name}>
                        {character.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn('text-[8px] px-1 py-0 h-4 capitalize flex-shrink-0', getRoleBadgeClass(character.role))}
                      >
                        {character.role}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                      {(character.displayDescription && character.displayDescription.trim().length > 0)
                        ? character.displayDescription
                        : character.description}
                    </p>

                    {/* Feedback / Regenerate Controls */}
                    {character.referenceImage && onRerollCharacter && (
                      <div className="mt-2 pt-2 border-t border-stone-100">
                        {expandedFeedback === character.id ? (
                          <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                            <Textarea
                              placeholder="Feedback..."
                              value={feedbackMap[character.id] || ''}
                              onChange={(e) => setFeedbackMap(prev => ({ ...prev, [character.id]: e.target.value }))}
                              className="text-[10px] min-h-[40px] resize-none p-1.5"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedFeedback(null)}
                                className="flex-1 h-5 text-[10px] px-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRegenerateCharacter(character.id)}
                                disabled={regeneratingChars[character.id]}
                                className="flex-1 h-5 text-[10px] px-1 bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                {regeneratingChars[character.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="w-2 h-2 mr-0.5" />
                                    Regen
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedFeedback(character.id);
                            }}
                            className="w-full h-5 text-[10px] text-stone-500 hover:text-stone-700 hover:bg-stone-100 px-1"
                          >
                            <MessageSquare className="w-2.5 h-2.5 mr-1" />
                            Refine
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Story Arc Section */}
      <Card className="border-l-4 border-l-amber-500 overflow-hidden">
        <CardHeader
          className="cursor-pointer hover:bg-stone-50/50 transition-colors"
          onClick={() => toggleSection('storyArc')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {expandedSections.storyArc ? (
                <ChevronDown className="w-5 h-5 text-stone-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-stone-400" />
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Story Arc</CardTitle>
                  <CardDescription className="text-xs">
                    Step 1: AI analysis of story structure and themes
                  </CardDescription>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        {expandedSections.storyArc && (
          <CardContent className="pt-0 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Story Beats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-stone-600 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Story Progression
                </h4>
                <ul className="space-y-2">
                  {planData.storyArcSummary.map((bullet, index) => (
                    <li key={index} className="flex items-start gap-2 text-stone-700 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex items-center justify-center mt-0.5">
                        {index + 1}
                      </span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Theme & Style */}
              <div className="space-y-4">
                {planData.theme && (
                  <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-amber-800 block mb-1">Theme</span>
                        <span className="text-stone-700 leading-relaxed">{planData.theme}</span>
                      </div>
                    </div>
                  </div>
                )}

                {planData.styleBible && (
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-100">
                    <h5 className="text-xs font-medium text-stone-600 mb-2">Visual Style</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {planData.styleBible.artStyle || 'Custom art style'} with {planData.styleBible.colorPalette || 'warm colors'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
