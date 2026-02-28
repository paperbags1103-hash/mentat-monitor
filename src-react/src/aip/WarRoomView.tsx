/**
 * WarRoomView — 이란-이스라엘 전황 실시간 관제실  v5
 *
 * MIL-STD-2525 스타일 군사 자산 배치 레이어 추가
 * IRGC 미사일/드론/해군 · IDF 지상군/방공 · 미 항모타격단
 * 헤즈볼라 · 후티 · 이라크PMF 프록시 세력
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
  { id:'us-cv1', name:'USS Gerald R. Ford (CVN-78)', detail:'항모타격단 · F/A-18E/F 72기 · 동지중해 배치', lat:34.20, lng:31.50, type:'carrier', side:'us', strength:'xl', active:true },
  { id:'us-cv2', name:'USS Harry S. Truman (CVN-75)', detail:'항모타격단 · 홍해/아라비아해 교대 전개', lat:15.00, lng:52.00, type:'carrier', side:'us', strength:'xl', active:true },
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
interface Map3DProps {
  siteScores: Array<{ name: string; lat: number; lng: number; score: number }>;
  meAcled: any[]; meFirms: any[]; meQuakes: any[]; meAircraft: any[];
}

function Map3D({ siteScores, meAcled, meFirms, meQuakes, meAircraft }: Map3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const rafRef       = useRef<number>(0);
  const dataRef      = useRef({ siteScores, meAcled, meFirms, meQuakes, meAircraft });
  const trailsRef    = useRef<Map<string, Array<[number,number]>>>(new Map());

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
                'raster-opacity': 0.88,
                'raster-saturation': -0.35,
                'raster-brightness-min': 0.02,
                'raster-brightness-max': 0.72,
                'raster-contrast': 0.05,
              },
            },
            // 다크 오버레이 (레이블·도로 살리면서 군사 분위기 유지)
            { id: 'dark-overlay', type: 'raster', source: 'darkgrid', paint: { 'raster-opacity': 0.30 } },
          ],
        },
        center: [47, 32.5], zoom: 4.8, pitch: 62, bearing: -20,
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
        map.addLayer({ id: 'wr-bases-halo', type: 'circle', source: 'wr-bases', paint: { 'circle-radius': 16, 'circle-color': ['get','baseColor'], 'circle-opacity': 0.08, 'circle-blur': 1 } });
        // 기지 점
        map.addLayer({ id: 'wr-bases-dot', type: 'circle', source: 'wr-bases', paint: { 'circle-radius': ['match', ['get','type'], 'nuclear', 7, 'airbase', 5, 4], 'circle-color': ['get','baseColor'], 'circle-opacity': 0.92, 'circle-stroke-width': 1.5, 'circle-stroke-color': ['get','baseColor'] } });
        // 기지 레이블
        map.addLayer({ id: 'wr-bases-label', type: 'symbol', source: 'wr-bases', layout: { 'text-field': ['get','name'], 'text-size': 9, 'text-offset': [0,-1.4], 'text-anchor': 'bottom', 'text-font': ['literal', ['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true }, paint: { 'text-color': ['get','baseColor'], 'text-halo-color': '#000810', 'text-halo-width': 1.5 } });

        /* ── 위협 기둥 ── */
        map.addSource('wr-columns', { type: 'geojson', data: columns });
        map.addLayer({ id: 'wr-columns-fill', type: 'fill-extrusion', source: 'wr-columns', paint: { 'fill-extrusion-color': ['get','color'], 'fill-extrusion-height': ['get','height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.8 } });
        map.addLayer({ id: 'wr-columns-cap', type: 'fill-extrusion', source: 'wr-columns', paint: { 'fill-extrusion-color': ['get','color'], 'fill-extrusion-height': ['*', ['get','height'], 1.04], 'fill-extrusion-base': ['*', ['get','height'], 0.98], 'fill-extrusion-opacity': 0.4 } });

        /* ── FIRMS 화재 ── */
        map.addSource('wr-fires', { type: 'geojson', data: fires });
        map.addLayer({ id: 'wr-fires-halo', type: 'circle', source: 'wr-fires', paint: { 'circle-radius': 18, 'circle-color': '#ff6a00', 'circle-opacity': 0.10, 'circle-blur': 1.2 } });
        map.addLayer({ id: 'wr-fires-dot', type: 'circle', source: 'wr-fires', paint: { 'circle-radius': ['interpolate',['linear'],['get','frp'], 0,3, 200,9], 'circle-color': '#ff6a00', 'circle-opacity': 0.92 } });

        /* ── GDELT 분쟁 ── */
        map.addSource('wr-conflicts', { type: 'geojson', data: conflicts });
        map.addLayer({ id: 'wr-conflicts-halo', type: 'circle', source: 'wr-conflicts', paint: { 'circle-radius': 14, 'circle-color': ['match',['get','severity'],'critical','#ef4444','high','#f97316','#fbbf24'], 'circle-opacity': 0.13, 'circle-blur': 0.8 } });
        map.addLayer({ id: 'wr-conflicts-dot', type: 'circle', source: 'wr-conflicts', paint: { 'circle-radius': ['match',['get','severity'],'critical',8,'high',6,4], 'circle-color': ['match',['get','severity'],'critical','#ef4444','high','#f97316','#fbbf24'], 'circle-opacity': ['case',['get','isRecent'],1,0.75], 'circle-stroke-width': ['case',['get','isRecent'],2,0], 'circle-stroke-color': '#fff' } });

        /* ── USGS ── */
        map.addSource('wr-seismic', { type: 'geojson', data: seismic });
        map.addLayer({ id: 'wr-seismic-dot', type: 'circle', source: 'wr-seismic', paint: { 'circle-radius': ['interpolate',['linear'],['get','mag'], 2.5,5, 6,14], 'circle-color': '#f97316', 'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff7ed' } });

        /* ── OpenSky (일반 항공기) ── */
        map.addSource('wr-aircraft', { type: 'geojson', data: acft });
        map.addLayer({ id: 'wr-aircraft-dot', type: 'circle', source: 'wr-aircraft', filter: ['!=', ['get','mil'], true], paint: { 'circle-radius': 4, 'circle-color': '#3b82f6', 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#93c5fd' } });
        /* ── 군용기 — 별도 하이라이트 ── */
        map.addLayer({ id: 'wr-aircraft-mil-halo', type: 'circle', source: 'wr-aircraft', filter: ['==', ['get','mil'], true], paint: { 'circle-radius': 18, 'circle-color': '#facc15', 'circle-opacity': 0.15, 'circle-blur': 1 } });
        map.addLayer({ id: 'wr-aircraft-mil-dot', type: 'circle', source: 'wr-aircraft', filter: ['==', ['get','mil'], true], paint: { 'circle-radius': 6, 'circle-color': '#facc15', 'circle-opacity': 1, 'circle-stroke-width': 2, 'circle-stroke-color': '#fef08a' } });
        map.addLayer({ id: 'wr-aircraft-mil-label', type: 'symbol', source: 'wr-aircraft', filter: ['==', ['get','mil'], true], layout: { 'text-field': ['get','callsign'], 'text-size': 9, 'text-offset': [0,-1.5], 'text-anchor': 'bottom', 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true }, paint: { 'text-color': '#facc15', 'text-halo-color': '#000810', 'text-halo-width': 1.5 } });

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
        // 활성 자산: 내부 채움
        map.addLayer({ id: 'wr-forces-fill', type: 'circle', source: 'wr-forces',
          filter: ['==', ['get','active'], true],
          paint: { 'circle-radius': ['get','radius'], 'circle-color': ['get','color'], 'circle-opacity': ['get','opacity'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': 0.6 },
        });
        // 심볼 텍스트 (TYPE_SYMBOL)
        map.addLayer({ id: 'wr-forces-symbol', type: 'symbol', source: 'wr-forces',
          layout: { 'text-field': ['get','symbol'], 'text-size': ['case', ['==',['get','active'],true], 11, 9], 'text-anchor': 'center', 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-allow-overlap': true },
          paint: { 'text-color': '#ffffff', 'text-opacity': ['get','opacity'], 'text-halo-color': '#000000', 'text-halo-width': 0.5 },
        });
        // 부대명 레이블 (호버/줌 시)
        map.addLayer({ id: 'wr-forces-label', type: 'symbol', source: 'wr-forces',
          minzoom: 5,
          layout: { 'text-field': ['get','name'], 'text-size': 8, 'text-offset': [0, -1.8], 'text-anchor': 'bottom', 'text-font': ['literal',['DIN Offc Pro Medium','Arial Unicode MS Bold']], 'text-optional': true, 'text-max-width': 12 },
          paint: { 'text-color': ['get','color'], 'text-halo-color': '#000810', 'text-halo-width': 1.5, 'text-opacity': ['get','opacity'] },
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

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
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
    return <div style={{ height: H, display:'flex', alignItems:'center', justifyContent:'center', color:'#1e3a5f', fontSize:9 }}>데이터 수집 중...</div>;
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
   CSS
══════════════════════════════════════════════════════ */
const CSS = `
@keyframes wr-sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
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
.wr-blink        { animation: wr-blink 1.1s step-start infinite; }
.wr-threat-flash { animation: wr-pulse-border 1.2s ease-in-out infinite; }
.wr-feed-item    { animation: wr-slide-in 0.35s ease-out; }
.wr-count        { animation: wr-count 0.5s ease-out; }
.wr-breaking-in  { animation: wr-breaking-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
.wr-breaking-out { animation: wr-breaking-out 0.4s ease-in forwards; }
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
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
interface FeedItem { id:string; time:string; icon:string; title:string; region:string; severity:string; source:string; lat?:number; lng?:number; }
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
  const [cinematic,    setCinematic]    = useState(false);
  const [threatHistory,setThreatHistory]= useState<TensionPoint[]>([]);
  const [gdeltTimeline,setGdeltTimeline]= useState<{date:string;tone:number}[]>([]);
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
      const [a,q,f,o,g,oil] = await Promise.allSettled([
        apiFetch<any>('/api/acled-events'),
        apiFetch<any>('/api/usgs-quakes'),
        apiFetch<any>('/api/firms-fires'),
        apiFetch<any>('/api/opensky-aircraft'),
        apiFetch<any>('/api/gdacs-alerts'),
        apiFetch<any>('/api/oil-price'),
      ]);
      const aData = a.status==='fulfilled' ? (a.value?.events??[]) : [];
      const qData = q.status==='fulfilled' ? (q.value?.events??[]) : [];
      const fData = f.status==='fulfilled' ? (f.value?.events??[]) : [];
      const oData = o.status==='fulfilled' ? (o.value?.aircraft??[]) : [];
      const gData = g.status==='fulfilled' ? (g.value?.events??[]) : [];
      if (oil.status==='fulfilled') setOil(oil.value as Oil);

      /* GDELT 긴장 타임라인 */
      try {
        const tlRes = await apiFetch<any>('/api/gdelt-timeline');
        if (tlRes?.points?.length > 0) setGdeltTimeline(tlRes.points);
      } catch {}

      setAcled(aData); setQuakes(qData); setFirms(fData); setAircraft(oData); setGdacs(gData);
      setFreshness({ gdelt: t, usgs: t, firms: t, opensky: t, gdacs: t });

      /* 이벤트 피드 */
      const items: FeedItem[] = [
        ...aData.filter((e:any)=>inBBOX(e.lat,e.lng)).map((e:any)=>({ id:e.id, time:e.date||'', icon:'⚔️', title:e.eventType||'전투', region:e.region||e.country, severity:e.severity, source:'GDELT', lat:e.lat, lng:e.lng })),
        ...qData.filter((q:any)=>q.isSuspect&&inBBOX(q.lat,q.lng)).map((q:any)=>({ id:q.id, time:new Date(q.time).toISOString(), icon:'🌋', title:`M${q.magnitude} 이상진동`, region:q.place, severity:q.severity, source:'USGS', lat:q.lat, lng:q.lng })),
        ...gData.filter((e:any)=>inBBOX(e.lat,e.lng)).map((e:any)=>({ id:e.id, time:e.date||'', icon:'🚨', title:e.eventType, region:e.country, severity:e.severity, source:'GDACS' })),
        ...fData.filter((e:any)=>inBBOX(e.lat,e.lng)&&e.frp>20).map((e:any)=>({ id:e.id, time:`${e.date} ${e.time}`, icon:'🔥', title:`화재 ${e.frp}MW`, region:e.zone, severity:e.severity, source:'FIRMS' })),
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
  useEffect(() => { const id=setInterval(loadAll, 5*60_000); return ()=>clearInterval(id); }, [loadAll]);
  useEffect(() => { const id=setInterval(()=>setTick(t=>t+1), 1000); return ()=>clearInterval(id); }, []);

  /* Threat 히스토리 누적 */
  const threatScore = useMemo(()=>calcThreat(acled,quakes,firms,aircraft),[acled,quakes,firms,aircraft]);
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
    { key:'gdelt', label:'GDELT' },
    { key:'usgs',  label:'USGS'  },
    { key:'firms', label:'FIRMS' },
    { key:'opensky', label:'OPENSKY' },
    { key:'gdacs', label:'GDACS' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background:'#000810', display:'flex', flexDirection:'column', fontFamily:"'Courier New', monospace", overflow:'hidden', position:'relative' }}>
      <style>{CSS}</style>

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
          <span style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2 }}>// IRAN-ISRAEL CORRIDOR</span>
        </div>
        <div style={{ flex:1 }} />

        {/* 유가 ticker */}
        {oil?.wti?.price && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 12px', border:'1px solid #1a3a4a', borderRadius:2, background:'#020c18' }}>
            <span style={{ fontSize:9, color:'#4a7a9b', letterSpacing:1 }}>WTI</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#fbbf24', textShadow:'0 0 6px #fbbf2466' }}>${oil.wti.price.toFixed(2)}</span>
            <span style={{ fontSize:10, fontWeight:700, color: oil.wti.change >= 0 ? '#22c55e' : '#ef4444' }}>{oil.wti.change >= 0 ? '▲' : '▼'}{Math.abs(oil.wti.change).toFixed(2)}%</span>
          </div>
        )}

        {/* 위협 레벨 */}
        <div className={threat.flash ? 'wr-threat-flash' : ''} style={{ padding:'3px 14px', borderRadius:2, border:`1px solid ${threat.color}`, background:`${threat.color}18`, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2 }}>THREAT</span>
          <span style={{ fontSize:13, fontWeight:900, color:threat.color, letterSpacing:2, textShadow:`0 0 10px ${threat.glow}` }}>{threat.label}</span>
          <div style={{ width:60, height:6, background:'#0a1f2f', borderRadius:1, overflow:'hidden' }}>
            <div style={{ width:`${threatScore}%`, height:'100%', background:threat.color, boxShadow:`0 0 6px ${threat.color}`, transition:'width 1s ease' }} />
          </div>
          <span style={{ fontSize:11, color:threat.color, fontWeight:700 }}>{threatScore}</span>
        </div>

        {/* 인시던트 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 12px', border:'1px solid #1a3a4a', borderRadius:2, background:'#020c18' }}>
          <span style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2 }}>INCIDENTS</span>
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
          <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:1 }}>UTC · {loading?'동기화 중...':'데이터 최신'}</div>
        </div>
      </div>

      {/* ── 메인 2분할 ── */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* ──────── LEFT: 전술 지도 ──────── */}
        <div style={{ flex: cinematic ? '1 1 100%' : '0 0 57%', position:'relative', borderRight: cinematic ? 'none' : '1px solid #0a3050', transition:'flex 0.4s ease' }}>
          <div style={{ position:'absolute', top:8, left:8, zIndex:1000, fontSize:9, color:'#00d4ff88', letterSpacing:3, fontWeight:700 }}>TACTICAL MAP 3D // IRAN-ISRAEL</div>

          {/* CRT 스캔라인 */}
          <div style={{ position:'absolute', inset:0, zIndex:999, pointerEvents:'none', backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)' }} />

          {/* 레이더 스윕 */}
          <div style={{ position:'absolute', inset:0, zIndex:998, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <div style={{ width:'140%', paddingBottom:'140%', background:'conic-gradient(from -5deg, transparent 0deg, rgba(0,255,136,0.06) 18deg, transparent 22deg)', animation:'wr-sweep 7s linear infinite', borderRadius:'50%', position:'absolute' }} />
          </div>

          {/* 3D 지도 */}
          <Map3D siteScores={siteScores} meAcled={meAcled} meFirms={meFirms} meQuakes={meQuakes} meAircraft={meAircraft} />

          {/* 레전드 */}
          <div style={{ position:'absolute', bottom:8, left:8, zIndex:1000, background:'rgba(0,8,16,0.85)', border:'1px solid #0a3050', borderRadius:3, padding:'5px 10px', fontSize:9, color:'#4a7a9b', display:'flex', flexWrap:'wrap', gap:'4px 10px', maxWidth:300 }}>
            {[['🔴','분쟁'],['🟠','지진'],['🔥','화재'],['✈','항공기'],['✦','군용기'],['▲','기지'],['◈','핵'],['〇','사거리'],['〰','해협'],['▧','분쟁구역'],['⚠','기지경보'],['◆','이란전력(red)'],['▲','IDF(blue)'],['★','미항모(cyan)']].map(([i,l])=>(
              <span key={l as string}>{i} {l}</span>
            ))}
          </div>
        </div>

        {/* ──────── RIGHT: 인텔 대시보드 ──────── */}
        <div style={{ flex:1, display: cinematic ? 'none' : 'flex', flexDirection:'column', background:'#050f1a', minHeight:0, overflow:'hidden' }}>

          {/* 긴장지수 타임라인 차트 */}
          <div style={{ padding:'6px 12px 4px', borderBottom:'1px solid #0a1f2f', flexShrink:0, background:'#020c18' }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
              ▸ TENSION INDEX
              <span style={{ marginLeft:'auto', fontSize:8, color:'#2d5a7a' }}>24h</span>
            </div>
            <TensionChart data={threatHistory} gdeltPoints={gdeltTimeline} />
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
                <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:3 }}>{stat.icon} {stat.label}</div>
                <div className="wr-count" style={{ fontSize:24, fontWeight:900, color:stat.color, textShadow:`0 0 10px ${stat.color}66`, lineHeight:1 }}>{stat.val}</div>
              </div>
            ))}
          </div>

          {/* 전력 배치 요약 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:6 }}>▸ FORCE DEPLOYMENT</div>
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
                    <div style={{ fontSize:7, color:'#4a7a9b', letterSpacing:1, marginTop:2 }}>ACTIVE</div>
                    <div style={{ fontSize:8, color:group.color, opacity:0.6 }}>/{assets.length}</div>
                    <div style={{ fontSize:7, color:'#2d5a7a', marginTop:2, letterSpacing:0.5 }}>{group.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 자산 타입별 미니 분류 */}
            <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:3 }}>
              {(['missile','drone','navy','ground','airdef','carrier'] as ForceType[]).map(t => {
                const cnt = FORCE_ASSETS.filter(a=>a.type===t && a.active).length;
                if (!cnt) return null;
                return <span key={t} style={{ fontSize:8, padding:'1px 5px', border:'1px solid #0a1f2f', borderRadius:1, color:'#8aa3ba', background:'#020c18' }}>{TYPE_SYMBOL[t]} {TYPE_LABEL[t]} {cnt}</span>;
              })}
            </div>
          </div>

          {/* 영공 현황 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:5 }}>▸ AIRSPACE STATUS</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {AIRSPACE_ZONES.map(zone=>{
                const { status, color, icon } = airspaceStatus(aircraft, zone);
                return (
                  <div key={zone.name} style={{ padding:'2px 7px', border:`1px solid ${color}55`, borderRadius:2, background:`${color}08`, display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:10 }}>{zone.flag}</span>
                    <span style={{ fontSize:9, color:'#c0d8e8' }}>{zone.name}</span>
                    <span style={{ fontSize:9 }}>{icon}</span>
                    <span style={{ fontSize:9, color, fontWeight:700 }}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 군용기 감지 패널 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ MILITARY AIRCRAFT
              {milAircraft.length>0 && <span className="wr-blink" style={{ fontSize:9, color:'#facc15', fontWeight:700 }}>⚡ {milAircraft.length}기 탐지</span>}
              {milAircraft.length===0 && <span style={{ fontSize:9, color:'#2d5a7a' }}>탐지 없음</span>}
            </div>
            {milAircraft.length===0 ? (
              <div style={{ fontSize:9, color:'#1e3a5f', fontStyle:'italic', textAlign:'center', padding:'4px 0' }}>— 군용기 신호 없음 —</div>
            ) : milAircraft.slice(0,6).map((ac:any)=>(
              <div key={ac.icao24||ac.callsign} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', borderBottom:'1px solid #0a1f2f' }}>
                <span style={{ fontSize:10, color:'#facc15' }}>✦</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#fef08a' }}>{ac.callsign||'UNKNOWN'}</span>
                <span style={{ fontSize:9, color:'#4a7a9b' }}>{ac.country||''}</span>
                {ac.altitude && <span style={{ fontSize:9, color:'#2d5a7a', marginLeft:'auto' }}>{Math.round(ac.altitude)}m</span>}
              </div>
            ))}
          </div>

          {/* 기지 근접 화재 경보 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:5, display:'flex', alignItems:'center', gap:8 }}>
              ▸ BASE STRIKE ALERTS
              {baseAlerts.length>0 && <span className="wr-blink" style={{ fontSize:9, color:'#ef4444', fontWeight:700 }}>⚠ {baseAlerts.length}건</span>}
            </div>
            {baseAlerts.length===0 ? (
              <div style={{ fontSize:9, color:'#1e3a5f', fontStyle:'italic', textAlign:'center', padding:'4px 0' }}>— 기지 근접 화재 없음 —</div>
            ) : baseAlerts.map(alert=>{
              const color = BASE_COLOR[alert.type]??'#ef4444';
              return (
                <div key={alert.name} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 6px', marginBottom:3, borderRadius:2, border:`1px solid ${color}44`, background:`${color}0a` }}>
                  <span style={{ fontSize:10 }}>{BASE_SYMBOL[alert.type]??'●'}</span>
                  <span style={{ fontSize:10, fontWeight:700, color }}>⚠ {alert.name}</span>
                  <span style={{ fontSize:9, color:'#f97316', marginLeft:'auto' }}>🔥×{alert.fires}</span>
                </div>
              );
            })}
          </div>

          {/* 위협 지점 바 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:5 }}>▸ THREAT SITE INDEX</div>
            {siteScores.sort((a,b)=>b.score-a.score).slice(0,4).map(site=>{
              const color = site.score>70?'#ef4444':site.score>45?'#f97316':'#fbbf24';
              return (
                <div key={site.name} style={{ marginBottom:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontSize:9, color:'#c0d8e8' }}>{site.name}</span>
                    <span style={{ fontSize:9, color, fontWeight:700 }}>{site.score}</span>
                  </div>
                  <div style={{ height:3, background:'#0a1f2f', borderRadius:1, overflow:'hidden' }}>
                    <div style={{ width:`${site.score}%`, height:'100%', background:color, boxShadow:`0 0 4px ${color}`, transition:'width 1.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 인텔 피드 */}
          <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'5px 12px', borderBottom:'1px solid #0a1f2f', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <span style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2 }}>▸ INTEL FEED</span>
              <span className="wr-blink" style={{ fontSize:9, color:'#ef4444', letterSpacing:1 }}>● LIVE</span>
              <span style={{ marginLeft:'auto', fontSize:9, color:'#4a7a9b' }}>{feed.length}</span>
            </div>
            <div ref={feedRef} style={{ flex:1, overflowY:'auto', padding:'0 2px' }}>
              {feed.length===0 && <div style={{ padding:20, textAlign:'center', color:'#4a7a9b', fontSize:11 }}>{loading?'인텔 수집 중...':'감지된 이벤트 없음'}</div>}
              {feed.map((item,idx)=>{
                const sevColor = SEV_COLOR[item.severity]??'#94a3b8';
                return (
                  <div key={item.id} className="wr-feed-item" style={{ padding:'6px 12px', borderBottom:'1px solid #07131e', borderLeft:`2px solid ${sevColor}`, background:idx===0?`${sevColor}08`:'transparent', cursor:'default' }} onMouseEnter={e=>(e.currentTarget.style.background=`${sevColor}0f`)} onMouseLeave={e=>(e.currentTarget.style.background=idx===0?`${sevColor}08`:'transparent')}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:11 }}>{item.icon}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</span>
                      <span style={{ fontSize:9, color:'#4a7a9b', flexShrink:0 }}>{item.source}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:10, color:'#8aa3ba' }}>{item.region}</span>
                      <span style={{ fontSize:9, color:sevColor, fontWeight:700 }}>{item.severity?.toUpperCase()}</span>
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
                    <span className={fresh?'wr-blink':''} style={{ fontSize:7, color: stale?'#ef4444':fresh?'#22c55e':'#fbbf24' }}>●</span>
                    <span style={{ fontSize:8, color:'#4a7a9b' }}>{fi.label}</span>
                    {age!==null && <span style={{ fontSize:8, color: stale?'#ef4444':'#2d5a7a' }}>{age<60?`${age}s`:`${Math.floor(age/60)}m`}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
