/**
 * 이란 리알 환율 — 지정학 선행지표
 * Yahoo Finance USDIRR=X (오픈마켓 환율, 공식 42000 IRR 대비 실시간 반영)
 * Opus 추천: 이란발 공격 선행지표 (이란 주민이 달러 매수 → IRR 급락)
 * 캐시: 5분
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60_000;

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

function extractYF(data) {
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const meta   = result.meta;
  const price  = meta?.regularMarketPrice ?? null;
  const prev   = meta?.previousClose ?? null;
  const change = (price && prev) ? ((price - prev) / prev * 100) : 0;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const price7d = closes.filter(Boolean)[0] ?? prev;
  const change7d = (price && price7d) ? ((price - price7d) / price7d * 100) : 0;
  return {
    price:    price ? +price.toFixed(0) : null,
    prev:     prev  ? +prev.toFixed(0)  : null,
    change1d: +change.toFixed(3),
    change7d: +change7d.toFixed(3),
    symbol:   meta?.symbol ?? 'USDIRR=X',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    // 7일 범위 (7d 변화율 계산용)
    const r = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/USDIRR=X?range=7d&interval=1d',
      { headers: YF_HEADERS, signal: AbortSignal.timeout(7000) }
    );
    const data = await r.json();
    const irr  = extractYF(data);

    if (!irr?.price) throw new Error('IRR price unavailable');

    // 정규화 (1000 IRR/USD 당 0.1 단위, 7일 변화 기반)
    // 이란 리알 약세 = 달러 강세 = USDIRR 상승
    // 7d +5% 이상이면 위험 신호 (과거 10/7 직전 패턴)
    const rialNorm = Math.min(1, Math.max(0, irr.change7d / 8));  // 8% = 최대 위험

    const result = {
      price:     irr.price,
      change1d:  irr.change1d,
      change7d:  irr.change7d,
      rialNorm,
      // 경고 레벨
      alert: rialNorm >= 0.6 ? 'CRITICAL' : rialNorm >= 0.35 ? 'ELEVATED' : 'NORMAL',
      // 표시용 (리알 표시: 1 USD = X IRR)
      displayKo: irr.price ? `1 USD = ₺${irr.price.toLocaleString('ko-KR')} IRR` : null,
      note: '오픈마켓 기준 (Yahoo Finance USDIRR=X)',
      fetchedAt: Date.now(),
    };

    cache = result;
    cacheTime = Date.now();
    return res.json(result);
  } catch (err) {
    // 캐시 만료돼도 에러보단 구 캐시 반환
    if (cache) return res.json({ ...cache, stale: true });
    return res.status(200).json({
      price: null, change1d: 0, change7d: 0, rialNorm: 0,
      alert: 'NORMAL', error: err.message,
    });
  }
}
