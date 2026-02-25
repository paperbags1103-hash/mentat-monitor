import { useStore } from '@/store';

function SpreadGauge({ label, value, change, colorFn }: {
  label: string; value: number; change: number; colorFn: (v: number) => string;
}) {
  const color = colorFn(value);
  const up = change > 0;
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-secondary font-semibold">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}bps</span>
          <span className={`text-xs ${up ? 'text-risk-critical' : 'text-risk-safe'}`}>
            {up ? '▲' : '▼'}{Math.abs(change).toFixed(0)}
          </span>
        </div>
      </div>
      {/* Gauge bar (max scale: HY=800bps, IG=200bps) */}
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, (value / (label === 'HY 스프레드' ? 800 : 200)) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

const HY_COLOR = (v: number) => v >= 700 ? '#ef4444' : v >= 500 ? '#f97316' : v >= 300 ? '#eab308' : '#4ade80';
const IG_COLOR = (v: number) => v >= 150 ? '#ef4444' : v >= 100 ? '#f97316' : v >= 70  ? '#eab308' : '#4ade80';

const STRESS_BADGE: Record<string, string> = {
  LOW:      'bg-risk-safe/20 text-risk-safe border-risk-safe/30',
  ELEVATED: 'bg-risk-watch/20 text-risk-watch border-risk-watch/30',
  HIGH:     'bg-risk-elevated/20 text-risk-elevated border-risk-elevated/30',
  CRITICAL: 'bg-risk-critical/20 text-risk-critical border-risk-critical/30',
};
const STRESS_KO: Record<string, string> = { LOW: '안정', ELEVATED: '주의', HIGH: '경계', CRITICAL: '위험' };

export function CreditStressPanel() {
  const { creditStress } = useStore();

  if (!creditStress) {
    return <div className="flex items-center justify-center h-full text-muted text-xs">신용 데이터 로드 중…</div>;
  }

  const { igSpread, hySpread, igChange, hyChange, tedSpread, stressLevel, commentary, dataSource } = creditStress;
  const badge = STRESS_BADGE[stressLevel] ?? STRESS_BADGE.LOW;

  return (
    <div className="flex flex-col h-full px-3 py-3 overflow-y-auto">
      {/* Stress level header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${badge}`}>
          {STRESS_KO[stressLevel] ?? stressLevel}
        </span>
        <span className="text-xs text-muted">신용시장 스트레스</span>
        <span className={`ml-auto text-xs text-muted/60 ${dataSource === 'yahoo_approx' ? 'text-risk-watch/60' : ''}`}>
          {dataSource === 'fred' ? '● FRED' : '○ 추정'}
        </span>
      </div>

      {/* Spread gauges */}
      <SpreadGauge label="HY 스프레드" value={hySpread} change={hyChange} colorFn={HY_COLOR} />
      <SpreadGauge label="IG 스프레드" value={igSpread} change={igChange} colorFn={IG_COLOR} />

      {tedSpread != null && (
        <div className="flex items-baseline justify-between text-xs mb-3">
          <span className="text-secondary font-semibold">TED 스프레드</span>
          <span className="font-bold tabular-nums text-primary">{tedSpread}bps</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[['< 300', '안정', '#4ade80'], ['300-500', '주의', '#eab308'], ['500-700', '경계', '#f97316'], ['> 700', '위험', '#ef4444']].map(([r, l, c]) => (
          <div key={r} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span className="text-xs text-muted">{r} {l}</span>
          </div>
        ))}
      </div>

      {/* Commentary */}
      <div className="mt-auto pt-3 border-t border-border">
        <p className="text-xs text-secondary leading-relaxed">{commentary}</p>
      </div>
    </div>
  );
}
