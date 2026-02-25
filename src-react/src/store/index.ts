import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// react-grid-layout layout item type (inline to avoid module issues)
export interface RGLItem {
  i: string; x: number; y: number; w: number; h: number;
  minW?: number; minH?: number; maxW?: number; maxH?: number;
  static?: boolean; isDraggable?: boolean; isResizable?: boolean;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'ELEVATED' | 'WATCH' | 'INFO';
export type Sentiment = 'risk_on' | 'risk_off' | 'neutral' | 'ambiguous';
export type Momentum  = 'rising' | 'falling' | 'stable';

export interface Inference {
  ruleId: string;
  severity: Severity;
  titleKo: string;
  summaryKo: string;
  suggestedActionKo?: string;
  confidence: number;
  affectedEntityIds?: string[];
  expectedImpact?: {
    kospiRange?: [number, number];
    krwDirection?: 'weaken' | 'strengthen' | 'neutral';
    safeHavens?: string[];
  };
}

export interface InsightBriefing {
  generatedAt: number;
  globalRiskScore: number;
  riskLabel: string;
  narrativeKo: string;
  narrativeMethod: 'llm' | 'template';
  topInferences: Inference[];
  marketOutlook: {
    kospiSentiment: Sentiment;
    keyRisks: string[];
    keyOpportunities: string[];
    hedgeSuggestions: string[];
  };
  signalSummary: {
    total: number;
    bySeverity: Record<Severity, number>;
    topEntities: { entityId: string; nameKo: string; fusedStrength: number }[];
  };
}

export interface ActiveTheme {
  id: string;
  nameKo: string;
  strength: number;
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

export interface MarketTick {
  price: number;
  changePercent: number;
  sparkline?: number[];
}

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PreciousMetalsData {
  gold: { price: number; changePercent: number };
  silver: { price: number; changePercent: number };
  goldSilverRatio: number;
  timestamp: number;
}

export interface BlackSwanData {
  tailRiskScore: number;
  modules: Record<string, { score: number; label: string }>;
  timestamp: number;
}

export interface EconCalendarEvent {
  title: string;
  institution: string;
  daysUntil: number;
  date: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CreditStressData {
  igSpread: number;
  hySpread: number;
  igChange: number;
  hyChange: number;
  tedSpread: number | null;
  tedChange: number | null;
  stressLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  commentary: string;
  dataSource: 'fred' | 'yahoo_approx';
  timestamp: number;
}

export interface YieldCurveData {
  y2: number | null;
  y10: number | null;
  y30: number | null;
  spread2s10s: number | null;
  spread10s30s: number | null;
  interpretation: { label: string; emoji: string; sentiment: string } | null;
}

export interface GlobalMacroData {
  dxy: { price: number; changePct: number; signal: { ko: string; sentiment: string } } | null;
  yieldCurve: YieldCurveData;
  realRate: { value: number | null; change: number | null; source: string; goldSignal: string | null };
  copperGold: { ratio: number | null; signal: string | null; copper: { price: number; changePct: number } | null };
  vix: { price: number; changePct: number } | null;
  timestamp: number;
}

// Panel layout definition
export interface PanelDef {
  id: string;
  type: string;
  title: string;
  config?: Record<string, unknown>;
}

// ─── Layout store (persisted) ────────────────────────────────────────────────

interface LayoutState {
  layouts: RGLItem[];
  panels: PanelDef[];
  setLayouts: (layouts: RGLItem[]) => void;
  addPanel: (panel: PanelDef, layout?: Partial<RGLItem>) => void;
  removePanel: (id: string) => void;
  resetLayout: () => void;
}

const DEFAULT_PANELS: PanelDef[] = [
  { id: 'briefing',      type: 'briefing',      title: '🧠 멘탯 브리핑' },
  { id: 'themes',        type: 'themes',        title: '🎯 투자 테마' },
  { id: 'actions',       type: 'actions',       title: '⚡ 행동 제안' },
  { id: 'market',        type: 'market',        title: '📊 시장 현황' },
  { id: 'global-macro',  type: 'global-macro',  title: '🌐 글로벌 매크로' },
  { id: 'chart-kospi',   type: 'chart',         title: '📈 KOSPI', config: { symbol: '^KS11', nameKo: 'KOSPI' } },
  { id: 'chart-spx',     type: 'chart',         title: '📈 S&P500', config: { symbol: '^GSPC', nameKo: 'S&P500' } },
  { id: 'chart-btc',     type: 'chart',         title: '📈 BTC/KRW', config: { symbol: 'BTC-KRW', nameKo: 'BTC/KRW' } },
  { id: 'signals',       type: 'signals',       title: '📡 신호 피드' },
  { id: 'blackswan',     type: 'blackswan',     title: '🌡️ 블랙스완' },
  { id: 'credit-stress', type: 'credit-stress', title: '💳 신용 스트레스' },
  { id: 'calendar',      type: 'econ-calendar', title: '📅 경제 캘린더' },
];

const DEFAULT_LAYOUTS: RGLItem[] = [
  // Row 0: Briefing (tall left) + Themes + Actions
  { i: 'briefing',      x: 0, y: 0,  w: 4, h: 10, minW: 3, minH: 6 },
  { i: 'themes',        x: 4, y: 0,  w: 4, h: 5,  minW: 3, minH: 4 },
  { i: 'actions',       x: 8, y: 0,  w: 4, h: 5,  minW: 3, minH: 4 },
  // Row 1: Charts
  { i: 'chart-kospi',   x: 4, y: 5,  w: 4, h: 5,  minW: 3, minH: 3 },
  { i: 'chart-spx',     x: 8, y: 5,  w: 4, h: 5,  minW: 3, minH: 3 },
  // Row 2: Data panels
  { i: 'market',        x: 0, y: 10, w: 3, h: 6,  minW: 2, minH: 4 },
  { i: 'global-macro',  x: 3, y: 10, w: 3, h: 6,  minW: 2, minH: 4 },
  { i: 'credit-stress', x: 6, y: 10, w: 3, h: 6,  minW: 2, minH: 4 },
  { i: 'blackswan',     x: 9, y: 10, w: 3, h: 6,  minW: 2, minH: 4 },
  // Row 3: Signals + BTC + Calendar
  { i: 'signals',       x: 0, y: 16, w: 4, h: 5,  minW: 2, minH: 3 },
  { i: 'chart-btc',     x: 4, y: 16, w: 4, h: 5,  minW: 3, minH: 3 },
  { i: 'calendar',      x: 8, y: 16, w: 4, h: 5,  minW: 2, minH: 3 },
];

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layouts: DEFAULT_LAYOUTS,
      panels: DEFAULT_PANELS,
      setLayouts: (layouts) => set({ layouts }),
      addPanel: (panel, layoutHint) => set((s) => {
        if (s.panels.find(p => p.id === panel.id)) return s;
        const newLayout: RGLItem = {
          i: panel.id,
          x: 0, y: Infinity,
          w: layoutHint?.w ?? 4, h: layoutHint?.h ?? 4,
          minW: 2, minH: 3,
          ...layoutHint,
        };
        return { panels: [...s.panels, panel], layouts: [...s.layouts, newLayout] };
      }),
      removePanel: (id) => set((s) => ({
        panels: s.panels.filter(p => p.id !== id),
        layouts: s.layouts.filter(l => l.i !== id),
      })),
      resetLayout: () => set({ layouts: DEFAULT_LAYOUTS, panels: DEFAULT_PANELS }),
    }),
    { name: 'mentat-layout-v1' }
  )
);

// ─── Data store ──────────────────────────────────────────────────────────────

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const API_BASE = isTauri ? 'http://localhost:46123' : '';

export async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch { return null; }
}

interface DataState {
  // Risk
  globalRiskScore: number;
  riskLabel: string;
  briefing: InsightBriefing | null;

  // Market
  kospi:  MarketTick | null;
  kosdaq: MarketTick | null;
  usdkrw: { rate: number; changePercent: number } | null;
  btcKrw: MarketTick | null;
  kimchiPremium: number | null;
  spx:    MarketTick | null;
  nasdaq: MarketTick | null;
  dxy:    MarketTick | null;
  vix:    MarketTick | null;
  gold:   MarketTick | null;
  oil:    MarketTick | null;

  // Signals
  signals: SignalItem[];
  activeThemes: ActiveTheme[];

  // Extended data
  preciousMetals: PreciousMetalsData | null;
  blackSwan: BlackSwanData | null;
  econCalendar: EconCalendarEvent[];
  creditStress: CreditStressData | null;
  globalMacro: GlobalMacroData | null;
  themeDiscoveryMethod: 'llm' | 'template' | null;

  // Meta
  isLoading: boolean;
  lastUpdated: number | null;

  // Chart data cache
  chartCache: Record<string, OHLCBar[]>;

  // Actions
  fetchAll: () => Promise<void>;
  fetchThemes: () => Promise<void>;
  fetchChart: (symbol: string, range?: string) => Promise<OHLCBar[]>;
}

export const useStore = create<DataState>()((set, get) => ({
  globalRiskScore: 0,
  riskLabel: '—',
  briefing: null,
  kospi: null, kosdaq: null, usdkrw: null, btcKrw: null, kimchiPremium: null,
  spx: null, nasdaq: null, dxy: null, vix: null, gold: null, oil: null,
  signals: [], activeThemes: [],
  preciousMetals: null, blackSwan: null, econCalendar: [], creditStress: null,
  globalMacro: null, themeDiscoveryMethod: null,
  isLoading: false, lastUpdated: null,
  chartCache: {},

  fetchAll: async () => {
    set({ isLoading: true });
    const [briefingRaw, mktRaw, metalsRaw, bsRaw, calRaw, creditRaw, macroRaw] = await Promise.all([
      apiFetch<InsightBriefing>('/api/insight-briefing'),
      apiFetch<Record<string, unknown>>('/api/korea-market'),
      apiFetch<PreciousMetalsData>('/api/precious-metals'),
      apiFetch<{ tailRiskScore: number; modules: Record<string, { score: number }> }>('/api/blackswan'),
      apiFetch<{ events: EconCalendarEvent[] }>('/api/economic-calendar'),
      apiFetch<CreditStressData>('/api/credit-stress'),
      apiFetch<GlobalMacroData>('/api/global-macro'),
    ]);

    const signals: SignalItem[] = briefingRaw?.topInferences?.map(inf => ({
      id: inf.ruleId, source: 'insight', headlineKo: inf.titleKo,
      severity: inf.severity, timestamp: briefingRaw.generatedAt ?? Date.now(),
    })) ?? [];

    const bsModules: Record<string, { score: number; label: string }> = {};
    const MODULE_LABELS: Record<string, string> = {
      financial: '금융', pandemic: '팬데믹', nuclear: '핵', cyber: '사이버', geopolitical: '지정학', supplyChain: '공급망'
    };
    if (bsRaw?.modules) {
      Object.entries(bsRaw.modules).forEach(([k, v]) => {
        bsModules[k] = { score: (v as { score: number }).score, label: MODULE_LABELS[k] ?? k };
      });
    }

    // Extract DXY from macro data if available
    const dxyFromMacro = macroRaw?.dxy
      ? { price: macroRaw.dxy.price, changePercent: macroRaw.dxy.changePct } as MarketTick
      : null;
    const vixFromMacro = macroRaw?.vix
      ? { price: macroRaw.vix.price, changePercent: macroRaw.vix.changePct } as MarketTick
      : null;

    set({
      isLoading: false, lastUpdated: Date.now(),
      globalRiskScore: briefingRaw?.globalRiskScore ?? 0,
      riskLabel: briefingRaw?.riskLabel ?? '—',
      briefing: briefingRaw,
      signals,
      kospi:  mktRaw?.kospi  as MarketTick ?? null,
      kosdaq: mktRaw?.kosdaq as MarketTick ?? null,
      usdkrw: mktRaw?.usdkrw as { rate: number; changePercent: number } ?? null,
      btcKrw: mktRaw?.btcKrw as MarketTick ?? null,
      kimchiPremium: typeof mktRaw?.kimchiPremium === 'number' ? mktRaw.kimchiPremium : null,
      dxy: dxyFromMacro, vix: vixFromMacro,
      preciousMetals: metalsRaw,
      blackSwan: bsRaw ? { tailRiskScore: bsRaw.tailRiskScore, modules: bsModules, timestamp: Date.now() } : null,
      econCalendar: calRaw?.events ?? [],
      creditStress: creditRaw,
      globalMacro: macroRaw,
    });
  },

  fetchThemes: async () => {
    const data = await apiFetch<{ themes: ActiveTheme[]; method: 'llm' | 'template' }>('/api/theme-discovery');
    if (data?.themes) {
      set({ activeThemes: data.themes, themeDiscoveryMethod: data.method });
    }
  },

  fetchChart: async (symbol, range = '3mo') => {
    const cacheKey = `${symbol}:${range}`;
    const cached = get().chartCache[cacheKey];
    if (cached && cached.length > 0) return cached;
    const data = await apiFetch<{ bars: OHLCBar[] }>(`/api/chart-data?symbol=${encodeURIComponent(symbol)}&range=${range}`);
    const bars = data?.bars ?? [];
    if (bars.length > 0) {
      set(s => ({ chartCache: { ...s.chartCache, [cacheKey]: bars } }));
    }
    return bars;
  },
}));
