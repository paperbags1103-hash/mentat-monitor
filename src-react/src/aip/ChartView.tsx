/**
 * ChartView — 멀티 차트 뷰 (2x2 그리드)
 * lightweight-charts 기반, 상단에서 종목 선택 + 검색/목록으로 종목 변경
 */
import { useState, useEffect, useMemo } from 'react';
import { ChartPanel } from '@/panels/ChartPanel';

interface ChartSlot {
  symbol: string;
  nameKo: string;
}

// ─── 종목 카탈로그 ─────────────────────────────────────────────────────────────
interface CatalogItem extends ChartSlot {
  tags?: string; // 검색용 추가 키워드
}
interface CatalogCategory {
  label: string;
  items: CatalogItem[];
}

const CATALOG: CatalogCategory[] = [
  {
    label: '📊 지수',
    items: [
      { symbol: '^KS11',   nameKo: 'KOSPI' },
      { symbol: '^KQ11',   nameKo: 'KOSDAQ' },
      { symbol: '^GSPC',   nameKo: 'S&P500', tags: 'spx sp500' },
      { symbol: '^IXIC',   nameKo: '나스닥', tags: 'nasdaq' },
      { symbol: '^DJI',    nameKo: '다우존스', tags: 'dow' },
      { symbol: '^N225',   nameKo: '니케이', tags: 'nikkei japan' },
      { symbol: '^HSI',    nameKo: '항셍', tags: 'hangseng hk' },
      { symbol: '^FTSE',   nameKo: 'FTSE100', tags: 'uk' },
    ],
  },
  {
    label: '🇰🇷 한국주식',
    items: [
      { symbol: '005930.KS', nameKo: '삼성전자' },
      { symbol: '000660.KS', nameKo: 'SK하이닉스' },
      { symbol: '012450.KS', nameKo: '한화에어로' },
      { symbol: '373220.KS', nameKo: 'LG에너지솔루션', tags: '배터리' },
      { symbol: '006400.KS', nameKo: '삼성SDI', tags: '배터리' },
      { symbol: '051910.KS', nameKo: 'LG화학' },
      { symbol: '035420.KS', nameKo: 'NAVER' },
      { symbol: '035720.KS', nameKo: '카카오' },
      { symbol: '005380.KS', nameKo: '현대차' },
      { symbol: '000270.KS', nameKo: '기아' },
      { symbol: '105560.KS', nameKo: 'KB금융' },
      { symbol: '055550.KS', nameKo: '신한지주' },
      { symbol: '329180.KS', nameKo: 'HD현대중공업', tags: '조선' },
      { symbol: '009540.KS', nameKo: 'HD한국조선해양', tags: '조선' },
      { symbol: '003670.KS', nameKo: '포스코퓨처엠', tags: '배터리' },
      { symbol: '047810.KS', nameKo: '한국항공우주', tags: '방산 kai' },
    ],
  },
  {
    label: '🇺🇸 미국주식',
    items: [
      { symbol: 'NVDA',  nameKo: '엔비디아', tags: 'nvidia ai gpu' },
      { symbol: 'AAPL',  nameKo: '애플', tags: 'apple' },
      { symbol: 'MSFT',  nameKo: '마이크로소프트', tags: 'microsoft' },
      { symbol: 'GOOGL', nameKo: '구글', tags: 'google alphabet' },
      { symbol: 'AMZN',  nameKo: '아마존', tags: 'amazon' },
      { symbol: 'META',  nameKo: '메타', tags: 'facebook' },
      { symbol: 'TSLA',  nameKo: '테슬라', tags: 'tesla' },
      { symbol: 'AMD',   nameKo: 'AMD', tags: 'gpu ai' },
      { symbol: 'TSM',   nameKo: 'TSMC', tags: '반도체' },
      { symbol: 'PLTR',  nameKo: '팔란티어', tags: 'palantir ai' },
      { symbol: 'INTC',  nameKo: '인텔', tags: 'intel' },
      { symbol: 'ASML',  nameKo: 'ASML', tags: '반도체 장비' },
      { symbol: 'NFLX',  nameKo: '넷플릭스', tags: 'netflix' },
      { symbol: 'JPM',   nameKo: 'JP모건', tags: '금융 은행' },
      { symbol: 'BAC',   nameKo: '뱅크오브아메리카', tags: '금융 은행 boa' },
    ],
  },
  {
    label: '💱 매크로/FX',
    items: [
      { symbol: 'KRW=X',    nameKo: 'USD/KRW', tags: '환율 달러 원' },
      { symbol: 'DX-Y.NYB', nameKo: 'DXY 달러인덱스', tags: '달러 dxy' },
      { symbol: '^TNX',     nameKo: '미국 10년 금리', tags: '국채 채권' },
      { symbol: '^TYX',     nameKo: '미국 30년 금리', tags: '국채 채권' },
      { symbol: '^VIX',     nameKo: 'VIX 공포지수', tags: '공포 변동성' },
      { symbol: 'EURUSD=X', nameKo: 'EUR/USD' },
      { symbol: 'JPYUSD=X', nameKo: 'JPY/USD', tags: '엔화 일본' },
      { symbol: 'CNY=X',    nameKo: 'USD/CNY', tags: '위안화 중국' },
    ],
  },
  {
    label: '🏗 원자재',
    items: [
      { symbol: 'GC=F',  nameKo: '금', tags: 'gold' },
      { symbol: 'SI=F',  nameKo: '은', tags: 'silver' },
      { symbol: 'CL=F',  nameKo: 'WTI 원유', tags: '유가 oil' },
      { symbol: 'BZ=F',  nameKo: '브렌트유', tags: '유가 oil brent' },
      { symbol: 'NG=F',  nameKo: '천연가스', tags: 'gas' },
      { symbol: 'HG=F',  nameKo: '구리', tags: 'copper' },
      { symbol: 'PL=F',  nameKo: '백금', tags: 'platinum' },
    ],
  },
  {
    label: '₿ 암호화폐',
    items: [
      { symbol: 'BTC-USD', nameKo: '비트코인', tags: 'bitcoin btc' },
      { symbol: 'ETH-USD', nameKo: '이더리움', tags: 'ethereum eth' },
      { symbol: 'SOL-USD', nameKo: '솔라나', tags: 'solana sol' },
      { symbol: 'BNB-USD', nameKo: '바이낸스', tags: 'bnb binance' },
      { symbol: 'XRP-USD', nameKo: '리플', tags: 'xrp ripple' },
    ],
  },
];

const ALL_ITEMS: CatalogItem[] = CATALOG.flatMap(c => c.items);

// ─── 프리셋 ────────────────────────────────────────────────────────────────────
const CHART_PRESETS: ChartSlot[][] = [
  [
    { symbol: '^KS11',  nameKo: 'KOSPI' },
    { symbol: '^GSPC',  nameKo: 'S&P500' },
    { symbol: 'GC=F',   nameKo: '금' },
    { symbol: '^TNX',   nameKo: '미10년금리' },
  ],
  [
    { symbol: '^KQ11',   nameKo: 'KOSDAQ' },
    { symbol: '^IXIC',   nameKo: '나스닥' },
    { symbol: 'CL=F',    nameKo: 'WTI 원유' },
    { symbol: 'BTC-USD', nameKo: '비트코인' },
  ],
  [
    { symbol: '005930.KS', nameKo: '삼성전자' },
    { symbol: '000660.KS', nameKo: 'SK하이닉스' },
    { symbol: 'NVDA',      nameKo: '엔비디아' },
    { symbol: 'TSM',       nameKo: 'TSMC' },
  ],
  [
    { symbol: 'DX-Y.NYB', nameKo: 'DXY 달러' },
    { symbol: 'KRW=X',    nameKo: 'USD/KRW' },
    { symbol: '^VIX',     nameKo: 'VIX 공포' },
    { symbol: 'HG=F',     nameKo: '구리' },
  ],
];

const PRESET_NAMES = ['주요 지수', '코스닥/나스닥', '반도체', '매크로'];
const LAYOUTS = ['1x1', '1x2', '2x2'] as const;
type Layout = typeof LAYOUTS[number];

const STORAGE_KEY = 'chartview_custom_charts';

function loadCustomCharts(): ChartSlot[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChartSlot[];
    if (Array.isArray(parsed) && parsed.every(s => s.symbol && s.nameKo)) return parsed;
  } catch {}
  return null;
}

function saveCustomCharts(charts: ChartSlot[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(charts)); } catch {}
}

// ─── 종목 선택 모달 ────────────────────────────────────────────────────────────
function SymbolPicker({ current, onSelect, onClose }: {
  current: ChartSlot;
  onSelect: (slot: ChartSlot) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName,   setCustomName]   = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null; // null = 카테고리 전체 표시
    return ALL_ITEMS.filter(item =>
      item.nameKo.toLowerCase().includes(q) ||
      item.symbol.toLowerCase().includes(q) ||
      (item.tags ?? '').toLowerCase().includes(q)
    );
  }, [query]);

  function pick(item: ChartSlot) {
    onSelect(item);
    onClose();
  }

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customSymbol.trim()) return;
    pick({ symbol: customSymbol.trim(), nameKo: customName.trim() || customSymbol.trim() });
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-panel border border-border rounded-lg w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 + 검색 */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-accent-light">종목 선택</p>
            <p className="text-[10px] text-muted">현재: {current.nameKo} ({current.symbol})</p>
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="검색: 삼성, nvidia, btc, 금..."
            autoFocus
            className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-primary
                       focus:outline-none focus:border-accent/60 placeholder-muted/60"
          />
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {filtered !== null ? (
            /* 검색 결과 */
            filtered.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">검색 결과 없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filtered.map(item => (
                  <button key={item.symbol} onClick={() => pick(item)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      item.symbol === current.symbol
                        ? 'bg-accent/20 border-accent/60 text-accent-light'
                        : 'bg-surface border-border hover:border-accent/50 text-secondary hover:text-primary'
                    }`}>
                    {item.nameKo}
                    <span className="ml-1 text-[10px] text-muted font-mono">{item.symbol}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* 카테고리 전체 목록 */
            CATALOG.map(cat => (
              <div key={cat.label} className="mb-4">
                <p className="text-[10px] text-muted font-bold mb-1.5 uppercase tracking-wider">{cat.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map(item => (
                    <button key={item.symbol} onClick={() => pick(item)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        item.symbol === current.symbol
                          ? 'bg-accent/20 border-accent/60 text-accent-light'
                          : 'bg-surface border-border hover:border-accent/50 text-secondary hover:text-primary'
                      }`}>
                      {item.nameKo}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 직접 입력 */}
        <form onSubmit={submitCustom} className="p-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted mb-2">목록에 없는 종목 직접 입력</p>
          <div className="flex gap-2">
            <input value={customSymbol} onChange={e => setCustomSymbol(e.target.value)}
              placeholder="티커 (예: 000720.KS)"
              className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-primary
                         focus:outline-none focus:border-accent/60 font-mono" />
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="이름"
              className="w-24 bg-surface border border-border rounded px-2 py-1 text-xs text-primary
                         focus:outline-none focus:border-accent/60" />
            <button type="submit"
              className="text-xs px-3 py-1 bg-accent text-white rounded hover:bg-accent/80 shrink-0">확인</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function ChartView() {
  const [preset, setPreset] = useState(-1);
  const [layout, setLayout] = useState<Layout>('2x2');
  const [charts, setCharts] = useState<ChartSlot[]>(() => loadCustomCharts() ?? CHART_PRESETS[0]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (preset >= 0) {
      const next = CHART_PRESETS[preset];
      setCharts(next);
      saveCustomCharts(next);
    }
  }, [preset]);

  const count = layout === '1x1' ? 1 : layout === '1x2' ? 2 : 4;
  const gridClass = layout === '1x1' ? 'grid-cols-1 grid-rows-1' :
                    layout === '1x2' ? 'grid-cols-2 grid-rows-1' :
                    'grid-cols-2 grid-rows-2';

  function handleSelect(idx: number, slot: ChartSlot) {
    const next = charts.map((c, i) => i === idx ? slot : c);
    setCharts(next);
    saveCustomCharts(next);
    setPreset(-1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap">
        <div className="flex gap-1">
          {PRESET_NAMES.map((name, i) => (
            <button key={i} onClick={() => setPreset(i)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                preset === i ? 'bg-accent text-white' : 'bg-border text-secondary hover:text-primary'
              }`}>{name}</button>
          ))}
          {preset === -1 && (
            <span className="text-xs px-2.5 py-1 rounded bg-surface border border-accent/40 text-accent-light">커스텀</span>
          )}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1">
          {LAYOUTS.map(l => (
            <button key={l} onClick={() => setLayout(l)}
              className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                layout === l ? 'bg-surface border border-accent/60 text-accent-light' : 'text-muted hover:text-primary'
              }`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted/60">
          차트 셀 우측 상단 ✏️ 클릭 시 종목 변경
        </div>
      </div>

      {/* Chart grid */}
      <div className={`flex-1 grid ${gridClass} gap-0.5 bg-border min-h-0`}>
        {charts.slice(0, count).map((c, idx) => (
          <div key={`${c.symbol}-${idx}`} className="bg-panel min-h-0 overflow-hidden relative group">
            <button
              onClick={() => setEditingIdx(idx)}
              className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity
                         text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted
                         hover:border-accent/60 hover:text-accent-light"
              title="종목 변경"
            >✏️</button>
            <div className="h-full">
              <ChartPanel symbol={c.symbol} nameKo={c.nameKo} />
            </div>
          </div>
        ))}
      </div>

      {/* 종목 선택 모달 */}
      {editingIdx !== null && (
        <SymbolPicker
          current={charts[editingIdx]}
          onSelect={slot => handleSelect(editingIdx, slot)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}
