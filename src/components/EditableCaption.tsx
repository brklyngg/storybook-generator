'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableCaptionProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableCaption({
  value,
  onChange,
  placeholder = 'Enter caption...',
  className,
  disabled = false,
}: EditableCaptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(editValue.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      // Cmd/Ctrl+Enter to save
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('space-y-2', className)}>
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[80px] resize-none border-amber-300 focus:border-amber-500 focus:ring-amber-500"
          disabled={disabled}
        />
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="text-stone-500 hover:text-stone-700"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!editValue.trim()}
          >
            <Check className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
        <p className="text-xs text-stone-400">Press Cmd+Enter to save, Escape to cancel</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-lg p-3 transition-colors',
        'hover:bg-amber-50 border border-transparent hover:border-amber-200',
        disabled && 'pointer-events-none opacity-60',
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <p className="text-stone-700 leading-relaxed pr-8">
        {value || <span className="text-stone-400 italic">{placeholder}</span>}
      </p>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        <Pencil className="w-3.5 h-3.5 text-amber-600" />
      </Button>
    </div>
  );
}
