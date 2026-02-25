# Mentat Monitor

> *"A Mentat must first learn one thing above all others: that there are no certainties. The only reliable data is data gathered with great care."*
> — Frank Herbert, Dune

**Real-time global intelligence dashboard — geopolitical signals mapped to investment impact.**

A fork of [World Monitor](https://github.com/koala73/worldmonitor), rebuilt for investors who want to see the world *before* markets react.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## Why Mentat Monitor?

| Problem | Solution |
|---------|----------|
| Geopolitical events scattered across 100+ sources | **Single 3D globe dashboard** with unified signal layers |
| No connection between world events and market impact | **Event → asset mapping** with historical pattern matching |
| Expensive OSINT tools ($$$) | **100% free & open source** |
| No Korean market context | **Built-in Korean market intelligence** |
| Black swan events go undetected | **Multi-source early warning system** |
| Cloud-dependent AI | **Local LLM support** (Ollama / LM Studio) |

The name: **Mentat** — in Frank Herbert's *Dune*, a human trained to process vast amounts of data and extract actionable intelligence. That's what this app tries to be for investors.

---

## Features

### 🇰🇷 Korean Market Intelligence
- **KOSPI / KOSDAQ** real-time indices
- **USD/KRW exchange rate** live feed
- **Kimchi Premium** — BTC/KRW (Upbit) vs BTC/USDT (Binance) spread, auto-calculated
- **Korean news RSS** — 연합뉴스, YTN, MBC, 매일경제, 한겨레, Korea Herald
- **Full Korean UI** (ko.json — 84KB complete translation)

### 🌍 Global Intelligence Layers (inherited from World Monitor)
- **35+ map layers** — conflicts, military bases, nuclear facilities, undersea cables, satellite fire detection, cyber threat IOCs, and more
- **150+ RSS feeds** across geopolitics, defense, energy, tech, and finance
- **3D WebGL globe** — deck.gl + MapLibre GL JS, 60fps rendering
- **AI-synthesized briefs** — local Ollama / Groq / OpenRouter fallback chain
- **Country Instability Index (CII)** — real-time stability scores for 22 nations

### 🚨 Korean Peninsula Intelligence
- **North Korea Provocation Timeline** — 20+ historical events (2006–2024) with GPS coordinates for map visualization
  - Missile tests, nuclear tests, cyber operations, maritime incidents, artillery events
- **Korea-focused feeds** — 38 North, NK News, CSIS Korea Chair, KCNA Watch

### 📅 Economic Calendar
- **Central bank rate decisions** — Fed (FOMC), ECB, 한국은행 금통위, BOJ, BOE
- **2025–2026 schedule** pre-seeded (no API key required)
- **FMP API integration** — high-impact event calendar when `FMP_API_KEY` is set
- **Map layer** — events shown as markers at central bank coordinates

### 🍕 PizzINT Activity Index *(bonus — already in codebase!)*
- Real-time activity monitoring at government/intelligence facilities
- DEFCON-style scoring based on unusual activity spikes
- Based on [pizzint.watch](https://www.pizzint.watch) API

---

## Quick Start

### Web (no install)
```
coming soon — mentatmonitor.app
```

### Desktop App
```bash
git clone https://github.com/paperbags1103-hash/mentat-monitor
cd mentat-monitor
npm install
npm run dev          # development (full/geopolitical variant)
npm run dev:signal   # signal variant (investment-focused)
```

### Build Desktop App (Tauri)
```bash
npm run build:desktop
```
Outputs native binaries for macOS, Windows, and Linux.

---

## Configuration

### AI (Optional)
The app works without any API keys. AI summarization uses a fallback chain:
1. **Ollama** (local — no API key, no data leaves your machine)
2. **Groq** — free tier available at [console.groq.com](https://console.groq.com)
3. **OpenRouter** — pay-per-use
4. **T5 (browser)** — lightweight fallback, always available

### Data Sources (Optional API Keys)
| Key | Service | Notes |
|-----|---------|-------|
| `FMP_API_KEY` | Financial Modeling Prep | Economic calendar high-impact events |
| `GROQ_API_KEY` | Groq | AI news summarization |
| `FINNHUB_API_KEY` | Finnhub | Stock quotes |

Korean market data (KOSPI, KOSDAQ, USD/KRW, Kimchi Premium) requires **no API key**.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│               Tauri Desktop App                  │
│           (macOS / Windows / Linux)              │
├─────────────────────────────────────────────────┤
│  Frontend: TypeScript + Vite + React             │
│  Map: deck.gl + MapLibre GL JS (3D Globe)        │
├─────────────────────────────────────────────────┤
│  Node.js Sidecar (API handlers)                  │
│  ├── RSS Collector + Korean news feeds           │
│  ├── Korea Market API (KOSPI/KOSDAQ/Kimchi)      │
│  ├── Economic Calendar API                       │
│  ├── NK Provocation Layer                        │
│  └── Proto-first API (17+ typed services)        │
├─────────────────────────────────────────────────┤
│  External Data (free / no key required)          │
│  ├── Yahoo Finance (indices, commodities)        │
│  ├── Upbit API (BTC/KRW)                        │
│  ├── Binance API (BTC/USDT)                     │
│  ├── OpenSky Network (aircraft tracking)         │
│  ├── GDELT Project (global events)               │
│  └── 38North / NK News / KCNA Watch             │
└─────────────────────────────────────────────────┘
```

---

## Roadmap

See [MENTAT_ROADMAP.md](./MENTAT_ROADMAP.md) for full Phase 1-3 plan.

**Phase 1 (Done):** Korean market data, Korean locale, NK timeline, economic calendar  
**Phase 2:** Black swan early warning, VIP flight tracking, event auto-tagging, convergence detection  
**Phase 3:** Portfolio risk exposure, impact scoring, 3-tier alert system, v0.1.0 release  

---

## Contributing

PRs welcome. This project follows the upstream [World Monitor](https://github.com/koala73/worldmonitor) architecture.

1. Fork this repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Open a PR

---

## License

[AGPL v3](LICENSE) — same as upstream World Monitor.

This means: if you host this as a service (SaaS), you must open-source your modifications.  
Self-hosted and desktop use: no restrictions.

---

## Disclaimer

**This is not financial advice.** All market data, signals, and intelligence outputs are for informational purposes only. Always do your own research. Past geopolitical patterns do not guarantee future market movements.

---

*Built on [World Monitor](https://github.com/koala73/worldmonitor) by koala73. Respect to the original work.*
