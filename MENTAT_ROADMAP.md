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
- [x] 경제 캘린더 API (FOMC, BOK, ECB, BOJ 금리 결정 일정 + FMP 연동)
- [ ] 원자재 피드 UI 통합 (WTI, 금, 구리 — 서버 핸들러 기존 존재)
- [x] 북한 도발 타임라인 데이터 (JSON DB, 2006-2024, 20개+ 이벤트, 좌표 포함)

## Phase 2: 신호 수집 강화 (W7-10)

- [x] 블랙스완 조기경보 (6개 모듈, Tail Risk Index 0-100)
  - 금융 스트레스: VIX, HY 스프레드, 엔화 흐름
  - 팬데믹: ProMED RSS + WHO + Google News
  - 핵/방사능: IAEA + 구글뉴스 키워드
  - 사이버: Cloudflare Radar + 구글뉴스
  - 지정학: 6시간 내 에스컬레이션 키워드
  - 공급망: BDRY ETF + 해운 뉴스
- [x] VIP/군용기 항공 추적 (OpenSky Network API, 직접 연결)
  - 24개국 주요 항공기 ICAO DB (한국 대통령, Air Force One 등)
- [x] 이벤트 자동 태깅 (rule-based, 섹터/자산/지역 매핑)
- [x] 수렴 감지 엔진 (Haversine 기반 지역별 신호 집계, 다중 신호 → 에스컬레이션)
- [x] 반도체 공급망 트래커 (11개 주요 기업 노드, 4개 리스크 시나리오)

## Phase 3: 투자 인텔리전스 (W11-13)

- [x] 이벤트 임팩트 스코어링 (-10 ~ +10, 강세/약세/중립)
  - 10개 신호 타입 × 방향/강도 → 서명 점수
  - 한국 자산 특화 (KOSPI 민감도 1.4×, KRW, NK 직접 노출 1.5×)
  - 다중 이벤트 집계 (24h 반감기 가중치)
- [x] 히스토리컬 패턴 매칭 ("과거 유사 이벤트 때 어떻게 됐나?")
  - 18개 주요 사건 DB (걸프전 ~ 2024 계엄령)
  - 키워드 유사도 + 신호 타입 매칭
  - 한국 투자자 관점 교훈 (keyLessonKo)
  - 섹터 로테이션 신호 (18개 규칙)
- [x] 포트폴리오 연동 및 리스크 노출도 계산
  - 9개 자산 클래스 민감도 행렬
  - 한국 자산 특화 (삼성전자, SK하이닉스 등 직접 매핑)
  - 헤지 제안 자동 생성
  - 샘플 포트폴리오 3종 (보수형/공격형/글로벌균형)
- [x] 3티어 알림 시스템 (CRITICAL / WATCH / INFO)
  - AlertManager 클래스 (지문 기반 중복 제거, TTL, 영속성)
  - 6개 소스: 블랙스완, VIP기, 시장 스트레스, 포트폴리오 리스크, 팬데믹, 핵
  - 스누즈 / 카테고리 음소거 / 일괄 확인 지원
- [x] Tail Risk Index → `api/blackswan.js` (Phase 2에서 완료)
- [x] v0.1.0 릴리스 (macOS Apple Silicon DMG — 2026-02-25)

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
