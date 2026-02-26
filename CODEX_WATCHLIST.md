# Task: My Watchlist Geopolitical Radar

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Korean retail investors want to know: "What geopolitical events today will impact MY stocks?"
Build a personalized watchlist feature that:
1. Lets user add up to 8 Korean/US tickers to their watchlist (stored in localStorage)
2. Maps each ticker to related geographic regions, supply chain nodes, and geopolitical themes (static JSON lookup)
3. When geo-events load, automatically highlights events that match watchlist tickers → shows a badge count
4. Shows a "오늘의 브리핑" (Today's Briefing) panel filtered to watchlist-relevant events

## Files to Edit/Create

1. `src-react/src/data/watchlist-map.ts` — CREATE NEW: static ticker → geo mapping
2. `src-react/src/store/watchlist.ts` — CREATE NEW: Zustand store for watchlist
3. `src-react/src/panels/WatchlistPanel.tsx` — CREATE NEW: watchlist management UI panel
4. `src-react/src/aip/WorldMapView.tsx` — ADD watchlist geo-event matching + badge overlay

Do NOT touch any other files.

---

## PART 1: `src-react/src/data/watchlist-map.ts`

Create a static mapping table: ticker → { regions, themes, supplyChainKeywords }.

```typescript
export interface TickerGeoMapping {
  ticker: string;
  nameKo: string;
  regions: string[];           // geo region names to match (partial string match)
  themes: string[];            // theme keywords for matching
  supplyChainKeywords: string[]; // keywords to match in event titles/descriptions
}

export const TICKER_GEO_MAP: TickerGeoMapping[] = [
  {
    ticker: '000660',
    nameKo: 'SK하이닉스',
    regions: ['대만', '중국', '미국', '대만해협'],
    themes: ['반도체', 'HBM', 'AI', '수출통제', 'TSMC'],
    supplyChainKeywords: ['semiconductor', 'chip', 'TSMC', 'Taiwan', 'export control', 'HBM', 'DRAM'],
  },
  {
    ticker: '005930',
    nameKo: '삼성전자',
    regions: ['중국', '대만', '미국', '베트남'],
    themes: ['반도체', '스마트폰', '수출통제'],
    supplyChainKeywords: ['Samsung', 'semiconductor', 'chip', 'smartphone', 'display'],
  },
  {
    ticker: '011200',
    nameKo: 'HMM',
    regions: ['수에즈', '홍해', '말라카', '파나마', '대만해협'],
    themes: ['해운', '물류', '운임'],
    supplyChainKeywords: ['Suez', 'Red Sea', 'shipping', 'freight', 'container', 'Houthi'],
  },
  {
    ticker: '012450',
    nameKo: '한화에어로스페이스',
    regions: ['우크라이나', '중동', '대만', '북한'],
    themes: ['방산', '전쟁', '군비'],
    supplyChainKeywords: ['defense', 'military', 'war', 'conflict', 'NATO', 'arms'],
  },
  {
    ticker: '096770',
    nameKo: 'SK이노베이션',
    regions: ['호르무즈', '사우디', '이란', '러시아'],
    themes: ['원유', '에너지', '정유'],
    supplyChainKeywords: ['oil', 'crude', 'energy', 'OPEC', 'Iran', 'Saudi', 'refinery'],
  },
  {
    ticker: '035420',
    nameKo: 'NAVER',
    regions: ['미국', '일본'],
    themes: ['AI', '빅테크', '규제'],
    supplyChainKeywords: ['AI', 'tech regulation', 'data', 'antitrust'],
  },
  {
    ticker: '373220',
    nameKo: 'LG에너지솔루션',
    regions: ['중국', '미국', '칠레', '콩고'],
    themes: ['배터리', 'EV', '리튬', '코발트'],
    supplyChainKeywords: ['battery', 'lithium', 'cobalt', 'EV', 'electric vehicle', 'IRA'],
  },
  {
    ticker: 'NVDA',
    nameKo: 'NVIDIA',
    regions: ['대만', '중국', '미국'],
    themes: ['AI', '반도체', '수출통제', 'GPU'],
    supplyChainKeywords: ['NVIDIA', 'GPU', 'AI chip', 'TSMC', 'export control'],
  },
  {
    ticker: 'TSLA',
    nameKo: 'Tesla',
    regions: ['중국', '독일', '미국'],
    themes: ['EV', '배터리', '무역관세'],
    supplyChainKeywords: ['Tesla', 'EV', 'tariff', 'China market', 'Gigafactory'],
  },
  {
    ticker: '005380',
    nameKo: '현대차',
    regions: ['미국', '인도', '중국'],
    themes: ['자동차', 'EV', '관세', '무역'],
    supplyChainKeywords: ['auto', 'tariff', 'trade war', 'EV', 'Hyundai'],
  },
];

export function findMatchingTickers(
  eventText: string,
  eventRegion: string,
  watchlistTickers: string[],
): string[] {
  const text = (eventText + ' ' + eventRegion).toLowerCase();
  return TICKER_GEO_MAP
    .filter(m => watchlistTickers.includes(m.ticker))
    .filter(m =>
      m.regions.some(r => text.includes(r.toLowerCase())) ||
      m.themes.some(t => text.includes(t.toLowerCase())) ||
      m.supplyChainKeywords.some(k => text.includes(k.toLowerCase()))
    )
    .map(m => m.ticker);
}
```

---

## PART 2: `src-react/src/store/watchlist.ts`

```typescript
import { create } from 'zustand';
import { TICKER_GEO_MAP } from '../data/watchlist-map';

const STORAGE_KEY = 'mentat-watchlist-v1';
const MAX_TICKERS = 8;

interface WatchlistState {
  tickers: string[];       // list of ticker strings
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  hasTicker: (ticker: string) => boolean;
}

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveToStorage(tickers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  tickers: loadFromStorage(),
  addTicker: (ticker: string) => {
    const { tickers } = get();
    if (tickers.includes(ticker) || tickers.length >= MAX_TICKERS) return;
    const next = [...tickers, ticker];
    saveToStorage(next);
    set({ tickers: next });
  },
  removeTicker: (ticker: string) => {
    const next = get().tickers.filter(t => t !== ticker);
    saveToStorage(next);
    set({ tickers: next });
  },
  hasTicker: (ticker: string) => get().tickers.includes(ticker),
}));
```

---

## PART 3: `src-react/src/panels/WatchlistPanel.tsx`

A panel that allows managing the watchlist and shows today's briefing.

- Show current watchlist (up to 8 tickers)
- Show a dropdown/search to add tickers from TICKER_GEO_MAP
- Show a "오늘의 지정학 브리핑" section listing geo-events that match any watchlist ticker
- Each event shows which tickers it affects (small badges)

```tsx
import React, { useState } from 'react';
import { useWatchlistStore } from '../store/watchlist';
import { TICKER_GEO_MAP, findMatchingTickers } from '../data/watchlist-map';

interface Props {
  geoEvents: Array<{
    id: string;
    titleKo: string;
    region: string;
    severity: string;
    category: string;
    lat: number;
    lng: number;
  }>;
}

export default function WatchlistPanel({ geoEvents }: Props) {
  const { tickers, addTicker, removeTicker } = useWatchlistStore();
  const [search, setSearch] = useState('');

  const filtered = TICKER_GEO_MAP.filter(m =>
    !tickers.includes(m.ticker) &&
    (m.ticker.toLowerCase().includes(search.toLowerCase()) ||
     m.nameKo.includes(search))
  );

  // Match geo events to watchlist
  const relevantEvents = geoEvents
    .map(ev => ({
      ...ev,
      matchedTickers: findMatchingTickers(ev.titleKo, ev.region, tickers),
    }))
    .filter(ev => ev.matchedTickers.length > 0)
    .sort((a, b) => {
      const sev = { critical: 3, high: 2, medium: 1 };
      return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0);
    });

  const SEVERITY_COLOR: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#22c55e',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', fontSize: 12, color: '#e2e8f0', background: 'var(--color-appbase)' }}>
      {/* Watchlist tickers */}
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

        {/* Add ticker */}
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
                    onMouseEnter={e => (e.currentTarget.style.background = '#2d3f55')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

      {/* Today's briefing */}
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
              background: '#0f172a', border: `1px solid ${SEVERITY_COLOR[ev.severity] ?? '#334155'}33`,
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
```

---

## PART 4: Integrate WatchlistPanel into the app

### 4A: Add to a panel in `src-react/src/panels/`

Create `src-react/src/panels/WatchlistPanelWrapper.tsx`:

```tsx
import React from 'react';
import WatchlistPanel from './WatchlistPanel';
import { useGeopoliticsStore } from '../store/geopolitics'; // use existing store if available

// This wrapper fetches geoEvents from the appropriate store/context
// If there's no shared geoEvents store, accept it as a prop from the parent
export default function WatchlistPanelWrapper({ geoEvents = [] }: { geoEvents?: any[] }) {
  return <WatchlistPanel geoEvents={geoEvents} />;
}
```

### 4B: Add geo-event badge matching in `WorldMapView.tsx`

1. Import `findMatchingTickers` and `useWatchlistStore` at the top of `WorldMapView.tsx`
2. Get `tickers` from `useWatchlistStore()`
3. When rendering geo-event markers on the map, compute matched tickers for each event:
   ```typescript
   const matched = findMatchingTickers(ev.titleKo, ev.region, tickers);
   ```
4. If `matched.length > 0`, add a **yellow star badge** (⭐) or a small pulsing ring around the event marker:
   - Add a `CircleMarker` with yellow color (`#fbbf24`) underneath the existing event marker
   - Or add a small label near the marker showing the matched ticker codes

5. Add a **watchlist alert badge** in the map control bar: 
   - Show "⭐ 관심종목 {N}건" badge in the top-left of the map (near layer controls) when `relevantCount > 0`
   - `relevantCount` = geo-events that have at least one matched ticker from watchlist

### 4C: Register WatchlistPanel in the AIP panel grid

In the existing AIP panel registration (likely in `AIPLayout.tsx` or similar), add a new panel with:
- id: `'watchlist'`
- title: `'📡 관심종목 레이더'`
- component: `WatchlistPanelWrapper` (pass geoEvents prop)

Look at how other panels are registered in the codebase and follow the same pattern.

---

## Important Notes

- Look at existing TypeScript interfaces (especially `GeoEvent`) in `WorldMapView.tsx` or nearby files to use the correct type for geoEvents prop
- The `geoEvents` state in `WorldMapView.tsx` is fetched inside that component — pass it down or use a shared store
- Follow existing code style (no semicolons if the project uses none, match indentation)
- Use `'var(--color-appbase)'` for panel backgrounds, `'var(--color-accent)'` for accent colors
- Check existing panel imports in the layout file before adding new ones

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -30
```

Fix all TypeScript errors. Then commit:
`feat: My Watchlist Geopolitical Radar — 관심종목 지정학 레이더 + 오늘의 브리핑`

Then run:
```
openclaw system event --text "Done: Watchlist Geopolitical Radar complete" --mode now
```
