import { useStore } from '@/store';

interface TickerRowProps {
  label: string;
  value: string;
  changePct?: number | null;
  sub?: string;
}

function TickerRow({ label, value, changePct, sub }: TickerRowProps) {
  const up = changePct !== null && changePct !== undefined && changePct > 0;
  const dn = changePct !== null && changePct !== undefined && changePct < 0;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div>
        <span className="text-xs font-semibold text-secondary">{label}</span>
        {sub && <span className="text-xs text-muted ml-1.5">{sub}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold tabular-nums text-primary">{value}</span>
        {changePct !== null && changePct !== undefined && (
          <span className={`text-xs tabular-nums font-semibold min-w-[52px] text-right ${up ? 'text-risk-safe' : dn ? 'text-risk-critical' : 'text-muted'}`}>
            {up ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <div className="text-xs text-muted uppercase tracking-widest pt-2 pb-1">{title}</div>;
}

export function MarketOverviewPanel() {
  const { kospi, kosdaq, usdkrw, btcKrw, kimchiPremium, spx, nasdaq, dxy, vix, gold, oil, preciousMetals } = useStore();

  const fmt = (n: number | null | undefined, dec = 2) =>
    n != null ? n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-2">
      <SectionHeader title="한국 시장" />
      {kospi  && <TickerRow label="KOSPI"   value={fmt(kospi.price)}    changePct={kospi.changePercent} />}
      {kosdaq && <TickerRow label="KOSDAQ"  value={fmt(kosdaq.price)}   changePct={kosdaq.changePercent} />}
      {usdkrw && <TickerRow label="USD/KRW" value={`₩${fmt(usdkrw.rate, 1)}`} changePct={usdkrw.changePercent} />}
      {btcKrw && <TickerRow label="BTC/KRW" value={`₩${fmt(btcKrw.price, 0)}`} changePct={btcKrw.changePercent} />}
      {kimchiPremium != null && (
        <TickerRow label="김치 프리미엄" value={`${kimchiPremium > 0 ? '+' : ''}${kimchiPremium.toFixed(1)}%`} />
      )}

      <SectionHeader title="글로벌 지수" />
      {spx    && <TickerRow label="S&P 500"  value={fmt(spx.price)}    changePct={spx.changePercent} />}
      {nasdaq && <TickerRow label="나스닥"   value={fmt(nasdaq.price)} changePct={nasdaq.changePercent} />}
      {vix    && <TickerRow label="VIX"      value={fmt(vix.price)}    changePct={vix.changePercent} sub="공포지수" />}
      {dxy    && <TickerRow label="DXY"      value={fmt(dxy.price)}    changePct={dxy.changePercent} sub="달러지수" />}

      <SectionHeader title="원자재" />
      {(gold ?? preciousMetals?.gold) && (
        <TickerRow label="금 (Gold)" value={`$${fmt(gold?.price ?? preciousMetals?.gold.price)}`}
          changePct={gold?.changePercent ?? preciousMetals?.gold.changePercent} />
      )}
      {oil && <TickerRow label="WTI 원유" value={`$${fmt(oil.price)}`} changePct={oil.changePercent} />}
      {preciousMetals?.silver && (
        <TickerRow label="은 (Silver)" value={`$${fmt(preciousMetals.silver.price)}`}
          changePct={preciousMetals.silver.changePercent} />
      )}
    </div>
  );
}
