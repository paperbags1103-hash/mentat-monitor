/**
 * GDELT 24h 이벤트 볼륨 — 1시간 버킷 히스토그램용
 * Iran/Israel/Gaza/Lebanon 관련 기사 수 시계열
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
    const now = new Date();
    const start = new Date(now - 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const query = encodeURIComponent('(Iran OR Israel OR Gaza OR Lebanon OR Hormuz) sourcelang:english');
    const url = `http://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=timelinevolinfo&format=json&startdatetime=${fmt(start)}&enddatetime=${fmt(now)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json();

    const rawSeries = data?.timeline?.[0]?.data ?? [];
    if (!rawSeries.length) throw new Error('no timeline data');

    // GDELT date format: "YYYYMMDDHHMMSS" → parse to UTC hour
    const parseGdeltDate = (str) => {
      const s = String(str);
      const yr=+s.slice(0,4), mo=+s.slice(4,6)-1, dy=+s.slice(6,8);
      const hh=+s.slice(8,10), mm=+s.slice(10,12), ss=+s.slice(12,14)||0;
      return new Date(Date.UTC(yr, mo, dy, hh, mm, ss)).getTime();
    };

    // 1시간 단위 24개 버킷 집계
    const buckets = [];
    for (let h = 0; h < 24; h++) {
      const bStart = now.getTime() - (23 - h + 1) * 3600_000;
      const bEnd   = now.getTime() - (23 - h)     * 3600_000;
      const label  = new Date(bStart).getUTCHours().toString().padStart(2, '0') + 'h';
      const pts    = rawSeries.filter(d => {
        const t = parseGdeltDate(d.date);
        return t >= bStart && t < bEnd;
      });
      const val = pts.length > 0
        ? pts.reduce((s, d) => s + parseFloat(d.value ?? 0), 0)
        : 0;
      buckets.push({ hour: h, label, value: val });
    }

    cache = { buckets, fetchedAt: Date.now() };
    cacheTime = Date.now();
    return res.json(cache);
  } catch (err) {
    // 폴백: 0으로 채운 24개 버킷
    const fallback = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2,'0')}h`,
      value: 0,
    }));
    return res.status(200).json({ buckets: fallback, error: err.message });
  }
}
