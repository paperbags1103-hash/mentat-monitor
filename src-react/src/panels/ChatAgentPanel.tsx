import React, { useState, useRef, useEffect } from 'react';
import { useWatchlistStore } from '../store/watchlist';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GeoEventContext {
  titleKo: string;
  region: string;
  severity: string;
  lat: number;
  lng: number;
}

interface ConvergenceZoneContext {
  regionLabel: string;
  layerCount: number;
  maxSeverity: string;
}

interface MarketSummaryContext {
  kospi?: string;
  usdkrw?: string;
  vix?: string;
}

interface Props {
  geoEvents?: GeoEventContext[];
  convergenceZones?: ConvergenceZoneContext[];
  marketSummary?: MarketSummaryContext;
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
          const raw = localStorage.getItem('mentat-api-keys-v1') || '{}';
          const parsed = JSON.parse(raw) as { groq?: string };
          return parsed.groq || '';
        } catch {
          return '';
        }
      })();

      const res = await fetch('/api/chat-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(groqKey ? { 'x-groq-key': groqKey } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
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
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullText += delta;
              setStreamBuffer(fullText);
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullText || '(응답 없음)' }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠ 오류: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setStreaming(false);
      setStreamBuffer('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-appbase)', fontSize: 13 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>빠른 질문</div>
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => { void sendMessage(q); }}
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
          <div
            key={`${msg.role}-${i}`}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : '#0f172a',
                border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.4)' : '#1e293b'}`,
                color: msg.role === 'user' ? '#c7d2fe' : '#e2e8f0',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && streamBuffer && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: '12px 12px 12px 2px',
                background: '#0f172a',
                border: '1px solid #1e293b',
                color: '#e2e8f0',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {streamBuffer}
              <span style={{ opacity: 0.5 }}>▋</span>
            </div>
          </div>
        )}

        {streaming && !streamBuffer && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '8px 12px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', color: '#475569', fontSize: 11 }}>
              분석 중...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="지정학, 종목, 시장 상황 질문..."
          disabled={streaming}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#e2e8f0',
            outline: 'none',
          }}
        />
        <button
          onClick={() => { void sendMessage(); }}
          disabled={streaming || !input.trim()}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: streaming || !input.trim() ? '#1e293b' : 'rgba(99,102,241,0.6)',
            color: streaming || !input.trim() ? '#475569' : '#e0e7ff',
            cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {streaming ? '...' : '->'}
        </button>
      </div>
    </div>
  );
}
