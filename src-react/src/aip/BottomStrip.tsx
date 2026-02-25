/**
 * BottomStrip — 하단 지표 스트립
 * 핵심 지표 스냅샷: 주요 지수 + 신용 + 매크로
 */
import { useStore } from '@/store';

interface MiniTickerProps {
  label: string;
  value: string;
  change?: number | null;
  unit?: string;
  highlight?: 'red' | 'green' | 'yellow';
}

function MiniTicker({ label, value, change, unit, highlight }: MiniTickerProps) {
  const upChg = change != null && change > 0;
  const dnChg = change != null && change < 0;
  const hlCls = highlight === 'red' ? 'text-risk-critical' : highlight === 'green' ? 'text-risk-safe' :
                highlight === 'yellow' ? 'text-risk-watch' : '';
  return (
    <div className="flex flex-col items-center px-3 py-1.5 border-r border-border/50 last:border-0 min-w-[80px]">
      <span className="text-xs text-muted uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${hlCls || 'text-primary'} whitespace-nowrap`}>
        {unit}{value}
      </span>
      {change != null && (
        <span className={`text-xs tabular-nums ${upChg ? 'text-risk-safe' : dnChg ? 'text-risk-critical' : 'text-muted'}`}>
          {upChg ? '+' : ''}{change.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function BottomStrip() {
  const {
    kospi, kosdaq, usdkrw, btcKrw, kimchiPremium,
    spx, nasdaq, vix, gold, oil, dxy,
    globalRiskScore, creditStress, globalMacro,
  } = useStore();

  const fmtN = (n: number | null | undefined, d = 2) =>
    n != null ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  return (
    <div className="h-14 bg-surface border-t border-border flex items-center overflow-x-auto shrink-0">
      {/* Korean */}
      {kospi  && <MiniTicker label="KOSPI"   value={fmtN(kospi.price)}  change={kospi.changePercent} />}
      {kosdaq && <MiniTicker label="KOSDAQ"  value={fmtN(kosdaq.price)} change={kosdaq.changePercent} />}
      {usdkrw && <MiniTicker label="KRW"     value={fmtN(usdkrw.rate, 1)} change={usdkrw.changePercent} unit="₩" />}
      {btcKrw && <MiniTicker label="BTC"     value={Math.round(btcKrw.price).toLocaleString('ko-KR')} change={btcKrw.changePercent} unit="₩" />}
      {kimchiPremium != null && <MiniTicker label="김치프리미엄" value={`${kimchiPremium.toFixed(1)}%`} highlight={Math.abs(kimchiPremium) > 3 ? 'yellow' : undefined} />}

      {/* US */}
      {spx    && <MiniTicker label="S&P500"  value={fmtN(spx.price)}    change={spx.changePercent} />}
      {nasdaq && <MiniTicker label="나스닥"  value={fmtN(nasdaq.price)} change={nasdaq.changePercent} />}
      {vix    && <MiniTicker label="VIX"     value={fmtN(vix.price)}    change={vix.changePercent}
        highlight={vix.price >= 30 ? 'red' : vix.price >= 20 ? 'yellow' : 'green'} />}
      {dxy    && <MiniTicker label="DXY"     value={fmtN(dxy.price)}    change={dxy.changePercent} />}

      {/* Commodities */}
      {gold   && <MiniTicker label="금"      value={fmtN(gold.price)}   change={gold.changePercent}  unit="$" />}
      {oil    && <MiniTicker label="WTI"     value={fmtN(oil.price)}    change={oil.changePercent}   unit="$" />}

      {/* Credit & Macro */}
      {creditStress && (
        <MiniTicker label="HY 스프레드" value={`${creditStress.hySpread}bps`}
          highlight={creditStress.stressLevel === 'CRITICAL' ? 'red' : creditStress.stressLevel === 'HIGH' ? 'yellow' : undefined} />
      )}
      {globalMacro?.yieldCurve?.spread2s10s != null && (
        <MiniTicker label="2s10s"
          value={`${globalMacro.yieldCurve.spread2s10s >= 0 ? '+' : ''}${globalMacro.yieldCurve.spread2s10s.toFixed(2)}%p`}
          highlight={globalMacro.yieldCurve.spread2s10s < 0 ? 'red' : 'green'} />
      )}
      {/* Global risk */}
      <MiniTicker label="위협 지수" value={String(globalRiskScore)}
        highlight={globalRiskScore >= 70 ? 'red' : globalRiskScore >= 40 ? 'yellow' : 'green'} />
    </div>
  );
}
