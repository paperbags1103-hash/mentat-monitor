/**
 * /api/korea-market
 *
 * Korean market intelligence endpoint for Mentat Monitor.
 * Returns: KOSPI, KOSDAQ, USD/KRW rate, BTC kimchi premium.
 *
 * Data sources (all free, no API key required):
 *  - Yahoo Finance: KOSPI (^KS11), KOSDAQ (^KQ11), USD/KRW (KRW=X)
 *  - Upbit public API: BTC/KRW real-time
 *  - Binance public API: BTC/USDT real-time
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 60_000; // 1 minute in-memory cache
let cache = null;
let cacheTs = 0;

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
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
  return { price, change };
}

async function fetchUpbitBtcKrw() {
  const resp = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error(`Upbit → ${resp.status}`);
  const data = await resp.json();
  const ticker = data?.[0];
  if (!ticker) throw new Error('Upbit: no ticker');
  return {
    price: ticker.trade_price,
    change: ticker.signed_change_rate * 100,
  };
}

async function fetchBinanceBtcUsdt() {
  const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error(`Binance → ${resp.status}`);
  const data = await resp.json();
  return {
    price: parseFloat(data.lastPrice),
    change: parseFloat(data.priceChangePercent),
  };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // In-memory cache
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cache), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Fetch all in parallel with individual error tolerance
  const [kospiResult, kosdaqResult, usdKrwResult, upbitResult, binanceResult] =
    await Promise.allSettled([
      fetchYahoo('^KS11'),
      fetchYahoo('^KQ11'),
      fetchYahoo('KRW=X'),
      fetchUpbitBtcKrw(),
      fetchBinanceBtcUsdt(),
    ]);

  const kospi = kospiResult.status === 'fulfilled' ? kospiResult.value : null;
  const kosdaq = kosdaqResult.status === 'fulfilled' ? kosdaqResult.value : null;
  const usdKrw = usdKrwResult.status === 'fulfilled' ? usdKrwResult.value : null;
  const upbit = upbitResult.status === 'fulfilled' ? upbitResult.value : null;
  const binance = binanceResult.status === 'fulfilled' ? binanceResult.value : null;

  // Kimchi premium calculation
  // Formula: (BTC_KRW / (BTC_USDT * USD_KRW) - 1) * 100
  let kimchiPremium = null;
  if (upbit && binance && usdKrw) {
    const btcKrwImplied = binance.price * usdKrw.price;
    kimchiPremium = ((upbit.price / btcKrwImplied) - 1) * 100;
    kimchiPremium = Math.round(kimchiPremium * 100) / 100; // 2 decimal places
  }

  const result = {
    timestamp: now,
    kospi: kospi ? {
      symbol: '^KS11',
      name: '코스피',
      price: Math.round(kospi.price * 100) / 100,
      change: Math.round(kospi.change * 100) / 100,
    } : null,
    kosdaq: kosdaq ? {
      symbol: '^KQ11',
      name: '코스닥',
      price: Math.round(kosdaq.price * 100) / 100,
      change: Math.round(kosdaq.change * 100) / 100,
    } : null,
    usdKrw: usdKrw ? {
      symbol: 'KRW=X',
      name: '원/달러',
      price: Math.round(usdKrw.price * 10) / 10,
      change: Math.round(usdKrw.change * 100) / 100,
    } : null,
    btcKrw: upbit ? {
      exchange: 'upbit',
      name: 'BTC/KRW',
      price: upbit.price,
      change: Math.round(upbit.change * 100) / 100,
    } : null,
    btcUsdt: binance ? {
      exchange: 'binance',
      name: 'BTC/USDT',
      price: Math.round(binance.price * 100) / 100,
      change: Math.round(binance.change * 100) / 100,
    } : null,
    kimchiPremium,
    errors: {
      kospi: kospiResult.status === 'rejected' ? kospiResult.reason?.message : null,
      kosdaq: kosdaqResult.status === 'rejected' ? kosdaqResult.reason?.message : null,
      usdKrw: usdKrwResult.status === 'rejected' ? usdKrwResult.reason?.message : null,
      upbit: upbitResult.status === 'rejected' ? upbitResult.reason?.message : null,
      binance: binanceResult.status === 'rejected' ? binanceResult.reason?.message : null,
    },
  };

  // Cache the result
  cache = result;
  cacheTs = now;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
