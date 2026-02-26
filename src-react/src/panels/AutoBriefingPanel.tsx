import React, { useEffect, useState } from 'react';
import { apiFetch } from '../store';

interface BriefingData {
  headline?: string;
  riskMode?: 'ON' | 'OFF' | 'NEUTRAL';
  riskReason?: string;
  topThreats?: Array<{ title: string; detail: string; affectedKR: string[]; affectedUS: string[] }>;
  opportunities?: Array<{ title: string; detail: string; affectedKR: string[]; affectedUS: string[] }>;
  keyWatchpoints?: string[];
  briefingKo?: string;
  generatedAtKST?: string;
  signalCount?: number;
  cached?: boolean;
  cacheAge?: number;
  error?: string;
}

const BRIEFING_HOURS_KST = [8, 13, 19];

function getNextBriefingTime(): Date {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const kstHour = kstNow.getUTCHours();

  let nextHour = BRIEFING_HOURS_KST.find((h) => h > kstHour);
  if (!nextHour) nextHour = BRIEFING_HOURS_KST[0] + 24;

  const next = new Date(kstNow);
  next.setUTCHours(nextHour % 24, 0, 0, 0);
  if (nextHour >= 24) next.setUTCDate(next.getUTCDate() + 1);
  return new Date(next.getTime() - kstOffset);
}

export default function AutoBriefingPanel() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextTime, setNextTime] = useState<Date>(getNextBriefingTime());

  async function fetchBriefing(forceRefresh = false) {
    setLoading(true);
    try {
      const data = await apiFetch<BriefingData>(`/api/auto-briefing${forceRefresh ? '?refresh=1' : ''}`);
      setBriefing(data ?? { error: '브리핑 생성 실패' });
      setNextTime(getNextBriefingTime());
    } catch {
      setBriefing({ error: '브리핑 생성 실패' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBriefing();
  }, []);

  useEffect(() => {
    const msUntilNext = nextTime.getTime() - Date.now();
    if (msUntilNext <= 0) {
      void fetchBriefing();
      return;
    }
    const t = setTimeout(() => void fetchBriefing(), msUntilNext);
    return () => clearTimeout(t);
  }, [nextTime]);

  const RISK_COLOR: Record<'ON' | 'OFF' | 'NEUTRAL', string> = { ON: '#22c55e', OFF: '#ef4444', NEUTRAL: '#f59e0b' };
  const riskColor = RISK_COLOR[briefing?.riskMode ?? 'NEUTRAL'] ?? '#f59e0b';

  function formatCountdown(date: Date): string {
    const ms = date.getTime() - Date.now();
    if (ms <= 0) return '지금';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  }

  if (loading && !briefing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: '#475569', fontSize: 12 }}>
        <div style={{ fontSize: 20 }}>🧠</div>
        <div>브리핑 생성 중...</div>
        <div style={{ fontSize: 10 }}>70b 모델로 모든 시그널 분석 중</div>
      </div>
    );
  }

  if (!briefing || briefing.error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: '#ef4444', fontSize: 12 }}>{briefing?.error ?? '브리핑 없음'}</div>
        <button onClick={() => void fetchBriefing(true)} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}>
          재시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ padding: '6px 12px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${riskColor}22`, color: riskColor, fontWeight: 800, border: `1px solid ${riskColor}44` }}>
          {briefing.riskMode === 'ON' ? '📈 Risk-On' : briefing.riskMode === 'OFF' ? '🛡️ Risk-Off' : '⚖️ Neutral'}
        </span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{briefing.headline}</span>
        <button
          onClick={() => void fetchBriefing(true)}
          disabled={loading}
          title="지금 재생성"
          style={{ background: 'none', border: '1px solid #334155', color: loading ? '#334155' : '#64748b', borderRadius: 4, padding: '2px 6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 10 }}
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {briefing.briefingKo && (
          <div style={{ lineHeight: 1.7, color: '#cbd5e1', fontSize: 11, padding: '8px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #1e293b' }}>
            {briefing.briefingKo}
          </div>
        )}

        {briefing.riskReason && (
          <div style={{ fontSize: 10, color: riskColor, padding: '5px 8px', background: `${riskColor}11`, borderRadius: 4, border: `1px solid ${riskColor}33` }}>
            {briefing.riskReason}
          </div>
        )}

        {briefing.topThreats && briefing.topThreats.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>⚠️ 주요 위협</div>
            {briefing.topThreats.map((t, i) => (
              <div key={i} style={{ marginBottom: 7, padding: '7px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #ef444433', borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, marginBottom: 5 }}>{t.detail}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {t.affectedKR?.map((s) => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2a3f', color: '#60a5fa', borderRadius: 3, fontWeight: 700 }}>{s}</span>)}
                  {t.affectedUS?.map((s) => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2f1a', color: '#86efac', borderRadius: 3, fontFamily: 'monospace' }}>{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {briefing.opportunities && briefing.opportunities.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>💰 투자 기회</div>
            {briefing.opportunities.map((o, i) => (
              <div key={i} style={{ marginBottom: 7, padding: '7px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #22c55e33', borderLeft: '3px solid #22c55e' }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 3 }}>{o.title}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, marginBottom: 5 }}>{o.detail}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {o.affectedKR?.map((s) => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2a3f', color: '#60a5fa', borderRadius: 3, fontWeight: 700 }}>{s}</span>)}
                  {o.affectedUS?.map((s) => <span key={s} style={{ fontSize: 9, padding: '1px 5px', background: '#1a2f1a', color: '#86efac', borderRadius: 3, fontFamily: 'monospace' }}>{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {briefing.keyWatchpoints && briefing.keyWatchpoints.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>👁️ 주목할 것</div>
            {briefing.keyWatchpoints.map((w, i) => (
              <div key={i} style={{ fontSize: 10, color: '#94a3b8', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                {i + 1}. {w}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '5px 12px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#0a0f1e' }}>
        <span style={{ fontSize: 9, color: '#334155' }}>
          {briefing.generatedAtKST ? `생성: ${briefing.generatedAtKST.slice(5, 16)}` : ''}{briefing.cacheAge ? ` (${briefing.cacheAge}분 전)` : ''}
        </span>
        <span style={{ fontSize: 9, color: '#334155' }}>
          다음: {formatCountdown(nextTime)}
        </span>
      </div>
    </div>
  );
}
