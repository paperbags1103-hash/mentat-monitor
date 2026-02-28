/**
 * GDELT 기반 군사 자산 동적 활성화
 * 최근 48h 뉴스에서 언급된 FORCE_ASSETS 키워드 매칭
 * 10분 캐시
 */
export const config = { runtime: 'nodejs' };

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60_000;

// 자산 ID → 뉴스 매칭 키워드
const ASSET_KEYWORDS = {
  'ir-m1': ['Shahab','IRGC missile','ballistic missile Iran'],
  'ir-m2': ['Fateh','Kermanshah','Iran western'],
  'ir-m3': ['Zolfaghar','Kerman province'],
  'ir-m4': ['Noor missile','Hormuz coastal'],
  'ir-m6': ['Fattah','hypersonic Iran','Mach'],
  'ir-m7': ['Kheibar','Khorramshahr'],
  'ir-d1': ['Shahed-136','kamikaze drone Iran','Shahed drone'],
  'ir-d2': ['Mohajer','UAV Iran'],
  'ir-d3': ['Iraqi militia drone','PMF drone'],
  'ir-n1': ['IRGC Navy','Bandar Abbas','Persian Gulf Iran'],
  'ir-n2': ['Chabahar','Iranian submarine'],
  'ir-n3': ['Abu Musa','island Iran'],
  'hzb-1': ['Hezbollah rocket','Katyusha','South Lebanon rocket'],
  'hzb-2': ['Hezbollah missile','Fatah precision','Haifa missile'],
  'hzb-3': ['Radwan','Hezbollah elite','infiltrat'],
  'hth-1': ['Houthi ballistic','Burkan','Yemen missile'],
  'hth-2': ['Houthi drone','Red Sea attack','UAV Yemen'],
  'hth-3': ['Houthi naval','maritime drone Yemen'],
  'pmf-1': ['Kataib Hezbollah','PMF drone','Iraqi militia'],
  'il-g1': ['IDF Gaza north','Israeli ground Gaza'],
  'il-g2': ['IDF Rafah','Israeli operation south Gaza'],
  'il-g3': ['IDF northern command','Lebanon ground','IDF Hezbollah'],
  'il-g4': ['Sayeret Matkal','IDF special forces','Mossad operation'],
  'il-ad1': ['Iron Dome intercept','northern Israel intercept'],
  'il-ad2': ['Iron Dome Tel Aviv','central Israel defense'],
  'il-ad3': ['Iron Dome south','Beersheba'],
  'il-ad4': ["David's Sling","Stunner intercept"],
  'il-ad5': ['Arrow-3','Arrow intercept','Arrow missile'],
  'us-cv1': ['USS Truman','CVN-75','carrier Mediterranean'],
  'us-cv2': ['B-2 bomber','Diego Garcia','stealth bomber Iran'],
  'us-b1': ['USS Bulkeley','USS Ramage','destroyer Red Sea'],
  'us-th1': ['THAAD Israel','US missile defense deploy'],
  'us-cc': ['CENTCOM','US Central Command','Austin Middle East'],
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Date.now() - cacheTime < CACHE_TTL && cache) {
    return res.json({ ...cache, cached: true });
  }

  try {
    const now = new Date();
    const start = new Date(now - 48 * 3600_000);
    const fmt = d => d.toISOString().replace(/[-:T]/g,'').slice(0,14);

    const query = encodeURIComponent(
      '(IRGC OR IDF OR Hezbollah OR Houthi OR "Iron Dome" OR Shahab OR Shahed OR "CENTCOM" OR "carrier strike") sourcelang:english'
    );
    const url = `http://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=80&sort=DateDesc&startdatetime=${fmt(start)}&enddatetime=${fmt(now)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
    const data = await resp.json();
    const articles = data?.articles ?? [];

    // 전체 텍스트 풀 (제목 연결)
    const corpus = articles.map(a => a.title || '').join(' ');

    // 키워드 매칭
    const activeIds = new Set();
    const mentionCount = {};
    for (const [id, keywords] of Object.entries(ASSET_KEYWORDS)) {
      for (const kw of keywords) {
        if (corpus.includes(kw)) {
          activeIds.add(id);
          mentionCount[id] = (mentionCount[id] || 0) + 1;
          break;
        }
      }
    }

    // 전장별 활성도 (언급 기사 수)
    const theaterActivity = {
      'iran-israel': articles.filter(a => /(Iran|Israel|Gaza|Hezbollah|Houthi)/i.test(a.title)).length,
      'ukraine':     articles.filter(a => /(Ukraine|Russia|Zelensky|Kyiv|Kherson|Bakhmut)/i.test(a.title)).length,
      'taiwan':      articles.filter(a => /(Taiwan|PLA|PLAN|strait|China military)/i.test(a.title)).length,
    };

    cache = {
      activeIds: [...activeIds],
      mentionCount,
      theaterActivity,
      articleCount: articles.length,
      fetchedAt: Date.now(),
    };
    cacheTime = Date.now();
    return res.json(cache);
  } catch (err) {
    return res.status(200).json({ activeIds: [], mentionCount: {}, theaterActivity: {}, error: err.message });
  }
}
