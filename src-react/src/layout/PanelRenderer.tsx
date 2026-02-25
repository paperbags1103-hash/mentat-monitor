import { type PanelDef } from '@/store';
import { BriefingPane }        from '@/components/BriefingPane';
import { ThemePane }           from '@/components/ThemePane';
import { SignalFeed }          from '@/components/SignalFeed';
import { ChartPanel }          from '@/panels/ChartPanel';
import { MarketOverviewPanel } from '@/panels/MarketOverviewPanel';
import { BlackSwanPanel }      from '@/panels/BlackSwanPanel';
import { EconCalendarPanel }   from '@/panels/EconCalendarPanel';
import { LiveTVPanel }         from '@/panels/LiveTVPanel';
import { WebcamPanel }         from '@/panels/WebcamPanel';
import { CreditStressPanel }   from '@/panels/CreditStressPanel';
import { GlobalMacroPanel }    from '@/panels/GlobalMacroPanel';
import { ActionPanel }         from '@/panels/ActionPanel';
import { PortfolioPanel }      from '@/panels/PortfolioPanel';
import { AlertPanel }          from '@/panels/AlertPanel';
import { ScreenerPanel }       from '@/panels/ScreenerPanel';
import { NewsFeedPanel }       from '@/panels/NewsFeedPanel';
import { FearGreedPanel }      from '@/panels/FearGreedPanel';
import { ScenarioPanel }       from '@/panels/ScenarioPanel';
import { VaRPanel }            from '@/panels/VaRPanel';
import { SettingsPanel }       from '@/panels/SettingsPanel';
import { StockDetailPanel }    from '@/panels/StockDetailPanel';

interface Props { panel: PanelDef }

export function PanelRenderer({ panel }: Props) {
  switch (panel.type) {
    case 'briefing':       return <BriefingPane />;
    case 'themes':         return <ThemePane />;
    case 'signals':        return <SignalFeed />;
    case 'market':         return <MarketOverviewPanel />;
    case 'blackswan':      return <BlackSwanPanel />;
    case 'econ-calendar':  return <EconCalendarPanel />;
    case 'live-tv':        return <LiveTVPanel />;
    case 'webcam':         return <WebcamPanel />;
    case 'credit-stress':  return <CreditStressPanel />;
    case 'global-macro':   return <GlobalMacroPanel />;
    case 'actions':        return <ActionPanel />;
    case 'portfolio':      return <PortfolioPanel />;
    case 'alerts':         return <AlertPanel />;
    case 'screener':       return <ScreenerPanel />;
    case 'news':           return <NewsFeedPanel />;
    case 'fear-greed':     return <FearGreedPanel />;
    case 'scenario':       return <ScenarioPanel />;
    case 'var':            return <VaRPanel />;
    case 'settings':       return <SettingsPanel />;
    case 'stock': {
      const cfg = {
        symbol:   (panel.config?.symbol   as string) ?? 'AAPL',
        nameKo:   (panel.config?.nameKo   as string) ?? (panel.config?.symbol as string) ?? 'AAPL',
        exchange: (panel.config?.exchange as string) ?? '',
      };
      return <StockDetailPanel config={cfg} />;
    }
    case 'chart': {
      const symbol = (panel.config?.symbol as string) ?? '^KS11';
      const nameKo = (panel.config?.nameKo as string) ?? symbol;
      return <ChartPanel symbol={symbol} nameKo={nameKo} />;
    }
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted text-xs">
          알 수 없는 패널: {panel.type}
        </div>
      );
  }
}
