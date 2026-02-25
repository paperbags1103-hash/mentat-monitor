/**
 * Narrative Generator — Groq LLM + template fallback
 */

import type { InferenceResult, FusionResult } from './types.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `당신은 한국 개인투자자를 위한 지정학 리스크 분석가입니다.
구조화된 위협 분석 데이터를 바탕으로 한국어 투자 브리핑을 작성합니다.

규칙:
- 한국어로만 작성
- 250자 이내, 3-4문단
- 첫 문단: 현재 위협 수준 한 줄 요약
- 중간: 핵심 위협/기회 요인 2-3개
- 마지막: 구체적 투자 행동 제안 (종목·섹터 언급)
- 투기 조장 금지 — 리스크 관리 관점 유지
- 주어진 데이터 외 정보 추가 금지
- 과거 유사 사례가 있으면 반드시 언급`;

interface NarrativeInput {
  riskScore: number;
  riskLabel: string;
  inferences: Array<{
    title: string;
    summary: string;
    severity: string;
    suggestedAction: string;
    historicalRef?: string;
  }>;
  signalCount: number;
  convergenceZoneNames: string[];
}

function buildUserPrompt(input: NarrativeInput): string {
  const lines: string[] = [
    `위협 수준: ${input.riskScore}/100 (${input.riskLabel})`,
    `활성 신호: ${input.signalCount}개`,
    input.convergenceZoneNames.length > 0
      ? `수렴 지역: ${input.convergenceZoneNames.join(', ')}`
      : '수렴 지역: 없음',
    '',
    '주요 분석 결과:',
    ...input.inferences.slice(0, 4).map((inf, i) =>
      `${i + 1}. [${inf.severity}] ${inf.title}\n   ${inf.summary}\n   제안: ${inf.suggestedAction}${inf.historicalRef ? `\n   참고: ${inf.historicalRef}` : ''}`
    ),
  ];
  return lines.join('\n');
}

/** Cache last LLM narrative to avoid redundant calls (15 min TTL) */
let _lastNarrative: { text: string; ts: number } | null = null;
const NARRATIVE_CACHE_TTL = 15 * 60_000;

export async function generateNarrative(
  fusion: FusionResult,
  inferences: InferenceResult[],
  riskScore: number,
  riskLabel: string,
  entityNameFn: (id: string) => string,
  groqApiKey?: string,
): Promise<{ text: string; method: 'llm' | 'template' }> {

  const input: NarrativeInput = {
    riskScore,
    riskLabel,
    inferences: inferences.slice(0, 4).map(inf => ({
      title: inf.titleKo,
      summary: inf.summaryKo,
      severity: inf.severity,
      suggestedAction: inf.suggestedActionKo,
      historicalRef: inf.historicalPatternIds?.[0],
    })),
    signalCount: fusion.entitySignals.reduce((s, e) => s + e.signalCount, 0),
    convergenceZoneNames: fusion.activeConvergenceZones.map(entityNameFn),
  };

  // Try Groq LLM
  if (groqApiKey) {
    const cached = _lastNarrative;
    if (cached && Date.now() - cached.ts < NARRATIVE_CACHE_TTL) {
      return { text: cached.text, method: 'llm' };
    }

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(input) },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (text.length > 50) {
          _lastNarrative = { text, ts: Date.now() };
          return { text, method: 'llm' };
        }
      }
    } catch (e) {
      console.warn('[narrative] Groq failed, using template:', (e as Error).message);
    }
  }

  // Template fallback
  return { text: buildTemplateFallback(input), method: 'template' };
}

function buildTemplateFallback(input: NarrativeInput): string {
  const lines: string[] = [];

  if (input.inferences.length === 0) {
    lines.push(`[멘탯 브리핑] 위협 수준 ${input.riskLabel} (${input.riskScore}/100) — 현재 주요 위협 신호가 임계점 이하입니다. 정상적 시장 환경.`);
    return lines.join('\n');
  }

  lines.push(`[멘탯 브리핑] 위협 수준: ${input.riskLabel} (${input.riskScore}/100) | 활성 신호: ${input.signalCount}개\n`);

  for (const inf of input.inferences.slice(0, 3)) {
    lines.push(`▸ ${inf.title}`);
    lines.push(`  ${inf.summary}`);
    lines.push(`  💡 ${inf.suggestedAction}`);
    if (inf.historicalRef) lines.push(`  📖 참고: ${inf.historicalRef}`);
    lines.push('');
  }

  if (input.convergenceZoneNames.length > 0) {
    lines.push(`⚠️ 수렴 지역: ${input.convergenceZoneNames.join(', ')}`);
  }

  return lines.join('\n').trim();
}
