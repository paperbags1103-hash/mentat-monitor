/**
 * Portfolio Risk Exposure — Mentat Monitor Phase 3
 *
 * Calculates how much a user's portfolio is exposed to current geopolitical
 * and macroeconomic events. Designed for Korean retail investors.
 *
 * Features:
 * - Per-position exposure score based on tagged events
 * - Total portfolio risk score (0–100)
 * - Hedge suggestions
 * - "What if?" scenario analysis
 */

import type { AggregatedImpact } from './impact-scoring.js';
import type { PatternAnalysis } from './pattern-matcher.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetClass =
  | 'korean_equity'
  | 'us_equity'
  | 'global_equity'
  | 'cryptocurrency'
  | 'commodity'
  | 'bond'
  | 'cash'
  | 'real_estate'
  | 'other';

export interface PortfolioPosition {
  symbol: string;
  name?: string;
  nameKo?: string;
  weight: number;       // 0–1 (sum of all = 1.0)
  assetClass: AssetClass;
  country?: string;     // ISO 2-letter dominant exposure
  sector?: string;
}

export interface PositionRisk {
  symbol: string;
  name: string;
  weight: number;
  assetClass: AssetClass;
  // Risk assessment
  exposureScore: number;  // -10 to +10 (positive = opportunity, negative = risk)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Specific concerns
  concerns: string[];     // Korean-language bullet points
  opportunities: string[]; // Korean-language bullet points
  // Beta to current events
  eventBeta: number;      // sensitivity multiplier
}

export interface PortfolioRiskReport {
  timestamp: number;
  totalRiskScore: number;         // 0–100 (aggregate downside risk)
  weightedExposure: number;       // -10 to +10 (net impact)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  positions: PositionRisk[];
  // Portfolio composition analysis
  koreaExposure: number;          // 0–1 (fraction of portfolio in Korean assets)
  cryptoExposure: number;
  defensiveAllocation: number;    // cash + bonds
  // Hedge suggestions
  hedgeSuggestions: HedgeSuggestion[];
  // Summary
  summaryKo: string;
  topRiskPositions: PositionRisk[];
  topOpportunityPositions: PositionRisk[];
}

export interface HedgeSuggestion {
  asset: string;
  assetKo: string;
  rationale: string;
  allocationSuggestion: string;  // e.g. "포트폴리오의 5-10%"
  condition: string;             // trigger condition
}

// ─── Asset class sensitivity matrix ──────────────────────────────────────────

// How each asset class responds to event types (bearish environment)
const ASSET_CLASS_SENSITIVITY: Record<AssetClass, {
  geopoliticalBeta: number;  // 1.0 = same as market, >1.0 = more sensitive
  financialCrisisBeta: number;
  pandemicBeta: number;
  energyShockBeta: number;
  cryptoBeta: number;       // sensitivity to "risk off" broadly
}> = {
  korean_equity:  { geopoliticalBeta: 1.4, financialCrisisBeta: 1.3, pandemicBeta: 1.2, energyShockBeta: 1.1, cryptoBeta: 0.3 },
  us_equity:      { geopoliticalBeta: 0.8, financialCrisisBeta: 1.2, pandemicBeta: 1.0, energyShockBeta: 0.9, cryptoBeta: 0.2 },
  global_equity:  { geopoliticalBeta: 0.9, financialCrisisBeta: 1.1, pandemicBeta: 1.0, energyShockBeta: 0.9, cryptoBeta: 0.2 },
  cryptocurrency: { geopoliticalBeta: 1.2, financialCrisisBeta: 1.8, pandemicBeta: 1.5, energyShockBeta: 0.7, cryptoBeta: 1.0 },
  commodity:      { geopoliticalBeta: 1.0, financialCrisisBeta: 0.8, pandemicBeta: 0.6, energyShockBeta: 1.8, cryptoBeta: 0.1 },
  bond:           { geopoliticalBeta: -0.5, financialCrisisBeta: -0.3, pandemicBeta: -0.4, energyShockBeta: -0.2, cryptoBeta: -0.2 },
  cash:           { geopoliticalBeta: -0.1, financialCrisisBeta: -0.1, pandemicBeta: -0.1, energyShockBeta: -0.1, cryptoBeta: -0.1 },
  real_estate:    { geopoliticalBeta: 0.5, financialCrisisBeta: 1.0, pandemicBeta: 0.8, energyShockBeta: 0.4, cryptoBeta: 0.1 },
  other:          { geopoliticalBeta: 0.8, financialCrisisBeta: 0.9, pandemicBeta: 0.8, energyShockBeta: 0.7, cryptoBeta: 0.3 },
};

// ─── Known Korean asset sector map ───────────────────────────────────────────

const KOREAN_ASSETS: Record<string, { nameKo: string; sector: string }> = {
  '^KS11':    { nameKo: 'KOSPI 지수', sector: 'broad_market' },
  '^KQ11':    { nameKo: 'KOSDAQ 지수', sector: 'tech' },
  '005930.KS': { nameKo: '삼성전자', sector: 'semiconductor' },
  '000660.KS': { nameKo: 'SK하이닉스', sector: 'semiconductor' },
  '035420.KS': { nameKo: 'NAVER', sector: 'tech' },
  '035720.KS': { nameKo: '카카오', sector: 'tech' },
  '005380.KS': { nameKo: '현대차', sector: 'autos' },
  '000270.KS': { nameKo: '기아', sector: 'autos' },
  '068270.KS': { nameKo: '셀트리온', sector: 'biotech' },
  '207940.KS': { nameKo: '삼성바이오로직스', sector: 'biotech' },
  '006400.KS': { nameKo: '삼성SDI', sector: 'battery' },
  '373220.KS': { nameKo: 'LG에너지솔루션', sector: 'battery' },
  '051910.KS': { nameKo: 'LG화학', sector: 'chemicals' },
  '003490.KS': { nameKo: '대한항공', sector: 'airlines' },
  '034020.KS': { nameKo: '두산에너빌리티', sector: 'nuclear_power' },
  '138040.KS': { nameKo: '메리츠금융지주', sector: 'finance' },
  '055550.KS': { nameKo: '신한지주', sector: 'finance' },
  '105560.KS': { nameKo: 'KB금융', sector: 'finance' },
  // ETFs
  'TIGER200':  { nameKo: 'TIGER 코스피200 ETF', sector: 'broad_market' },
  '069500.KS': { nameKo: 'KODEX 200 ETF', sector: 'broad_market' },
  // Crypto
  'BTC-KRW':  { nameKo: '비트코인 (원화)', sector: 'crypto' },
  'ETH-KRW':  { nameKo: '이더리움 (원화)', sector: 'crypto' },
};

// ─── Sector risk assessment ───────────────────────────────────────────────────

function getSectorExposure(sector: string, sectorSignals: PatternAnalysis['sectorSignals']): {
  exposure: number;
  concerns: string[];
  opportunities: string[];
} {
  const concerns: string[] = [];
  const opportunities: string[] = [];
  let exposure = 0;

  for (const signal of sectorSignals) {
    if (signal.sector === sector || sector === 'broad_market') {
      const weight = signal.confidence * (sector === 'broad_market' ? 0.5 : 1.0);
      if (signal.direction === 'bearish') {
        exposure -= weight * 5;
        concerns.push(`${signal.sectorKo}: ${signal.basis} (신뢰도 ${Math.round(signal.confidence * 100)}%)`);
      } else if (signal.direction === 'bullish') {
        exposure += weight * 5;
        opportunities.push(`${signal.sectorKo}: ${signal.basis} (신뢰도 ${Math.round(signal.confidence * 100)}%)`);
      }
    }
  }

  return { exposure: Math.max(-10, Math.min(10, exposure)), concerns, opportunities };
}

// ─── Main portfolio risk calculation ─────────────────────────────────────────

export function calculatePortfolioRisk(
  positions: PortfolioPosition[],
  aggregatedImpact: AggregatedImpact,
  patternAnalysis: PatternAnalysis | null,
  tailRiskScore: number  // 0–100 from blackswan
): PortfolioRiskReport {
  const now = Date.now();

  // Validate weights sum to ~1
  const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
  const normalizedPositions = totalWeight > 0
    ? positions.map(p => ({ ...p, weight: p.weight / totalWeight }))
    : positions;

  // Analyze each position
  const positionRisks: PositionRisk[] = normalizedPositions.map(pos => {
    const sensitivity = ASSET_CLASS_SENSITIVITY[pos.assetClass];
    const koInfo = KOREAN_ASSETS[pos.symbol];

    // Base exposure from aggregated impact, scaled by sensitivity
    let exposureScore = aggregatedImpact.compositeScore;

    // Adjust for asset-class sensitivity
    if (aggregatedImpact.dominantDirection === 'bearish') {
      // Use worst-case beta for this asset class
      const maxBeta = Math.max(
        sensitivity.geopoliticalBeta,
        sensitivity.financialCrisisBeta,
        sensitivity.pandemicBeta
      );
      exposureScore *= maxBeta;
    }

    // Korean equity gets KOSPI-specific impact
    if (pos.assetClass === 'korean_equity' || pos.country === 'KR') {
      exposureScore = aggregatedImpact.kospiComposite;
    }

    // Crypto extra sensitivity to risk-off
    if (pos.assetClass === 'cryptocurrency') {
      exposureScore *= sensitivity.cryptoBeta;
    }

    // Pattern analysis overlay
    const sectorSignals = patternAnalysis?.sectorSignals ?? [];
    const sectorExposure = getSectorExposure(pos.sector ?? '', sectorSignals);

    // Blend: 60% direct event impact, 40% sector pattern signal
    const blendedExposure = Math.max(-10, Math.min(10,
      exposureScore * 0.6 + sectorExposure.exposure * 0.4
    ));

    // Determine risk level
    const absExposure = Math.abs(blendedExposure);
    const riskLevel: PositionRisk['riskLevel'] =
      absExposure >= 7 ? 'CRITICAL' :
      absExposure >= 5 ? 'HIGH' :
      absExposure >= 3 ? 'MEDIUM' : 'LOW';

    // Add Korea-specific concerns
    const concerns = [...sectorExposure.concerns];
    const opportunities = [...sectorExposure.opportunities];

    if (pos.assetClass === 'korean_equity' && aggregatedImpact.krwComposite < -2) {
      concerns.push(`KRW 약세 예상 (${aggregatedImpact.krwComposite.toFixed(1)}) → 외국인 이탈 위험`);
    }
    if (pos.assetClass === 'cryptocurrency' && tailRiskScore > 50) {
      concerns.push(`테일 리스크 지수 ${tailRiskScore} → 암호화폐 변동성 확대 위험`);
    }
    if (blendedExposure > 3) {
      opportunities.push('현재 이벤트 환경에서 해당 자산 강세 예상');
    }

    return {
      symbol: pos.symbol,
      name: koInfo?.nameKo ?? pos.name ?? pos.symbol,
      weight: pos.weight,
      assetClass: pos.assetClass,
      exposureScore: Math.round(blendedExposure * 10) / 10,
      riskLevel,
      concerns,
      opportunities,
      eventBeta: ASSET_CLASS_SENSITIVITY[pos.assetClass].geopoliticalBeta,
    };
  });

  // Portfolio-level aggregation
  const weightedExposure = positionRisks.reduce((s, p) => s + p.exposureScore * p.weight, 0);

  const koreaExposure = normalizedPositions
    .filter(p => p.assetClass === 'korean_equity' || p.country === 'KR')
    .reduce((s, p) => s + p.weight, 0);

  const cryptoExposure = normalizedPositions
    .filter(p => p.assetClass === 'cryptocurrency')
    .reduce((s, p) => s + p.weight, 0);

  const defensiveAllocation = normalizedPositions
    .filter(p => p.assetClass === 'cash' || p.assetClass === 'bond')
    .reduce((s, p) => s + p.weight, 0);

  // Total risk score: combine tail risk + weighted exposure
  const exposureRiskContrib = Math.max(0, -weightedExposure) * 8;  // negative exposure → risk
  const tailRiskContrib = tailRiskScore * 0.4;
  const concentrationRisk = koreaExposure > 0.5 ? (koreaExposure - 0.5) * 40 : 0;
  const totalRiskScore = Math.round(Math.min(100, exposureRiskContrib + tailRiskContrib + concentrationRisk));

  const riskLevel: PortfolioRiskReport['riskLevel'] =
    totalRiskScore >= 70 ? 'CRITICAL' :
    totalRiskScore >= 50 ? 'HIGH' :
    totalRiskScore >= 30 ? 'MEDIUM' : 'LOW';

  // Hedge suggestions
  const hedgeSuggestions: HedgeSuggestion[] = [];

  if (koreaExposure > 0.3 && aggregatedImpact.kospiComposite < -2) {
    hedgeSuggestions.push({
      asset: 'GLD / 금 현물',
      assetKo: '금 (안전자산)',
      rationale: '한국 자산 비중이 높고 KOSPI 약세 예상 시 금이 헤지 역할',
      allocationSuggestion: '포트폴리오의 5-10%',
      condition: 'KOSPI 약세 / 지정학 리스크 상승 시',
    });
  }

  if (cryptoExposure > 0.2 && tailRiskScore > 50) {
    hedgeSuggestions.push({
      asset: 'USDT / 스테이블코인',
      assetKo: '스테이블코인 (달러 연동)',
      rationale: '암호화폐 비중 과다 + 테일 리스크 상승 시 일부 안정화 필요',
      allocationSuggestion: '암호화폐 포지션의 20-30% 전환',
      condition: '테일 리스크 지수 50+ 시',
    });
  }

  if (defensiveAllocation < 0.1 && totalRiskScore > 50) {
    hedgeSuggestions.push({
      asset: 'MMF / 단기채',
      assetKo: '머니마켓펀드 / 단기 국채',
      rationale: '방어적 자산 비중 부족. 전반적 리스크 상승 환경.',
      allocationSuggestion: '포트폴리오의 10-20%',
      condition: '리스크 레벨 HIGH 이상 지속 시',
    });
  }

  if (aggregatedImpact.safeHavenPressure > 50) {
    hedgeSuggestions.push({
      asset: 'JPY / 엔화',
      assetKo: '일본 엔화',
      rationale: '안전자산 선호 강화 시 엔화 강세 경향',
      allocationSuggestion: '외화 자산의 10-15%',
      condition: '글로벌 리스크오프 환경',
    });
  }

  // Sort positions
  const topRiskPositions = [...positionRisks]
    .filter(p => p.exposureScore < -2)
    .sort((a, b) => a.exposureScore - b.exposureScore)
    .slice(0, 3);

  const topOpportunityPositions = [...positionRisks]
    .filter(p => p.exposureScore > 2)
    .sort((a, b) => b.exposureScore - a.exposureScore)
    .slice(0, 3);

  // Summary
  const riskLevelKo = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음', CRITICAL: '위험' }[riskLevel];
  const summaryKo = `현재 포트폴리오 리스크: ${riskLevelKo} (${totalRiskScore}/100). ` +
    `한국 자산 비중: ${Math.round(koreaExposure * 100)}%. ` +
    (topRiskPositions.length ? `주요 위험 포지션: ${topRiskPositions.map(p => p.name).join(', ')}.` : '고위험 포지션 없음.');

  return {
    timestamp: now,
    totalRiskScore,
    weightedExposure: Math.round(weightedExposure * 10) / 10,
    riskLevel,
    positions: positionRisks,
    koreaExposure: Math.round(koreaExposure * 100) / 100,
    cryptoExposure: Math.round(cryptoExposure * 100) / 100,
    defensiveAllocation: Math.round(defensiveAllocation * 100) / 100,
    hedgeSuggestions,
    summaryKo,
    topRiskPositions,
    topOpportunityPositions,
  };
}

// ─── Sample Korean investor portfolios ───────────────────────────────────────

export const SAMPLE_PORTFOLIOS: Record<string, PortfolioPosition[]> = {
  conservative: [
    { symbol: '069500.KS', name: 'KODEX 200', nameKo: 'KODEX 200 ETF', weight: 0.30, assetClass: 'korean_equity', country: 'KR', sector: 'broad_market' },
    { symbol: 'BOND_KR', name: '한국국채 ETF', nameKo: '한국 국채', weight: 0.30, assetClass: 'bond', country: 'KR' },
    { symbol: 'CASH', name: 'CMA/예금', nameKo: '현금성 자산', weight: 0.20, assetClass: 'cash' },
    { symbol: 'GLD', name: 'Gold ETF', nameKo: '금 ETF', weight: 0.10, assetClass: 'commodity', sector: 'gold' },
    { symbol: 'SPY', name: 'S&P 500 ETF', nameKo: '미국 S&P500', weight: 0.10, assetClass: 'us_equity', country: 'US', sector: 'broad_market' },
  ],
  aggressive_korean: [
    { symbol: '005930.KS', name: 'Samsung Electronics', nameKo: '삼성전자', weight: 0.30, assetClass: 'korean_equity', country: 'KR', sector: 'semiconductor' },
    { symbol: '000660.KS', name: 'SK Hynix', nameKo: 'SK하이닉스', weight: 0.20, assetClass: 'korean_equity', country: 'KR', sector: 'semiconductor' },
    { symbol: '^KQ11', name: 'KOSDAQ', nameKo: '코스닥 지수', weight: 0.20, assetClass: 'korean_equity', country: 'KR', sector: 'tech' },
    { symbol: 'BTC-KRW', name: 'Bitcoin KRW', nameKo: '비트코인', weight: 0.15, assetClass: 'cryptocurrency' },
    { symbol: 'ETH-KRW', name: 'Ethereum KRW', nameKo: '이더리움', weight: 0.15, assetClass: 'cryptocurrency' },
  ],
  balanced_global: [
    { symbol: '069500.KS', name: 'KODEX 200', nameKo: 'KODEX 200 ETF', weight: 0.25, assetClass: 'korean_equity', country: 'KR', sector: 'broad_market' },
    { symbol: 'SPY', name: 'S&P 500', nameKo: '미국 S&P500', weight: 0.25, assetClass: 'us_equity', country: 'US', sector: 'broad_market' },
    { symbol: 'GLD', name: 'Gold', nameKo: '금', weight: 0.10, assetClass: 'commodity', sector: 'gold' },
    { symbol: 'BTC-KRW', name: 'Bitcoin', nameKo: '비트코인', weight: 0.10, assetClass: 'cryptocurrency' },
    { symbol: 'BOND_KR', name: 'Korea Bonds', nameKo: '한국 채권', weight: 0.20, assetClass: 'bond', country: 'KR' },
    { symbol: 'CASH', name: 'Cash', nameKo: '현금', weight: 0.10, assetClass: 'cash' },
  ],
};
