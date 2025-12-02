/**
 * MCP-style Tools for Chatbot
 *
 * These tools follow the Model Context Protocol pattern, providing
 * structured database access that the LLM can call via tool use.
 *
 * Benefits:
 * - Type-safe tool definitions with Zod schemas
 * - Clear separation of concerns
 * - Easy to extend with new capabilities
 * - Compatible with any LLM that supports tool/function calling
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// Tool Definitions (MCP-style)
// ============================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<Record<string, z.ZodTypeAny>>;
  execute: (params: Record<string, unknown>, supabase: SupabaseClient) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================
// Guest Tools
// ============================================

export const countGuestsTool: ToolDefinition = {
  name: 'count_guests',
  description: 'Count the total number of guests, optionally filtered by criteria like location, registration status, or date',
  parameters: z.object({
    location: z.string().optional().describe('Filter by location (e.g., "Japan", "USA")'),
    registration_status: z.enum(['confirmed', 'pending', 'cancelled', 'waitlisted']).optional().describe('Filter by registration status'),
    needs_arrival_transfer: z.boolean().optional().describe('Filter by whether guest needs arrival transfer'),
    needs_departure_transfer: z.boolean().optional().describe('Filter by whether guest needs departure transfer'),
    arrival_date: z.string().optional().describe('Filter by arrival date (YYYY-MM-DD format)'),
    departure_date: z.string().optional().describe('Filter by departure date (YYYY-MM-DD format)'),
  }),
  execute: async (params, supabase) => {
    let query = supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .or('is_removed.eq.false,is_removed.is.null');

    if (params.location) {
      query = query.ilike('location', `%${params.location}%`);
    }
    if (params.registration_status) {
      query = query.eq('registration_status', params.registration_status);
    }
    if (params.needs_arrival_transfer !== undefined) {
      query = query.eq('needs_arrival_transfer', params.needs_arrival_transfer);
    }
    if (params.needs_departure_transfer !== undefined) {
      query = query.eq('needs_departure_transfer', params.needs_departure_transfer);
    }
    if (params.arrival_date) {
      query = query.eq('arrival_date', params.arrival_date);
    }
    if (params.departure_date) {
      query = query.eq('departure_date', params.departure_date);
    }

    const { count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        count: count || 0,
        filters_applied: Object.entries(params).filter(([, v]) => v !== undefined).map(([k]) => k),
      },
    };
  },
};

export const getGuestsTool: ToolDefinition = {
  name: 'get_guests',
  description: 'Get a list of guests with their details, optionally filtered and limited',
  parameters: z.object({
    location: z.string().optional().describe('Filter by location'),
    registration_status: z.enum(['confirmed', 'pending', 'cancelled', 'waitlisted']).optional(),
    arrival_date: z.string().optional().describe('Filter by arrival date (YYYY-MM-DD)'),
    departure_date: z.string().optional().describe('Filter by departure date (YYYY-MM-DD)'),
    search: z.string().optional().describe('Search by name or email'),
    limit: z.coerce.number().max(50).default(20).describe('Maximum number of results'),
    order_by: z.enum(['first_name', 'last_name', 'arrival_date', 'departure_date']).optional(),
  }),
  execute: async (params, supabase) => {
    let query = supabase
      .from('guests')
      .select('id, first_name, last_name, email, location, registration_status, arrival_date, arrival_time, departure_date, departure_time, needs_arrival_transfer, needs_departure_transfer')
      .or('is_removed.eq.false,is_removed.is.null');

    if (params.location) {
      query = query.ilike('location', `%${params.location}%`);
    }
    if (params.registration_status) {
      query = query.eq('registration_status', params.registration_status);
    }
    if (params.arrival_date) {
      query = query.eq('arrival_date', params.arrival_date);
    }
    if (params.departure_date) {
      query = query.eq('departure_date', params.departure_date);
    }
    if (params.search) {
      query = query.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
    }
    if (params.order_by) {
      query = query.order(params.order_by);
    }

    query = query.limit(params.limit || 20);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        guests: data || [],
        count: data?.length || 0,
      },
    };
  },
};

export const getBusiestArrivalDayTool: ToolDefinition = {
  name: 'get_busiest_arrival_day',
  description: 'Find the arrival date with the most guests',
  parameters: z.object({
    top_n: z.coerce.number().max(10).default(1).describe('Number of top days to return'),
  }),
  execute: async (params, supabase) => {
    const query = `
      SELECT arrival_date, COUNT(*) as guest_count
      FROM guests
      WHERE registration_status = 'confirmed'
        AND (is_removed = false OR is_removed IS NULL)
        AND arrival_date IS NOT NULL
      GROUP BY arrival_date
      ORDER BY guest_count DESC
      LIMIT ${params.top_n || 1}
    `.trim();

    const { data, error } = await supabase.rpc('execute_readonly_query', {
      query_text: query,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        busiest_days: data || [],
      },
    };
  },
};

export const getGuestStatsTool: ToolDefinition = {
  name: 'get_guest_stats',
  description: 'Get statistics about guests including counts by status, location breakdown, and transfer needs',
  parameters: z.object({
    group_by: z.enum(['registration_status', 'location', 'arrival_date', 'departure_date']).optional().describe('Group statistics by this field'),
  }),
  execute: async (params, supabase) => {
    const stats: Record<string, unknown> = {};

    // Total count
    const { count: totalCount } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .or('is_removed.eq.false,is_removed.is.null');
    stats.total_guests = totalCount || 0;

    // Count by registration status
    const { data: statusData } = await supabase
      .from('guests')
      .select('registration_status')
      .or('is_removed.eq.false,is_removed.is.null');

    if (statusData) {
      const statusCounts: Record<string, number> = {};
      statusData.forEach((g) => {
        const status = g.registration_status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      stats.by_status = statusCounts;
    }

    // Transfer needs
    const { count: arrivalTransfers } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('needs_arrival_transfer', true)
      .or('is_removed.eq.false,is_removed.is.null');

    const { count: departureTransfers } = await supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('needs_departure_transfer', true)
      .or('is_removed.eq.false,is_removed.is.null');

    stats.transfer_needs = {
      arrival: arrivalTransfers || 0,
      departure: departureTransfers || 0,
    };

    // Group by specific field if requested
    if (params.group_by === 'location') {
      const { data: locationData } = await supabase
        .from('guests')
        .select('location')
        .or('is_removed.eq.false,is_removed.is.null');

      if (locationData) {
        const locationCounts: Record<string, number> = {};
        locationData.forEach((g) => {
          const loc = g.location || 'Unknown';
          locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        });
        stats.by_location = locationCounts;
      }
    }

    return {
      success: true,
      data: stats,
    };
  },
};

// ============================================
// Transport Tools
// ============================================

export const getVehiclesTool: ToolDefinition = {
  name: 'get_vehicles',
  description: 'Get list of available vehicles and their details',
  parameters: z.object({
    active_only: z.boolean().default(true).describe('Only return active vehicles'),
  }),
  execute: async (params, supabase) => {
    let query = supabase
      .from('vehicles')
      .select('id, name, type, capacity, driver_name, driver_phone, license_plate, is_active');

    if (params.active_only) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name');

    if (error) {
      return { success: false, error: error.message };
    }

    const totalCapacity = (data || []).reduce((sum, v) => sum + (v.capacity || 0), 0);

    return {
      success: true,
      data: {
        vehicles: data || [],
        count: data?.length || 0,
        total_capacity: totalCapacity,
      },
    };
  },
};

export const getTransportSchedulesTool: ToolDefinition = {
  name: 'get_transport_schedules',
  description: 'Get transport schedules for a specific date',
  parameters: z.object({
    date: z.string().describe('Date to get schedules for (YYYY-MM-DD)'),
    direction: z.enum(['arrival', 'departure']).optional().describe('Filter by direction'),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  }),
  execute: async (params, supabase) => {
    let query = supabase
      .from('transport_schedules')
      .select(`
        id, direction, schedule_date, pickup_time, pickup_location, dropoff_location, status, notes,
        vehicles (name, type, capacity, driver_name)
      `)
      .eq('schedule_date', params.date);

    if (params.direction) {
      query = query.eq('direction', params.direction);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query.order('pickup_time');

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        schedules: data || [],
        count: data?.length || 0,
        date: params.date,
      },
    };
  },
};

// ============================================
// Import History Tools
// ============================================

export const getImportHistoryTool: ToolDefinition = {
  name: 'get_import_history',
  description: 'Get the history of Excel file imports, showing when files were uploaded, how many rows were added/updated, and whether the original file is available for download',
  parameters: z.object({
    limit: z.coerce.number().max(20).default(10).describe('Maximum number of import sessions to return'),
  }),
  execute: async (params, supabase) => {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('id, filename, status, rows_added, rows_modified, rows_unchanged, rows_error, file_path, file_url, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) {
      return { success: false, error: error.message };
    }

    // Add download availability flag
    const importsWithDownload = (data || []).map((imp) => ({
      ...imp,
      has_original_file: !!imp.file_path,
    }));

    return {
      success: true,
      data: {
        imports: importsWithDownload,
        count: data?.length || 0,
      },
    };
  },
};

export const compareImportsTool: ToolDefinition = {
  name: 'compare_imports',
  description: 'Compare two Excel imports to see the differences - how many rows were added, updated, or unchanged between the latest and previous import',
  parameters: z.object({
    latest_import_id: z.string().optional().describe('ID of the latest import session (defaults to most recent)'),
    previous_import_id: z.string().optional().describe('ID of the previous import session (defaults to second most recent)'),
  }),
  execute: async (params, supabase) => {
    // Get the two most recent imports if not specified
    const { data: imports, error: fetchError } = await supabase
      .from('import_sessions')
      .select('id, filename, status, rows_added, rows_modified, rows_unchanged, rows_error, created_at, completed_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(2);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!imports || imports.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 completed imports to compare. Only found ' + (imports?.length || 0),
      };
    }

    const latestImport = imports[0];
    const previousImport = imports[1];

    // Calculate differences
    const comparison = {
      latest: {
        filename: latestImport.filename,
        date: latestImport.created_at,
        rows_added: latestImport.rows_added || 0,
        rows_modified: latestImport.rows_modified || 0,
        rows_unchanged: latestImport.rows_unchanged || 0,
        rows_error: latestImport.rows_error || 0,
        total_processed: (latestImport.rows_added || 0) + (latestImport.rows_modified || 0) + (latestImport.rows_unchanged || 0),
      },
      previous: {
        filename: previousImport.filename,
        date: previousImport.created_at,
        rows_added: previousImport.rows_added || 0,
        rows_modified: previousImport.rows_modified || 0,
        rows_unchanged: previousImport.rows_unchanged || 0,
        rows_error: previousImport.rows_error || 0,
        total_processed: (previousImport.rows_added || 0) + (previousImport.rows_modified || 0) + (previousImport.rows_unchanged || 0),
      },
      differences: {
        new_guests_in_latest: latestImport.rows_added || 0,
        guests_modified_in_latest: latestImport.rows_modified || 0,
        guests_unchanged: latestImport.rows_unchanged || 0,
        total_change: ((latestImport.rows_added || 0) + (latestImport.rows_modified || 0) + (latestImport.rows_unchanged || 0)) -
                      ((previousImport.rows_added || 0) + (previousImport.rows_modified || 0) + (previousImport.rows_unchanged || 0)),
      },
      summary: `The latest import (${latestImport.filename}) added ${latestImport.rows_added || 0} new guests and modified ${latestImport.rows_modified || 0} existing guests compared to the previous import (${previousImport.filename}).`,
    };

    return {
      success: true,
      data: comparison,
    };
  },
};

export const getImportDetailsTool: ToolDefinition = {
  name: 'get_import_details',
  description: 'Get detailed information about a specific import including the raw data that was imported. Use this to see exactly what guests were in a specific Excel file and to get the download link for the original file.',
  parameters: z.object({
    import_id: z.string().optional().describe('ID of the import session (defaults to most recent)'),
    show_data: z.boolean().default(false).describe('Whether to include the raw imported data'),
    limit: z.coerce.number().max(100).default(20).describe('Maximum number of rows to return from raw data'),
  }),
  execute: async (params, supabase) => {
    let query = supabase
      .from('import_sessions')
      .select('id, filename, status, total_rows, rows_added, rows_modified, rows_removed, rows_unchanged, rows_error, error_details, raw_data, file_path, file_url, created_at, completed_at');

    if (params.import_id) {
      query = query.eq('id', params.import_id);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Import session not found' };
    }

    const result: Record<string, unknown> = {
      id: data.id,
      filename: data.filename,
      status: data.status,
      total_rows: data.total_rows,
      rows_added: data.rows_added,
      rows_modified: data.rows_modified,
      rows_removed: data.rows_removed,
      rows_unchanged: data.rows_unchanged,
      rows_error: data.rows_error,
      created_at: data.created_at,
      completed_at: data.completed_at,
    };

    if (data.error_details) {
      result.errors = data.error_details;
    }

    // Include raw data if requested (limited)
    if (params.show_data && data.raw_data) {
      const rawData = data.raw_data as Record<string, unknown>[];
      result.sample_data = rawData.slice(0, params.limit || 20);
      result.data_preview_count = Math.min(rawData.length, params.limit || 20);
      result.total_data_rows = rawData.length;
    }

    return {
      success: true,
      data: result,
    };
  },
};

export const compareImportDataTool: ToolDefinition = {
  name: 'compare_import_data',
  description: 'Deep compare the actual data between two Excel imports to find specific differences - which guests were added, removed, or had data changes',
  parameters: z.object({
    latest_import_id: z.string().optional().describe('ID of the latest import (defaults to most recent)'),
    previous_import_id: z.string().optional().describe('ID of the previous import (defaults to second most recent)'),
    show_details: z.boolean().default(true).describe('Show detailed list of changes'),
    limit: z.coerce.number().max(50).default(20).describe('Maximum number of detailed changes to return'),
  }),
  execute: async (params, supabase) => {
    // Get the two imports with raw data
    const { data: imports, error: fetchError } = await supabase
      .from('import_sessions')
      .select('id, filename, status, raw_data, created_at')
      .eq('status', 'completed')
      .not('raw_data', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!imports || imports.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 completed imports with data to compare. Found ' + (imports?.length || 0),
      };
    }

    const latestImport = imports[0];
    const previousImport = imports[1];

    const latestData = (latestImport.raw_data || []) as Record<string, unknown>[];
    const previousData = (previousImport.raw_data || []) as Record<string, unknown>[];

    // Create maps by email for comparison
    const latestByEmail = new Map<string, Record<string, unknown>>();
    const previousByEmail = new Map<string, Record<string, unknown>>();

    latestData.forEach((row) => {
      const email = (row.email as string)?.toLowerCase();
      if (email) latestByEmail.set(email, row);
    });

    previousData.forEach((row) => {
      const email = (row.email as string)?.toLowerCase();
      if (email) previousByEmail.set(email, row);
    });

    // Find differences
    const added: Record<string, unknown>[] = [];
    const removed: Record<string, unknown>[] = [];
    const modified: { email: string; changes: { field: string; old: unknown; new: unknown }[] }[] = [];

    // Find added and modified
    latestByEmail.forEach((latestRow, email) => {
      const previousRow = previousByEmail.get(email);
      if (!previousRow) {
        added.push(latestRow);
      } else {
        // Check for modifications
        const changes: { field: string; old: unknown; new: unknown }[] = [];
        const fieldsToCompare = ['firstName', 'lastName', 'location', 'arrivalDate', 'arrivalTime',
          'departureDate', 'departureTime', 'registrationStatus', 'needsArrivalTransfer', 'needsDepartureTransfer'];

        fieldsToCompare.forEach((field) => {
          const oldVal = previousRow[field];
          const newVal = latestRow[field];
          if (String(oldVal || '') !== String(newVal || '')) {
            changes.push({ field, old: oldVal, new: newVal });
          }
        });

        if (changes.length > 0) {
          modified.push({ email, changes });
        }
      }
    });

    // Find removed
    previousByEmail.forEach((previousRow, email) => {
      if (!latestByEmail.has(email)) {
        removed.push(previousRow);
      }
    });

    const result: Record<string, unknown> = {
      latest_file: latestImport.filename,
      latest_date: latestImport.created_at,
      previous_file: previousImport.filename,
      previous_date: previousImport.created_at,
      summary: {
        guests_added: added.length,
        guests_removed: removed.length,
        guests_modified: modified.length,
        guests_unchanged: latestByEmail.size - added.length - modified.length,
        latest_total: latestData.length,
        previous_total: previousData.length,
      },
    };

    if (params.show_details) {
      const limit = params.limit || 20;
      result.added_guests = added.slice(0, limit).map((g) => ({
        email: g.email,
        name: `${g.firstName} ${g.lastName}`,
        location: g.location,
      }));
      result.removed_guests = removed.slice(0, limit).map((g) => ({
        email: g.email,
        name: `${g.firstName} ${g.lastName}`,
        location: g.location,
      }));
      result.modified_guests = modified.slice(0, limit);
    }

    return {
      success: true,
      data: result,
    };
  },
};

// ============================================
// Guest Update Tools (AI-Powered)
// ============================================

export const updateGuestTool: ToolDefinition = {
  name: 'update_guest',
  description: 'Update a guest\'s information. Use this when the user wants to change flight details, transfer needs, hotel dates, or other guest data. Search for the guest by name or email first.',
  parameters: z.object({
    search_name: z.string().describe('Guest name to search for (first name, last name, or both)'),
    search_email: z.string().optional().describe('Optional email to narrow down search'),
    updates: z.object({
      arrival_flight_number: z.string().optional().describe('New arrival flight number'),
      arrival_date: z.string().optional().describe('New arrival date (YYYY-MM-DD)'),
      arrival_time: z.string().optional().describe('New arrival time (HH:MM in 24hr format)'),
      arrival_airport: z.string().optional().describe('New arrival airport'),
      departure_flight_number: z.string().optional().describe('New departure flight number'),
      departure_date: z.string().optional().describe('New departure date (YYYY-MM-DD)'),
      departure_time: z.string().optional().describe('New departure time (HH:MM in 24hr format)'),
      departure_airport: z.string().optional().describe('New departure airport'),
      needs_arrival_transfer: z.boolean().optional().describe('Whether guest needs airport pickup'),
      needs_departure_transfer: z.boolean().optional().describe('Whether guest needs airport dropoff'),
      hotel_checkin_date: z.string().optional().describe('Hotel check-in date (YYYY-MM-DD)'),
      hotel_checkout_date: z.string().optional().describe('Hotel check-out date (YYYY-MM-DD)'),
      registration_status: z.enum(['confirmed', 'pending', 'cancelled', 'waitlisted']).optional(),
    }).describe('Fields to update'),
    reason: z.string().optional().describe('Reason for the update (for audit log)'),
  }),
  execute: async (params, supabase) => {
    // First, find the guest
    const searchTerms = params.search_name.toLowerCase().split(' ').filter(t => t.length > 0);

    let query = supabase
      .from('guests')
      .select('id, first_name, last_name, email, arrival_flight_number, departure_flight_number, needs_arrival_transfer, needs_departure_transfer')
      .or('is_removed.eq.false,is_removed.is.null');

    // Build search conditions
    if (searchTerms.length === 1) {
      // Single term - search both first and last name
      query = query.or(`first_name.ilike.%${searchTerms[0]}%,last_name.ilike.%${searchTerms[0]}%`);
    } else if (searchTerms.length >= 2) {
      // Multiple terms - try first + last name combination
      query = query.or(`and(first_name.ilike.%${searchTerms[0]}%,last_name.ilike.%${searchTerms[searchTerms.length - 1]}%),and(first_name.ilike.%${searchTerms[searchTerms.length - 1]}%,last_name.ilike.%${searchTerms[0]}%)`);
    }

    if (params.search_email) {
      query = query.ilike('email', `%${params.search_email}%`);
    }

    const { data: guests, error: searchError } = await query.limit(5);

    if (searchError) {
      return { success: false, error: `Search error: ${searchError.message}` };
    }

    if (!guests || guests.length === 0) {
      return {
        success: false,
        error: `No guest found matching "${params.search_name}". Please check the name spelling.`
      };
    }

    if (guests.length > 1) {
      return {
        success: false,
        error: `Multiple guests found matching "${params.search_name}": ${guests.map(g => `${g.first_name} ${g.last_name} (${g.email})`).join(', ')}. Please be more specific.`,
        data: { matches: guests }
      };
    }

    const guest = guests[0];

    // Filter out undefined values from updates
    const validUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params.updates)) {
      if (value !== undefined && value !== null) {
        validUpdates[key] = value;
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    // Add updated_at timestamp
    validUpdates.updated_at = new Date().toISOString();

    // Perform the update
    const { error: updateError } = await supabase
      .from('guests')
      .update(validUpdates)
      .eq('id', guest.id);

    if (updateError) {
      return { success: false, error: `Update error: ${updateError.message}` };
    }

    // Build a human-readable summary of changes
    const changesList = Object.entries(validUpdates)
      .filter(([key]) => key !== 'updated_at')
      .map(([key, value]) => {
        const fieldLabels: Record<string, string> = {
          arrival_flight_number: 'Arrival Flight',
          arrival_date: 'Arrival Date',
          arrival_time: 'Arrival Time',
          arrival_airport: 'Arrival Airport',
          departure_flight_number: 'Departure Flight',
          departure_date: 'Departure Date',
          departure_time: 'Departure Time',
          departure_airport: 'Departure Airport',
          needs_arrival_transfer: 'Needs Arrival Transfer',
          needs_departure_transfer: 'Needs Departure Transfer',
          hotel_checkin_date: 'Hotel Check-in',
          hotel_checkout_date: 'Hotel Check-out',
          registration_status: 'Registration Status',
        };
        return `${fieldLabels[key] || key}: ${value}`;
      });

    return {
      success: true,
      data: {
        guest_id: guest.id,
        guest_name: `${guest.first_name} ${guest.last_name}`,
        guest_email: guest.email,
        updates_applied: validUpdates,
        changes_summary: changesList,
        reason: params.reason || 'Manual update via chatbot',
      },
    };
  },
};

export const findGuestTool: ToolDefinition = {
  name: 'find_guest',
  description: 'Find a specific guest by name or email to get their current details before making updates',
  parameters: z.object({
    search: z.string().describe('Name or email to search for'),
  }),
  execute: async (params, supabase) => {
    const searchTerm = params.search.toLowerCase();

    const { data: guests, error } = await supabase
      .from('guests')
      .select('id, first_name, last_name, email, location, arrival_date, arrival_time, arrival_flight_number, arrival_airport, departure_date, departure_time, departure_flight_number, departure_airport, needs_arrival_transfer, needs_departure_transfer, hotel_checkin_date, hotel_checkout_date, registration_status')
      .or('is_removed.eq.false,is_removed.is.null')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!guests || guests.length === 0) {
      return { success: false, error: `No guest found matching "${params.search}"` };
    }

    return {
      success: true,
      data: {
        guests: guests.map(g => ({
          id: g.id,
          name: `${g.first_name} ${g.last_name}`,
          email: g.email,
          location: g.location,
          arrival: g.arrival_date ? {
            date: g.arrival_date,
            time: g.arrival_time,
            flight: g.arrival_flight_number,
            airport: g.arrival_airport,
            needs_transfer: g.needs_arrival_transfer,
          } : null,
          departure: g.departure_date ? {
            date: g.departure_date,
            time: g.departure_time,
            flight: g.departure_flight_number,
            airport: g.departure_airport,
            needs_transfer: g.needs_departure_transfer,
          } : null,
          hotel: {
            checkin: g.hotel_checkin_date,
            checkout: g.hotel_checkout_date,
          },
          status: g.registration_status,
        })),
        count: guests.length,
      },
    };
  },
};

// ============================================
// Tool Registry
// ============================================

export const CHATBOT_TOOLS: ToolDefinition[] = [
  countGuestsTool,
  getGuestsTool,
  getBusiestArrivalDayTool,
  getGuestStatsTool,
  getVehiclesTool,
  getTransportSchedulesTool,
  getImportHistoryTool,
  compareImportsTool,
  getImportDetailsTool,
  compareImportDataTool,
  updateGuestTool,
  findGuestTool,
];

// Convert tools to OpenAI/OpenRouter function format
export function getToolsForLLM() {
  return CHATBOT_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<ToolResult> {
  const tool = CHATBOT_TOOLS.find((t) => t.name === toolName);

  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  try {
    // Validate parameters
    const validatedParams = tool.parameters.parse(params);
    return await tool.execute(validatedParams, supabase);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper: Convert Zod schema to JSON Schema (simplified)
function zodToJsonSchema(schema: z.ZodObject<Record<string, z.ZodTypeAny>>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    const description = zodType.description;

    // Determine if optional
    const isOptional = zodType.isOptional();
    if (!isOptional) {
      required.push(key);
    }

    // Get the base type
    const baseType = isOptional ? (zodType as z.ZodOptional<z.ZodTypeAny>)._def.innerType : zodType;

    // Convert to JSON Schema type
    properties[key] = {
      ...getJsonSchemaType(baseType),
      ...(description ? { description } : {}),
    };
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function getJsonSchemaType(zodType: z.ZodTypeAny): Record<string, unknown> {
  const typeName = zodType._def.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: (zodType as z.ZodEnum<[string, ...string[]]>)._def.values };
    case 'ZodDefault':
      return getJsonSchemaType((zodType as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
    default:
      return { type: 'string' };
  }
}
