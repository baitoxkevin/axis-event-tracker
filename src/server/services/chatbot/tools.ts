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
// Tool Registry
// ============================================

export const CHATBOT_TOOLS: ToolDefinition[] = [
  countGuestsTool,
  getGuestsTool,
  getBusiestArrivalDayTool,
  getGuestStatsTool,
  getVehiclesTool,
  getTransportSchedulesTool,
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
