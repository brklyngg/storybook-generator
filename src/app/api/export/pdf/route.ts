import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFImage } from 'pdf-lib';
import { z } from 'zod';

const ExportRequestSchema = z.object({
  pages: z.array(z.object({
    index: z.number(),
    caption: z.string(),
    imageUrl: z.string().optional(), // Optional - pages without images show placeholder
  })),
  title: z.string().optional(),
  author: z.string().optional(),
});

// iPad-optimized page dimensions (768 x 1024 points - standard iPad portrait)
const PAGE_WIDTH = 768;
const PAGE_HEIGHT = 1024;

// Beautiful layout constants
const MARGIN = 48;
const IMAGE_AREA_HEIGHT = 680; // Large area for the image
const CAPTION_AREA_TOP = PAGE_HEIGHT - IMAGE_AREA_HEIGHT - MARGIN - 40;

async function fetchImageWithRetry(url: string, retries = 3): Promise<{ data: Uint8Array; type: 'png' | 'jpeg' } | null> {
  // Handle Data URIs directly
  if (url.startsWith('data:')) {
    try {
      const matches = url.match(/^data:(image\/([a-z]+));base64,(.+)$/);
      if (!matches) return null;

      const mimeType = matches[1];
      const type = mimeType.includes('png') ? 'png' : 'jpeg';
      const base64Data = matches[3];
      const bytes = Buffer.from(base64Data, 'base64');

      return { data: bytes, type };
    } catch (error) {
      console.error('Failed to decode data URI:', error);
      return null;
    }
  }

  // Handle URLs
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'image/*',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Determine image type from content-type or magic bytes
      let type: 'png' | 'jpeg' = 'jpeg';

      if (contentType.includes('png')) {
        type = 'png';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        type = 'jpeg';
      } else {
        // Check magic bytes
        if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
          type = 'png';
        }
      }

      return { data, type };
    } catch (error) {
      console.error(`Image fetch attempt ${i + 1} failed:`, error);
      if (i === retries - 1) return null;
    }
  }
  return null;
}

async function embedImage(pdfDoc: PDFDocument, imageData: { data: Uint8Array; type: 'png' | 'jpeg' }): Promise<PDFImage | null> {
  try {
    if (imageData.type === 'png') {
      return await pdfDoc.embedPng(imageData.data);
    } else {
      return await pdfDoc.embedJpg(imageData.data);
    }
  } catch (error) {
    console.error('Failed to embed image:', error);
    return null;
  }
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pages, title = 'Picture Book', author = '' } = ExportRequestSchema.parse(body);

    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Colors - elegant palette
    const titleColor = rgb(0.15, 0.15, 0.15);
    const captionColor = rgb(0.2, 0.2, 0.2);
    const subtitleColor = rgb(0.45, 0.45, 0.45);
    const pageNumColor = rgb(0.6, 0.6, 0.6);
    const accentColor = rgb(0.75, 0.65, 0.55); // Warm sepia accent

    // ═══════════════════════════════════════════════════════════════
    // TITLE PAGE - Elegant and centered
    // ═══════════════════════════════════════════════════════════════
    const titlePage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Subtle background gradient effect using rectangles
    for (let i = 0; i < 5; i++) {
      const alpha = 0.02 - (i * 0.004);
      titlePage.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - (i * 50),
        width: PAGE_WIDTH,
        height: 50,
        color: rgb(0.95, 0.93, 0.90),
        opacity: alpha * 10,
      });
    }

    // Decorative line above title
    titlePage.drawRectangle({
      x: PAGE_WIDTH / 2 - 80,
      y: PAGE_HEIGHT / 2 + 120,
      width: 160,
      height: 2,
      color: accentColor,
    });

    // Main title - centered
    const titleFontSize = 42;
    const titleWidth = titleFont.widthOfTextAtSize(title, titleFontSize);
    titlePage.drawText(title, {
      x: (PAGE_WIDTH - titleWidth) / 2,
      y: PAGE_HEIGHT / 2 + 60,
      size: titleFontSize,
      font: titleFont,
      color: titleColor,
    });

    // Author name if provided
    if (author) {
      const authorText = `by ${author}`;
      const authorWidth = italicFont.widthOfTextAtSize(authorText, 18);
      titlePage.drawText(authorText, {
        x: (PAGE_WIDTH - authorWidth) / 2,
        y: PAGE_HEIGHT / 2,
        size: 18,
        font: italicFont,
        color: subtitleColor,
      });
    }

    // Decorative line below title/author
    titlePage.drawRectangle({
      x: PAGE_WIDTH / 2 - 80,
      y: PAGE_HEIGHT / 2 - 40,
      width: 160,
      height: 2,
      color: accentColor,
    });

    // Footer text (using ASCII-safe character)
    const footerText = '~';
    const footerWidth = bodyFont.widthOfTextAtSize(footerText, 24);
    titlePage.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: 80,
      size: 24,
      font: bodyFont,
      color: accentColor,
    });

    // ═══════════════════════════════════════════════════════════════
    // STORY PAGES - Image-first design
    // ═══════════════════════════════════════════════════════════════
    for (const page of pages) {
      const pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      // Try to fetch and embed the image
      let imageEmbedded = false;

      if (page.imageUrl) {
        const imageResult = await fetchImageWithRetry(page.imageUrl);

        if (imageResult) {
          const embeddedImage = await embedImage(pdfDoc, imageResult);

          if (embeddedImage) {
            // Calculate dimensions to fit in the image area while maintaining aspect ratio
            const imageWidth = embeddedImage.width;
            const imageHeight = embeddedImage.height;

            const maxImageWidth = PAGE_WIDTH - (MARGIN * 2);
            const maxImageHeight = IMAGE_AREA_HEIGHT;

            // Calculate scale to fit
            const scaleX = maxImageWidth / imageWidth;
            const scaleY = maxImageHeight / imageHeight;
            const scale = Math.min(scaleX, scaleY);

            const finalWidth = imageWidth * scale;
            const finalHeight = imageHeight * scale;

            // Center the image horizontally, position at top with margin
            const imageX = (PAGE_WIDTH - finalWidth) / 2;
            const imageY = PAGE_HEIGHT - MARGIN - finalHeight;

            // Draw a subtle shadow/border effect
            pdfPage.drawRectangle({
              x: imageX - 2,
              y: imageY - 2,
              width: finalWidth + 4,
              height: finalHeight + 4,
              color: rgb(0.92, 0.90, 0.88),
            });

            // Draw the actual image
            pdfPage.drawImage(embeddedImage, {
              x: imageX,
              y: imageY,
              width: finalWidth,
              height: finalHeight,
            });

            imageEmbedded = true;
          }
        }
      }

      // If image failed, draw elegant placeholder
      if (!imageEmbedded) {
        const placeholderX = MARGIN;
        const placeholderY = PAGE_HEIGHT - MARGIN - IMAGE_AREA_HEIGHT;
        const placeholderWidth = PAGE_WIDTH - (MARGIN * 2);

        // Placeholder background
        pdfPage.drawRectangle({
          x: placeholderX,
          y: placeholderY,
          width: placeholderWidth,
          height: IMAGE_AREA_HEIGHT,
          color: rgb(0.96, 0.94, 0.92),
        });

        // Placeholder border
        pdfPage.drawRectangle({
          x: placeholderX,
          y: placeholderY,
          width: placeholderWidth,
          height: IMAGE_AREA_HEIGHT,
          borderColor: rgb(0.85, 0.82, 0.78),
          borderWidth: 1,
        });

        // Placeholder text
        const placeholderText = 'Image unavailable';
        const placeholderTextWidth = italicFont.widthOfTextAtSize(placeholderText, 14);
        pdfPage.drawText(placeholderText, {
          x: (PAGE_WIDTH - placeholderTextWidth) / 2,
          y: placeholderY + IMAGE_AREA_HEIGHT / 2,
          size: 14,
          font: italicFont,
          color: rgb(0.7, 0.65, 0.6),
        });
      }

      // ─────────────────────────────────────────────────────────────
      // Caption text - elegantly wrapped and centered
      // ─────────────────────────────────────────────────────────────
      const captionFontSize = 18;
      const lineHeight = 28;
      const maxCaptionWidth = PAGE_WIDTH - (MARGIN * 2) - 40; // Extra padding for elegance

      const captionLines = wrapText(page.caption, bodyFont, captionFontSize, maxCaptionWidth);
      const totalCaptionHeight = captionLines.length * lineHeight;

      // Center caption block vertically in the remaining space
      const captionStartY = CAPTION_AREA_TOP - 20 - ((CAPTION_AREA_TOP - 60 - totalCaptionHeight) / 2);

      captionLines.forEach((line, index) => {
        const lineWidth = bodyFont.widthOfTextAtSize(line, captionFontSize);
        pdfPage.drawText(line, {
          x: (PAGE_WIDTH - lineWidth) / 2, // Center each line
          y: captionStartY - (index * lineHeight),
          size: captionFontSize,
          font: bodyFont,
          color: captionColor,
        });
      });

      // ─────────────────────────────────────────────────────────────
      // Page number - subtle footer
      // ─────────────────────────────────────────────────────────────
      const pageNum = `${page.index + 1}`;
      const pageNumWidth = bodyFont.widthOfTextAtSize(pageNum, 12);
      pdfPage.drawText(pageNum, {
        x: (PAGE_WIDTH - pageNumWidth) / 2,
        y: 36,
        size: 12,
        font: bodyFont,
        color: pageNumColor,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // END PAGE - Simple colophon
    // ═══════════════════════════════════════════════════════════════
    const endPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    const endText = '- The End -';
    const endWidth = titleFont.widthOfTextAtSize(endText, 24);
    endPage.drawText(endText, {
      x: (PAGE_WIDTH - endWidth) / 2,
      y: PAGE_HEIGHT / 2 + 20,
      size: 24,
      font: titleFont,
      color: accentColor,
    });

    // Generation credit
    const creditText = 'Generated with AI';
    const creditWidth = italicFont.widthOfTextAtSize(creditText, 11);
    endPage.drawText(creditText, {
      x: (PAGE_WIDTH - creditWidth) / 2,
      y: 60,
      size: 11,
      font: italicFont,
      color: pageNumColor,
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();

    // Create safe filename
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      },
    });

  } catch (error) {
    console.error('PDF export error:', error);
    // Log the error details for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to export PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
