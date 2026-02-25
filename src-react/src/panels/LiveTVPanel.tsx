import { useState } from 'react';

interface Channel {
  id: string;
  nameKo: string;
  youtubeId: string;
  lang: string;
}

const CHANNELS: Channel[] = [
  { id: 'bloomberg', nameKo: 'Bloomberg TV', youtubeId: 'dp8PhLsUcFE', lang: 'EN' },
  { id: 'cnbc',      nameKo: 'CNBC',         youtubeId: '2ZXF58lhNug', lang: 'EN' },
  { id: 'kbs',       nameKo: 'KBS 뉴스',     youtubeId: 'uGBCINbYZYI', lang: 'KO' },
  { id: 'ytn',       nameKo: 'YTN',          youtubeId: 'vdboOJ7ALEY', lang: 'KO' },
  { id: 'mk',        nameKo: '매일경제TV',   youtubeId: 'Xg8Ks0_cF5U', lang: 'KO' },
  { id: 'mbc',       nameKo: 'MBC 뉴스',     youtubeId: '3rga2G4z7cE', lang: 'KO' },
];

export function LiveTVPanel() {
  const [active, setActive]   = useState<Channel>(CHANNELS[0]);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Channel selector */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-border shrink-0 flex-wrap">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => { setActive(ch); setPlaying(true); }}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              active.id === ch.id && playing
                ? 'bg-risk-critical text-white'
                : 'bg-border text-secondary hover:text-primary'
            }`}
          >
            {playing && active.id === ch.id && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse" />}
            {ch.nameKo}
          </button>
        ))}
      </div>

      {/* Video */}
      <div className="flex-1 relative bg-black">
        {playing ? (
          <iframe
            key={active.id}
            src={`https://www.youtube.com/embed/${active.youtubeId}?autoplay=1&mute=0&rel=0`}
            className="w-full h-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent flex items-center justify-center">
              <span className="text-2xl ml-1">▶</span>
            </div>
            <span className="text-sm text-secondary">{active.nameKo} 재생</span>
            <span className="text-xs text-muted">클릭해서 라이브 방송 시작</span>
          </button>
        )}
        {playing && (
          <button
            onClick={() => setPlaying(false)}
            className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded hover:bg-black/80"
          >✕ 끄기</button>
        )}
      </div>
    </div>
  );
}
