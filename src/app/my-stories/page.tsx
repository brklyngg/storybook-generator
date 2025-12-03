'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import {
    BookOpen,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    Trash2,
    MoreVertical,
    ArrowRight
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@supabase/supabase-js';

interface Story {
    id: string;
    title: string;
    file_name: string;
    created_at: string;
    status: string;
    theme: string | null;
    settings: any;
    first_page_image?: string;
    page_count?: number;
}

export default function MyStoriesPage() {
    const router = useRouter();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; story: Story | null }>({ open: false, story: null });
    const [deleting, setDeleting] = useState(false);

    const supabase = getSupabaseBrowser();

    useEffect(() => {
        if (!supabase) {
            router.push('/');
            return;
        }

        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/');
                return;
            }
            setUser(session.user);
            fetchStories(session.user.id);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push('/');
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    const fetchStories = async (userId: string) => {
        if (!supabase) return;

        try {
            const { data: storiesData, error } = await supabase
                .from('stories')
                .select('id, title, file_name, created_at, status, theme, settings')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const storiesWithDetails = await Promise.all(
                (storiesData || []).map(async (story) => {
                    const [{ data: pageData }, { count }] = await Promise.all([
                        supabase
                            .from('pages')
                            .select('image_url')
                            .eq('story_id', story.id)
                            .eq('page_number', 1)
                            .single(),
                        supabase
                            .from('pages')
                            .select('*', { count: 'exact', head: true })
                            .eq('story_id', story.id)
                    ]);

                    return {
                        ...story,
                        first_page_image: pageData?.image_url || null,
                        page_count: count || 0
                    };
                })
            );

            setStories(storiesWithDetails);
        } catch (error) {
            console.error('Error fetching stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!supabase || !deleteDialog.story) return;

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', deleteDialog.story.id);

            if (error) throw error;

            setStories(prev => prev.filter(s => s.id !== deleteDialog.story!.id));
            setDeleteDialog({ open: false, story: null });
        } catch (error) {
            console.error('Error deleting story:', error);
        } finally {
            setDeleting(false);
        }
    };

    const getStatusConfig = (story: Story) => {
        const hasGeneratedPages = story.first_page_image && story.page_count && story.page_count > 0;
        let effectiveStatus = story.status;
        if (hasGeneratedPages && (story.status === 'planning' || story.status === 'generating')) {
            effectiveStatus = 'complete';
        }

        switch (effectiveStatus) {
            case 'completed':
            case 'complete':
                return {
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                    label: 'Complete',
                    className: 'text-accent'
                };
            case 'generating':
            case 'planning':
                return {
                    icon: <div className="editorial-loader scale-75"><span></span><span></span><span></span></div>,
                    label: effectiveStatus === 'generating' ? 'Generating' : 'Planning',
                    className: 'text-muted-foreground'
                };
            case 'error':
                return {
                    icon: <AlertCircle className="h-3.5 w-3.5" />,
                    label: 'Error',
                    className: 'text-destructive'
                };
            default:
                return {
                    icon: <Clock className="h-3.5 w-3.5" />,
                    label: 'Draft',
                    className: 'text-muted-foreground'
                };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="editorial-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />

            <main className="max-w-5xl mx-auto px-6 py-12">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
                    <div>
                        <h1 className="text-display text-foreground">Your Library</h1>
                        <p className="text-muted-foreground font-body mt-2">
                            {stories.length === 0
                                ? "No stories yet"
                                : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`
                            }
                        </p>
                    </div>
                    <Button
                        onClick={() => router.push('/')}
                        variant="ghost"
                        className="gap-2 font-ui text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="h-4 w-4" />
                        New Story
                    </Button>
                </div>

                {/* Empty State */}
                {stories.length === 0 ? (
                    <div className="editorial-card p-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="font-heading text-xl font-semibold mb-3">Create your first book</h2>
                        <p className="text-muted-foreground font-body mb-8 max-w-sm mx-auto">
                            Transform any story into a beautifully illustrated picture book
                        </p>
                        <Button
                            onClick={() => router.push('/')}
                            size="lg"
                            className="bg-accent hover:bg-accent/90 text-accent-foreground font-ui"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    /* Stories Grid */
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stories.map((story) => {
                            const statusConfig = getStatusConfig(story);

                            return (
                                <div
                                    key={story.id}
                                    className="group bg-card rounded-lg border border-border overflow-hidden hover-lift"
                                >
                                    {/* Cover Image */}
                                    <button
                                        onClick={() => router.push(`/studio?session=${story.id}`)}
                                        className="block w-full aspect-[4/3] bg-secondary relative overflow-hidden"
                                    >
                                        {story.first_page_image ? (
                                            <img
                                                src={story.first_page_image}
                                                alt={story.title || story.file_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                                            </div>
                                        )}

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
                                    </button>

                                    {/* Content */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-heading font-semibold text-foreground truncate">
                                                    {story.title || story.file_name || 'Untitled'}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-ui">
                                                    <span>{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</span>
                                                    {story.page_count && story.page_count > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{story.page_count} pages</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/studio?session=${story.id}`)} className="font-ui">
                                                        <BookOpen className="mr-2 h-4 w-4" />
                                                        Open
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteDialog({ open: true, story })}
                                                        className="text-destructive focus:text-destructive font-ui"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Status indicator - only for non-complete states */}
                                        {(statusConfig.label === 'Generating' || statusConfig.label === 'Planning' || statusConfig.label === 'Error') && (
                                            <div className={`flex items-center gap-2 mt-3 pt-3 border-t border-border text-xs font-ui ${statusConfig.className}`}>
                                                {statusConfig.icon}
                                                <span>{statusConfig.label}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Delete Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, story: open ? deleteDialog.story : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-heading">Delete Story</DialogTitle>
                        <DialogDescription className="font-body">
                            Are you sure you want to delete "{deleteDialog.story?.title || deleteDialog.story?.file_name || 'this story'}"?
                            This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteDialog({ open: false, story: null })} disabled={deleting} className="font-ui">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="font-ui">
                            {deleting ? (
                                <div className="flex items-center gap-2">
                                    <div className="editorial-loader scale-75">
                                        <span className="!bg-destructive-foreground"></span>
                                        <span className="!bg-destructive-foreground"></span>
                                        <span className="!bg-destructive-foreground"></span>
                                    </div>
                                    <span>Deleting...</span>
                                </div>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
