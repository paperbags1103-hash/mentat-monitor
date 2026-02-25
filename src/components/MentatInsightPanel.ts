/**
 * MentatInsightPanel.ts — Mentat Monitor Phase 4
 *
 * 지정학 리스크 인사이트 패널 (한국 투자자용)
 * API: /api/insight-briefing → 리스크 게이지 + 나레이티브 + 인퍼런스 카드 + 마켓 아웃룩
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { toRuntimeUrl } from '@/services/runtime';

// ─── Types (mirrored from api/insight-briefing.js) ─────────────────────────────

interface InferenceResult {
  ruleId: string;
  severity: 'CRITICAL' | 'ELEVATED' | 'WATCH' | 'INFO';
  titleKo: string;
  summaryKo: string;
  suggestedActionKo?: string;
  confidence: number;
  expectedImpact?: {
    kospiRange?: [number, number];
    krwDirection?: 'weaken' | 'strengthen' | 'neutral';
    safeHavens?: string[];
  };
  affectedEntityIds?: string[];
}

interface TopEntity {
  entityId: string;
  nameKo: string;
  fusedStrength: number;
}

interface InsightBriefingResponse {
  generatedAt: number;
  globalRiskScore: number;
  riskLabel: string;
  topInferences: InferenceResult[];
  narrativeKo: string;
  narrativeMethod: 'llm' | 'template';
  signalSummary: {
    total: number;
    bySeverity: {
      CRITICAL: number;
      ELEVATED: number;
      WATCH: number;
      INFO: number;
    };
    topEntities: TopEntity[];
  };
  marketOutlook: {
    kospiSentiment: 'risk_on' | 'risk_off' | 'neutral' | 'ambiguous';
    keyRisks: string[];
    keyOpportunities: string[];
    hedgeSuggestions: string[];
  };
  staleWarnings: string[];
  _meta: {
    processingMs: number;
    signalCount: number;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60_000; // 5 minutes (matches API cache)
const FETCH_TIMEOUT_MS = 12_000;

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: '🚨',
  ELEVATED: '⚠️',
  WATCH:    '👁️',
  INFO:     'ℹ️',
};

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: 'mentat-inf-critical',
  ELEVATED: 'mentat-inf-elevated',
  WATCH:    'mentat-inf-watch',
  INFO:     'mentat-inf-info',
};

const SENTIMENT_KO: Record<string, string> = {
  risk_on:  '상승',
  risk_off: '하락',
  neutral:  '중립',
  ambiguous:'혼조',
};

const SENTIMENT_CLASS: Record<string, string> = {
  risk_on:  'mentat-up',
  risk_off: 'mentat-down',
  neutral:  'mentat-neutral',
  ambiguous:'mentat-neutral',
};

// ─── MentatInsightPanel ────────────────────────────────────────────────────────

export class MentatInsightPanel extends Panel {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastData: InsightBriefingResponse | null = null;
  private loading = false;

  constructor() {
    super({
      id: 'mentat-insight',
      title: '🧠 멘탯 인사이트',
      showCount: false,
      infoTooltip: '지정학·금융 신호를 융합한 한국 투자자용 AI 리스크 브리핑',
    });
  }

  public start(): void {
    void this.refresh();
    this.intervalId = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
  }

  public override destroy(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    super.destroy();
  }

  // ─── Data fetch ─────────────────────────────────────────────────────────────

  private async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    if (!this.lastData) {
      this.setContent(this.renderLoading());
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(toRuntimeUrl('/api/insight-briefing'), { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: InsightBriefingResponse = await res.json();
      this.lastData = data;
      this.render(data);
    } catch (err) {
      if (this.lastData) {
        // Keep stale data, just show warning
        this.render(this.lastData, true);
      } else {
        this.setContent(this.renderError(err instanceof Error ? err.message : '연결 오류'));
      }
    } finally {
      this.loading = false;
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private render(data: InsightBriefingResponse, stale = false): void {
    const html = [
      this.renderGauge(data.globalRiskScore, data.riskLabel),
      stale ? '<div class="mentat-stale-warn">⚠ 데이터 갱신 실패 — 이전 데이터 표시 중</div>' : '',
      data.staleWarnings?.length
        ? `<div class="mentat-stale-warn">${escapeHtml(data.staleWarnings.join(' | '))}</div>`
        : '',
      this.renderNarrative(data.narrativeKo, data.narrativeMethod),
      this.renderInferences(data.topInferences),
      this.renderMarketOutlook(data.marketOutlook),
      this.renderSignalFooter(data),
    ].join('');

    this.setContent(html);
  }

  // ── Risk gauge ───────────────────────────────────────────────────────────────

  private renderGauge(score: number, label: string): string {
    const pct = Math.max(0, Math.min(100, score));
    const color = pct >= 80 ? '#ef4444'
      : pct >= 60 ? '#f97316'
      : pct >= 40 ? '#eab308'
      : pct >= 20 ? '#22c55e'
      :              '#3b82f6';

    // Arc SVG: 180° gauge
    const R = 54;
    const cx = 70;
    const cy = 65;
    const startAngle = Math.PI;
    const endAngle = 0;
    const angle = startAngle + (endAngle - startAngle) * (1 - pct / 100);
    const x = cx + R * Math.cos(angle);
    const y = cy + R * Math.sin(angle);
    const largeArc = angle - startAngle > Math.PI ? 1 : 0;

    const trackPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
    const fillPath  = pct > 0
      ? `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`
      : '';

    return `
      <div class="mentat-gauge-wrap">
        <svg width="140" height="80" viewBox="0 0 140 80" class="mentat-gauge-svg">
          <path d="${trackPath}" fill="none" stroke="var(--panel-bg, #1e1e2e)" stroke-width="10" opacity="0.3"/>
          ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/>` : ''}
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="${color}" font-size="22" font-weight="700">${pct}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="var(--text-secondary, #aaa)" font-size="10">${escapeHtml(label)}</text>
        </svg>
        <div class="mentat-gauge-label">글로벌 위협 지수</div>
      </div>
    `;
  }

  // ── Narrative ─────────────────────────────────────────────────────────────────

  private renderNarrative(text: string, method: 'llm' | 'template'): string {
    const badge = method === 'llm'
      ? '<span class="mentat-badge mentat-badge-ai">AI 생성</span>'
      : '<span class="mentat-badge mentat-badge-tmpl">템플릿</span>';
    return `
      <div class="mentat-section mentat-narrative">
        <div class="mentat-section-head">브리핑 ${badge}</div>
        <div class="mentat-narrative-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }

  // ── Inference cards ───────────────────────────────────────────────────────────

  private renderInferences(inferences: InferenceResult[]): string {
    if (!inferences || inferences.length === 0) return '';

    const cards = inferences.slice(0, 5).map(inf => {
      const sevClass = SEVERITY_CLASS[inf.severity] ?? 'mentat-inf-info';
      const icon = SEVERITY_ICON[inf.severity] ?? 'ℹ️';
      const kospiRange = inf.expectedImpact?.kospiRange;
      const kospiText = kospiRange
        ? `코스피 ${kospiRange[0]}~${kospiRange[1]}%`
        : '';

      return `
        <div class="mentat-inf-card ${sevClass}">
          <div class="mentat-inf-title">${icon} ${escapeHtml(inf.titleKo)}</div>
          <div class="mentat-inf-summary">${escapeHtml(inf.summaryKo)}</div>
          ${inf.suggestedActionKo
            ? `<div class="mentat-inf-action">💡 ${escapeHtml(inf.suggestedActionKo)}</div>`
            : ''}
          <div class="mentat-inf-meta">
            ${kospiText ? `<span>${escapeHtml(kospiText)}</span>` : ''}
            <span class="mentat-conf">신뢰도 ${Math.round(inf.confidence * 100)}%</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="mentat-section">
        <div class="mentat-section-head">인퍼런스 분석 (${inferences.length})</div>
        <div class="mentat-inf-list">${cards}</div>
      </div>
    `;
  }

  // ── Market outlook ─────────────────────────────────────────────────────────────

  private renderMarketOutlook(outlook: InsightBriefingResponse['marketOutlook']): string {
    if (!outlook) return '';

    const sentClass = SENTIMENT_CLASS[outlook.kospiSentiment] ?? 'mentat-neutral';
    const sentLabel = SENTIMENT_KO[outlook.kospiSentiment] ?? '중립';

    const risks = outlook.keyRisks?.slice(0, 3)
      .map(r => `<li>${escapeHtml(r)}</li>`).join('') ?? '';
    const hedges = outlook.hedgeSuggestions?.slice(0, 3)
      .map(h => `<span class="mentat-tag">${escapeHtml(h)}</span>`).join('') ?? '';

    return `
      <div class="mentat-section mentat-outlook">
        <div class="mentat-section-head">마켓 아웃룩</div>
        <div class="mentat-outlook-grid">
          <div class="mentat-outlook-row">
            <span class="mentat-outlook-label">코스피</span>
            <span class="mentat-sentiment ${sentClass}">${sentLabel}</span>
          </div>
          ${risks ? `
          <div class="mentat-outlook-row mentat-risk-list">
            <span class="mentat-outlook-label">핵심 위험</span>
            <ul class="mentat-risks">${risks}</ul>
          </div>` : ''}
          ${hedges ? `
          <div class="mentat-outlook-row">
            <span class="mentat-outlook-label">헤지 제안</span>
            <div class="mentat-hedges">${hedges}</div>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  // ── Footer ────────────────────────────────────────────────────────────────────

  private renderSignalFooter(data: InsightBriefingResponse): string {
    const s = data.signalSummary;
    const ts = data.generatedAt
      ? new Date(data.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const topEnts = (s.topEntities ?? []).slice(0, 4)
      .map(e => `<span class="mentat-ent-tag">${escapeHtml(e.nameKo)} <em>${e.fusedStrength}</em></span>`)
      .join('');

    return `
      <div class="mentat-footer">
        <div class="mentat-footer-row">
          <span class="mentat-footer-label">신호 ${s.total ?? 0}개</span>
          ${s.bySeverity?.CRITICAL ? `<span class="mentat-badge mentat-badge-crit">🚨 ${s.bySeverity.CRITICAL}</span>` : ''}
          ${s.bySeverity?.ELEVATED ? `<span class="mentat-badge mentat-badge-elev">⚠️ ${s.bySeverity.ELEVATED}</span>` : ''}
          ${s.bySeverity?.WATCH    ? `<span class="mentat-badge mentat-badge-watch">👁️ ${s.bySeverity.WATCH}</span>` : ''}
          <span class="mentat-footer-ts">${ts}</span>
        </div>
        ${topEnts ? `<div class="mentat-top-ents">${topEnts}</div>` : ''}
      </div>
    `;
  }

  // ── States ────────────────────────────────────────────────────────────────────

  private renderLoading(): string {
    return `
      <div class="mentat-loading">
        <div class="mentat-loading-spinner"></div>
        <div class="mentat-loading-text">인사이트 분석 중…</div>
      </div>
    `;
  }

  private renderError(msg: string): string {
    return `
      <div class="mentat-error">
        <div class="mentat-error-icon">⚠️</div>
        <div class="mentat-error-text">브리핑 로드 실패</div>
        <div class="mentat-error-sub">${escapeHtml(msg)}</div>
      </div>
    `;
  }
}
