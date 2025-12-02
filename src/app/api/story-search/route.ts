import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const SearchRequestSchema = z.object({
    query: z.string().min(1),
    useWebSearch: z.boolean().optional().default(true),
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

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

        const prompt = `
You are a literary assistant helping find PUBLIC DOMAIN stories. The user is searching for: "${query}".

IMPORTANT: Search the web for the COMPLETE, FULL TEXT of this story. Look for sources like:
- Project Gutenberg (gutenberg.org)
- Standard Ebooks (standardebooks.org)
- Wikisource
- Public domain archives
- Classic literature websites

If this is a PUBLIC DOMAIN story (published before 1928 in the US, or author died 70+ years ago):
- Provide the COMPLETE, UNABRIDGED story text
- Include chapter breaks if applicable
- For very long novels, provide at least the first 3-4 chapters or 5000+ words
- Make sure to capture the full narrative arc for shorter stories

If this is a COPYRIGHTED modern story:
- Explain that it's under copyright
- Provide a brief 2-3 sentence summary only
- Suggest similar public domain alternatives

If the story cannot be found:
- Reply with "STORY_NOT_FOUND"

Format your response EXACTLY as follows (use these exact headers):
TITLE: [Full Story Title]
AUTHOR: [Author Name]
COPYRIGHT_STATUS: [Public Domain / Copyrighted]
YEAR_PUBLISHED: [Year if known, or "Unknown"]
SOURCE: [Where you found the text, e.g., "Project Gutenberg"]
TEXT:
[The complete story text here - include everything, don't truncate]
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

        // Extract text content more reliably (everything after TEXT:)
        const textParts = text.split(/\*?TEXT:\*?/i);
        const contentMatch = textParts.length > 1 ? textParts[1] : null;

        if (!contentMatch) {
            console.error('Gemini response format error:', text.substring(0, 500));
            throw new Error('Failed to parse story content from AI response');
        }

        const storyContent = contentMatch.trim();
        const wordCount = storyContent.split(/\s+/).length;
        const isPublicDomain = statusMatch?.[1]?.toLowerCase().includes('public domain') ?? false;

        return NextResponse.json({
            title: titleMatch ? titleMatch[1].trim().replace(/\*+/g, '') : query,
            author: authorMatch ? authorMatch[1].trim().replace(/\*+/g, '') : 'Unknown',
            copyrightStatus: statusMatch ? statusMatch[1].trim().replace(/\*+/g, '') : 'Unknown',
            yearPublished: yearMatch ? yearMatch[1].trim().replace(/\*+/g, '') : null,
            source: sourceMatch ? sourceMatch[1].trim().replace(/\*+/g, '') : null,
            content: storyContent,
            wordCount,
            isPublicDomain,
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
