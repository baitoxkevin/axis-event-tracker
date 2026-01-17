import { z } from 'zod';
import { router, protectedProcedure, crewOnlyProcedure } from '../init';
import { guests, auditLogs } from '@/server/db/schema';
import { eq, and, or, like, isNull, desc, asc, sql, count } from 'drizzle-orm';
import { mockGuests } from '@/server/mock-data';

// Input schemas
const guestFilterSchema = z.object({
  search: z.string().optional(),
  registrationStatus: z.enum(['pending', 'confirmed', 'cancelled', 'waitlisted']).optional(),
  arrivalDateFrom: z.string().optional(),
  arrivalDateTo: z.string().optional(),
  departureDateFrom: z.string().optional(),
  departureDateTo: z.string().optional(),
  reportingLevel1: z.string().optional(),
  needsTransfer: z.boolean().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const guestCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  axisEmail: z.string().email().optional(),
  reportingLevel1: z.string().optional(),
  reportingLevel2: z.string().optional(),
  reportingLevel3: z.string().optional(),
  function: z.string().optional(),
  location: z.string().optional(),
  arrivalDate: z.string().optional(),
  arrivalTime: z.string().optional(),
  arrivalFlightNumber: z.string().optional(),
  arrivalAirport: z.string().optional(),
  departureDate: z.string().optional(),
  departureTime: z.string().optional(),
  departureFlightNumber: z.string().optional(),
  departureAirport: z.string().optional(),
  hotelCheckinDate: z.string().optional(),
  hotelCheckoutDate: z.string().optional(),
  extendStayBefore: z.boolean().optional(),
  extendStayAfter: z.boolean().optional(),
  needsArrivalTransfer: z.boolean().optional(),
  needsDepartureTransfer: z.boolean().optional(),
  registrationStatus: z.enum(['pending', 'confirmed', 'cancelled', 'waitlisted']).optional(),
  travelType: z.string().optional(),
});

const guestUpdateSchema = guestCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const guestsRouter = router({
  // List guests with filtering and pagination
  list: protectedProcedure
    .input(guestFilterSchema)
    .query(async ({ ctx, input }) => {
      const { search, registrationStatus, page, pageSize } = input;

      // Demo mode - return mock data
      if (ctx.isDemoMode) {
        let filtered = [...mockGuests];

        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(
            (g) =>
              g.firstName.toLowerCase().includes(searchLower) ||
              g.lastName.toLowerCase().includes(searchLower) ||
              g.email.toLowerCase().includes(searchLower)
          );
        }

        if (registrationStatus) {
          filtered = filtered.filter((g) => g.registrationStatus === registrationStatus);
        }

        if (input.reportingLevel1) {
          filtered = filtered.filter((g) => g.reportingLevel1 === input.reportingLevel1);
        }

        const total = filtered.length;
        const offset = (page - 1) * pageSize;
        const paginated = filtered.slice(offset, offset + pageSize);

        return {
          data: paginated.map((g) => ({ ...g, transportAssignments: [] })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        };
      }

      // Use Supabase client if Drizzle is not available
      if (!ctx.db && ctx.supabase) {
        let query = ctx.supabase
          .from('guests')
          .select('*', { count: 'exact' })
          .is('deleted_at', null);

        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,axis_email.ilike.%${search}%`);
        }

        if (registrationStatus) {
          query = query.eq('registration_status', registrationStatus);
        }

        if (input.reportingLevel1) {
          query = query.eq('reporting_level_1', input.reportingLevel1);
        }

        if (input.needsTransfer !== undefined) {
          if (input.needsTransfer) {
            query = query.or('needs_arrival_transfer.eq.true,needs_departure_transfer.eq.true');
          }
        }

        const offset = (page - 1) * pageSize;

        // Map sortBy from camelCase to snake_case
        const sortByMapping: Record<string, string> = {
          createdAt: 'created_at',
          updatedAt: 'updated_at',
          firstName: 'first_name',
          lastName: 'last_name',
          arrivalDate: 'arrival_date',
          departureDate: 'departure_date',
        };
        const sortColumn = sortByMapping[input.sortBy] || 'created_at';

        query = query
          .order(sortColumn, { ascending: input.sortOrder === 'asc' })
          .range(offset, offset + pageSize - 1);

        const { data: results, count: total, error } = await query;

        if (error) {
          console.error('Error fetching guests:', error);
          throw new Error(`Failed to fetch guests: ${error.message}`);
        }

        // Transform snake_case to camelCase for frontend
        const transformedResults = (results || []).map((g: Record<string, unknown>) => ({
          id: g.id,
          email: g.email,
          firstName: g.first_name,
          lastName: g.last_name,
          axisEmail: g.axis_email,
          salutation: g.salutation,
          gender: g.gender,
          reportingLevel1: g.reporting_level_1,
          reportingLevel2: g.reporting_level_2,
          reportingLevel3: g.reporting_level_3,
          function: g.function,
          location: g.location,
          arrivalDate: g.arrival_date,
          arrivalTime: g.arrival_time,
          arrivalFlightNumber: g.arrival_flight_number,
          arrivalAirport: g.arrival_airport,
          arrivalFlightRoute: g.arrival_flight_route,
          departureDate: g.departure_date,
          departureTime: g.departure_time,
          departureFlightNumber: g.departure_flight_number,
          departureAirport: g.departure_airport,
          departureFlightRoute: g.departure_flight_route,
          hotelCheckinDate: g.hotel_checkin_date,
          hotelCheckoutDate: g.hotel_checkout_date,
          hotelRoomNumber: g.room_number,
          hotelConfirmationNumber: g.hotel_confirmation_number,
          roomType: g.room_type,
          beddingPreference: g.bedding_preference,
          dietaryRequirements: g.dietary_requirements,
          specialRequests: g.special_requests,
          tableNumber: g.table_number,
          awardsMenuSelection: g.awards_menu_selection,
          extendStayBefore: g.extend_stay_before,
          extendStayAfter: g.extend_stay_after,
          earlyCheckin: g.early_checkin,
          lateCheckout: g.late_checkout,
          needsArrivalTransfer: g.needs_arrival_transfer,
          needsDepartureTransfer: g.needs_departure_transfer,
          registrationStatus: g.registration_status,
          travelType: g.travel_type,
          version: g.version,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          deletedAt: g.deleted_at,
          transportAssignments: [],
        }));

        return {
          data: transformedResults,
          pagination: {
            page,
            pageSize,
            total: total || 0,
            totalPages: Math.ceil((total || 0) / pageSize),
          },
        };
      }

      // Build where conditions for Drizzle
      const conditions = [isNull(guests.deletedAt)];

      if (search) {
        conditions.push(
          or(
            like(guests.firstName, `%${search}%`),
            like(guests.lastName, `%${search}%`),
            like(guests.email, `%${search}%`),
            like(guests.axisEmail, `%${search}%`)
          )!
        );
      }

      if (registrationStatus) {
        conditions.push(eq(guests.registrationStatus, registrationStatus));
      }

      if (input.reportingLevel1) {
        conditions.push(eq(guests.reportingLevel1, input.reportingLevel1));
      }

      if (input.needsTransfer !== undefined) {
        conditions.push(
          or(
            eq(guests.needsArrivalTransfer, input.needsTransfer),
            eq(guests.needsDepartureTransfer, input.needsTransfer)
          )!
        );
      }

      // Get total count
      const [{ total }] = await ctx.db!
        .select({ total: count() })
        .from(guests)
        .where(and(...conditions));

      // Get paginated results
      const offset = (page - 1) * pageSize;

      const results = await ctx.db!.query.guests.findMany({
        where: and(...conditions),
        limit: pageSize,
        offset,
        orderBy: input.sortOrder === 'desc'
          ? desc(guests[input.sortBy as keyof typeof guests] || guests.createdAt)
          : asc(guests[input.sortBy as keyof typeof guests] || guests.createdAt),
        with: {
          transportAssignments: {
            with: {
              schedule: true,
            },
          },
        },
      });

      return {
        data: results,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  // Get single guest by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Demo mode
      if (ctx.isDemoMode) {
        const guest = mockGuests.find((g) => g.id === input.id);
        if (!guest) {
          throw new Error('Guest not found');
        }
        return { ...guest, transportAssignments: [] };
      }

      const guest = await ctx.db!.query.guests.findFirst({
        where: and(eq(guests.id, input.id), isNull(guests.deletedAt)),
        with: {
          transportAssignments: {
            with: {
              schedule: {
                with: {
                  vehicle: true,
                },
              },
            },
          },
        },
      });

      if (!guest) {
        throw new Error('Guest not found');
      }

      return guest;
    }),

  // Create guest (crew only)
  create: crewOnlyProcedure
    .input(guestCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Demo mode - return mock created guest
      if (ctx.isDemoMode) {
        return {
          id: `demo-${Date.now()}`,
          ...input,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
      }

      const [newGuest] = await ctx.db!.insert(guests).values(input).returning();

      // Create audit log
      await ctx.db!.insert(auditLogs).values({
        entityType: 'guest',
        entityId: newGuest.id,
        action: 'create',
        changes: Object.entries(input).map(([field, value]) => ({
          field,
          oldValue: null,
          newValue: value,
          fieldType: typeof value,
        })),
        changeSource: 'manual',
        performedBy: ctx.user!.id,
      });

      return newGuest;
    }),

  // Update guest (crew only)
  update: crewOnlyProcedure
    .input(guestUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Demo mode
      if (ctx.isDemoMode) {
        const currentGuest = mockGuests.find((g) => g.id === id);
        if (!currentGuest) {
          throw new Error('Guest not found');
        }
        return { ...currentGuest, ...updateData, version: currentGuest.version + 1, updatedAt: new Date() };
      }

      // Get current guest
      const currentGuest = await ctx.db!.query.guests.findFirst({
        where: eq(guests.id, id),
      });

      if (!currentGuest) {
        throw new Error('Guest not found');
      }

      // Calculate changes
      const changes = Object.entries(updateData)
        .filter(([key, value]) => {
          const currentValue = currentGuest[key as keyof typeof currentGuest];
          return currentValue !== value;
        })
        .map(([field, newValue]) => ({
          field,
          oldValue: currentGuest[field as keyof typeof currentGuest],
          newValue,
          fieldType: typeof newValue,
        }));

      if (changes.length === 0) {
        return currentGuest;
      }

      // Update guest with incremented version
      const [updatedGuest] = await ctx.db!
        .update(guests)
        .set({
          ...updateData,
          version: currentGuest.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(guests.id, id))
        .returning();

      // Create audit log
      await ctx.db!.insert(auditLogs).values({
        entityType: 'guest',
        entityId: id,
        action: 'update',
        changes,
        changeSource: 'manual',
        performedBy: ctx.user!.id,
      });

      return updatedGuest;
    }),

  // Soft delete guest (crew only)
  delete: crewOnlyProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Demo mode
      if (ctx.isDemoMode) {
        return { success: true };
      }

      const currentGuest = await ctx.db!.query.guests.findFirst({
        where: eq(guests.id, input.id),
      });

      if (!currentGuest) {
        throw new Error('Guest not found');
      }

      // Soft delete
      await ctx.db!
        .update(guests)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(guests.id, input.id));

      // Create audit log
      await ctx.db!.insert(auditLogs).values({
        entityType: 'guest',
        entityId: input.id,
        action: 'delete',
        changes: [
          {
            field: 'deletedAt',
            oldValue: null,
            newValue: new Date().toISOString(),
            fieldType: 'date',
          },
        ],
        changeSource: 'manual',
        performedBy: ctx.user!.id,
      });

      return { success: true };
    }),

  // Get dashboard statistics
  stats: protectedProcedure.query(async ({ ctx }) => {
    // Demo mode
    if (ctx.isDemoMode) {
      return {
        total: mockGuests.length,
        confirmed: mockGuests.filter((g) => g.registrationStatus === 'confirmed').length,
        pending: mockGuests.filter((g) => g.registrationStatus === 'pending').length,
        cancelled: mockGuests.filter((g) => g.registrationStatus === 'cancelled').length,
        arrivingToday: 2,
        arrivingTomorrow: 1,
        departingToday: 0,
        departingTomorrow: 1,
        needsTransfer: mockGuests.filter((g) => g.needsArrivalTransfer || g.needsDepartureTransfer).length,
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Use Supabase client if Drizzle is not available
    if (!ctx.db && ctx.supabase) {
      const { data: allGuests, error } = await ctx.supabase
        .from('guests')
        .select('registration_status, arrival_date, departure_date, needs_arrival_transfer, needs_departure_transfer')
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching stats:', error);
        throw new Error(`Failed to fetch stats: ${error.message}`);
      }

      const guestList = allGuests || [];
      return {
        total: guestList.length,
        confirmed: guestList.filter((g) => g.registration_status === 'confirmed').length,
        pending: guestList.filter((g) => g.registration_status === 'pending').length,
        cancelled: guestList.filter((g) => g.registration_status === 'cancelled').length,
        arrivingToday: guestList.filter((g) => g.arrival_date === today).length,
        arrivingTomorrow: guestList.filter((g) => g.arrival_date === tomorrow).length,
        departingToday: guestList.filter((g) => g.departure_date === today).length,
        departingTomorrow: guestList.filter((g) => g.departure_date === tomorrow).length,
        needsTransfer: guestList.filter((g) => g.needs_arrival_transfer || g.needs_departure_transfer).length,
      };
    }

    const [stats] = await ctx.db!
      .select({
        total: count(),
        confirmed: sql<number>`count(*) filter (where ${guests.registrationStatus} = 'confirmed')`,
        pending: sql<number>`count(*) filter (where ${guests.registrationStatus} = 'pending')`,
        cancelled: sql<number>`count(*) filter (where ${guests.registrationStatus} = 'cancelled')`,
        arrivingToday: sql<number>`count(*) filter (where ${guests.arrivalDate} = ${today})`,
        arrivingTomorrow: sql<number>`count(*) filter (where ${guests.arrivalDate} = ${tomorrow})`,
        departingToday: sql<number>`count(*) filter (where ${guests.departureDate} = ${today})`,
        departingTomorrow: sql<number>`count(*) filter (where ${guests.departureDate} = ${tomorrow})`,
        needsTransfer: sql<number>`count(*) filter (where ${guests.needsArrivalTransfer} = true or ${guests.needsDepartureTransfer} = true)`,
      })
      .from(guests)
      .where(isNull(guests.deletedAt));

    return stats;
  }),

  // Get unique values for filters
  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    // Demo mode
    if (ctx.isDemoMode) {
      const reportingLevels = [...new Set(mockGuests.map((g) => g.reportingLevel1).filter(Boolean))];
      const locations = [...new Set(mockGuests.map((g) => g.location).filter(Boolean))];
      const functions = [...new Set(mockGuests.map((g) => g.function).filter(Boolean))];
      return { reportingLevels, locations, functions };
    }

    // Use Supabase client if Drizzle is not available
    if (!ctx.db && ctx.supabase) {
      const { data: allGuests, error } = await ctx.supabase
        .from('guests')
        .select('reporting_level_1, location, function')
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching filter options:', error);
        return { reportingLevels: [], locations: [], functions: [] };
      }

      const guestList = allGuests || [];
      return {
        reportingLevels: [...new Set(guestList.map((g) => g.reporting_level_1).filter(Boolean))] as string[],
        locations: [...new Set(guestList.map((g) => g.location).filter(Boolean))] as string[],
        functions: [...new Set(guestList.map((g) => g.function).filter(Boolean))] as string[],
      };
    }

    const reportingLevels = await ctx.db!
      .selectDistinct({ value: guests.reportingLevel1 })
      .from(guests)
      .where(and(isNull(guests.deletedAt), sql`${guests.reportingLevel1} is not null`));

    const locations = await ctx.db!
      .selectDistinct({ value: guests.location })
      .from(guests)
      .where(and(isNull(guests.deletedAt), sql`${guests.location} is not null`));

    const functions = await ctx.db!
      .selectDistinct({ value: guests.function })
      .from(guests)
      .where(and(isNull(guests.deletedAt), sql`${guests.function} is not null`));

    return {
      reportingLevels: reportingLevels.map((r) => r.value).filter(Boolean),
      locations: locations.map((l) => l.value).filter(Boolean),
      functions: functions.map((f) => f.value).filter(Boolean),
    };
  }),
});
