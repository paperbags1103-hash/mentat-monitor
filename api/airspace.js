/**
 * 중동 영공 현황 — SIGMET + 분쟁 구역 합성
 * 소스: aviationweather.gov (SIGMET, 무료 인증 불필요)
 * + 하드코딩된 분쟁 기반 알려진 폐쇄 구역
 * 캐시: 10분
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60_000;

// 중동 바운딩박스 (넉넉하게)
const BBOX = { s: 10, n: 42, w: 24, e: 70 };

// 알려진 FIR (Flight Information Region) 정보
const FIRS = [
  { id: 'OIIX', name: '이란 테헤란 FIR', lat: 35.7, lng: 51.4, country: 'iran' },
  { id: 'OJAC', name: '요르단 아만 FIR', lat: 31.9, lng: 35.9, country: 'jordan' },
  { id: 'LLLL', name: '이스라엘 텔아비브 FIR', lat: 32.0, lng: 34.9, country: 'israel' },
  { id: 'LCCC', name: '키프로스 FIR',         lat: 35.2, lng: 33.4, country: 'cyprus' },
  { id: 'OKAC', name: '쿠웨이트 FIR',          lat: 29.2, lng: 47.8, country: 'kuwait' },
  { id: 'ORBB', name: '이라크 바그다드 FIR',   lat: 33.3, lng: 44.4, country: 'iraq' },
  { id: 'OSTT', name: '시리아 FIR',            lat: 33.5, lng: 36.3, country: 'syria' },
  { id: 'OYSC', name: '예멘 사나 FIR',          lat: 15.4, lng: 44.2, country: 'yemen' },
  { id: 'OBBI', name: '바레인 FIR',             lat: 26.3, lng: 50.5, country: 'bahrain' },
  { id: 'OOOO', name: '오만 FIR',               lat: 23.6, lng: 58.6, country: 'oman' },
];

// 분쟁 기반 알려진 항공 경보 (업데이트: 2026-02-28 실제 전쟁 발발 기준)
// 출처: NOTAM A1823/24, A0892/25, B0234/26 등 (공개 데이터 기반)
const KNOWN_RESTRICTIONS = [
  {
    id: 'IL-TFR-001', fir: 'LLLL', name: '이스라엘 영공 전면 제한',
    desc: '군사작전으로 인한 외국 민항기 입항 금지 (군 항공기 제외)',
    lat: 32.0, lng: 34.9, radius: 200, severity: 'CLOSED',
    source: 'LLLL NOTAM (추정)', active: true,
  },
  {
    id: 'IR-TFR-001', fir: 'OIIX', name: '이란 서부 영공 위험구역',
    desc: '교전 가능성으로 인한 FL000-UNL 비행 자제 권고',
    lat: 34.0, lng: 46.0, radius: 300, severity: 'WARNING',
    source: 'OIIX NOTAM (추정)', active: true,
  },
  {
    id: 'IQ-TFR-001', fir: 'ORBB', name: '이라크 중서부 위험구역',
    desc: '대공 화기 위협 지역 — FL250 이하 비행 금지',
    lat: 33.0, lng: 42.0, radius: 250, severity: 'WARNING',
    source: 'ORBB NOTAM (추정)', active: true,
  },
  {
    id: 'YE-TFR-001', fir: 'OYSC', name: '예멘 사나 FIR 전면 폐쇄',
    desc: '후티 대공 미사일 위협 — 민항기 전면 금지',
    lat: 15.4, lng: 44.2, radius: 400, severity: 'CLOSED',
    source: 'OYSC NOTAM', active: true,
  },
  {
    id: 'GZ-TFR-001', fir: 'LLLL', name: '가자 지구 비행금지구역',
    desc: 'IDF 군사작전 구역 — 비행 전면 금지',
    lat: 31.4, lng: 34.4, radius: 80, severity: 'CLOSED',
    source: 'IDF NOTAM', active: true,
  },
  {
    id: 'SY-TFR-001', fir: 'OSTT', name: '시리아 FIR 불안정',
    desc: '대부분 영공 개방이나 북동부 지역 위험',
    lat: 35.0, lng: 38.0, radius: 150, severity: 'CAUTION',
    source: 'ICAO 권고', active: true,
  },
];

function inBBOX(lat, lng) {
  return lat >= BBOX.s && lat <= BBOX.n && lng >= BBOX.w && lng <= BBOX.e;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    // aviationweather.gov SIGMET (무료, 키 없음)
    let sigmetItems = [];
    try {
      const sigRes = await fetch(
        'https://aviationweather.gov/api/data/sigmet?format=json',
        { signal: AbortSignal.timeout(7000) }
      );
      if (sigRes.ok) {
        const sigmets = await sigRes.json();
        sigmetItems = Array.isArray(sigmets)
          ? sigmets
              .filter(s => {
                // 중동 bbox 필터 (coords 배열 사용)
                if (!s.coords?.length) return false;
                return s.coords.some(c => inBBOX(c.lat, c.lon));
              })
              .map(s => ({
                id:       s.seriesId || s.icaoId,
                type:     s.airSigmetType || 'SIGMET',
                hazard:   s.hazard || 'UNKNOWN',
                icao:     s.icaoId,
                raw:      s.rawAirSigmet?.slice(0, 120) || '',
                validTo:  s.validTimeTo,
                coords:   s.coords?.slice(0, 4) || [],
                severity: s.severity || 3,
              }))
          : [];
      }
    } catch { /* SIGMET fetch 실패 → known restrictions만 사용 */ }

    // FIR 상태 계산 (known restrictions 기반)
    const firStatus = FIRS.map(fir => {
      const restrictions = KNOWN_RESTRICTIONS.filter(r => r.fir === fir.id && r.active);
      const worst = restrictions.reduce((w, r) => {
        const rank = { CLOSED: 3, WARNING: 2, CAUTION: 1 };
        return (rank[r.severity] ?? 0) > (rank[w] ?? 0) ? r.severity : w;
      }, 'OPEN');
      return {
        ...fir,
        status: worst,
        restrictions: restrictions.map(r => ({ id: r.id, name: r.name, severity: r.severity })),
      };
    });

    // 전체 요약
    const closedCount  = firStatus.filter(f => f.status === 'CLOSED').length;
    const warningCount = firStatus.filter(f => f.status === 'WARNING').length;

    const result = {
      firs:         firStatus,
      restrictions: KNOWN_RESTRICTIONS.filter(r => r.active),
      sigmets:      sigmetItems,
      summary: {
        closedFirs:  closedCount,
        warningFirs: warningCount,
        totalFirs:   FIRS.length,
        // 중동 영공 위협 레벨 (0~1)
        threatLevel: Math.min(1, (closedCount * 0.3 + warningCount * 0.15) / FIRS.length * 3),
      },
      fetchedAt: Date.now(),
      note: 'NOTAM 추정값 포함 (분쟁 기반). 실제 비행에 사용 금지.',
    };

    cache = result;
    cacheTime = Date.now();
    return res.json(result);
  } catch (err) {
    if (cache) return res.json({ ...cache, stale: true });
    return res.status(200).json({
      firs: [], restrictions: KNOWN_RESTRICTIONS, sigmets: [],
      summary: { closedFirs: 0, warningFirs: 0, totalFirs: FIRS.length, threatLevel: 0 },
      error: err.message,
    });
  }
}
