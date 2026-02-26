# Task: Breaking News Badges + Aircraft Photos

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Two improvements to the existing map features:

1. **Breaking News Badges**: Critical geo-events get a "BREAKING" visual treatment + live headline ticker at map top
2. **Aircraft Photos**: When a VIP aircraft panel opens, fetch a real photo of that aircraft from Planespotters.net

## Files to Edit

1. `src-react/src/aip/WorldMapView.tsx` — main changes
2. `api/geo-events.js` — add urgency scoring so critical events are marked as "breaking"

Do NOT touch any other files.

---

## PART 1: Breaking News Badges on Geo-Event Markers

### A) What "breaking" means

An event is "breaking" if it meets ANY of these in `geo-events.js`:
- Groq assigns `severity: "critical"`
- Event was published within the last 2 hours (based on `pubDate` if available)

In `geo-events.js`, add `breaking: true` to events where `severity === 'critical'`. Already done if severity is correctly set — just need to pass it through to the client.

Actually: modify the returned event object to include `breaking: boolean`:
```js
breaking: item.severity === 'critical'
```

### B) In `WorldMapView.tsx` — visual treatment

Currently geo-events are rendered as CircleMarker. For `breaking: true` events:

1. Add an **outer animated ring** — a larger CircleMarker with dashed border and high opacity:
```tsx
{ev.breaking && (
  <CircleMarker
    center={[ev.lat, ev.lng]}
    radius={16}
    pathOptions={{
      color: '#ef4444',
      fillColor: 'transparent',
      fillOpacity: 0,
      weight: 2,
      opacity: 0.7,
      dashArray: '3 3',
    }}
  />
)}
```

2. Add a **"BREAKING" label** in the Tooltip header:
```tsx
{ev.breaking && <span style={{ color: '#ef4444', fontWeight: 900, fontSize: 9, letterSpacing: 1 }}>● BREAKING</span>}
```

### C) Breaking News Ticker

Add a scrolling ticker bar at the TOP of the map (inside the map container wrapper div, above `<MapContainer>`):

```tsx
{/* ── Breaking News Ticker ── */}
{(() => {
  const breakingEvents = geoEvents.filter(ev => (ev as any).breaking || ev.severity === 'critical');
  if (breakingEvents.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
      background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.4)',
      display: 'flex', alignItems: 'center', overflow: 'hidden', height: 28,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        flexShrink: 0, background: '#ef4444', color: 'white',
        padding: '0 10px', height: '100%', display: 'flex', alignItems: 'center',
        fontSize: 10, fontWeight: 900, letterSpacing: 1,
      }}>
        ⚡ BREAKING
      </div>
      <div style={{
        flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 24,
      }}>
        {breakingEvents.slice(0, 3).map((ev, i) => (
          <span key={ev.id} style={{ fontSize: 11, color: '#fca5a5', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {i > 0 && <span style={{ color: '#ef4444', marginRight: 24 }}>·</span>}
            📍 {ev.region} — {ev.titleKo}
          </span>
        ))}
      </div>
    </div>
  );
})()}
```

Make sure the map container has `position: 'relative'` wrapper.

---

## PART 2: Aircraft Photos via Planespotters.net

### A) Add registration field to AIRCRAFT_LABELS in `api/vip-aircraft.js`

Look at the existing `AIRCRAFT_LABELS` array. Each entry has `icao24`, `label`, `category`, `investmentSignalKo`, etc.

Add a `reg` field to CEO/VIP aircraft entries (registration number):

```js
// Elon Musk jets
{ icao24: 'a6395a', reg: 'N628TS', label: 'Elon Musk G650ER', ... }
{ icao24: 'a835af', reg: 'N272BG', label: 'Elon Musk G550', ... }
// Bill Gates
{ icao24: 'a4b5cb', reg: 'N887WM', label: 'Bill Gates G650ER', ... }
// Military aircraft: use tail number where publicly known
// For military aircraft without public registration, leave reg undefined
```

Also include `reg` in the returned aircraft objects (pass it through).

### B) In `WorldMapView.tsx` — add photo to VipAircraftPanel

The `VipAircraftPanel` component shows info when you click an aircraft marker.

Add photo fetching:

```typescript
const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
const [photoLoading, setPhotoLoading] = React.useState(false);

React.useEffect(() => {
  if (!aircraft.reg) return;
  setPhotoLoading(true);
  fetch(`https://api.planespotters.net/pub/photos/reg/${aircraft.reg}`)
    .then(r => r.json())
    .then(data => {
      const photo = data.photos?.[0];
      if (photo?.thumbnail_large?.src) {
        setPhotoUrl(photo.thumbnail_large.src);
      } else if (photo?.thumbnail?.src) {
        setPhotoUrl(photo.thumbnail.src);
      }
    })
    .catch(() => {})
    .finally(() => setPhotoLoading(false));
}, [aircraft.reg]);
```

Add to the panel JSX, ABOVE the investment signal text:

```tsx
{/* Aircraft Photo */}
{photoLoading && (
  <div style={{ height: 120, background: '#1e293b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
    <span style={{ fontSize: 11, color: '#475569' }}>사진 로딩 중...</span>
  </div>
)}
{photoUrl && !photoLoading && (
  <div style={{ marginBottom: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid #334155' }}>
    <img
      src={photoUrl}
      alt={aircraft.label}
      style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
      onError={() => setPhotoUrl(null)}
    />
    <div style={{ padding: '4px 8px', background: '#0f172a', fontSize: 9, color: '#475569' }}>
      Photo: Planespotters.net
    </div>
  </div>
)}
{!photoUrl && !photoLoading && aircraft.reg && (
  <div style={{ height: 60, background: '#0f172a', borderRadius: 6, border: '1px dashed #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
    <span style={{ fontSize: 11, color: '#475569' }}>✈️ {aircraft.reg} · 사진 없음</span>
  </div>
)}
```

Also show `aircraft.reg` in the panel header if available:
```tsx
{aircraft.reg && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#60a5fa' }}>{aircraft.reg}</span>}
```

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -30
```

Fix TypeScript errors. Commit:
`feat: BREAKING 뱃지 + 항공기 사진 (Planespotters.net)`

Then run:
```
openclaw system event --text "Done: Breaking news badges and aircraft photos complete" --mode now
```
