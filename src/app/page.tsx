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
import { Upload, BookOpen, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
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
    targetAge: '6-8',
    harshness: 3,
    aestheticStyle: 'Watercolor',
    freeformNotes: '',
    desiredPageCount: 20,
    characterConsistency: true,
    // Nano Banana Pro defaults
    qualityTier: 'standard-flash',
    aspectRatio: '1:1',
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">

        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16 space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4">
            <BookOpen className="h-8 w-8 text-primary mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-green-600">
              Storybook Generator
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 tracking-tight leading-tight">
            BOOKS BOOKS BOOKS
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light">
            Transform any idea or classic tale into a beautifully illustrated picture book in seconds.
          </p>
        </div>

        {/* Main Search Interface */}
        <div className="max-w-3xl mx-auto relative z-10 mb-12">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-green-600 rounded-full opacity-20 group-hover:opacity-30 blur transition duration-200" />
            <form
              onSubmit={handleStorySearch}
              className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100 p-2 transition-all focus-within:ring-4 focus-within:ring-green-100 focus-within:border-primary/50"
            >
              <Search className="h-6 w-6 text-gray-400 ml-4 flex-shrink-0" />
              <Input
                id="story-search"
                className="flex-1 border-none shadow-none focus-visible:ring-0 text-lg h-14 bg-transparent placeholder:text-gray-400"
                placeholder="What story do you want to tell? (e.g. The Tortoise and the Hare)"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                autoComplete="off"
              />
              <Button
                type="submit"
                disabled={isSearching}
                size="lg"
                className="rounded-full px-8 h-12 text-base font-medium shadow-md hover:shadow-lg transition-all relative z-10"
              >
                {isSearching ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    Find Story
                    <Sparkles className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Status Messages */}
          {searchError && (
            <div className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl flex items-start gap-3 text-red-800 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
              <div className="text-sm">
                <strong>Search Failed:</strong> {searchError}
              </div>
            </div>
          )}

          {textInput && !showManualInput && (
            <div className="mt-4 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-xl flex items-center justify-center text-green-800 animate-in fade-in slide-in-from-top-2">
              <Sparkles className="h-5 w-5 mr-2 text-green-600" />
              <span className="font-medium">Story loaded!</span>
              <span className="mx-2">•</span>
              <span className="opacity-80">{textInput.length} characters ready to adapt.</span>
            </div>
          )}

          {copyrightWarning && (
            <div className="mt-4 p-4 bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-xl flex items-start gap-3 text-yellow-800 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-600" />
              <div className="text-sm">
                <strong>Copyright Notice:</strong> {copyrightWarning}
              </div>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="grid md:grid-cols-12 gap-8 items-start">
          {/* Settings Column */}
          <div className="md:col-span-8 space-y-6">
            <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Customize Your Book
                </CardTitle>
                <CardDescription>
                  Tailor the experience for your young reader
                </CardDescription>
              </CardHeader>
              <CardContent>
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
            <Card className="bg-gradient-to-br from-primary to-green-700 text-white border-none shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

              <CardHeader>
                <CardTitle className="text-white">Ready to Create?</CardTitle>
                <CardDescription className="text-green-100">
                  Turn your settings into a full picture book.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-green-100">
                  <div className="flex justify-between">
                    <span>Story Source</span>
                    <span className="font-medium text-white">{textInput ? 'Ready' : 'Waiting...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pages</span>
                    <span className="font-medium text-white">{settings.desiredPageCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Style</span>
                    <span className="font-medium text-white truncate max-w-[120px]">{settings.aestheticStyle}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || (!textInput.trim() && !file)}
                  size="lg"
                  className="w-full bg-white text-primary hover:bg-gray-50 font-bold shadow-lg text-lg h-14"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Book
                      <Sparkles className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Example Card */}
            <Card className="bg-white/50 backdrop-blur-sm border-none shadow-lg">
              <CardHeader>
                <CardTitle className="text-base">Inspiration</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-3">
                <p>Try searching for:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => { setStoryTitle("The Velveteen Rabbit"); handleStorySearch(); }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    The Velveteen Rabbit
                  </li>
                  <li className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => { setStoryTitle("Alice in Wonderland"); handleStorySearch(); }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    Alice in Wonderland
                  </li>
                  <li className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => { setStoryTitle("Peter Pan"); handleStorySearch(); }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    Peter Pan
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}