import { useStore } from '@/store';

import type { ReactNode } from 'react';

interface Props {
  onAddPanel: () => void;
  onResetLayout: () => void;
  extraActions?: ReactNode;
}

const RISK_COLOR: Record<string, string> = {
  '안정': 'text-risk-safe', '주의': 'text-risk-watch',
  '경계': 'text-risk-elevated', '심각': 'text-risk-critical', '위기': 'text-risk-critical',
};

function Tick({ label, value, pct }: { label: string; value: string; pct?: number | null }) {
  const cls = pct != null ? (pct > 0 ? 'text-risk-safe' : pct < 0 ? 'text-risk-critical' : 'text-muted') : '';
  return (
    <div className="flex items-baseline gap-1 text-xs font-mono">
      <span className="text-muted">{label}</span>
      <span className="text-primary font-semibold tabular-nums">{value}</span>
      {pct != null && <span className={`text-xs tabular-nums ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>}
    </div>
  );
}

export function TopBar({ onAddPanel, onResetLayout, extraActions }: Props) {
  const { globalRiskScore, riskLabel, kospi, usdkrw, btcKrw, kimchiPremium, isLoading, lastUpdated } = useStore();
  const riskCls = RISK_COLOR[riskLabel] ?? 'text-primary';
  const ts = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <header className="h-11 flex items-center gap-4 px-4 bg-surface border-b border-border shrink-0 overflow-x-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-accent font-bold text-base tracking-tight">🧠 MENTAT</span>
        <span className="text-muted text-xs hidden md:inline">금융 온톨로지</span>
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Risk score */}
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="text-muted text-xs">위협</span>
        <span className={`text-xl font-bold tabular-nums ${riskCls}`}>{globalRiskScore}</span>
        <span className={`text-xs font-semibold ${riskCls}`}>{riskLabel}</span>
        {isLoading && <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin ml-1" />}
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Market tickers */}
      <div className="flex items-center gap-4 flex-1 overflow-x-auto min-w-0">
        {kospi  && <Tick label="KOSPI"   value={kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} pct={kospi.changePercent} />}
        {usdkrw && <Tick label="KRW"     value={`₩${usdkrw.rate.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}`} pct={usdkrw.changePercent} />}
        {btcKrw && <Tick label="BTC"     value={`₩${Math.round(btcKrw.price).toLocaleString('ko-KR')}`} pct={btcKrw.changePercent} />}
        {kimchiPremium != null && Math.abs(kimchiPremium) >= 1 && (
          <Tick label="김치" value={`${kimchiPremium > 0 ? '+' : ''}${kimchiPremium.toFixed(1)}%`} />
        )}
        {ts && <span className="text-muted text-xs ml-auto shrink-0 hidden lg:inline">{ts}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button
          onClick={onAddPanel}
          className="text-xs px-3 py-1 bg-accent/20 text-accent-light border border-accent/40 rounded hover:bg-accent/30 transition-colors font-semibold"
        >+ 패널</button>
        <button
          onClick={onResetLayout}
          className="text-xs px-2 py-1 text-muted hover:text-primary transition-colors"
          title="레이아웃 초기화"
        >⟳</button>
        {extraActions}
      </div>
    </header>
  );
}
