/**
 * /api/theme-discovery
 *
 * AI-driven investment theme discovery via Groq (llama-3.3-70b-versatile).
 * Pulls recent signals/inferences from the insight-briefing, runs
 * cross-asset correlation analysis, and generates 4-6 investable narrative themes.
 *
 * Cache: 30 minutes (themes change slowly)
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 30 * 60_000;
let cache = null;
let cacheTs = 0;

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ── Static theme seeds (fallback when Groq unavailable) ────────────────────
// 2026 기준 — 현재 시장 핵심 테마
const THEME_SEEDS = [
  {
    id: 'defense_supercycle',
    nameKo: '방산 슈퍼사이클',
    keywords: ['방산', 'NATO', '재무장', '한화에어로스페이스', 'LIG넥스원', '폴란드', '수출'],
    relatedAssets: ['한화에어로스페이스', 'LIG넥스원', '현대로템', 'HD현대중공업', 'LMT', 'RTX'],
  },
  {
    id: 'ai_agent_infra',
    nameKo: 'AI 에이전트 인프라',
    keywords: ['AI 에이전트', 'MCP', 'LLM', 'HBM', '데이터센터', '엔비디아', 'SK하이닉스'],
    relatedAssets: ['SK하이닉스', '삼성전자', 'NVDA', 'MSFT', 'TIGER AI반도체'],
  },
  {
    id: 'korea_valup_foreigners',
    nameKo: '코스피 밸류업',
    keywords: ['밸류업', '외국인 순매수', '코스피', '탄핵', '정치리스크 해소', '저PBR'],
    relatedAssets: ['KODEX 200', '삼성전자', '현대차', 'KB금융', '신한지주'],
  },
  {
    id: 'trump_tariff_hedge',
    nameKo: '트럼프 관세 헤지',
    keywords: ['관세', '트럼프', '무역전쟁', '달러강세', '환율', '수출 타격'],
    relatedAssets: ['USD/KRW', '달러 ETF', 'KODEX 미국달러선물', '내수주'],
  },
  {
    id: 'nuclear_ai_power',
    nameKo: '원전·AI 전력 인프라',
    keywords: ['원전', '데이터센터 전력', '전력망', 'SMR', '두산에너빌리티', 'LS ELECTRIC'],
    relatedAssets: ['두산에너빌리티', 'LS ELECTRIC', '한전기술', 'CEG', 'VST'],
  },
  {
    id: 'hbm4_memory_race',
    nameKo: 'HBM4 메모리 경쟁',
    keywords: ['HBM4', 'HBM3e', '고대역폭메모리', 'SK하이닉스', '삼성전자', '마이크론', 'AI반도체'],
    relatedAssets: ['SK하이닉스', '삼성전자', 'MU', 'AMAT', 'LRCX'],
  },
  {
    id: 'china_ai_rise',
    nameKo: '중국 AI 굴기',
    keywords: ['딥시크', 'DeepSeek', '중국AI', '알리바바AI', 'Tencent', '바이두', 'Kimi'],
    relatedAssets: ['알리바바(9988.HK)', '텐센트(0700.HK)', 'BIDU', 'KWEB', '中芯国际(0981.HK)'],
  },
  {
    id: 'bitcoin_institutionalization',
    nameKo: '비트코인 기관화',
    keywords: ['비트코인', '현물ETF', '기관투자', '코인베이스', '마이크로스트래티지', '암호화폐'],
    relatedAssets: ['COIN', 'MSTR', 'IBIT', 'FBTC', 'BTC'],
  },
];

async function discoverThemes(signals, inferences, marketSnapshot, overrideGroqKey = '') {
  const groqKey = process.env.GROQ_API_KEY || overrideGroqKey;
  if (!groqKey) return generateTemplateThemes(signals, inferences);

  const signalSummary = signals.slice(0, 10).map(s =>
    `[${s.severity}] ${s.headlineKo ?? s.headline}`
  ).join('\n');

  const inferenceSummary = inferences.slice(0, 6).map(i =>
    `[${i.severity}] ${i.titleKo}: ${i.summaryKo}`
  ).join('\n');

  const mktStr = marketSnapshot ? JSON.stringify(marketSnapshot, null, 2) : '데이터 없음';

  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;

  const prompt = `
당신은 한국 개인투자자를 위한 금융 인텔리전스 분석가입니다.
오늘은 ${dateStr}입니다.

## 2026년 현재 시장 배경
- 방산 슈퍼사이클: 유럽 NATO 재무장, 한화에어로스페이스·LIG넥스원 수출 급증
- AI 에이전트 인프라: LLM → AI 에이전트 전환, HBM4 경쟁, 전력 인프라 수요
- 트럼프 관세: 반도체·자동차 관세 리스크, 달러 강세 압력
- 한국 정치 리스크 해소 후 코스피 밸류업 + 외국인 복귀 흐름
- 중국 AI 굴기(DeepSeek 이후), 비트코인 기관화 지속

## 현재 실시간 신호
${signalSummary || '(신호 없음)'}

## AI 인퍼런스
${inferenceSummary || '(인퍼런스 없음)'}

## 시장 스냅샷
${mktStr}

## 지시사항
위 데이터와 배경을 종합해, **지금 이 순간** 가장 강하게 작동 중인 투자 테마 4~6개를 발굴하세요.
현재 시장 흐름에 실제로 맞는 테마만 선정하고, 트렌드가 지난 테마는 제외하세요.
반드시 아래 JSON 배열만 출력하세요 (다른 텍스트 없이):
[
  {
    "id": "snake_case_id",
    "nameKo": "테마명 (한국어, 10자 이내)",
    "strength": 0~100 (강도),
    "momentum": "rising" | "falling" | "stable",
    "evidenceKo": ["근거1", "근거2"],
    "beneficiaryKo": ["수혜 자산1", "수혜 자산2"],
    "riskKo": ["리스크1", "리스크2"],
    "koreanStocks": ["종목1", "종목2"],
    "updatedAt": ${Date.now()}
  }
]

각 테마는 실제 투자 판단에 도움이 되도록 구체적이고 현재 시장에 맞게 작성하세요.
koreanStocks는 실제 한국 상장 종목 혹은 ETF명 (KODEX, TIGER 포함).
`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Extract JSON array
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    const themes = JSON.parse(jsonMatch[0]);
    return { themes, method: 'llm' };
  } catch (e) {
    console.error('Groq theme-discovery failed:', e.message);
    return generateTemplateThemes(signals, inferences);
  }
}

function generateTemplateThemes(signals, inferences) {
  // Score each seed theme based on keyword overlap with signals
  const signalText = signals.map(s => s.headlineKo ?? s.headline ?? '').join(' ');
  const infText    = inferences.map(i => i.titleKo ?? '').join(' ');
  const combined   = (signalText + ' ' + infText).toLowerCase();

  const scored = THEME_SEEDS.map(seed => {
    const hits = seed.keywords.filter(k => combined.includes(k.toLowerCase())).length;
    const strength = Math.min(95, 40 + hits * 12 + Math.random() * 10);
    const momentum = hits >= 2 ? 'rising' : hits === 1 ? 'stable' : 'falling';
    return {
      id:          seed.id,
      nameKo:      seed.nameKo,
      strength:    Math.round(strength),
      momentum,
      evidenceKo:  seed.keywords.slice(0, 2).map(k => `${k} 관련 신호 감지`),
      beneficiaryKo: seed.relatedAssets.slice(0, 3),
      riskKo:      ['글로벌 리스크온 전환', '달러강세 전환'],
      koreanStocks: seed.relatedAssets.filter(a => !a.includes('/') && !a.match(/^[A-Z]{2,4}$/)).slice(0, 3),
      updatedAt:   Date.now(),
    };
  });

  const themes = scored.sort((a, b) => b.strength - a.strength).slice(0, 5);
  return { themes, method: 'template' };
}

async function fetchMarketSnapshot() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:46123';
    const [koreaRes, macroRes] = await Promise.allSettled([
      fetch(`${base}/api/korea-market`, { signal: AbortSignal.timeout(4000) }),
      fetch(`${base}/api/global-macro`, { signal: AbortSignal.timeout(4000) }),
    ]);
    const korea = koreaRes.status === 'fulfilled' && koreaRes.value.ok ? await koreaRes.value.json() : null;
    const macro = macroRes.status === 'fulfilled' && macroRes.value.ok ? await macroRes.value.json() : null;

    const fmtPct = (v) => v != null ? `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%` : null;
    return {
      kospi:  korea?.kospi  ? `${fmtPct(korea.kospi.changePercent)}`  : null,
      kosdaq: korea?.kosdaq ? `${fmtPct(korea.kosdaq.changePercent)}` : null,
      usdkrw: korea?.usdkrw ? `${fmtPct(korea.usdkrw.changePercent)}` : null,
      spx:    macro?.spx    ? `${fmtPct(macro.spx.changePct)}`   : null,
      nasdaq: macro?.nasdaq ? `${fmtPct(macro.nasdaq.changePct)}` : null,
      vix:    macro?.vix    ? `${macro.vix.price?.toFixed(1)}`   : null,
      gold:   macro?.gold   ? `${fmtPct(macro.gold.changePct)}`  : null,
      oil:    macro?.oil    ? `${fmtPct(macro.oil.changePct)}`   : null,
    };
  } catch { return null; }
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  // Serve cache
  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Fetch signals + inferences from insight-briefing (best-effort)
  let signals    = [];
  let inferences = [];
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:46123';
    const briefRes = await fetch(`${base}/api/insight-briefing`, { signal: AbortSignal.timeout(5000) });
    if (briefRes.ok) {
      const brief = await briefRes.json();
      inferences = brief.topInferences ?? [];
      signals    = (brief.signalSummary?.topEntities ?? []).map(e => ({ headlineKo: e.nameKo, severity: 'INFO' }));
    }
  } catch { /* graceful */ }

  const overrideGroqKey = req.headers?.get?.('x-groq-key') ?? '';
  const marketSnapshot = await fetchMarketSnapshot();
  const { themes, method } = await discoverThemes(signals, inferences, marketSnapshot, overrideGroqKey);

  const payload = { themes, method, generatedAt: Date.now(), nextUpdate: Date.now() + CACHE_TTL };
  cache   = payload;
  cacheTs = Date.now();

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
