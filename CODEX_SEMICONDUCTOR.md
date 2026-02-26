# Task: Semiconductor Supply Chain Flow Layer

Project: `/Users/superdog/.openclaw/workspace/projects/signal/`

## Overview

Korean investors who hold semiconductor stocks (SK하이닉스, 삼성전자, NVDA) need to see the global supply chain visually on the map. When geopolitical events threaten parts of the supply chain, the relevant edges should turn red/orange automatically.

This is the "SK하이닉스 X-ray" feature: click any semiconductor company node and see its entire supply chain.

## Files to Edit/Create

1. `src-react/src/data/semiconductor-supply-chain.ts` — CREATE: static supply chain graph data
2. `src-react/src/aip/WorldMapView.tsx` — ADD semiconductor layer rendering
3. No other files.

---

## PART 1: `src-react/src/data/semiconductor-supply-chain.ts`

### Node structure

```typescript
export interface SemiNode {
  id: string;
  nameKo: string;
  nameEn: string;
  ticker?: string;        // stock ticker if publicly traded
  lat: number;
  lng: number;
  type: 'fab' | 'equipment' | 'material' | 'designer' | 'consumer' | 'packaging';
  country: string;
}

export interface SemiEdge {
  from: string;   // node id
  to: string;     // node id
  label: string;  // what flows (e.g., "EUV 장비", "HBM 웨이퍼", "DRAM 칩")
  labelEn: string;
  value: number;  // relative importance 1-5 (controls line thickness)
  geopoliticalKeywords: string[]; // keywords that stress this edge
}
```

### Static Data (hardcode these exactly)

```typescript
export const SEMI_NODES: SemiNode[] = [
  // Equipment
  { id: 'asml', nameKo: 'ASML', nameEn: 'ASML', ticker: 'ASML', lat: 51.42, lng: 5.47, type: 'equipment', country: '네덜란드' },
  { id: 'lam', nameKo: 'Lam Research', nameEn: 'Lam Research', ticker: 'LRCX', lat: 37.65, lng: -121.97, type: 'equipment', country: '미국' },
  { id: 'applied', nameKo: 'Applied Materials', nameEn: 'Applied Materials', ticker: 'AMAT', lat: 37.39, lng: -121.98, type: 'equipment', country: '미국' },
  { id: 'tokyo_electron', nameKo: '도쿄일렉트론', nameEn: 'Tokyo Electron', ticker: 'TOELY', lat: 35.69, lng: 139.69, type: 'equipment', country: '일본' },
  // Materials
  { id: 'shin_etsu', nameKo: '신에쓰화학', nameEn: 'Shin-Etsu Chemical', ticker: '4063.T', lat: 35.69, lng: 139.77, type: 'material', country: '일본' },
  { id: 'jsr', nameKo: 'JSR', nameEn: 'JSR Corporation', lat: 35.67, lng: 139.74, type: 'material', country: '일본' },
  { id: 'linde', nameKo: 'Linde', nameEn: 'Linde PLC', ticker: 'LIN', lat: 51.50, lng: -0.12, type: 'material', country: '영국' },
  // Fabs / Designers
  { id: 'tsmc', nameKo: 'TSMC', nameEn: 'TSMC', ticker: 'TSM', lat: 24.78, lng: 120.98, type: 'fab', country: '대만' },
  { id: 'skhynix', nameKo: 'SK하이닉스', nameEn: 'SK Hynix', ticker: '000660', lat: 37.28, lng: 127.44, type: 'fab', country: '한국' },
  { id: 'samsung_semi', nameKo: '삼성전자 반도체', nameEn: 'Samsung Semiconductor', ticker: '005930', lat: 37.27, lng: 127.03, type: 'fab', country: '한국' },
  { id: 'nvidia', nameKo: 'NVIDIA', nameEn: 'NVIDIA', ticker: 'NVDA', lat: 37.37, lng: -121.96, type: 'designer', country: '미국' },
  { id: 'intel', nameKo: 'Intel', nameEn: 'Intel', ticker: 'INTC', lat: 37.39, lng: -121.96, type: 'fab', country: '미국' },
  // Packaging
  { id: 'ase', nameKo: 'ASE그룹', nameEn: 'ASE Group', lat: 22.62, lng: 120.28, type: 'packaging', country: '대만' },
  { id: 'amkor', nameKo: 'Amkor', nameEn: 'Amkor Technology', ticker: 'AMKR', lat: 33.59, lng: -111.88, type: 'packaging', country: '미국' },
  // Consumers
  { id: 'apple', nameKo: 'Apple', nameEn: 'Apple', ticker: 'AAPL', lat: 37.33, lng: -122.01, type: 'consumer', country: '미국' },
  { id: 'amazon', nameKo: 'Amazon AWS', nameEn: 'Amazon AWS', ticker: 'AMZN', lat: 47.62, lng: -122.34, type: 'consumer', country: '미국' },
];

export const SEMI_EDGES: SemiEdge[] = [
  // Equipment → Fabs
  { from: 'asml', to: 'tsmc', label: 'EUV 장비', labelEn: 'EUV lithography', value: 5, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban', 'China chip'] },
  { from: 'asml', to: 'skhynix', label: 'EUV 장비', labelEn: 'EUV lithography', value: 4, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban'] },
  { from: 'asml', to: 'samsung_semi', label: 'EUV 장비', labelEn: 'EUV lithography', value: 4, geopoliticalKeywords: ['Netherlands export', 'ASML', 'EUV ban'] },
  { from: 'lam', to: 'tsmc', label: '식각 장비', labelEn: 'etch equipment', value: 3, geopoliticalKeywords: ['US export control', 'semiconductor equipment'] },
  { from: 'applied', to: 'tsmc', label: '증착 장비', labelEn: 'deposition equipment', value: 3, geopoliticalKeywords: ['US export control'] },
  { from: 'tokyo_electron', to: 'tsmc', label: '코팅 장비', labelEn: 'coating equipment', value: 3, geopoliticalKeywords: ['Japan export', 'semiconductor'] },
  { from: 'tokyo_electron', to: 'samsung_semi', label: '코팅 장비', labelEn: 'coating equipment', value: 3, geopoliticalKeywords: ['Japan export'] },
  // Materials → Fabs
  { from: 'shin_etsu', to: 'tsmc', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export control', 'photoresist', 'semiconductor material'] },
  { from: 'shin_etsu', to: 'skhynix', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export control'] },
  { from: 'jsr', to: 'tsmc', label: '포토레지스트', labelEn: 'photoresist', value: 3, geopoliticalKeywords: ['Japan export', 'JSR'] },
  { from: 'linde', to: 'skhynix', label: '특수가스', labelEn: 'specialty gases', value: 2, geopoliticalKeywords: ['neon', 'specialty gas', 'Ukraine'] },
  // TSMC / Samsung → HBM products
  { from: 'tsmc', to: 'skhynix', label: 'HBM 웨이퍼', labelEn: 'HBM wafer supply', value: 5, geopoliticalKeywords: ['Taiwan', 'Taiwan Strait', 'China', 'military', 'HBM'] },
  { from: 'tsmc', to: 'samsung_semi', label: '파운드리', labelEn: 'foundry services', value: 4, geopoliticalKeywords: ['Taiwan', 'Taiwan Strait', 'China', 'military'] },
  // HBM → NVIDIA
  { from: 'skhynix', to: 'nvidia', label: 'HBM3E 공급', labelEn: 'HBM3E memory supply', value: 5, geopoliticalKeywords: ['HBM', 'AI chip', 'memory', 'NVIDIA', 'export control'] },
  { from: 'samsung_semi', to: 'nvidia', label: 'HBM/DRAM', labelEn: 'HBM/DRAM supply', value: 4, geopoliticalKeywords: ['HBM', 'AI chip', 'DRAM'] },
  // Packaging
  { from: 'skhynix', to: 'ase', label: '패키징', labelEn: 'advanced packaging', value: 3, geopoliticalKeywords: ['Taiwan', 'packaging'] },
  { from: 'tsmc', to: 'ase', label: 'CoWoS 패키징', labelEn: 'CoWoS packaging', value: 4, geopoliticalKeywords: ['Taiwan', 'CoWoS', 'AI chip'] },
  { from: 'ase', to: 'nvidia', label: '완성 패키지', labelEn: 'finished package', value: 4, geopoliticalKeywords: ['Taiwan', 'packaging', 'AI chip'] },
  // To consumers
  { from: 'nvidia', to: 'amazon', label: 'GPU 공급', labelEn: 'GPU supply', value: 4, geopoliticalKeywords: ['AI', 'GPU', 'cloud'] },
  { from: 'skhynix', to: 'apple', label: 'LPDDR 메모리', labelEn: 'LPDDR memory', value: 3, geopoliticalKeywords: ['Apple', 'iPhone', 'memory'] },
  { from: 'tsmc', to: 'apple', label: 'A시리즈 칩', labelEn: 'Apple silicon foundry', value: 5, geopoliticalKeywords: ['Apple', 'Taiwan', 'A-series chip'] },
];
```

---

## PART 2: Add Semiconductor Layer to `WorldMapView.tsx`

### A) Import at top

```typescript
import { SEMI_NODES, SEMI_EDGES, SemiNode, SemiEdge } from '../data/semiconductor-supply-chain';
```

### B) Add LayerState and toggles

Add `semiconductor: false` to the `LayerState` interface and initial state (alongside existing layers).

Add a layer button in the layer controls:
```tsx
<button
  onClick={() => toggleLayer('semiconductor' as keyof LayerState)}
  title="반도체 공급망"
  style={{
    background: layers.semiconductor ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${layers.semiconductor ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
    color: layers.semiconductor ? '#86efac' : '#94a3b8',
    borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 13,
  }}
>
  🔬
</button>
```

### C) Add state for selected semiconductor node

```typescript
const [selectedSemiNodeId, setSelectedSemiNodeId] = useState<string | null>(null);
```

### D) Compute edge stress from geo-events

Inside `WorldMapView`, add this derived computation:
```typescript
const stressedEdgeIds = React.useMemo(() => {
  const allEventText = geoEvents.map(ev => `${ev.titleKo} ${ev.region} ${ev.descKo ?? ''}`).join(' ').toLowerCase();
  return new Set(
    SEMI_EDGES
      .filter(edge => edge.geopoliticalKeywords.some(kw => allEventText.includes(kw.toLowerCase())))
      .map(edge => `${edge.from}-${edge.to}`)
  );
}, [geoEvents]);
```

### E) Add semiconductor layer rendering inside `<MapContainer>`

**Add BEFORE the convergence zone markers:**

```tsx
{/* ── 반도체 공급망 레이어 ── */}
{layers.semiconductor && (() => {
  // Determine which nodes to highlight based on selected node
  const relevantEdges = selectedSemiNodeId
    ? SEMI_EDGES.filter(e => e.from === selectedSemiNodeId || e.to === selectedSemiNodeId)
    : SEMI_EDGES;

  const relevantNodeIds = selectedSemiNodeId
    ? new Set([selectedSemiNodeId, ...relevantEdges.flatMap(e => [e.from, e.to])])
    : null; // null means show all

  return (
    <>
      {/* Edges (Polylines) */}
      {relevantEdges.map(edge => {
        const fromNode = SEMI_NODES.find(n => n.id === edge.from);
        const toNode = SEMI_NODES.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const edgeKey = `${edge.from}-${edge.to}`;
        const isStressed = stressedEdgeIds.has(edgeKey);
        const isHighlighted = selectedSemiNodeId === edge.from || selectedSemiNodeId === edge.to;

        const color = isStressed ? '#ef4444' : isHighlighted ? '#fbbf24' : '#22c55e';
        const opacity = selectedSemiNodeId ? (isHighlighted ? 0.85 : 0.15) : (isStressed ? 0.75 : 0.45);
        const weight = Math.max(1, edge.value * 0.8) + (isHighlighted ? 1 : 0);

        return (
          <React.Fragment key={edgeKey}>
            <Polyline
              positions={[[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]]}
              pathOptions={{ color, weight, opacity, dashArray: isStressed ? '5 4' : undefined }}
            />
            {/* Edge label at midpoint (only when highlighted or stressed) */}
            {(isHighlighted || isStressed) && (
              <Tooltip
                position={[(fromNode.lat + toNode.lat) / 2, (fromNode.lng + toNode.lng) / 2]}
                permanent={false}
                direction="top"
                opacity={1}
              >
                <div style={{ background: '#0f172a', color: isStressed ? '#ef4444' : '#fbbf24', padding: '3px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: `1px solid ${isStressed ? '#ef444444' : '#fbbf2444'}` }}>
                  {isStressed ? '⚠️ ' : ''}{edge.label}
                </div>
              </Tooltip>
            )}
          </React.Fragment>
        );
      })}

      {/* Nodes (CircleMarkers) */}
      {SEMI_NODES
        .filter(n => !relevantNodeIds || relevantNodeIds.has(n.id))
        .map(node => {
          const isSelected = selectedSemiNodeId === node.id;
          const isDimmed = selectedSemiNodeId && !relevantNodeIds?.has(node.id);
          const TYPE_COLOR: Record<string, string> = {
            fab: '#22c55e',
            equipment: '#a78bfa',
            material: '#fb923c',
            designer: '#38bdf8',
            consumer: '#f472b6',
            packaging: '#fbbf24',
          };
          const color = TYPE_COLOR[node.type] ?? '#94a3b8';

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={isSelected ? 9 : 6}
              pathOptions={{
                color,
                fillColor: isSelected ? '#ffffff' : color,
                fillOpacity: isDimmed ? 0.2 : isSelected ? 1 : 0.75,
                weight: isSelected ? 3 : 1.5,
                opacity: isDimmed ? 0.3 : 1,
              }}
              eventHandlers={{
                click: () => setSelectedSemiNodeId(prev => prev === node.id ? null : node.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div style={{ background: '#0f172a', color: '#f1f5f9', padding: '7px 10px', borderRadius: 7, border: `1px solid ${color}55`, fontFamily: 'system-ui', minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{node.nameKo}</div>
                  {node.ticker && <div style={{ fontSize: 10, color, fontFamily: 'monospace', fontWeight: 700, marginBottom: 2 }}>{node.ticker}</div>}
                  <div style={{ fontSize: 10, color: '#64748b' }}>{node.country} · {node.type}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>클릭 → 공급망 X-ray</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
    </>
  );
})()}
```

### F) Add X-ray panel when node selected

After `MapContainer` close tag (alongside other side panels), add:

```tsx
{/* ── 반도체 공급망 X-ray 패널 ── */}
{layers.semiconductor && selectedSemiNodeId && (() => {
  const node = SEMI_NODES.find(n => n.id === selectedSemiNodeId);
  if (!node) return null;

  const upstreamEdges = SEMI_EDGES.filter(e => e.to === selectedSemiNodeId);
  const downstreamEdges = SEMI_EDGES.filter(e => e.from === selectedSemiNodeId);
  const allEdges = [...upstreamEdges, ...downstreamEdges];
  const stressedCount = allEdges.filter(e => stressedEdgeIds.has(`${e.from}-${e.to}`)).size ?? 0;
  // Fix: use filter length
  const stressedCountReal = allEdges.filter(e => stressedEdgeIds.has(`${e.from}-${e.to}`)).length;

  const TYPE_COLOR: Record<string, string> = {
    fab: '#22c55e', equipment: '#a78bfa', material: '#fb923c',
    designer: '#38bdf8', consumer: '#f472b6', packaging: '#fbbf24',
  };
  const nodeColor = TYPE_COLOR[node.type] ?? '#94a3b8';

  return (
    <DraggablePanel
      initialX={20}
      initialY={60}
      width={320}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔬</span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>공급망 X-ray — {node.nameKo}</span>
          {stressedCountReal > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠️ {stressedCountReal}개 위험</span>
          )}
          <button onClick={() => setSelectedSemiNodeId(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, marginLeft: stressedCountReal > 0 ? 0 : 'auto' }}>×</button>
        </div>
      }
    >
      <div style={{ padding: '10px 12px', fontSize: 12, color: '#e2e8f0', background: '#0f172a', maxHeight: 350, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 4, background: `${nodeColor}22`, color: nodeColor, border: `1px solid ${nodeColor}44`, fontWeight: 700 }}>
            {node.type}
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>{node.country}</span>
          {node.ticker && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{node.ticker}</span>}
        </div>

        {upstreamEdges.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>⬆️ 상류 (공급받는 것)</div>
            {upstreamEdges.map(e => {
              const fromNode = SEMI_NODES.find(n => n.id === e.from);
              const isStressed = stressedEdgeIds.has(`${e.from}-${e.to}`);
              return (
                <div key={`${e.from}-${e.to}`} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #1e293b', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isStressed ? '#ef4444' : '#22c55e' }}>{isStressed ? '⚠️' : '✅'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{fromNode?.nameKo ?? e.from}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{e.label}</div>
                  </div>
                  {isStressed && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>RISK</span>}
                </div>
              );
            })}
          </div>
        )}

        {downstreamEdges.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>⬇️ 하류 (공급하는 것)</div>
            {downstreamEdges.map(e => {
              const toNode = SEMI_NODES.find(n => n.id === e.to);
              const isStressed = stressedEdgeIds.has(`${e.from}-${e.to}`);
              return (
                <div key={`${e.from}-${e.to}`} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #1e293b', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isStressed ? '#ef4444' : '#22c55e' }}>{isStressed ? '⚠️' : '✅'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{toNode?.nameKo ?? e.to}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{e.label}</div>
                  </div>
                  {isStressed && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>RISK</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DraggablePanel>
  );
})()}
```

---

## After changes

```bash
cd /Users/superdog/.openclaw/workspace/projects/signal/src-react && npm run build 2>&1 | tail -30
```

Fix all TypeScript errors. Commit:
`feat: Semiconductor Supply Chain Flow — 반도체 공급망 지도 레이어 + X-ray 패널`

Then run:
```
openclaw system event --text "Done: Semiconductor Supply Chain layer complete" --mode now
```
