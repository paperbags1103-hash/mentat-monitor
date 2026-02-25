/**
 * Signal Fusion Engine — Mentat Monitor Insight Layer
 *
 * Algorithm:
 *  1. Recency decay (6h half-life)
 *  2. Entity grouping + 1-hop graph propagation
 *  3. Per-entity fusion: max+avg blend → convergence amplification
 *  4. Cross-validation boost (news confirmed by market/factual)
 *  5. Weak signal accumulation
 *  6. Direction majority vote
 *  7. Global risk aggregation
 */

import type { NormalizedSignal, FusedEntitySignal, FusionResult, SignalDirection, SignalSource } from './types.js';
import type { EntityGraph } from './entity-graph.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const HALF_LIFE_MS = 6 * 3600_000;           // 6 hours
const CONVERGENCE_THRESHOLD = 3;              // distinct sources to amplify
const MAX_CONVERGENCE_MULT = 2.0;
const CROSS_VALIDATION_BOOST_STEP = 0.12;    // per confirmed source pair
const PROPAGATION_WEIGHT_FACTOR = 0.60;      // strength reduction per hop
const MIN_PROPAGATION_EDGE_WEIGHT = 0.45;    // only follow strong edges
const WEAK_SIGNAL_FLOOR = 25;               // individual threshold
const WEAK_SIGNAL_ACCUMULATED = 60;          // combined threshold

// ─── Recency decay ────────────────────────────────────────────────────────────

function applyDecay(strength: number, signalTime: number, now: number): number {
  const age = Math.max(0, now - signalTime);
  return strength * Math.pow(0.5, age / HALF_LIFE_MS);
}

// ─── Direction vote ───────────────────────────────────────────────────────────

function computeDirection(signals: NormalizedSignal[]): SignalDirection {
  const votes: Record<SignalDirection, number> = { risk_on: 0, risk_off: 0, neutral: 0, ambiguous: 0 };
  for (const s of signals) {
    votes[s.direction] += s.strength * s.confidence;
  }
  const sorted = (Object.entries(votes) as Array<[SignalDirection, number]>).sort((a, b) => b[1] - a[1]);
  if (!sorted[0] || sorted[0][1] === 0) return 'neutral';
  if (sorted[1] && sorted[0][1] > sorted[1][1] * 1.4) return sorted[0][0];
  return sorted[0][0];
}

// ─── Source categorization for cross-validation ───────────────────────────────

function isNewsSource(s: SignalSource): boolean {
  return s.startsWith('blackswan:') || s === 'event_tagger' || s === 'pattern_matcher';
}

function isMarketSource(s: SignalSource): boolean {
  return s === 'market_data' || s === 'blackswan:financial' || s === 'impact_score';
}

function isFactualSource(s: SignalSource): boolean {
  return s === 'vip_aircraft' || s === 'convergence_zone' || s === 'economic_calendar';
}

// ─── Main fusion ──────────────────────────────────────────────────────────────

export function fuseSignals(
  rawSignals: NormalizedSignal[],
  graph: EntityGraph,
  now = Date.now(),
): FusionResult {

  // Step 1: Apply recency decay
  const decayed = rawSignals.map(s => ({
    ...s,
    strength: applyDecay(s.strength, s.timestamp, now),
  }));

  // Step 2: Build entity → signals map, with 1-hop propagation
  const entityMap = new Map<string, NormalizedSignal[]>();

  const addToEntity = (eid: string, signal: NormalizedSignal) => {
    if (!entityMap.has(eid)) entityMap.set(eid, []);
    entityMap.get(eid)!.push(signal);
  };

  for (const signal of decayed) {
    // Direct assignment
    for (const eid of signal.affectedEntityIds) {
      addToEntity(eid, signal);
    }

    // 1-hop propagation via entity graph
    for (const eid of signal.affectedEntityIds) {
      const neighbors = graph.getNeighbors(eid, ['affects', 'belongs_to_sector', 'supply_chain_dependency']);
      for (const { entityId: neighborId, edge } of neighbors) {
        if (edge.weight < MIN_PROPAGATION_EDGE_WEIGHT) continue;
        if (signal.affectedEntityIds.includes(neighborId)) continue; // already direct

        const propagated: NormalizedSignal = {
          ...signal,
          id: `${signal.id}:prop:${neighborId}`,
          strength: signal.strength * edge.weight * PROPAGATION_WEIGHT_FACTOR,
          affectedEntityIds: [neighborId],
        };
        addToEntity(neighborId, propagated);
      }
    }
  }

  // Step 3: Per-entity fusion
  const entitySignals: FusedEntitySignal[] = [];

  for (const [entityId, signals] of entityMap) {
    if (signals.length === 0) continue;

    // Dedup by source — keep strongest per source
    const bySource = new Map<SignalSource, NormalizedSignal>();
    for (const s of signals) {
      const existing = bySource.get(s.source);
      if (!existing || s.strength > existing.strength) {
        bySource.set(s.source, s);
      }
    }
    const deduped = [...bySource.values()];
    const uniqueSources = [...bySource.keys()];

    // Base strength: max×0.6 + avg×0.4
    const maxStrength = Math.max(...deduped.map(s => s.strength));
    const avgStrength = deduped.reduce((a, s) => a + s.strength, 0) / deduped.length;
    let fusedStrength = maxStrength * 0.6 + avgStrength * 0.4;

    // Convergence amplification: 3+ distinct sources
    let convergenceMultiplier = 1.0;
    if (uniqueSources.length >= CONVERGENCE_THRESHOLD) {
      convergenceMultiplier = Math.min(
        MAX_CONVERGENCE_MULT,
        1 + (uniqueSources.length - CONVERGENCE_THRESHOLD + 1) * 0.25,
      );
      fusedStrength *= convergenceMultiplier;
    }

    // Cross-validation boost
    const hasNews = uniqueSources.some(isNewsSource);
    const hasMarket = uniqueSources.some(isMarketSource);
    const hasFactual = uniqueSources.some(isFactualSource);
    let crossBoost = 0;
    if (hasNews && hasMarket) crossBoost += CROSS_VALIDATION_BOOST_STEP;
    if (hasNews && hasFactual) crossBoost += CROSS_VALIDATION_BOOST_STEP;
    if (hasMarket && hasFactual) crossBoost += CROSS_VALIDATION_BOOST_STEP;
    // Apply as additive strength boost (max +15)
    fusedStrength += Math.min(15, crossBoost * fusedStrength);

    // Weak signal accumulation
    const weakSignals = deduped.filter(s => s.strength < WEAK_SIGNAL_FLOOR);
    if (weakSignals.length >= 3) {
      const accumulated = weakSignals.reduce((a, s) => a + s.strength, 0);
      if (accumulated >= WEAK_SIGNAL_ACCUMULATED) {
        fusedStrength = Math.max(fusedStrength, WEAK_SIGNAL_ACCUMULATED * 0.9);
      }
    }

    fusedStrength = Math.min(100, Math.max(0, fusedStrength));

    const fusedDirection = computeDirection(deduped);
    const dominantSources = uniqueSources.slice(0, 3);

    entitySignals.push({
      entityId,
      signals: deduped,
      fusedStrength,
      fusedDirection,
      convergenceMultiplier,
      signalCount: deduped.length,
      dominantSources,
    });
  }

  // Sort by fusedStrength descending
  entitySignals.sort((a, b) => b.fusedStrength - a.fusedStrength);

  // Global risk level: weighted top-N
  const topN = Math.min(8, entitySignals.length);
  const globalRiskLevel = topN > 0
    ? entitySignals.slice(0, topN).reduce((s, e, i) => s + e.fusedStrength * (topN - i), 0)
      / Array.from({ length: topN }, (_, i) => topN - i).reduce((a, b) => a + b, 0)
    : 0;

  // Active convergence zones
  const activeConvergenceZones = entitySignals
    .filter(e => {
      const entity = graph.getEntity(e.entityId);
      return entity?.type === 'region' && e.convergenceMultiplier > 1.0;
    })
    .map(e => e.entityId);

  return {
    timestamp: now,
    entitySignals,
    globalRiskLevel: Math.round(Math.min(100, globalRiskLevel)),
    activeConvergenceZones,
  };
}

// ─── Helpers for inference engine ─────────────────────────────────────────────

export function getEntitySignal(fusion: FusionResult, entityId: string): FusedEntitySignal | undefined {
  return fusion.entitySignals.find(e => e.entityId === entityId);
}

export function getEntityStrength(fusion: FusionResult, entityId: string): number {
  return getEntitySignal(fusion, entityId)?.fusedStrength ?? 0;
}
