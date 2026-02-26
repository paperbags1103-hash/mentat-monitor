/**
 * /api/causal-stream
 *
 * 온톨로지 엔진 — 금융 의미 추출 레이어
 *
 * 왼쪽 데이터 스트림(지도 이벤트 + 시장 데이터 + 뉴스)을 받아
 * Groq로 인과관계 분석 → 투자 의미화된 카드 스트림 반환
 *
 * 출력:
 *  - chains[]:      인과체인 (이벤트 → 메커니즘 → 자산 영향 → 행동)
 *  - convergences[]: 신호 컨버전스 (복수 지표 동시 발생 = 패턴)
 *  - marketContext: 현재 시장 맥락 요약
 *
 * Cache: 15분
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 15 * 60_000;
let cache = null;
let cacheTs = 0;

// ─── Base URL ─────────────────────────────────────────────────────────────────
function getBase(req) {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch { return ''; }
}

async function fetchJson(url, timeoutMs = 8000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ─── Groq: 인과관계 분석 ──────────────────────────────────────────────────────
async function analyzeWithGroq(payload, apiKey) {
  const { geoEvents, market, macro } = payload;

  // 지도 이벤트 요약 (상위 6개)
  const eventsText = (geoEvents ?? []).slice(0, 6).map((e, i) =>
    `${i + 1}. [${e.category}/${e.severity}] ${e.region}: ${e.titleKo}${e.investmentImpactKo ? ` (투자영향: ${e.investmentImpactKo})` : ''}`
  ).join('\n') || '이벤트 없음';

  // 시장 데이터 요약
  const kospi  = market?.kospi   ?? null;
  const kosdaq = market?.kosdaq  ?? null;
  const spx    = macro?.spx      ?? null;
  const vix    = macro?.vix      ?? null;
  const krw    = market?.usdkrw  ?? macro?.usdkrw ?? null;
  const gold   = macro?.gold     ?? null;
  const oil    = macro?.oil      ?? null;

  const marketText = [
    kospi  ? `KOSPI  ${kospi.price?.toFixed(0) ?? '?'}  (${kospi.changePercent > 0 ? '+' : ''}${kospi.changePercent?.toFixed(2) ?? '?'}%)` : null,
    kosdaq ? `KOSDAQ ${kosdaq.price?.toFixed(0) ?? '?'} (${kosdaq.changePercent > 0 ? '+' : ''}${kosdaq.changePercent?.toFixed(2) ?? '?'}%)` : null,
    spx    ? `S&P500 ${spx.price?.toFixed(0) ?? '?'}  (${spx.changePct > 0 ? '+' : ''}${spx.changePct?.toFixed(2) ?? '?'}%)` : null,
    vix    ? `VIX ${vix.price?.toFixed(1) ?? '?'} (${vix.price > 20 ? '⚠️ 공포 수준' : vix.price > 15 ? '주의' : '안정'})` : null,
    krw    ? `USD/KRW ${typeof krw === 'number' ? krw.toFixed(0) : krw?.price?.toFixed(0) ?? '?'}원` : null,
    gold   ? `금 $${gold.price?.toFixed(0) ?? '?'} (${gold.changePct > 0 ? '+' : ''}${gold.changePct?.toFixed(2) ?? '?'}%)` : null,
    oil    ? `WTI $${oil.price?.toFixed(1) ?? '?'} (${oil.changePct > 0 ? '+' : ''}${oil.changePct?.toFixed(2) ?? '?'}%)` : null,
  ].filter(Boolean).join('\n') || '시장 데이터 없음';

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `당신은 한국 개인 투자자를 위한 금융 온톨로지 분석 엔진입니다.
오늘 날짜: ${today}

현재 글로벌 이벤트와 시장 데이터를 분석하여, 데이터들 사이의 **인과관계**와 **투자 의미**를 추출하세요.
단순 요약이 아닌, "왜 이 데이터가 중요한가 → 어떤 메커니즘으로 → 어떤 자산에 영향 → 무엇을 해야 하는가" 형태의 의미 추출이 목적입니다.

=== 지정학 이벤트 ===
${eventsText}

=== 시장 데이터 ===
${marketText}

다음 JSON 형식으로 반환하세요:
{
  "chains": [
    {
      "id": "chain_N",
      "severity": "CRITICAL" | "ELEVATED" | "WATCH" | "INFO",
      "triggerKo": "원인 이벤트 (간결하게)",
      "mechanismKo": "작동 메커니즘 (이벤트가 자산에 영향을 주는 경로, 1-2문장)",
      "impactKo": "예상 영향 (어떤 섹터/자산, 방향)",
      "actionKo": "한국 투자자 행동 제안 (구체적으로)",
      "assets": ["관련 종목 또는 자산 (최대 4개)"],
      "confidence": 0.0-1.0
    }
  ],
  "convergences": [
    {
      "id": "conv_N",
      "patternKo": "감지된 복합 패턴 (예: VIX↑ + 달러강세 + 금↑)",
      "meaningKo": "이 패턴이 의미하는 것",
      "implicationKo": "투자 시사점",
      "direction": "risk_on" | "risk_off" | "neutral",
      "confidence": 0.0-1.0
    }
  ],
  "marketContext": {
    "kospiSentiment": "risk_on" | "risk_off" | "neutral",
    "dominantThemeKo": "현재 시장을 지배하는 주제 (1문장)",
    "urgencyLevel": "high" | "medium" | "low"
  }
}

rules:
- chains는 3-5개, 중요도 높은 것 우선
- convergences는 실제로 복수 지표가 같은 방향일 때만 (억지로 만들지 말 것), 0-2개
- 데이터가 부족하면 chains를 줄이되 있는 데이터로 최선을 다할 것
- 반드시 유효한 JSON만 반환, 마크다운 코드블록 금지`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ─── Fallback (Groq 없거나 실패 시) ─────────────────────────────────────────
function buildFallback(market, macro) {
  const vix = macro?.vix?.price ?? 0;
  const chains = [];

  if (vix > 20) {
    chains.push({
      id: 'chain_vix',
      severity: 'ELEVATED',
      triggerKo: `VIX ${vix.toFixed(1)} — 공포 수준 상승`,
      mechanismKo: '시장 불확실성 고조 → 외국인 매도 압력 → 코스피 하방 압력',
      impactKo: '전반적 리스크 자산 회피, 안전자산(금·달러·채권) 선호 심화',
      actionKo: '주식 비중 축소, 금/달러 ETF 헤지 검토',
      assets: ['KODEX 200', 'KODEX 골드선물(H)', 'TIGER 미국달러단기채권액티브'],
      confidence: 0.65,
    });
  }

  if (chains.length === 0) {
    chains.push({
      id: 'chain_default',
      severity: 'INFO',
      triggerKo: '시장 데이터 수집 중',
      mechanismKo: 'AI 분석 API 키 설정 후 인과관계 추출이 활성화됩니다',
      impactKo: '—',
      actionKo: '설정에서 Groq API 키를 입력하세요',
      assets: [],
      confidence: 0.0,
    });
  }

  return { chains, convergences: [], marketContext: { kospiSentiment: 'neutral', dominantThemeKo: '분석 대기 중', urgencyLevel: 'low' } };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // 캐시 확인
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cache), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  const base = getBase(req);
  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';

  try {
    // 병렬로 데이터 수집
    const [geoEventsRaw, marketRaw, macroRaw] = await Promise.all([
      fetchJson(`${base}/api/geo-events`, 5000),
      fetchJson(`${base}/api/korea-market`, 4000),
      fetchJson(`${base}/api/global-macro`, 4000),
    ]);

    const geoEvents = geoEventsRaw?.events ?? geoEventsRaw ?? [];
    const market    = marketRaw;
    const macro     = macroRaw;

    let result;
    let hasAI = false;

    if (groqKey && (geoEvents.length > 0 || market || macro)) {
      try {
        result = await analyzeWithGroq({ geoEvents, market, macro }, groqKey);
        hasAI = true;
      } catch (e) {
        console.error('Groq causal-stream error:', e.message);
        result = buildFallback(market, macro);
      }
    } else {
      result = buildFallback(market, macro);
    }

    const payload = {
      ...result,
      generatedAt: now,
      hasAI,
      eventCount: geoEvents.length,
    };

    cache = payload;
    cacheTs = now;

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (err) {
    console.error('causal-stream error:', err.message);
    return new Response(JSON.stringify({ error: 'Failed', details: err.message, chains: [], convergences: [] }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
