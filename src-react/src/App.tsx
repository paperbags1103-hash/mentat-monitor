import { useEffect, useState } from 'react';
import { useStore, useLayoutStore } from '@/store';
import { TopBar }       from '@/components/TopBar';
import { PanelGrid }    from '@/layout/PanelGrid';
import { PanelCatalog } from '@/layout/PanelCatalog';

const REFRESH_MS = 5 * 60_000;

export function App() {
  const fetchAll    = useStore(s => s.fetchAll);
  const resetLayout = useLayoutStore(s => s.resetLayout);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <div className="flex flex-col h-screen bg-base text-primary font-mono overflow-hidden">
      <TopBar
        onAddPanel={() => setShowCatalog(true)}
        onResetLayout={resetLayout}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <PanelGrid />
      </div>
      {showCatalog && <PanelCatalog onClose={() => setShowCatalog(false)} />}
    </div>
  );
}
