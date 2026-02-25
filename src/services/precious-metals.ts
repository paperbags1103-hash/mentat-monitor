/**
 * Precious Metals Service — Mentat Monitor
 * Gold & Silver intelligence: futures, ETFs, miners, calculated signals
 */

export interface MetalQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  unit?: string;
  sparkline?: number[];
}

export interface MinerQuote {
  symbol: string;
  name: string;
  type: 'gold' | 'silver' | 'streaming';
  price: number;
  change: number;
  lat: number;
  lng: number;
}

export interface PreciousMetalsSignals {
  /** Gold/Silver ratio. Historically avg ~60. > 80 = silver cheap */
  gsRatio: number | null;
  gsRatioSignal:
    | 'SILVER_EXTREMELY_CHEAP'
    | 'SILVER_CHEAP'
    | 'NEUTRAL'
    | 'SILVER_EXPENSIVE'
    | 'SILVER_EXTREMELY_EXPENSIVE'
    | null;
  gsRatioNote: string | null;
  /** GDX % change minus GC=F % change. +2 = miners leading = bullish */
  minersDivergence: number | null;
  minersDivergenceNote: string | null;
  /** GLD vs GC=F % change spread. Near 0 = normal, deviation = stress */
  paperPhysicalSpread: number | null;
}

export interface PreciousMetalsData {
  timestamp: number;
  goldFutures: MetalQuote | null;
  silverFutures: MetalQuote | null;
  gld: MetalQuote | null;
  slv: MetalQuote | null;
  minerEtfs: {
    gdx: MetalQuote | null;
    gdxj: MetalQuote | null;
    sil: MetalQuote | null;
    silj: MetalQuote | null;
  };
  miners: MinerQuote[];
  signals: PreciousMetalsSignals;
}

let cachedData: PreciousMetalsData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 120_000; // 2 min

export async function fetchPreciousMetals(baseUrl = ''): Promise<PreciousMetalsData | null> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) return cachedData;
  try {
    const resp = await fetch(`${baseUrl}/api/precious-metals`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) throw new Error(`Precious metals API returned ${resp.status}`);
    const data = (await resp.json()) as PreciousMetalsData;
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    console.warn('[precious-metals] fetch failed:', err);
    return cachedData;
  }
}

/** Returns color for a miner/ETF based on % change */
export function changeColor(change: number): string {
  if (change > 2) return '#00C853';   // strong green
  if (change > 0) return '#69F0AE';   // light green
  if (change < -2) return '#D50000';  // strong red
  if (change < 0) return '#FF5252';   // light red
  return '#9E9E9E';                    // neutral
}

/** G/S ratio signal label in Korean */
export function gsRatioLabel(signal: PreciousMetalsSignals['gsRatioSignal']): string {
  switch (signal) {
    case 'SILVER_EXTREMELY_CHEAP': return '은 극도 저평가 ⚠️';
    case 'SILVER_CHEAP': return '은 저평가';
    case 'NEUTRAL': return '중립';
    case 'SILVER_EXPENSIVE': return '은 고평가';
    case 'SILVER_EXTREMELY_EXPENSIVE': return '은 극도 고평가';
    default: return 'N/A';
  }
}
