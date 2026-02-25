import type { NormalizedSignal, SignalDirection } from '../types.js';
import type { AggregatedImpact } from '../../services/impact-scoring.js';

/** Convert AggregatedImpact (-10 to +10) to normalized signal strength (0–100) + direction */
function impactToStrengthAndDirection(score: number): { strength: number; direction: SignalDirection } {
  const abs = Math.abs(score);
  const strength = Math.min(100, abs * 10);
  const direction: SignalDirection = score < -1.5 ? 'risk_off' : score > 1.5 ? 'risk_on' : 'neutral';
  return { strength, direction };
}

export function normalizeAggregatedImpact(impact: AggregatedImpact, timestamp: number): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];

  // KOSPI composite
  if (Math.abs(impact.kospiComposite) > 1.5) {
    const { strength, direction } = impactToStrengthAndDirection(impact.kospiComposite);
    signals.push({
      id: `impact_score:kospi:${timestamp}`,
      source: 'impact_score',
      strength,
      direction,
      affectedEntityIds: ['asset:KS11', 'asset:USDKRW', 'country:south_korea'],
      confidence: 0.70,
      timestamp,
      headlineKo: `복합 이벤트 KOSPI 영향: ${impact.kospiComposite > 0 ? '+' : ''}${impact.kospiComposite.toFixed(1)}/10 (${impact.koreanMarketRisk})`,
      raw: { kospiComposite: impact.kospiComposite, koreanMarketRisk: impact.koreanMarketRisk },
    });
  }

  // KRW composite
  if (Math.abs(impact.krwComposite) > 1.5) {
    const { strength, direction } = impactToStrengthAndDirection(impact.krwComposite);
    signals.push({
      id: `impact_score:krw:${timestamp}`,
      source: 'impact_score',
      strength,
      direction,
      affectedEntityIds: ['asset:USDKRW', 'asset:KS11'],
      confidence: 0.70,
      timestamp,
      headlineKo: `원달러 방향성 신호: ${impact.krwComposite > 0 ? '강세' : '약세'} (${impact.krwComposite.toFixed(1)}/10)`,
      raw: { krwComposite: impact.krwComposite },
    });
  }

  // Safe haven pressure
  if (impact.safeHavenPressure > 50) {
    signals.push({
      id: `impact_score:safehaven:${timestamp}`,
      source: 'impact_score',
      strength: Math.min(80, impact.safeHavenPressure),
      direction: 'risk_off',
      affectedEntityIds: ['asset:GOLD', 'asset:USDJPY', 'asset:US10Y', 'asset:DXY'],
      confidence: 0.75,
      timestamp,
      headlineKo: `안전자산 선호 압력 ${impact.safeHavenPressure.toFixed(0)}% — 금/엔화 수요 증가 예상`,
      raw: { safeHavenPressure: impact.safeHavenPressure },
    });
  }

  return signals;
}
