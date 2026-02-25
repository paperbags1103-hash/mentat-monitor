# Mentat Monitor — 로드맵

> "A Mentat must first learn one thing above all others: that there are no certainties. The only reliable data is data gathered with great care."
> — Frank Herbert, Dune

**Mentat Monitor**는 전 세계 지정학·경제·군사 신호를 실시간으로 수집하고, 이를 투자 임팩트로 번역해주는 오픈소스 인텔리전스 플랫폼입니다.

World Monitor (https://github.com/koala73/worldmonitor) 포크 기반.

---

## Phase 1: 기반 구축 (W1-6)

- [x] World Monitor 포크 + Mentat Monitor 리브랜딩
- [x] 한국어 로케일 (ko.json)
- [x] 한국 뉴스 RSS 피드 추가 (연합뉴스, YTN, MBC, 매일경제, 한겨레 등)
- [x] 한반도 인텔리전스 피드 (38North, NK News, CSIS Korea, KCNA Watch)
- [ ] 한국 시장 데이터 (코스피/코스닥, 원달러 환율, 김치 프리미엄)
- [ ] 경제 캘린더 레이어 (FOMC, BOK, ECB 금리 결정 일정)
- [ ] 원자재 피드 (WTI, 금, 구리)
- [ ] 북한 도발 타임라인 데이터 (JSON DB)

## Phase 2: 신호 수집 강화 (W7-10)

- [ ] 블랙스완 조기경보
  - Google Trends 키워드 모니터링 (방사능 약, 비상식량 등)
  - FRED API: TED Spread, 레포금리, VIX
  - ProMED/HealthMap: 팬데믹 조기경보
  - Cloudflare Radar: 인터넷 장애 감지
- [ ] 군용기/정부기 항공 추적 (OpenSky Network API)
- [ ] 이벤트 자동 태깅 (섹터, 자산 클래스 연결)
- [ ] 수렴 감지 엔진 (다중 신호 동일 지역 겹침 → 에스컬레이션)
- [ ] 반도체 공급망 트래커 (삼성/SK하이닉스/TSMC/ASML 관련 뉴스 태깅)

## Phase 3: 투자 인텔리전스 (W11-13)

- [ ] 이벤트 임팩트 스코어링 (-10 ~ +10, 강세/약세/중립)
- [ ] 히스토리컬 패턴 매칭 ("과거 유사 이벤트 때 어떻게 됐나?")
- [ ] 포트폴리오 연동 및 리스크 노출도 계산
- [ ] 3티어 알림 시스템 (CRITICAL / WATCH / INFO)
- [ ] Tail Risk Index (블랙스완 종합 지수)
- [ ] v0.1.0 릴리스 (macOS/Windows/Linux 바이너리)

---

## 이름의 유래

**Mentat** — 프랭크 허버트의 소설 *Dune*에서, 컴퓨터 사용이 금지된 세계에서
인간 두뇌를 극한까지 훈련시켜 만든 데이터 분석 전문가.

모든 데이터를 수집하고, 패턴을 읽고, 결론을 내린다.

이 앱은 전 세계 신호를 수집해 투자 판단을 돕는 Mentat이 되고자 한다.

---

## 기술 스택

- **Frontend**: TypeScript + Vite + React + deck.gl + MapLibre GL JS
- **Desktop**: Tauri (macOS / Windows / Linux)
- **AI**: Groq API (무료) / OpenAI API (선택) / Ollama (로컬)
- **License**: AGPL v3
