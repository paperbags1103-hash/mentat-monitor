/**
 * /api/acled-events  (powered by GDELT 2.0 — no auth needed)
 *
 * Fetches recent global conflict events from GDELT 2.0 Events database.
 * GDELT is 100% free, no API key, updated every 15 minutes.
 * Cache: 30 minutes.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 30 * 60_000;
let cache   = null;
let cacheTs = 0;

/* ── GDELT column indices (0-based, tab-separated) ─────────────────── */
const C = {
  ACTOR1:      6,
  ACTOR2:      16,
  EVENT_CODE:  26,
  EVENT_ROOT:  28,
  QUAD_CLASS:  29,
  GOLDSTEIN:   30,
  MENTIONS:    31,
  GEO_NAME:    50,
  GEO_CC:      51,
  GEO_LAT:     53,
  GEO_LNG:     54,
  DATE:        56,
  SOURCE_URL:  57,
};

/* ── CAMEO conflict root codes ──────────────────────────────────────── */
const CAMEO_KO = {
  '14': '시위',      '141': '시위',     '145': '파업',
  '18': '폭력행위',  '180': '공격',     '181': '납치',
  '182': '고문',     '183': '부상',     '184': '살인',
  '185': '자살공격', '186': '대중폭력',
  '19': '전투',      '190': '교전',     '193': '공습',
  '194': '포격',     '195': '기뢰',
  '20': '군사력 사용', '201': '생화학무기', '202': '핵무기',
  '203': '대량살상무기', '204': '군사전략',
};

/* ── Decompress a single-file ZIP using Web Streams DecompressionStream */
async function unzip(buf) {
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error('Not a ZIP');
  const fnLen    = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const method   = view.getUint16(8,  true);
  const compSize = view.getUint32(18, true);
  const dataOff  = 30 + fnLen + extraLen;
  const comp     = buf.slice(dataOff, dataOff + compSize);

  if (method === 0) return new TextDecoder().decode(comp);
  if (method !== 8) throw new Error(`Unsupported ZIP method: ${method}`);

  const ds     = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(new Uint8Array(comp));
  writer.close();

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return new TextDecoder().decode(out);
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  try {
    /* Step 1: get latest GDELT events file URL */
    const luRes = await fetch('https://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(4000),
    });
    if (!luRes.ok) throw new Error(`GDELT lastupdate ${luRes.status}`);
    const luText   = await luRes.text();
    const eventsUrl = luText.trim().split('\n')[0].trim().split(/\s+/)[2];
    if (!eventsUrl) throw new Error('Cannot parse GDELT lastupdate.txt');

    /* Step 2: download + decompress ZIP */
    const zipRes = await fetch(eventsUrl, { signal: AbortSignal.timeout(6000) });
    if (!zipRes.ok) throw new Error(`GDELT file fetch ${zipRes.status}`);
    const zipBuf = await zipRes.arrayBuffer();
    const tsv    = await unzip(zipBuf);

    /* Step 3: parse TSV and filter conflict events */
    const lines  = tsv.split('\n');
    const seen   = new Set();
    const events = [];

    for (const line of lines) {
      if (!line) continue;
      const cols = line.split('\t');
      if (cols.length < 58) continue;

      const quadClass = parseInt(cols[C.QUAD_CLASS])  || 0;
      const eventRoot = cols[C.EVENT_ROOT] || '';
      const goldstein = parseFloat(cols[C.GOLDSTEIN]) || 0;

      /* Keep: material conflict (quadClass 4) OR assault/fight/military with negative Goldstein */
      const isConflict = quadClass === 4 ||
        (['18', '19', '20'].includes(eventRoot) && goldstein < -2);
      const isProtest  = eventRoot === '14';
      if (!isConflict && !isProtest) continue;

      const lat = parseFloat(cols[C.GEO_LAT]);
      const lng = parseFloat(cols[C.GEO_LNG]);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;

      /* Cluster dedup (0.5° grid) */
      const key = `${Math.round(lat * 2)},${Math.round(lng * 2)},${eventRoot}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const mentions  = parseInt(cols[C.MENTIONS]) || 0;
      const eventCode = cols[C.EVENT_CODE] || '';
      const label     = CAMEO_KO[eventCode] || CAMEO_KO[eventRoot] || eventRoot;
      const geoName   = cols[C.GEO_NAME] || '';
      const country   = cols[C.GEO_CC]   || '';

      const severity =
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

      if (events.length >= 300) break; // collect enough before sort
    }

    /* Sort by media coverage (NumMentions) → most significant first */
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

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
    });

  } catch (err) {
    return new Response(JSON.stringify({ events: [], error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
