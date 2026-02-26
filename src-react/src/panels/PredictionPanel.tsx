import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/store';

interface PredictionMarket {
  id: string;
  title: string;
  probability: number; // 0-100
  volume: number;
  url: string;
  category: string;
  categoryKo: string;
  yesLabel: string;
}

interface PolyResponse {
  markets: PredictionMarket[];
  cached: boolean;
  generatedAt: number;
  fallback?: boolean;
}

type CategoryFilter = 'all' | 'geopolitics' | 'politics' | 'economics';

function formatVolume(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function ProbBar({ prob }: { prob: number }) {
  const color = prob >= 60 ? '#22c55e' : prob <= 40 ? '#ef4444' : '#eab308';
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${prob}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>{prob}%</span>
    </div>
  );
}

export function PredictionPanel() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PolyResponse>('/api/polymarket');
      if (data?.markets) {
        setMarkets(data.markets);
        setGeneratedAt(data.generatedAt);
        setIsFallback(!!data.fallback);
      } else {
        setError('데이터 없음');
      }
    } catch {
      setError('로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const FILTERS: { key: CategoryFilter; label: string }[] = [
    { key: 'all',         label: '전체' },
    { key: 'geopolitics', label: '지정학' },
    { key: 'politics',    label: '정치' },
    { key: 'economics',   label: '경제' },
  ];

  const filtered = filter === 'all' ? markets : markets.filter(m => m.category === filter);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">예측 시장</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-border text-muted">Polymarket</span>
          {isFallback && <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">샘플</span>}
        </div>
        <div className="flex items-center gap-2">
          {markets.length > 0 && <span className="text-xs text-muted">{filtered.length}개</span>}
          <button onClick={() => void load()} disabled={loading}
            className="text-xs text-muted hover:text-primary transition-colors disabled:opacity-40"
            title="새로고침">{loading ? '…' : '⟳'}</button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-1 px-3 pt-2 shrink-0">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-[11px] px-2 py-0.5 rounded border transition-all ${
              filter === f.key
                ? 'bg-accent/20 border-accent/50 text-accent-light font-semibold'
                : 'border-border text-muted hover:text-primary'
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {loading && markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span className="text-xs">Polymarket 조회 중…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-xs text-risk-elevated">{error}</p>
            <button onClick={() => void load()} className="text-xs text-accent-light underline">재시도</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted">데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                className="block bg-surface border border-border rounded-lg p-2.5 hover:border-accent/40 transition-all cursor-pointer">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full border shrink-0"
                    style={{
                      color: m.category === 'geopolitics' ? '#ef4444' : m.category === 'economics' ? '#22c55e' : '#3b82f6',
                      borderColor: m.category === 'geopolitics' ? '#ef444440' : m.category === 'economics' ? '#22c55e40' : '#3b82f640',
                      background: m.category === 'geopolitics' ? '#ef444410' : m.category === 'economics' ? '#22c55e10' : '#3b82f610',
                    }}>
                    {m.categoryKo}
                  </span>
                  <p className="text-xs text-primary leading-snug line-clamp-2 flex-1">{m.title}</p>
                </div>
                <ProbBar prob={m.probability} />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted">거래량 {formatVolume(m.volume)}</span>
                  <span className="text-[10px] text-muted ml-auto">↗ 자세히</span>
                </div>
              </a>
            ))}
            {generatedAt && (
              <p className="text-[10px] text-muted text-center pb-1">
                {new Date(generatedAt).toLocaleTimeString('ko-KR')} 기준
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
