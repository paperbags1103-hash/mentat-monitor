/**
 * FearGreedPanel — 공포탐욕지수 + 시장 심리 대시보드
 * VIX, 수익률 곡선, 모멘텀, 안전자산 수요 기반 자체 계산
 * + CNN Fear&Greed API (best-effort)
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { apiFetch } from '@/store';

interface FearGreedData {
  score: number;        // 0-100
  label: string;
  prev: number | null;
  components: Array<{ name: string; score: number; ko: string }>;
  source: 'api' | 'computed';
  updatedAt: number;
}

function computeFromStore(vix: number | null, spread2s10s: number | null, hySpread: number | null, riskScore: number): FearGreedData {
  const components: Array<{ name: string; score: number; ko: string }> = [];
  let total = 0, weight = 0;

  // VIX: higher VIX = more fear (invert: VIX 10=greed 90, VIX 40=fear 10)
  if (vix != null) {
    const vixScore = Math.max(0, Math.min(100, 100 - (vix - 10) * 2.5));
    components.push({ name: 'VIX', score: Math.round(vixScore), ko: '변동성 (VIX)' });
    total += vixScore * 30; weight += 30;
  }

  // Yield curve: inverted = fear
  if (spread2s10s != null) {
    const curveScore = Math.max(0, Math.min(100, 50 + spread2s10s * 25));
    components.push({ name: 'Yield Curve', score: Math.round(curveScore), ko: '수익률 곡선' });
    total += curveScore * 25; weight += 25;
  }

  // HY spread: high spread = fear
  if (hySpread != null) {
    const hyScore = Math.max(0, Math.min(100, 100 - (hySpread - 200) / 6));
    components.push({ name: 'HY Spread', score: Math.round(hyScore), ko: '신용 스프레드' });
    total += hyScore * 25; weight += 25;
  }

  // Geopolitical risk (inverted)
  const geoScore = Math.max(0, 100 - riskScore);
  components.push({ name: 'Geo Risk', score: Math.round(geoScore), ko: '지정학 리스크' });
  total += geoScore * 20; weight += 20;

  const score = weight > 0 ? Math.round(total / weight) : 50;
  const label = score >= 75 ? '극도의 탐욕' : score >= 55 ? '탐욕' : score >= 45 ? '중립' :
                score >= 25 ? '공포' : '극도의 공포';

  return { score, label, prev: null, components, source: 'computed', updatedAt: Date.now() };
}

function ScoreArc({ score }: { score: number }) {
  const color = score >= 75 ? '#4ade80' : score >= 55 ? '#86efac' : score >= 45 ? '#eab308' :
                score >= 25 ? '#f97316' : '#ef4444';
  // SVG arc (semicircle)
  const r = 44;
  const cx = 60, cy = 60;
  const startAngle = -180, range = 180;
  const angle = startAngle + (score / 100) * range;
  const toRad = (a: number) => (a * Math.PI) / 180;
  const x = cx + r * Math.cos(toRad(angle));
  const y = cy + r * Math.sin(toRad(angle));
  const lx = cx + r * Math.cos(toRad(startAngle));
  const ly = cy + r * Math.sin(toRad(startAngle));

  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[140px] mx-auto">
      {/* Background arc */}
      <path d={`M ${lx} ${ly} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#2a2a3f" strokeWidth="8" strokeLinecap="round" />
      {/* Value arc */}
      <path d={`M ${lx} ${ly} A ${r} ${r} 0 ${score >= 50 ? 1 : 0} 1 ${x} ${y}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      {/* Needle dot */}
      <circle cx={x} cy={y} r={4} fill={color} />
      {/* Score */}
      <text x={cx} y={cy + 10} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">{score}</text>
    </svg>
  );
}

export function FearGreedPanel() {
  const { vix, globalRiskScore, globalMacro, creditStress } = useStore();
  const [data, setData] = useState<FearGreedData | null>(null);

  useEffect(() => {
    // Try CNN API (best-effort via proxy)
    apiFetch<{ fear_and_greed?: { score: number; description: string; previous_close: number } }>('/api/fear-greed').then(d => {
      if (d?.fear_and_greed) {
        const fg = d.fear_and_greed;
        setData({
          score: Math.round(fg.score),
          label: fg.description,
          prev: fg.previous_close,
          components: [],
          source: 'api',
          updatedAt: Date.now(),
        });
      }
    }).catch(() => {});

    // Always compute fallback
    const computed = computeFromStore(
      vix?.price ?? null,
      globalMacro?.yieldCurve?.spread2s10s ?? null,
      creditStress?.hySpread ?? null,
      globalRiskScore,
    );
    setData(prev => prev?.source === 'api' ? prev : computed);
  }, [vix, globalRiskScore, globalMacro, creditStress]);

  if (!data) return <div className="flex items-center justify-center h-full text-muted text-xs">계산 중…</div>;

  const color = data.score >= 75 ? 'text-risk-safe' : data.score >= 55 ? 'text-risk-safe' :
                data.score >= 45 ? 'text-risk-watch' : data.score >= 25 ? 'text-risk-elevated' : 'text-risk-critical';

  const change = data.prev != null ? data.score - data.prev : null;

  return (
    <div className="flex flex-col h-full px-3 py-3 overflow-y-auto">
      {/* Arc gauge */}
      <div className="shrink-0 mb-2">
        <ScoreArc score={data.score} />
        <div className="text-center mt-1">
          <p className={`text-sm font-bold ${color}`}>{data.label}</p>
          {change != null && (
            <p className="text-xs text-muted mt-0.5">
              전일 대비 {change > 0 ? '+' : ''}{change.toFixed(0)}
            </p>
          )}
          <p className="text-xs text-muted/60 mt-0.5">
            {data.source === 'api' ? 'CNN F&G' : '자체 계산'}
          </p>
        </div>
      </div>

      {/* Scale */}
      <div className="flex justify-between text-xs mb-3">
        {[['0', '극도의 공포', '#ef4444'], ['25', '공포', '#f97316'], ['50', '중립', '#eab308'], ['75', '탐욕', '#86efac'], ['100', '극도의 탐욕', '#4ade80']].map(([val, lbl, c]) => (
          <div key={val} className="text-center">
            <div className="w-1 h-1 rounded-full mx-auto mb-0.5" style={{ background: c }} />
            <div className="text-muted/60" style={{ fontSize: '9px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Components */}
      {data.components.length > 0 && (
        <>
          <div className="text-xs text-muted uppercase tracking-widest mb-2">구성 요소</div>
          {data.components.map(c => {
            const cColor = c.score >= 70 ? '#4ade80' : c.score >= 50 ? '#eab308' : '#ef4444';
            return (
              <div key={c.name} className="mb-2">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-secondary">{c.ko}</span>
                  <span className="font-bold tabular-nums" style={{ color: cColor }}>{c.score}</span>
                </div>
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: cColor }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
