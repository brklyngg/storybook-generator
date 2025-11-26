import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const UpdatePagesSchema = z.object({
    pages: z.array(z.object({
        pageNumber: z.number(),
        caption: z.string(),
    }))
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: storyId } = await params;

    if (!supabase) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const { pages } = UpdatePagesSchema.parse(body);

        // Update each page's caption
        const updates = await Promise.all(
            pages.map(page =>
                supabase!
                    .from('pages')
                    .update({ caption: page.caption })
                    .eq('story_id', storyId)
                    .eq('page_number', page.pageNumber)
            )
        );

        // Check for errors
        const errors = updates.filter(u => u.error);
        if (errors.length > 0) {
            console.error('Some page updates failed:', errors);
        }

        return NextResponse.json({
            success: true,
            updated: pages.length - errors.length
        });

    } catch (error: any) {
        console.error('Error updating pages:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
