'use client';

import { useState, useEffect, useRef } from 'react';
import { Library, ChevronDown, Search, Loader2, BookOpen, Clock } from 'lucide-react';
import { fetchStories, Story, supabase } from '@/lib/supabase';

interface StorySelectorProps {
  onSelect: (storyText: string, storyTitle: string) => void;
}

export function StorySelector({ onSelect }: StorySelectorProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle hydration - only check supabase after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if Supabase is configured (only meaningful after mount)
  const isConfigured = mounted && !!supabase;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch stories when dropdown opens
  useEffect(() => {
    if (isOpen && stories.length === 0 && isConfigured) {
      loadStories();
    }
  }, [isOpen, isConfigured]);

  const loadStories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStories();
      setStories(data);
    } catch (err) {
      setError('Failed to load stories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (story: Story) => {
    onSelect(story.source_text, story.title);
    setIsOpen(false);
    setSearch('');
  };

  // Filter stories by search term
  const filteredStories = stories.filter((story) => {
    const title = (story.title || '').toLowerCase();
    const theme = (story.theme || '').toLowerCase();
    const searchLower = search.toLowerCase();
    return title.includes(searchLower) || theme.includes(searchLower);
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Don't render anything until mounted (avoids hydration mismatch)
  // After mount, hide if Supabase isn't configured
  if (!mounted) {
    return null;
  }

  if (!isConfigured) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-lg
          bg-muted hover:bg-muted/80
          border border-border
          text-muted-foreground font-medium text-sm
          transition-all duration-200
          ${isOpen ? 'ring-2 ring-primary/30 border-primary' : ''}
        `}
      >
        <Library className="h-4 w-4" />
        Choose from Library
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] z-50 animate-in fade-in slide-in-from-top-2">
          <div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <Library className="h-5 w-5 text-primary" />
                <h3 className="font-heading font-semibold text-foreground">Story Library</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {stories.length} stories
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stories..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>

            {/* Story List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600 text-sm">
                  {error}
                  <button
                    onClick={loadStories}
                    className="block mx-auto mt-2 text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredStories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {search ? 'No stories match your search' : 'No stories found'}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {filteredStories.map((story) => {
                    const wordCount = story.source_text?.split(/\s+/).length || 0;

                    return (
                      <button
                        key={story.id}
                        onClick={() => handleSelect(story)}
                        className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors
                          border-b border-border/50 last:border-b-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-100 to-green-100 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {story.title}
                            </p>
                            {story.theme && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {story.theme}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(story.created_at)}
                              </span>
                              <span>{wordCount.toLocaleString()} words</span>
                              {story.status && story.status !== 'planning' && story.status !== 'complete' && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                                  ${story.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                                  {story.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
