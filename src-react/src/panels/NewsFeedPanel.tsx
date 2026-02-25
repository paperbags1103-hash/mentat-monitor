/**
 * NewsFeedPanel — 실시간 뉴스 피드
 * RSS 프록시 API를 통해 한국/글로벌 경제 뉴스 표시
 * 카테고리 필터, 키워드 검색, 자동 새로고침
 */
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/store';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
}

// RSS 소스별 API 경로 (rss-proxy 활용)
const NEWS_SOURCES = [
  { id: 'yonhap',  label: '연합뉴스',  ko: true,  url: 'https://www.yna.co.kr/rss/economy.xml' },
  { id: 'ytn',     label: 'YTN',       ko: true,  url: 'https://www.ytn.co.kr/_rss/economy.php' },
  { id: 'mk',      label: '매일경제',  ko: true,  url: 'https://www.mk.co.kr/rss/30100041/' },
  { id: 'reuters', label: 'Reuters',   ko: false, url: 'https://feeds.reuters.com/reuters/businessNews' },
  { id: 'ft',      label: 'FT',        ko: false, url: 'https://www.ft.com/world?format=rss' },
] as const;

const REFRESH_MS = 3 * 60_000;

function timeAgo(dateStr: string): string {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)     return `${Math.round(diff)}초 전`;
    if (diff < 3600)   return `${Math.round(diff / 60)}분 전`;
    if (diff < 86400)  return `${Math.round(diff / 3600)}시간 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// Fetch RSS via our proxy
async function fetchRSS(url: string, sourceLabel: string): Promise<NewsItem[]> {
  const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(url)}`;
  const data = await apiFetch<{ items?: Array<{ title?: string; link?: string; pubDate?: string }> }>(proxyUrl);
  return (data?.items ?? []).slice(0, 15).map(item => ({
    title:   item.title ?? '',
    link:    item.link ?? '#',
    pubDate: item.pubDate ?? '',
    source:  sourceLabel,
  }));
}

export function NewsFeedPanel() {
  const [items, setItems]   = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSrc, setActiveSrc] = useState<string>('all');
  const [koOnly, setKoOnly]   = useState(true);
  const mountedRef = useRef(true);

  async function load() {
    setLoading(true);
    const sources = NEWS_SOURCES.filter(s => koOnly ? s.ko : true);
    const results = await Promise.allSettled(
      sources.map(s => fetchRSS(s.url, s.label))
    );
    if (!mountedRef.current) return;
    const all: NewsItem[] = [];
    results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
    // Sort by pubDate desc
    all.sort((a, b) => {
      try { return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(); }
      catch { return 0; }
    });
    setItems(all);
    setLoading(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => { mountedRef.current = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [koOnly]);

  const filtered = items.filter(item => {
    if (activeSrc !== 'all' && item.source !== activeSrc) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sources = ['all', ...new Set(items.map(i => i.source))];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-3 py-2 border-b border-border shrink-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="뉴스 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-primary placeholder-muted focus:border-accent focus:outline-none min-w-0"
          />
          <button
            onClick={() => setKoOnly(k => !k)}
            className={`text-xs px-2 py-1 rounded transition-colors shrink-0 ${koOnly ? 'bg-accent/20 text-accent-light' : 'bg-border text-muted'}`}
          >KO</button>
          <button onClick={() => void load()} disabled={loading}
            className="text-xs text-muted hover:text-primary disabled:opacity-40 shrink-0">⟳</button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {sources.map(s => (
            <button key={s} onClick={() => setActiveSrc(s)}
              className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-colors shrink-0 ${
                activeSrc === s ? 'bg-accent text-white' : 'bg-border text-secondary hover:text-primary'
              }`}>{s === 'all' ? '전체' : s}</button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs gap-2">
            <div className="w-4 h-4 border border-border border-t-accent rounded-full animate-spin" />
            뉴스 로드 중…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            {search ? '검색 결과 없음' : '뉴스 없음'}
          </div>
        ) : (
          filtered.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 px-3 py-2.5 border-b border-border/40 hover:bg-surface/60 transition-colors block"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-secondary leading-snug line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-surface border border-border px-1.5 py-0.5 rounded text-muted">{item.source}</span>
                  {item.pubDate && <span className="text-xs text-muted/60">{timeAgo(item.pubDate)}</span>}
                </div>
              </div>
              <span className="text-muted text-xs shrink-0 mt-0.5">↗</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
