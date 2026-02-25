/**
 * /api/fear-greed
 *
 * CNN Fear & Greed Index proxy
 * Falls back gracefully if CNN blocks the request.
 *
 * Cache: 15 min
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 15 * 60_000;
let cache = null, cacheTs = 0;

// CNN's unofficial endpoint
const CNN_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  try {
    const res = await fetch(CNN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.cnn.com/',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`CNN ${res.status}`);
    const data = await res.json();

    const fg = data?.fear_and_greed;
    if (!fg) throw new Error('No fear_and_greed in response');

    const payload = {
      fear_and_greed: {
        score:          parseFloat(fg.score),
        rating:         fg.rating,
        description:    scoreToKo(parseFloat(fg.score)),
        previous_close: parseFloat(fg.previous_close),
        previous_1_week: fg.previous_1_week ? parseFloat(fg.previous_1_week) : null,
        previous_1_month: fg.previous_1_month ? parseFloat(fg.previous_1_month) : null,
      },
      timestamp: Date.now(),
    };

    cache = payload; cacheTs = Date.now();
    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, fear_and_greed: null }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

function scoreToKo(score) {
  if (score >= 75) return '극도의 탐욕';
  if (score >= 55) return '탐욕';
  if (score >= 45) return '중립';
  if (score >= 25) return '공포';
  return '극도의 공포';
}
