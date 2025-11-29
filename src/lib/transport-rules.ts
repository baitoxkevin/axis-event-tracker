/**
 * Transport Rules Configuration
 * Based on Pre-Plan Schedules:
 * - Arrivals: 18th Jan
 * - Departures: 21st, 22nd, 23rd Jan
 */

// Vehicle types and their passenger capacity (with luggage)
export const VEHICLE_TYPES = {
  SEDAN: { name: 'Sedan', minPax: 1, maxPax: 2, icon: '🚗' },
  MPV: { name: 'MPV', minPax: 3, maxPax: 4, icon: '🚙' },
  STAREX: { name: 'Starex', minPax: 5, maxPax: 7, icon: '🚐' },
  VAN: { name: 'Van', minPax: 8, maxPax: 10, icon: '🚐' },
  BUS: { name: 'Bus', minPax: 11, maxPax: 35, icon: '🚌' },
} as const;

export type VehicleType = keyof typeof VEHICLE_TYPES;

/**
 * Pre-planned transport groups
 * Groups flights that will share the same transport
 */
export interface TransportGroup {
  id: string;
  flights: string[];
  gatherTime: string; // Time to gather (for arrivals: at L1, for departures: at hotel lobby)
  transportTime: string; // Transport departure time
  vehicleType: VehicleType;
  combinedPax: number;
  remark?: string;
  isT2?: boolean; // Terminal 2 departure
}

export type TransportDirection = 'arrival' | 'departure';

export const TRANSPORT_GROUPS_JAN18: TransportGroup[] = [
  {
    id: 'G1',
    flights: ['MU8591', 'FM863', 'MH128'],
    gatherTime: '06:45',
    transportTime: '07:00',
    vehicleType: 'BUS',
    combinedPax: 24,
  },
  {
    id: 'G2',
    flights: ['NH885', 'ANA885', 'MH181'],
    gatherTime: '07:50',
    transportTime: '08:00',
    vehicleType: 'BUS',
    combinedPax: 25,
  },
  {
    id: 'G3',
    flights: ['MH191', 'MH193', 'MH195', 'MH132', 'MH199'],
    gatherTime: '08:30',
    transportTime: '08:30',
    vehicleType: 'BUS',
    combinedPax: 25,
  },
  {
    id: 'G4',
    flights: ['MH126', 'SQ104'],
    gatherTime: '09:15',
    transportTime: '09:15',
    vehicleType: 'MPV',
    combinedPax: 4,
  },
  {
    id: 'G5',
    flights: ['SQ106'],
    gatherTime: '10:30',
    transportTime: '10:30',
    vehicleType: 'STAREX',
    combinedPax: 5,
    remark: 'Possible to combine with next transport',
  },
  {
    id: 'G6',
    flights: ['SQ108', 'MH805'],
    gatherTime: '11:35',
    transportTime: '11:45',
    vehicleType: 'BUS',
    combinedPax: 22,
  },
  {
    id: 'G7',
    flights: ['BR217', 'GA820', 'TG415'],
    gatherTime: '12:55',
    transportTime: '13:00',
    vehicleType: 'VAN',
    combinedPax: 8,
  },
  {
    id: 'G8',
    flights: ['H14033', 'VJ825'],
    gatherTime: '13:35',
    transportTime: '13:35',
    vehicleType: 'VAN',
    combinedPax: 4,
  },
  {
    id: 'G9',
    flights: ['OD353', 'MH614', 'CX723', 'GA9282', 'MH712', 'CI721', 'CZ3047'],
    gatherTime: '13:55',
    transportTime: '14:00',
    vehicleType: 'VAN',
    combinedPax: 17,
  },
  {
    id: 'G10',
    flights: ['SQ114', 'VA5434', 'MH134'],
    gatherTime: '14:55',
    transportTime: '15:00',
    vehicleType: 'BUS',
    combinedPax: 26,
  },
  {
    id: 'G11',
    flights: ['MH146'],
    gatherTime: '15:15',
    transportTime: '15:15',
    vehicleType: 'VAN',
    combinedPax: 10,
  },
  {
    id: 'G12',
    flights: ['MH710'],
    gatherTime: '15:20',
    transportTime: '15:20',
    vehicleType: 'VAN',
    combinedPax: 15,
  },
  {
    id: 'G13',
    flights: ['MU8641', 'CZ5031', 'FM885'],
    gatherTime: '15:40',
    transportTime: '15:45',
    vehicleType: 'BUS',
    combinedPax: 31,
  },
  {
    id: 'G14',
    flights: ['MH606', 'SQ238'],
    gatherTime: '16:15',
    transportTime: '16:15',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'G15',
    flights: ['CZ8011', 'MH053', 'MH138', 'MH250', 'SQ116', 'MH0067'],
    gatherTime: '17:15',
    transportTime: '17:15',
    vehicleType: 'STAREX',
    combinedPax: 13,
  },
  {
    id: 'G16',
    flights: ['CX725'],
    gatherTime: '17:50',
    transportTime: '17:50',
    vehicleType: 'VAN',
    combinedPax: 10,
  },
  {
    id: 'G17',
    flights: ['JL7091', 'MH089'],
    gatherTime: '18:00',
    transportTime: '18:00',
    vehicleType: 'VAN',
    combinedPax: 18,
  },
  {
    id: 'G18',
    flights: ['MH789'],
    gatherTime: '18:35',
    transportTime: '18:35',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'G19',
    flights: ['MH9117', 'JL723', 'VN679'],
    gatherTime: '19:50',
    transportTime: '19:50',
    vehicleType: 'VAN',
    combinedPax: 9,
  },
  {
    id: 'G20',
    flights: ['SQ126', 'MH144'],
    gatherTime: '20:55',
    transportTime: '20:55',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'G21',
    flights: ['SQ128'],
    gatherTime: '22:00',
    transportTime: '22:00',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
];

/**
 * Pre-planned departure transport groups for Jan 21
 */
export const TRANSPORT_GROUPS_JAN21_DEPARTURE: TransportGroup[] = [
  {
    id: 'D21-1',
    flights: ['FM864', 'MU8592'],
    gatherTime: '02:50',
    transportTime: '03:05',
    vehicleType: 'STAREX',
    combinedPax: 6,
    remark: 'Late Night',
  },
  {
    id: 'D21-2',
    flights: ['SQ105'],
    gatherTime: '06:15',
    transportTime: '06:30',
    vehicleType: 'MPV',
    combinedPax: 3,
    remark: 'Late Night',
  },
  {
    id: 'D21-3',
    flights: ['CZ722'],
    gatherTime: '09:30',
    transportTime: '09:30',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-4',
    flights: ['CZ3048'],
    gatherTime: '10:45',
    transportTime: '10:45',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-5',
    flights: ['CZ5032', 'FM886', 'MU8642'],
    gatherTime: '11:30',
    transportTime: '11:40',
    vehicleType: 'BUS',
    combinedPax: 21,
  },
  {
    id: 'D21-6',
    flights: ['SQ115'],
    gatherTime: '13:00',
    transportTime: '13:00',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-7',
    flights: ['CX724'],
    gatherTime: '13:40',
    transportTime: '13:50',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D21-8',
    flights: ['SQ8551'],
    gatherTime: '15:10',
    transportTime: '15:10',
    vehicleType: 'SEDAN',
    combinedPax: 1,
    isT2: true,
    remark: 'T2 Departure',
  },
  {
    id: 'D21-9',
    flights: ['VN678'],
    gatherTime: '15:50',
    transportTime: '15:50',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-10',
    flights: ['SQ125', 'MH147'],
    gatherTime: '16:20',
    transportTime: '16:30',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D21-11',
    flights: ['6E1038', 'MH192'],
    gatherTime: '17:10',
    transportTime: '17:15',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D21-12',
    flights: ['JL724'],
    gatherTime: '18:50',
    transportTime: '18:50',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-13',
    flights: ['KL810'],
    gatherTime: '19:50',
    transportTime: '19:50',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D21-14',
    flights: ['HO1354'],
    gatherTime: '20:15',
    transportTime: '20:25',
    vehicleType: 'STAREX',
    combinedPax: 6,
  },
];

/**
 * Pre-planned departure transport groups for Jan 22
 */
export const TRANSPORT_GROUPS_JAN22_DEPARTURE: TransportGroup[] = [
  {
    id: 'D22-1',
    flights: ['NH816', 'CX730'],
    gatherTime: '04:00',
    transportTime: '04:05',
    vehicleType: 'STAREX',
    combinedPax: 7,
    remark: 'Late Night',
  },
  {
    id: 'D22-2',
    flights: ['MH70', 'JL7092'],
    gatherTime: '05:15',
    transportTime: '05:30',
    vehicleType: 'STAREX',
    combinedPax: 6,
    remark: 'Late Night',
  },
  {
    id: 'D22-3',
    flights: ['SQ105'],
    gatherTime: '06:15',
    transportTime: '06:30',
    vehicleType: 'SEDAN',
    combinedPax: 2,
    remark: 'Late Night',
  },
  {
    id: 'D22-4',
    flights: ['SQ107'],
    gatherTime: '06:45',
    transportTime: '07:05',
    vehicleType: 'STAREX',
    combinedPax: 11,
    remark: 'Late Night - Possible to make it 7am?',
  },
  {
    id: 'D22-5',
    flights: ['GA821', 'MH5860', 'TG416'],
    gatherTime: '08:45',
    transportTime: '08:50',
    vehicleType: 'VAN',
    combinedPax: 8,
  },
  {
    id: 'D22-6',
    flights: ['MH38', 'VJ826'],
    gatherTime: '09:15',
    transportTime: '09:25',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D22-7',
    flights: ['NH886'],
    gatherTime: '10:00',
    transportTime: '10:15',
    vehicleType: 'BUS',
    combinedPax: 22,
  },
  {
    id: 'D22-8',
    flights: ['CI722'],
    gatherTime: '10:30',
    transportTime: '10:35',
    vehicleType: 'VAN',
    combinedPax: 8,
  },
  {
    id: 'D22-9',
    flights: ['MH758', 'SQ113', 'MH782'],
    gatherTime: '10:30',
    transportTime: '10:40',
    vehicleType: 'VAN',
    combinedPax: 9,
  },
  {
    id: 'D22-10',
    flights: ['BR228', 'MH605'],
    gatherTime: '11:15',
    transportTime: '11:25',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D22-11',
    flights: ['MU8642'],
    gatherTime: '11:45',
    transportTime: '12:00',
    vehicleType: 'STAREX',
    combinedPax: 11,
  },
  {
    id: 'D22-12',
    flights: ['SQ115'],
    gatherTime: '12:45',
    transportTime: '13:00',
    vehicleType: 'STAREX',
    combinedPax: 7,
  },
  {
    id: 'D22-13',
    flights: ['MH804'],
    gatherTime: '13:30',
    transportTime: '13:35',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D22-14',
    flights: ['CX724', 'MH725', 'GA9275'],
    gatherTime: '13:45',
    transportTime: '13:50',
    vehicleType: 'VAN',
    combinedPax: 9,
  },
  {
    id: 'D22-15',
    flights: ['SQ121', 'MH190'],
    gatherTime: '14:45',
    transportTime: '14:30',
    vehicleType: 'STAREX',
    combinedPax: 6,
  },
  {
    id: 'D22-16',
    flights: ['MH194'],
    gatherTime: '15:45',
    transportTime: '15:55',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D22-17',
    flights: ['SQ125', 'MH251'],
    gatherTime: '16:15',
    transportTime: '16:30',
    vehicleType: 'STAREX',
    combinedPax: 5,
  },
  {
    id: 'D22-18',
    flights: ['MH198'],
    gatherTime: '17:15',
    transportTime: '17:25',
    vehicleType: 'SEDAN',
    combinedPax: 2,
  },
  {
    id: 'D22-19',
    flights: ['MH180', 'MH192'],
    gatherTime: '17:30',
    transportTime: '17:30',
    vehicleType: 'STAREX',
    combinedPax: 13,
  },
  {
    id: 'D22-20',
    flights: ['MH139', 'MH52'],
    gatherTime: '18:15',
    transportTime: '18:30',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D22-21',
    flights: ['JL724', 'MH9118'],
    gatherTime: '18:45',
    transportTime: '18:50',
    vehicleType: 'STAREX',
    combinedPax: 6,
  },
  {
    id: 'D22-22',
    flights: ['KE672'],
    gatherTime: '19:45',
    transportTime: '19:55',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
];

/**
 * Pre-planned departure transport groups for Jan 23
 */
export const TRANSPORT_GROUPS_JAN23_DEPARTURE: TransportGroup[] = [
  {
    id: 'D23-1',
    flights: ['MH141', 'MH125'],
    gatherTime: '05:00',
    transportTime: '05:10',
    vehicleType: 'STAREX',
    combinedPax: 6,
    remark: 'Late Night',
  },
  {
    id: 'D23-2',
    flights: ['MH129'],
    gatherTime: '05:45',
    transportTime: '05:50',
    vehicleType: 'STAREX',
    combinedPax: 5,
    remark: 'Late Night',
  },
  {
    id: 'D23-3',
    flights: ['SQ107', 'AK451'],
    gatherTime: '07:00',
    transportTime: '07:05',
    vehicleType: 'STAREX',
    combinedPax: 6,
  },
  {
    id: 'D23-4',
    flights: ['AK884'],
    gatherTime: '09:15',
    transportTime: '09:25',
    vehicleType: 'SEDAN',
    combinedPax: 1,
    isT2: true,
    remark: 'T2 Departure',
  },
  {
    id: 'D23-5',
    flights: ['CX722'],
    gatherTime: '09:30',
    transportTime: '09:35',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D23-6',
    flights: ['NH886'],
    gatherTime: '10:15',
    transportTime: '10:15',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-7',
    flights: ['MU8642'],
    gatherTime: '12:00',
    transportTime: '12:00',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-8',
    flights: ['SQ115'],
    gatherTime: '13:00',
    transportTime: '13:00',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-9',
    flights: ['SQ8583', 'TR473'],
    gatherTime: '14:00',
    transportTime: '14:15',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D23-10',
    flights: ['SQ8551'],
    gatherTime: '15:00',
    transportTime: '15:10',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-11',
    flights: ['MH251', 'MH135'],
    gatherTime: '16:15',
    transportTime: '16:30',
    vehicleType: 'MPV',
    combinedPax: 4,
  },
  {
    id: 'D23-12',
    flights: ['MH147'],
    gatherTime: '16:30',
    transportTime: '16:35',
    vehicleType: 'STAREX',
    combinedPax: 6,
  },
  {
    id: 'D23-13',
    flights: ['MH145', 'TG418'],
    gatherTime: '16:50',
    transportTime: '17:05',
    vehicleType: 'MPV',
    combinedPax: 3,
  },
  {
    id: 'D23-14',
    flights: ['MH192'],
    gatherTime: '17:15',
    transportTime: '17:30',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-15',
    flights: ['VA5447'],
    gatherTime: '17:30',
    transportTime: '17:50',
    vehicleType: 'SEDAN',
    combinedPax: 1,
  },
  {
    id: 'D23-16',
    flights: ['MH139', 'MH149'],
    gatherTime: '18:15',
    transportTime: '18:30',
    vehicleType: 'SEDAN',
    combinedPax: 2,
  },
  {
    id: 'D23-17',
    flights: ['MH52', 'MH9118'],
    gatherTime: '18:30',
    transportTime: '18:40',
    vehicleType: 'STAREX',
    combinedPax: 5,
  },
  {
    id: 'D23-18',
    flights: ['KE672'],
    gatherTime: '19:45',
    transportTime: '19:55',
    vehicleType: 'SEDAN',
    combinedPax: 2,
  },
];

/**
 * Combined transport schedule by date
 */
export const TRANSPORT_SCHEDULES: Record<string, { direction: TransportDirection; groups: TransportGroup[] }> = {
  '2026-01-18': { direction: 'arrival', groups: TRANSPORT_GROUPS_JAN18 },
  '2026-01-21': { direction: 'departure', groups: TRANSPORT_GROUPS_JAN21_DEPARTURE },
  '2026-01-22': { direction: 'departure', groups: TRANSPORT_GROUPS_JAN22_DEPARTURE },
  '2026-01-23': { direction: 'departure', groups: TRANSPORT_GROUPS_JAN23_DEPARTURE },
};

/**
 * Find transport group for a flight on a specific date
 */
export function findTransportGroup(flightNumber: string, date: string): TransportGroup | null {
  const schedule = TRANSPORT_SCHEDULES[date];
  if (!schedule) return null;

  const normalized = flightNumber.toUpperCase().replace(/\s+/g, '');

  return schedule.groups.find(group =>
    group.flights.some(f => {
      const normalizedGroup = f.toUpperCase().replace(/\s+/g, '');
      return normalizedGroup === normalized || areCodeshareFlights(normalizedGroup, normalized);
    })
  ) || null;
}

/**
 * Find transport group for a flight with direction info
 */
export function findTransportGroupWithDirection(flightNumber: string, date: string): { group: TransportGroup; direction: TransportDirection } | null {
  const schedule = TRANSPORT_SCHEDULES[date];
  if (!schedule) return null;

  const normalized = flightNumber.toUpperCase().replace(/\s+/g, '');

  const group = schedule.groups.find(g =>
    g.flights.some(f => {
      const normalizedGroup = f.toUpperCase().replace(/\s+/g, '');
      return normalizedGroup === normalized || areCodeshareFlights(normalizedGroup, normalized);
    })
  );

  return group ? { group, direction: schedule.direction } : null;
}

/**
 * Get all transport groups for a date
 */
export function getTransportGroupsForDate(date: string): { direction: TransportDirection; groups: TransportGroup[] } | null {
  return TRANSPORT_SCHEDULES[date] || null;
}

/**
 * Get all scheduled transport dates
 */
export function getScheduledTransportDates(): string[] {
  return Object.keys(TRANSPORT_SCHEDULES).sort();
}

/**
 * Get all flights in the same transport group
 */
export function getFlightsInSameGroup(flightNumber: string, date: string): string[] {
  const group = findTransportGroup(flightNumber, date);
  return group?.flights || [flightNumber];
}

/**
 * Get recommended vehicle type based on passenger count
 */
export function getRecommendedVehicle(paxCount: number): {
  type: VehicleType;
  name: string;
  icon: string;
  note?: string;
  needsMultiple?: boolean;
  vehicleCount?: number;
} {
  if (paxCount <= 2) {
    return { ...VEHICLE_TYPES.SEDAN, type: 'SEDAN' };
  }
  if (paxCount <= 4) {
    return { ...VEHICLE_TYPES.MPV, type: 'MPV' };
  }
  if (paxCount <= 7) {
    return { ...VEHICLE_TYPES.STAREX, type: 'STAREX' };
  }
  if (paxCount <= 9) {
    return { ...VEHICLE_TYPES.VAN, type: 'VAN' };
  }
  if (paxCount <= 35) {
    return { ...VEHICLE_TYPES.BUS, type: 'BUS' };
  }

  // More than 35 pax - need multiple buses
  const busCount = Math.ceil(paxCount / 35);
  return {
    ...VEHICLE_TYPES.BUS,
    type: 'BUS',
    needsMultiple: true,
    vehicleCount: busCount,
  };
}

/**
 * Midnight surcharge hours: 11:00pm (23:00) to 6:59am (06:59)
 */
export function isMidnightSurchargeTime(time: string): boolean {
  if (!time) return false;

  // Parse time in HH:MM or HH:MM:SS format
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return false;

  const hour = parseInt(match[1], 10);

  // Surcharge hours: 23:00-23:59 or 00:00-06:59
  return hour >= 23 || hour < 7;
}

/**
 * Codeshare / Same Flight Mappings
 * Flights that are actually the same but have different codes
 */
export const CODESHARE_FLIGHTS: Record<string, string[]> = {
  // Arrivals (Jan 18)
  'GA9282': ['MH712'],
  'MH712': ['GA9282'],
  'SQ114': ['VA5434'],
  'VA5434': ['SQ114'],
  'MU8641': ['FM885'],
  'FM885': ['MU8641'],
  'JL7091': ['MH089', 'MH89'],
  'MH089': ['JL7091'],
  'MH89': ['JL7091'],
  'JL723': ['MH9117'],
  'MH9117': ['JL723'],

  // Departures (Jan 21)
  'FM864': ['MU8592'],
  'MU8592': ['FM864'],
  'FM886': ['MU8642'],
  'MU8642': ['FM886'],

  // Departures (Jan 22)
  'JL7092': ['MH70'],
  'MH70': ['JL7092'],
  'MH5860': ['TG416'],
  'TG416': ['MH5860'],
  'MH725': ['GA9275'],
  'GA9275': ['MH725'],
  'JL724': ['MH9118'],
  'MH9118': ['JL724'],

  // Departures (Jan 23)
  'SQ8583': ['TR473'],
  'TR473': ['SQ8583'],

  // Alternative flight codes
  'ANA885': ['NH885'],
  'NH885': ['ANA885'],
};

/**
 * Get codeshare partners for a flight
 */
export function getCodesharePartners(flightNumber: string): string[] {
  const normalized = flightNumber.toUpperCase().replace(/\s+/g, '');
  return CODESHARE_FLIGHTS[normalized] || [];
}

/**
 * Check if two flights are codeshare partners
 */
export function areCodeshareFlights(flight1: string, flight2: string): boolean {
  const norm1 = flight1.toUpperCase().replace(/\s+/g, '');
  const norm2 = flight2.toUpperCase().replace(/\s+/g, '');

  if (norm1 === norm2) return true;

  const partners = CODESHARE_FLIGHTS[norm1];
  return partners ? partners.includes(norm2) : false;
}

/**
 * Time corrections from the document
 * Maps flight numbers to their corrected times
 */
export const TIME_CORRECTIONS: Record<string, { date: string; correctedTime: string; note?: string }> = {
  // Arrivals (Jan 18)
  'MH132': { date: '2026-01-18', correctedTime: '07:50', note: 'Not 07:25' },
  'CX723': { date: '2026-01-18', correctedTime: '12:35', note: 'Not 12:30' },
  'MH134': { date: '2026-01-18', correctedTime: '14:15', note: 'Not 14:10' },
  'SQ238': { date: '2026-01-18', correctedTime: '15:15', note: 'Not 18:10 - Stuart Howie, Mark Stuart Borg' },

  // Departures (Jan 21)
  'CX722': { date: '2026-01-21', correctedTime: '13:35', note: 'Not 13:30' },

  // Departures (Jan 22)
  'NH816': { date: '2026-01-22', correctedTime: '08:05', note: 'Not 08:00' },
  'CX730': { date: '2026-01-22', correctedTime: '08:15', note: 'Not 08:20' },
  'MH180': { date: '2026-01-22', correctedTime: '18:40', note: 'Not 18:30' },
  'MH38': { date: '2026-01-22', correctedTime: '13:25', note: 'Not 14:15' },

  // Departures (Jan 23)
  'MH135': { date: '2026-01-23', correctedTime: '20:30', note: 'Not 20:40' },
  'AK451': { date: '2026-01-23', correctedTime: '11:10', note: 'Not 09:00' },
};

/**
 * Get time correction for a flight if it exists
 */
export function getTimeCorrection(flightNumber: string, date: string): { correctedTime: string; note?: string } | null {
  const normalized = flightNumber.toUpperCase().replace(/\s+/g, '');
  const correction = TIME_CORRECTIONS[normalized];

  if (correction && correction.date === date) {
    return { correctedTime: correction.correctedTime, note: correction.note };
  }

  return null;
}

/**
 * Guests with missing or problematic flight codes
 */
export const GUESTS_NEEDING_ATTENTION = [
  { name: 'Sudhindra Holla', issue: 'Departure time is 21:30 but no flight code' },
  { name: 'Wai King Wong', issue: '24 JAN 00:20 flight, but no flight code' },
  { name: 'Oshana Jouna', issue: 'TR473 departure is 19:30pm (different from SQ8583)' },
];

/**
 * Format time for display with midnight surcharge indicator
 */
export function formatTimeWithSurcharge(time: string): {
  time: string;
  hasSurcharge: boolean;
  formatted: string;
} {
  const hasSurcharge = isMidnightSurchargeTime(time);
  return {
    time,
    hasSurcharge,
    formatted: hasSurcharge ? `${time} 🌙` : time,
  };
}
