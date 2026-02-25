import { useStore, type Severity } from '@/store';

const SEV_BORDER: Record<Severity, string> = {
  CRITICAL: 'border-l-risk-critical bg-risk-critical/5',
  ELEVATED: 'border-l-risk-elevated bg-risk-elevated/5',
  WATCH:    'border-l-risk-watch bg-risk-watch/5',
  INFO:     'border-l-accent bg-accent/5',
};

const SEV_TEXT: Record<Severity, string> = {
  CRITICAL: 'text-risk-critical',
  ELEVATED: 'text-risk-elevated',
  WATCH:    'text-risk-watch',
  INFO:     'text-accent-light',
};

const SEV_ICON: Record<Severity, string> = {
  CRITICAL: '🚨',
  ELEVATED: '⚠️',
  WATCH:    '👁',
  INFO:     'ℹ',
};

const SENTIMENT_KO: Record<string, string> = {
  risk_on:  '↑ 상승',
  risk_off: '↓ 하락',
  neutral:  '— 중립',
  ambiguous:'~ 혼조',
};

const SENTIMENT_CLS: Record<string, string> = {
  risk_on:  'text-risk-safe',
  risk_off: 'text-risk-critical',
  neutral:  'text-muted',
  ambiguous:'text-risk-watch',
};

export function BriefingPane() {
  const { briefing, isLoading, globalRiskScore } = useStore();

  if (isLoading && !briefing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
        <span className="text-sm">브리핑 분석 중…</span>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        데이터 없음
      </div>
    );
  }

  const { narrativeKo, narrativeMethod, topInferences, marketOutlook } = briefing;
  const sentiment = marketOutlook?.kospiSentiment ?? 'neutral';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-bold text-muted uppercase tracking-widest">브리핑</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
            narrativeMethod === 'llm'
              ? 'bg-accent/20 text-accent-light'
              : 'bg-border text-muted'
          }`}>
            {narrativeMethod === 'llm' ? 'AI 생성' : '템플릿'}
          </span>
        </div>
      </div>

      {/* Narrative — heart of the app */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <p className="text-sm leading-relaxed text-secondary whitespace-pre-line">
          {narrativeKo}
        </p>
      </div>

      {/* Inference cards */}
      <div className="flex flex-col gap-2 px-4 py-3 flex-1">
        <span className="text-xs text-muted uppercase tracking-widest mb-1">
          인퍼런스 ({topInferences?.length ?? 0})
        </span>
        {topInferences?.slice(0, 5).map((inf) => (
          <div
            key={inf.ruleId}
            className={`border-l-2 pl-3 py-2 pr-2 rounded-r ${SEV_BORDER[inf.severity]}`}
          >
            <div className="flex items-start gap-1.5 mb-1">
              <span>{SEV_ICON[inf.severity]}</span>
              <span className={`text-xs font-bold leading-tight ${SEV_TEXT[inf.severity]}`}>
                {inf.titleKo}
              </span>
            </div>
            <p className="text-xs text-secondary leading-relaxed mb-1.5">{inf.summaryKo}</p>
            {inf.suggestedActionKo && (
              <p className="text-xs text-accent-light">💡 {inf.suggestedActionKo}</p>
            )}
            {inf.expectedImpact?.kospiRange && (
              <span className="text-xs text-muted mt-1 block">
                코스피 {inf.expectedImpact.kospiRange[0]}~{inf.expectedImpact.kospiRange[1]}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Market outlook footer */}
      {marketOutlook && (
        <div className="px-4 py-3 border-t border-border bg-surface/50 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-muted">코스피 전망</span>
            <span className={`text-sm font-bold ${SENTIMENT_CLS[sentiment]}`}>
              {SENTIMENT_KO[sentiment]}
            </span>
          </div>
          {marketOutlook.hedgeSuggestions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted">헤지:</span>
              {marketOutlook.hedgeSuggestions.slice(0, 3).map((h) => (
                <span key={h} className="text-xs bg-risk-watch/10 text-risk-watch px-1.5 py-0.5 rounded">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
