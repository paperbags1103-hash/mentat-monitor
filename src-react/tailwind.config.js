/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        appbase:   '#08101e',
        surface:   '#0c1628',
        panel:     '#0f1e35',
        border:    '#1c2d45',
        accent:    '#1d6ae8',
        'accent-light': '#60a5fa',
        'risk-safe':     '#22c55e',
        'risk-watch':    '#eab308',
        'risk-elevated': '#f97316',
        'risk-critical': '#ef4444',
        primary:   '#f1f5f9',
        secondary: '#94a3b8',
        muted:     '#4a6080',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
