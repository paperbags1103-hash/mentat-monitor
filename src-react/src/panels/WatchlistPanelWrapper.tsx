import React from 'react';
import WatchlistPanel from './WatchlistPanel';

interface GeoEventItem {
  id: string;
  titleKo: string;
  region: string;
  severity: string;
  category: string;
  lat: number;
  lng: number;
}

export default function WatchlistPanelWrapper({ geoEvents = [] }: { geoEvents?: GeoEventItem[] }) {
  return <WatchlistPanel geoEvents={geoEvents} />;
}
