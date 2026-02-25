/**
 * WorldMapView — Leaflet 세계 지도 + 지정학 위협 핀
 * Dark tile: CartoDB Dark Matter
 * Pins: 인퍼런스 기반 지역 위협 오버레이
 */
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store';

// Known geopolitical hotspots
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
];

// Score hotspot by matching inferences
function scoreHotspot(
  hotspot: typeof HOTSPOTS[0],
  inferences: Array<{ severity: string; affectedEntityIds?: string[] }>,
  globalRiskScore: number
) {
  let score = globalRiskScore * 0.3; // base
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

export function WorldMapView() {
  const { briefing, globalRiskScore } = useStore();
  const inferences = briefing?.topInferences ?? [];

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={8}
        zoomControl={false}
        style={{ width: '100%', height: '100%', background: '#0a0a0f' }}
        attributionControl={false}
      >
        {/* Dark tile */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />
        <ZoomControl position="bottomright" />

        {/* Hotspot pins */}
        {HOTSPOTS.map(spot => {
          const score = scoreHotspot(spot, inferences, globalRiskScore);
          const color = scoreToColor(score);
          const radius = 6 + (score / 100) * 12;
          const relInfs = inferences.filter(i => i.affectedEntityIds?.some(id => spot.entityIds.includes(id)));

          return (
            <CircleMarker
              key={spot.id}
              center={[spot.lat, spot.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: score >= 60 ? 2 : 1,
              }}
            >
              <Popup className="mentat-popup">
                <div style={{ minWidth: 160, fontFamily: 'monospace' }}>
                  <div style={{ fontWeight: 'bold', color, marginBottom: 4 }}>{spot.nameKo}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>위협 지수: {Math.round(score)}</div>
                  {relInfs.map((inf, i) => (
                    <div key={i} style={{ color: '#f1f5f9', fontSize: 11, marginTop: 4, borderLeft: `2px solid ${color}`, paddingLeft: 6 }}>
                      {inf.titleKo ?? inf.severity}
                    </div>
                  ))}
                  {relInfs.length === 0 && (
                    <div style={{ color: '#475569', fontSize: 11 }}>활성 인퍼런스 없음</div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Overlay legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-black/70 rounded-lg p-2.5 text-xs space-y-1">
        {[['위험 (>70)', '#ef4444'], ['경계 (45-70)', '#f97316'], ['주의 (25-45)', '#eab308'], ['안정 (<25)', '#22c55e']].map(([l, c]) => (
          <div key={l} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            <span className="text-secondary">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
