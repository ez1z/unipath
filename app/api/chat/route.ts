import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { buildGroundingContext } from '@/lib/chat/context';
import { buildSystemPrompt } from '@/lib/chat/prompt';
import { logError } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// Cerebras — free, no credit card. OpenAI-compatible chat completions API.
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_MODEL = 'gpt-oss-120b';
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000;

const BodySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        content: z.string().min(1).max(MAX_CONTENT_LENGTH),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
});

// ── Lightweight in-memory rate limit (per IP) ───────────────────────────────
// Protects the free Cerebras quota from bursts. Resets on cold start — acceptable
// for v1; swap for a durable store (e.g. Supabase/Upstash) if abuse appears.
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'chat_unavailable' }, { status: 503 });
  }

  if (isRateLimited(getIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Retrieve only catalog records relevant to the latest user message, so the
  // request stays under the provider's per-minute token limit.
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Log the question for the admin analytics dashboard. Fire-and-forget — the
  // request stays alive while streaming, so the insert completes without blocking.
  if (lastUserMessage.trim()) {
    const visitorId = req.cookies.get('up_vid')?.value ?? randomUUID();
    void createServiceClient()
      .from('analytics_events')
      .insert({
        event_type: 'ai_question',
        visitor_id: visitorId,
        locale: body.locale,
        ai_question: lastUserMessage.slice(0, 1000),
      })
      .then(() => {}, () => {});
  }

  const groundingContext = await buildGroundingContext(lastUserMessage, body.locale);
  const systemPrompt = buildSystemPrompt(body.locale, groundingContext);

  // OpenAI-compatible message list: system prompt first, then the conversation.
  // Our client uses Gemini's 'model' role name — map it to OpenAI's 'assistant'.
  const messages = [
    { role: 'system', content: systemPrompt },
    ...body.messages.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const upstreamRes = await fetch(CEREBRAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const detail = await upstreamRes.text().catch(() => '');
    console.error(`[chat] Cerebras upstream ${upstreamRes.status}: ${detail}`);
    await logError('chat', `Cerebras upstream error ${upstreamRes.status}`, {
      status: upstreamRes.status,
      body: detail.slice(0, 1000),
    });
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  // Re-stream Cerebras's OpenAI-style SSE as plain UTF-8 text chunks for the client.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const json = trimmed.slice(5).trim();
            if (!json || json === '[DONE]') continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed?.choices?.[0]?.delta?.content;
              if (typeof text === 'string' && text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // partial / non-JSON keepalive line — ignore
            }
          }
        }
      } catch {
        // upstream dropped — close gracefully
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
