/**
 * Inference Rules — Mentat Monitor Insight Layer
 *
 * KEY IMPROVEMENT over basic spec:
 * Rules use `graph.getAffectedAssets(entityId)` and `graph.getImpactChain()`
 * to dynamically discover affected entities via traversal, not hardcoded lists.
 *
 * Rule evaluation order: lower priority number = checked first.
 * Once a rule fires for a primary entity, lower-priority rules for the same
 * entity are skipped (handled by inference-engine.ts).
 */

import type { InferenceResult, InferenceSeverity, InferenceContext } from './types.js';
import type { EntityGraph } from './entity-graph.js';
import type { FusionResult } from './types.js';
import { getEntityStrength, getEntitySignal } from './fusion.js';

export interface InferenceRule {
  id: string;
  priority: number;
  primaryEntityId?: string;   // if set, deduplicated per this entity
  evaluate(
    fusion: FusionResult,
    ctx: InferenceContext,
    graph: EntityGraph,
  ): InferenceResult | null;
}

// ─── Helper to build a result with graph-derived affected assets ─────────────

function buildResult(
  params: {
    ruleId: string;
    severity: InferenceSeverity;
    titleKo: string;
    summaryKo: string;
    suggestedActionKo: string;
    primaryEntityId: string;
    graph: EntityGraph;
    fusion: FusionResult;
    historicalPatternIds?: string[];
    kospiRange?: [number, number];
    krwDirection?: 'strengthen' | 'weaken' | 'neutral';
    confidence: number;
    triggerSignals: string[];
  }
): InferenceResult {
  // Use graph traversal to find affected assets — no hardcoded lists
  const affectedAssets = params.graph.getAffectedAssets(params.primaryEntityId, 2);
  const affectedEntityIds = [
    params.primaryEntityId,
    ...affectedAssets.map(a => a.assetId),
  ];

  // Find safe havens: assets with risk_on direction in fusion that are safe haven type
  const safeHavenIds = ['asset:GOLD', 'asset:USDJPY', 'asset:US10Y'];
  const activeSafeHavens = safeHavenIds.filter(id => {
    const s = getEntitySignal(params.fusion, id);
    return s && s.fusedStrength > 20 && s.fusedDirection === 'risk_on';
  });

  return {
    ruleId: params.ruleId,
    severity: params.severity,
    titleKo: params.titleKo,
    summaryKo: params.summaryKo,
    affectedEntityIds: [...new Set(affectedEntityIds)].slice(0, 8),
    suggestedActionKo: params.suggestedActionKo,
    historicalPatternIds: params.historicalPatternIds,
    expectedImpact: params.kospiRange ? {
      kospiRange: params.kospiRange,
      krwDirection: params.krwDirection ?? 'weaken',
      safeHavens: activeSafeHavens,
    } : undefined,
    confidence: params.confidence,
    triggerSignals: params.triggerSignals,
  };
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export const INFERENCE_RULES: InferenceRule[] = [

  // ── Rule 1: NK Compound Military + Command Aircraft ─────────────────────────
  {
    id: 'NK_COMPOUND_CRISIS',
    priority: 1,
    primaryEntityId: 'region:korean_peninsula',
    evaluate(fusion, ctx, graph) {
      const peninsulaStrength = getEntityStrength(fusion, 'region:korean_peninsula');
      const hasCommand = ctx.vipAircraftActive.some(a =>
        /nightwatch|e-4b|e-6b|tacamo|naoc/i.test(a)
      );
      if (peninsulaStrength < 60 || !hasCommand) return null;

      const signals = getEntitySignal(fusion, 'region:korean_peninsula')?.signals ?? [];
      return buildResult({
        ruleId: 'NK_COMPOUND_CRISIS', severity: 'CRITICAL', graph, fusion,
        primaryEntityId: 'region:korean_peninsula',
        titleKo: '🚨 복합 지정학-군사 위협 감지',
        summaryKo: `한반도 지역에서 복합 위협 신호(강도 ${peninsulaStrength.toFixed(0)}/100)가 감지되었으며, 미 핵지휘기가 비행 중입니다. 2017년 북핵 위기와 유사한 패턴입니다.`,
        suggestedActionKo: '코스피 비중 축소 긴급 검토. 방산주(한화에어로/KAI) 모멘텀 주목. 달러·금 헤지 강화. 단기 변동성 30% 이상 확대 대비.',
        historicalPatternIds: ['nk-icbm-2017'],
        kospiRange: [-3, -7], krwDirection: 'weaken',
        confidence: 0.85,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 2: NK Provocation (no command aircraft) ─────────────────────────────
  {
    id: 'NK_PROVOCATION',
    priority: 2,
    primaryEntityId: 'country:north_korea',
    evaluate(fusion, _ctx, graph) {
      const nkStrength = getEntityStrength(fusion, 'country:north_korea');
      const peninsulaStrength = getEntityStrength(fusion, 'region:korean_peninsula');
      if (nkStrength < 35 && peninsulaStrength < 30) return null;

      const signals = getEntitySignal(fusion, 'country:north_korea')?.signals ?? [];
      const combined = Math.max(nkStrength, peninsulaStrength);
      const severity: InferenceSeverity = combined > 65 ? 'ELEVATED' : 'WATCH';

      return buildResult({
        ruleId: 'NK_PROVOCATION', severity, graph, fusion,
        primaryEntityId: 'country:north_korea',
        titleKo: '⚠️ 북한 도발 신호 감지',
        summaryKo: `북한 관련 위협 신호(강도 ${combined.toFixed(0)}/100)가 임계점을 초과했습니다. 반복된 도발로 시장 내성이 형성되었으나 초기 하방 압박 가능성에 유의하세요.`,
        suggestedActionKo: '방산주(한화에어로, KAI) 단기 주목. KOSPI 1-3일 내 -1~-3% 하락 가능. 과거 패턴상 1주일 내 반등 경향.',
        historicalPatternIds: ['nk-2022-icbm'],
        kospiRange: [-1, -3], krwDirection: 'weaken',
        confidence: 0.70,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 3: Taiwan Strait Crisis ─────────────────────────────────────────────
  {
    id: 'TAIWAN_CRISIS',
    priority: 3,
    primaryEntityId: 'region:taiwan_strait',
    evaluate(fusion, _ctx, graph) {
      const straitStrength = getEntityStrength(fusion, 'region:taiwan_strait');
      if (straitStrength < 45) return null;

      const severity: InferenceSeverity = straitStrength > 75 ? 'CRITICAL' : 'ELEVATED';
      const signals = getEntitySignal(fusion, 'region:taiwan_strait')?.signals ?? [];

      // Use graph to find what companies are affected via sector:semiconductor
      const semiCompanies = graph.getCompaniesInSector('sector:semiconductor');
      const affectedTickers = semiCompanies.map(c => c.nameKo).join(', ');

      return buildResult({
        ruleId: 'TAIWAN_CRISIS', severity, graph, fusion,
        primaryEntityId: 'region:taiwan_strait',
        titleKo: '🇹🇼 대만해협 긴장 고조',
        summaryKo: `대만해협 복합 신호(강도 ${straitStrength.toFixed(0)}/100) 감지. 반도체 공급망 차질 위험. 영향 기업: ${affectedTickers || 'TSMC, 삼성전자, SK하이닉스'}.`,
        suggestedActionKo: '반도체 섹터 단기 변동성 확대. 삼성전자·SK하이닉스 단기 하락 후 TSMC 대체 수혜 가능성 공존. 해운(남중국해 경로) 차질 가능성.',
        historicalPatternIds: ['us-china-tariffs-2018'],
        kospiRange: [-2, -6], krwDirection: 'weaken',
        confidence: 0.70,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 4: Korean Political Crisis ──────────────────────────────────────────
  {
    id: 'KOREAN_POLITICAL_CRISIS',
    priority: 4,
    primaryEntityId: 'event:korea_politics',
    evaluate(fusion, _ctx, graph) {
      const koreaStrength = getEntityStrength(fusion, 'country:south_korea');
      const politicsSignal = getEntitySignal(fusion, 'event:korea_politics');
      const maxStrength = Math.max(koreaStrength, politicsSignal?.fusedStrength ?? 0);
      if (maxStrength < 40) return null;

      const signals = [
        ...(getEntitySignal(fusion, 'event:korea_politics')?.signals ?? []),
        ...(getEntitySignal(fusion, 'country:south_korea')?.signals.slice(0, 2) ?? []),
      ];

      return buildResult({
        ruleId: 'KOREAN_POLITICAL_CRISIS', severity: 'ELEVATED', graph, fusion,
        primaryEntityId: 'event:korea_politics',
        titleKo: '🇰🇷 국내 정치 리스크 부상',
        summaryKo: `한국 내 정치 불안정 신호(강도 ${maxStrength.toFixed(0)}/100) 감지. 2024년 계엄·탄핵 사태와 유사한 패턴. 외국인 이탈 및 KRW 약세 위험.`,
        suggestedActionKo: '외국인 순매도 경계. 원화 약세 헤지 고려. 과거 패턴상 정치 불확실성 해소 시 V자 반등 가능 — 매도보다 관망 우선.',
        historicalPatternIds: ['kospi-martial-law-2024'],
        kospiRange: [-2, -5], krwDirection: 'weaken',
        confidence: 0.65,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 5: Global Financial Stress ──────────────────────────────────────────
  {
    id: 'FINANCIAL_STRESS',
    priority: 5,
    primaryEntityId: 'asset:VIX',
    evaluate(fusion, ctx, graph) {
      const vixStrength = getEntityStrength(fusion, 'asset:VIX');
      if (ctx.tailRiskScore < 55 && vixStrength < 60) return null;

      const severity: InferenceSeverity = ctx.tailRiskScore > 80 || vixStrength > 80 ? 'CRITICAL' : 'ELEVATED';
      const signals = getEntitySignal(fusion, 'asset:VIX')?.signals ?? [];

      return buildResult({
        ruleId: 'FINANCIAL_STRESS', severity, graph, fusion,
        primaryEntityId: 'asset:VIX',
        titleKo: '📉 글로벌 금융 스트레스 경보',
        summaryKo: `테일리스크 지수 ${ctx.tailRiskScore}/100. VIX 공포지수 급등 및 복합 금융 스트레스 신호. 2020 코로나 충격 초기와 유사한 패턴.`,
        suggestedActionKo: '현금 비중 확대. 고베타 종목(코스닥, 암호화폐) 비중 축소. 미 국채·금 방어 배분. 코스피 레버리지 ETF 제거.',
        historicalPatternIds: ['covid-2020', 'gfc-2008'],
        kospiRange: [-3, -8], krwDirection: 'weaken',
        confidence: 0.80,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 6: Oil Supply Shock ───────────────────────────────────────────────
  {
    id: 'OIL_SHOCK',
    priority: 6,
    primaryEntityId: 'asset:OIL',
    evaluate(fusion, _ctx, graph) {
      const oilStrength = getEntityStrength(fusion, 'asset:OIL');
      const meStrength = getEntityStrength(fusion, 'region:middle_east');
      if (oilStrength < 45 || meStrength < 25) return null;

      const signals = [
        ...(getEntitySignal(fusion, 'asset:OIL')?.signals ?? []),
        ...(getEntitySignal(fusion, 'region:middle_east')?.signals.slice(0, 2) ?? []),
      ];

      // Graph traversal: who else is affected by OIL?
      const oilImpactChain = graph.getImpactChain('event:oil_shock', 2, 0.5);
      const affectedSectors = oilImpactChain
        .filter(n => n.entity?.type === 'sector')
        .map(n => n.entity?.nameKo ?? '').filter(Boolean)
        .join(', ');

      return buildResult({
        ruleId: 'OIL_SHOCK', severity: 'ELEVATED', graph, fusion,
        primaryEntityId: 'asset:OIL',
        titleKo: '🛢️ 원유 공급 충격 위험',
        summaryKo: `중동 지역 긴장(${meStrength.toFixed(0)}/100)과 원유 가격 이상 신호(${oilStrength.toFixed(0)}/100) 동시 감지. 에너지 수입 의존 한국 경제 전반 압박.`,
        suggestedActionKo: `에너지주·정유주 강세 수혜. 항공·해운·화학 비용 부담. 영향 섹터: ${affectedSectors || '에너지, 운송, 화학'}. KRW 약세 대비.`,
        historicalPatternIds: ['aramco-attack-2019'],
        kospiRange: [-1, -4], krwDirection: 'weaken',
        confidence: 0.65,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 7: Pandemic Signal ────────────────────────────────────────────────
  {
    id: 'PANDEMIC_RISK',
    priority: 7,
    primaryEntityId: 'event:pandemic',
    evaluate(fusion, _ctx, graph) {
      const pandemicStrength = getEntityStrength(fusion, 'event:pandemic');
      if (pandemicStrength < 45) return null;

      const severity: InferenceSeverity = pandemicStrength > 75 ? 'CRITICAL' : 'WATCH';
      const signals = getEntitySignal(fusion, 'event:pandemic')?.signals ?? [];

      // Graph: which companies benefit? (bio_pharma sector members)
      const bioPharmaCompanies = graph.getCompaniesInSector('sector:bio_pharma');
      const beneficiaries = bioPharmaCompanies.map(c => c.nameKo).join(', ');

      return buildResult({
        ruleId: 'PANDEMIC_RISK', severity, graph, fusion,
        primaryEntityId: 'event:pandemic',
        titleKo: '🦠 팬데믹 리스크 상승',
        summaryKo: `ProMED/WHO/뉴스에서 감염병 이상 신호(강도 ${pandemicStrength.toFixed(0)}/100) 감지. 초기 단계에서 과거 패턴상 2020 코로나 충격 전조와 유사.`,
        suggestedActionKo: `바이오/제약 섹터(${beneficiaries || '셀트리온'}) 주목. 항공·관광 포지션 경계. 아직 확정 전이므로 과도한 포지션 조정 자제.`,
        historicalPatternIds: ['covid-2020', 'mers-2015'],
        kospiRange: [-1, -4], krwDirection: 'neutral',
        confidence: 0.50,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 8: Fed Dovish Pivot ──────────────────────────────────────────────
  {
    id: 'FED_DOVISH_PIVOT',
    priority: 8,
    primaryEntityId: 'inst:fed',
    evaluate(fusion, ctx, graph) {
      const fedEvent = ctx.economicCalendar.find(e => /fomc/i.test(e.event) && e.daysUntil >= 0 && e.daysUntil <= 3);
      const usdkrwSignal = getEntitySignal(fusion, 'asset:USDKRW');
      if (!fedEvent) return null;
      if (!usdkrwSignal || usdkrwSignal.fusedDirection !== 'risk_on') return null;

      const signals = getEntitySignal(fusion, 'inst:fed')?.signals ?? [];

      return buildResult({
        ruleId: 'FED_DOVISH_PIVOT', severity: 'WATCH', graph, fusion,
        primaryEntityId: 'inst:fed',
        titleKo: '🏛️ 연준 비둘기파 전환 신호',
        summaryKo: `FOMC ${fedEvent.daysUntil}일 후 예정. 원/달러 환율 하락(원화 강세) 신호와 함께 금리 인하 기대감이 반영되고 있습니다.`,
        suggestedActionKo: '외국인 순매수 유입 기대. 코스피·코스닥 상승 모멘텀. 성장주·기술주 비중 확대 고려. 2차전지·IT 수혜.',
        kospiRange: [1, 4], krwDirection: 'strengthen',
        confidence: 0.55,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 9: Fed Hawkish Surprise ─────────────────────────────────────────
  {
    id: 'FED_HAWKISH',
    priority: 9,
    primaryEntityId: 'inst:fed',
    evaluate(fusion, ctx, graph) {
      const fedEvent = ctx.economicCalendar.find(e => /fomc/i.test(e.event) && e.daysUntil >= 0 && e.daysUntil <= 3);
      const usdkrwSignal = getEntitySignal(fusion, 'asset:USDKRW');
      if (!fedEvent) return null;
      if (!usdkrwSignal || usdkrwSignal.fusedDirection !== 'risk_off') return null;

      const signals = getEntitySignal(fusion, 'inst:fed')?.signals ?? [];

      return buildResult({
        ruleId: 'FED_HAWKISH', severity: 'WATCH', graph, fusion,
        primaryEntityId: 'inst:fed',
        titleKo: '🦅 연준 매파 서프라이즈 경계',
        summaryKo: `FOMC ${fedEvent.daysUntil}일 후 예정. 원화 약세 신호가 금리 인상 지속 또는 긴축 장기화 우려를 반영 중.`,
        suggestedActionKo: '외국인 이탈 리스크. 고PER 성장주 조심. 달러 자산·단기채 비중 확대. 코스닥 변동성 확대 예상.',
        kospiRange: [-2, -4], krwDirection: 'weaken',
        confidence: 0.55,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 10: BOK Rate Decision ────────────────────────────────────────────
  {
    id: 'BOK_RATE_DECISION',
    priority: 10,
    primaryEntityId: 'inst:bok',
    evaluate(fusion, ctx, graph) {
      const bokEvent = ctx.economicCalendar.find(e => /bok|bank of korea/i.test(e.event) && e.daysUntil >= 0 && e.daysUntil <= 2);
      if (!bokEvent) return null;

      const signals = getEntitySignal(fusion, 'inst:bok')?.signals ?? [];

      return buildResult({
        ruleId: 'BOK_RATE_DECISION', severity: 'WATCH', graph, fusion,
        primaryEntityId: 'inst:bok',
        titleKo: '🏦 한국은행 금리결정 임박',
        summaryKo: `한국은행 금통위 ${bokEvent.daysUntil === 0 ? '오늘' : `${bokEvent.daysUntil}일 후`} 예정. 환율·채권·외국인 자금 흐름에 주목.`,
        suggestedActionKo: '금리 동결: 시장 중립. 인하: 건설·부동산·은행 수혜, 원화 약세. 인상: 은행주 수혜, 성장주 부담.',
        confidence: 0.60,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 11: Semiconductor Supply Chain ───────────────────────────────────
  {
    id: 'SEMI_SUPPLY_DISRUPTION',
    priority: 11,
    primaryEntityId: 'sector:semiconductor',
    evaluate(fusion, _ctx, graph) {
      const semiStrength = getEntityStrength(fusion, 'sector:semiconductor');
      const tsmcStrength = getEntityStrength(fusion, 'company:tsmc');
      const maxStrength = Math.max(semiStrength, tsmcStrength);
      if (maxStrength < 40) return null;

      const signals = [
        ...(getEntitySignal(fusion, 'sector:semiconductor')?.signals ?? []),
        ...(getEntitySignal(fusion, 'company:tsmc')?.signals.slice(0, 2) ?? []),
      ];

      // Graph: which Korean companies are in semiconductor sector?
      const koreaChips = graph.getCompaniesInSector('sector:semiconductor')
        .filter(c => /\.KS$/.test(c.meta?.ticker as string ?? ''));
      const tickersKo = koreaChips.map(c => c.nameKo).join(', ');

      return buildResult({
        ruleId: 'SEMI_SUPPLY_DISRUPTION', severity: 'WATCH', graph, fusion,
        primaryEntityId: 'sector:semiconductor',
        titleKo: '🔧 반도체 공급망 교란 감지',
        summaryKo: `반도체 섹터 복합 신호(강도 ${maxStrength.toFixed(0)}/100) 감지. 영향 기업: ${tickersKo || '삼성전자, SK하이닉스'}.`,
        suggestedActionKo: '단기 반도체 섹터 변동성 확대. TSMC 차질 시 삼성/하이닉스 대체 수요 가능성과 리스크오프 중 선택. 실적 모멘텀 확인 필요.',
        kospiRange: [-1, -3], krwDirection: 'neutral',
        confidence: 0.60,
        triggerSignals: signals.map(s => s.id),
      });
    },
  },

  // ── Rule 12: Multi-Region Convergence ────────────────────────────────────
  {
    id: 'MULTI_REGION_CONVERGENCE',
    priority: 12,
    evaluate(fusion, _ctx, graph) {
      if (fusion.activeConvergenceZones.length < 2) return null;

      const zoneNames = fusion.activeConvergenceZones
        .map(id => graph.getEntityKo(id))
        .join(', ');

      const signals = fusion.entitySignals
        .filter(e => fusion.activeConvergenceZones.includes(e.entityId))
        .flatMap(e => e.signals)
        .slice(0, 8);

      return {
        ruleId: 'MULTI_REGION_CONVERGENCE',
        severity: 'ELEVATED',
        titleKo: '🌍 복수 지역 동시 위기 신호',
        summaryKo: `${zoneNames}에서 동시에 복합 위협 신호가 수렴 중입니다. 글로벌 리스크오프 및 안전자산 선호 환경.`,
        affectedEntityIds: [...fusion.activeConvergenceZones, 'asset:KS11', 'asset:GOLD', 'asset:VIX'],
        suggestedActionKo: '글로벌 위기 모드 전환 가능성. 현금+금+달러 방어적 배분. 한국 증시 외국인 순매도 경계.',
        expectedImpact: { kospiRange: [-3, -6], krwDirection: 'weaken', safeHavens: ['asset:GOLD', 'asset:US10Y'] },
        confidence: 0.70,
        triggerSignals: signals.map(s => s.id),
      };
    },
  },

  // ── Rule 13: VIP Aircraft Unusual Activity ────────────────────────────────
  {
    id: 'VIP_AIRCRAFT_UNUSUAL',
    priority: 13,
    evaluate(_fusion, ctx, _graph) {
      if (ctx.vipAircraftActive.length < 3) return null;

      return {
        ruleId: 'VIP_AIRCRAFT_UNUSUAL',
        severity: 'WATCH',
        titleKo: '✈️ VIP/군용기 다수 동시 비행',
        summaryKo: `${ctx.vipAircraftActive.length}대의 주요 군/정부 항공기가 동시 비행 중: ${ctx.vipAircraftActive.slice(0, 3).join(', ')}${ctx.vipAircraftActive.length > 3 ? ' 외' : ''}.`,
        affectedEntityIds: ['region:east_asia', 'asset:KS11'],
        suggestedActionKo: '비공개 외교·군사 활동 가능성. 추가 신호 모니터링 강화. 현재 단독으로는 포지션 조정 근거 부족.',
        confidence: 0.50,
        triggerSignals: [],
      };
    },
  },

  // ── Rule 14: Kimchi Premium Anomaly ───────────────────────────────────────
  {
    id: 'KIMCHI_PREMIUM_ANOMALY',
    priority: 14,
    primaryEntityId: 'asset:BTC',
    evaluate(fusion, ctx, _graph) {
      if (ctx.kimchiPremium === undefined || Math.abs(ctx.kimchiPremium) < 5) return null;

      const premium = ctx.kimchiPremium;
      const signals = getEntitySignal(fusion, 'asset:BTC')?.signals ?? [];

      return {
        ruleId: 'KIMCHI_PREMIUM_ANOMALY',
        severity: 'INFO',
        titleKo: `💰 김치 프리미엄 이상 (${premium > 0 ? '+' : ''}${premium.toFixed(1)}%)`,
        summaryKo: premium > 0
          ? `국내 암호화폐 매수 수요 급증. 개인투자자 위험선호 과열 신호. 과거 김치 프리미엄 10%+ 시 단기 조정 빈번.`
          : `김치 프리미엄 역전(디스카운트 ${Math.abs(premium).toFixed(1)}%). 자금 유출 또는 투자심리 위축 신호.`,
        affectedEntityIds: ['asset:BTC', 'asset:KS11', 'asset:KQ11'],
        suggestedActionKo: premium > 0
          ? '역발상: 고프리미엄 구간에서 차익실현 고려. 단기 조정 임박 가능성.'
          : '투자심리 냉각 중. 저점 탐색 구간일 수 있으나 추세 확인 후 진입.',
        confidence: 0.55,
        triggerSignals: signals.map(s => s.id),
      };
    },
  },

  // ── Rule 15: Calm Market (INFO, fires last) ────────────────────────────────
  {
    id: 'CALM_MARKET',
    priority: 99,
    evaluate(fusion, ctx, _graph) {
      if (fusion.globalRiskLevel >= 20 || fusion.activeConvergenceZones.length > 0) return null;
      if (ctx.tailRiskScore >= 30) return null;

      return {
        ruleId: 'CALM_MARKET',
        severity: 'INFO',
        titleKo: '✅ 시장 안정 구간',
        summaryKo: '주요 지정학·금융 위협 신호가 임계점 이하입니다. 현재 글로벌 리스크는 낮은 수준입니다.',
        affectedEntityIds: ['asset:KS11'],
        suggestedActionKo: '정상적 시장 환경. 기본 투자 전략 유지. 펀더멘털 중심 종목 선정 집중.',
        confidence: 0.85,
        triggerSignals: [],
      };
    },
  },
];
