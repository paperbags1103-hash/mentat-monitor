import { type ReactNode, useState } from 'react';
import { useLayoutStore } from '@/store';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

export function PanelWrapper({ id, title, children }: Props) {
  const removePanel = useLayoutStore(s => s.removePanel);
  const [hover, setHover] = useState(false);

  return (
    <div
      className="flex flex-col h-full bg-panel border border-border rounded overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Panel header — drag handle */}
      <div className="panel-drag-handle flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0 cursor-grab active:cursor-grabbing select-none">
        <span className="text-xs font-bold text-secondary tracking-wide truncate">{title}</span>
        {hover && (
          <button
            onClick={() => removePanel(id)}
            className="text-muted hover:text-risk-critical text-xs ml-2 shrink-0 transition-colors leading-none"
            title="패널 제거"
          >✕</button>
        )}
      </div>
      {/* Panel content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
    </div>
  );
}
