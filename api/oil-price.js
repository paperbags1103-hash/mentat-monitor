/**
 * Oil Price — WTI/Brent 실시간 (Yahoo Finance proxy)
 * 15분 캐시
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 15 * 60_000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    const [wtiRes, brentRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?range=1d&interval=5m', { headers }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?range=1d&interval=5m', { headers }),
    ]);

    const [wtiData, brentData] = await Promise.all([wtiRes.json(), brentRes.json()]);

    const extract = (data) => {
      const result = data?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const price = meta?.regularMarketPrice ?? null;
      const prev  = meta?.previousClose ?? null;
      const change = price && prev ? ((price - prev) / prev * 100) : 0;
      return { price, prev, change: +change.toFixed(2), symbol: meta?.symbol };
    };

    const wti   = extract(wtiData);
    const brent = extract(brentData);

    cache = { wti, brent, fetchedAt: Date.now() };
    cacheTime = Date.now();
    return res.json(cache);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
