'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, Calendar, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Story {
    id: string;
    file_name: string;
    created_at: string;
    status: string;
    theme: string;
    settings: any;
}

export default function MyStoriesPage() {
    const router = useRouter();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (!supabase) return;

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
    }, [router]);

    const fetchStories = async (userId: string) => {
        if (!supabase) return;

        try {
            const { data, error } = await supabase
                .from('stories')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStories(data || []);
        } catch (error) {
            console.error('Error fetching stories:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-12">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-heading font-bold">My Stories</h1>
                    <Button onClick={() => router.push('/')} variant="outline">
                        Create New Story
                    </Button>
                </div>

                {stories.length === 0 ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No stories yet</h3>
                            <p className="text-muted-foreground mb-6">
                                You haven't generated any stories yet. Start your first adventure!
                            </p>
                            <Button onClick={() => router.push('/')}>
                                Create Story
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stories.map((story) => (
                            <Card key={story.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/studio?session=${story.id}`)}>
                                <CardHeader>
                                    <CardTitle className="truncate font-heading text-lg">
                                        {story.file_name || 'Untitled Story'}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-2 text-xs">
                                        <Calendar className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Status</span>
                                            <span className={`font-medium ${story.status === 'complete' ? 'text-green-600' :
                                                    story.status === 'error' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {story.status.charAt(0).toUpperCase() + story.status.slice(1)}
                                            </span>
                                        </div>
                                        {story.theme && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                                {story.theme}
                                            </p>
                                        )}
                                        <div className="pt-4 flex justify-end">
                                            <Button variant="ghost" size="sm" className="group-hover:translate-x-1 transition-transform">
                                                Open <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
