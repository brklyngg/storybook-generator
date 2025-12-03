'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, BookOpen } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
    variant?: 'default' | 'minimal';
}

export function Header({ variant = 'default' }: HeaderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [storiesCount, setStoriesCount] = useState<number | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const supabase = getSupabaseBrowser();

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchStoriesCount(session.user.id);
            }
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchStoriesCount(session.user.id);
            } else {
                setStoriesCount(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchStoriesCount = async (userId: string) => {
        if (!supabase) return;

        const { count } = await supabase
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        setStoriesCount(count ?? 0);
    };

    const handleLogin = async () => {
        if (!supabase) return;
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const handleLogout = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        router.refresh();
    };

    const isStudioPage = pathname?.startsWith('/studio');

    // Minimal variant for studio page
    if (variant === 'minimal' || isStudioPage) {
        return (
            <header className="fixed top-0 right-0 z-50 p-4">
                {!loading && (
                    user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-white/50 shadow-sm bg-white/80 backdrop-blur">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                            {user.email?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm  font-medium leading-none">{user.user_metadata.full_name}</p>
                                        <p className="text-xs leading-none text-muted-foreground ">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push('/my-stories')} className="">
                                    <BookOpen className="mr-2 h-4 w-4" />
                                    <span>My Stories</span>
                                    {storiesCount !== null && (
                                        <span className="ml-auto text-xs text-muted-foreground">{storiesCount}</span>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button onClick={handleLogin} variant="outline" size="sm" className="bg-white/80 backdrop-blur shadow-sm gap-2">
                            <GoogleIcon />
                            Sign in
                        </Button>
                    )
                )}
            </header>
        );
    }

    // Default header for home page
    return (
        <header className="sticky top-0 z-50 bg-gradient-to-b from-amber-50/95 to-amber-50/80 backdrop-blur-sm border-b border-amber-100/50">
            <div className="max-w-5xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Wordmark */}
                    <button
                        onClick={() => router.push('/')}
                        className="hover:opacity-70 transition-opacity"
                    >
                        <span className="font-heading font-bold text-xl text-foreground tracking-tight">
                            Storybook
                        </span>
                    </button>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {!loading && (
                            user ? (
                                <>
                                    {/* My Stories link */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push('/my-stories')}
                                        className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground "
                                    >
                                        My Stories
                                        {storiesCount !== null && storiesCount > 0 && (
                                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                                {storiesCount}
                                            </span>
                                        )}
                                    </Button>

                                    {/* User dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                                                    <AvatarImage src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name} />
                                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                        {user.email?.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56" align="end" forceMount>
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-sm  font-medium leading-none">{user.user_metadata.full_name}</p>
                                                    <p className="text-xs leading-none text-muted-foreground ">{user.email}</p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />

                                            {/* Freemium indicator - ready for subscription */}
                                            <div className="px-2 py-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">Stories created</span>
                                                    <span className="font-medium">{storiesCount ?? 0}</span>
                                                </div>
                                                <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${Math.min((storiesCount ?? 0) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Free tier • Unlimited during beta
                                                </p>
                                            </div>

                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => router.push('/my-stories')} className="sm:hidden ">
                                                <BookOpen className="mr-2 h-4 w-4" />
                                                <span>My Stories</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleLogout} className="">
                                                <LogOut className="mr-2 h-4 w-4" />
                                                <span>Log out</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            ) : (
                                <Button onClick={handleLogin} variant="outline" size="sm" className="gap-2 ">
                                    <GoogleIcon />
                                    <span className="hidden sm:inline">Sign in with Google</span>
                                    <span className="sm:hidden">Sign in</span>
                                </Button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

function GoogleIcon() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}
