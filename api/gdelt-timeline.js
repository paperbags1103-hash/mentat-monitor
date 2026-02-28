/**
 * GDELT Tension Timeline — 이란/이스라엘 관련 기사 tone 시계열 (24h)
 * 음수 tone = 더 적대적 / 양수 = 우호적
 * 5분 캐시
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60_000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    // GDELT Doc 2.0 - timelinesent mode: 긴장도(tone) 시계열
    const now = new Date();
    const start = new Date(now - 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const query = encodeURIComponent('(Iran OR Israel OR "Strait of Hormuz") sourcelang:english');
    const url = `http://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=timelinetone&format=json&startdatetime=${fmt(start)}&enddatetime=${fmt(now)}&smoothing=1`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json();

    // timelinesent returns array of timelines (positive / negative / net)
    // data.timeline[0] = positive, [1] = negative, [2] = net
    const timeline = data?.timeline ?? [];
    const netSeries = timeline.find(t => t.series?.toLowerCase().includes('net')) ?? timeline[0];
    if (!netSeries?.data) throw new Error('no timeline data');

    const points = netSeries.data.map(d => ({
      date: d.date,
      tone: parseFloat(d.value ?? 0),
    })).slice(-48); // 최근 48개 포인트

    cache = { points, fetchedAt: Date.now(), series: netSeries.series };
    cacheTime = Date.now();
    return res.json(cache);
  } catch (err) {
    // 실패 시 빈 배열 (폴백: 클라이언트에서 로컬 threatScore 히스토리 사용)
    return res.status(200).json({ points: [], error: err.message });
  }
}
