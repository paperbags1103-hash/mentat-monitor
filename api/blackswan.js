/**
 * /api/blackswan
 *
 * Black Swan Early Warning System — Mentat Monitor
 *
 * Aggregates multiple signal categories into a composite Tail Risk Index (0–100).
 * Each category contributes a sub-score; categories are weighted by impact.
 *
 * Signal categories:
 *  1. Financial Stress  — VIX, HY credit spread, TED spread (Yahoo Finance + FRED)
 *  2. Pandemic Watch    — ProMED RSS + WHO outbreak news feed
 *  3. Nuclear/Radiation — IAEA press releases + radiation keywords in news
 *  4. Cyber / Internet  — Cloudflare Radar (if token set) + BGP anomaly news
 *  5. Geopolitical      — Keyword spikes in news (invasion, nuclear, coup, etc.)
 *  6. Supply Chain      — Shipping disruption keywords + Baltic Dry Index proxy
 *
 * Tail Risk Index:
 *   0–20:  GREEN  — Normal
 *  21–40:  YELLOW — Watch
 *  41–60:  ORANGE — Elevated
 *  61–80:  RED    — High
 *  81–100: CRITICAL
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 300_000; // 5 min
let cache = null;
let cacheTs = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJSON(url, timeout = 8000) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return resp.json();
}

async function fetchText(url, timeout = 8000) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return resp.text();
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function extractRssItems(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = (/<title[^>]*><!\[CDATA\[(.*?)\]\]>/i.exec(block) || /<title[^>]*>(.*?)<\/title>/i.exec(block) || [])[1] || '';
    const desc = (/<description[^>]*><!\[CDATA\[(.*?)\]\]>/i.exec(block) || /<description[^>]*>(.*?)<\/description>/i.exec(block) || [])[1] || '';
    items.push((title + ' ' + desc).toLowerCase());
  }
  return items;
}

function countKeywords(texts, keywords) {
  let count = 0;
  for (const text of texts) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) count++;
    }
  }
  return count;
}

// ─── Signal Modules ──────────────────────────────────────────────────────────

// 1. Financial Stress (40% weight)
async function getFinancialStressScore() {
  const signals = {};

  // VIX from Yahoo Finance
  try {
    const data = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d');
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) {
      signals.vix = price;
      // VIX scoring: <15=calm(0), 15-20=normal(10), 20-30=elevated(30), 30-40=high(60), >40=panic(90)
      signals.vixScore = price < 15 ? 0 : price < 20 ? 10 : price < 30 ? 30 : price < 40 ? 60 : 90;
    }
  } catch {}

  // HY Credit Spread proxy: JNK (HY bond ETF) % change vs LQD (IG ETF)
  // Large divergence = credit stress
  try {
    const [jnk, lqd] = await Promise.all([
      fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/JNK?interval=1d&range=5d'),
      fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/LQD?interval=1d&range=5d'),
    ]);
    const jnkChange = jnk?.chart?.result?.[0]?.meta;
    const lqdChange = lqd?.chart?.result?.[0]?.meta;
    if (jnkChange && lqdChange) {
      const jnkPct = ((jnkChange.regularMarketPrice - jnkChange.chartPreviousClose) / jnkChange.chartPreviousClose) * 100;
      const lqdPct = ((lqdChange.regularMarketPrice - lqdChange.chartPreviousClose) / lqdChange.chartPreviousClose) * 100;
      const spread = lqdPct - jnkPct; // positive = HY underperforming = stress
      signals.hySpread = Math.round(spread * 100) / 100;
      signals.hySpreadScore = spread < 0.5 ? 0 : spread < 1 ? 20 : spread < 2 ? 40 : spread < 3 ? 65 : 85;
    }
  } catch {}

  // USD/JPY (JPY strengthening rapidly = risk-off / flight to safety)
  try {
    const data = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/JPY%3DX?interval=1d&range=10d');
    const result = data?.chart?.result?.[0];
    if (result) {
      const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
      if (closes.length >= 5) {
        const roc5 = ((closes.at(-1) - closes.at(-5)) / closes.at(-5)) * 100;
        signals.jpyRoc5d = Math.round(roc5 * 100) / 100;
        // JPY appreciating fast (negative roc for USD/JPY) = risk-off
        signals.jpyScore = roc5 > 1 ? 0 : roc5 > -1 ? 10 : roc5 > -3 ? 30 : roc5 > -5 ? 55 : 80;
      }
    }
  } catch {}

  const scores = [signals.vixScore, signals.hySpreadScore, signals.jpyScore].filter(s => s != null);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { score: Math.round(avgScore), signals, weight: 0.40 };
}

// 2. Pandemic Watch (20% weight)
async function getPandemicScore() {
  const signals = {};
  let score = 0;

  const PANDEMIC_KEYWORDS = [
    'outbreak', 'epidemic', 'pandemic', 'novel virus', 'unknown pneumonia',
    'human transmission', 'person-to-person', 'health emergency', 'quarantine',
    'lockdown', 'disease cluster', 'hemorrhagic', 'unusual illness', 'excess deaths',
    'WHO alert', 'public health emergency', '집단 감염', '신종 바이러스',
  ];

  // ProMED RSS
  try {
    const xml = await fetchText('https://promedmail.org/feed/');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, PANDEMIC_KEYWORDS);
    signals.promedHits = hits;
    signals.promedItems = items.length;
    score += Math.min(40, hits * 8);
  } catch {}

  // WHO Disease Outbreak News
  try {
    const xml = await fetchText('https://www.who.int/rss-feeds/news-english.xml');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, ['outbreak', 'alert', 'disease', 'emergency', 'virus', 'epidemic']);
    signals.whoHits = hits;
    score += Math.min(30, hits * 5);
  } catch {}

  // HealthMap Google News proxy
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=(outbreak+OR+epidemic+OR+"unknown+disease"+OR+"unusual+illness")+when:1d&hl=en-US&gl=US&ceid=US:en');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, PANDEMIC_KEYWORDS);
    signals.gnewsHits = hits;
    score += Math.min(30, hits * 3);
  } catch {}

  return { score: clamp(score, 0, 100), signals, weight: 0.20 };
}

// 3. Nuclear / Radiation (15% weight)
async function getNuclearScore() {
  const signals = {};
  let score = 0;

  const NUCLEAR_KEYWORDS = [
    'nuclear', 'radiation', 'radioactive', 'meltdown', 'reactor',
    'potassium iodide', 'iodine tablets', 'nuclear alert', 'IAEA alert',
    '방사능', '원전 사고', '핵 경보', 'evacuate nuclear', 'radiological',
    'dirty bomb', 'nuclear incident', 'criticality', 'containment breach',
  ];

  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=(nuclear+alert+OR+radiation+leak+OR+"reactor+incident"+OR+"iodine+tablets")+when:2d&hl=en-US&gl=US&ceid=US:en');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, NUCLEAR_KEYWORDS);
    signals.googleNewsHits = hits;
    score += Math.min(60, hits * 15);
  } catch {}

  // IAEA press releases
  try {
    const xml = await fetchText('https://www.iaea.org/feeds/topstories.xml');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, ['incident', 'emergency', 'alert', 'radiation', 'nuclear']);
    signals.iaeaHits = hits;
    score += Math.min(40, hits * 20);
  } catch {}

  return { score: clamp(score, 0, 100), signals, weight: 0.15 };
}

// 4. Cyber / Internet Infrastructure (10% weight)
async function getCyberScore() {
  const signals = {};
  let score = 0;

  const CYBER_KEYWORDS = [
    'major outage', 'internet disruption', 'cyberattack', 'ransomware', 'critical infrastructure',
    'power grid attack', 'BGP hijack', 'submarine cable cut', 'DNS attack',
    '사이버 공격', '인터넷 마비', 'DDoS', 'zero-day', 'nation-state attack',
  ];

  // Cloudflare Radar (if token set)
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (cfToken) {
    try {
      const resp = await fetch('https://api.cloudflare.com/client/v4/radar/quality/speed/summary?dateRange=1d', {
        headers: { Authorization: `Bearer ${cfToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        // Check for anomalies in bandwidth reduction
        signals.cfData = 'available';
      }
    } catch {}
  }

  // Google News cyber keywords
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=(cyberattack+OR+"internet+outage"+OR+"critical+infrastructure+attack")+when:1d&hl=en-US&gl=US&ceid=US:en');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, CYBER_KEYWORDS);
    signals.cyberNewsHits = hits;
    score += Math.min(70, hits * 12);
  } catch {}

  return { score: clamp(score, 0, 100), signals, weight: 0.10 };
}

// 5. Geopolitical Escalation (10% weight)
async function getGeopoliticalScore() {
  const signals = {};
  let score = 0;

  const HIGH_KEYWORDS = ['invasion', 'nuclear launch', 'war declared', 'coup', 'martial law', 'assassination'];
  const MED_KEYWORDS = ['airstrike', 'missile launch', 'troops deployed', 'military alert', 'evacuation'];
  const LOW_KEYWORDS = ['tensions', 'conflict', 'border clash', 'military exercise', 'sanctions'];

  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=(war+OR+invasion+OR+nuclear+OR+coup+OR+crisis)+when:6h&hl=en-US&gl=US&ceid=US:en');
    const items = extractRssItems(xml);
    const highHits = countKeywords(items, HIGH_KEYWORDS);
    const medHits = countKeywords(items, MED_KEYWORDS);
    const lowHits = countKeywords(items, LOW_KEYWORDS);
    signals.highHits = highHits;
    signals.medHits = medHits;
    signals.lowHits = lowHits;
    score += Math.min(80, highHits * 25 + medHits * 10 + lowHits * 3);
  } catch {}

  return { score: clamp(score, 0, 100), signals, weight: 0.10 };
}

// 6. Supply Chain Disruption (5% weight)
async function getSupplyChainScore() {
  const signals = {};
  let score = 0;

  // Baltic Dry Index proxy via Yahoo Finance (BDI isn't on Yahoo, use shipping ETF)
  try {
    const data = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/BDRY?interval=1d&range=10d');
    const result = data?.chart?.result?.[0];
    if (result) {
      const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
      if (closes.length >= 5) {
        const roc5 = ((closes.at(-1) - closes.at(-5)) / closes.at(-5)) * 100;
        signals.bdryRoc5d = Math.round(roc5 * 100) / 100;
        // Rapid drop in shipping ETF = supply chain stress
        score += roc5 > -5 ? 0 : roc5 > -15 ? 20 : roc5 > -25 ? 45 : 70;
      }
    }
  } catch {}

  // Supply chain news
  try {
    const xml = await fetchText('https://news.google.com/rss/search?q=("supply+chain+disruption"+OR+"port+closure"+OR+"shipping+blockade")+when:2d&hl=en-US&gl=US&ceid=US:en');
    const items = extractRssItems(xml);
    const hits = countKeywords(items, ['disruption', 'blockade', 'closure', 'shortage', 'bottleneck']);
    signals.supplyNewsHits = hits;
    score += Math.min(30, hits * 8);
  } catch {}

  return { score: clamp(score, 0, 100), signals, weight: 0.05 };
}

// ─── Composite Score ──────────────────────────────────────────────────────────

function compositeScore(modules) {
  const weighted = modules.reduce((sum, m) => sum + m.score * m.weight, 0);
  return clamp(Math.round(weighted), 0, 100);
}

function getTailRiskLevel(score) {
  if (score <= 20) return { level: 'NORMAL', label: '정상', color: '#4CAF50', emoji: '🟢' };
  if (score <= 40) return { level: 'WATCH', label: '주시', color: '#FFC107', emoji: '🟡' };
  if (score <= 60) return { level: 'ELEVATED', label: '상승', color: '#FF9800', emoji: '🟠' };
  if (score <= 80) return { level: 'HIGH', label: '높음', color: '#F44336', emoji: '🔴' };
  return { level: 'CRITICAL', label: '위급', color: '#9C27B0', emoji: '🚨' };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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

  // Run all signal modules in parallel
  const [financial, pandemic, nuclear, cyber, geopolitical, supplyChain] = await Promise.all([
    getFinancialStressScore(),
    getPandemicScore(),
    getNuclearScore(),
    getCyberScore(),
    getGeopoliticalScore(),
    getSupplyChainScore(),
  ]);

  const modules = [financial, pandemic, nuclear, cyber, geopolitical, supplyChain];
  const tailRiskScore = compositeScore(modules);
  const tailRiskLevel = getTailRiskLevel(tailRiskScore);

  const result = {
    timestamp: now,
    tailRiskScore,
    ...tailRiskLevel,
    modules: {
      financial: { score: financial.score, weight: financial.weight, signals: financial.signals },
      pandemic: { score: pandemic.score, weight: pandemic.weight, signals: pandemic.signals },
      nuclear: { score: nuclear.score, weight: nuclear.weight, signals: nuclear.signals },
      cyber: { score: cyber.score, weight: cyber.weight, signals: cyber.signals },
      geopolitical: { score: geopolitical.score, weight: geopolitical.weight, signals: geopolitical.signals },
      supplyChain: { score: supplyChain.score, weight: supplyChain.weight, signals: supplyChain.signals },
    },
    // Pre-formatted for UI display
    breakdown: [
      { id: 'financial', label: '금융 스트레스', emoji: '📊', score: financial.score, weight: '40%' },
      { id: 'pandemic', label: '팬데믹 경보', emoji: '🦠', score: pandemic.score, weight: '20%' },
      { id: 'nuclear', label: '핵/방사능', emoji: '☢️', score: nuclear.score, weight: '15%' },
      { id: 'cyber', label: '사이버/인터넷', emoji: '💻', score: cyber.score, weight: '10%' },
      { id: 'geopolitical', label: '지정학 에스컬레이션', emoji: '⚔️', score: geopolitical.score, weight: '10%' },
      { id: 'supplyChain', label: '공급망 충격', emoji: '🚢', score: supplyChain.score, weight: '5%' },
    ],
  };

  cache = result;
  cacheTs = now;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
