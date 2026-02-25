/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:      '#0a0a0f',
        surface:   '#12121a',
        panel:     '#1a1a28',
        border:    '#2a2a3f',
        accent:    '#7c3aed',
        'accent-light': '#a78bfa',
        'risk-safe':     '#22c55e',
        'risk-watch':    '#eab308',
        'risk-elevated': '#f97316',
        'risk-critical': '#ef4444',
        primary:   '#f1f5f9',
        secondary: '#94a3b8',
        muted:     '#475569',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
