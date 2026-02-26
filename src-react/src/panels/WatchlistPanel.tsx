import React, { useMemo, useState } from 'react';
import { useWatchlistStore } from '../store/watchlist';
import { TICKER_GEO_MAP, findMatchingTickers } from '../data/watchlist-map';

interface GeoEventItem {
  id: string;
  titleKo: string;
  region: string;
  severity: string;
  category: string;
  lat: number;
  lng: number;
}

interface Props {
  geoEvents: GeoEventItem[];
}

export default function WatchlistPanel({ geoEvents }: Props) {
  const { tickers, addTicker, removeTicker } = useWatchlistStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => TICKER_GEO_MAP.filter(m => !tickers.includes(m.ticker)
      && (m.ticker.toLowerCase().includes(search.toLowerCase()) || m.nameKo.includes(search))),
    [search, tickers],
  );

  const relevantEvents = useMemo(
    () => geoEvents
      .map(ev => ({
        ...ev,
        matchedTickers: findMatchingTickers(ev.titleKo, ev.region, tickers),
      }))
      .filter(ev => ev.matchedTickers.length > 0)
      .sort((a, b) => {
        const sev = { critical: 3, high: 2, medium: 1 };
        return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0);
      }),
    [geoEvents, tickers],
  );

  const SEVERITY_COLOR: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#22c55e',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', fontSize: 12, color: '#e2e8f0', background: 'var(--color-appbase)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          관심종목 ({tickers.length}/{8})
        </div>
        {tickers.length === 0 && (
          <div style={{ color: '#475569', fontSize: 11, fontStyle: 'italic' }}>종목을 추가하세요</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tickers.map(t => {
            const meta = TICKER_GEO_MAP.find(m => m.ticker === t);
            return (
              <span
                key={t}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
                  color: '#818cf8', fontSize: 11, cursor: 'default',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{t}</span>
                {meta && <span style={{ color: '#94a3b8' }}>{meta.nameKo}</span>}
                <button
                  onClick={() => removeTicker(t)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}
                >×</button>
              </span>
            );
          })}
        </div>

        {tickers.length < 8 && (
          <div style={{ marginTop: 8, position: 'relative' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="종목 검색 (예: SK하이닉스, NVDA)"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 11,
                background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && filtered.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                maxHeight: 160, overflowY: 'auto',
              }}>
                {filtered.slice(0, 8).map(m => (
                  <div
                    key={m.ticker}
                    onClick={() => { addTicker(m.ticker); setSearch(''); }}
                    style={{
                      padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid #0f172a',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2d3f55'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{m.ticker}</span>
                    <span style={{ color: '#e2e8f0' }}>{m.nameKo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          📡 오늘의 지정학 브리핑 {relevantEvents.length > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>({relevantEvents.length}건)</span>}
        </div>

        {tickers.length === 0 && (
          <div style={{ color: '#475569', fontSize: 11 }}>관심종목을 추가하면 관련 지정학 이벤트가 여기에 표시됩니다.</div>
        )}

        {tickers.length > 0 && relevantEvents.length === 0 && (
          <div style={{ color: '#475569', fontSize: 11 }}>현재 관심종목에 영향을 줄 이벤트가 없습니다 ✅</div>
        )}

        {relevantEvents.map(ev => (
          <div
            key={ev.id}
            style={{
              marginBottom: 8, padding: '8px 10px', borderRadius: 6,
              background: '#0f172a', border: `1px solid ${(SEVERITY_COLOR[ev.severity] ?? '#334155')}33`,
              borderLeft: `3px solid ${SEVERITY_COLOR[ev.severity] ?? '#334155'}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{ev.titleKo}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>📍 {ev.region}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ev.matchedTickers.map(t => {
                const meta = TICKER_GEO_MAP.find(m => m.ticker === t);
                return (
                  <span
                    key={t}
                    style={{
                      fontSize: 9, padding: '2px 5px', borderRadius: 3,
                      background: '#1e3a5f', color: '#60a5fa', fontFamily: 'monospace', fontWeight: 700,
                    }}
                  >
                    {t}{meta ? ` ${meta.nameKo}` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
