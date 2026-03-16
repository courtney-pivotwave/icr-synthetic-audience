import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Import pdf-parse via lib path to avoid Next.js test file issue
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse');
    const pdfData = await pdfParse(buffer);

    const rawText = pdfData.text?.replace(/\s+/g, ' ').trim() || '';

    if (!rawText || rawText.length < 50) {
      return NextResponse.json(
        {
          error:
            'Could not extract text from this PDF. It may be image-based (scanned). Try copying the message text directly.',
        },
        { status: 400 }
      );
    }

    // Truncate to a reasonable size for the extraction prompt
    const truncatedText = rawText.slice(0, 5000);

    // Use Claude to extract the key marketing message
    const extraction = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `You are extracting the core marketing message from a document for message testing purposes.

From the content below, extract: (1) the main headline or value proposition, (2) the primary supporting claim, and (3) any key differentiators or proof points. Return 2-4 sentences of clean, direct marketing copy — exactly what a reader would encounter as the core message. No commentary, no labels, just the extracted message.

Document content:
${truncatedText}`,
        },
      ],
    });

    const extractedMessage =
      extraction.content[0].type === 'text' ? extraction.content[0].text.trim() : '';

    if (!extractedMessage) {
      return NextResponse.json({ error: 'Could not extract a message from this PDF.' }, { status: 500 });
    }

    return NextResponse.json({
      message: extractedMessage,
      filename: file.name,
      pageCount: pdfData.numpages,
    });
  } catch (err) {
    console.error('PDF extraction error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF extraction failed' },
      { status: 500 }
    );
  }
}
