import { create } from 'zustand';
import { TICKER_GEO_MAP } from '../data/watchlist-map';

const STORAGE_KEY = 'mentat-watchlist-v1';
const MAX_TICKERS = 8;

interface WatchlistState {
  tickers: string[];
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  hasTicker: (ticker: string) => boolean;
}

function loadFromStorage(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(TICKER_GEO_MAP.map(m => m.ticker));
    return parsed.filter((ticker: unknown): ticker is string => typeof ticker === 'string' && valid.has(ticker));
  } catch {
    return [];
  }
}

function saveToStorage(tickers: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  tickers: loadFromStorage(),
  addTicker: (ticker: string) => {
    const valid = TICKER_GEO_MAP.some(m => m.ticker === ticker);
    if (!valid) return;
    const { tickers } = get();
    if (tickers.includes(ticker) || tickers.length >= MAX_TICKERS) return;
    const next = [...tickers, ticker];
    saveToStorage(next);
    set({ tickers: next });
  },
  removeTicker: (ticker: string) => {
    const next = get().tickers.filter(t => t !== ticker);
    saveToStorage(next);
    set({ tickers: next });
  },
  hasTicker: (ticker: string) => get().tickers.includes(ticker),
}));
