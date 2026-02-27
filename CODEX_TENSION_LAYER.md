# Task: Military Tension Score Layer

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Compute a "military tension score" (0–100) for each geopolitical hotspot region by synthesizing
existing data layers: geo-events, VIP military aircraft positions, shipping chokepoint stress.
Visualize this as a semi-transparent pulsing heat overlay on the map.

No new external API required — uses only data already in the app.

## Files to Edit

1. `src-react/src/aip/WorldMapView.tsx` — add tension layer

Only this file. Do not touch anything else.

---

## What to build

### A) Tension Score Computation

Add a pure function `computeTensionZones` outside the component:

```typescript
interface TensionZone {
  id: string;
  lat: number;
  lng: number;
  region: string;
  score: number;          // 0-100
  level: 'extreme' | 'high' | 'elevated' | 'moderate';
  drivers: string[];      // what's driving the score
}

function computeTensionZones(
  geoEvents: GeoEvent[],
  liveAircraft: VipAircraft[],
): TensionZone[] {
  // Fixed hotspot anchors with base scores (geopolitically known tension points)
  const HOTSPOTS = [
    { id: 'iran',          lat: 32.4,  lng: 53.7,  region: '이란',        base: 30 },
    { id: 'taiwan_strait', lat: 24.0,  lng: 121.5, region: '대만해협',    base: 25 },
    { id: 'ukraine',       lat: 49.0,  lng: 31.5,  region: '우크라이나',  base: 20 },
    { id: 'korean_pen',    lat: 38.3,  lng: 127.8, region: '한반도',      base: 15 },
    { id: 'south_china',   lat: 14.0,  lng: 114.0, region: '남중국해',    base: 15 },
    { id: 'middle_east',   lat: 31.5,  lng: 35.5,  region: '중동',        base: 20 },
    { id: 'strait_hormuz', lat: 26.5,  lng: 56.5,  region: '호르무즈',    base: 20 },
  ];

  return HOTSPOTS.map(hs => {
    let score = hs.base;
    const drivers: string[] = [];

    // +20 for each critical geo-event within 10° radius
    const nearEvents = geoEvents.filter(ev => {
      const dist = Math.sqrt(Math.pow(ev.lat - hs.lat, 2) + Math.pow(ev.lng - hs.lng, 2));
      return dist < 10;
    });
    const criticalNear = nearEvents.filter(ev => ev.severity === 'critical');
    const highNear = nearEvents.filter(ev => ev.severity === 'high');
    if (criticalNear.length > 0) {
      score += criticalNear.length * 20;
      drivers.push(`🔴 위기 이벤트 ${criticalNear.length}건`);
    }
    if (highNear.length > 0) {
      score += highNear.length * 10;
      drivers.push(`🟠 고위험 이벤트 ${highNear.length}건`);
    }

    // +15 for each military aircraft within 12° radius (airborne only)
    const nearMilitary = liveAircraft.filter(ac => {
      if (ac.onGround) return false;
      const isMilitary = ac.category === 'military_recon' || ac.category === 'military_command' || ac.category === 'military_bomber';
      if (!isMilitary) return false;
      const dist = Math.sqrt(Math.pow(ac.lat - hs.lat, 2) + Math.pow(ac.lng - hs.lng, 2));
      return dist < 12;
    });
    if (nearMilitary.length > 0) {
      score += nearMilitary.length * 15;
      drivers.push(`✈️ 군용기 ${nearMilitary.length}대`);
    }

    // Cap at 95
    score = Math.min(95, score);

    const level: TensionZone['level'] =
      score >= 70 ? 'extreme' :
      score >= 50 ? 'high' :
      score >= 30 ? 'elevated' : 'moderate';

    return { id: hs.id, lat: hs.lat, lng: hs.lng, region: hs.region, score, level, drivers };
  }).filter(z => z.score > 0);
}
```

### B) Add LayerState

Add `tension: false` to the `LayerState` interface and initial state.

### C) Add layer button to controls

In the layer controls area, add a new button:
```tsx
<button
  onClick={() => toggleLayer('tension' as keyof LayerState)}
  title="군사 긴장 지수"
  style={{
    background: layers.tension ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${layers.tension ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
    color: layers.tension ? '#fca5a5' : '#94a3b8',
    borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 13,
  }}
>
  🌡️
</button>
```

### D) Compute tension zones in component

Inside the WorldMapView component, after the convergenceZones useMemo, add:
```typescript
const tensionZones = React.useMemo(
  () => computeTensionZones(geoEvents, liveAircraft),
  [geoEvents, liveAircraft]
);
```

### E) Render tension layer inside MapContainer

Add BEFORE convergence zone markers:

```tsx
{/* ── 군사 긴장 지수 레이어 ── */}
{layers.tension && tensionZones.map(zone => {
  const LEVEL_COLOR = {
    extreme:  '#ef4444',
    high:     '#f97316',
    elevated: '#f59e0b',
    moderate: '#84cc16',
  };
  const color = LEVEL_COLOR[zone.level];
  // Outer glow ring (large, transparent)
  const outerRadius = zone.level === 'extreme' ? 80 : zone.level === 'high' ? 65 : zone.level === 'elevated' ? 50 : 40;
  const innerRadius = zone.level === 'extreme' ? 30 : zone.level === 'high' ? 24 : 18;

  return (
    <React.Fragment key={zone.id}>
      {/* Outer glow */}
      <CircleMarker
        center={[zone.lat, zone.lng]}
        radius={outerRadius}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.04,
          weight: 0,
          opacity: 0,
        }}
        interactive={false}
      />
      {/* Mid ring */}
      <CircleMarker
        center={[zone.lat, zone.lng]}
        radius={outerRadius * 0.6}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.07,
          weight: 1,
          opacity: 0.3,
          dashArray: '3 5',
        }}
        interactive={false}
      />
      {/* Inner core */}
      <CircleMarker
        center={[zone.lat, zone.lng]}
        radius={innerRadius}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
          opacity: 0.8,
        }}
      >
        <Tooltip direction="top" offset={[0, -innerRadius - 4]} opacity={1}>
          <div style={{
            background: '#0f172a', color: '#f1f5f9', padding: '8px 10px',
            borderRadius: 8, border: `1px solid ${color}55`, fontFamily: 'system-ui',
            minWidth: 160,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 13 }}>🌡️</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{zone.region}</span>
              <span style={{
                marginLeft: 'auto', fontSize: 13, fontWeight: 900,
                color, fontFamily: 'monospace',
              }}>{zone.score}</span>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color,
              padding: '2px 6px', background: `${color}22`, borderRadius: 3,
              display: 'inline-block', marginBottom: 5,
            }}>
              {zone.level === 'extreme' ? '🔴 극도 긴장' :
               zone.level === 'high' ? '🟠 고위험' :
               zone.level === 'elevated' ? '🟡 긴장 고조' : '🟢 주의'}
            </div>
            {zone.drivers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {zone.drivers.map((d, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#94a3b8' }}>· {d}</div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>

      {/* Score label at center */}
      {zone.level === 'extreme' || zone.level === 'high' ? (
        <Tooltip
          position={[zone.lat, zone.lng]}
          permanent
          direction="center"
          opacity={1}
          className="tension-label"
        >
          <div style={{
            background: 'transparent', border: 'none',
            color, fontWeight: 900, fontSize: 11, fontFamily: 'monospace',
            textShadow: '0 0 4px #000',
            pointerEvents: 'none',
          }}>
            {zone.score}
          </div>
        </Tooltip>
      ) : null}
    </React.Fragment>
  );
})}
```

### F) Add tension layer legend

Add a small legend near the layer controls when tension layer is active:
```tsx
{layers.tension && (
  <div style={{
    position: 'absolute', bottom: 8, left: 8, zIndex: 1000,
    background: 'rgba(10,15,30,0.9)', border: '1px solid #334155',
    borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#94a3b8',
  }}>
    <div style={{ fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>🌡️ 군사 긴장 지수</div>
    {[
      { label: '극도 긴장', color: '#ef4444', range: '70+' },
      { label: '고위험',    color: '#f97316', range: '50-69' },
      { label: '긴장 고조', color: '#f59e0b', range: '30-49' },
      { label: '주의',      color: '#84cc16', range: '<30' },
    ].map(item => (
      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
        <span>{item.label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: item.color }}>{item.range}</span>
      </div>
    ))}
  </div>
)}
```

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -20
```

Fix TypeScript errors. Commit:
`feat: 군사 긴장 지수 레이어 (🌡️) — 지역별 0-100 실시간 스코어`

Then run:
```
openclaw system event --text "Done: Military tension score layer complete" --mode now
```
