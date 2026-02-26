/**
 * PortfolioPanel — 포트폴리오 트래킹 (v2)
 *
 * 탭 3개:
 * - 💼 보유종목: P&L 실시간 추적
 * - 🏭 섹터분산: 섹터별 비중 바차트
 * - 🌍 지정학리스크: 보유종목 × 지정학 위협 노출도
 */
import { useState, useEffect, useMemo } from 'react';
import { usePortfolioStore, type HoldingWithPnL } from '@/store/portfolio';
import { useStore } from '@/store';

// ─── 섹터 매핑 ─────────────────────────────────────────────────────────────
const SECTOR_MAP: Record<string, { sector: string; color: string }> = {
  '005930.KS': { sector: '반도체', color: '#6366f1' },
  '000660.KS': { sector: '반도체', color: '#6366f1' },
  '012450.KS': { sector: '방산',   color: '#ef4444' },
  '047810.KS': { sector: '방산',   color: '#ef4444' },
  '034020.KS': { sector: '에너지', color: '#f97316' },
  '009830.KS': { sector: '에너지', color: '#f97316' },
  '051910.KS': { sector: '화학/배터리', color: '#22c55e' },
  '006400.KS': { sector: '화학/배터리', color: '#22c55e' },
  '003670.KS': { sector: '화학/배터리', color: '#22c55e' },
  '005380.KS': { sector: '자동차', color: '#eab308' },
  '000270.KS': { sector: '자동차', color: '#eab308' },
  '329180.KS': { sector: '조선',   color: '#06b6d4' },
  '009540.KS': { sector: '조선',   color: '#06b6d4' },
  '035420.KS': { sector: 'IT/플랫폼', color: '#8b5cf6' },
  '035720.KS': { sector: 'IT/플랫폼', color: '#8b5cf6' },
  '047050.KS': { sector: '철강',   color: '#94a3b8' },
  '005490.KS': { sector: '철강',   color: '#94a3b8' },
  '003490.KS': { sector: '항공',   color: '#f43f5e' },
  '020560.KS': { sector: '항공',   color: '#f43f5e' },
  '030200.KS': { sector: '통신',   color: '#64748b' },
  '017670.KS': { sector: '통신',   color: '#64748b' },
  'NVDA':    { sector: '반도체/AI', color: '#a78bfa' },
  'AMD':     { sector: '반도체/AI', color: '#a78bfa' },
  'TSM':     { sector: '반도체',   color: '#6366f1' },
  'TSLA':    { sector: '전기차',   color: '#4ade80' },
  'AAPL':    { sector: 'IT/소비재', color: '#94a3b8' },
  'MSFT':    { sector: 'IT/클라우드', color: '#60a5fa' },
  'GOOGL':   { sector: 'IT/광고',  color: '#facc15' },
  'AMZN':    { sector: 'IT/커머스', color: '#fb923c' },
  'META':    { sector: 'IT/소셜',  color: '#3b82f6' },
  'PLTR':    { sector: 'AI/데이터', color: '#d946ef' },
  'TLT':     { sector: '채권',     color: '#94a3b8' },
  'GLD':     { sector: '원자재/금', color: '#fbbf24' },
  'GC=F':    { sector: '원자재/금', color: '#fbbf24' },
  'CL=F':    { sector: '원자재/유가', color: '#f97316' },
  'BTC-USD': { sector: '암호화폐', color: '#f59e0b' },
  'BTC-KRW': { sector: '암호화폐', color: '#f59e0b' },
  'ETH-USD': { sector: '암호화폐', color: '#818cf8' },
  'FXI':     { sector: 'ETF/중국', color: '#ef4444' },
  'HYG':     { sector: 'ETF/채권', color: '#64748b' },
};
const DEFAULT_SECTOR = { sector: '기타', color: '#475569' };

function getSector(symbol: string) {
  return SECTOR_MAP[symbol] ?? DEFAULT_SECTOR;
}

// ─── 지정학 노출 매핑 ─────────────────────────────────────────────────────────
// symbol → 영향받는 핫스팟 ID 목록 + 영향 강도(0~1)
const GEO_EXPOSURE: Record<string, { hotspot: string; weight: number; reason: string }[]> = {
  '005930.KS': [
    { hotspot: 'korean_peninsula', weight: 0.9, reason: '국내 본사 + 생산기지' },
    { hotspot: 'taiwan_strait',    weight: 0.7, reason: 'TSMC 경쟁/협력 관계, 반도체 공급망' },
    { hotspot: 'beijing',          weight: 0.5, reason: '중국 매출 비중 15-20%' },
  ],
  '000660.KS': [
    { hotspot: 'korean_peninsula', weight: 0.9, reason: '국내 생산기지 집중' },
    { hotspot: 'taiwan_strait',    weight: 0.8, reason: 'HBM 공급망, 반도체 지정학' },
  ],
  '012450.KS': [
    { hotspot: 'korean_peninsula', weight: 0.9, reason: '방산 수요 직결' },
    { hotspot: 'north_korea',      weight: 0.8, reason: '북한 도발 시 직접 수혜' },
  ],
  '047810.KS': [
    { hotspot: 'korean_peninsula', weight: 0.9, reason: '방산 수요 직결' },
    { hotspot: 'middle_east',      weight: 0.4, reason: '중동 수출 확대 중' },
  ],
  '034020.KS': [
    { hotspot: 'middle_east',      weight: 0.5, reason: '원전 수주 경쟁' },
    { hotspot: 'korean_peninsula', weight: 0.6, reason: '국내 에너지 정책 의존' },
  ],
  '051910.KS': [
    { hotspot: 'beijing',          weight: 0.6, reason: '중국 배터리 경쟁 노출' },
    { hotspot: 'middle_east',      weight: 0.4, reason: '납사 원재료 가격 연동' },
  ],
  '006400.KS': [
    { hotspot: 'beijing',          weight: 0.6, reason: '중국 배터리 시장 경쟁' },
    { hotspot: 'middle_east',      weight: 0.3, reason: '원자재 가격 연동' },
  ],
  '005380.KS': [
    { hotspot: 'new_york',         weight: 0.6, reason: '미국 관세/무역 정책 직접 영향' },
    { hotspot: 'beijing',          weight: 0.5, reason: '중국 공장 + 판매' },
    { hotspot: 'middle_east',      weight: 0.3, reason: '유가 연동 원가' },
  ],
  '329180.KS': [
    { hotspot: 'south_china_sea',  weight: 0.5, reason: '조선 수주 지역 리스크' },
    { hotspot: 'hormuz',           weight: 0.4, reason: 'LNG 운반선 수요 연동' },
  ],
  '035420.KS': [
    { hotspot: 'korean_peninsula', weight: 0.6, reason: '국내 플랫폼 기업' },
    { hotspot: 'beijing',          weight: 0.4, reason: '중국 서비스 규제 리스크' },
  ],
  'NVDA': [
    { hotspot: 'taiwan_strait',    weight: 0.8, reason: 'TSMC 생산 의존도 90%+' },
    { hotspot: 'beijing',          weight: 0.6, reason: '중국 수출 규제 직격' },
    { hotspot: 'new_york',         weight: 0.5, reason: '연준/달러 연동 미국주' },
  ],
  'TSLA': [
    { hotspot: 'beijing',          weight: 0.7, reason: '상하이 기가팩토리, 중국 매출 20%+' },
    { hotspot: 'new_york',         weight: 0.5, reason: '연준/달러 연동 미국주' },
  ],
  'AAPL': [
    { hotspot: 'beijing',          weight: 0.6, reason: '중국 제조 + 판매 의존' },
    { hotspot: 'new_york',         weight: 0.5, reason: '연준/달러 연동 미국주' },
  ],
  'MSFT': [
    { hotspot: 'new_york',         weight: 0.6, reason: '연준/달러 연동 미국주' },
    { hotspot: 'beijing',          weight: 0.3, reason: '중국 서비스 규제 잠재' },
  ],
  'GC=F': [
    { hotspot: 'middle_east',      weight: 0.8, reason: '지정학 헤지 자산' },
    { hotspot: 'ukraine',          weight: 0.6, reason: '전쟁 리스크 = 금 수요↑' },
    { hotspot: 'new_york',         weight: 0.5, reason: '달러 역상관' },
  ],
  'BTC-USD': [
    { hotspot: 'new_york',         weight: 0.7, reason: '연준 유동성 직결' },
  ],
  'BTC-KRW': [
    { hotspot: 'new_york',         weight: 0.7, reason: '연준 유동성 직결' },
    { hotspot: 'korean_peninsula', weight: 0.3, reason: '김치프리미엄 / 규제 리스크' },
  ],
};

// 핫스팟 레이블
const HOTSPOT_LABELS: Record<string, { name: string; color: string }> = {
  korean_peninsula: { name: '한반도',       color: '#6366f1' },
  taiwan_strait:    { name: '대만해협',     color: '#ef4444' },
  middle_east:      { name: '중동',         color: '#f97316' },
  ukraine:          { name: '우크라이나',   color: '#64748b' },
  south_china_sea:  { name: '남중국해',     color: '#06b6d4' },
  iran:             { name: '이란',         color: '#dc2626' },
  north_korea:      { name: '북한',         color: '#7c3aed' },
  new_york:         { name: '미국 금융',    color: '#3b82f6' },
  beijing:          { name: '중국',         color: '#ef4444' },
  moscow:           { name: '러시아',       color: '#94a3b8' },
  hormuz:           { name: '호르무즈',     color: '#f59e0b' },
};

// ─── 섹터 분산 탭 ──────────────────────────────────────────────────────────
function SectorTab({ holdings }: { holdings: HoldingWithPnL[] }) {
  const usdkrwRate = usePortfolioStore(s => s.usdkrwRate);

  const sectorData = useMemo(() => {
    const map: Record<string, { value: number; color: string; count: number }> = {};
    holdings.forEach(h => {
      const cost = h.avgCost * h.quantity * (h.currency === 'USD' ? usdkrwRate : 1);
      const { sector, color } = getSector(h.symbol);
      if (!map[sector]) map[sector] = { value: 0, color, count: 0 };
      map[sector].value += cost;
      map[sector].count += 1;
    });
    const total = Object.values(map).reduce((s, v) => s + v.value, 0);
    return Object.entries(map)
      .map(([name, { value, color, count }]) => ({
        name, color, count, value,
        pct: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [holdings, usdkrwRate]);

  const fmtKrw = (n: number) =>
    n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` :
    n >= 1e4 ? `${(n / 1e4).toFixed(0)}만` :
    n.toLocaleString('ko-KR');

  if (holdings.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted text-xs">보유 종목을 먼저 추가하세요</div>;
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      <div className="text-xs text-muted uppercase tracking-widest mb-3">섹터별 투자 비중</div>

      {/* 도넛 대신 스택 바 */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {sectorData.map(s => (
          <div key={s.name} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.name} ${s.pct.toFixed(1)}%`} />
        ))}
      </div>

      {/* 섹터 목록 */}
      {sectorData.map(s => (
        <div key={s.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
          <span className="text-xs text-secondary w-28 shrink-0">{s.name}</span>
          {/* bar */}
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.pct}%`, background: s.color }} />
          </div>
          <span className="text-xs font-mono text-primary w-10 text-right">{s.pct.toFixed(1)}%</span>
          <span className="text-xs text-muted w-16 text-right shrink-0">₩{fmtKrw(s.value)}</span>
        </div>
      ))}

      {/* 통화 비중 */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-xs text-muted uppercase tracking-widest mb-2">통화 노출</div>
        {(['KRW', 'USD'] as const).map(cur => {
          const val = holdings.filter(h => h.currency === cur).reduce((s, h) => s + h.avgCost * h.quantity, 0);
          const total = holdings.reduce((s, h) => s + h.avgCost * h.quantity * (h.currency === 'USD' ? usdkrwRate : 1), 0);
          const pct = total > 0 ? (val * (cur === 'USD' ? usdkrwRate : 1) / total) * 100 : 0;
          return (
            <div key={cur} className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-mono w-8 shrink-0 ${cur === 'USD' ? 'text-blue-400' : 'text-accent-light'}`}>{cur}</span>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cur === 'USD' ? '#60a5fa' : '#818cf8' }} />
              </div>
              <span className="text-xs font-mono text-primary w-10 text-right">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 지정학 리스크 탭 ─────────────────────────────────────────────────────────
function GeoRiskTab({ holdings }: { holdings: HoldingWithPnL[] }) {
  const { briefing, globalRiskScore } = useStore();
  const usdkrwRate = usePortfolioStore(s => s.usdkrwRate);
  const inferences = briefing?.topInferences ?? [];

  // 포트폴리오 총 가치 (KRW)
  const totalKrw = useMemo(() =>
    holdings.reduce((s, h) => s + h.avgCost * h.quantity * (h.currency === 'USD' ? usdkrwRate : 1), 0),
    [holdings, usdkrwRate]
  );

  // 핫스팟별 노출 집계
  const hotspotExposure = useMemo(() => {
    const map: Record<string, { exposure: number; holdings: { name: string; weight: number; reason: string }[] }> = {};

    holdings.forEach(h => {
      const geos = GEO_EXPOSURE[h.symbol] ?? [];
      const hCostKrw = h.avgCost * h.quantity * (h.currency === 'USD' ? usdkrwRate : 1);
      const hPct = totalKrw > 0 ? hCostKrw / totalKrw : 0;

      geos.forEach(g => {
        if (!map[g.hotspot]) map[g.hotspot] = { exposure: 0, holdings: [] };
        map[g.hotspot].exposure += hPct * g.weight * 100;
        map[g.hotspot].holdings.push({ name: h.nameKo, weight: g.weight, reason: g.reason });
      });
    });

    // 핫스팟별 현재 위협 점수 (briefing 기반)
    return Object.entries(map).map(([id, { exposure, holdings: hs }]) => {
      const label = HOTSPOT_LABELS[id];
      // 해당 핫스팟의 인퍼런스 매칭 (간단 매핑)
      const matchedInferences = inferences.filter(inf =>
        inf.affectedEntityIds?.some(eid => eid.includes(id.replace('_', ':').replace('_', '')))
      );
      const threatScore = Math.min(100, globalRiskScore * 0.3 + matchedInferences.length * 20);
      const riskExposure = (exposure / 100) * (threatScore / 100) * 100; // 리스크 노출도 (%)

      return {
        id, label: label?.name ?? id, color: label?.color ?? '#64748b',
        exposure: Math.min(100, exposure), threatScore, riskExposure,
        holdings: hs, matchedInferences,
      };
    }).sort((a, b) => b.riskExposure - a.riskExposure);
  }, [holdings, inferences, globalRiskScore, totalKrw, usdkrwRate]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (holdings.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted text-xs">보유 종목을 먼저 추가하세요</div>;
  }

  return (
    <div className="p-3 overflow-y-auto h-full">
      <div className="text-xs text-muted uppercase tracking-widest mb-1">지정학 리스크 노출도</div>
      <p className="text-xs text-muted/60 mb-3">보유 종목 × 지정학 위협 강도 × 비중</p>

      {hotspotExposure.length === 0 && (
        <div className="text-xs text-muted text-center py-8">매핑된 종목 없음<br/>주요 종목 추가 시 분석됩니다</div>
      )}

      {hotspotExposure.map(h => (
        <div key={h.id} className="mb-2">
          <div
            className="flex items-center gap-2 cursor-pointer py-1.5 rounded px-1 hover:bg-surface/60 transition-colors"
            onClick={() => setExpandedId(prev => prev === h.id ? null : h.id)}
          >
            {/* Color dot */}
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: h.color }} />
            <span className="text-xs font-semibold text-primary w-24 shrink-0">{h.label}</span>

            {/* 포트폴리오 노출 바 */}
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${h.exposure}%`, background: h.color, opacity: 0.5 }} />
                </div>
                <span className="text-xs text-muted w-10 text-right">{h.exposure.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${h.riskExposure}%`,
                    background: h.riskExposure > 30 ? '#ef4444' : h.riskExposure > 15 ? '#f97316' : h.color
                  }} />
                </div>
                <span className={`text-xs font-bold w-10 text-right ${
                  h.riskExposure > 30 ? 'text-risk-critical' : h.riskExposure > 15 ? 'text-risk-elevated' : 'text-muted'
                }`}>{h.riskExposure.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* 확장 뷰 */}
          {expandedId === h.id && (
            <div className="ml-4 mt-1 mb-2 px-2 py-2 bg-surface/60 rounded-lg border border-border/40 space-y-1.5">
              {h.matchedInferences.length > 0 && (
                <div className="text-xs text-risk-elevated">⚠ 활성 위협: {h.matchedInferences.map(i => i.titleKo).join(', ')}</div>
              )}
              {h.holdings.map((hh, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-xs font-semibold text-primary shrink-0">{hh.name}</span>
                  <span className="text-xs text-muted/70">— {hh.reason}</span>
                  <span className="text-xs text-secondary ml-auto shrink-0">×{(hh.weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 범례 */}
      <div className="mt-3 pt-3 border-t border-border text-xs text-muted space-y-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-1.5 rounded-full bg-gray-600/50" />
          <span>포트폴리오 노출도 (비중 × 지역 의존도)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-1.5 rounded-full bg-red-500" />
          <span>리스크 노출도 (노출 × 현재 위협 강도)</span>
        </div>
      </div>
    </div>
  );
}

// ─── 보유종목 탭 (기존) ────────────────────────────────────────────────────────
function AddForm({ onClose }: { onClose: () => void }) {
  const addHolding = usePortfolioStore(s => s.addHolding);
  const QUICK_SYMBOLS = [
    { symbol: '005930.KS', nameKo: '삼성전자',   currency: 'KRW' as const },
    { symbol: '000660.KS', nameKo: 'SK하이닉스', currency: 'KRW' as const },
    { symbol: '035420.KS', nameKo: 'NAVER',      currency: 'KRW' as const },
    { symbol: '051910.KS', nameKo: 'LG화학',     currency: 'KRW' as const },
    { symbol: '006400.KS', nameKo: '삼성SDI',    currency: 'KRW' as const },
    { symbol: 'NVDA',      nameKo: '엔비디아',   currency: 'USD' as const },
    { symbol: 'TSLA',      nameKo: '테슬라',     currency: 'USD' as const },
    { symbol: 'AAPL',      nameKo: '애플',       currency: 'USD' as const },
    { symbol: 'MSFT',      nameKo: '마이크로소프트', currency: 'USD' as const },
    { symbol: 'BTC-KRW',   nameKo: '비트코인',   currency: 'KRW' as const },
  ];
  const [symbol, setSymbol]   = useState('');
  const [nameKo, setNameKo]   = useState('');
  const [qty, setQty]         = useState('');
  const [cost, setCost]       = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [note, setNote]       = useState('');

  function fillQuick(q: typeof QUICK_SYMBOLS[number]) {
    setSymbol(q.symbol); setNameKo(q.nameKo); setCurrency(q.currency);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !nameKo || !qty || !cost) return;
    addHolding({ symbol, nameKo, quantity: parseFloat(qty), avgCost: parseFloat(cost), currency, note });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form className="bg-panel border border-border rounded-xl w-full max-w-md shadow-2xl p-5"
        onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3 className="text-sm font-bold text-primary mb-4">보유 종목 추가</h3>
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

function HoldingRow({ h, onRemove, onSelect }: { h: HoldingWithPnL; onRemove: () => void; onSelect?: () => void }) {
  const up = h.pnlPct != null && h.pnlPct >= 0;
  const fmt = (n: number, dec = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: dec });
  const sec = getSector(h.symbol);

  return (
    <div onClick={onSelect} className={`flex items-start gap-2 py-2 border-b border-border/40 last:border-0 group ${onSelect ? 'cursor-pointer hover:bg-surface/60 rounded px-1 transition-colors' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: sec.color }} />
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
      <button onClick={e => { e.stopPropagation(); onRemove(); }} className="text-muted hover:text-risk-critical text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
    </div>
  );
}

// ─── 메인 패널 ─────────────────────────────────────────────────────────────────
type Tab = 'holdings' | 'sector' | 'geo';

export function PortfolioPanel() {
  const { getHoldingsWithPnL, getSummary, fetchPrices, isLoading, lastFetch, removeHolding } = usePortfolioStore();
  const { usdkrw, selectSymbol } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab]         = useState<Tab>('holdings');

  useEffect(() => {
    if (usdkrw?.rate) usePortfolioStore.setState({ usdkrwRate: usdkrw.rate });
  }, [usdkrw?.rate]);

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
        /* 빈 상태 */
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
          <span className="text-2xl">💼</span>
          <div>
            <p className="text-xs font-semibold text-secondary mb-1">포트폴리오 없음</p>
            <p className="text-xs text-muted">보유 종목을 추가하면<br/>실시간 P&L + 섹터분산 + 지정학 리스크를 분석합니다</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 bg-accent text-white rounded font-semibold mt-1">+ 첫 종목 추가</button>
        </div>
      ) : (
        <>
          {/* 요약 헤더 */}
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
            <div className="flex gap-3 mt-1">
              {summary.topGainer?.pnlPct != null && summary.topGainer.pnlPct > 0 && (
                <span className="text-xs text-risk-safe">▲ {summary.topGainer.nameKo} +{summary.topGainer.pnlPct.toFixed(1)}%</span>
              )}
              {summary.topLoser?.pnlPct != null && summary.topLoser.pnlPct < 0 && (
                <span className="text-xs text-risk-critical">▼ {summary.topLoser.nameKo} {summary.topLoser.pnlPct.toFixed(1)}%</span>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-0 border-b border-border shrink-0">
            {([
              ['holdings', '💼 보유종목'],
              ['sector',   '🏭 섹터분산'],
              ['geo',      '🌍 지정학'],
            ] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 text-xs py-1.5 transition-colors border-b-2 ${
                  tab === id ? 'border-accent text-accent-light font-semibold' : 'border-transparent text-muted hover:text-primary'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* 탭 컨텐츠 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === 'holdings' && (
              <div className="overflow-y-auto h-full px-3 py-2">
                {holdings.map(h => (
                  <HoldingRow key={h.id} h={h}
                    onRemove={() => removeHolding?.(h.id)}
                    onSelect={typeof selectSymbol === 'function' ? () => selectSymbol(h.symbol, h.nameKo) : undefined}
                  />
                ))}
              </div>
            )}
            {tab === 'sector' && <SectorTab holdings={holdings} />}
            {tab === 'geo'    && <GeoRiskTab holdings={holdings} />}
          </div>
        </>
      )}

      {showAdd && <AddForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
