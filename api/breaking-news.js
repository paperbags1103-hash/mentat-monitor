/**
 * /api/breaking-news
 *
 * Near-real-time breaking news from multiple RSS sources.
 * No Groq - keyword-based filtering only (fast).
 * Cache: 5 minutes.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 5 * 60_000;
let cache = null;
let cacheTs = 0;

const SOURCES = [
  { label: 'AlJazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { label: 'Guardian',  url: 'https://www.theguardian.com/world/rss' },
  { label: 'BBC',       url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { label: 'DW',        url: 'https://rss.dw.com/xml/rss-en-all' },
  { label: 'Reuters',   url: 'https://feeds.reuters.com/reuters/worldNews' },
];

const BREAKING_KEYWORDS = [
  'breaking', 'urgent', 'alert', 'crisis', 'attack', 'explosion', 'strike',
  'sanctions', 'nuclear', 'missile', 'war', 'conflict', 'invasion', 'ceasefire',
  'emergency', 'catastrophe', 'earthquake', 'tsunami', 'crash', 'killed',
  'iran', 'israel', 'ukraine', 'taiwan', 'north korea', 'dprk',
  'semiconductor', 'chip ban', 'export control', 'tariff', 'trade war',
  'oil', 'crude', 'opec', 'fed rate', 'interest rate',
  '이란', '이스라엘', '우크라이나', '대만', '북한', '핵', '제재',
];

const COUNTRY_GEO = {
  iran: { lat: 32.4, lng: 53.7, region: '이란' },
  israel: { lat: 31.0, lng: 35.2, region: '이스라엘' },
  ukraine: { lat: 49.0, lng: 31.5, region: '우크라이나' },
  russia: { lat: 61.5, lng: 105.3, region: '러시아' },
  taiwan: { lat: 23.7, lng: 121.0, region: '대만' },
  china: { lat: 35.9, lng: 104.2, region: '중국' },
  'north korea': { lat: 40.3, lng: 127.5, region: '북한' },
  dprk: { lat: 40.3, lng: 127.5, region: '북한' },
  'south korea': { lat: 36.5, lng: 127.9, region: '한국' },
  usa: { lat: 37.1, lng: -95.7, region: '미국' },
  'united states': { lat: 37.1, lng: -95.7, region: '미국' },
  japan: { lat: 36.2, lng: 138.3, region: '일본' },
  gaza: { lat: 31.35, lng: 34.31, region: '가자지구' },
  'middle east': { lat: 29.3, lng: 42.5, region: '중동' },
  syria: { lat: 34.8, lng: 38.9, region: '시리아' },
  lebanon: { lat: 33.8, lng: 35.9, region: '레바논' },
  saudi: { lat: 23.9, lng: 45.1, region: '사우디아라비아' },
  pakistan: { lat: 30.4, lng: 69.3, region: '파키스탄' },
  india: { lat: 20.6, lng: 79.0, region: '인도' },
};

function parseItems(xml) {
  const matches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)];
  return matches.map((m) => {
    const content = m[1];
    const title = (content.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      content.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1]?.trim() ?? '';
    const link = (content.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/) ||
      content.match(/<link>([\s\S]*?)<\/link>/))?.[1]?.trim() ?? '';
    const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/))?.[1]?.trim() ?? '';
    const desc = (content.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      content.match(/<description[^>]*>([\s\S]*?)<\/description>/))?.[1]
      ?.replace(/<[^>]+>/g, '')?.trim() ?? '';
    return { title, link, pubDate, desc };
  });
}

function scoreItem(item) {
  const text = `${item.title} ${item.desc}`.toLowerCase();

  let ageHours = 999;
  if (item.pubDate) {
    try {
      ageHours = (Date.now() - new Date(item.pubDate).getTime()) / 3_600_000;
    } catch { /* noop */ }
  }
  if (ageHours > 12) return null;

  const matchedKeywords = BREAKING_KEYWORDS.filter((kw) => text.includes(kw));
  if (matchedKeywords.length === 0) return null;

  let geo = null;
  for (const [key, coords] of Object.entries(COUNTRY_GEO)) {
    if (text.includes(key)) {
      geo = coords;
      break;
    }
  }

  const isBreaking = matchedKeywords.some((kw) =>
    ['breaking', 'urgent', 'alert', 'attack', 'explosion', 'strike', 'invasion'].includes(kw)
  );
  const severity = isBreaking ? 'critical' : ageHours < 3 ? 'high' : 'medium';

  return {
    id: `bn-${Math.abs([...item.title].reduce((a, c) => a + c.charCodeAt(0), 0)) % 99999}`,
    title: item.title,
    link: item.link,
    source: item.source,
    pubDate: item.pubDate,
    ageHours: Math.round(ageHours * 10) / 10,
    severity,
    breaking: isBreaking,
    keywords: matchedKeywords.slice(0, 3),
    geo,
    score: matchedKeywords.length * 10 - ageHours * 2,
  };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify(cache), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  const results = await Promise.allSettled(
    SOURCES.map((src) =>
      fetch(src.url, { signal: AbortSignal.timeout(3000) })
        .then((r) => r.text())
        .then((xml) => parseItems(xml).map((item) => ({ ...item, source: src.label })))
        .catch(() => [])
    )
  );

  const allItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const scored = allItems
    .map((item) => scoreItem(item))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const deduped = scored.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const output = {
    items: deduped.slice(0, 15),
    breaking: deduped.filter((i) => i.breaking).slice(0, 5),
    fetchedAt: new Date().toISOString(),
    sourceCount: SOURCES.length,
  };

  cache = output;
  cacheTs = now;

  return new Response(JSON.stringify(output), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
