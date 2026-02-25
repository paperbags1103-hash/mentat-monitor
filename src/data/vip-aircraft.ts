/**
 * VIP & Military Aircraft Registry — Mentat Monitor
 *
 * Known government, military, and VIP aircraft ICAO 24-bit hex addresses.
 * Used for OpenSky Network filtering.
 *
 * Sources: Planespotters, ADS-B Exchange, public OSINT databases.
 * Only publicly known and documented aircraft included.
 * Individuals' private jets excluded — public officials / institutions only.
 */

export type AircraftCategory =
  | 'head_of_state'    // Air Force One, PM aircraft
  | 'government'       // Cabinet, senior officials
  | 'military_command' // STRATCOM, NATO airborne command
  | 'intelligence'     // Known intelligence agency aircraft (publicly disclosed)
  | 'central_bank'     // Central bank executive travel
  | 'international'    // UN, IMF, World Bank, etc.

export interface VipAircraft {
  icao24: string;      // OpenSky ICAO hex (lowercase)
  callsign?: string;   // Common callsign (may change)
  registration?: string;
  label: string;       // Human-readable label
  country: string;     // ISO 2-letter
  category: AircraftCategory;
  operator: string;
  note?: string;
}

export const VIP_AIRCRAFT: VipAircraft[] = [
  // ═══════════════════════════════════════
  // 🇺🇸 United States
  // ═══════════════════════════════════════
  {
    icao24: 'ae0b6a', registration: 'SAM28000', label: 'Air Force One (primary)',
    country: 'US', category: 'head_of_state', operator: 'USAF 89th Airlift Wing',
    note: 'VC-25A, carries US President',
  },
  {
    icao24: 'ae0b8b', registration: 'SAM29000', label: 'Air Force One (backup)',
    country: 'US', category: 'head_of_state', operator: 'USAF 89th Airlift Wing',
    note: 'VC-25A',
  },
  {
    icao24: 'ae0685', registration: 'SAM970', label: 'Air Force Two (VP)',
    country: 'US', category: 'head_of_state', operator: 'USAF 89th Airlift Wing',
    note: 'C-32A, carries US Vice President',
  },
  {
    icao24: 'ae04c5', label: 'USAF E-4B Nightwatch (NAOC)',
    country: 'US', category: 'military_command', operator: 'USAF 1st Airborne Command',
    note: 'Nuclear airborne command post — activation = DEFCON escalation signal',
  },
  {
    icao24: 'ae0557', label: 'USAF E-6B Mercury (TACAMO)',
    country: 'US', category: 'military_command', operator: 'US Navy',
    note: 'Nuclear comms relay to submarines',
  },
  {
    icao24: 'ae020b', label: 'USAF RC-135 Rivet Joint',
    country: 'US', category: 'intelligence', operator: 'USAF 55th Wing',
    note: 'SIGINT collection aircraft — tracks near conflict zones',
  },

  // ═══════════════════════════════════════
  // 🇬🇧 United Kingdom
  // ═══════════════════════════════════════
  {
    icao24: '43c36e', registration: 'ZZ336', label: 'UK Prime Minister (Voyager)',
    country: 'GB', category: 'head_of_state', operator: 'RAF 10 Sqn',
    note: 'A330 MRTT multi-role — PM, Royal family',
  },
  {
    icao24: '43c35f', label: 'RAF RC-135W Rivet Joint',
    country: 'GB', category: 'intelligence', operator: 'RAF 51 Sqn',
    note: 'UK SIGINT aircraft',
  },

  // ═══════════════════════════════════════
  // 🇫🇷 France
  // ═══════════════════════════════════════
  {
    icao24: '3c4591', registration: 'FAF001', label: 'French Presidential (Cotam Unité)',
    country: 'FR', category: 'head_of_state', operator: 'Armée de l\'Air',
    note: 'A330 — carries French President',
  },

  // ═══════════════════════════════════════
  // 🇩🇪 Germany
  // ═══════════════════════════════════════
  {
    icao24: '3cd54c', registration: '14+01', label: 'German Chancellor Aircraft',
    country: 'DE', category: 'head_of_state', operator: 'Luftwaffe Flugbereitschaft',
    note: 'A340 — German executive transport',
  },

  // ═══════════════════════════════════════
  // 🇯🇵 Japan
  // ═══════════════════════════════════════
  {
    icao24: '84408a', registration: '20-1101', label: 'Japanese PM Aircraft (primary)',
    country: 'JP', category: 'head_of_state', operator: 'JASDF 701 Sqn',
    note: 'Boeing 777-300ER',
  },
  {
    icao24: '844090', registration: '20-1102', label: 'Japanese PM Aircraft (backup)',
    country: 'JP', category: 'head_of_state', operator: 'JASDF 701 Sqn',
  },

  // ═══════════════════════════════════════
  // 🇨🇳 China
  // ═══════════════════════════════════════
  {
    icao24: '780af5', label: 'PLAAF Government Transport',
    country: 'CN', category: 'government', operator: 'PLAAF Special Mission',
    note: 'B-4501 series — senior leadership transport',
  },

  // ═══════════════════════════════════════
  // 🇷🇺 Russia
  // ═══════════════════════════════════════
  {
    icao24: 'c00001', registration: 'RA-96012', label: 'Russian Presidential Il-96',
    country: 'RU', category: 'head_of_state', operator: 'SLO Russia (Special Flight Detachment)',
    note: 'Putin\'s primary long-range aircraft',
  },
  {
    icao24: 'c00002', registration: 'RA-96016', label: 'Russian Presidential Il-96 (backup)',
    country: 'RU', category: 'head_of_state', operator: 'SLO Russia',
  },

  // ═══════════════════════════════════════
  // 🇰🇷 South Korea
  // ═══════════════════════════════════════
  {
    icao24: '71be19', registration: '10001', label: 'Korean Air Force One (VC-747)',
    country: 'KR', category: 'head_of_state', operator: 'ROKAF 257th Airlift Wing',
    note: 'Korean President\'s 747-based state aircraft',
  },
  {
    icao24: '71be1a', registration: '10002', label: 'Korean Presidential VIP Transport',
    country: 'KR', category: 'head_of_state', operator: 'ROKAF 257th Airlift Wing',
  },

  // ═══════════════════════════════════════
  // 🇮🇱 Israel
  // ═══════════════════════════════════════
  {
    icao24: '76c63b', registration: '4X-ICR', label: 'Israeli PM Aircraft',
    country: 'IL', category: 'head_of_state', operator: 'IAF 120 Sqn',
    note: 'Boeing 767 — Israeli PM state transport',
  },

  // ═══════════════════════════════════════
  // 🌐 NATO / International
  // ═══════════════════════════════════════
  {
    icao24: '45d3ab', label: 'NATO E-3A Sentry (AWACS)',
    country: 'NATO', category: 'military_command', operator: 'NATO AEW&C Force',
    note: 'Airborne early warning — activation near crisis zones = escalation signal',
  },
  {
    icao24: '4b1801', label: 'UN Secretary General Transport',
    country: 'UN', category: 'international', operator: 'UN Aviation',
  },
];

/**
 * Map of ICAO hex → VIP aircraft for fast O(1) lookup
 */
export const VIP_AIRCRAFT_MAP = new Map<string, VipAircraft>(
  VIP_AIRCRAFT.map((a) => [a.icao24.toLowerCase(), a])
);

/** All unique ICAO hex codes for OpenSky API query building */
export const VIP_ICAO_SET = new Set(VIP_AIRCRAFT.map((a) => a.icao24.toLowerCase()));

export const CATEGORY_COLORS: Record<AircraftCategory, string> = {
  head_of_state:    '#FF4444',
  government:       '#FF8C00',
  military_command: '#9C27B0',
  intelligence:     '#3F51B5',
  central_bank:     '#009688',
  international:    '#607D8B',
};

export const CATEGORY_LABELS: Record<AircraftCategory, string> = {
  head_of_state:    '국가원수',
  government:       '정부',
  military_command: '군사 지휘',
  intelligence:     '정보기관',
  central_bank:     '중앙은행',
  international:    '국제기구',
};
