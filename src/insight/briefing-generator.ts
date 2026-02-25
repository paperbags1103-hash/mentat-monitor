/**
 * Briefing Generator — Orchestrates all insight layer steps
 * gather → normalize → fuse → infer → narrate → InsightBriefing
 */

import type { InsightBriefing, NormalizedSignal, InferenceContext, InferenceSeverity } from './types.js';
import { getEntityGraph } from './entity-graph.js';
import { fuseSignals } from './fusion.js';
import { runInference } from './inference-engine.js';
import { INFERENCE_RULES } from './inference-rules.js';
import { generateNarrative } from './narrative.js';

import { normalizeBlackSwan } from './normalizers/blackswan.js';
import { normalizeVipAircraft } from './normalizers/vip-aircraft.js';
import { normalizeConvergence } from './normalizers/convergence.js';
import { normalizeMarketData } from './normalizers/market-data.js';
import { normalizeEconomicCalendar } from './normalizers/economic-calendar.js';
import { normalizeAggregatedImpact } from './normalizers/impact-scoring.js';
import { normalizePatternAnalysis } from './normalizers/pattern-matcher.js';

export interface BriefingOptions {
  baseUrl?: string;
  groqApiKey?: string;
  rawData?: {
    blackSwan?: unknown;
    vipAircraft?: unknown;
    convergence?: unknown;
    koreanMarket?: unknown;
    economicCalendar?: unknown;
    aggregatedImpact?: unknown;
    patternAnalysis?: unknown;
  };
}

const RISK_LABELS: Array<{ min: number; label: string }> = [
  { min: 80, label: '위기' },
  { min: 60, label: '심각' },
  { min: 40, label: '경계' },
  { min: 20, label: '주의' },
  { min: 0,  label: '안정' },
];

function getRiskLabel(score: number): string {
  return RISK_LABELS.find(l => score >= l.min)?.label ?? '안정';
}

/** Safely access value from a settled promise result */
function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export async function generateBriefing(options: BriefingOptions = {}): Promise<InsightBriefing> {
  const start = Date.now();
  const staleWarnings: string[] = [];
  const signals: NormalizedSignal[] = [];

  const graph = getEntityGraph();

  // ── Gather data ─────────────────────────────────────────────────────────────

  type Raw = unknown;
  let allResults: Array<PromiseSettledResult<Raw>>;

  if (options.rawData) {
    allResults = [
      { status: 'fulfilled', value: options.rawData.blackSwan ?? null },
      { status: 'fulfilled', value: options.rawData.vipAircraft ?? null },
      { status: 'fulfilled', value: options.rawData.convergence ?? null },
      { status: 'fulfilled', value: options.rawData.koreanMarket ?? null },
      { status: 'fulfilled', value: options.rawData.economicCalendar ?? null },
      { status: 'fulfilled', value: options.rawData.aggregatedImpact ?? null },
      { status: 'fulfilled', value: options.rawData.patternAnalysis ?? null },
    ] as Array<PromiseSettledResult<Raw>>;
  } else {
    const base = options.baseUrl ?? '';
    const fetchJson = async (url: string, timeout = 8000): Promise<Raw> => {
      const res = await fetch(base + url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.json() as Promise<Raw>;
    };

    allResults = await Promise.allSettled([
      fetchJson('/api/blackswan'),
      fetchJson('/api/vip-aircraft', 5000),
      fetchJson('/api/convergence', 5000),
      fetchJson('/api/korea-market', 5000),
      fetchJson('/api/economic-calendar', 5000),
      Promise.resolve(null), // aggregatedImpact (client-side)
      Promise.resolve(null), // patternAnalysis (client-side)
    ]);
  }

  const bsData   = allResults[0] ? settled(allResults[0]) : null;
  const vipData  = allResults[1] ? settled(allResults[1]) : null;
  const convData = allResults[2] ? settled(allResults[2]) : null;
  const mktData  = allResults[3] ? settled(allResults[3]) : null;
  const calData  = allResults[4] ? settled(allResults[4]) : null;
  const impData  = allResults[5] ? settled(allResults[5]) : null;
  const patData  = allResults[6] ? settled(allResults[6]) : null;

  if (!bsData)  staleWarnings.push('블랙스완 데이터 수집 실패');
  if (!vipData) staleWarnings.push('VIP 항공기 데이터 수집 실패');
  if (!mktData) staleWarnings.push('시장 데이터 수집 실패');

  // ── Normalize ────────────────────────────────────────────────────────────────

  const tryNormalize = <T>(name: string, data: unknown, fn: (d: T) => NormalizedSignal[]) => {
    if (!data) return;
    try { signals.push(...fn(data as T)); }
    catch (e) { staleWarnings.push(`${name} 정규화 실패: ${(e as Error).message}`); }
  };

  type BS  = Parameters<typeof normalizeBlackSwan>[0];
  type VIP = Parameters<typeof normalizeVipAircraft>[0];
  type CV  = Parameters<typeof normalizeConvergence>[0];
  type MKT = Parameters<typeof normalizeMarketData>[0];
  type CAL = Parameters<typeof normalizeEconomicCalendar>[0];
  type IMP = Parameters<typeof normalizeAggregatedImpact>[0];
  type PAT = Parameters<typeof normalizePatternAnalysis>[0];

  tryNormalize<BS> ('blackswan',    bsData,  normalizeBlackSwan);
  tryNormalize<VIP>('vip-aircraft', vipData, normalizeVipAircraft);
  tryNormalize<CV> ('convergence',  convData, normalizeConvergence);
  tryNormalize<MKT>('market-data',  mktData,  normalizeMarketData);
  tryNormalize<CAL>('calendar',     calData,  normalizeEconomicCalendar);
  if (impData) tryNormalize<IMP>('impact', impData,
    (d) => normalizeAggregatedImpact(d, Date.now()));
  if (patData) tryNormalize<PAT>('pattern', patData,
    (d) => normalizePatternAnalysis(d, Date.now()));

  // ── Fuse ─────────────────────────────────────────────────────────────────────

  const fusion = fuseSignals(signals, graph);

  // ── Build inference context ───────────────────────────────────────────────────

  interface BsTyped { tailRiskScore?: number }
  interface VipTyped { aircraft?: Array<{ onGround: boolean; label: string }> }
  interface MktTyped { kimchiPremium?: number }
  interface CalTyped { events?: Array<{ title: string; daysUntil: number }> }

  const ctx: InferenceContext = {
    tailRiskScore: (bsData as BsTyped | null)?.tailRiskScore ?? 0,
    vipAircraftActive: ((vipData as VipTyped | null)?.aircraft ?? [])
      .filter(a => !a.onGround).map(a => a.label),
    economicCalendar: ((calData as CalTyped | null)?.events ?? [])
      .map(e => ({ event: e.title, daysUntil: e.daysUntil })),
    kimchiPremium: (mktData as MktTyped | null)?.kimchiPremium,
    fusion,
  };

  // ── Infer ─────────────────────────────────────────────────────────────────────

  const inferences = runInference(fusion, ctx, graph);

  // ── Risk score ────────────────────────────────────────────────────────────────

  const bySeverity = inferences.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<InferenceSeverity, number>);

  const severityBonus = (bySeverity.CRITICAL ?? 0) * 20
    + (bySeverity.ELEVATED ?? 0) * 10
    + (bySeverity.WATCH ?? 0) * 5;
  const globalRiskScore = Math.min(100, Math.round(fusion.globalRiskLevel * 0.7 + Math.min(30, severityBonus) * 0.3));
  const riskLabel = getRiskLabel(globalRiskScore);

  // ── Narrative ─────────────────────────────────────────────────────────────────

  const { text: narrativeKo, method: narrativeMethod } = await generateNarrative(
    fusion, inferences, globalRiskScore, riskLabel,
    (id: string) => graph.getEntityKo(id),
    options.groqApiKey,
  );

  // ── Assemble ──────────────────────────────────────────────────────────────────

  const topEntities = fusion.entitySignals.slice(0, 5).map(e => ({
    entityId: e.entityId,
    nameKo: graph.getEntityKo(e.entityId),
    fusedStrength: Math.round(e.fusedStrength),
  }));

  const kospiSignal = fusion.entitySignals.find(e => e.entityId === 'asset:KS11');
  const hedgeSuggestions = [...new Set(
    inferences.flatMap(i => i.expectedImpact?.safeHavens ?? [])
      .map(id => graph.getEntityKo(id)).filter(Boolean)
  )].slice(0, 3);

  return {
    generatedAt: Date.now(),
    globalRiskScore,
    riskLabel,
    topInferences: inferences.slice(0, 5),
    narrativeKo,
    narrativeMethod,
    signalSummary: {
      total: signals.length,
      bySeverity: { CRITICAL: bySeverity.CRITICAL ?? 0, ELEVATED: bySeverity.ELEVATED ?? 0, WATCH: bySeverity.WATCH ?? 0, INFO: bySeverity.INFO ?? 0 },
      topEntities,
    },
    marketOutlook: {
      kospiSentiment: kospiSignal?.fusedDirection ?? 'neutral',
      keyRisks: inferences.filter(i => i.severity !== 'INFO').map(i => i.titleKo).slice(0, 3),
      keyOpportunities: inferences
        .filter(i => (i.expectedImpact?.kospiRange?.[1] ?? 0) > 0)
        .map(i => i.suggestedActionKo).slice(0, 2),
      hedgeSuggestions,
    },
    staleWarnings,
    _meta: {
      processingMs: Date.now() - start,
      signalCount: signals.length,
      rulesEvaluated: INFERENCE_RULES.length,
    },
  };
}
