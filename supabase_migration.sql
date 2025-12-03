-- Add user_id column to stories table
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see their own stories
CREATE POLICY "Users can view their own stories" 
ON stories FOR SELECT 
USING (auth.uid() = user_id);

-- Policy to allow users to insert their own stories
CREATE POLICY "Users can insert their own stories" 
ON stories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own stories
CREATE POLICY "Users can update their own stories" 
ON stories FOR UPDATE 
USING (auth.uid() = user_id);

-- OPTIONAL: Allow anonymous users to create stories (if you want to keep guest functionality)
-- Note: If you enforce RLS, guest users (anon) won't be able to see stories unless you add a policy for them.
-- For now, the app logic handles user_id as optional, but RLS might block it if not configured.
-- If you want guests to create stories but not see them later (or see them via session ID only if you add a policy for that):
CREATE POLICY "Guests can insert stories" 
ON stories FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow guests to select stories by ID (if they have the UUID) - this is a bit loose, usually you'd want a session token or similar.
-- For now, let's allow public read if you want shareable stories, OR restrict to owner.
-- If you want strictly private:
-- (The "Users can view their own stories" policy above handles it)

-- If you want to allow the API (service role) to do anything (it bypasses RLS by default), you don't need extra policies for it.

-- Migration: Add is_hero column to characters table (for hero photo feature)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS is_hero BOOLEAN DEFAULT false;

-- Migration: Add display_description and approximate_age columns for improved character UX
-- display_description: Story role description shown to users (e.g., "The proud king whose arrogance...")
-- approximate_age: Character's age for display (e.g., "~40s", "young adult")
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS display_description TEXT;

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS approximate_age TEXT;
