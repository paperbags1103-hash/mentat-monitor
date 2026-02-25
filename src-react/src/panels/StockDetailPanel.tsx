/**
 * StockDetailPanel — 개별 종목 상세 뷰
 * 차트 + 기본 정보 + 관련 테마 + 뉴스 링크
 *
 * config: { symbol: 'AAPL', nameKo: '애플', exchange?: 'NASDAQ' }
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import type { OHLCBar } from '@/store';
import { createChart, ColorType } from 'lightweight-charts';

interface StockConfig {
  symbol: string;
  nameKo?: string;
  exchange?: string;
}

const RANGE_OPTIONS = [
  { label: '5일',  value: '5d'  },
  { label: '1개월', value: '1mo' },
  { label: '3개월', value: '3mo' },
  { label: '6개월', value: '6mo' },
  { label: '1년',  value: '1y'  },
];

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (p >= 10) return p.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return p.toFixed(4);
}

function useCandleChart(ref: React.RefObject<HTMLDivElement | null>, bars: OHLCBar[]) {
  useEffect(() => {
    if (!ref.current || bars.length === 0) return;
    const el = ref.current;
    el.innerHTML = '';

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
    });

    const candles = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',   wickDownColor: '#ef4444',
    });

    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // lightweight-charts v4: time = Unix seconds
    type LCTime = import('lightweight-charts').Time;
    const toTime = (ms: number): LCTime => Math.floor(ms / 1000) as unknown as LCTime;

    const candleData = bars.map(b => ({
      time: toTime(b.time),
      open: b.open, high: b.high, low: b.low, close: b.close,
    }));
    const volData = bars.map(b => ({
      time: toTime(b.time),
      value: b.volume ?? 0,
      color: b.close >= b.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
    }));

    candles.setData(candleData);
    vol.setData(volData);
    chart.timeScale().fitContent();

    const obs = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);

    return () => { chart.remove(); obs.disconnect(); };
  }, [bars]);
}

export function StockDetailPanel({ config }: { config?: StockConfig }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const selectedName   = useStore(s => s.selectedSymbolName);
  // config takes precedence; fall back to globally selected symbol
  const symbol   = config?.symbol   ?? selectedSymbol ?? 'AAPL';
  const nameKo   = config?.nameKo   ?? selectedName   ?? symbol;
  const exchange = config?.exchange  ?? '';
  const fetchChart = useStore(s => s.fetchChart);
  const activeThemes = useStore(s => s.activeThemes);

  const [range, setRange] = useState('3mo');
  const [bars, setBars] = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(true);

  const chartRef = useRef<HTMLDivElement>(null);
  useCandleChart(chartRef, bars);

  useEffect(() => {
    setLoading(true);
    setBars([]);
    fetchChart(symbol, range).then(b => {
      setBars(b);
      setLoading(false);
    });
  }, [symbol, range]);

  // 관련 테마 찾기
  const relatedThemes = activeThemes.filter(t =>
    t.beneficiaryKo?.some(s => s.includes(symbol) || symbol.includes(s.replace(/[가-힣]/g, '')))
    || t.koreanStocks?.includes(symbol)
  );

  // 기본 가격 정보
  const lastBar = bars[bars.length - 1];
  const firstBar = bars[0];
  const priceChange = lastBar && firstBar
    ? ((lastBar.close - firstBar.close) / firstBar.close) * 100
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-primary font-mono">{symbol}</span>
              <span className="text-xs text-muted">{nameKo}</span>
              {exchange && <span className="text-xs text-muted/60">{exchange}</span>}
            </div>
            {lastBar && (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-bold text-primary tabular-nums font-mono">
                  {formatPrice(lastBar.close)}
                </span>
                {priceChange != null && (
                  <span className={`text-xs font-mono ${priceChange >= 0 ? 'text-risk-safe' : 'text-risk-critical'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    <span className="text-muted ml-1">({RANGE_OPTIONS.find(r => r.value === range)?.label})</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Range selector */}
          <div className="flex gap-0.5">
            {RANGE_OPTIONS.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                  range === r.value
                    ? 'bg-accent/30 text-accent-light border border-accent/40'
                    : 'text-muted hover:text-secondary border border-transparent'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-base/60 z-10">
            <div className="text-xs text-muted animate-pulse">로딩 중...</div>
          </div>
        )}
        {!loading && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-muted">데이터 없음 ({symbol})</div>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>

      {/* OHLCV row */}
      {lastBar && (
        <div className="px-3 py-1.5 border-t border-border shrink-0 grid grid-cols-5 text-center text-xs font-mono">
          {[
            ['시가', lastBar.open],
            ['고가', lastBar.high],
            ['저가', lastBar.low],
            ['종가', lastBar.close],
            ['거래량', lastBar.volume],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-muted/60 text-[10px]">{label}</div>
              <div className="text-secondary tabular-nums">
                {typeof val === 'number' ? (
                  label === '거래량'
                    ? val > 1e6 ? `${(val/1e6).toFixed(1)}M` : val > 1e3 ? `${(val/1e3).toFixed(0)}K` : val.toString()
                    : formatPrice(val)
                ) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Related themes */}
      {relatedThemes.length > 0 && (
        <div className="px-3 py-2 border-t border-border shrink-0">
          <div className="text-xs text-muted mb-1">관련 테마</div>
          <div className="flex flex-wrap gap-1">
            {relatedThemes.map(t => (
              <span key={t.id}
                className="text-xs px-1.5 py-0.5 rounded-full bg-accent/15 text-accent-light border border-accent/25">
                {t.nameKo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
