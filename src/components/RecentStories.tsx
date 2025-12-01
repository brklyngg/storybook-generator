'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { 
    BookOpen, 
    ArrowRight, 
    Clock, 
    CheckCircle2, 
    Loader2,
    AlertCircle,
    Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@supabase/supabase-js';

interface RecentStory {
    id: string;
    title: string;
    file_name: string;
    created_at: string;
    status: string;
    theme: string | null;
    first_page_image?: string;
}

export function RecentStories() {
    const [user, setUser] = useState<User | null>(null);
    const [stories, setStories] = useState<RecentStory[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = getSupabaseBrowser();

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchRecentStories(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchRecentStories(session.user.id);
            } else {
                setStories([]);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchRecentStories = async (userId: string) => {
        if (!supabase) return;

        try {
            // First get recent stories
            const { data: storiesData, error } = await supabase
                .from('stories')
                .select('id, title, file_name, created_at, status, theme')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;

            // For each story, try to get the first page image
            const storiesWithImages = await Promise.all(
                (storiesData || []).map(async (story) => {
                    const { data: pageData } = await supabase
                        .from('pages')
                        .select('image_url')
                        .eq('story_id', story.id)
                        .eq('page_number', 1)
                        .single();

                    return {
                        ...story,
                        first_page_image: pageData?.image_url || null
                    };
                })
            );

            setStories(storiesWithImages);
        } catch (error) {
            console.error('Error fetching recent stories:', error);
        } finally {
            setLoading(false);
        }
    };

    // Don't show anything if not logged in or no stories
    if (!user || loading) return null;
    if (stories.length === 0) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
            case 'complete':
                return <CheckCircle2 className="h-3 w-3 text-green-600" />;
            case 'generating':
            case 'planning':
                return <Loader2 className="h-3 w-3 text-amber-600 animate-spin" />;
            case 'error':
                return <AlertCircle className="h-3 w-3 text-red-500" />;
            default:
                return <Clock className="h-3 w-3 text-muted-foreground" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed':
            case 'complete':
                return 'Complete';
            case 'generating':
                return 'Generating';
            case 'planning':
                return 'Planning';
            case 'error':
                return 'Error';
            default:
                return 'Draft';
        }
    };

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Your Recent Stories
                </h2>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => router.push('/my-stories')}
                    className="text-primary hover:text-primary/80 gap-1"
                >
                    See all
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stories.map((story) => (
                    <button
                        key={story.id}
                        onClick={() => router.push(`/studio?session=${story.id}`)}
                        className="group relative bg-card rounded-xl border border-border overflow-hidden text-left hover:border-primary/30 hover:shadow-md transition-all duration-200"
                    >
                        {/* Cover image or placeholder */}
                        <div className="aspect-[4/3] bg-gradient-to-br from-amber-100 to-orange-50 relative overflow-hidden">
                            {story.first_page_image ? (
                                <img 
                                    src={story.first_page_image}
                                    alt={story.title || story.file_name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="h-10 w-10 text-amber-300" />
                                </div>
                            )}
                            
                            {/* Status badge */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium">
                                {getStatusIcon(story.status)}
                                <span>{getStatusLabel(story.status)}</span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-3">
                            <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {story.title || story.file_name || 'Untitled Story'}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}

