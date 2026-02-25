import { useStore } from '@/store';

const RISK_COLOR: Record<string, string> = {
  '안정': 'text-risk-safe',
  '주의': 'text-risk-watch',
  '경계': 'text-risk-elevated',
  '심각': 'text-risk-critical',
  '위기': 'text-risk-critical',
};

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function ChangeTag({ value }: { value: number }) {
  const cls = value > 0 ? 'text-risk-safe' : value < 0 ? 'text-risk-critical' : 'text-muted';
  return (
    <span className={`text-xs ${cls}`}>
      {value > 0 ? '+' : ''}{fmt(value)}%
    </span>
  );
}

export function TopBar() {
  const { globalRiskScore, riskLabel, kospi, usdkrw, lastUpdated } = useStore();
  const riskCls = RISK_COLOR[riskLabel] ?? 'text-primary';

  const ts = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-surface border-b border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-accent font-bold text-lg tracking-tight font-mono">🧠 MENTAT</span>
        <span className="text-muted text-xs hidden sm:inline">금융 온톨로지</span>
      </div>

      {/* Risk gauge */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted text-xs">위협</span>
          <span className={`text-2xl font-bold font-mono tabular-nums ${riskCls}`}>{globalRiskScore}</span>
          <span className={`text-xs font-semibold ${riskCls}`}>{riskLabel}</span>
        </div>
      </div>

      {/* Market strip */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {kospi && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">KOSPI</span>
            <span className="text-primary font-semibold">{fmt(kospi.price, 2)}</span>
            <ChangeTag value={kospi.changePercent} />
          </div>
        )}
        {usdkrw && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">USD/KRW</span>
            <span className="text-primary font-semibold">₩{fmt(usdkrw.rate, 1)}</span>
            <ChangeTag value={usdkrw.changePercent} />
          </div>
        )}
        {ts && <span className="text-muted hidden md:inline">{ts}</span>}
      </div>
    </header>
  );
}
