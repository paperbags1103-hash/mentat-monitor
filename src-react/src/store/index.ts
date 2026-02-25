import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'ELEVATED' | 'WATCH' | 'INFO';
export type Sentiment = 'risk_on' | 'risk_off' | 'neutral' | 'ambiguous';
export type Momentum = 'rising' | 'falling' | 'stable';

export interface Inference {
  ruleId: string;
  severity: Severity;
  titleKo: string;
  summaryKo: string;
  suggestedActionKo?: string;
  confidence: number;
  expectedImpact?: {
    kospiRange?: [number, number];
    krwDirection?: 'weaken' | 'strengthen' | 'neutral';
    safeHavens?: string[];
  };
}

export interface MarketOutlook {
  kospiSentiment: Sentiment;
  keyRisks: string[];
  keyOpportunities: string[];
  hedgeSuggestions: string[];
}

export interface InsightBriefing {
  generatedAt: number;
  globalRiskScore: number;
  riskLabel: string;
  narrativeKo: string;
  narrativeMethod: 'llm' | 'template';
  topInferences: Inference[];
  marketOutlook: MarketOutlook;
  signalSummary: {
    total: number;
    bySeverity: Record<Severity, number>;
    topEntities: { entityId: string; nameKo: string; fusedStrength: number }[];
  };
}

export interface ActiveTheme {
  id: string;
  nameKo: string;
  strength: number;       // 0–100
  momentum: Momentum;
  evidenceKo: string[];
  beneficiaryKo: string[];
  riskKo: string[];
  koreanStocks: string[];
  updatedAt: number;
}

export interface SignalItem {
  id: string;
  source: string;
  headlineKo: string;
  severity: Severity;
  timestamp: number;
}

export interface KoreaMarket {
  kospi: { price: number; changePercent: number } | null;
  kosdaq: { price: number; changePercent: number } | null;
  usdkrw: { rate: number; changePercent: number } | null;
  btcKrw: { price: number; changePercent: number } | null;
  kimchiPremium: number | null;
}

// ─── Store ─────────────────────────────────────────────────────────────────

interface AppState extends KoreaMarket {
  globalRiskScore: number;
  riskLabel: string;
  briefing: InsightBriefing | null;
  activeThemes: ActiveTheme[];
  signals: SignalItem[];
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;

  fetchAll: () => Promise<void>;
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const useStore = create<AppState>((set) => ({
  // Risk
  globalRiskScore: 0,
  riskLabel: '—',
  // Market
  kospi: null,
  kosdaq: null,
  usdkrw: null,
  btcKrw: null,
  kimchiPremium: null,
  // Insight
  briefing: null,
  activeThemes: [],
  signals: [],
  // Meta
  isLoading: false,
  lastUpdated: null,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });

    const [briefingRaw, marketRaw] = await Promise.all([
      safeFetch<InsightBriefing>('/api/insight-briefing'),
      safeFetch<{
        kospi: { price: number; changePercent: number };
        kosdaq: { price: number; changePercent: number };
        usdkrw: { rate: number; changePercent: number };
        btcKrw: { price: number; changePercent: number };
        kimchiPremium: number;
      }>('/api/korea-market'),
    ]);

    // Map briefing → signals feed
    const signals: SignalItem[] = briefingRaw?.topInferences?.map((inf) => ({
      id: inf.ruleId,
      source: 'insight',
      headlineKo: inf.titleKo,
      severity: inf.severity,
      timestamp: briefingRaw.generatedAt ?? Date.now(),
    })) ?? [];

    set({
      isLoading: false,
      lastUpdated: Date.now(),
      globalRiskScore: briefingRaw?.globalRiskScore ?? 0,
      riskLabel: briefingRaw?.riskLabel ?? '—',
      briefing: briefingRaw,
      signals,
      kospi:        marketRaw?.kospi   ?? null,
      kosdaq:       marketRaw?.kosdaq  ?? null,
      usdkrw:       marketRaw?.usdkrw  ?? null,
      btcKrw:       marketRaw?.btcKrw  ?? null,
      kimchiPremium: marketRaw?.kimchiPremium ?? null,
    });
  },
}));
