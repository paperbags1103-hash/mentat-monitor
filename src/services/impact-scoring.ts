/**
 * Event Impact Scoring — Mentat Monitor Phase 3
 *
 * Converts event tags → quantified investment impact scores.
 * Score: -10 (extremely bearish) to +10 (extremely bullish), 0 = neutral.
 *
 * Logic: rule-based baseline → magnitude multiplier → Korean market adjustment
 */

import type { EventTag, ImpactDirection, SignalType } from './event-tagger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImpactScore {
  score: number;           // -10 to +10
  direction: ImpactDirection;
  magnitude: number;       // 1–5 (absolute force, regardless of direction)
  confidence: 'high' | 'medium' | 'low';
  // Per-asset adjustments
  assetScores: Record<string, number>;  // symbol → score
  // Korean market specific
  kospiImpact: number;     // -10 to +10
  krwImpact: number;       // -10 to +10 (positive = KRW strengthens)
  // Brief rationale
  rationale: string;
  // Safe haven flows
  safeHavenBullish: boolean;  // Gold, JPY, Treasuries up
}

export interface ScoredEvent {
  id: string;
  title: string;
  timestamp: number;
  tag: EventTag;
  impact: ImpactScore;
}

// ─── Direction → Base Score Mapping ──────────────────────────────────────────

const DIRECTION_BASE: Record<ImpactDirection, number> = {
  bullish: 1,
  bearish: -1,
  neutral: 0,
  uncertain: 0,
};

// ─── Signal Type → Default Asset Impacts ────────────────────────────────────

interface SignalDefaults {
  kospiMultiplier: number;   // sensitivity of KOSPI to this signal type
  krwMultiplier: number;     // sensitivity of KRW to this signal type
  goldImpact: number;        // direct gold impact direction
  oilImpact: number;         // direct oil impact direction
  safeHaven: boolean;        // does this event trigger safe haven flows
  rationale: string;
}

const SIGNAL_DEFAULTS: Record<SignalType, SignalDefaults> = {
  military: {
    kospiMultiplier: 1.4,  // KOSPI very sensitive to military events (NK proximity)
    krwMultiplier: -1.5,   // KRW weakens on military escalation
    goldImpact: 1,
    oilImpact: 0.5,
    safeHaven: true,
    rationale: '군사 긴장 → 위험자산 회피, KRW 약세, 금·엔 강세',
  },
  diplomatic: {
    kospiMultiplier: 0.8,
    krwMultiplier: 0.5,
    goldImpact: 0.2,
    oilImpact: 0.2,
    safeHaven: false,
    rationale: '외교 이벤트 → 완화 시 위험자산 회복, 긴장 시 약세',
  },
  economic: {
    kospiMultiplier: 1.0,
    krwMultiplier: 0.8,
    goldImpact: -0.3,
    oilImpact: 0.3,
    safeHaven: false,
    rationale: '경제 이벤트 → 지표에 따라 방향 결정',
  },
  pandemic: {
    kospiMultiplier: 1.2,
    krwMultiplier: -1.2,
    goldImpact: 0.5,
    oilImpact: -1,
    safeHaven: true,
    rationale: '팬데믹 → 내수 충격, KRW 약세, 원유 수요 급감',
  },
  cyber: {
    kospiMultiplier: 0.6,
    krwMultiplier: -0.3,
    goldImpact: 0.3,
    oilImpact: 0.1,
    safeHaven: false,
    rationale: '사이버 공격 → 기술주 약세, 제한적 시장 영향',
  },
  natural_disaster: {
    kospiMultiplier: 0.5,
    krwMultiplier: -0.4,
    goldImpact: 0.2,
    oilImpact: 0.3,
    safeHaven: false,
    rationale: '자연재해 → 지역 충격, 재건 수요 일부 상쇄',
  },
  political: {
    kospiMultiplier: 0.9,
    krwMultiplier: -0.7,
    goldImpact: 0.4,
    oilImpact: 0.2,
    safeHaven: false,
    rationale: '정치 이벤트 → 불확실성 증가, KRW 약세 경향',
  },
  energy: {
    kospiMultiplier: 0.7,
    krwMultiplier: -0.5,
    goldImpact: 0.3,
    oilImpact: 1.5,
    safeHaven: false,
    rationale: '에너지 이벤트 → 수입 의존 한국 경제 영향',
  },
  financial: {
    kospiMultiplier: 1.1,
    krwMultiplier: -1.0,
    goldImpact: 0.4,
    oilImpact: -0.5,
    safeHaven: true,
    rationale: '금융 충격 → 시스템 리스크, 안전자산 선호',
  },
  supply_chain: {
    kospiMultiplier: 1.0,
    krwMultiplier: -0.6,
    goldImpact: 0.1,
    oilImpact: 0.4,
    safeHaven: false,
    rationale: '공급망 충격 → 반도체·수출 의존 한국 민감',
  },
};

// ─── Korea-specific asset sensitivity ────────────────────────────────────────

const KOREA_SENSITIVE_ASSETS = new Set([
  '^KS11',   // KOSPI
  'KRW=X',   // USD/KRW
  '005930.KS', // Samsung Electronics
  '000660.KS', // SK Hynix
  'SOXS',    // Semiconductor bear (inverse)
  'SOXX',    // Semiconductor bull
]);

// ─── Core scoring function ────────────────────────────────────────────────────

export function scoreEvent(tag: EventTag): ImpactScore {
  const baseDir = DIRECTION_BASE[tag.impactDirection];
  const magnitude = tag.impactScore; // 1–5
  const defaults = SIGNAL_DEFAULTS[tag.signalType];

  // Base score: direction × magnitude (scaled to 0–10)
  const baseScore = baseDir * magnitude * 2; // max ±10

  // Korean market impact
  let kospiImpact = baseScore * defaults.kospiMultiplier;
  let krwImpact = baseScore * defaults.krwMultiplier;

  // Korea-specific adjustments
  if (tag.region === 'korea' || tag.countries.includes('KR') || tag.countries.includes('KP')) {
    kospiImpact *= 1.5;  // 50% amplification for direct Korea events
    krwImpact *= 1.5;
  }

  // North Korea military = maximum KOSPI sensitivity
  if (tag.countries.includes('KP') && tag.signalType === 'military') {
    kospiImpact = Math.min(-3, kospiImpact); // at least -3 even on small events
  }

  // Per-asset scores
  const assetScores: Record<string, number> = {};
  for (const asset of tag.relatedAssets) {
    // Gold
    if (['GLD', 'GC=F', 'XAUUSD'].includes(asset)) {
      assetScores[asset] = clamp(defaults.goldImpact * magnitude * 1.5, -10, 10);
    }
    // Oil
    else if (['WTI', 'CL=F', 'USO', 'BNO'].includes(asset)) {
      assetScores[asset] = clamp(defaults.oilImpact * magnitude * 1.5, -10, 10);
    }
    // Korea assets
    else if (KOREA_SENSITIVE_ASSETS.has(asset)) {
      assetScores[asset] = clamp(kospiImpact, -10, 10);
    }
    // Defense — beneficiary of military events
    else if (['LMT', 'RTX', 'NOC', 'BA'].includes(asset) && tag.signalType === 'military') {
      assetScores[asset] = clamp(magnitude * 1.5, -10, 10); // military = defense bullish
    }
    // Default: follow base score
    else {
      assetScores[asset] = clamp(baseScore * 0.5, -10, 10);
    }
  }

  const finalScore = clamp(baseScore, -10, 10);

  return {
    score: Math.round(finalScore * 10) / 10,
    direction: tag.impactDirection,
    magnitude,
    confidence: tag.confidence,
    assetScores: Object.fromEntries(
      Object.entries(assetScores).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    kospiImpact: Math.round(clamp(kospiImpact, -10, 10) * 10) / 10,
    krwImpact: Math.round(clamp(krwImpact, -10, 10) * 10) / 10,
    safeHavenBullish: defaults.safeHaven && tag.impactDirection === 'bearish',
    rationale: defaults.rationale,
  };
}

// ─── Multi-event aggregation ─────────────────────────────────────────────────

export interface AggregatedImpact {
  compositeScore: number;          // -10 to +10 (weighted average)
  kospiComposite: number;
  krwComposite: number;
  dominantDirection: ImpactDirection;
  topRisks: Array<{ title: string; score: number; kospiImpact: number }>;
  safeHavenPressure: number;       // 0–100 (how much safe haven flows)
  koreanMarketRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function aggregateImpacts(events: ScoredEvent[]): AggregatedImpact {
  if (!events.length) {
    return {
      compositeScore: 0, kospiComposite: 0, krwComposite: 0,
      dominantDirection: 'neutral', topRisks: [], safeHavenPressure: 0,
      koreanMarketRisk: 'LOW',
    };
  }

  // Weight recent events more heavily
  const now = Date.now();
  const weighted = events.map(e => {
    const ageHours = (now - e.timestamp) / 3_600_000;
    const recencyWeight = Math.exp(-ageHours / 24); // 24h half-life
    return { e, w: recencyWeight * e.impact.magnitude };
  });

  const totalWeight = weighted.reduce((s, x) => s + x.w, 0) || 1;
  const compositeScore = weighted.reduce((s, x) => s + x.e.impact.score * x.w, 0) / totalWeight;
  const kospiComposite = weighted.reduce((s, x) => s + x.e.impact.kospiImpact * x.w, 0) / totalWeight;
  const krwComposite = weighted.reduce((s, x) => s + x.e.impact.krwImpact * x.w, 0) / totalWeight;

  const safeHavenCount = events.filter(e => e.impact.safeHavenBullish).length;
  const safeHavenPressure = Math.min(100, (safeHavenCount / events.length) * 100 * 1.5);

  const kospiAbs = Math.abs(kospiComposite);
  const koreanMarketRisk: AggregatedImpact['koreanMarketRisk'] =
    kospiAbs >= 6 ? 'CRITICAL' : kospiAbs >= 4 ? 'HIGH' : kospiAbs >= 2 ? 'MEDIUM' : 'LOW';

  const topRisks = events
    .filter(e => e.impact.score < -3 || e.impact.kospiImpact < -3)
    .sort((a, b) => a.impact.kospiImpact - b.impact.kospiImpact)
    .slice(0, 5)
    .map(e => ({ title: e.title, score: e.impact.score, kospiImpact: e.impact.kospiImpact }));

  const bullishCount = events.filter(e => e.impact.score > 1).length;
  const bearishCount = events.filter(e => e.impact.score < -1).length;
  const dominantDirection: ImpactDirection =
    bearishCount > bullishCount * 2 ? 'bearish'
    : bullishCount > bearishCount * 2 ? 'bullish'
    : Math.abs(compositeScore) < 1 ? 'neutral'
    : 'uncertain';

  return {
    compositeScore: Math.round(compositeScore * 10) / 10,
    kospiComposite: Math.round(kospiComposite * 10) / 10,
    krwComposite: Math.round(krwComposite * 10) / 10,
    dominantDirection,
    topRisks,
    safeHavenPressure: Math.round(safeHavenPressure),
    koreanMarketRisk,
  };
}

// ─── Score label helpers ──────────────────────────────────────────────────────

export function impactLabel(score: number): string {
  if (score >= 7) return '강한 강세';
  if (score >= 4) return '강세';
  if (score >= 1.5) return '약한 강세';
  if (score > -1.5) return '중립';
  if (score > -4) return '약한 약세';
  if (score > -7) return '약세';
  return '강한 약세';
}

export function impactColor(score: number): string {
  if (score >= 4) return '#4CAF50';
  if (score >= 1.5) return '#8BC34A';
  if (score > -1.5) return '#9E9E9E';
  if (score > -4) return '#FF9800';
  return '#F44336';
}

export function impactArrow(score: number): string {
  if (score >= 4) return '▲▲';
  if (score >= 1.5) return '▲';
  if (score > -1.5) return '→';
  if (score > -4) return '▼';
  return '▼▼';
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
