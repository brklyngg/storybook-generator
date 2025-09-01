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
import { Upload, BookOpen, Sparkles, AlertTriangle } from 'lucide-react';
import { validateBookText } from '@/lib/safety';
import { parseTextFile } from '@/lib/text';
import type { BookSettings } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [settings, setSettings] = useState<BookSettings>({
    targetAge: '6-8',
    harshness: 3,
    aestheticStyle: 'warm watercolor, soft edges, gentle steampunk motifs, intricate beautiful backgrounds',
    freeformNotes: '',
    desiredPageCount: 20,
    characterConsistency: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyrightWarning, setCopyrightWarning] = useState<string | null>(null);

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
      alert('Please provide either text or upload a file');
      return;
    }

    setIsProcessing(true);

    try {
      const sessionData = {
        sourceText: textInput,
        fileName: file?.name,
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900">AI Children's Picture Book Generator</h1>
          </div>
          <p className="text-lg text-gray-600">
            Transform any story into a beautifully illustrated children's picture book
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Story Input
              </CardTitle>
              <CardDescription>
                Upload a text file (PDF, EPUB, TXT) or paste your story
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Upload File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.epub,.txt"
                  onChange={handleFileUpload}
                  className="mt-1"
                />
              </div>
              
              <div className="text-center text-gray-500">or</div>
              
              <div>
                <Label htmlFor="text-input">Paste Text</Label>
                <Textarea
                  id="text-input"
                  placeholder="Paste your story here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={8}
                  className="mt-1"
                />
              </div>

              {copyrightWarning && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <strong>Copyright Notice:</strong> {copyrightWarning}
                    <br />
                    Please ensure you have rights to use this content.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Book Settings
              </CardTitle>
              <CardDescription>
                Customize your children's book generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Target Age Group</Label>
                <Select value={settings.targetAge} onValueChange={(value: any) => 
                  setSettings(prev => ({ ...prev, targetAge: value }))
                }>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3-5">Ages 3-5 (Toddlers)</SelectItem>
                    <SelectItem value="6-8">Ages 6-8 (Early Readers)</SelectItem>
                    <SelectItem value="9-12">Ages 9-12 (Middle Grade)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Content Intensity (0 = Very Gentle, 10 = More Adventurous)</Label>
                <div className="mt-2 px-3">
                  <Slider
                    value={[settings.harshness]}
                    onValueChange={([value]) => 
                      setSettings(prev => ({ ...prev, harshness: value }))
                    }
                    max={10}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Very Gentle</span>
                    <span className="font-medium">{settings.harshness}</span>
                    <span>Adventurous</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="aesthetic-style">Visual Style</Label>
                <Input
                  id="aesthetic-style"
                  value={settings.aestheticStyle}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, aestheticStyle: e.target.value }))
                  }
                  placeholder="e.g., warm watercolor, soft edges..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="freeform-notes">Additional Notes</Label>
                <Textarea
                  id="freeform-notes"
                  value={settings.freeformNotes}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, freeformNotes: e.target.value }))
                  }
                  placeholder="Any specific requests or themes..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Desired Page Count</Label>
                <div className="mt-2 px-3">
                  <Slider
                    value={[settings.desiredPageCount]}
                    onValueChange={([value]) => 
                      setSettings(prev => ({ ...prev, desiredPageCount: value }))
                    }
                    max={30}
                    min={10}
                    step={2}
                    className="w-full"
                  />
                  <div className="text-center text-sm text-gray-600 mt-1">
                    {settings.desiredPageCount} pages
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="character-consistency">Character Consistency</Label>
                <Switch
                  id="character-consistency"
                  checked={settings.characterConsistency}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, characterConsistency: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || (!textInput.trim() && !file)}
            size="lg"
            className="px-8"
          >
            {isProcessing ? 'Processing...' : 'Create Picture Book'}
          </Button>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Try the Example</CardTitle>
            <CardDescription>
              See how "The Time Machine" by H.G. Wells becomes a children's book
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Settings:</strong>
                <br />Age: 6-8
                <br />Intensity: 3/10
              </div>
              <div>
                <strong>Style:</strong>
                <br />Warm watercolor, soft edges, gentle steampunk motifs
              </div>
              <div>
                <strong>Result:</strong>
                <br />~20 pages with consistent main character in tan coat & goggles
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}