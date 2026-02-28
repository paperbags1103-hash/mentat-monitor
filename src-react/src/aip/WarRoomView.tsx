/**
 * WarRoomView — 이란-이스라엘 전황 실시간 관제실  v2
 *
 * 군사 작전 센터(NORAD) 스타일 · Phase 1+2 구현
 * - 3D 지형 + 군사기지 마커 + 미사일 사거리 원 + 해협 글로우
 * - BREAKING 오버레이 · Market Impact 연쇄 패널 · 유가 ticker
 * - 데이터 신선도 heartbeat dots
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

/* ── 원형 폴리곤 생성 ───────────────────────────────────────────────── */
function circlePoly(lng: number, lat: number, radiusKm: number, sides = 48): number[][] {
  return Array.from({ length: sides + 1 }, (_, i) => {
    const a = (i * 2 * Math.PI) / sides;
    return [lng + (radiusKm / 111 / Math.cos(lat * Math.PI / 180)) * Math.sin(a),
            lat + (radiusKm / 111) * Math.cos(a)];
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

  useEffect(() => {
    dataRef.current = { siteScores, meAcled, meFirms, meQuakes, meAircraft };
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
    const acft = { type: 'FeatureCollection' as const, features: d.meAircraft.map(a => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] }, properties: { callsign: a.callsign } })) };
    return { columns, fires, conflicts, seismic, acft };
  }

  function updateDynamicLayers() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded?.()) return;
    try {
      const { columns, fires, conflicts, seismic, acft } = buildDynGeoJSON();
      const pairs: [string, any][] = [
        ['wr-columns', columns], ['wr-fires', fires], ['wr-conflicts', conflicts],
        ['wr-seismic', seismic], ['wr-aircraft', acft],
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
          sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'], tileSize: 256, attribution: '© CartoDB' } },
          layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto' }],
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

        /* ── OpenSky ── */
        map.addSource('wr-aircraft', { type: 'geojson', data: acft });
        map.addLayer({ id: 'wr-aircraft-dot', type: 'circle', source: 'wr-aircraft', paint: { 'circle-radius': 4, 'circle-color': '#3b82f6', 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#93c5fd' } });

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
  const [oil,       setOil]       = useState<Oil|null>(null);
  const [loading,   setLoading]   = useState(true);
  const [breaking,  setBreaking]  = useState<FeedItem|null>(null);
  const [breakAnim, setBreakAnim] = useState<'in'|'out'>('in');
  const [freshness, setFreshness] = useState<Record<string,number>>({});
  const [tick,      setTick]      = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevCritRef = useRef<Set<string>>(new Set());

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
        prevCritRef.current = new Set(items.map(i=>i.id));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const id=setInterval(loadAll, 5*60_000); return ()=>clearInterval(id); }, [loadAll]);
  useEffect(() => { const id=setInterval(()=>setTick(t=>t+1), 1000); return ()=>clearInterval(id); }, []);

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
  const threatScore = useMemo(()=>calcThreat(acled,quakes,firms,aircraft),[acled,quakes,firms,aircraft]);
  const threat = threatMeta(threatScore);

  const siteScores = useMemo(()=>THREAT_SITES.map(site=>({
    ...site,
    score: Math.min(99, site.base
      + meFirms.filter(f=>Math.abs(f.lat-site.lat)<2&&Math.abs(f.lng-site.lng)<2).length*3
      + meAcled.filter(e=>Math.abs(e.lat-site.lat)<1.5&&Math.abs(e.lng-site.lng)<1.5).length*5),
  })), [meFirms, meAcled]);

  /* 활성 Market Impact 체인 */
  const activeChains = useMemo(()=>{
    const allText = feed.map(f=>`${f.title} ${f.region}`).join(' ');
    return MARKET_CHAINS.filter(c=>c.keywords.some(k=>allText.toLowerCase().includes(k.toLowerCase())));
  }, [feed]);

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

        {/* 군용 시각 */}
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#00d4ff', letterSpacing:2, textShadow:'0 0 6px #00d4ff66' }}>{milTime}</div>
          <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:1 }}>UTC · {loading?'동기화 중...':'데이터 최신'}</div>
        </div>
      </div>

      {/* ── 메인 2분할 ── */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* ──────── LEFT: 전술 지도 ──────── */}
        <div style={{ flex:'0 0 57%', position:'relative', borderRight:'1px solid #0a3050' }}>
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
            {[['🔴','GDELT'],['🟠','USGS'],['🔥','FIRMS'],['✈','항공기'],['▲','군사기지'],['◈','핵시설'],['〇','미사일사거리'],['~','해협']].map(([i,l])=>(
              <span key={l as string}>{i} {l}</span>
            ))}
          </div>
        </div>

        {/* ──────── RIGHT: 인텔 대시보드 ──────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#050f1a', minHeight:0, overflow:'hidden' }}>

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

          {/* Market Impact 연쇄 패널 */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid #0a1f2f', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4a7a9b', letterSpacing:2, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
              ▸ CONFLICT → MARKET IMPACT
              {activeChains.length > 0 && <span style={{ fontSize:9, color:'#ef4444', fontWeight:700 }}>⚡ {activeChains.length}개 트리거 활성</span>}
            </div>
            {MARKET_CHAINS.map(chain=>{
              const active = activeChains.some(c=>c.id===chain.id);
              return (
                <div key={chain.id} style={{ marginBottom:8, padding:'6px 8px', borderRadius:2, border:`1px solid ${active?'#ef444444':'#0a1f2f'}`, background:active?'#ef444408':'transparent', transition:'all 0.5s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:12 }}>{chain.icon}</span>
                    <span style={{ fontSize:10, fontWeight:700, color: active?'#ef4444':'#8aa3ba' }}>{chain.title}</span>
                    <span style={{ marginLeft:'auto', fontSize:9, color: chain.dir==='up'?'#22c55e':'#ef4444', fontWeight:700 }}>{chain.asset} {chain.dir==='up'?'▲':'▼'}{chain.est}</span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {chain.stocks.map(s=>(
                      <span key={s.name} style={{ fontSize:9, padding:'1px 6px', borderRadius:1, background: s.dir==='↑'?'#14532d44':'#7f1d1d44', color: s.dir==='↑'?'#4ade80':'#f87171', border:`1px solid ${s.dir==='↑'?'#16a34a33':'#dc262633'}` }}>
                        {s.dir} {s.name} <span style={{ opacity:0.6 }}>({s.reason})</span>
                      </span>
                    ))}
                  </div>
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
