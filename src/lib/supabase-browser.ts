'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Browser-side Supabase client for auth and user-specific queries
// Uses anon key (safe for client) + RLS for security

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
    if (browserClient) return browserClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase credentials not found');
        return null;
    }

    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    return browserClient;
}

