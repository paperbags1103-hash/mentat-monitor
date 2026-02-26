export interface TickerGeoMapping {
  ticker: string;
  nameKo: string;
  regions: string[];
  themes: string[];
  supplyChainKeywords: string[];
}

export const TICKER_GEO_MAP: TickerGeoMapping[] = [
  {
    ticker: '000660',
    nameKo: 'SK하이닉스',
    regions: ['대만', '중국', '미국', '대만해협'],
    themes: ['반도체', 'HBM', 'AI', '수출통제', 'TSMC'],
    supplyChainKeywords: ['semiconductor', 'chip', 'TSMC', 'Taiwan', 'export control', 'HBM', 'DRAM'],
  },
  {
    ticker: '005930',
    nameKo: '삼성전자',
    regions: ['중국', '대만', '미국', '베트남'],
    themes: ['반도체', '스마트폰', '수출통제'],
    supplyChainKeywords: ['Samsung', 'semiconductor', 'chip', 'smartphone', 'display'],
  },
  {
    ticker: '011200',
    nameKo: 'HMM',
    regions: ['수에즈', '홍해', '말라카', '파나마', '대만해협'],
    themes: ['해운', '물류', '운임'],
    supplyChainKeywords: ['Suez', 'Red Sea', 'shipping', 'freight', 'container', 'Houthi'],
  },
  {
    ticker: '012450',
    nameKo: '한화에어로스페이스',
    regions: ['우크라이나', '중동', '대만', '북한'],
    themes: ['방산', '전쟁', '군비'],
    supplyChainKeywords: ['defense', 'military', 'war', 'conflict', 'NATO', 'arms'],
  },
  {
    ticker: '096770',
    nameKo: 'SK이노베이션',
    regions: ['호르무즈', '사우디', '이란', '러시아'],
    themes: ['원유', '에너지', '정유'],
    supplyChainKeywords: ['oil', 'crude', 'energy', 'OPEC', 'Iran', 'Saudi', 'refinery'],
  },
  {
    ticker: '035420',
    nameKo: 'NAVER',
    regions: ['미국', '일본'],
    themes: ['AI', '빅테크', '규제'],
    supplyChainKeywords: ['AI', 'tech regulation', 'data', 'antitrust'],
  },
  {
    ticker: '373220',
    nameKo: 'LG에너지솔루션',
    regions: ['중국', '미국', '칠레', '콩고'],
    themes: ['배터리', 'EV', '리튬', '코발트'],
    supplyChainKeywords: ['battery', 'lithium', 'cobalt', 'EV', 'electric vehicle', 'IRA'],
  },
  {
    ticker: 'NVDA',
    nameKo: 'NVIDIA',
    regions: ['대만', '중국', '미국'],
    themes: ['AI', '반도체', '수출통제', 'GPU'],
    supplyChainKeywords: ['NVIDIA', 'GPU', 'AI chip', 'TSMC', 'export control'],
  },
  {
    ticker: 'TSLA',
    nameKo: 'Tesla',
    regions: ['중국', '독일', '미국'],
    themes: ['EV', '배터리', '무역관세'],
    supplyChainKeywords: ['Tesla', 'EV', 'tariff', 'China market', 'Gigafactory'],
  },
  {
    ticker: '005380',
    nameKo: '현대차',
    regions: ['미국', '인도', '중국'],
    themes: ['자동차', 'EV', '관세', '무역'],
    supplyChainKeywords: ['auto', 'tariff', 'trade war', 'EV', 'Hyundai'],
  },
];

export function findMatchingTickers(
  eventText: string,
  eventRegion: string,
  watchlistTickers: string[],
): string[] {
  const text = `${eventText} ${eventRegion}`.toLowerCase();
  return TICKER_GEO_MAP
    .filter(m => watchlistTickers.includes(m.ticker))
    .filter(m =>
      m.regions.some(r => text.includes(r.toLowerCase()))
      || m.themes.some(t => text.includes(t.toLowerCase()))
      || m.supplyChainKeywords.some(k => text.includes(k.toLowerCase())),
    )
    .map(m => m.ticker);
}
