'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageDetailsAccordion } from '@/components/PageDetailsAccordion';
import { PlanData, EditedPage, CharacterWithImage } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
    BookOpen,
    Users,
    FileText,
    Sparkles,
    User,
    ArrowRight,
    Loader2,
    Check,
    RefreshCw,
    MessageSquare,
    ImageIcon,
    Square
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { StoryPage } from '@/lib/types';

interface UnifiedStoryPreviewProps {
    planData: PlanData;
    characters: CharacterWithImage[];
    storyTitle: string;
    onGenerateStorybook: (editedPages: EditedPage[]) => void;
    onRegeneratePlan: () => void;
    onRerollCharacter: (characterId: string, feedback?: string) => void;
    onStopGeneration?: () => void;
    isRegeneratingPlan: boolean;
    isGeneratingCharacters: boolean;
    isGeneratingPages?: boolean;
    currentStep?: string;
    progress?: number;
    generatedPages?: StoryPage[];
}

export function UnifiedStoryPreview({
    planData,
    characters,
    storyTitle,
    onGenerateStorybook,
    onRegeneratePlan,
    onRerollCharacter,
    onStopGeneration,
    isRegeneratingPlan,
    isGeneratingCharacters,
    isGeneratingPages,
    currentStep,
    progress = 0,
    generatedPages = []
}: UnifiedStoryPreviewProps) {
    // Track edited pages locally
    const [editedPages, setEditedPages] = useState<EditedPage[]>(() =>
        planData.pages.map((p) => ({
            pageNumber: p.pageNumber,
            caption: p.caption,
            prompt: p.prompt,
            isModified: false,
        }))
    );

    // Track active tab
    const [activeTab, setActiveTab] = useState<string>('overview');

    // Track feedback state
    const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
    const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
    const [regeneratingChars, setRegeneratingChars] = useState<Record<string, boolean>>({});

    const handleRegenerateCharacter = (id: string) => {
        setRegeneratingChars(prev => ({ ...prev, [id]: true }));
        onRerollCharacter(id, feedbackMap[id]);
        // Note: Parent should handle resetting loading state via props or we just rely on image change?
        // Actually, better to just let the parent handle the async call and we can't easily know when it's done unless we track it.
        // For now, let's just set a timeout to clear the loading state as a fallback, 
        // but ideally the parent would pass down a "regeneratingIds" prop.
        // Since we don't have that yet, let's just rely on the image changing or a simple timeout for UX feedback.
        setTimeout(() => {
            setRegeneratingChars(prev => ({ ...prev, [id]: false }));
            setExpandedFeedback(null);
        }, 3000); // Fake timeout for immediate feedback, real loading happens in background
    };

    // Update when planData changes
    useEffect(() => {
        setEditedPages(
            planData.pages.map((p) => ({
                pageNumber: p.pageNumber,
                caption: p.caption,
                prompt: p.prompt,
                isModified: false,
            }))
        );
    }, [planData]);

    // Auto-switch to pages tab when page generation starts
    useEffect(() => {
        if (isGeneratingPages && activeTab !== 'pages') {
            setActiveTab('pages');
        }
    }, [isGeneratingPages]);

    const handleCaptionChange = (pageNumber: number, newCaption: string) => {
        setEditedPages((prev) =>
            prev.map((p) =>
                p.pageNumber === pageNumber
                    ? {
                        ...p,
                        caption: newCaption,
                        isModified: newCaption !== planData.pages.find((op) => op.pageNumber === pageNumber)?.caption,
                    }
                    : p
            )
        );
    };

    const modifiedCount = editedPages.filter((p) => p.isModified).length;
    const charactersWithImages = characters.filter(c => c.referenceImage);
    const totalCharacters = planData.characters.length;
    const characterProgress = Math.round((charactersWithImages.length / totalCharacters) * 100);

    // Get role badge color
    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'main':
                return 'bg-amber-100 text-amber-700 border-amber-300';
            case 'supporting':
                return 'bg-emerald-100 text-emerald-700 border-emerald-300';
            default:
                return 'bg-stone-100 text-stone-600 border-stone-300';
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 pb-20">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="font-heading text-xl sm:text-2xl font-bold text-stone-800 truncate max-w-[200px] sm:max-w-md">
                                {storyTitle}
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                                <span>{editedPages.length} Pages</span>
                                <span>•</span>
                                <span>{totalCharacters} Characters</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Progress Indicator - Characters */}
                            {isGeneratingCharacters && !isGeneratingPages && (
                                <div className="hidden sm:flex items-center gap-3 mr-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-amber-800">Generating Characters...</span>
                                        <span className="text-[10px] text-amber-600">{charactersWithImages.length}/{totalCharacters} ready</span>
                                    </div>
                                </div>
                            )}

                            {/* Progress Indicator - Pages (when auto-generating) */}
                            {isGeneratingPages ? (
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium text-emerald-800">
                                                {currentStep || 'Generating pages...'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-300"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-emerald-600">{Math.round(progress)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    {onStopGeneration && (
                                        <Button
                                            onClick={onStopGeneration}
                                            variant="outline"
                                            size="sm"
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <Square className="w-3 h-3 mr-1.5 fill-current" />
                                            Stop
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Button
                                    onClick={() => onGenerateStorybook(editedPages)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all hover:scale-105"
                                    size="lg"
                                    disabled={isGeneratingCharacters}
                                >
                                    Generate Storybook
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className={cn(
                        "grid w-full max-w-lg mx-auto sm:mx-0",
                        isGeneratingPages || generatedPages.length > 0 ? "grid-cols-3" : "grid-cols-2"
                    )}>
                        <TabsTrigger value="overview">Story Overview</TabsTrigger>
                        <TabsTrigger value="script">Script & Captions</TabsTrigger>
                        {(isGeneratingPages || generatedPages.length > 0) && (
                            <TabsTrigger value="pages" className="relative">
                                Pages
                                {isGeneratingPages && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                )}
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6 animate-in fade-in-50 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Story Arc */}
                            <div className="lg:col-span-1 space-y-6">
                                <Card className="border-l-4 border-l-amber-500 h-full">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <BookOpen className="w-5 h-5 text-amber-600" />
                                            Story Arc
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <ul className="space-y-3">
                                            {planData.storyArcSummary.map((bullet, index) => (
                                                <li key={index} className="flex items-start gap-3 text-stone-700 text-sm">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex items-center justify-center mt-0.5">
                                                        {index + 1}
                                                    </span>
                                                    <span className="leading-relaxed">{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {planData.theme && (
                                            <div className="pt-4 border-t border-stone-100">
                                                <div className="flex items-start gap-2 text-sm">
                                                    <Sparkles className="w-4 h-4 text-amber-500 mt-0.5" />
                                                    <div>
                                                        <span className="font-medium text-stone-600 block">Theme</span>
                                                        <span className="text-stone-700">{planData.theme}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="pt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={onRegeneratePlan}
                                                disabled={isRegeneratingPlan}
                                                className="w-full text-stone-500 hover:text-stone-700"
                                            >
                                                <RefreshCw className={cn("w-3 h-3 mr-2", isRegeneratingPlan && "animate-spin")} />
                                                Regenerate Story Plan
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Characters */}
                            <div className="lg:col-span-2">
                                <Card className="border-l-4 border-l-emerald-500 h-full">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Users className="w-5 h-5 text-emerald-600" />
                                                Cast of Characters
                                            </CardTitle>
                                            <Badge variant="secondary">
                                                {charactersWithImages.length} / {totalCharacters} Ready
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            Characters are being designed in the background. You can proceed anytime.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {characters.map((character) => (
                                                <div
                                                    key={character.id}
                                                    className={cn(
                                                        "group relative rounded-xl overflow-hidden border transition-all duration-300",
                                                        character.referenceImage
                                                            ? "border-stone-200 bg-white shadow-sm hover:shadow-md"
                                                            : "border-dashed border-stone-200 bg-stone-50"
                                                    )}
                                                >
                                                    {/* Image Area */}
                                                    <div className="aspect-square relative bg-stone-100 overflow-hidden">
                                                        {character.referenceImage ? (
                                                            <>
                                                                <img
                                                                    src={character.referenceImage}
                                                                    alt={character.name}
                                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                />
                                                                <div className="absolute top-2 right-2">
                                                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm animate-in zoom-in duration-300">
                                                                        <Check className="w-3 h-3 text-white" />
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                                                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                                                                <span className="text-xs text-stone-500 font-medium">Designing...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info Area */}
                                                    <div className="p-3">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <h4 className="font-semibold text-stone-800 text-sm truncate" title={character.name}>
                                                                {character.name}
                                                            </h4>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn('text-[10px] px-1.5 py-0 h-5 capitalize flex-shrink-0', getRoleBadgeClass(character.role))}
                                                            >
                                                                {character.role}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-stone-500 line-clamp-2 mb-3">
                                                            {character.description}
                                                        </p>

                                                        {/* Feedback / Regenerate Controls */}
                                                        {character.referenceImage && (
                                                            <div className="pt-2 border-t border-stone-100">
                                                                {expandedFeedback === character.id ? (
                                                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                                        <Textarea
                                                                            placeholder="Feedback (e.g. 'make hair darker')..."
                                                                            value={feedbackMap[character.id] || ''}
                                                                            onChange={(e) => setFeedbackMap(prev => ({ ...prev, [character.id]: e.target.value }))}
                                                                            className="text-xs min-h-[60px] resize-none"
                                                                        />
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => setExpandedFeedback(null)}
                                                                                className="flex-1 h-7 text-xs"
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleRegenerateCharacter(character.id)}
                                                                                disabled={regeneratingChars[character.id]}
                                                                                className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                                                                            >
                                                                                {regeneratingChars[character.id] ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    <>
                                                                                        <RefreshCw className="w-3 h-3 mr-1" />
                                                                                        Regenerate
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setExpandedFeedback(character.id)}
                                                                        className="w-full h-7 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                                                                    >
                                                                        <MessageSquare className="w-3 h-3 mr-1.5" />
                                                                        Refine / Regenerate
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="script" className="animate-in fade-in-50 duration-300">
                        <Card className="border-l-4 border-l-orange-500">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <FileText className="w-5 h-5 text-orange-600" />
                                        Story Script
                                    </CardTitle>
                                    {modifiedCount > 0 && (
                                        <Badge className="bg-amber-500 text-white">
                                            {modifiedCount} changes
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription>
                                    Review the text for each page. You can edit the captions if needed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PageDetailsAccordion
                                    pages={editedPages}
                                    onCaptionChange={handleCaptionChange}
                                    disabled={isRegeneratingPlan}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Live Pages Tab - Shows images as they generate */}
                    <TabsContent value="pages" className="animate-in fade-in-50 duration-300">
                        <Card className="border-l-4 border-l-emerald-500">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                                        Your Storybook
                                    </CardTitle>
                                    <Badge variant="secondary">
                                        {generatedPages.filter(p => p.imageUrl).length} / {editedPages.length} pages
                                    </Badge>
                                </div>
                                <CardDescription>
                                    {isGeneratingPages
                                        ? "Watch your storybook come to life! Pages appear as they're generated."
                                        : "Your completed storybook pages."
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {editedPages.map((page, index) => {
                                        const generatedPage = generatedPages[index];
                                        const hasImage = generatedPage?.imageUrl;

                                        return (
                                            <div
                                                key={page.pageNumber}
                                                className={cn(
                                                    "relative rounded-xl overflow-hidden border transition-all duration-500",
                                                    hasImage
                                                        ? "border-emerald-200 bg-white shadow-md"
                                                        : "border-dashed border-stone-200 bg-stone-50"
                                                )}
                                            >
                                                {/* Page number badge */}
                                                <div className="absolute top-2 left-2 z-10">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "text-[10px] px-1.5 py-0.5",
                                                            hasImage ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"
                                                        )}
                                                    >
                                                        Page {page.pageNumber}
                                                    </Badge>
                                                </div>

                                                {/* Image area */}
                                                <div className="aspect-[3/4] relative bg-stone-100">
                                                    {hasImage ? (
                                                        <img
                                                            src={generatedPage.imageUrl!}
                                                            alt={`Page ${page.pageNumber}`}
                                                            className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                                            {isGeneratingPages && index === generatedPages.filter(p => p.imageUrl).length ? (
                                                                <>
                                                                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin mb-2" />
                                                                    <span className="text-[10px] text-stone-500">Generating...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ImageIcon className="w-6 h-6 text-stone-300 mb-2" />
                                                                    <span className="text-[10px] text-stone-400">Waiting</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Caption preview */}
                                                <div className="p-2">
                                                    <p className="text-[10px] text-stone-600 line-clamp-2 leading-relaxed">
                                                        {page.caption}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
