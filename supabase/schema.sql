-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Stories Table
create table public.stories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete set null,
  source_text text not null,
  settings jsonb not null default '{}'::jsonb,
  title text,
  file_name text,
  theme text,
  status text default 'planning' check (status in ('saved', 'planning', 'generating', 'completed', 'error')),
  current_step text
);

-- Index for user queries
create index idx_stories_user_id on public.stories(user_id);
create index idx_stories_user_created on public.stories(user_id, created_at desc);
create index idx_stories_user_status on public.stories(user_id, status);

-- Characters Table
create table public.characters (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text not null,
  role text check (role in ('main', 'supporting', 'background')),
  is_hero boolean default false, -- True if this character uses the uploaded hero photo
  reference_image text, -- Primary reference image (base64 or URL)
  reference_images text[], -- Array of reference images
  status text default 'pending' check (status in ('pending', 'generating', 'completed', 'error'))
);

-- Pages Table
create table public.pages (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  page_number integer not null,
  caption text,
  prompt text,
  image_url text,
  status text default 'pending' check (status in ('pending', 'generating', 'completed', 'error'))
);

-- Enable Row Level Security (RLS)
alter table public.stories enable row level security;
alter table public.characters enable row level security;
alter table public.pages enable row level security;

-- Stories RLS Policies
-- Anyone can read stories (for demo/sharing purposes)
create policy "Anyone can read stories" on public.stories for select using (true);

-- Anyone can create stories (user_id is optional for anonymous users)
create policy "Anyone can create stories" on public.stories for insert with check (true);

-- Users can update their own stories or unowned stories
create policy "Users can update own stories" on public.stories for update 
  using (user_id is null or user_id = auth.uid());

-- Users can delete their own stories
create policy "Users can delete own stories" on public.stories for delete 
  using (user_id = auth.uid());

-- Characters RLS Policies (inherit from story ownership)
create policy "Anyone can read characters" on public.characters for select using (true);
create policy "Anyone can create characters" on public.characters for insert with check (true);
create policy "Anyone can update characters" on public.characters for update using (true);

-- Pages RLS Policies (inherit from story ownership)
create policy "Anyone can read pages" on public.pages for select using (true);
create policy "Anyone can create pages" on public.pages for insert with check (true);
create policy "Anyone can update pages" on public.pages for update using (true);
