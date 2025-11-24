import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const SearchRequestSchema = z.object({
    query: z.string().min(1),
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
        const { query } = SearchRequestSchema.parse(body);

        const model = genAI.getGenerativeModel({ model: 'gemini-3.0-pro' });

        const prompt = `
You are a literary assistant. The user is asking for the text of the story: "${query}".

If this story is in the public domain, please provide the full text (or a comprehensive summary/retelling if it's very long, suitable for adapting into a children's book).
If it is a copyrighted modern story, please provide a detailed summary of the plot, characters, and key scenes so that it can be adapted into a fan-fiction style or educational summary, but DO NOT violate copyright by reproducing the exact text.
If the story is unknown, please reply with "STORY_NOT_FOUND".

Format your response as follows:
TITLE: [Story Title]
AUTHOR: [Author Name]
COPYRIGHT_STATUS: [Public Domain / Copyrighted]
TEXT:
[The story text or summary here]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (text.includes('STORY_NOT_FOUND')) {
            return NextResponse.json(
                { error: 'Story not found. Please try a different title or upload a file.' },
                { status: 404 }
            );
        }

        // Robust parsing of the response
        const titleMatch = text.match(/\*?TITLE:\*?\s*(.*)/i);
        const authorMatch = text.match(/\*?AUTHOR:\*?\s*(.*)/i);
        const statusMatch = text.match(/\*?COPYRIGHT_STATUS:\*?\s*(.*)/i);

        // Extract text content more reliably (everything after TEXT:)
        const textParts = text.split(/\*?TEXT:\*?/i);
        const contentMatch = textParts.length > 1 ? textParts[1] : null;

        if (!contentMatch) {
            console.error('Gemini response format error:', text);
            throw new Error('Failed to parse story content from AI response');
        }

        return NextResponse.json({
            title: titleMatch ? titleMatch[1].trim() : query,
            author: authorMatch ? authorMatch[1].trim() : 'Unknown',
            copyrightStatus: statusMatch ? statusMatch[1].trim() : 'Unknown',
            content: contentMatch.trim(),
        });

    } catch (error) {
        console.error('Story search error:', error);
        return NextResponse.json(
            { error: 'Failed to search for story' },
            { status: 500 }
        );
    }
}
