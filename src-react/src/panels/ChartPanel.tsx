import { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts';
import { useStore } from '@/store';

interface Props {
  symbol: string;
  nameKo: string;
}

const RANGES = ['1mo', '3mo', '6mo', '1y', '2y'] as const;
type Range = typeof RANGES[number];

const RANGE_KO: Record<Range, string> = {
  '1mo': '1개월', '3mo': '3개월', '6mo': '6개월', '1y': '1년', '2y': '2년',
};

export function ChartPanel({ symbol, nameKo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef  = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [range, setRange]     = useState<Range>('3mo');
  const [loading, setLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [change, setChange]       = useState<number | null>(null);
  const fetchChart = useStore(s => s.fetchChart);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#1a1a28' }, textColor: '#94a3b8' },
      grid:   { vertLines: { color: '#2a2a3f' }, horzLines: { color: '#2a2a3f' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2a3f' },
      timeScale:       { borderColor: '#2a2a3f', timeVisible: true, secondsVisible: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#4ade80', downColor: '#f87171',
      borderUpColor: '#4ade80', borderDownColor: '#f87171',
      wickUpColor: '#4ade80', wickDownColor: '#f87171',
    });
    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Load data on symbol/range change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChart(symbol, range).then(bars => {
      if (cancelled || !seriesRef.current || bars.length === 0) {
        setLoading(false);
        return;
      }
      const data = bars.map(b => ({
        time:  b.time as UTCTimestamp,
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      }));
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
      const last  = bars[bars.length - 1];
      const first = bars[0];
      setLastPrice(last.close);
      setChange(((last.close - first.close) / first.close) * 100);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, range, fetchChart]);

  const up = change !== null && change >= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header strip */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-border/50">
        {lastPrice !== null && (
          <>
            <span className="text-sm font-bold tabular-nums text-primary">
              {lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {change !== null && (
              <span className={`text-xs font-semibold ${up ? 'text-risk-safe' : 'text-risk-critical'}`}>
                {up ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex gap-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                r === range ? 'bg-accent text-white' : 'text-muted hover:text-primary'
              }`}
            >{RANGE_KO[r]}</button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/60 z-10">
            <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
