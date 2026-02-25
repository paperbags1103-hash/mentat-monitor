/**
 * Event Auto-Tagger — Mentat Monitor
 *
 * Rule-based classifier that maps news events to:
 *  - Sectors (energy, semiconductors, defense, finance...)
 *  - Assets (specific symbols / commodities)
 *  - Geopolitical context (region, countries involved)
 *  - Signal type (military, economic, pandemic, cyber...)
 *
 * Rule-based first (fast, deterministic) → LLM fallback for ambiguous cases.
 */

export type SignalType =
  | 'military'
  | 'diplomatic'
  | 'economic'
  | 'pandemic'
  | 'cyber'
  | 'natural_disaster'
  | 'political'
  | 'energy'
  | 'financial'
  | 'supply_chain';

export type ImpactDirection = 'bullish' | 'bearish' | 'neutral' | 'uncertain';

export interface EventTag {
  signalType: SignalType;
  sectors: string[];          // e.g. ['defense', 'energy']
  relatedAssets: string[];    // e.g. ['LMT', 'WTI', 'KRW=X']
  impactDirection: ImpactDirection;
  impactScore: number;        // 1–5 (magnitude, not direction)
  countries: string[];        // ISO 2-letter
  region: string;             // 'korea', 'middleeast', 'europe', etc.
  confidence: 'high' | 'medium' | 'low';
  tags: string[];             // free-form tags
}

// ─── Rule Tables ─────────────────────────────────────────────────────────────

interface TagRule {
  keywords: string[];
  match: 'any' | 'all';
  result: Partial<EventTag>;
}

const SIGNAL_TYPE_RULES: TagRule[] = [
  {
    keywords: ['missile', 'launch', 'warship', 'airstrike', 'bomb', 'troops', 'military', 'attack', 'invasion', 'war'],
    match: 'any',
    result: { signalType: 'military', impactDirection: 'bearish', impactScore: 4 },
  },
  {
    keywords: ['pandemic', 'outbreak', 'virus', 'epidemic', 'quarantine', 'lockdown', 'pathogen'],
    match: 'any',
    result: { signalType: 'pandemic', impactDirection: 'bearish', impactScore: 4 },
  },
  {
    keywords: ['cyberattack', 'ransomware', 'hack', 'data breach', 'malware', 'ddos', 'critical infrastructure'],
    match: 'any',
    result: { signalType: 'cyber', impactDirection: 'bearish', impactScore: 3 },
  },
  {
    keywords: ['earthquake', 'tsunami', 'hurricane', 'typhoon', 'volcano', 'flood', 'disaster'],
    match: 'any',
    result: { signalType: 'natural_disaster', impactDirection: 'bearish', impactScore: 3 },
  },
  {
    keywords: ['interest rate', 'rate hike', 'rate cut', 'inflation', 'gdp', 'recession', 'fed', 'fomc', 'ecb', '금리'],
    match: 'any',
    result: { signalType: 'financial', impactDirection: 'uncertain', impactScore: 3 },
  },
  {
    keywords: ['sanctions', 'tariff', 'trade war', 'export ban', 'embargo', '제재'],
    match: 'any',
    result: { signalType: 'economic', impactDirection: 'bearish', impactScore: 3 },
  },
  {
    keywords: ['oil', 'gas', 'opec', 'pipeline', 'energy', 'lng', 'nuclear plant', 'refinery'],
    match: 'any',
    result: { signalType: 'energy', impactDirection: 'uncertain', impactScore: 2 },
  },
  {
    keywords: ['summit', 'treaty', 'negotiation', 'ceasefire', 'agreement', 'diplomatic'],
    match: 'any',
    result: { signalType: 'diplomatic', impactDirection: 'bullish', impactScore: 2 },
  },
  {
    keywords: ['coup', 'election', 'protest', 'riot', 'government collapse', 'political crisis'],
    match: 'any',
    result: { signalType: 'political', impactDirection: 'bearish', impactScore: 3 },
  },
  {
    keywords: ['supply chain', 'shortage', 'port closure', 'shipping', 'container', 'suez', 'strait'],
    match: 'any',
    result: { signalType: 'supply_chain', impactDirection: 'bearish', impactScore: 2 },
  },
];

const SECTOR_RULES: TagRule[] = [
  {
    keywords: ['semiconductor', 'chip', 'tsmc', 'samsung', 'nvidia', 'intel', 'asml', 'sk hynix', 'micron', '반도체'],
    match: 'any',
    result: { sectors: ['semiconductors'], relatedAssets: ['NVDA', 'TSM', '005930.KS', 'ASML', 'MU'] },
  },
  {
    keywords: ['oil', 'opec', 'crude', 'petroleum', 'refiner', 'energy'],
    match: 'any',
    result: { sectors: ['energy'], relatedAssets: ['CL=F', 'XOM', 'CVX', 'BP'] },
  },
  {
    keywords: ['gold', 'silver', 'precious metal', 'mining', 'bullion', '금', '은'],
    match: 'any',
    result: { sectors: ['precious_metals'], relatedAssets: ['GC=F', 'SI=F', 'GLD', 'SLV', 'GDX'] },
  },
  {
    keywords: ['defense', 'military spending', 'weapon', 'lockheed', 'raytheon', 'northrop', 'boeing defense', '방산'],
    match: 'any',
    result: { sectors: ['defense'], relatedAssets: ['LMT', 'RTX', 'NOC', 'BA', 'GD'] },
  },
  {
    keywords: ['bank', 'financial crisis', 'credit', 'bond', 'treasury', 'fed', 'central bank', '은행', '금융'],
    match: 'any',
    result: { sectors: ['financials'], relatedAssets: ['JPM', 'BAC', 'GS', 'TLT'] },
  },
  {
    keywords: ['bitcoin', 'crypto', 'ethereum', 'stablecoin', 'defi', 'blockchain', '비트코인', '가상화폐'],
    match: 'any',
    result: { sectors: ['crypto'], relatedAssets: ['BTC-USD', 'ETH-USD'] },
  },
  {
    keywords: ['wheat', 'corn', 'food', 'grain', 'agriculture', 'famine', 'drought', '식량', '곡물'],
    match: 'any',
    result: { sectors: ['agriculture'], relatedAssets: ['ZW=F', 'ZC=F', 'WEAT'] },
  },
  {
    keywords: ['shipping', 'freight', 'container', 'port', 'maersk', 'cosco', '해운', '물류'],
    match: 'any',
    result: { sectors: ['shipping'], relatedAssets: ['MAERSK-B.CO', 'ZIM'] },
  },
  {
    keywords: ['lithium', 'cobalt', 'ev', 'electric vehicle', 'battery', 'tesla', '전기차', '배터리'],
    match: 'any',
    result: { sectors: ['ev_battery'], relatedAssets: ['TSLA', 'LIT', 'ALB'] },
  },
];

const REGION_RULES: { keywords: string[]; region: string; countries: string[] }[] = [
  { keywords: ['korea', '한국', '북한', 'dprk', 'north korea', 'south korea', 'pyongyang', 'seoul', 'korean'], region: 'korea', countries: ['KR', 'KP'] },
  { keywords: ['taiwan', 'tsmc', 'taipei', 'strait'], region: 'taiwan', countries: ['TW', 'CN'] },
  { keywords: ['china', 'beijing', 'shanghai', 'xi jinping', 'pla', 'chinese'], region: 'china', countries: ['CN'] },
  { keywords: ['middle east', 'israel', 'iran', 'gaza', 'hamas', 'hezbollah', 'lebanon', 'iraq', 'saudi', 'yemen', 'persian gulf'], region: 'middleeast', countries: ['IL', 'IR', 'SA', 'YE', 'IQ', 'LB'] },
  { keywords: ['ukraine', 'russia', 'moscow', 'kyiv', 'putin', 'nato', 'crimea', 'donbas'], region: 'europe', countries: ['UA', 'RU'] },
  { keywords: ['europe', 'eu', 'germany', 'france', 'uk', 'britain', 'ecb'], region: 'europe', countries: ['DE', 'FR', 'GB', 'EU'] },
  { keywords: ['japan', 'tokyo', 'yen', 'boj', 'nikkei', '일본'], region: 'japan', countries: ['JP'] },
  { keywords: ['india', 'pakistan', 'delhi', 'mumbai', 'modi'], region: 'southasia', countries: ['IN', 'PK'] },
  { keywords: ['iran', 'tehran', 'strait of hormuz', 'persian'], region: 'iran', countries: ['IR'] },
  { keywords: ['us', 'usa', 'america', 'washington', 'federal reserve', 'nasdaq', 'sp500', 'wall street'], region: 'us', countries: ['US'] },
];

// ─── Core Tagger ─────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ');
}

function matchesRule(text: string, rule: TagRule): boolean {
  const normalized = normalize(text);
  if (rule.match === 'any') {
    return rule.keywords.some((kw) => normalized.includes(kw.toLowerCase()));
  }
  return rule.keywords.every((kw) => normalized.includes(kw.toLowerCase()));
}

export function tagEvent(title: string, description = ''): EventTag {
  const text = `${title} ${description}`;

  // Detect signal type
  let signalType: SignalType = 'political';
  let impactDirection: ImpactDirection = 'neutral';
  let impactScore = 1;

  for (const rule of SIGNAL_TYPE_RULES) {
    if (matchesRule(text, rule)) {
      signalType = rule.result.signalType ?? signalType;
      impactDirection = rule.result.impactDirection ?? impactDirection;
      impactScore = rule.result.impactScore ?? impactScore;
      break; // first match wins
    }
  }

  // Detect sectors + related assets
  const sectors: string[] = [];
  const relatedAssets: string[] = [];
  for (const rule of SECTOR_RULES) {
    if (matchesRule(text, rule)) {
      sectors.push(...(rule.result.sectors ?? []));
      relatedAssets.push(...(rule.result.relatedAssets ?? []));
    }
  }

  // Detect region + countries
  let region = 'global';
  const countries: string[] = [];
  for (const r of REGION_RULES) {
    if (r.keywords.some((kw) => normalize(text).includes(kw.toLowerCase()))) {
      region = r.region;
      countries.push(...r.countries);
      break;
    }
  }

  // Add region-specific assets
  if (region === 'korea') relatedAssets.push('^KS11', '^KQ11', 'KRW=X');
  if (region === 'japan') relatedAssets.push('^N225', 'JPY=X');
  if (region === 'taiwan') relatedAssets.push('^TWII', 'TSM');
  if (region === 'iran' || region === 'middleeast') relatedAssets.push('CL=F', 'GC=F');

  // Confidence based on how many rules fired
  const rulesFired = sectors.length + (region !== 'global' ? 1 : 0);
  const confidence: EventTag['confidence'] = rulesFired >= 3 ? 'high' : rulesFired >= 1 ? 'medium' : 'low';

  // Free-form tags
  const tags: string[] = [signalType, region, ...sectors];

  return {
    signalType,
    sectors: [...new Set(sectors)],
    relatedAssets: [...new Set(relatedAssets)],
    impactDirection,
    impactScore,
    countries: [...new Set(countries)],
    region,
    confidence,
    tags: [...new Set(tags)],
  };
}

/** Batch tag multiple events */
export function tagEvents(events: Array<{ title: string; description?: string }>): EventTag[] {
  return events.map((e) => tagEvent(e.title, e.description));
}
