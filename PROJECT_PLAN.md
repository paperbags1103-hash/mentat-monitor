# Signal — 프로젝트 플랜

> 지정학/OSINT 신호를 실시간으로 수집해서 투자 임팩트로 자동 번역해주는 오픈소스 인텔리전스 플랫폼

---

## 1. 컨셉 검토 및 조정

### ✅ 강점 (유지)
- World Monitor의 기존 인프라(36+ 레이어, 150+ RSS, 3D 글로브, Tauri 앱)를 그대로 활용 — 엄청난 시간 절약
- Finance Monitor 변형이 이미 존재 (92개 거래소, 19 금융센터, 13 중앙은행) → 좋은 출발점
- 로컬 LLM(Ollama) 지원 → 프라이버시 민감한 한국 투자자에게 어필
- AGPL v3 → 포크 시 동일 라이선스 유지 필수, 상업적 SaaS 불가 (이건 "무료 오픈소스" 컨셉과 정합)

### ⚠️ 과도한 것 (스코프 축소 권고)

| 기능 | 문제 | 권고 |
|------|------|------|
| Google Popular Times (펜타곤 피자 지수) | Google Places API 유료 + 정부청사 데이터 정확도 낮음 | **Phase 3 이후로 연기**, 대신 Google Trends 키워드만 추적 |
| 위성 이미지 항구/주차장 밀도 | Sentinel-2 무료이나 해상도 10m로 주차장 분석 불가, 상용은 월 수백만원 | **제거** — 비용 대비 가치 부족 |
| AIS 선박 신호 소실 패턴 | MarineTraffic API 유료, 무료 대안(AISHub) 커버리지 제한 | **Phase 2로 연기**, AISHub 무료 피드로 프로토타입만 |
| VIP 이동추적 전체 | 흥미롭지만 테일넘버 DB 유지보수 부담 + 프라이버시 논란 | **Phase 2**, 공개 군용기/정부기만 추적 (민간인 제외) |
| AI 시나리오 분석 | LLM 환각 리스크 → 투자 조언으로 오해 시 법적 리스크 | **Phase 3**, "참고용" 면책 강조 |

### 🔴 빠진 것 (추가 권고)

| 기능 | 이유 | 우선순위 |
|------|------|----------|
| **경제 캘린더 통합** | FOMC, BOK, ECB 등 금리 결정 일정 — 투자자 필수 | Phase 1 필수 |
| **SNS 감성 분석** | X(Twitter) 핀포인트 키워드 실시간 감성 (Fear & Greed 대용) | Phase 2 |
| **제재/관세 트래커** | OFAC 제재 리스트 변경, 관세 발표 자동 감지 | Phase 1 |
| **원자재 가격 피드** | WTI, 금, 구리, 천연가스 — 지정학 이벤트의 즉각적 프록시 | Phase 1 필수 |
| **Fear & Greed Index 클론** | VIX + 풋콜비율 + 안전자산 흐름으로 자체 계산 | Phase 2 |

---

## 2. MVP 범위 정의 (3개월, 1인~2인 기준)

### Phase 1: 기반 구축 (Week 1-6)

**목표:** World Monitor 포크 → Signal 브랜드 → 한국 투자자용 기본 대시보드

| 주차 | 작업 | 산출물 |
|------|------|--------|
| W1-2 | 포크 + 브랜딩 + 빌드 파이프라인 정리 | Signal 이름, 로고, CI/CD (GitHub Actions), Tauri 빌드 확인 |
| W1-2 | 한국어 로케일 추가 (i18n 번들) | ko.json, UI 전체 한국어화 |
| W3-4 | **한국 뉴스 RSS 피드 30개+** 추가 | 연합뉴스, YTN, 한겨레, 조선일보, 매일경제, 한국은행, 금감원 등 |
| W3-4 | **경제 캘린더 레이어** | investing.com 스크래핑 또는 FMP API (무료 티어) |
| W5-6 | **한국 시장 데이터 레이어** | 코스피/코스닥 (KRX OPEN API), 원달러 환율, 김치 프리미엄 |
| W5-6 | **원자재 가격 피드** | WTI, 금, 구리 (Yahoo Finance API 무료) |
| W5-6 | **북한 도발 타임라인** | 38 North RSS + CSIS Beyond Parallel + 수동 JSON DB |

**Phase 1 핵심 지표:** 한국어로 된 뉴스 + 시장 데이터 + 경제 캘린더가 3D 글로브 위에 표시

### Phase 2: 신호 수집 강화 (Week 7-10)

| 주차 | 작업 | 산출물 |
|------|------|--------|
| W7-8 | **블랙스완 조기경보 v1** | Google Trends 키워드 모니터링, Cloudflare Radar, FRED 데이터 (TED Spread, 레포금리) |
| W7-8 | **이벤트 태깅 시스템** | LLM 기반 자동 태깅 (섹터, 자산 클래스, 지역) |
| W9-10 | **항공기 추적 v1** | OpenSky Network API → 군용기/정부기 레이어 (글로브 위 실시간) |
| W9-10 | **수렴 감지 기본** | 동일 지역 반경 500km 내 3개+ 신호 → 에스컬레이션 배지 |
| W9-10 | **반도체 공급망 트래커 v1** | TSMC/삼성/ASML 관련 뉴스 자동 태깅 + 공급망 맵 레이어 |

### Phase 3: 임팩트 & 포트폴리오 (Week 11-13)

| 주차 | 작업 | 산출물 |
|------|------|--------|
| W11-12 | **임팩트 스코어링** | 이벤트별 1-10 스코어 + 방향성 (강세/약세/중립) |
| W11-12 | **히스토리컬 패턴 매칭 v1** | 과거 유사 이벤트 DB (수동 큐레이션 50개+) + 자동 매칭 |
| W12-13 | **포트폴리오 입력 & 리스크 노출** | 종목 입력 → 활성 신호와 매칭 → 노출도 표시 |
| W13 | **알림 시스템** | 3티어 (CRITICAL/WATCH/INFO), 브라우저 알림 + 선택적 디스코드 웹훅 |
| W13 | **v0.1.0 릴리스** | GitHub Release + Tauri 바이너리 (macOS/Windows/Linux) |

---

## 3. 기술 아키텍처

### 3.1 스택 (World Monitor 기반 유지)

```
┌─────────────────────────────────────────────────┐
│                  Tauri Desktop App               │
│              (macOS / Windows / Linux)           │
├─────────────────────────────────────────────────┤
│   Frontend: TypeScript + Vite + React            │
│   지도: deck.gl + MapLibre GL JS (3D Globe)      │
│   상태: Zustand or 기존 상태관리 유지              │
├─────────────────────────────────────────────────┤
│   Tauri Rust Backend (사이드카)                   │
│   ├── RSS Collector (기존 확장)                   │
│   ├── API Fetcher (스케줄러)                      │
│   ├── SQLite (로컬 캐시 + 포트폴리오)             │
│   ├── Proto-first API (기존 17 서비스 확장)       │
│   └── Ollama Bridge (AI 요약/태깅)               │
├─────────────────────────────────────────────────┤
│   External Data Sources (API/RSS/WebSocket)      │
└─────────────────────────────────────────────────┘
```

### 3.2 핵심 아키텍처 결정

| 결정사항 | 선택 | 근거 |
|----------|------|------|
| 백엔드 | **Tauri Rust 사이드카 유지** | World Monitor 구조 존중, 서버 비용 0원 |
| DB | **SQLite (기존)** + 선택적 DuckDB | 로컬 우선, 히스토리컬 데이터 분석 시 DuckDB |
| 데이터 수집 | **Rust 스케줄러 (cron식)** | RSS 5분, API 1-15분, 실시간은 WebSocket |
| AI | **Ollama 로컬 LLM** (기본) + OpenAI API (선택) | 프라이버시 기본, 성능 원하면 API 키 입력 |
| 호스팅 | **없음 (데스크탑 앱)** | 서버 비용 0원, 사용자 데이터 로컬 보관 |
| 웹 버전 | **GitHub Pages (정적)** + 브라우저 API 호출 | 선택적, PWA 지원 (기존 World Monitor처럼) |
| Proto/API | **기존 Proto-first 구조 확장** | 타입 안전성 유지, 신규 서비스 추가 |

### 3.3 데이터 파이프라인

```
[Sources] → [Fetcher/Parser] → [Normalizer] → [SQLite Cache]
                                      ↓
                              [LLM Tagger] → [Event Store]
                                      ↓
                           [Impact Scorer] → [Alert Engine]
                                      ↓
                            [Globe Renderer] ← [Layer Manager]
```

**이벤트 정규화 스키마:**
```typescript
interface SignalEvent {
  id: string;
  source: string;           // "rss:yonhap" | "api:opensky" | "api:fred"
  type: SignalType;          // GEOPOLITICAL | MILITARY | ECONOMIC | PANDEMIC | CYBER
  title: string;
  summary: string;          // AI 생성
  lat: number;
  lng: number;
  timestamp: number;
  severity: 1 | 2 | 3 | 4 | 5;
  tags: string[];           // ["semiconductor", "KOSPI", "USD/KRW"]
  impactScore?: number;     // -10 ~ +10 (약세~강세)
  sectors?: string[];       // ["tech", "defense", "energy"]
  relatedAssets?: string[]; // ["005930.KS", "NVDA", "WTI"]
  convergenceZone?: string; // 수렴 감지 시 zone ID
}
```

---

## 4. 데이터 소스 목록

### Layer 1: 신호 수집

#### 뉴스/지정학 (Phase 1)

| 소스 | 무료/유료 | API 형태 | 주기 | 비고 |
|------|-----------|----------|------|------|
| 연합뉴스 RSS | 무료 | RSS | 5분 | 한국어 주요 뉴스 |
| YTN RSS | 무료 | RSS | 5분 | |
| 매일경제 RSS | 무료 | RSS | 5분 | 경제 특화 |
| 한국은행 보도자료 | 무료 | RSS/HTML | 1시간 | 금리 결정 등 |
| 38 North | 무료 | RSS | 1시간 | 북한 분석 |
| CSIS Beyond Parallel | 무료 | RSS | 1시간 | 북한 위성 분석 |
| KCNA Watch | 무료 | RSS | 1시간 | 북한 관영매체 번역 |
| Reuters/AP/BBC (기존) | 무료 | RSS | 5분 | World Monitor 기존 |
| GDELT Project | 무료 | REST API | 15분 | 글로벌 이벤트 DB |

#### 시장 데이터 (Phase 1)

| 소스 | 무료/유료 | API 형태 | 주기 | 비고 |
|------|-----------|----------|------|------|
| KRX 정보데이터시스템 | 무료 | REST API | 실시간(장중) | 코스피/코스닥, 등록 필요 |
| 한국은행 ECOS | 무료 | REST API | 1일 | 환율, 금리 |
| Yahoo Finance | 무료 | 비공식 API | 15분 | 글로벌 지수, 원자재 |
| FRED (세인트루이스 연준) | 무료 | REST API | 1일 | TED Spread, 레포금리, VIX |
| 업비트 API | 무료 | WebSocket | 실시간 | BTC/KRW (김치 프리미엄 계산) |
| 바이낸스 API | 무료 | WebSocket | 실시간 | BTC/USDT |
| Financial Modeling Prep | 프리미엄($14/월) | REST API | 15분 | 경제 캘린더, 실적 일정 |

#### 블랙스완 조기경보 (Phase 2)

| 소스 | 무료/유료 | API 형태 | 주기 | 비고 |
|------|-----------|----------|------|------|
| Google Trends | 무료 | pytrends (비공식) | 4시간 | 키워드 트렌드, 레이트리밋 주의 |
| Cloudflare Radar | 무료 | REST API | 1시간 | 인터넷 장애 감지 |
| ProMED-mail | 무료 | RSS/이메일 | 1시간 | 팬데믹 조기경보 |
| IAEA PRIS | 무료 | HTML 스크래핑 | 6시간 | 원전 상태 |
| WHO Disease Outbreak News | 무료 | RSS | 1시간 | |

#### VIP 항공 추적 (Phase 2)

| 소스 | 무료/유료 | API 형태 | 주기 | 비고 |
|------|-----------|----------|------|------|
| OpenSky Network | 무료 | REST API | 10초 | 레이트리밋: 비인증 100/일, 인증 4000/일 |
| ADS-B Exchange | 무료(기본)/유료(API) | REST API | 실시간 | RapidAPI $10/월 for 빠른 접근 |
| 군용기 테일넘버 DB | 무료 | 자체 JSON | 수동 | Milamos, PlaneSpotters 참조 |

#### 선박/해양 (Phase 3+)

| 소스 | 무료/유료 | API 형태 | 주기 | 비고 |
|------|-----------|----------|------|------|
| AISHub | 무료(기여형) | TCP/UDP | 실시간 | 데이터 기여 필요 |
| MarineTraffic | 유료($$$) | REST API | — | 비용 높아 초기 제외 |

### Layer 2: 임팩트 매핑 (Phase 3)

| 소스 | 무료/유료 | 용도 |
|------|-----------|------|
| 자체 히스토리컬 DB | 무료 | 과거 이벤트-시장반응 매핑 (수동 큐레이션) |
| Ollama (Llama 3, Mistral 등) | 무료 | 이벤트 태깅, 임팩트 스코어링 |
| GICS 섹터 분류 | 무료 | 종목-섹터 매핑 |

### Layer 3: 포트폴리오 (Phase 3)

| 소스 | 무료/유료 | 용도 |
|------|-----------|------|
| 사용자 수동 입력 | — | 보유 종목 목록 |
| Yahoo Finance | 무료 | 종목 메타데이터 (섹터, 산업, 국가) |

---

## 5. 리스크 및 주의사항

### 법적 리스크

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|-----------|
| **투자 조언 해당 여부** | 🔴 높음 | 모든 화면에 "투자 조언이 아닙니다" 면책 고지. 임팩트 스코어는 "참고 정보"로 명시. 자본시장법 제9조 투자자문업 해당 여부 법률 검토 필요 |
| **AGPL v3 라이선스** | 🟡 중간 | 포크 시 동일 AGPL v3 적용 필수. 소스코드 공개 의무. SaaS 제공 시 네트워크 사용자에게도 소스 공개 필요 → 오픈소스 유지하면 문제 없음 |
| **데이터 스크래핑 합법성** | 🟡 중간 | RSS/공개 API만 사용. Google Trends 비공식 API는 ToS 위반 가능 → pytrends 사용 시 레이트리밋 엄수, 차단 시 대체재(SerpAPI $50/월) 준비 |
| **항공 데이터 프라이버시** | 🟡 중간 | 개인(민간인) 항공기 추적 제외. 군용기/정부기만 추적. ICAO Annex 10 익명화 요청 항공기 자동 필터링 |
| **북한 관련 콘텐츠** | 🟢 낮음 | 공개 소스 분석만 (OSINT). 국가정보원법 위반 소지 없도록 추측성 정보 라벨링 명확히 |

### 기술적 리스크

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|-----------|
| **API 레이트리밋/차단** | 🔴 높음 | 모든 API에 exponential backoff + 캐시 레이어. 무료 티어 한도 모니터링 대시보드. 핵심 소스 2개+ 대체재 확보 |
| **LLM 태깅 정확도** | 🟡 중간 | 초기에는 룰 기반 태깅 병행. LLM은 보조. 사용자 피드백으로 지속 개선 |
| **LLM 환각 (임팩트 스코어)** | 🔴 높음 | 임팩트 스코어에 "AI 생성" 뱃지 명시. 히스토리컬 매칭은 수동 큐레이션 DB 우선, LLM은 보조 |
| **Tauri 빌드 복잡성** | 🟡 중간 | World Monitor의 기존 CI/CD 그대로 사용. OS별 테스트 자동화 |
| **데이터 볼륨 증가** | 🟡 중간 | SQLite는 10GB+도 감당 가능. 오래된 데이터 자동 아카이브 (90일 기본) |
| **OpenSky API 안정성** | 🟡 중간 | 무료 티어 불안정. 캐시 적극 활용 + ADS-B Exchange 대체 |

### 운영 리스크

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|-----------|
| **1-2인 개발 번아웃** | 🔴 높음 | MVP 스코프 엄격 관리. Phase 1만 완성해도 가치 있는 프로덕트가 되도록 설계. 커뮤니티 기여 유도 |
| **World Monitor 업스트림 변경** | 🟡 중간 | 주기적 업스트림 머지 전략 수립. 코어 변경 최소화, 플러그인/레이어 형태로 기능 추가 |

---

## 6. 실행 체크리스트 (Phase 1 킥오프)

- [ ] World Monitor 포크 + `signal` 레포 생성
- [ ] AGPL v3 라이선스 확인 + NOTICE 파일 작성
- [ ] 브랜딩 (이름 확정, 로고, 컬러 팔레트)
- [ ] 한국어 i18n 번들 (`ko.json`) 생성
- [ ] 한국 뉴스 RSS 피드 30개 수집 + 테스트
- [ ] KRX API 키 발급 + 연동 프로토타입
- [ ] 업비트/바이낸스 WebSocket 김치 프리미엄 계산
- [ ] Yahoo Finance 원자재 피드 연동
- [ ] FRED API 키 발급 + 핵심 지표 5개 연동
- [ ] 북한 도발 히스토리컬 DB (JSON) 초기 데이터 50건+
- [ ] 경제 캘린더 레이어 구현
- [ ] Tauri 빌드 확인 (macOS ARM/x64, Windows, Linux)
- [ ] GitHub Actions CI/CD 파이프라인
- [ ] README.md (한국어/영어 병행)

---

## 부록: 이름 후보

| 이름 | 장점 | 단점 |
|------|------|------|
| **Signal** | 직관적, 강렬 | 메신저 Signal과 혼동 |
| **Sigint** | OSINT/SIGINT 감성 | 군사용어라 딱딱 |
| **Overwatch** | 게이머 친화적 | 블리자드 상표 |
| **Sentinel** | 감시/경계 의미 | GitHub Sentinel 등 기존 사용 많음 |
| **Haetae (해태)** | 한국 수호신, 유니크 | 외국인 발음 어려움 |
| **Nuri (누리)** | "세상" 의미, 한국적 | 누리호와 혼동 |

**권고:** "Signal"은 메신저와 혼동 우려. **"Sentinel"** 또는 **"Haetae"** 추천. 한국 타겟이면 "해태"가 독특한 브랜딩 가능.
