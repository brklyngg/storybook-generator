-- Add scene awareness to pages table for clothing consistency
-- Scene grouping allows characters to have consistent outfits within a scene,
-- but different outfits between scenes (for epic tales spanning years)

ALTER TABLE public.pages
ADD COLUMN scene_id text;

ALTER TABLE public.pages
ADD COLUMN scene_outfits jsonb;

COMMENT ON COLUMN public.pages.scene_id IS 'Scene identifier for grouping consecutive pages (e.g., scene_1_trojan_camp)';
COMMENT ON COLUMN public.pages.scene_outfits IS 'Character outfits for this scene as JSON (e.g., {"Odysseus": "bronze armor, red cape"})';
