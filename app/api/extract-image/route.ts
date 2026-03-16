import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = 'nodejs';

const ALLOWED_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const mimeType = ALLOWED_TYPES[file.type.toLowerCase()];
    if (!mimeType) {
      return NextResponse.json(
        { error: 'File must be a JPG, PNG, GIF, or WebP image' },
        { status: 400 }
      );
    }

    // Convert to base64 for Claude vision
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    // Send directly to Claude as a vision message — no extra libraries needed
    const extraction = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are extracting the core marketing message from an ad or marketing image for message testing purposes.

Read all visible text in this image — headlines, subheadlines, body copy, taglines, CTAs. Then extract: (1) the main headline or value proposition, (2) the primary supporting claim, and (3) any key differentiators or calls to action.

Return 2-4 sentences of clean, direct marketing copy representing the core message. No commentary, no labels, no description of the image itself — just the extracted marketing message as a reader would experience it.

If the image contains no readable marketing text, say: "No readable marketing text found in this image."`,
            },
          ],
        },
      ],
    });

    const extractedMessage =
      extraction.content[0].type === 'text' ? extraction.content[0].text.trim() : '';

    if (!extractedMessage || extractedMessage.startsWith('No readable marketing text')) {
      return NextResponse.json(
        { error: 'No readable marketing text found in this image. Try uploading a clearer version or paste the copy directly.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: extractedMessage, filename: file.name });
  } catch (err) {
    console.error('Image extraction error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image extraction failed' },
      { status: 500 }
    );
  }
}
