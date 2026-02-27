/**
 * /api/geo-events
 *
 * RSS 뉴스 → Groq → 지도에 표시할 지리적 이벤트 추출
 * 분쟁, 전쟁, 테러, 정치, 경제, 사회 이벤트를 위경도와 함께 반환
 *
 * Cache: 20분
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 10 * 60_000;
let cache = null;
let cacheTs = 0;

const RSS_SOURCES_PRIMARY = [
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', label: 'AlJazeera' },
  { url: 'https://rss.dw.com/rdf/rss-en-all', label: 'DW' },
  { url: 'https://www.theguardian.com/world/rss', label: 'Guardian' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC World' },
  { url: 'https://feeds.reuters.com/reuters/worldNews', label: 'Reuters' },
];
const RSS_SOURCES_FALLBACK = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', label: 'BBC Business' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC World' },
  { url: 'https://www.theguardian.com/world/rss', label: 'Guardian' },
];

const FALLBACK_COORDS = {
  iran: { lat: 32.4, lng: 53.7, region: '이란' },
  israel: { lat: 31.0, lng: 35.2, region: '이스라엘' },
  ukraine: { lat: 49.0, lng: 31.5, region: '우크라이나' },
  russia: { lat: 61.5, lng: 105.3, region: '러시아' },
  taiwan: { lat: 23.7, lng: 121.0, region: '대만' },
  china: { lat: 35.9, lng: 104.2, region: '중국' },
  'north korea': { lat: 40.3, lng: 127.5, region: '북한' },
  korea: { lat: 36.5, lng: 127.9, region: '한국' },
  gaza: { lat: 31.35, lng: 34.31, region: '가자지구' },
  'middle east': { lat: 29.3, lng: 42.5, region: '중동' },
  syria: { lat: 34.8, lng: 38.9, region: '시리아' },
  lebanon: { lat: 33.8, lng: 35.9, region: '레바논' },
  saudi: { lat: 23.9, lng: 45.1, region: '사우디아라비아' },
  pakistan: { lat: 30.4, lng: 69.3, region: '파키스탄' },
  india: { lat: 20.6, lng: 79.0, region: '인도' },
  japan: { lat: 36.2, lng: 138.3, region: '일본' },
  'united states': { lat: 37.1, lng: -95.7, region: '미국' },
};

function assignFallbackGeo(text) {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(FALLBACK_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

// ─── 카테고리 메타데이터 ───────────────────────────────────────────────────────
export const CATEGORY_META = {
  conflict:   { icon: '⚔️',  color: '#ef4444', labelKo: '분쟁·전쟁' },
  terrorism:  { icon: '💣',  color: '#f97316', labelKo: '테러' },
  politics:   { icon: '🏛️',  color: '#3b82f6', labelKo: '정치' },
  economy:    { icon: '📈',  color: '#22c55e', labelKo: '경제' },
  social:     { icon: '🧩',  color: '#eab308', labelKo: '사회' },
  disaster:   { icon: '🌪️',  color: '#a855f7', labelKo: '재해' },
};

// ─── RSS fetch ────────────────────────────────────────────────────────────────
async function fetchRssFrom(sources) {
  const headlines = [];
  const RSS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; MentatMonitor/1.0; +https://signal-six-henna.vercel.app)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  };
  for (const src of sources) {
    try {
      const url = typeof src === 'string' ? src : src.url;
      const label = typeof src === 'string' ? '' : src.label ?? '';
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: RSS_HEADERS, redirect: 'follow' });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = [...xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g)];
      for (const item of items.slice(0, 15)) {
        const title = item[0].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          ?? item[0].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
        const desc = item[0].match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
          ?? item[0].match(/<description>(.*?)<\/description>/)?.[1] ?? '';
        const link = item[0].match(/<link>(.*?)<\/link>/)?.[1] ?? '';
        if (title) headlines.push({ title: title.trim(), desc: desc.replace(/<[^>]+>/g, '').trim().slice(0, 200), link, source: label });
      }
    } catch { /* skip */ }
  }
  return headlines;
}

async function fetchRssHeadlines() {
  const primary = await fetchRssFrom(RSS_SOURCES_PRIMARY);
  if (primary.length >= 5) return primary.slice(0, 25);
  const fallback = await fetchRssFrom(RSS_SOURCES_FALLBACK);
  return [...primary, ...fallback].slice(0, 25);
}

// ─── Groq 지리 이벤트 추출 ────────────────────────────────────────────────────
async function extractGeoEvents(headlines, groqKey) {
  if (!groqKey || headlines.length === 0) return buildFallbackEvents();

  const newsBlock = headlines
    .map((h, i) => `${i + 1}. ${h.title}${h.desc ? ' — ' + h.desc : ''}`)
    .join('\n');

  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `오늘은 ${dateStr}입니다. 뉴스 헤드라인에서 지도에 핀으로 표시할 만한 지정학적으로 중요한 이벤트를 추출하세요.
분쟁, 전쟁, 테러, 핵협상, 군사훈련, 제재, 외교위기, 경제 위기, 사회 불안, 자연재해 등을 포함합니다.
국가 또는 지역 수준으로만 알려져도 포함하세요 (도시 좌표가 없어도 국가 중심 좌표 사용).
이란, 이스라엘, 우크라이나, 러시아, 북한, 대만, 중국 관련 뉴스는 반드시 포함하세요.
반드시 아래 JSON 배열만 출력하세요 (다른 텍스트 없이):
[
  {
    "id": "snake_case_고유id",
    "lat": 위도(숫자, 국가 중심 좌표),
    "lng": 경도(숫자, 국가 중심 좌표),
    "region": "지역명 (한국어, 도시/국가/지역)",
    "category": "conflict|terrorism|politics|economy|social|disaster 중 하나",
    "severity": "critical|high|medium|low 중 하나",
    "titleKo": "이벤트 제목 (한국어, 30자 이내)",
    "summaryKo": "3문장 이내 요약 (한국어)",
    "tags": ["태그1", "태그2"],
    "investmentImpactKo": "관련 투자 영향 (있으면 기재, 한국 종목 포함)"
  }
]
중복 지역은 하나로 합치세요. 최대 12개.`,
          },
          { role: 'user', content: newsBlock },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array');
    const events = JSON.parse(match[0]);
    return events.map((e) => {
      const hasLatLng = typeof e.lat === 'number' && typeof e.lng === 'number' && !(e.lat === 0 && e.lng === 0);
      const fallback = hasLatLng ? null : assignFallbackGeo(`${e.titleKo ?? ''} ${e.titleEn ?? ''}`);
      return {
        ...e,
        lat: hasLatLng ? e.lat : (fallback?.lat ?? 0),
        lng: hasLatLng ? e.lng : (fallback?.lng ?? 0),
        region: e.region || fallback?.region || '미상',
        id: e.id ?? `event_${Math.random().toString(36).slice(2)}`,
        updatedAt: Date.now(),
      };
    });
  } catch (err) {
    console.error('geo-events Groq failed:', err.message);
    return buildFallbackEvents();
  }
}

// ─── Fallback 이벤트 (Groq 없을 때) ─────────────────────────────────────────
function buildFallbackEvents() {
  return [
    {
      id: 'ukraine_war',
      lat: 50.4501, lng: 30.5234,
      region: '우크라이나',
      category: 'conflict',
      severity: 'critical',
      titleKo: '러시아-우크라이나 전쟁',
      summaryKo: '2022년 2월 시작된 전쟁 진행 중. NATO 지원 지속, 전선 교착 상태.',
      tags: ['전쟁', '러시아', 'NATO', '에너지'],
      investmentImpactKo: '유럽 에너지 가격 불안, 방산주 수혜, 곡물 가격 상승',
      updatedAt: Date.now(),
    },
    {
      id: 'middle_east_conflict',
      lat: 31.5, lng: 34.75,
      region: '가자지구',
      category: 'conflict',
      severity: 'critical',
      titleKo: '중동 분쟁 지속',
      summaryKo: '이스라엘-하마스 분쟁 지속. 레바논·이란 긴장 병행.',
      tags: ['전쟁', '이스라엘', '이란', '유가'],
      investmentImpactKo: '유가 상승 압력, 안전자산 수요 증가',
      updatedAt: Date.now(),
    },
    {
      id: 'taiwan_tension',
      lat: 24.0, lng: 121.0,
      region: '대만해협',
      category: 'politics',
      severity: 'high',
      titleKo: '대만해협 군사 긴장',
      summaryKo: '중국 군사 훈련 증가. 미국 대만 지원 법안 통과.',
      tags: ['지정학', '반도체', '공급망'],
      investmentImpactKo: '반도체 공급망 리스크, NVDA·삼성전자 주목',
      updatedAt: Date.now(),
    },
    {
      id: 'us_tariff',
      lat: 38.8951, lng: -77.0364,
      region: '워싱턴 D.C.',
      category: 'economy',
      severity: 'high',
      titleKo: '미국 관세 정책 강화',
      summaryKo: '트럼프 행정부 관세 인상 추진. 한국·중국 수출품 직접 영향.',
      tags: ['관세', '무역전쟁', '달러', '환율'],
      investmentImpactKo: '한국 수출주 부담, 달러 강세, 내수주 방어',
      updatedAt: Date.now(),
    },
    {
      id: 'north_korea_missile',
      lat: 39.0392, lng: 125.7625,
      region: '북한',
      category: 'conflict',
      severity: 'medium',
      titleKo: '북한 미사일 동향',
      summaryKo: '북한 탄도미사일 발사 패턴 지속. 러시아 무기 협력 강화.',
      tags: ['지정학', '방산', '한반도'],
      investmentImpactKo: '방산주 단기 수혜, 코스피 외국인 이탈 주의',
      updatedAt: Date.now(),
    },
    {
      id: 'china_economy',
      lat: 39.9042, lng: 116.4074,
      region: '베이징',
      category: 'economy',
      severity: 'medium',
      titleKo: '중국 경기 부양책',
      summaryKo: '중국 소비 부진 지속, 정부 경기부양 패키지 추진 중.',
      tags: ['중국', '원자재', '철강', '구리'],
      investmentImpactKo: '포스코·철강주 수혜 가능, 구리 가격 상승',
      updatedAt: Date.now(),
    },
  ];
}

function withBreakingFlag(event) {
  return {
    ...event,
    breaking: event.severity === 'critical',
  };
}

// ─── NASA EONET 자연재해 fetch ────────────────────────────────────────────────
const EONET_CATEGORY_MAP = {
  volcanoes:    { category: 'disaster', severity: 'high',   titleSuffix: '화산 활동' },
  severeStorms: { category: 'disaster', severity: 'high',   titleSuffix: '강풍·폭풍' },
  wildfires:    { category: 'disaster', severity: 'medium', titleSuffix: '산불' },
  earthquakes:  { category: 'disaster', severity: 'high',   titleSuffix: '지진' },
  floods:       { category: 'disaster', severity: 'medium', titleSuffix: '홍수' },
  landslides:   { category: 'disaster', severity: 'medium', titleSuffix: '산사태' },
  seaLakeIce:   { category: 'disaster', severity: 'low',    titleSuffix: '해빙' },
  drought:      { category: 'disaster', severity: 'low',    titleSuffix: '가뭄' },
};

async function fetchEonetEvents() {
  try {
    const res = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=14&limit=30',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = [];
    for (const ev of (data.events ?? [])) {
      const geo = ev.geometry?.[0];
      if (!geo || geo.type !== 'Point') continue;
      const [lng, lat] = geo.coordinates;
      const catId = ev.categories?.[0]?.id ?? '';
      const meta = EONET_CATEGORY_MAP[catId];
      if (!meta) continue;
      events.push({
        id: `eonet_${ev.id}`,
        lat,
        lng,
        region: ev.title,
        category: meta.category,
        severity: meta.severity,
        titleKo: `${meta.titleSuffix}: ${ev.title}`,
        summaryKo: `NASA EONET 감지 — ${ev.categories?.[0]?.title ?? catId}. ${ev.title}.`,
        tags: [catId, 'eonet', '자연재해'],
        investmentImpactKo: catId === 'earthquakes' ? '건설·보험주 관련 모니터링'
          : catId === 'volcanoes' ? '항공편 결항, 농산물 공급 영향 가능'
          : catId === 'wildfires' ? '목재·농산물·탄소크레딧 영향'
          : null,
        updatedAt: Date.now(),
      });
    }
    return events;
  } catch { return []; }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  // Cache hit
  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ events: cache, cached: true, generatedAt: cacheTs }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  const overrideKey = req.headers?.get?.('x-groq-key') ?? '';
  const groqKey = process.env.GROQ_API_KEY || overrideKey;

  const [headlines, eonetEvents] = await Promise.all([
    fetchRssHeadlines(),
    fetchEonetEvents(),
  ]);
  const groqEvents = await extractGeoEvents(headlines, groqKey);

  // EONET 이벤트 merge — 근접 중복 제거 (같은 카테고리, 200km 이내)
  const allEvents = [...groqEvents];
  for (const eo of eonetEvents) {
    const dup = allEvents.some(e =>
      e.category === eo.category &&
      Math.abs(e.lat - eo.lat) < 2 && Math.abs(e.lng - eo.lng) < 2
    );
    if (!dup) allEvents.push(eo);
  }
  const events = allEvents.slice(0, 25).map(withBreakingFlag); // 최대 25개

  cache = events;
  cacheTs = Date.now();

  return new Response(JSON.stringify({ events, cached: false, generatedAt: cacheTs }), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
