'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Upload, AlertTriangle, FileText, CheckCircle, ArrowRight } from 'lucide-react';
import { validateBookText } from '@/lib/safety';
import { parseTextFile } from '@/lib/text';
import type { BookSettings } from '@/lib/types';

import { Header } from '@/components/Header';
import { RecentStories } from '@/components/RecentStories';
import { LoginBanner } from '@/components/LoginBanner';
import { StorySelector } from '@/components/StorySelector';
import { StorySearch } from '@/components/StorySearch';

// Art styles - editorial cards, no emojis
const ART_STYLES = [
  { id: 'Watercolor', label: 'Watercolor', description: 'Soft, flowing brushstrokes' },
  { id: 'Pixar-style 3D', label: 'Pixar 3D', description: 'Dimensional, expressive characters' },
  { id: 'Paper Cutout', label: 'Paper Cutout', description: 'Layered, tactile textures' },
  { id: 'Classic Disney', label: 'Classic Disney', description: 'Timeless animated style' },
  { id: 'Studio Ghibli', label: 'Studio Ghibli', description: 'Dreamy, detailed worlds' },
  { id: 'Bold Cartoon', label: 'Bold Cartoon', description: 'Vibrant, graphic style' },
];

export default function HomePage() {
  const router = useRouter();
  const [textInput, setTextInput] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<BookSettings>({
    targetAge: 7,
    harshness: 5,
    aestheticStyle: 'Watercolor',
    freeformNotes: '',
    desiredPageCount: 10,
    characterConsistency: true,
    qualityTier: 'premium-2k',
    aspectRatio: '2:3',
    enableSearchGrounding: false,
    enableConsistencyCheck: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyrightWarning, setCopyrightWarning] = useState<string | null>(null);

  // Check if text is stored as a localStorage reference (large file)
  const isLargeTextRef = textInput.startsWith('__LARGE_TEXT_REF__');

  // For large text refs, we can't easily count words in React state
  // Show a placeholder message instead
  const wordCount = textInput.trim()
    ? (isLargeTextRef ? 0 : textInput.trim().split(/\s+/).length)
    : 0;

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStoryTitle(uploadedFile.name.replace(/\.[^/.]+$/, ''));

    try {
      const text = await parseTextFile(uploadedFile);

      // For very large texts (500K+), store in localStorage to avoid React state bloat
      const LARGE_TEXT_THRESHOLD = 100_000;
      if (text.length > LARGE_TEXT_THRESHOLD) {
        const textId = `upload_${Date.now()}`;
        localStorage.setItem(`largeText_${textId}`, text);
        setTextInput(`__LARGE_TEXT_REF__${textId}`);
        console.log(`📦 Large text (${text.length.toLocaleString()} chars) stored in localStorage: ${textId}`);
      } else {
        setTextInput(text);
      }

      const copyrightCheck = await validateBookText(text);
      if (copyrightCheck.isProtected) {
        setCopyrightWarning(copyrightCheck.warning || 'This content may be copyrighted');
      } else {
        setCopyrightWarning(null);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.txt')) {
      const fakeEvent = {
        target: { files: [droppedFile] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(fakeEvent);
    }
  }, [handleFileUpload]);

  const handleSubmit = async () => {
    if (!textInput.trim()) {
      alert('Please provide a story first');
      return;
    }

    setIsProcessing(true);

    try {
      // Handle large text references - keep them in localStorage separately
      let sourceTextForSession = textInput;
      let isLargeText = false;

      if (textInput.startsWith('__LARGE_TEXT_REF__')) {
        // Keep the reference as-is, don't retrieve the full text yet
        // StudioClient will retrieve it when needed
        isLargeText = true;
        console.log(`📦 Keeping large text reference for session: ${textInput}`);
      }

      const sessionData = {
        sourceText: sourceTextForSession,
        fileName: storyTitle || 'Untitled Story',
        title: storyTitle || 'Untitled Story',
        settings,
        timestamp: Date.now(),
        isLargeText,
      };

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(sessionId, JSON.stringify(sessionData));

      router.push(`/studio?session=${sessionId}`);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section - Editorial Style */}
      <div className="pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-display text-foreground mb-6">
            Transform any story into illustrated magic
          </h1>
          <p className="text-editorial-lg text-muted-foreground max-w-xl mx-auto">
            Create beautifully illustrated children's picture books with AI-powered consistency and style.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pb-16">
        {/* Recent Stories */}
        <RecentStories />

        {/* Login Banner */}
        <LoginBanner />

        <div className="space-y-12">

          {/* Story Input Section */}
          <section>
            <h2 className="text-label text-accent mb-6">Your Story</h2>

            <div className="space-y-6">
              {/* Story Search */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Search for a classic story
                </label>
                <StorySearch
                  onStoryFound={(text, title, metadata) => {
                    setTextInput(text);
                    setStoryTitle(title);
                    setCopyrightWarning(metadata?.isPublicDomain === false
                      ? 'This story may be under copyright.'
                      : null
                    );
                  }}
                />
              </div>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-xs text-muted-foreground uppercase tracking-wider">
                    Or upload your own
                  </span>
                </div>
              </div>

              {/* Library Selector + Status */}
              <div className="flex items-center gap-4">
                <StorySelector
                  onSelect={(text, title) => {
                    setTextInput(text);
                    setStoryTitle(title);
                    setCopyrightWarning(null);
                  }}
                />
                {(wordCount > 0 || isLargeTextRef) && (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    {isLargeTextRef ? 'Large story loaded' : `${wordCount.toLocaleString()} words`}
                  </span>
                )}
              </div>

              {/* Story Preview or Input */}
              {textInput ? (
                <div className="editorial-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-heading font-semibold text-foreground">
                      {storyTitle || 'Story loaded'}
                    </h3>
                    <button
                      onClick={() => {
                        setTextInput('');
                        setStoryTitle('');
                        setFile(null);
                        setCopyrightWarning(null);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground font-body line-clamp-3 leading-relaxed">
                    {isLargeTextRef
                      ? 'Full story text loaded and ready for processing. Large texts are summarized using AI to capture the complete narrative arc.'
                      : `${textInput.substring(0, 300)}...`
                    }
                  </p>
                </div>
              ) : (
                <>
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your story text here..."
                    rows={5}
                    className="font-body  resize-none"
                  />

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="border border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors cursor-pointer"
                  >
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-3">
                        {file ? (
                          <>
                            <FileText className="h-5 w-5 text-accent" />
                            <span className="text-sm font-medium text-foreground">{file.name}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Drop a .txt file or click to upload</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* Copyright Warning */}
              {copyrightWarning && (
                <div className="flex items-start gap-3 p-4 bg-destructive/5 border-l-2 border-l-destructive rounded-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground/80 font-body">{copyrightWarning}</span>
                </div>
              )}
            </div>
          </section>

          {/* Settings Grid */}
          <section>
            <h2 className="text-label text-accent mb-6">Book Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Reader Age
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={3}
                    max={18}
                    value={settings.targetAge}
                    onChange={(e) => {
                      const value = Math.min(18, Math.max(3, parseInt(e.target.value) || 7));
                      setSettings({ ...settings, targetAge: value });
                    }}
                    className="w-20 text-center "
                  />
                  <span className="text-sm text-muted-foreground">years old</span>
                </div>
              </div>

              {/* Page Count */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Page Count
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={settings.desiredPageCount}
                    onChange={(e) => {
                      const value = Math.min(30, Math.max(5, parseInt(e.target.value) || 10));
                      setSettings({ ...settings, desiredPageCount: value });
                    }}
                    className="w-20 text-center "
                  />
                  <span className="text-sm text-muted-foreground">pages</span>
                </div>
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-foreground mb-4">
                Story Intensity
              </label>
              <div className="px-1">
                <Slider
                  value={[settings.harshness]}
                  onValueChange={([value]) => setSettings({ ...settings, harshness: value })}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Gentle</span>
                  <span className="font-medium text-foreground">{settings.harshness}</span>
                  <span>Intense</span>
                </div>
              </div>
            </div>
          </section>

          {/* Art Style Section */}
          <section>
            <h2 className="text-label text-accent mb-6">Art Style</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSettings({ ...settings, aestheticStyle: style.id })}
                  className={`
                    p-4 rounded-lg border text-left transition-all
                    ${settings.aestheticStyle === style.id
                      ? 'border-accent bg-accent/5 shadow-sm'
                      : 'border-border hover:border-accent/40'
                    }
                  `}
                >
                  <span className="block font-medium text-foreground text-sm mb-1">
                    {style.label}
                  </span>
                  <span className="block text-xs text-muted-foreground font-body">
                    {style.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Personalization Section */}
          <section>
            <h2 className="text-label text-accent mb-6">
              Personalize <span className="text-muted-foreground font-normal">(optional)</span>
            </h2>

            <div className="space-y-6">
              {/* Hero Photo */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Hero character photo
                </label>
                <div className="flex items-center gap-4">
                  {settings.customHeroImage ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                      <img
                        src={settings.customHeroImage}
                        alt="Hero"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setSettings({ ...settings, customHeroImage: undefined })}
                        className="absolute inset-0 bg-foreground/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="text-background text-xs">Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center bg-secondary">
                      <span className="text-muted-foreground text-xl">+</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSettings({ ...settings, customHeroImage: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Story notes
                </label>
                <Textarea
                  value={settings.freeformNotes}
                  onChange={(e) => setSettings({ ...settings, freeformNotes: e.target.value })}
                  placeholder="Names, themes, or special details to include..."
                  rows={2}
                  className="font-body  resize-none"
                />
              </div>
            </div>
          </section>

          {/* Generate Button */}
          <div className="pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !textInput.trim()}
              size="lg"
              className="w-full h-14 text-lg font-semibold bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isProcessing ? (
                <div className="flex items-center gap-3">
                  <div className="editorial-loader">
                    <span className="!bg-accent-foreground"></span>
                    <span className="!bg-accent-foreground"></span>
                    <span className="!bg-accent-foreground"></span>
                  </div>
                  <span>Creating...</span>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  Create Your Book
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Premium 2K quality • ~$2.85 per book • 12-20 minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
