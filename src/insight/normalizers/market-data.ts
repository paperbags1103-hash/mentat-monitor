import type { NormalizedSignal } from '../types.js';

interface KoreaMarketData {
  kospi?: { price?: number; changePercent?: number };
  kosdaq?: { price?: number; changePercent?: number };
  usdkrw?: { rate?: number; changePercent?: number };
  upbitBtc?: { price?: number; changePercent?: number };
  kimchiPremium?: number;
  timestamp?: number;
}

const KOSPI_THRESHOLDS = { watch: -1.5, elevated: -3.0, critical: -5.0 };
const KRW_THRESHOLDS = { watch: 1.0, elevated: 2.0, critical: 3.5 };

function changeToStrength(changePct: number, thresholds: { watch: number; elevated: number; critical: number }): number {
  const abs = Math.abs(changePct);
  if (abs >= Math.abs(thresholds.critical)) return 75;
  if (abs >= Math.abs(thresholds.elevated)) return 55;
  if (abs >= Math.abs(thresholds.watch)) return 35;
  return 0;
}

export function normalizeMarketData(data: KoreaMarketData): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  const ts = data.timestamp ?? Date.now();

  // KOSPI
  if (data.kospi?.changePercent !== undefined) {
    const chg = data.kospi.changePercent;
    const strength = changeToStrength(chg, KOSPI_THRESHOLDS);
    if (strength > 0) {
      signals.push({
        id: `market_data:kospi:${ts}`,
        source: 'market_data',
        strength,
        direction: chg < 0 ? 'risk_off' : 'risk_on',
        affectedEntityIds: ['asset:KS11', 'country:south_korea'],
        confidence: 0.95,
        timestamp: ts,
        headlineKo: `코스피 ${chg > 0 ? '+' : ''}${chg.toFixed(2)}% (${data.kospi.price?.toLocaleString() ?? '?'})`,
        raw: data.kospi,
      });
    }
  }

  // USD/KRW
  if (data.usdkrw?.changePercent !== undefined) {
    const chg = data.usdkrw.changePercent;
    const strength = changeToStrength(chg, KRW_THRESHOLDS);
    if (strength > 0) {
      signals.push({
        id: `market_data:usdkrw:${ts}`,
        source: 'market_data',
        strength,
        direction: chg > 0 ? 'risk_off' : 'risk_on', // positive = KRW weaker = risk-off
        affectedEntityIds: ['asset:USDKRW', 'asset:KS11', 'country:south_korea'],
        confidence: 0.95,
        timestamp: ts,
        headlineKo: `원달러 ${chg > 0 ? '+' : ''}${chg.toFixed(2)}% (${data.usdkrw.rate?.toFixed(1) ?? '?'}원)`,
        raw: data.usdkrw,
      });
    }
  }

  // Kimchi premium anomaly (>3% or <-3%)
  if (data.kimchiPremium !== undefined && Math.abs(data.kimchiPremium) > 3) {
    const premium = data.kimchiPremium;
    signals.push({
      id: `market_data:kimchi:${ts}`,
      source: 'market_data',
      strength: Math.min(70, Math.abs(premium) * 8),
      direction: premium > 0 ? 'risk_on' : 'risk_off', // high premium = Korean demand surge
      affectedEntityIds: ['asset:BTC', 'asset:KS11'],
      confidence: 0.80,
      timestamp: ts,
      headlineKo: `김치 프리미엄 ${premium > 0 ? '+' : ''}${premium.toFixed(1)}% ${premium > 5 ? '⚠️ 과열' : premium < -3 ? '⚠️ 역프리미엄' : ''}`,
      raw: { kimchiPremium: premium },
    });
  }

  return signals;
}
