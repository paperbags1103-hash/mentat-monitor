/**
 * KoreaMarketPanel.ts — Mentat Monitor
 *
 * 한국 시장 전용 패널: KOSPI · KOSDAQ · USD-KRW · BTC 김치프리미엄
 * API: /api/korea-market (1분 캐시)
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { toRuntimeUrl } from '@/services/runtime';

interface IndexData {
  price: number;
  change: number;
  changePercent: number;
  sparkline?: number[];
}

interface KoreaMarketData {
  timestamp: number;
  kospi: IndexData;
  kosdaq: IndexData;
  usdkrw: { rate: number; change: number; changePercent: number };
  btcKrw?: { price: number; changePercent: number };
  btcUsdt?: { price: number };
  kimchiPremium?: number;
  error?: string;
}

const REFRESH_MS = 60_000; // 1분

function sign(n: number): string {
  return n >= 0 ? '+' : '';
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(n: number): string {
  return `${sign(n)}${fmt(n)}%`;
}

function changeClass(n: number): string {
  return n > 0 ? 'km-up' : n < 0 ? 'km-down' : 'km-flat';
}

function sparkline(data: number[] | undefined, change: number, w = 56, h = 18): string {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const color = change >= 0 ? 'var(--km-up, #4ade80)' : 'var(--km-down, #f87171)';
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="km-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export class KoreaMarketPanel extends Panel {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stale = false;

  constructor() {
    super({
      id: 'korea-market',
      title: '🇰🇷 한국 시장',
      showCount: false,
      infoTooltip: 'KOSPI · KOSDAQ · 원달러 · BTC 김치프리미엄 실시간',
    });
  }

  public start(): void {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  public override destroy(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    super.destroy();
  }

  private async refresh(): Promise<void> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(toRuntimeUrl('/api/korea-market'), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: KoreaMarketData = await res.json();
      this.stale = false;
      this.render(data);
    } catch {
      this.stale = true;
      this.showError('시장 데이터 로드 실패 — 재시도 중…');
    }
  }

  private render(d: KoreaMarketData): void {
    const ts = d.timestamp
      ? new Date(d.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';

    const items: string[] = [
      this.row('KOSPI', d.kospi?.price?.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) ?? '—',
        d.kospi?.changePercent ?? 0, d.kospi?.sparkline),
      this.row('KOSDAQ', d.kosdaq?.price?.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) ?? '—',
        d.kosdaq?.changePercent ?? 0, d.kosdaq?.sparkline),
      this.row('USD/KRW', d.usdkrw?.rate ? `₩${fmt(d.usdkrw.rate, 1)}` : '—',
        d.usdkrw?.changePercent ?? 0),
    ];

    if (d.btcKrw?.price) {
      items.push(this.row('BTC (KRW)', `₩${d.btcKrw.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`, d.btcKrw.changePercent ?? 0));
    }

    const kimchiHtml = d.kimchiPremium != null
      ? this.kimchiRow(d.kimchiPremium)
      : '';

    const html = `
      <div class="km-list">${items.join('')}${kimchiHtml}</div>
      ${ts ? `<div class="km-footer">업데이트 ${escapeHtml(ts)}</div>` : ''}
    `;
    this.setContent(html);
    this.setDataBadge(this.stale ? 'cached' : 'live');
  }

  private row(label: string, price: string, changePct: number, spark?: number[]): string {
    const cls = changeClass(changePct);
    return `
      <div class="km-row">
        <div class="km-info">
          <span class="km-label">${escapeHtml(label)}</span>
        </div>
        <div class="km-data">
          ${sparkline(spark, changePct)}
          <span class="km-price">${escapeHtml(price)}</span>
          <span class="km-chg ${cls}">${fmtPct(changePct)}</span>
        </div>
      </div>
    `;
  }

  private kimchiRow(premium: number): string {
    const cls = changeClass(premium);
    const label = premium > 0 ? '🌶️ 김치 프리미엄' : '📉 김치 디스카운트';
    const tooltip = premium > 3
      ? '국내 BTC 수요 과열 → 리스크온 지표'
      : premium < -3
        ? '투자 심리 위축 신호'
        : '정상 범위';
    return `
      <div class="km-row km-kimchi">
        <div class="km-info">
          <span class="km-label">${label}</span>
          <span class="km-sublabel">${escapeHtml(tooltip)}</span>
        </div>
        <div class="km-data">
          <span class="km-price km-chg ${cls}">${sign(premium)}${fmt(premium, 1)}%</span>
        </div>
      </div>
    `;
  }
}
