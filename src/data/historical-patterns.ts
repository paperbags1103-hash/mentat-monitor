/**
 * Historical Geopolitical Event Patterns — Mentat Monitor Phase 3
 *
 * Curated database of major events with documented market outcomes.
 * Used by the pattern matcher to find analogues for current events.
 *
 * Price outcomes are approximate peak-to-trough or event-window changes.
 * Sources: Bloomberg, FactSet, academic papers, news archives.
 */

export type PatternCategory =
  | 'war'
  | 'nk_provocation'
  | 'pandemic'
  | 'financial_crisis'
  | 'cyber'
  | 'political'
  | 'energy_shock'
  | 'nuclear'
  | 'diplomatic'
  | 'natural_disaster';

export interface MarketOutcome {
  asset: string;          // e.g. '^KS11', 'SPY', 'GC=F', 'KRW=X', 'BTC-USD'
  label: string;          // human-readable
  changePercent: number;  // % change during event window
  windowDays: number;     // days over which change occurred
  direction: 'up' | 'down' | 'flat';
  note?: string;          // qualifier
}

export interface HistoricalPattern {
  id: string;
  title: string;
  titleKo: string;
  date: string;           // ISO 8601
  category: PatternCategory;
  subcategory?: string;
  description: string;
  descriptionKo: string;
  countries: string[];    // ISO 2-letter
  region: string;
  signalTypes: string[];  // matches SignalType from event-tagger
  keywords: string[];     // for similarity matching
  severity: 1 | 2 | 3 | 4 | 5;  // 5 = global catastrophe
  outcomes: MarketOutcome[];
  resolution: 'escalated' | 'de-escalated' | 'ongoing' | 'resolved';
  resolutionDays?: number;
  keyLesson: string;
  keyLessonKo: string;
}

export const HISTORICAL_PATTERNS: HistoricalPattern[] = [
  // ─── Korean Peninsula ──────────────────────────────────────────────────────
  {
    id: 'nk-icbm-2017',
    title: 'North Korea ICBM Test + H-Bomb Test (2017)',
    titleKo: '북한 ICBM + 수소탄 실험 (2017)',
    date: '2017-09-03',
    category: 'nk_provocation',
    description: 'North Korea conducted its 6th nuclear test (est. 250kt) and multiple ICBM launches.',
    descriptionKo: '북한이 6차 핵실험(추정 250kt)과 ICBM 발사를 잇따라 감행.',
    countries: ['KP', 'KR'],
    region: 'korea',
    signalTypes: ['military', 'nuclear'],
    keywords: ['north korea', 'icbm', 'nuclear', 'missile', 'hydrogen bomb', '핵실험', 'ICBM'],
    severity: 5,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -1.8, windowDays: 5, direction: 'down', note: '이후 급반등, 시장 내성 형성' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +1.2, windowDays: 3, direction: 'up', note: 'KRW 일시적 약세' },
      { asset: 'GC=F', label: 'Gold', changePercent: +2.1, windowDays: 5, direction: 'up' },
      { asset: '^N225', label: 'Nikkei', changePercent: -1.5, windowDays: 3, direction: 'down' },
      { asset: 'JPY=X', label: 'USD/JPY', changePercent: -1.0, windowDays: 3, direction: 'down', note: '엔화 강세' },
    ],
    resolution: 'de-escalated',
    resolutionDays: 30,
    keyLesson: 'KOSPI quickly priced in NK risks after repeated provocations. Each test caused diminishing market reaction.',
    keyLessonKo: '반복된 도발로 시장 내성 형성. 매번 KOSPI 충격 폭이 줄어들었음. "NK 디스카운트"가 이미 반영됨.',
  },
  {
    id: 'nk-2022-icbm',
    title: 'North Korea Hwasong-17 ICBM Test (2022)',
    titleKo: '북한 화성-17형 ICBM (2022)',
    date: '2022-11-18',
    category: 'nk_provocation',
    description: 'Largest North Korean ICBM test; flew ~1,000km, 6,000km+ altitude.',
    descriptionKo: '사거리 1만5천km 이상 추정 화성-17형 발사. 역대 최대 규모.',
    countries: ['KP', 'KR'],
    region: 'korea',
    signalTypes: ['military'],
    keywords: ['north korea', 'hwasong', 'icbm', 'missile launch', '화성', 'ICBM 발사'],
    severity: 4,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -0.8, windowDays: 2, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +0.5, windowDays: 2, direction: 'up' },
      { asset: 'GC=F', label: 'Gold', changePercent: +0.7, windowDays: 3, direction: 'up' },
    ],
    resolution: 'de-escalated',
    resolutionDays: 7,
    keyLesson: 'Market had heavily priced in NK missile risk by 2022. Small market move despite historically large missile.',
    keyLessonKo: '2022년에는 이미 NK 리스크가 시장에 충분히 반영됨. 역대 최대 미사일임에도 시장 반응 제한적.',
  },
  {
    id: 'kospi-martial-law-2024',
    title: 'South Korea Martial Law Declaration (2024)',
    titleKo: '한국 계엄령 선포 및 해제 (2024)',
    date: '2024-12-03',
    category: 'political',
    description: 'President Yoon declared martial law citing anti-state forces. National Assembly voted to lift it within hours.',
    descriptionKo: '윤석열 대통령 계엄 선포, 국회 투표로 6시간 만에 해제. 탄핵 정국 시작.',
    countries: ['KR'],
    region: 'korea',
    signalTypes: ['political'],
    keywords: ['martial law', 'impeachment', 'south korea', 'yoon', '계엄', '탄핵', '윤석열'],
    severity: 4,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -2.5, windowDays: 1, direction: 'down', note: '계엄 선포 당일' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +2.1, windowDays: 1, direction: 'up' },
      { asset: '^KS11', label: 'KOSPI (2주 후)', changePercent: -8.0, windowDays: 14, direction: 'down', note: '탄핵 정국 지속' },
      { asset: 'KRW=X', label: 'USD/KRW (2주 후)', changePercent: +4.5, windowDays: 14, direction: 'up' },
    ],
    resolution: 'resolved',
    resolutionDays: 90,
    keyLesson: 'Political shock in Korea = significant KRW weakness. Market initially overshoots, then partially recovers as situation clarifies.',
    keyLessonKo: '한국 정치 충격 = KRW 급락. 불확실성 지속 시 외국인 이탈 및 KOSPI 약세 장기화.',
  },
  // ─── Global Wars ───────────────────────────────────────────────────────────
  {
    id: 'ukraine-invasion-2022',
    title: 'Russia Invades Ukraine (2022)',
    titleKo: '러시아 우크라이나 침공 (2022)',
    date: '2022-02-24',
    category: 'war',
    description: 'Russia launched full-scale invasion of Ukraine. Oil, gas, wheat, defense stocks surged.',
    descriptionKo: '러시아 전면 침공. 유가·천연가스·밀·방산주 급등.',
    countries: ['RU', 'UA'],
    region: 'europe',
    signalTypes: ['military', 'energy', 'supply_chain'],
    keywords: ['russia', 'ukraine', 'invasion', 'war', 'sanctions', '러시아', '우크라이나', '침공'],
    severity: 5,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -3.0, windowDays: 5, direction: 'down', note: '초기 반응; 이후 회복' },
      { asset: '^KS11', label: 'KOSPI', changePercent: -3.2, windowDays: 5, direction: 'down' },
      { asset: 'GC=F', label: 'Gold', changePercent: +5.5, windowDays: 10, direction: 'up' },
      { asset: 'CL=F', label: 'WTI Crude', changePercent: +26.0, windowDays: 14, direction: 'up' },
      { asset: 'LMT', label: 'Lockheed Martin', changePercent: +15.0, windowDays: 30, direction: 'up' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +3.0, windowDays: 14, direction: 'up', note: 'KRW 에너지 비용 취약' },
      { asset: 'WHEAT', label: 'Wheat Futures', changePercent: +55.0, windowDays: 30, direction: 'up' },
    ],
    resolution: 'ongoing',
    keyLesson: 'Energy importers (South Korea) hurt most. Defense/commodity stocks surge. Initial equity shock followed by recovery in non-European markets.',
    keyLessonKo: '에너지 수입국(한국)에 직접 타격. 방산·원자재 급등. 침공 초기 주식 충격 후 비유럽 시장 일부 회복.',
  },
  {
    id: 'gulf-war-1990',
    title: 'Iraq Invasion of Kuwait / Gulf War (1990)',
    titleKo: '이라크 쿠웨이트 침공 / 걸프전 (1990)',
    date: '1990-08-02',
    category: 'war',
    description: 'Iraq invaded Kuwait; US-led coalition responded. Oil prices doubled.',
    descriptionKo: '이라크 쿠웨이트 침공. 유가 2배 급등. 미국 주도 연합군 반격.',
    countries: ['IQ', 'KW', 'US'],
    region: 'middleeast',
    signalTypes: ['military', 'energy'],
    keywords: ['iraq', 'kuwait', 'gulf war', 'oil', 'invasion', '걸프전', '유가'],
    severity: 4,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -19.0, windowDays: 70, direction: 'down' },
      { asset: 'CL=F', label: 'WTI Crude', changePercent: +90.0, windowDays: 60, direction: 'up' },
      { asset: 'GC=F', label: 'Gold', changePercent: +8.0, windowDays: 30, direction: 'up' },
    ],
    resolution: 'resolved',
    resolutionDays: 180,
    keyLesson: 'Middle East conflict = oil shock. Korea as oil importer affected via cost inflation and export slowdown.',
    keyLessonKo: '중동 분쟁 = 유가 충격. 석유 수입국 한국은 인플레이션 압박 직격.',
  },
  // ─── Financial Crises ─────────────────────────────────────────────────────
  {
    id: 'gfc-2008',
    title: 'Global Financial Crisis — Lehman Collapse (2008)',
    titleKo: '글로벌 금융위기 — 리먼 파산 (2008)',
    date: '2008-09-15',
    category: 'financial_crisis',
    description: 'Lehman Brothers filed for bankruptcy. Triggered systemic global financial crisis.',
    descriptionKo: '리먼 브라더스 파산. 글로벌 금융 시스템 위기 촉발.',
    countries: ['US'],
    region: 'global',
    signalTypes: ['financial'],
    keywords: ['lehman', 'bank', 'credit', 'financial crisis', '금융위기', '리먼', '파산'],
    severity: 5,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -46.0, windowDays: 180, direction: 'down' },
      { asset: '^KS11', label: 'KOSPI', changePercent: -42.0, windowDays: 90, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +55.0, windowDays: 90, direction: 'up', note: 'KRW -35% 급락' },
      { asset: 'GC=F', label: 'Gold', changePercent: +25.0, windowDays: 180, direction: 'up' },
      { asset: 'CL=F', label: 'WTI Crude', changePercent: -74.0, windowDays: 150, direction: 'down' },
    ],
    resolution: 'resolved',
    resolutionDays: 730,
    keyLesson: 'Korea highly vulnerable to global financial shocks — KOSPI and KRW both hit hard. KRW weakness amplifies import costs.',
    keyLessonKo: '한국은 글로벌 금융 충격에 특히 취약. KOSPI·KRW 동반 급락. KRW 약세로 수입 비용 추가 상승.',
  },
  {
    id: 'asian-financial-crisis-1997',
    title: 'Asian Financial Crisis — IMF Bailout (1997)',
    titleKo: '아시아 금융위기 — IMF 구제금융 (1997)',
    date: '1997-11-21',
    category: 'financial_crisis',
    description: 'South Korea requested IMF bailout amid currency/debt crisis. KRW collapsed 50%.',
    descriptionKo: '한국 IMF 구제금융 신청. KRW 50% 폭락. 기업 대량 도산.',
    countries: ['KR', 'TH', 'ID'],
    region: 'asia',
    signalTypes: ['financial', 'economic'],
    keywords: ['imf', 'korea', 'currency crisis', 'won', 'bailout', 'IMF', '외환위기', '한국', '원화'],
    severity: 5,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -67.0, windowDays: 90, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +100.0, windowDays: 60, direction: 'up', note: 'KRW 반토막' },
    ],
    resolution: 'resolved',
    resolutionDays: 365,
    keyLesson: 'IMF crisis = generational memory for Korean investors. KRW collapse feedback loop: imports expensive, more KRW selling pressure.',
    keyLessonKo: '외환위기는 한국 투자자들의 집단 기억. KRW 급락 → 수입 비용 폭등 → 추가 약세 악순환.',
  },
  // ─── Pandemics ────────────────────────────────────────────────────────────
  {
    id: 'covid-2020',
    title: 'COVID-19 Pandemic — Global Lockdowns (2020)',
    titleKo: 'COVID-19 팬데믹 — 글로벌 봉쇄 (2020)',
    date: '2020-03-11',
    category: 'pandemic',
    description: 'WHO declared COVID-19 pandemic. Global lockdowns crashed demand and supply chains.',
    descriptionKo: 'WHO 팬데믹 선언. 글로벌 봉쇄로 수요·공급망 동반 붕괴.',
    countries: ['CN', 'US', 'IT'],
    region: 'global',
    signalTypes: ['pandemic', 'supply_chain'],
    keywords: ['covid', 'pandemic', 'coronavirus', 'lockdown', 'who', '코로나', '팬데믹', '봉쇄'],
    severity: 5,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -34.0, windowDays: 30, direction: 'down' },
      { asset: '^KS11', label: 'KOSPI', changePercent: -36.0, windowDays: 30, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +7.0, windowDays: 14, direction: 'up' },
      { asset: 'GC=F', label: 'Gold', changePercent: -10.0, windowDays: 14, direction: 'down', note: '초기 유동성 압박; 이후 급등' },
      { asset: 'CL=F', label: 'WTI Crude', changePercent: -72.0, windowDays: 60, direction: 'down' },
      { asset: 'BTC-USD', label: 'Bitcoin', changePercent: -52.0, windowDays: 14, direction: 'down' },
    ],
    resolution: 'resolved',
    resolutionDays: 500,
    keyLesson: 'Pandemic initial shock = "sell everything". Korea recovery was fast due to strong tech exports and semiconductor demand.',
    keyLessonKo: '초기 패닉 이후 한국은 반도체·IT 수출 강세로 빠른 회복. COVID 수혜 섹터 (반도체, 배터리, 바이오) 급등.',
  },
  {
    id: 'mers-2015',
    title: 'MERS Outbreak in South Korea (2015)',
    titleKo: '한국 메르스 사태 (2015)',
    date: '2015-05-20',
    category: 'pandemic',
    description: 'South Korea MERS outbreak — 186 cases, 38 deaths, hospitals quarantined.',
    descriptionKo: '삼성서울병원 등 주요 병원 폐쇄. 관광·소비 급감.',
    countries: ['KR'],
    region: 'korea',
    signalTypes: ['pandemic'],
    keywords: ['mers', 'korea', 'outbreak', 'hospital', '메르스', '한국', '병원'],
    severity: 3,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -3.5, windowDays: 30, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +2.0, windowDays: 14, direction: 'up' },
    ],
    resolution: 'resolved',
    resolutionDays: 60,
    keyLesson: 'Korea-specific pandemic = KOSPI moderate impact, KRW mild weakness. Fast government response contained economic damage.',
    keyLessonKo: '한국 내 감염병 → KOSPI 중간 수준 충격, 관광·소비 섹터 직격. 정부 대응 속도가 시장 회복 속도 결정.',
  },
  // ─── Nuclear / Radiation ──────────────────────────────────────────────────
  {
    id: 'fukushima-2011',
    title: 'Fukushima Nuclear Disaster (2011)',
    titleKo: '후쿠시마 원전 사고 (2011)',
    date: '2011-03-11',
    category: 'nuclear',
    description: 'Magnitude 9.0 earthquake + tsunami triggered nuclear meltdown at Fukushima Daiichi.',
    descriptionKo: '대지진·쓰나미로 후쿠시마 원전 멜트다운. 방사성 물질 유출.',
    countries: ['JP'],
    region: 'asia',
    signalTypes: ['nuclear', 'natural_disaster'],
    keywords: ['fukushima', 'nuclear', 'meltdown', 'reactor', 'radiation', '후쿠시마', '원전', '방사능'],
    severity: 5,
    outcomes: [
      { asset: '^N225', label: 'Nikkei 225', changePercent: -19.0, windowDays: 5, direction: 'down' },
      { asset: '^KS11', label: 'KOSPI', changePercent: -4.5, windowDays: 5, direction: 'down' },
      { asset: 'JPY=X', label: 'USD/JPY', changePercent: -5.0, windowDays: 5, direction: 'down', note: '엔화 일시 급등 (이후 G7 개입)' },
      { asset: 'GC=F', label: 'Gold', changePercent: +3.0, windowDays: 10, direction: 'up' },
      { asset: 'URA', label: 'Uranium ETF', changePercent: -35.0, windowDays: 60, direction: 'down' },
    ],
    resolution: 'resolved',
    resolutionDays: 365,
    keyLesson: 'Nuclear disaster = uranium stocks crushed, Japan equities hit hard. Korea secondary exposure via Japan supply chains.',
    keyLessonKo: '핵 사고 → 우라늄 주식 폭락, 원전주 전 세계 동반 하락. 한국은 일본 공급망 차질로 2차 피해.',
  },
  // ─── Cyber Attacks ───────────────────────────────────────────────────────
  {
    id: 'wannacry-2017',
    title: 'WannaCry Ransomware Global Attack (2017)',
    titleKo: 'WannaCry 랜섬웨어 글로벌 공격 (2017)',
    date: '2017-05-12',
    category: 'cyber',
    description: 'WannaCry ransomware infected 200,000+ systems across 150 countries. Hospitals, banks, telecoms hit.',
    descriptionKo: '150개국 20만+ 시스템 감염. 병원·은행·통신 마비.',
    countries: ['KP', 'US', 'GB'],
    region: 'global',
    signalTypes: ['cyber'],
    keywords: ['wannacry', 'ransomware', 'cyberattack', 'nsa', 'north korea', '랜섬웨어', '사이버'],
    severity: 4,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -0.8, windowDays: 3, direction: 'down', note: '제한적 시장 영향' },
      { asset: 'CIBR', label: 'Cybersecurity ETF', changePercent: +3.0, windowDays: 5, direction: 'up' },
    ],
    resolution: 'resolved',
    resolutionDays: 14,
    keyLesson: 'Cyber attacks alone rarely cause major market disruption unless infrastructure is severely impaired. Cybersecurity stocks benefit.',
    keyLessonKo: '사이버 공격은 직접 금융 인프라 타격이 없으면 시장 영향 제한. 보안 주식 수혜.',
  },
  // ─── Energy Shocks ───────────────────────────────────────────────────────
  {
    id: 'oil-embargo-1973',
    title: 'OPEC Oil Embargo (1973)',
    titleKo: 'OPEC 석유 금수 조치 (1973)',
    date: '1973-10-19',
    category: 'energy_shock',
    description: 'OPEC Arab members declared oil embargo against US and allies. Oil prices quadrupled.',
    descriptionKo: 'OPEC 아랍 회원국 대미 석유 금수. 유가 4배 폭등. 스태그플레이션 시작.',
    countries: ['SA', 'US'],
    region: 'global',
    signalTypes: ['energy', 'supply_chain'],
    keywords: ['opec', 'oil', 'embargo', 'energy', 'oil shock', 'stagflation', '석유 위기', '오일쇼크'],
    severity: 5,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -48.0, windowDays: 350, direction: 'down' },
      { asset: 'CL=F', label: 'WTI Crude', changePercent: +300.0, windowDays: 90, direction: 'up' },
    ],
    resolution: 'resolved',
    resolutionDays: 180,
    keyLesson: 'Severe energy shock = stagflation risk. Oil importers (Korea) face double pressure: inflation + growth slowdown.',
    keyLessonKo: '에너지 충격 = 스태그플레이션 위험. 석유 수입국 한국은 인플레이션 + 성장 둔화 이중고.',
  },
  {
    id: 'aramco-attack-2019',
    title: 'Aramco Oil Facility Drone Attack (2019)',
    titleKo: '아람코 석유 시설 드론 공격 (2019)',
    date: '2019-09-14',
    category: 'energy_shock',
    description: 'Drone/missile attack halved Saudi Arabian oil production (5% of global supply).',
    descriptionKo: '예멘 후티 반군 드론·미사일로 사우디 석유 생산량 50% 타격.',
    countries: ['SA', 'YE', 'IR'],
    region: 'middleeast',
    signalTypes: ['military', 'energy'],
    keywords: ['aramco', 'saudi', 'drone attack', 'oil', 'houthi', '아람코', '사우디', '드론'],
    severity: 4,
    outcomes: [
      { asset: 'CL=F', label: 'WTI Crude', changePercent: +15.0, windowDays: 1, direction: 'up', note: '단일일 최대 급등' },
      { asset: 'GC=F', label: 'Gold', changePercent: +1.0, windowDays: 2, direction: 'up' },
      { asset: 'SPY', label: 'S&P 500', changePercent: -0.5, windowDays: 1, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +0.8, windowDays: 2, direction: 'up', note: 'KRW 소폭 약세' },
    ],
    resolution: 'resolved',
    resolutionDays: 14,
    keyLesson: 'Single infrastructure attack can spike oil 15%+ instantly but effect fades within weeks as supply is restored.',
    keyLessonKo: '인프라 공격으로 유가 즉시 급등. 하지만 공급 회복 시 수주 내 정상화. 한국 에너지 비용 단기 충격.',
  },
  // ─── Diplomatic / Trade ───────────────────────────────────────────────────
  {
    id: 'us-china-tariffs-2018',
    title: 'US-China Trade War — Tariff Escalation (2018)',
    titleKo: '미중 무역전쟁 — 관세 전쟁 (2018)',
    date: '2018-07-06',
    category: 'diplomatic',
    description: 'US imposed 25% tariffs on $34bn of Chinese goods. China retaliated. Tech/semiconductor hit.',
    descriptionKo: '미국 340억달러 중국산 제품 25% 관세 부과. 반도체·기술주 타격.',
    countries: ['US', 'CN'],
    region: 'global',
    signalTypes: ['diplomatic', 'economic'],
    keywords: ['trade war', 'tariff', 'china', 'us', 'semiconductor', '무역전쟁', '관세', '미중', '반도체'],
    severity: 4,
    outcomes: [
      { asset: 'SPY', label: 'S&P 500', changePercent: -12.0, windowDays: 90, direction: 'down' },
      { asset: '^KS11', label: 'KOSPI', changePercent: -17.0, windowDays: 90, direction: 'down', note: '수출 의존 한국 직격' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +6.0, windowDays: 60, direction: 'up' },
      { asset: 'SOXX', label: 'Semiconductor ETF', changePercent: -18.0, windowDays: 90, direction: 'down' },
    ],
    resolution: 'de-escalated',
    resolutionDays: 540,
    keyLesson: 'Korea extremely sensitive to US-China trade tensions due to semiconductor supply chain position between both countries.',
    keyLessonKo: '한국은 미중 무역갈등에 가장 민감한 국가 중 하나. 반도체·중간재 수출 타격, KOSPI KRW 동반 하락.',
  },
  {
    id: 'japan-korea-trade-dispute-2019',
    title: 'Japan-Korea Trade Dispute (2019)',
    titleKo: '일본 수출규제 분쟁 (2019)',
    date: '2019-07-01',
    category: 'diplomatic',
    description: 'Japan restricted exports of 3 semiconductor materials to Korea (fluorinated polyimide, resist, HF).',
    descriptionKo: '일본, 반도체 핵심 소재 3품목 대한 수출 규제. 삼성·SK하이닉스 공급망 위기.',
    countries: ['JP', 'KR'],
    region: 'korea',
    signalTypes: ['diplomatic', 'supply_chain'],
    keywords: ['japan', 'korea', 'export restriction', 'semiconductor', 'samsung', 'fluoride', '일본', '수출규제', '반도체'],
    severity: 3,
    outcomes: [
      { asset: '^KS11', label: 'KOSPI', changePercent: -7.0, windowDays: 30, direction: 'down' },
      { asset: '005930.KS', label: 'Samsung Electronics', changePercent: -9.0, windowDays: 14, direction: 'down' },
      { asset: '000660.KS', label: 'SK Hynix', changePercent: -11.0, windowDays: 14, direction: 'down' },
      { asset: 'KRW=X', label: 'USD/KRW', changePercent: +3.5, windowDays: 14, direction: 'up' },
    ],
    resolution: 'de-escalated',
    resolutionDays: 270,
    keyLesson: 'Japan-Korea supply chain friction = Samsung/SK Hynix hit first and hardest. Korea accelerated domestic material supply chain.',
    keyLessonKo: '일본 수출규제 → 삼성·SK하이닉스 공급망 위기. 한국 소재 국산화 가속. 중장기적으로 한국 반도체 경쟁력 강화.',
  },
];

// ─── Pattern search utilities ──────────────────────────────────────────────

/** Returns patterns most similar to given keywords via keyword overlap */
export function findSimilarPatterns(
  keywords: string[],
  category?: PatternCategory,
  topN = 5
): Array<HistoricalPattern & { similarity: number }> {
  const query = keywords.map(k => k.toLowerCase());

  const scored = HISTORICAL_PATTERNS.map(p => {
    const patternKw = p.keywords.map(k => k.toLowerCase());
    const overlap = query.filter(k => patternKw.some(pk => pk.includes(k) || k.includes(pk)));
    const similarity = overlap.length / Math.max(query.length, patternKw.length);
    return { ...p, similarity };
  });

  return scored
    .filter(p => category ? p.category === category : true)
    .filter(p => p.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/** Get outcome for specific asset from a pattern */
export function getOutcomeForAsset(pattern: HistoricalPattern, assetSymbol: string): MarketOutcome | null {
  return pattern.outcomes.find(o => o.asset === assetSymbol) ?? null;
}

/** Summarize most likely outcome for Korean investors given similar patterns */
export function summarizeKoreanOutlook(patterns: HistoricalPattern[]): {
  kospiExpected: 'down_sharp' | 'down_mild' | 'flat' | 'up';
  krwExpected: 'weaken_sharp' | 'weaken_mild' | 'stable' | 'strengthen';
  safeHavenDemand: boolean;
  timeToResolve: string;
} {
  const kospiChanges = patterns.flatMap(p => p.outcomes.filter(o => o.asset === '^KS11').map(o => o.changePercent));
  const krwChanges = patterns.flatMap(p => p.outcomes.filter(o => o.asset === 'KRW=X').map(o => o.changePercent));

  const avgKospi = kospiChanges.length ? kospiChanges.reduce((a, b) => a + b, 0) / kospiChanges.length : 0;
  const avgKrw = krwChanges.length ? krwChanges.reduce((a, b) => a + b, 0) / krwChanges.length : 0;

  const avgResolution = patterns.filter(p => p.resolutionDays).reduce((s, p) => s + (p.resolutionDays ?? 0), 0) / (patterns.filter(p => p.resolutionDays).length || 1);

  const safeHavenDemand = patterns.some(p => p.outcomes.some(o => (o.asset === 'GC=F' || o.asset === 'JPY=X') && o.direction === 'up'));

  return {
    kospiExpected: avgKospi < -10 ? 'down_sharp' : avgKospi < -3 ? 'down_mild' : avgKospi < 2 ? 'flat' : 'up',
    krwExpected: avgKrw > 5 ? 'weaken_sharp' : avgKrw > 2 ? 'weaken_mild' : avgKrw < -2 ? 'strengthen' : 'stable',
    safeHavenDemand,
    timeToResolve: avgResolution < 14 ? '1-2주' : avgResolution < 60 ? '1-2개월' : avgResolution < 180 ? '3-6개월' : '6개월+',
  };
}
