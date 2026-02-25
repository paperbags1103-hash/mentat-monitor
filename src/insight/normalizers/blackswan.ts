import type { NormalizedSignal } from '../types.js';
import type { BlackSwanData } from '../../services/blackswan.js';

export function normalizeBlackSwan(data: BlackSwanData): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  const ts = data.timestamp;

  const modules = [
    {
      key: 'financial' as const,
      source: 'blackswan:financial' as const,
      entities: ['asset:KS11', 'asset:SPX', 'asset:VIX', 'asset:USDKRW', 'asset:BTC'],
      confidence: 0.85,
      threshold: 15,
      labelFn: (m: typeof data.modules.financial) =>
        `금융 스트레스 ${m.score}/100 (VIX: ${(m.signals as Record<string, unknown>)?.vix ?? '?'})`,
    },
    {
      key: 'pandemic' as const,
      source: 'blackswan:pandemic' as const,
      entities: ['event:pandemic', 'sector:bio_pharma', 'asset:KS11', 'sector:shipping'],
      confidence: 0.55,
      threshold: 20,
      labelFn: (_m: unknown) => '팬데믹 경보 신호 감지 (ProMED/WHO)',
    },
    {
      key: 'nuclear' as const,
      source: 'blackswan:nuclear' as const,
      entities: ['event:nk_nuclear', 'region:korean_peninsula', 'asset:KS11', 'sector:defense', 'asset:GOLD'],
      confidence: 0.60,
      threshold: 15,
      labelFn: (m: typeof data.modules.nuclear) => `핵/방사능 키워드 감지 (${m.score}/100)`,
    },
    {
      key: 'cyber' as const,
      source: 'blackswan:cyber' as const,
      entities: ['sector:cybersecurity', 'sector:finance', 'asset:KS11'],
      confidence: 0.55,
      threshold: 20,
      labelFn: (m: typeof data.modules.cyber) => `사이버 위협 감지 (${m.score}/100)`,
    },
    {
      key: 'geopolitical' as const,
      source: 'blackswan:geopolitical' as const,
      entities: ['asset:KS11', 'asset:GOLD', 'asset:OIL', 'asset:USDKRW'],
      confidence: 0.50,
      threshold: 15,
      labelFn: (m: typeof data.modules.geopolitical) => `지정학 위험 키워드 급증 (${m.score}/100)`,
    },
    {
      key: 'supplyChain' as const,
      source: 'blackswan:supply_chain' as const,
      entities: ['sector:shipping', 'sector:semiconductor', 'asset:KS11'],
      confidence: 0.70,
      threshold: 20,
      labelFn: (m: typeof data.modules.supplyChain) => `공급망 스트레스 (${m.score}/100)`,
    },
  ] as const;

  for (const mod of modules) {
    const moduleData = data.modules[mod.key];
    if (!moduleData || moduleData.score < mod.threshold) continue;

    signals.push({
      id: `${mod.source}:${ts}`,
      source: mod.source,
      strength: moduleData.score,
      direction: moduleData.score > 50 ? 'risk_off' : 'neutral',
      affectedEntityIds: [...mod.entities],
      confidence: mod.confidence,
      timestamp: ts,
      headlineKo: mod.labelFn(moduleData as never),
      raw: moduleData,
    });
  }

  return signals;
}
