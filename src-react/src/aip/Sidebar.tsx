/**
 * Sidebar — 왼쪽 아이콘 사이드바 (팔란티어 AIP 스타일)
 * 뷰 전환 + 주요 모듈 접근
 */
import { useState } from 'react';
import type { MainViewType } from './AIPLayout';
import { useThemeStore, THEMES } from '@/store/theme';

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

// 테마 색상 점 (미리보기)
const THEME_PREVIEW: Record<string, string> = {
  montra: '#1d6ae8',
  ghost:  '#7c3aed',
  matrix: '#16a34a',
  amber:  '#d97706',
};

export function Sidebar({ activeView, onViewChange, riskScore }: Props) {
  const [showTheme, setShowTheme] = useState(false);
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="w-14 bg-surface border-r border-border flex flex-col items-center py-2 shrink-0">
      {/* Logo */}
      <div className="w-9 h-9 rounded bg-accent/20 border border-accent/30 flex items-center justify-center mb-3 cursor-pointer" title="Mentat Monitor">
        <span className="text-sm">🧠</span>
      </div>

      {/* Risk dot */}
      <div className="mb-3 flex flex-col items-center" title={`위협 지수: ${riskScore}`}>
        <div className="inline-flex items-center gap-1">
          <span className="text-blue-400 text-xs">●</span>
          <span className="text-xs text-blue-400 font-mono tracking-widest">ACTIVE</span>
        </div>
        <span className="text-[10px] text-muted font-mono">{riskScore}</span>
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

      {/* Bottom — 테마 버튼 */}
      <div className="flex flex-col gap-1 w-full px-1.5 relative">
        <button
          onClick={() => setShowTheme(s => !s)}
          title="UI 테마 변경"
          className={`w-full h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-border/60 transition-all relative ${showTheme ? 'bg-border/60 text-primary' : ''}`}
        >
          {/* 현재 테마 색상 점 */}
          <span style={{ fontSize: '18px', filter: `drop-shadow(0 0 4px ${THEME_PREVIEW[theme]})` }}>🎨</span>
        </button>

        {/* 테마 팝업 */}
        {showTheme && (
          <div className="absolute bottom-12 left-1 z-50 w-44 bg-panel border border-border rounded-lg shadow-2xl p-2">
            <div className="text-[10px] text-muted uppercase tracking-widest mb-2 px-1">UI 테마</div>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setShowTheme(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all text-left ${
                  theme === t.id
                    ? 'bg-accent/15 text-accent-light'
                    : 'text-muted hover:text-primary hover:bg-border/60'
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0 border"
                  style={{ background: THEME_PREVIEW[t.id], borderColor: THEME_PREVIEW[t.id] + '88' }} />
                <span className="text-xs font-mono font-bold">{t.name}</span>
                <span className="text-[10px] text-muted ml-auto truncate">{t.desc}</span>
                {theme === t.id && <span className="text-accent-light text-xs shrink-0">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
