/**
 * /api/vip-aircraft
 *
 * VIP & Military Aircraft Tracker — Mentat Monitor
 *
 * Queries OpenSky Network for known government/military aircraft positions.
 * No relay required — uses OpenSky public REST API directly.
 *
 * Rate limits:
 *  - Anonymous: 100 requests/day, 10s resolution
 *  - Authenticated: 4,000 requests/day, 5s resolution
 *    (Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET for higher limits)
 *
 * Data is 30–60s delayed on OpenSky free tier.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 120_000; // 2 min (balance between freshness and rate limits)
let cache = null;
let cacheTs = 0;

// Known VIP/military ICAO hex codes (subset for quick filtering)
// Full list in src/data/vip-aircraft.ts
const VIP_ICAO_LIST = [
  // US Head of State
  'ae0b6a', 'ae0b8b', 'ae0685',
  // US Military Command (high signal value)
  'ae04c5', 'ae0557', 'ae020b',
  // UK
  '43c36e', '43c35f',
  // France
  '3c4591',
  // Germany
  '3cd54c',
  // Japan
  '84408a', '844090',
  // China
  '780af5',
  // Russia
  'c00001', 'c00002',
  // South Korea
  '71be19', '71be1a',
  // Israel
  '76c63b',
  // NATO
  '45d3ab', '4b1801',
];

// Additional military type patterns to catch unlisted aircraft
const MILITARY_CALLSIGN_PREFIXES = [
  'RCH', 'SAM', 'VENUS', 'REACH', 'KNIFE', 'EVAC', 'SPAR',
  'JAKE', 'BOXER', 'BISON', 'TOPGUN', 'ACES',
];

const MILITARY_SQUAWKS = new Set(['7700', '7600', '7500', '7777']);

// Label map for known aircraft
const AIRCRAFT_LABELS = {
  'ae0b6a': { label: 'Air Force One (SAM28000)', country: 'US', category: 'head_of_state' },
  'ae0b8b': { label: 'Air Force One (SAM29000)', country: 'US', category: 'head_of_state' },
  'ae0685': { label: 'Air Force Two (VP)', country: 'US', category: 'head_of_state' },
  'ae04c5': { label: 'E-4B Nightwatch (NAOC)', country: 'US', category: 'military_command' },
  'ae0557': { label: 'E-6B Mercury (TACAMO)', country: 'US', category: 'military_command' },
  'ae020b': { label: 'RC-135 Rivet Joint', country: 'US', category: 'intelligence' },
  '43c36e': { label: 'UK PM Voyager', country: 'GB', category: 'head_of_state' },
  '43c35f': { label: 'RAF RC-135W', country: 'GB', category: 'intelligence' },
  '3c4591': { label: 'French President', country: 'FR', category: 'head_of_state' },
  '3cd54c': { label: 'German Chancellor', country: 'DE', category: 'head_of_state' },
  '84408a': { label: 'Japanese PM (primary)', country: 'JP', category: 'head_of_state' },
  '844090': { label: 'Japanese PM (backup)', country: 'JP', category: 'head_of_state' },
  '780af5': { label: 'China Gov Transport', country: 'CN', category: 'government' },
  'c00001': { label: 'Russian Presidential Il-96', country: 'RU', category: 'head_of_state' },
  'c00002': { label: 'Russian Presidential (backup)', country: 'RU', category: 'head_of_state' },
  '71be19': { label: '한국 대통령 전용기', country: 'KR', category: 'head_of_state' },
  '71be1a': { label: '한국 VIP 수송기', country: 'KR', category: 'head_of_state' },
  '76c63b': { label: 'Israeli PM Aircraft', country: 'IL', category: 'head_of_state' },
  '45d3ab': { label: 'NATO E-3A AWACS', country: 'NATO', category: 'military_command' },
};

function buildOpenSkyUrl(icaoList) {
  const base = 'https://opensky-network.org/api/states/all';
  const params = new URLSearchParams();
  // OpenSky accepts comma-separated ICAO24 in the `icao24` parameter
  params.set('icao24', icaoList.join(','));
  return `${base}?${params}`;
}

function getOpenSkyAuth() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }
  return null;
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

  const auth = getOpenSkyAuth();
  const headers = { Accept: 'application/json', 'User-Agent': 'MentatMonitor/1.0' };
  if (auth) headers.Authorization = auth;

  let aircraft = [];
  let openSkyError = null;

  try {
    // Query OpenSky for all VIP ICAO codes in one request
    const url = buildOpenSkyUrl(VIP_ICAO_LIST);
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status === 429) throw new Error('Rate limited by OpenSky');
    if (!resp.ok) throw new Error(`OpenSky returned ${resp.status}`);

    const data = await resp.json();
    // OpenSky state vector format:
    // [icao24, callsign, origin_country, time_position, last_contact,
    //  longitude, latitude, baro_altitude, on_ground, velocity,
    //  true_track, vertical_rate, sensors, geo_altitude, squawk,
    //  spi, position_source, category]
    const states = data?.states ?? [];

    aircraft = states
      .filter(s => s[5] !== null && s[6] !== null) // must have position
      .map(s => {
        const icao24 = (s[0] || '').toLowerCase();
        const callsign = (s[1] || '').trim();
        const known = AIRCRAFT_LABELS[icao24] || {};
        const isMilCallsign = MILITARY_CALLSIGN_PREFIXES.some(p => callsign.startsWith(p));
        const squawk = s[14] || '';
        const isEmergencySquawk = MILITARY_SQUAWKS.has(squawk);

        return {
          icao24,
          callsign: callsign || null,
          originCountry: s[2],
          lng: s[5],
          lat: s[6],
          altBaro: s[7],    // meters
          onGround: s[8],
          velocity: s[9],   // m/s
          heading: s[10],
          squawk,
          isEmergencySquawk,
          isMilCallsign,
          // Enrichment from known list
          label: known.label || callsign || icao24,
          country: known.country || s[2],
          category: known.category || (isMilCallsign ? 'government' : 'unknown'),
          isKnownVip: icao24 in AIRCRAFT_LABELS,
          // Alert flag: military command aircraft + airborne = notable
          isHighAlert: ['military_command', 'head_of_state'].includes(known.category) && !s[8],
        };
      });
  } catch (err) {
    openSkyError = err.message;
  }

  // Detect notable patterns
  const airborne = aircraft.filter(a => !a.onGround);
  const highAlerts = aircraft.filter(a => a.isHighAlert);
  const commandAircraft = aircraft.filter(a => a.category === 'military_command' && !a.onGround);
  const headOfStateAirborne = aircraft.filter(a => a.category === 'head_of_state' && !a.onGround);

  // Alert score: more military command airborne = higher tension
  const alertScore = Math.min(100,
    commandAircraft.length * 30 +
    headOfStateAirborne.length * 10 +
    (highAlerts.length > 0 ? 20 : 0)
  );

  const result = {
    timestamp: now,
    aircraft,
    stats: {
      total: aircraft.length,
      airborne: airborne.length,
      onGround: aircraft.length - airborne.length,
      commandAirborne: commandAircraft.length,
      headOfStateAirborne: headOfStateAirborne.length,
      alertScore,
    },
    alerts: highAlerts.map(a => ({
      icao24: a.icao24,
      label: a.label,
      category: a.category,
      lat: a.lat,
      lng: a.lng,
      message: `${a.label} 비행 중`,
    })),
    source: 'opensky-network.org',
    authenticated: !!auth,
    error: openSkyError,
  };

  if (!openSkyError) {
    cache = result;
    cacheTs = now;
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': openSkyError ? 'ERROR' : 'MISS', ...corsHeaders },
  });
}
