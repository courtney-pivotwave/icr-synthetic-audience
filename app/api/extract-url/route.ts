import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'A valid URL is required' }, { status: 400 });
    }

    // Fetch the page server-side (avoids CORS)
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Could not fetch page (${pageResponse.status}). Try copying the message text directly.` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();
    const $ = cheerio.load(html);

    // Strip noise
    $('script, style, nav, footer, header, iframe, noscript, svg, [class*="cookie"], [class*="banner"], [id*="cookie"]').remove();

    // Extract full structured content — preserve the messaging hierarchy
    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
    const ogDesc = $('meta[property="og:description"]').attr('content')?.trim() || '';
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' | ');
    const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' | ');
    const h3s = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' | ');
    const bullets = $('li').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 10 && t.length < 200).slice(0, 30).join(' • ');
    const bodyText = $('main, article, [role="main"], .content, #content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    const rawContent = [
      title && `PAGE TITLE: ${title}`,
      ogTitle && ogTitle !== title && `OG TITLE: ${ogTitle}`,
      metaDesc && `META DESCRIPTION: ${metaDesc}`,
      ogDesc && ogDesc !== metaDesc && `OG DESCRIPTION: ${ogDesc}`,
      h1 && `H1 HEADLINES: ${h1}`,
      h2s && `H2 SUBHEADS: ${h2s}`,
      h3s && `H3 SUBHEADS: ${h3s}`,
      bullets && `BULLETS/LIST ITEMS: ${bullets}`,
      bodyText && `FULL PAGE TEXT: ${bodyText}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!rawContent.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from this page. Try copying the message directly.' },
        { status: 400 }
      );
    }

    // Use Claude to produce a full messaging inventory — not a summary
    const extraction = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: `You are extracting the complete marketing messaging from a product page for message testing purposes. Do NOT summarize — preserve the actual language used on the page.

From the content below, extract and organize the full messaging into this structure:

**Headline / Primary Value Proposition:**
[The main H1 or top-level claim — verbatim or near-verbatim]

**Supporting Claims:**
[All major supporting messages, subheadlines, and section headers — keep the actual language]

**Key Differentiators / Features:**
[Specific capabilities, proof points, or differentiators called out on the page]

**Proof Points / Social Proof:**
[Any stats, customer names, certifications, SLAs, or credibility signals]

**Call to Action:**
[What the page asks the visitor to do]

Use the actual words from the page wherever possible. This will be used to test how buyers respond to this specific language.

Content:
${rawContent}`,
        },
      ],
    });

    const extractedMessage =
      extraction.content[0].type === 'text' ? extraction.content[0].text.trim() : '';

    if (!extractedMessage) {
      return NextResponse.json({ error: 'Could not extract a message from this page.' }, { status: 500 });
    }

    return NextResponse.json({ message: extractedMessage, source: url });
  } catch (err) {
    console.error('URL extraction error:', err);
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json(
      { error: message.includes('timeout') ? 'Page took too long to load. Try copying the message directly.' : message },
      { status: 500 }
    );
  }
}
