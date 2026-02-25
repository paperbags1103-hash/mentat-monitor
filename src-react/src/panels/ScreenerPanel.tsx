/**
 * ScreenerPanel — 테마 연계 종목 스크리너
 * AI 테마 × 포트폴리오 갭 × 시장 모멘텀 → 관심 종목 자동 서제스트
 */
import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { usePortfolioStore } from '@/store/portfolio';

interface StockCandidate {
  symbol: string;
  nameKo: string;
  market: 'KR' | 'US' | 'CRYPTO';
  theme: string;
  reasonKo: string;
  riskLevel: 'LOW' | 'MED' | 'HIGH';
  sector: string;
}

// 테마 × 종목 매핑 (확장 가능)
const THEME_STOCKS: Record<string, StockCandidate[]> = {
  ai_infra_bottleneck: [
    { symbol: '005930.KS', nameKo: '삼성전자',   market: 'KR', theme: 'AI 인프라 병목', reasonKo: 'HBM 메모리 최대 수혜', riskLevel: 'LOW', sector: '반도체' },
    { symbol: '000660.KS', nameKo: 'SK하이닉스', market: 'KR', theme: 'AI 인프라 병목', reasonKo: 'HBM3E 엔비디아 독점 공급', riskLevel: 'MED', sector: '반도체' },
    { symbol: 'NVDA',      nameKo: '엔비디아',   market: 'US', theme: 'AI 인프라 병목', reasonKo: 'GPU 수요 독점적 지위', riskLevel: 'HIGH', sector: '반도체' },
    { symbol: '267260.KS', nameKo: 'HD현대일렉트릭', market: 'KR', theme: 'AI 인프라 병목', reasonKo: '전력망 변압기 공급 병목', riskLevel: 'MED', sector: '전력' },
    { symbol: '010120.KS', nameKo: 'LS ELECTRIC',market: 'KR', theme: 'AI 인프라 병목', reasonKo: '데이터센터 전력 장비', riskLevel: 'MED', sector: '전력' },
  ],
  safe_haven_rotation: [
    { symbol: 'GC=F',    nameKo: '금 선물',   market: 'US', theme: '안전자산 로테이션', reasonKo: '지정학 헤지 1순위', riskLevel: 'LOW', sector: '원자재' },
    { symbol: 'TLT',     nameKo: '미국 장기채 ETF', market: 'US', theme: '안전자산 로테이션', reasonKo: '금리 하락 시 수혜', riskLevel: 'LOW', sector: '채권' },
    { symbol: '114800.KS', nameKo: 'KODEX 인버스', market: 'KR', theme: '안전자산 로테이션', reasonKo: '하락장 방어', riskLevel: 'MED', sector: 'ETF' },
  ],
  korea_export_cycle: [
    { symbol: '005380.KS', nameKo: '현대차',    market: 'KR', theme: '한국 수출 싸이클', reasonKo: '미국 판매 증가세, 환율 수혜', riskLevel: 'MED', sector: '자동차' },
    { symbol: '329180.KS', nameKo: 'HD현대중공업', market: 'KR', theme: '한국 수출 싸이클', reasonKo: '조선 수주 사이클 상승', riskLevel: 'MED', sector: '조선' },
    { symbol: '051910.KS', nameKo: 'LG화학',   market: 'KR', theme: '한국 수출 싸이클', reasonKo: '배터리 소재 수출', riskLevel: 'HIGH', sector: '화학' },
  ],
  china_stimulus_trade: [
    { symbol: '047050.KS', nameKo: '포스코홀딩스', market: 'KR', theme: '중국 부양 트레이드', reasonKo: '철강 수요 회복 시 수혜', riskLevel: 'HIGH', sector: '철강' },
    { symbol: 'FXI',      nameKo: '중국 대형주 ETF', market: 'US', theme: '중국 부양 트레이드', reasonKo: '중국 경기부양 직접 수혜', riskLevel: 'HIGH', sector: 'ETF' },
  ],
  energy_transition: [
    { symbol: '034020.KS', nameKo: '두산에너빌리티', market: 'KR', theme: '에너지 전환', reasonKo: '원전 르네상스 핵심 수혜', riskLevel: 'MED', sector: '에너지' },
    { symbol: '009830.KS', nameKo: '한화솔루션', market: 'KR', theme: '에너지 전환', reasonKo: '태양광 모듈 글로벌 5위', riskLevel: 'HIGH', sector: '태양광' },
    { symbol: 'ENPH',     nameKo: '엔페이즈',  market: 'US', theme: '에너지 전환', reasonKo: '마이크로인버터 시장 1위', riskLevel: 'HIGH', sector: '태양광' },
  ],
  taiwan_strait_risk: [
    { symbol: '012450.KS', nameKo: '한화에어로스페이스', market: 'KR', theme: '대만해협 리스크', reasonKo: '방산 수혜, 한국 리스크오프 방어', riskLevel: 'MED', sector: '방산' },
    { symbol: '047810.KS', nameKo: 'LIG넥스원', market: 'KR', theme: '대만해협 리스크', reasonKo: '미사일 방어 시스템 수혜', riskLevel: 'MED', sector: '방산' },
  ],
  us_credit_stress: [
    { symbol: 'HYG',    nameKo: 'iShares HY ETF', market: 'US', theme: '미국 신용 스트레스', reasonKo: '스프레드 확대 → 매도 후 재진입 기회', riskLevel: 'HIGH', sector: '채권' },
    { symbol: '132030.KS', nameKo: 'KODEX 달러선물', market: 'KR', theme: '미국 신용 스트레스', reasonKo: '신용 스트레스 → 달러 강세 헤지', riskLevel: 'MED', sector: 'ETF' },
  ],
};

const RISK_CLS = { LOW: 'text-risk-safe', MED: 'text-risk-watch', HIGH: 'text-risk-critical' };
const RISK_KO  = { LOW: '저위험', MED: '중위험', HIGH: '고위험' };
const MKT_CLS  = { KR: 'text-accent-light', US: 'text-blue-400', CRYPTO: 'text-yellow-400' };

export function ScreenerPanel() {
  const { activeThemes } = useStore();
  const { holdings }     = usePortfolioStore();
  const [filter, setFilter] = useState<string>('all');
  const selectSymbol = useStore(s => s.selectSymbol);
  const selectedSym  = useStore(s => s.selectedSymbol);
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'KR' | 'US'>('ALL');

  const ownedSymbols = new Set(holdings.map(h => h.symbol));

  // Get candidates from active themes
  const candidates = useMemo(() => {
    const allCandidates: (StockCandidate & { themeStrength: number })[] = [];
    const seen = new Set<string>();

    // Use AI-discovered themes if available
    const themeIds = activeThemes.length > 0
      ? activeThemes.map(t => t.id)
      : Object.keys(THEME_STOCKS);

    themeIds.forEach(tid => {
      const stocks = THEME_STOCKS[tid] ?? [];
      const theme = activeThemes.find(t => t.id === tid);
      const strength = theme?.strength ?? 50;
      stocks.forEach(s => {
        if (!seen.has(s.symbol)) {
          seen.add(s.symbol);
          allCandidates.push({ ...s, themeStrength: strength });
        }
      });
    });

    return allCandidates.sort((a, b) => b.themeStrength - a.themeStrength);
  }, [activeThemes]);

  const filtered = candidates.filter(c => {
    if (marketFilter !== 'ALL' && c.market !== marketFilter) return false;
    if (filter !== 'all' && c.theme !== filter) return false;
    return true;
  });

  const themes = [...new Set(candidates.map(c => c.theme))];

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-3 py-2 border-b border-border shrink-0 space-y-1.5">
        <div className="flex gap-1 flex-wrap">
          {(['ALL', 'KR', 'US'] as const).map(m => (
            <button key={m} onClick={() => setMarketFilter(m)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                marketFilter === m ? 'bg-accent text-white' : 'bg-border text-secondary hover:text-primary'
              }`}>{m === 'ALL' ? '전체' : m}</button>
          ))}
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-secondary focus:border-accent focus:outline-none">
          <option value="all">전체 테마</option>
          {themes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs">종목 없음</div>
        ) : (
          filtered.map((c, i) => {
            const owned = ownedSymbols.has(c.symbol);
            return (
              <div key={i}
                onClick={() => selectSymbol(c.symbol, c.nameKo)}
                className={`py-2 border-b border-border/40 last:border-0 cursor-pointer hover:bg-surface/60 rounded px-1 transition-colors ${owned ? 'opacity-50' : ''} ${selectedSym === c.symbol ? 'bg-accent/10 border-accent/30' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-primary">{c.nameKo}</span>
                      <span className={`text-xs ${MKT_CLS[c.market]}`}>{c.symbol}</span>
                      {owned && <span className="text-xs bg-accent/20 text-accent-light px-1 rounded">보유중</span>}
                    </div>
                    <p className="text-xs text-secondary leading-snug mt-0.5">{c.reasonKo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-surface border border-border px-1.5 py-0.5 rounded text-muted">{c.sector}</span>
                      <span className={`text-xs font-semibold ${RISK_CLS[c.riskLevel]}`}>{RISK_KO[c.riskLevel]}</span>
                      <span className="text-xs text-muted ml-auto">↑ {c.themeStrength}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border shrink-0 text-xs text-muted/60">
        투자 참고용 · 개인 판단 필요
      </div>
    </div>
  );
}
