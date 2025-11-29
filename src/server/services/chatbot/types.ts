// Chatbot types

export type QueryType = 'count' | 'list' | 'search' | 'stats' | 'comparison' | 'tool_call' | 'conversation' | 'unknown';

export interface QueryClassification {
  type: QueryType;
  entities: string[];
  filters: Record<string, string | number | boolean>;
  limit?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatbotResponse {
  message: string;
  metadata?: {
    queryType?: QueryType | string;
    executedQuery?: string;
    resultCount?: number;
    error?: string;
    toolsUsed?: string[]; // MCP-style tools that were called
  };
}

export interface ConversationContext {
  messages: ChatMessage[];
  sessionId: string;
  userId?: string;
}

// Allowed tables and columns for security
export const ALLOWED_TABLES = ['guests', 'vehicles', 'transport_schedules', 'guest_transport_assignments'] as const;
export type AllowedTable = typeof ALLOWED_TABLES[number];

export const TABLE_COLUMNS: Record<AllowedTable, string[]> = {
  guests: [
    'id', 'email', 'first_name', 'last_name', 'axis_email',
    'reporting_level_1', 'reporting_level_2', 'reporting_level_3',
    'function', 'location', 'arrival_date', 'arrival_time',
    'arrival_flight_number', 'arrival_airport', 'departure_date',
    'departure_time', 'departure_flight_number', 'departure_airport',
    'hotel_checkin_date', 'hotel_checkout_date', 'needs_arrival_transfer',
    'needs_departure_transfer', 'registration_status', 'travel_type',
    'created_at', 'updated_at'
  ],
  vehicles: [
    'id', 'name', 'type', 'capacity', 'driver_name', 'driver_phone',
    'license_plate', 'is_active', 'created_at', 'updated_at'
  ],
  transport_schedules: [
    'id', 'vehicle_id', 'direction', 'schedule_date', 'pickup_time',
    'pickup_location', 'dropoff_location', 'status', 'notes',
    'created_at', 'updated_at'
  ],
  guest_transport_assignments: [
    'id', 'guest_id', 'schedule_id', 'assignment_type', 'status', 'created_at'
  ]
};

// Column aliases for natural language mapping
export const COLUMN_ALIASES: Record<string, { table: AllowedTable; column: string }> = {
  'name': { table: 'guests', column: 'first_name' },
  'firstname': { table: 'guests', column: 'first_name' },
  'lastname': { table: 'guests', column: 'last_name' },
  'department': { table: 'guests', column: 'reporting_level_1' },
  'team': { table: 'guests', column: 'reporting_level_2' },
  'arriving': { table: 'guests', column: 'arrival_date' },
  'departing': { table: 'guests', column: 'departure_date' },
  'flight': { table: 'guests', column: 'arrival_flight_number' },
  'status': { table: 'guests', column: 'registration_status' },
  'hotel': { table: 'guests', column: 'hotel_checkin_date' },
  'transfer': { table: 'guests', column: 'needs_arrival_transfer' },
  'vehicle': { table: 'vehicles', column: 'name' },
  'driver': { table: 'vehicles', column: 'driver_name' },
  'capacity': { table: 'vehicles', column: 'capacity' },
};
