/**
 * /api/auto-briefing
 *
 * Generates a comprehensive Korean investment briefing from all live signals.
 * Uses llama-3.3-70b-versatile for high-quality analysis.
 * Cache: 4 hours (or until invalidated by critical event).
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 4 * 60 * 60_000;
let cache = null;
let cacheTs = 0;

async function fetchJson(url, timeout = 4000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'No Groq key' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  const now = Date.now();
  if (!forceRefresh && cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({
      ...cache,
      cached: true,
      cacheAge: Math.round((now - cacheTs) / 60000),
    }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  const baseUrl = new URL(req.url).origin;
  const [geoData, marketData, breakingData] = await Promise.all([
    fetchJson(`${baseUrl}/api/geo-events`, 5000),
    fetchJson(`${baseUrl}/api/korea-market`, 4000),
    fetchJson(`${baseUrl}/api/breaking-news`, 4000),
  ]);

  const criticalEvents = (geoData?.events ?? [])
    .filter((ev) => ev.severity === 'critical' || ev.severity === 'high')
    .slice(0, 6);
  const breakingItems = (breakingData?.breaking ?? []).slice(0, 5);
  const allBreaking = (breakingData?.items ?? [])
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 8);

  const eventSummary = criticalEvents.map((ev) => `[${ev.severity}] ${ev.region}: ${ev.titleKo}`).join('\n');

  const uniqueBreaking = [];
  const seenBreaking = new Set();
  for (const item of [...breakingItems, ...allBreaking]) {
    const key = item.id ?? `${item.title}-${item.pubDate ?? ''}`;
    if (seenBreaking.has(key)) continue;
    seenBreaking.add(key);
    uniqueBreaking.push(item);
    if (uniqueBreaking.length >= 8) break;
  }
  const breakingSummary = uniqueBreaking
    .map((i) => `[BREAKING] ${i.title} (${i.ageHours}h ago, src: ${i.source})`)
    .join('\n');

  const marketStr = marketData
    ? `KOSPI: ${marketData.kospi ?? 'N/A'} (${marketData.kospiChange ?? ''}) | USD/KRW: ${marketData.usdkrw ?? 'N/A'} | VIX: ${marketData.vix ?? 'N/A'}`
    : '시장 데이터 불가';

  const kstHour = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    hour12: false,
  });
  const kstDate = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const prompt = `당신은 한국의 투자 전문가입니다. 아래 실시간 시그널들을 분석해서 한국 개인 투자자를 위한 종합 브리핑을 작성하세요.

현재 시각: ${kstDate} ${kstHour}시

## 실시간 지정학 이벤트
${eventSummary || '주요 이벤트 없음'}

## 브레이킹 뉴스
${breakingSummary || '브레이킹 없음'}

## 시장 현황
${marketStr}

---

다음 JSON 형식으로 응답하세요:
{
  "headline": "한 줄 핵심 요약 (20자 이내)",
  "riskMode": "ON" | "OFF" | "NEUTRAL",
  "riskReason": "리스크 판단 근거 (1-2문장)",
  "topThreats": [{"title": "위협 제목", "detail": "상세 설명 (2-3문장)", "affectedKR": ["종목1", "종목2"], "affectedUS": ["TICKER"]}],
  "opportunities": [{"title": "기회 제목", "detail": "상세 설명", "affectedKR": ["종목"], "affectedUS": []}],
  "keyWatchpoints": ["주목할 것 1", "주목할 것 2", "주목할 것 3"],
  "briefingKo": "전체 브리핑 요약 (150-200자, 자연스러운 문장)"
}

topThreats는 최대 3개, opportunities는 최대 2개. 구체적인 한국 종목명(6자리 코드 없이 이름만)과 미국 티커를 반드시 포함.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');

    const result = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      generatedAtKST: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      signalCount: criticalEvents.length + breakingItems.length,
      cached: false,
      cacheAge: 0,
    };

    cache = result;
    cacheTs = now;

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
