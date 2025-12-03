'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react';
import { Storyboard } from '@/components/Storyboard';
import { ExportBar } from '@/components/ExportBar';
import { Reader } from '@/components/Reader';
import { UnifiedStoryPreview } from '@/components/UnifiedStoryPreview';
import { Header } from '@/components/Header';
import { GenerationHistory } from '@/components/GenerationHistory';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { StoryPage, BookSession, WorkflowState, PlanData, EditedPage, StyleBible, ConsistencyAnalysis, CharacterWithImage } from '@/lib/types';

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
  const stopGenerationRef = useRef(false);
  const autoGenerationStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
            title: data.story.title,
            fileName: data.story.file_name
          };

          setSession(loadedSession);
          storyIdRef.current = data.story.id;

          // Check if this story already has pages with images (completed)
          const hasCompletedPages = data.pages.some((p: any) => p.image_url);

          if (hasCompletedPages) {
            // Load existing data
            const loadedCharacters = data.characters.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              displayDescription: c.display_description, // Story role for UI
              approximateAge: c.approximate_age, // Age for UI
              role: c.role,
              isHero: c.is_hero,
              referenceImage: c.reference_image,
              referenceImages: c.reference_images
            }));
            setCharacters(loadedCharacters);

            const loadedPages = data.pages.map((p: any) => ({
              index: p.page_number - 1,
              caption: p.caption,
              prompt: p.prompt,
              cameraAngle: p.camera_angle,
              imageUrl: p.image_url,
              warnings: []
            }));
            setPages(loadedPages);

            // Helper to create a plot summary from a caption (extract key action, not full prose)
            const summarizeCaption = (caption: string): string => {
              // Take first sentence but limit to 20 words max
              const firstSentence = caption.match(/^[^.!?]*[.!?]/)?.[0] || caption;
              const words = firstSentence.trim().split(/\s+/);
              if (words.length > 20) {
                return words.slice(0, 20).join(' ') + '...';
              }
              return firstSentence.trim();
            };

            // Reconstruct planData from loaded data for GenerationHistory
            const totalPages = data.pages.length;

            // Map pages to story beats (Setup → Rising → Midpoint → Climax → Resolution)
            const setupIdx = 0;
            const risingIdx = Math.floor(totalPages * 0.25);
            const midpointIdx = Math.floor(totalPages * 0.5);
            const climaxIdx = Math.floor(totalPages * 0.75);
            const resolutionIdx = totalPages - 1;

            const reconstructedPlanData: PlanData = {
              pages: data.pages.map((p: any) => ({
                pageNumber: p.page_number,
                caption: p.caption,
                prompt: p.prompt,
                cameraAngle: p.camera_angle
              })),
              characters: loadedCharacters.map((c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                displayDescription: c.displayDescription, // Story role for UI
                approximateAge: c.approximateAge, // Age for UI
                role: c.role,
                isHero: c.isHero
              })),
              // Generate proper 5-point story arc from strategic page captions
              storyArcSummary: [
                summarizeCaption(data.pages[setupIdx]?.caption || 'The story begins...'),
                summarizeCaption(data.pages[risingIdx]?.caption || 'The adventure starts...'),
                summarizeCaption(data.pages[midpointIdx]?.caption || 'A turning point occurs...'),
                summarizeCaption(data.pages[climaxIdx]?.caption || 'The climax arrives...'),
                summarizeCaption(data.pages[resolutionIdx]?.caption || 'The story concludes...')
              ],
              theme: data.story.theme || '',
              styleBible: {
                artStyle: loadedSession.settings?.aestheticStyle || 'watercolor',
                colorPalette: 'warm and inviting',
                lighting: 'soft natural light',
                composition: 'balanced and child-friendly',
                doNots: [],
                consistency: {
                  characterSeeds: {},
                  environmentStyle: loadedSession.settings?.aestheticStyle || 'watercolor'
                },
                visualDensity: 'age-appropriate detail',
                resolutionQuality: loadedSession.settings?.qualityTier || 'standard-flash'
              }
            };
            setPlanData(reconstructedPlanData);

            // Ensure story status is 'complete' in database (fix for stories stuck in 'planning')
            if (data.story.status !== 'complete') {
              try {
                const supabase = getSupabaseBrowser();
                if (supabase) {
                  await supabase.from('stories').update({
                    status: 'complete',
                    current_step: null
                  }).eq('id', data.story.id);
                }
              } catch (e) {
                console.warn('Failed to fix story status:', e);
              }
            }

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
        let userId = undefined;
        const supabase = getSupabaseBrowser();
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }

        const createResponse = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: sessionData.sourceText,
            settings: sessionData.settings,
            title: sessionData.title || sessionData.fileName || 'Untitled Story',
            userId
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
          displayDescription: c.display_description, // Story role for UI
          approximateAge: c.approximate_age, // Age for UI
          role: c.role || 'supporting',
          isHero: c.is_hero || false
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
        cameraAngle: p.cameraAngle, // Story-driven camera angle from planning
        isModified: false
      })));

      // Transition to unified story preview
      setWorkflowState('story_preview');
      setCurrentStep('');

      // Start character generation immediately in background
      // Pass newPlanData and sessionData directly since React state updates are async
      startCharacterGeneration(newPlanData, sessionData);

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
  // Pass planDataOverride and sessionOverride when calling immediately after setPlanData/setSession (async state issue)
  const startCharacterGeneration = async (planDataOverride?: PlanData, sessionOverride?: BookSession) => {
    const activePlanData = planDataOverride || planData;
    const activeSession = sessionOverride || session;
    if (!activeSession || !activePlanData || !storyIdRef.current) return;

    // Only set state if we're not already in preview mode (legacy support or direct entry)
    if (workflowState !== 'story_preview') {
      setWorkflowState('characters_generating');
    }

    setCurrentStep('Generating character references...');
    setProgress(0);

    const storyId = storyIdRef.current;
    const totalCharacters = activePlanData.characters.length;

    // Initialize characters with placeholders (no images yet) for progressive loading
    const initialCharacters: CharacterWithImage[] = activePlanData.characters.map(char => ({
      id: char.id,
      name: char.name,
      description: char.description,
      displayDescription: char.displayDescription, // Story role for UI
      approximateAge: char.approximateAge, // Age for UI
      role: char.role,
      isHero: char.isHero,
      referenceImage: undefined,
      referenceImages: undefined
    }));
    setCharacters(initialCharacters);

    try {
      // Generate character images one by one, updating state progressively
      for (let i = 0; i < activePlanData.characters.length; i++) {
        const char = activePlanData.characters[i];
        setCurrentStep(`Generating character: ${char.name}...`);

        try {
          const charResponse = await fetch(`/api/stories/${storyId}/characters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: char.id })
          });

          if (charResponse.ok) {
            const charResult = await charResponse.json();
            // Update just this character with its image
            setCharacters(prev => prev.map(c =>
              c.id === char.id
                ? { ...c, referenceImage: charResult.references?.[0], referenceImages: charResult.references }
                : c
            ));
          }
        } catch (e) {
          console.warn(`Failed to generate character ${char.name}`, e);
          // Character stays in placeholder state
        }

        setProgress(((i + 1) / totalCharacters) * 50); // First 50% for characters
      }

      // Get latest characters state for generating first page
      const finalCharacters = await new Promise<CharacterWithImage[]>(resolve => {
        setCharacters(prev => {
          resolve(prev);
          return prev;
        });
      });

      // Auto-start page generation immediately after characters are ready
      // Full auto flow - no user approval gate needed
      if (!autoGenerationStartedRef.current) {
        autoGenerationStartedRef.current = true;
        // Start page generation immediately, passing session override
        startPageGeneration(finalCharacters, activeSession);
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
          cameraAngle: firstPage.cameraAngle, // Story-driven camera angle from planning
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
  const handleCharacterReroll = async (characterId?: string, feedback?: string) => {
    if (!session || !planData || !storyIdRef.current) return;

    const storyId = storyIdRef.current;

    // Case 1: Reroll specific character (from Unified Preview)
    if (characterId) {
      // Clear image for this character to show loading state
      setCharacters(prev => prev.map(c =>
        c.id === characterId ? { ...c, referenceImage: undefined } : c
      ));

      try {
        const charResponse = await fetch(`/api/stories/${storyId}/characters/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId,
            feedback // Pass feedback to API
          })
        });

        if (charResponse.ok) {
          const charResult = await charResponse.json();
          setCharacters(prev => prev.map(c =>
            c.id === characterId
              ? { ...c, referenceImage: charResult.references?.[0], referenceImages: charResult.references }
              : c
          ));
        }
      } catch (e) {
        console.warn(`Failed to regenerate character ${characterId}`, e);
      }
      return;
    }

    // Case 2: Reroll all characters (Legacy / Bulk)
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


  // Handle stop generation
  const handleStopGeneration = async () => {
    stopGenerationRef.current = true;
    // Abort any ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Update story status in database to 'complete' (partial generation is still valid)
    try {
      const supabase = getSupabaseBrowser();
      if (supabase && storyIdRef.current) {
        await supabase.from('stories').update({
          status: 'complete',
          current_step: null
        }).eq('id', storyIdRef.current);
      }
    } catch (e) {
      console.warn('Failed to update story status on stop:', e);
    }

    // Immediately update UI to show generation was stopped
    setWorkflowState('complete');
    setCurrentStep('Generation stopped by user');
    // Set progress to current state (don't reset to 0)
    // This keeps the visual feedback of what was completed
  };

  // Handle unified "Generate Storybook" action
  const handleGenerateStorybook = async (approvedPages: EditedPage[]) => {
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

    // Proceed to page generation
    startPageGeneration(characters);
  };

  // PHASE 3: Generate Pages
  // Pass sessionOverride when calling from auto-flow (React state may not be committed yet)
  const startPageGeneration = async (chars: CharacterWithImage[], sessionOverride?: BookSession) => {
    const activeSession = sessionOverride || session;
    if (!activeSession || !storyIdRef.current) return;

    setWorkflowState('pages_generating');
    setProgress(50); // Start at 50% since characters are done
    stopGenerationRef.current = false; // Reset stop flag

    // Create new abort controller for this generation session
    abortControllerRef.current = new AbortController();

    const storyId = storyIdRef.current;

    // Update story status in database to 'generating'
    try {
      const supabase = getSupabaseBrowser();
      if (supabase) {
        await supabase.from('stories').update({
          status: 'generating',
          current_step: 'Generating page illustrations...'
        }).eq('id', storyId);
      }
    } catch (e) {
      console.warn('Failed to update story status to generating:', e);
    }

    try {
      // Fetch pages from DB
      const pagesResponse = await fetch(`/api/stories/${storyId}`);
      const pagesData = await pagesResponse.json();
      const dbPages = pagesData.pages;

      // Apply any caption and camera angle edits, normalize field names
      const pagesWithEdits = dbPages.map((p: any) => {
        const edited = editedPages.find(ep => ep.pageNumber === p.page_number);
        return {
          ...p,
          caption: edited?.caption || p.caption,
          cameraAngle: edited?.cameraAngle || p.camera_angle || 'medium shot' // Apply edits first, then DB, then fallback
        };
      });

      setPages(pagesWithEdits.map((p: any) => ({
        index: p.page_number - 1,
        caption: p.caption,
        prompt: p.prompt,
        cameraAngle: p.cameraAngle,
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
          cameraAngle: pagesWithEdits[0].cameraAngle,
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
        // Check for cancellation
        if (stopGenerationRef.current) {
          console.log('Generation stopped by user');

          // Update story status in database to 'complete' (partial generation is still valid)
          try {
            const supabase = getSupabaseBrowser();
            if (supabase) {
              await supabase.from('stories').update({
                status: 'complete',
                current_step: null
              }).eq('id', storyId);
            }
          } catch (e) {
            console.warn('Failed to update story status on stop:', e);
          }

          setWorkflowState('complete'); // Go to complete state with partial pages
          setCurrentStep('Generation stopped');
          return;
        }

        const page = pagesWithEdits[i];
        setCurrentStep(`Illustrating page ${i + 1} of ${totalPages}...`);

        const characterReferences = chars
          .filter(c => c.referenceImage)
          .map(c => ({ name: c.name, referenceImage: c.referenceImage! }));

        try {
          const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storyId,
              pageIndex: i,
              caption: page.caption,
              stylePrompt: activeSession.settings.aestheticStyle,
              characterConsistency: activeSession.settings.characterConsistency,
              previousPages: generatedPages.slice(-2),
              characterReferences,
              qualityTier: activeSession.settings.qualityTier,
              aspectRatio: activeSession.settings.aspectRatio,
              enableSearchGrounding: activeSession.settings.enableSearchGrounding,
              cameraAngle: page.cameraAngle, // Story-driven camera angle from planning
            }),
            signal: abortControllerRef.current?.signal,
          });

          if (!generateResponse.ok) {
            // Log the error but continue to next page
            console.error(`Page ${i + 1} generation failed with status ${generateResponse.status}`);
            const failedPage: StoryPage = {
              index: i,
              caption: page.caption,
              prompt: page.prompt,
              cameraAngle: page.cameraAngle,
              imageUrl: '', // Empty signals failed generation
              warnings: [`Generation failed (HTTP ${generateResponse.status}) - click to retry`],
              status: 'failed',
            };
            generatedPages.push(failedPage);
            setPages(prev => {
              const newPages = [...prev];
              newPages[i] = failedPage;
              return newPages;
            });
            setProgress(50 + ((i + 1) / totalPages) * 45);
            continue; // Continue to next page instead of breaking
          }

          const { imageUrl, warnings } = await generateResponse.json();

          const newPage: StoryPage = {
            index: i,
            caption: page.caption,
            prompt: page.prompt,
            cameraAngle: page.cameraAngle,
            imageUrl,
            warnings,
          };

          generatedPages.push(newPage);
          setPages(prev => {
            const newPages = [...prev];
            newPages[i] = newPage;
            return newPages;
          });

          setProgress(50 + ((i + 1) / totalPages) * 45); // Leave room for consistency check
        } catch (err: unknown) {
          // Check if it was an abort
          if (err instanceof Error && err.name === 'AbortError') {
            console.log('Fetch aborted by user');
            return; // Exit the loop
          }
          // Log error and continue to next page instead of breaking entire generation
          console.error(`Page ${i + 1} generation error:`, err);
          const failedPage: StoryPage = {
            index: i,
            caption: page.caption,
            prompt: page.prompt,
            cameraAngle: page.cameraAngle,
            imageUrl: '', // Empty signals failed generation
            warnings: [`Generation failed - click to retry`],
            status: 'failed',
          };
          generatedPages.push(failedPage);
          setPages(prev => {
            const newPages = [...prev];
            newPages[i] = failedPage;
            return newPages;
          });
          setProgress(50 + ((i + 1) / totalPages) * 45);
          continue; // Continue to next page
        }
      }

      // Run consistency check if enabled (default: true)
      if (activeSession.settings.enableConsistencyCheck !== false) {
        await runConsistencyCheckAndFix(
          storyId,
          generatedPages,
          chars,
          (pageIndex, newImageUrl) => {
            // Progressive UI update - user sees page refresh
            setPages(prev => {
              const updated = [...prev];
              updated[pageIndex] = { ...updated[pageIndex], imageUrl: newImageUrl };
              return updated;
            });
          },
          3, // maxRetries
          activeSession // pass session override
        );
      }

      // Update story status in database to 'complete'
      try {
        const supabase = getSupabaseBrowser();
        if (supabase) {
          await supabase.from('stories').update({
            status: 'complete',
            current_step: null
          }).eq('id', storyId);
        }
      } catch (e) {
        console.warn('Failed to update story status to complete:', e);
      }

      setWorkflowState('complete');
      setCurrentStep('');
      setProgress(100);

    } catch (err) {
      console.error('Error generating pages:', err);

      // Update story status in database to 'error'
      try {
        const supabase = getSupabaseBrowser();
        if (supabase && storyIdRef.current) {
          await supabase.from('stories').update({
            status: 'error',
            current_step: err instanceof Error ? err.message : 'Failed to generate pages'
          }).eq('id', storyIdRef.current);
        }
      } catch (e) {
        console.warn('Failed to update story status to error:', e);
      }

      setError(err instanceof Error ? err.message : 'Failed to generate pages');
      setWorkflowState('error');
    }
  };

  // PHASE 4: Consistency Check & Auto-Fix
  // Pass sessionOverride when calling from auto-flow (React state may not be committed yet)
  const runConsistencyCheckAndFix = async (
    storyId: string,
    generatedPages: StoryPage[],
    chars: CharacterWithImage[],
    onPageFixed: (pageIndex: number, newImageUrl: string) => void,
    maxRetries: number = 3,
    sessionOverride?: BookSession
  ): Promise<number[]> => {
    const activeSession = sessionOverride || session;
    if (!activeSession) return [];

    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        setCurrentStep('Checking consistency...');
        setProgress(95);

        // 1. Analyze all pages
        const analysisResponse = await fetch(`/api/stories/${storyId}/consistency/analyze`, {
          method: 'POST'
        });

        if (!analysisResponse.ok) {
          throw new Error('Analysis failed');
        }

        const analysis: ConsistencyAnalysis = await analysisResponse.json();

        // 2. If no issues, we're done
        if (analysis.pagesNeedingRegeneration.length === 0) {
          console.log('Consistency check passed - no issues found');
          return [];
        }

        console.log(`Consistency check found ${analysis.issues.length} issues, fixing ${analysis.pagesNeedingRegeneration.length} pages`);

        // 3. Regenerate each problematic page
        const fixedPages: number[] = [];

        for (const pageNum of analysis.pagesNeedingRegeneration) {
          const pageIndex = pageNum - 1;
          const page = generatedPages[pageIndex];
          const issue = analysis.issues.find(i => i.pageNumber === pageNum);

          if (!page) continue;

          setCurrentStep(`Fixing page ${pageNum}...`);

          const characterReferences = chars
            .filter(c => c.referenceImage)
            .map(c => ({ name: c.name, referenceImage: c.referenceImage! }));

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storyId,
              pageIndex,
              caption: page.caption,
              stylePrompt: activeSession.settings.aestheticStyle,
              characterConsistency: true,
              characterReferences,
              previousPages: generatedPages.slice(Math.max(0, pageIndex - 2), pageIndex).map(p => ({
                index: p.index,
                imageUrl: p.imageUrl
              })),
              qualityTier: activeSession.settings.qualityTier,
              aspectRatio: activeSession.settings.aspectRatio,
              consistencyFix: issue?.fixPrompt,
              cameraAngle: page.cameraAngle, // Preserve story-driven camera angle
            })
          });

          if (response.ok) {
            const { imageUrl } = await response.json();
            onPageFixed(pageIndex, imageUrl);
            // Update the generatedPages array for subsequent fixes
            generatedPages[pageIndex] = { ...generatedPages[pageIndex], imageUrl };
            fixedPages.push(pageNum);
          }
        }

        return fixedPages;

      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          console.warn('Consistency check failed after retries, continuing without fixes');
          return [];
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    return [];
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Header variant="minimal" />
        <div className="editorial-loader">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }


  // Unified Story Preview state - also show during page generation for live preview
  if ((workflowState === 'story_preview' || workflowState === 'pages_generating') && planData && session) {
    return (
      <UnifiedStoryPreview
        planData={planData}
        characters={characters}
        storyTitle={session.title || session.fileName || 'Untitled Story'}
        onGenerateStorybook={handleGenerateStorybook}
        onRegeneratePlan={handlePlanRegenerate}
        onRerollCharacter={handleCharacterReroll}
        onStopGeneration={handleStopGeneration}
        isRegeneratingPlan={isRegenerating}
        isGeneratingCharacters={progress < 50 && characters.some(c => !c.referenceImage)}
        isGeneratingPages={workflowState === 'pages_generating'}
        currentStep={currentStep}
        progress={progress}
        generatedPages={pages}
      />
    );
  }


  // Main studio view (generating or complete)
  return (
    <div className="min-h-screen bg-background">
      <Header variant="minimal" />
      
      {isReading && session && (
        <Reader
          pages={pages}
          onClose={() => setIsReading(false)}
          title={session.title || session.fileName || 'My Story'}
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
                  {session?.title || session?.fileName || 'Untitled Story'}
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

      <div className="max-w-7xl mx-auto p-6">
        {/* Generation Progress - Editorial Style */}
        {(workflowState === 'plan_pending' || workflowState === 'characters_generating' || workflowState === 'pages_generating') && session && (
          <Card className="mb-8 editorial-card">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="editorial-loader">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div>
                    <h2 className="text-lg font-heading font-semibold">
                      {currentStep || 'Creating your storybook...'}
                    </h2>
                  </div>
                </div>
                {workflowState === 'pages_generating' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStopGeneration}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Stop
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <div
                  className="w-full bg-muted rounded-full h-1.5"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500 ease-smooth"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-right font-ui">
                  {Math.round(progress)}% complete
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {workflowState === 'error' && error && (
          <Card className="mb-8 border-l-3 border-l-destructive">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-foreground mb-2">
                    Generation Failed
                  </h3>
                  <p className="text-muted-foreground mb-4 font-body">{error}</p>
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Storyboard */}
        {session && workflowState === 'complete' && (
          <>
            <Storyboard
              pages={pages}
              characters={characters}
              settings={session.settings}
              onPageUpdate={handlePageUpdate}
              onPageReorder={handlePageReorder}
              isGenerating={false}
            />

            {/* Generation History - shows all steps that led to the final output */}
            {planData && (
              <GenerationHistory
                planData={planData}
                characters={characters}
                onRerollCharacter={handleCharacterReroll}
              />
            )}
          </>
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
