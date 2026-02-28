/**
 * /api/usgs-quakes
 *
 * Real-time seismic data from USGS Earthquake Hazards Program.
 * Shallow earthquakes near conflict zones may indicate bombardment/explosions.
 * North Korea shallow seismic = potential nuclear test.
 * No API key required.
 * Cache: 10 minutes.
 */
export const config = { maxDuration: 10 };

const CACHE_TTL = 10 * 60_000;
let cache = null;
let cacheTs = 0;

// Conflict-zone bounding boxes [south, west, north, east]
const CONFLICT_ZONES = [
  { name: '우크라이나',        bounds: [44, 22, 53, 41] },
  { name: '가자/이스라엘',     bounds: [29, 33, 33, 36] },
  { name: '이란',              bounds: [24, 44, 40, 64] },
  { name: '시리아/레바논',     bounds: [31, 35, 38, 43] },
  { name: '수단/에티오피아',   bounds: [4,  22, 24, 43] },
  { name: '북한 (핵실험 감시)', bounds: [37, 124, 43, 131] },
  { name: '대만해협',          bounds: [20, 118, 27, 123] },
  { name: '미얀마',            bounds: [10, 92,  28, 102] },
  { name: '예멘',              bounds: [12, 42,  19, 55]  },
];

function matchConflictZone(lat, lng) {
  for (const z of CONFLICT_ZONES) {
    const [s, w, n, e] = z.bounds;
    if (lat >= s && lat <= n && lng >= w && lng <= e) return z.name;
  }
  return null;
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
    // Last 24h, all magnitudes ≥ 2.5
    const r = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) throw new Error(`USGS ${r.status}`);
    const data = await r.json();

    const events = data.features.map(f => {
      const [lng, lat, depth] = f.geometry.coordinates;
      const mag   = f.properties.mag  || 0;
      const place = f.properties.place || '';
      const zone  = matchConflictZone(lat, lng);
      // "Suspect" = conflict zone + very shallow + no obvious natural fault
      const isSuspect = zone !== null && depth <= 10 && mag >= 3.0;

      return {
        id:        `usgs-${f.id}`,
        lat, lng,
        magnitude: mag,
        depth:     Math.round(depth),
        place,
        time:      f.properties.time,
        url:       f.properties.url,
        zone,
        isSuspect,
        severity:  mag >= 5.5 ? 'critical' : mag >= 4.5 ? 'high' : mag >= 3.5 ? 'medium' : 'low',
        titleKo:   `M${mag} ${place}${isSuspect ? ' ⚠️ 분쟁지역 이상 진동' : ''}`,
        source:    'USGS',
      };
    }).filter(f => f.magnitude >= 2.5 && f.depth <= 70);

    const result = { events, fetchedAt: new Date().toISOString(), count: events.length, cached: false };
    cache   = result;
    cacheTs = now;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ events: [], error: err.message });
  }
}
