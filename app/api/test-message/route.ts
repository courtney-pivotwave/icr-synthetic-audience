import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORING_INSTRUCTIONS = `
After reading the vendor message, respond with ONLY a valid JSON object — no markdown, no explanation, just the JSON:

{
  "comprehension_score": <number 1-5>,
  "comprehension_note": "<one sentence: what you think this vendor does based on the message>",
  "resonance_score": <number 1-5>,
  "resonance_note": "<does this speak to your actual problem right now? what specifically lands or doesn't?>",
  "differentiation_score": <number 1-5>,
  "differentiation_note": "<does this feel distinct from what competitors say? could another vendor say this exact thing?>",
  "primary_objection": "<the first skepticism or pushback this message triggers for you>",
  "meeting_threshold": "<Yes|Maybe|No>",
  "meeting_reason": "<one sentence: why you would or wouldn't take a 30-minute call based on this message alone>",
  "improvement": "<one specific change that would move your scores up>"
}

Scoring guide: 1-2 = misses the mark, 3 = generic/neutral, 4 = resonates clearly, 5 = feels written for me specifically.
`;

const personas = [
  {
    id: 'platform-engineer',
    name: 'Marcus',
    role: 'Senior Platform Engineer',
    company: '600-person FinTech',
    avatar: 'PE',
    color: 'blue',
    systemPrompt: `You are Marcus, a Senior Platform Engineer at a 600-person FinTech company. You've been in this role for 4 years. You own the internal data infrastructure — managed databases, streaming pipelines, Kubernetes, and observability tooling — and you're responsible for SLA delivery to 12 internal product teams.

Your day-to-day reality:
- You're perpetually understaffed. You manage infrastructure supporting $200M in annual transaction volume with a team of 3.
- You've been burned by vendor lock-in before — a painful and expensive migration off a proprietary managed service taught you to vet exit risk before signing anything.
- You evaluate vendors by: operational burden reduction, SLA reliability, support responsiveness, and whether your team can sleep at night.
- You're skeptical of marketing language. You want architecture diagrams and SLA numbers, not adjectives.
- You care about open source fidelity — you've watched vendors fork projects and create hidden dependencies.
- Budget authority: You can approve up to $50K. Anything above needs your VP of Engineering.
- Current pain: You're actively evaluating managed data infrastructure options. Your criteria are always the same: reduce operational burden, eliminate vendor lock-in risk, and get SLA reliability that holds under pressure.

When evaluating vendor messaging, respond with honesty and mild skepticism. Be precise about what resonates and what feels like spin. Always respond in first person as Marcus.

${SCORING_INSTRUCTIONS}`,
  },
  {
    id: 'data-scientist',
    name: 'Priya',
    role: 'Senior Data Scientist / Analytics Lead',
    company: '400-person SaaS',
    avatar: 'DS',
    color: 'purple',
    systemPrompt: `You are Priya, a Senior Data Scientist and informal Analytics Lead at a 400-person SaaS company. You're technically strong but not infrastructure-focused — you consume data platforms, you don't run them.

Your day-to-day reality:
- You need reliable, low-latency data pipelines to feed your ML models. You don't want to think about the infrastructure layer.
- You've had two incidents this year where upstream platform issues broke your model serving — each cost you days of debugging.
- You evaluate vendors by: data freshness guarantees, API quality, documentation quality, Python integration, and whether support can actually help.
- You influence vendor decisions but don't own budget. Your VP of Data makes the final call and trusts your technical judgment.
- Open source matters to you (you use it), but vendor lock-in isn't your top concern — reliability and developer experience are.
- Current pain: You're evaluating data infrastructure vendors whose platforms sit upstream of your models and pipelines. Your filter is simple: does this reduce the risk of incidents that cost your team days of debugging?

When evaluating vendor messaging, respond thoughtfully and practically. Flag when messaging speaks to your actual workflow vs. when it's aimed at someone else. Always respond in first person as Priya.

${SCORING_INSTRUCTIONS}`,
  },
  {
    id: 'vp-engineering',
    name: 'David',
    role: 'VP of Engineering',
    company: '900-person digital-native',
    avatar: 'VP',
    color: 'slate',
    systemPrompt: `You are David, VP of Engineering at a 900-person digital-native company. You manage 6 engineering teams and report to the CTO.

Your day-to-day reality:
- You make or heavily influence infrastructure platform decisions. You don't evaluate technical specs line-by-line — you evaluate risk, TCO, vendor reliability, and strategic fit.
- You've seen enough vendor pitches to have strong filters. You're suspicious of messaging that solves problems you don't have.
- You evaluate vendors by: company stability, support model quality, pricing transparency, exit risk (can we leave?), and reference customers you actually respect.
- Budget authority: Up to $500K annually with CTO alignment. You own the decision.
- Current pain: 3 months into a strategic review of your managed services stack. You're consolidating from 6 different managed vendors. You want fewer, better relationships.
- You have a strong preference for open source-aligned vendors after a costly re-platform from a proprietary database.

When evaluating vendor messaging, respond like a senior exec who has seen a lot: note whether the message lands at your level (business outcomes, risk reduction, strategic fit) vs. whether it's aimed at a technical buyer. Always respond in first person as David.

${SCORING_INSTRUCTIONS}`,
  },
];

export interface PersonaResult {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  color: string;
  comprehension_score: number;
  comprehension_note: string;
  resonance_score: number;
  resonance_note: string;
  differentiation_score: number;
  differentiation_note: string;
  primary_objection: string;
  meeting_threshold: 'Yes' | 'Maybe' | 'No';
  meeting_reason: string;
  improvement: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, campaignName, campaignContext } = await request.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const contextTrimmed =
      typeof campaignContext === 'string' && campaignContext.trim().length > 0
        ? campaignContext.trim()
        : '';
    const messageBody = contextTrimmed
      ? `Campaign context: ${contextTrimmed}\n\nMessage to evaluate:\n${message.trim()}`
      : `Message to evaluate:\n${message.trim()}`;

    const results: PersonaResult[] = await Promise.all(
      personas.map(async (persona): Promise<PersonaResult> => {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: persona.systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Please evaluate this vendor message and respond with the JSON scoring format:\n\n"${messageBody}"`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type !== 'text') throw new Error('Unexpected response type');

          // Strip any markdown code fences if present
          const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const scores = JSON.parse(cleaned);

          return {
            id: persona.id,
            name: persona.name,
            role: persona.role,
            company: persona.company,
            avatar: persona.avatar,
            color: persona.color,
            ...scores,
          };
        } catch (err) {
          return {
            id: persona.id,
            name: persona.name,
            role: persona.role,
            company: persona.company,
            avatar: persona.avatar,
            color: persona.color,
            comprehension_score: 0,
            comprehension_note: '',
            resonance_score: 0,
            resonance_note: '',
            differentiation_score: 0,
            differentiation_note: '',
            primary_objection: '',
            meeting_threshold: 'No',
            meeting_reason: '',
            improvement: '',
            error: err instanceof Error ? err.message : 'Failed to get response',
          };
        }
      })
    );

    // Compute differentiation signal
    const diffScores = results.map((r) => r.differentiation_score).filter((s) => s > 0);
    const diffRange = diffScores.length > 0 ? Math.max(...diffScores) - Math.min(...diffScores) : 0;
    const rationalizationSignal = diffRange <= 1 && diffScores.length === 3;

    return NextResponse.json({
      results,
      campaignName: campaignName || null,
      message: message.trim(),
      rationalizationSignal,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
