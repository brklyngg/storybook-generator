'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PageCard } from './PageCard';
import type { StoryPage, BookSettings } from '@/lib/types';

const ReactSortable = dynamic(
  () => import('react-sortablejs').then(mod => mod.ReactSortable),
  { ssr: false }
);

interface StoryboardProps {
  pages: StoryPage[];
  characters: any[];
  settings?: BookSettings;
  onPageUpdate: (index: number, updates: Partial<StoryPage>) => void;
  onPageReorder: (pages: StoryPage[]) => void;
  isGenerating?: boolean;
}

export function Storyboard({
  pages,
  characters,
  settings,
  onPageUpdate,
  onPageReorder, 
  isGenerating = false 
}: StoryboardProps) {
  const [draggedItem, setDraggedItem] = useState<StoryPage | null>(null);

  const handleSort = useCallback((newList: StoryPage[]) => {
    const reorderedPages = newList.map((page, index) => ({
      ...page,
      index,
    }));
    onPageReorder(reorderedPages);
  }, [onPageReorder]);

  const handlePageEdit = useCallback((page: StoryPage, updates: Partial<StoryPage>) => {
    onPageUpdate(page.index, updates);
  }, [onPageUpdate]);

  const handleRegenerateImage = useCallback(async (page: StoryPage) => {
    try {
      // Extract character references with images for consistency
      const characterReferences = characters
        ?.filter((char: any) => char.referenceImage)
        ?.map((char: any) => ({
          name: char.name,
          referenceImage: char.referenceImage,
        })) || [];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageIndex: page.index,
          caption: page.caption,
          stylePrompt: settings?.aestheticStyle || 'warm watercolor, soft edges',
          characterConsistency: settings?.characterConsistency ?? true,
          characterReferences,
          qualityTier: settings?.qualityTier || 'standard-flash',
          aspectRatio: settings?.aspectRatio || '1:1',
          enableSearchGrounding: settings?.enableSearchGrounding ?? false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate image');
      }

      const { imageUrl, warnings } = await response.json();
      
      onPageUpdate(page.index, {
        imageUrl,
        warnings,
        metadata: {
          ...page.metadata,
          generatedAt: Date.now(),
          model: settings?.qualityTier === 'standard-flash' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview',
          tokensUsed: 1290
        }
      });
    } catch (error) {
      console.error('Error regenerating image:', error);
    }
  }, [onPageUpdate, characters, settings]);

  if (pages.length === 0 && !isGenerating) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg">
          No pages generated yet. Upload a story to begin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Story Pages</h2>
        <div className="text-sm text-gray-600">
          {pages.length} pages {isGenerating && '(generating...)'}
        </div>
      </div>

      <ReactSortable
        list={pages}
        setList={handleSort}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        disabled={isGenerating}
        ghostClass="opacity-50"
        chosenClass="ring-2 ring-blue-400"
        dragClass="rotate-2 scale-105"
      >
        {pages.map((page) => (
          <PageCard
            key={`page-${page.index}`}
            page={page}
            onEdit={(updates) => handlePageEdit(page, updates)}
            onRegenerate={() => handleRegenerateImage(page)}
            isGenerating={isGenerating}
          />
        ))}
      </ReactSortable>

      {isGenerating && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Generating more pages...
          </div>
        </div>
      )}
    </div>
  );
}