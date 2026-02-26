/**
 * /api/chat-agent
 *
 * Streaming chat endpoint for the Mentat Monitor AI agent.
 * Accepts POST with { messages, context } and streams Groq response as SSE.
 *
 * Uses llama-3.3-70b-versatile for high-quality analysis.
 * Streaming bypasses Vercel Hobby 10s timeout.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `당신은 Mentat Monitor의 AI 투자 인텔리전스 에이전트입니다.
한국 개인 투자자를 위한 고급 지정학 및 금융 분석을 제공합니다.

당신의 역할:
- 지정학 이벤트와 한국/미국 주식 시장의 인과관계 분석
- 구체적인 종목명과 투자 시사점 제시 (한국 코드/미국 티커 포함)
- Risk-On/Risk-Off 판단과 근거 설명
- 현재 시장 상황에 맞는 실용적 조언

응답 원칙:
- 항상 한국어로 답변
- 구체적이고 실용적으로 (추상적 일반론 금지)
- 종목 언급 시 한국 코드(6자리) 또는 미국 티커 병기
- 불확실한 것은 불확실하다고 명시
- 200-400자 내외로 간결하게`;

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: corsHeaders });

  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';
  if (!groqKey) {
    return new Response(
      JSON.stringify({ error: 'Groq API key required' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const { messages = [], context = {} } = body;

  const contextParts = [];

  if (context.geoEvents?.length > 0) {
    const topEvents = context.geoEvents
      .filter((ev) => ev.severity === 'critical' || ev.severity === 'high')
      .slice(0, 6)
      .map((ev) => `[${String(ev.severity).toUpperCase()}] ${ev.region}: ${ev.titleKo}`)
      .join('\n');
    if (topEvents) contextParts.push(`## 현재 주요 지정학 이벤트\n${topEvents}`);
  }

  if (context.convergenceZones?.length > 0) {
    const zones = context.convergenceZones
      .slice(0, 3)
      .map((z) => `⚡ ${z.regionLabel} (${z.layerCount}개 레이어 수렴, ${z.maxSeverity})`)
      .join('\n');
    contextParts.push(`## 수렴 구역\n${zones}`);
  }

  if (context.marketSummary) {
    const m = context.marketSummary;
    contextParts.push(`## 현재 시장\nKOSPI: ${m.kospi ?? 'N/A'} | KRW/USD: ${m.usdkrw ?? 'N/A'} | VIX: ${m.vix ?? 'N/A'}`);
  }

  if (context.watchlistTickers?.length > 0) {
    contextParts.push(`## 사용자 관심종목\n${context.watchlistTickers.join(', ')}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n<current_signals>\n${contextParts.join('\n\n')}\n</current_signals>`
    : '';

  const systemMessage = {
    role: 'system',
    content: SYSTEM_PROMPT + contextBlock,
  };

  const allMessages = [systemMessage, ...messages.slice(-6)];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: allMessages,
        temperature: 0.4,
        max_tokens: 600,
        stream: true,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq error: ${groqRes.status}`, detail: errText }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!groqRes.body) {
      return new Response(
        JSON.stringify({ error: 'Groq response body is empty' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const stream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    });

    groqRes.body.pipeTo(stream.writable).catch(() => {});

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
