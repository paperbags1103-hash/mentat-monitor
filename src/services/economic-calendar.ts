/**
 * Economic Calendar Service — Mentat Monitor
 *
 * Fetches upcoming high-impact economic events:
 *  - Central bank rate decisions (Fed, ECB, BOK, BOJ)
 *  - Jackson Hole symposium
 *  - Major economic data releases (via FMP API if configured)
 */

export type EventImpact = 'high' | 'medium' | 'low';

export interface EconomicEvent {
  date: string;           // ISO date YYYY-MM-DD
  title: string;
  country: string;        // ISO 2-letter country code
  currency: string;       // e.g. USD, KRW, EUR
  impact: EventImpact;
  actual?: number | null;
  estimate?: number | null;
  previous?: number | null;
  source?: string;
  lat?: number;
  lng?: number;
}

export interface EconomicCalendarData {
  timestamp: number;
  source: string;
  from: string;
  to: string;
  events: EconomicEvent[];
}

let cachedData: EconomicCalendarData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3_600_000; // 1 hour

export async function fetchEconomicCalendar(baseUrl = ''): Promise<EconomicCalendarData | null> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    const resp = await fetch(`${baseUrl}/api/economic-calendar`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`Economic calendar API returned ${resp.status}`);
    const data = (await resp.json()) as EconomicCalendarData;
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    console.warn('[economic-calendar] fetch failed:', err);
    return cachedData;
  }
}

/** Returns events for a specific country code */
export function getEventsByCountry(
  events: EconomicEvent[],
  country: string,
): EconomicEvent[] {
  return events.filter((e) => e.country === country);
}

/** Returns events within the next N days */
export function getUpcomingEvents(
  events: EconomicEvent[],
  withinDays = 7,
): EconomicEvent[] {
  const today = new Date().toISOString().substring(0, 10);
  const cutoff = new Date(Date.now() + withinDays * 86400 * 1000)
    .toISOString()
    .substring(0, 10);
  return events.filter((e) => e.date >= today && e.date <= cutoff);
}

/** Color coding for event sources */
export const CB_COLORS: Record<string, string> = {
  FederalReserve: '#1A73E8',
  ECB: '#003399',
  BOK: '#005BAA',       // 한국은행 파란색
  BOJ: '#BC002D',       // 일본 빨간색
  PBOC: '#DE2910',      // 중국
  BOE: '#003078',       // 영국
  KansasFed: '#4A90D9', // 잭슨홀
};

/** Flag emoji by country code */
export const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
  KR: '🇰🇷',
  JP: '🇯🇵',
  CN: '🇨🇳',
  GB: '🇬🇧',
};
