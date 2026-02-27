/**
 * /api/acled-events
 *
 * Fetches recent armed conflict events from ACLED API.
 * Uses key+email query-param authentication (programmatic method).
 * Cache: 30 minutes.
 *
 * Required env vars:
 *   ACLED_API_KEY  — API key from developer.acleddata.com
 *   ACLED_EMAIL    — myACLED account email
 */
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 30 * 60_000;
let cache = null;
let cacheTs = 0;

const EVENT_TYPE_MAP = {
  'Battles': 'conflict',
  'Explosions/Remote violence': 'conflict',
  'Violence against civilians': 'conflict',
  'Protests': 'social',
  'Riots': 'social',
  'Strategic developments': 'politics',
};

function getSeverity(eventType, fatalities) {
  const fat = parseInt(fatalities) || 0;
  if (eventType === 'Battles' || eventType === 'Explosions/Remote violence') {
    return fat >= 10 ? 'critical' : 'high';
  }
  if (eventType === 'Violence against civilians') {
    return fat >= 5 ? 'critical' : 'high';
  }
  return fat >= 20 ? 'high' : 'medium';
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = process.env.ACLED_API_KEY || '';
  const email  = process.env.ACLED_EMAIL    || '';

  if (!apiKey || !email) {
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

  try {
    const endDate   = new Date();
    const startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const params = new URLSearchParams({
      key:              apiKey,
      email:            email,
      event_date:       `${fmt(startDate)}|${fmt(endDate)}`,
      event_date_where: 'BETWEEN',
      event_type:       'Battles:Explosions/Remote violence:Violence against civilians',
      fields:           'event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|country|location|latitude|longitude|fatalities|notes',
      limit:            '100',
      order:            'event_date',
      orderby:          'DESC',
    });

    const res = await fetch(`https://api.acleddata.com/acled/read?${params}`, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'mentat-monitor/1.0 (research)',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`ACLED ${res.status}: ${errBody.slice(0, 150)}`);
    }

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error(`Unexpected ACLED format: ${JSON.stringify(data).slice(0, 100)}`);
    }

    const events = data.data.map(ev => {
      const lat = parseFloat(ev.latitude);
      const lng = parseFloat(ev.longitude);
      if (isNaN(lat) || isNaN(lng)) return null;
      const fatalities = parseInt(ev.fatalities) || 0;
      return {
        id:           `acled-${ev.event_id_cnty}`,
        lat, lng,
        region:       `${ev.location}, ${ev.country}`,
        country:      ev.country,
        category:     EVENT_TYPE_MAP[ev.event_type] || 'conflict',
        severity:     getSeverity(ev.event_type, fatalities),
        eventType:    ev.event_type,
        subEventType: ev.sub_event_type,
        actors:       [ev.actor1, ev.actor2].filter(Boolean).join(' vs '),
        fatalities,
        date:         ev.event_date,
        notes:        (ev.notes || '').slice(0, 200),
        titleKo:      `${ev.location}: ${ev.event_type}${fatalities > 0 ? ` (사망 ${fatalities}명)` : ''}`,
        source:       'ACLED',
      };
    }).filter(Boolean);

    const result = { events, fetchedAt: new Date().toISOString(), count: events.length, cached: false };
    cache  = result;
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
