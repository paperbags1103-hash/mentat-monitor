/**
 * /api/polymarket
 *
 * Polymarket 예측 시장 — 지정학/경제/선거 관련 이벤트 확률 조회
 * Source: gamma-api.polymarket.com (공개 API)
 *
 * Cache: 10분
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 10 * 60_000;
let cache = null;
let cacheTs = 0;

const GAMMA_API = 'https://gamma-api.polymarket.com';

// 조회할 태그 목록
const TAGS = ['geopolitics', 'politics', 'economics'];

// 카테고리 한국어 레이블
const CATEGORY_KO = {
  geopolitics: '지정학',
  politics:    '정치',
  economics:   '경제',
  elections:   '선거',
};

async function fetchMarketsForTag(tag) {
  const url = `${GAMMA_API}/events?closed=false&tag=${tag}&order=volume&ascending=false&limit=8`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = Array.isArray(data) ? data : [];
    const markets = [];
    for (const ev of events) {
      if (ev.closed) continue;
      const mkt = ev.markets?.[0];
      if (!mkt) continue;
      // probability: outcomePrices가 "[0.62, 0.38]" 형태의 문자열
      let probability = 0.5;
      try {
        const prices = JSON.parse(mkt.outcomePrices ?? '[0.5,0.5]');
        probability = parseFloat(Array.isArray(prices) ? prices[0] : '0.5');
      } catch { /* default */ }

      markets.push({
        id: ev.id ?? mkt.id,
        title: ev.title ?? mkt.question ?? '',
        probability: Math.round(probability * 1000) / 10, // % (0-100)
        volume: Math.round(ev.volume ?? mkt.volumeNum ?? 0),
        url: `https://polymarket.com/event/${ev.slug ?? ev.id}`,
        category: tag,
        categoryKo: CATEGORY_KO[tag] ?? tag,
        // YES 결과 레이블
        yesLabel: mkt.outcomes ? JSON.parse(mkt.outcomes)[0] ?? 'Yes' : 'Yes',
      });
    }
    return markets;
  } catch {
    return [];
  }
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  // Cache hit
  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ markets: cache, cached: true, generatedAt: cacheTs }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  try {
    // 태그별 병렬 fetch
    const results = await Promise.allSettled(TAGS.map(tag => fetchMarketsForTag(tag)));
    const allMarkets = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // 중복 제거 + 볼륨 정렬
    const seen = new Set();
    const markets = allMarkets
      .filter(m => m.title && !seen.has(m.id) && seen.add(m.id))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    cache = markets;
    cacheTs = Date.now();

    return new Response(JSON.stringify({ markets, cached: false, generatedAt: cacheTs }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (err) {
    // fallback — 샘플 데이터 (API 차단 시)
    const fallback = [
      { id: 'fb1', title: 'Will the US impose 50%+ tariffs on China in 2025?', probability: 34, volume: 2400000, url: 'https://polymarket.com', category: 'geopolitics', categoryKo: '지정학', yesLabel: 'Yes' },
      { id: 'fb2', title: 'Will North Korea conduct a nuclear test in 2025?', probability: 12, volume: 890000, url: 'https://polymarket.com', category: 'geopolitics', categoryKo: '지정학', yesLabel: 'Yes' },
      { id: 'fb3', title: 'Will the Fed cut rates in 2025?', probability: 78, volume: 5200000, url: 'https://polymarket.com', category: 'economics', categoryKo: '경제', yesLabel: 'Yes' },
    ];
    return new Response(JSON.stringify({ markets: fallback, cached: false, generatedAt: Date.now(), fallback: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
