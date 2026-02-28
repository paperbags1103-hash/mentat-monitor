/**
 * Geo-Financial Signals — 지정학 리스크 선행지표
 * USD/ILS 변화율, 금 현물 변화율, Brent-WTI 스프레드
 * Opus 4.6 추천: 전쟁 예측에서 가장 강한 무료 선행지표
 * 10분 캐시
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60_000;

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const YF = (sym) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`;

function extract(data) {
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const meta   = result.meta;
  const price  = meta?.regularMarketPrice ?? null;
  const prev   = meta?.previousClose ?? null;
  const change = price && prev ? ((price - prev) / prev * 100) : 0;
  // 5일 전 종가 (시작점)
  const closes  = result.indicators?.quote?.[0]?.close ?? [];
  const price5d = closes.filter(Boolean)[0] ?? prev;
  const change5d = price && price5d ? ((price - price5d) / price5d * 100) : 0;
  return {
    price: +price?.toFixed(4),
    prev:  +prev?.toFixed(4),
    change1d: +change.toFixed(3),
    change5d: +change5d.toFixed(3),
    symbol: meta?.symbol,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    const [ilsRes, goldRes, wtiRes, brentRes] = await Promise.all([
      fetch(YF('USDILS=X'), { headers: YF_HEADERS }), // 이스라엘 셰켈
      fetch(YF('GC=F'),     { headers: YF_HEADERS }), // 금 선물
      fetch(YF('CL=F'),     { headers: YF_HEADERS }), // WTI
      fetch(YF('BZ=F'),     { headers: YF_HEADERS }), // Brent
    ]);

    const [ilsData, goldData, wtiData, brentData] = await Promise.all([
      ilsRes.json(), goldRes.json(), wtiRes.json(), brentRes.json(),
    ]);

    const ils   = extract(ilsData);
    const gold  = extract(goldData);
    const wti   = extract(wtiData);
    const brent = extract(brentData);

    // Brent-WTI 스프레드 계산
    const spread = (brent?.price && wti?.price)
      ? +(brent.price - wti.price).toFixed(2)
      : null;
    const spreadNorm = spread != null ? Math.min(1, Math.max(0, (spread - 3) / 10)) : 0;

    // ILS 정규화 (ILS 상승 = 달러 강세 = 셰켈 약세 = 위험 증가)
    const ilsChange5d = ils?.change5d ?? 0;
    const ilsNorm = Math.min(1, Math.max(0, ilsChange5d / 4)); // 4% = max

    // Gold 정규화
    const goldChange5d = gold?.change5d ?? 0;
    const goldNorm = Math.min(1, Math.max(0, goldChange5d / 5)); // 5% = max

    const result = {
      ils,
      gold,
      wti,
      brent,
      derived: {
        brentWtiSpread: spread,
        spreadNorm,
        ilsNorm,
        goldNorm,
        // 종합 지정학 리스크 점수 (0~100)
        geoRiskScore: Math.round((spreadNorm * 0.35 + ilsNorm * 0.40 + goldNorm * 0.25) * 100),
      },
      fetchedAt: Date.now(),
    };

    cache = result;
    cacheTime = Date.now();
    return res.json(result);
  } catch (err) {
    return res.status(200).json({
      ils: null, gold: null, wti: null, brent: null,
      derived: { brentWtiSpread: null, spreadNorm: 0, ilsNorm: 0, goldNorm: 0, geoRiskScore: 0 },
      error: err.message,
    });
  }
}
