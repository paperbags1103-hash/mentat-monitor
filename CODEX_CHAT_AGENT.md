# Task: Conversational AI Agent Panel (Groq Streaming)

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Add a chat interface panel where users can ask questions about geopolitical events, their portfolio, and market signals.
The agent reads all current live data as context and streams a Groq response back.

Key points:
- Uses `llama-3.3-70b-versatile` (high quality) with **SSE streaming** (bypasses Vercel 10s timeout)
- Context includes: geo-events, convergence zones, market summary, watchlist tickers
- Panel title: "🤖 AI 브리핑 에이전트"
- User asks questions in Korean, agent answers in Korean

## Files to Create/Edit

1. `api/chat-agent.js` — CREATE: Vercel Edge streaming endpoint
2. `src-react/src/panels/ChatAgentPanel.tsx` — CREATE: streaming chat UI
3. `src-react/src/aip/AIPLayout.tsx` — ADD: register the new panel

Do NOT modify WorldMapView.tsx or any other files.

---

## PART 1: `api/chat-agent.js`

```js
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
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';
  if (!groqKey) {
    return new Response(
      JSON.stringify({ error: 'Groq API key required' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages = [], context = {} } = body;

  // Build context string from live data
  const contextParts = [];

  if (context.geoEvents?.length > 0) {
    const topEvents = context.geoEvents
      .filter(ev => ev.severity === 'critical' || ev.severity === 'high')
      .slice(0, 6)
      .map(ev => `[${ev.severity.toUpperCase()}] ${ev.region}: ${ev.titleKo}`)
      .join('\n');
    if (topEvents) contextParts.push(`## 현재 주요 지정학 이벤트\n${topEvents}`);
  }

  if (context.convergenceZones?.length > 0) {
    const zones = context.convergenceZones
      .slice(0, 3)
      .map(z => `⚡ ${z.regionLabel} (${z.layerCount}개 레이어 수렴, ${z.maxSeverity})`)
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

  // Build messages array
  const allMessages = [systemMessage, ...messages.slice(-6)]; // keep last 6 for memory

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

    // Stream the SSE response directly to the client
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
      JSON.stringify({ error: err.message }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
```

---

## PART 2: `src-react/src/panels/ChatAgentPanel.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useWatchlistStore } from '../store/watchlist';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  geoEvents?: Array<{ titleKo: string; region: string; severity: string; lat: number; lng: number }>;
  convergenceZones?: Array<{ regionLabel: string; layerCount: number; maxSeverity: string }>;
  marketSummary?: { kospi?: string; usdkrw?: string; vix?: string };
}

const QUICK_QUESTIONS = [
  '오늘 내 포트폴리오에 영향을 줄 지정학 이슈는?',
  '현재 Risk-On이야 Risk-Off야?',
  '지금 지도에서 제일 위험한 지역은?',
  'SK하이닉스 공급망 리스크 분석해줘',
  '유가 상승하면 어떤 한국 종목이 오를까?',
];

export default function ChatAgentPanel({ geoEvents = [], convergenceZones = [], marketSummary }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { tickers: watchlistTickers } = useWatchlistStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  async function sendMessage(text?: string) {
    const userText = text || input.trim();
    if (!userText || streaming) return;

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setStreaming(true);
    setStreamBuffer('');

    try {
      const groqKey = (() => {
        try {
          return JSON.parse(localStorage.getItem('mentat-api-keys-v1') || '{}').groq || '';
        } catch { return ''; }
      })();

      const res = await fetch('/api/chat-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(groqKey ? { 'x-groq-key': groqKey } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: {
            geoEvents: geoEvents.slice(0, 10),
            convergenceZones: convergenceZones.slice(0, 5),
            marketSummary,
            watchlistTickers,
          },
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullText += delta;
              setStreamBuffer(fullText);
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullText || '(응답 없음)' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 오류: ${(err as Error).message}` }]);
    } finally {
      setStreaming(false);
      setStreamBuffer('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-appbase)', fontSize: 13 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>빠른 질문</div>
            {QUICK_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                  color: '#94a3b8', borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                  fontSize: 11, textAlign: 'left', lineHeight: 1.4,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : '#0f172a',
              border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.4)' : '#1e293b'}`,
              color: msg.role === 'user' ? '#c7d2fe' : '#e2e8f0',
              fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && streamBuffer && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: '12px 12px 12px 2px',
              background: '#0f172a', border: '1px solid #1e293b',
              color: '#e2e8f0', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {streamBuffer}
              <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▋</span>
            </div>
          </div>
        )}

        {streaming && !streamBuffer && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '8px 12px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', color: '#475569', fontSize: 11 }}>
              🧠 분석 중...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="지정학, 종목, 시장 상황 질문..."
          disabled={streaming}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0',
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={streaming || !input.trim()}
          style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: streaming || !input.trim() ? '#1e293b' : 'rgba(99,102,241,0.6)',
            color: streaming || !input.trim() ? '#475569' : '#e0e7ff',
            cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {streaming ? '⏳' : '→'}
        </button>
      </div>
    </div>
  );
}
```

---

## PART 3: Register in `src-react/src/aip/AIPLayout.tsx`

Look at how other panels are imported and registered in AIPLayout.tsx.

1. Import `ChatAgentPanel`:
```typescript
import ChatAgentPanel from '../panels/ChatAgentPanel';
```

2. Add a new panel entry in the panels registry (follow the same pattern as other panels):
```typescript
{
  id: 'chat-agent',
  title: '🤖 AI 에이전트',
  component: <ChatAgentPanel geoEvents={geoEvents} convergenceZones={[]} marketSummary={undefined} />,
  // pass the same geoEvents prop that's used elsewhere in AIPLayout if available
  // if geoEvents is not available in AIPLayout scope, just pass empty array: geoEvents={[]}
  minW: 2, minH: 3, defaultW: 3, defaultH: 4,
}
```

Look at the existing panel structure in AIPLayout.tsx carefully and follow the exact same pattern. If geoEvents is managed inside WorldMapView and not in AIPLayout, just use an empty array — the panel will still work, it just won't have the geo context (we can improve this later).

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -30
```

Fix all TypeScript errors. Commit:
`feat: AI 대화형 에이전트 패널 — Groq 70b 스트리밍`

Then run:
```
openclaw system event --text "Done: Chat Agent panel complete with Groq 70b streaming" --mode now
```
