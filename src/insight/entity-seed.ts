/**
 * Entity Graph Seed Data — Mentat Monitor Insight Layer
 * 55 entities + ~60 edges, Korean investor focused
 */

import type { Entity, Edge } from './types.js';

export const SEED_ENTITIES: Entity[] = [
  // ─── Countries ──────────────────────────────────────────────────────────────
  { id: 'country:south_korea', type: 'country', name: 'South Korea', nameKo: '대한민국', tags: ['korea', 'rok', '한국'] },
  { id: 'country:north_korea', type: 'country', name: 'North Korea', nameKo: '북한', tags: ['dprk', 'nk', '조선'] },
  { id: 'country:usa', type: 'country', name: 'United States', nameKo: '미국', tags: ['us', 'america', '미'] },
  { id: 'country:china', type: 'country', name: 'China', nameKo: '중국', tags: ['prc', 'beijing', '중'] },
  { id: 'country:japan', type: 'country', name: 'Japan', nameKo: '일본', tags: ['jpn', 'tokyo', '일'] },
  { id: 'country:russia', type: 'country', name: 'Russia', nameKo: '러시아', tags: ['rus', 'moscow'] },
  { id: 'country:taiwan', type: 'country', name: 'Taiwan', nameKo: '대만', tags: ['roc', 'taipei', 'tpe'] },
  { id: 'country:iran', type: 'country', name: 'Iran', nameKo: '이란', tags: ['tehran', 'persia'] },
  { id: 'country:saudi_arabia', type: 'country', name: 'Saudi Arabia', nameKo: '사우디아라비아', tags: ['ksa', 'riyadh', 'aramco'] },
  { id: 'country:ukraine', type: 'country', name: 'Ukraine', nameKo: '우크라이나', tags: ['kyiv', 'odesa'] },
  { id: 'country:israel', type: 'country', name: 'Israel', nameKo: '이스라엘', tags: ['tel aviv', 'jerusalem'] },

  // ─── Regions ────────────────────────────────────────────────────────────────
  { id: 'region:korean_peninsula', type: 'region', name: 'Korean Peninsula', nameKo: '한반도', tags: ['korea', 'dmz', 'nll'] },
  { id: 'region:taiwan_strait', type: 'region', name: 'Taiwan Strait', nameKo: '대만해협', tags: ['taiwan', 'formosa strait'] },
  { id: 'region:middle_east', type: 'region', name: 'Middle East', nameKo: '중동', tags: ['opec', 'hormuz', 'gulf'] },
  { id: 'region:east_asia', type: 'region', name: 'East Asia', nameKo: '동아시아', tags: ['asia pacific'] },
  { id: 'region:europe', type: 'region', name: 'Europe', nameKo: '유럽', tags: ['eu', 'nato', 'eastern europe'] },
  { id: 'region:south_china_sea', type: 'region', name: 'South China Sea', nameKo: '남중국해', tags: ['spratlys', 'paracels'] },

  // ─── Assets ─────────────────────────────────────────────────────────────────
  { id: 'asset:KS11', type: 'asset', name: 'KOSPI', nameKo: '코스피 지수', tags: ['kospi', '^KS11'], meta: { ticker: '^KS11' } },
  { id: 'asset:KQ11', type: 'asset', name: 'KOSDAQ', nameKo: '코스닥 지수', tags: ['kosdaq', '^KQ11'], meta: { ticker: '^KQ11' } },
  { id: 'asset:USDKRW', type: 'asset', name: 'USD/KRW', nameKo: '원달러 환율', tags: ['krw', 'won', 'fx'], meta: { ticker: 'KRW=X' } },
  { id: 'asset:SPX', type: 'asset', name: 'S&P 500', nameKo: 'S&P 500', tags: ['spx', 'sp500'], meta: { ticker: '^SPX' } },
  { id: 'asset:VIX', type: 'asset', name: 'VIX Fear Index', nameKo: 'VIX 공포지수', tags: ['vix', 'volatility'], meta: { ticker: '^VIX' } },
  { id: 'asset:GOLD', type: 'asset', name: 'Gold', nameKo: '금 현물', tags: ['gold', 'xau', 'gc=f'], meta: { ticker: 'GC=F' } },
  { id: 'asset:OIL', type: 'asset', name: 'Crude Oil (WTI)', nameKo: 'WTI 원유', tags: ['wti', 'oil', 'brent'], meta: { ticker: 'CL=F' } },
  { id: 'asset:BTC', type: 'asset', name: 'Bitcoin', nameKo: '비트코인', tags: ['btc', 'crypto', 'upbit'] },
  { id: 'asset:USDJPY', type: 'asset', name: 'USD/JPY', nameKo: '엔달러', tags: ['jpy', 'yen'], meta: { ticker: 'JPY=X' } },
  { id: 'asset:US10Y', type: 'asset', name: 'US 10Y Treasury', nameKo: '미국 10년물 국채', tags: ['treasury', 'bond', 'tnx'] },
  { id: 'asset:DXY', type: 'asset', name: 'US Dollar Index', nameKo: '달러 인덱스', tags: ['dxy', 'dollar'] },

  // ─── Sectors ────────────────────────────────────────────────────────────────
  { id: 'sector:defense', type: 'sector', name: 'Defense', nameKo: '방산', tags: ['military', 'weapons', 'aerospace'] },
  { id: 'sector:semiconductor', type: 'sector', name: 'Semiconductor', nameKo: '반도체', tags: ['chip', 'fab', 'memory', 'dram'] },
  { id: 'sector:energy', type: 'sector', name: 'Energy', nameKo: '에너지', tags: ['oil', 'gas', 'refinery'] },
  { id: 'sector:shipping', type: 'sector', name: 'Shipping', nameKo: '해운', tags: ['bdry', 'container', 'freight'] },
  { id: 'sector:nuclear_power', type: 'sector', name: 'Nuclear Power', nameKo: '원자력', tags: ['uranium', 'nuclear energy'] },
  { id: 'sector:bio_pharma', type: 'sector', name: 'Bio/Pharma', nameKo: '바이오/제약', tags: ['vaccine', 'pandemic', 'biotech'] },
  { id: 'sector:cybersecurity', type: 'sector', name: 'Cybersecurity', nameKo: '사이버보안', tags: ['security', 'firewall'] },
  { id: 'sector:finance', type: 'sector', name: 'Finance / Banks', nameKo: '금융/은행', tags: ['bank', 'credit', 'insurance'] },
  { id: 'sector:autos', type: 'sector', name: 'Automobiles', nameKo: '자동차', tags: ['ev', 'car', 'auto'] },
  { id: 'sector:batteries', type: 'sector', name: 'EV Batteries', nameKo: '배터리/2차전지', tags: ['battery', 'ev', 'cathode'] },

  // ─── Korean Companies ────────────────────────────────────────────────────────
  { id: 'company:samsung_elec', type: 'company', name: 'Samsung Electronics', nameKo: '삼성전자', tags: ['005930', 'samsung'], meta: { ticker: '005930.KS', kospiWeight: 0.25 } },
  { id: 'company:sk_hynix', type: 'company', name: 'SK Hynix', nameKo: 'SK하이닉스', tags: ['000660', 'hynix', 'memory'], meta: { ticker: '000660.KS' } },
  { id: 'company:hanwha_aero', type: 'company', name: 'Hanwha Aerospace', nameKo: '한화에어로스페이스', tags: ['012450', 'hanwha'], meta: { ticker: '012450.KS' } },
  { id: 'company:kai', type: 'company', name: 'Korea Aerospace (KAI)', nameKo: '한국항공우주', tags: ['047810', 'kai'], meta: { ticker: '047810.KS' } },
  { id: 'company:lge_battery', type: 'company', name: 'LG Energy Solution', nameKo: 'LG에너지솔루션', tags: ['373220', 'lges'], meta: { ticker: '373220.KS' } },
  { id: 'company:samsung_sdi', type: 'company', name: 'Samsung SDI', nameKo: '삼성SDI', tags: ['006400'], meta: { ticker: '006400.KS' } },
  { id: 'company:celltrion', type: 'company', name: 'Celltrion', nameKo: '셀트리온', tags: ['068270'], meta: { ticker: '068270.KS' } },
  { id: 'company:hhi', type: 'company', name: 'HD Hyundai Heavy Industries', nameKo: 'HD현대중공업', tags: ['329180'], meta: { ticker: '329180.KS' } },
  { id: 'company:tsmc', type: 'company', name: 'TSMC', nameKo: 'TSMC', tags: ['tsm', 'taiwan semi'], meta: { ticker: 'TSM' } },

  // ─── Institutions ────────────────────────────────────────────────────────────
  { id: 'inst:fed', type: 'institution', name: 'US Federal Reserve', nameKo: '미 연준(Fed)', tags: ['fomc', 'fed', 'powell'] },
  { id: 'inst:bok', type: 'institution', name: 'Bank of Korea', nameKo: '한국은행(BOK)', tags: ['bok', '한은', 'mpb'] },
  { id: 'inst:boj', type: 'institution', name: 'Bank of Japan', nameKo: '일본은행(BOJ)', tags: ['boj', '일은'] },
  { id: 'inst:opec', type: 'institution', name: 'OPEC+', nameKo: 'OPEC+', tags: ['opec', 'oil cartel'] },
  { id: 'inst:iaea', type: 'institution', name: 'IAEA', nameKo: '국제원자력기구(IAEA)', tags: ['iaea', 'nuclear watchdog'] },

  // ─── Event Templates ─────────────────────────────────────────────────────────
  { id: 'event:nk_missile', type: 'event_template', name: 'NK Missile Launch', nameKo: '북한 미사일 발사', tags: ['missile', 'icbm', 'slbm', 'provocation', '화성'] },
  { id: 'event:nk_nuclear', type: 'event_template', name: 'NK Nuclear Test', nameKo: '북한 핵실험', tags: ['nuclear test', 'underground', '핵'] },
  { id: 'event:taiwan_crisis', type: 'event_template', name: 'Taiwan Strait Crisis', nameKo: '대만해협 위기', tags: ['taiwan', 'blockade', 'invasion', 'pla'] },
  { id: 'event:oil_shock', type: 'event_template', name: 'Oil Supply Shock', nameKo: '원유 공급 충격', tags: ['oil', 'opec', 'embargo', 'hormuz', 'aramco'] },
  { id: 'event:fed_pivot', type: 'event_template', name: 'Fed Policy Pivot', nameKo: '연준 정책 전환', tags: ['rate cut', 'rate hike', 'pivot', 'fomc'] },
  { id: 'event:pandemic', type: 'event_template', name: 'Pandemic / Outbreak', nameKo: '팬데믹/감염병 발생', tags: ['pandemic', 'virus', 'outbreak', 'who', 'quarantine'] },
  { id: 'event:korea_politics', type: 'event_template', name: 'Korean Political Crisis', nameKo: '한국 정치 위기', tags: ['탄핵', '계엄', 'impeachment', 'martial law', '국회'] },
];

export const SEED_EDGES: Edge[] = [
  // ─── Geographic containment ──────────────────────────────────────────────────
  { from: 'country:north_korea', to: 'region:korean_peninsula', type: 'located_in', weight: 1.0 },
  { from: 'country:south_korea', to: 'region:korean_peninsula', type: 'located_in', weight: 1.0 },
  { from: 'country:taiwan', to: 'region:taiwan_strait', type: 'located_in', weight: 1.0 },
  { from: 'country:china', to: 'region:taiwan_strait', type: 'located_in', weight: 0.7 },
  { from: 'country:china', to: 'region:south_china_sea', type: 'located_in', weight: 0.9 },
  { from: 'country:iran', to: 'region:middle_east', type: 'located_in', weight: 1.0 },
  { from: 'country:saudi_arabia', to: 'region:middle_east', type: 'located_in', weight: 1.0 },
  { from: 'country:israel', to: 'region:middle_east', type: 'located_in', weight: 1.0 },
  { from: 'country:ukraine', to: 'region:europe', type: 'located_in', weight: 0.8 },
  { from: 'country:russia', to: 'region:europe', type: 'located_in', weight: 0.5 },
  { from: 'country:japan', to: 'region:east_asia', type: 'located_in', weight: 1.0 },
  { from: 'country:south_korea', to: 'region:east_asia', type: 'located_in', weight: 1.0 },

  // ─── Adversarial / Alliance ──────────────────────────────────────────────────
  { from: 'country:north_korea', to: 'country:south_korea', type: 'adversary_of', weight: 1.0 },
  { from: 'country:north_korea', to: 'country:usa', type: 'adversary_of', weight: 0.9 },
  { from: 'country:north_korea', to: 'country:japan', type: 'adversary_of', weight: 0.8 },
  { from: 'country:china', to: 'country:taiwan', type: 'adversary_of', weight: 0.85 },
  { from: 'country:russia', to: 'country:ukraine', type: 'adversary_of', weight: 1.0 },
  { from: 'country:usa', to: 'country:south_korea', type: 'ally_of', weight: 0.95 },
  { from: 'country:usa', to: 'country:japan', type: 'ally_of', weight: 0.9 },

  // ─── NK events → assets/sectors (traversable) ────────────────────────────────
  { from: 'event:nk_missile', to: 'country:north_korea', type: 'affects', weight: 1.0 },
  { from: 'event:nk_missile', to: 'region:korean_peninsula', type: 'affects', weight: 1.0 },
  { from: 'event:nk_missile', to: 'asset:KS11', type: 'affects', weight: 0.75, meta: { direction: 'risk_off' } },
  { from: 'event:nk_missile', to: 'asset:USDKRW', type: 'affects', weight: 0.80, meta: { direction: 'risk_off', note: 'KRW weakens' } },
  { from: 'event:nk_missile', to: 'asset:GOLD', type: 'affects', weight: 0.55, meta: { direction: 'risk_on' } },
  { from: 'event:nk_missile', to: 'asset:USDJPY', type: 'affects', weight: 0.55, meta: { direction: 'risk_off', note: 'JPY strengthens' } },
  { from: 'event:nk_missile', to: 'sector:defense', type: 'affects', weight: 0.90, meta: { direction: 'risk_on' } },
  { from: 'event:nk_nuclear', to: 'event:nk_missile', type: 'affects', weight: 0.9, meta: { note: 'nuclear test amplifies missile risk' } },
  { from: 'event:nk_nuclear', to: 'asset:KS11', type: 'affects', weight: 0.90, meta: { direction: 'risk_off' } },
  { from: 'event:nk_nuclear', to: 'sector:nuclear_power', type: 'affects', weight: 0.6, meta: { direction: 'risk_off' } },

  // ─── Taiwan → semiconductors ─────────────────────────────────────────────────
  { from: 'event:taiwan_crisis', to: 'region:taiwan_strait', type: 'affects', weight: 1.0 },
  { from: 'event:taiwan_crisis', to: 'company:tsmc', type: 'affects', weight: 1.0, meta: { direction: 'risk_off' } },
  { from: 'event:taiwan_crisis', to: 'sector:semiconductor', type: 'affects', weight: 0.95, meta: { direction: 'risk_off' } },
  { from: 'event:taiwan_crisis', to: 'company:samsung_elec', type: 'affects', weight: 0.65, meta: { direction: 'ambiguous', note: 'TSMC replacement demand vs. risk-off' } },
  { from: 'event:taiwan_crisis', to: 'company:sk_hynix', type: 'affects', weight: 0.60, meta: { direction: 'ambiguous' } },
  { from: 'event:taiwan_crisis', to: 'asset:KS11', type: 'affects', weight: 0.70, meta: { direction: 'risk_off' } },
  { from: 'event:taiwan_crisis', to: 'sector:shipping', type: 'affects', weight: 0.55, meta: { direction: 'risk_off', note: 'Taiwan Strait shipping lane blockade' } },

  // ─── Companies → sectors ─────────────────────────────────────────────────────
  { from: 'company:samsung_elec', to: 'sector:semiconductor', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:sk_hynix', to: 'sector:semiconductor', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:tsmc', to: 'sector:semiconductor', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:hanwha_aero', to: 'sector:defense', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:kai', to: 'sector:defense', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:hhi', to: 'sector:shipping', type: 'belongs_to_sector', weight: 0.6 },
  { from: 'company:hhi', to: 'sector:defense', type: 'belongs_to_sector', weight: 0.5, meta: { note: 'Naval vessel production' } },
  { from: 'company:lge_battery', to: 'sector:batteries', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:samsung_sdi', to: 'sector:batteries', type: 'belongs_to_sector', weight: 1.0 },
  { from: 'company:celltrion', to: 'sector:bio_pharma', type: 'belongs_to_sector', weight: 1.0 },

  // ─── KOSPI composition ───────────────────────────────────────────────────────
  { from: 'company:samsung_elec', to: 'asset:KS11', type: 'affects', weight: 0.25, meta: { note: '~25% KOSPI weight' } },
  { from: 'company:sk_hynix', to: 'asset:KS11', type: 'affects', weight: 0.06 },

  // ─── Oil shock ───────────────────────────────────────────────────────────────
  { from: 'event:oil_shock', to: 'region:middle_east', type: 'affects', weight: 0.8 },
  { from: 'event:oil_shock', to: 'asset:OIL', type: 'affects', weight: 1.0, meta: { direction: 'risk_on' } },
  { from: 'event:oil_shock', to: 'sector:energy', type: 'affects', weight: 0.85, meta: { direction: 'risk_on' } },
  { from: 'event:oil_shock', to: 'asset:KS11', type: 'affects', weight: 0.60, meta: { direction: 'risk_off', note: 'Korea energy importer' } },
  { from: 'event:oil_shock', to: 'asset:USDKRW', type: 'affects', weight: 0.55, meta: { direction: 'risk_off' } },
  { from: 'inst:opec', to: 'asset:OIL', type: 'affects', weight: 0.80 },

  // ─── Monetary policy ─────────────────────────────────────────────────────────
  { from: 'event:fed_pivot', to: 'inst:fed', type: 'affects', weight: 1.0 },
  { from: 'inst:fed', to: 'asset:US10Y', type: 'affects', weight: 0.90 },
  { from: 'inst:fed', to: 'asset:DXY', type: 'affects', weight: 0.85 },
  { from: 'inst:fed', to: 'asset:USDKRW', type: 'affects', weight: 0.70 },
  { from: 'inst:fed', to: 'asset:SPX', type: 'affects', weight: 0.80 },
  { from: 'inst:bok', to: 'asset:USDKRW', type: 'affects', weight: 0.80 },
  { from: 'inst:bok', to: 'asset:KS11', type: 'affects', weight: 0.60 },

  // ─── Pandemic ────────────────────────────────────────────────────────────────
  { from: 'event:pandemic', to: 'sector:bio_pharma', type: 'affects', weight: 0.90, meta: { direction: 'risk_on' } },
  { from: 'event:pandemic', to: 'asset:KS11', type: 'affects', weight: 0.75, meta: { direction: 'risk_off' } },
  { from: 'event:pandemic', to: 'sector:shipping', type: 'affects', weight: 0.60, meta: { direction: 'risk_off' } },
  { from: 'event:pandemic', to: 'asset:OIL', type: 'affects', weight: 0.70, meta: { direction: 'risk_off', note: 'demand destruction' } },

  // ─── Korean political crisis ─────────────────────────────────────────────────
  { from: 'event:korea_politics', to: 'country:south_korea', type: 'affects', weight: 1.0 },
  { from: 'event:korea_politics', to: 'asset:KS11', type: 'affects', weight: 0.85, meta: { direction: 'risk_off' } },
  { from: 'event:korea_politics', to: 'asset:USDKRW', type: 'affects', weight: 0.90, meta: { direction: 'risk_off' } },
  { from: 'event:korea_politics', to: 'asset:KQ11', type: 'affects', weight: 0.80, meta: { direction: 'risk_off' } },

  // ─── Safe haven correlations (inverse) ───────────────────────────────────────
  { from: 'asset:VIX', to: 'asset:KS11', type: 'historically_correlated', weight: 0.80, meta: { inverse: true } },
  { from: 'asset:VIX', to: 'asset:SPX', type: 'historically_correlated', weight: 0.90, meta: { inverse: true } },
  { from: 'asset:USDKRW', to: 'asset:KS11', type: 'historically_correlated', weight: 0.75, meta: { inverse: true } },
  { from: 'asset:GOLD', to: 'asset:USDJPY', type: 'historically_correlated', weight: 0.60, directional: false },
  { from: 'asset:DXY', to: 'asset:GOLD', type: 'historically_correlated', weight: 0.70, meta: { inverse: true } },

  // ─── Supply chain dependencies ────────────────────────────────────────────────
  { from: 'country:japan', to: 'sector:semiconductor', type: 'supply_chain_dependency', weight: 0.70, meta: { note: 'photoresist, fluorine materials' } },
  { from: 'country:china', to: 'sector:batteries', type: 'supply_chain_dependency', weight: 0.80, meta: { note: 'lithium, cathode materials' } },
  { from: 'sector:semiconductor', to: 'sector:autos', type: 'supply_chain_dependency', weight: 0.65 },
  { from: 'sector:semiconductor', to: 'sector:batteries', type: 'supply_chain_dependency', weight: 0.50 },
];
