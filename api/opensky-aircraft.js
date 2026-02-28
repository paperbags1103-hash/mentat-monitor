/**
 * /api/opensky-aircraft
 *
 * Real-time commercial aircraft positions from OpenSky Network.
 * Queries conflict zone bounding boxes.
 * KEY INSIGHT: Sudden absence of aircraft in a zone = airspace closure = conflict escalation signal.
 * No API key required (anonymous, rate-limited).
 * Cache: 5 minutes.
 */
export const config = { maxDuration: 10 };

const CACHE_TTL = 5 * 60_000;
let cache   = null;
let cacheTs = 0;

// Conflict-zone bounding boxes [lamin, lomin, lamax, lomax]
const ZONES = [
  { name: '중동/이스라엘/이란',  bbox: [24, 32, 42, 62] },
  { name: '우크라이나',          bbox: [44, 22, 54, 42] },
  { name: '대만해협',            bbox: [18, 116, 28, 126] },
  { name: '남중국해',            bbox: [4,  108, 24, 122] },
  { name: '한반도',              bbox: [34, 123, 44, 132] },
];

async function fetchZone(zone) {
  const [lamin, lomin, lamax, lomax] = zone.bbox;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();
  return (data.states || []).map(s => ({
    icao24:  s[0],
    callsign: (s[1] || '').trim(),
    country: s[2],
    lat:     s[6],
    lng:     s[5],
    altitude: s[7] ? Math.round(s[7]) : null, // baro_altitude in meters
    speed:   s[9] ? Math.round(s[9] * 3.6)  : null, // m/s → km/h
    heading: s[10] ? Math.round(s[10])       : 0,    // true_track degrees
    onGround: s[8] || false,
    zone:    zone.name,
  })).filter(a => a.lat && a.lng && !a.onGround);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return res.status(200).json({ ...cache, cached: true });
  }

  try {
    // Fetch all zones in parallel
    const results = await Promise.allSettled(ZONES.map(fetchZone));
    const aircraft = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Per-zone aircraft count (airspace density monitoring)
    const densityByZone = {};
    for (const a of aircraft) {
      densityByZone[a.zone] = (densityByZone[a.zone] || 0) + 1;
    }

    const result = {
      aircraft,
      count: aircraft.length,
      densityByZone,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
    cache   = result;
    cacheTs = now;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ aircraft: [], count: 0, error: err.message });
  }
}
