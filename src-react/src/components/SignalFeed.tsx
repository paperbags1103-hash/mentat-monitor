import { useStore, type Severity } from '@/store';

const SEV_DOT: Record<Severity, string> = {
  CRITICAL: 'bg-risk-critical animate-pulse',
  ELEVATED: 'bg-risk-elevated',
  WATCH:    'bg-risk-watch',
  INFO:     'bg-accent',
};

const SEV_LABEL: Record<Severity, string> = {
  CRITICAL: '위기',
  ELEVATED: '경계',
  WATCH:    '주의',
  INFO:     '정보',
};

function relativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)    return `${Math.round(diff)}초 전`;
  if (diff < 3600)  return `${Math.round(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  return `${Math.round(diff / 86400)}일 전`;
}

function KimchiRow() {
  const { kimchiPremium } = useStore();
  if (kimchiPremium == null || Math.abs(kimchiPremium) < 1) return null;

  const isPositive = kimchiPremium > 0;
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-border/50">
      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isPositive ? 'bg-risk-safe' : 'bg-risk-critical'}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-secondary">
          🌶️ 김치 프리미엄{' '}
          <span className={`font-bold ${isPositive ? 'text-risk-safe' : 'text-risk-critical'}`}>
            {isPositive ? '+' : ''}{kimchiPremium.toFixed(1)}%
          </span>
        </span>
        <p className="text-xs text-muted mt-0.5">
          {isPositive ? '국내 BTC 수요 과열 신호' : '투자심리 위축 신호'}
        </p>
      </div>
    </div>
  );
}

export function SignalFeed() {
  const { signals, briefing, kospi, kosdaq, btcKrw } = useStore();

  const topEntities = briefing?.signalSummary?.topEntities ?? [];
  const signalCount = briefing?.signalSummary?.total ?? 0;
  const bySeverity  = briefing?.signalSummary?.bySeverity;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-bold text-muted uppercase tracking-widest">신호 피드</span>
        {signalCount > 0 && (
          <span className="text-xs text-muted">{signalCount}개 신호</span>
        )}
      </div>

      {/* Severity summary */}
      {bySeverity && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0">
          {bySeverity.CRITICAL > 0 && (
            <span className="text-xs font-bold text-risk-critical">🚨 {bySeverity.CRITICAL}</span>
          )}
          {bySeverity.ELEVATED > 0 && (
            <span className="text-xs font-bold text-risk-elevated">⚠️ {bySeverity.ELEVATED}</span>
          )}
          {bySeverity.WATCH > 0 && (
            <span className="text-xs text-risk-watch">👁 {bySeverity.WATCH}</span>
          )}
          {bySeverity.INFO > 0 && (
            <span className="text-xs text-muted">ℹ {bySeverity.INFO}</span>
          )}
        </div>
      )}

      {/* Market mini-strip */}
      <div className="px-4 py-2 border-b border-border/50 shrink-0">
        <div className="flex flex-col gap-1">
          {kospi && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted">KOSPI</span>
              <span className={kospi.changePercent >= 0 ? 'text-risk-safe' : 'text-risk-critical'}>
                {kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                {' '}({kospi.changePercent > 0 ? '+' : ''}{kospi.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
          {kosdaq && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted">KOSDAQ</span>
              <span className={kosdaq.changePercent >= 0 ? 'text-risk-safe' : 'text-risk-critical'}>
                {kosdaq.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                {' '}({kosdaq.changePercent > 0 ? '+' : ''}{kosdaq.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
          {btcKrw && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted">BTC/KRW</span>
              <span className={btcKrw.changePercent >= 0 ? 'text-risk-safe' : 'text-risk-critical'}>
                ₩{btcKrw.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Kimchi premium */}
      <div className="px-4">
        <KimchiRow />
      </div>

      {/* Inference signal list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {signals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted text-xs">
            신호 없음
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/40">
            {signals.map((sig) => (
              <div key={sig.id} className="flex items-start gap-2 py-2.5">
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${SEV_DOT[sig.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-secondary leading-snug">{sig.headlineKo}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-xs font-semibold ${
                      sig.severity === 'CRITICAL' ? 'text-risk-critical' :
                      sig.severity === 'ELEVATED' ? 'text-risk-elevated' :
                      sig.severity === 'WATCH'    ? 'text-risk-watch' : 'text-accent-light'
                    }`}>{SEV_LABEL[sig.severity]}</span>
                    <span className="text-xs text-muted">{relativeTime(sig.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top entities */}
      {topEntities.length > 0 && (
        <div className="px-4 py-2 border-t border-border shrink-0">
          <span className="text-xs text-muted block mb-1.5">핵심 엔티티</span>
          <div className="flex flex-wrap gap-1.5">
            {topEntities.slice(0, 5).map((e) => (
              <span key={e.entityId} className="text-xs bg-surface px-2 py-0.5 rounded border border-border">
                {e.nameKo}
                <em className="not-italic text-accent font-bold ml-1">{e.fusedStrength}</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
