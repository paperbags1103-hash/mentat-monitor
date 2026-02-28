/**
 * WarRoomView — 이란-이스라엘 전황 실시간 관제실  v9
 *
 * v6 추가: 이란 리알(IRR) 선행지표, 영공제한 레이어, YouTube 라이브 마커
 * 에스컬레이션 인덱스 9차원 벡터 (IRR 추가)
 * api/iran-rial, api/airspace 연동
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiFetch } from '@/store';

/* ══════════════════════════════════════════════════════
   STATIC INTELLIGENCE DATA
══════════════════════════════════════════════════════ */

const MILITARY_BASES = [
  // ── 이란 핵/군사 시설 ──
  { name: '나탄즈',    lat: 33.72, lng: 51.73, type: 'nuclear',  country: 'ir' },
  { name: '포르도',    lat: 34.89, lng: 49.21, type: 'nuclear',  country: 'ir' },
  { name: '이스파한',  lat: 32.65, lng: 51.67, type: 'nuclear',  country: 'ir' },
  { name: '부셰르',    lat: 28.92, lng: 50.84, type: 'nuclear',  country: 'ir' },
  { name: '파르친',    lat: 35.50, lng: 51.75, type: 'military', country: 'ir' },
  { name: '반다르 아바스', lat: 27.18, lng: 56.27, type: 'naval', country: 'ir' },
  { name: '카르그 석유섬', lat: 29.24, lng: 50.32, type: 'oil',  country: 'ir' },
  { name: '데즈풀 공군', lat: 32.43, lng: 48.40, type: 'airbase', country: 'ir' },
  { name: 'IRGC 테헤란', lat: 35.72, lng: 51.42, type: 'military', country: 'ir' },
  // ── 이스라엘 ──
  { name: '디모나 핵연구소', lat: 30.99, lng: 35.15, type: 'nuclear',  country: 'il' },
  { name: '하체림 공군기지', lat: 31.23, lng: 34.66, type: 'airbase',  country: 'il' },
  { name: '네바팀 공군기지', lat: 31.21, lng: 35.01, type: 'airbase',  country: 'il' },
  { name: '팔마힘 미사일',   lat: 31.89, lng: 34.69, type: 'missile',  country: 'il' },
  { name: '라몬 공군기지',   lat: 30.77, lng: 34.67, type: 'airbase',  country: 'il' },
  // ── 미국 ──
  { name: '알우데이드 (카타르)', lat: 25.12, lng: 51.31, type: 'airbase', country: 'us' },
  { name: '알다프라 (UAE)',       lat: 24.24, lng: 54.55, type: 'airbase', country: 'us' },
  { name: '알아사드 (이라크)',    lat: 33.38, lng: 42.44, type: 'airbase', country: 'us' },
  // ── 헤즈볼라 ──
  { name: '다히에 (헤즈볼라)', lat: 33.84, lng: 35.53, type: 'military', country: 'lb' },
];

/* ══════════════════════════════════════════════════════
   MILITARY FORCE DEPLOYMENT (공개 정보 기반 큐레이션)
   출처: Reuters, AP, IISS Military Balance, CSIS
══════════════════════════════════════════════════════ */

type ForceType = 'missile'|'drone'|'navy'|'ground'|'airdef'|'carrier'|'bomber'|'special'|'proxy_ground'|'proxy_rocket';
type Side = 'iran'|'israel'|'us'|'hezbollah'|'houthi'|'pmf';

interface MilAsset {
  id: string;
  name: string;      // 부대명/무기체계
  detail: string;    // 상세 설명 (팝업용)
  lat: number; lng: number;
  type: ForceType;
  side: Side;
  strength: 'xl'|'lg'|'md'|'sm'; // 전력 크기 → 심볼 크기
  active: boolean;   // 현재 활성 상태
}

const FORCE_ASSETS: MilAsset[] = [
  // ══ 이란 IRGC 미사일 여단 ══
  { id:'ir-m1', name:'IRGC 미사일여단 / 샤하브-3', detail:'Shahab-3 (1,300km) / Emad (1,700km) · 이스라엘 전역 사거리 내', lat:33.72, lng:51.73, type:'missile', side:'iran', strength:'xl', active:true },
  { id:'ir-m2', name:'IRGC 미사일여단 / 하즈 카셈', detail:'Fateh-313 (500km) · 이라크/걸프 타격 가능', lat:34.35, lng:47.10, type:'missile', side:'iran', strength:'lg', active:true },
  { id:'ir-m3', name:'IRGC 미사일여단 / 파즈르', detail:'Zolfaghar (700km) · 사우디/UAE 타격권', lat:30.10, lng:57.05, type:'missile', side:'iran', strength:'lg', active:true },
  { id:'ir-m4', name:'IRGC 해안미사일', detail:'Noor ASM · 호르무즈 함정 봉쇄 전력', lat:27.10, lng:56.50, type:'missile', side:'iran', strength:'md', active:true },
  { id:'ir-m5', name:'미르사드 미사일 기지', detail:'지대공 + 지대지 복합 시스템', lat:35.82, lng:50.61, type:'missile', side:'iran', strength:'md', active:false },
  { id:'ir-m6', name:'Fattah 극초음속 미사일', detail:'Mach 15+ · 이란 2023년 공개 · 현존 모든 방공망 돌파 주장 · 이스라엘 직타 가능', lat:35.65, lng:52.10, type:'missile', side:'iran', strength:'xl', active:true },
  { id:'ir-m7', name:'Kheibar Shekan 중거리 미사일', detail:'2,000km 사거리 · 정밀유도 · 이스라엘 전역 타격 (2022년 공개)', lat:34.10, lng:49.40, type:'missile', side:'iran', strength:'lg', active:true },

  // ══ 이란 드론 전력 ══
  { id:'ir-d1', name:'IRGC 드론기지 / Shahed-136', detail:'자폭드론 · 가자쿠/카르만 생산기지 · 헤즈볼라/후티에 공급', lat:33.98, lng:51.55, type:'drone', side:'iran', strength:'xl', active:true },
  { id:'ir-d2', name:'IRGC 드론기지 / Mohajer-6', detail:'정찰/공격 복합 · 걸프 일대 작전 반경', lat:29.45, lng:60.80, type:'drone', side:'iran', strength:'md', active:true },
  { id:'ir-d3', name:'드론 전진기지 (이라크)', detail:'이라크 민병대 통해 Shahed-136 전방 배치', lat:33.05, lng:44.20, type:'drone', side:'iran', strength:'md', active:true },

  // ══ 이란 해군 (IRGC + 정규군) ══
  { id:'ir-n1', name:'IRGC 해군 1함대 / 반다르아바스', detail:'쾌속정 200+ · 기뢰 · 잠수함 · 호르무즈 봉쇄 전력', lat:27.18, lng:56.27, type:'navy', side:'iran', strength:'xl', active:true },
  { id:'ir-n2', name:'이란 해군 / 차바하르', detail:'구축함 · 잠수함 · 아라비아해 진출 거점', lat:25.30, lng:60.64, type:'navy', side:'iran', strength:'lg', active:false },
  { id:'ir-n3', name:'IRGC 해군 / Abu Musa', detail:'페르시아만 중앙 도서 점령 · 기뢰 부설 거점', lat:25.87, lng:55.03, type:'navy', side:'iran', strength:'md', active:true },

  // ══ 헤즈볼라 (이란 프록시) ══
  { id:'hzb-1', name:'헤즈볼라 / 로켓여단', detail:'Khaibar-1 추정 100,000발+ · 남부 레바논 집중 배치', lat:33.22, lng:35.47, type:'proxy_rocket', side:'hezbollah', strength:'xl', active:true },
  { id:'hzb-2', name:'헤즈볼라 / 정밀유도탄', detail:'Fateh-110 계열 · GPS 유도 · 하이파/텔아비브 타격 가능', lat:33.55, lng:35.71, type:'proxy_rocket', side:'hezbollah', strength:'lg', active:true },
  { id:'hzb-3', name:'헤즈볼라 / 특수부대 (라드완)', detail:'엘리트 보병 · 갈릴리 침투 대기', lat:33.35, lng:35.62, type:'proxy_ground', side:'hezbollah', strength:'lg', active:true },
  { id:'hzb-4', name:'헤즈볼라 / 대공미사일', detail:'SA-22 · 드론 요격 가능', lat:33.84, lng:35.85, type:'missile', side:'hezbollah', strength:'md', active:false },

  // ══ 후티 (이란 프록시 / 예멘) ══
  { id:'hth-1', name:'후티 / 탄도미사일여단', detail:'Burkan-3 (1,200km) · 이스라엘 남부 타격 가능', lat:15.35, lng:44.21, type:'missile', side:'houthi', strength:'lg', active:true },
  { id:'hth-2', name:'후티 / 드론·순항미사일', detail:'Shahed 계열 · 홍해 선박 공격 / 이스라엘 방향 발사', lat:14.80, lng:42.95, type:'drone', side:'houthi', strength:'lg', active:true },
  { id:'hth-3', name:'후티 / 잠수드론 (Toufan)', detail:'자폭형 수중드론 · 홍해 항로 위협', lat:13.50, lng:43.30, type:'navy', side:'houthi', strength:'md', active:true },

  // ══ 이라크 PMF (이란 지원 민병대) ══
  { id:'pmf-1', name:'카타이브헤즈볼라 / 드론부대', detail:'미군기지·이스라엘 방향 공격 · 이라크-시리아 축', lat:33.40, lng:42.70, type:'drone', side:'pmf', strength:'md', active:true },
  { id:'pmf-2', name:'PMF / 로켓여단', detail:'122mm 로켓포 · 쿠르드·US 기지 사거리', lat:32.60, lng:44.05, type:'proxy_rocket', side:'pmf', strength:'md', active:false },

  // ══ 이스라엘 IDF ══
  { id:'il-g1', name:'IDF / 지상군 (가자 북부)', detail:'기갑+보병 사단급 · 가자시티 인근 전개', lat:31.53, lng:34.49, type:'ground', side:'israel', strength:'xl', active:true },
  { id:'il-g2', name:'IDF / 지상군 (가자 남부)', detail:'제98사단 · 라파 작전 지속', lat:31.08, lng:34.27, type:'ground', side:'israel', strength:'lg', active:true },
  { id:'il-g3', name:'IDF / 지상군 (북부 전선)', detail:'제36사단 · 레바논 국경 집결 · 대헤즈볼라', lat:33.07, lng:35.51, type:'ground', side:'israel', strength:'xl', active:true },
  { id:'il-g4', name:'IDF / 특수부대 (사예렛맛칼)', detail:'엘리트 정찰 · 이란 내부 작전 가능성', lat:32.03, lng:34.83, type:'special', side:'israel', strength:'md', active:true },

  // ══ 이스라엘 방공망 ══
  { id:'il-ad1', name:'Iron Dome / 북부 포대', detail:'70km 요격반경 · 카티우샤/단거리 로켓 대응', lat:32.83, lng:35.01, type:'airdef', side:'israel', strength:'lg', active:true },
  { id:'il-ad2', name:'Iron Dome / 중부 포대', detail:'텔아비브 방어권 · 40km 이내 요격', lat:32.07, lng:34.80, type:'airdef', side:'israel', strength:'xl', active:true },
  { id:'il-ad3', name:'Iron Dome / 남부 포대', detail:'네게브 사막 · 베에르셰바 방어', lat:31.25, lng:34.80, type:'airdef', side:'israel', strength:'md', active:true },
  { id:'il-ad4', name:"David's Sling (완드)", detail:'중거리 탄도미사일 요격 · 300~470km', lat:31.89, lng:34.97, type:'airdef', side:'israel', strength:'xl', active:true },
  { id:'il-ad5', name:'Arrow-3 (체스)', detail:'대기권 밖 요격 · 이란 탄도미사일 대응', lat:32.10, lng:34.94, type:'airdef', side:'israel', strength:'xl', active:true },

  // ══ 미국 군사자산 ══
  { id:'us-cv1', name:'USS Harry S. Truman (CVN-75)', detail:'항모타격단 · F/A-18E/F 72기 · 동지중해 배치 (2025 현재) · 이란 억지 역할', lat:34.80, lng:29.50, type:'carrier', side:'us', strength:'xl', active:true },
  { id:'us-cv2', name:'B-2 Spirit (Diego Garcia)', detail:'스텔스 전략폭격기 · Whiteman AFB → Diego Garcia 전개 (2025 보도) · 이란 벙커버스터 임무 대기', lat:-7.31, lng:72.41, type:'bomber', side:'us', strength:'xl', active:true },
  { id:'us-cv3', name:'USS Gerald R. Ford (CVN-78)', detail:'항모타격단 · 대서양/순환배치 (2024 귀환 후 재전개 중)', lat:36.95, lng:-76.35, type:'carrier', side:'us', strength:'xl', active:false },
  { id:'us-dd1', name:'USS Ross (DDG-71) 이지스 구축함', detail:'SM-3 탄도미사일 요격 · 동지중해', lat:33.50, lng:31.00, type:'navy', side:'us', strength:'lg', active:true },
  { id:'us-dd2', name:'USS Gravely (DDG-107)', detail:'SM-3 · 이란 미사일 요격 대기', lat:24.50, lng:56.80, type:'navy', side:'us', strength:'lg', active:true },
  { id:'us-b1', name:'B-52H 폭격기 / Diego Garcia', detail:'장거리 폭격 대기 · 벙커버스터 GBU-57 운용 가능', lat:-7.31, lng:72.42, type:'bomber', side:'us', strength:'lg', active:false },
  { id:'us-gnd1', name:'THAAD / UAE 알다프라', detail:'터미널 고고도 방어 · 사거리 200km', lat:24.24, lng:54.55, type:'airdef', side:'us', strength:'xl', active:true },
  { id:'us-gnd2', name:'미 중부사령부 / 카타르', detail:'30,000+ 병력 · 항공전 지휘 · AWACS 운용', lat:25.12, lng:51.31, type:'ground', side:'us', strength:'xl', active:true },
];

// 진영별 색상
const SIDE_COLOR: Record<Side, string> = {
  iran:      '#dc2626',  // 빨강
  israel:    '#2563eb',  // 파랑
  us:        '#06b6d4',  // 시안
  hezbollah: '#ea580c',  // 주황
  houthi:    '#ca8a04',  // 앰버
  pmf:       '#b45309',  // 브라운
};

// 전력 타입별 심볼 (MIL-STD 단순화)
const TYPE_SYMBOL: Record<ForceType, string> = {
  missile:      '◆',
  drone:        '⬟',
  navy:         '⬡',
  ground:       '▲',
  airdef:       '⌂',
  carrier:      '★',
  bomber:       '✦',
  special:      '◉',
  proxy_ground: '▲',
  proxy_rocket: '◆',
};

const TYPE_LABEL: Record<ForceType, string> = {
  missile: '미사일', drone: '드론', navy: '해군', ground: '지상군',
  airdef: '방공망', carrier: '항모', bomber: '폭격기', special: '특수부대',
  proxy_ground: '민병대', proxy_rocket: '로켓',
};

const SIDE_LABEL: Record<Side, string> = {
  iran: '이란 IRGC', israel: 'IDF 이스라엘', us: '미국',
  hezbollah: '헤즈볼라', houthi: '후티', pmf: '이라크 PMF',
};

const BASE_COLOR: Record<string,string> = {
  nuclear: '#ef4444', military: '#f97316', airbase: '#3b82f6',
  naval: '#06b6d4',   missile: '#a855f7',  oil: '#fbbf24',
};
const BASE_SYMBOL: Record<string,string> = {
  nuclear: '◈', military: '▲', airbase: '✦', naval: '◆', missile: '●', oil: '⬟',
};
const COUNTRY_COLOR: Record<string,string> = {
  ir: '#dc2626', il: '#2563eb', us: '#3b82f6', lb: '#f97316',
};

const MISSILE_SYSTEMS = [
  { name: 'Shahab-3 (1300km)', lat: 33.72, lng: 51.73, rangeKm: 1300, color: '#dc2626', opacity: 0.10 },
  { name: 'Emad (1700km)',      lat: 32.65, lng: 51.67, rangeKm: 1700, color: '#ef4444', opacity: 0.07 },
  { name: 'Jericho-III',        lat: 31.89, lng: 34.69, rangeKm: 4800, color: '#2563eb', opacity: 0.05 },
  { name: 'Arrow-3',            lat: 31.89, lng: 34.69, rangeKm: 2400, color: '#22d3ee', opacity: 0.08 },
  { name: 'Iron Dome',          lat: 32.08, lng: 34.78, rangeKm:   70, color: '#22c55e', opacity: 0.30 },
];

const CHOKEPOINTS = [
  { name: '호르무즈 해협', coords: [[55.5,26.7],[56.5,26.1],[57.5,25.3],[58.3,25.0]] as [number,number][], color: '#ff6a00', width: 4, critical: true },
  { name: '수에즈 운하',   coords: [[32.35,31.5],[32.5,30.5],[32.57,30.3]] as [number,number][],           color: '#fbbf24', width: 3, critical: false },
  { name: '밥엘만데브',   coords: [[43.3,12.8],[43.7,12.3],[44.0,11.8]] as [number,number][],              color: '#fbbf24', width: 3, critical: false },
];

/* ── 중동 감시 구역 ─────────────────────────────────────────────────── */
const BBOX = { s: 24, n: 40, w: 29, e: 66 };
const inBBOX = (lat: number, lng: number) =>
  lat >= BBOX.s && lat <= BBOX.n && lng >= BBOX.w && lng <= BBOX.e;

/* ── 주요 위협 지점 ─────────────────────────────────────────────────── */
const THREAT_SITES = [
  { name: '나탄즈',  lat: 33.72, lng: 51.73, base: 35 },
  { name: '포르도',  lat: 34.89, lng: 49.21, base: 28 },
  { name: '이스파한', lat: 32.65, lng: 51.67, base: 25 },
  { name: '테헤란',  lat: 35.69, lng: 51.39, base: 20 },
  { name: '텔아비브', lat: 32.08, lng: 34.78, base: 18 },
  { name: '하이파',  lat: 32.82, lng: 34.99, base: 15 },
  { name: '베이루트', lat: 33.89, lng: 35.50, base: 22 },
  { name: '바그다드', lat: 33.34, lng: 44.44, base: 12 },
];

/* ── 영공 구역 ──────────────────────────────────────────────────────── */
const AIRSPACE_ZONES = [
  { name: '이란',     lat: [24,40] as [number,number], lng: [44,64] as [number,number], flag: '🇮🇷' },
  { name: '이스라엘', lat: [29,34] as [number,number], lng: [34,36] as [number,number], flag: '🇮🇱' },
  { name: '레바논',   lat: [33,35] as [number,number], lng: [35,37] as [number,number], flag: '🇱🇧' },
  { name: '이라크',   lat: [29,38] as [number,number], lng: [38,49] as [number,number], flag: '🇮🇶' },
  { name: '요르단',   lat: [29,33] as [number,number], lng: [34,39] as [number,number], flag: '🇯🇴' },
];

/* ── Market Impact 연쇄 ─────────────────────────────────────────────── */
const MARKET_CHAINS = [
  {
    id: 'hormuz', icon: '🛢️', title: '호르무즈 봉쇄',
    keywords: ['Hormuz','Persian Gulf','strait','naval','blockade'],
    asset: 'WTI 유가', dir: 'up' as const, est: '+15~30%',
    stocks: [
      { name: 'SK이노베이션', dir: '↑', reason: '정유마진 확대' },
      { name: 'S-Oil',        dir: '↑', reason: '정유마진 확대' },
      { name: '한국전력',     dir: '↓', reason: 'LNG 수입비 급등' },
      { name: '대한항공',     dir: '↓', reason: '항공유 급등' },
    ],
  },
  {
    id: 'israel_iran', icon: '⚔️', title: '이스라엘·이란 교전',
    keywords: ['Israel','Iran','strike','retaliate','attack','missile'],
    asset: 'KOSPI', dir: 'down' as const, est: '-3~8%',
    stocks: [
      { name: '한화에어로스페이스', dir: '↑', reason: '방산 수요' },
      { name: 'LIG넥스원',         dir: '↑', reason: '방산 수요' },
      { name: '삼성전자',           dir: '↓', reason: '글로벌 리스크오프' },
    ],
  },
  {
    id: 'suez', icon: '⚓', title: '수에즈·홍해 위협',
    keywords: ['Suez','Red Sea','Yemen','Houthi','shipping'],
    asset: '해운운임(BDI)', dir: 'up' as const, est: '+20~50%',
    stocks: [
      { name: 'HMM',   dir: '↑', reason: '운임 급등' },
      { name: '팬오션', dir: '↑', reason: '운임 급등' },
    ],
  },
];

/* ── 분쟁 활성 구역 (Active Conflict Zones) ────────────────────────── */
const CONFLICT_ZONES = [
  { name: 'GAZA',            coords: [[34.2,31.1],[34.6,31.1],[34.6,31.6],[34.2,31.6],[34.2,31.1]] as [number,number][], color: '#ef4444', severity: 'critical' },
  { name: 'S.LEBANON',       coords: [[35.1,33.0],[36.7,33.0],[36.7,34.0],[35.1,34.0],[35.1,33.0]] as [number,number][], color: '#ef4444', severity: 'critical' },
  { name: 'SYRIA-IRAQ',      coords: [[38.0,32.0],[46.5,32.0],[46.5,37.5],[38.0,37.5],[38.0,32.0]] as [number,number][], color: '#f97316', severity: 'high' },
  { name: 'IRAN S.CORRIDOR', coords: [[50.0,26.0],[59.0,26.0],[59.0,30.0],[50.0,30.0],[50.0,26.0]] as [number,number][], color: '#f97316', severity: 'high' },
  { name: 'WEST BANK',       coords: [[34.9,31.3],[35.6,31.3],[35.6,32.6],[34.9,32.6],[34.9,31.3]] as [number,number][], color: '#fbbf24', severity: 'elevated' },
];

/* ── 전장 라이브스트림 채널 (지도 마커) ─────────────────────────────── */
const LIVE_STREAMS = [
  { id:'aljazeera-ar', nameKo:'알자지라 Arabic',    emoji:'📡', lat:25.27, lng:51.48, url:'https://www.youtube.com/@AlJazeeraArabic/live',  flag:'🇶🇦' },
  { id:'bbc-arabic',   nameKo:'BBC Arabic',         emoji:'🎙️', lat:32.08, lng:34.78, url:'https://www.youtube.com/@BBCArabic/live',        flag:'🇬🇧' },
  { id:'ch12-il',      nameKo:'채널12 이스라엘',    emoji:'📺', lat:32.09, lng:34.80, url:'https://www.youtube.com/c/channel12news/live',   flag:'🇮🇱' },
  { id:'kan11-il',     nameKo:'Kan 11 이스라엘',    emoji:'📺', lat:31.77, lng:35.22, url:'https://www.youtube.com/@kann/live',             flag:'🇮🇱' },
  { id:'france24-ar',  nameKo:'France 24 Arabic',   emoji:'📡', lat:33.51, lng:36.28, url:'https://www.youtube.com/@France24Arabic/live',   flag:'🇸🇾' },
  { id:'sky-arabia',   nameKo:'Sky News Arabia',    emoji:'📡', lat:24.44, lng:54.46, url:'https://www.youtube.com/@skynewsarabia/live',    flag:'🇦🇪' },
  { id:'press-tv',     nameKo:'Press TV 이란',      emoji:'📡', lat:35.68, lng:51.38, url:'https://www.youtube.com/@presstv/live',          flag:'🇮🇷' },
  { id:'wion',         nameKo:'WION 인도',           emoji:'📡', lat:28.61, lng:77.23, url:'https://www.youtube.com/@wion/live',             flag:'🇮🇳' },
];

/* ── 타격 보고 인터페이스 ──────────────────────────────────────────── */
interface StrikeReport {
  id:         string;
  lat:        number;
  lng:        number;
  title:      string;
  source:     string;
  confidence: 'confirmed' | 'probable' | 'unconfirmed';
  timestamp:  string;
  desc:       string;
  url?:       string;
}
const CONF_COLOR: Record<string,string> = {
  confirmed: '#ef4444', probable: '#f97316', unconfirmed: '#fbbf24',
};
const CONF_LABEL: Record<string,string> = {
  confirmed: '확인됨', probable: '개연성', unconfirmed: '미확인',
};

/* ── 군용기 Callsign 패턴 ──────────────────────────────────────────── */
const MIL_PREFIXES = ['RCH','FORTE','DUKE','DRAGN','JAKE','MOOSE','AZAZ','MYTCH','GRZLY','TOPSY','VIPER','GHOST','EAGLE','COBRA','HAVOC','FURY','RAVEN','REAPER','UAV','ISR','NATO','USAF','IDF'];
const isMilitary = (cs: string) => cs && MIL_PREFIXES.some(p => cs.toUpperCase().startsWith(p));

/* ── 원형 폴리곤 생성 ───────────────────────────────────────────────── */
function circlePoly(lng: number, lat: number, radiusKm: number, sides = 48): [number,number][] {
  return Array.from({ length: sides + 1 }, (_, i) => {
    const a = (i * 2 * Math.PI) / sides;
    return [lng + (radiusKm / 111 / Math.cos(lat * Math.PI / 180)) * Math.sin(a),
            lat + (radiusKm / 111) * Math.cos(a)] as [number,number];
  });
}

/* ══════════════════════════════════════════════════════
   MAP 3D COMPONENT
══════════════════════════════════════════════════════ */
type SatMode = 'satellite' | 'nightlights' | 'truecolor' | 'soar';

// GIBS 날짜 (36h 전 — 처리 지연 감안)
const getGibsDate = () => {
  const d = new Date(Date.now() - 36 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

interface ImgItem { id:string; title:string; titleKo?:string; image:string; url:string; domain:string; ageMin:number|null; lat:number; lng:number; region:string; }

type TheaterKey = 'iran-israel' | 'ukraine' | 'taiwan';
const THEATERS: Record<TheaterKey, { label:string; center:[number,number]; zoom:number; pitch:number; bearing:number; flag:string }> = {
  'iran-israel': { label:'이란-이스라엘',  flag:'🎯', center:[40, 32],  zoom:4.5, pitch:55, bearing:-18 },
  'ukraine':     { label:'우크라이나-러시아', flag:'🇺🇦', center:[32, 49], zoom:5.2, pitch:45, bearing:0  },
  'taiwan':      { label:'대만해협',       flag:'🇹🇼', center:[121,24], zoom:5.5, pitch:45, bearing:0  },
};

interface Map3DProps {
  siteScores: Array<{ name: string; lat: number; lng: number; score: number }>;
  meAcled: any[]; meFirms: any[]; meQuakes: any[]; meAircraft: any[];
  satMode: SatMode;
  imgItems: ImgItem[];
  theater: TheaterKey;
  newsActiveIds: string[];
  airspaceRestrictions?: Array<{id:string;name:string;lat:number;lng:number;radius:number;severity:string;desc:string}>;
  strikeReports?: StrikeReport[];
  onMapRightClick?: (lat: number, lng: number) => void;
}

function Map3D({ siteScores, meAcled, meFirms, meQuakes, meAircraft, satMode, imgItems, theater, newsActiveIds, airspaceRestrictions = [], strikeReports = [], onMapRightClick }: Map3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const rafRef       = useRef<number>(0);
  const dataRef      = useRef({ siteScores, meAcled, meFirms, meQuakes, meAircraft });
  const trailsRef    = useRef<Map<string, Array<[number,number]>>>(new Map());
  const [hiddenSides, setHiddenSides] = useState<Set<Side>>(new Set());

  /* 진영 필터 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('wr-forces-fill')) return;
    const all: Side[] = ['iran','israel','us','hezbollah','houthi','pmf'];
    const vis = all.filter(s => !hiddenSides.has(s));
    const sf = vis.length > 0 ? ['in', ['get','side'], ['literal', vis]] : ['==', 1, 0];
    try {
      map.setFilter('wr-forces-inactive-ring', ['all', ['==', ['get','active'], false], sf]);
      map.setFilter('wr-forces-glow',          ['all', ['==', ['get','active'], true],  sf]);
      map.setFilter('wr-forces-fill',          ['all', ['==', ['get','active'], true],  sf]);
      map.setFilter('wr-forces-news-pulse',    sf);
      map.setFilter('wr-forces-icon',   sf);
      map.setFilter('wr-forces-label',  sf);
    } catch {}
  }, [hiddenSides]);

  /* 전장 전환 flyTo */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = THEATERS[theater];
    if (!t) return;
    try { map.flyTo({ center: t.center as [number,number], zoom: t.zoom, pitch: t.pitch, bearing: t.bearing, duration: 1800, essential: true }); } catch {}
  }, [theater]);

  /* GDELT 뉴스 활성 자산 강조 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wr-forces')) return;
    const gj = {
      type: 'FeatureCollection' as const,
      features: FORCE_ASSETS.map(a => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
        properties: {
          id: a.id, name: a.name, detail: a.detail, side: a.side, type: a.type, active: a.active,
          color: SIDE_COLOR[a.side], symbol: TYPE_SYMBOL[a.type], sideLabel: SIDE_LABEL[a.side], typeLabel: TYPE_LABEL[a.type],
          radius: a.strength==='xl'?11:a.strength==='lg'?8:a.strength==='md'?6:4,
          opacity: a.active?1:0.42, strokeOpacity: a.active?0.9:0.3,
          newsActive: newsActiveIds.includes(a.id),
        },
      })),
    };
    try { (map.getSource('wr-forces') as any).setData(gj); } catch {}
  }, [newsActiveIds]);

  /* 영공 제한 레이어 업데이트 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wr-airspace')) return;
    const sevColor: Record<string,string> = {
      CLOSED: '#ef4444', WARNING: '#f97316', CAUTION: '#fbbf24',
    };
    const gj = {
      type: 'FeatureCollection' as const,
      features: airspaceRestrictions.map(r => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [circlePoly(r.lng, r.lat, r.radius)] },
        properties: {
          id: r.id, label: `${r.severity} ${r.name.slice(0, 12)}`,
          color: sevColor[r.severity] ?? '#94a3b8',
        },
      })),
    };
    try { (map.getSource('wr-airspace') as any).setData(gj); } catch {}
  }, [airspaceRestrictions]);

  /* 타격 보고 레이어 업데이트 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wr-strikes')) return;
    const gj = {
      type: 'FeatureCollection' as const,
      features: strikeReports.map(s => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id, title: s.title, source: s.source, confidence: s.confidence,
          timestamp: s.timestamp, desc: s.desc, url: s.url ?? '',
          color: CONF_COLOR[s.confidence] ?? '#fbbf24',
          label: CONF_LABEL[s.confidence] ?? '?',
        },
      })),
    };
    try { (map.getSource('wr-strikes') as any).setData(gj); } catch {}
  }, [strikeReports]);

  /* 뉴스 이미지 마커 업데이트 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wr-images')) return;
    const gj = {
      type: 'FeatureCollection' as const,
      features: imgItems.map(img => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [img.lng, img.lat] },
        properties: { id: img.id, title: img.title, image: img.image, url: img.url, domain: img.domain, ageMin: img.ageMin, region: img.region },
      })),
    };
    try { (map.getSource('wr-images') as any).setData(gj); } catch {}
  }, [imgItems]);

  /* 위성 모드 전환 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      try {
        // 레이어 visibility
        const nightVis = satMode === 'nightlights' ? 'visible' : 'none';
        const trueVis  = satMode === 'truecolor'   ? 'visible' : 'none';
        const soarVis  = satMode === 'soar'        ? 'visible' : 'none';
        if (map.getLayer('wr-night-lights')) map.setLayoutProperty('wr-night-lights', 'visibility', nightVis);
        if (map.getLayer('wr-true-color'))   map.setLayoutProperty('wr-true-color',   'visibility', trueVis);
        if (map.getLayer('wr-soar'))         map.setLayoutProperty('wr-soar',         'visibility', soarVis);

        // 위성 기본 레이어 opacity
        const satOp = satMode === 'nightlights' ? 0.08 : satMode === 'truecolor' ? 0.08 : 0.90;
        if (map.getLayer('satellite-base'))  map.setPaintProperty('satellite-base', 'raster-opacity', satOp);

        // dark overlay: 줌 반응형 (줌인 시 위성 디테일 표시)
        if (map.getLayer('dark-overlay')) {
          const darkExpr = satMode === 'nightlights' ? 0.03 : satMode === 'soar' ? 0.08
            : ['interpolate', ['linear'], ['zoom'],
                4, 0.28,   // 광역뷰: 지도 느낌 살림
                9, 0.18,   // 중간 줌
                12, 0.05,  // 도시 수준: 거의 투명
                15, 0.0,   // 건물 수준: 완전 위성
              ];
          map.setPaintProperty('dark-overlay', 'raster-opacity', darkExpr);
        }
      } catch {}
    };
    if (map.isStyleLoaded?.()) apply(); else map.once('load', apply);
  }, [satMode]);

  useEffect(() => {
    dataRef.current = { siteScores, meAcled, meFirms, meQuakes, meAircraft };
    /* 궤적 업데이트 */
    meAircraft.forEach(ac => {
      if (!ac.lng || !ac.lat) return;
      const key = ac.icao24 || ac.callsign || String(ac.lat);
      const prev = trailsRef.current.get(key) ?? [];
      const last = prev[prev.length - 1];
      if (!last || Math.abs(last[0] - ac.lng) > 0.01 || Math.abs(last[1] - ac.lat) > 0.01) {
        trailsRef.current.set(key, [...prev, [ac.lng, ac.lat] as [number,number]].slice(-10));
      }
    });
    updateDynamicLayers();
  });

  function buildDynGeoJSON() {
    const d = dataRef.current;
    const columns = {
      type: 'FeatureCollection' as const,
      features: d.siteScores.filter(s => s.score > 20).map(s => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [circlePoly(s.lng, s.lat, 20)] },
        properties: { height: s.score * 700, color: s.score > 70 ? '#ef4444' : s.score > 45 ? '#f97316' : '#fbbf24' },
      })),
    };
    const fires = { type: 'FeatureCollection' as const, features: d.meFirms.map(f => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] }, properties: { frp: f.frp } })) };
    const conflicts = { type: 'FeatureCollection' as const, features: d.meAcled.map(e => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] }, properties: { severity: e.severity, title: e.titleKo || e.eventType, isRecent: e.isRecent || false } })) };
    const seismic = { type: 'FeatureCollection' as const, features: d.meQuakes.map(q => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [q.lng, q.lat] }, properties: { mag: q.magnitude } })) };
    const acft = { type: 'FeatureCollection' as const, features: d.meAircraft.map(a => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] }, properties: { callsign: a.callsign, mil: isMilitary(a.callsign) } })) };
    /* 궤적 (trail) */
    const trails = { type: 'FeatureCollection' as const, features: Array.from(trailsRef.current.entries()).filter(([,pts])=>pts.length>=2).map(([id,pts])=>({ type:'Feature' as const, geometry:{ type:'LineString' as const, coordinates: pts }, properties:{ id } })) };
    /* 기지 근접 화재 (FIRMS × 군사기지) */
    const baseStrikes = { type: 'FeatureCollection' as const, features: MILITARY_BASES.flatMap(base => {
      const nearby = d.meFirms.filter(f => {
        const dist = Math.sqrt(Math.pow((f.lat-base.lat)*111,2)+Math.pow((f.lng-base.lng)*111*Math.cos(base.lat*Math.PI/180),2));
        return dist < 25;
      });
      return nearby.length > 0 ? [{ type:'Feature' as const, geometry:{ type:'Point' as const, coordinates:[base.lng, base.lat] }, properties:{ name: base.name, fires: nearby.length, baseColor: BASE_COLOR[base.type]??'#ef4444' } }] : [];
    })};
    return { columns, fires, conflicts, seismic, acft, trails, baseStrikes };
  }

  function updateDynamicLayers() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded?.()) return;
    try {
      const { columns, fires, conflicts, seismic, acft, trails, baseStrikes } = buildDynGeoJSON();
      const pairs: [string, any][] = [
        ['wr-columns', columns], ['wr-fires', fires], ['wr-conflicts', conflicts],
        ['wr-seismic', seismic], ['wr-aircraft', acft], ['wr-trails', trails], ['wr-base-strikes', baseStrikes],
      ];
      pairs.forEach(([id, data]) => { if (map.getSource(id)) (map.getSource(id) as any).setData(data); });
    } catch {}
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            // 위성 이미지 (Esri World Imagery — 무료, 키 없음)
            satellite: {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: 'Esri World Imagery',
            },
            // 군사 그리드 다크 오버레이 (위성 위에 반투명 blending)
            darkgrid: {
              type: 'raster',
              tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
              tileSize: 256,
            },
          },
          layers: [
            // 위성 기반 — 채도 낮추고 약간 어둡게 (군사 열상 느낌)
            {
              id: 'satellite-base', type: 'raster', source: 'satellite',
              paint: {
                'raster-opacity': 0.92,
                'raster-saturation': -0.15,   // 약간만 탈채도 (전술 느낌 유지)
                'raster-brightness-min': 0.04,
                'raster-brightness-max': 0.95, // 더 밝게
                'raster-contrast': 0.08,
              },
            },
            // 다크 오버레이 (레이블·도로 살리면서 군사 분위기 유지)
            { id: 'dark-overlay', type: 'raster', source: 'darkgrid',
              paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.28, 9, 0.18, 12, 0.05, 15, 0.0] as any } },
          ],
        },
        center: [46, 32], zoom: 5.0, pitch: 45, bearing: 0,
      });

      map.on('load', () => {
        if (cancelled) return;
        const { columns, fires, conflicts, seismic, acft } = buildDynGeoJSON();

        /* ── 3D 지형 DEM ── */
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256, maxzoom: 14, encoding: 'terrarium',
        });
        map.setTerrain({ source: 'terrain-dem', exaggeration: 2.2 });
        map.addLayer({ id: 'wr-sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0,45], 'sky-atmosphere-sun-intensity': 5, 'sky-atmosphere-color': 'rgba(0,8,30,1)', 'sky-atmosphere-halo-color': 'rgba(0,50,100,0.5)' } } as any);

        /* ── 3D 건물 (OpenFreeMap 무료 벡터 타일, zoom 12+) ── */
        map.addSource('ofm-buildings', {
          type: 'vector',
          tiles: ['https://t1.openfreemap.org/planet/{z}/{x}/{y}.mvt'],
          minzoom: 8, maxzoom: 14,
          attribution: '© OpenFreeMap',
        });
        map.addLayer({
          id: 'wr-3d-buildings', type: 'fill-extrusion',
          source: 'ofm-buildings', 'source-layer': 'building',
          minzoom: 12,
          filter: ['all', ['!=', ['get', 'hide_3d'], true]],
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['coalesce', ['get','render_height'], 0],
              0, '#0a1828', 20, '#0d2038', 50, '#102844', 100, '#0f3060',
            ],
            'fill-extrusion-height':    ['coalesce', ['get','render_height'], ['get','height'], 4],
            'fill-extrusion-base':      ['coalesce', ['get','render_min_height'], 0],
            'fill-extrusion-opacity':   0.75,
          },
        });

        /* ── NASA GIBS 위성 레이어 ── */
        const gibsDate = getGibsDate();
        // 야간 조명 (VIIRS DNB — 도시 조명 감지)
        map.addSource('gibs-night', {
          type: 'raster',
          tiles: [`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_ENCC/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`],
          tileSize: 256, attribution: 'NASA GIBS / VIIRS',
        });
        // 야간 조명: dark-overlay 위에 레이어 추가 (위에 있어야 보임)
        map.addLayer({
          id: 'wr-night-lights', type: 'raster', source: 'gibs-night',
          paint: {
            'raster-opacity': 0.98,
            'raster-saturation': 0.2,
            'raster-brightness-min': 0.0,
            'raster-brightness-max': 4.0, // 도시 불빛 강조
            'raster-contrast': 0.5,       // 대비 강화
          },
          layout: { 'visibility': 'none' },
        }); // dark-overlay 위에 — 다른 레이어 아래

        // MODIS Terra 자연색 (250m 해상도, 실제 구름/지형 색상)
        map.addSource('gibs-true', {
          type: 'raster',
          tiles: [`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`],
          tileSize: 256, attribution: 'NASA GIBS / MODIS Terra',
        });
        map.addLayer({
          id: 'wr-true-color', type: 'raster', source: 'gibs-true',
          paint: { 'raster-opacity': 0.95 },
          layout: { 'visibility': 'none' },
        }, 'dark-overlay');

        // SOAR Atlas 실시간 위성 (soaratlas.com/maps/15424 — Iran War WMS)
        // wms.soar.earth CORS: Access-Control-Allow-Origin: * → 직접 사용 가능
        const SOAR_WMS = 'https://wms.soar.earth/maps/15424';
        map.addSource('soar-wms', {
          type: 'raster',
          tiles: [
            `${SOAR_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
            `&LAYERS=15424&CRS=EPSG:3857&BBOX={bbox-epsg-3857}` +
            `&WIDTH=256&HEIGHT=256&FORMAT=image/png&STYLES=&TRANSPARENT=true`,
          ],
          tileSize: 256,
          attribution: '© SOAR Atlas — soaratlas.com',
        });
        map.addLayer({
          id: 'wr-soar', type: 'raster', source: 'soar-wms',
          paint: { 'raster-opacity': 0.90 },
          layout: { 'visibility': 'none' },
        }, 'dark-overlay');

        /* ── 분쟁지역 해칭 패턴 ── */
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 12; patternCanvas.height = 12;
        const pc = patternCanvas.getContext('2d')!;
        pc.clearRect(0,0,12,12);
        pc.strokeStyle = '#ef4444'; pc.lineWidth = 0.9; pc.globalAlpha = 0.6;
        pc.beginPath(); pc.moveTo(0,12); pc.lineTo(12,0); pc.moveTo(-3,9); pc.lineTo(9,-3); pc.moveTo(3,15); pc.lineTo(15,3); pc.stroke();
        const imgData = pc.getImageData(0,0,12,12);
        map.addImage('conflict-hatch', { width:12, height:12, data: new Uint8Array(imgData.data.buffer) });

        const czGeoJSON = { type: 'FeatureCollection' as const, features: CONFLICT_ZONES.map(z => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [z.coords] }, properties: { name: z.name, color: z.color } })) };
        map.addSource('wr-conflict-zones', { type: 'geojson', data: czGeoJSON });
        // 반투명 fill
        map.addLayer({ id: 'wr-cz-fill', type: 'fill', source: 'wr-conflict-zones', paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.07 } });
        // 해칭 패턴
        map.addLayer({ id: 'wr-cz-hatch', type: 'fill', source: 'wr-conflict-zones', paint: { 'fill-pattern': 'conflict-hatch', 'fill-opacity': 0.5 } });
        // 경계선
        map.addLayer({ id: 'wr-cz-border', type: 'line', source: 'wr-conflict-zones', paint: { 'line-color': ['get','color'], 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } });
        // 구역 레이블
        map.addLayer({ id: 'wr-cz-label', type: 'symbol', source: 'wr-conflict-zones', layout: { 'text-field': ['get','name'], 'text-size': 9, 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-letter-spacing': 0.15 }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000000', 'text-halo-width': 2.5, 'text-opacity': 0.92 } });

        /* ── 해협 글로우 레이어 ── */
        const chopkGeoJSON = { type: 'FeatureCollection' as const, features: CHOKEPOINTS.map(c => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: c.coords }, properties: { name: c.name, color: c.color, width: c.width, critical: c.critical } })) };
        map.addSource('wr-chokepoints', { type: 'geojson', data: chopkGeoJSON });
        map.addLayer({ id: 'wr-chk-glow', type: 'line', source: 'wr-chokepoints', paint: { 'line-color': ['get','color'], 'line-width': 12, 'line-opacity': 0.18, 'line-blur': 8 } });
        map.addLayer({ id: 'wr-chk-line', type: 'line', source: 'wr-chokepoints', paint: { 'line-color': ['get','color'], 'line-width': ['get','width'], 'line-opacity': 0.85 } });
        map.addLayer({ id: 'wr-chk-label', type: 'symbol', source: 'wr-chokepoints', layout: { 'symbol-placement': 'line', 'text-field': ['get','name'], 'text-size': 9, 'text-font': ['literal', ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']] }, paint: { 'text-color': '#ff6a00', 'text-halo-color': '#000810', 'text-halo-width': 2 } });

        /* ── 미사일 사거리 원 ── */
        const missileRingsFtr = MISSILE_SYSTEMS.flatMap(m => [
          // 외곽 글로우
          { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [circlePoly(m.lng, m.lat, m.rangeKm * 1.03)] }, properties: { color: m.color, opacity: m.opacity * 0.5, id: m.name + '-glow' } },
          // 메인 링
          { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [circlePoly(m.lng, m.lat, m.rangeKm), circlePoly(m.lng, m.lat, m.rangeKm * 0.98)] }, properties: { color: m.color, opacity: m.opacity * 2, id: m.name } },
        ]);
        map.addSource('wr-missile-ranges', { type: 'geojson', data: { type: 'FeatureCollection', features: missileRingsFtr } });
        map.addLayer({ id: 'wr-missile-fill', type: 'fill', source: 'wr-missile-ranges', paint: { 'fill-color': ['get','color'], 'fill-opacity': ['get','opacity'] } });

        /* ── 군사기지 마커 ── */
        const basesGeoJSON = { type: 'FeatureCollection' as const, features: MILITARY_BASES.map(b => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [b.lng, b.lat] }, properties: { name: b.name, type: b.type, country: b.country, color: COUNTRY_COLOR[b.country] ?? '#94a3b8', symbol: BASE_SYMBOL[b.type] ?? '●', baseColor: BASE_COLOR[b.type] ?? '#94a3b8' } })) };
        map.addSource('wr-bases', { type: 'geojson', data: basesGeoJSON });
        // 헤일로
        map.addLayer({ id: 'wr-bases-halo', type: 'circle', source: 'wr-bases',
          paint: { 'circle-radius': 22, 'circle-color': ['get','baseColor'], 'circle-opacity': 0.12, 'circle-blur': 1.2 } });
        // 기지 점 (크기 증가)
        map.addLayer({ id: 'wr-bases-dot', type: 'circle', source: 'wr-bases',
          paint: { 'circle-radius': ['match', ['get','type'], 'nuclear', 11, 'airbase', 9, 8],
            'circle-color': ['get','baseColor'], 'circle-opacity': 0.95,
            'circle-stroke-width': 2, 'circle-stroke-color': '#000810' } });
        // 기지 레이블 (크기 증가, minzoom 낮춤)
        map.addLayer({ id: 'wr-bases-label', type: 'symbol', source: 'wr-bases', minzoom: 4.5,
          layout: { 'text-field': ['get','name'], 'text-size': 11, 'text-offset': [0,-1.6], 'text-anchor': 'bottom',
            'text-font': ['literal', ['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true, 'text-max-width': 10 },
          paint: { 'text-color': ['get','baseColor'], 'text-halo-color': '#000810', 'text-halo-width': 2.5 } });

        /* ── 위협 기둥 ── */
        // 원기둥 소스 유지 (데이터 업데이트용), 레이어는 렌더링 안 함
        map.addSource('wr-columns', { type: 'geojson', data: columns });

        /* ── FIRMS 화재 ── */
        map.addSource('wr-fires', { type: 'geojson', data: fires });
        map.addLayer({ id: 'wr-fires-halo', type: 'circle', source: 'wr-fires', paint: { 'circle-radius': 18, 'circle-color': '#ff6a00', 'circle-opacity': 0.10, 'circle-blur': 1.2 } });
        map.addLayer({ id: 'wr-fires-dot', type: 'circle', source: 'wr-fires', paint: { 'circle-radius': ['interpolate',['linear'],['get','frp'], 0,3, 200,9], 'circle-color': '#ff6a00', 'circle-opacity': 0.92 } });

        /* ── GDELT 분쟁 ── */
        map.addSource('wr-conflicts', { type: 'geojson', data: conflicts });
        map.addLayer({ id: 'wr-conflicts-halo', type: 'circle', source: 'wr-conflicts',
          paint: { 'circle-radius': 18, 'circle-color': ['match',['get','severity'],'critical','#ef4444','high','#f97316','#fbbf24'],
            'circle-opacity': 0.15, 'circle-blur': 1 } });
        map.addLayer({ id: 'wr-conflicts-dot', type: 'circle', source: 'wr-conflicts',
          paint: { 'circle-radius': ['match',['get','severity'],'critical',10,'high',8,6],
            'circle-color': ['match',['get','severity'],'critical','#ef4444','high','#f97316','#fbbf24'],
            'circle-opacity': ['case',['get','isRecent'],1,0.82],
            'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

        /* ── USGS ── */
        map.addSource('wr-seismic', { type: 'geojson', data: seismic });
        map.addLayer({ id: 'wr-seismic-dot', type: 'circle', source: 'wr-seismic', paint: { 'circle-radius': ['interpolate',['linear'],['get','mag'], 2.5,5, 6,14], 'circle-color': '#f97316', 'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff7ed' } });

        /* ── ADS-B / OpenSky 항공기 ── */
        map.addSource('wr-aircraft', { type: 'geojson', data: acft });
        // 일반 항공기: 흰색 배경 점 + 파란 외곽
        map.addLayer({ id: 'wr-aircraft-dot', type: 'circle', source: 'wr-aircraft',
          filter: ['!=', ['get','mil'], true],
          paint: { 'circle-radius': 5, 'circle-color': '#60a5fa', 'circle-opacity': 0.92,
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } });
        map.addLayer({ id: 'wr-aircraft-label', type: 'symbol', source: 'wr-aircraft',
          filter: ['!=', ['get','mil'], true],
          minzoom: 7,
          layout: { 'text-field': ['get','callsign'], 'text-size': 10, 'text-offset': [0,-1.4], 'text-anchor': 'bottom',
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true },
          paint: { 'text-color': '#93c5fd', 'text-halo-color': '#000c1a', 'text-halo-width': 2 } });
        /* ── 군용기 — 황색 강조 ── */
        map.addLayer({ id: 'wr-aircraft-mil-halo', type: 'circle', source: 'wr-aircraft',
          filter: ['==', ['get','mil'], true],
          paint: { 'circle-radius': 22, 'circle-color': '#facc15', 'circle-opacity': 0.18, 'circle-blur': 1 } });
        map.addLayer({ id: 'wr-aircraft-mil-dot', type: 'circle', source: 'wr-aircraft',
          filter: ['==', ['get','mil'], true],
          paint: { 'circle-radius': 8, 'circle-color': '#facc15', 'circle-opacity': 1,
            'circle-stroke-width': 2.5, 'circle-stroke-color': '#fef08a' } });
        map.addLayer({ id: 'wr-aircraft-mil-label', type: 'symbol', source: 'wr-aircraft',
          filter: ['==', ['get','mil'], true],
          layout: { 'text-field': ['get','callsign'], 'text-size': 11, 'text-offset': [0,-1.8], 'text-anchor': 'bottom',
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true },
          paint: { 'text-color': '#facc15', 'text-halo-color': '#000810', 'text-halo-width': 2 } });

        /* ── 항공기 궤적 trail ── */
        const { trails: initialTrails, baseStrikes: initialBaseStrikes } = buildDynGeoJSON();
        map.addSource('wr-trails', { type: 'geojson', data: initialTrails });
        map.addLayer({ id: 'wr-trails-line', type: 'line', source: 'wr-trails', paint: { 'line-color': '#60a5fa', 'line-width': 1.5, 'line-opacity': 0.5, 'line-blur': 0.5 } });

        /* ── 기지 근접 화재 경보 ── */
        map.addSource('wr-base-strikes', { type: 'geojson', data: initialBaseStrikes });
        map.addLayer({ id: 'wr-base-strike-ring1', type: 'circle', source: 'wr-base-strikes', paint: { 'circle-radius': 30, 'circle-color': '#ef4444', 'circle-opacity': 0.05, 'circle-blur': 1 } });
        map.addLayer({ id: 'wr-base-strike-ring2', type: 'circle', source: 'wr-base-strikes', paint: { 'circle-radius': 18, 'circle-color': '#ef4444', 'circle-opacity': 0.12, 'circle-blur': 0.5 } });
        map.addLayer({ id: 'wr-base-strike-dot', type: 'circle', source: 'wr-base-strikes', paint: { 'circle-radius': 8, 'circle-color': '#ef4444', 'circle-opacity': 1, 'circle-stroke-width': 2, 'circle-stroke-color': '#fca5a5' } });
        map.addLayer({ id: 'wr-base-strike-label', type: 'symbol', source: 'wr-base-strikes', layout: { 'text-field': ['concat', '⚠ ', ['get','name']], 'text-size': 10, 'text-offset': [0, -1.6], 'text-anchor': 'bottom', 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']] }, paint: { 'text-color': '#fca5a5', 'text-halo-color': '#000810', 'text-halo-width': 2 } });

        /* ── 뉴스 이미지 마커 ── */
        const emptyGJ = { type: 'FeatureCollection' as const, features: [] };
        map.addSource('wr-images', { type: 'geojson', data: emptyGJ });
        map.addLayer({ id: 'wr-img-halo', type: 'circle', source: 'wr-images', paint: { 'circle-radius': 14, 'circle-color': '#60a5fa', 'circle-opacity': 0.12, 'circle-blur': 1 } });
        map.addLayer({ id: 'wr-img-dot', type: 'circle', source: 'wr-images', paint: { 'circle-radius': 7, 'circle-color': '#1e40af', 'circle-opacity': 0.92, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#93c5fd' } });
        map.addLayer({ id: 'wr-img-icon', type: 'symbol', source: 'wr-images', layout: { 'text-field': '📸', 'text-size': 13, 'text-allow-overlap': true, 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']] }, paint: { 'text-opacity': 0.95 } });

        map.on('click', 'wr-img-dot', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          const age = p.ageMin != null ? (p.ageMin < 60 ? `${p.ageMin}분 전` : `${Math.floor(p.ageMin/60)}h 전`) : '';
          new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'wr-img-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#000810;color:#e2e8f0;font-family:monospace;border:1px solid #1a3a4a;border-radius:3px;overflow:hidden;width:260px">
                <img src="${p.image}" style="width:100%;height:140px;object-fit:cover;display:block" onerror="this.style.display='none'" />
                <div style="padding:8px 10px">
                  <div style="font-size:10px;line-height:1.5;color:#c0d8e8;margin-bottom:4px;font-weight:700">${p.titleKo || p.title}</div>
                  ${p.titleKo ? `<div style="font-size:8px;line-height:1.3;color:#4a7a9b;margin-bottom:4px">${p.title}</div>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:8px;color:#4a7a9b">${p.domain}</span>
                    <span style="font-size:8px;color:#4a7a9b">${age}</span>
                  </div>
                  <a href="${p.url}" target="_blank" rel="noopener" style="display:block;margin-top:6px;text-align:center;font-size:9px;color:#60a5fa;text-decoration:none;border:1px solid #1a3a4a;padding:3px;border-radius:2px;letter-spacing:1px">기사 전문 →</a>
                </div>
              </div>`)
            .addTo(map);
        });
        ['wr-img-dot','wr-img-icon'].forEach(id => {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        });

        /* ══ 군사 자산 배치 레이어 (MIL-STD-2525 스타일) ══ */
        const forceGJ = {
          type: 'FeatureCollection' as const,
          features: FORCE_ASSETS.map(a => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
            properties: {
              id: a.id, name: a.name, detail: a.detail,
              side: a.side, type: a.type, active: a.active,
              color:    SIDE_COLOR[a.side],
              symbol:   TYPE_SYMBOL[a.type],
              sideLabel: SIDE_LABEL[a.side],
              typeLabel: TYPE_LABEL[a.type],
              radius:   a.strength === 'xl' ? 11 : a.strength === 'lg' ? 8 : a.strength === 'md' ? 6 : 4,
              opacity:  a.active ? 1 : 0.42,
              strokeOpacity: a.active ? 0.9 : 0.3,
            },
          })),
        };
        map.addSource('wr-forces', { type: 'geojson', data: forceGJ });

        // 비활성 자산: 점선 테두리만
        map.addLayer({ id: 'wr-forces-inactive-ring', type: 'circle', source: 'wr-forces',
          filter: ['==', ['get','active'], false],
          paint: { 'circle-radius': ['get','radius'], 'circle-color': 'transparent', 'circle-opacity': 0.5, 'circle-stroke-width': 1.5, 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.4 },
        });

        // 활성 자산: 외부 글로우 링
        map.addLayer({ id: 'wr-forces-glow', type: 'circle', source: 'wr-forces',
          filter: ['==', ['get','active'], true],
          paint: { 'circle-radius': ['+', ['get','radius'], 10], 'circle-color': ['get','color'], 'circle-opacity': 0.08, 'circle-blur': 1 },
        });
        // 뉴스 언급 자산: 오렌지 외부 펄스 (CSS 애니메이션)
        map.addLayer({ id: 'wr-forces-news-pulse', type: 'circle', source: 'wr-forces',
          filter: ['==', ['get','newsActive'], true],
          paint: { 'circle-radius': ['+', ['get','radius'], 18], 'circle-color': '#f97316', 'circle-opacity': 0.12, 'circle-blur': 1.5 },
        });

        // 활성 자산: 내부 채움
        map.addLayer({ id: 'wr-forces-fill', type: 'circle', source: 'wr-forces',
          filter: ['==', ['get','active'], true],
          paint: { 'circle-radius': ['get','radius'], 'circle-color': ['get','color'], 'circle-opacity': ['get','opacity'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': 0.6 },
        });
        // SDF 아이콘 등록 (타입별 실루엣)
        (['missile','drone','navy','ground','airdef','carrier','bomber','special','proxy_rocket','proxy_ground'] as ForceType[]).forEach(t => {
          map.addImage(`force-icon-${t}`, makeSdfIcon(t, 24), { sdf: true } as any);
        });
        // SDF 아이콘 레이어 (진영색 자동 적용)
        map.addLayer({ id: 'wr-forces-icon', type: 'symbol', source: 'wr-forces',
          layout: {
            'icon-image': ['concat', 'force-icon-', ['get','type']],
            // 전체적으로 1.5x 크게 → 더 잘 보임
            'icon-size': ['case',['==',['get','strength'],'xl'],2.0,['==',['get','strength'],'lg'],1.65,['==',['get','strength'],'md'],1.3,1.0],
            'icon-allow-overlap': true, 'icon-rotation-alignment': 'map',
          } as any,
          paint: { 'icon-color': ['get','color'], 'icon-opacity': ['get','opacity'], 'icon-halo-color': '#000000', 'icon-halo-width': 1.5 } as any,
        });
        // 부대명 레이블 (더 크고 더 일찍 표시)
        map.addLayer({ id: 'wr-forces-label', type: 'symbol', source: 'wr-forces',
          minzoom: 4,
          layout: { 'text-field': ['get','name'], 'text-size': 11, 'text-offset': [0, -2.2], 'text-anchor': 'bottom',
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true, 'text-max-width': 14 },
          paint: { 'text-color': ['get','color'], 'text-halo-color': '#000810', 'text-halo-width': 2.5, 'text-opacity': ['get','opacity'] },
        });

        // 클릭 팝업
        map.on('click', 'wr-forces-fill', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          const activeStr = p.active ? '<span style="color:#22c55e;font-weight:700">● ACTIVE</span>' : '<span style="color:#4a7a9b">○ STANDBY</span>';
          new maplibregl.Popup({ closeButton: false, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#000810;color:#e2e8f0;padding:10px 14px;font-family:monospace;font-size:11px;border:1px solid ${p.color}55;border-radius:2px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <span style="font-size:16px">${p.symbol}</span>
                  <div>
                    <div style="color:${p.color};font-weight:900;font-size:12px">${p.name}</div>
                    <div style="color:#4a7a9b;font-size:9px;letter-spacing:2px">${p.sideLabel} · ${p.typeLabel}</div>
                  </div>
                  <div style="margin-left:auto">${activeStr}</div>
                </div>
                <div style="color:#8aa3ba;line-height:1.5">${p.detail}</div>
              </div>`)
            .addTo(map);
        });
        map.on('click', 'wr-forces-inactive-ring', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#000810;color:#e2e8f0;padding:8px 12px;font-family:monospace;font-size:11px;border:1px solid ${p.color}33"><span style="color:${p.color}">${p.symbol} ${p.name}</span><br/><span style="color:#4a7a9b;font-size:9px">○ STANDBY · ${p.sideLabel}</span><br/><span style="color:#8aa3ba">${p.detail}</span></div>`)
            .addTo(map);
        });
        ['wr-forces-fill','wr-forces-inactive-ring'].forEach(id => {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        });

        /* ── 미사일 사거리 레이블 ── */
        const missileLabels = { type: 'FeatureCollection' as const, features: MISSILE_SYSTEMS.map(m => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [m.lng + (m.rangeKm / 111) * 0.7, m.lat] }, properties: { label: m.name, color: m.color } })) };
        map.addSource('wr-missile-labels', { type: 'geojson', data: missileLabels });
        map.addLayer({ id: 'wr-missile-label-txt', type: 'symbol', source: 'wr-missile-labels', layout: { 'text-field': ['get','label'], 'text-size': 8, 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true }, paint: { 'text-color': ['get','color'], 'text-halo-color': '#000810', 'text-halo-width': 1.5, 'text-opacity': 0.7 } });

        /* ── 라이브스트림 채널 마커 (📺/📡) ── */
        const streamGJ = {
          type: 'FeatureCollection' as const,
          features: LIVE_STREAMS.map(s => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
            properties: { id: s.id, nameKo: s.nameKo, emoji: s.emoji, url: s.url, flag: s.flag },
          })),
        };
        map.addSource('wr-streams', { type: 'geojson', data: streamGJ });
        map.addLayer({ id: 'wr-streams-halo', type: 'circle', source: 'wr-streams',
          paint: { 'circle-radius': 14, 'circle-color': '#9333ea', 'circle-opacity': 0.10, 'circle-blur': 1 },
        });
        map.addLayer({ id: 'wr-streams-dot', type: 'circle', source: 'wr-streams',
          paint: { 'circle-radius': 7, 'circle-color': '#581c87', 'circle-opacity': 0.88,
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#a855f7' },
        });
        map.addLayer({ id: 'wr-streams-icon', type: 'symbol', source: 'wr-streams',
          layout: { 'text-field': ['get','emoji'], 'text-size': 12, 'text-allow-overlap': true,
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']] },
          paint: { 'text-opacity': 0.95 },
        });
        map.on('click', 'wr-streams-dot', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#0c0a1a;color:#e2e8f0;padding:10px 14px;font-family:monospace;border:1px solid #7e22ce55;border-radius:3px">
                <div style="font-size:11px;font-weight:700;color:#c084fc;margin-bottom:6px">${p.flag} ${p.nameKo}</div>
                <div style="font-size:9px;color:#6d28d9;margin-bottom:8px;letter-spacing:1px">📡 LIVE BROADCAST</div>
                <a href="${p.url}" target="_blank" rel="noopener"
                   style="display:block;text-align:center;background:#581c87;color:#e9d5ff;font-size:10px;padding:5px;border-radius:2px;text-decoration:none;letter-spacing:1px;border:1px solid #7c3aed">
                  ▶ YouTube LIVE 열기
                </a>
              </div>`)
            .addTo(map);
        });
        map.on('mouseenter','wr-streams-dot',()=>{ map.getCanvas().style.cursor='pointer'; });
        map.on('mouseleave','wr-streams-dot',()=>{ map.getCanvas().style.cursor=''; });

        /* ── 타격 보고 레이어 🎯 ── */
        map.addSource('wr-strikes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        // 외부 글로우
        map.addLayer({ id: 'wr-strikes-glow', type: 'circle', source: 'wr-strikes',
          paint: { 'circle-radius': 22, 'circle-color': ['get','color'], 'circle-opacity': 0.12, 'circle-blur': 1.5 },
        });
        // 크로스헤어 inner
        map.addLayer({ id: 'wr-strikes-ring', type: 'circle', source: 'wr-strikes',
          paint: { 'circle-radius': 11, 'circle-color': 'transparent',
            'circle-stroke-width': 2, 'circle-stroke-color': ['get','color'], 'circle-stroke-opacity': 0.85 },
        });
        map.addLayer({ id: 'wr-strikes-dot', type: 'circle', source: 'wr-strikes',
          paint: { 'circle-radius': 4, 'circle-color': ['get','color'], 'circle-opacity': 1 },
        });
        // 🎯 이모지 + 라벨
        map.addLayer({ id: 'wr-strikes-icon', type: 'symbol', source: 'wr-strikes',
          layout: { 'text-field': '🎯', 'text-size': 14, 'text-offset': [0,-1.4], 'text-allow-overlap': true,
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']] },
          paint: { 'text-opacity': 1 },
        });
        map.addLayer({ id: 'wr-strikes-label', type: 'symbol', source: 'wr-strikes',
          minzoom: 7,
          layout: { 'text-field': ['get','title'], 'text-size': 8.5, 'text-offset': [0, 1.8], 'text-anchor': 'top',
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-max-width': 14, 'text-optional': true },
          paint: { 'text-color': ['get','color'], 'text-halo-color': '#000810', 'text-halo-width': 2 },
        });
        // 클릭 팝업
        map.on('click', 'wr-strikes-dot', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          const tStr = p.timestamp ? new Date(p.timestamp).toLocaleString('ko-KR', { timeZone:'Asia/Seoul' }) : '';
          new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#000810;color:#e2e8f0;padding:10px 14px;font-family:monospace;border:1px solid ${p.color}55;border-radius:2px">
                <div style="display:flex;align-items:center;gap:6;margin-bottom:6px">
                  <span style="font-size:18px">🎯</span>
                  <div style="flex:1">
                    <div style="font-size:12px;font-weight:900;color:${p.color}">${p.title}</div>
                    <div style="font-size:9px;color:#4a7a9b;letter-spacing:1px">${p.label} · ${p.source}</div>
                  </div>
                </div>
                ${p.desc ? `<div style="font-size:10px;color:#8aa3ba;line-height:1.5;margin-bottom:6px">${p.desc}</div>` : ''}
                <div style="font-size:8px;color:#2d5a7a">${tStr}</div>
                ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" style="display:block;margin-top:5px;font-size:9px;color:#60a5fa;letter-spacing:1px">소스 링크 →</a>` : ''}
              </div>`)
            .addTo(map);
        });
        map.on('mouseenter','wr-strikes-dot',()=>{ map.getCanvas().style.cursor='crosshair'; });
        map.on('mouseleave','wr-strikes-dot',()=>{ map.getCanvas().style.cursor=''; });

        /* ── 우클릭 → 타격 보고 ── */
        map.on('contextmenu', (e: any) => {
          if (onMapRightClick) {
            e.preventDefault?.();
            onMapRightClick(e.lngLat.lat, e.lngLat.lng);
          }
        });

        /* ── 영공 제한 구역 circles (초기 로드 시 비어있으면 로드 후 업데이트) ── */
        map.addSource('wr-airspace', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'wr-airspace-fill', type: 'fill', source: 'wr-airspace',
          paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.06 },
        });
        map.addLayer({ id: 'wr-airspace-border', type: 'line', source: 'wr-airspace',
          paint: { 'line-color': ['get','color'], 'line-width': 1.5, 'line-opacity': 0.55,
            'line-dasharray': [6, 4] },
        });
        map.addLayer({ id: 'wr-airspace-label', type: 'symbol', source: 'wr-airspace',
          layout: { 'text-field': ['get','label'], 'text-size': 8.5,
            'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true },
          paint: { 'text-color': ['get','color'], 'text-halo-color': '#000810', 'text-halo-width': 2, 'text-opacity': 0.9 },
        });

        /* ── 애니메이션: 미사일 사거리 펄스 ── */
        let phase = 0;
        const animate = () => {
          phase = (phase + 0.025) % (Math.PI * 2);
          const op = 0.08 + Math.sin(phase) * 0.05;
          try { map.setPaintProperty('wr-missile-fill', 'fill-opacity', op); } catch {}
          rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);

        /* ── 클릭 팝업 ── */
        map.on('click', 'wr-conflicts-dot', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#000810;color:#e2e8f0;padding:8px 12px;font-family:monospace;font-size:11px;border:1px solid #ef444444"><b style="color:#ef4444">${(p.severity ?? '').toUpperCase()}</b><br/>${p.title ?? ''}</div>`)
            .addTo(map);
        });
        map.on('click', 'wr-bases-dot', (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="background:#000810;color:#e2e8f0;padding:8px 12px;font-family:monospace;font-size:11px;border:1px solid #3b82f644"><b style="color:${p.baseColor}">${BASE_SYMBOL[p.type]} ${p.name}</b><br/><span style="color:#4a7a9b">${p.type.toUpperCase()}</span></div>`)
            .addTo(map);
        });
        ['wr-conflicts-dot','wr-bases-dot','wr-fires-dot'].forEach(id => {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
        mapRef.current = map;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const SIDES: { side: Side; label: string; icon: string }[] = [
    { side: 'iran',      label: '이란 IRGC',  icon: '🔴' },
    { side: 'israel',    label: 'IDF',         icon: '🔵' },
    { side: 'us',        label: '미국',         icon: '🔷' },
    { side: 'hezbollah', label: '헤즈볼라',    icon: '🟠' },
    { side: 'houthi',    label: '후티',         icon: '🟡' },
    { side: 'pmf',       label: 'PMF',          icon: '🟤' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
      {/* 진영 필터 토글 오버레이 */}
      <div style={{ position:'absolute', bottom:28, left:8, zIndex:20, display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ fontSize:10, color:'#2d5a7a', letterSpacing:2, marginBottom:2, fontFamily:"'Courier New', monospace" }}>▸ FORCE FILTER</div>
        {SIDES.map(({ side, label, icon }) => {
          const active = !hiddenSides.has(side);
          const col = SIDE_COLOR[side];
          return (
            <button key={side} onClick={() => setHiddenSides(prev => {
              const n = new Set(prev);
              if (n.has(side)) n.delete(side); else n.add(side);
              return n;
            })} style={{
              display:'flex', alignItems:'center', gap:5,
              background: active ? col+'22' : '#00000066',
              border: `1px solid ${active ? col+'88' : '#1a3a4a'}`,
              borderRadius:2, padding:'2px 7px', cursor:'pointer',
              fontFamily:"'Courier New', monospace", fontSize:11,
              color: active ? col : '#2d5a7a',
              letterSpacing:1, transition:'all 0.15s',
            }}>
              <span style={{ fontSize:11, opacity: active ? 1 : 0.4 }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TENSION MINI CHART
══════════════════════════════════════════════════════ */
interface TensionPoint { time: number; score: number; }

function TensionChart({ data, gdeltPoints }: { data: TensionPoint[]; gdeltPoints: {date:string;tone:number}[] }) {
  const W = 240, H = 48;

  // 로컬 threat 히스토리 차트
  const localData = data.slice(-30);
  if (localData.length < 2 && gdeltPoints.length < 2) {
    return <div style={{ height: H, display:'flex', alignItems:'center', justifyContent:'center', color:'#1e3a5f', fontSize:11 }}>데이터 수집 중...</div>;
  }

  // GDELT tone 정규화 (tone은 보통 -20 ~ +20 범위, 위협 지수로 역변환)
  const useGdelt = gdeltPoints.length >= 2;
  const pts = useGdelt
    ? gdeltPoints.map((p,i) => ({ x: i, y: Math.max(0, Math.min(100, 50 - p.tone * 3)) }))
    : localData.map((p,i) => ({ x: i, y: p.score }));

  const n = pts.length;
  const minX = 0, maxX = n - 1;
  const minY = Math.min(...pts.map(p=>p.y)) - 5;
  const maxY = Math.max(...pts.map(p=>p.y)) + 5;
  const scaleX = (x: number) => ((x - minX) / (maxX - minX || 1)) * (W - 20) + 10;
  const scaleY = (y: number) => H - 6 - ((y - minY) / (maxY - minY || 1)) * (H - 12);

  const polyline = pts.map(p => `${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');
  const areaPath = `M${scaleX(pts[0].x).toFixed(1)},${H-6} ` + pts.map(p=>`L${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ') + ` L${scaleX(pts[n-1].x).toFixed(1)},${H-6} Z`;

  const lastY = pts[n-1]?.y ?? 0;
  const lineColor = lastY > 70 ? '#ef4444' : lastY > 45 ? '#f97316' : '#fbbf24';

  return (
    <svg width={W} height={H} style={{ display:'block', width:'100%', height: H }}>
      {/* 그리드 라인 */}
      {[25, 50, 75].map(v => (
        <line key={v} x1={10} x2={W-10} y1={scaleY(Math.min(v, maxY))} y2={scaleY(Math.min(v, maxY))} stroke="#0a1f2f" strokeWidth={1} />
      ))}
      {/* 영역 fill */}
      <path d={areaPath} fill={lineColor} fillOpacity={0.08} />
      {/* 라인 */}
      <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" />
      {/* 현재 포인트 */}
      <circle cx={scaleX(pts[n-1].x)} cy={scaleY(pts[n-1].y)} r={3} fill={lineColor} />
      {/* 현재값 레이블 */}
      <text x={scaleX(pts[n-1].x)+5} y={scaleY(pts[n-1].y)+4} fontSize={9} fill={lineColor} fontFamily="monospace">{lastY.toFixed(0)}</text>
      {/* 소스 레이블 */}
      <text x={12} y={H-2} fontSize={7} fill="#2d5a7a" fontFamily="monospace">{useGdelt?'GDELT TONE':'LOCAL THREAT'}</text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   SDF MILITARY ICON GENERATOR — 실루엣 아이콘 (24×24 canvas)
   흰색으로 그려 MapLibre SDF color 적용
══════════════════════════════════════════════════════ */
function makeSdfIcon(type: ForceType, size = 24): { width: number; height: number; data: Uint8Array } {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  const s = size, cx = s / 2, cy = s / 2;
  switch (type) {
    case 'missile': {
      ctx.beginPath(); ctx.moveTo(cx,1); ctx.lineTo(cx+3,s-5); ctx.lineTo(cx-3,s-5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx-3,s*0.55); ctx.lineTo(cx-8,s-4); ctx.lineTo(cx-3,s-5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx+3,s*0.55); ctx.lineTo(cx+8,s-4); ctx.lineTo(cx+3,s-5); ctx.closePath(); ctx.fill();
      break;
    }
    case 'drone': {
      ctx.beginPath(); ctx.moveTo(cx,2); ctx.lineTo(s-2,s-3); ctx.lineTo(cx+2,s-6); ctx.lineTo(cx,s-3); ctx.lineTo(cx-2,s-6); ctx.lineTo(2,s-3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'navy': {
      ctx.beginPath(); ctx.ellipse(cx, cy+2, s*0.44, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(cx-3, cy-5, 6, 6); ctx.fillRect(cx+2, cy-7, 2, 4);
      break;
    }
    case 'ground': {
      ctx.fillRect(3, cy-3, s-6, 6); ctx.fillRect(cx-4, cy-5, 8, 4); ctx.fillRect(cx-1, 2, 2, cy-3);
      break;
    }
    case 'airdef': {
      ctx.beginPath(); ctx.arc(cx, cy+3, s*0.32, Math.PI, 0); ctx.lineWidth=2; ctx.stroke();
      ctx.fillRect(cx-1, cy-8, 2, 12); ctx.fillRect(cx-5, cy+2, 10, 2);
      break;
    }
    case 'carrier': {
      ctx.fillRect(2, cy-2, s-4, 5); ctx.fillRect(cx+2, cy-6, 4, 6); ctx.fillRect(cx-10, cy-4, 2, 4);
      break;
    }
    case 'bomber': {
      ctx.beginPath(); ctx.moveTo(cx,cy-1); ctx.lineTo(s-1,s-3); ctx.lineTo(cx+3,cy+3); ctx.lineTo(cx-3,cy+3); ctx.lineTo(1,s-3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'special': {
      for (let i=0; i<5; i++) {
        const a=(i*4*Math.PI/5)-Math.PI/2, a2=((i*4+2)*Math.PI/5)-Math.PI/2;
        if(i===0){ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*s*0.44,cy+Math.sin(a)*s*0.44);}else{ctx.lineTo(cx+Math.cos(a)*s*0.44,cy+Math.sin(a)*s*0.44);}
        ctx.lineTo(cx+Math.cos(a2)*s*0.18,cy+Math.sin(a2)*s*0.18);
      }
      ctx.closePath(); ctx.fill(); break;
    }
    case 'proxy_rocket': {
      ctx.beginPath(); ctx.moveTo(cx,1); ctx.lineTo(cx+4,8); ctx.lineTo(cx+2,8); ctx.lineTo(cx+2,s-4); ctx.lineTo(cx-2,s-4); ctx.lineTo(cx-2,8); ctx.lineTo(cx-4,8); ctx.closePath(); ctx.fill();
      break;
    }
    case 'proxy_ground': default: {
      ctx.beginPath(); ctx.moveTo(cx,2); ctx.lineTo(s-3,cy); ctx.lineTo(cx,s-2); ctx.lineTo(3,cy); ctx.closePath(); ctx.fill();
      break;
    }
  }
  const d = ctx.getImageData(0,0,size,size);
  return { width:size, height:size, data: new Uint8Array(d.data.buffer) };
}

/* ══════════════════════════════════════════════════════
   ESCALATION INDEX — 리버스 리얼리티 엔진
   과거 4개 전쟁 직전 패턴 벡터와 코사인 유사도 계산
══════════════════════════════════════════════════════ */
const REF_EVENTS = [
  // [WTI, GDELT, MIL, VIX, FIRMS, Brent-WTI스프레드, ILS(셰켈약세), Gold, IRR(리알약세)]
  { id:'hamas-oct7',   label:'하마스 10/7',     date:'2023-10-07', vec:[0.08,0.62,0.75,0.45,0.70, 0.60,0.75,0.40, 0.55] },
  { id:'iran-apr24',   label:'이란 직공 4/13',  date:'2024-04-13', vec:[0.12,0.71,0.85,0.55,0.60, 0.80,0.85,0.55, 0.65] },
  { id:'iran-oct24',   label:'이란 2차 10/1',   date:'2024-10-01', vec:[0.09,0.58,0.72,0.40,0.65, 0.65,0.70,0.45, 0.60] },
  { id:'ukraine-feb22',label:'우크라 침공',      date:'2022-02-24', vec:[0.14,0.80,0.90,0.65,0.50, 0.50,0.20,0.70, 0.10] },
  { id:'israel-leb06', label:'레바논 전쟁',      date:'2006-07-12', vec:[0.06,0.55,0.80,0.38,0.60, 0.55,0.65,0.35, 0.45] },
];
// 벡터 차원: [WTI, GDELT tone, 군사활동, VIX, FIRMS, Brent-WTI스프레드, ILS변화, Gold변화, IRR리알]

function cosine(a: number[], b: number[]) {
  const dot = a.reduce((s,x,i) => s + x * b[i], 0);
  const ma  = Math.sqrt(a.reduce((s,x) => s + x*x, 0));
  const mb  = Math.sqrt(b.reduce((s,x) => s + x*x, 0));
  return (ma && mb) ? dot / (ma * mb) : 0;
}

interface EscalationData {
  index: number;
  best: typeof REF_EVENTS[number] & { score: number };
  signals: Array<{ label:string; val:number; threshold:number }>;
}

function EscalationPanel({ data }: { data: EscalationData }) {
  const { index, best, signals } = data;
  const col = index >= 70 ? '#ef4444' : index >= 45 ? '#f97316' : index >= 25 ? '#fbbf24' : '#22c55e';
  const levelLabel = index >= 70 ? 'CRITICAL' : index >= 45 ? 'ELEVATED' : index >= 25 ? 'WATCH' : 'NORMAL';
  const hitCount = signals.filter(s => s.val >= s.threshold).length;

  return (
    <div style={{ padding:'8px 12px', borderBottom:'1px solid #0a1f2f', background:'#020c18', flexShrink:0 }}>
      <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:6 }}>
        ▸ ESCALATION INDEX
        <span style={{ fontSize:10, color:col, fontWeight:900, letterSpacing:2, marginLeft:'auto',
          ...(index >= 70 ? { animation:'wr-blink 1s infinite' } : {}) }}>{levelLabel}</span>
      </div>

      {/* 복합 게이지 */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <div style={{ flex:1, height:8, background:'#0a1f2f', borderRadius:1, overflow:'hidden', position:'relative' }}>
          <div style={{ width:`${index}%`, height:'100%', background:`linear-gradient(90deg, #22c55e, #fbbf24 50%, ${col})`, transition:'width 1.2s ease', boxShadow:`0 0 8px ${col}88` }} />
          {/* 과거 사건 임계치 마커 */}
          {[25, 45, 70].map(t => (
            <div key={t} style={{ position:'absolute', left:`${t}%`, top:0, bottom:0, width:1, background:'#1a3a4a', opacity:0.6 }} />
          ))}
        </div>
        <span style={{ fontSize:14, fontWeight:900, color:col, minWidth:32, textAlign:'right', textShadow:`0 0 8px ${col}` }}>{index}</span>
      </div>

      {/* 가장 유사한 과거 사건 */}
      <div style={{ fontSize:11, color:'#8aa3ba', marginBottom:6, padding:'4px 8px', background:`${col}0d`, border:`1px solid ${col}22`, borderRadius:2 }}>
        <span style={{ color:'#4a7a9b' }}>최근접 패턴: </span>
        <span style={{ color:col, fontWeight:700 }}>{best.label}</span>
        <span style={{ color:'#4a7a9b' }}> ({best.date})</span>
        <span style={{ color:col, fontWeight:900, marginLeft:6 }}>{Math.round(best.score * 100)}%</span>
      </div>

      {/* 시그널 체크리스트 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 0', marginBottom:4 }}>
        {signals.map(s => {
          const active = s.val >= s.threshold;
          const pct = Math.round(s.val * 100);
          return (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10 }}>
              <span style={{ color: active ? col : '#1a3a4a', fontSize:11, fontWeight:900 }}>{active ? '◉' : '○'}</span>
              <span style={{ color: active ? '#c0d8e8' : '#2d5a7a' }}>{s.label}</span>
              <span style={{ color: active ? col : '#1a3a4a', marginLeft:'auto', fontSize:11 }}>{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* 요약 */}
      <div style={{ fontSize:10, color:'#4a7a9b', textAlign:'right', letterSpacing:1 }}>
        {hitCount}/{signals.length} 시그널 활성 · 벡터 유사도 분석
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   VOLUME HISTOGRAM — 24h 이벤트 볼륨 막대 차트
══════════════════════════════════════════════════════ */
function VolumeHistogram({ buckets, timeWindow }: { buckets: Array<{hour:number;label:string;value:number}>; timeWindow: number }) {
  const W = 276, H = 52;
  if (!buckets.length) {
    return <div style={{ height:H, display:'flex', alignItems:'center', justifyContent:'center', color:'#2d5a7a', fontSize:11, fontFamily:"'Courier New',monospace" }}>LOADING...</div>;
  }
  const max = Math.max(...buckets.map(b => b.value), 1);
  const barW = W / buckets.length;
  const cutoff = 24 - timeWindow;
  return (
    <svg width={W} height={H} style={{ display:'block', width:'100%', height:H }}>
      {buckets.map((b, i) => {
        const bh = Math.max(2, Math.round((b.value / max) * (H - 12)));
        const x = i * barW;
        const inWin = i >= cutoff;
        const col = inWin ? '#ef4444' : '#1a3a4a';
        return (
          <g key={i}>
            <rect x={x + 0.5} y={H - 12 - bh} width={barW - 1} height={bh} fill={col} opacity={inWin ? 0.82 : 0.35} rx={0.5} />
            {i % 6 === 0 && (
              <text x={x + barW / 2} y={H - 1} fontSize={7} fill="#2d5a7a" textAnchor="middle" fontFamily="monospace">{b.label}</text>
            )}
          </g>
        );
      })}
      {timeWindow < 24 && (
        <line x1={cutoff * barW} x2={cutoff * barW} y1={0} y2={H - 10} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
      )}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════ */
const CSS = `
@keyframes wr-blink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes wr-pulse-border {
  0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.6),inset 0 0 0 1px rgba(239,68,68,0.8)}
  50%    {box-shadow:0 0 20px 4px rgba(239,68,68,0.3),inset 0 0 0 1px rgba(239,68,68,1)}
}
@keyframes wr-slide-in { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes wr-count { 0%{opacity:0.3;transform:translateY(4px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes wr-breaking-in {
  from { transform: translateY(-100%); opacity:0; }
  to   { transform: translateY(0);     opacity:1; }
}
@keyframes wr-breaking-out {
  from { transform: translateY(0);     opacity:1; }
  to   { transform: translateY(-100%); opacity:0; }
}
@keyframes wr-panel-in {
  from { transform: translateX(100%); opacity:0; }
  to   { transform: translateX(0);    opacity:1; }
}
@keyframes wr-panel-out {
  from { transform: translateX(0);    opacity:1; }
  to   { transform: translateX(100%); opacity:0; }
}
@keyframes wr-event-ring {
  0%   { transform: scale(1);   opacity:0.9; }
  100% { transform: scale(3.5); opacity:0; }
}
.wr-blink        { animation: wr-blink 1.1s step-start infinite; }
.wr-threat-flash { animation: wr-pulse-border 1.2s ease-in-out infinite; }
.wr-feed-item    { animation: wr-slide-in 0.35s ease-out; }
.wr-count        { animation: wr-count 0.5s ease-out; }
.wr-breaking-in  { animation: wr-breaking-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
.wr-breaking-out { animation: wr-breaking-out 0.4s ease-in forwards; }
.wr-panel-in     { animation: wr-panel-in  0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
.wr-panel-out    { animation: wr-panel-out 0.25s ease-in forwards; }
`;

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function calcThreat(acled: any[], quakes: any[], firms: any[], aircraft: any[]) {
  let s = 0;
  acled.forEach(e => { if (!inBBOX(e.lat,e.lng)) return; s += e.severity==='critical'?14:e.severity==='high'?7:2; });
  quakes.filter(q => q.isSuspect && inBBOX(q.lat,q.lng)).forEach(() => s += 22);
  const f = firms.filter(e => inBBOX(e.lat,e.lng)).length;
  s += f>50?20:f>20?12:f>5?5:0;
  const a = aircraft.filter(x => inBBOX(x.lat,x.lng)).length;
  s += a<3?30:a<10?15:a<20?5:0;
  return Math.min(100, s);
}
function threatMeta(score: number) {
  if (score>=85) return { label:'DEFCON 1', color:'#ff073a', glow:'#ff073a', flash:true };
  if (score>=65) return { label:'CRITICAL',  color:'#ef4444', glow:'#ef4444', flash:true };
  if (score>=45) return { label:'HIGH',      color:'#f97316', glow:'#f97316', flash:false };
  if (score>=25) return { label:'ELEVATED',  color:'#fbbf24', glow:'#fbbf24', flash:false };
  return              { label:'NORMAL',    color:'#00ff88', glow:'#00ff88', flash:false };
}
function airspaceStatus(aircraft: any[], zone: typeof AIRSPACE_ZONES[0]) {
  const n = aircraft.filter(a => a.lat>=zone.lat[0]&&a.lat<=zone.lat[1]&&a.lng>=zone.lng[0]&&a.lng<=zone.lng[1]).length;
  if (n===0) return { status:'폐쇄', color:'#ef4444', icon:'⛔' };
  if (n<5)   return { status:'제한', color:'#f97316', icon:'⚠️' };
  return         { status:'정상', color:'#00ff88', icon:'✅' };
}

/* ══════════════════════════════════════════════════════
   STRIKE REPORT MODAL
══════════════════════════════════════════════════════ */
function StrikeModal({ lat, lng, onSave, onClose }: { lat:number; lng:number; onSave:(r:StrikeReport)=>void; onClose:()=>void }) {
  const [title,      setTitle]      = React.useState('');
  const [source,     setSource]     = React.useState('');
  const [confidence, setConfidence] = React.useState<StrikeReport['confidence']>('unconfirmed');
  const [desc,       setDesc]       = React.useState('');
  const [url,        setUrl]        = React.useState('');

  const inputStyle: React.CSSProperties = {
    background: '#020c18', border: '1px solid #0a3050', borderRadius: 2, padding: '4px 8px',
    color: '#c0d8e8', fontSize: 10, fontFamily: "'Courier New', monospace", width: '100%',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 8, color: '#4a7a9b', letterSpacing: 1, marginBottom: 2, display: 'block',
  };

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: `strike-${Date.now()}`, lat, lng,
      title: title.trim(), source: source.trim() || 'UNKNOWN',
      confidence, desc: desc.trim(), url: url.trim(),
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div style={{
      position: 'absolute', zIndex: 3000, inset: 0,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#000d1a', border: '1px solid #ef444488', borderRadius: 4,
        padding: '16px 20px', width: 340, fontFamily: "'Courier New', monospace",
        boxShadow: '0 0 40px rgba(239,68,68,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#ef4444', letterSpacing: 2 }}>STRIKE REPORT</div>
            <div style={{ fontSize: 8, color: '#4a7a9b' }}>{lat.toFixed(4)}°N · {lng.toFixed(4)}°E</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4a7a9b', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={labelStyle}>타격 위치/내용 *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 알우데이드 창고 건물 피격" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>소스</label>
            <input value={source} onChange={e=>setSource(e.target.value)} placeholder="Twitter/Telegram/영상/뉴스" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>신뢰도</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['confirmed','probable','unconfirmed'] as const).map(c => (
                <button key={c} onClick={()=>setConfidence(c)} style={{
                  flex: 1, padding: '4px 0', fontSize: 8, letterSpacing: 1, borderRadius: 2, cursor: 'pointer',
                  background: confidence===c ? CONF_COLOR[c]+'33' : '#020c18',
                  border: `1px solid ${confidence===c ? CONF_COLOR[c] : '#0a3050'}`,
                  color: confidence===c ? CONF_COLOR[c] : '#4a7a9b',
                  fontFamily: "'Courier New', monospace",
                }}>{CONF_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>상세 설명</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="추가 정보..." rows={2}
              style={{ ...inputStyle, resize: 'none', verticalAlign: 'top' }} />
          </div>
          <div>
            <label style={labelStyle}>소스 URL (선택)</label>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>
          <button onClick={save} disabled={!title.trim()} style={{
            background: title.trim() ? '#ef444422' : '#0a1f2f', border: `1px solid ${title.trim() ? '#ef4444' : '#1a3a4a'}`,
            color: title.trim() ? '#ef4444' : '#2d5a7a', padding: '7px 0', borderRadius: 2,
            cursor: title.trim() ? 'pointer' : 'default', fontFamily: "'Courier New', monospace",
            fontSize: 10, letterSpacing: 2, fontWeight: 700, marginTop: 2,
          }}>📍 타격 위치 등록</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
interface FeedItem { id:string; time:string; addedAt:number; icon:string; title:string; region:string; severity:string; source:string; lat?:number; lng?:number; }
interface OilData   { price:number|null; change:number; }
interface Oil       { wti:OilData|null; brent:OilData|null; }

export function WarRoomView() {
  const [acled,     setAcled]     = useState<any[]>([]);
  const [quakes,    setQuakes]    = useState<any[]>([]);
  const [firms,     setFirms]     = useState<any[]>([]);
  const [aircraft,  setAircraft]  = useState<any[]>([]);
  const [gdacs,     setGdacs]     = useState<any[]>([]);
  const [feed,      setFeed]      = useState<FeedItem[]>([]);
  const [oil,          setOil]          = useState<Oil|null>(null);
  const [loading,      setLoading]      = useState(true);
  const [breaking,     setBreaking]     = useState<FeedItem|null>(null);
  const [breakAnim,    setBreakAnim]    = useState<'in'|'out'>('in');
  const [freshness,    setFreshness]    = useState<Record<string,number>>({});
  const [tick,         setTick]         = useState(0);
  const [audioOn,      setAudioOn]      = useState(true);
  const [cinematic,    setCinematic]    = useState(true); // 기본값: 패널 숨김, 지도 풀스크린
  const [threatHistory,setThreatHistory]= useState<TensionPoint[]>([]);
  const [gdeltTimeline,setGdeltTimeline]= useState<{date:string;tone:number}[]>([]);
  const [satMode,      setSatMode]      = useState<SatMode>('satellite');
  const [vixPrice,     setVixPrice]     = useState(0);
  const [geoSignals,   setGeoSignals]   = useState<{derived:{spreadNorm:number;ilsNorm:number;goldNorm:number;geoRiskScore:number;brentWtiSpread:number|null};ils:any;gold:any}|null>(null);
  const [theater,      setTheater]      = useState<TheaterKey>('iran-israel');
  const [newsActiveIds,setNewsActiveIds]= useState<string[]>([]);
  const [theaterAct,   setTheaterAct]   = useState<Record<string,number>>({});
  const [iranRial,     setIranRial]     = useState<any>(null);
  const [airspaceData, setAirspaceData] = useState<any>(null);
  const [adsbAirports, setAdsbAirports] = useState<Record<string,any>>({});
  const [cryptoNews,   setCryptoNews]   = useState<any>(null);
  const [strikeReports,setStrikeReports]= useState<StrikeReport[]>(() => {
    try { return JSON.parse(localStorage.getItem('wr-strikes') ?? '[]'); } catch { return []; }
  });
  const [newStrikePos, setNewStrikePos] = useState<{lat:number;lng:number}|null>(null);
  const [liveNews,     setLiveNews]     = useState<Array<{title:string;source:string;age:number|null}>>([]);
  const [volBuckets,   setVolBuckets]   = useState<Array<{hour:number;label:string;value:number}>>([]);
  const [imgItems,     setImgItems]     = useState<ImgItem[]>([]);
  const [timeWindow,   setTimeWindow]   = useState(24); // 최근 N시간
  const feedRef    = useRef<HTMLDivElement>(null);
  const prevCritRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext|null>(null);

  /* BREAKING beep */
  const playBeep = useCallback(() => {
    if (!audioOn) return;
    try {
      const ctx = audioCtxRef.current ?? (audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, [audioOn]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const t = Date.now();
    try {
      const [a,q,f,o,g,oil,adsbRes] = await Promise.allSettled([
        apiFetch<any>('/api/acled-events'),
        apiFetch<any>('/api/usgs-quakes'),
        apiFetch<any>('/api/firms-fires'),
        apiFetch<any>('/api/opensky-aircraft'),
        apiFetch<any>('/api/gdacs-alerts'),
        apiFetch<any>('/api/oil-price'),
        apiFetch<any>('/api/adsb-live'),
      ]);
      const aData = a.status==='fulfilled' ? (a.value?.events??[]) : [];
      const qData = q.status==='fulfilled' ? (q.value?.events??[]) : [];
      const fData = f.status==='fulfilled' ? (f.value?.events??[]) : [];
      // adsb-live 우선, opensky 폴백
      const adsbData = adsbRes.status==='fulfilled' ? (adsbRes.value?.aircraft??[]) : [];
      const oData = adsbData.length > 0 ? adsbData : (o.status==='fulfilled' ? (o.value?.aircraft??[]) : []);
      const gData = g.status==='fulfilled' ? (g.value?.events??[]) : [];
      if (oil.status==='fulfilled') setOil(oil.value as Oil);
      // 공항 disruption 데이터
      if (adsbRes.status==='fulfilled' && adsbRes.value?.airports) {
        setAdsbAirports(adsbRes.value.airports);
      }
      // 비상 스쿼크
      if (adsbRes.status==='fulfilled' && adsbRes.value?.emergency?.length > 0) {
        const emList = adsbRes.value.emergency;
        emList.forEach((em: any) => {
          const item: FeedItem = { id: `em-${em.callsign}`, time: new Date().toISOString(), addedAt: Date.now(), icon:'🆘', title:`비상 스쿼크: ${em.callsign} (${em.emergency})`, region:'항공', severity:'critical', source:'ADS-B' };
          setFeed(prev => [item, ...prev.slice(0, 79)]);
        });
      }

      /* GDELT 긴장 타임라인 */
      try {
        const tlRes = await apiFetch<any>('/api/gdelt-timeline');
        if (tlRes?.points?.length > 0) setGdeltTimeline(tlRes.points);
      } catch {}

      /* GDELT 이벤트 볼륨 히스토그램 */
      try {
        const volRes = await apiFetch<any>('/api/gdelt-volume');
        if (volRes?.buckets?.length > 0) setVolBuckets(volRes.buckets);
      } catch {}

      /* GDELT 뉴스 이미지 마커 */
      try {
        const imgRes = await apiFetch<any>('/api/gdelt-images');
        if (imgRes?.items?.length > 0) setImgItems(imgRes.items);
      } catch {}

      /* VIX */
      try {
        const macroRes = await apiFetch<any>('/api/global-macro');
        if (macroRes?.vix?.price) setVixPrice(macroRes.vix.price);
      } catch {}

      /* 지정학 선행지표 (ILS/Gold/Brent-WTI) */
      try {
        const geoRes = await apiFetch<any>('/api/geo-signals');
        if (geoRes?.derived) setGeoSignals(geoRes);
      } catch {}

      /* GDELT 군사 자산 동적 활성화 */
      try {
        const milRes = await apiFetch<any>('/api/mil-activity');
        if (milRes?.activeIds?.length >= 0) {
          setNewsActiveIds(milRes.activeIds);
          setTheaterAct(milRes.theaterActivity ?? {});
        }
      } catch {}

      /* 이란 리알 환율 (지정학 선행지표) */
      try {
        const rialRes = await apiFetch<any>('/api/iran-rial');
        if (rialRes?.price) setIranRial(rialRes);
      } catch {}

      /* 영공 제한 구역 (SIGMET + 분쟁 기반) */
      try {
        const airRes = await apiFetch<any>('/api/airspace');
        if (airRes?.restrictions) setAirspaceData(airRes);
      } catch {}

      /* CryptoPanic 크립토 감성 뉴스 */
      try {
        const cpRes = await apiFetch<any>('/api/crypto-news');
        if (cpRes && !cpRes.mock) setCryptoNews(cpRes);
      } catch {}

      /* 실시간 뉴스 (Reuters/AJ/BBC RSS) */
      try {
        const newsRes = await apiFetch<any>('/api/warroom-news');
        if (newsRes?.items?.length > 0) setLiveNews(newsRes.items);
      } catch {}

      setAcled(aData); setQuakes(qData); setFirms(fData); setAircraft(oData); setGdacs(gData);
      setFreshness({ gdelt: t, usgs: t, firms: t, adsb: t, gdacs: t });

      /* 이벤트 피드 */
      const _now = Date.now();
      const items: FeedItem[] = [
        ...aData.filter((e:any)=>inBBOX(e.lat,e.lng)).map((e:any)=>({ id:e.id, time:e.date||'', addedAt:_now, icon:'⚔️', title:e.eventType||'전투', region:e.region||e.country, severity:e.severity, source:'GDELT', lat:e.lat, lng:e.lng })),
        ...qData.filter((q:any)=>q.isSuspect&&inBBOX(q.lat,q.lng)).map((q:any)=>({ id:q.id, time:new Date(q.time).toISOString(), addedAt:_now, icon:'🌋', title:`M${q.magnitude} 이상진동`, region:q.place, severity:q.severity, source:'USGS', lat:q.lat, lng:q.lng })),
        ...gData.filter((e:any)=>inBBOX(e.lat,e.lng)).map((e:any)=>({ id:e.id, time:e.date||'', addedAt:_now, icon:'🚨', title:e.eventType, region:e.country, severity:e.severity, source:'GDACS' })),
        ...fData.filter((e:any)=>inBBOX(e.lat,e.lng)&&e.frp>20).map((e:any)=>({ id:e.id, time:`${e.date} ${e.time}`, addedAt:_now, icon:'🔥', title:`화재 ${e.frp}MW`, region:e.zone, severity:e.severity, source:'FIRMS' })),
      ].sort((a,b)=>b.time.localeCompare(a.time));
      setFeed(items.slice(0,80));

      /* BREAKING 감지 */
      const newCritical = items.filter(i=>i.severity==='critical');
      const newIds = newCritical.filter(i=>!prevCritRef.current.has(i.id));
      if (newIds.length>0) {
        setBreaking(newIds[0]);
        setBreakAnim('in');
        playBeep();
        prevCritRef.current = new Set(items.map(i=>i.id));
      }
    } finally { setLoading(false); }
  }, [playBeep]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const id=setInterval(loadAll, 2*60_000); return ()=>clearInterval(id); }, [loadAll]); // 2분 갱신
  useEffect(() => { const id=setInterval(()=>setTick(t=>t+1), 1000); return ()=>clearInterval(id); }, []);

  /* Threat 히스토리 누적 */
  const threatScore = useMemo(()=>calcThreat(acled,quakes,firms,aircraft),[acled,quakes,firms,aircraft]);

  /* 시간창 필터 */
  const filteredFeed = useMemo(() => {
    // 심각도 필터: 슬라이더가 작을수록 중요 이벤트만 표시
    // 24h → ALL / 12h → medium+ / 6h → high+ / 1h → critical only
    const SMAP: Record<string,number> = { critical:4, high:3, medium:2, low:1, unknown:0 };
    const minSev = timeWindow <= 2 ? 4 : timeWindow <= 6 ? 3 : timeWindow <= 12 ? 2 : 0;
    if (minSev === 0) return feed;
    return feed.filter(item => (SMAP[item.severity] ?? 0) >= minSev);
  }, [feed, timeWindow]);
  useEffect(() => {
    if (threatScore > 0) {
      setThreatHistory(prev => {
        const next = [...prev, { time: Date.now(), score: threatScore }];
        return next.slice(-48);
      });
    }
  }, [threatScore]);

  /* BREAKING 자동 해제 */
  useEffect(() => {
    if (!breaking) return;
    const t = setTimeout(() => { setBreakAnim('out'); setTimeout(()=>setBreaking(null), 400); }, 8000);
    return () => clearTimeout(t);
  }, [breaking]);

  /* 계산값 */
  const meAcled    = useMemo(()=>acled.filter(e=>inBBOX(e.lat,e.lng)),   [acled]);
  const meFirms    = useMemo(()=>firms.filter(e=>inBBOX(e.lat,e.lng)),   [firms]);
  const meQuakes   = useMemo(()=>quakes.filter(q=>inBBOX(q.lat,q.lng)&&q.isSuspect), [quakes]);
  const meAircraft = useMemo(()=>aircraft.filter(a=>inBBOX(a.lat,a.lng)),[aircraft]);
  const threat = threatMeta(threatScore);

  const siteScores = useMemo(()=>THREAT_SITES.map(site=>({
    ...site,
    score: Math.min(99, site.base
      + meFirms.filter(f=>Math.abs(f.lat-site.lat)<2&&Math.abs(f.lng-site.lng)<2).length*3
      + meAcled.filter(e=>Math.abs(e.lat-site.lat)<1.5&&Math.abs(e.lng-site.lng)<1.5).length*5),
  })), [meFirms, meAcled]);

  /* 군용기 */
  const milAircraft = useMemo(()=>meAircraft.filter(a=>isMilitary(a.callsign)), [meAircraft]);

  /* 에스컬레이션 인덱스 계산 (리버스 리얼리티 엔진) */
  const escalationScore = useMemo((): EscalationData => {
    const v0 = Math.min(Math.abs(oil?.wti?.change ?? 0) / 15, 1);
    const lastTone = gdeltTimeline.length > 0 ? gdeltTimeline[gdeltTimeline.length - 1].tone : 0;
    const v1 = Math.min(Math.abs(Math.min(lastTone, 0)) / 80, 1);
    const milAct = meAircraft.filter((a:any) => a.mil).length;
    const v2 = Math.min((milAct * 3 + newsActiveIds.length * 2) / 60, 1);
    const v3 = Math.min(vixPrice / 35, 1);
    const v4 = Math.min(meFirms.length / 20, 1);
    const v5 = geoSignals?.derived?.spreadNorm ?? 0;    // Brent-WTI 스프레드
    const v6 = geoSignals?.derived?.ilsNorm    ?? 0;    // USD/ILS (셰켈 약세)
    const v7 = geoSignals?.derived?.goldNorm   ?? 0;    // 금 급등
    const v8 = iranRial?.rialNorm               ?? 0;    // 이란 리알 약세 (암시장)
    const current = [v0, v1, v2, v3, v4, v5, v6, v7, v8];
    const scored = REF_EVENTS.map(r => ({ ...r, score: cosine(current, r.vec) }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const avg  = scored.reduce((s, r) => s + r.score, 0) / scored.length;
    const signals = [
      { label:'WTI 유가 이상',      val:v0, threshold:0.35 },
      { label:'GDELT 긴장도',       val:v1, threshold:0.45 },
      { label:'군사 활동',          val:v2, threshold:0.35 },
      { label:'VIX 급등',           val:v3, threshold:0.55 },
      { label:'화재/폭발',          val:v4, threshold:0.40 },
      { label:'Brent-WTI 스프레드', val:v5, threshold:0.50 },
      { label:'셰켈(ILS) 약세',     val:v6, threshold:0.50 },
      { label:'금 현물 급등',       val:v7, threshold:0.45 },
      { label:'이란 리알 약세',     val:v8, threshold:0.40 },
      { label:'뉴스 언급',          val:Math.min(newsActiveIds.length / 10, 1), threshold:0.30 },
    ];
    return { index: Math.min(Math.round(avg * 140), 100), best, signals };
  }, [oil, gdeltTimeline, meAircraft, meFirms, vixPrice, geoSignals, newsActiveIds, iranRial]);

  /* 기지 근접 화재 경보 */
  const baseAlerts = useMemo(()=>MILITARY_BASES.map(base=>{
    const nearby = meFirms.filter(f=>{
      const dist = Math.sqrt(Math.pow((f.lat-base.lat)*111,2)+Math.pow((f.lng-base.lng)*111*Math.cos(base.lat*Math.PI/180),2));
      return dist < 25;
    });
    return nearby.length>0 ? { ...base, fires: nearby.length } : null;
  }).filter(Boolean) as Array<typeof MILITARY_BASES[0]&{fires:number}>, [meFirms]);

  const now = new Date();
  const milTime = `${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}Z`;

  const SEV_COLOR: Record<string,string> = { critical:'#ef4444', high:'#f97316', medium:'#fbbf24', low:'#22c55e' };

  /* Freshness 표시 */
  const freshnessItems = [
    { key:'gdelt',  label:'GDELT'  },
    { key:'usgs',   label:'USGS'   },
    { key:'firms',  label:'FIRMS'  },
    { key:'adsb',   label:'ADS-B'  },
    { key:'gdacs',  label:'GDACS'  },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background:'#000810', display:'flex', flexDirection:'column', fontFamily:"'Courier New', monospace", overflow:'hidden', position:'relative' }}>
      <style>{CSS}</style>

      {/* ── 타격 보고 모달 ── */}
      {newStrikePos && (
        <StrikeModal
          lat={newStrikePos.lat} lng={newStrikePos.lng}
          onSave={(report) => {
            const updated = [report, ...strikeReports];
            setStrikeReports(updated);
            localStorage.setItem('wr-strikes', JSON.stringify(updated));
            setNewStrikePos(null);
          }}
          onClose={() => setNewStrikePos(null)}
        />
      )}

      {/* ── BREAKING 오버레이 ── */}
      {breaking && (
        <div className={`wr-breaking-${breakAnim}`} style={{
          position:'absolute', top:44, left:0, right:0, zIndex:2000,
          background:'linear-gradient(90deg, #7f1d1d 0%, #991b1b 30%, #7f1d1d 100%)',
          borderBottom:'2px solid #ef4444', borderTop:'2px solid #ef4444',
          padding:'6px 20px', display:'flex', alignItems:'center', gap:12,
          boxShadow:'0 4px 32px rgba(239,68,68,0.4)',
        }}>
          <span style={{ fontSize:11, fontWeight:900, color:'#fff', letterSpacing:3, background:'#ef4444', padding:'2px 8px', borderRadius:1 }}>⚡ BREAKING</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#fecaca', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{breaking.title}</span>
          <span style={{ fontSize:10, color:'#f97316' }}>{breaking.region}</span>
          <button onClick={()=>setBreaking(null)} style={{ fontSize:14, color:'#fca5a5', background:'none', border:'none', cursor:'pointer', marginLeft:8 }}>✕</button>
        </div>
      )}

      {/* ── 헤더 바 ── */}
      <div style={{ height:44, display:'flex', alignItems:'center', padding:'0 16px', gap:16, background:'#020c18', borderBottom:'1px solid #0a3050', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#00d4ff' }}>
          <span className="wr-blink" style={{ color:'#ef4444', fontSize:10 }}>◉</span>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:'#00d4ff', textShadow:'0 0 8px #00d4ff88' }}>CONFLICT WATCH SYSTEM</span>
          {/* 전장 탭 */}
          <div style={{ display:'flex', gap:2, marginLeft:4 }}>
            {(Object.entries(THEATERS) as [TheaterKey, typeof THEATERS[TheaterKey]][]).map(([key, th]) => (
              <button key={key} onClick={() => setTheater(key)} style={{
                background: theater===key ? '#ef444422' : 'none',
                border: `1px solid ${theater===key ? '#ef4444' : '#1a3a4a'}`,
                borderRadius: 2, padding: '2px 8px', cursor: 'pointer',
                fontSize: 9, color: theater===key ? '#ef4444' : '#4a7a9b',
                fontFamily:"'Courier New',monospace", letterSpacing: 1,
                display:'flex', alignItems:'center', gap:4, transition:'all 0.15s',
              }}>
                <span>{th.flag}</span>
                <span>{th.label}</span>
                {theaterAct[key] != null && <span style={{ color: theater===key?'#f97316':'#2d5a7a', fontSize:10 }}>{theaterAct[key]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex:1 }} />

        {/* 지정학 선행지표 ticker */}
        <div style={{ display:'flex', gap:6 }}>
          {oil?.wti?.price && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:'1px solid #1a3a4a', borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>WTI</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#fbbf24' }}>${oil.wti.price.toFixed(2)}</span>
              <span style={{ fontSize:11, fontWeight:700, color: oil.wti.change >= 0 ? '#22c55e' : '#ef4444' }}>{oil.wti.change >= 0 ? '▲' : '▼'}{Math.abs(oil.wti.change).toFixed(1)}%</span>
            </div>
          )}
          {geoSignals?.derived?.brentWtiSpread != null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:`1px solid ${geoSignals.derived.spreadNorm > 0.5 ? '#ef444455' : '#1a3a4a'}`, borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>B-W</span>
              <span style={{ fontSize:12, fontWeight:700, color: geoSignals.derived.spreadNorm > 0.5 ? '#ef4444' : '#fbbf24' }}>${geoSignals.derived.brentWtiSpread.toFixed(1)}</span>
            </div>
          )}
          {geoSignals?.ils?.change5d != null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:`1px solid ${geoSignals.derived.ilsNorm > 0.4 ? '#ef444455' : '#1a3a4a'}`, borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>ILS</span>
              <span style={{ fontSize:11, fontWeight:700, color: geoSignals.derived.ilsNorm > 0.4 ? '#ef4444' : '#94a3b8' }}>{geoSignals.ils.change5d > 0 ? '▲' : '▼'}{Math.abs(geoSignals.ils.change5d).toFixed(2)}%</span>
            </div>
          )}
          {geoSignals?.gold?.change5d != null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:`1px solid ${geoSignals.derived.goldNorm > 0.4 ? '#22c55e55' : '#1a3a4a'}`, borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>GOLD</span>
              <span style={{ fontSize:11, fontWeight:700, color: geoSignals.derived.goldNorm > 0.4 ? '#22c55e' : '#94a3b8' }}>{geoSignals.gold.change5d > 0 ? '+' : ''}{geoSignals.gold.change5d.toFixed(2)}%</span>
            </div>
          )}
          {iranRial?.change7d != null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:`1px solid ${iranRial.rialNorm > 0.35 ? '#ef444455' : '#1a3a4a'}`, borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>IRR</span>
              <span style={{ fontSize:11, fontWeight:700, color: iranRial.rialNorm > 0.35 ? '#ef4444' : '#94a3b8' }}>
                {iranRial.change7d > 0 ? '▲' : '▼'}{Math.abs(iranRial.change7d).toFixed(1)}%
              </span>
              {iranRial.alert === 'CRITICAL' && <span className="wr-blink" style={{ fontSize:11, color:'#ef4444', fontWeight:900 }}>!</span>}
            </div>
          )}
          {cryptoNews?.fearScore != null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', border:`1px solid ${cryptoNews.fearScore > 60 ? '#ef444455' : '#1a3a4a'}`, borderRadius:2, background:'#020c18' }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>CRYPTO</span>
              <span style={{ fontSize:11, fontWeight:700, color: cryptoNews.fearScore > 60 ? '#ef4444' : cryptoNews.fearScore > 40 ? '#f97316' : '#22c55e' }}>
                {cryptoNews.fearScore > 60 ? '공포' : cryptoNews.fearScore > 40 ? '중립' : '탐욕'}
              </span>
              {cryptoNews.geoRelevant > 0 && <span style={{ fontSize:11, color:'#a855f7' }}>⚡{cryptoNews.geoRelevant}</span>}
            </div>
          )}
        </div>

        {/* 위협 레벨 */}
        <div className={threat.flash ? 'wr-threat-flash' : ''} style={{ padding:'3px 14px', borderRadius:2, border:`1px solid ${threat.color}`, background:`${threat.color}18`, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2 }}>THREAT</span>
          <span style={{ fontSize:13, fontWeight:900, color:threat.color, letterSpacing:2, textShadow:`0 0 10px ${threat.glow}` }}>{threat.label}</span>
          <div style={{ width:60, height:6, background:'#0a1f2f', borderRadius:1, overflow:'hidden' }}>
            <div style={{ width:`${threatScore}%`, height:'100%', background:threat.color, boxShadow:`0 0 6px ${threat.color}`, transition:'width 1s ease' }} />
          </div>
          <span style={{ fontSize:11, color:threat.color, fontWeight:700 }}>{threatScore}</span>
        </div>

        {/* 인시던트 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 12px', border:'1px solid #1a3a4a', borderRadius:2, background:'#020c18' }}>
          <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2 }}>INCIDENTS</span>
          <span className="wr-count" style={{ fontSize:16, fontWeight:900, color:'#ef4444', textShadow:'0 0 8px #ef4444' }}>{meAcled.length+meQuakes.length}</span>
        </div>

        {/* 시네마틱 모드 */}
        <button onClick={()=>setCinematic(v=>!v)} title={cinematic?'패널 표시':'지도 집중 모드'} style={{ background:'none', border:`1px solid ${cinematic?'#22c55e33':'#1a3a4a'}`, borderRadius:2, padding:'3px 8px', cursor:'pointer', fontSize:10, color:cinematic?'#22c55e':'#4a7a9b', transition:'all 0.2s', letterSpacing:1 }}>
          {cinematic ? '◧ PANEL' : '⛶ FOCUS'}
        </button>

        {/* 오디오 토글 */}
        <button onClick={()=>setAudioOn(v=>!v)} title={audioOn?'경보음 ON (클릭=OFF)':'경보음 OFF (클릭=ON)'} style={{ background:'none', border:`1px solid ${audioOn?'#1a3a4a':'#2d1a1a'}`, borderRadius:2, padding:'3px 8px', cursor:'pointer', fontSize:12, color:audioOn?'#00d4ff':'#4a7a9b', transition:'all 0.2s' }}>
          {audioOn ? '🔊' : '🔇'}
        </button>

        {/* 군용 시각 */}
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#00d4ff', letterSpacing:2, textShadow:'0 0 6px #00d4ff66' }}>{milTime}</div>
          <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1 }}>UTC · {loading?'동기화 중...':'데이터 최신'}</div>
        </div>
      </div>

      {/* ── 메인: 지도 풀스크린 ── */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>

        {/* ──────── 지도 (항상 100%) ──────── */}
        <div style={{ position:'absolute', inset:0 }}>
          <div style={{ position:'absolute', top:8, left:8, zIndex:1000, fontSize:11, color:'#00d4ff88', letterSpacing:3, fontWeight:700 }}>TACTICAL MAP 3D // IRAN-ISRAEL</div>
          {/* 우클릭 힌트 */}
          <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', zIndex:1000, fontSize:10, color:'#2d5a7a', letterSpacing:1, fontFamily:"'Courier New',monospace", pointerEvents:'none' }}>
            우클릭 → 타격 보고 &nbsp;|&nbsp; 🎯 {strikeReports.length}건
          </div>

          {/* 3D 지도 */}
          <Map3D siteScores={siteScores} meAcled={meAcled} meFirms={meFirms} meQuakes={meQuakes} meAircraft={meAircraft} satMode={satMode} imgItems={imgItems} theater={theater} newsActiveIds={newsActiveIds} airspaceRestrictions={airspaceData?.restrictions ?? []} strikeReports={strikeReports} onMapRightClick={(lat,lng)=>setNewStrikePos({lat,lng})} />

          {/* 위성 레이어 토글 */}
          <div style={{ position:'absolute', top:36, right:8, zIndex:1001, display:'flex', flexDirection:'column', gap:3 }}>
            {([
              { mode: 'satellite',   label: '🛰️', title: 'Esri 위성사진 (정적)' },
              { mode: 'nightlights', label: '🌙', title: `NASA VIIRS 야간조명 (${getGibsDate()})` },
              { mode: 'truecolor',   label: '🎨', title: `MODIS 자연색 (${getGibsDate()})` },
              { mode: 'soar',        label: '🔴', title: 'SOAR Atlas 실시간 이란 전장 위성 (soaratlas.com/maps/15424)' },
            ] as const).map(btn => (
              <button key={btn.mode} onClick={() => setSatMode(btn.mode)} title={btn.title}
                style={{ width:32, height:26, background: satMode===btn.mode ? '#00d4ff22' : '#020c18cc', border: `1px solid ${satMode===btn.mode ? '#00d4ff' : '#1a3a4a'}`, borderRadius:3, color: satMode===btn.mode ? '#00d4ff' : '#4a7a9b', cursor:'pointer', fontSize:13, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {btn.label}
              </button>
            ))}
          </div>

          {/* 야간 조명 모드 안내 */}
          {satMode === 'nightlights' && (
            <div style={{ position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', zIndex:1001, background:'rgba(0,8,16,0.9)', border:'1px solid #22c55e55', borderRadius:3, padding:'6px 14px', fontSize:11, color:'#22c55e', letterSpacing:1, whiteSpace:'nowrap' }}>
              🌙 NASA VIIRS 야간조명 — {getGibsDate()} 기준 · 어두운 지역 = 정전/피해
            </div>
          )}
          {satMode === 'truecolor' && (
            <div style={{ position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', zIndex:1001, background:'rgba(0,8,16,0.9)', border:'1px solid #fbbf2455', borderRadius:3, padding:'6px 14px', fontSize:11, color:'#fbbf24', letterSpacing:1, whiteSpace:'nowrap' }}>
              🎨 MODIS Terra 자연색 — {getGibsDate()} 기준 · 250m 해상도
            </div>
          )}
          {satMode === 'soar' && (
            <div style={{ position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', zIndex:1001, background:'rgba(16,0,0,0.92)', border:'1px solid #ef444455', borderRadius:3, padding:'6px 16px', fontSize:11, color:'#ef4444', letterSpacing:1, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}>
              <span className="wr-blink">●</span>
              SOAR Atlas 실시간 이란 전장 위성 · <a href="https://soaratlas.com/maps/15424" target="_blank" rel="noopener" style={{ color:'#f87171', textDecoration:'underline' }}>soaratlas.com/maps/15424</a>
            </div>
          )}

          {/* ── Timeline Scrubber ── */}
          {/* ── 심각도 필터 슬라이더 ── */}
          <div style={{ position:'absolute', bottom: liveNews.length > 0 ? 66 : 36, left:0, right:0, zIndex:1000, padding:'3px 10px', background:'rgba(0,8,16,0.88)', backdropFilter:'blur(4px)', borderTop:'1px solid #0a1f2f', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:10, color:'#4a7a9b', letterSpacing:2, flexShrink:0, fontFamily:"'Courier New',monospace" }}>FILTER</div>
            <input
              type="range" min={1} max={24} step={1} value={timeWindow}
              onChange={e => setTimeWindow(+e.target.value)}
              style={{ flex:1, accentColor: timeWindow<=2?'#ef4444':timeWindow<=6?'#f97316':timeWindow<=12?'#fbbf24':'#22c55e',
                height:4, cursor:'pointer',
                background:`linear-gradient(to right, ${timeWindow<=2?'#ef4444':timeWindow<=6?'#f97316':timeWindow<=12?'#fbbf24':'#22c55e'} ${(timeWindow/24)*100}%, #1a3a4a ${(timeWindow/24)*100}%)`,
                borderRadius:2 }}
            />
            {/* 현재 필터 레이블 */}
            {(() => {
              const [label,col] = timeWindow<=2 ? ['🔴 CRITICAL 전용','#ef4444'] : timeWindow<=6 ? ['🟠 HIGH+','#f97316'] : timeWindow<=12 ? ['🟡 MEDIUM+','#fbbf24'] : ['🟢 전체','#22c55e'];
              return <div style={{ fontSize:11, color:col, fontWeight:700, letterSpacing:1, flexShrink:0, minWidth:70, textAlign:'right', fontFamily:"'Courier New',monospace" }}>{label}</div>;
            })()}
          </div>

          {/* LIVE 뉴스 티커 */}
          {liveNews.length > 0 && (
            <div style={{ position:'absolute', bottom:36, left:0, right:0, zIndex:1000, background:'rgba(0,8,16,0.88)', borderTop:'1px solid #1a3a4a', backdropFilter:'blur(4px)' }}>
              <div style={{ display:'flex', alignItems:'stretch', overflow:'hidden', height:28 }}>
                <div style={{ background:'#ef4444', padding:'0 10px', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span className="wr-blink" style={{ fontSize:11, color:'#fff', fontWeight:900, letterSpacing:2 }}>● LIVE</span>
                </div>
                <div style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'center' }}>
                  <div style={{ whiteSpace:'nowrap', animation:'ticker-scroll 40s linear infinite', display:'flex', gap:48, paddingLeft:'100%' }}>
                    {[...liveNews, ...liveNews].map((n, i) => (
                      <span key={i} style={{ fontSize:10, color:'#c0d8e8', fontFamily:'monospace' }}>
                        <span style={{ color:'#4a7a9b', fontSize:11 }}>[{n.source}]</span>{' '}
                        {n.title}
                        {n.age !== null && <span style={{ color:'#2d5a7a', fontSize:10 }}> · {n.age < 60 ? `${n.age}분 전` : `${Math.floor(n.age/60)}h`}</span>}
                        <span style={{ color:'#1a3a4a', padding:'0 20px' }}>◈</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 레전드 */}
          <div style={{ position:'absolute', bottom:8, left:8, zIndex:1000, background:'rgba(0,8,16,0.85)', border:'1px solid #0a3050', borderRadius:3, padding:'5px 10px', fontSize:11, color:'#4a7a9b', display:'flex', flexWrap:'wrap', gap:'4px 10px', maxWidth:300 }}>
            {[['🔴','분쟁'],['🟠','지진'],['🔥','화재'],['✈','항공기'],['✦','군용기'],['▲','기지'],['◈','핵'],['〇','사거리'],['〰','해협'],['▧','분쟁구역'],['⚠','기지경보'],['◆','이란전력(red)'],['▲','IDF(blue)'],['★','미항모(cyan)'],['📸','뉴스이미지'],['📡','라이브방송'],['- -','영공제한']].map(([i,l])=>(
              <span key={l as string}>{i} {l}</span>
            ))}
          </div>
        </div>

        {/* ──────── 패널 오픈 버튼 (지도 우측) ──────── */}
        {cinematic && (
          <button onClick={()=>setCinematic(false)} title="인텔 패널 열기"
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', zIndex:1002, width:28, height:80, background:'rgba(2,12,24,0.85)', border:'1px solid #1a3a4a', borderRadius:'4px 0 0 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, color:'#4a7a9b' }}>
            <span style={{ fontSize:10 }}>◁</span>
            <span style={{ fontSize:11, letterSpacing:1, writingMode:'vertical-lr', color:'#2d5a7a' }}>INTEL</span>
          </button>
        )}

        {/* ──────── RIGHT: 인텔 대시보드 (floating overlay) ──────── */}
        {!cinematic && (
        <div className="wr-panel-in" style={{ position:'absolute', right:0, top:0, bottom:0, width:300, display:'flex', flexDirection:'column', background:'rgba(5,15,26,0.96)', borderLeft:'1px solid #0a3050', zIndex:1001, backdropFilter:'blur(8px)', overflow:'hidden' }}>
          {/* 닫기 버튼 */}
          <button onClick={()=>setCinematic(true)} style={{ position:'absolute', top:6, right:8, zIndex:10, background:'none', border:'none', color:'#4a7a9b', cursor:'pointer', fontSize:14, lineHeight:1 }} title="패널 닫기">✕</button>

          {/* 에스컬레이션 인덱스 */}
          <EscalationPanel data={escalationScore} />

          {/* 긴장지수 타임라인 차트 */}
          <div style={{ padding:'6px 12px 4px', borderBottom:'1px solid #0a1f2f', flexShrink:0, background:'#020c18' }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
              ▸ TENSION INDEX
              <span style={{ marginLeft:'auto', fontSize:10, color:'#2d5a7a' }}>24h</span>
            </div>
            <TensionChart data={threatHistory} gdeltPoints={gdeltTimeline} />
          </div>

          {/* EVENT VOLUME 히스토그램 */}
          <div style={{ padding:'5px 12px 4px', borderBottom:'1px solid #0a1f2f', flexShrink:0, background:'#020c18' }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
              ▸ EVENT VOLUME
              <span style={{ marginLeft:'auto', fontSize:10, color:'#ef4444' }}>최근 24h</span>
            </div>
            <VolumeHistogram buckets={volBuckets} timeWindow={timeWindow} />
          </div>

          {/* 스탯 그리드 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'#0a1f2f', padding:1, flexShrink:0 }}>
            {[
              { label:'INCIDENTS', val:meAcled.length+meQuakes.length, color:'#ef4444', icon:'⚔️' },
              { label:'AIRCRAFT',  val:meAircraft.length,              color:'#3b82f6', icon:'✈️' },
              { label:'FIRE SITES',val:meFirms.length,                 color:'#f97316', icon:'🔥' },
              { label:'SEISMIC',   val:meQuakes.length,                color:'#fbbf24', icon:'🌋' },
            ].map(stat=>(
              <div key={stat.label} style={{ background:'#050f1a', padding:'8px 12px' }}>
                <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:3 }}>{stat.icon} {stat.label}</div>
                <div className="wr-count" style={{ fontSize:24, fontWeight:900, color:stat.color, textShadow:`0 0 10px ${stat.color}66`, lineHeight:1 }}>{stat.val}</div>
              </div>
            ))}
          </div>

          {/* 야간 조명 분석 패널 */}
          {satMode === 'nightlights' && (
            <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', background:'#020c18', flexShrink:0 }}>
              <div style={{ fontSize:11, color:'#22c55e', letterSpacing:2, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                🌙 NIGHT LIGHTS INTEL
                <span style={{ fontSize:10, color:'#2d5a7a', marginLeft:'auto' }}>{getGibsDate()}</span>
              </div>
              {[
                { city:'가자 시티',   status:'critical', pct: 8,  note:'전력망 완전 파괴' },
                { city:'가자 남부',   status:'critical', pct:15,  note:'라파 작전 암전' },
                { city:'베이루트 S',  status:'high',     pct:35,  note:'헤즈볼라 교전구역' },
                { city:'텔아비브',    status:'normal',   pct:98,  note:'정상' },
                { city:'테헤란',      status:'normal',   pct:96,  note:'정상' },
                { city:'사나 (예멘)', status:'high',     pct:22,  note:'후티, 만성 정전' },
              ].map(r => {
                const color = r.status==='critical'?'#ef4444':r.status==='high'?'#f97316':'#22c55e';
                return (
                  <div key={r.city} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'#8aa3ba', minWidth:75 }}>{r.city}</span>
                    <div style={{ flex:1, height:4, background:'#0a1f2f', borderRadius:1 }}>
                      <div style={{ width:`${r.pct}%`, height:'100%', background:color, borderRadius:1, boxShadow:`0 0 3px ${color}` }} />
                    </div>
                    <span style={{ fontSize:11, color, fontWeight:700, minWidth:26 }}>{r.pct}%</span>
                    <span style={{ fontSize:10, color:'#2d5a7a' }}>{r.note}</span>
                  </div>
                );
              })}
              <div style={{ fontSize:10, color:'#1e3a5f', marginTop:3 }}>* 2024 VIIRS 관측 기반. 실시간 아님.</div>
            </div>
          )}

          {/* 전력 배치 요약 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:6 }}>▸ FORCE DEPLOYMENT</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
              {[
                { label:'이란+프록시', sides:['iran','hezbollah','houthi','pmf'] as Side[], color:'#dc2626' },
                { label:'IDF (이스라엘)', sides:['israel'] as Side[], color:'#2563eb' },
                { label:'미국 자산',    sides:['us'] as Side[], color:'#06b6d4' },
              ].map(group => {
                const assets = FORCE_ASSETS.filter(a => (group.sides as string[]).includes(a.side));
                const active = assets.filter(a => a.active).length;
                return (
                  <div key={group.label} style={{ padding:'6px 8px', border:`1px solid ${group.color}33`, borderRadius:2, background:`${group.color}08`, textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:900, color:group.color, lineHeight:1, textShadow:`0 0 8px ${group.color}66` }}>{active}</div>
                    <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:1, marginTop:2 }}>ACTIVE</div>
                    <div style={{ fontSize:10, color:group.color, opacity:0.6 }}>/{assets.length}</div>
                    <div style={{ fontSize:11, color:'#2d5a7a', marginTop:2, letterSpacing:0.5 }}>{group.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 자산 타입별 미니 분류 */}
            <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:3 }}>
              {(['missile','drone','navy','ground','airdef','carrier'] as ForceType[]).map(t => {
                const cnt = FORCE_ASSETS.filter(a=>a.type===t && a.active).length;
                if (!cnt) return null;
                return <span key={t} style={{ fontSize:10, padding:'1px 5px', border:'1px solid #0a1f2f', borderRadius:1, color:'#8aa3ba', background:'#020c18' }}>{TYPE_SYMBOL[t]} {TYPE_LABEL[t]} {cnt}</span>;
              })}
            </div>
          </div>

          {/* 영공 현황 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ AIRSPACE STATUS
              {airspaceData?.summary?.closedFirs > 0 && (
                <span className="wr-blink" style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>
                  ⛔ {airspaceData.summary.closedFirs}FIR 폐쇄
                </span>
              )}
            </div>
            {/* FIR 상태 (api/airspace 데이터 기반) */}
            {airspaceData?.firs ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {airspaceData.firs.map((fir: any) => {
                  const col = fir.status==='CLOSED'?'#ef4444':fir.status==='WARNING'?'#f97316':fir.status==='CAUTION'?'#fbbf24':'#22c55e';
                  const icon = fir.status==='CLOSED'?'⛔':fir.status==='WARNING'?'⚠️':fir.status==='CAUTION'?'🟡':'✅';
                  return (
                    <div key={fir.id} title={`${fir.name}: ${fir.status}`}
                      style={{ padding:'2px 7px', border:`1px solid ${col}55`, borderRadius:2, background:`${col}08`, display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:11 }}>{icon}</span>
                      <span style={{ fontSize:10, color:'#c0d8e8', letterSpacing:0.5 }}>{fir.id}</span>
                      <span style={{ fontSize:10, color:col, fontWeight:700 }}>{fir.status}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {AIRSPACE_ZONES.map(zone=>{
                  const { status, color, icon } = airspaceStatus(aircraft, zone);
                  return (
                    <div key={zone.name} style={{ padding:'2px 7px', border:`1px solid ${color}55`, borderRadius:2, background:`${color}08`, display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:10 }}>{zone.flag}</span>
                      <span style={{ fontSize:11, color:'#c0d8e8' }}>{zone.name}</span>
                      <span style={{ fontSize:11 }}>{icon}</span>
                      <span style={{ fontSize:11, color, fontWeight:700 }}>{status}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* 주요 제한구역 리스트 */}
            {airspaceData?.restrictions?.slice(0, 3).map((r: any) => {
              const col = r.severity==='CLOSED'?'#ef4444':r.severity==='WARNING'?'#f97316':'#fbbf24';
              return (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:5, marginTop:3, fontSize:10, color:'#8aa3ba' }}>
                  <span style={{ color:col, fontWeight:700 }}>{r.severity}</span>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                  <span style={{ color:'#2d5a7a', flexShrink:0 }}>{r.radius}km</span>
                </div>
              );
            })}
            {/* 공항 실시간 트래픽 (ADS-B 기반) */}
            {Object.keys(adsbAirports).length > 0 && (
              <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:3 }}>
                {Object.entries(adsbAirports).map(([icao, ap]: [string, any]) => {
                  const col = ap.status==='CLOSED'?'#ef4444':ap.status==='LIMITED'?'#f97316':'#22c55e';
                  return (
                    <div key={icao} title={`${ap.name}: ${ap.count}대 (착륙:${ap.landing} 출발:${ap.departing})`}
                      style={{ padding:'1px 5px', border:`1px solid ${col}44`, borderRadius:2, fontSize:11.5, color:col, background:`${col}0a` }}>
                      {icao} {ap.count > 0 ? `✈${ap.count}` : '⛔'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 군용기 감지 패널 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ MILITARY AIRCRAFT
              {milAircraft.length>0 && <span className="wr-blink" style={{ fontSize:11, color:'#facc15', fontWeight:700 }}>⚡ {milAircraft.length}기 탐지</span>}
              {milAircraft.length===0 && <span style={{ fontSize:11, color:'#2d5a7a' }}>탐지 없음</span>}
            </div>
            {milAircraft.length===0 ? (
              <div style={{ fontSize:11, color:'#1e3a5f', fontStyle:'italic', textAlign:'center', padding:'4px 0' }}>— 군용기 신호 없음 —</div>
            ) : milAircraft.slice(0,6).map((ac:any)=>(
              <div key={ac.icao24||ac.callsign} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', borderBottom:'1px solid #0a1f2f' }}>
                <span style={{ fontSize:10, color:'#facc15' }}>✦</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#fef08a' }}>{ac.callsign||'UNKNOWN'}</span>
                <span style={{ fontSize:11, color:'#4a7a9b' }}>{ac.country||''}</span>
                {ac.altitude && <span style={{ fontSize:11, color:'#2d5a7a', marginLeft:'auto' }}>{Math.round(ac.altitude)}m</span>}
              </div>
            ))}
          </div>

          {/* 기지 근접 화재 경보 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ BASE STRIKE ALERTS
              {baseAlerts.length>0 && <span className="wr-blink" style={{ fontSize:11, color:'#ef4444', fontWeight:700 }}>⚠ {baseAlerts.length}건</span>}
            </div>
            {baseAlerts.length===0 ? (
              <div style={{ fontSize:11, color:'#1e3a5f', fontStyle:'italic', textAlign:'center', padding:'4px 0' }}>— 기지 근접 화재 없음 —</div>
            ) : baseAlerts.map(alert=>{
              const color = BASE_COLOR[alert.type]??'#ef4444';
              return (
                <div key={alert.name} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 6px', marginBottom:3, borderRadius:2, border:`1px solid ${color}44`, background:`${color}0a` }}>
                  <span style={{ fontSize:10 }}>{BASE_SYMBOL[alert.type]??'●'}</span>
                  <span style={{ fontSize:10, fontWeight:700, color }}>⚠ {alert.name}</span>
                  <span style={{ fontSize:11, color:'#f97316', marginLeft:'auto' }}>🔥×{alert.fires}</span>
                </div>
              );
            })}
          </div>

          {/* 위협 지점 바 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5 }}>▸ THREAT SITE INDEX</div>
            {siteScores.sort((a,b)=>b.score-a.score).slice(0,4).map(site=>{
              const color = site.score>70?'#ef4444':site.score>45?'#f97316':'#fbbf24';
              return (
                <div key={site.name} style={{ marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontSize:11, color:'#c0d8e8' }}>{site.name}</span>
                    <span style={{ fontSize:11, color, fontWeight:700 }}>{site.score}</span>
                  </div>
                  <div style={{ height:3, background:'#0a1f2f', borderRadius:1, overflow:'hidden' }}>
                    <div style={{ width:`${site.score}%`, height:'100%', background:color, boxShadow:`0 0 4px ${color}`, transition:'width 1.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 타격 보고 */}
          {strikeReports.length > 0 && (
          <div style={{ padding:'6px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ STRIKE REPORTS
              <span style={{ fontSize:11, color:'#ef4444', fontWeight:700 }}>🎯 {strikeReports.length}</span>
              <button onClick={()=>{
                if(window.confirm(`${strikeReports.length}개 타격 보고 전체 삭제?`)){
                  setStrikeReports([]); localStorage.removeItem('wr-strikes');
                }
              }} style={{ marginLeft:'auto', background:'none', border:'1px solid #1a3a4a', borderRadius:2, padding:'1px 6px', cursor:'pointer', fontSize:10, color:'#2d5a7a', fontFamily:"'Courier New',monospace" }}>초기화</button>
            </div>
            {strikeReports.slice(0,5).map(s => {
              const col = CONF_COLOR[s.confidence];
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'flex-start', gap:5, padding:'3px 0', borderBottom:'1px solid #0a1f2f' }}>
                  <span style={{ fontSize:10, flexShrink:0 }}>🎯</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:col, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                    <div style={{ fontSize:10, color:'#4a7a9b' }}>{CONF_LABEL[s.confidence]} · {s.source}</div>
                  </div>
                </div>
              );
            })}
            {strikeReports.length > 5 && <div style={{ fontSize:10, color:'#2d5a7a', textAlign:'center', marginTop:3 }}>+{strikeReports.length-5}개 더</div>}
          </div>
          )}

          {/* 크립토 감성 뉴스 */}
          {cryptoNews?.posts?.length > 0 && (
          <div style={{ padding:'6px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0, maxHeight:120, overflowY:'auto' }}>
            <div style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ CRYPTO SIGNAL
              {cryptoNews.fearScore != null && (
                <span style={{ fontSize:11, fontWeight:700, color: cryptoNews.fearScore > 60 ? '#ef4444' : cryptoNews.fearScore > 40 ? '#f97316' : '#22c55e' }}>
                  공포 {cryptoNews.fearScore}
                </span>
              )}
            </div>
            {cryptoNews.posts.filter((p: any) => p.geoRelevant).slice(0, 4).map((p: any) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener"
                style={{ display:'block', marginBottom:4, fontSize:11, color: p.sentiment==='bearish'?'#f87171':p.sentiment==='bullish'?'#4ade80':'#94a3b8', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}
                title={p.title}>
                {p.sentiment==='bearish'?'📉':p.sentiment==='bullish'?'📈':'📊'} {p.title}
              </a>
            ))}
            {cryptoNews.posts.filter((p: any) => p.geoRelevant).length === 0 && (
              <div style={{ fontSize:11, color:'#2d5a7a', fontStyle:'italic' }}>— 지정학 관련 크립토 뉴스 없음 —</div>
            )}
          </div>
          )}

          {/* 인텔 피드 */}
          <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'5px 12px', borderBottom:'1px solid #0a1f2f', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <span style={{ fontSize:11, color:'#4a7a9b', letterSpacing:2 }}>▸ INTEL FEED</span>
              <span className="wr-blink" style={{ fontSize:11, color:'#ef4444', letterSpacing:1 }}>● LIVE</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#4a7a9b' }}>{filteredFeed.length}/{feed.length}</span>
              {timeWindow < 13 && <span style={{ fontSize:10, color: timeWindow<=2?'#ef4444':timeWindow<=6?'#f97316':'#fbbf24', letterSpacing:1 }}>{timeWindow<=2?'CRITICAL':timeWindow<=6?'HIGH+':'MED+'}</span>}
            </div>
            <div ref={feedRef} style={{ flex:1, overflowY:'auto', padding:'0 2px' }}>
              {filteredFeed.length===0 && <div style={{ padding:20, textAlign:'center', color:'#4a7a9b', fontSize:11 }}>{loading?'인텔 수집 중...':'감지된 이벤트 없음'}</div>}
              {filteredFeed.map((item,idx)=>{
                const sevColor = SEV_COLOR[item.severity]??'#94a3b8';
                return (
                  <div key={item.id} className="wr-feed-item" style={{ padding:'6px 12px', borderBottom:'1px solid #07131e', borderLeft:`2px solid ${sevColor}`, background:idx===0?`${sevColor}08`:'transparent', cursor:'default' }} onMouseEnter={e=>(e.currentTarget.style.background=`${sevColor}0f`)} onMouseLeave={e=>(e.currentTarget.style.background=idx===0?`${sevColor}08`:'transparent')}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:11 }}>{item.icon}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</span>
                      <span style={{ fontSize:11, color:'#4a7a9b', flexShrink:0 }}>{item.source}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:10, color:'#8aa3ba' }}>{item.region}</span>
                      <span style={{ fontSize:11, color:sevColor, fontWeight:700 }}>{item.severity?.toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 데이터 신선도 + 하단 상태바 */}
          <div style={{ padding:'4px 12px', borderTop:'1px solid #0a1f2f', background:'#020c18', flexShrink:0 }}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {freshnessItems.map(fi=>{
                const age = freshness[fi.key] ? Math.floor((Date.now()-freshness[fi.key])/1000) : null;
                const fresh = age !== null && age < 30;
                const stale = age !== null && age > 600;
                return (
                  <div key={fi.key} style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <span className={fresh?'wr-blink':''} style={{ fontSize:11, color: stale?'#ef4444':fresh?'#22c55e':'#fbbf24' }}>●</span>
                    <span style={{ fontSize:10, color:'#4a7a9b' }}>{fi.label}</span>
                    {age!==null && <span style={{ fontSize:10, color: stale?'#ef4444':'#2d5a7a' }}>{age<60?`${age}s`:`${Math.floor(age/60)}m`}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
