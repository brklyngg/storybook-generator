'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Upload, AlertTriangle, Loader2, CheckCircle, BookOpen } from 'lucide-react';
import { validateBookText } from '@/lib/safety';
import { parseTextFile } from '@/lib/text';
import type { BookSettings } from '@/lib/types';

import { Controls } from '@/components/Controls';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [settings, setSettings] = useState<BookSettings>({
    targetAge: 7,
    harshness: 3,
    aestheticStyle: 'Watercolor',
    freeformNotes: '',
    desiredPageCount: 20,
    characterConsistency: true,
    // Nano Banana Pro defaults
    qualityTier: 'standard-flash',
    aspectRatio: '2:3',
    enableSearchGrounding: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copyrightWarning, setCopyrightWarning] = useState<string | null>(null);

  const handleStorySearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!storyTitle.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCopyrightWarning(null);

    try {
      const response = await fetch('/api/story-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: storyTitle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find story');
      }

      setTextInput(data.content);
      setCopyrightWarning(data.copyrightStatus === 'Public Domain' ? null : `This story may be copyrighted (${data.copyrightStatus}). We will use a summary/adaptation.`);

    } catch (error: any) {
      console.error('Search error:', error);
      setSearchError(error.message || 'An unexpected error occurred while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const text = await parseTextFile(uploadedFile);
      setTextInput(text.substring(0, 10000));

      const copyrightCheck = await validateBookText(text);
      if (copyrightCheck.isProtected) {
        setCopyrightWarning(copyrightCheck.warning || 'This content may be copyrighted');
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    }
  }, []);

  const handleSubmit = async () => {
    if (!textInput.trim() && !file) {
      alert('Please provide a story first (search for a title or upload text)');
      return;
    }

    setIsProcessing(true);

    try {
      const sessionData = {
        sourceText: textInput,
        fileName: file?.name || storyTitle || 'Untitled Story',
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
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">

        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-display font-heading text-foreground max-w-3xl mx-auto">
            Storybook Generator
          </h1>
        </div>

        {/* Main Search Interface */}
        <div className="max-w-3xl mx-auto relative z-10 mb-12">
          <form
            onSubmit={handleStorySearch}
            className="relative flex items-center gap-3 bg-card rounded-xl border-2 border-border p-3 transition-smooth focus-within:border-primary focus-within:shadow-md"
          >
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <Input
              id="story-search"
              className="flex-1 border-none shadow-none focus-visible:ring-0 text-base h-12 bg-transparent"
              placeholder="Search for a classic tale (e.g., The Tortoise and the Hare)"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={isSearching}
              size="lg"
              className="rounded-lg px-6 h-11"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching
                </>
              ) : (
                'Search'
              )}
            </Button>
          </form>

          {/* Status Messages */}
          {searchError && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 text-red-900">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="text-sm"><strong>Search Failed:</strong> {searchError}</div>
            </div>
          )}

          {textInput && !showManualInput && (
            <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-center gap-3 text-green-900">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm">Story loaded! {textInput.length} characters ready.</span>
            </div>
          )}

          {copyrightWarning && (
            <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg flex items-start gap-3 text-yellow-900">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="text-sm"><strong>Copyright Notice:</strong> {copyrightWarning}</div>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="grid md:grid-cols-12 gap-8 items-start">
          {/* Settings Column */}
          <div className="md:col-span-8 space-y-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-semibold font-heading">
                  Book Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Controls
                  settings={settings}
                  onSettingsChange={setSettings}
                  disabled={isProcessing}
                />
              </CardContent>
            </Card>

            {/* Advanced Options (Upload/Paste) */}
            <div className="text-center">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors py-2"
              >
                {showManualInput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced: Upload file or paste text manually
              </button>

              {showManualInput && (
                <Card className="mt-4 border-dashed border-2 bg-transparent shadow-none animate-in fade-in slide-in-from-top-2">
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="file-upload" className="text-left block">Upload File (PDF/EPUB/TXT)</Label>
                        <div className="flex items-center justify-center w-full">
                          <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-3 text-gray-400" />
                              <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                            </div>
                            <Input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              accept=".pdf,.epub,.txt"
                              onChange={handleFileUpload}
                            />
                          </label>
                        </div>
                        {file && <p className="text-sm text-green-600 font-medium text-left">Selected: {file.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="text-input" className="text-left block">Paste Text Directly</Label>
                        <Textarea
                          id="text-input"
                          placeholder="Paste your story text here..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          className="h-32 resize-none"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar / CTA Column */}
          <div className="md:col-span-4 space-y-6">
            <Card className="bg-accent border-2 border-accent-foreground/20 shadow-lg">
              <CardHeader>
                <CardTitle className="font-heading">Create Your Book</CardTitle>
                <CardDescription>Review settings before generating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status indicators */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Story</span>
                    {textInput ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">Waiting</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Pages</span>
                    <span className="font-semibold">{settings.desiredPageCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Style</span>
                    <span className="font-semibold truncate max-w-[120px]">{settings.aestheticStyle}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || (!textInput.trim() && !file)}
                  size="lg"
                  className="w-full h-12"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Generate Book'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Popular Stories Card */}
            <Card className="bg-card border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Popular Stories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {['The Velveteen Rabbit', 'Alice in Wonderland', 'Peter Pan'].map((story) => (
                  <button
                    key={story}
                    onClick={() => { setStoryTitle(story); handleStorySearch(); }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-smooth flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {story}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}