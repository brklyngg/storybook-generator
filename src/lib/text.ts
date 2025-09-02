export interface ParsedText {
  content: string;
  wordCount: number;
  language?: string;
  metadata?: {
    title?: string;
    author?: string;
    pageCount?: number;
  };
}

export async function parseTextFile(file: File): Promise<string> {
  const fileType = getFileType(file);
  
  try {
    switch (fileType) {
      case 'pdf':
        return await parsePdfFile(file);
      case 'epub':
        // EPUB parsing disabled due to client-side limitations
        throw new Error('EPUB parsing is currently not supported. Please use PDF or TXT files.');
      case 'txt':
        return await parseTextOnly(file);
      default:
        throw new Error(`Unsupported file type: ${file.type}`);
    }
  } catch (error) {
    console.error('Error parsing file:', error);
    throw new Error(`Failed to parse ${fileType.toUpperCase()} file`);
  }
}

function getFileType(file: File): 'pdf' | 'epub' | 'txt' {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (file.type === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  } else if (file.type === 'application/epub+zip' || extension === 'epub') {
    return 'epub';
  } else if (file.type === 'text/plain' || extension === 'txt') {
    return 'txt';
  }
  
  throw new Error('Unsupported file format');
}

async function parsePdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  
  try {
    const { getTextFromPdf } = await import('unpdf');
    const { text, totalPages } = await getTextFromPdf(buffer);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    return cleanExtractedText(text);
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

async function parseTextOnly(file: File): Promise<string> {
  const text = await file.text();
  
  if (!text || text.trim().length === 0) {
    throw new Error('The text file appears to be empty');
  }
  
  return cleanExtractedText(text);
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\w\s\n.,;:!?'"()-]/g, '')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .trim();
}

export function getTextStats(text: string) {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    characterCount: text.length,
    estimatedReadingTime: Math.ceil(words.length / 200),
  };
}

export function truncateText(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  
  return words.slice(0, maxWords).join(' ') + '...';
}

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).toLowerCase();
  
  if (/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/.test(sample)) {
    return 'en';
  } else if (/\b(le|la|les|de|du|des|et|ou|mais|dans|sur|à|pour|avec|par)\b/.test(sample)) {
    return 'fr';
  } else if (/\b(der|die|das|und|oder|aber|in|auf|an|zu|für|von|mit|durch)\b/.test(sample)) {
    return 'de';
  }
  
  return 'unknown';
}