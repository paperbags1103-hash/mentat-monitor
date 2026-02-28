/**
 * GDELT 뉴스 이미지 위치 마커
 * 이란/이스라엘/가자 관련 최신 기사 이미지 + 키워드→좌표 매핑
 * 15분 캐시
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 15 * 60_000;

// 제목 키워드 → [lat, lng] 매핑
const REGION_MAP = [
  // 이스라엘/팔레스타인
  { kw: ['Gaza City','Gaza city'],          lat: 31.50, lng: 34.47 },
  { kw: ['Rafah'],                           lat: 31.29, lng: 34.24 },
  { kw: ['Khan Younis','Khan Youn'],         lat: 31.35, lng: 34.31 },
  { kw: ['Gaza'],                            lat: 31.42, lng: 34.38 },
  { kw: ['West Bank','Ramallah','Nablus'],   lat: 31.90, lng: 35.20 },
  { kw: ['Jenin'],                           lat: 32.46, lng: 35.30 },
  { kw: ['Tel Aviv'],                        lat: 32.09, lng: 34.78 },
  { kw: ['Jerusalem','Yerushalayim'],        lat: 31.77, lng: 35.22 },
  { kw: ['Haifa'],                           lat: 32.81, lng: 34.99 },
  { kw: ['Dimona'],                          lat: 31.07, lng: 35.03 },
  { kw: ['Israel','Israeli','IDF','Mossad'], lat: 31.50, lng: 34.90 },
  // 레바논/헤즈볼라
  { kw: ['Beirut','Dahieh','Dahiye'],        lat: 33.89, lng: 35.50 },
  { kw: ['South Lebanon','Nabatieh'],        lat: 33.37, lng: 35.48 },
  { kw: ['Lebanon','Hezbollah'],             lat: 33.85, lng: 35.86 },
  // 이란
  { kw: ['Tehran','Teheran'],                lat: 35.69, lng: 51.39 },
  { kw: ['Isfahan','Natanz'],                lat: 32.65, lng: 51.67 },
  { kw: ['Fordow','Fordo'],                  lat: 34.88, lng: 49.21 },
  { kw: ['Bandar Abbas'],                    lat: 27.18, lng: 56.27 },
  { kw: ['Iran','IRGC','Revolutionary'],     lat: 32.50, lng: 53.69 },
  // 예멘/후티
  { kw: ['Sanaa','Sana\'a'],                 lat: 15.36, lng: 44.21 },
  { kw: ['Hodeidah','Hudaydah'],             lat: 14.80, lng: 42.95 },
  { kw: ['Yemen','Houthi','Houthis'],        lat: 15.55, lng: 48.52 },
  // 시리아
  { kw: ['Damascus'],                        lat: 33.51, lng: 36.29 },
  { kw: ['Aleppo'],                          lat: 36.20, lng: 37.16 },
  { kw: ['Syria','Syrian'],                  lat: 34.80, lng: 38.99 },
  // 이라크
  { kw: ['Baghdad'],                         lat: 33.33, lng: 44.44 },
  { kw: ['Mosul'],                           lat: 36.34, lng: 43.14 },
  { kw: ['Iraq','Iraqi','PMF'],              lat: 33.22, lng: 43.68 },
  // 호르무즈/걸프
  { kw: ['Hormuz','Strait'],                 lat: 26.56, lng: 56.27 },
  { kw: ['Persian Gulf','Arabian Gulf'],     lat: 26.50, lng: 53.00 },
  { kw: ['Red Sea','Bab al-Mandab'],         lat: 14.00, lng: 42.50 },
];

function resolveLocation(title) {
  const t = title || '';
  for (const r of REGION_MAP) {
    for (const kw of r.kw) {
      if (t.includes(kw)) return { lat: r.lat, lng: r.lng, region: kw };
    }
  }
  return null;
}

function parseSeenDate(s) {
  // "20251220T134500Z"
  if (!s || s.length < 8) return null;
  return new Date(
    `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)||'00'}:${s.slice(11,13)||'00'}:00Z`
  ).getTime();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    const query = encodeURIComponent(
      '(Iran OR Israel OR Gaza OR Lebanon OR Hezbollah OR Houthi OR "West Bank") sourcelang:english'
    );
    const url = `http://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=50&sort=DateDesc`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json();

    const articles = data?.articles ?? [];
    const now = Date.now();
    const cutoff = now - 24 * 3600_000; // 24h 이내만

    const items = [];
    const seen = new Set();

    for (const a of articles) {
      if (!a.socialimage) continue;
      const loc = resolveLocation(a.title);
      if (!loc) continue;

      const t = parseSeenDate(a.seendate);
      if (t && t < cutoff) continue;

      // 같은 위치에 중복 마커 방지 (2도 반경 내 중복 제거)
      const key = `${Math.round(loc.lat * 2)}_${Math.round(loc.lng * 2)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        id: a.url,
        title: (a.title || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        image: a.socialimage,
        url: a.url,
        domain: a.domain || '',
        seendate: a.seendate,
        ageMin: t ? Math.round((now - t) / 60_000) : null,
        lat: loc.lat + (Math.random() - 0.5) * 0.15, // 약간 분산 (겹침 방지)
        lng: loc.lng + (Math.random() - 0.5) * 0.15,
        region: loc.region,
      });

      if (items.length >= 20) break;
    }

    cache = { items, fetchedAt: Date.now() };
    cacheTime = Date.now();
    return res.json(cache);
  } catch (err) {
    return res.status(200).json({ items: [], error: err.message });
  }
}
