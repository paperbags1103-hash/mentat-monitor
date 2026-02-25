/**
 * Convergence Detection Engine — Mentat Monitor
 *
 * Identifies geographic "hot zones" where multiple signal types
 * are occurring simultaneously. More signal types = higher convergence score.
 *
 * Concept: When military activity + protest + cyberattack + VIP movement
 * all concentrate in the same region within the same time window,
 * it's a leading indicator of major events.
 *
 * Signal sources fed in:
 *  - NK provocations
 *  - BlackSwan module scores
 *  - VIP aircraft positions
 *  - Economic calendar events (central bank meetings)
 *  - News event tags (from event-tagger)
 *  - Precious metals signals (financial stress proxy)
 */

export type SignalSource =
  | 'nk_provocation'
  | 'blackswan_pandemic'
  | 'blackswan_nuclear'
  | 'blackswan_financial'
  | 'blackswan_cyber'
  | 'blackswan_geopolitical'
  | 'vip_aircraft'
  | 'military_aircraft'
  | 'economic_calendar'
  | 'news_alert'
  | 'precious_metals'
  | 'market_stress';

export interface ConvergenceSignal {
  source: SignalSource;
  lat: number;
  lng: number;
  region: string;
  severity: 1 | 2 | 3 | 4 | 5;
  label: string;
  timestamp: number;
}

export interface ConvergenceZone {
  id: string;
  region: string;
  centerLat: number;
  centerLng: number;
  signals: ConvergenceSignal[];
  score: number;        // 0–100
  level: 'low' | 'medium' | 'high' | 'critical';
  signalTypes: SignalSource[];
  topLabel: string;
  /** True if 3+ different signal types in same zone */
  isConverging: boolean;
}

// Region center coordinates
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  korea:      { lat: 37.5, lng: 127.0 },
  taiwan:     { lat: 23.5, lng: 121.0 },
  china:      { lat: 35.0, lng: 105.0 },
  middleeast: { lat: 29.0, lng: 45.0 },
  europe:     { lat: 50.0, lng: 14.0 },
  japan:      { lat: 36.0, lng: 138.0 },
  southasia:  { lat: 20.0, lng: 77.0 },
  iran:       { lat: 32.0, lng: 53.0 },
  us:         { lat: 38.0, lng: -97.0 },
  global:     { lat: 0.0, lng: 0.0 },
};

const RADIUS_KM = 1500; // Zone radius for grouping

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Assign a signal to the nearest region center */
function assignRegion(lat: number, lng: number): string {
  let nearest = 'global';
  let minDist = Infinity;
  for (const [region, center] of Object.entries(REGION_CENTERS)) {
    if (region === 'global') continue;
    const dist = haversineKm(lat, lng, center.lat, center.lng);
    if (dist < minDist && dist < RADIUS_KM) {
      minDist = dist;
      nearest = region;
    }
  }
  return nearest;
}

/** Calculate convergence zones from a list of active signals */
export function detectConvergence(signals: ConvergenceSignal[]): ConvergenceZone[] {
  // Group signals by region
  const byRegion: Record<string, ConvergenceSignal[]> = {};

  for (const signal of signals) {
    const region = signal.region || assignRegion(signal.lat, signal.lng);
    if (!byRegion[region]) byRegion[region] = [];
    byRegion[region].push({ ...signal, region });
  }

  const zones: ConvergenceZone[] = [];

  for (const [region, regionSignals] of Object.entries(byRegion)) {
    if (regionSignals.length === 0) continue;

    // Unique signal types in this zone
    const types = [...new Set(regionSignals.map((s) => s.source))];
    const avgSeverity = regionSignals.reduce((sum, s) => sum + s.severity, 0) / regionSignals.length;

    // Convergence score:
    // - Base: unique signal type count × 15
    // - Bonus: severity multiplier
    // - Bonus: military + financial overlap = extra weight
    let score = types.length * 15;
    score += avgSeverity * 8;

    const hasMilitary = types.some((t) =>
      ['nk_provocation', 'vip_aircraft', 'military_aircraft', 'blackswan_geopolitical'].includes(t)
    );
    const hasFinancial = types.some((t) =>
      ['blackswan_financial', 'market_stress', 'precious_metals', 'economic_calendar'].includes(t)
    );
    if (hasMilitary && hasFinancial) score += 20; // cross-domain convergence bonus

    score = Math.min(100, Math.round(score));

    const level: ConvergenceZone['level'] =
      score >= 75 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 25 ? 'medium' : 'low';

    const center = REGION_CENTERS[region] ?? (regionSignals[0] ? { lat: regionSignals[0].lat, lng: regionSignals[0].lng } : { lat: 0, lng: 0 });

    // Top label: highest severity signal
    const topSignal = [...regionSignals].sort((a, b) => b.severity - a.severity)[0];

    zones.push({
      id: `zone-${region}`,
      region,
      centerLat: center.lat,
      centerLng: center.lng,
      signals: regionSignals,
      score,
      level,
      signalTypes: types,
      topLabel: topSignal?.label ?? region,
      isConverging: types.length >= 3,
    });
  }

  return zones.sort((a, b) => b.score - a.score);
}

/** Convert a BlackSwan module result to convergence signals */
export function blackSwanToSignals(
  modules: Record<string, { score: number }>,
  timestamp = Date.now(),
): ConvergenceSignal[] {
  const signals: ConvergenceSignal[] = [];

  const globalCenter = REGION_CENTERS['global'] ?? { lat: 0, lng: 0 };

  if ((modules['pandemic']?.score ?? 0) > 20) {
    signals.push({
      source: 'blackswan_pandemic',
      lat: globalCenter.lat, lng: globalCenter.lng,
      region: 'global',
      severity: Math.ceil((modules['pandemic']?.score ?? 0) / 20) as 1 | 2 | 3 | 4 | 5,
      label: `팬데믹 경보 (${modules['pandemic']?.score ?? 0}/100)`,
      timestamp,
    });
  }

  if ((modules['nuclear']?.score ?? 0) > 15) {
    signals.push({
      source: 'blackswan_nuclear',
      lat: globalCenter.lat, lng: globalCenter.lng,
      region: 'global',
      severity: Math.ceil((modules['nuclear']?.score ?? 0) / 20) as 1 | 2 | 3 | 4 | 5,
      label: `핵/방사능 경보 (${modules['nuclear']?.score ?? 0}/100)`,
      timestamp,
    });
  }

  if ((modules['financial']?.score ?? 0) > 30) {
    signals.push({
      source: 'blackswan_financial',
      lat: REGION_CENTERS['us']?.lat ?? 38.0, lng: REGION_CENTERS['us']?.lng ?? -97.0,
      region: 'us',
      severity: Math.ceil((modules['financial']?.score ?? 0) / 20) as 1 | 2 | 3 | 4 | 5,
      label: `금융 스트레스 (${modules['financial']?.score ?? 0}/100)`,
      timestamp,
    });
  }

  if ((modules['geopolitical']?.score ?? 0) > 25) {
    signals.push({
      source: 'blackswan_geopolitical',
      lat: globalCenter.lat, lng: globalCenter.lng,
      region: 'global',
      severity: Math.ceil((modules['geopolitical']?.score ?? 0) / 20) as 1 | 2 | 3 | 4 | 5,
      label: `지정학 에스컬레이션 (${modules['geopolitical']?.score ?? 0}/100)`,
      timestamp,
    });
  }

  return signals;
}

/** Region display labels */
export const REGION_LABELS: Record<string, string> = {
  korea:      '🇰🇷 한반도',
  taiwan:     '🇹🇼 대만 해협',
  china:      '🇨🇳 중국',
  middleeast: '🌙 중동',
  europe:     '🇪🇺 유럽',
  japan:      '🇯🇵 일본',
  southasia:  '🌏 남아시아',
  iran:       '🇮🇷 이란',
  us:         '🇺🇸 미국',
  global:     '🌍 글로벌',
};
