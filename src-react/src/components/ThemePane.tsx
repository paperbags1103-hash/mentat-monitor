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
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

function ThemeCard({ theme }: { theme: ActiveTheme }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-3 hover:border-accent/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-primary leading-tight">{theme.nameKo}</span>
        <div className="flex items-center gap-1 shrink-0">
          <MomentumArrow m={theme.momentum} />
          <span className="text-xs text-muted tabular-nums">{theme.strength}</span>
        </div>
      </div>
      <StrengthBar value={theme.strength} />

      {theme.evidenceKo.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-muted">근거</span>
          <ul className="mt-0.5">
            {theme.evidenceKo.slice(0, 2).map((e, i) => (
              <li key={i} className="text-xs text-secondary before:content-['▸_'] before:text-muted">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {theme.koreanStocks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {theme.koreanStocks.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-accent/10 text-accent-light px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemePane() {
  const { activeThemes, isLoading } = useStore();

  return (
    <div className="flex flex-col h-full overflow-y-auto border-x border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-bold text-muted uppercase tracking-widest">활성 테마</span>
        {activeThemes.length > 0 && (
          <span className="text-xs text-muted">{activeThemes.length}개</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-3 py-3 overflow-y-auto">
        {isLoading && activeThemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-center">AI 테마 분석 중…<br/>
              <span className="text-muted/60">뉴스와 신호에서 투자 내러티브를 추출하고 있어요</span>
            </span>
          </div>
        ) : activeThemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <span className="text-3xl">🔍</span>
            <div>
              <p className="text-sm text-secondary font-semibold mb-1">테마 발견 엔진</p>
              <p className="text-xs text-muted leading-relaxed">
                AI가 시장 신호와 뉴스에서<br/>
                활성 투자 내러티브를 자동으로 발견합니다.<br/><br/>
                <span className="text-accent-light">Phase 2에서 활성화됩니다</span>
              </p>
            </div>
            {/* Preview of what it will look like */}
            <div className="w-full mt-2 opacity-30 pointer-events-none">
              <div className="bg-panel border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-primary">AI 데이터센터 전력 병목</span>
                  <span className="text-xs text-risk-safe">↑ 78</span>
                </div>
                <div className="h-1 w-full bg-border rounded-full">
                  <div className="h-full w-3/4 bg-risk-elevated rounded-full" />
                </div>
                <div className="mt-2 flex gap-1">
                  <span className="text-xs bg-accent/10 text-accent-light px-1.5 py-0.5 rounded">효성중공업</span>
                  <span className="text-xs bg-accent/10 text-accent-light px-1.5 py-0.5 rounded">LS일렉트릭</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeThemes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
