/**
 * LiveNews — 글로벌 뉴스 + AI 요약 피드
 * - RSS 탭: 원문 헤드라인 (기존)
 * - AI 탭: Groq 한국어 투자 요약 (신규)
 */
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/store';

// ─── RSS 탭 ───────────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const RSS_SOURCES = [
  { label: 'BBC 비즈니스', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { label: 'BBC 월드',     url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { label: 'BBC 테크',     url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
] as const;

function timeAgo(dateStr: string): string {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)    return `${Math.round(diff)}초 전`;
    if (diff < 3600)  return `${Math.round(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function RSSTab() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [srcIdx, setSrcIdx] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function load(idx = srcIdx) {
    setLoading(true);
    const src = RSS_SOURCES[idx];
    try {
      const data = await apiFetch<{ items?: Array<{ title?: string; link?: string; pubDate?: string }> }>(
        `/api/rss-proxy?url=${encodeURIComponent(src.url)}`
      );
      if (!mountedRef.current) return;
      setItems(
        (data?.items ?? []).slice(0, 10).map(i => ({
          title:   i.title ?? '',
          link:    i.link ?? '#',
          pubDate: i.pubDate ?? '',
          source:  src.label,
        }))
      );
    } catch { /* graceful */ }
    finally { if (mountedRef.current) setLoading(false); }
  }

  useEffect(() => { void load(); }, [srcIdx]);
  useEffect(() => { const id = setInterval(() => void load(), 5 * 60_000); return () => clearInterval(id); }, [srcIdx]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 pb-1.5 shrink-0">
        <select value={srcIdx} onChange={e => setSrcIdx(Number(e.target.value))}
          className="flex-1 text-xs bg-transparent border border-border text-muted rounded px-1 py-0.5 outline-none">
          {RSS_SOURCES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>
        {loading && <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shrink-0" />}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-muted text-xs">
            {loading ? '로딩 중...' : '뉴스 없음'}
          </div>
        ) : (
          items.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-1.5 border-b border-border/30 last:border-0 hover:bg-surface/60 transition-colors group">
              <p className="text-xs text-secondary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </p>
              <span className="text-xs text-muted/60 mt-0.5 block">{timeAgo(item.pubDate)}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ─── AI 요약 탭 ───────────────────────────────────────────────────────────────
interface AINewsItem {
  originalTitle: string;
  summaryKo: string;
  investmentImplication: string;
  sectors: string[];
  koreanTickers: string[];
  importance: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface AINewsResponse {
  items: AINewsItem[];
  generatedAt: number;
  hasAI: boolean;
  fallback?: boolean;
}

const SENTIMENT_CONFIG = {
  bullish: { label: '강세', cls: 'text-green-400 border-green-500/40 bg-green-500/10' },
  bearish: { label: '약세', cls: 'text-red-400 border-red-500/40 bg-red-500/10' },
  neutral: { label: '중립', cls: 'text-gray-400 border-gray-600 bg-gray-800/40' },
};

function AITab() {
  const [data, setData] = useState<AINewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function load() {
    setLoading(true);
    try {
      // apiFetch가 로컬스토리지의 Groq 키를 헤더에 자동 포함
      const result = await apiFetch<AINewsResponse>('/api/news-ai');
      if (!mountedRef.current) return;
      setData(result);
    } catch { /* graceful */ }
    finally { if (mountedRef.current) setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { const id = setInterval(() => void load(), 10 * 60_000); return () => clearInterval(id); }, []);

  const items = data?.items ?? [];
  const hasAI = data?.hasAI ?? false;
  const genTime = data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="flex flex-col h-full">
      {/* 상태바 */}
      <div className="flex items-center gap-1.5 px-2 pb-1.5 shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${hasAI ? 'text-purple-400 border-purple-500/40 bg-purple-500/10' : 'text-gray-500 border-gray-700'}`}>
          {hasAI ? '🧠 AI 요약' : '📰 원문'}
        </span>
        {!hasAI && (
          <span className="text-xs text-gray-600">Groq 키 필요</span>
        )}
        {genTime && <span className="text-xs text-gray-600 ml-auto">{genTime}</span>}
        {loading && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse shrink-0" />}
      </div>

      {/* 아이템 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted text-xs">
            <span className="animate-spin">⟳</span>
            <span>AI 분석 중...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted text-xs text-center px-4">
            <span>뉴스 없음</span>
            <span className="text-gray-600">설정에서 Groq API 키를 입력하면<br/>한국어 AI 요약이 활성화됩니다</span>
          </div>
        ) : (
          items.map((item, i) => {
            const sent = SENTIMENT_CONFIG[item.sentiment] ?? SENTIMENT_CONFIG.neutral;
            const isOpen = expanded === i;
            return (
              <div key={i}
                className="border-b border-border/30 last:border-0 cursor-pointer hover:bg-surface/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : i)}>
                {/* 헤더 */}
                <div className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-xs px-1 py-0.5 rounded border shrink-0 ${sent.cls}`}>{sent.label}</span>
                    <span className="text-xs text-gray-600 ml-auto shrink-0">#{item.importance}</span>
                  </div>
                  <p className="text-xs text-secondary leading-snug line-clamp-2">{item.summaryKo}</p>
                </div>

                {/* 확장 뷰 */}
                {isOpen && (
                  <div className="px-3 pb-2.5 space-y-2">
                    {/* 원문 */}
                    <p className="text-xs text-gray-600 italic leading-snug">{item.originalTitle}</p>
                    {/* 투자 시사점 */}
                    <div className="bg-surface/60 rounded p-2">
                      <div className="text-xs text-gray-500 mb-0.5">💡 투자 시사점</div>
                      <p className="text-xs text-gray-300 leading-snug">{item.investmentImplication}</p>
                    </div>
                    {/* 섹터 */}
                    {item.sectors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.sectors.map(s => (
                          <span key={s} className="text-xs px-1.5 py-0.5 rounded-full border border-gray-700 text-gray-400 bg-gray-800/40">{s}</span>
                        ))}
                      </div>
                    )}
                    {/* 관련 종목 */}
                    {item.koreanTickers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.koreanTickers.map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 bg-blue-500/10 font-mono">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
type Tab = 'ai' | 'rss';

export function LiveNews() {
  const [tab, setTab] = useState<Tab>('ai');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-t border-border shrink-0 flex flex-col" style={{ maxHeight: collapsed ? 'auto' : '280px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface/80 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => setTab('ai')}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${tab === 'ai' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'text-muted hover:text-primary'}`}>
            🧠 AI
          </button>
          <button onClick={() => setTab('rss')}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${tab === 'rss' ? 'bg-accent/20 text-accent-light border border-accent/40' : 'text-muted hover:text-primary'}`}>
            📰 RSS
          </button>
        </div>
        <button onClick={() => setCollapsed(c => !c)}
          className="text-muted hover:text-primary text-xs w-5 text-center">
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden" style={{ height: '240px' }}>
          {tab === 'ai'  && <AITab />}
          {tab === 'rss' && <RSSTab />}
        </div>
      )}
    </div>
  );
}
