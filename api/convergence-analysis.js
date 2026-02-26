/**
 * /api/convergence-analysis
 *
 * Given multiple converging signals from different layers,
 * returns a Groq-generated investment synthesis.
 * Designed for lazy-load (called only when user clicks a convergence zone).
 *
 * Cache: 10 minutes per unique event combination.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 10 * 60_000;
const cache = new Map(); // key -> {result, ts}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';
  if (!groqKey) return new Response(JSON.stringify({ error: 'No Groq key', synthesis: null }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

  const { events = [], region = '' } = body;
  if (!events || events.length === 0) return new Response(JSON.stringify({ synthesis: null }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  // Cache key: sorted event IDs
  const cacheKey = events.map(e => e.id || e.label || '').sort().join('|');
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) {
    return new Response(JSON.stringify({ synthesis: cached.result, cached: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders } });
  }

  const eventDesc = events.map((e, i) => `${i + 1}. [${e.layer}] ${e.label || e.title}: ${e.signal || e.desc || ''}`).join('\n');

  const prompt = `다음은 ${region || '특정 지역'}에서 동시에 발생한 ${events.length}개의 다층 시그널입니다:\n\n${eventDesc}\n\n한국 개인 투자자 관점에서:\n1. 이 시그널들의 공통 의미를 2-3문장으로 요약\n2. 단기(1-2주) 투자 시사점 (구체적 한국 종목명 포함)\n3. Risk-On 또는 Risk-Off 판정 및 이유\n\nJSON으로만 응답:\n{"summary":"...","actionKo":"...","riskMode":"ON|OFF","confidence":"high|medium|low","affectedTickersKR":["ticker1","ticker2"]}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    cache.set(cacheKey, { result: parsed, ts: now });
    if (cache.size > 50) { const first = cache.keys().next().value; cache.delete(first); }
    return new Response(JSON.stringify({ synthesis: parsed, cached: false }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ synthesis: null, error: err.message }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
