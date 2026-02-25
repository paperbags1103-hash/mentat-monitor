import { useStore } from '@/store';

function ModuleGauge({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 70 ? '#ef4444' : score >= 45 ? '#f97316' : score >= 25 ? '#eab308' : '#4ade80';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-secondary">{label}</span>
        <div className="flex gap-2">
          <span className="text-muted">{weight}%</span>
          <span className="font-bold tabular-nums" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const MODULE_WEIGHTS: Record<string, number> = {
  financial: 40, pandemic: 20, nuclear: 15, cyber: 10, geopolitical: 10, supplyChain: 5
};

export function BlackSwanPanel() {
  const { blackSwan, globalRiskScore, riskLabel } = useStore();

  const RISK_COLOR = globalRiskScore >= 80 ? 'text-risk-critical' :
    globalRiskScore >= 60 ? 'text-risk-elevated' :
    globalRiskScore >= 40 ? 'text-risk-watch' :
    globalRiskScore >= 20 ? 'text-risk-safe' : 'text-accent-light';

  return (
    <div className="flex flex-col h-full px-3 py-3 overflow-y-auto">
      {/* Total score */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <div>
          <div className={`text-3xl font-bold tabular-nums ${RISK_COLOR}`}>
            {blackSwan?.tailRiskScore ?? globalRiskScore}
          </div>
          <div className={`text-xs font-semibold ${RISK_COLOR}`}>테일 리스크 지수</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-sm font-bold ${RISK_COLOR}`}>{riskLabel}</div>
          <div className="text-xs text-muted">위협 등급</div>
        </div>
      </div>

      {/* Modules */}
      {blackSwan?.modules ? (
        Object.entries(blackSwan.modules)
          .sort(([a], [b]) => (MODULE_WEIGHTS[b] ?? 0) - (MODULE_WEIGHTS[a] ?? 0))
          .map(([key, mod]) => (
            <ModuleGauge key={key} label={mod.label} score={mod.score} weight={MODULE_WEIGHTS[key] ?? 0} />
          ))
      ) : (
        <div className="flex items-center justify-center flex-1 text-muted text-xs">
          블랙스완 데이터 로드 중…
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
        {[['< 20', '안정', '#4ade80'], ['20-40', '주의', '#eab308'], ['40-60', '경계', '#f97316'], ['> 60', '위험', '#ef4444']].map(([range, label, color]) => (
          <div key={range} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-muted">{range} {label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
