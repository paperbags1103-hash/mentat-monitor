/**
 * AIPLayout — 팔란티어 AIP 스타일 레이아웃
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ TopBar: 위협 | KOSPI | KRW | VIX | 공포탐욕 | 시간     │
 * ├────┬────────────────────────────────────┬───────────────┤
 * │    │                                    │               │
 * │ 사 │   메인 뷰 (지도/히트맵/차트)       │  LIVE FEED    │
 * │ 이 │                                    │  (신호/테마/  │
 * │ 드 │                                    │   브리핑)     │
 * │ 바 │                                    │               │
 * │    ├────────────────────────────────────┤               │
 * │    │  하단 스트립 (지표 스크롤)         │               │
 * └────┴────────────────────────────────────┴───────────────┘
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { useStore } from '@/store';
import { Sidebar }      from './Sidebar';
const WorldMapView = lazy(() => import('./WorldMapView').then(m => ({ default: m.WorldMapView })));
import { HeatMapView }  from './HeatMapView';
import { ChartView }    from './ChartView';
import { LiveFeed }     from './LiveFeed';
import { BottomStrip }  from './BottomStrip';
import { PanelGrid }    from '@/layout/PanelGrid';
import { PanelCatalog } from '@/layout/PanelCatalog';
import { useLayoutStore } from '@/store';

export type MainViewType = 'map' | 'heatmap' | 'charts' | 'grid';

const RISK_COLOR: Record<string, string> = {
  '안정': 'text-risk-safe', '주의': 'text-risk-watch',
  '경계': 'text-risk-elevated', '심각': 'text-risk-critical', '위기': 'text-risk-critical',
};

function AIPTopBar({ onLayoutSwitch }: { onLayoutSwitch: () => void }) {
  const { globalRiskScore, riskLabel, kospi, usdkrw, vix, isLoading, lastUpdated } = useStore();
  const resetLayout = useLayoutStore(s => s.resetLayout);
  const [showCatalog, setShowCatalog] = useState(false);

  const riskCls = RISK_COLOR[riskLabel] ?? 'text-primary';
  const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="h-11 flex items-center gap-3 px-3 bg-surface border-b border-border shrink-0 overflow-x-auto">
      {/* Risk badge */}
      <div className={`flex items-baseline gap-1 shrink-0 px-2 py-0.5 rounded border ${
        globalRiskScore >= 70 ? 'border-risk-critical/50 bg-risk-critical/10' :
        globalRiskScore >= 40 ? 'border-risk-elevated/50 bg-risk-elevated/10' :
        'border-border bg-surface'
      }`}>
        <span className="text-xs text-muted">RISK</span>
        <span className={`text-base font-bold tabular-nums ${riskCls}`}>{globalRiskScore}</span>
        <span className={`text-xs ${riskCls}`}>{riskLabel}</span>
        {isLoading && <span className="w-2 h-2 border border-accent border-t-transparent rounded-full animate-spin ml-1" />}
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Tickers */}
      <div className="flex items-center gap-4 flex-1 overflow-x-auto min-w-0">
        {kospi && (
          <div className="flex items-baseline gap-1 text-xs font-mono shrink-0">
            <span className="text-muted">KOSPI</span>
            <span className="font-bold text-primary tabular-nums">{kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
            <span className={kospi.changePercent >= 0 ? 'text-risk-safe' : 'text-risk-critical'}>
              {kospi.changePercent >= 0 ? '+' : ''}{kospi.changePercent.toFixed(2)}%
            </span>
          </div>
        )}
        {usdkrw && (
          <div className="flex items-baseline gap-1 text-xs font-mono shrink-0">
            <span className="text-muted">USD/KRW</span>
            <span className="font-bold text-primary tabular-nums">₩{usdkrw.rate.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}</span>
            <span className={usdkrw.changePercent >= 0 ? 'text-risk-critical' : 'text-risk-safe'}>
              {usdkrw.changePercent >= 0 ? '+' : ''}{usdkrw.changePercent.toFixed(2)}%
            </span>
          </div>
        )}
        {vix && (
          <div className="flex items-baseline gap-1 text-xs font-mono shrink-0">
            <span className="text-muted">VIX</span>
            <span className={`font-bold tabular-nums ${vix.price >= 30 ? 'text-risk-critical' : vix.price >= 20 ? 'text-risk-watch' : 'text-risk-safe'}`}>
              {vix.price.toFixed(2)}
            </span>
          </div>
        )}
        <div className="text-xs text-muted font-mono ml-auto shrink-0 hidden lg:block">{now}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => setShowCatalog(true)}
          className="text-xs px-2.5 py-1 bg-accent/20 text-accent-light border border-accent/40 rounded hover:bg-accent/30 transition-colors font-semibold">
          + 패널
        </button>
        <button onClick={resetLayout}
          className="text-xs px-2 py-1 text-muted hover:text-primary transition-colors" title="레이아웃 초기화">⟳</button>
        <button onClick={onLayoutSwitch}
          className="text-xs px-2 py-1 bg-border text-secondary hover:text-primary rounded transition-colors" title="그리드 모드 전환">
          ⊞ 그리드
        </button>
      </div>

      {showCatalog && <PanelCatalog onClose={() => setShowCatalog(false)} />}
    </header>
  );
}

interface Props {
  onSwitchToGrid: () => void;
}

export function AIPLayout({ onSwitchToGrid }: Props) {
  const { fetchAll, globalRiskScore } = useStore();
  const [mainView, setMainView] = useState<MainViewType>('heatmap');

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  function handleViewChange(v: MainViewType) {
    if (v === 'grid') { onSwitchToGrid(); return; }
    setMainView(v);
  }

  return (
    <div className="flex flex-col h-screen bg-base text-primary font-mono overflow-hidden">
      <AIPTopBar onLayoutSwitch={onSwitchToGrid} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar activeView={mainView} onViewChange={handleViewChange} riskScore={globalRiskScore} />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Main view */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {mainView === 'map'     && <Suspense fallback={<div className="flex items-center justify-center h-full text-muted">지도 로딩 중...</div>}><WorldMapView /></Suspense>}
            {mainView === 'heatmap' && <HeatMapView />}
            {mainView === 'charts'  && <ChartView />}
            {mainView === 'grid'    && <PanelGrid />}
          </div>

          {/* Bottom strip */}
          <BottomStrip />
        </div>

        {/* Live feed — right panel */}
        <div className="w-72 shrink-0 min-h-0 overflow-hidden">
          <LiveFeed />
        </div>
      </div>
    </div>
  );
}
