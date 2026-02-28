/**
 * /api/acled-events  (powered by GDELT 2.0 — no auth needed)
 *
 * Fetches recent global conflict events from GDELT 2.0 Events database.
 * GDELT is 100% free, no API key, updated every 15 minutes.
 * Node.js runtime (uses built-in zlib for ZIP decompression).
 * Cache: 30 minutes.
 */
import { inflateRawSync } from 'zlib';

// Node.js serverless handler (req, res) — not edge
export const config = { maxDuration: 10 };

const CACHE_TTL = 30 * 60_000;
let cache   = null;
let cacheTs = 0;

/* ── GDELT 2.0 column indices (0-based, TSV, 61 cols total) ─────────
 *  Geo blocks = 8 fields each: Type|FullName|CC|ADM1|ADM2|Lat|Long|FeatureID
 *  Actor1Geo: 35-42, Actor2Geo: 43-50, ActionGeo: 51-58
 *  DATEADDED: 59, SOURCEURL: 60                                       */
const C = {
  ACTOR1:     6,
  ACTOR2:     16,
  EVENT_CODE: 26,
  EVENT_ROOT: 28,
  QUAD_CLASS: 29,
  GOLDSTEIN:  30,
  MENTIONS:   31,
  GEO_NAME:   52,  // ActionGeo_FullName
  GEO_CC:     53,  // ActionGeo_CountryCode
  GEO_LAT:    56,  // ActionGeo_Lat
  GEO_LNG:    57,  // ActionGeo_Long
  DATE:       59,  // DATEADDED
  SOURCE_URL: 60,  // SOURCEURL
};

/* ── CAMEO labels (Korean) ──────────────────────────────────────────── */
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

/** Parse a single-file ZIP using Node's inflateRawSync */
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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ ...cache, cached: true });
  }

  try {
    /* Step 1: get latest GDELT events file URL */
    const luRes = await fetch('https://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(4000),
    });
    if (!luRes.ok) throw new Error(`GDELT lastupdate ${luRes.status}`);
    const luText    = await luRes.text();
    let eventsUrl   = luText.trim().split('\n')[0].trim().split(/\s+/)[2];
    if (!eventsUrl) throw new Error('Cannot parse GDELT lastupdate.txt');
    eventsUrl = eventsUrl.replace(/^http:\/\//, 'https://');

    /* Step 2: download ZIP as Buffer */
    const zipRes = await fetch(eventsUrl, { signal: AbortSignal.timeout(6000) });
    if (!zipRes.ok) throw new Error(`GDELT file fetch ${zipRes.status}`);
    const zipArrBuf = await zipRes.arrayBuffer();
    const zipBuf    = Buffer.from(zipArrBuf);

    /* Step 3: decompress with Node zlib */
    const tsv = unzipBuffer(zipBuf);

    /* Step 4: parse TSV + filter conflict events */
    const lines  = tsv.split('\n');
    const seen   = new Set();
    const events = [];

    for (const line of lines) {
      if (!line) continue;
      const cols = line.split('\t');
      if (cols.length < 61) continue;

      const quadClass = parseInt(cols[C.QUAD_CLASS])  || 0;
      const eventRoot = cols[C.EVENT_ROOT] || '';
      const goldstein = parseFloat(cols[C.GOLDSTEIN]) || 0;

      const isConflict = quadClass === 4 ||
        (['18', '19', '20'].includes(eventRoot) && goldstein < -2);
      const isProtest  = eventRoot === '14';
      if (!isConflict && !isProtest) continue;

      const lat = parseFloat(cols[C.GEO_LAT]);
      const lng = parseFloat(cols[C.GEO_LNG]);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;

      /* Cluster dedup (0.5° grid + event type) */
      const key = `${Math.round(lat * 2)},${Math.round(lng * 2)},${eventRoot}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const mentions  = parseInt(cols[C.MENTIONS]) || 0;
      const eventCode = cols[C.EVENT_CODE] || '';
      const label     = CAMEO_KO[eventCode] || CAMEO_KO[eventRoot] || eventRoot;
      const geoName   = cols[C.GEO_NAME] || '';
      const country   = cols[C.GEO_CC]   || '';
      const severity  =
        goldstein <= -8 ? 'critical' :
        goldstein <= -5 ? 'high'     :
        goldstein <= -2 ? 'medium'   : 'low';

      events.push({
        id:           `gdelt-${cols[C.DATE]}-${Math.round(lat * 100)}-${Math.round(lng * 100)}`,
        lat, lng,
        region:       geoName,
        country,
        category:     isProtest ? 'social' : 'conflict',
        severity,
        eventType:    label,
        subEventType: eventCode,
        actors:       [cols[C.ACTOR1], cols[C.ACTOR2]].filter(Boolean).join(' vs '),
        fatalities:   0,
        date:         cols[C.DATE],
        notes:        (cols[C.SOURCE_URL] || '').slice(0, 200),
        titleKo:      `${geoName || country}: ${label}`,
        source:       'GDELT',
        goldstein,
        mentions,
      });

      if (events.length >= 300) break;
    }

    /* Sort by media coverage → most significant first */
    events.sort((a, b) => b.mentions - a.mentions);
    const top = events.slice(0, 100);

    const result = {
      events: top,
      fetchedAt: new Date().toISOString(),
      count: top.length,
      source: 'GDELT',
      cached: false,
    };
    cache   = result;
    cacheTs = now;

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);

  } catch (err) {
    return res.status(200).json({ events: [], error: err.message });
  }
}
