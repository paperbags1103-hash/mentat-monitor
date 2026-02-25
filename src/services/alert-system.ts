/**
 * 3-Tier Alert System — Mentat Monitor Phase 3
 *
 * Monitors all signal sources and dispatches alerts when thresholds cross.
 *
 * Alert tiers:
 *  CRITICAL — Immediate action may be warranted (tailRisk > 80, major geopolitical event)
 *  WATCH    — Elevated situation requiring attention (tailRisk > 40, pattern match spike)
 *  INFO     — Noteworthy but non-urgent (economic calendar, moderate signals)
 *
 * Features:
 * - Deduplication with fingerprint + TTL
 * - Alert queue with priority ordering
 * - Persistent storage via localStorage (Tauri compatible)
 * - Snooze / acknowledge
 */

import type { BlackSwanData } from './blackswan.js';
import type { VipAircraftData } from './vip-aircraft.js';
import type { AggregatedImpact } from './impact-scoring.js';
import type { PortfolioRiskReport } from './portfolio-risk.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertTier = 'CRITICAL' | 'WATCH' | 'INFO';
export type AlertCategory =
  | 'tail_risk'
  | 'vip_aircraft'
  | 'market_stress'
  | 'portfolio_risk'
  | 'pattern_match'
  | 'economic_calendar'
  | 'nk_provocation'
  | 'pandemic_signal'
  | 'nuclear_signal'
  | 'cyber_signal'
  | 'convergence';

export interface Alert {
  id: string;
  fingerprint: string;   // used for dedup
  tier: AlertTier;
  category: AlertCategory;
  title: string;
  titleKo: string;
  body: string;
  bodyKo: string;
  emoji: string;
  timestamp: number;
  expiresAt: number;    // alerts auto-expire
  // State
  acknowledged: boolean;
  snoozedUntil: number | null;
  // Context
  score?: number;
  relatedAssets?: string[];
  actionHint?: string;   // brief actionable advice
  actionHintKo?: string;
}

export interface AlertSystemState {
  alerts: Alert[];
  lastEvaluatedAt: number;
  mutedCategories: Set<AlertCategory>;
  mutedUntil: number | null;
  settings: AlertSettings;
}

export interface AlertSettings {
  criticalThreshold: number;   // tail risk score to trigger CRITICAL (default 80)
  watchThreshold: number;      // tail risk score to trigger WATCH (default 40)
  portfolioRiskThreshold: number; // portfolio risk score to alert (default 60)
  enabledCategories: Set<AlertCategory>;
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mentat_alerts_v1';
const SETTINGS_KEY = 'mentat_alert_settings_v1';

// ─── Default settings ─────────────────────────────────────────────────────────

export function defaultSettings(): AlertSettings {
  return {
    criticalThreshold: 80,
    watchThreshold: 40,
    portfolioRiskThreshold: 60,
    enabledCategories: new Set<AlertCategory>([
      'tail_risk', 'vip_aircraft', 'market_stress', 'portfolio_risk',
      'pattern_match', 'economic_calendar', 'nk_provocation',
      'pandemic_signal', 'nuclear_signal', 'convergence',
    ]),
    soundEnabled: true,
    desktopNotifications: true,
  };
}

// ─── Alert factory helpers ────────────────────────────────────────────────────

function makeId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fingerprint(category: AlertCategory, key: string): string {
  return `${category}:${key}`;
}

function ttlMs(tier: AlertTier): number {
  // CRITICAL: 6h, WATCH: 2h, INFO: 30min
  return tier === 'CRITICAL' ? 6 * 3600_000
    : tier === 'WATCH' ? 2 * 3600_000
    : 30 * 60_000;
}

// ─── Alert generators ─────────────────────────────────────────────────────────

function makeBlackSwanAlert(data: BlackSwanData, settings: AlertSettings): Alert[] {
  const alerts: Alert[] = [];
  const score = data.tailRiskScore;

  if (score >= settings.criticalThreshold) {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('tail_risk', `critical_${Math.floor(score / 10)}`),
      tier: 'CRITICAL',
      category: 'tail_risk',
      title: `⚠️ CRITICAL: Tail Risk Index ${score}/100`,
      titleKo: `⚠️ 위기 경보: 테일 리스크 ${score}/100`,
      body: `Composite tail risk score has reached CRITICAL level (${score}/100). Level: ${data.level}. Immediate review recommended.`,
      bodyKo: `복합 테일 리스크 지수가 위기 수준에 도달했습니다 (${score}/100). 레벨: ${data.label}. 포트폴리오 점검이 필요합니다.`,
      emoji: '🚨',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('CRITICAL'),
      acknowledged: false,
      snoozedUntil: null,
      score,
      actionHint: 'Consider reducing risk exposure and adding safe haven assets (gold, JPY, Treasuries).',
      actionHintKo: '위험자산 비중 축소, 금·단기채 비중 확대 고려. KOSPI/KRW 헤지 포지션 점검.',
    });
  } else if (score >= settings.watchThreshold) {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('tail_risk', `watch_${Math.floor(score / 10)}`),
      tier: 'WATCH',
      category: 'tail_risk',
      title: `🟡 WATCH: Tail Risk ${score}/100 (${data.level})`,
      titleKo: `🟡 주시 모드: 테일 리스크 ${score}/100 (${data.label})`,
      body: `Tail risk elevated. Top contributors: ${data.breakdown.filter(b => b.score > 30).map(b => `${b.emoji}${b.label} (${b.score})`).join(', ')}`,
      bodyKo: `리스크 상승 중. 주요 원인: ${data.breakdown.filter(b => b.score > 30).map(b => `${b.emoji}${b.label} (${b.score}점)`).join(', ')}`,
      emoji: '🟡',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('WATCH'),
      acknowledged: false,
      snoozedUntil: null,
      score,
      actionHint: 'Monitor closely. Review portfolio for elevated risk positions.',
      actionHintKo: '주요 신호 모니터링 강화. 위험 포지션 점검.',
    });
  }

  // Module-specific alerts for very high scores
  const { pandemic, nuclear } = data.modules;
  if (pandemic.score > 60) {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('pandemic_signal', `high_${Math.floor(pandemic.score / 10)}`),
      tier: pandemic.score > 80 ? 'CRITICAL' : 'WATCH',
      category: 'pandemic_signal',
      title: `🦠 Pandemic Signal Elevated (${pandemic.score}/100)`,
      titleKo: `🦠 팬데믹 신호 상승 (${pandemic.score}/100)`,
      body: `ProMED/WHO/news shows elevated pandemic risk indicators.`,
      bodyKo: `ProMED, WHO, 뉴스에서 팬데믹 위험 신호 감지. 항공·관광 섹터 주의.`,
      emoji: '🦠',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('WATCH'),
      acknowledged: false,
      snoozedUntil: null,
      score: pandemic.score,
      actionHintKo: '항공·관광·면세 포지션 점검. 바이오·제약 수혜 가능성 검토.',
    });
  }

  if (nuclear.score > 50) {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('nuclear_signal', `high_${Math.floor(nuclear.score / 10)}`),
      tier: nuclear.score > 70 ? 'CRITICAL' : 'WATCH',
      category: 'nuclear_signal',
      title: `☢️ Nuclear/Radiation Signal (${nuclear.score}/100)`,
      titleKo: `☢️ 핵/방사능 신호 감지 (${nuclear.score}/100)`,
      body: `Nuclear or radiation-related news signals elevated. IAEA or emergency keywords detected.`,
      bodyKo: `IAEA 또는 방사능 관련 긴급 키워드 감지. 원전주·우라늄 영향 가능성.`,
      emoji: '☢️',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('WATCH'),
      acknowledged: false,
      snoozedUntil: null,
      score: nuclear.score,
      actionHintKo: '원전주 포지션 주의. 금·안전자산 수요 증가 가능.',
    });
  }

  return alerts;
}

function makeVipAircraftAlert(data: VipAircraftData): Alert[] {
  const alerts: Alert[] = [];
  if (data.alerts && data.alerts.length > 0) {
    for (const a of data.alerts.slice(0, 3)) {
      alerts.push({
        id: makeId(),
        fingerprint: fingerprint('vip_aircraft', a.icao24),
        tier: a.category === 'military_command' ? 'WATCH' : 'INFO',
        category: 'vip_aircraft',
        title: `✈️ VIP Aircraft: ${a.label}`,
        titleKo: `✈️ VIP 항공기 추적: ${a.label}`,
        body: `${a.label} is airborne${a.lat ? ` (${a.lat.toFixed(1)}°N, ${a.lng?.toFixed(1)}°E)` : ''}. Category: ${a.category}.`,
        bodyKo: `${a.label} 비행 중${a.lat ? ` (${a.lat.toFixed(1)}°N, ${a.lng?.toFixed(1)}°E)` : ''}. 분류: ${a.category}.`,
        emoji: '✈️',
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs('INFO'),
        acknowledged: false,
        snoozedUntil: null,
        actionHintKo: '공군 지휘기 비행은 군사 긴장의 간접 지표일 수 있음.',
      });
    }
  }
  return alerts;
}

function makeMarketStressAlert(impact: AggregatedImpact): Alert[] {
  const alerts: Alert[] = [];

  if (impact.koreanMarketRisk === 'CRITICAL') {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('market_stress', `critical_${Math.round(impact.kospiComposite)}`),
      tier: 'CRITICAL',
      category: 'market_stress',
      title: '📉 Korean Market: CRITICAL Event Impact',
      titleKo: '📉 한국 시장 위험: 복합 이벤트 CRITICAL',
      body: `Composite KOSPI impact score: ${impact.kospiComposite}/10. KRW impact: ${impact.krwComposite}/10. Safe haven demand: ${impact.safeHavenPressure}%.`,
      bodyKo: `복합 KOSPI 영향 점수: ${impact.kospiComposite}/10. KRW 영향: ${impact.krwComposite}/10. 안전자산 선호도: ${impact.safeHavenPressure}%.`,
      emoji: '📉',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('CRITICAL'),
      acknowledged: false,
      snoozedUntil: null,
      score: Math.abs(impact.kospiComposite) * 10,
      relatedAssets: ['^KS11', 'KRW=X'],
      actionHintKo: `한국 자산 비중 축소 고려. ${impact.safeHavenPressure > 50 ? '금·엔화 헤지 강화.' : ''}`,
    });
  } else if (impact.koreanMarketRisk === 'HIGH') {
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('market_stress', `high_${Math.round(impact.kospiComposite)}`),
      tier: 'WATCH',
      category: 'market_stress',
      title: '⚠️ Korean Market: High Event Risk',
      titleKo: '⚠️ 한국 시장 주의: 복합 이벤트 HIGH',
      body: `Multiple bearish signals converging on Korean assets. KOSPI impact: ${impact.kospiComposite}/10.`,
      bodyKo: `한국 자산에 복수의 약세 신호 집중. KOSPI 영향: ${impact.kospiComposite}/10.`,
      emoji: '⚠️',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs('WATCH'),
      acknowledged: false,
      snoozedUntil: null,
      score: Math.abs(impact.kospiComposite) * 10,
      relatedAssets: ['^KS11', 'KRW=X'],
    });
  }

  return alerts;
}

function makePortfolioRiskAlert(report: PortfolioRiskReport, settings: AlertSettings): Alert[] {
  const alerts: Alert[] = [];

  if (report.totalRiskScore >= settings.portfolioRiskThreshold) {
    const tier: AlertTier = report.totalRiskScore >= 80 ? 'CRITICAL' : 'WATCH';
    alerts.push({
      id: makeId(),
      fingerprint: fingerprint('portfolio_risk', `${Math.floor(report.totalRiskScore / 10)}`),
      tier,
      category: 'portfolio_risk',
      title: `💼 Portfolio Risk: ${report.riskLevel} (${report.totalRiskScore}/100)`,
      titleKo: `💼 포트폴리오 위험: ${report.riskLevel} (${report.totalRiskScore}/100)`,
      body: report.summaryKo,
      bodyKo: report.summaryKo,
      emoji: '💼',
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs(tier),
      acknowledged: false,
      snoozedUntil: null,
      score: report.totalRiskScore,
      relatedAssets: report.topRiskPositions.map(p => p.symbol),
      actionHintKo: (() => {
        const first = report.hedgeSuggestions[0];
        return first ? `헤지 제안: ${first.assetKo} (${first.allocationSuggestion})` : '위험 포지션 점검 필요';
      })(),
    });
  }

  return alerts;
}

// ─── Alert Manager ────────────────────────────────────────────────────────────

export class AlertManager {
  private state: AlertSystemState;
  private settings: AlertSettings;
  private listeners: Array<(alerts: Alert[]) => void> = [];

  constructor() {
    this.settings = this.loadSettings();
    this.state = {
      alerts: this.loadAlerts(),
      lastEvaluatedAt: 0,
      mutedCategories: new Set(),
      mutedUntil: null,
      settings: this.settings,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Evaluate all signal sources and generate new alerts */
  evaluate(params: {
    blackSwan?: BlackSwanData;
    vipAircraft?: VipAircraftData;
    aggregatedImpact?: AggregatedImpact;
    portfolioRisk?: PortfolioRiskReport;
  }): Alert[] {
    const newAlerts: Alert[] = [];

    if (params.blackSwan) {
      newAlerts.push(...makeBlackSwanAlert(params.blackSwan, this.settings));
    }
    if (params.vipAircraft) {
      newAlerts.push(...makeVipAircraftAlert(params.vipAircraft));
    }
    if (params.aggregatedImpact) {
      newAlerts.push(...makeMarketStressAlert(params.aggregatedImpact));
    }
    if (params.portfolioRisk) {
      newAlerts.push(...makePortfolioRiskAlert(params.portfolioRisk, this.settings));
    }

    // Deduplication and filter
    const dedupedAlerts = this.dedup(newAlerts);
    const now = Date.now();

    this.state.alerts = [
      // Keep existing alerts that haven't expired or been acknowledged
      ...this.state.alerts.filter(a => !a.acknowledged && a.expiresAt > now && (a.snoozedUntil === null || a.snoozedUntil < now)),
      ...dedupedAlerts,
    ];

    // Sort: CRITICAL first, then WATCH, then INFO; newest first within tier
    this.state.alerts.sort((a, b) => {
      const tierOrder = { CRITICAL: 0, WATCH: 1, INFO: 2 };
      if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
      return b.timestamp - a.timestamp;
    });

    this.state.lastEvaluatedAt = now;
    this.persist();
    this.notifyListeners();

    return dedupedAlerts;
  }

  /** Get all active (non-expired, non-acknowledged, non-snoozed) alerts */
  getActive(): Alert[] {
    const now = Date.now();
    return this.state.alerts.filter(a =>
      !a.acknowledged &&
      a.expiresAt > now &&
      (a.snoozedUntil === null || a.snoozedUntil <= now) &&
      this.settings.enabledCategories.has(a.category) &&
      !this.state.mutedCategories.has(a.category) &&
      (this.state.mutedUntil === null || this.state.mutedUntil <= now)
    );
  }

  /** Get count by tier */
  getCounts(): Record<AlertTier, number> {
    const active = this.getActive();
    return {
      CRITICAL: active.filter(a => a.tier === 'CRITICAL').length,
      WATCH: active.filter(a => a.tier === 'WATCH').length,
      INFO: active.filter(a => a.tier === 'INFO').length,
    };
  }

  acknowledge(alertId: string): void {
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.persist();
      this.notifyListeners();
    }
  }

  acknowledgeAll(): void {
    this.state.alerts.forEach(a => { a.acknowledged = true; });
    this.persist();
    this.notifyListeners();
  }

  snooze(alertId: string, durationMs = 3600_000): void {
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.snoozedUntil = Date.now() + durationMs;
      this.persist();
      this.notifyListeners();
    }
  }

  muteCategory(category: AlertCategory, durationMs?: number): void {
    this.state.mutedCategories.add(category);
    if (durationMs) {
      setTimeout(() => {
        this.state.mutedCategories.delete(category);
        this.notifyListeners();
      }, durationMs);
    }
  }

  muteAll(durationMs = 3600_000): void {
    this.state.mutedUntil = Date.now() + durationMs;
    this.persist();
  }

  updateSettings(partial: Partial<AlertSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.state.settings = this.settings;
    this.saveSettings();
  }

  subscribe(listener: (alerts: Alert[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private dedup(newAlerts: Alert[]): Alert[] {
    const existing = new Set(this.state.alerts.map(a => a.fingerprint));
    return newAlerts.filter(a => !existing.has(a.fingerprint));
  }

  private notifyListeners(): void {
    const active = this.getActive();
    this.listeners.forEach(l => l(active));
  }

  private persist(): void {
    try {
      const serializable = this.state.alerts.map(a => ({ ...a, snoozedUntil: a.snoozedUntil ?? null }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
  }

  private loadAlerts(): Alert[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: Alert[] = JSON.parse(raw);
      const now = Date.now();
      return parsed.filter(a => a.expiresAt > now);
    } catch {
      return [];
    }
  }

  private saveSettings(): void {
    try {
      const serializable = {
        ...this.settings,
        enabledCategories: Array.from(this.settings.enabledCategories),
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(serializable));
    } catch {}
  }

  private loadSettings(): AlertSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const parsed = JSON.parse(raw);
      return {
        ...defaultSettings(),
        ...parsed,
        enabledCategories: new Set(parsed.enabledCategories ?? []),
      };
    } catch {
      return defaultSettings();
    }
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────

let _alertManager: AlertManager | null = null;

export function getAlertManager(): AlertManager {
  if (!_alertManager) {
    _alertManager = new AlertManager();
  }
  return _alertManager;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function alertTierColor(tier: AlertTier): string {
  return tier === 'CRITICAL' ? '#F44336' : tier === 'WATCH' ? '#FF9800' : '#2196F3';
}

export function alertTierBg(tier: AlertTier): string {
  return tier === 'CRITICAL' ? '#FFEBEE' : tier === 'WATCH' ? '#FFF3E0' : '#E3F2FD';
}
