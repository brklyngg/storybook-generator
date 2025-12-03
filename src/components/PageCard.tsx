'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MoreHorizontal,
  Edit3,
  RefreshCw,
  AlertTriangle,
  GripVertical,
  Eye,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { StoryPage } from '@/lib/types';

interface PageCardProps {
  page: StoryPage;
  onEdit: (updates: Partial<StoryPage>) => void;
  onRegenerate: (feedback?: string) => void;
  isGenerating?: boolean;
}

// Quick fix options for common AI image issues
const QUICK_FIX_OPTIONS = [
  { id: 'floating', label: 'Floating objects', prompt: 'Fix floating/disconnected objects - ensure all items are properly grounded and connected' },
  { id: 'anatomy', label: 'Body/hands', prompt: 'Fix anatomy issues - ensure correct number of fingers, proper limb connections, natural poses' },
  { id: 'faces', label: 'Face issues', prompt: 'Fix facial features - ensure proper eye placement, natural expressions, consistent character appearance' },
  { id: 'composition', label: 'Awkward pose', prompt: 'Fix composition/poses - characters should have clear, intentional interactions, not ambiguous positioning' },
  { id: 'missing', label: 'Missing parts', prompt: 'Fix missing elements - ensure all referenced objects and character parts are fully visible' },
  { id: 'style', label: 'Style mismatch', prompt: 'Fix style consistency - match the art style of other pages more closely' },
];

export function PageCard({ page, onEdit, onRegenerate, isGenerating = false }: PageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(page.caption);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [selectedFixes, setSelectedFixes] = useState<string[]>([]);
  const [customFeedback, setCustomFeedback] = useState('');

  const handleSaveEdit = () => {
    if (editedCaption.trim() !== page.caption) {
      onEdit({ caption: editedCaption.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedCaption(page.caption);
    setIsEditing(false);
  };

  const handleOpenFeedback = () => {
    setSelectedFixes([]);
    setCustomFeedback('');
    setShowFeedbackDialog(true);
  };

  const toggleFix = (fixId: string) => {
    setSelectedFixes(prev =>
      prev.includes(fixId)
        ? prev.filter(id => id !== fixId)
        : [...prev, fixId]
    );
  };

  const handleRegenerate = async (skipFeedback = false) => {
    let feedback = '';
    if (!skipFeedback) {
      const fixPrompts = selectedFixes
        .map(id => QUICK_FIX_OPTIONS.find(opt => opt.id === id)?.prompt)
        .filter(Boolean);

      if (fixPrompts.length > 0 || customFeedback.trim()) {
        feedback = [
          ...fixPrompts,
          customFeedback.trim() ? `Additional notes: ${customFeedback.trim()}` : ''
        ].filter(Boolean).join('\n');
      }
    }

    setShowFeedbackDialog(false);
    setIsRegenerating(true);
    try {
      await onRegenerate(feedback || undefined);
    } finally {
      setIsRegenerating(false);
    }
  };

  const downloadImage = () => {
    if (page.imageUrl) {
      const link = document.createElement('a');
      link.href = page.imageUrl;
      link.download = `page-${page.index + 1}.jpg`;
      link.click();
    }
  };

  return (
    <Card className="relative group cursor-move hover-lift bg-card">
      {/* Drag handle */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-label text-accent">
            Page {page.index + 1}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Caption
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenFeedback}
                disabled={isRegenerating || isGenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadImage} disabled={!page.imageUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {/* Image container */}
        <div className="aspect-square bg-secondary rounded-md overflow-hidden relative">
          {page.imageUrl ? (
            <>
              <img
                src={page.imageUrl}
                alt={`Page ${page.index + 1}`}
                className="w-full h-full object-cover"
              />

              <Dialog>
                <DialogTrigger asChild>
                  <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/10 transition-all cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100">
                    <Eye className="h-8 w-8 text-background" />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle className="font-heading">Page {page.index + 1}</DialogTitle>
                    <DialogDescription className="font-body">{page.caption}</DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-center">
                    <img
                      src={page.imageUrl}
                      alt={`Page ${page.index + 1} full size`}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                {(isGenerating || isRegenerating) ? (
                  <div className="editorial-loader mx-auto mb-2">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : null}
                <div className="text-sm ">
                  {isGenerating || isRegenerating ? 'Creating...' : 'Pending'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-2">
          {isEditing ? (
            <>
              <Textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                className="text-sm font-body "
                rows={3}
                placeholder="Enter page caption..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-foreground/80 line-clamp-3 min-h-[3.5rem] font-body leading-relaxed">
              {page.caption || 'No caption'}
            </p>
          )}
        </div>

        {/* Warnings */}
        {page.warnings && page.warnings.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-destructive/5 border-l-2 border-l-destructive rounded-sm text-xs">
            <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-foreground/70 ">
              {page.warnings.join(', ')}
            </div>
          </div>
        )}

        {/* Metadata */}
        {page.metadata && (
          <div className="text-xs text-muted-foreground ">
            {new Date(page.metadata.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </CardContent>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">What needs fixing?</DialogTitle>
            <DialogDescription className="font-body">
              Select issues to improve the regeneration (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quick fix chips */}
            <div className="flex flex-wrap gap-2">
              {QUICK_FIX_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleFix(option.id)}
                  className={`px-3 py-1.5 text-sm rounded-md border  transition-all ${
                    selectedFixes.includes(option.id)
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-secondary text-foreground/70 border-border hover:border-accent/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Custom feedback */}
            <Textarea
              placeholder="Any other details? (e.g., 'sword handle is missing')"
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              rows={2}
              className="text-sm font-body "
            />

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRegenerate(true)}
              >
                Skip & Regenerate
              </Button>
              <Button
                size="sm"
                onClick={() => handleRegenerate(false)}
                disabled={selectedFixes.length === 0 && !customFeedback.trim()}
                className="bg-accent hover:bg-accent/90"
              >
                Fix & Regenerate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
