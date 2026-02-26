/**
 * ChartView — 멀티 차트 뷰 (2x2 그리드)
 * lightweight-charts 기반, 상단에서 종목 선택 + 각 차트 커스터마이즈
 */
import { useState, useEffect } from 'react';
import { ChartPanel } from '@/panels/ChartPanel';

interface ChartSlot {
  symbol: string;
  nameKo: string;
}

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

export function ChartView() {
  const [preset, setPreset] = useState(-1); // -1 = custom
  const [layout, setLayout] = useState<Layout>('2x2');
  const [charts, setCharts] = useState<ChartSlot[]>(() => loadCustomCharts() ?? CHART_PRESETS[0]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editSymbol, setEditSymbol] = useState('');
  const [editName, setEditName] = useState('');

  // preset 선택 시 차트 교체
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

  function openEdit(idx: number) {
    setEditSymbol(charts[idx].symbol);
    setEditName(charts[idx].nameKo);
    setEditingIdx(idx);
  }

  function applyEdit() {
    if (editingIdx === null) return;
    if (!editSymbol.trim()) return;
    const next = charts.map((c, i) =>
      i === editingIdx ? { symbol: editSymbol.trim(), nameKo: editName.trim() || editSymbol.trim() } : c
    );
    setCharts(next);
    saveCustomCharts(next);
    setPreset(-1); // custom 상태로
    setEditingIdx(null);
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
            {/* Edit button — hover로 표시 */}
            <button
              onClick={() => openEdit(idx)}
              className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity
                         text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted
                         hover:border-accent/60 hover:text-accent-light"
              title="종목 변경"
            >✏️</button>

            {/* Edit modal */}
            {editingIdx === idx && (
              <div className="absolute inset-0 z-30 bg-panel/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4">
                <p className="text-xs font-bold text-accent-light">차트 {idx + 1} 종목 변경</p>
                <div className="w-full max-w-[200px] flex flex-col gap-2">
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">티커 심볼</label>
                    <input
                      value={editSymbol}
                      onChange={e => setEditSymbol(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyEdit()}
                      placeholder="예: 005930.KS"
                      className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-primary
                                 focus:outline-none focus:border-accent/60 font-mono"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">표시 이름</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyEdit()}
                      placeholder="예: 삼성전자"
                      className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-primary
                                 focus:outline-none focus:border-accent/60"
                    />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={applyEdit}
                      className="flex-1 text-xs py-1 rounded bg-accent text-white hover:bg-accent/80 transition-colors"
                    >확인</button>
                    <button
                      onClick={() => setEditingIdx(null)}
                      className="flex-1 text-xs py-1 rounded bg-border text-secondary hover:text-primary transition-colors"
                    >취소</button>
                  </div>
                </div>
              </div>
            )}

            <div className="h-full">
              <ChartPanel symbol={c.symbol} nameKo={c.nameKo} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
