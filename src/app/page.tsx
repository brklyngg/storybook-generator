'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, AlertTriangle, Loader2, CheckCircle, FileText } from 'lucide-react';
import { validateBookText } from '@/lib/safety';
import { parseTextFile } from '@/lib/text';
import type { BookSettings } from '@/lib/types';

import { StorySelector } from '@/components/StorySelector';

// Art style options with icons
const ART_STYLES = [
  { id: 'Watercolor', label: 'Watercolor', icon: '🎨' },
  { id: 'Pixar-style 3D', label: 'Pixar 3D', icon: '✨' },
  { id: 'Paper Cutout', label: 'Paper Cutout', icon: '📄' },
  { id: 'Classic Disney', label: 'Classic Disney', icon: '🏰' },
  { id: 'Studio Ghibli', label: 'Studio Ghibli', icon: '🌸' },
  { id: 'Bold Cartoon', label: 'Bold Cartoon', icon: '💫' },
];

// Intensity tiers
const INTENSITY_TIERS = [
  { id: 'gentle', label: 'Gentle', value: 3 },
  { id: 'standard', label: 'Standard', value: 5 },
  { id: 'intense', label: 'Intense', value: 8 },
];

function StepNumber({ number }: { number: number }) {
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
      {number}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [textInput, setTextInput] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState<BookSettings>({
    targetAge: 7,
    harshness: 5, // "Standard" tier
    aestheticStyle: 'Watercolor',
    freeformNotes: '',
    desiredPageCount: 10,
    characterConsistency: true,
    qualityTier: 'premium-2k', // Hidden, always premium
    aspectRatio: '2:3',
    enableSearchGrounding: false,
    enableCharacterReviewCheckpoint: false,
    enableConsistencyCheck: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyrightWarning, setCopyrightWarning] = useState<string | null>(null);

  // Get current intensity tier
  const currentIntensityTier = INTENSITY_TIERS.find(t => t.value === settings.harshness) || INTENSITY_TIERS[1];

  // Word count
  const wordCount = textInput.trim() ? textInput.trim().split(/\s+/).length : 0;

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStoryTitle(uploadedFile.name.replace(/\.[^/.]+$/, ''));

    try {
      const text = await parseTextFile(uploadedFile);
      setTextInput(text.substring(0, 10000));

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
      const sessionData = {
        sourceText: textInput,
        fileName: storyTitle || 'Untitled Story',
        title: storyTitle || 'Untitled Story',
        settings,
        timestamp: Date.now(),
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <span>Regs Version</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
            AI-Powered Picture Books
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Paste your story or upload a file, and our AI will create stunning, consistent illustrations for every page of your children's book.
          </p>
        </div>

        {/* Main Form */}
        <div className="space-y-8">

          {/* STEP 1: Your Story */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <StepNumber number={1} />
              <h2 className="text-lg font-semibold font-heading">Your Story</h2>
            </div>

            <div className="space-y-4">
              {/* Story Selector */}
              <div className="flex items-center gap-3">
                <StorySelector
                  onSelect={(text, title) => {
                    setTextInput(text);
                    setStoryTitle(title);
                    setCopyrightWarning(null);
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {wordCount.toLocaleString()} words
                </span>
              </div>

              {/* Text Area */}
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your story here..."
                rows={6}
                className="resize-none"
              />

              {/* File Upload */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2">
                    {file ? (
                      <>
                        <FileText className="h-8 w-8 text-primary" />
                        <span className="text-sm font-medium text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">Click to replace</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Upload a story file</span>
                        <span className="text-xs text-muted-foreground">Drop a .txt file or click to browse</span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* Status Messages */}
              {copyrightWarning && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 text-yellow-800 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{copyrightWarning}</span>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2: Book Settings */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <StepNumber number={2} />
              <h2 className="text-lg font-semibold font-heading">Book Settings</h2>
            </div>

            <div className="space-y-6">
              {/* Reader Age */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Reader Age</label>
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
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">years</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Adjusts vocabulary and themes</p>
              </div>

              {/* Page Count */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Page Count</label>
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
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">pages</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">5-30 pages available</p>
              </div>

              {/* Story Intensity */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Story Intensity</label>
                <div className="flex gap-2">
                  {INTENSITY_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSettings({ ...settings, harshness: tier.value })}
                      className={`
                        flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all
                        ${settings.harshness === tier.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: Art Style */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <StepNumber number={3} />
              <h2 className="text-lg font-semibold font-heading">Art Style</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSettings({ ...settings, aestheticStyle: style.id })}
                  className={`
                    flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                    ${settings.aestheticStyle === style.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'
                    }
                  `}
                >
                  <span className="text-2xl mb-1">{style.icon}</span>
                  <span className="text-xs font-medium text-foreground">{style.label}</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Style prompt: {settings.aestheticStyle.toLowerCase()} children's book illustration, soft and whimsical, gentle brush strokes
            </p>
          </section>

          {/* STEP 4: Personalize */}
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <StepNumber number={4} />
              <h2 className="text-lg font-semibold font-heading">Personalize</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Optional</span>
            </div>

            <div className="space-y-4">
              {/* Hero Photo Upload */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Add hero photo</label>
                <p className="text-xs text-muted-foreground mb-3">
                  Optional: Upload a face photo for the main character
                </p>

                <div className="flex items-center gap-4">
                  {settings.customHeroImage ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group">
                      <img
                        src={settings.customHeroImage}
                        alt="Hero preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setSettings({ ...settings, customHeroImage: undefined })}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="text-white text-xs font-medium">Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                      <span className="text-2xl">👤</span>
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
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Personalize Story Notes */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Personalize your story</label>
                <Textarea
                  value={settings.freeformNotes}
                  onChange={(e) => setSettings({ ...settings, freeformNotes: e.target.value })}
                  placeholder="Add any special details, names, or themes..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-primary hover:underline"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              </button>

              {showAdvanced && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Advanced options are pre-configured for optimal results:
                  </p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Image Quality: Premium 2K</li>
                    <li>• Character Consistency: Enabled</li>
                    <li>• Auto-fix Consistency: Enabled</li>
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !textInput.trim()}
            size="lg"
            className="w-full h-14 text-lg font-semibold"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Picture Book'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Generation takes 12-20 minutes for a 10-page book
          </p>

          {/* Footer Info */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
            <span>Gemini 3 Pro</span>
            <span>•</span>
            <span>~$2.85/book</span>
          </div>
        </div>
      </div>
    </div>
  );
}
