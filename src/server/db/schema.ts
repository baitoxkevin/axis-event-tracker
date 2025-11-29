import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  time,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().$type<'event_registration_crew' | 'transport_arranger'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Guests table
export const guests = pgTable('guests', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: varchar('external_id', { length: 50 }),
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  axisEmail: varchar('axis_email', { length: 255 }),

  // Organization
  reportingLevel1: varchar('reporting_level_1', { length: 100 }),
  reportingLevel2: varchar('reporting_level_2', { length: 100 }),
  reportingLevel3: varchar('reporting_level_3', { length: 100 }),
  function: varchar('function', { length: 100 }),
  location: varchar('location', { length: 100 }),

  // Flight Arrival
  arrivalDate: date('arrival_date'),
  arrivalTime: time('arrival_time'),
  arrivalFlightNumber: varchar('arrival_flight_number', { length: 20 }),
  arrivalAirport: varchar('arrival_airport', { length: 100 }),
  arrivalFlightRoute: varchar('arrival_flight_route', { length: 50 }),
  // Flight Arrival - Verified Info (from API)
  arrivalTerminal: varchar('arrival_terminal', { length: 20 }),
  arrivalGate: varchar('arrival_gate', { length: 20 }),
  arrivalVerifiedTime: time('arrival_verified_time'),
  arrivalFlightStatus: varchar('arrival_flight_status', { length: 50 }).$type<'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown'>(),
  arrivalVerifiedAt: timestamp('arrival_verified_at', { withTimezone: true }),
  arrivalTimeMismatch: boolean('arrival_time_mismatch').default(false),

  // Flight Departure
  departureDate: date('departure_date'),
  departureTime: time('departure_time'),
  departureFlightNumber: varchar('departure_flight_number', { length: 20 }),
  departureAirport: varchar('departure_airport', { length: 100 }),
  departureFlightRoute: varchar('departure_flight_route', { length: 50 }),
  // Flight Departure - Verified Info (from API)
  departureTerminal: varchar('departure_terminal', { length: 20 }),
  departureGate: varchar('departure_gate', { length: 20 }),
  departureVerifiedTime: time('departure_verified_time'),
  departureFlightStatus: varchar('departure_flight_status', { length: 50 }).$type<'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown'>(),
  departureVerifiedAt: timestamp('departure_verified_at', { withTimezone: true }),
  departureTimeMismatch: boolean('departure_time_mismatch').default(false),

  // Hotel
  hotelCheckinDate: date('hotel_checkin_date'),
  hotelCheckoutDate: date('hotel_checkout_date'),
  extendStayBefore: boolean('extend_stay_before').default(false),
  extendStayAfter: boolean('extend_stay_after').default(false),
  earlyCheckin: varchar('early_checkin', { length: 50 }),
  lateCheckout: varchar('late_checkout', { length: 50 }),

  // Transport
  needsArrivalTransfer: boolean('needs_arrival_transfer'),
  needsDepartureTransfer: boolean('needs_departure_transfer'),

  // Status
  registrationStatus: varchar('registration_status', { length: 50 }).default('pending').$type<'pending' | 'confirmed' | 'cancelled' | 'waitlisted'>(),
  travelType: varchar('travel_type', { length: 50 }),
  isDuplicate: boolean('is_duplicate').default(false),
  isRemoved: boolean('is_removed').default(false),

  // Metadata
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('guests_email_unique').on(table.email),
  index('idx_guests_arrival').on(table.arrivalDate),
  index('idx_guests_departure').on(table.departureDate),
  index('idx_guests_status').on(table.registrationStatus),
]);

// Vehicles table
export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  capacity: integer('capacity').notNull(),
  driverName: varchar('driver_name', { length: 100 }),
  driverPhone: varchar('driver_phone', { length: 50 }),
  licensePlate: varchar('license_plate', { length: 20 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Transport Schedules table
export const transportSchedules = pgTable('transport_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  direction: varchar('direction', { length: 20 }).notNull().$type<'arrival' | 'departure'>(),
  scheduleDate: date('schedule_date').notNull(),
  pickupTime: time('pickup_time').notNull(),
  pickupLocation: varchar('pickup_location', { length: 255 }),
  dropoffLocation: varchar('dropoff_location', { length: 255 }),
  status: varchar('status', { length: 50 }).default('scheduled').$type<'scheduled' | 'in_progress' | 'completed' | 'cancelled'>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_transport_date').on(table.scheduleDate),
  index('idx_transport_vehicle').on(table.vehicleId),
]);

// Guest Transport Assignments table
export const guestTransportAssignments = pgTable('guest_transport_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: uuid('guest_id').references(() => guests.id).notNull(),
  scheduleId: uuid('schedule_id').references(() => transportSchedules.id).notNull(),
  assignmentType: varchar('assignment_type', { length: 20 }).notNull().$type<'arrival' | 'departure'>(),
  status: varchar('status', { length: 50 }).default('assigned').$type<'assigned' | 'completed' | 'no_show'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('guest_assignment_unique').on(table.guestId, table.assignmentType),
  index('idx_assignment_schedule').on(table.scheduleId),
]);

// Import Sessions table
export const importSessions = pgTable('import_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  status: varchar('status', { length: 50 }).default('pending').$type<'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back'>(),
  totalRows: integer('total_rows'),
  rowsAdded: integer('rows_added').default(0),
  rowsModified: integer('rows_modified').default(0),
  rowsRemoved: integer('rows_removed').default(0),
  rowsUnchanged: integer('rows_unchanged').default(0),
  rowsError: integer('rows_error').default(0),
  errorDetails: jsonb('error_details'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Logs table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull().$type<'guest' | 'vehicle' | 'transport_schedule' | 'assignment'>(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull().$type<'create' | 'update' | 'delete' | 'restore'>(),
  changes: jsonb('changes').notNull().$type<Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
    fieldType: string;
  }>>(),
  changeSource: varchar('change_source', { length: 20 }).$type<'import' | 'manual' | 'system'>(),
  importSessionId: uuid('import_session_id').references(() => importSessions.id),
  performedBy: uuid('performed_by').references(() => users.id),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_entity').on(table.entityType, table.entityId),
  index('idx_audit_timestamp').on(table.performedAt),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
  importSessions: many(importSessions),
}));

export const guestsRelations = relations(guests, ({ many }) => ({
  transportAssignments: many(guestTransportAssignments),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  schedules: many(transportSchedules),
}));

export const transportSchedulesRelations = relations(transportSchedules, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [transportSchedules.vehicleId],
    references: [vehicles.id],
  }),
  assignments: many(guestTransportAssignments),
}));

export const guestTransportAssignmentsRelations = relations(guestTransportAssignments, ({ one }) => ({
  guest: one(guests, {
    fields: [guestTransportAssignments.guestId],
    references: [guests.id],
  }),
  schedule: one(transportSchedules, {
    fields: [guestTransportAssignments.scheduleId],
    references: [transportSchedules.id],
  }),
}));

export const importSessionsRelations = relations(importSessions, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [importSessions.uploadedBy],
    references: [users.id],
  }),
  auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  performedByUser: one(users, {
    fields: [auditLogs.performedBy],
    references: [users.id],
  }),
  importSession: one(importSessions, {
    fields: [auditLogs.importSessionId],
    references: [importSessions.id],
  }),
}));

// Chatbot Conversations table
export const chatbotConversations = pgTable('chatbot_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_conversation_user').on(table.userId),
  index('idx_conversation_session').on(table.sessionId),
]);

// Chatbot Messages table
export const chatbotMessages = pgTable('chatbot_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => chatbotConversations.id).notNull(),
  role: varchar('role', { length: 20 }).notNull().$type<'user' | 'assistant' | 'system'>(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<{
    queryType?: 'count' | 'list' | 'search' | 'stats' | 'unknown';
    executedQuery?: string;
    resultCount?: number;
    error?: string;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_message_conversation').on(table.conversationId),
  index('idx_message_created').on(table.createdAt),
]);

// Chatbot Relations
export const chatbotConversationsRelations = relations(chatbotConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatbotConversations.userId],
    references: [users.id],
  }),
  messages: many(chatbotMessages),
}));

export const chatbotMessagesRelations = relations(chatbotMessages, ({ one }) => ({
  conversation: one(chatbotConversations, {
    fields: [chatbotMessages.conversationId],
    references: [chatbotConversations.id],
  }),
}));
