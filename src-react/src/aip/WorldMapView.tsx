/**
 * WorldMapView — Leaflet 세계 지도 + 지정학 위협 레이어
 * 레이어 토글: 위협 핀 / VIP 항공기 / 해운 항로 / Mentat 인사이트
 */
import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, ZoomControl, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store';

// ── 지정학 핫스팟 ─────────────────────────────────────────────────────────────
const HOTSPOTS = [
  { id: 'korean_peninsula', lat: 37.5665,  lng: 126.9780, nameKo: '한반도',     entityIds: ['region:korean_peninsula', 'country:north_korea', 'country:south_korea'] },
  { id: 'taiwan_strait',    lat: 24.0,     lng: 121.0,    nameKo: '대만해협',   entityIds: ['region:taiwan_strait', 'country:taiwan'] },
  { id: 'middle_east',      lat: 31.7683,  lng: 35.2137,  nameKo: '중동',       entityIds: ['region:middle_east', 'country:israel'] },
  { id: 'ukraine',          lat: 50.4501,  lng: 30.5234,  nameKo: '우크라이나', entityIds: ['region:europe', 'country:russia', 'country:ukraine'] },
  { id: 'south_china_sea',  lat: 15.0,     lng: 114.0,    nameKo: '남중국해',   entityIds: ['country:china', 'region:east_asia'] },
  { id: 'iran',             lat: 35.6892,  lng: 51.3890,  nameKo: '이란',       entityIds: ['country:iran'] },
  { id: 'north_korea',      lat: 39.0392,  lng: 125.7625, nameKo: '북한',       entityIds: ['country:north_korea'] },
  { id: 'new_york',         lat: 40.7128,  lng: -74.0060, nameKo: '미국 금융',  entityIds: ['country:usa', 'financial'] },
  { id: 'beijing',          lat: 39.9042,  lng: 116.4074, nameKo: '중국',       entityIds: ['country:china'] },
  { id: 'moscow',           lat: 55.7558,  lng: 37.6173,  nameKo: '러시아',     entityIds: ['country:russia'] },
  { id: 'hormuz',           lat: 26.5000,  lng: 56.2500,  nameKo: '호르무즈해협', entityIds: ['region:middle_east', 'country:iran'] },
];

// ── VIP 항공기 (플레이스홀더) ─────────────────────────────────────────────────
const VIP_AIRCRAFT = [
  { id: 'a1', lat: 51.5074,  lng: -0.1278,  label: 'VIP-01 (런던 상공)',      callsign: 'VIP001' },
  { id: 'a2', lat: 35.6762,  lng: 139.6503, label: 'VIP-02 (도쿄 상공)',      callsign: 'VIP002' },
  { id: 'a3', lat: 40.7128,  lng: -74.0060, label: 'VIP-03 (뉴욕 상공)',      callsign: 'VIP003' },
  { id: 'a4', lat: 48.8566,  lng: 2.3522,   label: 'VIP-04 (파리 상공)',      callsign: 'VIP004' },
  { id: 'a5', lat: 25.2048,  lng: 55.2708,  label: 'VIP-05 (두바이 상공)',    callsign: 'VIP005' },
  { id: 'a6', lat: 37.5665,  lng: 126.9780, label: 'VIP-06 (서울 상공)',      callsign: 'VIP006' },
];

// ── 해운 항로 ─────────────────────────────────────────────────────────────────
const SHIPPING_ROUTES = [
  { id: 'asia-europe', name: '아시아-유럽', points: [[1.3, 103.8], [12.5, 44.0], [30, 32.5], [37, 15], [51.9, 4.4]] as [number,number][] },
  { id: 'trans-pacific', name: '태평양 횡단', points: [[31.2, 121.4], [37.8, 144.9], [34.0, -118.2]] as [number,number][] },
  { id: 'us-europe', name: '대서양', points: [[40.7, -74.0], [51.5, -8.0], [51.9, 4.4]] as [number,number][] },
  { id: 'south-china', name: '남중국해', points: [[22.3, 114.2], [1.3, 103.8], [15.0, 108.0]] as [number,number][] },
];

function scoreHotspot(
  hotspot: typeof HOTSPOTS[0],
  inferences: Array<{ severity: string; affectedEntityIds?: string[] }>,
  globalRiskScore: number
) {
  let score = globalRiskScore * 0.3;
  inferences.forEach(inf => {
    const match = inf.affectedEntityIds?.some(id => hotspot.entityIds.includes(id));
    if (match) {
      score += inf.severity === 'CRITICAL' ? 40 : inf.severity === 'ELEVATED' ? 25 : inf.severity === 'WATCH' ? 10 : 5;
    }
  });
  return Math.min(100, score);
}

function scoreToColor(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 45) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

// ── 레이어 토글 버튼 ─────────────────────────────────────────────────────────
interface LayerState {
  threats: boolean;
  insight: boolean;
  aircraft: boolean;
  shipping: boolean;
}

function LayerControl({ layers, onToggle }: {
  layers: LayerState;
  onToggle: (key: keyof LayerState) => void;
}) {
  const btns: { key: keyof LayerState; label: string; color: string }[] = [
    { key: 'threats',  label: '🎯 위협 핀',  color: 'text-red-400 border-red-500/50 bg-red-500/20' },
    { key: 'insight',  label: '🧠 인사이트', color: 'text-purple-400 border-purple-500/50 bg-purple-500/20' },
    { key: 'aircraft', label: '✈ VIP 항공기', color: 'text-blue-400 border-blue-500/50 bg-blue-500/20' },
    { key: 'shipping', label: '🚢 해운 항로', color: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/20' },
  ];
  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
      {btns.map(b => (
        <button key={b.key} onClick={() => onToggle(b.key)}
          className={`text-xs px-2 py-1 rounded border font-semibold transition-all backdrop-blur-sm ${
            layers[b.key] ? b.color : 'text-gray-500 border-gray-700 bg-black/60 hover:text-gray-300'
          }`}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function WorldMapView() {
  const { briefing, globalRiskScore } = useStore();
  const inferences = briefing?.topInferences ?? [];

  const [layers, setLayers] = useState<LayerState>({
    threats: true,
    insight: true,
    aircraft: false,
    shipping: false,
  });

  function toggleLayer(key: keyof LayerState) {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const scored = HOTSPOTS.map(h => ({
    ...h,
    score: scoreHotspot(h, inferences, globalRiskScore),
  }));

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

        {/* ── Mentat 인사이트 글로우 레이어 ── */}
        {layers.insight && scored.filter(h => h.score >= 30).map(h => (
          <Circle key={`glow-${h.id}`}
            center={[h.lat, h.lng]}
            radius={400000}
            pathOptions={{
              color: 'transparent',
              fillColor: scoreToColor(h.score),
              fillOpacity: h.score >= 70 ? 0.18 : h.score >= 45 ? 0.12 : 0.07,
            }}
          />
        ))}

        {/* ── 위협 핀 ── */}
        {layers.threats && scored.map(h => (
          <CircleMarker key={h.id}
            center={[h.lat, h.lng]}
            radius={h.score >= 70 ? 12 : h.score >= 45 ? 9 : h.score >= 25 ? 7 : 5}
            pathOptions={{
              color: scoreToColor(h.score),
              fillColor: scoreToColor(h.score),
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ background: '#1a1a2e', color: '#f1f5f9', padding: '8px', borderRadius: '4px', minWidth: '160px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{h.nameKo}</div>
                <div style={{ fontSize: '11px', color: scoreToColor(h.score) }}>
                  위협 지수: {Math.round(h.score)}/100
                </div>
                {inferences
                  .filter(inf => inf.affectedEntityIds?.some(id => h.entityIds.includes(id)))
                  .slice(0, 2)
                  .map((inf, i) => (
                    <div key={i} style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                      · {(inf as { titleKo?: string }).titleKo ?? inf.severity}
                    </div>
                  ))
                }
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
              <div style={{ background: '#1a1a2e', color: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#60a5fa' }}>✈ {ac.callsign}</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>{ac.label}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                  실시간 연동 예정 (ADSBExchange API)
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* ── 해운 항로 ── */}
        {layers.shipping && SHIPPING_ROUTES.map(route => (
          <Polyline key={route.id}
            positions={route.points}
            pathOptions={{ color: '#06b6d4', weight: 1.5, opacity: 0.6, dashArray: '6 4' }}
          >
            <Popup>
              <div style={{ background: '#1a1a2e', color: '#f1f5f9', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', color: '#22d3ee' }}>🚢 {route.name}</div>
              </div>
            </Popup>
          </Polyline>
        ))}
      </MapContainer>

      {/* 레이어 컨트롤 */}
      <LayerControl layers={layers} onToggle={toggleLayer} />

      {/* 범례 */}
      <div className="absolute bottom-10 left-3 z-[1000] text-xs space-y-1 bg-black/70 backdrop-blur-sm rounded-lg p-2 border border-white/10">
        <div className="text-gray-400 font-semibold mb-1">위협 지수</div>
        {[['#ef4444', '위험 (>70)'], ['#f97316', '경계 (45-70)'], ['#eab308', '주의 (25-45)'], ['#22c55e', '안전 (<25)']] .map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            <span className="text-gray-300">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
