/**
 * Inference Engine — runs rules against fusion result, deduplicates
 */

import type { InferenceResult, InferenceContext, FusionResult } from './types.js';
import type { EntityGraph } from './entity-graph.js';
import { INFERENCE_RULES } from './inference-rules.js';

const SEVERITY_ORDER = { CRITICAL: 0, ELEVATED: 1, WATCH: 2, INFO: 3 };
const MAX_CRITICAL = 2;     // cap to prevent flooding
const DEDUP_TTL_MS = 4 * 3600_000; // same rule won't re-fire within 4h

// Simple in-memory fire history (sessionStorage-like)
const _firedAt = new Map<string, number>();

function canFire(ruleId: string, now: number): boolean {
  const last = _firedAt.get(ruleId);
  return !last || now - last > DEDUP_TTL_MS;
}

export function runInference(
  fusion: FusionResult,
  ctx: InferenceContext,
  graph: EntityGraph,
): InferenceResult[] {
  const now = Date.now();
  const results: InferenceResult[] = [];
  const firedPrimaryEntities = new Set<string>();
  let criticalCount = 0;

  // Sort rules by priority (lower = higher priority)
  const sortedRules = [...INFERENCE_RULES].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    // TTL dedup
    if (!canFire(rule.id, now)) continue;

    // Primary entity dedup: if a higher-priority rule already fired for same entity, skip
    if (rule.primaryEntityId && firedPrimaryEntities.has(rule.primaryEntityId)) continue;

    // CRITICAL cap
    if (criticalCount >= MAX_CRITICAL) {
      // Still allow WATCH and INFO
      try {
        const result = rule.evaluate(fusion, ctx, graph);
        if (result && result.severity !== 'CRITICAL') {
          results.push(result);
          if (rule.primaryEntityId) firedPrimaryEntities.add(rule.primaryEntityId);
          _firedAt.set(rule.id, now);
        }
      } catch (e) {
        console.error(`[insight] Rule ${rule.id} failed:`, e);
      }
      continue;
    }

    try {
      const result = rule.evaluate(fusion, ctx, graph);
      if (result) {
        results.push(result);
        if (rule.primaryEntityId) firedPrimaryEntities.add(rule.primaryEntityId);
        _firedAt.set(rule.id, now);
        if (result.severity === 'CRITICAL') criticalCount++;
      }
    } catch (e) {
      console.error(`[insight] Rule ${rule.id} failed:`, e);
    }
  }

  // Sort: severity first, then confidence
  results.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (b.confidence - a.confidence)
  );

  return results;
}

/** Synthesize meta-rule when 3+ CRITICAL rules want to fire */
export function synthesizeCrisisRule(fired: InferenceResult[]): InferenceResult {
  const criticals = fired.filter(r => r.severity === 'CRITICAL');
  const allEntities = [...new Set(criticals.flatMap(r => r.affectedEntityIds))];
  return {
    ruleId: 'SYSTEMIC_CRISIS',
    severity: 'CRITICAL',
    titleKo: '🚨 시스테믹 복합 위기 감지',
    summaryKo: `${criticals.length}개 분야에서 동시 위기 신호 감지: ${criticals.map(r => r.titleKo).join(' | ')}`,
    affectedEntityIds: allEntities.slice(0, 8),
    suggestedActionKo: '즉시 방어 포지션 전환. 현금 50%+, 금·달러 헤지. 모든 레버리지 제거.',
    expectedImpact: { kospiRange: [-5, -15], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:US10Y', 'asset:USDJPY'] },
    confidence: 0.90,
    triggerSignals: criticals.flatMap(r => r.triggerSignals).slice(0, 20),
  };
}
