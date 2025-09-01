'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  onRegenerate: () => void;
  isGenerating?: boolean;
}

export function PageCard({ page, onEdit, onRegenerate, isGenerating = false }: PageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(page.caption);
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
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
    <Card className="relative group cursor-move hover:shadow-lg transition-shadow">
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            Page {page.index + 1}
          </Badge>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Caption
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleRegenerate}
                disabled={isRegenerating || isGenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate Image
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadImage} disabled={!page.imageUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
          {page.imageUrl ? (
            <>
              <img
                src={page.imageUrl}
                alt={`Page ${page.index + 1}`}
                className="w-full h-full object-cover"
              />
              
              <Dialog>
                <DialogTrigger asChild>
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100">
                    <Eye className="h-8 w-8 text-white" />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Page {page.index + 1} Preview</DialogTitle>
                    <DialogDescription>{page.caption}</DialogDescription>
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
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2 ${!isGenerating && !isRegenerating ? 'hidden' : ''}`} />
                <div className="text-sm">
                  {isGenerating || isRegenerating ? 'Generating...' : 'No Image'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isEditing ? (
            <>
              <Textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                className="text-sm"
                rows={3}
                placeholder="Enter page caption..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-700 line-clamp-3 min-h-[3rem]">
              {page.caption || 'No caption'}
            </p>
          )}
        </div>

        {page.warnings && page.warnings.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-yellow-800">
              {page.warnings.join(', ')}
            </div>
          </div>
        )}

        {page.metadata && (
          <div className="text-xs text-gray-500">
            Generated: {new Date(page.metadata.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}