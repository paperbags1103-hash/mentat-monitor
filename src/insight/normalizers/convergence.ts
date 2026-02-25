import type { NormalizedSignal } from '../types.js';

interface ConvergenceZone {
  centroid: { lat: number; lng: number };
  signalTypes: string[];
  signalCount: number;
  isConverging: boolean;
  score?: number;
  regionId?: string;
}

interface ConvergenceData {
  zones?: ConvergenceZone[];
  clusters?: ConvergenceZone[];
  timestamp?: number;
}

/** Geographic → entity ID mapping */
function inferRegionEntities(lat: number, lng: number): string[] {
  // Korean Peninsula
  if (lat > 33 && lat < 43 && lng > 124 && lng < 132)
    return ['region:korean_peninsula', 'asset:KS11', 'asset:USDKRW'];
  // Taiwan Strait
  if (lat > 21 && lat < 26 && lng > 117 && lng < 123)
    return ['region:taiwan_strait', 'sector:semiconductor', 'company:tsmc'];
  // Middle East
  if (lat > 12 && lat < 42 && lng > 25 && lng < 63)
    return ['region:middle_east', 'asset:OIL', 'sector:energy'];
  // East Asia broad
  if (lat > 0 && lat < 55 && lng > 90 && lng < 150)
    return ['region:east_asia', 'asset:KS11'];
  // Europe
  if (lat > 35 && lat < 70 && lng > -10 && lng < 45)
    return ['region:europe'];
  return ['region:east_asia'];
}

const KNOWN_REGION_MAP: Record<string, string[]> = {
  korea:            ['region:korean_peninsula', 'asset:KS11', 'asset:USDKRW'],
  korean_peninsula: ['region:korean_peninsula', 'asset:KS11', 'asset:USDKRW'],
  taiwan:           ['region:taiwan_strait', 'sector:semiconductor', 'company:tsmc'],
  middle_east:      ['region:middle_east', 'asset:OIL', 'sector:energy'],
  europe:           ['region:europe'],
};

export function normalizeConvergence(data: ConvergenceData): NormalizedSignal[] {
  const ts = data.timestamp ?? Date.now();
  const zones = data.zones ?? data.clusters ?? [];

  return zones
    .filter(z => z.isConverging)
    .map((zone, i) => {
      const entities = zone.regionId
        ? (KNOWN_REGION_MAP[zone.regionId] ?? inferRegionEntities(zone.centroid.lat, zone.centroid.lng))
        : inferRegionEntities(zone.centroid.lat, zone.centroid.lng);

      const strength = Math.min(100,
        (zone.score ?? 0) ||
        (zone.signalTypes.length * 25 + Math.min(zone.signalCount, 5) * 5)
      );

      return {
        id: `convergence:${i}:${ts}`,
        source: 'convergence_zone' as const,
        strength,
        direction: 'risk_off' as const,
        affectedEntityIds: [...new Set(entities)],
        confidence: 0.65 + Math.min(0.25, zone.signalTypes.length * 0.05),
        timestamp: ts,
        headlineKo: `복합신호 수렴: ${zone.signalTypes.length}종 ${zone.signalCount}건 (${zone.regionId ?? '해당 지역'})`,
        raw: zone,
      };
    });
}
