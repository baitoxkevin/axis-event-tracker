/**
 * OpenSky Network API Service
 * Free real-time flight tracking (4000 calls/day)
 * Docs: https://openskynetwork.github.io/opensky-api/
 */

export interface OpenSkyState {
  icao24: string;          // Unique ICAO 24-bit address (hex)
  callsign: string | null; // Callsign (e.g., "SIA114")
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;  // Barometric altitude in meters
  onGround: boolean;
  velocity: number | null;      // Ground speed in m/s
  trueTrack: number | null;     // Direction in degrees (0 = North)
  verticalRate: number | null;
  geoAltitude: number | null;
}

export interface LiveFlightStatus {
  flightNumber: string;
  callsign: string;
  isInAir: boolean;
  hasLanded: boolean;
  position: {
    lat: number;
    lng: number;
    altitude: number; // meters
    heading: number;  // degrees
    speed: number;    // km/h
  } | null;
  lastUpdate: Date;
  estimatedArrival?: string; // Calculated ETA if possible
}

export interface OpenSkyResponse {
  success: boolean;
  data: LiveFlightStatus | null;
  error?: string;
}

// Convert flight number (SQ114) to callsign format (SIA114)
const AIRLINE_CALLSIGN_MAP: Record<string, string> = {
  'SQ': 'SIA',  // Singapore Airlines
  'MH': 'MAS',  // Malaysia Airlines
  'AK': 'AXM',  // AirAsia
  'TR': 'TGW',  // Scoot
  'CX': 'CPA',  // Cathay Pacific
  'QF': 'QFA',  // Qantas
  'EK': 'UAE',  // Emirates
  'BA': 'BAW',  // British Airways
  'QR': 'QTR',  // Qatar Airways
  'TG': 'THA',  // Thai Airways
  'GA': 'GIA',  // Garuda Indonesia
  'JL': 'JAL',  // Japan Airlines
  'NH': 'ANA',  // All Nippon Airways
  'KE': 'KAL',  // Korean Air
  'OZ': 'AAR',  // Asiana Airlines
  'CI': 'CAL',  // China Airlines
  'BR': 'EVA',  // EVA Air
  'PR': 'PAL',  // Philippine Airlines
  'VN': 'HVN',  // Vietnam Airlines
};

/**
 * Convert IATA flight number to ICAO callsign
 * e.g., "SQ114" -> "SIA114"
 */
export function flightNumberToCallsign(flightNumber: string): string {
  const cleaned = flightNumber.replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);

  if (match) {
    const [, airline, number] = match;
    const icaoCode = AIRLINE_CALLSIGN_MAP[airline] || airline;
    return `${icaoCode}${number}`;
  }

  return cleaned;
}

/**
 * Parse OpenSky state vector array into structured object
 */
function parseStateVector(state: (string | number | boolean | null)[]): OpenSkyState {
  return {
    icao24: state[0] as string,
    callsign: state[1] ? (state[1] as string).trim() : null,
    originCountry: state[2] as string,
    timePosition: state[3] as number | null,
    lastContact: state[4] as number,
    longitude: state[5] as number | null,
    latitude: state[6] as number | null,
    baroAltitude: state[7] as number | null,
    onGround: state[8] as boolean,
    velocity: state[9] as number | null,
    trueTrack: state[10] as number | null,
    verticalRate: state[11] as number | null,
    geoAltitude: state[13] as number | null,
  };
}

// Cache for all flights data (reuse within 30 seconds)
let cachedAllFlights: { data: (string | number | boolean | null)[][]; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get all flights from OpenSky (cached)
 * This is the key optimization - 1 API call for ALL flights
 */
async function getAllFlightsFromOpenSky(): Promise<{
  success: boolean;
  states: (string | number | boolean | null)[][];
  error?: string;
}> {
  // Check cache first
  if (cachedAllFlights && Date.now() - cachedAllFlights.timestamp < CACHE_TTL) {
    return { success: true, states: cachedAllFlights.data };
  }

  try {
    const response = await fetch('https://opensky-network.org/api/states/all', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, states: [], error: 'Rate limit exceeded' };
      }
      throw new Error(`OpenSky API error: ${response.status}`);
    }

    const data = await response.json();
    const states = data.states || [];

    // Update cache
    cachedAllFlights = { data: states, timestamp: Date.now() };

    return { success: true, states };
  } catch (error) {
    console.error('OpenSky API error:', error);
    return {
      success: false,
      states: [],
      error: error instanceof Error ? error.message : 'Failed to fetch flights',
    };
  }
}

/**
 * Get live flight status from OpenSky Network
 * Uses cached data - multiple calls in 30 seconds = 1 API call
 */
export async function getLiveFlightStatus(flightNumber: string): Promise<OpenSkyResponse> {
  const callsign = flightNumberToCallsign(flightNumber);

  const { success, states, error } = await getAllFlightsFromOpenSky();

  if (!success) {
    return { success: false, data: null, error };
  }

  if (states.length === 0) {
    return { success: false, data: null, error: 'No flights currently tracked' };
  }

  // Find flight by callsign
  const flightState = states.find((state) => {
    const stateCallsign = state[1] ? (state[1] as string).trim().toUpperCase() : '';
    return stateCallsign === callsign || stateCallsign.startsWith(callsign);
  });

  if (!flightState) {
    return {
      success: false,
      data: null,
      error: `Flight ${flightNumber} (${callsign}) not currently in the air`,
    };
  }

  const parsed = parseStateVector(flightState);

  const liveStatus: LiveFlightStatus = {
    flightNumber,
    callsign: parsed.callsign || callsign,
    isInAir: !parsed.onGround && parsed.latitude !== null,
    hasLanded: parsed.onGround && parsed.latitude !== null,
    position: parsed.latitude && parsed.longitude ? {
      lat: parsed.latitude,
      lng: parsed.longitude,
      altitude: parsed.baroAltitude || parsed.geoAltitude || 0,
      heading: parsed.trueTrack || 0,
      speed: parsed.velocity ? parsed.velocity * 3.6 : 0, // m/s to km/h
    } : null,
    lastUpdate: new Date(parsed.lastContact * 1000),
  };

  return { success: true, data: liveStatus };
}

/**
 * Get MULTIPLE flight statuses in ONE API call
 * This is the batch query - uses cached data
 */
export async function getBatchFlightStatus(
  flightNumbers: string[]
): Promise<Map<string, LiveFlightStatus | null>> {
  const results = new Map<string, LiveFlightStatus | null>();

  // Convert all flight numbers to callsigns
  const callsignMap = new Map<string, string>();
  flightNumbers.forEach((fn) => {
    callsignMap.set(flightNumberToCallsign(fn), fn);
  });

  // Single API call for all flights
  const { success, states } = await getAllFlightsFromOpenSky();

  if (!success || states.length === 0) {
    // Return null for all flights
    flightNumbers.forEach((fn) => results.set(fn, null));
    return results;
  }

  // Find all matching flights
  states.forEach((state) => {
    const stateCallsign = state[1] ? (state[1] as string).trim().toUpperCase() : '';

    // Check if this callsign matches any of our flights
    for (const [callsign, flightNumber] of callsignMap) {
      if (stateCallsign === callsign || stateCallsign.startsWith(callsign)) {
        const parsed = parseStateVector(state);
        results.set(flightNumber, {
          flightNumber,
          callsign: parsed.callsign || callsign,
          isInAir: !parsed.onGround && parsed.latitude !== null,
          hasLanded: parsed.onGround && parsed.latitude !== null,
          position: parsed.latitude && parsed.longitude ? {
            lat: parsed.latitude,
            lng: parsed.longitude,
            altitude: parsed.baroAltitude || parsed.geoAltitude || 0,
            heading: parsed.trueTrack || 0,
            speed: parsed.velocity ? parsed.velocity * 3.6 : 0,
          } : null,
          lastUpdate: new Date(parsed.lastContact * 1000),
        });
        break;
      }
    }
  });

  // Set null for flights not found
  flightNumbers.forEach((fn) => {
    if (!results.has(fn)) {
      results.set(fn, null);
    }
  });

  return results;
}

/**
 * Get all flights near an airport (by bounding box)
 * Useful for tracking arrivals/departures
 */
export async function getFlightsNearAirport(
  airportCode: string
): Promise<{ success: boolean; flights: LiveFlightStatus[]; error?: string }> {
  // Airport bounding boxes (approximate)
  const AIRPORT_BOUNDS: Record<string, { lamin: number; lomin: number; lamax: number; lomax: number }> = {
    'KUL': { lamin: 2.5, lomin: 101.4, lamax: 3.0, lomax: 101.9 }, // Kuala Lumpur
    'SIN': { lamin: 1.2, lomin: 103.8, lamax: 1.5, lomax: 104.1 }, // Singapore
    'HKG': { lamin: 22.2, lomin: 113.8, lamax: 22.4, lomax: 114.0 }, // Hong Kong
    'BKK': { lamin: 13.6, lomin: 100.6, lamax: 13.8, lomax: 100.8 }, // Bangkok
  };

  const bounds = AIRPORT_BOUNDS[airportCode.toUpperCase()];
  if (!bounds) {
    return {
      success: false,
      flights: [],
      error: `Unknown airport: ${airportCode}`,
    };
  }

  try {
    const url = `https://opensky-network.org/api/states/all?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`OpenSky API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.states || data.states.length === 0) {
      return { success: true, flights: [] };
    }

    const flights: LiveFlightStatus[] = data.states.map((state: (string | number | boolean | null)[]) => {
      const parsed = parseStateVector(state);
      return {
        flightNumber: parsed.callsign || 'Unknown',
        callsign: parsed.callsign || '',
        isInAir: !parsed.onGround,
        hasLanded: parsed.onGround,
        position: parsed.latitude && parsed.longitude ? {
          lat: parsed.latitude,
          lng: parsed.longitude,
          altitude: parsed.baroAltitude || 0,
          heading: parsed.trueTrack || 0,
          speed: parsed.velocity ? parsed.velocity * 3.6 : 0,
        } : null,
        lastUpdate: new Date(parsed.lastContact * 1000),
      };
    });

    return { success: true, flights };
  } catch (error) {
    console.error('OpenSky API error:', error);
    return {
      success: false,
      flights: [],
      error: error instanceof Error ? error.message : 'Failed to fetch flights',
    };
  }
}
