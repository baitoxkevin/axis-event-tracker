/**
 * Smart Flight Polling Scheduler
 *
 * Polling frequency based on proximity to event:
 * - More than 7 days before: 2x per day (verify schedules)
 * - 7 days to 1 day before: 5x per day (watch for changes)
 * - Event day: Continuous via OpenSky (real-time tracking)
 *
 * API Priority:
 * 1. Amadeus (2,000 calls/month) - for schedule verification
 * 2. AviationStack (100 calls/month) - fallback
 * 3. OpenSky (4,000 calls/day) - for live tracking
 */

import { getFlightStatus, type FlightInfo } from './flight-status';
import { getAmadeusFlightStatus, isAmadeusConfigured, extractTimeFromAmadeus } from './amadeus';
import { getLiveFlightStatus, type LiveFlightStatus } from './opensky';

export interface FlightToTrack {
  flightNumber: string;
  flightDate: string;  // YYYY-MM-DD
  direction: 'arrival' | 'departure';
  expectedTime: string; // HH:MM
}

export interface PollingSchedule {
  frequency: 'twice_daily' | 'five_daily' | 'realtime';
  nextCheckAt: Date;
  checksRemaining: number;
  reason: string;
}

export interface FlightVerificationResult {
  flightNumber: string;
  flightDate: string;
  status: 'verified' | 'changed' | 'not_found' | 'error';
  scheduledInfo?: FlightInfo;
  liveStatus?: LiveFlightStatus;
  timeMismatch?: boolean;
  lastCheckedAt: Date;
}

/**
 * Calculate days until flight date
 */
function daysUntilFlight(flightDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const flight = new Date(flightDate);
  flight.setHours(0, 0, 0, 0);
  return Math.ceil((flight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determine polling schedule based on event proximity
 */
export function getPollingSchedule(flightDate: string): PollingSchedule {
  const daysAway = daysUntilFlight(flightDate);
  const now = new Date();

  if (daysAway <= 0) {
    // Event day - use OpenSky real-time tracking
    return {
      frequency: 'realtime',
      nextCheckAt: new Date(now.getTime() + 5 * 60 * 1000), // Every 5 minutes
      checksRemaining: -1, // Unlimited
      reason: 'Event day - real-time tracking via OpenSky',
    };
  } else if (daysAway <= 7) {
    // 1-7 days before - check 5x per day
    const checksPerDay = 5;
    const intervalHours = 24 / checksPerDay; // ~4.8 hours
    return {
      frequency: 'five_daily',
      nextCheckAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
      checksRemaining: daysAway * checksPerDay,
      reason: `${daysAway} days until flight - checking ${checksPerDay}x daily`,
    };
  } else {
    // More than 7 days - check 2x per day
    const checksPerDay = 2;
    const intervalHours = 12;
    return {
      frequency: 'twice_daily',
      nextCheckAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
      checksRemaining: daysAway * checksPerDay,
      reason: `${daysAway} days until flight - checking ${checksPerDay}x daily`,
    };
  }
}

/**
 * Get unique flight numbers from guest list
 * This reduces API calls by checking each flight only once
 */
export function getUniqueFlights(
  guests: Array<{
    arrivalFlightNumber?: string | null;
    arrivalDate?: string | null;
    arrivalTime?: string | null;
    departureFlightNumber?: string | null;
    departureDate?: string | null;
    departureTime?: string | null;
  }>
): FlightToTrack[] {
  const flightMap = new Map<string, FlightToTrack>();

  guests.forEach((guest) => {
    // Arrival flights
    if (guest.arrivalFlightNumber && guest.arrivalDate) {
      const key = `${guest.arrivalFlightNumber}-${guest.arrivalDate}-arrival`;
      if (!flightMap.has(key)) {
        flightMap.set(key, {
          flightNumber: guest.arrivalFlightNumber,
          flightDate: guest.arrivalDate,
          direction: 'arrival',
          expectedTime: guest.arrivalTime || '',
        });
      }
    }

    // Departure flights
    if (guest.departureFlightNumber && guest.departureDate) {
      const key = `${guest.departureFlightNumber}-${guest.departureDate}-departure`;
      if (!flightMap.has(key)) {
        flightMap.set(key, {
          flightNumber: guest.departureFlightNumber,
          flightDate: guest.departureDate,
          direction: 'departure',
          expectedTime: guest.departureTime || '',
        });
      }
    }
  });

  return Array.from(flightMap.values());
}

/**
 * Verify a single flight using appropriate API based on timing
 * Priority: Amadeus -> AviationStack -> Mock
 */
export async function verifyFlight(flight: FlightToTrack): Promise<FlightVerificationResult> {
  const schedule = getPollingSchedule(flight.flightDate);

  if (schedule.frequency === 'realtime') {
    // Event day - use OpenSky for live tracking
    const liveResult = await getLiveFlightStatus(flight.flightNumber);

    return {
      flightNumber: flight.flightNumber,
      flightDate: flight.flightDate,
      status: liveResult.success ? 'verified' : 'not_found',
      liveStatus: liveResult.data || undefined,
      lastCheckedAt: new Date(),
    };
  } else {
    // Pre-event - try Amadeus first (2000 calls/month), then AviationStack (100 calls/month)
    let scheduledTime: string | null = null;
    let apiSource: 'amadeus' | 'aviationstack' | 'mock' = 'mock';

    if (isAmadeusConfigured()) {
      // Try Amadeus first
      const amadeusResult = await getAmadeusFlightStatus(flight.flightNumber, flight.flightDate);

      if (amadeusResult.success && amadeusResult.data) {
        scheduledTime = extractTimeFromAmadeus(amadeusResult.data.arrival.scheduledTime);
        apiSource = amadeusResult.source === 'amadeus' ? 'amadeus' : 'mock';

        // Convert Amadeus response to FlightInfo format for compatibility
        const flightInfo: FlightInfo = {
          flightNumber: amadeusResult.data.flightNumber,
          flightDate: amadeusResult.data.flightDate,
          airline: {
            name: amadeusResult.data.carrierCode,
            iata: amadeusResult.data.carrierCode,
            icao: amadeusResult.data.carrierCode,
          },
          departure: {
            airport: amadeusResult.data.departure.airport,
            iata: amadeusResult.data.departure.iataCode,
            icao: amadeusResult.data.departure.iataCode,
            terminal: amadeusResult.data.departure.terminal || null,
            gate: amadeusResult.data.departure.gate || null,
            scheduled: amadeusResult.data.departure.scheduledTime,
            estimated: amadeusResult.data.departure.estimatedTime || null,
            actual: amadeusResult.data.departure.actualTime || null,
            delay: null,
            timezone: 'UTC',
          },
          arrival: {
            airport: amadeusResult.data.arrival.airport,
            iata: amadeusResult.data.arrival.iataCode,
            icao: amadeusResult.data.arrival.iataCode,
            terminal: amadeusResult.data.arrival.terminal || null,
            gate: amadeusResult.data.arrival.gate || null,
            baggage: null,
            scheduled: amadeusResult.data.arrival.scheduledTime,
            estimated: amadeusResult.data.arrival.estimatedTime || null,
            actual: amadeusResult.data.arrival.actualTime || null,
            delay: null,
            timezone: 'UTC',
          },
          flightStatus: amadeusResult.data.status,
          aircraft: null,
        };

        const timeMismatch = scheduledTime && flight.expectedTime
          ? Math.abs(
              parseInt(scheduledTime.replace(':', '')) -
              parseInt(flight.expectedTime.replace(':', ''))
            ) > 30
          : false;

        return {
          flightNumber: flight.flightNumber,
          flightDate: flight.flightDate,
          status: timeMismatch ? 'changed' : 'verified',
          scheduledInfo: flightInfo,
          timeMismatch,
          lastCheckedAt: new Date(),
        };
      }
    }

    // Fallback to AviationStack
    const scheduleResult = await getFlightStatus(
      flight.flightNumber,
      flight.flightDate,
      'KUL'
    );

    if (!scheduleResult.success || !scheduleResult.data) {
      return {
        flightNumber: flight.flightNumber,
        flightDate: flight.flightDate,
        status: 'not_found',
        lastCheckedAt: new Date(),
      };
    }

    scheduledTime = scheduleResult.data.arrival.scheduled
      ? new Date(scheduleResult.data.arrival.scheduled).toTimeString().slice(0, 5)
      : null;

    const timeMismatch = scheduledTime && flight.expectedTime
      ? Math.abs(
          parseInt(scheduledTime.replace(':', '')) -
          parseInt(flight.expectedTime.replace(':', ''))
        ) > 30
      : false;

    return {
      flightNumber: flight.flightNumber,
      flightDate: flight.flightDate,
      status: timeMismatch ? 'changed' : 'verified',
      scheduledInfo: scheduleResult.data,
      timeMismatch,
      lastCheckedAt: new Date(),
    };
  }
}

/**
 * Batch verify all unique flights
 * Respects API rate limits
 */
export async function verifyAllFlights(
  flights: FlightToTrack[]
): Promise<Map<string, FlightVerificationResult>> {
  const results = new Map<string, FlightVerificationResult>();

  // Group by schedule type to batch efficiently
  const realtimeFlights: FlightToTrack[] = [];
  const scheduledFlights: FlightToTrack[] = [];

  flights.forEach((flight) => {
    const schedule = getPollingSchedule(flight.flightDate);
    if (schedule.frequency === 'realtime') {
      realtimeFlights.push(flight);
    } else {
      scheduledFlights.push(flight);
    }
  });

  // Process scheduled flights first (they use AviationStack with rate limits)
  for (const flight of scheduledFlights) {
    const key = `${flight.flightNumber}-${flight.flightDate}`;
    const result = await verifyFlight(flight);
    results.set(key, result);

    // Rate limit: 1 second between AviationStack calls
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Process realtime flights (OpenSky is more generous)
  for (const flight of realtimeFlights) {
    const key = `${flight.flightNumber}-${flight.flightDate}`;
    const result = await verifyFlight(flight);
    results.set(key, result);

    // Rate limit: 100ms between OpenSky calls
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Calculate API usage estimate
 */
export function estimateApiUsage(flights: FlightToTrack[]): {
  aviationStackCalls: number;
  openSkyCalls: number;
  withinFreeTier: boolean;
} {
  let aviationStackCalls = 0;
  let openSkyCalls = 0;

  flights.forEach((flight) => {
    const schedule = getPollingSchedule(flight.flightDate);
    const daysAway = daysUntilFlight(flight.flightDate);

    if (schedule.frequency === 'realtime') {
      // Event day: ~12 checks per hour * 12 hours = 144 calls per flight
      openSkyCalls += 144;
    } else if (schedule.frequency === 'five_daily') {
      // 1-7 days: 5 calls per day
      aviationStackCalls += Math.min(daysAway, 7) * 5;
    } else {
      // 7+ days: 2 calls per day
      aviationStackCalls += Math.min(daysAway - 7, 30) * 2;
    }
  });

  return {
    aviationStackCalls,
    openSkyCalls,
    withinFreeTier: aviationStackCalls <= 100, // AviationStack free tier
  };
}
