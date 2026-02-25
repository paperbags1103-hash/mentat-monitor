/**
 * LiveNews — 글로벌 뉴스 미니 피드
 * LIVE FEED 아래에 배치, RSS 프록시 사용
 */
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/store';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const SOURCES = [
  { label: 'Reuters 월드', url: 'https://feeds.reuters.com/reuters/worldNews' },
  { label: 'Reuters 비즈', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { label: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml' },
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

export function LiveNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function load(idx = srcIdx) {
    setLoading(true);
    const src = SOURCES[idx];
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

  useEffect(() => {
    const id = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(id);
  }, [srcIdx]);

  return (
    <div className="border-t border-border shrink-0" style={{ maxHeight: collapsed ? 'auto' : '260px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface/80 sticky top-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-primary">📰 글로벌 뉴스</span>
          {loading && <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          <select value={srcIdx} onChange={e => setSrcIdx(Number(e.target.value))}
            className="text-xs bg-base border border-border text-muted rounded px-1 py-0.5 outline-none">
            {SOURCES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select>
          <button onClick={() => setCollapsed(c => !c)}
            className="text-muted hover:text-primary text-xs w-5 text-center">
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* News list */}
      {!collapsed && (
        <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
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
      )}
    </div>
  );
}
