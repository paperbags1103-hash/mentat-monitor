import { useState, useMemo } from 'react';
import { useStore } from '@/store';

interface Webcam {
  id: string;
  nameKo: string;
  region: string;
  embedUrl: string;
  tags: string[]; // geopolitical regions to auto-trigger
}

// 채널 ID 기반 YouTube Live embed — 스트림 ID 만료 없음
// 형식: https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID
const WEBCAMS: Webcam[] = [
  { id: 'ytn-korea',   nameKo: 'YTN 뉴스 (한국)',    region: 'korean_peninsula', tags: ['korea', 'korean_peninsula'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCO_aKKYxn4tvrqPjcTzZ6EQ&autoplay=1&mute=1' },
  { id: 'jtbc-korea',  nameKo: 'JTBC 뉴스 (한국)',   region: 'korean_peninsula', tags: ['korea', 'korean_peninsula'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCClrS_9IuFPXZmRtyIPW0fQ&autoplay=1&mute=1' },
  { id: 'nhk-world',   nameKo: 'NHK World (일본)',   region: 'east_asia', tags: ['japan', 'east_asia'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCCcey5CP5GDZeom987rqosg&autoplay=1&mute=1' },
  { id: 'abc-news',    nameKo: 'ABC News (미국)',     region: 'usa', tags: ['usa', 'financial'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q&autoplay=1&mute=1' },
  { id: 'cgtn',        nameKo: 'CGTN (중국)',         region: 'east_asia', tags: ['china', 'taiwan', 'east_asia', 'taiwan_strait'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCt6Lg1zOR7yNO3sAm2WMXiA&autoplay=1&mute=1' },
  { id: 'aljazeera',   nameKo: 'Al Jazeera (중동)',  region: 'middle_east', tags: ['israel', 'middle_east'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1' },
  { id: 'france24',    nameKo: 'France 24 (유럽)',   region: 'europe', tags: ['europe', 'russia'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&mute=1' },
  { id: 'dw-news',     nameKo: 'DW News (유럽/글로벌)', region: 'europe', tags: ['europe'],
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1' },
];

// Map entity IDs → webcam tags
const ENTITY_TO_TAG: Record<string, string> = {
  'region:korean_peninsula': 'korean_peninsula',
  'region:taiwan_strait':    'taiwan_strait',
  'region:middle_east':      'middle_east',
  'region:east_asia':        'east_asia',
  'region:europe':           'europe',
  'country:north_korea':     'korean_peninsula',
  'country:south_korea':     'korea',
};

export function WebcamPanel() {
  const { signals, briefing } = useStore();
  const [selected, setSelected] = useState<Webcam>(WEBCAMS[0]);
  const [autoMode, setAutoMode] = useState(true);

  // Figure out high-signal regions
  const hotTags = useMemo(() => {
    const tags = new Set<string>();
    briefing?.topInferences?.filter(i => i.severity === 'CRITICAL' || i.severity === 'ELEVATED')
      .forEach(inf => {
        inf.affectedEntityIds?.forEach((eid: string) => {
          const tag = ENTITY_TO_TAG[eid];
          if (tag) tags.add(tag);
        });
      });
    return tags;
  }, [briefing]);

  // Auto-select webcam for hot region
  const autoSelected = useMemo(() => {
    if (!autoMode || hotTags.size === 0) return null;
    return WEBCAMS.find(w => w.tags.some(t => hotTags.has(t)));
  }, [hotTags, autoMode]);

  const current = autoMode && autoSelected ? autoSelected : selected;
  const isHot = hotTags.size > 0 && current.tags.some(t => hotTags.has(t));

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border shrink-0 flex-wrap">
        {/* Auto mode toggle */}
        <button
          onClick={() => setAutoMode(a => !a)}
          className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
            autoMode ? 'bg-accent/20 text-accent-light border border-accent/40' : 'bg-border text-muted'
          }`}
        >
          {autoMode ? '🔴 자동' : '⚪ 수동'}
        </button>

        {/* Manual select */}
        <select
          value={selected.id}
          onChange={e => { setSelected(WEBCAMS.find(w => w.id === e.target.value) ?? WEBCAMS[0]); setAutoMode(false); }}
          className="flex-1 text-xs bg-border text-secondary rounded px-1 py-0.5 min-w-0"
        >
          {WEBCAMS.map(w => (
            <option key={w.id} value={w.id}>
              {hotTags.size > 0 && w.tags.some(t => hotTags.has(t)) ? '🔴 ' : ''}{w.nameKo}
            </option>
          ))}
        </select>
      </div>

      {/* Alert banner */}
      {isHot && (
        <div className="px-3 py-1.5 bg-risk-critical/10 border-b border-risk-critical/30 text-xs text-risk-critical font-semibold shrink-0">
          🔴 위기 신호 감지 — 자동 전환됨: {current.nameKo}
        </div>
      )}

      {/* Embed */}
      <div className={`flex-1 relative bg-black ${isHot ? 'ring-1 ring-risk-critical/50' : ''}`}>
        <iframe
          key={current.id}
          src={current.embedUrl}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
        <div className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded pointer-events-none">
          📡 {current.nameKo}
        </div>
      </div>
    </div>
  );
}
