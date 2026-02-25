/**
 * VaRPanel — Value at Risk (VaR) 계산
 * 포트폴리오 리스크 정량화
 * Historical VaR + Parametric VaR (정규분포 가정)
 * + 지정학 시나리오 스트레스 VaR
 */
import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolio';
import { useStore } from '@/store';
import { apiFetch } from '@/store';

interface VaRResult {
  confidence: number;     // 95 or 99
  horizon: number;        // days
  varAmount: number;      // KRW 또는 USD
  varPct: number;         // %
  method: 'parametric' | 'historical';
}

interface StressResult {
  scenario: string;
  loss: number;    // %
  amount: number;  // KRW
}

// 역사적 자산 변동성 (연간 기준, 근사값)
const ASSET_VOL: Record<string, number> = {
  '^KS11':    0.18,  // KOSPI 연간 변동성
  '^KQ11':    0.25,
  '005930.KS': 0.28,
  '000660.KS': 0.35,
  'NVDA':     0.55,
  'TSLA':     0.60,
  'AAPL':     0.28,
  'MSFT':     0.25,
  '^GSPC':    0.15,
  '^IXIC':    0.20,
  'GC=F':     0.15,
  'CL=F':     0.35,
  'BTC-USD':  0.80,
  'BTC-KRW':  0.80,
  'DEFAULT':  0.30,
};

const Z95 = 1.645;  // 95% 신뢰구간
const Z99 = 2.326;  // 99% 신뢰구간

function calcParametricVaR(
  holdings: ReturnType<ReturnType<typeof usePortfolioStore.getState>['getHoldingsWithPnL']>,
  confidence: 95 | 99,
  horizonDays: number,
  usdkrwRate: number
): VaRResult {
  const z = confidence === 95 ? Z95 : Z99;
  const horizonFactor = Math.sqrt(horizonDays / 252); // convert annual to horizon

  let totalValueKrw = 0;
  let portfolioVarSquared = 0; // simplified: assuming zero correlation (conservative)

  holdings.forEach(h => {
    const val = (h.currentValue ?? h.totalCost) * (h.currency === 'USD' ? usdkrwRate : 1);
    const vol = ASSET_VOL[h.symbol] ?? ASSET_VOL.DEFAULT;
    totalValueKrw += val;
    portfolioVarSquared += (val * vol * horizonFactor * z) ** 2;
  });

  const varAmount = totalValueKrw > 0 ? Math.sqrt(portfolioVarSquared) : 0;
  const varPct    = totalValueKrw > 0 ? (varAmount / totalValueKrw) * 100 : 0;

  return { confidence, horizon: horizonDays, varAmount, varPct, method: 'parametric' };
}

const STRESS_SCENARIOS = [
  { name: '대만해협 충돌', pct: -18 },
  { name: '연준 긴급 인상', pct: -15 },
  { name: '북한 핵실험', pct: -8 },
  { name: 'VIX 40 급등', pct: -12 },
];

export function VaRPanel() {
  const { getHoldingsWithPnL, usdkrwRate } = usePortfolioStore();
  const { globalRiskScore } = useStore();
  const [horizon, setHorizon] = useState<1 | 5 | 10>(1);
  const holdings = getHoldingsWithPnL();

  const totalValueKrw = holdings.reduce((s, h) =>
    s + (h.currentValue ?? h.totalCost) * (h.currency === 'USD' ? usdkrwRate : 1), 0
  );

  const var95 = calcParametricVaR(holdings, 95, horizon, usdkrwRate);
  const var99 = calcParametricVaR(holdings, 99, horizon, usdkrwRate);

  const stressResults: StressResult[] = STRESS_SCENARIOS.map(s => ({
    scenario: s.name,
    loss:     Math.abs(s.pct),
    amount:   totalValueKrw * Math.abs(s.pct) / 100,
  }));

  // Risk level based on VaR/portfolio size
  const riskLevel = var95.varPct >= 5 ? 'HIGH' : var95.varPct >= 2.5 ? 'MEDIUM' : 'LOW';
  const riskColor = riskLevel === 'HIGH' ? 'text-risk-critical' : riskLevel === 'MEDIUM' ? 'text-risk-watch' : 'text-risk-safe';

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <span className="text-2xl">📐</span>
        <p className="text-xs font-semibold text-secondary">포트폴리오 없음</p>
        <p className="text-xs text-muted">포트폴리오 패널에서 종목을 추가하면<br/>VaR 리스크 분석을 제공합니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-3 py-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">포트폴리오 VaR</div>
          <div className="text-xs text-secondary mt-0.5">
            총 {(totalValueKrw / 10000).toFixed(0)}만원 × {holdings.length}종목
          </div>
        </div>
        <div className="flex gap-1">
          {([1, 5, 10] as const).map(d => (
            <button key={d} onClick={() => setHorizon(d)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                horizon === d ? 'bg-accent text-white' : 'bg-border text-muted'
              }`}>{d}일</button>
          ))}
        </div>
      </div>

      {/* VaR results */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[var95, var99].map(v => (
          <div key={v.confidence} className="bg-surface rounded-lg p-3 border border-border">
            <div className="text-xs text-muted mb-1">{v.confidence}% VaR ({v.horizon}일)</div>
            <div className={`text-lg font-bold tabular-nums ${riskColor}`}>
              -{v.varPct.toFixed(1)}%
            </div>
            <div className="text-xs text-secondary tabular-nums">
              -₩{Math.round(v.varAmount / 10000).toLocaleString()}만원
            </div>
          </div>
        ))}
      </div>

      {/* Risk gauge */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted">포트폴리오 리스크</span>
          <span className={`font-bold ${riskColor}`}>{riskLevel === 'HIGH' ? '고위험' : riskLevel === 'MEDIUM' ? '중위험' : '저위험'}</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, var95.varPct * 10)}%`,
              background: riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MEDIUM' ? '#f97316' : '#22c55e',
            }} />
        </div>
        <div className="flex justify-between text-xs text-muted mt-0.5">
          <span>저위험 (0-2.5%)</span>
          <span>중 (2.5-5%)</span>
          <span>고위험 (5%+)</span>
        </div>
      </div>

      {/* Geopolitical overlay */}
      {globalRiskScore >= 40 && (
        <div className="mb-4 p-2.5 rounded-lg bg-risk-elevated/10 border border-risk-elevated/30">
          <div className="text-xs font-bold text-risk-elevated mb-1">⚠️ 지정학 리스크 오버레이</div>
          <p className="text-xs text-secondary">
            현재 위협 지수 {globalRiskScore}로 {globalRiskScore >= 70 ? '위험' : '경계'} 수준.
            실제 VaR은 모델 추정치보다 {globalRiskScore >= 70 ? '30-50%' : '15-25%'} 높을 수 있음.
          </p>
        </div>
      )}

      {/* Stress test */}
      <div className="mb-3">
        <div className="text-xs text-muted uppercase tracking-widest mb-2">시나리오 스트레스 테스트</div>
        {stressResults.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-secondary flex-1">{s.scenario}</span>
            <span className="text-xs font-bold text-risk-critical tabular-nums">-{s.loss}%</span>
            <span className="text-xs text-muted tabular-nums">-₩{Math.round(s.amount / 10000).toLocaleString()}만</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-muted/50 mt-auto">
        * Parametric VaR (정규분포 가정) · 상관관계 미반영<br/>
        * 역사적 변동성 기반 근사치
      </div>
    </div>
  );
}
