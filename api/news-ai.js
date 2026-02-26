/**
 * /api/news-ai
 *
 * RSS 뉴스 → Groq AI 한국어 투자 요약
 *
 * 1. Reuters/연합뉴스 RSS 최신 헤드라인 fetch
 * 2. Groq llama-3.3-70b-versatile로 한국어 투자 시사점 요약
 * 3. 섹터 태그 + 관련 티커 + 중요도 점수 반환
 *
 * Cache: 10분
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 10 * 60_000;
const caches = new Map(); // key → { data, ts }

// ─── RSS 소스 (primary + fallback) ────────────────────────────────────────────
const RSS_SOURCES_PRIMARY = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',    label: 'BBC 비즈' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',       label: 'BBC 월드' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',  label: 'BBC 테크' },
];

const RSS_SOURCES_FALLBACK = [
  { url: 'https://www.theguardian.com/business/rss',           label: 'Guardian 비즈' },
  { url: 'https://www.theguardian.com/world/rss',              label: 'Guardian 월드' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',          label: 'AlJazeera' },
];

// ─── 간단 XML 파서 (edge runtime) ─────────────────────────────────────────────
function parseRSSItems(xml, sourceLabel) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
    const block = match[1];
    const title   = extractTag(block, 'title');
    const pubDate = extractTag(block, 'pubDate');
    const desc    = extractTag(block, 'description');
    if (title && title.length > 10) {
      items.push({ title: stripCDATA(title), pubDate, description: stripCDATA(desc).slice(0, 200), source: sourceLabel });
    }
  }
  return items;
}

function extractTag(str, tag) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function stripCDATA(str) {
  return str.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
}

// ─── RSS fetch ────────────────────────────────────────────────────────────────
async function fetchRSS({ url, label }) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MentatMonitor/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml, label);
  } catch {
    return [];
  }
}

async function fetchAllRSS() {
  // 1차: primary 소스 시도
  const primary = (await Promise.all(RSS_SOURCES_PRIMARY.map(fetchRSS))).flat();
  if (primary.length >= 5) return primary;

  // primary 실패 시 fallback 병렬 시도
  const fallback = (await Promise.all(RSS_SOURCES_FALLBACK.map(fetchRSS))).flat();
  return [...primary, ...fallback];
}

// ─── Groq 요약 ────────────────────────────────────────────────────────────────
async function summarizeWithGroq(headlines, apiKey, portfolioTickers = []) {
  const headlineText = headlines
    .map((h, i) => `${i + 1}. [${h.source}] ${h.title}`)
    .join('\n');

  const portfolioHint = portfolioTickers.length > 0
    ? `\n사용자 보유 종목: ${portfolioTickers.join(', ')}.\n이 종목들과 관련된 뉴스를 최우선 선별하고, koreanTickers에 해당 종목명을 반드시 포함하세요.\n`
    : '';

  const prompt = `당신은 한국 개인 투자자를 위한 글로벌 금융 뉴스 분석가입니다.
다음 영문 뉴스 헤드라인을 분석하여, 한국 주식/ETF 투자에 중요한 순서로 5개를 선별해 JSON으로 반환하세요.
${portfolioHint}
헤드라인:
${headlineText}

각 항목에 대해 다음을 반환하세요:
{
  "items": [
    {
      "originalTitle": "원문 제목",
      "summaryKo": "한국어 요약 (2-3문장, 투자 관점 포함)",
      "investmentImplication": "한국 투자자에게 미치는 영향 (1문장)",
      "sectors": ["영향 섹터 (예: 반도체, 에너지, 방산, IT, 금융, 화학, 자동차)"],
      "koreanTickers": ["관련 한국 종목명 (최대 2개, 없으면 [])"],
      "importance": 1-10,
      "sentiment": "bullish" | "bearish" | "neutral"
    }
  ]
}

반드시 유효한 JSON만 반환. 다른 텍스트 불가.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Groq API ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';

  // JSON 파싱 (Groq가 가끔 마크다운 코드블록으로 감싸는 경우 처리)
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ─── Fallback (Groq 없을 때) ──────────────────────────────────────────────────
function buildFallback(headlines) {
  return {
    items: headlines.slice(0, 5).map((h, i) => ({
      originalTitle: h.title,
      summaryKo: h.title,
      investmentImplication: 'AI 요약을 위해 설정에서 Groq API 키를 입력하세요.',
      sectors: [],
      koreanTickers: [],
      importance: 5 - i,
      sentiment: 'neutral',
    })),
    fallback: true,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // 포트폴리오 파라미터
  const url = new URL(req.url);
  const portfolioParam = url.searchParams.get('portfolio') || '';
  const portfolioTickers = portfolioParam
    ? portfolioParam.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const cacheKey = portfolioTickers.length > 0 ? `portfolio:${portfolioParam}` : 'default';

  // 캐시 확인
  const now = Date.now();
  const cached = caches.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // API 키: 서버 env 우선, 없으면 클라이언트 헤더
  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';

  try {
    // RSS fetch (primary → fallback)
    const allItems = await fetchAllRSS();
    // 중복 제목 제거 (앞 40자로 비교)
    const seen = new Set();
    const unique = allItems.filter(h => {
      const key = h.title.slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let result;
    if (groqKey && unique.length > 0) {
      try {
        result = await summarizeWithGroq(unique.slice(0, 12), groqKey, portfolioTickers);
      } catch (e) {
        console.error('Groq error:', e.message);
        result = buildFallback(unique);
      }
    } else {
      result = buildFallback(unique);
    }

    const payload = {
      ...result,
      generatedAt: now,
      rawCount: unique.length,
      hasAI: !!groqKey && !result.fallback,
      portfolioMode: portfolioTickers.length > 0,
    };

    caches.set(cacheKey, { data: payload, ts: now });

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (err) {
    console.error('news-ai error:', err.message);
    return new Response(JSON.stringify({ error: 'Failed', details: err.message, items: [] }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
