/**
 * VIP Aircraft Service — Mentat Monitor
 * Fetches real-time positions of known government/military aircraft from OpenSky.
 */

export interface TrackedAircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lng: number;
  lat: number;
  altBaro: number | null;
  onGround: boolean;
  velocity: number | null;
  heading: number | null;
  squawk: string;
  isEmergencySquawk: boolean;
  isMilCallsign: boolean;
  label: string;
  country: string;
  category: string;
  isKnownVip: boolean;
  isHighAlert: boolean;
}

export interface VipAircraftData {
  timestamp: number;
  aircraft: TrackedAircraft[];
  stats: {
    total: number;
    airborne: number;
    onGround: number;
    commandAirborne: number;
    headOfStateAirborne: number;
    alertScore: number;
  };
  alerts: Array<{
    icao24: string;
    label: string;
    category: string;
    lat: number;
    lng: number;
    message: string;
  }>;
  source: string;
  authenticated: boolean;
  error: string | null;
}

let cachedData: VipAircraftData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 120_000; // 2 min

export async function fetchVipAircraft(baseUrl = ''): Promise<VipAircraftData | null> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) return cachedData;

  try {
    const resp = await fetch(`${baseUrl}/api/vip-aircraft`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) throw new Error(`VIP aircraft API returned ${resp.status}`);
    const data = (await resp.json()) as VipAircraftData;
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    console.warn('[vip-aircraft] fetch failed:', err);
    return cachedData;
  }
}

export const CATEGORY_COLORS: Record<string, string> = {
  head_of_state:    '#FF4444',
  government:       '#FF8C00',
  military_command: '#9C27B0',
  intelligence:     '#3F51B5',
  central_bank:     '#009688',
  international:    '#607D8B',
  unknown:          '#9E9E9E',
};

export const CATEGORY_LABELS_KO: Record<string, string> = {
  head_of_state:    '국가원수',
  government:       '정부',
  military_command: '군사 지휘',
  intelligence:     '정보기관',
  central_bank:     '중앙은행',
  international:    '국제기구',
  unknown:          '미분류',
};
