import type { NormalizedSignal } from '../types.js';

interface CalendarEvent {
  id?: string;
  title: string;
  institution: string;   // 'FOMC' | 'BOK' | 'BOJ' | 'ECB'
  date: string;          // ISO
  daysUntil?: number;
  importance?: 'high' | 'medium' | 'low';
}

interface EconomicCalendarData {
  events: CalendarEvent[];
  timestamp?: number;
}

const INST_ENTITY_MAP: Record<string, { entityId: string; affectedEntityIds: string[] }> = {
  FOMC:  { entityId: 'inst:fed', affectedEntityIds: ['inst:fed', 'asset:USDKRW', 'asset:KS11', 'asset:US10Y', 'asset:DXY'] },
  BOK:   { entityId: 'inst:bok', affectedEntityIds: ['inst:bok', 'asset:USDKRW', 'asset:KS11'] },
  BOJ:   { entityId: 'inst:boj', affectedEntityIds: ['inst:boj', 'asset:USDJPY', 'asset:KS11'] },
  ECB:   { entityId: 'inst:ecb', affectedEntityIds: ['region:europe', 'asset:SPX'] },
};

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.round((target.getTime() - now.getTime()) / 86400_000);
}

function urgencyToStrength(daysUntil: number): number {
  if (daysUntil < 0) return 0;     // already passed
  if (daysUntil === 0) return 70;
  if (daysUntil === 1) return 55;
  if (daysUntil <= 3) return 40;
  if (daysUntil <= 7) return 25;
  return 0;
}

export function normalizeEconomicCalendar(data: EconomicCalendarData): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  const ts = data.timestamp ?? Date.now();

  for (const event of data.events) {
    const days = event.daysUntil ?? daysUntilDate(event.date);
    const strength = urgencyToStrength(days);
    if (strength === 0) continue;

    const inst = event.institution.toUpperCase();
    const mapping = INST_ENTITY_MAP[inst];
    if (!mapping) continue;

    signals.push({
      id: `economic_calendar:${event.id ?? inst}:${ts}`,
      source: 'economic_calendar',
      strength,
      direction: 'neutral', // actual direction depends on decision; pre-event is neutral
      affectedEntityIds: mapping.affectedEntityIds,
      confidence: 0.90, // calendar data is high confidence
      timestamp: ts,
      headlineKo: `${event.title} — ${days === 0 ? '오늘' : `${days}일 후`} 예정`,
      raw: event,
    });
  }

  return signals;
}
