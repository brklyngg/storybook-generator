'use client';

import { Collapsible } from '@/components/ui/collapsible';
import { EditableCaption } from '@/components/EditableCaption';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PageDetail {
  pageNumber: number;
  caption: string;
  prompt: string;
  isModified?: boolean;
}

interface PageDetailsAccordionProps {
  pages: PageDetail[];
  onCaptionChange: (pageNumber: number, newCaption: string) => void;
  className?: string;
  disabled?: boolean;
}

export function PageDetailsAccordion({
  pages,
  onCaptionChange,
  className,
  disabled = false,
}: PageDetailsAccordionProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {pages.map((page, index) => (
        <Collapsible
          key={page.pageNumber}
          defaultOpen={index === 0}
          title={
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  page.isModified
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-stone-100 text-stone-600'
                )}
              >
                Page {page.pageNumber}
              </Badge>
              <span className="text-sm text-stone-600 truncate max-w-[300px] sm:max-w-[400px]">
                {page.caption}
              </span>
              {page.isModified && (
                <Badge className="bg-amber-500 text-white text-[10px] py-0">
                  Edited
                </Badge>
              )}
            </div>
          }
          className="bg-white"
        >
          <div className="space-y-4">
            {/* Editable Caption */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Caption
              </label>
              <EditableCaption
                value={page.caption}
                onChange={(newCaption) => onCaptionChange(page.pageNumber, newCaption)}
                placeholder="Enter page caption..."
                disabled={disabled}
              />
            </div>

            {/* Read-only Scene Prompt */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Scene Description
                <span className="text-stone-400 font-normal ml-2">(read-only)</span>
              </label>
              <div className="rounded-lg bg-stone-50 p-3 border border-stone-200">
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap text-left">
                  {page.prompt}
                </p>
              </div>
            </div>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
