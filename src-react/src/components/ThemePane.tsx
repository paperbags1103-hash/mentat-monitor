import { useEffect, useState } from 'react';
import { useStore, type ActiveTheme } from '@/store';

function MomentumArrow({ m }: { m: ActiveTheme['momentum'] }) {
  if (m === 'rising')  return <span className="text-risk-safe text-sm">↑</span>;
  if (m === 'falling') return <span className="text-risk-critical text-sm">↓</span>;
  return <span className="text-muted text-sm">→</span>;
}

function StrengthBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-risk-critical' : value >= 45 ? 'bg-risk-elevated' : 'bg-risk-watch';
  return (
    <div className="h-1 w-full bg-border rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
    </div>
  );
}

function ThemeCard({ theme }: { theme: ActiveTheme }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="bg-surface border border-border rounded-lg p-3 hover:border-accent/50 transition-all cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-primary leading-tight">{theme.nameKo}</span>
        <div className="flex items-center gap-1 shrink-0">
          <MomentumArrow m={theme.momentum} />
          <span className="text-xs tabular-nums font-bold text-secondary">{theme.strength}</span>
        </div>
      </div>
      <StrengthBar value={theme.strength} />

      {(theme.koreanStocks ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(theme.koreanStocks ?? []).slice(0, 4).map(s => (
            <span key={s} className="text-xs bg-accent/10 text-accent-light px-1.5 py-0.5 rounded border border-accent/20">{s}</span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border space-y-1.5">
          {(theme.evidenceKo ?? []).length > 0 && (
            <div>
              <span className="text-xs text-muted font-semibold">📌 근거</span>
              {(theme.evidenceKo ?? []).map((e, i) => (
                <p key={i} className="text-xs text-secondary leading-snug">· {e}</p>
              ))}
            </div>
          )}
          {(theme.beneficiaryKo ?? []).length > 0 && (
            <div>
              <span className="text-xs text-muted font-semibold">✅ 수혜</span>
              {(theme.beneficiaryKo ?? []).map((b, i) => (
                <p key={i} className="text-xs text-risk-safe leading-snug">· {b}</p>
              ))}
            </div>
          )}
          {(theme.riskKo ?? []).length > 0 && (
            <div>
              <span className="text-xs text-muted font-semibold">⚠️ 리스크</span>
              {(theme.riskKo ?? []).map((r, i) => (
                <p key={i} className="text-xs text-risk-elevated leading-snug">· {r}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThemePane() {
  const { activeThemes, isLoading, themeDiscoveryMethod, fetchThemes } = useStore();
  const [themeLoading, setThemeLoading] = useState(false);

  // Fetch on mount, then every 30 min
  useEffect(() => {
    const load = async () => { setThemeLoading(true); await fetchThemes(); setThemeLoading(false); };
    void load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [fetchThemes]);

  const loading = isLoading || themeLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">투자 테마</span>
          {themeDiscoveryMethod && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              themeDiscoveryMethod === 'llm' ? 'bg-accent/20 text-accent-light' : 'bg-border text-muted'
            }`}>
              {themeDiscoveryMethod === 'llm' ? '🤖 Groq' : '📐 템플릿'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeThemes.length > 0 && <span className="text-xs text-muted">{activeThemes.length}개</span>}
          <button
            onClick={() => { setThemeLoading(true); fetchThemes().finally(() => setThemeLoading(false)); }}
            disabled={loading}
            className="text-xs text-muted hover:text-primary transition-colors disabled:opacity-40"
            title="테마 새로고침"
          >{loading ? '…' : '⟳'}</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {loading && activeThemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-center">AI 테마 분석 중…</span>
          </div>
        ) : activeThemes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs">테마 데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeThemes.map(theme => <ThemeCard key={theme.id} theme={theme} />)}
          </div>
        )}
      </div>
    </div>
  );
}
