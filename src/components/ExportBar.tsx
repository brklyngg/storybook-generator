'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  FileText, 
  Archive,
  Loader2,
  CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StoryPage } from '@/lib/types';

interface ExportBarProps {
  pages: StoryPage[];
}

export function ExportBar({ pages }: ExportBarProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const handleExportPDF = async () => {
    if (pages.length === 0) return;

    setIsExporting('pdf');
    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages,
          title: 'AI Generated Picture Book',
          author: 'AI Generator',
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'picture-book.pdf';
      link.click();
      window.URL.revokeObjectURL(url);

      setExportSuccess('pdf');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportZIP = async () => {
    if (pages.length === 0) return;

    setIsExporting('zip');
    try {
      const response = await fetch('/api/export/zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages,
          title: 'picture-book',
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'picture-book.zip';
      link.click();
      window.URL.revokeObjectURL(url);

      setExportSuccess('zip');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('ZIP export error:', error);
      alert('Failed to export ZIP. Please try again.');
    } finally {
      setIsExporting(null);
    }
  };

  const getButtonIcon = (type: string) => {
    if (isExporting === type) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (exportSuccess === type) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return type === 'pdf' ? <FileText className="h-4 w-4" /> : <Archive className="h-4 w-4" />;
  };

  const isDisabled = pages.length === 0 || isExporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          disabled={isDisabled}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={handleExportPDF}
          disabled={isDisabled}
          className="cursor-pointer"
        >
          {getButtonIcon('pdf')}
          <span className="ml-2">Export as PDF</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleExportZIP}
          disabled={isDisabled}
          className="cursor-pointer"
        >
          {getButtonIcon('zip')}
          <span className="ml-2">Export as ZIP</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5 text-xs text-gray-500">
          Includes: {pages.length} pages, manifest.json, README
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}