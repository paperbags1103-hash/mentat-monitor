import type { NormalizedSignal, SignalDirection } from '../types.js';
import type { EventTag } from '../../services/event-tagger.js';

/** Map event-tagger signal types → entity IDs */
const SIGNAL_TYPE_ENTITY_MAP: Record<string, string[]> = {
  military:       ['sector:defense', 'asset:GOLD', 'asset:KS11'],
  diplomatic:     ['asset:KS11', 'asset:USDKRW'],
  economic:       ['asset:KS11', 'asset:SPX', 'asset:USDKRW'],
  pandemic:       ['event:pandemic', 'sector:bio_pharma', 'asset:KS11'],
  cyber:          ['sector:cybersecurity', 'sector:finance'],
  natural_disaster: ['asset:KS11', 'asset:OIL'],
  political:      ['asset:KS11', 'asset:USDKRW', 'asset:KQ11'],
  energy:         ['asset:OIL', 'sector:energy', 'asset:KS11'],
  financial:      ['asset:KS11', 'asset:VIX', 'asset:GOLD', 'asset:BTC'],
  supply_chain:   ['sector:shipping', 'sector:semiconductor', 'asset:KS11'],
};

/** Map event-tagger regions → entity IDs */
const REGION_ENTITY_MAP: Record<string, string[]> = {
  korea:        ['region:korean_peninsula', 'country:south_korea'],
  asia:         ['region:east_asia'],
  middleeast:   ['region:middle_east'],
  europe:       ['region:europe'],
  global:       [],
};

function impactDirectionToSignalDirection(direction: EventTag['impactDirection']): SignalDirection {
  if (direction === 'bullish') return 'risk_on';
  if (direction === 'bearish') return 'risk_off';
  if (direction === 'neutral') return 'neutral';
  return 'ambiguous';
}

function confidenceToNumber(c: EventTag['confidence']): number {
  return c === 'high' ? 0.85 : c === 'medium' ? 0.65 : 0.45;
}

/** Convert an EventTag to NormalizedSignals (one per event) */
export function normalizeEventTag(tag: EventTag, eventTitle: string, timestamp: number): NormalizedSignal {
  const typeEntities = SIGNAL_TYPE_ENTITY_MAP[tag.signalType] ?? [];
  const regionEntities = REGION_ENTITY_MAP[tag.region] ?? [];

  // Map related assets from event-tagger to entity IDs
  const assetEntityMap = (a: string): string | undefined => {
    if (a === '^KS11') return 'asset:KS11';
    if (a === 'KRW=X') return 'asset:USDKRW';
    if (a === 'GC=F' || a === 'GLD') return 'asset:GOLD';
    if (a === 'CL=F' || a === 'WTI') return 'asset:OIL';
    if (a === '^VIX') return 'asset:VIX';
    if (a === 'BTC-USD' || a === 'BTC-KRW') return 'asset:BTC';
    if (a.includes('KS')) return 'asset:KS11';
    return undefined;
  };
  const assetEntities = tag.relatedAssets
    .map(assetEntityMap)
    .filter((id): id is string => id !== undefined);

  const allEntities = [...new Set([...typeEntities, ...regionEntities, ...assetEntities])];

  // Strength: impactScore (1-5) × 18 → 18-90, clamp 0-100
  const strength = Math.min(100, Math.max(0, tag.impactScore * 18));

  return {
    id: `event_tagger:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    source: 'event_tagger',
    strength,
    direction: impactDirectionToSignalDirection(tag.impactDirection),
    affectedEntityIds: allEntities,
    confidence: confidenceToNumber(tag.confidence),
    timestamp,
    headlineKo: eventTitle,
    raw: tag,
  };
}

/** Normalize a batch of tagged events */
export function normalizeEventTags(
  events: Array<{ tag: EventTag; title: string; timestamp: number }>
): NormalizedSignal[] {
  return events.map(e => normalizeEventTag(e.tag, e.title, e.timestamp));
}
