# Task: ACLED Armed Conflict Data Layer

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

ACLED (Armed Conflict Location & Event Data) provides real-time armed conflict events
with precise GPS coordinates, event type, fatalities, and actors involved.
This is FAR more accurate than RSS for actual military/conflict events.

## Files to Create/Edit

1. `api/acled-events.js` — CREATE: Vercel Edge function wrapping ACLED API
2. `src-react/src/aip/WorldMapView.tsx` — ADD ACLED event markers layer

## PART 1: `api/acled-events.js`

```js
/**
 * /api/acled-events
 *
 * Fetches recent armed conflict events from ACLED API.
 * Returns events from the last 30 days, filtered to high-impact.
 * Cache: 30 minutes.
 *
 * ACLED API docs: https://apidocs.acleddata.com/
 * Requires: ACLED_API_KEY + ACLED_EMAIL environment variables.
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 30 * 60_000;
let cache = null;
let cacheTs = 0;

// Event type → category mapping
const EVENT_TYPE_MAP = {
  'Battles': 'conflict',
  'Explosions/Remote violence': 'conflict',
  'Violence against civilians': 'conflict',
  'Protests': 'social',
  'Riots': 'social',
  'Strategic developments': 'politics',
};

// Severity based on event type + fatalities
function getSeverity(eventType, fatalities) {
  const fat = parseInt(fatalities) || 0;
  if (eventType === 'Battles' || eventType === 'Explosions/Remote violence') {
    if (fat >= 10) return 'critical';
    if (fat >= 1) return 'high';
    return 'high';
  }
  if (eventType === 'Violence against civilians') {
    if (fat >= 5) return 'critical';
    return 'high';
  }
  if (fat >= 20) return 'high';
  return 'medium';
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = process.env.ACLED_API_KEY || req.headers.get('x-acled-key') || '';
  const apiEmail = process.env.ACLED_EMAIL || req.headers.get('x-acled-email') || '';

  if (!apiKey || !apiEmail) {
    return new Response(JSON.stringify({ events: [], error: 'ACLED credentials not configured' }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL) {
    return new Response(JSON.stringify({ ...cache, cached: true }), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
    });
  }

  // Get events from last 30 days
  const endDate = new Date();
  const startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const params = new URLSearchParams({
    key: apiKey,
    email: apiEmail,
    event_date: `${formatDate(startDate)}|${formatDate(endDate)}`,
    event_date_where: 'BETWEEN',
    event_type: 'Battles:Explosions/Remote violence:Violence against civilians',
    fields: 'event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|country|location|latitude|longitude|fatalities|notes',
    limit: '100',
    order: 'event_date',
    orderby: 'DESC',
  });

  try {
    const res = await fetch(`https://api.acleddata.com/acled/read?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`ACLED ${res.status}`);
    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) throw new Error('Unexpected ACLED response');

    const events = data.data.map(ev => {
      const lat = parseFloat(ev.latitude);
      const lng = parseFloat(ev.longitude);
      const fatalities = parseInt(ev.fatalities) || 0;
      const eventType = ev.event_type || '';
      const severity = getSeverity(eventType, fatalities);
      const category = EVENT_TYPE_MAP[eventType] || 'conflict';

      return {
        id: `acled-${ev.event_id_cnty}`,
        lat,
        lng,
        region: `${ev.location}, ${ev.country}`,
        country: ev.country,
        category,
        severity,
        eventType,
        subEventType: ev.sub_event_type,
        actors: [ev.actor1, ev.actor2].filter(Boolean).join(' vs '),
        fatalities,
        date: ev.event_date,
        notes: (ev.notes || '').slice(0, 200),
        titleKo: `${ev.location}: ${ev.event_type}${fatalities > 0 ? ` (사망 ${fatalities}명)` : ''}`,
        source: 'ACLED',
      };
    }).filter(ev => !isNaN(ev.lat) && !isNaN(ev.lng));

    const result = {
      events,
      fetchedAt: new Date().toISOString(),
      count: events.length,
      cached: false,
    };

    cache = result;
    cacheTs = now;

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ events: [], error: err.message }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
```

## PART 2: Add ACLED layer to `WorldMapView.tsx`

### A) Add to LayerState

Add `acled: false` to `LayerState` interface and initial state.

### B) Add state for ACLED events

```typescript
const [acledEvents, setAcledEvents] = useState<any[]>([]);
const [acledLoaded, setAcledLoaded] = useState(false);
```

### C) Fetch ACLED events when layer is toggled on

In a useEffect watching `layers.acled`:
```typescript
useEffect(() => {
  if (!layers.acled || acledLoaded) return;
  apiFetch<{ events: any[] }>('/api/acled-events')
    .then(data => {
      setAcledEvents(data.events || []);
      setAcledLoaded(true);
    })
    .catch(() => setAcledLoaded(true));
}, [layers.acled]);
```

### D) Add layer button

```tsx
<button
  onClick={() => toggleLayer('acled' as keyof LayerState)}
  title="ACLED 무력충돌 데이터"
  style={{
    background: layers.acled ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${layers.acled ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
    color: layers.acled ? '#fca5a5' : '#94a3b8',
    borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 13,
  }}
>
  ⚔️
</button>
```

### E) Render ACLED events in MapContainer

Add after geo-events markers:
```tsx
{/* ── ACLED 무력충돌 레이어 ── */}
{layers.acled && acledEvents.map(ev => {
  const SEV_COLOR: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#65a30d',
  };
  const color = SEV_COLOR[ev.severity] ?? '#94a3b8';
  const radius = ev.severity === 'critical' ? 8 : ev.severity === 'high' ? 6 : 5;

  return (
    <CircleMarker
      key={ev.id}
      center={[ev.lat, ev.lng]}
      radius={radius}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1.5,
      }}
    >
      <Tooltip direction="top" offset={[0, -radius - 4]} opacity={1}>
        <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '8px 10px', borderRadius: 8, border: `1px solid ${color}55`, fontFamily: 'system-ui', maxWidth: 240 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12 }}>⚔️</span>
            <span style={{ fontWeight: 700, fontSize: 11 }}>{ev.region}</span>
          </div>
          <div style={{ fontSize: 11, color: color, fontWeight: 600, marginBottom: 3 }}>{ev.eventType}</div>
          {ev.actors && <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{ev.actors}</div>}
          {ev.fatalities > 0 && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>사망 {ev.fatalities}명</div>}
          <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>{ev.date} · ACLED</div>
          {ev.notes && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{ev.notes.slice(0, 100)}{ev.notes.length > 100 ? '...' : ''}</div>}
        </div>
      </Tooltip>
    </CircleMarker>
  );
})}
```

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -20
```

Fix TypeScript errors. Commit:
`feat: ACLED 무력충돌 데이터 레이어 (⚔️) — 30일 실제 교전/폭발 이벤트`

Then run:
```
openclaw system event --text "Done: ACLED armed conflict layer complete" --mode now
```
