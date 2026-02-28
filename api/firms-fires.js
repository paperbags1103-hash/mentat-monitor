/**
 * /api/firms-fires
 *
 * NASA FIRMS (Fire Information for Resource Management System).
 * Satellite thermal anomaly detection — VIIRS 375m resolution, ~3hr delay.
 * In conflict zones, fire clusters = military strikes, burning vehicles, infrastructure.
 *
 * Required env var:
 *   FIRMS_MAP_KEY — free at https://firms.modaps.eosdis.nasa.gov/api/map_key/
 * Cache: 3 hours (FIRMS updates every ~3hr).
 */
export const config = { maxDuration: 10 };

const CACHE_TTL = 3 * 60 * 60_000;
let cache = null;
let cacheTs = 0;

// Conflict-zone bounding boxes [W,S,E,N] for targeted queries
const ZONES = [
  { name: '우크라이나',     bbox: '22,44,41,53'  },
  { name: '가자/이스라엘',  bbox: '33,29,36,34'  },
  { name: '이란',           bbox: '44,24,64,40'  },
  { name: '시리아',         bbox: '35,31,43,38'  },
  { name: '수단',           bbox: '22,8,38,24'   },
  { name: '북한',           bbox: '124,37,131,43' },
  { name: '미얀마',         bbox: '92,10,102,28' },
  { name: '예멘',           bbox: '42,12,55,19'  },
  { name: '러시아 남부',    bbox: '35,46,42,52'  },
];

function parseCSVFIRMS(csv, zoneName) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const latIdx  = headers.indexOf('latitude');
  const lngIdx  = headers.indexOf('longitude');
  const frpIdx  = headers.indexOf('frp');           // Fire Radiative Power (MW)
  const confIdx = headers.indexOf('confidence');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const brightIdx = headers.indexOf('bright_ti4') !== -1
    ? headers.indexOf('bright_ti4')
    : headers.indexOf('brightness');

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    const lat  = parseFloat(cols[latIdx]);
    const lng  = parseFloat(cols[lngIdx]);
    const frp  = parseFloat(cols[frpIdx])  || 0;
    const conf = parseInt(cols[confIdx])   || 0;
    const bright = parseFloat(cols[brightIdx]) || 0;

    if (isNaN(lat) || isNaN(lng)) return null;
    if (conf < 60) return null;       // skip low-confidence detections

    const severity = frp >= 100 ? 'critical' : frp >= 30 ? 'high' : frp >= 5 ? 'medium' : 'low';
    const dateStr = cols[dateIdx] || '';
    const timeStr = (cols[timeIdx] || '').padStart(4, '0');

    return {
      id:       `firms-${zoneName}-${i}-${lat.toFixed(2)}-${lng.toFixed(2)}`,
      lat, lng,
      zone:     zoneName,
      frp:      Math.round(frp),
      confidence: conf,
      brightness: Math.round(bright),
      date:     dateStr,
      time:     `${timeStr.slice(0, 2)}:${timeStr.slice(2)}Z`,
      severity,
      category: 'fire',
      titleKo:  `🔥 ${zoneName}: 화재 감지 FRP ${Math.round(frp)}MW`,
      source:   'NASA FIRMS',
    };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const mapKey = process.env.FIRMS_MAP_KEY || '';
  if (!mapKey) {
    return res.status(200).json({
      events: [],
      error: 'FIRMS_MAP_KEY not configured. Get free key at firms.modaps.eosdis.nasa.gov',
    });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return res.status(200).json({ ...cache, cached: true });
  }

  try {
    // Fetch all zones in parallel
    const results = await Promise.allSettled(
      ZONES.map(zone =>
        fetch(
          `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/${zone.bbox}/1`,
          { signal: AbortSignal.timeout(7000) }
        )
          .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(csv => parseCSVFIRMS(csv, zone.name))
          .catch(() => [])
      )
    );

    const allFires = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Cluster nearby fires (0.05° = ~5km) to avoid overwhelming the map
    const seen = new Set();
    const clustered = allFires.filter(f => {
      const key = `${Math.round(f.lat / 0.1) * 0.1},${Math.round(f.lng / 0.1) * 0.1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by FRP (most intense fires first), cap at 500
    clustered.sort((a, b) => b.frp - a.frp);
    const top = clustered.slice(0, 500);

    const result = { events: top, fetchedAt: new Date().toISOString(), count: top.length, cached: false };
    cache   = result;
    cacheTs = now;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ events: [], error: err.message });
  }
}
