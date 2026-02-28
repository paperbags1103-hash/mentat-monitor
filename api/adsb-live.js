/**
 * ADS-B Live Aircraft — adsb.one 무료 API
 * FlightRadar24 수준 실시간 항공기 위치
 * 중동 전역 커버리지 (2개 쿼리: 중부+남부)
 * 캐시: 30초 (실시간 특성)
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30초

const UA = 'Mozilla/5.0 (compatible; MentatMonitor/1.0)';

// 중동 커버 2포인트 (반경 800nm 오버랩)
const QUERY_POINTS = [
  { lat: 32, lon: 40, dist: 800 }, // 북중동 (이란/이스라엘/이라크/터키)
  { lat: 20, lon: 55, dist: 700 }, // 남중동 (사우디/UAE/예멘/파키스탄)
];

// 전역 bbox (최종 필터)
const BBOX = { s: 10, n: 44, w: 22, e: 70 };

// 군용기 콜사인 패턴
const MIL_PATTERNS = [
  /^RCH/i, /^FORTE/i, /^DUKE/i, /^DRAGN/i, /^JAKE\d/i, /^MOOSE\d/i,
  /^AZAZ\d/i, /^GRZLY/i, /^VIPER\d/i, /^COBRA/i, /^EAGLE\d/i,
  /^HAVOC/i, /^FURY\d/i, /^RAVEN/i, /^REAPER/i, /^UAV/i, /^ISR/i,
  /^USAF/i, /^IDF/i, /^TOPSY/i, /^NATO/i, /^GHOST\d/i,
  // 추가 중동 특화 패턴
  /^IAFXX/i, /^IRIAF/i, /^SAF\d/i, /^UAEAF/i, /^QATAF/i,
];

function isMilitary(callsign, hex) {
  if (!callsign) return false;
  return MIL_PATTERNS.some(p => p.test(callsign.trim()));
}

function classifyAircraft(ac) {
  const type = (ac.t || '').toUpperCase();
  const flight = (ac.flight || '').trim();
  const cat = ac.category || '';

  if (isMilitary(flight, ac.hex)) return 'military';

  // 대형 여객기 분류
  if (['B77W','B773','B772','B763','B752','B737','A320','A321','A319','A318',
       'A330','A340','A350','A380','A333','A332','B738','B739'].includes(type)) return 'airliner';

  // 카고
  if (type.includes('F') && ['B74F','B77F','B763','A30B'].includes(type)) return 'cargo';

  // 헬기
  if (cat === 'B1' || type.startsWith('EC') || type.startsWith('AS')) return 'helo';

  // 소형
  if (cat === 'A1' || cat === 'A2') return 'light';

  return 'unknown';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=25');

  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    // 두 포인트 동시 쿼리
    const results = await Promise.allSettled(
      QUERY_POINTS.map(p =>
        fetch(`https://api.adsb.one/v2/point/${p.lat}/${p.lon}/${p.dist}`, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(8000),
        }).then(r => r.json())
      )
    );

    // 중복 제거 (hex 기준)
    const seen = new Set();
    const allAc = [];

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const acs = r.value?.ac ?? [];
      for (const ac of acs) {
        if (!ac.lat || !ac.lon) continue;
        if (ac.lat < BBOX.s || ac.lat > BBOX.n) continue;
        if (ac.lon < BBOX.w || ac.lon > BBOX.e) continue;
        if (seen.has(ac.hex)) continue;
        seen.add(ac.hex);

        const flight = (ac.flight || '').trim();
        const kind   = classifyAircraft(ac);

        allAc.push({
          icao24:    ac.hex,
          callsign:  flight || ac.r || ac.hex,
          reg:       ac.r || null,
          type:      ac.t || null,
          desc:      ac.desc || null,
          lat:       ac.lat,
          lng:       ac.lon,
          alt:       ac.alt_baro || ac.alt_geom || null,    // feet
          altM:      ac.alt_baro ? Math.round(ac.alt_baro * 0.3048) : null, // metres
          speed:     ac.gs ? Math.round(ac.gs) : null,      // knots
          track:     ac.track ?? null,
          vrate:     ac.baro_rate ?? null,
          squawk:    ac.squawk || null,
          emergency: ac.emergency && ac.emergency !== 'none' ? ac.emergency : null,
          mil:       isMilitary(flight, ac.hex),
          kind,
          country:   ac.r ? ac.r.slice(0, 2) : null,
        });
      }
    }

    // 군용기 먼저, 그 다음 고도순 정렬
    allAc.sort((a, b) => {
      if (a.mil && !b.mil) return -1;
      if (!a.mil && b.mil) return 1;
      return (b.alt || 0) - (a.alt || 0);
    });

    const milCount = allAc.filter(a => a.mil).length;
    const highAlt  = allAc.filter(a => (a.alt || 0) > 35000);

    const result = {
      aircraft:    allAc,
      total:       allAc.length,
      military:    milCount,
      highAlt:     highAlt.length,
      // 비정상 스쿼크
      emergency:   allAc.filter(a => a.emergency).map(a => ({
        callsign: a.callsign, emergency: a.emergency, lat: a.lat, lng: a.lng,
      })),
      // 공항 disruption proxy — 중동 주요 공항 반경 50nm 내 항공기 수
      airports: computeAirportDensity(allAc),
      fetchedAt: Date.now(),
      source: 'adsb.one',
    };

    cache = result;
    cacheTime = Date.now();
    return res.json(result);
  } catch (err) {
    if (cache) return res.json({ ...cache, stale: true, error: err.message });
    return res.status(200).json({
      aircraft: [], total: 0, military: 0, highAlt: 0,
      emergency: [], airports: {}, error: err.message,
    });
  }
}

// 공항 밀도 계산 (접근/이탈 항공기 카운트 → disruption 프록시)
function computeAirportDensity(aircraft) {
  const AIRPORTS = {
    LLBG: { name:'텔아비브 벤구리온', lat:32.01, lng:34.89 },
    OIIE: { name:'테헤란 이맘 호메이니', lat:35.42, lng:51.15 },
    OKBK: { name:'쿠웨이트', lat:29.23, lng:47.97 },
    OTBD: { name:'도하 하마드', lat:25.27, lng:51.61 },
    OMAA: { name:'아부다비', lat:24.44, lng:54.65 },
    OMDB: { name:'두바이', lat:25.25, lng:55.36 },
    OERK: { name:'리야드', lat:24.96, lng:46.70 },
    OJAM: { name:'암만', lat:31.72, lng:35.99 },
    LCLK: { name:'라르나카 키프로스', lat:34.87, lng:33.62 },
    ORBI: { name:'바그다드', lat:33.26, lng:44.23 },
  };

  const result = {};
  for (const [icao, ap] of Object.entries(AIRPORTS)) {
    const nearby = aircraft.filter(a => {
      const d = Math.sqrt((a.lat - ap.lat)**2 + (a.lng - ap.lng)**2);
      return d < 0.8; // ~80km
    });
    const landing  = nearby.filter(a => (a.vrate || 0) < -500).length;
    const climbing = nearby.filter(a => (a.vrate || 0) > 500).length;
    result[icao] = {
      name: ap.name,
      count: nearby.length,
      landing,
      departing: climbing,
      status: nearby.length === 0 ? 'CLOSED' : nearby.length < 3 ? 'LIMITED' : 'ACTIVE',
    };
  }
  return result;
}
