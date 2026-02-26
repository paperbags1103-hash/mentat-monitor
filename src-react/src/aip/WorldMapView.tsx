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
  Popup, ZoomControl, Polyline, GeoJSON, useMap,
} from 'react-leaflet';
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
  tickers: string[];
  implication: string;
  arcsTo: [number, number][];  // [lat, lng][] — 영향받는 금융 허브들
  isoCountries: string[];     // ISO_A2 코드 — 오버레이 강조
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
    tickers: ['한화에어로스페이스', 'LIG넥스원', '삼성전자'],
    implication: '북한 도발 시 방산주 급등 + 코스피 외국인 이탈 반복 패턴. 단기 헤지: KODEX 인버스.',
    arcsTo: [[35.6762, 139.6503], [1.3521, 103.8198]],
    isoCountries: ['KP', 'KR'],
  },
  taiwan_strait: {
    sectors: ['반도체', 'IT부품', '해운'],
    tickers: ['삼성전자', 'SK하이닉스', 'HMM'],
    implication: '대만 긴장 격화 시 TSMC 대체 수혜 vs. 공급망 차질 이중 효과. 엔화 강세 연동.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503], [1.3521, 103.8198]],
    isoCountries: ['TW', 'CN'],
  },
  middle_east: {
    sectors: ['에너지', '항공', '화학'],
    tickers: ['S-Oil', '대한항공', 'LG화학'],
    implication: '중동 불안 → 유가 상승 → 정유사 마진 개선, 항공주 비용 부담. 원화 약세 압력.',
    arcsTo: [[37.5665, 126.9780], [28.6139, 77.2090]],
    isoCountries: ['IL', 'IR', 'SA', 'YE', 'SY', 'IQ'],
  },
  ukraine: {
    sectors: ['곡물', '에너지', '철강'],
    tickers: ['POSCO홀딩스', 'CJ제일제당', '대한항공'],
    implication: '전쟁 장기화 시 원자재 가격 구조적 상승 → 철강·식품 원가 부담 지속.',
    arcsTo: [[37.5665, 126.9780], [40.7128, -74.0060]],
    isoCountries: ['UA', 'RU'],
  },
  south_china_sea: {
    sectors: ['해운', '반도체', '무역'],
    tickers: ['HMM', '팬오션', '삼성전자'],
    implication: '남중국해 분쟁 시 물류비 급등 + 한국 수출 차질. 해운주 단기 수혜 후 리스크.',
    arcsTo: [[37.5665, 126.9780], [1.3521, 103.8198]],
    isoCountries: ['CN', 'PH', 'VN'],
  },
  iran: {
    sectors: ['에너지', '해운', '화학'],
    tickers: ['S-Oil', 'GS에너지', 'HMM'],
    implication: '호르무즈 봉쇄 리스크 시 한국 원유 수입 70%+ 차질. WTI +20% 시나리오.',
    arcsTo: [[37.5665, 126.9780], [22.3964, 114.1095]],
    isoCountries: ['IR'],
  },
  north_korea: {
    sectors: ['방산', 'ETF', '반도체'],
    tickers: ['한화에어로스페이스', '현대로템', 'KODEX 200'],
    implication: '미사일 발사 당일 코스피 평균 -0.8%. 방산주 +3~8%. 3일내 대부분 회복.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503]],
    isoCountries: ['KP'],
  },
  new_york: {
    sectors: ['금융', '기술주', '환율'],
    tickers: ['미래에셋증권', '삼성자산운용', 'TIGER 미국나스닥100'],
    implication: '연준 금리 결정 → 달러/원 직접 연동. 금리 인상 시 외국인 코스피 순매도 패턴.',
    arcsTo: [[37.5665, 126.9780], [51.5074, -0.1278]],
    isoCountries: ['US'],
  },
  beijing: {
    sectors: ['철강', '화학', '배터리'],
    tickers: ['POSCO홀딩스', 'LG에너지솔루션', 'SK이노베이션'],
    implication: '중국 부양책 시 철강·화학 수혜. 기술패권 충돌 심화 시 배터리 공급망 우려.',
    arcsTo: [[37.5665, 126.9780], [35.6762, 139.6503]],
    isoCountries: ['CN'],
  },
  moscow: {
    sectors: ['에너지', '곡물', '방산'],
    tickers: ['한화에어로스페이스', 'POSCO홀딩스', 'CJ제일제당'],
    implication: '러 제재 확대 → 유럽 에너지 가격 재상승 → LNG 관련주 간접 수혜.',
    arcsTo: [[37.5665, 126.9780], [51.5074, -0.1278]],
    isoCountries: ['RU'],
  },
  hormuz: {
    sectors: ['에너지', '해운', '화학'],
    tickers: ['S-Oil', 'GS칼텍스', 'HMM'],
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

// ─── VIP 항공기 ───────────────────────────────────────────────────────────────
const VIP_AIRCRAFT = [
  { id: 'a1', lat: 51.5074,  lng: -0.1278,  label: 'VIP-01 (런던 상공)',   callsign: 'VIP001' },
  { id: 'a2', lat: 35.6762,  lng: 139.6503, label: 'VIP-02 (도쿄 상공)',   callsign: 'VIP002' },
  { id: 'a3', lat: 40.7128,  lng: -74.0060, label: 'VIP-03 (뉴욕 상공)',   callsign: 'VIP003' },
  { id: 'a4', lat: 48.8566,  lng: 2.3522,   label: 'VIP-04 (파리 상공)',   callsign: 'VIP004' },
  { id: 'a5', lat: 25.2048,  lng: 55.2708,  label: 'VIP-05 (두바이 상공)', callsign: 'VIP005' },
  { id: 'a6', lat: 37.5665,  lng: 126.9780, label: 'VIP-06 (서울 상공)',   callsign: 'VIP006' },
];

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
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require('leaflet');
    layerRef.current = L.geoJSON(data, { style: styleFunc, interactive: false });
    layerRef.current.addTo(map);
    return () => { layerRef.current?.remove(); };
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
}

function LayerControl({ layers, onToggle }: {
  layers: LayerState;
  onToggle: (key: keyof LayerState) => void;
}) {
  const btns: { key: keyof LayerState; label: string; active: string }[] = [
    { key: 'threats',  label: '🎯 위협 핀',      active: 'text-red-400 border-red-500/50 bg-red-500/20' },
    { key: 'overlay',  label: '🗺 국가 오버레이', active: 'text-amber-400 border-amber-500/50 bg-amber-500/20' },
    { key: 'arcs',     label: '⚡ 영향선',       active: 'text-purple-400 border-purple-500/50 bg-purple-500/20' },
    { key: 'aircraft', label: '✈ VIP 항공기',    active: 'text-blue-400 border-blue-500/50 bg-blue-500/20' },
    { key: 'shipping', label: '🚢 해운 항로',     active: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/20' },
  ];
  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
      {btns.map(b => (
        <button key={b.key} onClick={() => onToggle(b.key)}
          className={`text-xs px-2.5 py-1 rounded border font-semibold transition-all backdrop-blur-sm ${
            layers[b.key] ? b.active : 'text-gray-500 border-gray-700 bg-black/60 hover:text-gray-300'
          }`}>
          {b.label}
        </button>
      ))}
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
    <div className="absolute bottom-12 right-3 z-[1000] w-72 bg-black/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-2xl"
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

            {/* Tickers */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">관련 종목</div>
              <div className="flex flex-wrap gap-1">
                {inv.tickers.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded border font-mono" style={{ borderColor: color + '60', color, background: color + '12' }}>{t}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
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
  });

  // 선택된 핫스팟
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // GeoJSON 데이터 (CDN 로드)
  const [geoData, setGeoData] = useState<any>(null);

  // GeoJSON 로드
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => { /* GeoJSON 없어도 동작 — 핀만 표시 */ });
  }, []);

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
              click: () => setSelectedId(prev => prev === h.id ? null : h.id),
            }}
          >
            <Popup>
              <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', minWidth: '200px', fontFamily: 'monospace' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: scoreToColor(h.score), flexShrink: 0 }} />
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{h.nameKo}</span>
                  <span style={{ fontSize: '11px', color: scoreToColor(h.score), marginLeft: 'auto' }}>{Math.round(h.score)}/100</span>
                </div>
                {h.matchedInferences.slice(0, 2).map((inf, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>
                    · {severityKo(inf.severity)} {inf.titleKo}
                  </div>
                ))}
                {h.matchedInferences.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#475569' }}>활성 위협 없음</div>
                )}
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '6px' }}>
                  ↙ 클릭하면 투자 시사점 패널 표시
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* ── VIP 항공기 ── */}
        {layers.aircraft && VIP_AIRCRAFT.map(ac => (
          <CircleMarker key={ac.id}
            center={[ac.lat, ac.lng]}
            radius={6}
            pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.9, weight: 1 }}
          >
            <Popup>
              <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '8px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                <div style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '12px' }}>✈ {ac.callsign}</div>
                <div style={{ fontSize: '11px', marginTop: '3px', color: '#94a3b8' }}>{ac.label}</div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>ADSBExchange 연동 예정</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

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
      <LayerControl layers={layers} onToggle={toggleLayer} />

      {/* 선택된 핫스팟 상세 패널 */}
      {selectedHotspot && (
        <SelectedPanel hotspot={selectedHotspot} onClose={() => setSelectedId(null)} />
      )}

      {/* 범례 */}
      <div className="absolute bottom-10 left-3 z-[1000] text-xs space-y-1 bg-black/80 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
        <div className="text-gray-400 font-semibold mb-2">위협 지수</div>
        {[['#ef4444', '위험 (>70)'], ['#f97316', '경계 (45-70)'], ['#eab308', '주의 (25-45)'], ['#22c55e', '안전 (<25)']] .map(([c, l]) => (
          <div key={l as string} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />
            <span className="text-gray-300">{l as string}</span>
          </div>
        ))}
        <div className="text-gray-600 mt-2 text-xs pt-2 border-t border-white/10">핀 클릭 → 투자 시사점</div>
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
