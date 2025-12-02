import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import type { ImportDiff, FieldChange } from '@/types';

// Column mapping schema
const columnMappingSchema = z.record(z.string(), z.string().nullable());

// Import preview schema
const importPreviewSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  columnMapping: columnMappingSchema,
  filename: z.string(),
  filePath: z.string().optional(), // Storage path for original file
  fileUrl: z.string().optional(),  // URL for original file
});

// Fields to track for diff
const TRACKED_FIELDS = [
  'email',
  'salutation',
  'first_name',
  'last_name',
  'axis_email',
  'reporting_level_1',
  'reporting_level_2',
  'reporting_level_3',
  'function',
  'location',
  'arrival_date',
  'arrival_time',
  'arrival_flight_number',
  'arrival_airport',
  'arrival_flight_route',
  'departure_date',
  'departure_time',
  'departure_flight_number',
  'departure_airport',
  'departure_flight_route',
  'hotel_checkin_date',
  'hotel_checkout_date',
  'hotel_confirmation_number',
  'extend_stay_before',
  'extend_stay_after',
  'early_checkin',
  'late_checkout',
  'needs_arrival_transfer',
  'needs_departure_transfer',
  'registration_status',
  'travel_type',
];

// Map camelCase field names to snake_case for database
const fieldNameMapping: Record<string, string> = {
  salutation: 'salutation',
  firstName: 'first_name',
  lastName: 'last_name',
  axisEmail: 'axis_email',
  reportingLevel1: 'reporting_level_1',
  reportingLevel2: 'reporting_level_2',
  reportingLevel3: 'reporting_level_3',
  arrivalDate: 'arrival_date',
  arrivalTime: 'arrival_time',
  arrivalFlightNumber: 'arrival_flight_number',
  arrivalAirport: 'arrival_airport',
  arrivalFlightRoute: 'arrival_flight_route',
  departureDate: 'departure_date',
  departureTime: 'departure_time',
  departureFlightNumber: 'departure_flight_number',
  departureAirport: 'departure_airport',
  departureFlightRoute: 'departure_flight_route',
  hotelCheckinDate: 'hotel_checkin_date',
  hotelCheckoutDate: 'hotel_checkout_date',
  hotelConfirmationNumber: 'hotel_confirmation_number',
  extendStayBefore: 'extend_stay_before',
  extendStayAfter: 'extend_stay_after',
  earlyCheckin: 'early_checkin',
  lateCheckout: 'late_checkout',
  needsArrivalTransfer: 'needs_arrival_transfer',
  needsDepartureTransfer: 'needs_departure_transfer',
  registrationStatus: 'registration_status',
  travelType: 'travel_type',
};

// Convert camelCase object to snake_case for database
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = fieldNameMapping[key] || key;
    result[snakeKey] = value;
  }
  return result;
}

// Helper to compare values
function compareValues(oldVal: unknown, newVal: unknown): boolean {
  if (oldVal === newVal) return true;
  if (oldVal === null && newVal === undefined) return true;
  if (oldVal === undefined && newVal === null) return true;
  if (oldVal === null && newVal === '') return true;
  if (oldVal === '' && newVal === null) return true;

  // Date comparison
  if (oldVal instanceof Date && typeof newVal === 'string') {
    return oldVal.toISOString().split('T')[0] === newVal;
  }
  if (typeof oldVal === 'string' && newVal instanceof Date) {
    return oldVal === newVal.toISOString().split('T')[0];
  }

  // String comparison (trim both)
  if (typeof oldVal === 'string' && typeof newVal === 'string') {
    return oldVal.trim() === newVal.trim();
  }

  return false;
}

// Helper to get field type
function getFieldType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  return 'string';
}

export const importRouter = router({
  // Preview import - calculate diff
  preview: protectedProcedure
    .input(importPreviewSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, columnMapping, filename, filePath, fileUrl } = input;

      if (!ctx.supabase) {
        throw new Error('Database not configured');
      }

      // Get all existing guests
      const { data: existingGuests, error: fetchError } = await ctx.supabase
        .from('guests')
        .select('*')
        .is('deleted_at', null);

      if (fetchError) {
        throw new Error(`Failed to fetch guests: ${fetchError.message}`);
      }

      // Create lookup by email
      const existingByEmail = new Map(
        (existingGuests || []).map((g) => [g.email?.toLowerCase(), g])
      );

      // Track which existing guests are in import
      const matchedIds = new Set<string>();

      // Calculate diff
      const diff: ImportDiff = {
        added: [],
        modified: [],
        removed: [],
        unchanged: [],
        errors: [],
      };

      // Process each row
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];

        // Map columns to guest fields (already mapped from Excel)
        const mappedData: Record<string, unknown> = { ...row };

        // Validate required fields
        const errors: string[] = [];
        if (!mappedData.email) {
          errors.push('Email is required');
        }
        if (!mappedData.firstName) {
          errors.push('First name is required');
        }
        if (!mappedData.lastName) {
          errors.push('Last name is required');
        }

        if (errors.length > 0) {
          diff.errors.push({
            row: rowIndex + 2, // +2 for header and 0-indexing
            email: mappedData.email as string | undefined,
            errors,
          });
          continue;
        }

        const email = (mappedData.email as string).toLowerCase();
        const existing = existingByEmail.get(email);

        // Convert to snake_case for comparison with database
        const snakeCaseData = toSnakeCase(mappedData);

        if (existing) {
          // Check for changes
          matchedIds.add(existing.id);

          const changes: FieldChange[] = [];
          for (const field of TRACKED_FIELDS) {
            const oldValue = existing[field];
            const newValue = snakeCaseData[field];

            if (!compareValues(oldValue, newValue)) {
              changes.push({
                field,
                oldValue,
                newValue,
                fieldType: getFieldType(newValue) as 'string' | 'date' | 'boolean' | 'number' | 'enum',
              });
            }
          }

          if (changes.length > 0) {
            diff.modified.push({
              existing,
              changes,
              newData: snakeCaseData,
            });
          } else {
            diff.unchanged.push(existing);
          }
        } else {
          // New guest
          diff.added.push(snakeCaseData);
        }
      }

      // Find removed guests (in DB but not in import)
      for (const guest of existingGuests || []) {
        if (!matchedIds.has(guest.id)) {
          diff.removed.push(guest);
        }
      }

      // Create import session in pending state with raw data for comparison
      const { data: session, error: sessionError } = await ctx.supabase
        .from('import_sessions')
        .insert({
          filename,
          uploaded_by: ctx.user.id,
          status: 'pending',
          total_rows: data.length,
          rows_added: diff.added.length,
          rows_modified: diff.modified.length,
          rows_removed: diff.removed.length,
          rows_unchanged: diff.unchanged.length,
          rows_error: diff.errors.length,
          error_details: diff.errors.length > 0 ? { errors: diff.errors } : null,
          raw_data: data, // Store original import data for comparison
          file_path: filePath || null, // Storage path for original Excel file
          file_url: fileUrl || null,   // URL for original Excel file
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        // Continue without session if table doesn't exist
      }

      return {
        sessionId: session?.id || 'temp-session',
        diff,
        summary: {
          added: diff.added.length,
          modified: diff.modified.length,
          removed: diff.removed.length,
          unchanged: diff.unchanged.length,
          errors: diff.errors.length,
        },
      };
    }),

  // Execute import
  executeImport: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        diff: z.object({
          added: z.array(z.record(z.string(), z.unknown())),
          modified: z.array(
            z.object({
              existing: z.any(),
              changes: z.array(
                z.object({
                  field: z.string(),
                  oldValue: z.unknown(),
                  newValue: z.unknown(),
                  fieldType: z.string(),
                })
              ),
              newData: z.record(z.string(), z.unknown()),
            })
          ),
          removed: z.array(z.any()),
        }),
        removeDeleted: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, diff, removeDeleted } = input;

      if (!ctx.supabase) {
        throw new Error('Database not configured');
      }

      // Update session status if it exists
      if (sessionId !== 'temp-session') {
        await ctx.supabase
          .from('import_sessions')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      try {
        let addedCount = 0;
        let modifiedCount = 0;
        let removedCount = 0;

        // Process added guests
        for (const guestData of diff.added) {
          const { error: insertError } = await ctx.supabase
            .from('guests')
            .insert(guestData);

          if (insertError) {
            console.error('Insert error:', insertError);
          } else {
            addedCount++;
          }
        }

        // Process modified guests
        for (const { existing, newData } of diff.modified) {
          const { error: updateError } = await ctx.supabase
            .from('guests')
            .update({
              ...newData,
              version: (existing.version || 1) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Update error:', updateError);
          } else {
            modifiedCount++;
          }
        }

        // Process removed guests (soft delete if removeDeleted is true)
        if (removeDeleted) {
          for (const guest of diff.removed) {
            const { error: deleteError } = await ctx.supabase
              .from('guests')
              .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', guest.id);

            if (deleteError) {
              console.error('Delete error:', deleteError);
            } else {
              removedCount++;
            }
          }
        }

        // Update session status
        if (sessionId !== 'temp-session') {
          await ctx.supabase
            .from('import_sessions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              rows_removed: removeDeleted ? removedCount : 0,
            })
            .eq('id', sessionId);
        }

        return {
          success: true,
          sessionId,
          results: {
            added: addedCount,
            modified: modifiedCount,
            removed: removedCount,
          },
        };
      } catch (error) {
        // Update session status on failure
        if (sessionId !== 'temp-session') {
          await ctx.supabase
            .from('import_sessions')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_details: { error: String(error) },
            })
            .eq('id', sessionId);
        }

        throw error;
      }
    }),

  // Get import sessions
  getSessions: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      if (!ctx.supabase) {
        return [];
      }

      const { data: sessions, error } = await ctx.supabase
        .from('import_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error fetching sessions:', error);
        return [];
      }

      return sessions || [];
    }),

  // Get specific import session
  getSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        return null;
      }

      const { data: session, error } = await ctx.supabase
        .from('import_sessions')
        .select('*')
        .eq('id', input.id)
        .single();

      if (error) {
        console.error('Error fetching session:', error);
        return null;
      }

      return session;
    }),
});
