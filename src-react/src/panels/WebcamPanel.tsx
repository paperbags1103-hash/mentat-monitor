import { useState, useMemo } from 'react';
import { useStore } from '@/store';

interface Webcam {
  id: string;
  nameKo: string;
  region: string;
  embedUrl: string;
  tags: string[]; // geopolitical regions to auto-trigger
}

// Public embed webcams (windy.com station IDs or YouTube live)
const WEBCAMS: Webcam[] = [
  { id: 'seoul-gwanghwamun', nameKo: '서울 광화문', region: 'korean_peninsula', tags: ['korea', 'korean_peninsula'],
    embedUrl: 'https://www.youtube.com/embed/rD6VhLLJPAE?autoplay=1&mute=1' },
  { id: 'seoul-namsan',      nameKo: '서울 남산타워', region: 'korean_peninsula', tags: ['korea', 'korean_peninsula'],
    embedUrl: 'https://www.youtube.com/embed/MNn1-5QHiE8?autoplay=1&mute=1' },
  { id: 'tokyo-shibuya',     nameKo: '도쿄 시부야', region: 'east_asia', tags: ['japan', 'east_asia'],
    embedUrl: 'https://www.youtube.com/embed/rDLs69n0IH8?autoplay=1&mute=1' },
  { id: 'newyork-times-sq',  nameKo: '뉴욕 타임스퀘어', region: 'usa', tags: ['usa', 'financial'],
    embedUrl: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1' },
  { id: 'taipei-101',        nameKo: '타이페이 101', region: 'taiwan_strait', tags: ['taiwan', 'taiwan_strait'],
    embedUrl: 'https://www.youtube.com/embed/DpSeqaEQUQs?autoplay=1&mute=1' },
  { id: 'hongkong-harbor',   nameKo: '홍콩 항구', region: 'east_asia', tags: ['china', 'east_asia'],
    embedUrl: 'https://www.youtube.com/embed/ViFLNSFa1HU?autoplay=1&mute=1' },
  { id: 'jerusalem',         nameKo: '예루살렘', region: 'middle_east', tags: ['israel', 'middle_east'],
    embedUrl: 'https://www.youtube.com/embed/wTGqNMiLMFo?autoplay=1&mute=1' },
  { id: 'moscow-kremlin',    nameKo: '모스크바 크렘린', region: 'europe', tags: ['russia', 'europe'],
    embedUrl: 'https://www.youtube.com/embed/z29HVmQ2bRE?autoplay=1&mute=1' },
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
