'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageDetailsAccordion } from '@/components/PageDetailsAccordion';
import { WorkflowStepper } from '@/components/WorkflowStepper';
import { PlanData, EditedPage, WorkflowState, StyleBible } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Users,
  FileText,
  RefreshCw,
  ArrowRight,
  Sparkles,
  User,
} from 'lucide-react';

interface PlanReviewPanelProps {
  planData: PlanData;
  storyTitle: string;
  onApprove: (editedPages: EditedPage[]) => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
  showCharacterReviewCheckpoint?: boolean;
}

export function PlanReviewPanel({
  planData,
  storyTitle,
  onApprove,
  onRegenerate,
  isRegenerating = false,
  showCharacterReviewCheckpoint = false,
}: PlanReviewPanelProps) {
  // Track edited pages locally
  const [editedPages, setEditedPages] = useState<EditedPage[]>(() =>
    planData.pages.map((p) => ({
      pageNumber: p.pageNumber,
      caption: p.caption,
      prompt: p.prompt,
      isModified: false,
    }))
  );

  // Update when planData changes (e.g., after regeneration)
  useEffect(() => {
    setEditedPages(
      planData.pages.map((p) => ({
        pageNumber: p.pageNumber,
        caption: p.caption,
        prompt: p.prompt,
        isModified: false,
      }))
    );
  }, [planData]);

  const handleCaptionChange = (pageNumber: number, newCaption: string) => {
    setEditedPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber
          ? {
              ...p,
              caption: newCaption,
              isModified: newCaption !== planData.pages.find((op) => op.pageNumber === pageNumber)?.caption,
            }
          : p
      )
    );
  };

  const modifiedCount = editedPages.filter((p) => p.isModified).length;

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

  return (
    <div className="min-h-screen bg-stone-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header with Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-stone-800">
                Review Your Story Plan
              </h1>
              <p className="text-stone-600 mt-1">
                {storyTitle}
              </p>
            </div>
          </div>
          <WorkflowStepper
            currentState="plan_review"
            showCharacterReview={showCharacterReviewCheckpoint}
          />
        </div>

        {/* Story Arc Summary */}
        <Card className="mb-6 border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-amber-600" />
              Story Arc
            </CardTitle>
            <CardDescription>
              The AI&apos;s understanding of your story&apos;s narrative flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {planData.storyArcSummary.map((bullet, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-stone-700"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-sm font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
            {planData.theme && (
              <div className="mt-4 pt-4 border-t border-stone-200">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-stone-600">Theme:</span>
                  <span className="text-stone-700">{planData.theme}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Characters */}
        <Card className="mb-6 border-l-4 border-l-emerald-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-emerald-600" />
              Characters
              <Badge variant="secondary" className="ml-2">
                {planData.characters.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Main characters that will be illustrated with visual consistency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {planData.characters.map((character) => (
                <div
                  key={character.id}
                  className="p-4 rounded-lg bg-stone-50 border border-stone-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-stone-800 truncate">
                          {character.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn('text-xs capitalize', getRoleBadgeClass(character.role))}
                        >
                          {character.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-600 line-clamp-3">
                        {(character.displayDescription && character.displayDescription.trim().length > 0)
                          ? character.displayDescription
                          : character.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Page Details */}
        <Card className="mb-8 border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-orange-600" />
              Page Details
              <Badge variant="secondary" className="ml-2">
                {editedPages.length} pages
              </Badge>
              {modifiedCount > 0 && (
                <Badge className="ml-2 bg-amber-500 text-white">
                  {modifiedCount} edited
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Click on any caption to edit it before generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageDetailsAccordion
              pages={editedPages}
              onCaptionChange={handleCaptionChange}
              disabled={isRegenerating}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="text-sm text-stone-600">
            {modifiedCount > 0 ? (
              <span className="text-amber-600 font-medium">
                {modifiedCount} caption{modifiedCount !== 1 ? 's' : ''} modified
              </span>
            ) : (
              <span>Review and approve when ready</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="border-stone-300"
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isRegenerating && 'animate-spin')} />
              Re-generate Plan
            </Button>
            <Button
              onClick={() => onApprove(editedPages)}
              disabled={isRegenerating}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Approve Plan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
