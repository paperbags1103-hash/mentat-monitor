/**
 * Action Panel — 팔란티어 온톨로지 "Action" 레이어
 * Inference의 suggestedActionKo를 구조화된 행동 카드로 변환
 * 각 행동은: 유형(HEDGE/REDUCE/INCREASE/WATCH/HOLD) + 조건 + 예상 영향 + 긴급도
 */
import { useStore, type Inference, type Severity } from '@/store';

type ActionType = 'HEDGE' | 'REDUCE' | 'INCREASE' | 'WATCH' | 'HOLD' | 'ALERT';

interface ActionCard {
  id: string;
  type: ActionType;
  titleKo: string;
  bodyKo: string;
  severity: Severity;
  confidence: number;
  assets?: string[];
}

const ACTION_META: Record<ActionType, { emoji: string; ko: string; cls: string }> = {
  HEDGE:    { emoji: '🛡', ko: '헤지',    cls: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
  REDUCE:   { emoji: '📉', ko: '비중 축소', cls: 'border-risk-elevated/40 bg-risk-elevated/5 text-risk-elevated' },
  INCREASE: { emoji: '📈', ko: '비중 확대', cls: 'border-risk-safe/40 bg-risk-safe/5 text-risk-safe' },
  WATCH:    { emoji: '👁',  ko: '모니터링', cls: 'border-risk-watch/40 bg-risk-watch/5 text-risk-watch' },
  HOLD:     { emoji: '✋', ko: '유지',    cls: 'border-border/40 bg-surface text-muted' },
  ALERT:    { emoji: '🚨', ko: '즉시 대응', cls: 'border-risk-critical/40 bg-risk-critical/5 text-risk-critical' },
};

// Infer action type from severity + text
function inferActionType(inf: Inference): ActionType {
  const text = (inf.suggestedActionKo ?? '').toLowerCase();
  if (inf.severity === 'CRITICAL') return 'ALERT';
  if (text.includes('헤지') || text.includes('안전')) return 'HEDGE';
  if (text.includes('축소') || text.includes('매도') || text.includes('줄')) return 'REDUCE';
  if (text.includes('확대') || text.includes('매수') || text.includes('늘')) return 'INCREASE';
  if (text.includes('모니터') || text.includes('주시')) return 'WATCH';
  if (inf.severity === 'ELEVATED') return 'HEDGE';
  return 'WATCH';
}

// Extract asset mentions from inference
function extractAssets(inf: Inference): string[] {
  const impact = inf.expectedImpact;
  const assets: string[] = [];
  if (impact?.safeHavens)          assets.push(...impact.safeHavens.slice(0, 3));
  if (impact?.krwDirection === 'weaken') assets.push('USD/KRW ↑');
  if (impact?.krwDirection === 'strengthen') assets.push('USD/KRW ↓');
  if (impact?.kospiRange) {
    const [lo, hi] = impact.kospiRange;
    assets.push(`KOSPI ${lo > 0 ? '+' : ''}${lo}%~${hi > 0 ? '+' : ''}${hi}%`);
  }
  return assets;
}

function deriveActions(inferences: Inference[]): ActionCard[] {
  return inferences
    .filter(i => i.severity === 'CRITICAL' || i.severity === 'ELEVATED' || i.severity === 'WATCH')
    .map(inf => ({
      id:         inf.ruleId,
      type:       inferActionType(inf),
      titleKo:    inf.titleKo,
      bodyKo:     inf.suggestedActionKo ?? inf.summaryKo,
      severity:   inf.severity,
      confidence: inf.confidence,
      assets:     extractAssets(inf),
    }));
}

function ActionCardView({ card }: { card: ActionCard }) {
  const meta = ACTION_META[card.type];
  return (
    <div className={`rounded border p-3 mb-2 ${meta.cls}`}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-base leading-none mt-0.5">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.ko}</span>
            <span className="text-xs text-muted">신뢰도 {Math.round(card.confidence * 100)}%</span>
          </div>
          <p className="text-xs font-semibold text-primary mt-1 leading-snug">{card.titleKo}</p>
        </div>
      </div>
      <p className="text-xs text-secondary leading-relaxed ml-7">{card.bodyKo}</p>
      {card.assets && card.assets.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 ml-7">
          {card.assets.map((a, i) => (
            <span key={i} className="text-xs bg-black/20 px-1.5 py-0.5 rounded text-muted border border-white/5">{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionPanel() {
  const { briefing, creditStress, globalMacro } = useStore();

  const actions = deriveActions(briefing?.topInferences ?? []);

  // Add macro-derived actions
  const extraActions: ActionCard[] = [];

  if (creditStress?.stressLevel === 'HIGH' || creditStress?.stressLevel === 'CRITICAL') {
    extraActions.push({
      id: 'credit-stress-action',
      type: creditStress.stressLevel === 'CRITICAL' ? 'ALERT' : 'REDUCE',
      titleKo: `HY 스프레드 ${creditStress.hySpread}bps — 신용 스트레스 경고`,
      bodyKo: creditStress.commentary,
      severity: creditStress.stressLevel === 'CRITICAL' ? 'CRITICAL' : 'ELEVATED',
      confidence: 0.8,
      assets: ['HYG 매도', 'TLT 비중 확대', '현금 비중 증가'],
    });
  }

  if (globalMacro?.yieldCurve?.spread2s10s != null && globalMacro.yieldCurve.spread2s10s < -0.3) {
    extraActions.push({
      id: 'yield-curve-inversion',
      type: 'HEDGE',
      titleKo: `수익률 곡선 역전 (2s10s: ${globalMacro.yieldCurve.spread2s10s.toFixed(2)}%p)`,
      bodyKo: '역전 커브는 경기침체 선행지표. 방어주·채권·금 헤지 포지션 고려.',
      severity: 'ELEVATED',
      confidence: 0.75,
      assets: ['채권 ETF (TLT)', '금 (GLD)', '방어주 ETF'],
    });
  }

  if (globalMacro?.dxy?.signal?.sentiment === 'usd_surge') {
    extraActions.push({
      id: 'dxy-surge',
      type: 'REDUCE',
      titleKo: '달러 급등 — 수출주·신흥국 ETF 단기 압박',
      bodyKo: '강달러는 한국 수출 기업 마진 압박 및 외국인 자금 유출 가능성.',
      severity: 'WATCH',
      confidence: 0.65,
      assets: ['수출주 비중 점검', 'EEM 주의', 'USD/KRW 헤지'],
    });
  }

  const allActions = [...actions, ...extraActions];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-bold text-muted uppercase tracking-widest">행동 제안</span>
        <span className="text-xs text-muted">{allActions.length}개</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {allActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-xs font-semibold text-secondary mb-1">행동 필요 없음</p>
              <p className="text-xs text-muted">현재 위협 수준이 낮습니다<br/>시장 모니터링 계속 중</p>
            </div>
          </div>
        ) : (
          allActions.map(card => <ActionCardView key={card.id} card={card} />)
        )}
      </div>
    </div>
  );
}
