/**
 * Semiconductor Supply Chain Tracker — Mentat Monitor
 *
 * Tracks the key nodes of the global semiconductor supply chain:
 *  - Core companies: Samsung, SK Hynix, TSMC, ASML, Nvidia, Intel, Qualcomm
 *  - News signal: regulations, export bans, factory incidents, demand signals
 *  - Market signal: stock performance divergence as early warning
 *
 * Why this matters for Korean investors:
 *  - Samsung Electronics = ~20% of KOSPI market cap
 *  - SK Hynix = ~5% of KOSPI
 *  - TSMC crisis = Taiwan risk premium repricing
 */

export interface SemiNode {
  symbol: string;
  name: string;
  nameKo: string;
  country: string;
  role: SemiRole;
  lat: number;
  lng: number;
  /** Yahoo Finance symbol */
  yfinance: string;
}

export type SemiRole =
  | 'fab'           // semiconductor manufacturer
  | 'memory'        // DRAM/NAND memory
  | 'equipment'     // fab equipment (ASML, Applied Materials)
  | 'design'        // fabless chip designer
  | 'integrated'    // IDM (own fab + design)
  | 'materials';    // chemicals, wafers

export const SEMI_NODES: SemiNode[] = [
  // ─── Korea ───
  {
    symbol: '005930.KS', name: 'Samsung Electronics', nameKo: '삼성전자',
    country: 'KR', role: 'memory', lat: 37.27, lng: 127.05, yfinance: '005930.KS',
  },
  {
    symbol: '000660.KS', name: 'SK Hynix', nameKo: 'SK 하이닉스',
    country: 'KR', role: 'memory', lat: 37.41, lng: 127.25, yfinance: '000660.KS',
  },
  // ─── Taiwan ───
  {
    symbol: 'TSM', name: 'TSMC', nameKo: 'TSMC',
    country: 'TW', role: 'fab', lat: 24.78, lng: 120.97, yfinance: 'TSM',
  },
  // ─── Netherlands ───
  {
    symbol: 'ASML', name: 'ASML', nameKo: 'ASML (EUV 장비)',
    country: 'NL', role: 'equipment', lat: 51.44, lng: 5.48, yfinance: 'ASML',
  },
  // ─── USA ───
  {
    symbol: 'NVDA', name: 'Nvidia', nameKo: '엔비디아',
    country: 'US', role: 'design', lat: 37.37, lng: -121.97, yfinance: 'NVDA',
  },
  {
    symbol: 'INTC', name: 'Intel', nameKo: '인텔',
    country: 'US', role: 'integrated', lat: 45.52, lng: -122.97, yfinance: 'INTC',
  },
  {
    symbol: 'AMD', name: 'AMD', nameKo: 'AMD',
    country: 'US', role: 'design', lat: 37.33, lng: -121.92, yfinance: 'AMD',
  },
  {
    symbol: 'QCOM', name: 'Qualcomm', nameKo: '퀄컴',
    country: 'US', role: 'design', lat: 32.90, lng: -117.20, yfinance: 'QCOM',
  },
  {
    symbol: 'AMAT', name: 'Applied Materials', nameKo: '어플라이드 머티리얼즈',
    country: 'US', role: 'equipment', lat: 37.39, lng: -121.97, yfinance: 'AMAT',
  },
  {
    symbol: 'LRCX', name: 'Lam Research', nameKo: '램 리서치',
    country: 'US', role: 'equipment', lat: 37.65, lng: -121.80, yfinance: 'LRCX',
  },
  // ─── Japan ───
  {
    symbol: '6857.T', name: 'Advantest', nameKo: '어드밴테스트',
    country: 'JP', role: 'equipment', lat: 35.69, lng: 139.69, yfinance: '6857.T',
  },
  {
    symbol: '6501.T', name: 'Hitachi (semiconductor biz)', nameKo: '히타치',
    country: 'JP', role: 'materials', lat: 35.69, lng: 139.74, yfinance: '6501.T',
  },
];

// Keywords for news tagger — semiconductor supply chain events
export const SEMI_KEYWORDS: string[] = [
  'semiconductor', 'chip shortage', 'fab', 'wafer', 'TSMC', 'samsung fab',
  'SK hynix', 'ASML', 'EUV', 'export ban', 'chip ban', 'export control',
  'CHIPS act', 'advanced packaging', 'HBM', 'NAND', 'DRAM', 'memory downturn',
  'fab equipment', 'fab capacity', 'foundry', 'leading edge',
  '반도체', '수출 규제', '파운드리',
];

// Risk events that historically moved Korean semiconductor stocks
export const SEMI_RISK_EVENTS = [
  {
    id: 'taiwan-risk',
    label: '대만 해협 긴장',
    trigger: ['taiwan', 'strait', 'tsmc', 'invasion'],
    assets: ['TSM', '005930.KS', '000660.KS', 'NVDA', 'ASML'],
    note: 'TSMC 공장 리스크 → 전체 공급망 충격. 삼성/SK하이닉스 대안 수혜 가능성.',
    historicalImpact: '-15 to -30% (전쟁 시나리오)',
  },
  {
    id: 'us-china-ban',
    label: '미중 반도체 수출 규제',
    trigger: ['export ban', 'chip restriction', 'entity list', 'huawei', 'smic'],
    assets: ['NVDA', 'INTC', 'LRCX', 'AMAT', 'ASML', '005930.KS'],
    note: '중국향 매출 의존도 높은 장비주 타격. 한국 메모리 단기 수혜 가능.',
    historicalImpact: 'NVDA -15% (2022), ASML -12%',
  },
  {
    id: 'memory-downturn',
    label: '메모리 다운턴',
    trigger: ['memory oversupply', 'price decline', 'capex cut', 'inventory'],
    assets: ['005930.KS', '000660.KS', 'MU'],
    note: '재고 사이클 — 2~3년 주기. 바닥 = 매수 기회.',
    historicalImpact: '삼성전자 -40% (2022~2023 다운턴)',
  },
  {
    id: 'japan-materials',
    label: '일본 소재 수출 규제',
    trigger: ['japan export', 'photoresist', 'fluorinated', 'etching gas'],
    assets: ['005930.KS', '000660.KS'],
    note: '불화수소, 포토레지스트 등 핵심 소재 일본 의존. 2019년 선례.',
    historicalImpact: '-10% (2019 초기 쇼크)',
  },
];

/** Get all Yahoo Finance symbols for bulk quote fetch */
export function getSemiSymbols(): string[] {
  return SEMI_NODES.map((n) => n.yfinance);
}

/** Get role label in Korean */
export const ROLE_LABELS: Record<SemiRole, string> = {
  fab: '파운드리',
  memory: '메모리',
  equipment: '장비',
  design: '팹리스 설계',
  integrated: '종합반도체',
  materials: '소재/부품',
};

export const ROLE_COLORS: Record<SemiRole, string> = {
  fab: '#E91E63',
  memory: '#2196F3',
  equipment: '#FF9800',
  design: '#9C27B0',
  integrated: '#009688',
  materials: '#795548',
};
