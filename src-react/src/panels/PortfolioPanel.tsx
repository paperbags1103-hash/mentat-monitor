import { useState, useEffect } from 'react';
import { usePortfolioStore, type Holding, type HoldingWithPnL } from '@/store/portfolio';
import { useStore } from '@/store';

// ── Add holding form ───────────────────────────────────────────────────────

const QUICK_SYMBOLS = [
  { symbol: '005930.KS', nameKo: '삼성전자', currency: 'KRW' },
  { symbol: '000660.KS', nameKo: 'SK하이닉스', currency: 'KRW' },
  { symbol: '035420.KS', nameKo: 'NAVER', currency: 'KRW' },
  { symbol: '051910.KS', nameKo: 'LG화학', currency: 'KRW' },
  { symbol: '006400.KS', nameKo: '삼성SDI', currency: 'KRW' },
  { symbol: 'NVDA',      nameKo: '엔비디아', currency: 'USD' },
  { symbol: 'TSLA',      nameKo: '테슬라', currency: 'USD' },
  { symbol: 'AAPL',      nameKo: '애플', currency: 'USD' },
  { symbol: 'MSFT',      nameKo: '마이크로소프트', currency: 'USD' },
  { symbol: 'BTC-USD',   nameKo: '비트코인', currency: 'USD' },
] as const;

function AddForm({ onClose }: { onClose: () => void }) {
  const addHolding = usePortfolioStore(s => s.addHolding);
  const [symbol, setSymbol]   = useState('');
  const [nameKo, setNameKo]   = useState('');
  const [qty, setQty]         = useState('');
  const [cost, setCost]       = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [note, setNote]       = useState('');

  function fillQuick(q: typeof QUICK_SYMBOLS[number]) {
    setSymbol(q.symbol);
    setNameKo(q.nameKo);
    setCurrency(q.currency as 'KRW' | 'USD');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !nameKo || !qty || !cost) return;
    addHolding({ symbol, nameKo, quantity: parseFloat(qty), avgCost: parseFloat(cost), currency, note });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        className="bg-panel border border-border rounded-xl w-full max-w-md shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="text-sm font-bold text-primary mb-4">보유 종목 추가</h3>

        {/* Quick picks */}
        <div className="flex flex-wrap gap-1 mb-4">
          {QUICK_SYMBOLS.map(q => (
            <button key={q.symbol} type="button" onClick={() => fillQuick(q)}
              className="text-xs px-2 py-0.5 rounded bg-surface border border-border hover:border-accent/60 text-secondary transition-colors">
              {q.nameKo}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted block mb-1">종목코드 *</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="005930.KS"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">종목명 *</label>
            <input value={nameKo} onChange={e => setNameKo(e.target.value)} placeholder="삼성전자"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">수량 *</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="100"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">평균단가 *</label>
            <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="75000"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <label className="text-xs text-muted">통화</label>
          {(['KRW', 'USD'] as const).map(c => (
            <label key={c} className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={currency === c} onChange={() => setCurrency(c)} className="accent-violet-500" />
              <span className="text-xs text-secondary">{c}</span>
            </label>
          ))}
        </div>

        <input value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)"
          className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none mb-4" />

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 text-muted hover:text-primary">취소</button>
          <button type="submit" className="text-xs px-4 py-1.5 bg-accent text-white rounded hover:bg-accent/80 font-semibold">추가</button>
        </div>
      </form>
    </div>
  );
}

// ── Holding row ────────────────────────────────────────────────────────────

function HoldingRow({ h, onRemove }: { h: HoldingWithPnL; onRemove: () => void }) {
  const up = h.pnlPct != null && h.pnlPct >= 0;
  const fmt = (n: number, dec = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: dec });

  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/40 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-primary">{h.nameKo}</span>
          <span className="text-xs text-muted">{h.quantity}주</span>
          <span className={`text-xs ml-auto ${h.currency === 'USD' ? 'text-blue-400' : 'text-accent-light'}`}>{h.currency}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xs text-muted">매입 {fmt(h.avgCost)}</span>
          {h.currentPrice != null && (
            <>
              <span className="text-xs text-muted">→</span>
              <span className={`text-xs font-semibold ${up ? 'text-risk-safe' : 'text-risk-critical'}`}>{fmt(h.currentPrice)}</span>
            </>
          )}
          {h.pnlPct != null && (
            <span className={`text-xs font-bold ${up ? 'text-risk-safe' : 'text-risk-critical'}`}>
              {up ? '+' : ''}{h.pnlPct.toFixed(1)}%
            </span>
          )}
        </div>
        {h.pnl != null && (
          <div className={`text-xs ${up ? 'text-risk-safe' : 'text-risk-critical'}`}>
            {up ? '+' : ''}{fmt(Math.round(h.pnl))} {h.currency}
          </div>
        )}
      </div>
      <button onClick={onRemove} className="text-muted hover:text-risk-critical text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function PortfolioPanel() {
  const { getHoldingsWithPnL, getSummary, fetchPrices, isLoading, lastFetch, removeHolding } = usePortfolioStore();
  const { usdkrw } = useStore();
  const [showAdd, setShowAdd] = useState(false);

  // Sync USD/KRW from main store
  useEffect(() => {
    if (usdkrw?.rate) {
      usePortfolioStore.setState({ usdkrwRate: usdkrw.rate });
    }
  }, [usdkrw?.rate]);

  // Auto-refresh prices every 5 min
  useEffect(() => {
    void fetchPrices();
    const id = setInterval(() => void fetchPrices(), 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  const holdings = getHoldingsWithPnL();
  const summary  = getSummary();
  const ts = lastFetch ? new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null;

  const totalUp = summary.totalPnlPct != null && summary.totalPnlPct >= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">포트폴리오</span>
          {ts && <span className="text-xs text-muted/60">{ts}</span>}
          {isLoading && <div className="w-3 h-3 border border-border border-t-accent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void fetchPrices()} className="text-xs text-muted hover:text-primary">⟳</button>
          <button onClick={() => setShowAdd(true)} className="text-xs px-2 py-0.5 bg-accent/20 text-accent-light border border-accent/30 rounded hover:bg-accent/30 font-semibold">+ 추가</button>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
          <span className="text-2xl">💼</span>
          <div>
            <p className="text-xs font-semibold text-secondary mb-1">포트폴리오 없음</p>
            <p className="text-xs text-muted">보유 종목을 추가하면<br/>실시간 P&L을 추적합니다</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 bg-accent text-white rounded font-semibold mt-1">+ 첫 종목 추가</button>
        </div>
      ) : (
        <>
          {/* Summary */}
          {summary.totalCostKrw > 0 && (
            <div className="px-3 py-2 border-b border-border/60 shrink-0">
              <div className="flex items-baseline gap-2">
                {summary.totalValueKrw != null && (
                  <span className="text-sm font-bold text-primary tabular-nums">
                    ₩{Math.round(summary.totalValueKrw).toLocaleString('ko-KR')}
                  </span>
                )}
                {summary.totalPnlPct != null && (
                  <span className={`text-xs font-bold ${totalUp ? 'text-risk-safe' : 'text-risk-critical'}`}>
                    {totalUp ? '+' : ''}{summary.totalPnlPct.toFixed(2)}%
                  </span>
                )}
                {summary.totalPnlKrw != null && (
                  <span className={`text-xs ${totalUp ? 'text-risk-safe' : 'text-risk-critical'} ml-auto`}>
                    {totalUp ? '+' : ''}₩{Math.round(summary.totalPnlKrw).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
              {/* Top gainer/loser */}
              <div className="flex gap-3 mt-1">
                {summary.topGainer && summary.topGainer.pnlPct != null && summary.topGainer.pnlPct > 0 && (
                  <span className="text-xs text-risk-safe">▲ {summary.topGainer.nameKo} +{summary.topGainer.pnlPct.toFixed(1)}%</span>
                )}
                {summary.topLoser && summary.topLoser.pnlPct != null && summary.topLoser.pnlPct < 0 && (
                  <span className="text-xs text-risk-critical">▼ {summary.topLoser.nameKo} {summary.topLoser.pnlPct.toFixed(1)}%</span>
                )}
              </div>
            </div>
          )}

          {/* Holdings list */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {holdings.map(h => (
              <HoldingRow key={h.id} h={h} onRemove={() => removeHolding(h.id)} />
            ))}
          </div>
        </>
      )}

      {showAdd && <AddForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
