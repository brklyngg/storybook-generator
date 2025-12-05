-- Add display_description and approximate_age columns to characters table
-- These fields provide story context for UI display, separate from the visual description used for image generation

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS display_description text;

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS approximate_age text;

COMMENT ON COLUMN public.characters.display_description IS 'Story role and character arc description shown to users in UI';
COMMENT ON COLUMN public.characters.approximate_age IS 'Character age for UI display (e.g., ~30s, young adult, child ~8)';
