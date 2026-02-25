import { useState, useEffect } from 'react';
import { useStore, useLayoutStore } from '@/store';
import { TopBar }       from '@/components/TopBar';
import { PanelGrid }    from '@/layout/PanelGrid';
import { PanelCatalog } from '@/layout/PanelCatalog';
import { AIPLayout }    from '@/aip/AIPLayout';

const REFRESH_MS = 5 * 60_000;

type LayoutMode = 'aip' | 'grid';

export function App() {
  const fetchAll    = useStore(s => s.fetchAll);
  const resetLayout = useLayoutStore(s => s.resetLayout);
  const [showCatalog, setShowCatalog] = useState(false);
  const [mode, setMode] = useState<LayoutMode>('aip');

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  // AIP mode has its own layout + fetch cycle
  if (mode === 'aip') {
    return <AIPLayout onSwitchToGrid={() => setMode('grid')} />;
  }

  // Grid mode (free-form Bloomberg)
  return (
    <div className="flex flex-col h-screen bg-base text-primary font-mono overflow-hidden">
      <TopBar
        onAddPanel={() => setShowCatalog(true)}
        onResetLayout={resetLayout}
        extraActions={
          <button
            onClick={() => setMode('aip')}
            className="text-xs px-2 py-1 bg-border text-secondary hover:text-primary rounded transition-colors ml-1"
            title="AIP 모드 전환"
          >🗺 AIP</button>
        }
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <PanelGrid />
      </div>
      {showCatalog && <PanelCatalog onClose={() => setShowCatalog(false)} />}
    </div>
  );
}
