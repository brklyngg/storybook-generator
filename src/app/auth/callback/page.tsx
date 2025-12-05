'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

function AuthCallbackContent() {
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
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="editorial-loader mx-auto mb-4">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <p className="text-muted-foreground ">Signing you in...</p>
            </div>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="editorial-loader">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}

