import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sourceText, settings } = body;

        if (!supabase) {
            // Fallback for no-DB mode (should ideally not happen if we want persistence)
            // But for now, let's return a mock ID or error
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 503 }
            );
        }

        const { data, error } = await supabase
            .from('stories')
            .insert([
                {
                    source_text: sourceText,
                    settings: settings,
                    status: 'planning',
                    current_step: 'Initializing story...'
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Create story error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create story' },
            { status: 500 }
        );
    }
}
