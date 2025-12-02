'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function AuthCallback() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handleAuthCallback = async () => {
            const supabase = getSupabaseBrowser();
            if (!supabase) {
                console.error('Supabase client not available');
                router.push('/');
                return;
            }

            const code = searchParams.get('code');
            const next = searchParams.get('next') ?? '/';

            if (code) {
                try {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        console.error('Auth exchange error:', error);
                    }
                } catch (err) {
                    console.error('Auth exchange failed:', err);
                }
            }

            // Redirect to home (or next page)
            router.push(next);
        };

        handleAuthCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-amber-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Signing you in...</p>
            </div>
        </div>
    );
}

