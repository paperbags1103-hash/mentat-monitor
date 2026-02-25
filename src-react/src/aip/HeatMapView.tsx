/**
 * HeatMapView — 글로벌 리스크 히트맵 (시각적 그리드)
 * 지역별 위협 강도를 색상 블록으로 표시
 */
import { useMemo } from 'react';
import { useStore } from '@/store';

interface Region {
  id: string;
  nameKo: string;
  continent: string;
  entityIds: string[];
  lat: number;  // normalized 0-100 for grid
  lng: number;
}

const REGIONS: Region[] = [
  // East Asia
  { id: 'nk',     nameKo: '북한',   continent: '동아시아', entityIds: ['country:north_korea'],   lat: 22, lng: 75 },
  { id: 'kr',     nameKo: '한국',   continent: '동아시아', entityIds: ['country:south_korea'],   lat: 25, lng: 74 },
  { id: 'cn',     nameKo: '중국',   continent: '동아시아', entityIds: ['country:china'],         lat: 28, lng: 72 },
  { id: 'tw',     nameKo: '대만',   continent: '동아시아', entityIds: ['region:taiwan_strait'],  lat: 28, lng: 75 },
  { id: 'jp',     nameKo: '일본',   continent: '동아시아', entityIds: ['country:japan'],         lat: 24, lng: 78 },
  { id: 'sea',    nameKo: '동남아', continent: '동아시아', entityIds: ['region:east_asia'],      lat: 32, lng: 74 },
  // Middle East
  { id: 'il',     nameKo: '이스라엘', continent: '중동', entityIds: ['country:israel'],        lat: 28, lng: 57 },
  { id: 'ir',     nameKo: '이란',   continent: '중동', entityIds: ['country:iran'],            lat: 27, lng: 60 },
  { id: 'sa',     nameKo: '사우디', continent: '중동', entityIds: ['region:middle_east'],      lat: 30, lng: 59 },
  // Europe
  { id: 'ua',     nameKo: '우크라이나', continent: '유럽', entityIds: ['country:ukraine'],    lat: 20, lng: 55 },
  { id: 'ru',     nameKo: '러시아',   continent: '유럽', entityIds: ['country:russia'],        lat: 15, lng: 62 },
  { id: 'eu',     nameKo: '유럽',     continent: '유럽', entityIds: ['region:europe'],         lat: 18, lng: 52 },
  // Americas
  { id: 'us',     nameKo: '미국',   continent: '아메리카', entityIds: ['country:usa'],         lat: 25, lng: 30 },
  { id: 'latam',  nameKo: '중남미', continent: '아메리카', entityIds: [],                      lat: 35, lng: 33 },
  // Africa
  { id: 'africa', nameKo: '아프리카', continent: '아프리카', entityIds: [],                    lat: 35, lng: 50 },
  // South Asia
  { id: 'in',     nameKo: '인도',   continent: '남아시아', entityIds: [],                      lat: 30, lng: 66 },
  { id: 'pak',    nameKo: '파키스탄', continent: '남아시아', entityIds: [],                    lat: 27, lng: 64 },
];

function computeScore(
  region: Region,
  inferences: Array<{ severity: string; affectedEntityIds?: string[]; titleKo?: string }>,
  base: number,
) {
  let score = base * 0.15;
  const matched: string[] = [];
  inferences.forEach(inf => {
    const match = region.entityIds.some(id => inf.affectedEntityIds?.includes(id));
    if (match) {
      score += inf.severity === 'CRITICAL' ? 45 : inf.severity === 'ELEVATED' ? 28 : inf.severity === 'WATCH' ? 12 : 5;
      if (inf.titleKo) matched.push(inf.titleKo);
    }
  });
  return { score: Math.min(100, Math.round(score)), matched };
}

const BG_COLOR = (s: number) =>
  s >= 70 ? 'bg-red-500/40 border-red-500/60' :
  s >= 45 ? 'bg-orange-500/30 border-orange-500/50' :
  s >= 25 ? 'bg-yellow-500/20 border-yellow-500/40' :
  'bg-green-500/10 border-green-900/30';

const TEXT_COLOR = (s: number) =>
  s >= 70 ? 'text-red-400' : s >= 45 ? 'text-orange-400' : s >= 25 ? 'text-yellow-400' : 'text-green-400';

export function HeatMapView() {
  const { briefing, globalRiskScore } = useStore();
  const inferences = briefing?.topInferences ?? [];

  const scored = useMemo(() =>
    REGIONS.map(r => ({ ...r, ...computeScore(r, inferences, globalRiskScore) }))
      .sort((a, b) => b.score - a.score),
  [inferences, globalRiskScore]);

  const continents = [...new Set(REGIONS.map(r => r.continent))];

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Global risk header */}
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border">
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">글로벌 테일 리스크</div>
          <div className={`text-4xl font-bold tabular-nums mt-1 ${
            globalRiskScore >= 70 ? 'text-risk-critical' :
            globalRiskScore >= 45 ? 'text-risk-elevated' :
            globalRiskScore >= 25 ? 'text-risk-watch' : 'text-risk-safe'
          }`}>{globalRiskScore}</div>
        </div>
        {/* Horizontal bar */}
        <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${globalRiskScore}%`,
              background: globalRiskScore >= 70 ? '#ef4444' : globalRiskScore >= 45 ? '#f97316' : globalRiskScore >= 25 ? '#eab308' : '#22c55e',
            }} />
        </div>
        <div className="text-xs text-muted">{inferences.length}개 인퍼런스</div>
      </div>

      {/* Region heatmap grid */}
      {continents.map(cont => {
        const rgs = scored.filter(r => r.continent === cont);
        return (
          <div key={cont} className="mb-5">
            <div className="text-xs text-muted uppercase tracking-widest mb-2">{cont}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {rgs.map(r => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 transition-all cursor-default ${BG_COLOR(r.score)}`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-bold text-primary">{r.nameKo}</span>
                    <span className={`text-sm font-bold tabular-nums ${TEXT_COLOR(r.score)}`}>{r.score}</span>
                  </div>
                  <div className="h-1 bg-black/20 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${r.score}%`,
                        background: r.score >= 70 ? '#ef4444' : r.score >= 45 ? '#f97316' : r.score >= 25 ? '#eab308' : '#22c55e',
                      }} />
                  </div>
                  {r.matched.length > 0 ? (
                    r.matched.slice(0, 1).map((m, i) => (
                      <p key={i} className="text-xs text-secondary leading-tight truncate">{m}</p>
                    ))
                  ) : (
                    <p className="text-xs text-muted/50">활성 위협 없음</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Top risks list */}
      <div className="mt-2 border-t border-border pt-4">
        <div className="text-xs text-muted uppercase tracking-widest mb-3">🔺 최고 위협 지역</div>
        {scored.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-center gap-3 py-1.5">
            <span className={`text-xs font-bold w-16 ${TEXT_COLOR(r.score)}`}>{r.nameKo}</span>
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full"
                style={{
                  width: `${r.score}%`,
                  background: r.score >= 70 ? '#ef4444' : r.score >= 45 ? '#f97316' : '#eab308',
                }} />
            </div>
            <span className={`text-xs font-bold tabular-nums w-8 text-right ${TEXT_COLOR(r.score)}`}>{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
