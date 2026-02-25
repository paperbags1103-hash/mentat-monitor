/**
 * /api/chart-data?symbol=^KS11&range=3mo
 *
 * OHLCV chart data via Yahoo Finance (unofficial)
 * Supports: stocks, indices, FX, crypto, ETFs
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE = new Map(); // symbol:range → { bars, ts }
const CACHE_TTL = 5 * 60_000;

// Yahoo Finance interval map
const RANGE_TO_INTERVAL = {
  '1d': '5m', '5d': '15m', '1mo': '1d',
  '3mo': '1d', '6mo': '1wk', '1y': '1wk', '2y': '1mo', '5y': '1mo',
};

async function fetchYahoo(symbol, range) {
  const interval = RANGE_TO_INTERVAL[range] ?? '1d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens   = quote.open   ?? [];
  const highs   = quote.high   ?? [];
  const lows    = quote.low    ?? [];
  const closes  = quote.close  ?? [];
  const volumes = quote.volume ?? [];

  const bars = timestamps.map((t, i) => ({
    time:   t,
    open:   opens[i]   ?? null,
    high:   highs[i]   ?? null,
    low:    lows[i]    ?? null,
    close:  closes[i]  ?? null,
    volume: volumes[i] ?? null,
  })).filter(b => b.close !== null && b.open !== null);

  return { bars, meta: { symbol, currency: result.meta?.currency, regularMarketPrice: result.meta?.regularMarketPrice } };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: corsHeaders });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') ?? '^KS11';
  const range  = url.searchParams.get('range')  ?? '3mo';

  const cacheKey = `${symbol}:${range}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders }
    });
  }

  try {
    const data = await fetchYahoo(symbol, range);
    CACHE.set(cacheKey, { data, ts: Date.now() });
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, bars: [] }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
