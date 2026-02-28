/**
 * CryptoPanic 뉴스 + 감성 분석
 * 지정학 위기 시 BTC/크립토 시장 반응 추적
 * CRYPTOPANIC_TOKEN Vercel 환경변수 필요 (cryptopanic.com 무료 가입)
 * 캐시: 5분
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60_000;

const TOKEN = process.env.CRYPTOPANIC_TOKEN;

// 지정학 관련 키워드 (전쟁/위기 관련 크립토 뉴스 필터)
const GEO_KEYWORDS = [
  'iran', 'israel', 'war', 'strike', 'attack', 'sanction', 'military',
  'conflict', 'escalat', 'geopolit', 'oil', 'btc', 'bitcoin', 'safe haven',
  'risk off', 'sell off', 'market crash', 'volatil',
];

function isGeoRelevant(title) {
  const t = (title || '').toLowerCase();
  return GEO_KEYWORDS.some(k => t.includes(k));
}

// 공포 점수 계산 (0~100)
function calcFearScore(posts) {
  if (!posts?.length) return 50;
  let bearish = 0, bullish = 0, neutral = 0;
  for (const p of posts) {
    const votes = p.votes ?? {};
    bearish += (votes.negative ?? 0) + (votes.saved ?? 0) * 0.3;
    bullish += (votes.positive ?? 0) * 0.8;
    neutral += (votes.important ?? 0) * 0.5;
  }
  const total = bearish + bullish + neutral + 0.001;
  const fearRatio = bearish / total;
  return Math.round(fearRatio * 100);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 토큰 없으면 mock 반환 (API 키 미설정)
  if (!TOKEN) {
    return res.status(200).json({
      posts: [],
      fearScore: null,
      geoRelevant: 0,
      error: 'CRYPTOPANIC_TOKEN not set',
      mock: true,
    });
  }

  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    // CryptoPanic Free API: https://cryptopanic.com/developers/api/
    const url = `https://cryptopanic.com/api/free/v1/posts/` +
      `?auth_token=${TOKEN}&kind=news&filter=hot&regions=en&limit=20`;

    const r = await fetch(url, {
      headers: { 'User-Agent': 'MentatMonitor/1.0' },
      signal: AbortSignal.timeout(7000),
    });
    const data = await r.json();
    const posts = data?.results ?? [];

    // 지정학 관련 뉴스만 필터
    const geoPosts = posts.filter(p => isGeoRelevant(p.title));
    const fearScore = calcFearScore(posts);

    // 감성 집계
    let totalPos = 0, totalNeg = 0;
    for (const p of posts) {
      totalPos += p.votes?.positive ?? 0;
      totalNeg += p.votes?.negative ?? 0;
    }

    const result = {
      posts: posts.slice(0, 10).map(p => ({
        id:        p.id,
        title:     p.title,
        url:       p.url,
        source:    p.source?.title,
        sentiment: (p.votes?.positive ?? 0) > (p.votes?.negative ?? 0) ? 'bullish'
                 : (p.votes?.negative ?? 0) > (p.votes?.positive ?? 0) ? 'bearish' : 'neutral',
        geoRelevant: isGeoRelevant(p.title),
        publishedAt: p.published_at,
        votes:     p.votes,
      })),
      fearScore,             // 0~100 (높을수록 공포/매도)
      geoRelevant: geoPosts.length,
      sentiment: {
        bullish: totalPos,
        bearish: totalNeg,
        ratio: totalPos + totalNeg > 0 ? +(totalPos / (totalPos + totalNeg)).toFixed(3) : 0.5,
      },
      fetchedAt: Date.now(),
    };

    cache = result;
    cacheTime = Date.now();
    return res.json(result);
  } catch (err) {
    if (cache) return res.json({ ...cache, stale: true });
    return res.status(200).json({
      posts: [], fearScore: null, geoRelevant: 0,
      sentiment: { bullish: 0, bearish: 0, ratio: 0.5 },
      error: err.message,
    });
  }
}
