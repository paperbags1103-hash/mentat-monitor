/**
 * Portfolio Store — 포트폴리오 트래킹
 * 종목 보유 내역, P&L, VaR 계산, 테마 연계
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from './index';

export interface Holding {
  id: string;
  symbol: string;         // Yahoo Finance 심볼
  nameKo: string;         // 한국어 종목명
  quantity: number;       // 수량
  avgCost: number;        // 평균 매입 단가 (원화 또는 USD)
  currency: 'KRW' | 'USD'; // 통화
  addedAt: number;
  note?: string;
}

export interface HoldingWithPnL extends Holding {
  currentPrice: number | null;
  priceChangePct: number | null;
  totalCost: number;
  currentValue: number | null;
  pnl: number | null;         // unrealized P&L (원화 or USD)
  pnlPct: number | null;
}

export interface PortfolioSummary {
  totalCostKrw: number;
  totalValueKrw: number | null;
  totalPnlKrw: number | null;
  totalPnlPct: number | null;
  usdkrwRate: number;
  topGainer: HoldingWithPnL | null;
  topLoser: HoldingWithPnL | null;
  updatedAt: number;
}

interface PortfolioState {
  holdings: Holding[];
  prices: Record<string, { price: number; changePct: number }>;
  usdkrwRate: number;
  lastFetch: number | null;
  isLoading: boolean;

  // CRUD
  addHolding: (h: Omit<Holding, 'id' | 'addedAt'>) => void;
  removeHolding: (id: string) => void;
  updateHolding: (id: string, patch: Partial<Omit<Holding, 'id'>>) => void;

  // Data
  fetchPrices: () => Promise<void>;
  getHoldingsWithPnL: () => HoldingWithPnL[];
  getSummary: () => PortfolioSummary;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: [],
      prices: {},
      usdkrwRate: 1380,
      lastFetch: null,
      isLoading: false,

      addHolding: (h) => set(s => ({
        holdings: [...s.holdings, { ...h, id: `${h.symbol}-${Date.now()}`, addedAt: Date.now() }],
      })),

      removeHolding: (id) => set(s => ({ holdings: s.holdings.filter(h => h.id !== id) })),

      updateHolding: (id, patch) => set(s => ({
        holdings: s.holdings.map(h => h.id === id ? { ...h, ...patch } : h),
      })),

      fetchPrices: async () => {
        const { holdings } = get();
        if (holdings.length === 0) return;
        set({ isLoading: true });

        const symbols = [...new Set(holdings.map(h => h.symbol))];
        const prices: Record<string, { price: number; changePct: number }> = {};

        await Promise.all(symbols.map(async sym => {
          const data = await apiFetch<{ bars: Array<{ close: number }> }>(
            `/api/chart-data?symbol=${encodeURIComponent(sym)}&range=5d`
          );
          const bars = data?.bars ?? [];
          if (bars.length >= 2) {
            const last = bars[bars.length - 1].close;
            const prev = bars[bars.length - 2].close;
            prices[sym] = { price: last, changePct: ((last - prev) / prev) * 100 };
          } else if (bars.length === 1) {
            prices[sym] = { price: bars[0].close, changePct: 0 };
          }
        }));

        // Get USD/KRW
        const mkt = await apiFetch<{ usdkrw?: { rate: number } }>('/api/korea-market');
        const usdkrwRate = mkt?.usdkrw?.rate ?? get().usdkrwRate;

        set({ prices, usdkrwRate, isLoading: false, lastFetch: Date.now() });
      },

      getHoldingsWithPnL: () => {
        const { holdings, prices, usdkrwRate } = get();
        return holdings.map(h => {
          const priceData = prices[h.symbol];
          const currentPrice = priceData?.price ?? null;
          const totalCost = h.avgCost * h.quantity;
          const currentValue = currentPrice != null ? currentPrice * h.quantity : null;
          const pnl = currentValue != null ? currentValue - totalCost : null;
          const pnlPct = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null;
          void usdkrwRate; // available for future USD→KRW conversion
          return { ...h, currentPrice, priceChangePct: priceData?.changePct ?? null, totalCost, currentValue, pnl, pnlPct };
        });
      },

      getSummary: (): PortfolioSummary => {
        const { usdkrwRate } = get();
        const withPnL = get().getHoldingsWithPnL();

        const toKrw = (value: number, currency: 'KRW' | 'USD') =>
          currency === 'USD' ? value * usdkrwRate : value;

        const totalCostKrw = withPnL.reduce((s, h) => s + toKrw(h.totalCost, h.currency), 0);
        const totalValueKrwArr = withPnL.map(h => h.currentValue != null ? toKrw(h.currentValue, h.currency) : null);
        const allHavePrices = totalValueKrwArr.every(v => v != null);
        const totalValueKrw = allHavePrices ? totalValueKrwArr.reduce((s, v) => s + (v ?? 0), 0) : null;
        const totalPnlKrw = totalValueKrw != null ? totalValueKrw - totalCostKrw : null;
        const totalPnlPct = totalPnlKrw != null && totalCostKrw > 0 ? (totalPnlKrw / totalCostKrw) * 100 : null;

        const sorted = [...withPnL].filter(h => h.pnlPct != null).sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
        return {
          totalCostKrw, totalValueKrw, totalPnlKrw, totalPnlPct,
          usdkrwRate,
          topGainer: sorted[0] ?? null,
          topLoser: sorted.at(-1) ?? null,
          updatedAt: get().lastFetch ?? 0,
        };
      },
    }),
    { name: 'mentat-portfolio-v1' }
  )
);
