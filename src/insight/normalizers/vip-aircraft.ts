import type { NormalizedSignal } from '../types.js';
import type { VipAircraftData } from '../../services/vip-aircraft.js';

/** Categories that warrant strong signals */
const CATEGORY_CONFIG: Record<string, { strength: number; entities: string[]; confidence: number }> = {
  military_command: { strength: 80, entities: ['event:nk_nuclear', 'event:nk_missile'], confidence: 0.90 },
  head_of_state:    { strength: 55, entities: [], confidence: 0.85 },
  intelligence:     { strength: 50, entities: [], confidence: 0.80 },
  government:       { strength: 35, entities: [], confidence: 0.75 },
  unknown:          { strength: 25, entities: [], confidence: 0.60 },
};

/** Korea proximity bounding box */
function isNearKoreanPeninsula(lat: number, lng: number): boolean {
  return lat > 33 && lat < 43 && lng > 124 && lng < 132;
}

export function normalizeVipAircraft(data: VipAircraftData): NormalizedSignal[] {
  const airborne = data.aircraft.filter(a => !a.onGround && a.lat != null && a.lng != null);

  return airborne.map(a => {
    const cfg = CATEGORY_CONFIG[a.category] ?? CATEGORY_CONFIG['unknown'];
    const nearKorea = isNearKoreanPeninsula(a.lat, a.lng);

    const strength0 = cfg?.strength ?? 25;
    const entityIds0 = cfg?.entities ?? [];

    let strength = strength0;
    const entityIds = [...entityIds0];

    if (nearKorea) {
      strength = Math.min(100, strength + 20);
      entityIds.push('region:korean_peninsula', 'asset:KS11', 'asset:USDKRW');
    } else {
      entityIds.push('region:east_asia');
    }

    if (a.isHighAlert) {
      strength = Math.min(100, strength + 15);
    }

    return {
      id: `vip_aircraft:${a.icao24}:${data.timestamp}`,
      source: 'vip_aircraft' as const,
      strength,
      direction: 'risk_off' as const,
      affectedEntityIds: [...new Set(entityIds)],
      confidence: cfg?.confidence ?? 0.60,
      timestamp: data.timestamp,
      headlineKo: `${a.label} 비행 감지 (${a.category}${nearKorea ? ', 한반도 근접' : ''})`,
      raw: a,
    };
  });
}
