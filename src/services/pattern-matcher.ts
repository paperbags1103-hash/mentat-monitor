/**
 * Historical Pattern Matcher — Mentat Monitor Phase 3
 *
 * Given current events (tagged), finds the most similar historical analogues
 * and returns expected market outcomes based on those precedents.
 */

import {
  HISTORICAL_PATTERNS,
  findSimilarPatterns,
  summarizeKoreanOutlook,
  type HistoricalPattern,
  type MarketOutcome,
  type PatternCategory,
} from '../data/historical-patterns.js';

import type { EventTag } from './event-tagger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatternMatch {
  pattern: HistoricalPattern;
  similarity: number;   // 0–1
  relevanceScore: number; // 0–100 (similarity × severity × recency)
  matchedKeywords: string[];
  relevantOutcomes: MarketOutcome[];
  isKoreaSpecific: boolean;
}

export interface PatternAnalysis {
  timestamp: number;
  matchedPatterns: PatternMatch[];
  // Aggregated Korean market outlook
  outlook: {
    kospiExpected: string;
    krwExpected: string;
    safeHavenDemand: boolean;
    timeToResolve: string;
  };
  // Most impactful analogues for display
  topAnalogues: Array<{
    id: string;
    title: string;
    titleKo: string;
    date: string;
    similarity: number;
    kospiChange?: number;
    krwChange?: number;
    keyLessonKo: string;
  }>;
  // Sector rotation signals
  sectorSignals: Array<{
    sector: string;
    sectorKo: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;  // 0–1
    basis: string;
  }>;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ─── Sector rotation rules from historical data ────────────────────────────

interface SectorRotationRule {
  category: PatternCategory[];
  direction: 'bullish' | 'bearish';
  sector: string;
  sectorKo: string;
  confidence: number;
  basis: string;
}

const SECTOR_ROTATION_RULES: SectorRotationRule[] = [
  // War / Military escalation
  { category: ['war', 'nk_provocation'], direction: 'bullish', sector: 'defense', sectorKo: '방산', confidence: 0.85, basis: '군사 긴장 시 방산 수혜' },
  { category: ['war', 'nk_provocation'], direction: 'bearish', sector: 'tourism', sectorKo: '관광', confidence: 0.80, basis: '지정학 리스크 시 관광 타격' },
  { category: ['war', 'nk_provocation'], direction: 'bearish', sector: 'consumer', sectorKo: '소비재', confidence: 0.70, basis: '불확실성 시 소비 감소' },
  // Energy shocks
  { category: ['energy_shock', 'war'], direction: 'bullish', sector: 'energy', sectorKo: '에너지', confidence: 0.80, basis: '에너지 가격 상승 → 에너지주 수혜' },
  { category: ['energy_shock'], direction: 'bearish', sector: 'airlines', sectorKo: '항공', confidence: 0.85, basis: '유가 상승 → 항공 연료비 급증' },
  { category: ['energy_shock'], direction: 'bearish', sector: 'chemicals', sectorKo: '화학', confidence: 0.75, basis: '나프타 등 원료비 상승' },
  // Financial crisis
  { category: ['financial_crisis'], direction: 'bearish', sector: 'finance', sectorKo: '금융', confidence: 0.90, basis: '금융 위기 시 은행·증권 직격' },
  { category: ['financial_crisis'], direction: 'bearish', sector: 'real_estate', sectorKo: '부동산', confidence: 0.80, basis: '신용 경색 시 부동산 타격' },
  { category: ['financial_crisis'], direction: 'bullish', sector: 'gold', sectorKo: '금·귀금속', confidence: 0.85, basis: '금융 위기 시 안전자산 선호' },
  // Pandemic
  { category: ['pandemic'], direction: 'bearish', sector: 'aviation', sectorKo: '항공·여행', confidence: 0.90, basis: '이동 제한 → 항공·여행업 직격' },
  { category: ['pandemic'], direction: 'bullish', sector: 'biotech', sectorKo: '바이오·제약', confidence: 0.75, basis: '백신·치료제 수요 급증' },
  { category: ['pandemic'], direction: 'bullish', sector: 'ecommerce', sectorKo: 'e커머스·물류', confidence: 0.80, basis: '비대면 경제 수혜' },
  { category: ['pandemic'], direction: 'bullish', sector: 'semiconductor', sectorKo: '반도체', confidence: 0.70, basis: '재택·디지털화 → IT 수요 증가' },
  // Cyber
  { category: ['cyber'], direction: 'bullish', sector: 'cybersecurity', sectorKo: '사이버보안', confidence: 0.80, basis: '사이버 공격 → 보안 지출 증가' },
  { category: ['cyber'], direction: 'bearish', sector: 'fintech', sectorKo: '핀테크·금융IT', confidence: 0.60, basis: '금융 해킹 시 디지털 금융 신뢰 하락' },
  // Nuclear
  { category: ['nuclear'], direction: 'bearish', sector: 'nuclear_power', sectorKo: '원전', confidence: 0.85, basis: '핵 사고 → 원전 반대 여론 증가' },
  { category: ['nuclear'], direction: 'bearish', sector: 'uranium', sectorKo: '우라늄', confidence: 0.85, basis: '원전 shutdown 우려 → 우라늄 수요 감소' },
  // Trade war
  { category: ['diplomatic'], direction: 'bearish', sector: 'semiconductor', sectorKo: '반도체', confidence: 0.80, basis: '미중 무역갈등 → 반도체 수출 타격' },
  { category: ['diplomatic'], direction: 'bearish', sector: 'autos', sectorKo: '자동차', confidence: 0.70, basis: '관세 전쟁 → 자동차 부품 공급망 타격' },
];

// ─── Main pattern matching ─────────────────────────────────────────────────

export function matchPatterns(
  tags: EventTag[],
  options: { maxResults?: number; minSimilarity?: number } = {}
): PatternAnalysis {
  const { maxResults = 5, minSimilarity = 0.05 } = options;

  // Combine all keywords from all events
  const allKeywords = Array.from(new Set([
    ...tags.flatMap(t => t.tags),
    ...tags.flatMap(t => t.relatedAssets),
    ...tags.flatMap(t => t.countries),
    ...tags.map(t => t.region),
    ...tags.map(t => t.signalType),
  ]));

  // Get dominant categories from signal types
  const signalTypes = tags.map(t => t.signalType);

  // Find similar historical patterns
  const rawMatches = findSimilarPatterns(allKeywords, undefined, 20);

  // Build PatternMatch objects with enrichment
  const matches: PatternMatch[] = rawMatches
    .filter(p => p.similarity >= minSimilarity)
    .map(p => {
      const matchedKeywords = allKeywords.filter(k =>
        p.keywords.some(pk => pk.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(pk.toLowerCase()))
      );

      // Boost score if signal types match
      const signalTypeBonus = p.signalTypes.some(st => signalTypes.includes(st as EventTag['signalType'])) ? 0.2 : 0;

      // Boost Korea-specific patterns for Korean investors
      const koreaBonus = (p.countries.includes('KR') || p.countries.includes('KP') || p.region === 'korea') ? 0.15 : 0;

      const relevanceScore = Math.round(
        Math.min(100, (p.similarity + signalTypeBonus + koreaBonus) * 100 * (p.severity / 5))
      );

      const relevantOutcomes = p.outcomes.filter(o =>
        ['^KS11', 'KRW=X', 'GC=F', 'CL=F', 'SPY', '^N225'].includes(o.asset)
      );

      return {
        pattern: p,
        similarity: p.similarity,
        relevanceScore,
        matchedKeywords,
        relevantOutcomes,
        isKoreaSpecific: p.countries.includes('KR') || p.countries.includes('KP') || p.region === 'korea',
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);

  // Generate Korean market outlook from matched patterns
  const outlook = summarizeKoreanOutlook(matches.map(m => m.pattern));

  // Determine sector signals
  const categoriesInvolved = Array.from(new Set(matches.map(m => m.pattern.category)));
  const sectorSignals: PatternAnalysis['sectorSignals'] = [];
  const seenSectors = new Set<string>();

  for (const rule of SECTOR_ROTATION_RULES) {
    if (rule.category.some(c => categoriesInvolved.includes(c)) && !seenSectors.has(rule.sector)) {
      seenSectors.add(rule.sector);
      // Check if multiple matching categories reinforce the signal
      const matchCount = rule.category.filter(c => categoriesInvolved.includes(c)).length;
      const reinforcedConfidence = Math.min(0.95, rule.confidence * (1 + (matchCount - 1) * 0.1));

      sectorSignals.push({
        sector: rule.sector,
        sectorKo: rule.sectorKo,
        direction: rule.direction,
        confidence: reinforcedConfidence,
        basis: rule.basis,
      });
    }
  }

  // Sort: bearish first (warnings), then bullish
  sectorSignals.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'bearish' ? -1 : 1;
    return b.confidence - a.confidence;
  });

  // Build top analogues for display
  const topAnalogues = matches.slice(0, 3).map(m => ({
    id: m.pattern.id,
    title: m.pattern.title,
    titleKo: m.pattern.titleKo,
    date: m.pattern.date,
    similarity: Math.round(m.similarity * 100),
    kospiChange: m.pattern.outcomes.find(o => o.asset === '^KS11')?.changePercent,
    krwChange: m.pattern.outcomes.find(o => o.asset === 'KRW=X')?.changePercent,
    keyLessonKo: m.pattern.keyLessonKo,
  }));

  // Confidence: based on number of good matches and tag quality
  const avgSimilarity = matches.length ? matches.reduce((s, m) => s + m.similarity, 0) / matches.length : 0;
  const confidenceLevel: PatternAnalysis['confidenceLevel'] =
    avgSimilarity > 0.4 && matches.length >= 3 ? 'high'
    : avgSimilarity > 0.2 || matches.length >= 2 ? 'medium'
    : 'low';

  return {
    timestamp: Date.now(),
    matchedPatterns: matches,
    outlook,
    topAnalogues,
    sectorSignals,
    confidenceLevel,
  };
}

/** Quick text lookup: find all patterns mentioning a term */
export function searchPatterns(query: string): HistoricalPattern[] {
  const q = query.toLowerCase();
  return HISTORICAL_PATTERNS.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.titleKo.includes(q) ||
    p.keywords.some(k => k.toLowerCase().includes(q)) ||
    p.descriptionKo.includes(q)
  );
}

/** Get patterns by category */
export function getPatternsByCategory(category: PatternCategory): HistoricalPattern[] {
  return HISTORICAL_PATTERNS.filter(p => p.category === category);
}

/** Format outlook text for display */
export function formatOutlookKo(outlook: PatternAnalysis['outlook']): string {
  const kospiText = {
    down_sharp: 'KOSPI 급락 예상',
    down_mild: 'KOSPI 약세 예상',
    flat: 'KOSPI 보합 예상',
    up: 'KOSPI 강세 예상',
  }[outlook.kospiExpected] ?? '';

  const krwText = {
    weaken_sharp: 'KRW 급격 약세',
    weaken_mild: 'KRW 소폭 약세',
    stable: 'KRW 안정적',
    strengthen: 'KRW 강세',
  }[outlook.krwExpected] ?? '';

  const safeHaven = outlook.safeHavenDemand ? ' | 금·엔화 강세 예상' : '';

  return `${kospiText} | ${krwText}${safeHaven} | 해소 예상: ${outlook.timeToResolve}`;
}
