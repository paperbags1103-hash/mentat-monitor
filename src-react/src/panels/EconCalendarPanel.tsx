import { useStore } from '@/store';

const INST_BADGE: Record<string, string> = {
  FOMC: 'bg-blue-500/20 text-blue-400',
  BOK:  'bg-accent/20 text-accent-light',
  BOJ:  'bg-red-500/20 text-red-400',
  ECB:  'bg-yellow-500/20 text-yellow-400',
};

export function EconCalendarPanel() {
  const { econCalendar } = useStore();

  const sorted = [...econCalendar]
    .filter(e => e.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-2">
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted text-xs">캘린더 데이터 없음</div>
      ) : (
        sorted.map((ev, i) => {
          const inst = (ev.institution ?? '').toUpperCase();
          const badge = INST_BADGE[inst] ?? 'bg-border text-secondary';
          const urgency = ev.daysUntil === 0 ? 'text-risk-critical font-bold' :
            ev.daysUntil === 1 ? 'text-risk-elevated' :
            ev.daysUntil <= 3 ? 'text-risk-watch' : 'text-muted';

          return (
            <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/40 last:border-0">
              <div className={`text-center min-w-[36px]`}>
                <div className={`text-lg font-bold tabular-nums leading-none ${urgency}`}>{ev.daysUntil}</div>
                <div className="text-xs text-muted">일 후</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${badge}`}>{inst}</span>
                  {ev.importance === 'HIGH' && <span className="text-xs text-risk-critical">●</span>}
                </div>
                <p className="text-xs text-secondary leading-snug">{ev.title}</p>
                <p className="text-xs text-muted mt-0.5">{ev.date}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
