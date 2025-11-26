'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StoryPage } from '@/lib/types';

interface ReaderProps {
    pages: StoryPage[];
    onClose: () => void;
    title?: string;
}

export function Reader({ pages, onClose, title = 'Storybook' }: ReaderProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    // Hide controls after inactivity
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const handleActivity = () => {
            setIsControlsVisible(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setIsControlsVisible(false), 3000);
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('touchstart', handleActivity);
        window.addEventListener('click', handleActivity);

        handleActivity(); // Initial call

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
            window.removeEventListener('click', handleActivity);
            clearTimeout(timeout);
        };
    }, []);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < pages.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const currentPage = pages[currentIndex];

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 text-white flex flex-col items-center justify-center overflow-hidden">
            {/* Top Bar */}
            <div className={cn(
                "absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-300 z-10",
                isControlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                <h2 className="text-lg font-medium text-white/90 drop-shadow-md">{title}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                    <X className="h-6 w-6" />
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-8" onClick={handleNext}>
                {/* Image Container */}
                <div className="relative flex-1 w-full min-h-0 flex items-center justify-center mb-6">
                    {currentPage.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={currentPage.imageUrl}
                            alt={`Page ${currentIndex + 1}`}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900 rounded-lg">
                            Generating illustration...
                        </div>
                    )}
                </div>

                {/* Caption Area */}
                <div className="w-full max-w-4xl mx-auto z-10">
                    <p className="text-xl md:text-2xl font-heading leading-relaxed text-center text-white">
                        {currentPage.caption}
                    </p>
                </div>
            </div>

            {/* Navigation Buttons (Desktop/Visible) */}
            <div className={cn(
                "absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 pointer-events-none transition-opacity duration-300",
                isControlsVisible ? "opacity-100" : "opacity-0"
            )}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white pointer-events-auto backdrop-blur-md"
                >
                    <ChevronLeft className="h-7 w-7" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNext}
                    disabled={currentIndex === pages.length - 1}
                    className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white pointer-events-auto backdrop-blur-md"
                >
                    <ChevronRight className="h-7 w-7" />
                </Button>
            </div>

            {/* Page Indicator */}
            <div className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-sm text-white/80 transition-opacity duration-300",
                isControlsVisible ? "opacity-100" : "opacity-0"
            )}>
                Page {currentIndex + 1} of {pages.length}
            </div>
        </div>
    );
}
