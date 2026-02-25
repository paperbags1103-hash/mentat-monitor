/**
 * /api/economic-calendar
 *
 * Economic calendar for Mentat Monitor.
 * Returns upcoming high-impact economic events (central bank meetings, key data releases).
 *
 * Data sources:
 *  - FMP (Financial Modeling Prep) API — free tier: up to 250 requests/day
 *  - Static fallback: Known FOMC, BOK, ECB, BOJ, PBOC meeting dates
 *
 * Set env var: FMP_API_KEY for full calendar access.
 * Without API key: returns pre-seeded central bank calendar only.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 3_600_000; // 1 hour
let cache = null;
let cacheTs = 0;

// High-impact central bank events — updated manually each year
// Format: ISO date (local time approximate)
const STATIC_CB_CALENDAR = [
  // FOMC 2025
  { date: '2025-01-29', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-03-19', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-05-07', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-06-18', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-07-30', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-09-17', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-10-29', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2025-12-10', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  // FOMC 2026
  { date: '2026-01-28', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },
  { date: '2026-03-18', title: 'FOMC 금리 결정', country: 'US', currency: 'USD', impact: 'high', source: 'FederalReserve' },

  // ECB 2025
  { date: '2025-01-30', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-03-06', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-04-17', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-06-05', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-07-24', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-09-11', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-10-30', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },
  { date: '2025-12-18', title: 'ECB 금리 결정', country: 'EU', currency: 'EUR', impact: 'high', source: 'ECB' },

  // Bank of Korea 2025
  { date: '2025-01-16', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-02-25', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-04-17', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-05-29', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-07-17', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-08-28', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-10-16', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },
  { date: '2025-11-27', title: '한국은행 금통위 금리 결정', country: 'KR', currency: 'KRW', impact: 'high', source: 'BOK' },

  // Bank of Japan 2025
  { date: '2025-01-24', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-03-19', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-05-01', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-06-17', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-07-31', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-09-19', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-10-29', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },
  { date: '2025-12-19', title: 'BOJ 금리 결정', country: 'JP', currency: 'JPY', impact: 'high', source: 'BOJ' },

  // Jackson Hole
  { date: '2025-08-21', title: '잭슨홀 경제 심포지엄', country: 'US', currency: 'USD', impact: 'high', source: 'KansasFed' },
  { date: '2026-08-27', title: '잭슨홀 경제 심포지엄', country: 'US', currency: 'USD', impact: 'high', source: 'KansasFed' },
];

const COUNTRY_COORDS = {
  US: { lat: 38.89, lng: -77.04 },  // Washington DC / Fed
  EU: { lat: 50.11, lng: 8.68 },    // ECB Frankfurt
  KR: { lat: 37.55, lng: 126.98 },  // Seoul / BOK
  JP: { lat: 35.69, lng: 139.69 },  // Tokyo / BOJ
  CN: { lat: 39.91, lng: 116.39 },  // Beijing / PBOC
  GB: { lat: 51.51, lng: -0.12 },   // London / BOE
};

async function fetchFmpCalendar(apiKey, from, to) {
  const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${apiKey}`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`FMP ${resp.status}`);
  const data = await resp.json();
  // Filter high-impact events only
  return data
    .filter(e => e.impact === 'High')
    .map(e => ({
      date: e.date?.substring(0, 10) || '',
      title: e.event || '',
      country: e.country || '',
      currency: e.currency || '',
      impact: 'high',
      actual: e.actual,
      estimate: e.estimate,
      previous: e.previous,
      source: 'FMP',
      lat: COUNTRY_COORDS[e.country]?.lat,
      lng: COUNTRY_COORDS[e.country]?.lng,
    }));
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cache), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  const today = new Date().toISOString().substring(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400 * 1000).toISOString().substring(0, 10);

  let events = [];
  let source = 'static';

  // Try FMP API if key available
  const fmpKey = process.env.FMP_API_KEY;
  if (fmpKey) {
    try {
      const fmpEvents = await fetchFmpCalendar(fmpKey, today, in30days);
      events = fmpEvents;
      source = 'fmp';
    } catch (e) {
      console.warn('[economic-calendar] FMP failed, falling back to static:', e.message);
    }
  }

  // Merge/fallback to static CB calendar
  const staticUpcoming = STATIC_CB_CALENDAR
    .filter(e => e.date >= today && e.date <= in30days)
    .map(e => ({
      ...e,
      lat: COUNTRY_COORDS[e.country]?.lat,
      lng: COUNTRY_COORDS[e.country]?.lng,
    }));

  if (source === 'static' || events.length === 0) {
    events = staticUpcoming;
  } else {
    // Add static BOK events not in FMP (FMP often misses Korean data)
    const fmpDates = new Set(events.map(e => `${e.date}-${e.country}`));
    for (const e of staticUpcoming) {
      if (!fmpDates.has(`${e.date}-${e.country}`)) {
        events.push(e);
      }
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  const result = { timestamp: now, source, from: today, to: in30days, events };
  cache = result;
  cacheTs = now;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
