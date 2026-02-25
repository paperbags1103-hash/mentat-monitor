import { useEffect } from 'react';
import { useStore } from '@/store';
import { TopBar } from '@/components/TopBar';
import { BriefingPane } from '@/components/BriefingPane';
import { ThemePane } from '@/components/ThemePane';
import { SignalFeed } from '@/components/SignalFeed';

const REFRESH_MS = 5 * 60_000;

export function App() {
  const fetchAll = useStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <div className="flex flex-col h-screen bg-base text-primary font-mono overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Briefing */}
        <div className="w-1/3 flex flex-col bg-base border-r border-border overflow-hidden">
          <BriefingPane />
        </div>
        {/* Center — Themes */}
        <div className="w-1/3 flex flex-col bg-base overflow-hidden">
          <ThemePane />
        </div>
        {/* Right — Signal feed */}
        <div className="w-1/3 flex flex-col bg-base border-l border-border overflow-hidden">
          <SignalFeed />
        </div>
      </div>
    </div>
  );
}
