/**
 * North Korea Provocation Timeline — Mentat Monitor
 *
 * Historical database of DPRK provocations for map visualization.
 * Sources: 38North, CSIS Beyond Parallel, NTI, open news reports.
 *
 * Categories:
 *  - missile_test: Ballistic missile launches
 *  - nuclear_test: Underground nuclear detonations
 *  - cyber: Confirmed cyber attacks / hacking operations
 *  - maritime: Naval incidents, NLL violations
 *  - artillery: Artillery fire / border incidents
 *  - rhetoric: Significant threats / diplomatic ruptures
 */

export type NKProvocationType =
  | 'missile_test'
  | 'nuclear_test'
  | 'cyber'
  | 'maritime'
  | 'artillery'
  | 'rhetoric';

export interface NKProvocation {
  id: string;
  date: string; // ISO date
  type: NKProvocationType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3 | 4 | 5; // 1=low, 5=critical
  source?: string;
  tags?: string[];
}

export const NK_PROVOCATIONS: NKProvocation[] = [
  // === 2024 ===
  {
    id: 'nk-2024-11-missile',
    date: '2024-11-05',
    type: 'missile_test',
    title: 'ICBM 화성-19형 발사',
    description: '역대 최장거리 대륙간탄도미사일 발사. 비행시간 86분, 고도 7,000km 이상.',
    lat: 39.03,
    lng: 125.75,
    severity: 5,
    source: '38North',
    tags: ['ICBM', '화성-19', 'ballistic'],
  },
  {
    id: 'nk-2024-09-rubbish-balloon',
    date: '2024-09-10',
    type: 'rhetoric',
    title: '대남 오물 풍선 살포 재개',
    description: '한국 대북 확성기 방송에 대응해 오물·쓰레기 풍선 수백 개 살포.',
    lat: 37.9,
    lng: 126.5,
    severity: 2,
    tags: ['balloon', '오물풍선', 'psyops'],
  },
  {
    id: 'nk-2024-06-gps-jamming',
    date: '2024-06-02',
    type: 'cyber',
    title: 'GPS 전파 교란',
    description: '서해 해역 및 인천국제공항 항공기 GPS 신호 교란 작전.',
    lat: 37.46,
    lng: 126.44,
    severity: 3,
    tags: ['GPS', 'jamming', 'electronic warfare'],
  },
  // === 2023 ===
  {
    id: 'nk-2023-12-icbm',
    date: '2023-12-18',
    type: 'missile_test',
    title: '화성-18형 ICBM 발사',
    description: '고체연료 ICBM. 비행시간 73분, 최대 고도 6,518km, 비행거리 1,002km.',
    lat: 39.03,
    lng: 125.75,
    severity: 5,
    source: 'CSIS Beyond Parallel',
    tags: ['ICBM', '화성-18', 'solid fuel'],
  },
  {
    id: 'nk-2023-03-icbm',
    date: '2023-03-16',
    type: 'missile_test',
    title: '화성-17형 ICBM 발사',
    description: '평양 순안공항 인근에서 발사. 고도 5,768km, 비행거리 1,002km.',
    lat: 39.14,
    lng: 125.74,
    severity: 5,
    tags: ['ICBM', '화성-17'],
  },
  // === 2022 ===
  {
    id: 'nk-2022-11-icbm',
    date: '2022-11-18',
    type: 'missile_test',
    title: '화성-17형 발사 (역대 최장)',
    description: '당시 역대 최장 비행거리. 고도 6,041km, 비행거리 999km.',
    lat: 39.14,
    lng: 125.74,
    severity: 5,
    source: '38North',
    tags: ['ICBM', '화성-17'],
  },
  {
    id: 'nk-2022-10-missile-salvo',
    date: '2022-10-04',
    type: 'missile_test',
    title: '중거리탄도미사일 일본 상공 통과',
    description: '화성-12형 추정 IRBM이 일본 상공 통과. 비행거리 4,600km. 일본 전국 J-Alert 발령.',
    lat: 39.2,
    lng: 126.8,
    severity: 4,
    tags: ['IRBM', '화성-12', 'Japan overflight'],
  },
  {
    id: 'nk-2022-05-cyber-lazarus',
    date: '2022-05-01',
    type: 'cyber',
    title: '라자루스 그룹 암호화폐 해킹',
    description: '액시 인피니티 론진 브리지 6억 달러 해킹. 미 재무부 라자루스 그룹 지목.',
    lat: 39.03,
    lng: 125.75,
    severity: 4,
    tags: ['Lazarus', 'crypto', 'hack', '$600M'],
  },
  // === 2017 ===
  {
    id: 'nk-2017-09-nuclear',
    date: '2017-09-03',
    type: 'nuclear_test',
    title: '6차 핵실험 (수소폭탄)',
    description: '함경북도 길주군 풍계리. 추정 폭발력 160kt. DPRK "수소폭탄" 발표.',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    source: 'CTBTO',
    tags: ['nuclear', 'hydrogen bomb', 'Punggye-ri', '6차'],
  },
  {
    id: 'nk-2017-07-icbm-hwasong14',
    date: '2017-07-04',
    type: 'missile_test',
    title: '화성-14형 ICBM 첫 시험',
    description: '미국 독립기념일 첫 ICBM 발사. 비행거리 933km, 고도 2,802km. 알래스카 사정권.',
    lat: 40.85,
    lng: 125.12,
    severity: 5,
    tags: ['ICBM', '화성-14', 'first ICBM'],
  },
  // === 2016 ===
  {
    id: 'nk-2016-09-nuclear',
    date: '2016-09-09',
    type: 'nuclear_test',
    title: '5차 핵실험',
    description: '풍계리. 추정 폭발력 10kt. 역대 최대 규모.',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    tags: ['nuclear', 'Punggye-ri', '5차'],
  },
  {
    id: 'nk-2016-01-nuclear',
    date: '2016-01-06',
    type: 'nuclear_test',
    title: '4차 핵실험 (수소폭탄 주장)',
    description: '풍계리 4차 핵실험. DPRK "수소폭탄 실험 성공" 발표 (전문가들 의구심).',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    tags: ['nuclear', 'Punggye-ri', '4차'],
  },
  // === 2015 ===
  {
    id: 'nk-2015-08-landmine',
    date: '2015-08-04',
    type: 'artillery',
    title: 'DMZ 목함지뢰 사건',
    description: '비무장지대 수색로에 목함지뢰 매설. 한국군 부사관 2명 부상.',
    lat: 37.95,
    lng: 126.6,
    severity: 3,
    tags: ['DMZ', 'landmine', '목함지뢰'],
  },
  // === 2013 ===
  {
    id: 'nk-2013-02-nuclear',
    date: '2013-02-12',
    type: 'nuclear_test',
    title: '3차 핵실험',
    description: '풍계리 3차 핵실험. 추정 폭발력 6-9kt.',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    tags: ['nuclear', 'Punggye-ri', '3차'],
  },
  // === 2010 ===
  {
    id: 'nk-2010-11-yeonpyeong',
    date: '2010-11-23',
    type: 'artillery',
    title: '연평도 포격 사건',
    description: '연평도에 포탄 170발 이상 발사. 해병대원 2명·민간인 2명 사망, 다수 부상.',
    lat: 37.67,
    lng: 125.68,
    severity: 5,
    tags: ['연평도', 'artillery', '포격'],
  },
  {
    id: 'nk-2010-03-cheonan',
    date: '2010-03-26',
    type: 'maritime',
    title: '천안함 피격 사건',
    description: '서해 백령도 근해에서 해군 초계함 천안함 침몰. 승조원 46명 전사. 북한 어뢰 공격으로 결론.',
    lat: 37.88,
    lng: 124.62,
    severity: 5,
    tags: ['천안함', 'Cheonan', 'torpedo', 'naval'],
  },
  // === 2009 ===
  {
    id: 'nk-2009-05-nuclear',
    date: '2009-05-25',
    type: 'nuclear_test',
    title: '2차 핵실험',
    description: '풍계리 2차 핵실험. 추정 폭발력 2-7kt.',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    tags: ['nuclear', 'Punggye-ri', '2차'],
  },
  // === 2006 ===
  {
    id: 'nk-2006-10-nuclear',
    date: '2006-10-09',
    type: 'nuclear_test',
    title: '1차 핵실험',
    description: '풍계리 첫 핵실험. 추정 폭발력 0.6-1kt. 부분적 실패 관측.',
    lat: 41.31,
    lng: 129.07,
    severity: 5,
    source: 'CTBTO',
    tags: ['nuclear', 'Punggye-ri', '1차', 'first'],
  },
];

/**
 * Get provocations filtered by type and/or date range.
 */
export function filterProvocations(
  type?: NKProvocationType | NKProvocationType[],
  sinceDate?: string,
): NKProvocation[] {
  return NK_PROVOCATIONS.filter((p) => {
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes(p.type)) return false;
    }
    if (sinceDate && p.date < sinceDate) return false;
    return true;
  });
}

/**
 * Get the most recent N provocations.
 */
export function getRecentProvocations(n = 10): NKProvocation[] {
  return [...NK_PROVOCATIONS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export const NK_PROVOCATION_COLORS: Record<NKProvocationType, string> = {
  missile_test: '#FF4444',  // red
  nuclear_test: '#FF8C00',  // orange-red
  cyber: '#9B59B6',          // purple
  maritime: '#2196F3',      // blue
  artillery: '#FF6B35',     // orange
  rhetoric: '#FFC107',       // yellow
};

export const NK_PROVOCATION_ICONS: Record<NKProvocationType, string> = {
  missile_test: '🚀',
  nuclear_test: '☢️',
  cyber: '💻',
  maritime: '⚓',
  artillery: '💥',
  rhetoric: '📢',
};
