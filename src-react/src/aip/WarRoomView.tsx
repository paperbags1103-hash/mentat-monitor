/**
 * WarRoomView — 이란-이스라엘 전황 실시간 관제실
 *
 * 군사 작전 센터(NORAD/펜타곤) 스타일 실시간 분쟁 모니터링
 * GDELT + USGS + FIRMS + OpenSky + GDACS 통합
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '@/store';
import 'leaflet/dist/leaflet.css';

/* ── 중동 감시 구역 (이란-이스라엘 회랑) ────────────────────────────── */
const BBOX = { s: 24, n: 40, w: 29, e: 66 };
const inBBOX = (lat: number, lng: number) =>
  lat >= BBOX.s && lat <= BBOX.n && lng >= BBOX.w && lng <= BBOX.e;

/* ── 영공 구역 정의 ──────────────────────────────────────────────────── */
const AIRSPACE_ZONES = [
  { name: '이란',      lat: [24,40], lng: [44,64], flag: '🇮🇷' },
  { name: '이스라엘',  lat: [29,34], lng: [34,36], flag: '🇮🇱' },
  { name: '레바논',    lat: [33,35], lng: [35,37], flag: '🇱🇧' },
  { name: '이라크',    lat: [29,38], lng: [38,49], flag: '🇮🇶' },
  { name: '요르단',    lat: [29,33], lng: [34,39], flag: '🇯🇴' },
];

/* ── 위협 레벨 계산 ──────────────────────────────────────────────────── */
function calcThreat(acled: any[], quakes: any[], firms: any[], aircraft: any[]) {
  let score = 0;
  acled.forEach(e => {
    if (!inBBOX(e.lat, e.lng)) return;
    score += e.severity === 'critical' ? 14 : e.severity === 'high' ? 7 : 2;
  });
  quakes.filter(q => q.isSuspect && inBBOX(q.lat, q.lng)).forEach(() => { score += 22; });
  const meFires = firms.filter(f => inBBOX(f.lat, f.lng)).length;
  score += meFires > 50 ? 20 : meFires > 20 ? 12 : meFires > 5 ? 5 : 0;
  const meAircraft = aircraft.filter(a => inBBOX(a.lat, a.lng)).length;
  score += meAircraft < 3 ? 30 : meAircraft < 10 ? 15 : meAircraft < 20 ? 5 : 0;
  return Math.min(100, score);
}

function threatMeta(score: number) {
  if (score >= 85) return { label: 'DEFCON 1', color: '#ff073a', glow: '#ff073a', flash: true };
  if (score >= 65) return { label: 'CRITICAL',  color: '#ef4444', glow: '#ef4444', flash: true };
  if (score >= 45) return { label: 'HIGH',      color: '#f97316', glow: '#f97316', flash: false };
  if (score >= 25) return { label: 'ELEVATED',  color: '#fbbf24', glow: '#fbbf24', flash: false };
  return                   { label: 'NORMAL',   color: '#00ff88', glow: '#00ff88', flash: false };
}

function airspaceStatus(aircraft: any[], zone: typeof AIRSPACE_ZONES[0]) {
  const count = aircraft.filter(a =>
    a.lat >= zone.lat[0] && a.lat <= zone.lat[1] &&
    a.lng >= zone.lng[0] && a.lng <= zone.lng[1]
  ).length;
  if (count === 0) return { status: '폐쇄', color: '#ef4444', icon: '⛔' };
  if (count < 5)   return { status: '제한', color: '#f97316', icon: '⚠️' };
  return               { status: '정상', color: '#00ff88', icon: '✅' };
}

/* ── 이벤트 피드 아이템 타입 ────────────────────────────────────────── */
interface FeedItem {
  id: string; time: string; icon: string;
  title: string; region: string; severity: string; source: string;
  lat?: number; lng?: number;
}

/* ── CSS ────────────────────────────────────────────────────────────── */
const CSS = `
@keyframes wr-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes wr-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes wr-pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6), inset 0 0 0 1px rgba(239,68,68,0.8); }
  50%      { box-shadow: 0 0 20px 4px rgba(239,68,68,0.3), inset 0 0 0 1px rgba(239,68,68,1); }
}
@keyframes wr-slide-in {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes wr-scan {
  from { background-position: 0 0; }
  to   { background-position: 0 100%; }
}
@keyframes wr-count-up {
  0%   { opacity: 0.3; transform: translateY(4px); }
  100% { opacity: 1;   transform: translateY(0); }
}
.wr-blink   { animation: wr-blink 1.1s step-start infinite; }
.wr-threat-flash { animation: wr-pulse-border 1.2s ease-in-out infinite; }
.wr-feed-item { animation: wr-slide-in 0.35s ease-out; }
.wr-count    { animation: wr-count-up 0.5s ease-out; }
`;

/* ── 주요 위협 지점 ─────────────────────────────────────────────────── */
const THREAT_SITES = [
  { name: '나탄즈 핵시설', lat: 33.72, lng: 51.73, base: 35 },
  { name: '포르도 시설',   lat: 34.89, lng: 49.21, base: 28 },
  { name: '이스파한',      lat: 32.65, lng: 51.67, base: 25 },
  { name: '테헤란',        lat: 35.69, lng: 51.39, base: 20 },
  { name: '텔아비브',      lat: 32.08, lng: 34.78, base: 18 },
  { name: '하이파',        lat: 32.82, lng: 34.99, base: 15 },
  { name: '베이루트',      lat: 33.89, lng: 35.50, base: 22 },
  { name: '바그다드',      lat: 33.34, lng: 44.44, base: 12 },
];

export function WarRoomView() {
  const [acled,    setAcled]    = useState<any[]>([]);
  const [quakes,   setQuakes]   = useState<any[]>([]);
  const [firms,    setFirms]    = useState<any[]>([]);
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [gdacs,    setGdacs]    = useState<any[]>([]);
  const [feed,     setFeed]     = useState<FeedItem[]>([]);
  const [tick,     setTick]     = useState(0);   // clock refresh
  const [loading,  setLoading]  = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  /* ── 데이터 로드 ── */
  const loadAll = async () => {
    setLoading(true);
    try {
      const [a, q, f, o, g] = await Promise.allSettled([
        apiFetch<any>('/api/acled-events'),
        apiFetch<any>('/api/usgs-quakes'),
        apiFetch<any>('/api/firms-fires'),
        apiFetch<any>('/api/opensky-aircraft'),
        apiFetch<any>('/api/gdacs-alerts'),
      ]);
      const aData = a.status === 'fulfilled' ? (a.value?.events ?? []) : [];
      const qData = q.status === 'fulfilled' ? (q.value?.events ?? []) : [];
      const fData = f.status === 'fulfilled' ? (f.value?.events ?? []) : [];
      const oData = o.status === 'fulfilled' ? (o.value?.aircraft ?? []) : [];
      const gData = g.status === 'fulfilled' ? (g.value?.events ?? []) : [];

      setAcled(aData);
      setQuakes(qData);
      setFirms(fData);
      setAircraft(oData);
      setGdacs(gData);

      /* 이벤트 피드 합산 */
      const feedItems: FeedItem[] = [
        ...aData.filter((e: any) => inBBOX(e.lat, e.lng)).map((e: any) => ({
          id: e.id, time: e.date || '', icon: '⚔️',
          title: e.eventType || '전투', region: e.region || e.country,
          severity: e.severity, source: 'GDELT', lat: e.lat, lng: e.lng,
        })),
        ...qData.filter((e: any) => e.isSuspect && inBBOX(e.lat, e.lng)).map((e: any) => ({
          id: e.id, time: new Date(e.time).toISOString(),
          icon: '🌋', title: `M${e.magnitude} 이상진동`, region: e.place,
          severity: e.severity, source: 'USGS', lat: e.lat, lng: e.lng,
        })),
        ...gData.filter((e: any) => inBBOX(e.lat, e.lng)).map((e: any) => ({
          id: e.id, time: e.date || '', icon: '🚨',
          title: e.eventType, region: e.country,
          severity: e.severity, source: 'GDACS', lat: e.lat, lng: e.lng,
        })),
        ...fData.filter((e: any) => inBBOX(e.lat, e.lng) && e.frp > 20).map((e: any) => ({
          id: e.id, time: `${e.date} ${e.time}`, icon: '🔥',
          title: `화재 ${e.frp}MW`, region: e.zone,
          severity: e.severity, source: 'FIRMS', lat: e.lat, lng: e.lng,
        })),
      ].sort((a, b) => b.time.localeCompare(a.time));

      setFeed(feedItems.slice(0, 80));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const id = setInterval(() => { loadAll(); }, 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── 계산값 ── */
  const meAcled    = useMemo(() => acled.filter(e => inBBOX(e.lat, e.lng)), [acled]);
  const meFirms    = useMemo(() => firms.filter(e => inBBOX(e.lat, e.lng)), [firms]);
  const meQuakes   = useMemo(() => quakes.filter(q => inBBOX(q.lat, q.lng) && q.isSuspect), [quakes]);
  const meAircraft = useMemo(() => aircraft.filter(a => inBBOX(a.lat, a.lng)), [aircraft]);
  const threatScore = useMemo(() => calcThreat(acled, quakes, firms, aircraft), [acled, quakes, firms, aircraft]);
  const threat = threatMeta(threatScore);

  /* 위협 지점별 스코어 */
  const siteScores = useMemo(() => THREAT_SITES.map(site => {
    const nearFires  = meFirms.filter(f => Math.abs(f.lat - site.lat) < 2 && Math.abs(f.lng - site.lng) < 2).length;
    const nearAcled  = meAcled.filter(e => Math.abs(e.lat - site.lat) < 1.5 && Math.abs(e.lng - site.lng) < 1.5).length;
    const score = Math.min(99, site.base + nearFires * 3 + nearAcled * 5);
    return { ...site, score };
  }), [meFirms, meAcled]);

  const now = new Date();
  const milTime = `${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}Z`;

  const SEV_COLOR: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#fbbf24', low: '#22c55e',
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#000810', display: 'flex', flexDirection: 'column', fontFamily: "'Courier New', monospace", overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>

      {/* ── 최상단 헤더 바 ── */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
        background: '#020c18', borderBottom: '1px solid #0a3050',
        flexShrink: 0,
      }}>
        {/* 시스템 ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00d4ff' }}>
          <span className="wr-blink" style={{ color: '#ef4444', fontSize: 10 }}>◉</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#00d4ff', textShadow: '0 0 8px #00d4ff88' }}>
            CONFLICT WATCH SYSTEM
          </span>
          <span style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2 }}>// IRAN-ISRAEL CORRIDOR</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* 위협 레벨 */}
        <div
          className={threat.flash ? 'wr-threat-flash' : ''}
          style={{
            padding: '3px 14px', borderRadius: 2, border: `1px solid ${threat.color}`,
            background: `${threat.color}18`, display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2 }}>THREAT</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: threat.color, letterSpacing: 2, textShadow: `0 0 10px ${threat.glow}` }}>
            {threat.label}
          </span>
          <div style={{ width: 60, height: 6, background: '#0a1f2f', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              width: `${threatScore}%`, height: '100%', background: threat.color,
              boxShadow: `0 0 6px ${threat.color}`,
              transition: 'width 1s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: threat.color, fontWeight: 700 }}>{threatScore}</span>
        </div>

        {/* 활성 인시던트 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 12px', border: '1px solid #1a3a4a', borderRadius: 2, background: '#020c18' }}>
          <span style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2 }}>INCIDENTS</span>
          <span className="wr-count" style={{ fontSize: 16, fontWeight: 900, color: '#ef4444', textShadow: '0 0 8px #ef4444' }}>
            {meAcled.length + meQuakes.length}
          </span>
        </div>

        {/* 군용 시각 */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00d4ff', letterSpacing: 2, textShadow: '0 0 6px #00d4ff66' }}>
            {milTime}
          </div>
          <div style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 1 }}>UTC · {loading ? '동기화 중...' : '데이터 최신'}</div>
        </div>
      </div>

      {/* ── 메인 2분할 ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ──────── LEFT: 전술 지도 ──────── */}
        <div style={{ flex: '0 0 55%', position: 'relative', borderRight: '1px solid #0a3050' }}>

          {/* 지도 레이블 */}
          <div style={{
            position: 'absolute', top: 8, left: 8, zIndex: 1000,
            fontSize: 9, color: '#00d4ff88', letterSpacing: 3, fontWeight: 700,
          }}>
            TACTICAL MAP // IRAN-ISRAEL
          </div>
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 1000,
            fontSize: 9, color: '#4a7a9b', letterSpacing: 1,
          }}>
            ZOOM 5 · {(BBOX.n - BBOX.s) * 111 | 0}KM × {(BBOX.e - BBOX.w) * 88 | 0}KM
          </div>

          {/* CRT 스캔라인 오버레이 */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 999, pointerEvents: 'none',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
          }} />

          {/* 레이더 스윕 오버레이 */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 998, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '140%', paddingBottom: '140%',
              background: 'conic-gradient(from -5deg, transparent 0deg, rgba(0,255,136,0.07) 20deg, transparent 25deg)',
              animation: 'wr-sweep 6s linear infinite',
              borderRadius: '50%',
              position: 'absolute',
            }} />
          </div>

          {/* 지도 */}
          <MapContainer
            center={[32.5, 46]}
            zoom={5}
            minZoom={4}
            maxZoom={9}
            zoomControl={false}
            style={{ width: '100%', height: '100%', background: '#000810' }}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution=""
            />

            {/* FIRMS 화재 */}
            {meFirms.map((ev: any) => {
              const intensity = Math.min(1, ev.frp / 150);
              const r = Math.round(255);
              const g = Math.round(30 + (1 - intensity) * 100);
              return (
                <CircleMarker key={ev.id} center={[ev.lat, ev.lng]}
                  radius={Math.max(3, Math.min(7, 2 + ev.frp / 50))}
                  pathOptions={{ color: `rgb(${r},${g},0)`, fillColor: `rgb(${r},${g},0)`, fillOpacity: 0.9, weight: 0.5 }}>
                  <Tooltip direction="top" opacity={1}>
                    <div style={{ background: '#000810', color: '#fca5a5', padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                      🔥 {ev.zone} · {ev.frp}MW
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

            {/* GDELT 이벤트 */}
            {meAcled.map((ev: any) => {
              const color = SEV_COLOR[ev.severity] ?? '#94a3b8';
              const r = ev.severity === 'critical' ? 9 : ev.severity === 'high' ? 7 : 5;
              return (
                <React.Fragment key={ev.id}>
                  {ev.isRecent && (
                    <CircleMarker center={[ev.lat, ev.lng]} radius={r + 8}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 0.8, dashArray: '3 2' }} />
                  )}
                  <CircleMarker center={[ev.lat, ev.lng]} radius={r}
                    pathOptions={{ color, fillColor: color, fillOpacity: ev.isRecent ? 0.95 : 0.75, weight: 1.5 }}>
                    <Tooltip direction="top" opacity={1}>
                      <div style={{ background: '#000810', color: '#e2e8f0', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, maxWidth: 220, border: `1px solid ${color}44` }}>
                        <div style={{ color, fontWeight: 700 }}>{ev.eventType}</div>
                        <div>{ev.region}</div>
                        {ev.actors && <div style={{ color: '#4a7a9b', fontSize: 10 }}>{ev.actors}</div>}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                </React.Fragment>
              );
            })}

            {/* USGS 이상 지진 */}
            {meQuakes.map((q: any) => (
              <React.Fragment key={q.id}>
                <CircleMarker center={[q.lat, q.lng]} radius={12}
                  pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.07, weight: 1, dashArray: '4 3' }} />
                <CircleMarker center={[q.lat, q.lng]} radius={5}
                  pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.85, weight: 1.5 }}>
                  <Tooltip direction="top" opacity={1}>
                    <div style={{ background: '#000810', color: '#fed7aa', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                      🌋 M{q.magnitude} · 깊이{q.depth}km<br/>
                      <span style={{ color: '#f97316', fontWeight: 700 }}>⚠️ {q.zone}</span>
                    </div>
                  </Tooltip>
                </CircleMarker>
              </React.Fragment>
            ))}

            {/* OpenSky 항공기 */}
            {meAircraft.map((ac: any) => {
              const icon = L.divIcon({
                html: `<div style="transform:rotate(${ac.heading}deg);font-size:11px;color:#3b82f6;filter:drop-shadow(0 0 3px #3b82f6);line-height:1">✈</div>`,
                className: '', iconSize: [14, 14], iconAnchor: [7, 7],
              });
              return (
                <Marker key={`wr-os-${ac.icao24}`} position={[ac.lat, ac.lng]} icon={icon}>
                  <Tooltip direction="top" opacity={1}>
                    <div style={{ background: '#000810', color: '#93c5fd', padding: '4px 8px', fontFamily: 'monospace', fontSize: 10 }}>
                      ✈ {ac.callsign || ac.icao24} · {ac.country}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}

            {/* 주요 위협 지점 레이블 */}
            {siteScores.filter(s => s.score > 25).map(site => {
              const icon = L.divIcon({
                html: `<div style="color:#f97316;font-size:9px;font-family:monospace;white-space:nowrap;text-shadow:0 0 6px #f97316;pointer-events:none">◈ ${site.name}</div>`,
                className: '', iconSize: [100, 14], iconAnchor: [0, 7],
              });
              return <Marker key={`site-${site.name}`} position={[site.lat + 0.4, site.lng]} icon={icon} interactive={false} />;
            })}
          </MapContainer>

          {/* 지도 하단 레전드 */}
          <div style={{
            position: 'absolute', bottom: 8, left: 8, zIndex: 1000,
            background: 'rgba(0,8,16,0.8)', border: '1px solid #0a3050',
            borderRadius: 3, padding: '5px 10px', fontSize: 9, color: '#4a7a9b',
            display: 'flex', gap: 12,
          }}>
            {[['🔴','GDELT 분쟁'],['🟠','이상진동'],['🔥','위성화재'],['✈','항공기']].map(([icon, label]) => (
              <span key={label as string}>{icon} {label}</span>
            ))}
          </div>
        </div>

        {/* ──────── RIGHT: 인텔 대시보드 ──────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050f1a', minHeight: 0 }}>

          {/* 상단 스탯 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#0a1f2f', padding: 1, flexShrink: 0 }}>
            {[
              { label: 'INCIDENTS', val: meAcled.length + meQuakes.length, color: '#ef4444', icon: '⚔️' },
              { label: 'AIRCRAFT',  val: meAircraft.length,                color: '#3b82f6', icon: '✈️' },
              { label: 'FIRE SITES',val: meFirms.length,                   color: '#f97316', icon: '🔥' },
              { label: 'SEISMIC',   val: meQuakes.length,                  color: '#fbbf24', icon: '🌋' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#050f1a', padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2, marginBottom: 4 }}>{stat.icon} {stat.label}</div>
                <div className="wr-count" style={{ fontSize: 28, fontWeight: 900, color: stat.color, textShadow: `0 0 12px ${stat.color}66`, lineHeight: 1 }}>
                  {stat.val}
                </div>
              </div>
            ))}
          </div>

          {/* 영공 현황 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #0a1f2f', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2, marginBottom: 6 }}>▸ AIRSPACE STATUS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {AIRSPACE_ZONES.map(zone => {
                const { status, color, icon } = airspaceStatus(aircraft, zone);
                return (
                  <div key={zone.name} style={{
                    padding: '3px 8px', border: `1px solid ${color}55`, borderRadius: 2,
                    background: `${color}08`, display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ fontSize: 11 }}>{zone.flag}</span>
                    <span style={{ fontSize: 9, color: '#c0d8e8' }}>{zone.name}</span>
                    <span style={{ fontSize: 9 }}>{icon}</span>
                    <span style={{ fontSize: 9, color, fontWeight: 700 }}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 위협 지점 바 차트 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #0a1f2f', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2, marginBottom: 6 }}>▸ THREAT SITE INDEX</div>
            {siteScores.sort((a, b) => b.score - a.score).slice(0, 5).map(site => {
              const color = site.score > 70 ? '#ef4444' : site.score > 45 ? '#f97316' : '#fbbf24';
              return (
                <div key={site.name} style={{ marginBottom: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: '#c0d8e8' }}>{site.name}</span>
                    <span style={{ fontSize: 9, color, fontWeight: 700 }}>{site.score}</span>
                  </div>
                  <div style={{ height: 4, background: '#0a1f2f', borderRadius: 1, overflow: 'hidden' }}>
                    <div style={{
                      width: `${site.score}%`, height: '100%', background: color,
                      boxShadow: `0 0 4px ${color}`,
                      transition: 'width 1.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 이벤트 피드 */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid #0a1f2f', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 2 }}>▸ INTEL FEED</span>
              <span className="wr-blink" style={{ fontSize: 9, color: '#ef4444', letterSpacing: 1 }}>● LIVE</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#4a7a9b' }}>{feed.length} 이벤트</span>
            </div>
            <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '0 2px' }}>
              {feed.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#4a7a9b', fontSize: 11 }}>
                  {loading ? '인텔 수집 중...' : '감지된 이벤트 없음'}
                </div>
              )}
              {feed.map((item, idx) => {
                const sevColor = SEV_COLOR[item.severity] ?? '#94a3b8';
                return (
                  <div key={item.id} className="wr-feed-item" style={{
                    padding: '7px 12px', borderBottom: '1px solid #07131e',
                    borderLeft: `2px solid ${sevColor}`,
                    background: idx === 0 ? `${sevColor}08` : 'transparent',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${sevColor}0f`)}
                    onMouseLeave={e => (e.currentTarget.style.background = idx === 0 ? `${sevColor}08` : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 9, color: '#4a7a9b', flexShrink: 0 }}>{item.source}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#8aa3ba' }}>{item.region}</span>
                      <span style={{ fontSize: 9, color: sevColor, fontWeight: 700 }}>{item.severity?.toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 상태바 */}
          <div style={{
            height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16,
            borderTop: '1px solid #0a1f2f', background: '#020c18', flexShrink: 0,
          }}>
            <span className="wr-blink" style={{ fontSize: 8, color: '#00ff88' }}>●</span>
            <span style={{ fontSize: 9, color: '#4a7a9b', letterSpacing: 1 }}>GDELT · USGS · FIRMS · OPENSKY · GDACS</span>
            <span style={{ marginLeft: 'auto', fontSize: 9, color: '#4a7a9b' }}>5분 자동갱신</span>
          </div>
        </div>
      </div>
    </div>
  );
}
