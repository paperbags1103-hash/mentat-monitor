/**
 * Insight Layer — Core Types
 * Mentat Monitor Phase 4
 */

// ─── Entity Graph ─────────────────────────────────────────────────────────────

export type EntityType =
  | 'country'
  | 'region'
  | 'asset'
  | 'sector'
  | 'company'
  | 'event_template'
  | 'institution'
  | 'commodity';

export type EdgeType =
  | 'affects'
  | 'located_in'
  | 'belongs_to_sector'
  | 'historically_correlated'
  | 'supply_chain_dependency'
  | 'adversary_of'
  | 'ally_of'
  | 'produces'
  | 'consumes'
  | 'monitors';

export interface Entity {
  id: string;                       // e.g. "country:south_korea", "asset:KS11"
  type: EntityType;
  name: string;
  nameKo: string;
  tags: string[];
  meta?: Record<string, unknown>;
}

export interface Edge {
  from: string;
  to: string;
  type: EdgeType;
  weight: number;                   // 0–1
  directional?: boolean;            // default true
  meta?: Record<string, unknown>;
}

// ─── Normalized Signal ────────────────────────────────────────────────────────

export type SignalDirection = 'risk_on' | 'risk_off' | 'neutral' | 'ambiguous';

export type SignalSource =
  | 'blackswan:financial'
  | 'blackswan:pandemic'
  | 'blackswan:nuclear'
  | 'blackswan:cyber'
  | 'blackswan:geopolitical'
  | 'blackswan:supply_chain'
  | 'vip_aircraft'
  | 'convergence_zone'
  | 'event_tagger'
  | 'impact_score'
  | 'pattern_matcher'
  | 'market_data'
  | 'economic_calendar';

export interface NormalizedSignal {
  id: string;
  source: SignalSource;
  strength: number;                 // 0–100
  direction: SignalDirection;
  affectedEntityIds: string[];
  confidence: number;               // 0–1
  timestamp: number;
  headlineKo?: string;
  raw?: unknown;
}

// ─── Fused Signal ─────────────────────────────────────────────────────────────

export interface FusedEntitySignal {
  entityId: string;
  signals: NormalizedSignal[];
  fusedStrength: number;
  fusedDirection: SignalDirection;
  convergenceMultiplier: number;
  signalCount: number;
  dominantSources: SignalSource[];
}

export interface FusionResult {
  timestamp: number;
  entitySignals: FusedEntitySignal[];
  globalRiskLevel: number;          // 0–100
  activeConvergenceZones: string[]; // region entity IDs
}

// ─── Inference ────────────────────────────────────────────────────────────────

export type InferenceSeverity = 'CRITICAL' | 'ELEVATED' | 'WATCH' | 'INFO';

export interface InferenceResult {
  ruleId: string;
  severity: InferenceSeverity;
  titleKo: string;
  summaryKo: string;
  affectedEntityIds: string[];
  suggestedActionKo: string;
  historicalPatternIds?: string[];
  expectedImpact?: {
    kospiRange: [number, number];
    krwDirection: 'strengthen' | 'weaken' | 'neutral';
    safeHavens: string[];           // entity IDs
  };
  confidence: number;
  triggerSignals: string[];         // signal IDs that fired this rule
}

export interface InferenceContext {
  tailRiskScore: number;
  vipAircraftActive: string[];      // aircraft labels
  economicCalendar: Array<{ event: string; daysUntil: number }>;
  latestKospiChange?: number;
  kimchiPremium?: number;
  fusion: FusionResult;
}

// ─── Insight Briefing ─────────────────────────────────────────────────────────

export interface InsightBriefing {
  generatedAt: number;
  globalRiskScore: number;          // 0–100
  riskLabel: string;                // "안정" | "주의" | "경계" | "심각" | "위기"
  topInferences: InferenceResult[];
  narrativeKo: string;
  narrativeMethod: 'llm' | 'template';
  signalSummary: {
    total: number;
    bySeverity: Record<InferenceSeverity, number>;
    topEntities: Array<{ entityId: string; nameKo: string; fusedStrength: number }>;
  };
  marketOutlook: {
    kospiSentiment: SignalDirection;
    keyRisks: string[];
    keyOpportunities: string[];
    hedgeSuggestions: string[];
  };
  staleWarnings: string[];
  _meta?: { processingMs: number; signalCount: number; rulesEvaluated: number };
}
