import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'montra' | 'ghost' | 'matrix' | 'amber';

export const THEMES: { id: ThemeId; name: string; desc: string; emoji: string }[] = [
  { id: 'montra', name: 'MONTRA', desc: 'Navy + 파란 (기본)', emoji: '🔵' },
  { id: 'ghost',  name: 'GHOST',  desc: '어둠 + 보라',        emoji: '🟣' },
  { id: 'matrix', name: 'MATRIX', desc: '터미널 초록',        emoji: '🟢' },
  { id: 'amber',  name: 'AMBER',  desc: '레트로 앰버',        emoji: '🟡' },
];

interface ThemeStore {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

function applyTheme(t: ThemeId) {
  document.documentElement.setAttribute('data-theme', t);
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'montra',
      setTheme: (theme) => { applyTheme(theme); set({ theme }); },
    }),
    { name: 'ui-theme' }
  )
);

export function initTheme() {
  try {
    const raw = localStorage.getItem('ui-theme');
    const t: ThemeId = raw ? ((JSON.parse(raw)?.state?.theme as ThemeId) ?? 'montra') : 'montra';
    applyTheme(t);
  } catch { applyTheme('montra'); }
}
