/**
 * /api/precious-metals
 *
 * Gold & Silver intelligence for Mentat Monitor.
 * Goes beyond simple price — tracks physical demand signals and spread anomalies.
 *
 * Data sources (all free):
 *  - Yahoo Finance: GC=F (Gold futures), SI=F (Silver futures), GLD, SLV ETFs
 *  - Yahoo Finance: Gold/Silver ratio, miner ETFs (GDX, GDXJ, SIL, SILJ)
 *  - Yahoo Finance: Key miner stocks (NEM, GOLD, AG, WPM, PAAS)
 *  - Alternative.me: (no precious metals — skip)
 *
 * Calculated signals:
 *  - Gold/Silver Ratio (historical: 80+ = silver undervalued)
 *  - GLD ETF shares outstanding change (proxy for institutional demand)
 *  - Miners vs Metal spread (GDX/GC divergence = leading indicator)
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 120_000; // 2 min
let cache = null;
let cacheTs = 0;

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Yahoo ${symbol} → ${resp.status}`);
  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: no result`);

  const price = result.meta?.regularMarketPrice;
  const prevClose = result.meta?.chartPreviousClose || result.meta?.previousClose;
  const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  // Extract 5-day sparkline
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const sparkline = closes.filter(Boolean).slice(-5);

  return { price, change, sparkline };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cache), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Fetch all in parallel
  const symbols = {
    // Futures
    gold: 'GC=F',
    silver: 'SI=F',
    // ETFs (physical-backed)
    gld: 'GLD',      // SPDR Gold Trust — tracks gold
    slv: 'SLV',      // iShares Silver Trust
    // Miner ETFs
    gdx: 'GDX',      // Senior gold miners
    gdxj: 'GDXJ',    // Junior gold miners
    sil: 'SIL',      // Global silver miners
    silj: 'SILJ',    // Junior silver miners
    // Key miners (map layer dots)
    nem: 'NEM',      // Newmont — world's largest gold miner
    gold: 'GOLD',    // Barrick Gold
    ag: 'AG',        // First Majestic Silver
    wpm: 'WPM',      // Wheaton Precious Metals (streaming)
    paas: 'PAAS',    // Pan American Silver
  };

  const results = await Promise.allSettled(
    Object.entries(symbols).map(async ([key, sym]) => [key, await fetchYahooQuote(sym)])
  );

  const data = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [key, val] = r.value;
      data[key] = val;
    }
  }

  // === Calculated signals ===

  // 1. Gold/Silver Ratio
  let gsRatio = null;
  let gsRatioSignal = null;
  if (data.gold?.price && data.silver?.price) {
    gsRatio = Math.round((data.gold.price / data.silver.price) * 100) / 100;
    // Historical context: avg ~60, extreme cheap silver > 80, extreme expensive < 40
    if (gsRatio > 90)      gsRatioSignal = 'SILVER_EXTREMELY_CHEAP';
    else if (gsRatio > 80) gsRatioSignal = 'SILVER_CHEAP';
    else if (gsRatio > 65) gsRatioSignal = 'NEUTRAL';
    else if (gsRatio > 50) gsRatioSignal = 'SILVER_EXPENSIVE';
    else                   gsRatioSignal = 'SILVER_EXTREMELY_EXPENSIVE';
  }

  // 2. Miners vs Metal divergence
  // GDX should roughly track gold. If GDX diverging significantly = leading signal
  let minersDivergence = null;
  if (data.gdx?.change != null && data.gold?.change != null) {
    minersDivergence = Math.round((data.gdx.change - data.gold.change) * 100) / 100;
    // +2% = miners leading gold up (bullish), -2% = miners lagging (bearish)
  }

  // 3. Paper vs Physical spread proxy
  // GLD tracks gold price. If GLD premium/discount to NAV is extreme = stress signal
  // (Simplified: GLD % change vs GC=F % change)
  let paperPhysicalSpread = null;
  if (data.gld?.change != null && data.gold?.change != null) {
    paperPhysicalSpread = Math.round((data.gld.change - data.gold.change) * 1000) / 1000;
    // Should be near 0. Large deviation = ETF stress or arbitrage opportunity
  }

  const result = {
    timestamp: now,
    // Core prices
    goldFutures: data.gold ? {
      symbol: 'GC=F', name: '금 선물 (COMEX)',
      price: Math.round(data.gold.price * 100) / 100,
      change: Math.round(data.gold.change * 100) / 100,
      unit: 'USD/troy oz',
      sparkline: data.gold.sparkline,
    } : null,
    silverFutures: data.silver ? {
      symbol: 'SI=F', name: '은 선물 (COMEX)',
      price: Math.round(data.silver.price * 1000) / 1000,
      change: Math.round(data.silver.change * 100) / 100,
      unit: 'USD/troy oz',
      sparkline: data.silver.sparkline,
    } : null,
    // ETFs
    gld: data.gld ? { symbol: 'GLD', name: 'SPDR Gold ETF', price: data.gld.price, change: Math.round(data.gld.change * 100) / 100 } : null,
    slv: data.slv ? { symbol: 'SLV', name: 'iShares Silver ETF', price: data.slv.price, change: Math.round(data.slv.change * 100) / 100 } : null,
    // Miner ETFs
    minerEtfs: {
      gdx: data.gdx ? { symbol: 'GDX', name: '선진 금광주 ETF', price: data.gdx.price, change: Math.round(data.gdx.change * 100) / 100 } : null,
      gdxj: data.gdxj ? { symbol: 'GDXJ', name: '주니어 금광주 ETF', price: data.gdxj.price, change: Math.round(data.gdxj.change * 100) / 100 } : null,
      sil: data.sil ? { symbol: 'SIL', name: '글로벌 은광주 ETF', price: data.sil.price, change: Math.round(data.sil.change * 100) / 100 } : null,
      silj: data.silj ? { symbol: 'SILJ', name: '주니어 은광주 ETF', price: data.silj.price, change: Math.round(data.silj.change * 100) / 100 } : null,
    },
    // Key miners (for map layer)
    miners: [
      data.nem ? { symbol: 'NEM', name: 'Newmont', type: 'gold', price: data.nem.price, change: Math.round(data.nem.change * 100) / 100, lat: 39.75, lng: -104.99 } : null,
      data.gold ? { symbol: 'GOLD', name: 'Barrick Gold', type: 'gold', price: data.gold.price, change: Math.round(data.gold.change * 100) / 100, lat: 43.65, lng: -79.38 } : null,
      data.ag ? { symbol: 'AG', name: 'First Majestic Silver', type: 'silver', price: data.ag.price, change: Math.round(data.ag.change * 100) / 100, lat: 23.0, lng: -102.0 } : null,
      data.wpm ? { symbol: 'WPM', name: 'Wheaton Precious Metals', type: 'streaming', price: data.wpm.price, change: Math.round(data.wpm.change * 100) / 100, lat: 49.28, lng: -123.12 } : null,
      data.paas ? { symbol: 'PAAS', name: 'Pan American Silver', type: 'silver', price: data.paas.price, change: Math.round(data.paas.change * 100) / 100, lat: 49.28, lng: -123.12 } : null,
    ].filter(Boolean),
    // Signals
    signals: {
      gsRatio,
      gsRatioSignal,
      // e.g. 85 → "SILVER_CHEAP (역대 평균 60, 현재 85)"
      gsRatioNote: gsRatio ? `역대 평균 ~60 | 현재 ${gsRatio} | ${gsRatioSignal}` : null,
      minersDivergence,
      minersDivergenceNote: minersDivergence !== null
        ? `GDX vs 금 선물 ${minersDivergence > 0 ? '+' : ''}${minersDivergence}% | ${minersDivergence > 1 ? '광산주 선행 (강세 신호)' : minersDivergence < -1 ? '광산주 후행 (약세 신호)' : '중립'}`
        : null,
      paperPhysicalSpread,
    },
  };

  cache = result;
  cacheTs = now;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
