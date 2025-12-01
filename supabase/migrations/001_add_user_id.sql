-- Migration: Add user_id to stories for user-owned content
-- This enables users to see their own stories when logged in

-- Add user_id column to stories table
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add title column if it doesn't exist
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS title text;

-- Add file_name column if it doesn't exist  
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS file_name text;

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);

-- Create index for recent stories query
CREATE INDEX IF NOT EXISTS idx_stories_user_created ON public.stories(user_id, created_at DESC);

-- Update RLS policies for proper user isolation
-- First, drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.stories;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.stories;

-- New policies: Users can see all stories (for now) but own their own
-- This allows anonymous users to still use the app while logged-in users get persistence

-- Anyone can read stories (we might restrict this later)
CREATE POLICY "Anyone can read stories" 
ON public.stories FOR SELECT 
USING (true);

-- Anyone can insert stories
CREATE POLICY "Anyone can create stories" 
ON public.stories FOR INSERT 
WITH CHECK (true);

-- Users can update their own stories, or stories with no owner
CREATE POLICY "Users can update own stories" 
ON public.stories FOR UPDATE 
USING (
    user_id IS NULL 
    OR user_id = auth.uid()
);

-- Users can delete their own stories
CREATE POLICY "Users can delete own stories"
ON public.stories FOR DELETE
USING (user_id = auth.uid());

