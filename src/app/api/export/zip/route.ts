import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { z } from 'zod';

const ExportRequestSchema = z.object({
  pages: z.array(z.object({
    index: z.number(),
    caption: z.string(),
    imageUrl: z.string(),
    prompt: z.string(),
  })),
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pages, title = 'picture-book' } = ExportRequestSchema.parse(body);

    const zip = new JSZip();
    
    const manifest = {
      title,
      generatedAt: new Date().toISOString(),
      pages: pages.length,
      pages_data: pages.map(page => ({
        index: page.index,
        caption: page.caption,
        prompt: page.prompt,
        filename: `page-${page.index + 1}.jpg`,
      })),
      metadata: {
        generator: 'AI Children\'s Picture Book Generator',
        version: '1.0.0',
        ai_model: 'gemini-2.5-flash (text) / gemini-2.5-flash-image or gemini-3-pro-image-preview (images)',
      },
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const readme = `# ${title}

This is an AI-generated children's picture book created with Gemini 2.0 Flash.

## Contents
- manifest.json: Book metadata and page information
- images/: Individual page illustrations
- captions.txt: All page captions

Generated on: ${new Date().toLocaleDateString()}
`;
    zip.file('README.md', readme);

    const captionsText = pages
      .map(page => `Page ${page.index + 1}: ${page.caption}`)
      .join('\n\n');
    zip.file('captions.txt', captionsText);

    const imagesFolder = zip.folder('images');
    
    for (const page of pages) {
      const placeholderImage = Buffer.from('placeholder-image-data');
      imagesFolder!.file(`page-${page.index + 1}.jpg`, placeholderImage);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${title}.zip"`,
      },
    });

  } catch (error) {
    console.error('ZIP export error:', error);
    return NextResponse.json(
      { error: 'Failed to export ZIP' },
      { status: 500 }
    );
  }
}