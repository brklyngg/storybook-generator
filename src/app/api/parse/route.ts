import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ParseRequestSchema = z.object({
  fileType: z.enum(['pdf', 'epub', 'txt']),
  content: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileType, content } = ParseRequestSchema.parse(body);
    
    const buffer = Buffer.from(content, 'base64');
    let extractedText = '';

    switch (fileType) {
      case 'pdf':
        try {
          const unpdf = await import('unpdf') as any;
          const getTextFromPdf = unpdf.default?.getTextFromPdf || unpdf.getTextFromPdf;
          const { text } = await getTextFromPdf(buffer);
          extractedText = text;
        } catch (error) {
          console.error('PDF parsing error:', error);
          return NextResponse.json(
            { error: 'Failed to parse PDF file' },
            { status: 400 }
          );
        }
        break;

      case 'epub':
        return NextResponse.json(
          { error: 'EPUB parsing temporarily unavailable - please use PDF or TXT files' },
          { status: 400 }
        );

      case 'txt':
        extractedText = buffer.toString('utf-8');
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported file type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      text: extractedText,
      wordCount: extractedText.split(/\s+/).length,
    });

  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse file' },
      { status: 500 }
    );
  }
}