/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        appbase:        'var(--color-appbase)',
        surface:        'var(--color-surface)',
        panel:          'var(--color-panel)',
        border:         'var(--color-border)',
        accent:         'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
        primary:        'var(--color-primary)',
        secondary:      'var(--color-secondary)',
        muted:          'var(--color-muted)',
        'risk-safe':     '#22c55e',
        'risk-watch':    '#eab308',
        'risk-elevated': '#f97316',
        'risk-critical': '#ef4444',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
