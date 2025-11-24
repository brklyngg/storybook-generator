'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Download, Share2 } from 'lucide-react';
import { Storyboard } from '@/components/Storyboard';
import { ExportBar } from '@/components/ExportBar';
import type { StoryPage, BookSession } from '@/lib/types';

import { Reader } from '@/components/Reader';
import { Play } from 'lucide-react';

export default function StudioPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [session, setSession] = useState<BookSession | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isReading, setIsReading] = useState(false);

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

      const { pages: plannedPages, characters } = await planResponse.json();

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

    } catch (error) {
      console.error('Error generating storyboard:', error);
    } finally {
      setIsGenerating(false);
      setCurrentStep('');
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

        <Storyboard
          pages={pages}
          characters={characters}
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