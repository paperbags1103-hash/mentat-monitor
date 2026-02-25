import type { NormalizedSignal } from '../types.js';
import type { PatternAnalysis } from '../../services/pattern-matcher.js';

/** Map pattern-matcher outlook to entity signals */
export function normalizePatternAnalysis(analysis: PatternAnalysis, timestamp: number): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];

  if (!analysis.matchedPatterns.length) return signals;

  // Overall Korean market outlook signal
  const outlook = analysis.outlook;
  const kospiBearish = outlook.kospiExpected === 'down_sharp' || outlook.kospiExpected === 'down_mild';
  const kospiStrength = outlook.kospiExpected === 'down_sharp' ? 70
    : outlook.kospiExpected === 'down_mild' ? 40
    : outlook.kospiExpected === 'up' ? 40
    : 0;

  if (kospiStrength > 0) {
    signals.push({
      id: `pattern_matcher:outlook:${timestamp}`,
      source: 'pattern_matcher',
      strength: kospiStrength,
      direction: kospiBearish ? 'risk_off' : 'risk_on',
      affectedEntityIds: ['asset:KS11', 'asset:USDKRW'],
      confidence: analysis.confidenceLevel === 'high' ? 0.75 : analysis.confidenceLevel === 'medium' ? 0.55 : 0.40,
      timestamp,
      headlineKo: `역사적 패턴 분석: ${analysis.topAnalogues[0]?.titleKo ?? '유사 사례'} 유사 (${analysis.confidenceLevel} 신뢰도)`,
      raw: analysis.topAnalogues[0],
    });
  }

  // Sector rotation signals (high confidence bullish/bearish sectors)
  for (const sector of analysis.sectorSignals.slice(0, 4)) {
    if (sector.confidence < 0.65) continue;

    const entityId = `sector:${sector.sector}`;
    signals.push({
      id: `pattern_matcher:sector:${sector.sector}:${timestamp}`,
      source: 'pattern_matcher',
      strength: Math.round(sector.confidence * 65),
      direction: sector.direction === 'bearish' ? 'risk_off' : sector.direction === 'bullish' ? 'risk_on' : 'neutral',
      affectedEntityIds: [entityId],
      confidence: sector.confidence,
      timestamp,
      headlineKo: `${sector.sectorKo}: ${sector.direction === 'bearish' ? '약세' : '강세'} 예상 — ${sector.basis}`,
      raw: sector,
    });
  }

  return signals;
}
