/**
 * ScenarioPanel — 지정학 시나리오 스트레스 테스트
 * 대만해협/중동/한반도/금융위기 시나리오 × 포트폴리오 영향 계산
 * 팔란티어 "Scenario Engine" 개념
 */
import { useState } from 'react';
import { useStore } from '@/store';
import { usePortfolioStore } from '@/store/portfolio';

interface AssetImpact {
  asset: string;
  change: number;   // %
  note: string;
  direction: '↑' | '↓' | '→';
}

interface Scenario {
  id: string;
  nameKo: string;
  emoji: string;
  desc: string;
  probability: number;   // %
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  timeHorizon: string;
  assetImpacts: AssetImpact[];
  hedges: string[];
  triggers: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'taiwan_conflict',
    nameKo: '대만해협 무력 충돌',
    emoji: '🚢',
    desc: '중국군 대만 해상 봉쇄 → 반도체 공급망 붕괴',
    probability: 15,
    severity: 'CRITICAL',
    timeHorizon: '6개월 내',
    triggers: ['중국 군사 훈련 급증', '미-중 무역분쟁 격화', 'TSM 생산 차질'],
    assetImpacts: [
      { asset: 'KOSPI',    change: -18, note: '외국인 자금 이탈 + 반도체 비중', direction: '↓' },
      { asset: 'USD/KRW',  change: +8,  note: '원화 급격 약세 (리스크오프)', direction: '↑' },
      { asset: '삼성전자', change: -22, note: 'TSMC 대체 수요 vs 공급망 혼란', direction: '↓' },
      { asset: 'SK하이닉스',change: -20, note: '수요 붕괴 우려', direction: '↓' },
      { asset: '금 (Gold)', change: +15, note: '안전자산 최대 수혜', direction: '↑' },
      { asset: 'S&P500',   change: -12, note: '기술주 충격', direction: '↓' },
      { asset: '방산주',   change: +30, note: '한국 방산 수요 급증', direction: '↑' },
      { asset: 'WTI 원유', change: +20, note: '공급 차질 우려', direction: '↑' },
    ],
    hedges: ['금 ETF (KRW 헤지)', 'USD 비중 확대', '방산 ETF', 'KOSPI 인버스'],
  },
  {
    id: 'nk_provocation',
    nameKo: '북한 ICBM 발사 + 7차 핵실험',
    emoji: '☢️',
    desc: '한반도 긴장 최고조 → 코리아 디스카운트 극대화',
    probability: 25,
    severity: 'HIGH',
    timeHorizon: '3개월 내',
    triggers: ['북한 핵시설 동향', '한미 연합훈련', 'UNSC 제재 이슈'],
    assetImpacts: [
      { asset: 'KOSPI',    change: -8,  note: '초단기 급락 후 반등 패턴', direction: '↓' },
      { asset: 'USD/KRW',  change: +4,  note: '일시적 원화 약세', direction: '↑' },
      { asset: '삼성전자', change: -6,  note: '코리아 디스카운트', direction: '↓' },
      { asset: '금 (Gold)', change: +5,  note: '지정학 프리미엄', direction: '↑' },
      { asset: '방산주',   change: +20, note: '즉각적 수혜', direction: '↑' },
      { asset: 'VIX',      change: +30, note: '공포 급등', direction: '↑' },
    ],
    hedges: ['방산 ETF 비중 확대', '달러 현금 비중', 'KOSPI 인버스 단기'],
  },
  {
    id: 'fed_crisis',
    nameKo: '연준 긴급 금리 인상 + 신용위기',
    emoji: '💰',
    desc: '인플레이션 재발 → 긴급 금리 인상 → HY 스프레드 폭등',
    probability: 20,
    severity: 'HIGH',
    timeHorizon: '12개월 내',
    triggers: ['PCE 전년비 4% 돌파', 'HY 스프레드 700bps', '은행 유동성 경색'],
    assetImpacts: [
      { asset: 'KOSPI',    change: -15, note: '외국인 자금 이탈', direction: '↓' },
      { asset: 'USD/KRW',  change: +10, note: '달러 강세 극대화', direction: '↑' },
      { asset: 'S&P500',   change: -20, note: '성장주 밸류에이션 붕괴', direction: '↓' },
      { asset: 'NVDA',     change: -30, note: 'AI 버블 디레이팅', direction: '↓' },
      { asset: '미국 국채',change: +8,  note: 'flight-to-quality', direction: '↑' },
      { asset: '금 (Gold)', change: -5,  note: '실질금리 상승으로 단기 약세', direction: '↓' },
      { asset: 'USD/EUR',  change: +5,  note: '달러 강세', direction: '↑' },
    ],
    hedges: ['TLT 장기채 ETF', '달러 현금', '방어주 (헬스케어/유틸)', 'HYG 매도'],
  },
  {
    id: 'china_hard_landing',
    nameKo: '중국 경제 경착륙',
    emoji: '🇨🇳',
    desc: '부동산 위기 심화 + 소비 급감 → 원자재 수요 붕괴',
    probability: 30,
    severity: 'MEDIUM',
    timeHorizon: '6개월 내',
    triggers: ['CSI300 -20% 이상', '중국 PMI 45 하회', '부동산 채무불이행'],
    assetImpacts: [
      { asset: 'KOSPI',    change: -10, note: '대중 수출 비중 (7.3%)', direction: '↓' },
      { asset: '포스코홀딩스', change: -25, note: '철강 수요 직격', direction: '↓' },
      { asset: 'WTI 원유', change: -15, note: '에너지 수요 감소', direction: '↓' },
      { asset: '구리',     change: -20, note: '글로벌 성장 지표 급락', direction: '↓' },
      { asset: '금 (Gold)', change: +10, note: '안전자산 수요', direction: '↑' },
      { asset: 'USD/KRW',  change: +6,  note: '원화 약세', direction: '↑' },
    ],
    hedges: ['원자재 ETF 축소', '금 ETF', '달러 비중 확대'],
  },
  {
    id: 'middle_east_oil',
    nameKo: '호르무즈 해협 봉쇄',
    emoji: '🛢️',
    desc: '이란-이스라엘 전면전 → 원유 공급 30% 차단',
    probability: 12,
    severity: 'CRITICAL',
    timeHorizon: '3개월 내',
    triggers: ['이스라엘 이란 핵시설 공격', '후티 반군 해상 공격 확대', 'OPEC 긴급회의'],
    assetImpacts: [
      { asset: 'WTI 원유', change: +40, note: '공급 급감 (역대급 쇼크)', direction: '↑' },
      { asset: '항공주',   change: -30, note: '연료비 폭등', direction: '↓' },
      { asset: 'KOSPI',    change: -10, note: '에너지 수입국 한국 타격', direction: '↓' },
      { asset: '조선주',   change: +15, note: 'LNG 운반 대체 수요', direction: '↑' },
      { asset: '금 (Gold)', change: +12, note: '지정학 프리미엄', direction: '↑' },
      { asset: '에너지주', change: +25, note: '직접 수혜', direction: '↑' },
    ],
    hedges: ['에너지 ETF', '조선 ETF', '달러 현금', '항공주 숏'],
  },
];

function ImpactBadge({ change, direction }: { change: number; direction: '↑' | '↓' | '→' }) {
  const isUp = change > 0;
  const cls = isUp ? 'bg-risk-safe/20 text-risk-safe border-risk-safe/30' :
              change < 0 ? 'bg-risk-critical/20 text-risk-critical border-risk-critical/30' :
              'bg-border text-muted';
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border tabular-nums ${cls}`}>
      {direction}{isUp ? '+' : ''}{change}%
    </span>
  );
}

const SEV_CLS: Record<string, string> = {
  CRITICAL: 'border-risk-critical/60 bg-risk-critical/5',
  HIGH:     'border-risk-elevated/60 bg-risk-elevated/5',
  MEDIUM:   'border-risk-watch/40 bg-risk-watch/5',
};
const SEV_KO: Record<string, string> = { CRITICAL: '🔴 위기', HIGH: '🟠 고위험', MEDIUM: '🟡 중위험' };

export function ScenarioPanel() {
  const { kospi, usdkrw } = useStore();
  const { getHoldingsWithPnL } = usePortfolioStore();
  const [selected, setSelected] = useState<Scenario>(SCENARIOS[0]);
  const [expanded, setExpanded] = useState(false);

  const holdings = getHoldingsWithPnL();

  // Calculate portfolio impact for selected scenario
  const portfolioImpact = (() => {
    if (holdings.length === 0) return null;
    const IMPACT_MAP: Record<string, number> = {};
    selected.assetImpacts.forEach(ai => { IMPACT_MAP[ai.asset.toUpperCase()] = ai.change; });

    let totalValue = 0, totalImpactedValue = 0;
    holdings.forEach(h => {
      const val = (h.currentValue ?? h.totalCost);
      totalValue += val;
      // Try to match symbol
      const sym = h.symbol.toUpperCase().replace(/\.(KS|KQ)$/, '');
      const nameUp = h.nameKo.toUpperCase();
      const impactPct = IMPACT_MAP[sym] ?? IMPACT_MAP[nameUp] ?? null;
      if (impactPct != null) {
        totalImpactedValue += val * (impactPct / 100);
      } else {
        // Default KOSPI correlation
        const kospiImpact = selected.assetImpacts.find(a => a.asset === 'KOSPI');
        if (kospiImpact && h.currency === 'KRW') {
          totalImpactedValue += val * (kospiImpact.change / 100) * 0.7;
        }
      }
    });
    return totalValue > 0 ? (totalImpactedValue / totalValue) * 100 : null;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Scenario list */}
      <div className="flex gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
        {SCENARIOS.map(s => (
          <button key={s.id} onClick={() => setSelected(s)}
            className={`text-xs px-2.5 py-1 rounded whitespace-nowrap transition-colors shrink-0 ${
              selected.id === s.id ? 'bg-accent text-white' : 'bg-border text-secondary hover:text-primary'
            }`}>{s.emoji} {s.nameKo.split(' ')[0]}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Header */}
        <div className={`border rounded-lg p-3 mb-3 ${SEV_CLS[selected.severity]}`}>
          <div className="flex items-start gap-2 mb-1.5">
            <span className="text-2xl">{selected.emoji}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-primary">{selected.nameKo}</span>
                <span className="text-xs">{SEV_KO[selected.severity]}</span>
              </div>
              <p className="text-xs text-secondary mt-0.5">{selected.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">발생 확률</span>
              <span className="text-xs font-bold text-primary">{selected.probability}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">시계</span>
              <span className="text-xs font-bold text-primary">{selected.timeHorizon}</span>
            </div>
            {portfolioImpact != null && (
              <div className={`ml-auto flex items-center gap-1 px-2 py-1 rounded ${
                portfolioImpact < 0 ? 'bg-risk-critical/10 text-risk-critical' : 'bg-risk-safe/10 text-risk-safe'
              }`}>
                <span className="text-xs font-bold">포트폴리오</span>
                <span className="text-xs font-bold tabular-nums">
                  {portfolioImpact >= 0 ? '+' : ''}{portfolioImpact.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Asset impacts */}
        <div className="mb-3">
          <div className="text-xs text-muted uppercase tracking-widest mb-2">자산별 영향</div>
          <div className="space-y-1.5">
            {selected.assetImpacts.map((ai, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-secondary flex-1 min-w-0 truncate">{ai.asset}</span>
                <ImpactBadge change={ai.change} direction={ai.direction} />
                <span className="text-xs text-muted hidden sm:block flex-1 min-w-0 truncate">{ai.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hedge suggestions */}
        <div className="mb-3">
          <div className="text-xs text-muted uppercase tracking-widest mb-2">🛡 헤지 전략</div>
          <div className="flex flex-wrap gap-1.5">
            {selected.hedges.map((h, i) => (
              <span key={i} className="text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-1 rounded">{h}</span>
            ))}
          </div>
        </div>

        {/* Triggers */}
        <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
          <div className="text-xs text-muted uppercase tracking-widest mb-2 flex items-center gap-1">
            ⚡ 트리거 조건 <span>{expanded ? '▴' : '▾'}</span>
          </div>
        </button>
        {expanded && (
          <div className="space-y-1">
            {selected.triggers.map((t, i) => (
              <p key={i} className="text-xs text-secondary">• {t}</p>
            ))}
          </div>
        )}

        {/* Current market context */}
        {kospi && usdkrw && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-xs text-muted mb-1.5">현재 시장 vs 시나리오</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface rounded p-2">
                <div className="text-xs text-muted">KOSPI 현재</div>
                <div className="text-xs font-bold text-primary">{kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-risk-critical">시나리오: {
                  (() => {
                    const impact = selected.assetImpacts.find(a => a.asset === 'KOSPI');
                    return impact ? `${(kospi.price * (1 + impact.change / 100)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} (${impact.change}%)` : '—';
                  })()
                }</div>
              </div>
              <div className="bg-surface rounded p-2">
                <div className="text-xs text-muted">USD/KRW 현재</div>
                <div className="text-xs font-bold text-primary">₩{usdkrw.rate.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}</div>
                <div className="text-xs text-risk-elevated">시나리오: {
                  (() => {
                    const impact = selected.assetImpacts.find(a => a.asset === 'USD/KRW');
                    return impact ? `₩${((usdkrw.rate * (1 + impact.change / 100))).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} (${impact.change >= 0 ? '+' : ''}${impact.change}%)` : '—';
                  })()
                }</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border shrink-0 text-xs text-muted/60">
        ⚠️ 투자 참고용 분석 · 실제 결과 상이 가능
      </div>
    </div>
  );
}
