# Task: Auto-Briefing System + Breaking News Overhaul

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Replace the ChatAgent panel with a scheduled auto-briefing system using Groq 70b.
Also fix breaking news to be near-real-time (5-min cache, keyword-based, no Groq).

## Files to Create/Edit

1. `api/breaking-news.js` — CREATE: fast breaking news endpoint (5-min cache, keywords)
2. `api/auto-briefing.js` — CREATE: comprehensive scheduled briefing using 70b
3. `src-react/src/panels/AutoBriefingPanel.tsx` — CREATE: replaces ChatAgentPanel
4. `src-react/src/aip/AIPLayout.tsx` — REPLACE ChatAgentPanel with AutoBriefingPanel
5. `api/geo-events.js` — ADD Middle East/Reuters RSS sources + fallback lat/lng for country-only events

Do NOT touch WorldMapView.tsx.

---

## PART 1: `api/breaking-news.js`

Fast-path breaking news: no Groq, keyword filtering only, 5-min cache.

```js
/**
 * /api/breaking-news
 * 
 * Near-real-time breaking news from multiple RSS sources.
 * No Groq — keyword-based filtering only (fast).
 * Cache: 5 minutes.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 5 * 60_000;
let cache = null;
let cacheTs = 0;

const SOURCES = [
  { label: 'AlJazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { label: 'Guardian',  url: 'https://www.theguardian.com/world/rss' },
  { label: 'BBC',       url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { label: 'DW',        url: 'https://rss.dw.com/xml/rss-en-all' },
  { label: 'Reuters',   url: 'https://feeds.reuters.com/reuters/worldNews' },
];

// Keywords that indicate breaking/high-impact news
const BREAKING_KEYWORDS = [
  'breaking', 'urgent', 'alert', 'crisis', 'attack', 'explosion', 'strike',
  'sanctions', 'nuclear', 'missile', 'war', 'conflict', 'invasion', 'ceasefire',
  'emergency', 'catastrophe', 'earthquake', 'tsunami', 'crash', 'killed',
  // Korean market relevant
  'iran', 'israel', 'ukraine', 'taiwan', 'north korea', 'dprk',
  'semiconductor', 'chip ban', 'export control', 'tariff', 'trade war',
  'oil', 'crude', 'opec', 'fed rate', 'interest rate',
  // Korean
  '이란', '이스라엘', '우크라이나', '대만', '북한', '핵', '제재',
];

// Simple country → lat/lng mapping for geo-tagging
const COUNTRY_GEO = {
  iran: { lat: 32.4, lng: 53.7, region: '이란' },
  israel: { lat: 31.0, lng: 35.2, region: '이스라엘' },
  ukraine: { lat: 49.0, lng: 31.5, region: '우크라이나' },
  russia: { lat: 61.5, lng: 105.3, region: '러시아' },
  taiwan: { lat: 23.7, lng: 121.0, region: '대만' },
  china: { lat: 35.9, lng: 104.2, region: '중국' },
  'north korea': { lat: 40.3, lng: 127.5, region: '북한' },
  dprk: { lat: 40.3, lng: 127.5, region: '북한' },
  'south korea': { lat: 36.5, lng: 127.9, region: '한국' },
  usa: { lat: 37.1, lng: -95.7, region: '미국' },
  'united states': { lat: 37.1, lng: -95.7, region: '미국' },
  japan: { lat: 36.2, lng: 138.3, region: '일본' },
  gaza: { lat: 31.35, lng: 34.31, region: '가자지구' },
  'middle east': { lat: 29.3, lng: 42.5, region: '중동' },
  syria: { lat: 34.8, lng: 38.9, region: '시리아' },
  lebanon: { lat: 33.8, lng: 35.9, region: '레바논' },
  saudi: { lat: 23.9, lng: 45.1, region: '사우디아라비아' },
  pakistan: { lat: 30.4, lng: 69.3, region: '파키스탄' },
  india: { lat: 20.6, lng: 79.0, region: '인도' },
};

function parseItems(xml) {
  // Handle both RSS 2.0 and RDF/RSS 1.0
  const matches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)];
  return matches.map(m => {
    const content = m[1];
    const title = (content.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   content.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1]?.trim() ?? '';
    const link =  (content.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/) ||
                   content.match(/<link>([\s\S]*?)<\/link>/))?.[1]?.trim() ?? '';
    const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/))?.[1]?.trim() ?? '';
    const desc = (content.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                  content.match(/<description[^>]*>([\s\S]*?)<\/description>/))?.[1]
                    ?.replace(/<[^>]+>/g, '')?.trim() ?? '';
    return { title, link, pubDate, desc };
  });
}

function scoreItem(item) {
  const text = (item.title + ' ' + item.desc).toLowerCase();
  
  // Time score: penalize old items
  let ageHours = 999;
  if (item.pubDate) {
    try {
      ageHours = (Date.now() - new Date(item.pubDate).getTime()) / 3_600_000;
    } catch {}
  }
  if (ageHours > 12) return null; // Skip items older than 12 hours
  
  // Keyword score
  const matchedKeywords = BREAKING_KEYWORDS.filter(kw => text.includes(kw));
  if (matchedKeywords.length === 0) return null;
  
  // Geo-tagging
  let geo = null;
  for (const [key, coords] of Object.entries(COUNTRY_GEO)) {
    if (text.includes(key)) { geo = coords; break; }
  }
  
  const isBreaking = matchedKeywords.some(kw => ['breaking', 'urgent', 'alert', 'attack', 'explosion', 'strike', 'invasion'].includes(kw));
  const severity = isBreaking ? 'critical' : ageHours < 3 ? 'high' : 'medium';
  
  return {
    id: `bn-${Math.abs([...item.title].reduce((a, c) => a + c.charCodeAt(0), 0)) % 99999}`,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    ageHours: Math.round(ageHours * 10) / 10,
    severity,
    breaking: isBreaking,
    keywords: matchedKeywords.slice(0, 3),
    geo,
    score: matchedKeywords.length * 10 - ageHours * 2,
  };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify(cache), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Fetch all sources concurrently (3s timeout each)
  const results = await Promise.allSettled(
    SOURCES.map(src =>
      fetch(src.url, { signal: AbortSignal.timeout(3000) })
        .then(r => r.text())
        .then(xml => parseItems(xml).map(item => ({ ...item, source: src.label })))
        .catch(() => [])
    )
  );

  const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  
  // Score and filter
  const scored = allItems
    .map(item => scoreItem(item))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  
  // Deduplicate by title similarity (simple: first 40 chars)
  const seen = new Set();
  const deduped = scored.filter(item => {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const output = {
    items: deduped.slice(0, 15),
    breaking: deduped.filter(i => i.breaking).slice(0, 5),
    fetchedAt: new Date().toISOString(),
    sourceCount: SOURCES.length,
  };

  cache = output;
  cacheTs = now;

  return new Response(JSON.stringify(output), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
```

---

## PART 2: `api/auto-briefing.js`

Scheduled comprehensive briefing using Groq 70b. Called by client at 8am/1pm/7pm KST or on critical event.

```js
/**
 * /api/auto-briefing
 *
 * Generates a comprehensive Korean investment briefing from all live signals.
 * Uses llama-3.3-70b-versatile for high-quality analysis.
 * Cache: 4 hours (or until invalidated by critical event).
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 4 * 60 * 60_000; // 4 hours
let cache = null;
let cacheTs = 0;

async function fetchJson(url, timeout = 4000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const groqKey = process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '';
  if (!groqKey) return new Response(JSON.stringify({ error: 'No Groq key' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  // Check for force-refresh
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  const now = Date.now();
  if (!forceRefresh && cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true, cacheAge: Math.round((now - cacheTs) / 60000) }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Gather all signals in parallel
  const baseUrl = new URL(req.url).origin;
  const [geoData, marketData, breakingData] = await Promise.all([
    fetchJson(`${baseUrl}/api/geo-events`, 5000),
    fetchJson(`${baseUrl}/api/korea-market`, 4000),
    fetchJson(`${baseUrl}/api/breaking-news`, 4000),
  ]);

  // Summarize signals
  const criticalEvents = (geoData?.events ?? []).filter(ev => ev.severity === 'critical' || ev.severity === 'high').slice(0, 6);
  const breakingItems = (breakingData?.breaking ?? []).slice(0, 5);
  const allBreaking = (breakingData?.items ?? []).filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 8);

  const eventSummary = criticalEvents.map(ev => `[${ev.severity}] ${ev.region}: ${ev.titleKo}`).join('\n');
  const breakingSummary = [...new Set([...breakingItems, ...allBreaking])].slice(0, 8)
    .map(i => `[BREAKING] ${i.title} (${i.ageHours}h ago, src: ${i.source})`).join('\n');

  const marketStr = marketData
    ? `KOSPI: ${marketData.kospi ?? 'N/A'} (${marketData.kospiChange ?? ''}) | USD/KRW: ${marketData.usdkrw ?? 'N/A'} | VIX: ${marketData.vix ?? 'N/A'}`
    : '시장 데이터 불가';

  const kstHour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false });
  const kstDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

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
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
```

---

## PART 3: `src-react/src/panels/AutoBriefingPanel.tsx`

Replaces ChatAgentPanel. Shows the auto-generated briefing. Refreshes at 8am/1pm/7pm KST or when user clicks refresh.

```tsx
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../store';

interface BriefingData {
  headline?: string;
  riskMode?: 'ON' | 'OFF' | 'NEUTRAL';
  riskReason?: string;
  topThreats?: Array<{ title: string; detail: string; affectedKR: string[]; affectedUS: string[] }>;
  opportunities?: Array<{ title: string; detail: string; affectedKR: string[]; affectedUS: string[] }>;
  keyWatchpoints?: string[];
  briefingKo?: string;
  generatedAtKST?: string;
  signalCount?: number;
  cached?: boolean;
  cacheAge?: number;
  error?: string;
}

// KST schedule: 8, 13, 19 (hours)
const BRIEFING_HOURS_KST = [8, 13, 19];

function getNextBriefingTime(): Date {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const kstHour = kstNow.getUTCHours();

  let nextHour = BRIEFING_HOURS_KST.find(h => h > kstHour);
  if (!nextHour) nextHour = BRIEFING_HOURS_KST[0] + 24; // tomorrow 8am

  const next = new Date(kstNow);
  next.setUTCHours(nextHour % 24, 0, 0, 0);
  if (nextHour >= 24) next.setUTCDate(next.getUTCDate() + 1);
  return new Date(next.getTime() - kstOffset);
}

export default function AutoBriefingPanel() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextTime, setNextTime] = useState<Date>(getNextBriefingTime());

  async function fetchBriefing(forceRefresh = false) {
    setLoading(true);
    try {
      const data = await apiFetch<BriefingData>(`/api/auto-briefing${forceRefresh ? '?refresh=1' : ''}`);
      setBriefing(data);
      setNextTime(getNextBriefingTime());
    } catch (e) {
      setBriefing({ error: '브리핑 생성 실패' });
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    fetchBriefing();
  }, []);

  // Schedule auto-refresh at KST briefing hours
  useEffect(() => {
    const msUntilNext = nextTime.getTime() - Date.now();
    if (msUntilNext <= 0) { fetchBriefing(); return; }
    const t = setTimeout(() => fetchBriefing(), msUntilNext);
    return () => clearTimeout(t);
  }, [nextTime]);

  const RISK_COLOR = { ON: '#22c55e', OFF: '#ef4444', NEUTRAL: '#f59e0b' };
  const riskColor = RISK_COLOR[briefing?.riskMode ?? 'NEUTRAL'] ?? '#f59e0b';

  function formatCountdown(date: Date): string {
    const ms = date.getTime() - Date.now();
    if (ms <= 0) return '지금';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  }

  if (loading && !briefing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: '#475569', fontSize: 12 }}>
        <div style={{ fontSize: 20 }}>🧠</div>
        <div>브리핑 생성 중...</div>
        <div style={{ fontSize: 10 }}>70b 모델로 모든 시그널 분석 중</div>
      </div>
    );
  }

  if (!briefing || briefing.error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: '#ef4444', fontSize: 12 }}>{briefing?.error ?? '브리핑 없음'}</div>
        <button onClick={() => fetchBriefing(true)} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}>
          재시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 12, color: '#e2e8f0' }}>
      {/* Header bar */}
      <div style={{ padding: '6px 12px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${riskColor}22`, color: riskColor, fontWeight: 800, border: `1px solid ${riskColor}44` }}>
          {briefing.riskMode === 'ON' ? '📈 Risk-On' : briefing.riskMode === 'OFF' ? '🛡️ Risk-Off' : '⚖️ Neutral'}
        </span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{briefing.headline}</span>
        <button
          onClick={() => fetchBriefing(true)}
          disabled={loading}
          title="지금 재생성"
          style={{ background: 'none', border: '1px solid #334155', color: loading ? '#334155' : '#64748b', borderRadius: 4, padding: '2px 6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 10 }}
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Briefing summary */}
        {briefing.briefingKo && (
          <div style={{ lineHeight: 1.7, color: '#cbd5e1', fontSize: 11, padding: '8px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #1e293b' }}>
            {briefing.briefingKo}
          </div>
        )}

        {/* Risk reason */}
        {briefing.riskReason && (
          <div style={{ fontSize: 10, color: riskColor, padding: '5px 8px', background: `${riskColor}11`, borderRadius: 4, border: `1px solid ${riskColor}33` }}>
            {briefing.riskReason}
          </div>
        )}

        {/* Threats */}
        {briefing.topThreats && briefing.topThreats.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>⚠️ 주요 위협</div>
            {briefing.topThreats.map((t, i) => (
              <div key={i} style={{ marginBottom: 7, padding: '7px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #ef444433', borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, marginBottom: 5 }}>{t.detail}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {t.affectedKR?.map(s => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2a3f', color: '#60a5fa', borderRadius: 3, fontWeight: 700 }}>{s}</span>)}
                  {t.affectedUS?.map(s => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2f1a', color: '#86efac', borderRadius: 3, fontFamily: 'monospace' }}>{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Opportunities */}
        {briefing.opportunities && briefing.opportunities.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>💰 투자 기회</div>
            {briefing.opportunities.map((o, i) => (
              <div key={i} style={{ marginBottom: 7, padding: '7px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #22c55e33', borderLeft: '3px solid #22c55e' }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 3 }}>{o.title}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, marginBottom: 5 }}>{o.detail}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {o.affectedKR?.map(s => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2a3f', color: '#60a5fa', borderRadius: 3, fontWeight: 700 }}>{s}</span>)}
                  {o.affectedUS?.map(s => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2f1a', color: '#86efac', borderRadius: 3, fontFamily: 'monospace' }}>{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watchpoints */}
        {briefing.keyWatchpoints && briefing.keyWatchpoints.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>👁️ 주목할 것</div>
            {briefing.keyWatchpoints.map((w, i) => (
              <div key={i} style={{ fontSize: 10, color: '#94a3b8', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                {i + 1}. {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 12px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#0a0f1e' }}>
        <span style={{ fontSize: 9, color: '#334155' }}>
          {briefing.generatedAtKST ? `생성: ${briefing.generatedAtKST.slice(5, 16)}` : ''}{briefing.cacheAge ? ` (${briefing.cacheAge}분 전)` : ''}
        </span>
        <span style={{ fontSize: 9, color: '#334155' }}>
          다음: {formatCountdown(nextTime)}
        </span>
      </div>
    </div>
  );
}
```

---

## PART 4: Update `src-react/src/aip/AIPLayout.tsx`

1. Remove the import for `ChatAgentPanel`:
   ```typescript
   // Remove: import ChatAgentPanel from '@/panels/ChatAgentPanel';
   ```

2. Add import for `AutoBriefingPanel`:
   ```typescript
   import AutoBriefingPanel from '@/panels/AutoBriefingPanel';
   ```

3. Find the section in AIPLayout that uses `<ChatAgentPanel .../>` and replace it with:
   ```tsx
   <AutoBriefingPanel />
   ```
   
   Remove any props that were passed to ChatAgentPanel (geoEvents, convergenceZones, marketSummary) since AutoBriefingPanel handles its own data fetching.

Also update the section header from "🤖 AI 브리핑 에이전트" to "📊 종합 브리핑":
```tsx
<div className="h-8 shrink-0 flex items-center px-3 text-xs font-semibold text-accent border-b border-border">
  📊 종합 브리핑
</div>
```

---

## PART 5: Update `api/geo-events.js` — Add more sources + fallback geo

Look at the existing `api/geo-events.js`. 

1. Add these RSS sources to the primary list (if not already present):
```js
{ url: 'https://www.theguardian.com/world/rss', label: 'Guardian' },
{ url: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC World' },
```

2. Find where items are processed/geo-tagged. After Groq extracts events, if an event has no lat/lng but the title/description contains a known country, assign a fallback coordinate.

Add this helper BEFORE the Groq call in geo-events.js, and use it as fallback for events where Groq doesn't find coordinates:

```js
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
```

After Groq returns events, for any event where `lat === 0 && lng === 0` or lat/lng are missing, call `assignFallbackGeo(event.titleKo + ' ' + event.titleEn)` to assign coordinates.

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -30
```

Fix TypeScript errors. Commit:
`feat: 자동 종합 브리핑 시스템 + 실시간 브레이킹 뉴스 + 이란 지역 지원`

Then run:
```
openclaw system event --text "Done: Auto-briefing system and breaking news complete" --mode now
```
