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
    <div className="space-y-8">
      {/* HERO CHARACTER */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">Hero Character</h3>
        <div className="space-y-5">
          <div>
            <Label htmlFor="hero-upload">Upload Child's Photo (Optional)</Label>
            <div className="mt-2">
              <div className="flex items-center gap-4">
                {settings.customHeroImage ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group">
                    <img
                      src={settings.customHeroImage}
                      alt="Hero preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => updateSetting('customHeroImage', undefined)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="text-white text-xs font-medium">Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                    <span className="text-2xl text-muted-foreground">📷</span>
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    id="hero-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          updateSetting('customHeroImage', reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="cursor-pointer"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a clear photo to be the main character. Best results with a front-facing face.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STORY SETTINGS */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-4">Story Settings</h3>
        <div className="space-y-5">
          {/* Age */}
          <div>
            <Label htmlFor="target-age">Child's Age</Label>
            <Input
              id="target-age"
              type="number"
              min={3}
              max={18}
              value={settings.targetAge}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 7;
                // Clamp value between 3 and 18
                const clampedValue = Math.min(18, Math.max(3, value));
                updateSetting('targetAge', clampedValue);
              }}
              onBlur={(e) => {
                // Ensure valid value on blur
                const value = parseInt(e.target.value) || 7;
                const clampedValue = Math.min(18, Math.max(3, value));
                if (value !== clampedValue) {
                  updateSetting('targetAge', clampedValue);
                }
              }}
              className="mt-1"
              disabled={disabled}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter your child's age (3-18 years)
            </p>
          </div>

          {/* Intensity */}
          <div>
            <Label>Intensity</Label>
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
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Gentle</span>
                <span className="font-medium">{settings.harshness}</span>
                <span>Maximum Intensity</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Level 10 = most intense imagery appropriate for the specified age
            </p>
          </div>
        </div>
      </div>

      {/* VISUAL STYLE */}
      <div className="border-t border-border pt-8">
        <h3 className="text-base font-semibold text-foreground mb-4">Visual Style</h3>
        <div className="space-y-5">
          {/* Art Style */}
          <div>
            <Label htmlFor="aesthetic-style">Art Style</Label>
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
          </div>

          {/* Creative Notes */}
          <div>
            <Label htmlFor="freeform-notes">Creative Notes</Label>
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
        </div>
      </div>

      {/* TECHNICAL SETTINGS */}
      <div className="border-t border-border pt-8">
        <h3 className="text-base font-semibold text-foreground mb-4">Technical Settings</h3>
        <div className="space-y-5">
          {/* Page Count */}
          <div>
            <Label>Page Count</Label>
            <div className="mt-2 px-3">
              <Slider
                value={[settings.desiredPageCount]}
                onValueChange={([value]) => updateSetting('desiredPageCount', value)}
                max={30}
                min={5}
                step={1}
                className="w-full"
                disabled={disabled}
              />
              <div className="text-center text-sm text-muted-foreground mt-1">
                {settings.desiredPageCount} pages
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              More pages = more detailed story, fewer pages = simplified version
            </p>
          </div>

          {/* Image Quality */}
          <div>
            <Label htmlFor="quality-tier">Image Quality</Label>
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
                    <span className="text-xs text-muted-foreground">~${(0.039 * settings.desiredPageCount + 0.06).toFixed(2)} total</span>
                  </div>
                </SelectItem>
                <SelectItem value="premium-2k">
                  <div className="flex flex-col">
                    <span className="font-medium">Premium 2K</span>
                    <span className="text-xs text-muted-foreground">~${(0.134 * settings.desiredPageCount + 0.17).toFixed(2)} total</span>
                  </div>
                </SelectItem>
                <SelectItem value="premium-4k">
                  <div className="flex flex-col">
                    <span className="font-medium">Professional 4K</span>
                    <span className="text-xs text-muted-foreground">~${(0.24 * settings.desiredPageCount + 0.26).toFixed(2)} total</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {getQualityDescription(settings.qualityTier || 'standard-flash')}
            </p>
          </div>

          {/* Character Consistency */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="character-consistency">Character Consistency</Label>
              <p className="text-sm text-muted-foreground">
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

          {/* Search Grounding */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="search-grounding">Fact-Checking (Google Search)</Label>
              <p className="text-sm text-muted-foreground">
                Verify accuracy of real-world elements
              </p>
            </div>
            <Switch
              id="search-grounding"
              checked={settings.enableSearchGrounding || false}
              onCheckedChange={(checked) => updateSetting('enableSearchGrounding', checked)}
              disabled={disabled}
            />
          </div>

          {/* Character Review Checkpoint */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="character-review-checkpoint">Review Characters Before Generating</Label>
              <p className="text-sm text-muted-foreground">
                Pause to approve character designs and style before creating all pages
              </p>
            </div>
            <Switch
              id="character-review-checkpoint"
              checked={settings.enableCharacterReviewCheckpoint || false}
              onCheckedChange={(checked) => updateSetting('enableCharacterReviewCheckpoint', checked)}
              disabled={disabled}
            />
          </div>

          {/* Auto Consistency Check */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="consistency-check">Auto-fix Consistency Issues</Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect and fix character inconsistencies after generation
              </p>
            </div>
            <Switch
              id="consistency-check"
              checked={settings.enableConsistencyCheck !== false}
              onCheckedChange={(checked) => updateSetting('enableConsistencyCheck', checked)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* COST ESTIMATE */}
      <div className="border-t border-border pt-6">
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">Estimated Cost</span>
            <span className="text-3xl font-bold font-heading">${calculateEstimatedCost()}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Based on {settings.desiredPageCount} pages at {settings.qualityTier === 'standard-flash' ? 'Standard' : settings.qualityTier === 'premium-2k' ? 'Premium 2K' : 'Professional 4K'} quality
          </p>
        </div>
      </div>
    </div>
  );
}
