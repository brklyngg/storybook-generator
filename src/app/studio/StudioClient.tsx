'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Share2, Play, AlertTriangle, RefreshCw } from 'lucide-react';
import { Storyboard } from '@/components/Storyboard';
import { ExportBar } from '@/components/ExportBar';
import { Reader } from '@/components/Reader';
import type { StoryPage, BookSession } from '@/lib/types';

export default function StudioClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [session, setSession] = useState<BookSession | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    try {
      const sessionData = localStorage.getItem(id);
      if (sessionData) {
        const parsedSession: BookSession = JSON.parse(sessionData);
        parsedSession.id = id;
        setSession(parsedSession);

        await generateStoryboard(parsedSession);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const generateStoryboard = async (sessionData: BookSession) => {
    setIsGenerating(true);

    try {
      setCurrentStep('Planning story structure...');
      const planResponse = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sessionData.sourceText,
          settings: sessionData.settings,
        }),
      });

      const planData = await planResponse.json();

      if (!planResponse.ok) {
        throw new Error(planData.error || 'Failed to plan story');
      }

      const { pages: plannedPages, characters } = planData;

      if (!plannedPages || plannedPages.length === 0) {
        throw new Error('No pages were generated in the story plan');
      }

      // Store characters for consistency across regenerations
      setCharacters(characters || []);

      const generatedPages: StoryPage[] = [];

      for (let i = 0; i < plannedPages.length; i++) {
        setCurrentStep(`Generating illustration ${i + 1} of ${plannedPages.length}...`);

        // Extract character references with images for consistency
        const characterReferences = characters
          ?.filter((char: any) => char.referenceImage)
          ?.map((char: any) => ({
            name: char.name,
            referenceImage: char.referenceImage,
          })) || [];

        const generateResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageIndex: i,
            caption: plannedPages[i].caption,
            stylePrompt: sessionData.settings.aestheticStyle,
            characterConsistency: sessionData.settings.characterConsistency,
            previousPages: generatedPages,
            characterReferences,
            qualityTier: sessionData.settings.qualityTier,
            aspectRatio: sessionData.settings.aspectRatio,
            enableSearchGrounding: sessionData.settings.enableSearchGrounding,
          }),
        });

        const { imageUrl, warnings } = await generateResponse.json();

        const page: StoryPage = {
          index: i,
          caption: plannedPages[i].caption,
          prompt: plannedPages[i].prompt,
          imageUrl,
          warnings,
        };

        generatedPages.push(page);
        setPages([...generatedPages]);
      }

    } catch (err) {
      console.error('Error generating storyboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
    } finally {
      setIsGenerating(false);
      setCurrentStep('');
    }
  };

  const handleRetry = () => {
    setError(null);
    if (session) {
      generateStoryboard(session);
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isReading && (
        <Reader
          pages={pages}
          onClose={() => setIsReading(false)}
          title={session.fileName}
        />
      )}

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BookOpen className="h-6 w-6 text-green-600" />
              <div>
                <h1 className="text-xl font-semibold">Story Studio</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Badge variant="secondary">{session.settings.targetAge}</Badge>
                  <Badge variant="secondary">Intensity: {session.settings.harshness}/10</Badge>
                  <Badge variant="secondary">{pages.length} pages</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsReading(true)}
                disabled={pages.length === 0}
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
        {isGenerating && (
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
                    style={{ width: `${(pages.length / session.settings.desiredPageCount) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {pages.length} of {session.settings.desiredPageCount} pages complete
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

        <Storyboard
          pages={pages}
          characters={characters}
          settings={session.settings}
          onPageUpdate={handlePageUpdate}
          onPageReorder={handlePageReorder}
          isGenerating={isGenerating}
        />
      </div>

      <div className="fixed bottom-4 right-4">
        <Badge variant="outline" className="bg-white">
          🤖 AI Generated Content
        </Badge>
      </div>
    </div>
  );
}
