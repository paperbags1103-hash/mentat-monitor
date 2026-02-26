/**
 * AlertPanel — 가격 알림 + 지정학 트리거
 * - 가격 목표 알림 (> or < 타겟)
 * - 위협 등급 변화 알림 (ELEVATED, CRITICAL)
 * - Tauri notification API 연동 (데스크탑 알림)
 * - Web Notification API 폴백
 */
import { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '@/store';
import { apiFetch } from '@/store';

type AlertCondition = 'price_above' | 'price_below' | 'risk_above' | 'pct_change' | 'vix_above' | 'krw_above' | 'kospi_below';
type AlertStatus = 'active' | 'triggered' | 'dismissed';

export interface PriceAlert {
  id: string;
  type: AlertCondition;
  symbol?: string;
  nameKo: string;
  targetValue: number;
  direction?: 'above' | 'below';
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
}

interface AlertState {
  alerts: PriceAlert[];
  addAlert: (a: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set) => ({
      alerts: [],
      addAlert: (a) => set(s => ({
        alerts: [...s.alerts, { ...a, id: `alert-${Date.now()}`, createdAt: Date.now(), status: 'active' }],
      })),
      removeAlert: (id) => set(s => ({ alerts: s.alerts.filter(a => a.id !== id) })),
      triggerAlert: (id) => set(s => ({
        alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'triggered', triggeredAt: Date.now() } : a),
      })),
      dismissAlert: (id) => set(s => ({
        alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'dismissed' } : a),
      })),
    }),
    { name: 'mentat-alerts-v1' }
  )
);

// ── Notification helper ────────────────────────────────────────────────────

async function sendNotification(title: string, body: string) {
  // Tauri: use invoke directly if available
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:notification|notify', { title, body });
      return;
    } catch { /* fallback to web notification */ }
  }
  // Web Notification
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification(title, { body });
    }
  }
}

// ── Alert checker hook ─────────────────────────────────────────────────────

export function useAlertChecker() {
  const { globalRiskScore, vix, kospi, usdkrw, briefing } = useStore();
  const { alerts, triggerAlert } = useAlertStore();
  const prevRisk    = useRef(globalRiskScore);
  const prevVix     = useRef(vix?.price ?? 0);
  const prevKospi   = useRef(kospi?.price ?? 0);
  const prevKrw     = useRef(usdkrw?.rate ?? 0);
  const prevBriefId = useRef<number | null>(null);

  // ── 리스크 지수 알림 ────────────────────────────────────────────────────────
  useEffect(() => {
    alerts.filter(a => a.status === 'active' && a.type === 'risk_above').forEach(alert => {
      if (globalRiskScore >= alert.targetValue && prevRisk.current < alert.targetValue) {
        triggerAlert(alert.id);
        void sendNotification(`🚨 위협 등급 경고 — Mentat`, `${alert.nameKo}: 리스크 ${globalRiskScore} (임계값 ${alert.targetValue})`);
      }
    });
    prevRisk.current = globalRiskScore;
  }, [globalRiskScore, alerts, triggerAlert]);

  // ── VIX 임계값 알림 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const curVix = vix?.price ?? 0;
    alerts.filter(a => a.status === 'active' && a.type === 'vix_above').forEach(alert => {
      if (curVix >= alert.targetValue && prevVix.current < alert.targetValue) {
        triggerAlert(alert.id);
        void sendNotification(`😱 VIX 공포 경보 — Mentat`, `VIX ${curVix.toFixed(1)} (임계값 ${alert.targetValue} 초과) — 시장 공포 구간`);
      }
    });
    prevVix.current = curVix;
  }, [vix, alerts, triggerAlert]);

  // ── KOSPI 하락 알림 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const curKospi = kospi?.price ?? 0;
    alerts.filter(a => a.status === 'active' && a.type === 'kospi_below').forEach(alert => {
      if (curKospi > 0 && curKospi <= alert.targetValue && prevKospi.current > alert.targetValue) {
        triggerAlert(alert.id);
        void sendNotification(`📉 KOSPI 하락 경보 — Mentat`, `KOSPI ${curKospi.toLocaleString('ko-KR')} (임계값 ${alert.targetValue.toLocaleString()} 이하)`);
      }
    });
    prevKospi.current = curKospi;
  }, [kospi, alerts, triggerAlert]);

  // ── USD/KRW 급등 알림 ───────────────────────────────────────────────────────
  useEffect(() => {
    const curKrw = usdkrw?.rate ?? 0;
    alerts.filter(a => a.status === 'active' && a.type === 'krw_above').forEach(alert => {
      if (curKrw >= alert.targetValue && prevKrw.current < alert.targetValue) {
        triggerAlert(alert.id);
        void sendNotification(`💸 원화 약세 경보 — Mentat`, `USD/KRW ₩${curKrw.toFixed(0)} (임계값 ₩${alert.targetValue} 돌파)`);
      }
    });
    prevKrw.current = curKrw;
  }, [usdkrw, alerts, triggerAlert]);

  // ── 새 CRITICAL 인퍼런스 감지 ───────────────────────────────────────────────
  useEffect(() => {
    if (!briefing) return;
    const genAt = briefing.generatedAt;
    if (prevBriefId.current !== null && genAt !== prevBriefId.current) {
      const criticals = briefing.topInferences.filter(i => i.severity === 'CRITICAL');
      if (criticals.length > 0) {
        void sendNotification(
          `🔴 CRITICAL 신호 감지 — Mentat`,
          criticals.slice(0, 2).map(i => i.titleKo).join(' / ')
        );
      }
    }
    prevBriefId.current = genAt;
  }, [briefing]);
}

// ── Add Alert Form ─────────────────────────────────────────────────────────

const QUICK_ALERTS: { type: AlertCondition; nameKo: string; targetValue: number; emoji: string }[] = [
  { type: 'risk_above',   nameKo: '위험 리스크 경보',  targetValue: 70,   emoji: '🚨' },
  { type: 'risk_above',   nameKo: '심각 리스크 경보',  targetValue: 85,   emoji: '🔴' },
  { type: 'vix_above',    nameKo: 'VIX 공포 구간',    targetValue: 25,   emoji: '😱' },
  { type: 'vix_above',    nameKo: 'VIX 극도 공포',    targetValue: 35,   emoji: '🆘' },
  { type: 'krw_above',    nameKo: '원화 약세 경보',    targetValue: 1450, emoji: '💸' },
  { type: 'krw_above',    nameKo: '원화 위기 경보',    targetValue: 1500, emoji: '🚑' },
  { type: 'kospi_below',  nameKo: 'KOSPI 하락 경보',  targetValue: 2400, emoji: '📉' },
  { type: 'kospi_below',  nameKo: 'KOSPI 급락 경보',  targetValue: 2200, emoji: '💥' },
];

function AddAlertForm({ onClose }: { onClose: () => void }) {
  const addAlert = useAlertStore(s => s.addAlert);
  const [type, setType]     = useState<AlertCondition>('price_above');
  const [symbol, setSymbol] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [target, setTarget] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameKo || !target) return;
    addAlert({ type, symbol: symbol || undefined, nameKo, targetValue: parseFloat(target) });
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form className="bg-panel border border-border rounded-lg w-full max-w-sm shadow-2xl p-5"
        onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3 className="text-sm font-bold text-primary mb-4">알림 추가</h3>

        {/* Quick presets */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {QUICK_ALERTS.map((qa, i) => (
            <button key={i} type="button"
              onClick={() => { setType(qa.type); setNameKo(qa.nameKo); setTarget(String(qa.targetValue)); }}
              className="text-xs px-2 py-1 rounded bg-surface border border-border hover:border-accent/60 text-secondary text-left leading-tight">
              {qa.emoji} {qa.nameKo}
              <span className="text-muted ml-1">{qa.targetValue}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-muted block mb-1">알림 유형</label>
            <select value={type} onChange={e => setType(e.target.value as AlertCondition)}
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none">
              <option value="risk_above">🚨 리스크 지수 이상</option>
              <option value="vix_above">😱 VIX 이상</option>
              <option value="krw_above">💸 USD/KRW 이상</option>
              <option value="kospi_below">📉 KOSPI 이하</option>
              <option value="price_above">↑ 가격 이상</option>
              <option value="price_below">↓ 가격 이하</option>
              <option value="pct_change">± 변동률 초과</option>
            </select>
          </div>
          {(type === 'price_above' || type === 'price_below' || type === 'pct_change') && (
            <div>
              <label className="text-xs text-muted block mb-1">종목코드</label>
              <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="^KS11"
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted block mb-1">알림명 *</label>
            <input value={nameKo} onChange={e => setNameKo(e.target.value)} placeholder="KOSPI 3000 돌파"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">임계값 *</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="3000"
              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 text-muted hover:text-primary">취소</button>
          <button type="submit" className="text-xs px-4 py-1.5 bg-accent text-white rounded hover:bg-accent/80 font-semibold">추가</button>
        </div>
      </form>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<AlertCondition, string> = {
  price_above:  '↑ 가격 이상',
  price_below:  '↓ 가격 이하',
  risk_above:   '🚨 리스크 이상',
  pct_change:   '± 변동률',
  vix_above:    '😱 VIX 이상',
  krw_above:    '💸 USD/KRW 이상',
  kospi_below:  '📉 KOSPI 이하',
};

const STATUS_CLS: Record<AlertStatus, string> = {
  active:    'border-border',
  triggered: 'border-risk-critical/60 bg-risk-critical/5',
  dismissed: 'border-border/30 opacity-40',
};

export function AlertPanel() {
  const { alerts, removeAlert, dismissAlert } = useAlertStore();
  const { globalRiskScore } = useStore();
  const [showAdd, setShowAdd] = useState(false);

  // Install alert checker
  useAlertChecker();

  const activeCount    = alerts.filter(a => a.status === 'active').length;
  const triggeredCount = alerts.filter(a => a.status === 'triggered').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">알림</span>
          {triggeredCount > 0 && (
            <span className="text-xs bg-risk-critical/20 text-risk-critical px-1.5 py-0.5 rounded font-bold animate-pulse">
              {triggeredCount} 발동!
            </span>
          )}
          {activeCount > 0 && (
            <span className="text-xs text-muted">{activeCount}개 활성</span>
          )}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="text-xs px-2 py-0.5 bg-accent/20 text-accent-light border border-accent/30 rounded hover:bg-accent/30 font-semibold">
          + 알림
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* Current risk bar */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
          <span className="text-xs text-muted">현재 리스크</span>
          <span className="text-xs font-bold text-primary tabular-nums">{globalRiskScore}</span>
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${globalRiskScore}%`,
                backgroundColor: globalRiskScore >= 70 ? '#ef4444' : globalRiskScore >= 40 ? '#f97316' : '#4ade80',
              }} />
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <span className="text-xl">🔔</span>
            <p className="text-xs text-muted">알림이 없습니다<br/>리스크 또는 가격 알림을 추가하세요</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`border rounded p-2.5 mb-2 transition-colors ${STATUS_CLS[alert.status]}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-muted">{TYPE_LABEL[alert.type]}</span>
                    <span className="text-xs font-bold text-primary">{alert.nameKo}</span>
                    {alert.status === 'triggered' && (
                      <span className="text-xs bg-risk-critical/20 text-risk-critical px-1 rounded font-bold">발동!</span>
                    )}
                  </div>
                  <p className="text-xs text-secondary mt-0.5">임계값: {alert.targetValue.toLocaleString()}</p>
                  {alert.triggeredAt && (
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(alert.triggeredAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {alert.status === 'triggered' && (
                    <button onClick={() => dismissAlert(alert.id)} className="text-xs text-muted hover:text-primary">확인</button>
                  )}
                  <button onClick={() => removeAlert(alert.id)} className="text-xs text-muted hover:text-risk-critical">✕</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && <AddAlertForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
