'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react';
import { Storyboard } from '@/components/Storyboard';
import { ExportBar } from '@/components/ExportBar';
import { Reader } from '@/components/Reader';
import { PlanReviewPanel } from '@/components/PlanReviewPanel';
import { CharacterReviewPanel } from '@/components/CharacterReviewPanel';
import { WorkflowStepper } from '@/components/WorkflowStepper';
import type { StoryPage, BookSession, WorkflowState, PlanData, EditedPage, StyleBible } from '@/lib/types';

interface CharacterWithImage {
  id: string;
  name: string;
  description: string;
  role: 'main' | 'supporting' | 'background';
  referenceImage?: string;
  referenceImages?: string[];
}

export default function StudioClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  // Core state
  const [session, setSession] = useState<BookSession | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [characters, setCharacters] = useState<CharacterWithImage[]>([]);

  // Workflow state machine
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [editedPages, setEditedPages] = useState<EditedPage[]>([]);
  const [firstPagePreview, setFirstPagePreview] = useState<{ pageNumber: number; caption: string; imageUrl: string } | null>(null);

  // UI state
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [rerollingWhat, setRerollingWhat] = useState<'characters' | 'firstPage' | null>(null);

  // Refs
  const generationStartedRef = useRef(false);
  const storyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (isUuid) {
        const response = await fetch(`/api/stories/${id}`);
        if (response.ok) {
          const data = await response.json();

          const loadedSession: BookSession = {
            id: data.story.id,
            sourceText: data.story.source_text,
            settings: data.story.settings,
            timestamp: new Date(data.story.created_at).getTime(),
            theme: data.story.theme,
            fileName: data.story.file_name
          };

          setSession(loadedSession);
          storyIdRef.current = data.story.id;

          // Check if this story already has pages with images (completed)
          const hasCompletedPages = data.pages.some((p: any) => p.image_url);

          if (hasCompletedPages) {
            // Load existing data
            setCharacters(data.characters.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              role: c.role,
              referenceImage: c.reference_image,
              referenceImages: c.reference_images
            })));

            setPages(data.pages.map((p: any) => ({
              index: p.page_number - 1,
              caption: p.caption,
              prompt: p.prompt,
              imageUrl: p.image_url,
              warnings: []
            })));

            setWorkflowState('complete');
          } else {
            // Story exists but needs generation - start from plan
            startPlanGeneration(loadedSession);
          }
          return;
        }
      }

      // Fallback to localStorage for legacy sessions
      const sessionData = localStorage.getItem(id);
      if (sessionData) {
        const parsedSession: BookSession = JSON.parse(sessionData);
        parsedSession.id = id;
        setSession(parsedSession);
        startPlanGeneration(parsedSession);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setError('Failed to load story session');
      setWorkflowState('error');
    }
  };

  // PHASE 1: Generate Plan
  const startPlanGeneration = async (sessionData: BookSession) => {
    if (generationStartedRef.current) return;
    generationStartedRef.current = true;

    setWorkflowState('plan_pending');
    setError(null);
    setCurrentStep('Planning story structure...');

    try {
      let storyId = sessionData.id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId);

      // Create story in DB if needed
      if (!sessionId || !isUuid) {
        const createResponse = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: sessionData.sourceText,
            settings: sessionData.settings,
            fileName: sessionData.fileName
          })
        });

        if (createResponse.ok) {
          const newStory = await createResponse.json();
          storyId = newStory.id;
          storyIdRef.current = storyId;
          router.push(`/studio?session=${storyId}`);
        }
      } else {
        storyIdRef.current = storyId;
      }

      // Generate plan
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

      const plan = await planResponse.json();

      // Store plan data for review
      const newPlanData: PlanData = {
        pages: plan.pages || [],
        characters: plan.characters.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          role: c.role || 'supporting'
        })),
        storyArcSummary: plan.storyArcSummary || [],
        theme: plan.theme || '',
        styleBible: plan.styleBible
      };

      setPlanData(newPlanData);
      setEditedPages(newPlanData.pages.map(p => ({
        pageNumber: p.pageNumber,
        caption: p.caption,
        prompt: p.prompt,
        isModified: false
      })));

      // Transition to plan review
      setWorkflowState('plan_review');
      setCurrentStep('');

    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      setWorkflowState('error');
    }
  };

  // Handle plan approval
  const handlePlanApproval = async (approvedPages: EditedPage[]) => {
    if (!session || !storyIdRef.current) return;

    setEditedPages(approvedPages);

    // Update captions in DB if any were modified
    const modifiedPages = approvedPages.filter(p => p.isModified);
    if (modifiedPages.length > 0) {
      try {
        await fetch(`/api/stories/${storyIdRef.current}/pages/update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: modifiedPages })
        });
      } catch (e) {
        console.warn('Failed to persist caption changes:', e);
      }
    }

    // Start character generation
    startCharacterGeneration();
  };

  // Handle plan regeneration
  const handlePlanRegenerate = async () => {
    if (!session) return;

    setIsRegenerating(true);
    generationStartedRef.current = false;

    try {
      await startPlanGeneration(session);
    } finally {
      setIsRegenerating(false);
    }
  };

  // PHASE 2: Generate Characters
  const startCharacterGeneration = async () => {
    if (!session || !planData || !storyIdRef.current) return;

    setWorkflowState('characters_generating');
    setCurrentStep('Generating character references...');
    setProgress(0);

    const storyId = storyIdRef.current;
    const totalCharacters = planData.characters.length;

    try {
      const generatedCharacters: CharacterWithImage[] = [];

      for (let i = 0; i < planData.characters.length; i++) {
        const char = planData.characters[i];
        setCurrentStep(`Generating character: ${char.name}...`);

        try {
          const charResponse = await fetch(`/api/stories/${storyId}/characters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: char.id })
          });

          if (charResponse.ok) {
            const charResult = await charResponse.json();
            generatedCharacters.push({
              ...char,
              referenceImage: charResult.references?.[0],
              referenceImages: charResult.references
            });
          } else {
            generatedCharacters.push({ ...char });
          }
        } catch (e) {
          console.warn(`Failed to generate character ${char.name}`, e);
          generatedCharacters.push({ ...char });
        }

        setCharacters([...generatedCharacters]);
        setProgress(((i + 1) / totalCharacters) * 50); // First 50% for characters
      }

      // Check if we need character review checkpoint
      if (session.settings.enableCharacterReviewCheckpoint) {
        // Generate first page as style sample
        setCurrentStep('Generating style sample...');
        await generateFirstPageSample(storyId, generatedCharacters);
        setWorkflowState('character_review');
      } else {
        // Skip to page generation
        startPageGeneration(generatedCharacters);
      }

    } catch (err) {
      console.error('Error generating characters:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate characters');
      setWorkflowState('error');
    }
  };

  // Generate first page as style sample
  const generateFirstPageSample = async (storyId: string, chars: CharacterWithImage[]) => {
    if (!session || editedPages.length === 0) return;

    const firstPage = editedPages[0];
    const characterReferences = chars
      .filter(c => c.referenceImage)
      .map(c => ({ name: c.name, referenceImage: c.referenceImage! }));

    try {
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          pageIndex: 0,
          caption: firstPage.caption,
          stylePrompt: session.settings.aestheticStyle,
          characterConsistency: session.settings.characterConsistency,
          previousPages: [],
          characterReferences,
          qualityTier: session.settings.qualityTier,
          aspectRatio: session.settings.aspectRatio,
          enableSearchGrounding: session.settings.enableSearchGrounding,
        }),
      });

      if (generateResponse.ok) {
        const { imageUrl } = await generateResponse.json();
        setFirstPagePreview({
          pageNumber: 1,
          caption: firstPage.caption,
          imageUrl
        });
      }
    } catch (e) {
      console.warn('Failed to generate first page sample:', e);
    }
  };

  // Handle character approval
  const handleCharacterApproval = () => {
    startPageGeneration(characters);
  };

  // Handle character re-roll
  const handleCharacterReroll = async () => {
    if (!session || !planData) return;

    setRerollingWhat('characters');
    setCharacters(planData.characters.map(c => ({ ...c, referenceImage: undefined })));
    setFirstPagePreview(null);

    try {
      await startCharacterGeneration();
    } finally {
      setRerollingWhat(null);
    }
  };

  // Handle first page re-roll
  const handleFirstPageReroll = async () => {
    if (!session || !storyIdRef.current) return;

    setRerollingWhat('firstPage');
    setFirstPagePreview(null);

    try {
      await generateFirstPageSample(storyIdRef.current, characters);
    } finally {
      setRerollingWhat(null);
    }
  };

  // Handle going back to plan from character review
  const handleBackToPlan = () => {
    setWorkflowState('plan_review');
    setFirstPagePreview(null);
  };

  // PHASE 3: Generate Pages
  const startPageGeneration = async (chars: CharacterWithImage[]) => {
    if (!session || !storyIdRef.current) return;

    setWorkflowState('pages_generating');
    setProgress(50); // Start at 50% since characters are done

    const storyId = storyIdRef.current;

    try {
      // Fetch pages from DB
      const pagesResponse = await fetch(`/api/stories/${storyId}`);
      const pagesData = await pagesResponse.json();
      const dbPages = pagesData.pages;

      // Apply any caption edits
      const pagesWithEdits = dbPages.map((p: any) => {
        const edited = editedPages.find(ep => ep.pageNumber === p.page_number);
        return {
          ...p,
          caption: edited?.caption || p.caption
        };
      });

      setPages(pagesWithEdits.map((p: any) => ({
        index: p.page_number - 1,
        caption: p.caption,
        prompt: p.prompt,
        imageUrl: null
      })));

      const totalPages = pagesWithEdits.length;
      const generatedPages: StoryPage[] = [];

      // If we already have first page from preview, use it
      const startIndex = firstPagePreview ? 1 : 0;
      if (firstPagePreview) {
        const firstPageData: StoryPage = {
          index: 0,
          caption: pagesWithEdits[0].caption,
          prompt: pagesWithEdits[0].prompt,
          imageUrl: firstPagePreview.imageUrl,
          warnings: []
        };
        generatedPages.push(firstPageData);
        setPages(prev => {
          const newPages = [...prev];
          newPages[0] = firstPageData;
          return newPages;
        });
      }

      for (let i = startIndex; i < totalPages; i++) {
        const page = pagesWithEdits[i];
        setCurrentStep(`Illustrating page ${i + 1} of ${totalPages}...`);

        const characterReferences = chars
          .filter(c => c.referenceImage)
          .map(c => ({ name: c.name, referenceImage: c.referenceImage! }));

        const generateResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId,
            pageIndex: i,
            caption: page.caption,
            stylePrompt: session.settings.aestheticStyle,
            characterConsistency: session.settings.characterConsistency,
            previousPages: generatedPages.slice(-2),
            characterReferences,
            qualityTier: session.settings.qualityTier,
            aspectRatio: session.settings.aspectRatio,
            enableSearchGrounding: session.settings.enableSearchGrounding,
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

        setProgress(50 + ((i + 1) / totalPages) * 50);
      }

      setWorkflowState('complete');
      setCurrentStep('');
      setProgress(100);

    } catch (err) {
      console.error('Error generating pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate pages');
      setWorkflowState('error');
    }
  };

  const handleRetry = () => {
    if (session) {
      generationStartedRef.current = false;
      setError(null);
      startPlanGeneration(session);
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

  // Loading state
  if (workflowState === 'idle' && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  // Plan Review state
  if (workflowState === 'plan_review' && planData && session) {
    return (
      <PlanReviewPanel
        planData={planData}
        storyTitle={session.fileName || 'Untitled Story'}
        onApprove={handlePlanApproval}
        onRegenerate={handlePlanRegenerate}
        isRegenerating={isRegenerating}
        showCharacterReviewCheckpoint={session.settings.enableCharacterReviewCheckpoint}
      />
    );
  }

  // Character Review state
  if (workflowState === 'character_review' && session) {
    return (
      <CharacterReviewPanel
        characters={characters}
        firstPage={firstPagePreview}
        storyTitle={session.fileName || 'Untitled Story'}
        onApprove={handleCharacterApproval}
        onRerollCharacters={handleCharacterReroll}
        onRerollFirstPage={handleFirstPageReroll}
        onBack={handleBackToPlan}
        isRerolling={rerollingWhat !== null}
        rerollingWhat={rerollingWhat}
      />
    );
  }

  // Main studio view (generating or complete)
  return (
    <div className="min-h-screen bg-background">
      {isReading && session && (
        <Reader
          pages={pages}
          onClose={() => setIsReading(false)}
          title={session.fileName || 'My Story'}
        />
      )}

      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-smooth"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div className="border-l border-border pl-4">
                <h1 className="text-lg font-semibold font-heading">
                  {session?.fileName || 'Untitled Story'}
                </h1>
                {session && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>Ages {session.settings.targetAge}</span>
                    <span>•</span>
                    <span>{pages.length} pages</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsReading(true)}
                disabled={pages.length === 0 || workflowState !== 'complete'}
              >
                <Play className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <ExportBar pages={pages} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Generation Progress */}
        {(workflowState === 'plan_pending' || workflowState === 'characters_generating' || workflowState === 'pages_generating') && session && (
          <Card className="mb-6 border-2 border-amber-300/50 bg-amber-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                  Generating Your Picture Book
                </CardTitle>
                <WorkflowStepper
                  currentState={workflowState}
                  showCharacterReview={session.settings.enableCharacterReviewCheckpoint}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentStep && <p className="text-base font-medium text-stone-700">{currentStep}</p>}
                <div
                  className="w-full bg-stone-200 rounded-full h-3"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Processing...</span>
                  <span className="font-semibold text-stone-700">{Math.round(progress)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {workflowState === 'error' && error && (
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

        {/* Storyboard */}
        {session && workflowState === 'complete' && (
          <Storyboard
            pages={pages}
            characters={characters}
            settings={session.settings}
            onPageUpdate={handlePageUpdate}
            onPageReorder={handlePageReorder}
            isGenerating={false}
          />
        )}

        {/* Show pages during generation */}
        {session && (workflowState === 'characters_generating' || workflowState === 'pages_generating') && pages.length > 0 && (
          <Storyboard
            pages={pages}
            characters={characters}
            settings={session.settings}
            onPageUpdate={handlePageUpdate}
            onPageReorder={handlePageReorder}
            isGenerating={true}
          />
        )}
      </div>
    </div>
  );
}
