
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: storyId } = await params;

    if (!supabase) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
        // Fetch story
        const { data: story, error: storyError } = await supabase
            .from('stories')
            .select('*')
            .eq('id', storyId)
            .single();

        if (storyError || !story) {
            return NextResponse.json({ error: 'Story not found' }, { status: 404 });
        }

        // Fetch characters
        const { data: characters, error: charError } = await supabase
            .from('characters')
            .select('*')
            .eq('story_id', storyId);

        if (charError) throw charError;

        // Fetch pages
        const { data: pages, error: pageError } = await supabase
            .from('pages')
            .select('*')
            .eq('story_id', storyId)
            .order('page_number', { ascending: true });

        if (pageError) throw pageError;

        return NextResponse.json({
            story,
            characters,
            pages
        });

    } catch (error: any) {
        console.error('Fetch story error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
