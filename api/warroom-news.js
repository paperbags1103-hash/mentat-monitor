/**
 * War Room 실시간 뉴스 — 이란/이스라엘/중동 관련 최신 헤드라인
 * Reuters, Al Jazeera, BBC RSS 피드 파싱
 * 60초 캐시
 */
export const config = { runtime: 'nodejs18.x' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1분

const FEEDS = [
  { name: 'Reuters World', url: 'https://feeds.reuters.com/Reuters/worldNews', bias: 0 },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', bias: 0 },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', bias: 0 },
];

const KEYWORDS = ['iran','israel','idf','irgc','hamas','hezbollah','gaza','lebanon','hormuz','nuclear','missile','strike','war','attack','military'];

function parseRSS(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title   = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ?? /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim() ?? '';
    const link    = (/<link>(.*?)<\/link>/.exec(block) ?? /<guid>(.*?)<\/guid>/.exec(block))?.[1]?.trim() ?? '';
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? '';
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  const allItems = [];
  for (const feed of FEEDS) {
    try {
      const resp = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml' },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const items = parseRSS(xml);
      // 중동 관련 필터링
      const filtered = items.filter(i => {
        const text = i.title.toLowerCase();
        return KEYWORDS.some(k => text.includes(k));
      }).slice(0, 5);
      filtered.forEach(i => allItems.push({ ...i, source: feed.name }));
    } catch {}
  }

  // 날짜 정렬 (최신 우선)
  allItems.sort((a, b) => {
    const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tb - ta;
  });

  const result = allItems.slice(0, 12).map(i => ({
    title: i.title,
    source: i.source,
    link: i.link,
    pubDate: i.pubDate,
    age: i.pubDate ? Math.floor((Date.now() - new Date(i.pubDate).getTime()) / 60000) : null,
  }));

  cache = { items: result, fetchedAt: Date.now() };
  cacheTime = Date.now();
  return res.json(cache);
}
