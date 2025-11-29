import { z } from 'zod';
import { router, transportProcedure, crewOnlyProcedure } from '../init';
import {
  vehicles,
  transportSchedules,
  guestTransportAssignments,
  guests,
  auditLogs,
} from '@/server/db/schema';
import { eq, and, isNull, desc, asc, sql, count, gte, lte } from 'drizzle-orm';
import { mockVehicles, mockSchedules, mockGuests } from '@/server/mock-data';
import {
  getTransportGroupsForDate,
  getScheduledTransportDates,
  VEHICLE_TYPES,
  type TransportGroup,
  type TransportDirection,
} from '@/lib/transport-rules';

// Schemas
const vehicleSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  capacity: z.number().min(1),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  licensePlate: z.string().optional(),
});

const scheduleSchema = z.object({
  vehicleId: z.string().uuid(),
  direction: z.enum(['arrival', 'departure']),
  scheduleDate: z.string(),
  pickupTime: z.string(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  notes: z.string().optional(),
});

const assignmentSchema = z.object({
  guestId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  assignmentType: z.enum(['arrival', 'departure']),
});

// Helper to determine if we should use Supabase or Drizzle
function useSupabase(ctx: { db: unknown; supabase: unknown; isDemoMode: boolean }) {
  return !ctx.db && ctx.supabase && !ctx.isDemoMode;
}

export const transportRouter = router({
  // ============ VEHICLES ============

  // List vehicles
  vehicles: router({
    list: transportProcedure.query(async ({ ctx }) => {
      if (ctx.isDemoMode) {
        return mockVehicles;
      }

      // Use Supabase client if Drizzle is not available
      if (useSupabase(ctx)) {
        const { data, error } = await ctx.supabase!
          .from('vehicles')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw new Error(error.message);
        return data?.map(v => ({
          id: v.id,
          name: v.name,
          vehicleType: v.vehicle_type,
          capacity: v.capacity,
          driverName: v.driver_name,
          driverPhone: v.driver_phone,
          licensePlate: v.license_plate,
          isActive: v.is_active,
          createdAt: v.created_at,
          updatedAt: v.updated_at,
        })) || [];
      }

      return ctx.db!.query.vehicles.findMany({
        where: eq(vehicles.isActive, true),
        orderBy: asc(vehicles.name),
      });
    }),

    getById: transportProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return mockVehicles.find((v) => v.id === input.id) || null;
        }

        if (useSupabase(ctx)) {
          const { data, error } = await ctx.supabase!
            .from('vehicles')
            .select(`
              *,
              transport_schedules (
                *,
                guest_transport_assignments (
                  *,
                  guests (*)
                )
              )
            `)
            .eq('id', input.id)
            .single();

          if (error) return null;
          return data;
        }

        return ctx.db!.query.vehicles.findFirst({
          where: eq(vehicles.id, input.id),
          with: {
            schedules: {
              with: {
                assignments: {
                  with: {
                    guest: true,
                  },
                },
              },
            },
          },
        });
      }),

    create: crewOnlyProcedure
      .input(vehicleSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { id: `demo-vehicle-${Date.now()}`, ...input, isActive: true, createdAt: new Date(), updatedAt: new Date() };
        }

        if (useSupabase(ctx)) {
          const { data, error } = await ctx.supabase!
            .from('vehicles')
            .insert({
              name: input.name,
              vehicle_type: input.type,
              capacity: input.capacity,
              driver_name: input.driverName,
              driver_phone: input.driverPhone,
              license_plate: input.licensePlate,
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data;
        }

        const [vehicle] = await ctx.db!.insert(vehicles).values(input).returning();

        await ctx.db!.insert(auditLogs).values({
          entityType: 'vehicle',
          entityId: vehicle.id,
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

        return vehicle;
      }),

    update: crewOnlyProcedure
      .input(vehicleSchema.extend({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updateData } = input;

        if (ctx.isDemoMode) {
          const current = mockVehicles.find((v) => v.id === id);
          if (!current) throw new Error('Vehicle not found');
          return { ...current, ...updateData, updatedAt: new Date() };
        }

        if (useSupabase(ctx)) {
          const { data, error } = await ctx.supabase!
            .from('vehicles')
            .update({
              name: updateData.name,
              vehicle_type: updateData.type,
              capacity: updateData.capacity,
              driver_name: updateData.driverName,
              driver_phone: updateData.driverPhone,
              license_plate: updateData.licensePlate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data;
        }

        const current = await ctx.db!.query.vehicles.findFirst({
          where: eq(vehicles.id, id),
        });

        if (!current) throw new Error('Vehicle not found');

        const changes = Object.entries(updateData)
          .filter(([key, value]) => current[key as keyof typeof current] !== value)
          .map(([field, newValue]) => ({
            field,
            oldValue: current[field as keyof typeof current],
            newValue,
            fieldType: typeof newValue,
          }));

        const [updated] = await ctx.db!
          .update(vehicles)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(vehicles.id, id))
          .returning();

        if (changes.length > 0) {
          await ctx.db!.insert(auditLogs).values({
            entityType: 'vehicle',
            entityId: id,
            action: 'update',
            changes,
            changeSource: 'manual',
            performedBy: ctx.user!.id,
          });
        }

        return updated;
      }),

    delete: crewOnlyProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { success: true };
        }

        if (useSupabase(ctx)) {
          const { error } = await ctx.supabase!
            .from('vehicles')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', input.id);

          if (error) throw new Error(error.message);
          return { success: true };
        }

        await ctx.db!
          .update(vehicles)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(vehicles.id, input.id));

        await ctx.db!.insert(auditLogs).values({
          entityType: 'vehicle',
          entityId: input.id,
          action: 'delete',
          changes: [{ field: 'isActive', oldValue: true, newValue: false, fieldType: 'boolean' }],
          changeSource: 'manual',
          performedBy: ctx.user!.id,
        });

        return { success: true };
      }),
  }),

  // ============ SCHEDULES ============

  schedules: router({
    list: transportProcedure
      .input(
        z.object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          direction: z.enum(['arrival', 'departure']).optional(),
          vehicleId: z.string().uuid().optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          let filtered = [...mockSchedules];
          if (input?.dateFrom) {
            filtered = filtered.filter((s) => s.scheduleDate >= input.dateFrom!);
          }
          if (input?.dateTo) {
            filtered = filtered.filter((s) => s.scheduleDate <= input.dateTo!);
          }
          if (input?.direction) {
            filtered = filtered.filter((s) => s.direction === input.direction);
          }
          if (input?.vehicleId) {
            filtered = filtered.filter((s) => s.vehicleId === input.vehicleId);
          }
          return filtered;
        }

        if (useSupabase(ctx)) {
          let query = ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (
                *,
                guest:guests (*)
              )
            `)
            .order('schedule_date', { ascending: true })
            .order('pickup_time', { ascending: true });

          if (input?.dateFrom) {
            query = query.gte('schedule_date', input.dateFrom);
          }
          if (input?.dateTo) {
            query = query.lte('schedule_date', input.dateTo);
          }
          if (input?.direction) {
            query = query.eq('direction', input.direction);
          }
          if (input?.vehicleId) {
            query = query.eq('vehicle_id', input.vehicleId);
          }

          const { data, error } = await query;

          if (error) throw new Error(error.message);

          // Transform to match expected format
          return data?.map(s => ({
            id: s.id,
            vehicleId: s.vehicle_id,
            direction: s.direction,
            scheduleDate: s.schedule_date,
            pickupTime: s.pickup_time,
            pickupLocation: s.pickup_location,
            dropoffLocation: s.dropoff_location,
            status: s.status,
            notes: s.notes,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            vehicle: s.vehicle ? {
              id: s.vehicle.id,
              name: s.vehicle.name,
              vehicleType: s.vehicle.vehicle_type,
              capacity: s.vehicle.capacity,
              driverName: s.vehicle.driver_name,
              driverPhone: s.vehicle.driver_phone,
              licensePlate: s.vehicle.license_plate,
              isActive: s.vehicle.is_active,
            } : null,
            assignments: s.assignments?.map((a: Record<string, unknown>) => ({
              id: a.id,
              scheduleId: a.schedule_id,
              guestId: a.guest_id,
              assignmentType: a.assignment_type,
              status: a.status,
              createdAt: a.created_at,
              updatedAt: a.updated_at,
              guest: a.guest ? {
                id: (a.guest as Record<string, unknown>).id,
                firstName: (a.guest as Record<string, unknown>).first_name,
                lastName: (a.guest as Record<string, unknown>).last_name,
                email: (a.guest as Record<string, unknown>).email,
                phone: (a.guest as Record<string, unknown>).phone,
                arrivalDate: (a.guest as Record<string, unknown>).arrival_date,
                arrivalTime: (a.guest as Record<string, unknown>).arrival_time,
                arrivalFlightNumber: (a.guest as Record<string, unknown>).arrival_flight_number,
                departureDate: (a.guest as Record<string, unknown>).departure_date,
                departureTime: (a.guest as Record<string, unknown>).departure_time,
                departureFlightNumber: (a.guest as Record<string, unknown>).departure_flight_number,
              } : null,
            })) || [],
          })) || [];
        }

        const conditions = [];

        if (input?.dateFrom) {
          conditions.push(gte(transportSchedules.scheduleDate, input.dateFrom));
        }
        if (input?.dateTo) {
          conditions.push(lte(transportSchedules.scheduleDate, input.dateTo));
        }
        if (input?.direction) {
          conditions.push(eq(transportSchedules.direction, input.direction));
        }
        if (input?.vehicleId) {
          conditions.push(eq(transportSchedules.vehicleId, input.vehicleId));
        }

        return ctx.db!.query.transportSchedules.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [asc(transportSchedules.scheduleDate), asc(transportSchedules.pickupTime)],
          with: {
            vehicle: true,
            assignments: {
              with: {
                guest: true,
              },
            },
          },
        });
      }),

    getById: transportProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return mockSchedules.find((s) => s.id === input.id) || null;
        }

        if (useSupabase(ctx)) {
          const { data, error } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (
                *,
                guest:guests (*)
              )
            `)
            .eq('id', input.id)
            .single();

          if (error) return null;
          return data;
        }

        return ctx.db!.query.transportSchedules.findFirst({
          where: eq(transportSchedules.id, input.id),
          with: {
            vehicle: true,
            assignments: {
              with: {
                guest: true,
              },
            },
          },
        });
      }),

    create: transportProcedure
      .input(scheduleSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { id: `demo-schedule-${Date.now()}`, ...input, status: 'scheduled', createdAt: new Date(), updatedAt: new Date() };
        }

        if (useSupabase(ctx)) {
          const { data, error } = await ctx.supabase!
            .from('transport_schedules')
            .insert({
              vehicle_id: input.vehicleId,
              direction: input.direction,
              schedule_date: input.scheduleDate,
              pickup_time: input.pickupTime,
              pickup_location: input.pickupLocation,
              dropoff_location: input.dropoffLocation,
              notes: input.notes,
              status: 'scheduled',
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data;
        }

        const [schedule] = await ctx.db!.insert(transportSchedules).values(input).returning();

        await ctx.db!.insert(auditLogs).values({
          entityType: 'transport_schedule',
          entityId: schedule.id,
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

        return schedule;
      }),

    update: transportProcedure
      .input(scheduleSchema.partial().extend({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updateData } = input;

        if (ctx.isDemoMode) {
          const current = mockSchedules.find((s) => s.id === id);
          if (!current) throw new Error('Schedule not found');
          return { ...current, ...updateData, updatedAt: new Date() };
        }

        if (useSupabase(ctx)) {
          const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (updateData.vehicleId) updateObj.vehicle_id = updateData.vehicleId;
          if (updateData.direction) updateObj.direction = updateData.direction;
          if (updateData.scheduleDate) updateObj.schedule_date = updateData.scheduleDate;
          if (updateData.pickupTime) updateObj.pickup_time = updateData.pickupTime;
          if (updateData.pickupLocation !== undefined) updateObj.pickup_location = updateData.pickupLocation;
          if (updateData.dropoffLocation !== undefined) updateObj.dropoff_location = updateData.dropoffLocation;
          if (updateData.notes !== undefined) updateObj.notes = updateData.notes;

          const { data, error } = await ctx.supabase!
            .from('transport_schedules')
            .update(updateObj)
            .eq('id', id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data;
        }

        const current = await ctx.db!.query.transportSchedules.findFirst({
          where: eq(transportSchedules.id, id),
        });

        if (!current) throw new Error('Schedule not found');

        const changes = Object.entries(updateData)
          .filter(([key, value]) => current[key as keyof typeof current] !== value)
          .map(([field, newValue]) => ({
            field,
            oldValue: current[field as keyof typeof current],
            newValue,
            fieldType: typeof newValue,
          }));

        const [updated] = await ctx.db!
          .update(transportSchedules)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(transportSchedules.id, id))
          .returning();

        if (changes.length > 0) {
          await ctx.db!.insert(auditLogs).values({
            entityType: 'transport_schedule',
            entityId: id,
            action: 'update',
            changes,
            changeSource: 'manual',
            performedBy: ctx.user!.id,
          });
        }

        return updated;
      }),

    delete: transportProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { success: true };
        }

        if (useSupabase(ctx)) {
          // First remove all assignments
          await ctx.supabase!
            .from('guest_transport_assignments')
            .delete()
            .eq('schedule_id', input.id);

          // Then delete the schedule
          const { error } = await ctx.supabase!
            .from('transport_schedules')
            .delete()
            .eq('id', input.id);

          if (error) throw new Error(error.message);
          return { success: true };
        }

        // First remove all assignments
        await ctx.db!
          .delete(guestTransportAssignments)
          .where(eq(guestTransportAssignments.scheduleId, input.id));

        // Then delete the schedule
        await ctx.db!
          .delete(transportSchedules)
          .where(eq(transportSchedules.id, input.id));

        await ctx.db!.insert(auditLogs).values({
          entityType: 'transport_schedule',
          entityId: input.id,
          action: 'delete',
          changes: [],
          changeSource: 'manual',
          performedBy: ctx.user!.id,
        });

        return { success: true };
      }),
  }),

  // ============ ASSIGNMENTS ============

  assignments: router({
    assign: transportProcedure
      .input(assignmentSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { id: `demo-assignment-${Date.now()}`, ...input, createdAt: new Date() };
        }

        if (useSupabase(ctx)) {
          // Check capacity
          const { data: schedule } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (*)
            `)
            .eq('id', input.scheduleId)
            .single();

          if (!schedule) throw new Error('Schedule not found');

          const currentCount = schedule.assignments?.length || 0;
          if (schedule.vehicle && currentCount >= schedule.vehicle.capacity) {
            throw new Error('Vehicle is at full capacity');
          }

          // Check if guest already has assignment
          const { data: existing } = await ctx.supabase!
            .from('guest_transport_assignments')
            .select('*')
            .eq('guest_id', input.guestId)
            .eq('assignment_type', input.assignmentType)
            .maybeSingle();

          if (existing) {
            throw new Error(`Guest already has ${input.assignmentType} transport assigned`);
          }

          const { data, error } = await ctx.supabase!
            .from('guest_transport_assignments')
            .insert({
              guest_id: input.guestId,
              schedule_id: input.scheduleId,
              assignment_type: input.assignmentType,
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data;
        }

        // Check if schedule has capacity
        const schedule = await ctx.db!.query.transportSchedules.findFirst({
          where: eq(transportSchedules.id, input.scheduleId),
          with: {
            vehicle: true,
            assignments: true,
          },
        });

        if (!schedule) throw new Error('Schedule not found');

        const currentCount = schedule.assignments.length;
        if (schedule.vehicle && currentCount >= schedule.vehicle.capacity) {
          throw new Error('Vehicle is at full capacity');
        }

        // Check if guest already has assignment for this type
        const existing = await ctx.db!.query.guestTransportAssignments.findFirst({
          where: and(
            eq(guestTransportAssignments.guestId, input.guestId),
            eq(guestTransportAssignments.assignmentType, input.assignmentType)
          ),
        });

        if (existing) {
          throw new Error(`Guest already has ${input.assignmentType} transport assigned`);
        }

        const [assignment] = await ctx.db!
          .insert(guestTransportAssignments)
          .values(input)
          .returning();

        await ctx.db!.insert(auditLogs).values({
          entityType: 'assignment',
          entityId: assignment.id,
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

        return assignment;
      }),

    unassign: transportProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { success: true };
        }

        if (useSupabase(ctx)) {
          const { error } = await ctx.supabase!
            .from('guest_transport_assignments')
            .delete()
            .eq('id', input.id);

          if (error) throw new Error(error.message);
          return { success: true };
        }

        await ctx.db!
          .delete(guestTransportAssignments)
          .where(eq(guestTransportAssignments.id, input.id));

        await ctx.db!.insert(auditLogs).values({
          entityType: 'assignment',
          entityId: input.id,
          action: 'delete',
          changes: [],
          changeSource: 'manual',
          performedBy: ctx.user!.id,
        });

        return { success: true };
      }),

    bulkAssign: transportProcedure
      .input(
        z.object({
          scheduleId: z.string().uuid(),
          guestIds: z.array(z.string().uuid()),
          assignmentType: z.enum(['arrival', 'departure']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return input.guestIds.map((guestId, i) => ({
            id: `demo-assignment-${Date.now()}-${i}`,
            guestId,
            scheduleId: input.scheduleId,
            assignmentType: input.assignmentType,
            createdAt: new Date(),
          }));
        }

        if (useSupabase(ctx)) {
          // Check capacity
          const { data: schedule } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (*)
            `)
            .eq('id', input.scheduleId)
            .single();

          if (!schedule) throw new Error('Schedule not found');

          const currentCount = schedule.assignments?.length || 0;
          const newTotal = currentCount + input.guestIds.length;

          if (schedule.vehicle && newTotal > schedule.vehicle.capacity) {
            throw new Error(
              `Cannot assign ${input.guestIds.length} guests. Only ${schedule.vehicle.capacity - currentCount} spots available.`
            );
          }

          const { data, error } = await ctx.supabase!
            .from('guest_transport_assignments')
            .insert(
              input.guestIds.map((guestId) => ({
                guest_id: guestId,
                schedule_id: input.scheduleId,
                assignment_type: input.assignmentType,
              }))
            )
            .select();

          if (error) throw new Error(error.message);
          return data;
        }

        const schedule = await ctx.db!.query.transportSchedules.findFirst({
          where: eq(transportSchedules.id, input.scheduleId),
          with: {
            vehicle: true,
            assignments: true,
          },
        });

        if (!schedule) throw new Error('Schedule not found');

        const currentCount = schedule.assignments.length;
        const newTotal = currentCount + input.guestIds.length;

        if (schedule.vehicle && newTotal > schedule.vehicle.capacity) {
          throw new Error(
            `Cannot assign ${input.guestIds.length} guests. Only ${schedule.vehicle.capacity - currentCount} spots available.`
          );
        }

        const assignments = await ctx.db!
          .insert(guestTransportAssignments)
          .values(
            input.guestIds.map((guestId) => ({
              guestId,
              scheduleId: input.scheduleId,
              assignmentType: input.assignmentType,
            }))
          )
          .returning();

        return assignments;
      }),
  }),

  // ============ DASHBOARD ============

  dashboard: router({
    todaySchedule: transportProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split('T')[0];

      if (ctx.isDemoMode) {
        return mockSchedules.filter((s) => s.scheduleDate === today);
      }

      if (useSupabase(ctx)) {
        const { data, error } = await ctx.supabase!
          .from('transport_schedules')
          .select(`
            *,
            vehicle:vehicles (*),
            assignments:guest_transport_assignments (
              *,
              guest:guests (*)
            )
          `)
          .eq('schedule_date', today)
          .order('pickup_time', { ascending: true });

        if (error) throw new Error(error.message);
        return data || [];
      }

      return ctx.db!.query.transportSchedules.findMany({
        where: eq(transportSchedules.scheduleDate, today),
        orderBy: asc(transportSchedules.pickupTime),
        with: {
          vehicle: true,
          assignments: {
            with: {
              guest: true,
            },
          },
        },
      });
    }),

    unassignedGuests: transportProcedure
      .input(
        z.object({
          direction: z.enum(['arrival', 'departure']),
          date: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { direction, date } = input;

        if (ctx.isDemoMode) {
          return mockGuests.filter((g) => {
            const needsTransfer = direction === 'arrival' ? g.needsArrivalTransfer : g.needsDepartureTransfer;
            const matchesDate = !date || (direction === 'arrival' ? g.arrivalDate === date : g.departureDate === date);
            return needsTransfer && matchesDate;
          });
        }

        if (useSupabase(ctx)) {
          const needsTransferColumn = direction === 'arrival' ? 'needs_arrival_transfer' : 'needs_departure_transfer';
          const dateColumn = direction === 'arrival' ? 'arrival_date' : 'departure_date';

          let query = ctx.supabase!
            .from('guests')
            .select(`
              *,
              transport_assignments:guest_transport_assignments (*)
            `)
            .is('deleted_at', null)
            .eq(needsTransferColumn, true);

          if (date) {
            query = query.eq(dateColumn, date);
          }

          const { data, error } = await query;

          if (error) throw new Error(error.message);

          // Filter out guests who already have assignment for this direction
          return (data || [])
            .filter((guest) =>
              !guest.transport_assignments?.some(
                (a: { assignment_type: string }) => a.assignment_type === direction
              )
            )
            .map(g => ({
              id: g.id,
              firstName: g.first_name,
              lastName: g.last_name,
              email: g.email,
              phone: g.phone,
              arrivalDate: g.arrival_date,
              arrivalTime: g.arrival_time,
              arrivalFlightNumber: g.arrival_flight_number,
              departureDate: g.departure_date,
              departureTime: g.departure_time,
              departureFlightNumber: g.departure_flight_number,
              needsArrivalTransfer: g.needs_arrival_transfer,
              needsDepartureTransfer: g.needs_departure_transfer,
              travelType: g.travel_type,
            }));
        }

        const allGuests = await ctx.db!.query.guests.findMany({
          where: and(
            isNull(guests.deletedAt),
            direction === 'arrival'
              ? eq(guests.needsArrivalTransfer, true)
              : eq(guests.needsDepartureTransfer, true),
            date
              ? direction === 'arrival'
                ? eq(guests.arrivalDate, date)
                : eq(guests.departureDate, date)
              : undefined
          ),
          with: {
            transportAssignments: true,
          },
        });

        return allGuests.filter(
          (guest) =>
            !guest.transportAssignments.some(
              (a) => a.assignmentType === direction
            )
        );
      }),

    stats: transportProcedure.query(async ({ ctx }) => {
      if (ctx.isDemoMode) {
        const arrivalNeedingTransfer = mockGuests.filter((g) => g.needsArrivalTransfer).length;
        const departureNeedingTransfer = mockGuests.filter((g) => g.needsDepartureTransfer).length;
        const arrivalAssigned = mockSchedules.filter((s) => s.direction === 'arrival')
          .reduce((acc, s) => acc + (s.assignments?.length || 0), 0);
        const departureAssigned = mockSchedules.filter((s) => s.direction === 'departure')
          .reduce((acc, s) => acc + (s.assignments?.length || 0), 0);
        const today = new Date().toISOString().split('T')[0];
        const todaySchedules = mockSchedules.filter((s) => s.scheduleDate === today).length;

        return {
          arrivalNeedingTransfer,
          departureNeedingTransfer,
          arrivalAssigned,
          departureAssigned,
          todaySchedules,
        };
      }

      if (useSupabase(ctx)) {
        const today = new Date().toISOString().split('T')[0];

        // Get counts using separate queries for Supabase
        const { count: arrivalCount } = await ctx.supabase!
          .from('guests')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('needs_arrival_transfer', true);

        const { count: departureCount } = await ctx.supabase!
          .from('guests')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('needs_departure_transfer', true);

        const { count: arrivalAssigned } = await ctx.supabase!
          .from('guest_transport_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('assignment_type', 'arrival');

        const { count: departureAssigned } = await ctx.supabase!
          .from('guest_transport_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('assignment_type', 'departure');

        const { count: todaySchedules } = await ctx.supabase!
          .from('transport_schedules')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_date', today);

        return {
          arrivalNeedingTransfer: arrivalCount || 0,
          departureNeedingTransfer: departureCount || 0,
          arrivalAssigned: arrivalAssigned || 0,
          departureAssigned: departureAssigned || 0,
          todaySchedules: todaySchedules || 0,
        };
      }

      const today = new Date().toISOString().split('T')[0];

      const [arrivalStats] = await ctx.db!
        .select({
          total: count(),
        })
        .from(guests)
        .where(and(isNull(guests.deletedAt), eq(guests.needsArrivalTransfer, true)));

      const [departureStats] = await ctx.db!
        .select({
          total: count(),
        })
        .from(guests)
        .where(and(isNull(guests.deletedAt), eq(guests.needsDepartureTransfer, true)));

      const [assignedStats] = await ctx.db!
        .select({
          arrivals: sql<number>`count(*) filter (where ${guestTransportAssignments.assignmentType} = 'arrival')`,
          departures: sql<number>`count(*) filter (where ${guestTransportAssignments.assignmentType} = 'departure')`,
        })
        .from(guestTransportAssignments);

      const [scheduleStats] = await ctx.db!
        .select({
          total: count(),
        })
        .from(transportSchedules)
        .where(eq(transportSchedules.scheduleDate, today));

      return {
        arrivalNeedingTransfer: arrivalStats.total,
        departureNeedingTransfer: departureStats.total,
        arrivalAssigned: assignedStats.arrivals,
        departureAssigned: assignedStats.departures,
        todaySchedules: scheduleStats.total,
      };
    }),

    // Get delayed flights that impact scheduled transfers
    delayedFlights: transportProcedure
      .input(
        z.object({
          date: z.string().optional(),
          direction: z.enum(['arrival', 'departure']).optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const targetDate = input?.date || new Date().toISOString().split('T')[0];

        if (ctx.isDemoMode) {
          return {
            impactedSchedules: [],
            delayedGuests: [],
            availableCapacity: [],
          };
        }

        if (useSupabase(ctx)) {
          // Build query for guests on target date
          let guestQuery = ctx.supabase!
            .from('guests')
            .select(`
              *,
              transport_assignments:guest_transport_assignments (
                *,
                schedule:transport_schedules (
                  *,
                  vehicle:vehicles (*)
                )
              )
            `)
            .is('deleted_at', null);

          // Add date filters
          if (input?.direction === 'arrival' || !input?.direction) {
            guestQuery = guestQuery.eq('arrival_date', targetDate);
          }
          if (input?.direction === 'departure') {
            guestQuery = guestQuery.eq('departure_date', targetDate);
          }

          const { data: guestsData, error: guestsError } = await guestQuery;

          if (guestsError) throw new Error(guestsError.message);

          // Filter to guests with delays
          const delayedGuests = (guestsData || []).filter((guest) => {
            if (input?.direction === 'arrival' || !input?.direction) {
              if (guest.arrival_time_mismatch ||
                  guest.arrival_flight_status === 'cancelled' ||
                  guest.arrival_flight_status === 'diverted') {
                return true;
              }
            }
            if (input?.direction === 'departure' || !input?.direction) {
              if (guest.departure_time_mismatch ||
                  guest.departure_flight_status === 'cancelled' ||
                  guest.departure_flight_status === 'diverted') {
                return true;
              }
            }
            return false;
          });

          // Get schedules with available capacity
          const { data: schedulesData } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (*)
            `)
            .eq('schedule_date', targetDate);

          const availableCapacity = (schedulesData || [])
            .filter((s) => {
              if (!s.vehicle) return false;
              const used = s.assignments?.length || 0;
              return used < s.vehicle.capacity;
            })
            .map((s) => ({
              scheduleId: s.id,
              vehicleName: s.vehicle?.name || 'Unknown',
              direction: s.direction,
              pickupTime: s.pickup_time,
              currentCount: s.assignments?.length || 0,
              capacity: s.vehicle?.capacity || 0,
              availableSpots: (s.vehicle?.capacity || 0) - (s.assignments?.length || 0),
            }));

          return {
            delayedGuests: delayedGuests.map((g) => ({
              id: g.id,
              name: `${g.first_name} ${g.last_name}`,
              arrivalFlight: g.arrival_flight_number,
              arrivalTime: g.arrival_time,
              arrivalVerifiedTime: g.arrival_verified_time,
              arrivalStatus: g.arrival_flight_status,
              arrivalTimeMismatch: g.arrival_time_mismatch,
              departureFlight: g.departure_flight_number,
              departureTime: g.departure_time,
              departureVerifiedTime: g.departure_verified_time,
              departureStatus: g.departure_flight_status,
              departureTimeMismatch: g.departure_time_mismatch,
              currentAssignments: (g.transport_assignments || []).map((a: Record<string, unknown>) => ({
                id: a.id,
                type: a.assignment_type,
                scheduleId: a.schedule_id,
                scheduledPickup: (a.schedule as Record<string, unknown>)?.pickup_time,
                vehicleName: ((a.schedule as Record<string, unknown>)?.vehicle as Record<string, unknown>)?.name,
              })),
            })),
            impactedScheduleCount: new Set(
              delayedGuests.flatMap((g) =>
                (g.transport_assignments || []).map((a: { schedule_id: string }) => a.schedule_id)
              )
            ).size,
            availableCapacity,
          };
        }

        // Find all guests with delayed/changed flights who have transport assignments
        const guestsWithDelays = await ctx.db!.query.guests.findMany({
          where: and(
            isNull(guests.deletedAt),
            input?.direction === 'arrival' || !input?.direction
              ? eq(guests.arrivalDate, targetDate)
              : undefined,
            input?.direction === 'departure' || !input?.direction
              ? eq(guests.departureDate, targetDate)
              : undefined
          ),
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

        // Filter to guests with time mismatches or status changes
        const delayedGuests = guestsWithDelays.filter((guest) => {
          if (input?.direction === 'arrival' || !input?.direction) {
            if (guest.arrivalTimeMismatch ||
                guest.arrivalFlightStatus === 'cancelled' ||
                guest.arrivalFlightStatus === 'diverted') {
              return true;
            }
          }
          if (input?.direction === 'departure' || !input?.direction) {
            if (guest.departureTimeMismatch ||
                guest.departureFlightStatus === 'cancelled' ||
                guest.departureFlightStatus === 'diverted') {
              return true;
            }
          }
          return false;
        });

        // Get impacted schedules
        const impactedScheduleIds = new Set<string>();
        delayedGuests.forEach((guest) => {
          guest.transportAssignments.forEach((a) => {
            impactedScheduleIds.add(a.scheduleId);
          });
        });

        // Get schedules with available capacity for reallocation
        const allSchedules = await ctx.db!.query.transportSchedules.findMany({
          where: eq(transportSchedules.scheduleDate, targetDate),
          with: {
            vehicle: true,
            assignments: true,
          },
        });

        const availableCapacity = allSchedules
          .filter((s) => {
            if (!s.vehicle) return false;
            const used = s.assignments.length;
            return used < s.vehicle.capacity;
          })
          .map((s) => ({
            scheduleId: s.id,
            vehicleName: s.vehicle?.name || 'Unknown',
            direction: s.direction,
            pickupTime: s.pickupTime,
            currentCount: s.assignments.length,
            capacity: s.vehicle?.capacity || 0,
            availableSpots: (s.vehicle?.capacity || 0) - s.assignments.length,
          }));

        return {
          delayedGuests: delayedGuests.map((g) => ({
            id: g.id,
            name: `${g.firstName} ${g.lastName}`,
            arrivalFlight: g.arrivalFlightNumber,
            arrivalTime: g.arrivalTime,
            arrivalVerifiedTime: g.arrivalVerifiedTime,
            arrivalStatus: g.arrivalFlightStatus,
            arrivalTimeMismatch: g.arrivalTimeMismatch,
            departureFlight: g.departureFlightNumber,
            departureTime: g.departureTime,
            departureVerifiedTime: g.departureVerifiedTime,
            departureStatus: g.departureFlightStatus,
            departureTimeMismatch: g.departureTimeMismatch,
            currentAssignments: g.transportAssignments.map((a) => ({
              id: a.id,
              type: a.assignmentType,
              scheduleId: a.scheduleId,
              scheduledPickup: a.schedule?.pickupTime,
              vehicleName: a.schedule?.vehicle?.name,
            })),
          })),
          impactedScheduleCount: impactedScheduleIds.size,
          availableCapacity,
        };
      }),

    // Get flight groupings for efficient assignment
    flightGroupings: transportProcedure
      .input(
        z.object({
          date: z.string(),
          direction: z.enum(['arrival', 'departure']),
          timeWindowMinutes: z.number().default(60),
        })
      )
      .query(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return [];
        }

        if (useSupabase(ctx)) {
          const needsTransferColumn = input.direction === 'arrival' ? 'needs_arrival_transfer' : 'needs_departure_transfer';
          const dateColumn = input.direction === 'arrival' ? 'arrival_date' : 'departure_date';

          const { data, error } = await ctx.supabase!
            .from('guests')
            .select(`
              *,
              transport_assignments:guest_transport_assignments (*)
            `)
            .is('deleted_at', null)
            .eq(dateColumn, input.date)
            .eq(needsTransferColumn, true);

          if (error) throw new Error(error.message);

          // Filter to unassigned
          const unassignedGuests = (data || []).filter(
            (g) => !g.transport_assignments?.some((a: { assignment_type: string }) => a.assignment_type === input.direction)
          );

          // Group by time windows
          const timeGroups = new Map<string, typeof unassignedGuests>();

          for (const guest of unassignedGuests) {
            const time = input.direction === 'arrival'
              ? (guest.arrival_verified_time || guest.arrival_time)
              : (guest.departure_verified_time || guest.departure_time);

            if (!time) continue;

            const [hours, mins] = time.split(':').map(Number);
            const totalMins = hours * 60 + mins;
            const windowStart = Math.floor(totalMins / input.timeWindowMinutes) * input.timeWindowMinutes;
            const windowHours = Math.floor(windowStart / 60);
            const windowMins = windowStart % 60;
            const windowKey = `${String(windowHours).padStart(2, '0')}:${String(windowMins).padStart(2, '0')}`;

            if (!timeGroups.has(windowKey)) {
              timeGroups.set(windowKey, []);
            }
            timeGroups.get(windowKey)!.push(guest);
          }

          return Array.from(timeGroups.entries())
            .map(([timeWindow, windowGuests]) => ({
              timeWindow,
              guestCount: windowGuests.length,
              guests: windowGuests.map((g) => ({
                id: g.id,
                name: `${g.first_name} ${g.last_name}`,
                flightNumber: input.direction === 'arrival' ? g.arrival_flight_number : g.departure_flight_number,
                time: input.direction === 'arrival'
                  ? (g.arrival_verified_time || g.arrival_time)
                  : (g.departure_verified_time || g.departure_time),
                status: input.direction === 'arrival' ? g.arrival_flight_status : g.departure_flight_status,
                travelType: g.travel_type,
              })),
            }))
            .sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
        }

        // Get all unassigned guests for this date/direction
        const allGuests = await ctx.db!.query.guests.findMany({
          where: and(
            isNull(guests.deletedAt),
            input.direction === 'arrival'
              ? and(
                  eq(guests.arrivalDate, input.date),
                  eq(guests.needsArrivalTransfer, true)
                )
              : and(
                  eq(guests.departureDate, input.date),
                  eq(guests.needsDepartureTransfer, true)
                )
          ),
          with: {
            transportAssignments: true,
          },
        });

        // Filter to unassigned
        const unassignedGuests = allGuests.filter(
          (g) => !g.transportAssignments.some((a) => a.assignmentType === input.direction)
        );

        // Group by time windows
        const timeGroups = new Map<string, typeof unassignedGuests>();

        for (const guest of unassignedGuests) {
          const time = input.direction === 'arrival'
            ? (guest.arrivalVerifiedTime || guest.arrivalTime)
            : (guest.departureVerifiedTime || guest.departureTime);

          if (!time) continue;

          const [hours, mins] = time.split(':').map(Number);
          const totalMins = hours * 60 + mins;
          const windowStart = Math.floor(totalMins / input.timeWindowMinutes) * input.timeWindowMinutes;
          const windowHours = Math.floor(windowStart / 60);
          const windowMins = windowStart % 60;
          const windowKey = `${String(windowHours).padStart(2, '0')}:${String(windowMins).padStart(2, '0')}`;

          if (!timeGroups.has(windowKey)) {
            timeGroups.set(windowKey, []);
          }
          timeGroups.get(windowKey)!.push(guest);
        }

        return Array.from(timeGroups.entries())
          .map(([timeWindow, windowGuests]) => ({
            timeWindow,
            guestCount: windowGuests.length,
            guests: windowGuests.map((g) => ({
              id: g.id,
              name: `${g.firstName} ${g.lastName}`,
              flightNumber: input.direction === 'arrival' ? g.arrivalFlightNumber : g.departureFlightNumber,
              time: input.direction === 'arrival'
                ? (g.arrivalVerifiedTime || g.arrivalTime)
                : (g.departureVerifiedTime || g.departureTime),
              status: input.direction === 'arrival' ? g.arrivalFlightStatus : g.departureFlightStatus,
              travelType: g.travelType,
            })),
          }))
          .sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
      }),

    // Quick reassign guest to different schedule
    reassignGuest: transportProcedure
      .input(
        z.object({
          guestId: z.string().uuid(),
          fromScheduleId: z.string().uuid(),
          toScheduleId: z.string().uuid(),
          assignmentType: z.enum(['arrival', 'departure']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return { success: true };
        }

        if (useSupabase(ctx)) {
          // Check target schedule capacity
          const { data: targetSchedule } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (*)
            `)
            .eq('id', input.toScheduleId)
            .single();

          if (!targetSchedule) {
            throw new Error('Target schedule not found');
          }

          if (targetSchedule.vehicle &&
              (targetSchedule.assignments?.length || 0) >= targetSchedule.vehicle.capacity) {
            throw new Error('Target vehicle is at full capacity');
          }

          // Find current assignment
          const { data: currentAssignment } = await ctx.supabase!
            .from('guest_transport_assignments')
            .select('*')
            .eq('guest_id', input.guestId)
            .eq('schedule_id', input.fromScheduleId)
            .eq('assignment_type', input.assignmentType)
            .single();

          if (!currentAssignment) {
            throw new Error('Current assignment not found');
          }

          // Delete old assignment
          await ctx.supabase!
            .from('guest_transport_assignments')
            .delete()
            .eq('id', currentAssignment.id);

          // Create new assignment
          const { data: newAssignment, error } = await ctx.supabase!
            .from('guest_transport_assignments')
            .insert({
              guest_id: input.guestId,
              schedule_id: input.toScheduleId,
              assignment_type: input.assignmentType,
            })
            .select()
            .single();

          if (error) throw new Error(error.message);

          return { success: true, newAssignment };
        }

        // Check target schedule capacity
        const targetSchedule = await ctx.db!.query.transportSchedules.findFirst({
          where: eq(transportSchedules.id, input.toScheduleId),
          with: {
            vehicle: true,
            assignments: true,
          },
        });

        if (!targetSchedule) {
          throw new Error('Target schedule not found');
        }

        if (targetSchedule.vehicle &&
            targetSchedule.assignments.length >= targetSchedule.vehicle.capacity) {
          throw new Error('Target vehicle is at full capacity');
        }

        // Find and remove current assignment
        const currentAssignment = await ctx.db!.query.guestTransportAssignments.findFirst({
          where: and(
            eq(guestTransportAssignments.guestId, input.guestId),
            eq(guestTransportAssignments.scheduleId, input.fromScheduleId),
            eq(guestTransportAssignments.assignmentType, input.assignmentType)
          ),
        });

        if (!currentAssignment) {
          throw new Error('Current assignment not found');
        }

        // Delete old assignment
        await ctx.db!
          .delete(guestTransportAssignments)
          .where(eq(guestTransportAssignments.id, currentAssignment.id));

        // Create new assignment
        const [newAssignment] = await ctx.db!
          .insert(guestTransportAssignments)
          .values({
            guestId: input.guestId,
            scheduleId: input.toScheduleId,
            assignmentType: input.assignmentType,
          })
          .returning();

        // Log the reassignment
        await ctx.db!.insert(auditLogs).values({
          entityType: 'assignment',
          entityId: newAssignment.id,
          action: 'update',
          changes: [
            {
              field: 'scheduleId',
              oldValue: input.fromScheduleId,
              newValue: input.toScheduleId,
              fieldType: 'string',
            },
          ],
          changeSource: 'manual',
          performedBy: ctx.user!.id,
        });

        return { success: true, newAssignment };
      }),

    // Suggest reallocation for delayed guests
    suggestReallocation: transportProcedure
      .input(
        z.object({
          guestId: z.string().uuid(),
          direction: z.enum(['arrival', 'departure']),
        })
      )
      .query(async ({ ctx, input }) => {
        if (ctx.isDemoMode) {
          return [];
        }

        if (useSupabase(ctx)) {
          // Get the guest
          const { data: guest } = await ctx.supabase!
            .from('guests')
            .select('*')
            .eq('id', input.guestId)
            .single();

          if (!guest) {
            throw new Error('Guest not found');
          }

          const targetDate = input.direction === 'arrival'
            ? guest.arrival_date
            : guest.departure_date;
          const targetTime = input.direction === 'arrival'
            ? (guest.arrival_verified_time || guest.arrival_time)
            : (guest.departure_verified_time || guest.departure_time);

          if (!targetDate || !targetTime) {
            return [];
          }

          // Find schedules on the same date with available capacity
          const { data: schedules } = await ctx.supabase!
            .from('transport_schedules')
            .select(`
              *,
              vehicle:vehicles (*),
              assignments:guest_transport_assignments (*)
            `)
            .eq('schedule_date', targetDate)
            .eq('direction', input.direction);

          // Calculate time difference and score each schedule
          const [targetHours, targetMins] = targetTime.split(':').map(Number);
          const targetTotalMins = targetHours * 60 + targetMins;

          const suggestions = (schedules || [])
            .filter((s) => {
              if (!s.vehicle) return false;
              return (s.assignments?.length || 0) < s.vehicle.capacity;
            })
            .map((s) => {
              const [pickupHours, pickupMins] = s.pickup_time.split(':').map(Number);
              const pickupTotalMins = pickupHours * 60 + pickupMins;
              const timeDiff = Math.abs(pickupTotalMins - targetTotalMins);

              const timeScore = Math.max(0, 100 - timeDiff);
              const capacityScore = ((s.vehicle?.capacity || 0) - (s.assignments?.length || 0)) * 10;
              const totalScore = timeScore + capacityScore;

              return {
                scheduleId: s.id,
                vehicleName: s.vehicle?.name || 'Unknown',
                pickupTime: s.pickup_time,
                pickupLocation: s.pickup_location,
                currentCount: s.assignments?.length || 0,
                capacity: s.vehicle?.capacity || 0,
                availableSpots: (s.vehicle?.capacity || 0) - (s.assignments?.length || 0),
                timeDifferenceMinutes: timeDiff,
                score: totalScore,
                isRecommended: timeDiff <= 60,
              };
            })
            .sort((a, b) => b.score - a.score);

          return suggestions;
        }

        // Get the guest
        const guest = await ctx.db!.query.guests.findFirst({
          where: eq(guests.id, input.guestId),
        });

        if (!guest) {
          throw new Error('Guest not found');
        }

        const targetDate = input.direction === 'arrival'
          ? guest.arrivalDate
          : guest.departureDate;
        const targetTime = input.direction === 'arrival'
          ? (guest.arrivalVerifiedTime || guest.arrivalTime)
          : (guest.departureVerifiedTime || guest.departureTime);

        if (!targetDate || !targetTime) {
          return [];
        }

        // Find schedules on the same date with available capacity
        const schedules = await ctx.db!.query.transportSchedules.findMany({
          where: and(
            eq(transportSchedules.scheduleDate, targetDate),
            eq(transportSchedules.direction, input.direction)
          ),
          with: {
            vehicle: true,
            assignments: true,
          },
        });

        // Calculate time difference and score each schedule
        const [targetHours, targetMins] = targetTime.split(':').map(Number);
        const targetTotalMins = targetHours * 60 + targetMins;

        const suggestions = schedules
          .filter((s) => {
            if (!s.vehicle) return false;
            return s.assignments.length < s.vehicle.capacity;
          })
          .map((s) => {
            const [pickupHours, pickupMins] = s.pickupTime.split(':').map(Number);
            const pickupTotalMins = pickupHours * 60 + pickupMins;
            const timeDiff = Math.abs(pickupTotalMins - targetTotalMins);

            const timeScore = Math.max(0, 100 - timeDiff);
            const capacityScore = ((s.vehicle?.capacity || 0) - s.assignments.length) * 10;
            const totalScore = timeScore + capacityScore;

            return {
              scheduleId: s.id,
              vehicleName: s.vehicle?.name || 'Unknown',
              pickupTime: s.pickupTime,
              pickupLocation: s.pickupLocation,
              currentCount: s.assignments.length,
              capacity: s.vehicle?.capacity || 0,
              availableSpots: (s.vehicle?.capacity || 0) - s.assignments.length,
              timeDifferenceMinutes: timeDiff,
              score: totalScore,
              isRecommended: timeDiff <= 60,
            };
          })
          .sort((a, b) => b.score - a.score);

        return suggestions;
      }),
  }),

  // ============ PRE-PLANNED TRANSPORT GROUPS ============

  prePlannedGroups: router({
    // Get pre-planned transport groups for a specific date
    getByDate: transportProcedure
      .input(z.object({ date: z.string() }))
      .query(({ input }) => {
        const schedule = getTransportGroupsForDate(input.date);
        if (!schedule) {
          return null;
        }

        return {
          date: input.date,
          direction: schedule.direction,
          groups: schedule.groups.map((group) => ({
            ...group,
            vehicleInfo: VEHICLE_TYPES[group.vehicleType],
          })),
          totalPax: schedule.groups.reduce((acc, g) => acc + g.combinedPax, 0),
          totalGroups: schedule.groups.length,
        };
      }),

    // Get all dates that have pre-planned transport
    getScheduledDates: transportProcedure.query(() => {
      return getScheduledTransportDates();
    }),

    // Get summary of all pre-planned transport
    getSummary: transportProcedure.query(() => {
      const dates = getScheduledTransportDates();
      return dates.map((date) => {
        const schedule = getTransportGroupsForDate(date);
        if (!schedule) return null;

        const vehicleCounts: Record<string, number> = {};
        schedule.groups.forEach((g) => {
          vehicleCounts[g.vehicleType] = (vehicleCounts[g.vehicleType] || 0) + 1;
        });

        return {
          date,
          direction: schedule.direction,
          totalGroups: schedule.groups.length,
          totalPax: schedule.groups.reduce((acc, g) => acc + g.combinedPax, 0),
          vehicleCounts,
        };
      }).filter(Boolean);
    }),
  }),
});
