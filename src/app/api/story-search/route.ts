import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const SearchRequestSchema = z.object({
    query: z.string().min(1),
    useWebSearch: z.boolean().optional().default(true),
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Fetch full text directly from Project Gutenberg
 */
async function fetchFromGutenberg(bookId: string): Promise<string | null> {
    const url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'StorybookGenerator/1.0' },
            signal: AbortSignal.timeout(30000), // 30s timeout for large files
        });

        if (!response.ok) {
            console.log(`Gutenberg fetch failed for ID ${bookId}: ${response.status}`);
            return null;
        }

        const text = await response.text();
        return stripGutenbergWrapper(text);
    } catch (error) {
        console.error('Gutenberg fetch error:', error);
        return null;
    }
}

/**
 * Strip Project Gutenberg license header and footer from text
 */
function stripGutenbergWrapper(text: string): string {
    // Find start marker - everything before this is license/header
    const startMarkers = [
        '*** START OF THE PROJECT GUTENBERG EBOOK',
        '*** START OF THIS PROJECT GUTENBERG EBOOK',
        '*END*THE SMALL PRINT',
    ];

    let startIndex = 0;
    for (const marker of startMarkers) {
        const idx = text.indexOf(marker);
        if (idx !== -1) {
            // Find the end of the header line (skip past the *** line)
            const lineEnd = text.indexOf('\n', idx);
            startIndex = lineEnd !== -1 ? lineEnd + 1 : idx + marker.length;
            break;
        }
    }

    // Find end marker - everything after this is license/footer
    const endMarkers = [
        '*** END OF THE PROJECT GUTENBERG EBOOK',
        '*** END OF THIS PROJECT GUTENBERG EBOOK',
        'End of the Project Gutenberg',
        'End of Project Gutenberg',
    ];

    let endIndex = text.length;
    for (const marker of endMarkers) {
        const idx = text.indexOf(marker);
        if (idx !== -1) {
            endIndex = idx;
            break;
        }
    }

    return text.substring(startIndex, endIndex).trim();
}

export async function POST(request: NextRequest) {
    if (!genAI) {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY is not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { query, useWebSearch } = SearchRequestSchema.parse(body);

        // Use Gemini with google search grounding for fetching full story text
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: useWebSearch ? [{ googleSearch: {} }] as any : undefined,
        });

        // Two-step architecture: First get metadata + Gutenberg ID, then fetch full text directly
        const prompt = `
You are a literary assistant helping find PUBLIC DOMAIN stories. The user is searching for: "${query}".

Search the web to identify this story and find its Project Gutenberg ebook ID.

If this is a PUBLIC DOMAIN story (published before 1928 in the US, or author died 70+ years ago):
- Find the Project Gutenberg ebook number (the numeric ID in URLs like gutenberg.org/ebooks/1727)
- This ID is critical - we will use it to fetch the full text directly
- If not on Gutenberg, note that in the SOURCE field

If this is a COPYRIGHTED modern story:
- Set GUTENBERG_ID to "COPYRIGHTED"
- Provide a brief 2-3 sentence summary

If the story cannot be found:
- Reply with "STORY_NOT_FOUND"

Format your response EXACTLY as follows (use these exact headers):
TITLE: [Full Story Title]
AUTHOR: [Author Name]
COPYRIGHT_STATUS: [Public Domain / Copyrighted]
YEAR_PUBLISHED: [Year if known, or "Unknown"]
SOURCE: [Project Gutenberg / Standard Ebooks / Wikisource / Other]
GUTENBERG_ID: [The numeric ebook ID like "1727" for The Odyssey, or "COPYRIGHTED" or "NOT_FOUND"]
SUMMARY: [A 2-3 sentence plot summary for context]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Check for grounding metadata (useful for debugging/logging)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata;
        if (groundingMetadata) {
            console.log('Web search sources used:', groundingMetadata.webSearchQueries);
        }

        if (text.includes('STORY_NOT_FOUND')) {
            return NextResponse.json(
                { error: 'Story not found. Try searching for a classic public domain story like "The Velveteen Rabbit", "Peter Pan", or "Alice in Wonderland".' },
                { status: 404 }
            );
        }

        // Robust parsing of the response
        const titleMatch = text.match(/\*?TITLE:\*?\s*(.*)/i);
        const authorMatch = text.match(/\*?AUTHOR:\*?\s*(.*)/i);
        const statusMatch = text.match(/\*?COPYRIGHT_STATUS:\*?\s*(.*)/i);
        const yearMatch = text.match(/\*?YEAR_PUBLISHED:\*?\s*(.*)/i);
        const sourceMatch = text.match(/\*?SOURCE:\*?\s*(.*)/i);
        const gutenbergIdMatch = text.match(/\*?GUTENBERG_ID:\*?\s*(.*)/i);
        const summaryMatch = text.match(/\*?SUMMARY:\*?\s*(.*)/i);

        const title = titleMatch ? titleMatch[1].trim().replace(/\*+/g, '') : query;
        const author = authorMatch ? authorMatch[1].trim().replace(/\*+/g, '') : 'Unknown';
        const copyrightStatus = statusMatch ? statusMatch[1].trim().replace(/\*+/g, '') : 'Unknown';
        const yearPublished = yearMatch ? yearMatch[1].trim().replace(/\*+/g, '') : null;
        const source = sourceMatch ? sourceMatch[1].trim().replace(/\*+/g, '') : null;
        const gutenbergId = gutenbergIdMatch ? gutenbergIdMatch[1].trim().replace(/\*+/g, '') : null;
        const summary = summaryMatch ? summaryMatch[1].trim().replace(/\*+/g, '') : '';
        const isPublicDomain = statusMatch?.[1]?.toLowerCase().includes('public domain') ?? false;

        // Step 2: If we have a valid Gutenberg ID, fetch the full text directly
        if (gutenbergId && /^\d+$/.test(gutenbergId)) {
            console.log(`Fetching full text from Project Gutenberg ID: ${gutenbergId}`);
            const fullText = await fetchFromGutenberg(gutenbergId);

            if (fullText) {
                const wordCount = fullText.split(/\s+/).length;
                console.log(`Successfully fetched ${wordCount.toLocaleString()} words from Gutenberg`);

                return NextResponse.json({
                    title,
                    author,
                    copyrightStatus: 'Public Domain',
                    yearPublished,
                    source: `Project Gutenberg (ID: ${gutenbergId})`,
                    content: fullText,
                    wordCount,
                    isPublicDomain: true,
                    gutenbergId,
                    groundedSources: groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string } }) => chunk.web?.uri).filter(Boolean) || [],
                });
            } else {
                console.log(`Gutenberg fetch failed for ID ${gutenbergId}, falling back to summary`);
            }
        }

        // Fallback: Return summary with partialText flag
        // This happens if: no Gutenberg ID, invalid ID, fetch failed, or copyrighted
        const isCopyrighted = gutenbergId === 'COPYRIGHTED' || !isPublicDomain;

        return NextResponse.json({
            title,
            author,
            copyrightStatus: isCopyrighted ? 'Copyrighted' : copyrightStatus,
            yearPublished,
            source,
            content: summary || `Unable to fetch full text for "${title}". Please try uploading a file instead.`,
            wordCount: summary ? summary.split(/\s+/).length : 0,
            isPublicDomain: !isCopyrighted,
            partialText: true, // Flag to indicate this is just a summary
            groundedSources: groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string } }) => chunk.web?.uri).filter(Boolean) || [],
        });

    } catch (error) {
        console.error('Story search error:', error);
        return NextResponse.json(
            { error: 'Failed to search for story. Please try again.' },
            { status: 500 }
        );
    }
}
