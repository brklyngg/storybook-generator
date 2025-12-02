-- Add camera_angle column to pages table
ALTER TABLE public.pages 
ADD COLUMN IF NOT EXISTS camera_angle text;

-- Add comment for documentation
COMMENT ON COLUMN public.pages.camera_angle IS 'Camera angle for the page illustration (e.g., wide shot, close-up, aerial)';

