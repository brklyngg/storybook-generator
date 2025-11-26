'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Share2, Play, AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { Storyboard } from '@/components/Storyboard';
import { ExportBar } from '@/components/ExportBar';
import { Reader } from '@/components/Reader';
import type { StoryPage, BookSession } from '@/lib/types';

export default function StudioClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const [session, setSession] = useState<BookSession | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Ref to prevent duplicate generation calls (React StrictMode runs effects twice in dev)
  const generationStartedRef = useRef(false);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    try {
      // Check if ID is a valid UUID (Supabase requires UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (isUuid) {
        // Try fetching from API (Supabase)
        const response = await fetch(`/api/stories/${id}`);
        if (response.ok) {
          const data = await response.json();

          // Map DB data to BookSession format
          const loadedSession: BookSession = {
            id: data.story.id,
            sourceText: data.story.source_text,
            settings: data.story.settings,
            timestamp: new Date(data.story.created_at).getTime(),
            theme: data.story.theme
          };

          setSession(loadedSession);

          // Map characters
          const loadedCharacters = data.characters.map((c: any) => ({
            name: c.name,
            description: c.description,
            role: c.role,
            referenceImage: c.reference_image,
            referenceImages: c.reference_images
          }));
          setCharacters(loadedCharacters);

          // Map pages
          const loadedPages = data.pages.map((p: any) => ({
            index: p.page_number - 1,
            caption: p.caption,
            prompt: p.prompt,
            imageUrl: p.image_url,
            warnings: [] // Warnings not stored in simple schema yet
          }));
          setPages(loadedPages);
          return; // Successfully loaded from DB
        }
      }

      // Fallback to localStorage for legacy sessions or if DB fetch failed
      // Fallback to localStorage for legacy sessions
      const sessionData = localStorage.getItem(id);
      if (sessionData) {
        const parsedSession: BookSession = JSON.parse(sessionData);
        parsedSession.id = id;
        setSession(parsedSession);
        // If it was a legacy session, we might want to trigger generation if empty
        if (!parsedSession.pages || parsedSession.pages.length === 0) {
          startGeneration(parsedSession);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setError('Failed to load story session');
    }
  };

  const startGeneration = async (sessionData: BookSession) => {
    // Prevent duplicate calls from React StrictMode double-render
    if (generationStartedRef.current) return;
    generationStartedRef.current = true;

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // 1. Create Story (if not already exists or if we want to restart?)
      // Actually, if we are here, we might already have a session ID from localStorage or URL.
      // If it's a new session (no ID), we should have created it before routing here.
      // But let's assume we have sessionData.

      let storyId = sessionData.id;

      // If this is a fresh start (no ID or local-only), create in DB
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId);

      if (!sessionId || !isUuid) { // Only create if not loaded from URL OR if URL is legacy ID
        const createResponse = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: sessionData.sourceText,
            settings: sessionData.settings
          })
        });

        if (createResponse.ok) {
          const newStory = await createResponse.json();
          storyId = newStory.id;
          // Update URL without reload
          router.push(`/studio?session=${storyId}`);
        }
      }

      // 2. Generate Plan
      setCurrentStep('Planning story structure...');
      const planResponse = await fetch(`/api/stories/${storyId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sessionData.sourceText,
          settings: sessionData.settings,
        }),
      });

      if (!planResponse.ok) {
        const err = await planResponse.json();
        throw new Error(err.error || 'Failed to plan story');
      }

      const planData = await planResponse.json();
      const { characters: plannedCharacters, pageCount, styleBible } = planData;

      // Update local state with skeletons
      setCharacters(plannedCharacters.map((c: any) => ({ ...c, referenceImage: null })));
      setPages(Array(pageCount).fill(null).map((_, i) => ({
        index: i,
        caption: 'Planning...',
        prompt: 'Planning...'
      })));

      // 3. Generate Characters (Sequential)
      const totalSteps = plannedCharacters.length + pageCount;
      let completedSteps = 0;

      const generatedCharacters = [];
      for (const char of plannedCharacters) {
        setCurrentStep(`Generating character: ${char.name}...`);

        // Skip generation if Nano Banana Pro is disabled (check settings or env? Client doesn't know env)
        // We'll rely on the API to handle it or just call it.
        // The API `characters/generate` handles the generation.

        try {
          const charResponse = await fetch(`/api/stories/${storyId}/characters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: char.id })
          });

          if (charResponse.ok) {
            const charResult = await charResponse.json();
            // Update local character state with new image
            setCharacters(prev => prev.map(c =>
              c.id === char.id ? { ...c, referenceImage: charResult.references?.[0] } : c
            ));
          }
        } catch (e) {
          console.warn(`Failed to generate character ${char.name}`, e);
        }

        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      // Refresh characters from DB to get full data
      // Or just proceed with what we have in state (which we updated).

      // 4. Generate Pages (Sequential)
      // First, we need the page prompts. The `plan` endpoint saved them to DB.
      // We should fetch them or use the response from `plan` if it returned them.
      // The `plan` endpoint returned `pageCount` but not the full pages array in my refactor.
      // I should probably fetch the pages from DB now.

      const pagesResponse = await fetch(`/api/stories/${storyId}`);
      const pagesData = await pagesResponse.json();
      const dbPages = pagesData.pages; // These have captions and prompts but no images yet

      setPages(dbPages.map((p: any) => ({
        index: p.page_number - 1,
        caption: p.caption,
        prompt: p.prompt,
        imageUrl: null
      })));

      const generatedPages: StoryPage[] = [];

      for (let i = 0; i < dbPages.length; i++) {
        const page = dbPages[i];
        setCurrentStep(`Illustrating page ${page.page_number} of ${dbPages.length}...`);

        // Prepare context for generation
        // We need `characterReferences` which we have in `characters` state
        const characterReferences = characters
          .filter(c => c.referenceImage) // Only use those with images
          .map(c => ({
            name: c.name,
            referenceImage: c.referenceImage
          }));

        const generateResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId, // Pass storyId for persistence
            pageIndex: i,
            caption: page.caption,
            stylePrompt: sessionData.settings.aestheticStyle,
            characterConsistency: sessionData.settings.characterConsistency,
            previousPages: generatedPages, // Pass previously generated pages for continuity
            characterReferences,
            qualityTier: sessionData.settings.qualityTier,
            aspectRatio: sessionData.settings.aspectRatio,
            enableSearchGrounding: sessionData.settings.enableSearchGrounding,
          }),
        });

        const { imageUrl, warnings } = await generateResponse.json();

        const newPage: StoryPage = {
          index: i,
          caption: page.caption,
          prompt: page.prompt,
          imageUrl,
          warnings,
        };

        generatedPages.push(newPage);
        setPages(prev => {
          const newPages = [...prev];
          newPages[i] = newPage;
          return newPages;
        });

        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

    } catch (err) {
      console.error('Error generating storyboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
    } finally {
      setIsGenerating(false);
      setCurrentStep('');
      setProgress(0);
    }
  };

  const handleRetry = () => {
    if (session) {
      startGeneration(session);
    }
  };

  const handlePageUpdate = (index: number, updates: Partial<StoryPage>) => {
    setPages(prev => prev.map(page =>
      page.index === index ? { ...page, ...updates } : page
    ));
  };

  const handlePageReorder = (newPages: StoryPage[]) => {
    setPages(newPages);
  };

  if (!session && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isReading && session && (
        <Reader
          pages={pages}
          onClose={() => setIsReading(false)}
          title={session.fileName || 'My Story'}
        />
      )}

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BookOpen className="h-6 w-6 text-green-600" />
              <div>
                <h1 className="text-xl font-semibold">Story Studio</h1>
                {session && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Badge variant="secondary">{session.settings.targetAge}</Badge>
                    <Badge variant="secondary">Intensity: {session.settings.harshness}/10</Badge>
                    <Badge variant="secondary">{pages.length} pages</Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsReading(true)}
                disabled={pages.length === 0 || isGenerating}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Read Book
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <ExportBar pages={pages} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {isGenerating && session && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Your Picture Book
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">{currentStep}</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(progress)}% complete
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Generation Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={handleRetry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {session && (
          <Storyboard
            pages={pages}
            characters={characters}
            settings={session.settings}
            onPageUpdate={handlePageUpdate}
            onPageReorder={handlePageReorder}
            isGenerating={isGenerating}
          />
        )}
      </div>

      <div className="fixed bottom-4 right-4">
        <Badge variant="outline" className="bg-white">
          🤖 AI Generated Content
        </Badge>
      </div>
    </div>
  );
}
