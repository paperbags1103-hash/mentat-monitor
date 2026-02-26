/**
 * Sidebar — 왼쪽 아이콘 사이드바 (팔란티어 AIP 스타일)
 * 뷰 전환 + 주요 모듈 접근
 */
import type { MainViewType } from './AIPLayout';

interface NavItem {
  view?: MainViewType;
  icon: string;
  label: string;
  divider?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'map',       icon: '🗺',  label: '세계 지도' },
  { view: 'heatmap',   icon: '🔥',  label: '리스크 히트맵' },
  { view: 'charts',    icon: '📊',  label: '멀티 차트' },
  { view: 'portfolio', icon: '💼',  label: '포트폴리오' },
  { divider: true,     icon: '',    label: '' },
  { view: 'grid',      icon: '⊞',   label: '그리드 대시보드' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { icon: '⚙', label: '설정' },
];

interface Props {
  activeView: MainViewType;
  onViewChange: (v: MainViewType) => void;
  riskScore: number;
}

function RiskDot({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-risk-critical' : score >= 40 ? 'bg-risk-elevated' : 'bg-risk-safe';
  const pulse = score >= 60;
  return <div className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />;
}

export function Sidebar({ activeView, onViewChange, riskScore }: Props) {
  return (
    <div className="w-14 bg-surface border-r border-border flex flex-col items-center py-2 shrink-0">
      {/* Logo */}
      <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center mb-3 cursor-pointer" title="Mentat Monitor">
        <span className="text-sm">🧠</span>
      </div>

      {/* Risk dot */}
      <div className="mb-3" title={`위협 지수: ${riskScore}`}>
        <RiskDot score={riskScore} />
      </div>

      {/* Nav */}
      <div className="flex-1 flex flex-col gap-1 w-full px-1.5">
        {NAV_ITEMS.map((item, i) => {
          if (item.divider) return <div key={i} className="h-px bg-border my-1 w-full" />;
          return (
            <button
              key={item.view}
              onClick={() => item.view && onViewChange(item.view)}
              title={item.label}
              className={`w-full h-10 rounded-lg flex items-center justify-center text-lg transition-all
                ${activeView === item.view
                  ? 'bg-accent/20 border border-accent/40 text-accent-light'
                  : 'text-muted hover:bg-border/60 hover:text-primary'
                }`}
            >
              {item.icon}
            </button>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-1 w-full px-1.5">
        {BOTTOM_ITEMS.map((item, i) => (
          <button key={i} title={item.label}
            className="w-full h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-border/60 transition-all">
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
