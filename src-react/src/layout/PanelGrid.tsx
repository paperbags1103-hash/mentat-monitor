import ReactGridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useLayoutStore, type RGLItem } from '@/store';
import { PanelWrapper }  from './PanelWrapper';
import { PanelRenderer } from './PanelRenderer';

const GridLayout = WidthProvider(ReactGridLayout);

export function PanelGrid() {
  const { panels, layouts, setLayouts } = useLayoutStore();

  return (
    <GridLayout
      layout={layouts}
      cols={12}
      rowHeight={48}
      draggableHandle=".panel-drag-handle"
      onLayoutChange={(newLayout: RGLItem[]) => setLayouts(newLayout)}
      margin={[6, 6]}
      containerPadding={[6, 6]}
      useCSSTransforms
    >
      {panels.map(panel => (
        <div key={panel.id}>
          <PanelWrapper id={panel.id} title={panel.title}>
            <PanelRenderer panel={panel} />
          </PanelWrapper>
        </div>
      ))}
    </GridLayout>
  );
}
