# Mentat Monitor — 프로젝트 플랜 (2026-02-26 기준 최신)

> **금융 온톨로지의 민주화** — 골드만삭스급 의미 추출을 개인 한국 투자자에게

Investing.com + Bloomberg Terminal을 쓸 이유가 없어지는, 의미 추출이 붙은 개인 금융 인텔리전스 플랫폼.

---

## 🔗 핵심 링크

| 항목 | 값 |
|---|---|
| **Repo** | https://github.com/paperbags1103-hash/mentat-monitor |
| **Vercel (라이브)** | https://signal-six-henna.vercel.app |
| **로컬 경로** | `/Users/superdog/.openclaw/workspace/projects/signal/` |
| **최신 커밋** | `90d0424` |
| **현재 버전** | v0.6.9+ |
| **라이선스** | AGPL v3 |

---

## 🏗️ 아키텍처

```
DATA → VISUALIZATION → MEANING (Mentat) → ACTION
```

**4계층:**
1. **DATA**: Yahoo Finance, FRED, Groq RSS, Reuters RSS, 경제캘린더
2. **VISUALIZATION**: Leaflet 지도, lightweight-charts 캔들, 히트맵, 바차트
3. **MEANING**: Groq AI 인퍼런스, 지정학 스코어링, 패턴 매처
4. **ACTION**: 알림 시스템, 포트폴리오 리스크 노출도, 행동 제안

**기술 스택:**
- Frontend: React 18 + TypeScript + Tailwind CSS + Zustand
- Charts: lightweight-charts v4.2.0
- Map: react-leaflet v4.2.1 + Leaflet 1.9.4
- Build: Vite + Vercel (웹), Tauri (데스크탑)
- AI: Groq llama-3.3-70b-versatile (무료 API)
- 주가: Yahoo Finance (비공식, 무료)

---

## ✅ 완료된 기능 전체 목록

### 인프라
- [x] React 앱 (`src-react/`) — Vite 빌드, TypeScript, Tailwind
- [x] Vercel 배포 + CORS 설정 (`api/_cors.js`)
- [x] Zustand 스토어 (DataStore + LayoutStore + AlertStore + PortfolioStore)
- [x] Tauri 데스크탑 빌드 (`src-tauri/tauri.mentat.conf.json`)
- [x] API 키 설정 패널 (Groq/FRED/AlphaVantage → localStorage)

### 데이터 API (`api/` — Vercel Edge Functions)
- [x] `korea-market.js` — KOSPI, KOSDAQ, USD/KRW, BTC/KRW
- [x] `global-macro.js` — SPX, 나스닥, 금, WTI, DXY, VIX
- [x] `precious-metals.js` — 금/은 선물
- [x] `blackswan.js` — 6개 모듈 테일 리스크 지수
- [x] `economic-calendar.js` — FOMC, BOK, ECB 일정
- [x] `credit-stress.js` — IG/HY 스프레드 (FRED)
- [x] `insight-briefing.js` — Groq AI 한국 투자 브리핑 (5분 캐시)
- [x] `theme-discovery.js` — AI 투자 테마 자동 발견 (30분 캐시)
- [x] `chart-data.js` — Yahoo Finance OHLCV (1mo~2y)
- [x] `rss-proxy.js` — 뉴스 RSS 프록시
- [x] `news-ai.js` — RSS + Groq 한국어 투자 요약 (10분 캐시) ← NEW
- [x] `fear-greed.js` — 공포탐욕지수
- [x] `vip-aircraft.js`, `opensky.js` — 항공기 추적
- [x] `polymarket.js` — 예측 시장

### AIP 레이아웃 (메인 화면)
- [x] **Palantir AIP 스타일** — 사이드바 + 메인 뷰 + 라이브 피드 + 하단 스트립
- [x] **WorldMapView v2** — GeoJSON 국가 오버레이 + 영향선 + 투자 시사점 패널 ← NEW
  - GeoJSON choropleth (17개국 위험 점수 색상 오버레이)
  - 핫스팟 핀 클릭 → 투자 시사점 카드 (섹터 + 종목 + 임플리케이션)
  - 영향선 (Impact Arcs) — 연결 금융 허브까지 점선
  - 레이어 토글 5개 (위협/오버레이/영향선/항공기/해운)
- [x] **HeatMapView** — 17개 지역 × 위협 점수 그리드
- [x] **ChartView** — 4종목 멀티 차트 (preset 4개, 1x1/1x2/2x2)
- [x] **LiveFeed** — 인퍼런스 타임라인 (탭: 전체/위기/테마/브리핑)
- [x] **LiveNews** — AI 요약 탭 + RSS 탭 ← NEW
- [x] **BottomStrip** — 핵심 지표 스크롤 (KOSPI/KRW/VIX/SPX/금/WTI 등)

### 그리드 패널 (18개)
- [x] 브리핑 패널 — AI 투자 내러티브
- [x] 테마 패널 — AI 투자 테마 자동 발견
- [x] 행동 제안 패널 — 구조화된 투자 행동
- [x] 시장 현황 패널
- [x] 글로벌 매크로 패널 (DXY, 수익률 곡선, 실질금리)
- [x] 차트 패널 (캔들 + SMA 20/60일)
- [x] 블랙스완 패널
- [x] 경제 캘린더 패널
- [x] 신용 스트레스 패널
- [x] 신호 피드 패널
- [x] 공포탐욕 패널
- [x] **포트폴리오 패널 v2** ← NEW (3탭: 보유종목/섹터분산/지정학리스크)
- [x] **알림 패널** (VIX/KOSPI/KRW 임계값 + CRITICAL 인퍼런스 자동 알림) ← NEW
- [x] 스크리너 패널 (테마 연계 종목 서제스트)
- [x] 뉴스 피드 패널
- [x] 종목 상세 패널 (캔들 + OHLCV + 관련 테마)
- [x] 시나리오 패널 (5개 지정학 시나리오 스트레스 테스트)
- [x] VaR 패널 (포트폴리오 Value at Risk 95/99%)
- [x] 설정 패널 (API 키 관리)

### 크로스패널 연동
- [x] `selectSymbol` 액션 — 스크리너/포트폴리오 클릭 → StockDetailPanel 연동

---

## 🛠️ 기술 결정 사항 (중요!)

| 항목 | 결정 | 이유 |
|---|---|---|
| `react-grid-layout` | v1.4.4 고정 | 상위 버전 호환 이슈 |
| `lightweight-charts` | v4.2.0 | v5 API 완전히 다름 (`addCandlestickSeries()` not `addSeries(CandlestickSeries)`) |
| `react-leaflet` | v4.2.1 | v5 peer dep 충돌 (--legacy-peer-deps 필요) |
| Vite `base` | `'./'` 고정 (절대 `'/'` 쓰지 말 것) | Tauri 빌드 경로 이슈 |
| Tailwind 커스텀 색상 | `appbase` (not `base`) | `base`는 예약어 충돌 |
| API routing | Tauri: `http://localhost:46123`, Web: `''` | store/index.ts 자동 감지 |
| Leaflet import | `import L from 'leaflet'` | `require('leaflet')` 금지 (ESM 충돌) |
| Groq 모델 | `llama-3.3-70b-versatile` | 무료 + 한국어 지원 우수 |

### API 필드명 주의
- `korea-market.js`: `changePercent` (not `change`), `usdkrw` (not `usdKrw`), `rate` 필드 포함
- `global-macro.js`: `changePct` 반환 → store에서 `toTick()` 헬퍼로 `changePercent` 변환
- `precious-metals.js`: `goldFutures`/`silverFutures` (not `gold`/`silver`)
- `MarketTick.changePercent`: 항상 optional (`changePercent?: number`), 모든 `.toFixed()` 앞에 `?? 0`

### Vercel 배포
- Build command: `cd src-react && npm install --legacy-peer-deps && npm run build`
- Curl로 API 테스트 시 403 → Deployment Protection 때문, 브라우저에서는 정상
- 구버전 WorldMonitor TypeScript 에러 (server/ 폴더) — 빌드에 영향 없음, 무시

### DMG 빌드
- 리빌드 전 마운트된 "Mentat Monitor" 볼륨 전부 꺼내야 함

---

## 🔄 현재 진행 중 / 남은 작업

### 🔴 버그
- [ ] `TypeError: u is not a function` — 방어 코딩 적용됨, 에러 발생 시 이제 컴포넌트 스택 표시. 재현 시 스크린샷 필요

### 🟡 단기 (바로 할 수 있는 것)
- [ ] 경제 캘린더 fallback 데이터 (FOMC/CPI/PPI 하드코딩 — API 없어도 표시)
- [ ] RSI(14) / MACD 기술 지표 (ChartPanel에 추가)
- [ ] Vercel GitHub 자동 배포 (GitHub Secrets → Vercel token)

### 🟢 중기
- [ ] 모바일 레이아웃 최적화 (반응형 breakpoints)
- [ ] 포트폴리오 백테스팅 ("2022년 금리 인상기 수익률은?")
- [ ] AI 투자 어시스턴트 채팅 인터페이스

---

## 💰 비용

**현재 $0/월** — 전부 무료 tier

| 서비스 | 용도 | 제한 |
|---|---|---|
| Vercel | 호스팅 | 월 100GB 대역폭 |
| Yahoo Finance | 주가 데이터 | 비공식 API, rate limit 없음 |
| Groq | AI 요약/브리핑 | 분당 30 요청 |
| FRED | 거시경제 데이터 | 하루 120 요청 |
| CartoDB | 지도 타일 | 무료 |
| Reuters RSS | 뉴스 | 무료 |

---

## 📁 파일 구조 (핵심)

```
projects/signal/
├── api/                    # Vercel Edge Functions (28개)
│   ├── _cors.js            # CORS 설정 (signal-six-henna.vercel.app 허용)
│   ├── insight-briefing.js # Groq AI 브리핑 (핵심)
│   ├── korea-market.js     # KOSPI/KRW
│   ├── global-macro.js     # SPX/나스닥/금/WTI
│   ├── news-ai.js          # RSS + Groq 뉴스 요약 (NEW)
│   └── ...
├── src-react/              # React 앱 (canonical frontend)
│   └── src/
│       ├── aip/            # AIP 레이아웃 컴포넌트
│       │   ├── AIPLayout.tsx
│       │   ├── WorldMapView.tsx  # 지도 v2 (GeoJSON + 영향선)
│       │   ├── HeatMapView.tsx
│       │   ├── ChartView.tsx
│       │   ├── LiveFeed.tsx
│       │   ├── LiveNews.tsx      # AI/RSS 탭
│       │   ├── Sidebar.tsx
│       │   └── BottomStrip.tsx
│       ├── layout/         # 그리드 레이아웃
│       ├── panels/         # 18개 패널 컴포넌트
│       │   ├── PortfolioPanel.tsx  # v2: 3탭 (보유/섹터/지정학)
│       │   ├── AlertPanel.tsx      # VIX/KOSPI/KRW 임계값 알림
│       │   └── ...
│       └── store/
│           ├── index.ts    # 메인 Zustand 스토어
│           └── portfolio.ts # 포트폴리오 스토어
└── src-tauri/              # Tauri 데스크탑 설정
```
