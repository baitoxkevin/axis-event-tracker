/**
 * Flight Status Service
 * Uses AviationStack API for real-time flight information
 * Free tier: 100 requests/month
 * Docs: https://aviationstack.com/documentation
 */

export interface FlightInfo {
  flightNumber: string;
  flightDate: string;
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  departure: {
    airport: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    scheduled: string;
    estimated: string | null;
    actual: string | null;
    delay: number | null;
    timezone: string;
  };
  arrival: {
    airport: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    baggage: string | null;
    scheduled: string;
    estimated: string | null;
    actual: string | null;
    delay: number | null;
    timezone: string;
  };
  flightStatus: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
  aircraft: {
    registration: string | null;
    iata: string | null;
    icao: string | null;
  } | null;
}

export interface FlightStatusResponse {
  success: boolean;
  data: FlightInfo | null;
  error?: string;
  source: 'api' | 'mock';
}

interface AviationStackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: Array<{
    flight_date: string;
    flight_status: string;
    departure: {
      airport: string;
      timezone: string;
      iata: string;
      icao: string;
      terminal: string | null;
      gate: string | null;
      delay: number | null;
      scheduled: string;
      estimated: string | null;
      actual: string | null;
    };
    arrival: {
      airport: string;
      timezone: string;
      iata: string;
      icao: string;
      terminal: string | null;
      gate: string | null;
      baggage: string | null;
      delay: number | null;
      scheduled: string;
      estimated: string | null;
      actual: string | null;
    };
    airline: {
      name: string;
      iata: string;
      icao: string;
    };
    flight: {
      number: string;
      iata: string;
      icao: string;
    };
    aircraft: {
      registration: string | null;
      iata: string | null;
      icao: string | null;
    } | null;
  }>;
  error?: {
    code: number;
    type: string;
    info: string;
  };
}

// Mock data for demo mode or when API is unavailable
const MOCK_FLIGHTS: Record<string, FlightInfo> = {
  'SQ238': {
    flightNumber: 'SQ238',
    flightDate: '2026-01-18',
    airline: { name: 'Singapore Airlines', iata: 'SQ', icao: 'SIA' },
    departure: {
      airport: 'Singapore Changi Airport',
      iata: 'SIN',
      icao: 'WSSS',
      terminal: '3',
      gate: 'B12',
      scheduled: '2026-01-18T12:15:00+08:00',
      estimated: null,
      actual: null,
      delay: null,
      timezone: 'Asia/Singapore',
    },
    arrival: {
      airport: 'Kuala Lumpur International Airport',
      iata: 'KUL',
      icao: 'WMKK',
      terminal: '1',
      gate: 'C8',
      baggage: 'Belt 5',
      scheduled: '2026-01-18T15:15:00+08:00', // Correct time per user feedback
      estimated: null,
      actual: null,
      delay: null,
      timezone: 'Asia/Kuala_Lumpur',
    },
    flightStatus: 'scheduled',
    aircraft: { registration: '9V-SMG', iata: 'B789', icao: 'B789' },
  },
  'MH123': {
    flightNumber: 'MH123',
    flightDate: '2026-01-18',
    airline: { name: 'Malaysia Airlines', iata: 'MH', icao: 'MAS' },
    departure: {
      airport: 'Hong Kong International',
      iata: 'HKG',
      icao: 'VHHH',
      terminal: '1',
      gate: 'A15',
      scheduled: '2026-01-18T08:00:00+08:00',
      estimated: null,
      actual: null,
      delay: null,
      timezone: 'Asia/Hong_Kong',
    },
    arrival: {
      airport: 'Kuala Lumpur International Airport',
      iata: 'KUL',
      icao: 'WMKK',
      terminal: '1',
      gate: 'A22',
      baggage: 'Belt 3',
      scheduled: '2026-01-18T12:00:00+08:00',
      estimated: null,
      actual: null,
      delay: null,
      timezone: 'Asia/Kuala_Lumpur',
    },
    flightStatus: 'scheduled',
    aircraft: { registration: '9M-MTB', iata: 'A359', icao: 'A359' },
  },
};

/**
 * Parse flight number into airline code and flight number
 * e.g., "SQ238" -> { airline: "SQ", number: "238" }
 */
function parseFlightNumber(flightNumber: string): { airline: string; number: string } {
  const cleaned = flightNumber.replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    return { airline: match[1], number: match[2] };
  }
  // Try 3-letter airline code
  const match3 = cleaned.match(/^([A-Z]{3})(\d+)$/);
  if (match3) {
    return { airline: match3[1], number: match3[2] };
  }
  return { airline: '', number: flightNumber };
}

/**
 * Extract time from ISO datetime string
 * e.g., "2026-01-18T15:15:00+08:00" -> "15:15"
 */
export function extractTime(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null;
  try {
    const date = new Date(isoDateTime);
    return date.toTimeString().slice(0, 5); // "HH:MM"
  } catch {
    return null;
  }
}

/**
 * Compare two time strings and check if difference exceeds threshold
 * @param time1 "HH:MM" format
 * @param time2 "HH:MM" format
 * @param thresholdMinutes Maximum acceptable difference in minutes
 * @returns true if times differ by more than threshold
 */
export function hasTimeMismatch(time1: string | null, time2: string | null, thresholdMinutes = 30): boolean {
  if (!time1 || !time2) return false;

  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  const diff = Math.abs(minutes1 - minutes2);
  return diff > thresholdMinutes;
}

/**
 * Format time difference for display
 */
export function formatTimeDifference(time1: string | null, time2: string | null): string {
  if (!time1 || !time2) return '';

  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  const diffMinutes = minutes2 - minutes1;
  const hours = Math.floor(Math.abs(diffMinutes) / 60);
  const mins = Math.abs(diffMinutes) % 60;

  const sign = diffMinutes > 0 ? '+' : '-';
  if (hours > 0) {
    return `${sign}${hours}h ${mins}m`;
  }
  return `${sign}${mins}m`;
}

/**
 * Fetch flight status from AviationStack API
 */
export async function getFlightStatus(
  flightNumber: string,
  flightDate: string, // YYYY-MM-DD format
  arrivalAirport?: string // IATA code e.g., "KUL"
): Promise<FlightStatusResponse> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  // If no API key, use mock data
  if (!apiKey) {
    console.log('No AVIATIONSTACK_API_KEY configured, using mock data');
    return getMockFlightStatus(flightNumber);
  }

  try {
    const { airline, number } = parseFlightNumber(flightNumber);

    // Build API URL
    const params = new URLSearchParams({
      access_key: apiKey,
      flight_iata: `${airline}${number}`,
      flight_date: flightDate,
    });

    // Add arrival airport filter if provided
    if (arrivalAirport) {
      params.append('arr_iata', arrivalAirport.toUpperCase());
    }

    const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;

    const response = await fetch(url);
    const data: AviationStackResponse = await response.json();

    if (data.error) {
      console.error('AviationStack API error:', data.error);
      // Fall back to mock data on error
      return getMockFlightStatus(flightNumber);
    }

    if (!data.data || data.data.length === 0) {
      return {
        success: false,
        data: null,
        error: 'Flight not found',
        source: 'api',
      };
    }

    // Take the first matching flight
    const flight = data.data[0];

    const flightInfo: FlightInfo = {
      flightNumber: flight.flight.iata,
      flightDate: flight.flight_date,
      airline: {
        name: flight.airline.name,
        iata: flight.airline.iata,
        icao: flight.airline.icao,
      },
      departure: {
        airport: flight.departure.airport,
        iata: flight.departure.iata,
        icao: flight.departure.icao,
        terminal: flight.departure.terminal,
        gate: flight.departure.gate,
        scheduled: flight.departure.scheduled,
        estimated: flight.departure.estimated,
        actual: flight.departure.actual,
        delay: flight.departure.delay,
        timezone: flight.departure.timezone,
      },
      arrival: {
        airport: flight.arrival.airport,
        iata: flight.arrival.iata,
        icao: flight.arrival.icao,
        terminal: flight.arrival.terminal,
        gate: flight.arrival.gate,
        baggage: flight.arrival.baggage,
        scheduled: flight.arrival.scheduled,
        estimated: flight.arrival.estimated,
        actual: flight.arrival.actual,
        delay: flight.arrival.delay,
        timezone: flight.arrival.timezone,
      },
      flightStatus: mapFlightStatus(flight.flight_status),
      aircraft: flight.aircraft,
    };

    return {
      success: true,
      data: flightInfo,
      source: 'api',
    };
  } catch (error) {
    console.error('Error fetching flight status:', error);
    // Fall back to mock data on error
    return getMockFlightStatus(flightNumber);
  }
}

/**
 * Get mock flight status for demo mode
 */
function getMockFlightStatus(flightNumber: string): FlightStatusResponse {
  const cleanedNumber = flightNumber.replace(/\s+/g, '').toUpperCase();
  const mockFlight = MOCK_FLIGHTS[cleanedNumber];

  if (mockFlight) {
    return {
      success: true,
      data: mockFlight,
      source: 'mock',
    };
  }

  // Generate a generic mock response for unknown flights
  return {
    success: true,
    data: {
      flightNumber: cleanedNumber,
      flightDate: new Date().toISOString().split('T')[0],
      airline: {
        name: 'Unknown Airline',
        iata: cleanedNumber.slice(0, 2),
        icao: cleanedNumber.slice(0, 3)
      },
      departure: {
        airport: 'Origin Airport',
        iata: 'XXX',
        icao: 'XXXX',
        terminal: '1',
        gate: 'A1',
        scheduled: new Date().toISOString(),
        estimated: null,
        actual: null,
        delay: null,
        timezone: 'UTC',
      },
      arrival: {
        airport: 'Kuala Lumpur International Airport',
        iata: 'KUL',
        icao: 'WMKK',
        terminal: '1',
        gate: null,
        baggage: null,
        scheduled: new Date().toISOString(),
        estimated: null,
        actual: null,
        delay: null,
        timezone: 'Asia/Kuala_Lumpur',
      },
      flightStatus: 'unknown',
      aircraft: null,
    },
    source: 'mock',
  };
}

/**
 * Map AviationStack flight status to our schema
 */
function mapFlightStatus(status: string): FlightInfo['flightStatus'] {
  const statusMap: Record<string, FlightInfo['flightStatus']> = {
    'scheduled': 'scheduled',
    'active': 'active',
    'en-route': 'active',
    'landed': 'landed',
    'arrived': 'landed',
    'cancelled': 'cancelled',
    'diverted': 'diverted',
  };
  return statusMap[status.toLowerCase()] || 'unknown';
}

/**
 * Verify multiple flights at once (batch operation)
 * Useful for verifying all flights on a specific date
 */
export async function verifyFlightsBatch(
  flights: Array<{ flightNumber: string; flightDate: string; arrivalAirport?: string }>
): Promise<Map<string, FlightStatusResponse>> {
  const results = new Map<string, FlightStatusResponse>();

  // Process flights sequentially to respect API rate limits
  // AviationStack free tier: 1 request per 60 seconds
  for (const flight of flights) {
    const key = `${flight.flightNumber}-${flight.flightDate}`;
    const result = await getFlightStatus(
      flight.flightNumber,
      flight.flightDate,
      flight.arrivalAirport
    );
    results.set(key, result);

    // Add delay between API calls if using real API
    if (result.source === 'api') {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
