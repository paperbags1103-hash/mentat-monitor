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
const positionHistory = {}; // icao24 -> [{lat, lng, ts}]

// Known VIP/military ICAO hex codes (subset for quick filtering)
// Full list in src/data/vip-aircraft.ts
const VIP_ICAO_LIST = [
  // US Head of State
  'ae0b6a', 'ae0b8b', 'ae0685',
  // US Military Command (high signal value)
  'ae04c5', 'ae0557', 'ae020b',
  // US Air Force — Surveillance & ISR
  'ae020c', 'ae020d',
  'ae0230', 'ae0231',
  'ae4ee4',
  'ae0450', 'ae0451',
  'ae5b4c',
  // US Navy — Maritime patrol
  'ae53b3', 'ae53b4', 'ae53b5',
  // US Air Force — Strategic bombers
  'ae1408', 'ae1409',
  // US Air Force — Tankers
  'ae5001', 'ae5002', 'ae5003',
  'ae6000', 'ae6001',
  // US Air Force — SIGINT
  'ae4ee5', 'ae4ee6',
  // UK
  '43c36e', '43c35f',
  // France
  '3c4591',
  // Germany
  '3cd54c',
  // Japan
  '84408a', '844090',
  '840085', '840086', '840087', '844091', '844092',
  // China
  '780af5',
  // Russia
  'c00001', 'c00002',
  // South Korea
  '71be19', '71be1a',
  '71be1b', '71be1c', '71be1d',
  // Israel
  '76c63b',
  // NATO
  '45d3ab', '4b1801', '4b1802', '4b1803', '4b7e0b',
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
  'FORTE',   // Northrop Grumman surveillance
  'COBRA',   // RC-135 Cobra Ball missions
  'IRON',    // B-52 callsign
  'DOOM',    // B-52
  'GHOST',   // B-2 Spirit
  'DEATH',   // B-1B Lancer
  'UAVGH',   // RQ-4 Global Hawk
  'DRAGON',  // ISR
  'REDEYE',  // Army aviation
  'RANGER',  // USAF
  'STORM',   // Various
  'WOLF',    // USAF
  'HAWK',    // Various
  'EAGLE',   // F-15 units
  'VIPER',   // F-16 units
  'RAPTOR',  // F-22 units
  'GRIM',    // B-52/tanker
  'POLO',    // RC-135
  'JOLLY',   // HH-60 rescue
  'DUKE',    // Various
  'SWIFT',   // Various
  'GLORY',   // Various
  'STING',   // Various
  'CHALK',   // Airlift
  'ATLAS',   // AMC transport
  'TITAN',   // Various
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
  'ae020c': { label: 'RC-135V Rivet Joint (2)', country: 'US', category: 'intelligence',
    investmentSignalKo: '미 신호정보 수집기 추가 운항. 복수 RC-135 동시 비행 시 고강도 정보수집 작전 진행 중 가능성.' },
  'ae020d': { label: 'RC-135W Rivet Joint (3)', country: 'US', category: 'intelligence',
    investmentSignalKo: '미 신호정보 수집기 운항. 특정 지역 전자정보 수집 강화 신호.' },
  'ae0230': { label: 'RC-135S Cobra Ball', country: 'US', category: 'intelligence',
    investmentSignalKo: '⚠️ 코브라 볼 운항! 탄도미사일 추적 전문기. 북한/러시아/중국 미사일 시험 감시 중 가능성.' },
  'ae0231': { label: 'RC-135S Cobra Ball (2)', country: 'US', category: 'intelligence',
    investmentSignalKo: '탄도미사일 추적 정찰기. 복수 운항 시 실제 미사일 발사 임박 경보 가능성.' },
  'ae4ee4': { label: 'E-4B Nightwatch (2)', country: 'US', category: 'military_command',
    investmentSignalKo: '⚠️ 공중 핵전쟁 지휘소 추가 운항! 복수 나이트워치 비행은 극도의 위기 신호. 즉시 헤지.' },
  'ae0450': { label: 'E-3B Sentry AWACS', country: 'US', category: 'military_command',
    investmentSignalKo: '미 공중 조기경보 통제기 운항. 대규모 공중작전 통제 가능. 방산주 주목.' },
  'ae0451': { label: 'E-3C Sentry AWACS', country: 'US', category: 'military_command',
    investmentSignalKo: '미 E-3 센트리 운항. 공중 전투관리 임무 진행 중.' },
  'ae53b3': { label: 'P-8A Poseidon (VP-8)', country: 'US', category: 'intelligence',
    investmentSignalKo: 'P-8 포세이돈 운항. 대잠수함전/해상정찰 임무. 한반도 주변 운항 시 북한 잠수함 동향과 연관 가능.' },
  'ae53b4': { label: 'P-8A Poseidon (VP-16)', country: 'US', category: 'intelligence',
    investmentSignalKo: 'P-8 포세이돈 해상초계기. 해상 분쟁 지역 정찰 진행 중 가능성.' },
  'ae53b5': { label: 'P-8A Poseidon (VP-30)', country: 'US', category: 'intelligence',
    investmentSignalKo: 'P-8 포세이돈 운항. 해상 위협 모니터링 중.' },
  'ae1408': { label: 'B-52H Stratofortress', country: 'US', category: 'military',
    investmentSignalKo: 'B-52H 전략폭격기 운항. 훈련 또는 억제 비행. 아시아 상공 비행 시 방산·에너지 섹터 주목.' },
  'ae1409': { label: 'B-52H Stratofortress (2)', country: 'US', category: 'military',
    investmentSignalKo: 'B-52H 폭격기 비행. 전략적 억제 메시지 발신 가능성.' },
  'ae5001': { label: 'KC-135R Stratotanker', country: 'US', category: 'military',
    investmentSignalKo: 'KC-135 공중급유기 운항. 원거리 작전 지원 중 — 전투기/폭격기 장거리 임무와 연계.' },
  'ae5002': { label: 'KC-135R Stratotanker (2)', country: 'US', category: 'military',
    investmentSignalKo: 'KC-135 급유기 운항. 대규모 항공작전 지원 가능성.' },
  'ae5003': { label: 'KC-135R Stratotanker (3)', country: 'US', category: 'military',
    investmentSignalKo: 'KC-135 급유기. 복수 운항 시 대형 공중 작전 진행 중 신호.' },
  'ae6000': { label: 'KC-46A Pegasus', country: 'US', category: 'military',
    investmentSignalKo: 'KC-46A 신형 급유기 운항. 원거리 전력 투사 지원.' },
  'ae6001': { label: 'KC-46A Pegasus (2)', country: 'US', category: 'military',
    investmentSignalKo: 'KC-46A 공중급유기. 전방 배치 전력 지속 지원 중.' },
  '840085': { label: 'JASDF E-767 AWACS', country: 'JP', category: 'military_command',
    investmentSignalKo: '일본 E-767 공중조기경보기 운항. 동중국해/한반도 방향 비행 시 북한·중국 관련 위협 모니터링 강화 신호.' },
  '840086': { label: 'JASDF E-2C Hawkeye', country: 'JP', category: 'military',
    investmentSignalKo: '일본 E-2 호크아이 조기경보기 운항. 일본 해상 접근로 감시 중.' },
  '840087': { label: 'JASDF E-2D Hawkeye', country: 'JP', category: 'military',
    investmentSignalKo: '일본 E-2D 조기경보기. 중국 해군 동향 감시 가능성.' },
  '71be1b': { label: '한국 공군 ISR기', country: 'KR', category: 'intelligence',
    investmentSignalKo: '한국 공군 정보수집기(백두/금강계열) 운항. 북한 동향 집중 감시 가능성. 방산주 주목.' },
  '71be1c': { label: '한국 공군 정찰기', country: 'KR', category: 'intelligence',
    investmentSignalKo: '한국 공군 정찰기 비행. 북한 관련 군사 활동 감시 중.' },
  '71be1d': { label: '한국 공군 피스아이 AWACS', country: 'KR', category: 'military_command',
    investmentSignalKo: '한국 E-737 피스아이 운항. 한반도 공중 감시 강화. 북한 위협 또는 한미 합동훈련 진행 가능성.' },
  '4b1802': { label: 'NATO E-3A AWACS (2)', country: 'NATO', category: 'military_command',
    investmentSignalKo: 'NATO AWACS 추가 운항. 복수 조기경보기 비행 = 고강도 유럽 군사 경계 상황.' },
  '4b1803': { label: 'NATO E-3A AWACS (3)', country: 'NATO', category: 'military_command',
    investmentSignalKo: 'NATO 조기경보기 증파. 유럽 방산 섹터 및 에너지 관련 지정학 리스크 모니터링.' },
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
  'a6395a': { reg: 'N628TS', label: 'Elon Musk (N628TS)', country: 'US', category: 'tech_ceo',
    investmentSignalKo: '일론 머스크 전용기 이동. Tesla/SpaceX/X 사업 관련 행선지 → 관련 기업 동향과 연결 가능. 한국행 시 현대차·배터리 섹터 주목.' },
  'a835af': { reg: 'N272BG', label: 'Elon Musk (N72X)', country: 'US', category: 'tech_ceo',
    investmentSignalKo: '일론 머스크 보조 항공기. 테슬라·스페이스X 관련 미팅 이동 가능성.' },
  'a4b5cb': { reg: 'N887WM', label: 'Bill Gates (Cascade Inv.)', country: 'US', category: 'investor',
    investmentSignalKo: '빌 게이츠 전용기. 카스케이드 인베스트먼트 또는 게이츠재단 관련 이동. 방문 지역 기후·바이오 기업 주목.' },
  'ae4823': { label: 'US Treasury Transport', country: 'US', category: 'government',
    investmentSignalKo: '미 재무부 수송기. 재무장관 해외 협의 가능성. G7/G20 또는 IMF 미팅과 연계 시 달러·금리 방향 주목.' },
  'ae4824': { label: 'US Treasury Transport (2)', country: 'US', category: 'government',
    investmentSignalKo: '미 재무부 수송기. 달러 정책 또는 국제 금융 협의와 연관 가능성.' },
  // Dynamic label for ADSBX military sweep results not in VIP list
  // Use callsign prefix heuristic
};

const CATEGORY_SIGNAL_KO = {
  military_command: '⚠️ 군 지휘통제 항공기 운항. 군사 훈련 또는 위기 대응 가능성. 방산주 주목.',
  intelligence: '신호정보/감시정찰 항공기 운항. 특정 지역 군사적 긴장 수집 중. 지정학 리스크 모니터링.',
  military: '군용기 운항 감지. 훈련 또는 실전 작전 가능성. 방산·에너지 섹터 주의.',
  government: '정부 수송기 운항. 외교·행정 이동.',
  head_of_state: '국가원수 전용기 운항. 외교 일정 진행 중.',
  tech_ceo: '테크 CEO 전용기 이동. 관련 기업 M&A·파트너십 가능성 모니터링.',
  investor: '주요 투자자 이동. 관련 포트폴리오 동향 주목.',
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

function isMilitaryCallsign(callsign) {
  return MILITARY_CALLSIGN_PREFIXES.some(p => callsign.startsWith(p));
}

function resolveCategory(known, isMilCallsign, fromAdsbxMil) {
  if (known.category) return known.category;
  if (fromAdsbxMil) return 'military';
  if (isMilCallsign) return 'military';
  return 'unknown';
}

function buildAircraftRecord(base, fromAdsbxMil = false) {
  const icao24 = (base.icao24 || '').toLowerCase();
  const callsign = (base.callsign || '').trim();
  const known = AIRCRAFT_LABELS[icao24] || {};
  const isMilCallsign = isMilitaryCallsign(callsign);
  const category = resolveCategory(known, isMilCallsign, fromAdsbxMil);
  const squawk = base.squawk || '';
  const onGround = !!base.onGround;

  const record = {
    icao24,
    callsign: callsign || null,
    originCountry: base.originCountry || known.country || '',
    lng: base.lng,
    lat: base.lat,
    altBaro: base.altBaro ?? null,
    onGround,
    velocity: base.velocity ?? null,
    heading: base.heading ?? null,
    squawk,
    isEmergencySquawk: MILITARY_SQUAWKS.has(squawk),
    isMilCallsign,
    reg: known.reg || null,
    label: known.label || callsign || icao24,
    country: known.country || base.originCountry || '',
    category,
    investmentSignalKo: (known.investmentSignalKo ?? CATEGORY_SIGNAL_KO[known.category || category]) || null,
    isKnownVip: icao24 in AIRCRAFT_LABELS,
    isHighAlert: ['military_command', 'head_of_state', 'tech_ceo', 'military'].includes(category) && !onGround,
  };

  return record;
}

function resolveAdsbxOriginCountry(icao24) {
  return AIRCRAFT_LABELS[icao24]?.country || 'Unknown';
}

async function fetchAdsbExchangeMilitary() {
  const key = process.env.ADSBX_RAPIDAPI_KEY;
  if (!key) return [];

  try {
    const resp = await fetch('https://adsbexchange-com1.p.rapidapi.com/v2/mil/', {
      headers: {
        Accept: 'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const ac = Array.isArray(data?.ac) ? data.ac : [];

    return ac
      .filter(entry => entry?.lat !== null && entry?.lat !== undefined && entry?.lon !== null && entry?.lon !== undefined)
      .map(entry => {
        const icao24 = (entry.hex || '').toLowerCase();
        const callsign = (entry.flight || '').trim() || null;
        const known = AIRCRAFT_LABELS[icao24] || {};
        const isKnownVip = icao24 in AIRCRAFT_LABELS;
        const isMilCallsign = callsign ? isMilitaryCallsign(callsign) : false;
        const category = isKnownVip
          ? (known.category || 'military')
          : (isMilCallsign ? 'military' : 'military');
        const onGround = entry.alt_baro === 'ground' || entry.alt_baro === 0;

        return {
          icao24,
          callsign,
          originCountry: resolveAdsbxOriginCountry(icao24),
          lng: entry.lon,
          lat: entry.lat,
          altBaro: entry.alt_baro ?? null,
          onGround,
          velocity: entry.gs ?? null,
          heading: entry.track ?? null,
          squawk: entry.squawk || null,
          isEmergencySquawk: MILITARY_SQUAWKS.has(entry.squawk || ''),
          isMilCallsign,
          reg: known.reg || null,
          label: known.label || callsign || icao24,
          country: known.country || 'Unknown',
          category,
          investmentSignalKo: (known.investmentSignalKo ?? CATEGORY_SIGNAL_KO[known.category || category]) || null,
          isKnownVip,
          isHighAlert: ['military_command', 'head_of_state', 'tech_ceo', 'military'].includes(category) && !onGround && isKnownVip,
        };
      });
  } catch {
    return [];
  }
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
  let militarySweepCount = 0;
  const adsbxKey = process.env.ADSBX_RAPIDAPI_KEY;
  const adsbxActive = !!adsbxKey;

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
      .map(s => buildAircraftRecord({
        icao24: s[0],
        callsign: s[1],
        originCountry: s[2],
        lng: s[5],
        lat: s[6],
        altBaro: s[7], // meters
        onGround: s[8],
        velocity: s[9], // m/s
        heading: s[10],
        squawk: s[14],
      }));
  } catch (err) {
    openSkyError = err.message;
  }

  const adsbxAircraft = await fetchAdsbExchangeMilitary();
  militarySweepCount = adsbxAircraft.length;

  const merged = new Map();
  aircraft.forEach(a => merged.set(a.icao24, a));
  adsbxAircraft.forEach(a => {
    if (!merged.has(a.icao24)) merged.set(a.icao24, a);
  });
  aircraft = Array.from(merged.values());

  aircraft.forEach(a => {
    if (!a.onGround && Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
      if (!positionHistory[a.icao24]) positionHistory[a.icao24] = [];
      const hist = positionHistory[a.icao24];
      const last = hist[hist.length - 1];
      if (!last || Math.abs(last.lat - a.lat) > 0.005 || Math.abs(last.lng - a.lng) > 0.005) {
        hist.push({ lat: a.lat, lng: a.lng, ts: now });
        if (hist.length > 30) hist.shift();
      }
    }
  });
  aircraft = aircraft.map(a => ({
    ...a,
    pathHistory: (positionHistory[a.icao24] || []).slice(-10),
  }));

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
      militarySweepCount,
      adsbxActive,
    },
    alerts: highAlerts.map(a => ({
      icao24: a.icao24,
      label: a.label,
      category: a.category,
      lat: a.lat,
      lng: a.lng,
      message: `${a.label} 비행 중`,
    })),
    source: adsbxActive ? 'opensky-network.org + adsbexchange.com' : 'opensky-network.org',
    authenticated: !!auth,
    error: openSkyError || null,
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
