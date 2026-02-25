/**
 * /api/global-macro
 *
 * Global macro indicators:
 * - DXY (dollar index)
 * - US yield curve: 2Y, 10Y, 30Y; spread 2s10s, 10s30s
 * - Real rates: TIPS 10Y (DFII10 via FRED)
 * - Gold/real-rate correlation signal
 * - Copper/Gold ratio (global growth proxy)
 *
 * Cache: 15 min
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 15 * 60_000;
let cache = null, cacheTs = 0;

// Yahoo Finance symbols
const YAHOO_SYMBOLS = {
  dxy:    'DX-Y.NYB',
  y2:     '^IRX',      // 13-week T-Bill (proxy for 3M); use ^IRX for short end
  y10:    '^TNX',      // 10Y yield
  y30:    '^TYX',      // 30Y yield
  gold:   'GC=F',
  copper: 'HG=F',
  tips10: 'TIP',       // TIPS ETF (proxy for real rates)
  vix:    '^VIX',
  spx:    '^GSPC',     // S&P 500
  nasdaq: '^IXIC',     // 나스닥
  oil:    'CL=F',      // WTI 원유
};

// FRED for real rates
const FRED_REAL = 'DFII10'; // 10Y TIPS yield

async function batchYahoo(symbols) {
  const results = {};
  await Promise.all(Object.entries(symbols).map(async ([key, sym]) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return;
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      const closes = r?.indicators?.quote?.[0]?.close?.filter(c => c != null) ?? [];
      const meta   = r?.meta ?? {};
      if (closes.length < 1) return;
      const curr = closes.at(-1);
      const prev = closes.at(-2) ?? curr;
      results[key] = { price: curr, prev, changePct: ((curr - prev) / prev) * 100, symbol: sym, name: meta.shortName ?? sym };
    } catch { /* skip */ }
  }));
  return results;
}

async function fetchFredReal() {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${FRED_REAL}&api_key=${key}&file_type=json&sort_order=desc&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const obs  = data.observations?.filter(o => o.value !== '.') ?? [];
    return obs.length > 0 ? { rate: parseFloat(obs[0].value), prev: parseFloat(obs[1]?.value ?? obs[0].value) } : null;
  } catch { return null; }
}

function interpretCurve(y2, y10) {
  const spread = y10 - y2;
  if (spread < -0.5) return { label: '강한 역전', emoji: '🔴', sentiment: 'recession_warning' };
  if (spread < 0)    return { label: '경미한 역전', emoji: '🟠', sentiment: 'caution' };
  if (spread < 0.5)  return { label: '평탄화', emoji: '🟡', sentiment: 'neutral' };
  if (spread < 1.5)  return { label: '정상', emoji: '🟢', sentiment: 'normal' };
  return { label: '가파름', emoji: '🔵', sentiment: 'growth' };
}

function dxySignal(dxyPrice, dxyChg) {
  if (dxyChg > 1)    return { ko: '달러 급등 — 신흥국 통화 압박, 원자재 하방 압력', sentiment: 'usd_surge' };
  if (dxyChg > 0.3)  return { ko: '달러 강세 — 원화 약세 주의', sentiment: 'usd_strong' };
  if (dxyChg < -1)   return { ko: '달러 급락 — 글로벌 리스크온, 신흥국 강세', sentiment: 'usd_plunge' };
  if (dxyChg < -0.3) return { ko: '달러 약세 — 위험자산·원자재 우호적', sentiment: 'usd_weak' };
  return { ko: '달러 횡보', sentiment: 'neutral' };
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

  const [yahoo, realRate] = await Promise.all([
    batchYahoo(YAHOO_SYMBOLS),
    fetchFredReal(),
  ]);

  const dxy    = yahoo.dxy;
  const y2     = yahoo.y2;
  const y10    = yahoo.y10;
  const y30    = yahoo.y30;
  const gold   = yahoo.gold;
  const copper = yahoo.copper;
  const vix    = yahoo.vix;
  const spx    = yahoo.spx;
  const nasdaq = yahoo.nasdaq;
  const oil    = yahoo.oil;

  // Yield curve
  const y2Rate  = y2?.price   ?? null;
  const y10Rate = y10?.price  ?? null;
  const y30Rate = y30?.price  ?? null;
  const spread2s10s = (y10Rate != null && y2Rate != null)  ? y10Rate - y2Rate  : null;
  const spread10s30s = (y30Rate != null && y10Rate != null) ? y30Rate - y10Rate : null;
  const curveInterp = (spread2s10s != null && y2Rate != null && y10Rate != null)
    ? interpretCurve(y2Rate, y10Rate) : null;

  // Real rate
  const realRateValue = realRate?.rate ?? (y10Rate ? y10Rate - 2.3 : null); // rough: nominal - breakeven proxy
  const realRatePrev  = realRate?.prev ?? null;
  const realRateChg   = (realRateValue != null && realRatePrev != null) ? realRateValue - realRatePrev : null;

  // Gold vs real rates signal
  let goldRealSignal = null;
  if (gold && realRateValue != null) {
    if (realRateValue < 0)          goldRealSignal = '실질금리 마이너스 → 금 강세 환경';
    else if (realRateValue < 1)     goldRealSignal = '실질금리 낮음 → 금 보유 유리';
    else if (realRateValue < 2)     goldRealSignal = '실질금리 상승 중 → 금 단기 압박 가능';
    else                            goldRealSignal = '높은 실질금리 → 금 헤지 비용 증가';
  }

  // Copper/Gold ratio (global growth proxy)
  let copperGoldRatio = null;
  let copperGoldSignal = null;
  if (copper?.price && gold?.price) {
    copperGoldRatio = (copper.price / gold.price) * 1000; // per troy oz
    if (copper.changePct > gold.changePct + 0.5) copperGoldSignal = '구리 ↑ 금 ↓ → 글로벌 성장 기대 상승';
    else if (gold.changePct > copper.changePct + 0.5) copperGoldSignal = '금 ↑ 구리 ↓ → 안전자산 선호, 경기 둔화 우려';
    else copperGoldSignal = '구리·금 균형 — 중립적 성장 기대';
  }

  const payload = {
    dxy: dxy ? {
      price: dxy.price, changePct: dxy.changePct,
      signal: dxySignal(dxy.price, dxy.changePct),
    } : null,
    yieldCurve: {
      y2: y2Rate, y10: y10Rate, y30: y30Rate,
      spread2s10s, spread10s30s,
      interpretation: curveInterp,
    },
    realRate: {
      value:  realRateValue,
      change: realRateChg,
      source: realRate ? 'fred' : 'estimated',
      goldSignal: goldRealSignal,
    },
    copperGold: {
      ratio:  copperGoldRatio,
      signal: copperGoldSignal,
      copper: copper ? { price: copper.price, changePct: copper.changePct } : null,
    },
    vix:    vix    ? { price: vix.price,    changePct: vix.changePct    } : null,
    spx:    spx    ? { price: spx.price,    changePct: spx.changePct    } : null,
    nasdaq: nasdaq ? { price: nasdaq.price, changePct: nasdaq.changePct } : null,
    gold:   gold   ? { price: gold.price,   changePct: gold.changePct   } : null,
    oil:    oil    ? { price: oil.price,    changePct: oil.changePct    } : null,
    timestamp: Date.now(),
  };

  cache = payload; cacheTs = Date.now();
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
