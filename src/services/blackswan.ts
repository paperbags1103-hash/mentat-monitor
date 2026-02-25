/**
 * Black Swan Early Warning Service — Mentat Monitor
 *
 * Fetches composite Tail Risk Index from /api/blackswan.
 * Monitors: financial stress, pandemic, nuclear, cyber, geopolitical, supply chain.
 */

export type TailRiskLevel = 'NORMAL' | 'WATCH' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface BlackSwanModule {
  score: number;        // 0–100
  weight: number;       // fraction (0.0–1.0)
  signals: Record<string, unknown>;
}

export interface BlackSwanBreakdown {
  id: string;
  label: string;
  emoji: string;
  score: number;
  weight: string;       // e.g. "40%"
}

export interface BlackSwanData {
  timestamp: number;
  tailRiskScore: number;  // 0–100 composite
  level: TailRiskLevel;
  label: string;          // Korean label
  color: string;          // hex
  emoji: string;          // 🟢🟡🟠🔴🚨
  modules: {
    financial: BlackSwanModule;
    pandemic: BlackSwanModule;
    nuclear: BlackSwanModule;
    cyber: BlackSwanModule;
    geopolitical: BlackSwanModule;
    supplyChain: BlackSwanModule;
  };
  breakdown: BlackSwanBreakdown[];
}

let cachedData: BlackSwanData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300_000; // 5 min

export async function fetchBlackSwanData(baseUrl = ''): Promise<BlackSwanData | null> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) return cachedData;

  try {
    const resp = await fetch(`${baseUrl}/api/blackswan`, {
      signal: AbortSignal.timeout(30_000), // allow time for parallel fetches
    });
    if (!resp.ok) throw new Error(`Black swan API returned ${resp.status}`);
    const data = (await resp.json()) as BlackSwanData;
    cachedData = data;
    cacheTimestamp = now;
    return data;
  } catch (err) {
    console.warn('[blackswan] fetch failed:', err);
    return cachedData;
  }
}

/** Returns a text description of the Tail Risk score change */
export function describeTailRiskChange(prev: number | null, current: number): string {
  if (prev === null) return `현재 ${current}`;
  const delta = current - prev;
  if (Math.abs(delta) < 3) return `유지 (${current})`;
  return delta > 0 ? `↑ ${delta}pt 상승 (${current})` : `↓ ${Math.abs(delta)}pt 하락 (${current})`;
}

/** Returns true if the score warrants an alert notification */
export function shouldAlert(score: number, prevScore: number | null): boolean {
  // Alert on first time crossing threshold, or big jumps
  const thresholds = [40, 60, 80];
  if (prevScore === null) return score >= 40;
  for (const t of thresholds) {
    if (prevScore < t && score >= t) return true;
  }
  return score >= 60 && score - prevScore >= 15; // big jump at already high level
}

/** Color for a module score bar */
export function moduleScoreColor(score: number): string {
  if (score <= 20) return '#4CAF50';
  if (score <= 40) return '#FFC107';
  if (score <= 60) return '#FF9800';
  if (score <= 80) return '#F44336';
  return '#9C27B0';
}
