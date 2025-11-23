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
    </div>
  );
}