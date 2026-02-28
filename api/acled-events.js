/**
 * /api/acled-events  (powered by GDELT 2.0 — no auth needed)
 *
 * Fetches 2 consecutive GDELT 2.0 files = 30 minutes of global conflict events.
 * Events from the latest file are marked isRecent:true for pulse animation.
 * GDELT updates every 15 minutes, completely free, no API key.
 * Node.js runtime (uses built-in zlib for ZIP decompression).
 * Cache: 5 minutes.
 */
import { inflateRawSync } from 'zlib';

export const config = { maxDuration: 10 };

const CACHE_TTL = 5 * 60_000; // 5 min — GDELT updates every 15min
let cache   = null;
let cacheTs = 0;

/* ── GDELT 2.0 column indices (61 cols, ActionGeo block starts at col 51) */
const C = {
  ACTOR1:     6,
  ACTOR2:     16,
  EVENT_CODE: 26,
  EVENT_ROOT: 28,
  QUAD_CLASS: 29,
  GOLDSTEIN:  30,
  MENTIONS:   31,
  GEO_NAME:   52,
  GEO_CC:     53,
  GEO_LAT:    56,
  GEO_LNG:    57,
  DATE:       59,
  SOURCE_URL: 60,
};

const CAMEO_KO = {
  '14': '시위',      '141': '시위',      '145': '파업',
  '18': '폭력행위',  '180': '공격',      '181': '납치',
  '182': '고문',     '183': '부상',      '184': '살인',
  '185': '자살공격', '186': '대중폭력',
  '19': '전투',      '190': '교전',      '193': '공습',
  '194': '포격',     '195': '기뢰',
  '20': '군사력 사용', '201': '생화학무기', '202': '핵무기',
  '203': '대량살상무기', '204': '군사전략',
};

function unzipBuffer(buf) {
  const fnLen    = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const method   = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const offset   = 30 + fnLen + extraLen;
  const compData = buf.slice(offset, offset + compSize);
  if (method === 0) return compData.toString('utf8');
  if (method !== 8) throw new Error(`Unsupported ZIP method: ${method}`);
  return inflateRawSync(compData).toString('utf8');
}

/** Derive the URL for a GDELT file N minutes earlier */
function shiftUrl(url, minutesBack) {
  const m = url.match(/(\d{14})\.export/);
  if (!m) return null;
  const ts = m[1];
  const d  = new Date(Date.UTC(
    +ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8),
    +ts.slice(8, 10), +ts.slice(10, 12)
  ));
  d.setUTCMinutes(d.getUTCMinutes() - minutesBack);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const newTs = `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
  return url.replace(m[1], newTs);
}

async function fetchAndParseGDELT(url, isRecent) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const buf = Buffer.from(await res.arrayBuffer());
  const tsv = unzipBuffer(buf);

  const events = [];
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 61) continue;

    const quadClass = parseInt(cols[C.QUAD_CLASS]) || 0;
    const eventRoot = cols[C.EVENT_ROOT] || '';
    const goldstein = parseFloat(cols[C.GOLDSTEIN]) || 0;

    const isConflict = quadClass === 4 ||
      (['18', '19', '20'].includes(eventRoot) && goldstein < -2);
    const isProtest  = eventRoot === '14';
    if (!isConflict && !isProtest) continue;

    const lat = parseFloat(cols[C.GEO_LAT]);
    const lng = parseFloat(cols[C.GEO_LNG]);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;

    const mentions  = parseInt(cols[C.MENTIONS]) || 0;
    const eventCode = cols[C.EVENT_CODE] || '';
    const geoName   = cols[C.GEO_NAME] || '';
    const severity  =
      goldstein <= -8 ? 'critical' :
      goldstein <= -5 ? 'high'     :
      goldstein <= -2 ? 'medium'   : 'low';

    events.push({
      id:           `gdelt-${cols[C.DATE]}-${Math.round(lat*100)}-${Math.round(lng*100)}`,
      lat, lng,
      region:       geoName,
      country:      cols[C.GEO_CC] || '',
      category:     isProtest ? 'social' : 'conflict',
      severity,
      eventType:    CAMEO_KO[eventCode] || CAMEO_KO[eventRoot] || eventRoot,
      subEventType: eventCode,
      actors:       [cols[C.ACTOR1], cols[C.ACTOR2]].filter(Boolean).join(' vs '),
      fatalities:   0,
      date:         cols[C.DATE],
      notes:        (cols[C.SOURCE_URL] || '').slice(0, 200),
      titleKo:      `${geoName || cols[C.GEO_CC]}: ${CAMEO_KO[eventCode] || CAMEO_KO[eventRoot] || eventRoot}`,
      source:       'GDELT',
      goldstein,
      mentions,
      isRecent,     // true = latest 15min file → pulse animation on frontend
    });
  }
  return events;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ ...cache, cached: true });
  }

  try {
    // Step 1: get latest file URL
    const luRes = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(4000),
    });
    if (!luRes.ok) throw new Error(`GDELT lastupdate ${luRes.status}`);
    const latestUrl = (await luRes.text()).trim().split('\n')[0].trim().split(/\s+/)[2];
    if (!latestUrl) throw new Error('Cannot parse GDELT lastupdate.txt');

    const prevUrl = shiftUrl(latestUrl, 15); // previous 15-min file

    // Step 2: fetch both files in parallel
    const [recentEvents, prevEvents] = await Promise.all([
      fetchAndParseGDELT(latestUrl, true),
      prevUrl ? fetchAndParseGDELT(prevUrl, false) : Promise.resolve([]),
    ]);

    // Step 3: merge + dedup by location cluster
    const seen = new Set();
    const merged = [];
    for (const ev of [...recentEvents, ...prevEvents]) {
      const key = `${Math.round(ev.lat * 2)},${Math.round(ev.lng * 2)},${ev.subEventType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(ev);
      if (merged.length >= 400) break;
    }

    merged.sort((a, b) => b.mentions - a.mentions);
    const top = merged.slice(0, 120);

    const result = {
      events:     top,
      fetchedAt:  new Date().toISOString(),
      count:      top.length,
      recentCount: recentEvents.length,
      source:     'GDELT',
      cached:     false,
    };
    cache   = result;
    cacheTs = now;

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);

  } catch (err) {
    return res.status(200).json({ events: [], error: err.message });
  }
}
