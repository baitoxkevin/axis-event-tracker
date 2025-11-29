/**
 * Amadeus Flight Status Service
 * Uses Amadeus On-Demand Flight Status API
 * Free tier: 2,000 requests/month
 * Docs: https://developers.amadeus.com/self-service/category/flights/api-doc/on-demand-flight-status
 */

export interface AmadeusFlightInfo {
  flightNumber: string;
  carrierCode: string;
  flightDate: string;
  departure: {
    airport: string;
    iataCode: string;
    terminal?: string;
    gate?: string;
    scheduledTime: string;
    estimatedTime?: string;
    actualTime?: string;
  };
  arrival: {
    airport: string;
    iataCode: string;
    terminal?: string;
    gate?: string;
    scheduledTime: string;
    estimatedTime?: string;
    actualTime?: string;
  };
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
  duration?: string;
}

export interface AmadeusResponse {
  success: boolean;
  data: AmadeusFlightInfo | null;
  error?: string;
  source: 'amadeus' | 'mock';
}

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Use Test environment by default (set AMADEUS_ENV=production for prod)
const AMADEUS_BASE_URL = process.env.AMADEUS_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com';

/**
 * Parse flight number into carrier code and number
 * e.g., "SQ114" -> { carrier: "SQ", number: "114" }
 */
function parseFlightNumber(flightNumber: string): { carrier: string; number: string } {
  const cleaned = flightNumber.replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    return { carrier: match[1], number: match[2] };
  }
  // Try 3-letter code
  const match3 = cleaned.match(/^([A-Z]{3})(\d+)$/);
  if (match3) {
    return { carrier: match3[1], number: match3[2] };
  }
  return { carrier: '', number: flightNumber };
}

/**
 * Get OAuth2 access token from Amadeus
 * Tokens are cached and reused until expiry
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('Amadeus credentials not configured');
    return null;
  }

  // Check if we have a valid cached token
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  try {
    const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Amadeus auth error:', error);
      return null;
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Token expires in seconds, convert to milliseconds and add to current time
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    return accessToken;
  } catch (error) {
    console.error('Amadeus token error:', error);
    return null;
  }
}

/**
 * Map Amadeus status to our standard status
 */
function mapStatus(segments: Array<{ status?: string }>): AmadeusFlightInfo['status'] {
  if (!segments || segments.length === 0) return 'unknown';

  const status = segments[0].status?.toLowerCase() || '';

  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('divert')) return 'diverted';
  if (status.includes('land') || status.includes('arrived')) return 'landed';
  if (status.includes('active') || status.includes('airborne') || status.includes('departed')) return 'active';
  if (status.includes('scheduled') || status.includes('confirmed')) return 'scheduled';

  return 'unknown';
}

/**
 * Get flight status from Amadeus API
 */
export async function getAmadeusFlightStatus(
  flightNumber: string,
  flightDate: string // YYYY-MM-DD format
): Promise<AmadeusResponse> {
  const { carrier, number } = parseFlightNumber(flightNumber);

  if (!carrier) {
    return {
      success: false,
      data: null,
      error: 'Invalid flight number format',
      source: 'amadeus',
    };
  }

  const token = await getAccessToken();

  if (!token) {
    // Fall back to mock data if no credentials
    return getMockFlightStatus(flightNumber, flightDate);
  }

  try {
    const url = new URL(`${AMADEUS_BASE_URL}/v2/schedule/flights`);
    url.searchParams.set('carrierCode', carrier);
    url.searchParams.set('flightNumber', number);
    url.searchParams.set('scheduledDepartureDate', flightDate);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear cache and retry once
        accessToken = null;
        tokenExpiry = 0;
        const newToken = await getAccessToken();
        if (newToken) {
          return getAmadeusFlightStatus(flightNumber, flightDate);
        }
      }

      const error = await response.json().catch(() => ({}));
      console.error('Amadeus API error:', response.status, error);

      if (response.status === 404) {
        return {
          success: false,
          data: null,
          error: 'Flight not found',
          source: 'amadeus',
        };
      }

      // Fall back to mock on error
      return getMockFlightStatus(flightNumber, flightDate);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return {
        success: false,
        data: null,
        error: 'Flight not found',
        source: 'amadeus',
      };
    }

    // Parse the first flight result
    const flight = data.data[0];
    const flightPoints = flight.flightPoints || [];
    const segments = flight.segments || [];

    // Find departure and arrival points
    const departurePoint = flightPoints.find((p: { departure?: unknown }) => p.departure);
    const arrivalPoint = flightPoints.find((p: { arrival?: unknown }) => p.arrival);

    if (!departurePoint || !arrivalPoint) {
      return {
        success: false,
        data: null,
        error: 'Incomplete flight data',
        source: 'amadeus',
      };
    }

    const flightInfo: AmadeusFlightInfo = {
      flightNumber: `${carrier}${number}`,
      carrierCode: carrier,
      flightDate,
      departure: {
        airport: departurePoint.iataCode,
        iataCode: departurePoint.iataCode,
        terminal: departurePoint.departure?.terminal,
        gate: departurePoint.departure?.gate?.mainGate,
        scheduledTime: departurePoint.departure?.timings?.find((t: { qualifier: string }) => t.qualifier === 'STD')?.value || '',
        estimatedTime: departurePoint.departure?.timings?.find((t: { qualifier: string }) => t.qualifier === 'ETD')?.value,
        actualTime: departurePoint.departure?.timings?.find((t: { qualifier: string }) => t.qualifier === 'ATD')?.value,
      },
      arrival: {
        airport: arrivalPoint.iataCode,
        iataCode: arrivalPoint.iataCode,
        terminal: arrivalPoint.arrival?.terminal,
        gate: arrivalPoint.arrival?.gate?.mainGate,
        scheduledTime: arrivalPoint.arrival?.timings?.find((t: { qualifier: string }) => t.qualifier === 'STA')?.value || '',
        estimatedTime: arrivalPoint.arrival?.timings?.find((t: { qualifier: string }) => t.qualifier === 'ETA')?.value,
        actualTime: arrivalPoint.arrival?.timings?.find((t: { qualifier: string }) => t.qualifier === 'ATA')?.value,
      },
      status: mapStatus(segments),
      duration: segments[0]?.scheduledSegmentDuration,
    };

    return {
      success: true,
      data: flightInfo,
      source: 'amadeus',
    };
  } catch (error) {
    console.error('Amadeus fetch error:', error);
    return getMockFlightStatus(flightNumber, flightDate);
  }
}

/**
 * Mock flight data for demo/fallback
 */
const MOCK_FLIGHTS: Record<string, Omit<AmadeusFlightInfo, 'flightDate'>> = {
  'SQ238': {
    flightNumber: 'SQ238',
    carrierCode: 'SQ',
    departure: {
      airport: 'Singapore Changi Airport',
      iataCode: 'SIN',
      terminal: '3',
      gate: 'B12',
      scheduledTime: '12:15',
    },
    arrival: {
      airport: 'Kuala Lumpur International Airport',
      iataCode: 'KUL',
      terminal: '1',
      gate: 'C8',
      scheduledTime: '15:15',
    },
    status: 'scheduled',
    duration: 'PT1H0M',
  },
  'SQ114': {
    flightNumber: 'SQ114',
    carrierCode: 'SQ',
    departure: {
      airport: 'Singapore Changi Airport',
      iataCode: 'SIN',
      terminal: '2',
      gate: 'D5',
      scheduledTime: '12:40',
    },
    arrival: {
      airport: 'Kuala Lumpur International Airport',
      iataCode: 'KUL',
      terminal: '1',
      gate: 'A3',
      scheduledTime: '13:50',
    },
    status: 'scheduled',
    duration: 'PT1H10M',
  },
  'MH123': {
    flightNumber: 'MH123',
    carrierCode: 'MH',
    departure: {
      airport: 'Hong Kong International',
      iataCode: 'HKG',
      terminal: '1',
      gate: 'A15',
      scheduledTime: '08:00',
    },
    arrival: {
      airport: 'Kuala Lumpur International Airport',
      iataCode: 'KUL',
      terminal: '1',
      gate: 'A22',
      scheduledTime: '12:00',
    },
    status: 'scheduled',
    duration: 'PT4H0M',
  },
};

function getMockFlightStatus(flightNumber: string, flightDate: string): AmadeusResponse {
  const cleaned = flightNumber.replace(/\s+/g, '').toUpperCase();
  const mockFlight = MOCK_FLIGHTS[cleaned];

  if (mockFlight) {
    return {
      success: true,
      data: { ...mockFlight, flightDate },
      source: 'mock',
    };
  }

  // Generate generic mock for unknown flights
  const { carrier, number } = parseFlightNumber(flightNumber);
  return {
    success: true,
    data: {
      flightNumber: cleaned,
      carrierCode: carrier || 'XX',
      flightDate,
      departure: {
        airport: 'Origin Airport',
        iataCode: 'XXX',
        scheduledTime: '12:00',
      },
      arrival: {
        airport: 'Kuala Lumpur International Airport',
        iataCode: 'KUL',
        terminal: '1',
        scheduledTime: '16:00',
      },
      status: 'scheduled',
    },
    source: 'mock',
  };
}

/**
 * Extract time from Amadeus datetime string
 * Handles both "HH:MM" and ISO datetime formats
 */
export function extractTimeFromAmadeus(timeString: string | undefined): string | null {
  if (!timeString) return null;

  // If it's already HH:MM format
  if (/^\d{2}:\d{2}$/.test(timeString)) {
    return timeString;
  }

  // If it's ISO format
  try {
    const date = new Date(timeString);
    return date.toTimeString().slice(0, 5);
  } catch {
    return null;
  }
}

/**
 * Check if Amadeus is configured
 */
export function isAmadeusConfigured(): boolean {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}
