/**
 * /api/gdacs-alerts
 *
 * Global Disaster Alert and Coordination System (UN OCHA).
 * Real-time Red/Orange alerts: earthquakes, cyclones, floods, volcanoes, etc.
 * No API key required.
 * Cache: 30 minutes.
 */
export const config = { maxDuration: 10 };

const CACHE_TTL = 30 * 60_000;
let cache = null;
let cacheTs = 0;

const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';

const TYPE_KO = {
  EQ: '지진',  TC: '태풍',   FL: '홍수',  VO: '화산',
  DR: '가뭄',  WF: '산불',   TS: '해일',  EC: '메뚜기',
};

const LEVEL_SEVERITY = { Red: 'critical', Orange: 'high', Green: 'medium' };

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)<\/${name}>`));
  return m ? m[1].trim() : '';
}

function parseItems(xml) {
  const out = [];
  let m;
  const re = /<item[\s>]([\s\S]*?)<\/item>/g;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
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
    const r = await fetch(GDACS_RSS, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(`GDACS ${r.status}`);
    const xml = await r.text();

    const events = parseItems(xml).map((item, idx) => {
      const latStr = tag(item, 'geo:lat');
      const lngStr = tag(item, 'geo:long');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (isNaN(lat) || isNaN(lng)) return null;

      const alertLevel = tag(item, 'gdacs:alertlevel') || 'Green';
      const eventType  = tag(item, 'gdacs:eventtype')  || '';
      const country    = tag(item, 'gdacs:country')    || '';
      const title      = tag(item, 'title');
      const pubDate    = tag(item, 'pubDate');
      const score      = parseFloat(tag(item, 'gdacs:alertscore')) || 0;

      return {
        id:         `gdacs-${idx}`,
        lat, lng,
        alertLevel,
        eventType:  TYPE_KO[eventType] || eventType,
        eventCode:  eventType,
        country,
        severity:   LEVEL_SEVERITY[alertLevel] || 'low',
        score,
        title,
        date:       pubDate,
        category:   'disaster',
        titleKo:    `${country}: ${TYPE_KO[eventType] || eventType} (${alertLevel})`,
        source:     'GDACS',
      };
    }).filter(Boolean);

    const result = { events, fetchedAt: new Date().toISOString(), count: events.length, cached: false };
    cache   = result;
    cacheTs = now;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ events: [], error: err.message });
  }
}
