/**
 * /api/insight-briefing
 *
 * Insight Layer API — Mentat Monitor Phase 4
 *
 * Orchestrates: all signal sources → normalize → fuse → infer → narrate
 * Returns: InsightBriefing (Korean investment briefing with risk score)
 *
 * Cache: 5 minutes (briefing is expensive to generate)
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 5 * 60_000;
let cache = null;
let cacheTs = 0;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson(url, timeoutMs = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function getBase(req) {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

// ─── Normalizers (JS versions, minimal for edge runtime) ─────────────────────

function normalizeBlackSwan(data) {
  const signals = [];
  const ts = data.timestamp || Date.now();

  const modules = [
    { key: 'financial',    src: 'blackswan:financial',    entities: ['asset:KS11', 'asset:SPX', 'asset:VIX', 'asset:USDKRW'], conf: 0.85, thresh: 15 },
    { key: 'pandemic',     src: 'blackswan:pandemic',     entities: ['event:pandemic', 'sector:bio_pharma', 'asset:KS11'], conf: 0.55, thresh: 20 },
    { key: 'nuclear',      src: 'blackswan:nuclear',      entities: ['event:nk_nuclear', 'region:korean_peninsula', 'asset:KS11', 'sector:defense', 'asset:GOLD'], conf: 0.60, thresh: 15 },
    { key: 'cyber',        src: 'blackswan:cyber',        entities: ['sector:cybersecurity', 'sector:finance'], conf: 0.55, thresh: 20 },
    { key: 'geopolitical', src: 'blackswan:geopolitical', entities: ['asset:KS11', 'asset:GOLD', 'asset:OIL', 'asset:USDKRW'], conf: 0.50, thresh: 15 },
    { key: 'supplyChain',  src: 'blackswan:supply_chain', entities: ['sector:shipping', 'sector:semiconductor', 'asset:KS11'], conf: 0.70, thresh: 20 },
  ];

  for (const mod of modules) {
    const m = data.modules?.[mod.key];
    if (!m || m.score < mod.thresh) continue;
    signals.push({
      id: `${mod.src}:${ts}`,
      source: mod.src,
      strength: m.score,
      direction: m.score > 50 ? 'risk_off' : 'neutral',
      affectedEntityIds: mod.entities,
      confidence: mod.conf,
      timestamp: ts,
      headlineKo: `${mod.key} 모듈 ${m.score}/100`,
    });
  }
  return signals;
}

function normalizeVipAircraft(data) {
  return (data.aircraft || [])
    .filter(a => !a.onGround && a.lat != null)
    .map(a => {
      const isCommand = a.category === 'military_command';
      const nearKorea = a.lat > 33 && a.lat < 43 && a.lng > 124 && a.lng < 132;
      return {
        id: `vip_aircraft:${a.icao24}:${data.timestamp}`,
        source: 'vip_aircraft',
        strength: isCommand ? (nearKorea ? 95 : 75) : (nearKorea ? 60 : 40),
        direction: 'risk_off',
        affectedEntityIds: [
          ...(isCommand ? ['event:nk_nuclear'] : []),
          ...(nearKorea ? ['region:korean_peninsula', 'asset:KS11', 'asset:USDKRW'] : ['region:east_asia']),
        ],
        confidence: 0.90,
        timestamp: data.timestamp,
        headlineKo: `${a.label} 비행 감지 (${a.category})`,
      };
    });
}

function normalizeMarketData(data) {
  const signals = [];
  const ts = data.timestamp || Date.now();

  if (data.kospi?.changePercent && Math.abs(data.kospi.changePercent) > 1.5) {
    const chg = data.kospi.changePercent;
    signals.push({
      id: `market_data:kospi:${ts}`,
      source: 'market_data',
      strength: Math.min(80, Math.abs(chg) * 15),
      direction: chg < 0 ? 'risk_off' : 'risk_on',
      affectedEntityIds: ['asset:KS11', 'country:south_korea'],
      confidence: 0.95,
      timestamp: ts,
      headlineKo: `코스피 ${chg > 0 ? '+' : ''}${chg.toFixed(2)}%`,
    });
  }
  if (data.usdkrw?.changePercent && Math.abs(data.usdkrw.changePercent) > 1.0) {
    const chg = data.usdkrw.changePercent;
    signals.push({
      id: `market_data:usdkrw:${ts}`,
      source: 'market_data',
      strength: Math.min(75, Math.abs(chg) * 18),
      direction: chg > 0 ? 'risk_off' : 'risk_on',
      affectedEntityIds: ['asset:USDKRW', 'asset:KS11'],
      confidence: 0.95,
      timestamp: ts,
      headlineKo: `원달러 ${chg > 0 ? '+' : ''}${chg.toFixed(2)}%`,
    });
  }
  if (data.kimchiPremium != null && Math.abs(data.kimchiPremium) > 3) {
    signals.push({
      id: `market_data:kimchi:${ts}`,
      source: 'market_data',
      strength: Math.min(65, Math.abs(data.kimchiPremium) * 8),
      direction: data.kimchiPremium > 0 ? 'risk_on' : 'risk_off',
      affectedEntityIds: ['asset:BTC', 'asset:KS11'],
      confidence: 0.80,
      timestamp: ts,
      headlineKo: `김치 프리미엄 ${data.kimchiPremium > 0 ? '+' : ''}${data.kimchiPremium.toFixed(1)}%`,
      raw: { kimchiPremium: data.kimchiPremium },
    });
  }
  return signals;
}

function normalizeCalendar(data) {
  const signals = [];
  const ts = Date.now();
  for (const event of (data.events || [])) {
    const days = event.daysUntil ?? 99;
    const strength = days === 0 ? 65 : days === 1 ? 50 : days <= 3 ? 35 : 0;
    if (!strength) continue;
    const inst = (event.institution || '').toUpperCase();
    const entities = inst === 'FOMC'
      ? ['inst:fed', 'asset:USDKRW', 'asset:KS11', 'asset:US10Y']
      : inst === 'BOK'
        ? ['inst:bok', 'asset:USDKRW', 'asset:KS11']
        : ['asset:KS11'];
    signals.push({
      id: `economic_calendar:${inst}:${ts}`,
      source: 'economic_calendar',
      strength,
      direction: 'neutral',
      affectedEntityIds: entities,
      confidence: 0.90,
      timestamp: ts,
      headlineKo: `${event.title} — ${days === 0 ? '오늘' : `${days}일 후`}`,
    });
  }
  return signals;
}

// ─── Lightweight fusion (no graph for edge runtime) ───────────────────────────

function fuseSignals(signals) {
  const now = Date.now();
  const HALF_LIFE = 6 * 3600_000;
  const entityMap = new Map();

  for (const s of signals) {
    const age = Math.max(0, now - s.timestamp);
    const decayedStrength = s.strength * Math.pow(0.5, age / HALF_LIFE);

    for (const eid of s.affectedEntityIds) {
      if (!entityMap.has(eid)) entityMap.set(eid, []);
      entityMap.get(eid).push({ ...s, strength: decayedStrength });
    }
  }

  const entitySignals = [];
  for (const [entityId, sigs] of entityMap) {
    // Dedup by source
    const bySource = new Map();
    for (const s of sigs) {
      if (!bySource.has(s.source) || s.strength > bySource.get(s.source).strength) {
        bySource.set(s.source, s);
      }
    }
    const deduped = [...bySource.values()];
    const max = Math.max(...deduped.map(s => s.strength));
    const avg = deduped.reduce((a, s) => a + s.strength, 0) / deduped.length;
    let fusedStrength = max * 0.6 + avg * 0.4;

    // Convergence amplification
    const convergenceMultiplier = deduped.length >= 3
      ? Math.min(2.0, 1 + (deduped.length - 2) * 0.25)
      : 1.0;
    fusedStrength = Math.min(100, fusedStrength * convergenceMultiplier);

    // Direction vote
    const votes = { risk_on: 0, risk_off: 0, neutral: 0, ambiguous: 0 };
    for (const s of deduped) votes[s.direction] += s.strength * s.confidence;
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const fusedDirection = top[0][1] > top[1][1] * 1.4 ? top[0][0] : 'ambiguous';

    entitySignals.push({ entityId, signals: deduped, fusedStrength, fusedDirection, convergenceMultiplier, signalCount: deduped.length });
  }

  entitySignals.sort((a, b) => b.fusedStrength - a.fusedStrength);

  const top8 = entitySignals.slice(0, 8);
  const globalRiskLevel = top8.length > 0
    ? top8.reduce((s, e, i) => s + e.fusedStrength * (8 - i), 0) / top8.reduce((s, _, i) => s + (8 - i), 0)
    : 0;

  const activeConvergenceZones = entitySignals
    .filter(e => e.entityId.startsWith('region:') && e.convergenceMultiplier > 1.0)
    .map(e => e.entityId);

  return { entitySignals, globalRiskLevel: Math.round(Math.min(100, globalRiskLevel)), activeConvergenceZones };
}

// ─── Inference (simplified JS version) ───────────────────────────────────────

const REGION_NAMES = {
  'region:korean_peninsula': '한반도',
  'region:taiwan_strait': '대만해협',
  'region:middle_east': '중동',
  'region:europe': '유럽',
  'region:east_asia': '동아시아',
};

function getStrength(entitySignals, entityId) {
  return entitySignals.find(e => e.entityId === entityId)?.fusedStrength ?? 0;
}

function runInference(fusion, ctx) {
  const results = [];
  const { entitySignals, globalRiskLevel, activeConvergenceZones } = fusion;
  const ent = (id) => getStrength(entitySignals, id);

  // NK Compound Crisis
  const hasCommand = ctx.vipAircraftActive.some(a => /nightwatch|e-4b|e-6b|tacamo/i.test(a));
  if (ent('region:korean_peninsula') >= 60 && hasCommand) {
    results.push({
      ruleId: 'NK_COMPOUND_CRISIS', severity: 'CRITICAL',
      titleKo: '🚨 복합 지정학-군사 위협 감지',
      summaryKo: `한반도 복합 신호(${ent('region:korean_peninsula').toFixed(0)}/100)와 미 핵지휘기 비행 동시 감지. 2017년 북핵 위기와 유사.`,
      affectedEntityIds: ['region:korean_peninsula', 'asset:KS11', 'asset:USDKRW', 'sector:defense', 'asset:GOLD'],
      suggestedActionKo: '코스피 비중 긴급 축소. 방산주(한화에어로/KAI) 주목. 달러·금 헤지 강화.',
      expectedImpact: { kospiRange: [-3, -7], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:USDJPY'] },
      confidence: 0.85, triggerSignals: [],
    });
  }

  // NK Provocation
  if (!results.find(r => r.ruleId === 'NK_COMPOUND_CRISIS') && (ent('country:north_korea') >= 35 || ent('region:korean_peninsula') >= 30)) {
    const s = Math.max(ent('country:north_korea'), ent('region:korean_peninsula'));
    results.push({
      ruleId: 'NK_PROVOCATION', severity: s >= 65 ? 'ELEVATED' : 'WATCH',
      titleKo: '⚠️ 북한 도발 신호 감지',
      summaryKo: `북한 위협 신호(${s.toFixed(0)}/100). 반복 도발로 시장 내성 형성, 단기 -1~-3% 가능.`,
      affectedEntityIds: ['country:north_korea', 'asset:KS11', 'asset:USDKRW', 'sector:defense'],
      suggestedActionKo: '방산주 단기 주목. 1주일 내 반등 패턴 대기.',
      expectedImpact: { kospiRange: [-1, -3], krwDirection: 'weaken', safeHavens: ['asset:GOLD'] },
      confidence: 0.70, triggerSignals: [],
    });
  }

  // Taiwan Crisis
  if (ent('region:taiwan_strait') >= 45) {
    results.push({
      ruleId: 'TAIWAN_CRISIS', severity: ent('region:taiwan_strait') > 75 ? 'CRITICAL' : 'ELEVATED',
      titleKo: '🇹🇼 대만해협 긴장 고조',
      summaryKo: `대만해협 신호(${ent('region:taiwan_strait').toFixed(0)}/100). TSMC·삼성·하이닉스 공급망 차질 위험.`,
      affectedEntityIds: ['region:taiwan_strait', 'sector:semiconductor', 'company:tsmc', 'company:samsung_elec', 'asset:KS11'],
      suggestedActionKo: '반도체 섹터 변동성 확대. 포지션 축소 후 관망.',
      expectedImpact: { kospiRange: [-2, -6], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:US10Y'] },
      confidence: 0.70, triggerSignals: [],
    });
  }

  // Financial Stress
  if (ctx.tailRiskScore >= 55 || ent('asset:VIX') >= 60) {
    results.push({
      ruleId: 'FINANCIAL_STRESS', severity: ctx.tailRiskScore >= 80 ? 'CRITICAL' : 'ELEVATED',
      titleKo: '📉 글로벌 금융 스트레스 경보',
      summaryKo: `테일리스크 지수 ${ctx.tailRiskScore}/100. VIX 급등 및 복합 금융 스트레스 신호.`,
      affectedEntityIds: ['asset:VIX', 'asset:KS11', 'asset:KQ11', 'asset:SPX', 'asset:BTC'],
      suggestedActionKo: '현금 비중 확대. 레버리지·코스닥·암호화폐 비중 축소. 미 국채·금 방어 배분.',
      expectedImpact: { kospiRange: [-3, -8], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:US10Y'] },
      confidence: 0.80, triggerSignals: [],
    });
  }

  // Oil Shock
  if (ent('asset:OIL') >= 45 && ent('region:middle_east') >= 25) {
    results.push({
      ruleId: 'OIL_SHOCK', severity: 'ELEVATED',
      titleKo: '🛢️ 원유 공급 충격 위험',
      summaryKo: `중동 긴장(${ent('region:middle_east').toFixed(0)}/100)과 원유 신호 동시 감지. 에너지 수입 의존 한국 경제 압박.`,
      affectedEntityIds: ['asset:OIL', 'sector:energy', 'asset:KS11', 'asset:USDKRW'],
      suggestedActionKo: '에너지주 수혜. 항공·화학 비용 부담. KRW 약세 대비.',
      expectedImpact: { kospiRange: [-1, -4], krwDirection: 'weaken', safeHavens: ['asset:GOLD'] },
      confidence: 0.65, triggerSignals: [],
    });
  }

  // BOK
  const bokEvent = ctx.economicCalendar.find(e => /bok/i.test(e.event) && e.daysUntil >= 0 && e.daysUntil <= 2);
  if (bokEvent) {
    results.push({
      ruleId: 'BOK_RATE_DECISION', severity: 'WATCH',
      titleKo: '🏦 한국은행 금리결정 임박',
      summaryKo: `한국은행 금통위 ${bokEvent.daysUntil === 0 ? '오늘' : `${bokEvent.daysUntil}일 후`} 예정.`,
      affectedEntityIds: ['inst:bok', 'asset:USDKRW', 'asset:KS11'],
      suggestedActionKo: '금리 인하: 건설/부동산 수혜. 인상: 은행주 수혜, 성장주 부담.',
      confidence: 0.60, triggerSignals: [],
    });
  }

  // FOMC
  const fomcEvent = ctx.economicCalendar.find(e => /fomc/i.test(e.event) && e.daysUntil >= 0 && e.daysUntil <= 3);
  if (fomcEvent) {
    results.push({
      ruleId: 'FOMC_UPCOMING', severity: 'WATCH',
      titleKo: '🏛️ FOMC 금리결정 임박',
      summaryKo: `미 연준 FOMC ${fomcEvent.daysUntil}일 후 예정. 원달러 환율 및 외국인 자금 흐름 주목.`,
      affectedEntityIds: ['inst:fed', 'asset:USDKRW', 'asset:KS11', 'asset:US10Y'],
      suggestedActionKo: '인하 시 코스피 외국인 유입. 동결/인상 시 원화 약세 압박.',
      confidence: 0.60, triggerSignals: [],
    });
  }

  // Multi-region convergence
  if (activeConvergenceZones.length >= 2) {
    const zoneNames = activeConvergenceZones.map(id => REGION_NAMES[id] ?? id).join(', ');
    results.push({
      ruleId: 'MULTI_REGION_CONVERGENCE', severity: 'ELEVATED',
      titleKo: '🌍 복수 지역 동시 위기 신호',
      summaryKo: `${zoneNames}에서 동시 복합 신호 수렴. 글로벌 리스크오프 환경.`,
      affectedEntityIds: [...activeConvergenceZones, 'asset:KS11', 'asset:GOLD'],
      suggestedActionKo: '현금+금+달러 방어적 배분. 외국인 순매도 경계.',
      expectedImpact: { kospiRange: [-3, -6], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:US10Y'] },
      confidence: 0.70, triggerSignals: [],
    });
  }

  // Kimchi premium
  if (ctx.kimchiPremium != null && Math.abs(ctx.kimchiPremium) >= 5) {
    const p = ctx.kimchiPremium;
    results.push({
      ruleId: 'KIMCHI_PREMIUM', severity: 'INFO',
      titleKo: `💰 김치 프리미엄 이상 (${p > 0 ? '+' : ''}${p.toFixed(1)}%)`,
      summaryKo: p > 0 ? '개인 암호화폐 수요 과열 신호.' : '암호화폐 투자심리 위축 신호.',
      affectedEntityIds: ['asset:BTC', 'asset:KS11'],
      suggestedActionKo: p > 0 ? '역발상: 고프리미엄 구간 차익실현 고려.' : '저점 탐색 가능, 추세 확인 후 진입.',
      confidence: 0.55, triggerSignals: [],
    });
  }

  // Calm
  if (results.length === 0) {
    results.push({
      ruleId: 'CALM_MARKET', severity: 'INFO',
      titleKo: '✅ 시장 안정 구간',
      summaryKo: '주요 위협 신호 없음. 글로벌 리스크 낮은 수준.',
      affectedEntityIds: ['asset:KS11'],
      suggestedActionKo: '정상적 투자 환경. 펀더멘털 중심 종목 선정.',
      confidence: 0.85, triggerSignals: [],
    });
  }

  const ORDER = { CRITICAL: 0, ELEVATED: 1, WATCH: 2, INFO: 3 };
  return results.sort((a, b) => (ORDER[a.severity] - ORDER[b.severity]) || (b.confidence - a.confidence));
}

// ─── Groq narrative ───────────────────────────────────────────────────────────

async function generateNarrative(inferences, riskScore, riskLabel, groqKey, marketData) {
  if (!groqKey) return buildTemplate(inferences, riskScore, riskLabel);

  const top = inferences.slice(0, 4);

  // 시장 퍼포먼스 요약
  const mkt = marketData || {};
  const fmtPct = (v) => v != null ? `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%` : 'N/A';
  const marketSummary = [
    mkt.kospi    ? `KOSPI ${fmtPct(mkt.kospi.changePercent)}`    : null,
    mkt.kosdaq   ? `KOSDAQ ${fmtPct(mkt.kosdaq.changePercent)}`  : null,
    mkt.spx      ? `S&P500 ${fmtPct(mkt.spx.changePct)}`         : null,
    mkt.nasdaq   ? `나스닥 ${fmtPct(mkt.nasdaq.changePct)}`       : null,
    mkt.vix      ? `VIX ${mkt.vix.price?.toFixed(1)}`             : null,
    mkt.gold     ? `금 ${fmtPct(mkt.gold.changePct)}`             : null,
    mkt.oil      ? `WTI ${fmtPct(mkt.oil.changePct)}`             : null,
    mkt.usdkrw   ? `USD/KRW ${fmtPct(mkt.usdkrw.changePercent)}`  : null,
  ].filter(Boolean).join(' | ');

  const riskContext = top.map((i, n) =>
    `${n + 1}. [${i.severity}] ${i.titleKo}: ${i.summaryKo}`
  ).join('\n');

  const userMsg = `## 현재 시장 데이터
${marketSummary || '데이터 수집 중'}

## 위협 수준: ${riskScore}/100 (${riskLabel})
${riskContext || '주요 위협 없음'}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `당신은 한국 개인투자자를 위한 금융 인텔리전스 분석가입니다.
주어진 시장 데이터와 위협 신호를 바탕으로 다음 JSON 구조로 브리핑하세요.
반드시 유효한 JSON만 반환. 다른 텍스트 없이.

{
  "riskBriefing": "위협 수준과 핵심 리스크 요약 (150자 이내)",
  "moneyFlow": "현재 자금 흐름 분석 — 어느 시장/섹터에 돈이 몰리는지, 이유 포함 (200자 이내)",
  "outlookShort": "단기(~1개월) 전망과 주목할 트레이드 (150자 이내)",
  "outlookMid": "중기(3-6개월) 전망과 포지셔닝 전략 (150자 이내)",
  "outlookLong": "장기(1년+) 구조적 기회와 리스크 (150자 이내)",
  "riskOn": ["리스크 온 환경에서 유리한 자산/섹터 3개"],
  "riskOff": ["리스크 오프 환경에서 유리한 자산/섹터 3개"]
}`,
          },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
      // JSON 파싱 (마크다운 코드블록 제거)
      const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.riskBriefing) {
          return {
            text: parsed.riskBriefing,
            opportunityKo: parsed.moneyFlow ?? '',
            outlookShort: parsed.outlookShort ?? '',
            outlookMid: parsed.outlookMid ?? '',
            outlookLong: parsed.outlookLong ?? '',
            riskOn: parsed.riskOn ?? [],
            riskOff: parsed.riskOff ?? [],
            method: 'llm',
          };
        }
      } catch {}
      // JSON 파싱 실패 시 텍스트 그대로
      if (raw.length > 50) return { text: raw, method: 'llm' };
    }
  } catch {}

  return buildTemplate(inferences, riskScore, riskLabel);
}

function buildTemplate(inferences, riskScore, riskLabel) {
  if (!inferences.length) {
    return { text: `[멘탯 브리핑] 위협 수준 ${riskLabel} (${riskScore}/100) — 주요 위협 없음. 정상 시장.`, method: 'template' };
  }
  const lines = [`[멘탯 브리핑] ${riskLabel} (${riskScore}/100)\n`];
  for (const inf of inferences.slice(0, 3)) {
    lines.push(`▸ ${inf.titleKo}`);
    lines.push(`  ${inf.summaryKo}`);
    lines.push(`  💡 ${inf.suggestedActionKo}\n`);
  }
  return { text: lines.join('\n').trim(), method: 'template' };
}

// ─── Risk label ───────────────────────────────────────────────────────────────

function getRiskLabel(score) {
  if (score >= 80) return '위기';
  if (score >= 60) return '심각';
  if (score >= 40) return '경계';
  if (score >= 20) return '주의';
  return '안정';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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

  const start = now;
  const base = getBase(req);
  const staleWarnings = [];

  // ── Gather all sources in parallel ──────────────────────────────────────────

  const [bsRes, vipRes, mktRes, calRes, macroRes] = await Promise.allSettled([
    fetchJson(`${base}/api/blackswan`),
    fetchJson(`${base}/api/vip-aircraft`, 5000),
    fetchJson(`${base}/api/korea-market`, 5000),
    fetchJson(`${base}/api/economic-calendar`, 5000),
    fetchJson(`${base}/api/global-macro`, 5000),
  ]);

  const bsData    = bsRes.status    === 'fulfilled' ? bsRes.value    : (staleWarnings.push('블랙스완 수집 실패'), null);
  const vipData   = vipRes.status   === 'fulfilled' ? vipRes.value   : (staleWarnings.push('VIP항공기 수집 실패'), null);
  const mktData   = mktRes.status   === 'fulfilled' ? mktRes.value   : (staleWarnings.push('시장데이터 수집 실패'), null);
  const calData   = calRes.status   === 'fulfilled' ? calRes.value   : null;
  const macroData = macroRes.status === 'fulfilled' ? macroRes.value : null;

  // ── Normalize + fuse ─────────────────────────────────────────────────────────

  const signals = [
    ...(bsData  ? normalizeBlackSwan(bsData)    : []),
    ...(vipData ? normalizeVipAircraft(vipData) : []),
    ...(mktData ? normalizeMarketData(mktData)  : []),
    ...(calData ? normalizeCalendar(calData)    : []),
  ];

  const fusion = fuseSignals(signals);

  // ── Inference context ────────────────────────────────────────────────────────

  const ctx = {
    tailRiskScore: bsData?.tailRiskScore ?? 0,
    vipAircraftActive: (vipData?.aircraft ?? []).filter(a => !a.onGround).map(a => a.label),
    economicCalendar: (calData?.events ?? []).map(e => ({ event: e.title, daysUntil: e.daysUntil })),
    kimchiPremium: mktData?.kimchiPremium ?? null,
  };

  // ── Infer ────────────────────────────────────────────────────────────────────

  const inferences = runInference(fusion, ctx);

  // ── Risk score ───────────────────────────────────────────────────────────────

  const severityBonus = inferences.filter(i => i.severity === 'CRITICAL').length * 20
    + inferences.filter(i => i.severity === 'ELEVATED').length * 10
    + inferences.filter(i => i.severity === 'WATCH').length * 5;
  const globalRiskScore = Math.min(100, Math.round(fusion.globalRiskLevel * 0.7 + Math.min(30, severityBonus) * 0.3));
  const riskLabel = getRiskLabel(globalRiskScore);

  // ── Narrative ────────────────────────────────────────────────────────────────

  // 시장 데이터 병합 (korea-market + global-macro)
  const combinedMarket = {
    kospi:   mktData?.kospi ?? null,
    kosdaq:  mktData?.kosdaq ?? null,
    usdkrw:  mktData?.usdkrw ?? null,
    spx:     macroData?.spx ?? null,
    nasdaq:  macroData?.nasdaq ?? null,
    vix:     macroData?.vix ?? null,
    gold:    macroData?.gold ?? null,
    oil:     macroData?.oil ?? null,
  };

  const {
    text: narrativeKo,
    opportunityKo = '',
    outlookShort  = '',
    outlookMid    = '',
    outlookLong   = '',
    riskOn        = [],
    riskOff       = [],
    method: narrativeMethod,
  } = await generateNarrative(inferences, globalRiskScore, riskLabel,
      process.env.GROQ_API_KEY || req.headers.get('x-groq-key') || '', combinedMarket);

  // ── Market outlook ────────────────────────────────────────────────────────────

  const kospiSignal = fusion.entitySignals.find(e => e.entityId === 'asset:KS11');
  const safeHavens = [...new Set(
    inferences.flatMap(i => i.expectedImpact?.safeHavens ?? [])
  )];
  const ENTITY_KO = {
    'asset:GOLD': '금', 'asset:USDJPY': '엔화', 'asset:US10Y': '미국채',
    'asset:DXY': '달러', 'asset:BTC': '비트코인',
  };

  // ── Result ────────────────────────────────────────────────────────────────────

  // ── Fallback 인퍼런스 — 외부 신호 없을 때 기본 제공 ─────────────────────
  const BASELINE_INFERENCES = [
    {
      ruleId: 'BASELINE_MACRO', severity: 'INFO',
      titleKo: '📊 글로벌 매크로 감시 중',
      descriptionKo: '연준 금리 경로, 달러 강세 여부, 중국 부양책이 핵심 변수. KOSPI는 외국인 수급에 민감하게 반응.',
      affectedEntityIds: ['country:usa', 'country:china', 'country:south_korea'],
      affectedAssets: ['asset:KS11', 'asset:USDKRW', 'asset:SPX'],
      expectedImpact: { kospiRange: [0, 0], currency: 'neutral' },
      suggestedActionKo: '포트폴리오 환노출 점검',
      confidence: 0.7, ruleConfidence: 0.7,
    },
    {
      ruleId: 'BASELINE_AI_THEME', severity: 'INFO',
      titleKo: '💡 AI 인프라 투자 사이클 지속',
      descriptionKo: '엔비디아 실적·HBM 수요·전력 인프라 투자가 국내 반도체·전력주 수급에 직접 영향.',
      affectedEntityIds: ['country:south_korea', 'country:usa'],
      affectedAssets: ['sector:semiconductor', 'asset:KS11'],
      expectedImpact: { kospiRange: [1, 3], currency: 'neutral' },
      suggestedActionKo: '삼성전자·SK하이닉스 비중 유지',
      confidence: 0.65, ruleConfidence: 0.65,
    },
    {
      ruleId: 'BASELINE_GEOPOLITICAL', severity: 'WATCH',
      titleKo: '⚠️ 지정학 리스크 상시 경계',
      descriptionKo: '한반도·대만해협·중동 3개 축 모니터링 중. 단기 충격 시 KOSPI -2~-5% 반응 패턴.',
      affectedEntityIds: ['country:north_korea', 'region:korean_peninsula', 'region:taiwan_strait', 'region:middle_east'],
      affectedAssets: ['asset:KS11', 'asset:GOLD', 'asset:USDKRW'],
      expectedImpact: { kospiRange: [-5, -1], currency: 'KRW_WEAK' },
      suggestedActionKo: '금·달러 헤지 비중 5~10% 유지',
      confidence: 0.6, ruleConfidence: 0.6,
    },
  ];
  const finalInferences = inferences.length > 0 ? inferences : BASELINE_INFERENCES;

  const result = {
    generatedAt: now,
    globalRiskScore,
    riskLabel,
    topInferences: finalInferences.slice(0, 5),
    narrativeKo,
    narrativeMethod,
    opportunityKo,
    outlookShort,
    outlookMid,
    outlookLong,
    riskOn,
    riskOff,
    signalSummary: {
      total: signals.length,
      bySeverity: {
        CRITICAL: finalInferences.filter(i => i.severity === 'CRITICAL').length,
        ELEVATED: finalInferences.filter(i => i.severity === 'ELEVATED').length,
        WATCH:    finalInferences.filter(i => i.severity === 'WATCH').length,
        INFO:     finalInferences.filter(i => i.severity === 'INFO').length,
      },
      topEntities: fusion.entitySignals.slice(0, 5).map(e => ({
        entityId: e.entityId,
        nameKo: ENTITY_KO[e.entityId] ?? e.entityId.split(':')[1] ?? e.entityId,
        fusedStrength: Math.round(e.fusedStrength),
      })),
    },
    marketOutlook: {
      kospiSentiment: kospiSignal?.fusedDirection ?? 'neutral',
      keyRisks: finalInferences.filter(i => i.severity !== 'INFO').map(i => i.titleKo).slice(0, 3),
      keyOpportunities: finalInferences
        .filter(i => i.expectedImpact?.kospiRange?.[1] > 0)
        .map(i => i.suggestedActionKo).slice(0, 2),
      hedgeSuggestions: safeHavens.map(id => ENTITY_KO[id] ?? id).filter(Boolean).slice(0, 3),
    },
    staleWarnings,
    _meta: { processingMs: Date.now() - start, signalCount: signals.length },
  };

  cache = result;
  cacheTs = now;

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
  });
}
