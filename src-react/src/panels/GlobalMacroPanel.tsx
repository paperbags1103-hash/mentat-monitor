import { useStore } from '@/store';

function StatRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'red' | 'green' | 'yellow' | 'blue' }) {
  const cls = highlight === 'red' ? 'text-risk-critical' : highlight === 'green' ? 'text-risk-safe' :
    highlight === 'yellow' ? 'text-risk-watch' : highlight === 'blue' ? 'text-accent-light' : 'text-primary';
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-secondary">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-bold tabular-nums ${cls}`}>{value}</span>
        {sub && <span className="text-xs text-muted ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ t }: { t: string }) {
  return <div className="text-xs text-muted uppercase tracking-widest pt-2.5 pb-1 border-b border-border mb-1">{t}</div>;
}

export function GlobalMacroPanel() {
  const { globalMacro } = useStore();

  if (!globalMacro) {
    return <div className="flex items-center justify-center h-full text-muted text-xs">글로벌 매크로 로드 중…</div>;
  }

  const { dxy, yieldCurve, realRate, copperGold, vix } = globalMacro;
  const curve = yieldCurve;

  const spread2s10sPct = curve.spread2s10s?.toFixed(2) ?? '—';
  const spreadColor = curve.spread2s10s != null
    ? (curve.spread2s10s < -0.5 ? 'red' : curve.spread2s10s < 0 ? 'yellow' : curve.spread2s10s < 0.5 ? 'yellow' : 'green')
    : undefined;

  const realRateColor = realRate.value != null
    ? (realRate.value < 0 ? 'green' : realRate.value < 1 ? 'blue' : 'red')
    : undefined;

  return (
    <div className="flex flex-col h-full px-3 py-2 overflow-y-auto">
      {/* DXY */}
      <SectionTitle t="달러 지수 (DXY)" />
      {dxy ? (
        <>
          <StatRow
            label="DXY"
            value={dxy.price.toFixed(2)}
            sub={`${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct.toFixed(2)}%`}
            highlight={dxy.changePct > 0.5 ? 'red' : dxy.changePct < -0.5 ? 'green' : undefined}
          />
          {dxy.signal && (
            <p className="text-xs text-secondary mt-1 pb-2 leading-snug">{dxy.signal.ko}</p>
          )}
        </>
      ) : <p className="text-xs text-muted py-1">데이터 없음</p>}

      {/* Yield Curve */}
      <SectionTitle t="미국 수익률 곡선" />
      {curve.y2  != null && <StatRow label="2년물"  value={`${curve.y2.toFixed(2)}%`} />}
      {curve.y10 != null && <StatRow label="10년물" value={`${curve.y10.toFixed(2)}%`} />}
      {curve.y30 != null && <StatRow label="30년물" value={`${curve.y30.toFixed(2)}%`} />}
      {curve.spread2s10s != null && (
        <StatRow
          label="2s10s 스프레드"
          value={`${parseFloat(spread2s10sPct) >= 0 ? '+' : ''}${spread2s10sPct}%p`}
          sub={curve.interpretation ? `${curve.interpretation.emoji} ${curve.interpretation.label}` : undefined}
          highlight={spreadColor as 'red' | 'green' | 'yellow' | undefined}
        />
      )}

      {/* Real Rates */}
      <SectionTitle t="실질금리" />
      {realRate.value != null && (
        <StatRow
          label="실질금리 10Y"
          value={`${realRate.value.toFixed(2)}%`}
          sub={realRate.source === 'fred' ? 'FRED TIPS' : '추정'}
          highlight={realRateColor as 'red' | 'green' | 'blue' | undefined}
        />
      )}
      {realRate.goldSignal && (
        <p className="text-xs text-secondary leading-snug py-1">{realRate.goldSignal}</p>
      )}

      {/* Copper/Gold Ratio */}
      <SectionTitle t="구리/금 비율 (성장 프록시)" />
      {copperGold.ratio != null && (
        <StatRow label="구리/금 비율" value={copperGold.ratio.toFixed(3)} />
      )}
      {copperGold.copper && (
        <StatRow
          label="구리"
          value={`$${copperGold.copper.price.toFixed(2)}`}
          sub={`${copperGold.copper.changePct >= 0 ? '+' : ''}${copperGold.copper.changePct.toFixed(2)}%`}
          highlight={copperGold.copper.changePct > 0 ? 'green' : 'red'}
        />
      )}
      {copperGold.signal && (
        <p className="text-xs text-secondary leading-snug py-1">{copperGold.signal}</p>
      )}

      {/* VIX */}
      {vix && (
        <>
          <SectionTitle t="VIX 공포지수" />
          <StatRow
            label="VIX"
            value={vix.price.toFixed(2)}
            sub={`${vix.changePct >= 0 ? '+' : ''}${vix.changePct.toFixed(2)}%`}
            highlight={vix.price >= 30 ? 'red' : vix.price >= 20 ? 'yellow' : 'green'}
          />
          <p className="text-xs text-muted py-1">
            {vix.price >= 30 ? '🔴 극도의 공포 — 역발상 매수 기회 검토' :
             vix.price >= 20 ? '🟡 시장 불안 고조' : '🟢 VIX 안정 구간'}
          </p>
        </>
      )}
    </div>
  );
}
