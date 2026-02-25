/**
 * /api/credit-stress
 *
 * Credit stress indicators:
 * - US IG/HY spreads via FRED API (BAMLH0A0HYM2, BAMLC0A0CM)
 * - TED spread (proxy: 3m T-Bill vs SOFR)
 * - VIX correlation
 *
 * Cache: 15 min
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 15 * 60_000;
let cache = null, cacheTs = 0;

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';

// FRED series
const SERIES = {
  hy:  'BAMLH0A0HYM2',   // US HY OAS spread (bps/100 in %)
  ig:  'BAMLC0A0CM',     // US IG OAS spread (bps/100 in %)
  ted: 'TEDRATE',         // TED spread (T-Bill minus SOFR proxy)
};

async function fetchFred(seriesId) {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;

  const url = new URL(FRED_API);
  url.searchParams.set('series_id',         seriesId);
  url.searchParams.set('api_key',           key);
  url.searchParams.set('file_type',         'json');
  url.searchParams.set('sort_order',        'desc');
  url.searchParams.set('limit',             '5');
  url.searchParams.set('observation_start', '2020-01-01');

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const obs  = json.observations?.filter(o => o.value !== '.') ?? [];
    return obs.length > 0 ? { current: parseFloat(obs[0].value), prev: parseFloat(obs[1]?.value ?? obs[0].value) } : null;
  } catch { return null; }
}

// Fallback: Yahoo Finance ETF prices to approximate spread
async function fetchYahooFallback() {
  // HYG = iShares iBoxx HY; LQD = iShares IG; we use simple heuristics
  try {
    const symbols = ['HYG', 'LQD', '^VIX'];
    const results = await Promise.all(symbols.map(async sym => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { sym, price: null, prev: null };
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const clean  = closes.filter(c => c != null);
      return { sym, price: clean.at(-1) ?? null, prev: clean.at(-2) ?? null };
    }));
    return results.reduce((acc, r) => { acc[r.sym] = r; return acc; }, {});
  } catch { return {}; }
}

function classifyStress(hySpread, igSpread) {
  // HY spread historically: <300=low, 300-500=elevated, 500-700=high, >700=critical
  if (hySpread >= 700) return 'CRITICAL';
  if (hySpread >= 500) return 'HIGH';
  if (hySpread >= 300) return 'ELEVATED';
  return 'LOW';
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Try FRED first, fall back to Yahoo-derived approximation
  const [hyData, igData, tedData] = await Promise.all([
    fetchFred(SERIES.hy),
    fetchFred(SERIES.ig),
    fetchFred(SERIES.ted),
  ]);

  let hySpread, igSpread, hyChange, igChange, tedSpread, tedChange;

  if (hyData && igData) {
    // FRED values are in % → convert to bps (*100)
    hySpread = hyData.current * 100;
    igSpread = igData.current * 100;
    hyChange = (hyData.current - hyData.prev) * 100;
    igChange = (igData.current - igData.prev) * 100;
    tedSpread = tedData ? tedData.current * 100 : null;
    tedChange = tedData ? (tedData.current - tedData.prev) * 100 : null;
  } else {
    // Yahoo fallback: rough approximation using ETF returns
    const yahoo = await fetchYahooFallback();
    const vix   = yahoo['^VIX'];
    const hygRt  = yahoo['HYG'];
    const lqdRt  = yahoo['LQD'];

    // Approximate spread from yield (HYG yield ≈ 7-9%, LQD ≈ 4-5%)
    // Use VIX as a proxy for overall credit stress
    const vixLevel = vix?.price ?? 20;
    hySpread  = Math.round(250 + vixLevel * 7 + (hygRt?.price ? (100 - hygRt.price) * 2 : 0));
    igSpread  = Math.round(80 + vixLevel * 2);
    hyChange  = vix?.prev ? Math.round((vixLevel - vix.prev) * 5) : 0;
    igChange  = Math.round(hyChange * 0.25);
    tedSpread = null; tedChange = null;
  }

  const stressLevel = classifyStress(hySpread, igSpread);

  const payload = {
    igSpread:   Math.round(igSpread),
    hySpread:   Math.round(hySpread),
    igChange:   Math.round(igChange),
    hyChange:   Math.round(hyChange),
    tedSpread:  tedSpread != null ? Math.round(tedSpread) : null,
    tedChange:  tedChange != null ? Math.round(tedChange) : null,
    stressLevel,
    dataSource: hyData ? 'fred' : 'yahoo_approx',
    commentary: buildCommentary(hySpread, igSpread, stressLevel),
    timestamp:  Date.now(),
  };

  cache = payload; cacheTs = Date.now();
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}

function buildCommentary(hy, ig, level) {
  const LEVEL_KO = { LOW: '안정', ELEVATED: '주의', HIGH: '경계', CRITICAL: '위험' };
  const lvl = LEVEL_KO[level] ?? level;
  return `HY 스프레드 ${hy}bps, IG ${ig}bps — 신용시장 ${lvl} 수준. ` +
    (hy > 500 ? '고수익채 압박이 심화되고 있어 위험자산 익스포저 축소 권장.' :
     hy > 300 ? '스프레드 확대 추세, 포트폴리오 방어적 포지션 고려.' :
     '신용시장 정상 범위 유지.');
}
