'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, BookOpen, Globe, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface StorySearchProps {
  onStoryFound: (text: string, title: string, metadata?: {
    author?: string;
    source?: string;
    wordCount?: number;
    isPublicDomain?: boolean;
  }) => void;
}

// Popular public domain story suggestions
const STORY_SUGGESTIONS = [
  'The Velveteen Rabbit',
  'Peter Pan',
  'Alice in Wonderland',
  'The Little Prince',
  'The Ugly Duckling',
  'Cinderella',
  'Little Red Riding Hood',
  'The Three Little Pigs',
  'Jack and the Beanstalk',
  'Rapunzel',
  'Snow White',
  'Hansel and Gretel',
  'The Frog Prince',
  'Sleeping Beauty',
  'The Tortoise and the Hare',
];

export function StorySearch({ onStoryFound }: StorySearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    title: string;
    author: string;
    content: string;
    wordCount: number;
    isPublicDomain: boolean;
    source?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate through suggestions
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % STORY_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const response = await fetch('/api/story-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), useWebSearch: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find story');
      }

      setResult({
        title: data.title,
        author: data.author,
        content: data.content,
        wordCount: data.wordCount,
        isPublicDomain: data.isPublicDomain,
        source: data.source,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for story');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleQuickSearch = (story: string) => {
    setSearchQuery(story);
    performSearch(story);
  };

  const handleUseStory = async () => {
    if (!result) return;

    // Save to database for logged-in users
    const supabase = getSupabaseBrowser();
    if (supabase) {
      setIsSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Check if this story already exists for this user
          const { data: existing } = await supabase
            .from('stories')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', result.title)
            .eq('status', 'saved')
            .single();

          if (!existing) {
            // Save as a "saved" story (not yet generating)
            await supabase
              .from('stories')
              .insert({
                user_id: user.id,
                title: result.title,
                source_text: result.content,
                theme: `By ${result.author}`,
                status: 'saved',
                settings: {
                  author: result.author,
                  source: result.source,
                  isPublicDomain: result.isPublicDomain,
                },
              });
            setSaved(true);
          }
        }
      } catch (err) {
        console.error('Error saving story:', err);
      } finally {
        setIsSaving(false);
      }
    }

    // Pass story to parent - use localStorage for large texts
    const LARGE_TEXT_THRESHOLD = 100_000;
    if (result.content.length > LARGE_TEXT_THRESHOLD) {
      // Store large text in localStorage and pass reference
      const textId = `search_${Date.now()}`;
      localStorage.setItem(`largeText_${textId}`, result.content);
      console.log(`📦 Large searched story (${result.content.length.toLocaleString()} chars) stored in localStorage: ${textId}`);
      onStoryFound(`__LARGE_TEXT_REF__${textId}`, result.title, {
        author: result.author,
        source: result.source,
        wordCount: result.wordCount,
        isPublicDomain: result.isPublicDomain,
      });
    } else {
      onStoryFound(result.content, result.title, {
        author: result.author,
        source: result.source,
        wordCount: result.wordCount,
        isPublicDomain: result.isPublicDomain,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Try "${STORY_SUGGESTIONS[suggestionIndex]}"`}
              className="pl-10 pr-4 h-12 text-base"
              disabled={isSearching}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            size="lg"
            className="h-12 px-6"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Find Story
              </>
            )}
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Uses AI web search to find full text of public domain stories
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try classics like "The Velveteen Rabbit" or "Peter Pan"
            </p>
          </div>
        </div>
      )}

      {/* Result Preview */}
      {result && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-border">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-bold text-lg text-foreground truncate">
                  {result.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  by {result.author}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    result.isPublicDomain 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {result.isPublicDomain ? '✓ Public Domain' : '⚠ Copyrighted'}
                  </span>
                  <span className="text-muted-foreground">
                    {result.wordCount.toLocaleString()} words
                  </span>
                  {result.source && (
                    <span className="text-muted-foreground truncate max-w-32">
                      via {result.source}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4">
            <p className="text-sm text-muted-foreground line-clamp-4 italic">
              "{result.content.substring(0, 400)}..."
            </p>
          </div>

          {/* Actions */}
          <div className="p-4 pt-0 flex items-center gap-3">
            <Button
              onClick={handleUseStory}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Use This Story
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Use This Story
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setSearchQuery('');
                inputRef.current?.focus();
              }}
            >
              Search Again
            </Button>
          </div>

          {/* Saved indicator */}
          {saved && (
            <div className="px-4 pb-4">
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3" />
                Story saved to your library for future use
              </p>
            </div>
          )}
        </div>
      )}

      {/* Suggestions (when no search yet) */}
      {!result && !isSearching && !error && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Popular classics:</p>
          <div className="flex flex-wrap gap-2">
            {STORY_SUGGESTIONS.slice(0, 6).map((story) => (
              <button
                key={story}
                onClick={() => handleQuickSearch(story)}
                className="px-3 py-1.5 text-xs rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {story}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

