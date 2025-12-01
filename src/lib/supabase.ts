import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase credentials not found. Persistence will be disabled.');
}

export const supabase = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Story type for library dropdown
export interface Story {
    id: string;
    title: string;
    source_text: string;
    theme: string | null;
    created_at: string;
    status: string | null;
}

// Extract a title from the story text (first line or first ~50 chars)
export function extractTitle(sourceText: string): string {
    if (!sourceText) return 'Untitled Story';

    // Pattern 1: **Title** or *Title*
    const boldMatch = sourceText.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) return boldMatch[1].trim();

    const italicMatch = sourceText.match(/^\*([^*]+)\*/);
    if (italicMatch) return italicMatch[1].trim();

    // Pattern 2: "Title" at start
    const quoteMatch = sourceText.match(/^"([^"]+)"/);
    if (quoteMatch) return quoteMatch[1].trim();

    // Pattern 3: Title: or Chapter 1: etc
    const colonMatch = sourceText.match(/^([^:.\n]{5,50}):/);
    if (colonMatch) return colonMatch[1].trim();

    // Fallback: First line or first 50 characters
    const firstLine = sourceText.split('\n')[0].trim();
    if (firstLine.length <= 60) return firstLine;

    return firstLine.substring(0, 50).trim() + '...';
}

// Fetch all stories for the dropdown (unique titles only, most recent first)
// By default, fetches all stories including 'saved' ones
export async function fetchStories(options?: { includeSaved?: boolean; userId?: string }): Promise<Story[]> {
    if (!supabase) {
        console.warn('Supabase not configured');
        return [];
    }

    let query = supabase
        .from('stories')
        .select('id, title, source_text, theme, created_at, status')
        .order('created_at', { ascending: false });

    // Filter by user if provided
    if (options?.userId) {
        query = query.eq('user_id', options.userId);
    }

    // Optionally exclude 'saved' stories (stories that haven't been generated yet)
    if (options?.includeSaved === false) {
        query = query.neq('status', 'saved');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching stories:', error);
        return [];
    }

    // Deduplicate by title, keeping the most recent entry for each unique title
    const seenTitles = new Set<string>();
    const uniqueStories: Story[] = [];

    for (const story of data || []) {
        const title = story.title || extractTitle(story.source_text);
        if (!seenTitles.has(title)) {
            seenTitles.add(title);
            uniqueStories.push({ ...story, title });
        }
    }

    return uniqueStories;
}

// Fetch saved stories for a specific user (stories fetched from web search but not yet generated)
export async function fetchSavedStories(userId: string): Promise<Story[]> {
    if (!supabase) {
        console.warn('Supabase not configured');
        return [];
    }

    const { data, error } = await supabase
        .from('stories')
        .select('id, title, source_text, theme, created_at, status')
        .eq('user_id', userId)
        .eq('status', 'saved')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching saved stories:', error);
        return [];
    }

    return data || [];
}
