# Fix Summary: Database Constraint Violation

## Problem
When generating The Odyssey (or other complex stories), the app threw this error:
```
new row for relation "characters" violates check constraint "characters_role_check"
```

## Root Causes Identified

### 1. Missing Database Columns
The code was trying to insert `display_description` and `approximate_age` columns that didn't exist in the database.

**Files affected:**
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/src/app/api/stories/[id]/plan/route.ts` (lines 566-567, 589-590)

### 2. AI Generating Invalid Role Values
The AI was potentially generating role values like "protagonist", "antagonist", "minor", etc., but the database constraint only allows: `'main'`, `'supporting'`, `'background'`

**Database constraint location:**
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/supabase/schema.sql` (line 31)

## Fixes Applied

### ✅ Fix 1: Added Role Validation/Sanitization
Updated the plan route to normalize AI-generated role values before database insertion.

**File:** `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/src/app/api/stories/[id]/plan/route.ts` (lines 551-573)

**What it does:**
- Maps common AI-generated values to valid database values:
  - `protagonist`, `antagonist`, `hero`, `villain`, `major` → `main`
  - `secondary`, `minor`, `side` → `supporting`
  - `extra`, `crowd`, `unnamed` → `background`
- Falls back to `background` if the role is unrecognized

### ✅ Fix 2: Created Database Migration
Created migration to add missing columns to the `characters` table.

**File:** `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/supabase/migrations/005_add_character_display_fields.sql`

**Columns added:**
- `display_description` (text) - Story role and character arc description for UI display
- `approximate_age` (text) - Character age for UI display (e.g., "~30s", "young adult", "child ~8")

### ✅ Fix 3: Build Verification
Verified that the Next.js app builds successfully with the changes:
```bash
npm run build
```
✅ Build passed with no errors

## Action Required: Apply Database Migration

⚠️ **You must apply the database migration manually** using the Supabase dashboard.

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/ecmlnmdgjvhhzqpodqhr/editor

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "+ New query"

3. **Run Migration SQL**
   - Copy and paste the following SQL:

```sql
-- Add display_description and approximate_age columns to characters table
-- These fields provide story context for UI display, separate from the visual description used for image generation

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS display_description text;

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS approximate_age text;

COMMENT ON COLUMN public.characters.display_description IS 'Story role and character arc description shown to users in UI';
COMMENT ON COLUMN public.characters.approximate_age IS 'Character age for UI display (e.g., ~30s, young adult, child ~8)';
```

4. **Execute Migration**
   - Click "Run" to execute the migration

5. **Verify**
   - Go to "Table Editor" > "characters" table
   - Verify that `display_description` and `approximate_age` columns now exist

## Testing

After applying the migration:

1. **Restart the dev server** (if running):
   ```bash
   npm run dev
   ```

2. **Test generating a storybook:**
   - Try generating "The Odyssey" again
   - The error should no longer occur
   - Characters should be properly saved with their role, display description, and approximate age

## Files Changed

### Modified Files:
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/src/app/api/stories/[id]/plan/route.ts`
  - Added role validation/sanitization (lines 551-573)

### New Files Created:
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/supabase/migrations/005_add_character_display_fields.sql`
  - Database migration to add missing columns
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/run-migration.js`
  - Helper script to apply migration (RPC not available, manual application required)
- `/Users/garygurevich/Documents/Vibe Coding/Storybook Generator/apply-migration-direct.sh`
  - Shell script showing migration SQL and instructions

## Expected Outcome

After applying the migration and restarting the dev server:
- ✅ No more `characters_role_check` constraint violations
- ✅ Characters saved with valid roles (`main`, `supporting`, `background`)
- ✅ Characters have display descriptions for UI
- ✅ Characters have approximate ages for UI
- ✅ Complex stories like "The Odyssey" generate successfully

## Technical Details

### Database Schema Before:
```sql
create table public.characters (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text not null,
  role text check (role in ('main', 'supporting', 'background')),
  is_hero boolean default false,
  reference_image text,
  reference_images text[],
  status text default 'pending' check (status in ('pending', 'generating', 'completed', 'error'))
);
```

### Database Schema After Migration:
```sql
create table public.characters (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text not null,
  display_description text,  -- NEW: Story role for UI display
  approximate_age text,       -- NEW: Character age for UI display
  role text check (role in ('main', 'supporting', 'background')),
  is_hero boolean default false,
  reference_image text,
  reference_images text[],
  status text default 'pending' check (status in ('pending', 'generating', 'completed', 'error'))
);
```

---

**Status:** ✅ Code fixes applied | ⚠️ Database migration pending manual application
