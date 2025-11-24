'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BookSettings } from '@/lib/types';

interface ControlsProps {
  settings: BookSettings;
  onSettingsChange: (settings: BookSettings) => void;
  disabled?: boolean;
}

export function Controls({ settings, onSettingsChange, disabled = false }: ControlsProps) {
  const updateSetting = <K extends keyof BookSettings>(
    key: K,
    value: BookSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Calculate estimated cost based on quality tier and page count
  const calculateEstimatedCost = () => {
    const costPerImage = settings.qualityTier === 'standard-flash' ? 0.039 :
                         settings.qualityTier === 'premium-2k' ? 0.134 :
                         0.24; // premium-4k

    const imageCost = settings.desiredPageCount * costPerImage;
    const textCost = 0.02; // Planning cost
    const refCost = (settings.qualityTier !== 'standard-flash' ? 0.15 : 0.04); // Character reference generation

    return (imageCost + textCost + refCost).toFixed(2);
  };

  const getQualityDescription = (tier: string) => {
    switch (tier) {
      case 'standard-flash':
        return 'Fast generation, good quality for digital viewing';
      case 'premium-2k':
        return 'Superior character consistency, 2K resolution, print-ready';
      case 'premium-4k':
        return 'Professional print quality, 4K resolution, maximum detail';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="target-age">Target Age Group</Label>
        <Select
          value={settings.targetAge}
          onValueChange={(value: BookSettings['targetAge']) => updateSetting('targetAge', value)}
          disabled={disabled}
        >
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
        <Label>Content Intensity Level</Label>
        <div className="mt-2 px-3">
          <Slider
            value={[settings.harshness]}
            onValueChange={([value]) => updateSetting('harshness', value)}
            max={10}
            min={0}
            step={1}
            className="w-full"
            disabled={disabled}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Very Gentle</span>
            <span className="font-medium">{settings.harshness}</span>
            <span>Adventurous</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Controls how intense or challenging the story content will be
        </p>
      </div>

      <div>
        <Label htmlFor="aesthetic-style">Visual Art Style</Label>
        <Select
          value={settings.aestheticStyle.startsWith('Custom:') ? 'Custom' : settings.aestheticStyle}
          onValueChange={(value) => {
            if (value === 'Custom') {
              updateSetting('aestheticStyle', 'Custom: ');
            } else {
              updateSetting('aestheticStyle', value);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Watercolor">Watercolor</SelectItem>
            <SelectItem value="Paper Cutout">Paper Cutout</SelectItem>
            <SelectItem value="Pixar-style 3D">Pixar-style 3D</SelectItem>
            <SelectItem value="Classic Disney">Classic Disney</SelectItem>
            <SelectItem value="Abstract Shapes">Abstract Shapes</SelectItem>
            <SelectItem value="Custom">Custom...</SelectItem>
          </SelectContent>
        </Select>

        {settings.aestheticStyle.startsWith('Custom') && (
          <Input
            id="aesthetic-style-custom"
            value={settings.aestheticStyle.replace('Custom: ', '')}
            onChange={(e) => updateSetting('aestheticStyle', `Custom: ${e.target.value}`)}
            placeholder="Describe your custom style..."
            className="mt-2"
            disabled={disabled}
          />
        )}

        <p className="text-sm text-gray-600 mt-1">
          Choose the visual style for illustrations
        </p>
      </div>

      <div>
        <Label htmlFor="freeform-notes">Additional Creative Notes</Label>
        <Textarea
          id="freeform-notes"
          value={settings.freeformNotes}
          onChange={(e) => updateSetting('freeformNotes', e.target.value)}
          placeholder="Any specific themes, characters, or elements you'd like emphasized..."
          rows={3}
          className="mt-1"
          disabled={disabled}
        />
      </div>

      <div>
        <Label>Desired Page Count</Label>
        <div className="mt-2 px-3">
          <Slider
            value={[settings.desiredPageCount]}
            onValueChange={([value]) => updateSetting('desiredPageCount', value)}
            max={30}
            min={10}
            step={2}
            className="w-full"
            disabled={disabled}
          />
          <div className="text-center text-sm text-gray-600 mt-1">
            {settings.desiredPageCount} pages
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          More pages = more detailed story, fewer pages = simplified version
        </p>
      </div>

      {/* Nano Banana Pro Quality Settings */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Quality & Output Settings</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="quality-tier">Image Quality (Nano Banana Pro)</Label>
            <Select
              value={settings.qualityTier || 'standard-flash'}
              onValueChange={(value: BookSettings['qualityTier']) => updateSetting('qualityTier', value)}
              disabled={disabled}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard-flash">
                  <div className="flex flex-col">
                    <span className="font-medium">Standard (Flash)</span>
                    <span className="text-xs text-gray-500">~${(0.039 * settings.desiredPageCount + 0.06).toFixed(2)} total</span>
                  </div>
                </SelectItem>
                <SelectItem value="premium-2k">
                  <div className="flex flex-col">
                    <span className="font-medium">Premium 2K (Nano Banana Pro)</span>
                    <span className="text-xs text-gray-500">~${(0.134 * settings.desiredPageCount + 0.17).toFixed(2)} total</span>
                  </div>
                </SelectItem>
                <SelectItem value="premium-4k">
                  <div className="flex flex-col">
                    <span className="font-medium">Professional 4K (Nano Banana Pro)</span>
                    <span className="text-xs text-gray-500">~${(0.24 * settings.desiredPageCount + 0.26).toFixed(2)} total</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 mt-1">
              {getQualityDescription(settings.qualityTier || 'standard-flash')}
            </p>
          </div>

          <div>
            <Label htmlFor="aspect-ratio">Page Aspect Ratio</Label>
            <Select
              value={settings.aspectRatio || '1:1'}
              onValueChange={(value: BookSettings['aspectRatio']) => updateSetting('aspectRatio', value)}
              disabled={disabled}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">Square (1:1) - Classic book format</SelectItem>
                <SelectItem value="3:2">Standard (3:2) - Photo-like</SelectItem>
                <SelectItem value="16:9">Widescreen (16:9) - Cinematic</SelectItem>
                <SelectItem value="9:16">Portrait (9:16) - Mobile/Tall</SelectItem>
                <SelectItem value="21:9">Ultra-wide (21:9) - Panoramic</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 mt-1">
              Choose the shape of your book pages
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="character-consistency">Character Consistency</Label>
              <p className="text-sm text-gray-600">
                Use reference images to maintain character appearance
              </p>
            </div>
            <Switch
              id="character-consistency"
              checked={settings.characterConsistency}
              onCheckedChange={(checked) => updateSetting('characterConsistency', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="search-grounding">Fact-Checking (Google Search)</Label>
              <p className="text-sm text-gray-600">
                Verify accuracy of real-world elements (animals, places, etc.)
              </p>
            </div>
            <Switch
              id="search-grounding"
              checked={settings.enableSearchGrounding || false}
              onCheckedChange={(checked) => updateSetting('enableSearchGrounding', checked)}
              disabled={disabled}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-blue-900">Estimated Cost:</span>
              <span className="text-2xl font-bold text-blue-900">${calculateEstimatedCost()}</span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Based on {settings.desiredPageCount} pages at {settings.qualityTier === 'standard-flash' ? 'Standard' : settings.qualityTier === 'premium-2k' ? 'Premium 2K' : 'Professional 4K'} quality
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}