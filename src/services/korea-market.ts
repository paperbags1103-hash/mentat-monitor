/**
 * Korea Market Service — Mentat Monitor
 *
 * Fetches Korean market data from /api/korea-market:
 *  - KOSPI, KOSDAQ indices
 *  - USD/KRW exchange rate
 *  - BTC/KRW (Upbit) and BTC/USDT (Binance) for kimchi premium
 */

export interface KoreaMarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

export interface KoreaBtcQuote {
  exchange: string;
  name: string;
  price: number;
  change: number;
}

export interface KoreaMarketData {
  timestamp: number;
  kospi: KoreaMarketIndex | null;
  kosdaq: KoreaMarketIndex | null;
  usdKrw: KoreaMarketIndex | null;
  btcKrw: KoreaBtcQuote | null;
  btcUsdt: KoreaBtcQuote | null;
  /** 김치 프리미엄 (%) — positive means Korean BTC price is higher than global */
  kimchiPremium: number | null;
  errors: Record<string, string | null>;
}

let cachedData: KoreaMarketData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function fetchKoreaMarket(baseUrl = ''): Promise<KoreaMarketData | null> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    const resp = await fetch(`${baseUrl}/api/korea-market`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) throw new Error(`Korea market API returned ${resp.status}`);
    const data = (await resp.json()) as KoreaMarketData;
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    console.warn('[korea-market] fetch failed:', err);
    return cachedData; // Return stale data on error
  }
}

/**
 * Formats kimchi premium for display.
 * e.g. 2.35 → "+2.35%" (green), -0.5 → "-0.50%" (red)
 */
export function formatKimchiPremium(premium: number | null): string {
  if (premium === null) return 'N/A';
  const sign = premium >= 0 ? '+' : '';
  return `${sign}${premium.toFixed(2)}%`;
}

/**
 * Returns a severity level for the kimchi premium.
 * Used for coloring the UI indicator.
 */
export function kimchiPremiumLevel(premium: number | null): 'neutral' | 'low' | 'medium' | 'high' {
  if (premium === null) return 'neutral';
  const abs = Math.abs(premium);
  if (abs < 1) return 'neutral';
  if (abs < 3) return 'low';
  if (abs < 7) return 'medium';
  return 'high';
}
