/**
 * WorldMapView — 지정학 인텔리전스 지도 (v2)
 *
 * 기능:
 * - GeoJSON 국가 위험 오버레이 (코로플레스 choropleth)
 * - 지정학 핫스팟 핀 + 투자 시사점 팝업
 * - 영향선 (Impact Arcs) — 핫스팟 선택 시 금융 허브로 연결
 * - 공급망 무역 루트
 * - VIP 항공기 레이어
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Circle,
  Popup, Tooltip, ZoomControl, Polyline, useMap, Marker,
} from 'react-leaflet';
import { apiFetch } from '@/store';
import L from 'leaflet';
import type { PathOptions, StyleFunction } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store';
import type { Inference } from '@/store';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  nameKo: string;
  entityIds: string[];
}

interface HotspotInvestmentData {
  sectors: string[];
  tickers: string[];       // 🇰🇷 한국
  tickersUS?: string[];    // 🇺🇸 미국
  tickersJP?: string[];    // 🇯🇵 일본
  tickersCN?: string[];    // 🇨🇳 중국/홍콩
  implication: string;
  arcsTo: [number, number][];
  isoCountries: string[];
}

// ─── 지정학 핫스팟 ────────────────────────────────────────────────────────────
const HOTSPOTS: Hotspot[] = [
  { id: 'korean_peninsula', lat: 37.5665,  lng: 126.9780, nameKo: '한반도',       entityIds: ['region:korean_peninsula', 'country:north_korea', 'country:south_korea'] },
  { id: 'taiwan_strait',    lat: 24.0,     lng: 121.0,    nameKo: '대만해협',     entityIds: ['region:taiwan_strait', 'country:taiwan'] },
  { id: 'middle_east',      lat: 31.7683,  lng: 35.2137,  nameKo: '중동',         entityIds: ['region:middle_east', 'country:israel'] },
  { id: 'ukraine',          lat: 50.4501,  lng: 30.5234,  nameKo: '우크라이나',   entityIds: ['region:europe', 'country:russia', 'country:ukraine'] },
  { id: 'south_china_sea',  lat: 15.0,     lng: 114.0,    nameKo: '남중국해',     entityIds: ['country:china', 'region:east_asia'] },
  { id: 'iran',             lat: 35.6892,  lng: 51.3890,  nameKo: '이란',         entityIds: ['country:iran'] },
  { id: 'north_korea',      lat: 39.0392,  lng: 125.7625, nameKo: '북한',         entityIds: ['country:north_korea'] },
  { id: 'new_york',         lat: 40.7128,  lng: -74.0060, nameKo: '미국 금융',    entityIds: ['country:usa', 'financial'] },
  { id: 'beijing',          lat: 39.9042,  lng: 116.4074, nameKo: '중국',         entityIds: ['country:china'] },
  { id: 'moscow',           lat: 55.7558,  lng: 37.6173,  nameKo: '러시아',       entityIds: ['country:russia'] },
  { id: 'hormuz',           lat: 26.5000,  lng: 56.2500,  nameKo: '호르무즈해협', entityIds: ['region:middle_east', 'country:iran'] },
];

// ─── 투자 시사점 데이터 (핫스팟 ID → 정보) ──────────────────────────────────
const INVESTMENT_DATA: Record<string, HotspotInvestmentData> = {
  korean_peninsula: {
    sectors: ['방산', '반도체', 'ETF'],
    tickers:   ['한화에어로스페이스', 'LIG넥스원', '삼성전자'],
    tickersUS: ['LMT', 'RTX', 'NOC'],
    tickersJP: ['三菱重工(7011)', '川崎重工(7012)'],
    implication: '북한 도발 시 방산주 급등 + 코스피 외국인 이탈 반복 패턴. 단기 헤지: KODEX 인버스.',
    arcsTo: [[35.6762, 139.6503], [1.3521, 103.8198]],
    isoCountries: ['KP', 'KR'],
  },
  taiwan_strait: {
    sectors: ['반도체', 'IT부품', '해운'],
    tickers:   ['삼성전자', 'SK하이닉스', 'HMM'],
    tickersUS: ['NVDA', 'AMD', 'AMAT'],
    tickersJP: ['東京エレクトロン(8035)', '信越化学(4063)'],
    tickersCN: ['SMIC(0981.HK)', 'Alibaba(9988.HK)'],
    implication: '대만 긴장 격화 시 TSMC 대체 수혜 vs. 공급망 차질 이중 효과. 엔화 강세 연동.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503], [1.3521, 103.8198]],
    isoCountries: ['TW', 'CN'],
  },
  middle_east: {
    sectors: ['에너지', '항공', '화학'],
    tickers:   ['S-Oil', '대한항공', 'LG화학'],
    tickersUS: ['XOM', 'CVX', 'SLB'],
    tickersJP: ['ENEOS(5020)', 'ANA(9202)'],
    tickersCN: ['CNOOC(0883.HK)', 'PetroChina(0857.HK)'],
    implication: '중동 불안 → 유가 상승 → 정유사 마진 개선, 항공주 비용 부담. 원화 약세 압력.',
    arcsTo: [[37.5665, 126.9780], [28.6139, 77.2090]],
    isoCountries: ['IL', 'IR', 'SA', 'YE', 'SY', 'IQ'],
  },
  ukraine: {
    sectors: ['곡물', '에너지', '철강'],
    tickers:   ['POSCO홀딩스', 'CJ제일제당', '대한항공'],
    tickersUS: ['LMT', 'RTX', 'BA'],
    tickersJP: ['住友商事(8053)', 'JFEホールディングス(5411)'],
    tickersCN: ['CNOOC(0883.HK)', 'Sinopec(0386.HK)'],
    implication: '전쟁 장기화 시 원자재 가격 구조적 상승 → 철강·식품 원가 부담 지속.',
    arcsTo: [[37.5665, 126.9780], [40.7128, -74.0060]],
    isoCountries: ['UA', 'RU'],
  },
  south_china_sea: {
    sectors: ['해운', '반도체', '무역'],
    tickers:   ['HMM', '팬오션', '삼성전자'],
    tickersUS: ['FDX', 'UPS', 'ZIM'],
    tickersJP: ['日本郵船(9101)', '商船三井(9104)', '川崎汽船(9107)'],
    tickersCN: ['COSCO(1919.HK)', 'Orient Overseas(0316.HK)'],
    implication: '남중국해 분쟁 시 물류비 급등 + 한국 수출 차질. 해운주 단기 수혜 후 리스크.',
    arcsTo: [[37.5665, 126.9780], [1.3521, 103.8198]],
    isoCountries: ['CN', 'PH', 'VN'],
  },
  iran: {
    sectors: ['에너지', '해운', '화학'],
    tickers:   ['S-Oil', 'GS에너지', 'HMM'],
    tickersUS: ['XOM', 'CVX', 'MPC'],
    tickersJP: ['ENEOS(5020)', 'Idemitsu(5019)'],
    tickersCN: ['CNOOC(0883.HK)', 'PetroChina(0857.HK)'],
    implication: '호르무즈 봉쇄 리스크 시 한국 원유 수입 70%+ 차질. WTI +20% 시나리오.',
    arcsTo: [[37.5665, 126.9780], [22.3964, 114.1095]],
    isoCountries: ['IR'],
  },
  north_korea: {
    sectors: ['방산', 'ETF', '반도체'],
    tickers:   ['한화에어로스페이스', '현대로템', 'KODEX 200'],
    tickersUS: ['LMT', 'RTX', 'GD'],
    tickersJP: ['三菱重工(7011)', '川崎重工(7012)'],
    implication: '미사일 발사 당일 코스피 평균 -0.8%. 방산주 +3~8%. 3일내 대부분 회복.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503]],
    isoCountries: ['KP'],
  },
  new_york: {
    sectors: ['금융', '기술주', '환율'],
    tickers:   ['미래에셋증권', '삼성자산운용', 'TIGER 미국나스닥100'],
    tickersUS: ['JPM', 'GS', 'BLK', 'TLT'],
    tickersJP: ['野村HD(8604)', '大和証券(8601)'],
    tickersCN: ['건설은행(0939.HK)', 'HSBC(0005.HK)'],
    implication: '연준 금리 결정 → 달러/원 직접 연동. 금리 인상 시 외국인 코스피 순매도 패턴.',
    arcsTo: [[37.5665, 126.9780], [51.5074, -0.1278]],
    isoCountries: ['US'],
  },
  beijing: {
    sectors: ['철강', '화학', '배터리'],
    tickers:   ['POSCO홀딩스', 'LG에너지솔루션', 'SK이노베이션'],
    tickersUS: ['AAPL', 'NVDA', 'QCOM'],
    tickersJP: ['ソニー(6758)', 'トヨタ(7203)'],
    tickersCN: ['Alibaba(9988.HK)', 'Tencent(0700.HK)', 'BYD(1211.HK)'],
    implication: '중국 부양책 시 철강·화학 수혜. 기술패권 충돌 심화 시 배터리 공급망 우려.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503]],
    isoCountries: ['CN'],
  },
  moscow: {
    sectors: ['에너지', '곡물', '방산'],
    tickers:   ['한화에어로스페이스', 'POSCO홀딩스', 'CJ제일제당'],
    tickersUS: ['LMT', 'RTX', 'XOM'],
    tickersJP: ['三菱商事(8058)', ' 住友商事(8053)'],
    tickersCN: ['CNOOC(0883.HK)', 'Norinco Int\'l(0592.HK)'],
    implication: '러 제재 확대 → 유럽 에너지 가격 재상승 → LNG 관련주 간접 수혜.',
    arcsTo: [[37.5665, 126.9780], [51.5074, -0.1278]],
    isoCountries: ['RU'],
  },
  hormuz: {
    sectors: ['에너지', '해운', '화학'],
    tickers:   ['S-Oil', 'GS칼텍스', 'HMM'],
    tickersUS: ['XOM', 'CVX', 'MPC'],
    tickersJP: ['ENEOS(5020)', 'ANA(9202)'],
    tickersCN: ['CNOOC(0883.HK)', 'COSCO(1919.HK)'],
    implication: '호르무즈 봉쇄 = 블랙스완. 한국 에너지 안보 최대 취약점. 유가 WTI $150+ 시나리오.',
    arcsTo: [[37.5665, 126.9780], [1.3521, 103.8198]],
    isoCountries: ['IR', 'OM'],
  },
};

// ─── ISO → 엔티티 매핑 (GeoJSON 오버레이용) ──────────────────────────────────
const ISO_TO_ENTITIES: Record<string, string[]> = {
  KP: ['country:north_korea'],
  KR: ['country:south_korea'],
  CN: ['country:china', 'region:east_asia'],
  TW: ['region:taiwan_strait', 'country:taiwan'],
  JP: ['country:japan'],
  IL: ['country:israel', 'region:middle_east'],
  IR: ['country:iran', 'region:middle_east'],
  SA: ['region:middle_east'],
  YE: ['region:middle_east'],
  SY: ['region:middle_east'],
  IQ: ['region:middle_east'],
  UA: ['country:ukraine', 'region:europe'],
  RU: ['country:russia'],
  US: ['country:usa'],
  DE: ['region:europe'],
  FR: ['region:europe'],
  GB: ['region:europe'],
  PL: ['region:europe'],
  OM: ['region:middle_east', 'country:iran'],
  PH: ['region:east_asia'],
  VN: ['region:east_asia'],
};

// ─── 해운 항로 ────────────────────────────────────────────────────────────────
const SHIPPING_ROUTES = [
  { id: 'asia-europe',   name: '아시아-유럽',  points: [[1.3, 103.8], [12.5, 44.0], [30, 32.5], [37, 15], [51.9, 4.4]] as [number,number][] },
  { id: 'trans-pacific', name: '태평양 횡단', points: [[31.2, 121.4], [37.8, 144.9], [34.0, -118.2]] as [number,number][] },
  { id: 'us-europe',     name: '대서양',      points: [[40.7, -74.0], [51.5, -8.0], [51.9, 4.4]] as [number,number][] },
  { id: 'south-china',   name: '남중국해',    points: [[22.3, 114.2], [1.3, 103.8], [15.0, 108.0]] as [number,number][] },
];

// ─── VIP 항공기 타입 ──────────────────────────────────────────────────────────
interface VipAircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lat: number;
  lng: number;
  altBaro: number | null;
  onGround: boolean;
  velocity: number | null;
  heading: number | null;
  squawk: string | null;
  isEmergencySquawk: boolean;
  isMilCallsign: boolean;
  label: string;
  country: string;
  category: string;
  investmentSignalKo: string | null;
  isHighAlert: boolean;
  isKnownVip: boolean;
  pathHistory?: { lat: number; lng: number; ts: number }[];
}

interface VipAircraftResponse {
  aircraft: VipAircraft[];
  stats: { total: number; airborne: number; alertScore: number };
  alerts: { label: string; message: string }[];
  error?: string;
}

// 주요 VIP 항공기 홈베이스 (비행 미감지 시 위치 표시용)
const VIP_HOME_BASES = [
  // 국가 원수
  { icao24: 'ae0b6a', label: 'Air Force One',           lat: 38.8175, lng: -76.8640, flag: '🇺🇸', category: 'head_of_state',    person: '미국 대통령' },
  { icao24: 'ae0685', label: 'Air Force Two (VP)',       lat: 38.8175, lng: -76.8640, flag: '🇺🇸', category: 'head_of_state',    person: '미국 부통령' },
  { icao24: '43c36e', label: 'UK PM Voyager',            lat: 51.4775, lng: -0.4614,  flag: '🇬🇧', category: 'head_of_state',    person: '영국 총리' },
  { icao24: '3c4591', label: 'French President',         lat: 48.7233, lng: 2.3794,   flag: '🇫🇷', category: 'head_of_state',    person: '프랑스 대통령' },
  { icao24: '3cd54c', label: 'German Chancellor',        lat: 50.0319, lng: 8.5706,   flag: '🇩🇪', category: 'head_of_state',    person: '독일 총리' },
  { icao24: '84408a', label: 'Japanese PM',              lat: 35.5493, lng: 139.7798, flag: '🇯🇵', category: 'head_of_state',    person: '일본 총리' },
  { icao24: 'c00001', label: 'Russian Presidential',     lat: 55.4103, lng: 37.9027,  flag: '🇷🇺', category: 'head_of_state',    person: '러시아 대통령' },
  { icao24: '71be19', label: '대통령 전용기',             lat: 37.4444, lng: 127.1278, flag: '🇰🇷', category: 'head_of_state',    person: '한국 대통령' },
  { icao24: '76c63b', label: 'Israeli PM Aircraft',      lat: 31.9968, lng: 34.8936,  flag: '🇮🇱', category: 'head_of_state',    person: '이스라엘 총리' },
  { icao24: '780af5', label: 'China Gov Transport',      lat: 40.0801, lng: 116.5846, flag: '🇨🇳', category: 'government',        person: '중국 정부' },
  // 군 지휘부
  { icao24: 'ae04c5', label: 'E-4B Nightwatch',          lat: 41.1030, lng: -95.9130, flag: '🇺🇸', category: 'military_command', person: '미 핵전쟁 지휘소' },
  { icao24: 'ae0557', label: 'E-6B Mercury',              lat: 35.3490, lng: -97.4140, flag: '🇺🇸', category: 'military_command', person: '미 핵잠수함 통신' },
  { icao24: 'ae020b', label: 'RC-135 Rivet Joint',        lat: 35.3490, lng: -97.4140, flag: '🇺🇸', category: 'intelligence',     person: '미 신호정보 수집' },
  { icao24: '45d3ab', label: 'NATO E-3A AWACS',           lat: 50.8280, lng: 5.4525,   flag: '🌐', category: 'military_command',  person: 'NATO 조기경보기' },
  // 테크 CEO
  { icao24: 'a6395a', label: 'Elon Musk (N628TS)',        lat: 33.9222, lng: -118.3310,flag: '🚀', category: 'tech_ceo',          person: 'Elon Musk (Tesla/SpaceX/X)' },
  { icao24: 'a835af', label: 'Elon Musk (N72X)',          lat: 30.1975, lng: -97.6664, flag: '🚀', category: 'tech_ceo',          person: 'Elon Musk 보조기 (Austin TX)' },
  { icao24: 'a4b5cb', label: 'Bill Gates',                lat: 47.5296, lng: -122.3016,flag: '💻', category: 'investor',          person: 'Bill Gates (Cascade Inv.)' },
  // 미 정부 재무
  { icao24: 'ae4823', label: 'US Treasury Transport',     lat: 38.8175, lng: -76.8640, flag: '🇺🇸', category: 'government',       person: '미 재무부 수송기' },
];

// 카테고리별 색상
const AIRCRAFT_CAT_COLOR: Record<string, string> = {
  head_of_state:    '#f59e0b',
  military_command: '#ef4444',
  intelligence:     '#a855f7',
  military:         '#f97316',
  government:       '#3b82f6',
  tech_ceo:         '#22d3ee',
  investor:         '#84cc16',
  unknown:          '#6b7280',
};

const CATEGORY_KO: Record<string, string> = {
  head_of_state: '국가 수반',
  military_command: '군 지휘통제',
  intelligence: '정보수집',
  military: '군용기',
  government: '정부',
  tech_ceo: 'CEO 전용기',
  investor: '투자자',
  unknown: '미상',
};

function headingToCardinal(deg: number | null): string {
  if (deg == null) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function makeAircraftIcon(heading: number | null, color: string, isHighAlert: boolean) {
  const rot = heading ?? 0;
  const glow = isHighAlert ? `drop-shadow(0 0 6px ${color})` : `drop-shadow(0 0 2px ${color})`;
  return L.divIcon({
    html: `<div style="transform:rotate(${rot}deg);font-size:18px;filter:${glow};line-height:1;">✈</div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// VIP 항공기 상세 패널
function VipAircraftPanel({ ac, onClose }: { ac: VipAircraft; onClose: () => void }) {
  const color = AIRCRAFT_CAT_COLOR[ac.category] ?? '#6b7280';
  const cat = CATEGORY_KO[ac.category] ?? ac.category;
  const altFt = ac.altBaro != null ? Math.round(ac.altBaro * 3.28084) : null;
  const spdKts = ac.velocity != null ? Math.round(ac.velocity * 1.94384) : null;
  const headingDeg = ac.heading != null ? Math.round(ac.heading) : null;

  return (
    <DraggablePanel className="absolute bottom-14 left-3 z-[1000] w-72">
      <div className="bg-black/90 backdrop-blur-md border rounded-lg overflow-hidden shadow-2xl"
        style={{ borderColor: color + '66' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: color + '33', background: color + '18' }}>
          <div className="flex items-center gap-2">
            <span style={{ color, fontSize: '16px' }}>✈</span>
            <div>
              <div className="text-xs font-bold font-mono" style={{ color }}>{ac.label}</div>
              <div className="text-[10px] text-gray-400">{ac.country}</div>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color, borderColor: color + '66', background: color + '1f' }}>{cat}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs ml-2">✕</button>
        </div>

        {/* 비행 정보 */}
        <div className="px-3 py-2 grid grid-cols-4 gap-2 border-b border-white/5 text-center">
          <div>
            <div className="text-[10px] text-gray-500">상태</div>
            <div className={`text-xs font-mono font-bold ${ac.onGround ? 'text-gray-400' : 'text-green-400'}`}>
              {ac.onGround ? '지상' : '비행 중'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">고도</div>
            <div className="text-xs font-mono text-primary">{altFt != null ? `${altFt.toLocaleString()}ft` : '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">속도</div>
            <div className="text-xs font-mono text-primary">{spdKts != null ? `${spdKts}kts` : '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">방향</div>
            <div className="text-xs font-mono text-primary">
              {headingDeg != null ? `${headingDeg}°` : '—'} {headingToCardinal(ac.heading)}
            </div>
          </div>
        </div>

        <div className="px-3 py-2 grid grid-cols-2 gap-2 border-b border-white/5 text-center">
          {ac.callsign && (
            <div>
              <div className="text-[10px] text-gray-500">콜사인</div>
              <div className="text-xs font-mono text-primary">{ac.callsign}</div>
            </div>
          )}
          {ac.pathHistory && ac.pathHistory.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500">서버 궤적</div>
              <div className="text-xs font-mono text-primary">{ac.pathHistory.length}점</div>
            </div>
          )}
        </div>

        {/* 투자 인텔리전스 */}
        {ac.investmentSignalKo && !ac.onGround && (
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-gray-500 mb-1">💡 투자 인텔리전스</div>
            <p className="text-xs leading-relaxed" style={{ color: isHighAlertCategory(ac.category) ? '#fca5a5' : '#93c5fd' }}>
              {ac.investmentSignalKo}
            </p>
          </div>
        )}
        {ac.onGround && (
          <div className="px-3 py-2 text-[10px] text-gray-600 italic">현재 지상 대기 중. 이륙 시 신호 감지.</div>
        )}

        {/* ICAO */}
        <div className="px-3 pb-2 text-[10px] text-gray-700 font-mono">ICAO: {ac.icao24}</div>
      </div>
    </DraggablePanel>
  );
}

function isHighAlertCategory(cat: string) {
  return ['military_command', 'head_of_state'].includes(cat);
}

// 플릿 오버뷰 패널 — 추적 중인 전체 항공기 목록 + 현재 상태
function FleetOverviewPanel({
  liveAircraft,
  onSelect,
  onClose,
}: {
  liveAircraft: VipAircraft[];
  onSelect: (id: string | null, lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const CAT_LABEL: Record<string, string> = {
    head_of_state: '국가 원수',
    military_command: '군 지휘부',
    intelligence: '정보기관',
    government: '정부 기관',
    tech_ceo: '테크 CEO',
    investor: '투자자',
  };

  const groups = [
    { key: 'head_of_state',    label: '👑 국가 원수' },
    { key: 'military_command', label: '⚔️ 군 지휘부' },
    { key: 'tech_ceo',         label: '💡 테크 CEO' },
    { key: 'government',       label: '🏛️ 정부 기관' },
    { key: 'investor',         label: '💰 투자자' },
    { key: 'intelligence',     label: '🔎 정보기관' },
  ];

  return (
    <DraggablePanel className="absolute top-16 left-16 z-[1000] w-72">
      <div className="bg-black/92 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">✈</span>
            <span className="text-xs font-bold font-mono text-white">VIP FLEET TRACKER</span>
            <span className="text-[10px] text-gray-500 font-mono">/{VIP_HOME_BASES.length}기 추적</span>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xs">✕</button>
        </div>

        <div className="overflow-y-auto max-h-96">
          {groups.map(group => {
            const bases = VIP_HOME_BASES.filter(b => b.category === group.key);
            if (bases.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="px-3 py-1 text-[10px] text-gray-600 uppercase tracking-widest bg-white/3 border-b border-white/5">
                  {group.label}
                </div>
                {bases.map(base => {
                  const live = liveAircraft.find(a => a.icao24 === base.icao24);
                  const isAirborne = live && !live.onGround;
                  const color = AIRCRAFT_CAT_COLOR[base.category] ?? '#6b7280';
                  return (
                    <button
                      key={base.icao24}
                      onClick={() => {
                        const lat = live ? live.lat : base.lat;
                        const lng = live ? live.lng : base.lng;
                        onSelect(live ? base.icao24 : null, lat, lng);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-0 text-left transition-colors hover:bg-white/8 cursor-pointer"
                    >
                      {/* 상태 점 */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        isAirborne ? 'animate-pulse' : ''
                      }`} style={{ background: isAirborne ? color : '#374151' }} />
                      {/* 국기 + 이름 */}
                      <span className="text-xs shrink-0">{base.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-200 truncate leading-tight">{base.person ?? base.label}</div>
                        <div className="text-[10px] text-gray-600 truncate">{base.label}</div>
                      </div>
                      {/* 상태 배지 */}
                      <span className={`text-[10px] font-mono shrink-0 ${
                        isAirborne ? 'text-green-400' :
                        live ? 'text-gray-500' :
                        'text-gray-700'
                      }`}>
                        {isAirborne ? '✈ 비행' : live ? '지상' : '미감지'}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-gray-700">OpenSky Network · 2분 갱신</span>
          <span className="text-[10px] font-mono" style={{ color: liveAircraft.filter(a => !a.onGround).length > 0 ? '#4ade80' : '#6b7280' }}>
            {liveAircraft.filter(a => !a.onGround).length > 0
              ? `✈ ${liveAircraft.filter(a => !a.onGround).length}기 비행 중`
              : '현재 비행 없음'}
          </span>
        </div>
      </div>
    </DraggablePanel>
  );
}

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────
function scoreHotspot(
  hotspot: Hotspot,
  inferences: Inference[],
  globalRiskScore: number,
): number {
  let score = globalRiskScore * 0.3;
  inferences.forEach(inf => {
    const match = inf.affectedEntityIds?.some(id => hotspot.entityIds.includes(id));
    if (match) score += inf.severity === 'CRITICAL' ? 40 : inf.severity === 'ELEVATED' ? 25 : inf.severity === 'WATCH' ? 10 : 5;
  });
  return Math.min(100, score);
}

function scoreToColor(score: number): string {
  if (score >= 70) return '#ef4444';
  if (score >= 45) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

function scoreToFill(score: number): string {
  if (score >= 70) return '#ef444433';
  if (score >= 45) return '#f9731622';
  if (score >= 25) return '#eab30815';
  return '#22c55e0a';
}

function severityKo(s: string): string {
  return s === 'CRITICAL' ? '🔴 심각' : s === 'ELEVATED' ? '🟠 경계' : s === 'WATCH' ? '🟡 주의' : '🟢 모니터';
}

// ─── 지도 이동 컨트롤러 (MapContainer 내부에서 flyTo 실행) ───────────────────
function MapPanController({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 5, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// ─── GeoJSON 리로더 (데이터 변경 시 레이어 갱신용) ───────────────────────────
function GeoJsonLayer({ data, scoreMap }: { data: any; scoreMap: Record<string, number> }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  const styleFunc: StyleFunction = useCallback((feature: any): PathOptions => {
    const iso = feature?.properties?.ISO_A2 as string | undefined;
    const score = iso ? (scoreMap[iso] ?? 0) : 0;
    if (score < 5) return { fillOpacity: 0, color: 'transparent', weight: 0 };
    return {
      fillColor: scoreToColor(score),
      fillOpacity: 0.08 + (score / 100) * 0.22,
      color: scoreToColor(score),
      weight: 0.8,
      opacity: 0.4,
    };
  }, [scoreMap]);

  useEffect(() => {
    if (!data || !map) return;
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    try {
      layerRef.current = L.geoJSON(data, { style: styleFunc, interactive: false });
      layerRef.current.addTo(map);
    } catch (e) {
      console.warn('[GeoJsonLayer] GeoJSON 레이어 추가 실패:', e);
    }
    return () => {
      try { layerRef.current?.remove(); } catch { /* ignore */ }
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scoreMap]);

  return null;
}

// ─── 레이어 토글 상태 ─────────────────────────────────────────────────────────
interface LayerState {
  threats: boolean;
  overlay: boolean;
  arcs: boolean;
  aircraft: boolean;
  shipping: boolean;
  events: boolean;
  semiconductors: boolean;
  nkHistory: boolean;
}

// ─── 반도체 공급망 노드 ───────────────────────────────────────────────────────
interface SemiNode { symbol: string; nameKo: string; role: string; lat: number; lng: number; }
const SEMI_ROLE_COLOR: Record<string, string> = {
  memory: '#3b82f6', fab: '#ef4444', equipment: '#22c55e', design: '#f59e0b', integrated: '#a855f7',
};
const SEMI_NODES: SemiNode[] = [
  { symbol: '005930.KS', nameKo: '삼성전자',          role: 'memory',     lat: 37.27, lng: 127.05 },
  { symbol: '000660.KS', nameKo: 'SK하이닉스',         role: 'memory',     lat: 37.41, lng: 127.25 },
  { symbol: 'TSM',       nameKo: 'TSMC',              role: 'fab',        lat: 24.78, lng: 120.97 },
  { symbol: 'ASML',      nameKo: 'ASML (EUV장비)',     role: 'equipment',  lat: 51.44, lng: 5.48   },
  { symbol: 'NVDA',      nameKo: '엔비디아',            role: 'design',     lat: 37.37, lng: -121.97},
  { symbol: 'INTC',      nameKo: '인텔',               role: 'integrated', lat: 45.52, lng: -122.97},
  { symbol: 'AMD',       nameKo: 'AMD',               role: 'design',     lat: 37.33, lng: -121.92},
  { symbol: 'AMAT',      nameKo: '어플라이드 머티리얼즈', role: 'equipment',  lat: 37.39, lng: -121.97},
  { symbol: 'LRCX',      nameKo: '램 리서치',           role: 'equipment',  lat: 37.65, lng: -121.80},
  { symbol: '6857.T',    nameKo: '어드밴테스트',         role: 'equipment',  lat: 35.69, lng: 139.69 },
];

// ─── 북한 도발 이력 ───────────────────────────────────────────────────────────
type NKType = 'missile_test' | 'nuclear_test' | 'cyber' | 'maritime' | 'artillery' | 'rhetoric';
interface NKEvent { id: string; date: string; type: NKType; title: string; desc: string; lat: number; lng: number; severity: number; }
const NK_TYPE_COLOR: Record<NKType, string> = {
  missile_test: '#ef4444', nuclear_test: '#7c3aed', cyber: '#f97316',
  maritime: '#0ea5e9', artillery: '#84cc16', rhetoric: '#6b7280',
};
const NK_TYPE_KO: Record<NKType, string> = {
  missile_test: '미사일', nuclear_test: '핵실험', cyber: '사이버',
  maritime: '해상', artillery: '포격', rhetoric: '위협 발언',
};
const NK_EVENTS: NKEvent[] = [
  { id: 'nk1', date: '2024-11-05', type: 'missile_test', title: 'ICBM 화성-19형 발사', desc: '역대 최장거리 ICBM. 비행시간 86분, 고도 7,000km 이상. 미 본토 전역 사정권 과시.', lat: 39.03, lng: 125.75, severity: 5 },
  { id: 'nk2', date: '2024-09-10', type: 'rhetoric',     title: '대남 오물 풍선 살포', desc: '한국 대북 확성기 방송 대응, 오물·쓰레기 풍선 수백 개 살포.', lat: 37.9, lng: 126.5, severity: 2 },
  { id: 'nk3', date: '2024-06-02', type: 'cyber',        title: 'GPS 전파 교란', desc: '서해 해역 및 인천공항 항공기 GPS 신호 교란. 항공 운항 차질.', lat: 37.46, lng: 126.44, severity: 3 },
  { id: 'nk4', date: '2024-04-02', type: 'missile_test', title: '전략순항미사일 발사', desc: '서해상으로 전략순항미사일 다수 발사.', lat: 39.5, lng: 125.0, severity: 3 },
  { id: 'nk5', date: '2023-11-21', type: 'missile_test', title: '군사정찰위성 1호 성공', desc: '군사정찰위성 만리경-1호 궤도 진입. 군사 ISR 능력 획득.', lat: 39.9, lng: 124.7, severity: 4 },
  { id: 'nk6', date: '2023-03-16', type: 'missile_test', title: '화성-17 ICBM', desc: '최대사거리 ICBM 발사. 미 본토 전역 사정권 과시.', lat: 39.03, lng: 125.75, severity: 5 },
  { id: 'nk7', date: '2022-10-04', type: 'missile_test', title: '중거리 미사일 일본 상공', desc: '화성-12가 일본 열도 상공 통과. 4,600km 비행.', lat: 39.5, lng: 128.0, severity: 5 },
  { id: 'nk8', date: '2022-09-25', type: 'missile_test', title: '탄도미사일 6발 동시 발사', desc: '단거리 탄도미사일 6발 동해상 발사. 역대 최다 동시 발사.', lat: 39.2, lng: 127.1, severity: 4 },
];

// ─── 지리 이벤트 (뉴스 기반) ─────────────────────────────────────────────────
interface GeoEvent {
  id: string;
  lat: number;
  lng: number;
  region: string;
  category: 'conflict' | 'terrorism' | 'politics' | 'economy' | 'social' | 'disaster';
  severity: 'critical' | 'high' | 'medium' | 'low';
  titleKo: string;
  summaryKo: string;
  tags?: string[];
  investmentImpactKo?: string;
  updatedAt: number;
}

const CATEGORY_META: Record<GeoEvent['category'], { icon: string; color: string; labelKo: string }> = {
  conflict:  { icon: '⚔️',  color: '#ef4444', labelKo: '분쟁·전쟁' },
  terrorism: { icon: '💣',  color: '#f97316', labelKo: '테러' },
  politics:  { icon: '🏛️',  color: '#3b82f6', labelKo: '정치' },
  economy:   { icon: '📈',  color: '#22c55e', labelKo: '경제' },
  social:    { icon: '🧩',  color: '#eab308', labelKo: '사회' },
  disaster:  { icon: '🌪️',  color: '#a855f7', labelKo: '재해' },
};

const SEV_RADIUS: Record<GeoEvent['severity'], number> = {
  critical: 12, high: 9, medium: 7, low: 5,
};

type CategoryKey = GeoEvent['category'];
type SeverityFilter = 'all' | 'high' | 'critical';

function LayerControl({
  layers,
  onToggle,
  activeCategories,
  onToggleCategory,
  severityFilter,
  onSeverityChange,
  onFleetToggle,
  showFleet,
  aircraftTracked,
  aircraftAirborne,
}: {
  layers: LayerState;
  onToggle: (key: keyof LayerState) => void;
  activeCategories: Set<CategoryKey>;
  onToggleCategory: (cat: CategoryKey) => void;
  severityFilter: SeverityFilter;
  onSeverityChange: (f: SeverityFilter) => void;
  onFleetToggle?: () => void;
  showFleet?: boolean;
  aircraftTracked?: number;
  aircraftAirborne?: number;
}) {
  const btns: { key: keyof LayerState; label: string; active: string }[] = [
    { key: 'threats',  label: '🎯 위협 핀',      active: 'text-red-400 border-red-500/50 bg-red-500/20' },
    { key: 'overlay',  label: '🗺 국가 오버레이', active: 'text-amber-400 border-amber-500/50 bg-amber-500/20' },
    { key: 'arcs',     label: '⚡ 영향선',       active: 'text-purple-400 border-purple-500/50 bg-purple-500/20' },
    { key: 'aircraft', label: '✈ VIP 항공기',    active: 'text-blue-400 border-blue-500/50 bg-blue-500/20' },
    { key: 'shipping', label: '🚢 해운 항로',     active: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/20' },
    { key: 'events',        label: '📌 뉴스 이벤트',  active: 'text-pink-400 border-pink-500/50 bg-pink-500/20' },
    { key: 'semiconductors', label: '🔵 반도체 공급망', active: 'text-blue-400 border-blue-500/50 bg-blue-500/20' },
    { key: 'nkHistory',      label: '⚡ 북한 도발 이력', active: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/20' },
  ];

  const sevOptions: { key: SeverityFilter; label: string }[] = [
    { key: 'all',      label: '전체' },
    { key: 'high',     label: '높음↑' },
    { key: 'critical', label: '위급만' },
  ];

  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
      {/* 레이어 토글 */}
      {btns.map(b => (
        <div key={b.key} className="flex gap-1">
          <button onClick={() => onToggle(b.key)}
            className={`flex-1 text-xs px-2.5 py-1 rounded border font-semibold transition-all backdrop-blur-sm ${
              layers[b.key] ? b.active : 'text-gray-500 border-gray-700 bg-black/60 hover:text-gray-300'
            }`}>
            {b.label}
          </button>
          {/* 항공기 레이어 활성화 시 플릿 오버뷰 버튼 */}
          {b.key === 'aircraft' && layers.aircraft && onFleetToggle && (
            <button
              onClick={onFleetToggle}
              title="전체 추적 목록"
              className={`text-xs px-2 py-1 rounded border transition-all backdrop-blur-sm ${
                showFleet
                  ? 'text-blue-300 border-blue-400/60 bg-blue-500/20'
                  : 'text-gray-500 border-gray-700 bg-black/60 hover:text-gray-300'
              }`}
            >📋</button>
          )}
        </div>
      ))}
      {layers.aircraft && (aircraftTracked ?? 0) > 0 && (
        <div className="text-[11px] text-blue-200/80 bg-blue-500/10 border border-blue-500/25 rounded px-2 py-1">
          ✈ {aircraftAirborne ?? 0} airborne / {aircraftTracked ?? 0} tracked
        </div>
      )}

      {/* 이벤트 필터 패널 — events 켜진 경우만 */}
      {layers.events && (
        <div className="bg-black/80 backdrop-blur-sm border border-pink-500/20 rounded p-2 mt-1 flex flex-col gap-2">
          {/* 카테고리 토글 */}
          <div>
            <p className="text-[10px] text-gray-500 mb-1 font-semibold">카테고리</p>
            <div className="grid grid-cols-2 gap-1">
              {(Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => (
                <button key={key} onClick={() => onToggleCategory(key)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-all flex items-center gap-1 ${
                    activeCategories.has(key)
                      ? 'border-opacity-60 font-semibold'
                      : 'border-gray-700 text-gray-600 bg-transparent'
                  }`}
                  style={activeCategories.has(key) ? {
                    borderColor: meta.color + '80',
                    color: meta.color,
                    background: meta.color + '18',
                  } : undefined}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.labelKo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 심각도 필터 */}
          <div>
            <p className="text-[10px] text-gray-500 mb-1 font-semibold">심각도</p>
            <div className="flex gap-1">
              {sevOptions.map(s => (
                <button key={s.key} onClick={() => onSeverityChange(s.key)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-all flex-1 ${
                    severityFilter === s.key
                      ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 font-semibold'
                      : 'border-gray-700 text-gray-600 hover:text-gray-400'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 드래그 가능한 패널 래퍼 ─────────────────────────────────────────────────
function DraggablePanel({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      setOffset({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy });
    };
    const onUp = () => { drag.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div
      className={className}
      style={{ ...style, transform: `translate(${offset.x}px,${offset.y}px)`, userSelect: 'none', cursor: 'grab' }}
      onMouseDown={e => {
        // 버튼·링크·인풋 클릭은 드래그 무시 — 닫기 버튼 등이 정상 작동
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, select, [role="button"]')) return;
        drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
        document.body.style.cursor = 'grabbing';
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}

// ─── 선택된 핫스팟 상세 패널 ──────────────────────────────────────────────────
interface ScoredHotspot extends Hotspot {
  score: number;
  matchedInferences: Inference[];
}

function SelectedPanel({ hotspot, onClose }: { hotspot: ScoredHotspot; onClose: () => void }) {
  const inv = INVESTMENT_DATA[hotspot.id];
  const color = scoreToColor(hotspot.score);

  return (
    <DraggablePanel className="absolute bottom-14 right-3 z-[1000] w-72" >
    <div className="bg-black/90 backdrop-blur-md border rounded-lg overflow-hidden shadow-2xl relative"
      style={{ borderColor: color + '55' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: color + '33', background: color + '15' }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: color }} />
          <span className="text-sm font-bold text-white">{hotspot.nameKo}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: color + '30', color }}>
            {Math.round(hotspot.score)}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Active inferences */}
        {hotspot.matchedInferences.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">활성 신호</div>
            {hotspot.matchedInferences.slice(0, 2).map((inf, i) => (
              <div key={i} className="text-xs mb-1 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">{severityKo(inf.severity).split(' ')[0]}</span>
                <span className="text-gray-300 leading-tight">{inf.titleKo}</span>
              </div>
            ))}
          </div>
        )}

        {/* Investment implication */}
        {inv && (
          <>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">투자 시사점</div>
              <p className="text-xs text-gray-200 leading-relaxed">{inv.implication}</p>
            </div>

            {/* Sectors */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">영향 섹터</div>
              <div className="flex flex-wrap gap-1">
                {inv.sectors.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-300 bg-gray-800/60">{s}</span>
                ))}
              </div>
            </div>

            {/* Tickers — 국가별 */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">관련 종목</div>
              <div className="flex flex-col gap-1.5">
                {/* 🇰🇷 한국 */}
                {inv.tickers.length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-600 mb-1 block">🇰🇷 한국</span>
                    <div className="flex flex-wrap gap-1">
                      {inv.tickers.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded border font-mono"
                          style={{ borderColor: color + '60', color, background: color + '12' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* 🇺🇸 미국 */}
                {(inv.tickersUS?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-600 mb-1 block">🇺🇸 미국</span>
                    <div className="flex flex-wrap gap-1">
                      {inv.tickersUS!.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded border border-blue-500/40 text-blue-300 bg-blue-500/10 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* 🇯🇵 일본 */}
                {(inv.tickersJP?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-600 mb-1 block">🇯🇵 일본</span>
                    <div className="flex flex-wrap gap-1">
                      {inv.tickersJP!.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded border border-red-400/40 text-red-300 bg-red-500/10 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* 🇨🇳 중국/홍콩 */}
                {(inv.tickersCN?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-600 mb-1 block">🇨🇳 중국/홍콩</span>
                    <div className="flex flex-wrap gap-1">
                      {inv.tickersCN!.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded border border-yellow-500/40 text-yellow-300 bg-yellow-500/10 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </DraggablePanel>
  );
}

// ─── 뉴스 이벤트 상세 패널 ───────────────────────────────────────────────────
function EventPanel({ event, onClose }: { event: GeoEvent; onClose: () => void }) {
  const meta = CATEGORY_META[event.category];
  const sevColor = event.severity === 'critical' ? '#ef4444'
    : event.severity === 'high' ? '#f97316'
    : event.severity === 'medium' ? '#eab308' : '#22c55e';

  return (
    <DraggablePanel className="absolute top-16 right-3 z-[1000] w-72">
    <div className="bg-black/90 backdrop-blur-md border rounded-lg overflow-hidden shadow-2xl relative"
      style={{ borderColor: meta.color + '55' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: meta.color + '33', background: meta.color + '15' }}>
        <div className="flex items-center gap-2">
          <span>{meta.icon}</span>
          <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.labelKo}</span>
          <span className="text-xs font-bold text-gray-400">·</span>
          <span className="text-xs text-gray-300 font-semibold">{event.region}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
            style={{ background: sevColor + '30', color: sevColor }}>
            {event.severity === 'critical' ? '위급' : event.severity === 'high' ? '높음'
              : event.severity === 'medium' ? '보통' : '낮음'}
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <p className="text-sm font-bold text-white leading-tight">{event.titleKo}</p>
        <p className="text-xs text-gray-300 leading-relaxed">{event.summaryKo}</p>

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">#{tag}</span>
            ))}
          </div>
        )}

        {event.investmentImpactKo && (
          <div className="bg-green-500/5 border border-green-500/20 rounded p-2.5">
            <p className="text-[10px] text-green-400 font-semibold mb-1">💹 투자 영향</p>
            <p className="text-xs text-gray-300 leading-relaxed">{event.investmentImpactKo}</p>
          </div>
        )}
      </div>
    </div>
    </DraggablePanel>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function WorldMapView() {
  const { briefing, globalRiskScore } = useStore();
  const inferences = (briefing?.topInferences ?? []) as Inference[];

  // 레이어 토글
  const [layers, setLayers] = useState<LayerState>({
    threats: true,
    overlay: true,
    arcs: true,
    aircraft: false,
    shipping: false,
    events: true,
    semiconductors: false,
    nkHistory: false,
  });

  // NK 도발 선택 상태
  const [selectedNkId, setSelectedNkId] = useState<string | null>(null);

  // 선택된 핫스팟
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 뉴스 기반 지리 이벤트
  const [geoEvents, setGeoEvents] = useState<GeoEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // 이벤트 필터
  const ALL_CATEGORIES = new Set<CategoryKey>(Object.keys(CATEGORY_META) as CategoryKey[]);
  const [activeCategories, setActiveCategories] = useState<Set<CategoryKey>>(ALL_CATEGORIES);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  function toggleCategory(cat: CategoryKey) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); if (next.size === 0) return new Set(ALL_CATEGORIES); }
      else next.add(cat);
      return next;
    });
  }

  // GeoJSON 데이터 (CDN 로드)
  const [geoData, setGeoData] = useState<any>(null);

  // GeoJSON 로드
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => { /* GeoJSON 없어도 동작 — 핀만 표시 */ });
  }, []);

  // geo-events 로드 (뉴스 기반 이벤트 핀)
  useEffect(() => {
    const load = () => {
      fetch('/api/geo-events')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d.events)) setGeoEvents(d.events); })
        .catch(() => { /* graceful */ });
    };
    load();
    const id = setInterval(load, 20 * 60_000); // 20분마다 갱신
    return () => clearInterval(id);
  }, []);

  // VIP 항공기 실시간 데이터
  const [liveAircraft, setLiveAircraft] = useState<VipAircraft[]>([]);
  const [aircraftTrails, setAircraftTrails] = useState<Record<string, [number, number][]>>({});
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [showFleetOverview, setShowFleetOverview] = useState(false);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  useEffect(() => {
    if (!layers.aircraft) return; // 레이어 꺼져 있으면 fetch 안 함
    const load = () => {
      apiFetch<VipAircraftResponse>('/api/vip-aircraft')
        .then(d => {
          if (d && Array.isArray(d.aircraft)) {
            setLiveAircraft(d.aircraft);
            setAircraftTrails(prev => {
              const next = { ...prev };
              d.aircraft.forEach((ac: VipAircraft) => {
                if (ac.onGround) return;
                const trail = next[ac.icao24] ? [...next[ac.icao24]] : [];
                const last = trail[trail.length - 1];
                if (!last || Math.abs(last[0] - ac.lat) > 0.005 || Math.abs(last[1] - ac.lng) > 0.005) {
                  trail.push([ac.lat, ac.lng]);
                  if (trail.length > 30) trail.shift();
                  next[ac.icao24] = trail;
                }
              });
              return next;
            });
          }
        })
        .catch(() => { /* graceful */ });
    };
    load();
    const id = setInterval(load, 2 * 60_000); // 2분마다 갱신
    return () => clearInterval(id);
  }, [layers.aircraft]);

  function toggleLayer(key: keyof LayerState) {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // 핫스팟 점수 계산
  const scored: ScoredHotspot[] = HOTSPOTS.map(h => ({
    ...h,
    score: scoreHotspot(h, inferences, globalRiskScore),
    matchedInferences: inferences.filter(inf =>
      inf.affectedEntityIds?.some(id => h.entityIds.includes(id))
    ),
  }));

  // GeoJSON 국가별 리스크 점수 맵 (ISO_A2 → score)
  const isoScoreMap: Record<string, number> = {};
  Object.entries(ISO_TO_ENTITIES).forEach(([iso, entityIds]) => {
    let score = 0;
    inferences.forEach(inf => {
      const match = entityIds.some(id => inf.affectedEntityIds?.includes(id));
      if (match) score += inf.severity === 'CRITICAL' ? 40 : inf.severity === 'ELEVATED' ? 25 : inf.severity === 'WATCH' ? 10 : 5;
    });
    score += globalRiskScore * 0.1;
    if (score > 0) isoScoreMap[iso] = Math.min(100, score);
  });

  const selectedHotspot = scored.find(h => h.id === selectedId) ?? null;
  const selectedInv = selectedId ? INVESTMENT_DATA[selectedId] : null;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[20, 20]}
        zoom={2}
        minZoom={2}
        maxZoom={8}
        style={{ width: '100%', height: '100%', background: '#0a0a1a' }}
        zoomControl={false}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          noWrap={true}
        />
        <ZoomControl position="bottomright" />
        <MapPanController target={panTarget} />

        {/* ── GeoJSON 국가 위험 오버레이 ── */}
        {layers.overlay && geoData && (
          <GeoJsonLayer data={geoData} scoreMap={isoScoreMap} />
        )}

        {/* ── 글로우 레이어 (Insight glow) ── */}
        {layers.threats && scored.filter(h => h.score >= 30).map(h => (
          <Circle key={`glow-${h.id}`}
            center={[h.lat, h.lng]}
            radius={500000}
            pathOptions={{
              color: 'transparent',
              fillColor: scoreToColor(h.score),
              fillOpacity: h.score >= 70 ? 0.15 : h.score >= 45 ? 0.10 : 0.06,
            }}
          />
        ))}

        {/* ── 영향선 (Impact Arcs) — 선택된 핫스팟 ── */}
        {layers.arcs && selectedHotspot && selectedInv && selectedInv.arcsTo.map((target, i) => (
          <Polyline key={`arc-${i}`}
            positions={[[selectedHotspot.lat, selectedHotspot.lng], target]}
            pathOptions={{
              color: scoreToColor(selectedHotspot.score),
              weight: 1.5,
              opacity: 0.7,
              dashArray: '8 5',
            }}
          />
        ))}

        {/* ── 영향 대상 허브 마커 ── */}
        {layers.arcs && selectedHotspot && selectedInv && selectedInv.arcsTo.map((target, i) => (
          <CircleMarker key={`hub-${i}`}
            center={target}
            radius={5}
            pathOptions={{
              color: scoreToColor(selectedHotspot.score),
              fillColor: scoreToColor(selectedHotspot.score),
              fillOpacity: 0.6,
              weight: 1.5,
            }}
          />
        ))}

        {/* ── 위협 핀 ── */}
        {layers.threats && scored.map(h => (
          <CircleMarker key={h.id}
            center={[h.lat, h.lng]}
            radius={h.score >= 70 ? 13 : h.score >= 45 ? 10 : h.score >= 25 ? 7 : 5}
            pathOptions={{
              color: scoreToColor(h.score),
              fillColor: selectedId === h.id ? '#ffffff' : scoreToColor(h.score),
              fillOpacity: selectedId === h.id ? 0.95 : 0.8,
              weight: selectedId === h.id ? 3 : 2,
            }}
            eventHandlers={{
              click: () => {
                setSelectedId(prev => prev === h.id ? null : h.id);
                setSelectedEventId(null);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${scoreToColor(h.score)}44`, fontFamily: 'system-ui', minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: scoreToColor(h.score), flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: '12px' }}>{h.nameKo}</span>
                  <span style={{ fontSize: '11px', color: scoreToColor(h.score), marginLeft: 'auto', fontWeight: 'bold' }}>{Math.round(h.score)}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>위험도 {Math.round(h.score)}/100</div>
                {h.matchedInferences.slice(0, 1).map((inf, i) => (
                  <div key={i} style={{ fontSize: '10px', color: '#94a3b8' }}>· {inf.titleKo}</div>
                ))}
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#475569' }}>클릭 → 투자 시사점</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* ── 뉴스 이벤트 핀 ── */}
        {layers.events && geoEvents
          .filter(ev => {
            if (!activeCategories.has(ev.category)) return false;
            if (severityFilter === 'critical' && ev.severity !== 'critical') return false;
            if (severityFilter === 'high' && ev.severity !== 'critical' && ev.severity !== 'high') return false;
            return true;
          })
          .map(ev => {
          const meta = CATEGORY_META[ev.category] ?? CATEGORY_META.politics;
          const radius = SEV_RADIUS[ev.severity] ?? 7;
          const isSelected = selectedEventId === ev.id;
          return (
            <CircleMarker key={ev.id}
              center={[ev.lat, ev.lng]}
              radius={radius}
              pathOptions={{
                color: meta.color,
                fillColor: isSelected ? '#ffffff' : meta.color,
                fillOpacity: isSelected ? 0.95 : 0.75,
                weight: isSelected ? 3 : 1.5,
                dashArray: ev.category === 'conflict' || ev.category === 'terrorism' ? undefined : '4 3',
              }}
              eventHandlers={{
                click: () => {
                  setSelectedEventId(prev => prev === ev.id ? null : ev.id);
                  setSelectedId(null);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${meta.color}44`, fontFamily: 'system-ui', minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>{meta.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{ev.region}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: meta.color, fontWeight: 600, marginBottom: '2px' }}>{meta.labelKo}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>{ev.titleKo}</div>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#475569' }}>클릭 → 세부정보</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── 반도체 공급망 핀 ── */}
        {layers.semiconductors && SEMI_NODES.map(node => {
          const color = SEMI_ROLE_COLOR[node.role] ?? '#94a3b8';
          return (
            <CircleMarker key={node.symbol}
              center={[node.lat, node.lng]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${color}55`, fontFamily: 'system-ui' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px' }}>{node.nameKo}</div>
                  <div style={{ fontSize: '10px', color, fontWeight: 600 }}>{node.role.toUpperCase()}</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{node.symbol}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── 북한 도발 이력 핀 ── */}
        {layers.nkHistory && NK_EVENTS.map(ev => {
          const color = NK_TYPE_COLOR[ev.type] ?? '#6b7280';
          const radius = ev.severity >= 5 ? 11 : ev.severity === 4 ? 9 : ev.severity === 3 ? 7 : 5;
          return (
            <CircleMarker key={ev.id}
              center={[ev.lat, ev.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2, dashArray: '4 3' }}
              eventHandlers={{
                click: () => setSelectedNkId(prev => prev === ev.id ? null : ev.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${color}55`, fontFamily: 'system-ui', minWidth: '140px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', color, fontWeight: 700 }}>{NK_TYPE_KO[ev.type]}</span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>{ev.date}</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>클릭 → 세부정보</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── VIP 항공기 이동 궤적 ── */}
        {layers.aircraft && Object.entries(aircraftTrails).map(([icao24, trail]) => {
          if (trail.length < 2) return null;
          const ac = liveAircraft.find(a => a.icao24 === icao24);
          const color = AIRCRAFT_CAT_COLOR[ac?.category ?? 'unknown'] ?? '#6b7280';
          return (
            <Polyline
              key={`trail-${icao24}`}
              positions={trail}
              pathOptions={{
                color,
                weight: 1.5,
                opacity: 0.45,
                dashArray: '3 4',
              }}
            />
          );
        })}

        {/* ── VIP 항공기 (실시간 OpenSky Network) ── */}
        {layers.aircraft && liveAircraft.map(ac => {
          const color = AIRCRAFT_CAT_COLOR[ac.category] ?? '#6b7280';
          const icon = makeAircraftIcon(ac.heading, color, ac.isHighAlert);
          return (
            <Marker
              key={ac.icao24}
              position={[ac.lat, ac.lng]}
              icon={icon}
              eventHandlers={{ click: () => setSelectedAircraftId(ac.icao24) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '5px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span style={{ color }}>✈</span> {ac.label}
                  {!ac.onGround && <span style={{ color: '#4ade80', marginLeft: '6px' }}>비행 중</span>}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
        {/* VIP 홈베이스 마커 (비행 미감지 기체 = 지상 대기 표시) */}
        {layers.aircraft && VIP_HOME_BASES.map(base => {
          const isAirborne = liveAircraft.some(a => a.icao24 === base.icao24 && !a.onGround);
          if (isAirborne) return null; // 비행 중이면 위의 Marker가 표시
          const color = AIRCRAFT_CAT_COLOR[base.category] ?? '#6b7280';
          return (
            <CircleMarker
              key={`base-${base.icao24}`}
              center={[base.lat, base.lng]}
              radius={5}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 1.5, dashArray: '3 2' }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>{base.flag}</span> {base.label}
                  <span style={{ color: '#6b7280', marginLeft: '6px' }}>지상 대기</span>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── 해운 항로 ── */}
        {layers.shipping && SHIPPING_ROUTES.map(route => (
          <Polyline key={route.id}
            positions={route.points}
            pathOptions={{ color: '#06b6d4', weight: 1.5, opacity: 0.55, dashArray: '6 4' }}
          >
            <Popup>
              <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                <div style={{ fontSize: '12px', color: '#22d3ee' }}>🚢 {route.name}</div>
              </div>
            </Popup>
          </Polyline>
        ))}
      </MapContainer>

      {/* 레이어 컨트롤 */}
      <LayerControl
        layers={layers}
        onToggle={toggleLayer}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        severityFilter={severityFilter}
        onSeverityChange={setSeverityFilter}
        onFleetToggle={() => setShowFleetOverview(s => !s)}
        showFleet={showFleetOverview}
        aircraftTracked={liveAircraft.length}
        aircraftAirborne={liveAircraft.filter(a => !a.onGround).length}
      />

      {/* 선택된 핫스팟 상세 패널 */}
      {selectedHotspot && (
        <SelectedPanel hotspot={selectedHotspot} onClose={() => setSelectedId(null)} />
      )}

      {/* 뉴스 이벤트 상세 패널 */}
      {selectedEventId && geoEvents.find(e => e.id === selectedEventId) && (
        <EventPanel
          event={geoEvents.find(e => e.id === selectedEventId)!}
          onClose={() => setSelectedEventId(null)}
        />
      )}

      {/* VIP 항공기 상세 패널 */}
      {selectedAircraftId && (() => {
        const ac = liveAircraft.find(a => a.icao24 === selectedAircraftId);
        if (!ac) return null;
        return <VipAircraftPanel ac={ac} onClose={() => setSelectedAircraftId(null)} />;
      })()}

      {/* VIP 플릿 오버뷰 패널 */}
      {layers.aircraft && showFleetOverview && (
        <FleetOverviewPanel
          liveAircraft={liveAircraft}
          onSelect={(id, lat, lng) => {
            if (id) setSelectedAircraftId(id);
            setPanTarget({ lat, lng, zoom: 6 });
            // 플릿 패널 유지 — 계속 탐색 가능
          }}
          onClose={() => setShowFleetOverview(false)}
        />
      )}

      {/* NK 도발 세부 패널 */}
      {selectedNkId && (() => {
        const ev = NK_EVENTS.find(e => e.id === selectedNkId);
        if (!ev) return null;
        const color = NK_TYPE_COLOR[ev.type] ?? '#6b7280';
        return (
          <DraggablePanel className="absolute top-16 left-64 z-[1000] w-72">
            <div className="bg-black/90 backdrop-blur-md border rounded-lg overflow-hidden shadow-2xl relative"
              style={{ borderColor: color + '55' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b"
                style={{ borderColor: color + '33', background: color + '15' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color }}>⚡ {NK_TYPE_KO[ev.type]}</span>
                  <span className="text-xs text-gray-400">{ev.date}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded font-bold"
                    style={{ background: color + '30', color }}>
                    {'⭐'.repeat(Math.min(ev.severity, 5))}
                  </span>
                </div>
                <button onClick={() => setSelectedNkId(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-bold text-white leading-tight">{ev.title}</p>
                <p className="text-xs text-gray-300 leading-relaxed">{ev.desc}</p>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
                  <p className="text-[10px] text-yellow-400 font-semibold mb-1">📊 시장 반응 패턴</p>
                  <p className="text-xs text-gray-400">미사일 발사 당일 코스피 평균 -0.8%. 방산주 +3~8%. 3일내 대부분 회복.</p>
                </div>
              </div>
            </div>
          </DraggablePanel>
        );
      })()}

      {/* 범례 */}
      <div className="absolute bottom-10 left-3 z-[1000] text-xs space-y-1 bg-black/80 backdrop-blur-sm rounded p-2.5 border border-white/10">
        <div className="text-gray-400 font-semibold mb-2">위협 지수</div>
        {[['#ef4444', '위험 (>70)'], ['#f97316', '경계 (45-70)'], ['#eab308', '주의 (25-45)'], ['#22c55e', '안전 (<25)']] .map(([c, l]) => (
          <div key={l as string} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />
            <span className="text-gray-300">{l as string}</span>
          </div>
        ))}
        <div className="text-gray-500 mt-2 mb-1 text-[11px] pt-2 border-t border-white/10">이벤트 카테고리</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {Object.values(CATEGORY_META).map(meta => (
            <div key={meta.labelKo} className="flex items-center gap-1">
              <span style={{ color: meta.color }}>{meta.icon}</span>
              <span className="text-[10px] text-gray-400">{meta.labelKo}</span>
            </div>
          ))}
        </div>
        <div className="text-gray-600 mt-2 text-xs pt-2 border-t border-white/10">마우스오버: 지역/분야 · 클릭: 세부정보</div>
      </div>

      {/* 상단 힌트 (GeoJSON 로딩 중) */}
      {layers.overlay && !geoData && (
        <div className="absolute top-3 right-3 z-[1000] text-xs text-gray-500 bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-gray-700">
          🗺 지도 오버레이 로딩 중...
        </div>
      )}
    </div>
  );
}
