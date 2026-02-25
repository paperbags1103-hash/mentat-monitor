/**
 * ChartView — 멀티 차트 뷰 (2x2 그리드)
 * lightweight-charts 기반, 상단에서 종목 선택
 */
import { useState } from 'react';
import { ChartPanel } from '@/panels/ChartPanel';

const CHART_PRESETS = [
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

export function ChartView() {
  const [preset, setPreset]   = useState(0);
  const [layout, setLayout]   = useState<Layout>('2x2');
  const charts = CHART_PRESETS[preset];

  const gridClass = layout === '1x1' ? 'grid-cols-1 grid-rows-1' :
                    layout === '1x2' ? 'grid-cols-2 grid-rows-1' :
                    'grid-cols-2 grid-rows-2';

  const count = layout === '1x1' ? 1 : layout === '1x2' ? 2 : 4;

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
          {charts.slice(0, count).map(c => c.nameKo).join(' · ')}
        </div>
      </div>

      {/* Chart grid */}
      <div className={`flex-1 grid ${gridClass} gap-0.5 bg-border min-h-0`}>
        {charts.slice(0, count).map(c => (
          <div key={c.symbol} className="bg-panel min-h-0 overflow-hidden">
            <div className="h-full">
              <ChartPanel symbol={c.symbol} nameKo={c.nameKo} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
