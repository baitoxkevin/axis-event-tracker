import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { guests } from '@/server/db/schema';
import { eq, and, or, isNotNull, isNull } from 'drizzle-orm';
import {
  getFlightStatus,
  extractTime,
  hasTimeMismatch,
  formatTimeDifference,
  type FlightInfo,
} from '@/server/services/flight-status';
import {
  getLiveFlightStatus,
  getBatchFlightStatus,
  getFlightsNearAirport,
} from '@/server/services/opensky';
import {
  getPollingSchedule,
  getUniqueFlights,
  verifyFlight,
  estimateApiUsage,
  type FlightToTrack,
} from '@/server/services/flight-scheduler';
import {
  getRecommendedVehicle,
  isMidnightSurchargeTime,
  areCodeshareFlights,
  getCodesharePartners,
  getTimeCorrection,
  formatTimeWithSurcharge,
  findTransportGroup,
  VEHICLE_TYPES,
  type TransportGroup,
  type VehicleType,
} from '@/lib/transport-rules';

export const flightsRouter = router({
  // Verify a single flight
  verifyFlight: protectedProcedure
    .input(
      z.object({
        flightNumber: z.string().min(1),
        flightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        arrivalAirport: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await getFlightStatus(
        input.flightNumber,
        input.flightDate,
        input.arrivalAirport
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Flight not found',
          source: result.source,
        };
      }

      return {
        success: true,
        flight: result.data,
        source: result.source,
      };
    }),

  // Verify flight for a specific guest and update their record
  verifyGuestFlight: protectedProcedure
    .input(
      z.object({
        guestId: z.string().uuid(),
        direction: z.enum(['arrival', 'departure']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Demo mode handling
      if (ctx.isDemoMode) {
        // Return mock verification result
        return {
          success: true,
          verified: true,
          source: 'mock' as const,
          flightInfo: {
            terminal: '1',
            gate: 'A5',
            scheduledTime: '15:15',
            actualTime: null,
            status: 'scheduled' as const,
            timeMismatch: false,
            timeDifference: null,
          },
        };
      }

      if (!ctx.db) {
        throw new Error('Database not available');
      }

      // Get the guest
      const guest = await ctx.db.query.guests.findFirst({
        where: eq(guests.id, input.guestId),
      });

      if (!guest) {
        throw new Error('Guest not found');
      }

      // Get flight details based on direction
      const flightNumber =
        input.direction === 'arrival'
          ? guest.arrivalFlightNumber
          : guest.departureFlightNumber;

      const flightDate =
        input.direction === 'arrival'
          ? guest.arrivalDate
          : guest.departureDate;

      const enteredTime =
        input.direction === 'arrival'
          ? guest.arrivalTime
          : guest.departureTime;

      if (!flightNumber || !flightDate) {
        throw new Error('Flight information not available for this guest');
      }

      // Call flight status API
      const result = await getFlightStatus(flightNumber, flightDate, 'KUL');

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Flight not found',
          source: result.source,
        };
      }

      const flight = result.data;

      // Extract relevant info based on direction
      const flightSide = input.direction === 'arrival' ? flight.arrival : flight.departure;
      const scheduledTime = extractTime(flightSide.scheduled);
      const actualTime = extractTime(flightSide.actual || flightSide.estimated);

      // Check for time mismatch
      const mismatch = hasTimeMismatch(enteredTime, scheduledTime);
      const timeDiff = mismatch ? formatTimeDifference(enteredTime, scheduledTime) : null;

      // Update guest record with verified info
      const updateData =
        input.direction === 'arrival'
          ? {
              arrivalTerminal: flightSide.terminal,
              arrivalGate: flightSide.gate,
              arrivalVerifiedTime: scheduledTime,
              arrivalFlightStatus: flight.flightStatus,
              arrivalVerifiedAt: new Date(),
              arrivalTimeMismatch: mismatch,
            }
          : {
              departureTerminal: flightSide.terminal,
              departureGate: flightSide.gate,
              departureVerifiedTime: scheduledTime,
              departureFlightStatus: flight.flightStatus,
              departureVerifiedAt: new Date(),
              departureTimeMismatch: mismatch,
            };

      await ctx.db
        .update(guests)
        .set(updateData)
        .where(eq(guests.id, input.guestId));

      return {
        success: true,
        verified: true,
        source: result.source,
        flightInfo: {
          terminal: flightSide.terminal,
          gate: flightSide.gate,
          scheduledTime,
          actualTime,
          status: flight.flightStatus,
          timeMismatch: mismatch,
          timeDifference: timeDiff,
          airlineName: flight.airline.name,
          departureAirport: flight.departure.airport,
          arrivalAirport: flight.arrival.airport,
        },
      };
    }),

  // Verify all flights for a specific date
  verifyFlightsByDate: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        direction: z.enum(['arrival', 'departure']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Demo mode handling
      if (ctx.isDemoMode) {
        return {
          success: true,
          totalFlights: 5,
          verified: 5,
          mismatches: [
            {
              guestName: 'Stuart Howie',
              flightNumber: 'SQ238',
              enteredTime: '18:10',
              actualTime: '15:15',
              difference: '-2h 55m',
              terminal: '1',
            },
          ],
          source: 'mock' as const,
        };
      }

      if (!ctx.db) {
        throw new Error('Database not available');
      }

      // Get all guests with flights on this date
      const guestsWithFlights = await ctx.db.query.guests.findMany({
        where: and(
          input.direction === 'arrival'
            ? eq(guests.arrivalDate, input.date)
            : eq(guests.departureDate, input.date),
          input.direction === 'arrival'
            ? isNotNull(guests.arrivalFlightNumber)
            : isNotNull(guests.departureFlightNumber),
          isNull(guests.deletedAt)
        ),
      });

      const results = {
        success: true,
        totalFlights: guestsWithFlights.length,
        verified: 0,
        errors: 0,
        mismatches: [] as Array<{
          guestId: string;
          guestName: string;
          flightNumber: string;
          enteredTime: string | null;
          actualTime: string | null;
          difference: string | null;
          terminal: string | null;
        }>,
        source: 'api' as const,
      };

      // Group by flight number to minimize API calls
      const flightGroups = new Map<string, typeof guestsWithFlights>();

      for (const guest of guestsWithFlights) {
        const flightNumber =
          input.direction === 'arrival'
            ? guest.arrivalFlightNumber
            : guest.departureFlightNumber;

        if (flightNumber) {
          if (!flightGroups.has(flightNumber)) {
            flightGroups.set(flightNumber, []);
          }
          flightGroups.get(flightNumber)!.push(guest);
        }
      }

      // Verify each unique flight
      for (const [flightNumber, flightGuests] of flightGroups) {
        const flightResult = await getFlightStatus(flightNumber, input.date, 'KUL');

        if (flightResult.success && flightResult.data) {
          const flight = flightResult.data;
          const flightSide =
            input.direction === 'arrival' ? flight.arrival : flight.departure;
          const scheduledTime = extractTime(flightSide.scheduled);

          // Update all guests with this flight
          for (const guest of flightGuests) {
            const enteredTime =
              input.direction === 'arrival'
                ? guest.arrivalTime
                : guest.departureTime;

            const mismatch = hasTimeMismatch(enteredTime, scheduledTime);
            const timeDiff = mismatch
              ? formatTimeDifference(enteredTime, scheduledTime)
              : null;

            // Update guest record
            const updateData =
              input.direction === 'arrival'
                ? {
                    arrivalTerminal: flightSide.terminal,
                    arrivalGate: flightSide.gate,
                    arrivalVerifiedTime: scheduledTime,
                    arrivalFlightStatus: flight.flightStatus,
                    arrivalVerifiedAt: new Date(),
                    arrivalTimeMismatch: mismatch,
                  }
                : {
                    departureTerminal: flightSide.terminal,
                    departureGate: flightSide.gate,
                    departureVerifiedTime: scheduledTime,
                    departureFlightStatus: flight.flightStatus,
                    departureVerifiedAt: new Date(),
                    departureTimeMismatch: mismatch,
                  };

            await ctx.db
              .update(guests)
              .set(updateData)
              .where(eq(guests.id, guest.id));

            results.verified++;

            if (mismatch) {
              results.mismatches.push({
                guestId: guest.id,
                guestName: `${guest.firstName} ${guest.lastName}`,
                flightNumber,
                enteredTime,
                actualTime: scheduledTime,
                difference: timeDiff,
                terminal: flightSide.terminal,
              });
            }
          }
        } else {
          results.errors += flightGuests.length;
        }

        // Rate limiting delay
        if (flightResult.source === 'api') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return results;
    }),

  // Get flights with time mismatches
  getMismatches: protectedProcedure
    .input(
      z.object({
        direction: z.enum(['arrival', 'departure', 'both']).default('both'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Demo mode handling
      if (ctx.isDemoMode) {
        return [
          {
            id: 'demo-1',
            firstName: 'Stuart',
            lastName: 'Howie',
            flightNumber: 'SQ238',
            flightDate: '2026-01-18',
            enteredTime: '18:10',
            verifiedTime: '15:15',
            terminal: '1',
            gate: 'C8',
            status: 'scheduled' as const,
            direction: 'arrival' as const,
          },
          {
            id: 'demo-2',
            firstName: 'Mark Stuart',
            lastName: 'Borg',
            flightNumber: 'SQ238',
            flightDate: '2026-01-18',
            enteredTime: '18:10',
            verifiedTime: '15:15',
            terminal: '1',
            gate: 'C8',
            status: 'scheduled' as const,
            direction: 'arrival' as const,
          },
        ];
      }

      // Use Supabase client if Drizzle is not available
      if (!ctx.db && ctx.supabase) {
        let query = ctx.supabase
          .from('guests')
          .select('*')
          .is('deleted_at', null);

        if (input.direction === 'both') {
          query = query.or('arrival_time_mismatch.eq.true,departure_time_mismatch.eq.true');
        } else if (input.direction === 'arrival') {
          query = query.eq('arrival_time_mismatch', true);
        } else {
          query = query.eq('departure_time_mismatch', true);
        }

        const { data: guestsData, error } = await query;

        if (error) throw new Error(error.message);

        const mismatches = [];
        for (const guest of guestsData || []) {
          if (
            (input.direction === 'arrival' || input.direction === 'both') &&
            guest.arrival_time_mismatch
          ) {
            mismatches.push({
              id: guest.id,
              firstName: guest.first_name,
              lastName: guest.last_name,
              flightNumber: guest.arrival_flight_number,
              flightDate: guest.arrival_date,
              enteredTime: guest.arrival_time,
              verifiedTime: guest.arrival_verified_time,
              terminal: guest.arrival_terminal,
              gate: guest.arrival_gate,
              status: guest.arrival_flight_status,
              direction: 'arrival' as const,
            });
          }

          if (
            (input.direction === 'departure' || input.direction === 'both') &&
            guest.departure_time_mismatch
          ) {
            mismatches.push({
              id: guest.id,
              firstName: guest.first_name,
              lastName: guest.last_name,
              flightNumber: guest.departure_flight_number,
              flightDate: guest.departure_date,
              enteredTime: guest.departure_time,
              verifiedTime: guest.departure_verified_time,
              terminal: guest.departure_terminal,
              gate: guest.departure_gate,
              status: guest.departure_flight_status,
              direction: 'departure' as const,
            });
          }
        }

        return mismatches;
      }

      if (!ctx.db) {
        throw new Error('Database not available');
      }

      // Build mismatch condition based on direction
      let mismatchCondition;
      if (input.direction === 'both') {
        mismatchCondition = or(
          eq(guests.arrivalTimeMismatch, true),
          eq(guests.departureTimeMismatch, true)
        );
      } else if (input.direction === 'arrival') {
        mismatchCondition = eq(guests.arrivalTimeMismatch, true);
      } else {
        mismatchCondition = eq(guests.departureTimeMismatch, true);
      }

      const guestsWithMismatches = await ctx.db.query.guests.findMany({
        where: and(isNull(guests.deletedAt), mismatchCondition),
      });

      const mismatches = [];

      for (const guest of guestsWithMismatches) {
        if (
          (input.direction === 'arrival' || input.direction === 'both') &&
          guest.arrivalTimeMismatch
        ) {
          mismatches.push({
            id: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
            flightNumber: guest.arrivalFlightNumber,
            flightDate: guest.arrivalDate,
            enteredTime: guest.arrivalTime,
            verifiedTime: guest.arrivalVerifiedTime,
            terminal: guest.arrivalTerminal,
            gate: guest.arrivalGate,
            status: guest.arrivalFlightStatus,
            direction: 'arrival' as const,
          });
        }

        if (
          (input.direction === 'departure' || input.direction === 'both') &&
          guest.departureTimeMismatch
        ) {
          mismatches.push({
            id: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
            flightNumber: guest.departureFlightNumber,
            flightDate: guest.departureDate,
            enteredTime: guest.departureTime,
            verifiedTime: guest.departureVerifiedTime,
            terminal: guest.departureTerminal,
            gate: guest.departureGate,
            status: guest.departureFlightStatus,
            direction: 'departure' as const,
          });
        }
      }

      return mismatches;
    }),

  // Get flight summary for a date (for transport planning)
  getFlightSummary: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        direction: z.enum(['arrival', 'departure']),
      })
    )
    .query(async ({ ctx, input }) => {
      // Demo mode handling
      if (ctx.isDemoMode) {
        return [
          {
            flightNumber: 'SQ238',
            scheduledTime: '15:15',
            verifiedTime: '15:15',
            terminal: '1',
            guestCount: 2,
            status: 'scheduled' as const,
            hasTimeMismatch: true,
            guests: [
              { id: 'demo-1', name: 'Stuart Howie', enteredTime: '18:10' },
              { id: 'demo-2', name: 'Mark Stuart Borg', enteredTime: '18:10' },
            ],
          },
          {
            flightNumber: 'MH123',
            scheduledTime: '12:00',
            verifiedTime: '12:00',
            terminal: '1',
            guestCount: 3,
            status: 'scheduled' as const,
            hasTimeMismatch: false,
            guests: [
              { id: 'demo-3', name: 'John Smith', enteredTime: '12:00' },
              { id: 'demo-4', name: 'Jane Doe', enteredTime: '12:00' },
              { id: 'demo-5', name: 'Bob Wilson', enteredTime: '12:00' },
            ],
          },
        ];
      }

      // Helper function to convert time to string (handles both string and Date objects)
      const timeToString = (time: unknown): string | null => {
        if (!time) return null;
        if (typeof time === 'string') return time;
        if (time instanceof Date) return time.toISOString().slice(11, 16);
        return String(time);
      };

      // Use Supabase client if Drizzle is not available
      if (!ctx.db && ctx.supabase) {
        const dateColumn = input.direction === 'arrival' ? 'arrival_date' : 'departure_date';

        const { data: guestsData, error } = await ctx.supabase
          .from('guests')
          .select('*')
          .eq(dateColumn, input.date)
          .is('deleted_at', null);

        if (error) throw new Error(error.message);

        // Group by flight number
        const flightMap = new Map<
          string,
          {
            flightNumber: string;
            scheduledTime: string | null;
            verifiedTime: string | null;
            terminal: string | null;
            status: string | null;
            hasTimeMismatch: boolean;
            guests: Array<{ id: string; name: string; enteredTime: string | null }>;
            // Transport info
            transportGroup: {
              id: string;
              gatherTime: string;
              transportTime: string;
              vehicleType: string;
              vehicleIcon: string;
              combinedPax: number;
              otherFlights: string[];
              remark?: string;
            } | null;
            hasMidnightSurcharge: boolean;
            recommendedVehicle: {
              type: string;
              name: string;
              icon: string;
            };
          }
        >();

        for (const guest of guestsData || []) {
          const flightNumber =
            input.direction === 'arrival'
              ? guest.arrival_flight_number
              : guest.departure_flight_number;

          if (!flightNumber) continue;

          if (!flightMap.has(flightNumber)) {
            const scheduledTime = timeToString(
              input.direction === 'arrival'
                ? guest.arrival_time
                : guest.departure_time
            );

            // Get transport group info
            const transportGroup = findTransportGroup(flightNumber, input.date);
            const hasMidnightSurcharge = scheduledTime ? isMidnightSurchargeTime(scheduledTime) : false;

            flightMap.set(flightNumber, {
              flightNumber,
              scheduledTime,
              verifiedTime: timeToString(
                input.direction === 'arrival'
                  ? guest.arrival_verified_time
                  : guest.departure_verified_time
              ),
              terminal:
                input.direction === 'arrival'
                  ? guest.arrival_terminal
                  : guest.departure_terminal,
              status:
                input.direction === 'arrival'
                  ? guest.arrival_flight_status
                  : guest.departure_flight_status,
              hasTimeMismatch:
                input.direction === 'arrival'
                  ? !!guest.arrival_time_mismatch
                  : !!guest.departure_time_mismatch,
              guests: [],
              transportGroup: transportGroup ? {
                id: transportGroup.id,
                gatherTime: transportGroup.gatherTime,
                transportTime: transportGroup.transportTime,
                vehicleType: transportGroup.vehicleType,
                vehicleIcon: VEHICLE_TYPES[transportGroup.vehicleType].icon,
                combinedPax: transportGroup.combinedPax,
                otherFlights: transportGroup.flights.filter(f => f.toUpperCase() !== flightNumber.toUpperCase()),
                remark: transportGroup.remark,
              } : null,
              hasMidnightSurcharge,
              recommendedVehicle: { type: 'SEDAN', name: 'Sedan', icon: '🚗' }, // Will be calculated after grouping
            });
          }

          const flightEntry = flightMap.get(flightNumber)!;
          flightEntry.guests.push({
            id: guest.id,
            name: `${guest.first_name} ${guest.last_name}`,
            enteredTime: timeToString(
              input.direction === 'arrival'
                ? guest.arrival_time
                : guest.departure_time
            ),
          });

          // Update mismatch flag if any guest has mismatch
          if (
            input.direction === 'arrival'
              ? guest.arrival_time_mismatch
              : guest.departure_time_mismatch
          ) {
            flightEntry.hasTimeMismatch = true;
          }
        }

        // Calculate recommended vehicle based on actual guest count
        for (const flight of flightMap.values()) {
          const vehicle = getRecommendedVehicle(flight.guests.length);
          flight.recommendedVehicle = {
            type: vehicle.type,
            name: vehicle.name,
            icon: vehicle.icon,
          };
        }

        // Convert to array and sort by time
        return Array.from(flightMap.values()).sort((a, b) => {
          const timeA = a.verifiedTime || a.scheduledTime || '';
          const timeB = b.verifiedTime || b.scheduledTime || '';
          return timeA.localeCompare(timeB);
        });
      }

      if (!ctx.db) {
        throw new Error('Database not available');
      }

      const guestsOnDate = await ctx.db.query.guests.findMany({
        where: and(
          input.direction === 'arrival'
            ? eq(guests.arrivalDate, input.date)
            : eq(guests.departureDate, input.date),
          isNull(guests.deletedAt)
        ),
      });

      // Group by flight number
      const flightMap = new Map<
        string,
        {
          flightNumber: string;
          scheduledTime: string | null;
          verifiedTime: string | null;
          terminal: string | null;
          status: string | null;
          hasTimeMismatch: boolean;
          guests: Array<{ id: string; name: string; enteredTime: string | null }>;
          // Transport info
          transportGroup: {
            id: string;
            gatherTime: string;
            transportTime: string;
            vehicleType: string;
            vehicleIcon: string;
            combinedPax: number;
            otherFlights: string[];
            remark?: string;
          } | null;
          hasMidnightSurcharge: boolean;
          recommendedVehicle: {
            type: string;
            name: string;
            icon: string;
          };
        }
      >();

      for (const guest of guestsOnDate) {
        const flightNumber =
          input.direction === 'arrival'
            ? guest.arrivalFlightNumber
            : guest.departureFlightNumber;

        if (!flightNumber) continue;

        if (!flightMap.has(flightNumber)) {
          const scheduledTime = timeToString(
            input.direction === 'arrival'
              ? guest.arrivalTime
              : guest.departureTime
          );

          // Get transport group info
          const transportGroup = findTransportGroup(flightNumber, input.date);
          const hasMidnightSurcharge = scheduledTime ? isMidnightSurchargeTime(scheduledTime) : false;

          flightMap.set(flightNumber, {
            flightNumber,
            scheduledTime,
            verifiedTime: timeToString(
              input.direction === 'arrival'
                ? guest.arrivalVerifiedTime
                : guest.departureVerifiedTime
            ),
            terminal:
              input.direction === 'arrival'
                ? guest.arrivalTerminal
                : guest.departureTerminal,
            status:
              input.direction === 'arrival'
                ? guest.arrivalFlightStatus
                : guest.departureFlightStatus,
            hasTimeMismatch:
              input.direction === 'arrival'
                ? !!guest.arrivalTimeMismatch
                : !!guest.departureTimeMismatch,
            guests: [],
            transportGroup: transportGroup ? {
              id: transportGroup.id,
              gatherTime: transportGroup.gatherTime,
              transportTime: transportGroup.transportTime,
              vehicleType: transportGroup.vehicleType,
              vehicleIcon: VEHICLE_TYPES[transportGroup.vehicleType].icon,
              combinedPax: transportGroup.combinedPax,
              otherFlights: transportGroup.flights.filter(f => f.toUpperCase() !== flightNumber.toUpperCase()),
              remark: transportGroup.remark,
            } : null,
            hasMidnightSurcharge,
            recommendedVehicle: { type: 'SEDAN', name: 'Sedan', icon: '🚗' }, // Will be calculated after grouping
          });
        }

        const flightEntry = flightMap.get(flightNumber)!;
        flightEntry.guests.push({
          id: guest.id,
          name: `${guest.firstName} ${guest.lastName}`,
          enteredTime: timeToString(
            input.direction === 'arrival'
              ? guest.arrivalTime
              : guest.departureTime
          ),
        });

        // Update mismatch flag if any guest has mismatch
        if (
          input.direction === 'arrival'
            ? guest.arrivalTimeMismatch
            : guest.departureTimeMismatch
        ) {
          flightEntry.hasTimeMismatch = true;
        }
      }

      // Calculate recommended vehicle based on actual guest count
      for (const flight of flightMap.values()) {
        const vehicle = getRecommendedVehicle(flight.guests.length);
        flight.recommendedVehicle = {
          type: vehicle.type,
          name: vehicle.name,
          icon: vehicle.icon,
        };
      }

      // Convert to array and sort by time
      return Array.from(flightMap.values()).sort((a, b) => {
        const timeA = a.verifiedTime || a.scheduledTime || '';
        const timeB = b.verifiedTime || b.scheduledTime || '';
        return timeA.localeCompare(timeB);
      });
    }),

  // Get unique flight numbers for smart polling (not per-guest)
  getUniqueFlightNumbers: protectedProcedure
    .input(
      z.object({
        eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      // Demo mode
      if (ctx.isDemoMode) {
        return {
          flights: [
            {
              flightNumber: 'SQ238',
              flightDate: input.eventDate,
              direction: 'arrival' as const,
              expectedTime: '15:15',
              schedule: getPollingSchedule(input.eventDate),
            },
            {
              flightNumber: 'MH123',
              flightDate: input.eventDate,
              direction: 'arrival' as const,
              expectedTime: '12:00',
              schedule: getPollingSchedule(input.eventDate),
            },
          ],
          apiUsage: {
            aviationStackCalls: 10,
            openSkyCalls: 0,
            withinFreeTier: true,
          },
        };
      }

      if (!ctx.db) {
        throw new Error('Database not available');
      }

      // Get all guests
      const allGuests = await ctx.db.query.guests.findMany({
        where: isNull(guests.deletedAt),
      });

      // Extract unique flights
      const uniqueFlights = getUniqueFlights(allGuests);

      // Add polling schedule to each flight
      const flightsWithSchedule = uniqueFlights.map((f) => ({
        ...f,
        schedule: getPollingSchedule(f.flightDate),
      }));

      // Calculate API usage
      const apiUsage = estimateApiUsage(uniqueFlights);

      return {
        flights: flightsWithSchedule,
        apiUsage,
      };
    }),

  // Verify all unique flights (smart polling - checks flight numbers not guests)
  verifyUniqueFlights: protectedProcedure
    .input(
      z.object({
        flights: z.array(
          z.object({
            flightNumber: z.string(),
            flightDate: z.string(),
            direction: z.enum(['arrival', 'departure']),
            expectedTime: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results: Array<{
        flightNumber: string;
        flightDate: string;
        status: string;
        verifiedTime?: string;
        timeMismatch: boolean;
        isLive: boolean;
        liveStatus?: {
          isInAir: boolean;
          hasLanded: boolean;
          position?: { lat: number; lng: number; altitude: number };
        };
      }> = [];

      for (const flight of input.flights) {
        const schedule = getPollingSchedule(flight.flightDate);

        if (schedule.frequency === 'realtime') {
          // Event day - use OpenSky
          const liveResult = await getLiveFlightStatus(flight.flightNumber);
          results.push({
            flightNumber: flight.flightNumber,
            flightDate: flight.flightDate,
            status: liveResult.success
              ? liveResult.data?.hasLanded
                ? 'landed'
                : liveResult.data?.isInAir
                ? 'in_air'
                : 'unknown'
              : 'not_found',
            timeMismatch: false,
            isLive: true,
            liveStatus: liveResult.data
              ? {
                  isInAir: liveResult.data.isInAir,
                  hasLanded: liveResult.data.hasLanded,
                  position: liveResult.data.position || undefined,
                }
              : undefined,
          });
        } else {
          // Pre-event - use AviationStack
          const verification = await verifyFlight(flight as FlightToTrack);
          const verifiedTime = verification.scheduledInfo?.arrival.scheduled
            ? new Date(verification.scheduledInfo.arrival.scheduled)
                .toTimeString()
                .slice(0, 5)
            : undefined;

          results.push({
            flightNumber: flight.flightNumber,
            flightDate: flight.flightDate,
            status: verification.status,
            verifiedTime,
            timeMismatch: verification.timeMismatch || false,
            isLive: false,
          });

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return { results };
    }),

  // Live flight tracking via OpenSky (event day only) - single flight
  getLiveFlightStatus: protectedProcedure
    .input(
      z.object({
        flightNumber: z.string(),
      })
    )
    .query(async ({ input }) => {
      const result = await getLiveFlightStatus(input.flightNumber);
      return result;
    }),

  // BATCH live tracking - ALL flights in ONE API call!
  // This is the optimized endpoint for event day
  getBatchLiveStatus: protectedProcedure
    .input(
      z.object({
        flightNumbers: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      // Single API call for all flights (uses cached data)
      const statusMap = await getBatchFlightStatus(input.flightNumbers);

      // Convert Map to array for JSON response
      const results: Array<{
        flightNumber: string;
        found: boolean;
        isInAir?: boolean;
        hasLanded?: boolean;
        position?: { lat: number; lng: number; altitude: number; heading: number; speed: number };
        lastUpdate?: string;
      }> = [];

      for (const [flightNumber, status] of statusMap) {
        if (status) {
          results.push({
            flightNumber,
            found: true,
            isInAir: status.isInAir,
            hasLanded: status.hasLanded,
            position: status.position || undefined,
            lastUpdate: status.lastUpdate.toISOString(),
          });
        } else {
          results.push({
            flightNumber,
            found: false,
          });
        }
      }

      return {
        success: true,
        apiCallsUsed: 1, // Always 1, regardless of flight count!
        results,
      };
    }),

  // Get all flights near KUL airport (for monitoring arrivals)
  getArrivingFlights: protectedProcedure.query(async () => {
    const result = await getFlightsNearAirport('KUL');
    return result;
  }),

  // Get polling schedule for a specific date
  getPollingInfo: protectedProcedure
    .input(
      z.object({
        flightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(({ input }) => {
      return getPollingSchedule(input.flightDate);
    }),

  // Get first date with flights for each direction
  getFlightDateRange: protectedProcedure.query(async ({ ctx }) => {
    // Demo mode
    if (ctx.isDemoMode) {
      return {
        firstArrivalDate: '2026-01-18',
        firstDepartureDate: '2026-01-21',
        lastArrivalDate: '2026-01-18',
        lastDepartureDate: '2026-01-22',
      };
    }

    if (!ctx.db && ctx.supabase) {
      // Get first/last arrival date
      const { data: arrivalData } = await ctx.supabase
        .from('guests')
        .select('arrival_date')
        .not('arrival_date', 'is', null)
        .is('deleted_at', null)
        .order('arrival_date', { ascending: true });

      // Get first/last departure date
      const { data: departureData } = await ctx.supabase
        .from('guests')
        .select('departure_date')
        .not('departure_date', 'is', null)
        .is('deleted_at', null)
        .order('departure_date', { ascending: true });

      const arrivalDates = arrivalData?.map(g => g.arrival_date).filter(Boolean) || [];
      const departureDates = departureData?.map(g => g.departure_date).filter(Boolean) || [];

      return {
        firstArrivalDate: arrivalDates[0] || null,
        firstDepartureDate: departureDates[0] || null,
        lastArrivalDate: arrivalDates[arrivalDates.length - 1] || null,
        lastDepartureDate: departureDates[departureDates.length - 1] || null,
      };
    }

    if (!ctx.db) {
      throw new Error('Database not available');
    }

    const allGuests = await ctx.db.query.guests.findMany({
      where: isNull(guests.deletedAt),
    });

    const arrivalDates = allGuests
      .map(g => g.arrivalDate)
      .filter(Boolean)
      .sort() as string[];

    const departureDates = allGuests
      .map(g => g.departureDate)
      .filter(Boolean)
      .sort() as string[];

    return {
      firstArrivalDate: arrivalDates[0] || null,
      firstDepartureDate: departureDates[0] || null,
      lastArrivalDate: arrivalDates[arrivalDates.length - 1] || null,
      lastDepartureDate: departureDates[departureDates.length - 1] || null,
    };
  }),
});
