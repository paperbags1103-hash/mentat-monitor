import { useState } from 'react';
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
  CRITICAL: '🚨', ELEVATED: '⚠️', WATCH: '👁', INFO: 'ℹ',
};

type Tab = 'risk' | 'opportunity';

export function BriefingPane() {
  const { briefing, isLoading } = useStore();
  const [tab, setTab] = useState<Tab>('risk');

  if (isLoading && !briefing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
        <span className="text-sm">브리핑 분석 중…</span>
      </div>
    );
  }
  if (!briefing) {
    return <div className="flex items-center justify-center h-full text-muted text-sm">데이터 없음</div>;
  }

  const {
    narrativeKo, narrativeMethod, topInferences, marketOutlook,
    opportunityKo, outlookShort, outlookMid, outlookLong, riskOn, riskOff,
  } = briefing;

  const hasOpportunity = !!(opportunityKo || outlookShort || outlookMid || outlookLong);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + 탭 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex gap-0.5">
          <button onClick={() => setTab('risk')}
            className={`text-xs px-2.5 py-1 rounded-l border transition-colors ${
              tab === 'risk'
                ? 'bg-risk-elevated/20 text-risk-elevated border-risk-elevated/50 font-semibold'
                : 'text-muted border-border hover:text-primary'
            }`}>🛡️ 위협</button>
          <button onClick={() => setTab('opportunity')}
            className={`text-xs px-2.5 py-1 rounded-r border transition-colors ${
              tab === 'opportunity'
                ? 'bg-accent/20 text-accent-light border-accent/50 font-semibold'
                : 'text-muted border-border hover:text-primary'
            }`}>💰 투자기회</button>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
          narrativeMethod === 'llm' ? 'bg-accent/20 text-accent-light' : 'bg-border text-muted'
        }`}>
          {narrativeMethod === 'llm' ? 'AI' : '템플릿'}
        </span>
      </div>

      {/* ─── 위협 탭 ─── */}
      {tab === 'risk' && (
        <div className="flex-1 overflow-y-auto">
          {/* Narrative */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm leading-relaxed text-secondary whitespace-pre-line">{narrativeKo}</p>
          </div>

          {/* Inference cards */}
          <div className="flex flex-col gap-2 px-4 py-3">
            <span className="text-xs text-muted uppercase tracking-widest mb-1">
              위협 신호 ({topInferences?.length ?? 0})
            </span>
            {topInferences?.slice(0, 5).map(inf => (
              <div key={inf.ruleId}
                className={`border-l-2 pl-3 py-2 pr-2 rounded-r ${SEV_BORDER[inf.severity]}`}>
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
            <div className="px-4 py-3 border-t border-border bg-surface/50">
              {marketOutlook.hedgeSuggestions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted">헤지:</span>
                  {marketOutlook.hedgeSuggestions.slice(0, 3).map(h => (
                    <span key={h} className="text-xs bg-risk-watch/10 text-risk-watch px-1.5 py-0.5 rounded">{h}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── 투자기회 탭 ─── */}
      {tab === 'opportunity' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {!hasOpportunity ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <p className="text-xs text-muted">Groq AI 분석이 활성화되면</p>
              <p className="text-xs text-muted/60">자금 흐름 + 단기/중기/장기 전망이 표시됩니다</p>
            </div>
          ) : (
            <>
              {/* 자금 흐름 */}
              {opportunityKo && (
                <div>
                  <p className="text-xs font-bold text-accent-light mb-1.5">💹 자금 흐름 분석</p>
                  <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">{opportunityKo}</p>
                </div>
              )}

              {/* 단기/중기/장기 전망 */}
              {(outlookShort || outlookMid || outlookLong) && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest">투자 전망</p>
                  {outlookShort && (
                    <div className="bg-surface/60 rounded p-3 border border-border/60">
                      <p className="text-xs font-bold text-green-400 mb-1">📅 단기 (1개월)</p>
                      <p className="text-xs text-secondary leading-relaxed">{outlookShort}</p>
                    </div>
                  )}
                  {outlookMid && (
                    <div className="bg-surface/60 rounded p-3 border border-border/60">
                      <p className="text-xs font-bold text-yellow-400 mb-1">📆 중기 (3-6개월)</p>
                      <p className="text-xs text-secondary leading-relaxed">{outlookMid}</p>
                    </div>
                  )}
                  {outlookLong && (
                    <div className="bg-surface/60 rounded p-3 border border-border/60">
                      <p className="text-xs font-bold text-blue-400 mb-1">🔭 장기 (1년+)</p>
                      <p className="text-xs text-secondary leading-relaxed">{outlookLong}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 리스크 온/오프 */}
              {((riskOn?.length ?? 0) > 0 || (riskOff?.length ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {(riskOn?.length ?? 0) > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
                      <p className="text-xs font-bold text-green-400 mb-2">📈 리스크 ON</p>
                      {riskOn!.map((item, i) => (
                        <p key={i} className="text-xs text-secondary mb-1">▸ {item}</p>
                      ))}
                    </div>
                  )}
                  {(riskOff?.length ?? 0) > 0 && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                      <p className="text-xs font-bold text-blue-400 mb-2">🛡️ 리스크 OFF</p>
                      {riskOff!.map((item, i) => (
                        <p key={i} className="text-xs text-secondary mb-1">▸ {item}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
