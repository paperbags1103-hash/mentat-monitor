export interface SemiNode {
  id: string;
  nameKo: string;
  nameEn: string;
  ticker?: string;
  lat: number;
  lng: number;
  type: 'fab' | 'equipment' | 'material' | 'designer' | 'consumer' | 'packaging';
  country: string;
}

export interface SemiEdge {
  from: string;
  to: string;
  label: string;
  labelEn: string;
  value: number;
  geopoliticalKeywords: string[];
}

export const SEMI_NODES: SemiNode[] = [
  { id: 'asml', nameKo: 'ASML', nameEn: 'ASML', ticker: 'ASML', lat: 51.42, lng: 5.47, type: 'equipment', country: '네덜란드' },
  { id: 'lam', nameKo: 'Lam Research', nameEn: 'Lam Research', ticker: 'LRCX', lat: 37.65, lng: -121.97, type: 'equipment', country: '미국' },
  { id: 'applied', nameKo: 'Applied Materials', nameEn: 'Applied Materials', ticker: 'AMAT', lat: 37.39, lng: -121.98, type: 'equipment', country: '미국' },
  { id: 'tokyo_electron', nameKo: '도쿄일렉트론', nameEn: 'Tokyo Electron', ticker: 'TOELY', lat: 35.69, lng: 139.69, type: 'equipment', country: '일본' },
  { id: 'shin_etsu', nameKo: '신에쓰화학', nameEn: 'Shin-Etsu Chemical', ticker: '4063.T', lat: 35.69, lng: 139.77, type: 'material', country: '일본' },
  { id: 'jsr', nameKo: 'JSR', nameEn: 'JSR Corporation', lat: 35.67, lng: 139.74, type: 'material', country: '일본' },
  { id: 'linde', nameKo: 'Linde', nameEn: 'Linde PLC', ticker: 'LIN', lat: 51.50, lng: -0.12, type: 'material', country: '영국' },
  { id: 'tsmc', nameKo: 'TSMC', nameEn: 'TSMC', ticker: 'TSM', lat: 24.78, lng: 120.98, type: 'fab', country: '대만' },
  { id: 'skhynix', nameKo: 'SK하이닉스', nameEn: 'SK Hynix', ticker: '000660', lat: 37.28, lng: 127.44, type: 'fab', country: '한국' },
  { id: 'samsung_semi', nameKo: '삼성전자 반도체', nameEn: 'Samsung Semiconductor', ticker: '005930', lat: 37.27, lng: 127.03, type: 'fab', country: '한국' },
  { id: 'nvidia', nameKo: 'NVIDIA', nameEn: 'NVIDIA', ticker: 'NVDA', lat: 37.37, lng: -121.96, type: 'designer', country: '미국' },
  { id: 'intel', nameKo: 'Intel', nameEn: 'Intel', ticker: 'INTC', lat: 37.39, lng: -121.96, type: 'fab', country: '미국' },
  { id: 'ase', nameKo: 'ASE그룹', nameEn: 'ASE Group', lat: 22.62, lng: 120.28, type: 'packaging', country: '대만' },
  { id: 'amkor', nameKo: 'Amkor', nameEn: 'Amkor Technology', ticker: 'AMKR', lat: 33.59, lng: -111.88, type: 'packaging', country: '미국' },
  { id: 'apple', nameKo: 'Apple', nameEn: 'Apple', ticker: 'AAPL', lat: 37.33, lng: -122.01, type: 'consumer', country: '미국' },
  { id: 'amazon', nameKo: 'Amazon AWS', nameEn: 'Amazon AWS', ticker: 'AMZN', lat: 47.62, lng: -122.34, type: 'consumer', country: '미국' },
];

export const SEMI_EDGES: SemiEdge[] = [
  { from: 'asml', to: 'tsmc', label: 'EUV 장비', labelEn: 'EUV lithography', value: 5, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban', 'China chip'] },
  { from: 'asml', to: 'skhynix', label: 'EUV 장비', labelEn: 'EUV lithography', value: 4, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban'] },
  { from: 'asml', to: 'samsung_semi', label: 'EUV 장비', labelEn: 'EUV lithography', value: 4, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban'] },
  { from: 'lam', to: 'tsmc', label: '식각 장비', labelEn: 'etch equipment', value: 3, geopoliticalKeywords: ['US export control', 'semiconductor equipment'] },
  { from: 'applied', to: 'tsmc', label: '증착 장비', labelEn: 'deposition equipment', value: 3, geopoliticalKeywords: ['US export control'] },
  { from: 'tokyo_electron', to: 'tsmc', label: '코팅 장비', labelEn: 'coating equipment', value: 3, geopoliticalKeywords: ['Japan export', 'semiconductor'] },
  { from: 'tokyo_electron', to: 'samsung_semi', label: '코팅 장비', labelEn: 'coating equipment', value: 3, geopoliticalKeywords: ['Japan export'] },
  { from: 'shin_etsu', to: 'tsmc', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export control', 'photoresist', 'semiconductor material'] },
  { from: 'shin_etsu', to: 'skhynix', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export control'] },
  { from: 'jsr', to: 'tsmc', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export', 'JSR'] },
  { from: 'linde', to: 'skhynix', label: '특수가스', labelEn: 'specialty gases', value: 2, geopoliticalKeywords: ['neon', 'specialty gas', 'Ukraine'] },
  { from: 'tsmc', to: 'skhynix', label: 'HBM 웨이퍼', labelEn: 'HBM wafer supply', value: 5, geopoliticalKeywords: ['Taiwan', 'Taiwan Strait', 'China', 'military', 'HBM'] },
  { from: 'tsmc', to: 'samsung_semi', label: '파운드리', labelEn: 'foundry services', value: 4, geopoliticalKeywords: ['Taiwan', 'Taiwan Strait', 'China', 'military'] },
  { from: 'skhynix', to: 'nvidia', label: 'HBM3E 공급', labelEn: 'HBM3E memory supply', value: 5, geopoliticalKeywords: ['HBM', 'AI chip', 'memory', 'NVIDIA', 'export control'] },
  { from: 'samsung_semi', to: 'nvidia', label: 'HBM/DRAM', labelEn: 'HBM/DRAM supply', value: 4, geopoliticalKeywords: ['HBM', 'AI chip', 'DRAM'] },
  { from: 'skhynix', to: 'ase', label: '패키징', labelEn: 'advanced packaging', value: 3, geopoliticalKeywords: ['Taiwan', 'packaging'] },
  { from: 'tsmc', to: 'ase', label: 'CoWoS 패키징', labelEn: 'CoWoS packaging', value: 4, geopoliticalKeywords: ['Taiwan', 'CoWoS', 'AI chip'] },
  { from: 'ase', to: 'nvidia', label: '완성 패키지', labelEn: 'finished package', value: 4, geopoliticalKeywords: ['Taiwan', 'packaging', 'AI chip'] },
  { from: 'nvidia', to: 'amazon', label: 'GPU 공급', labelEn: 'GPU supply', value: 4, geopoliticalKeywords: ['AI', 'GPU', 'cloud'] },
  { from: 'skhynix', to: 'apple', label: 'LPDDR 메모리', labelEn: 'LPDDR memory', value: 3, geopoliticalKeywords: ['Apple', 'iPhone', 'memory'] },
  { from: 'tsmc', to: 'apple', label: 'A시리즈 칩', labelEn: 'Apple silicon foundry', value: 5, geopoliticalKeywords: ['Apple', 'Taiwan', 'A-series chip'] },
];
