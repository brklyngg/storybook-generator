-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Stories Table
create table public.stories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  source_text text not null,
  settings jsonb not null default '{}'::jsonb,
  theme text,
  status text default 'planning' check (status in ('planning', 'generating', 'completed', 'error')),
  current_step text
);

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

-- Create policies (Open for now, can be restricted later)
-- Allow anyone to read/write their own stories (identified by ID in local storage for now)
-- Ideally we'd use Supabase Auth, but for this "no-login" start, we'll allow public insert/select for demo purposes
-- or rely on the API to handle it with the Service Role key.

-- For Client-side access (if needed):
create policy "Enable read access for all users" on public.stories for select using (true);
create policy "Enable insert access for all users" on public.stories for insert with check (true);
create policy "Enable update access for all users" on public.stories for update using (true);

create policy "Enable read access for all users" on public.characters for select using (true);
create policy "Enable insert access for all users" on public.characters for insert with check (true);
create policy "Enable update access for all users" on public.characters for update using (true);

create policy "Enable read access for all users" on public.pages for select using (true);
create policy "Enable insert access for all users" on public.pages for insert with check (true);
create policy "Enable update access for all users" on public.pages for update using (true);
