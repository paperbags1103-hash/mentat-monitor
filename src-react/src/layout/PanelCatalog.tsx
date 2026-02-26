import { useState } from 'react';
import { useLayoutStore, type PanelDef } from '@/store';

interface CatalogItem {
  type: string;
  title: string;
  desc: string;
  config?: Record<string, unknown>;
  defaultSize?: { w: number; h: number };
}

const CATALOG: CatalogItem[] = [
  // Charts
  { type: 'chart', title: '📈 KOSPI 차트',    desc: '코스피 캔들스틱 차트', config: { symbol: '^KS11', nameKo: 'KOSPI' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 KOSDAQ 차트',   desc: '코스닥 캔들스틱 차트', config: { symbol: '^KQ11', nameKo: 'KOSDAQ' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 S&P500 차트',   desc: 'S&P500 캔들스틱 차트', config: { symbol: '^GSPC', nameKo: 'S&P500' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 나스닥 차트',   desc: '나스닥 캔들스틱 차트', config: { symbol: '^IXIC', nameKo: '나스닥' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 BTC/KRW 차트',  desc: '비트코인 원화 차트', config: { symbol: 'BTC-KRW', nameKo: 'BTC/KRW' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 금 (Gold) 차트', desc: '금 선물 차트', config: { symbol: 'GC=F', nameKo: '금 선물' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 WTI 원유 차트', desc: '원유 선물 차트', config: { symbol: 'CL=F', nameKo: 'WTI 원유' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 USD/KRW 차트',  desc: '원달러 차트', config: { symbol: 'KRW=X', nameKo: 'USD/KRW' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 VIX 차트',      desc: '공포지수 차트', config: { symbol: '^VIX', nameKo: 'VIX' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 삼성전자 차트', desc: '삼성전자 차트', config: { symbol: '005930.KS', nameKo: '삼성전자' }, defaultSize: { w: 5, h: 5 } },
  { type: 'chart', title: '📈 SK하이닉스',    desc: 'SK하이닉스 차트', config: { symbol: '000660.KS', nameKo: 'SK하이닉스' }, defaultSize: { w: 5, h: 5 } },
  // Data panels
  { type: 'live-tv',      title: '📺 경제 방송',   desc: 'Bloomberg/CNBC/YTN 라이브', defaultSize: { w: 5, h: 6 } },
  { type: 'webcam',       title: '📡 지역 웹캠',    desc: '위기 지역 자동 전환 웹캠', defaultSize: { w: 4, h: 5 } },
  { type: 'briefing',     title: '🧠 멘탯 브리핑', desc: 'AI 의미 추출 브리핑', defaultSize: { w: 4, h: 8 } },
  { type: 'market',       title: '📊 시장 현황',   desc: '주요 지수 스냅샷', defaultSize: { w: 3, h: 6 } },
  { type: 'themes',       title: '🎯 활성 테마',   desc: 'AI 투자 테마 발견 (Groq)', defaultSize: { w: 4, h: 5 } },
  { type: 'signals',      title: '⚡ 신호 피드',   desc: '실시간 위협 신호', defaultSize: { w: 3, h: 6 } },
  { type: 'blackswan',    title: '🌡️ 블랙스완',    desc: '테일 리스크 지수', defaultSize: { w: 3, h: 5 } },
  { type: 'econ-calendar',title: '📅 경제 캘린더', desc: 'FOMC/BOK/BOJ 일정', defaultSize: { w: 3, h: 5 } },
  { type: 'credit-stress',title: '💳 신용 스트레스', desc: 'IG/HY 스프레드 게이지', defaultSize: { w: 3, h: 5 } },
  { type: 'global-macro', title: '🌐 글로벌 매크로', desc: 'DXY·수익률 곡선·실질금리', defaultSize: { w: 3, h: 7 } },
  { type: 'actions',    title: '⚡ 행동 제안',  desc: '팔란티어 Action 레이어 — 구조화된 투자 행동', defaultSize: { w: 4, h: 6 } },
  { type: 'portfolio',  title: '💼 포트폴리오', desc: '보유 종목 P&L 실시간 추적', defaultSize: { w: 4, h: 7 } },
  { type: 'alerts',     title: '🔔 알림',       desc: '가격 목표 + 위협 등급 알림 (데스크탑 푸시)', defaultSize: { w: 3, h: 6 } },
  { type: 'screener',   title: '🔍 종목 스크리너', desc: '테마 연계 자동 관심종목 서제스트', defaultSize: { w: 4, h: 6 } },
  { type: 'news',       title: '📰 뉴스 피드',    desc: '한국·글로벌 경제 RSS 뉴스 (연합/YTN/Reuters)', defaultSize: { w: 4, h: 6 } },
  { type: 'fear-greed', title: '😱 공포탐욕지수', desc: 'VIX·수익률곡선·신용으로 자체 계산 + CNN F&G', defaultSize: { w: 3, h: 6 } },
  { type: 'scenario',   title: '🎯 시나리오 시뮬',  desc: '대만해협/북한/연준/중국 시나리오 스트레스 테스트', defaultSize: { w: 5, h: 8 } },
  { type: 'var',        title: '📐 VaR 분석',       desc: '포트폴리오 Value at Risk + 스트레스 테스트', defaultSize: { w: 3, h: 7 } },
  { type: 'settings',   title: '⚙ API 키 설정',      desc: 'Groq / FRED / Alpha Vantage 키 설정 (로컬 저장)', defaultSize: { w: 3, h: 8 } },
  { type: 'prediction', title: '🎲 예측 시장',        desc: 'Polymarket — 지정학/경제 이벤트 확률 실시간 조회', defaultSize: { w: 3, h: 9 } },
  { type: 'stock',     title: '📊 종목 상세',       desc: '캔들차트 + OHLCV + 관련 테마 (config에 symbol 지정)', defaultSize: { w: 4, h: 9 } },
];

interface Props { onClose: () => void }

export function PanelCatalog({ onClose }: Props) {
  const { addPanel, panels } = useLayoutStore();
  const [filter, setFilter] = useState('');

  const filtered = CATALOG.filter(c =>
    !filter || c.title.toLowerCase().includes(filter.toLowerCase()) || c.desc.includes(filter)
  );

  function handleAdd(item: CatalogItem) {
    const id = `${item.type}-${Date.now()}`;
    const panel: PanelDef = { id, type: item.type, title: item.title, config: item.config };
    addPanel(panel, item.defaultSize ? { w: item.defaultSize.w, h: item.defaultSize.h } : undefined);
    onClose();
  }



  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-panel border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-primary">📦 패널 추가</h2>
          <button onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <input
            autoFocus
            type="text"
            placeholder="패널 검색..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent"
          />
        </div>
        {/* Grid */}
        <div className="overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((item, i) => (
            <button
              key={i}
              onClick={() => handleAdd(item)}
              className="text-left bg-surface border border-border rounded-lg p-3 hover:border-accent/60 hover:bg-accent/5 transition-all group"
            >
              <div className="text-sm font-semibold text-primary mb-1 group-hover:text-accent-light transition-colors">{item.title}</div>
              <div className="text-xs text-muted leading-relaxed">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
