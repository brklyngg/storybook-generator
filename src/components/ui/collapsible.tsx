'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  titleClassName,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('border border-stone-200 rounded-lg overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4 text-left',
          'bg-stone-50 hover:bg-stone-100 transition-colors',
          titleClassName
        )}
      >
        <span className="font-medium text-stone-700">{title}</span>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-stone-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="p-4 border-t border-stone-200">{children}</div>
      </div>
    </div>
  );
}
