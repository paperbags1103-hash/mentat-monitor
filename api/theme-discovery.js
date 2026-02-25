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

// ── Static theme seeds (enriched dynamically) ──────────────────────────────
const THEME_SEEDS = [
  {
    id: 'ai_infra_bottleneck',
    nameKo: 'AI 인프라 병목',
    keywords: ['반도체', 'AI', '데이터센터', '전력', 'HBM', '엔비디아', 'TSM'],
    relatedAssets: ['삼성전자', 'SK하이닉스', 'NVDA', 'TSM', 'TSLA'],
  },
  {
    id: 'us_credit_stress',
    nameKo: '미국 신용 스트레스',
    keywords: ['HY 스프레드', '리파이낸싱', '정크본드', '연준', '금리'],
    relatedAssets: ['HYG', 'LQD', '미국 국채', '달러'],
  },
  {
    id: 'china_stimulus_trade',
    nameKo: '중국 경기부양 트레이드',
    keywords: ['중국 경기부양', '위안화', 'FXI', '원자재', '구리'],
    relatedAssets: ['포스코홀딩스', 'FXI', '구리', '철광석'],
  },
  {
    id: 'safe_haven_rotation',
    nameKo: '안전자산 로테이션',
    keywords: ['지정학', '달러강세', '금', '국채', '스위스 프랑'],
    relatedAssets: ['금', 'TLT', 'USD', 'CHF', '달러'],
  },
  {
    id: 'korea_export_cycle',
    nameKo: '한국 수출 싸이클',
    keywords: ['반도체 수출', '자동차', '조선', '환율', '미국 관세'],
    relatedAssets: ['삼성전자', '현대차', 'HD현대중공업', 'USD/KRW'],
  },
  {
    id: 'energy_transition',
    nameKo: '에너지 전환 가속',
    keywords: ['원전', '재생에너지', '탄소', 'LNG', '그린수소'],
    relatedAssets: ['두산에너빌리티', 'ENPH', 'WTI', 'LNG'],
  },
  {
    id: 'taiwan_strait_risk',
    nameKo: '대만해협 리스크',
    keywords: ['대만', '중국', '지정학', '반도체', '공급망'],
    relatedAssets: ['TSM', 'AMAT', '삼성전자', '방산주'],
  },
  {
    id: 'em_currency_stress',
    nameKo: '신흥국 통화 압박',
    keywords: ['달러강세', '신흥국', 'EM', '원화', '환율'],
    relatedAssets: ['USD/KRW', 'EEM', '한국 수출주'],
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

  const prompt = `
당신은 한국 기관투자자를 위한 금융 인텔리전스 분석가입니다.
아래 데이터를 분석하여, 현재 시장에서 활성화된 투자 테마를 4~6개 발견해주세요.

## 현재 신호
${signalSummary || '(신호 없음)'}

## AI 인퍼런스
${inferenceSummary || '(인퍼런스 없음)'}

## 시장 스냅샷
${mktStr}

## 지시사항
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
    const res = await fetch(`${base}/api/korea-market`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return res.json();
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
