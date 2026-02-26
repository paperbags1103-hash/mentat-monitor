/**
 * /api/vip-aircraft
 *
 * VIP & Military Aircraft Tracker — Mentat Monitor
 *
 * Queries OpenSky Network for known government/military aircraft positions.
 * No relay required — uses OpenSky public REST API directly.
 *
 * Rate limits:
 *  - Anonymous: 100 requests/day, 10s resolution
 *  - Authenticated: 4,000 requests/day, 5s resolution
 *    (Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET for higher limits)
 *
 * Data is 30–60s delayed on OpenSky free tier.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 120_000; // 2 min (balance between freshness and rate limits)
let cache = null;
let cacheTs = 0;

// Known VIP/military ICAO hex codes (subset for quick filtering)
// Full list in src/data/vip-aircraft.ts
const VIP_ICAO_LIST = [
  // US Head of State
  'ae0b6a', 'ae0b8b', 'ae0685',
  // US Military Command (high signal value)
  'ae04c5', 'ae0557', 'ae020b',
  // UK
  '43c36e', '43c35f',
  // France
  '3c4591',
  // Germany
  '3cd54c',
  // Japan
  '84408a', '844090',
  // China
  '780af5',
  // Russia
  'c00001', 'c00002',
  // South Korea
  '71be19', '71be1a',
  // Israel
  '76c63b',
  // NATO
  '45d3ab', '4b1801',
  // CEO / Tech Leaders (공개된 ADS-B 추적 데이터 기반)
  'a6395a', // Elon Musk (N628TS — SpaceX 등록, @ElonJet 추적 이력)
  'a835af', // Elon Musk 보조기 (N72X)
  'a4b5cb', // Bill Gates (N887WM — 카스케이드 인베스트먼트)
  'a3f71a', // Warren Buffett (NetJets 플릿)
  // Central Bank (Fed — 미 재무부 수송기)
  'ae4823', 'ae4824',
];

// Additional military type patterns to catch unlisted aircraft
const MILITARY_CALLSIGN_PREFIXES = [
  'RCH', 'SAM', 'VENUS', 'REACH', 'KNIFE', 'EVAC', 'SPAR',
  'JAKE', 'BOXER', 'BISON', 'TOPGUN', 'ACES',
];

const MILITARY_SQUAWKS = new Set(['7700', '7600', '7500', '7777']);

// Label map for known aircraft
// investmentSignalKo: 이 항공기가 비행 중일 때 투자자에게 주는 의미
const AIRCRAFT_LABELS = {
  'ae0b6a': { label: 'Air Force One (SAM28000)', country: 'US', category: 'head_of_state',
    investmentSignalKo: '미 대통령 해외 순방 중. 방문국과의 무역·외교 협상 가능성. 방문국 관련 섹터 및 KRW 변동 주의.' },
  'ae0b8b': { label: 'Air Force One (SAM29000)', country: 'US', category: 'head_of_state',
    investmentSignalKo: '미 대통령 전용기 운항. 외교·통상 일정과 연계된 시장 반응 가능성.' },
  'ae0685': { label: 'Air Force Two (VP)', country: 'US', category: 'head_of_state',
    investmentSignalKo: '미 부통령 해외 순방. 대외 정책 협의 또는 위기 조율 미팅 가능성.' },
  'ae04c5': { label: 'E-4B Nightwatch (NAOC)', country: 'US', category: 'military_command',
    investmentSignalKo: '⚠️ 공중 핵전쟁 지휘소 운항! 극도의 군사적 긴장 신호. 금·달러 즉시 헤지 고려.' },
  'ae0557': { label: 'E-6B Mercury (TACAMO)', country: 'US', category: 'military_command',
    investmentSignalKo: '핵잠수함 통신 중계기 비행 중. 고강도 군사 작전 또는 훈련 진행 가능성.' },
  'ae020b': { label: 'RC-135 Rivet Joint', country: 'US', category: 'intelligence',
    investmentSignalKo: '미 신호정보 수집기 운항. 특정 지역 정보 수집 강화 → 지정학적 긴장 고조 신호일 수 있음.' },
  '43c36e': { label: 'UK PM Voyager', country: 'GB', category: 'head_of_state',
    investmentSignalKo: '영국 총리 해외 순방. 브렉시트 후속 무역 협정 또는 G7 관련 이동 가능성.' },
  '43c35f': { label: 'RAF RC-135W', country: 'GB', category: 'intelligence',
    investmentSignalKo: '영국 정보수집기 비행. 유럽/중동 지역 긴장과 연관 가능성.' },
  '3c4591': { label: 'French President', country: 'FR', category: 'head_of_state',
    investmentSignalKo: '프랑스 대통령 순방. EU 외교 또는 아프리카·중동 정책과 관련된 이동 가능성.' },
  '3cd54c': { label: 'German Chancellor', country: 'DE', category: 'head_of_state',
    investmentSignalKo: '독일 총리 순방. EU 경제 정책 또는 에너지 공급망 협의 가능성.' },
  '84408a': { label: 'Japanese PM (primary)', country: 'JP', category: 'head_of_state',
    investmentSignalKo: '일본 총리 해외 순방. 한일관계 또는 미일 동맹 관련 이동 시 원화·엔화 변동 주의.' },
  '844090': { label: 'Japanese PM (backup)', country: 'JP', category: 'head_of_state',
    investmentSignalKo: '일본 VIP 수송기 운항. 고위 외교 일정 진행 중.' },
  '780af5': { label: 'China Gov Transport', country: 'CN', category: 'government',
    investmentSignalKo: '중국 정부 전용기 운항. 방문국에 따라 중국 외교·경제 협력 동향 파악 가능.' },
  'c00001': { label: 'Russian Presidential Il-96', country: 'RU', category: 'head_of_state',
    investmentSignalKo: '⚠️ 러시아 대통령 전용기 운항! 이동 방향이 분쟁 지역이면 지정학 리스크 상승. 에너지·방산주 주목.' },
  'c00002': { label: 'Russian Presidential (backup)', country: 'RU', category: 'head_of_state',
    investmentSignalKo: '러시아 대통령 보조 전용기 운항. 주요 외교 일정 동반 가능성.' },
  '71be19': { label: '한국 대통령 전용기', country: 'KR', category: 'head_of_state',
    investmentSignalKo: '한국 대통령 해외 순방. 방문국과의 경제협력·무역·안보 협의. KOSPI 및 방문국 관련 종목 주목.' },
  '71be1a': { label: '한국 VIP 수송기', country: 'KR', category: 'head_of_state',
    investmentSignalKo: '한국 고위급 인사 해외 이동. 외교·통상 일정과 연계 가능.' },
  '76c63b': { label: 'Israeli PM Aircraft', country: 'IL', category: 'head_of_state',
    investmentSignalKo: '이스라엘 총리 순방. 중동 긴장 완화 또는 고조와 연관. 유가·방산주 방향성 점검.' },
  '45d3ab': { label: 'NATO E-3A AWACS', country: 'NATO', category: 'military_command',
    investmentSignalKo: 'NATO 조기경보기 운항. 유럽·흑해 지역 군사 경계 강화 신호 가능성.' },
  // CEO / Tech Leaders
  'a6395a': { label: 'Elon Musk (N628TS)', country: 'US', category: 'tech_ceo',
    investmentSignalKo: '일론 머스크 전용기 이동. Tesla/SpaceX/X 사업 관련 행선지 → 관련 기업 동향과 연결 가능. 한국행 시 현대차·배터리 섹터 주목.' },
  'a835af': { label: 'Elon Musk (N72X)', country: 'US', category: 'tech_ceo',
    investmentSignalKo: '일론 머스크 보조 항공기. 테슬라·스페이스X 관련 미팅 이동 가능성.' },
  'a4b5cb': { label: 'Bill Gates (Cascade Inv.)', country: 'US', category: 'investor',
    investmentSignalKo: '빌 게이츠 전용기. 카스케이드 인베스트먼트 또는 게이츠재단 관련 이동. 방문 지역 기후·바이오 기업 주목.' },
  'ae4823': { label: 'US Treasury Transport', country: 'US', category: 'government',
    investmentSignalKo: '미 재무부 수송기. 재무장관 해외 협의 가능성. G7/G20 또는 IMF 미팅과 연계 시 달러·금리 방향 주목.' },
  'ae4824': { label: 'US Treasury Transport (2)', country: 'US', category: 'government',
    investmentSignalKo: '미 재무부 수송기. 달러 정책 또는 국제 금융 협의와 연관 가능성.' },
};

function buildOpenSkyUrl(icaoList) {
  const base = 'https://opensky-network.org/api/states/all';
  const params = new URLSearchParams();
  // OpenSky accepts comma-separated ICAO24 in the `icao24` parameter
  params.set('icao24', icaoList.join(','));
  return `${base}?${params}`;
}

function getOpenSkyAuth() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }
  return null;
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

  const auth = getOpenSkyAuth();
  const headers = { Accept: 'application/json', 'User-Agent': 'MentatMonitor/1.0' };
  if (auth) headers.Authorization = auth;

  let aircraft = [];
  let openSkyError = null;

  try {
    // Query OpenSky for all VIP ICAO codes in one request
    const url = buildOpenSkyUrl(VIP_ICAO_LIST);
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status === 429) throw new Error('Rate limited by OpenSky');
    if (!resp.ok) throw new Error(`OpenSky returned ${resp.status}`);

    const data = await resp.json();
    // OpenSky state vector format:
    // [icao24, callsign, origin_country, time_position, last_contact,
    //  longitude, latitude, baro_altitude, on_ground, velocity,
    //  true_track, vertical_rate, sensors, geo_altitude, squawk,
    //  spi, position_source, category]
    const states = data?.states ?? [];

    aircraft = states
      .filter(s => s[5] !== null && s[6] !== null) // must have position
      .map(s => {
        const icao24 = (s[0] || '').toLowerCase();
        const callsign = (s[1] || '').trim();
        const known = AIRCRAFT_LABELS[icao24] || {};
        const isMilCallsign = MILITARY_CALLSIGN_PREFIXES.some(p => callsign.startsWith(p));
        const squawk = s[14] || '';
        const isEmergencySquawk = MILITARY_SQUAWKS.has(squawk);

        return {
          icao24,
          callsign: callsign || null,
          originCountry: s[2],
          lng: s[5],
          lat: s[6],
          altBaro: s[7],    // meters
          onGround: s[8],
          velocity: s[9],   // m/s
          heading: s[10],
          squawk,
          isEmergencySquawk,
          isMilCallsign,
          // Enrichment from known list
          label: known.label || callsign || icao24,
          country: known.country || s[2],
          category: known.category || (isMilCallsign ? 'government' : 'unknown'),
          investmentSignalKo: known.investmentSignalKo || null,
          isKnownVip: icao24 in AIRCRAFT_LABELS,
          // Alert flag: military command aircraft + airborne = notable
          isHighAlert: ['military_command', 'head_of_state', 'tech_ceo'].includes(known.category) && !s[8],
        };
      });
  } catch (err) {
    openSkyError = err.message;
  }

  // Detect notable patterns
  const airborne = aircraft.filter(a => !a.onGround);
  const highAlerts = aircraft.filter(a => a.isHighAlert);
  const commandAircraft = aircraft.filter(a => a.category === 'military_command' && !a.onGround);
  const headOfStateAirborne = aircraft.filter(a => a.category === 'head_of_state' && !a.onGround);

  // Alert score: more military command airborne = higher tension
  const alertScore = Math.min(100,
    commandAircraft.length * 30 +
    headOfStateAirborne.length * 10 +
    (highAlerts.length > 0 ? 20 : 0)
  );

  const result = {
    timestamp: now,
    aircraft,
    stats: {
      total: aircraft.length,
      airborne: airborne.length,
      onGround: aircraft.length - airborne.length,
      commandAirborne: commandAircraft.length,
      headOfStateAirborne: headOfStateAirborne.length,
      alertScore,
    },
    alerts: highAlerts.map(a => ({
      icao24: a.icao24,
      label: a.label,
      category: a.category,
      lat: a.lat,
      lng: a.lng,
      message: `${a.label} 비행 중`,
    })),
    source: 'opensky-network.org',
    authenticated: !!auth,
    error: openSkyError,
  };

  if (!openSkyError) {
    cache = result;
    cacheTs = now;
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': openSkyError ? 'ERROR' : 'MISS', ...corsHeaders },
  });
}
