/**
 * LiveFeed — 오른쪽 라이브 피드 패널
 * 신호 + AI 인퍼런스 + 행동 제안 통합
 * 팔란티어 AIP 스타일: 타임라인 피드
 */
import { useState } from 'react';
import { useStore, type Severity, type Inference } from '@/store';

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: 'text-risk-critical border-risk-critical/50 bg-risk-critical/5',
  ELEVATED: 'text-risk-elevated border-risk-elevated/50 bg-risk-elevated/5',
  WATCH:    'text-risk-watch border-risk-watch/30 bg-risk-watch/5',
  INFO:     'text-accent-light border-accent/30 bg-accent/5',
};

const SEV_DOT: Record<Severity, string> = {
  CRITICAL: 'bg-risk-critical animate-pulse',
  ELEVATED: 'bg-risk-elevated',
  WATCH:    'bg-risk-watch',
  INFO:     'bg-accent',
};

const SEV_KO: Record<Severity, string> = {
  CRITICAL: '🚨 위기', ELEVATED: '⚠️ 경계', WATCH: '👁 주의', INFO: 'ℹ 정보'
};

function InferenceCard({ inf }: { inf: Inference }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`border-l-2 rounded-r-lg p-2.5 mb-2 cursor-pointer transition-colors ${SEV_COLORS[inf.severity]}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-1.5 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${SEV_DOT[inf.severity]}`} />
        <span className="text-xs font-bold leading-tight flex-1">{inf.titleKo}</span>
        <span className="text-xs text-muted shrink-0">{SEV_KO[inf.severity]}</span>
      </div>
      {expanded && (
        <>
          <p className="text-xs text-secondary leading-relaxed mb-1.5 ml-3">{inf.summaryKo}</p>
          {inf.suggestedActionKo && (
            <div className="ml-3 flex items-start gap-1">
              <span className="text-xs text-accent-light">💡</span>
              <p className="text-xs text-accent-light">{inf.suggestedActionKo}</p>
            </div>
          )}
          {inf.expectedImpact?.kospiRange && (
            <p className="text-xs text-muted ml-3 mt-1">
              KOSPI: {inf.expectedImpact.kospiRange[0]}~{inf.expectedImpact.kospiRange[1]}%
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5 ml-3">
            <span className="text-xs text-muted">신뢰도</span>
            <div className="flex-1 h-1 bg-black/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-current opacity-60"
                style={{ width: `${(inf.confidence ?? 0) * 100}%` }} />
            </div>
            <span className="text-xs text-muted">{Math.round((inf.confidence ?? 0) * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}

type Tab = 'all' | 'critical' | 'themes' | 'briefing';

export function LiveFeed() {
  const { briefing, signals, activeThemes, isLoading, lastUpdated } = useStore();
  const [tab, setTab] = useState<Tab>('all');

  const inferences = briefing?.topInferences ?? [];
  const criticals  = inferences.filter(i => i.severity === 'CRITICAL' || i.severity === 'ELEVATED');
  const ts = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-primary uppercase tracking-widest">LIVE FEED</span>
          {isLoading && <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />}
          {!isLoading && <div className="w-2 h-2 bg-risk-safe rounded-full" />}
          {ts && <span className="text-xs text-muted ml-auto">{ts}</span>}
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {([['all', '전체'], ['critical', '위기'], ['themes', '테마'], ['briefing', '브리핑']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                tab === id ? 'bg-accent text-white' : 'bg-border text-muted hover:text-primary'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {tab === 'all' && (
          <>
            {inferences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                {isLoading
                  ? <div className="text-xs text-muted animate-pulse">🔄 분석 중...</div>
                  : <>
                    <div className="text-xs text-muted">📡 실시간 신호 수집 중</div>
                    <div className="text-xs text-muted/50">데이터 로드 후 인퍼런스가 표시됩니다</div>
                  </>
                }
              </div>
            ) : (
              inferences.map(inf => <InferenceCard key={inf.ruleId} inf={inf} />)
            )}
            {signals.length > 0 && (
              <>
                <div className="text-xs text-muted uppercase tracking-widest mt-3 mb-2">신호</div>
                {signals.map(sig => (
                  <div key={sig.id} className="flex items-start gap-2 py-1.5 border-b border-border/30">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${SEV_DOT[sig.severity]}`} />
                    <p className="text-xs text-secondary leading-snug">{sig.headlineKo}</p>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'critical' && (
          <>
            {criticals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted text-xs">
                <span className="text-2xl">✅</span>
                <span>위기/경계 신호 없음</span>
              </div>
            ) : (
              criticals.map(inf => <InferenceCard key={inf.ruleId} inf={inf} />)
            )}
          </>
        )}

        {tab === 'themes' && (
          <>
            {activeThemes.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted text-xs">테마 발견 중…</div>
            ) : (
              activeThemes.map(t => (
                <div key={t.id} className="border border-border rounded-lg p-2.5 mb-2">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-primary">{t.nameKo}</span>
                    <span className={`text-xs font-semibold ${
                      t.momentum === 'rising' ? 'text-risk-safe' : t.momentum === 'falling' ? 'text-risk-critical' : 'text-muted'
                    }`}>{t.momentum === 'rising' ? '↑' : t.momentum === 'falling' ? '↓' : '→'} {t.strength}</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full" style={{
                      width: `${t.strength}%`,
                      background: t.strength >= 70 ? '#ef4444' : t.strength >= 45 ? '#f97316' : '#eab308',
                    }} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(t.koreanStocks ?? []).slice(0, 3).map(s => (
                      <span key={s} className="text-xs bg-accent/10 text-accent-light px-1 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'briefing' && (
          <>
            {briefing ? (
              <div className="space-y-3">
                <div className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                  {briefing.narrativeKo}
                </div>
                {briefing.marketOutlook && (
                  <div className="border-t border-border pt-3">
                    <div className="text-xs text-muted mb-1.5">📊 코스피 전망</div>
                    <div className={`text-xs font-bold mb-2 ${
                      briefing.marketOutlook.kospiSentiment === 'risk_on' ? 'text-risk-safe' :
                      briefing.marketOutlook.kospiSentiment === 'risk_off' ? 'text-risk-critical' : 'text-muted'
                    }`}>
                      {briefing.marketOutlook.kospiSentiment === 'risk_on' ? '↑ 상승 기대' :
                       briefing.marketOutlook.kospiSentiment === 'risk_off' ? '↓ 하락 우려' : '— 중립'}
                    </div>
                    {briefing.marketOutlook.keyRisks?.slice(0, 3).map((r, i) => (
                      <p key={i} className="text-xs text-risk-elevated">⚡ {r}</p>
                    ))}
                    {briefing.marketOutlook.keyOpportunities?.slice(0, 2).map((o, i) => (
                      <p key={i} className="text-xs text-risk-safe mt-0.5">✨ {o}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted text-xs text-center py-8">브리핑 데이터 없음</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
