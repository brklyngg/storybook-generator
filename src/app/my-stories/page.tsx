'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    BookOpen, 
    Plus, 
    Clock, 
    CheckCircle2,
    AlertCircle,
    Trash2,
    MoreVertical,
    Sparkles,
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

            // Fetch first page images and page counts
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

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'completed':
            case 'complete':
                return { 
                    icon: <CheckCircle2 className="h-4 w-4" />, 
                    label: 'Complete',
                    className: 'bg-green-100 text-green-700'
                };
            case 'generating':
                return { 
                    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
                    label: 'Generating',
                    className: 'bg-amber-100 text-amber-700'
                };
            case 'planning':
                return { 
                    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
                    label: 'Planning',
                    className: 'bg-blue-100 text-blue-700'
                };
            case 'error':
                return { 
                    icon: <AlertCircle className="h-4 w-4" />, 
                    label: 'Error',
                    className: 'bg-red-100 text-red-700'
                };
            default:
                return { 
                    icon: <Clock className="h-4 w-4" />, 
                    label: 'Draft',
                    className: 'bg-gray-100 text-gray-700'
                };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-stone-50">
                <Header />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-stone-50">
            <Header />
            
            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-foreground">My Stories</h1>
                        <p className="text-muted-foreground mt-1">
                            {stories.length === 0 
                                ? "You haven't created any stories yet" 
                                : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} created`
                            }
                        </p>
                    </div>
                    <Button onClick={() => router.push('/')} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create New Story
                    </Button>
                </div>

                {/* Empty State */}
                {stories.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-12 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                            <BookOpen className="h-10 w-10 text-primary" />
                        </div>
                        <h2 className="text-xl font-heading font-semibold mb-2">Create your first picture book</h2>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Transform any story into a beautifully illustrated children's book. 
                            Paste a story, upload a file, or search for a classic tale.
                        </p>
                        <Button onClick={() => router.push('/')} size="lg" className="gap-2">
                            <Sparkles className="h-5 w-5" />
                            Start Creating
                        </Button>
                    </div>
                ) : (
                    /* Stories Grid */
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stories.map((story) => {
                            const statusConfig = getStatusConfig(story.status);
                            
                            return (
                                <div
                                    key={story.id}
                                    className="group bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-200"
                                >
                                    {/* Cover Image */}
                                    <button
                                        onClick={() => router.push(`/studio?session=${story.id}`)}
                                        className="block w-full aspect-[4/3] bg-gradient-to-br from-amber-100 to-orange-50 relative overflow-hidden"
                                    >
                                        {story.first_page_image ? (
                                            <img 
                                                src={story.first_page_image}
                                                alt={story.title || story.file_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Sparkles className="h-12 w-12 text-amber-300" />
                                            </div>
                                        )}
                                        
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-lg">
                                                Open <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </button>

                                    {/* Content */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-foreground truncate">
                                                    {story.title || story.file_name || 'Untitled Story'}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
                                                </div>
                                            </div>

                                            {/* Actions dropdown */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/studio?session=${story.id}`)}>
                                                        <BookOpen className="mr-2 h-4 w-4" />
                                                        Open
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => setDeleteDialog({ open: true, story })}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Metadata row */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                                {statusConfig.icon}
                                                {statusConfig.label}
                                            </div>
                                            {story.page_count && story.page_count > 0 && (
                                                <span className="text-xs text-muted-foreground">
                                                    {story.page_count} pages
                                                </span>
                                            )}
                                        </div>

                                        {/* Theme if available */}
                                        {story.theme && (
                                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                                {story.theme}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, story: open ? deleteDialog.story : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Story</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deleteDialog.story?.title || deleteDialog.story?.file_name || 'this story'}"? 
                            This action cannot be undone and all pages will be permanently removed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialog({ open: false, story: null })} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
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
