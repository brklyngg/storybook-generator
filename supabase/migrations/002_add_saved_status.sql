-- Add 'saved' status to stories table for fetched stories that haven't been generated yet
-- This allows users to save public domain stories from web search to their library

-- Update the check constraint to include 'saved' status
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_status_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_status_check 
  CHECK (status IN ('saved', 'planning', 'generating', 'completed', 'error'));

-- Add index for finding saved stories efficiently
CREATE INDEX IF NOT EXISTS idx_stories_user_status ON public.stories(user_id, status);

