// User roles
export type UserRole = 'event_registration_crew' | 'transport_arranger';

// Guest types
export interface Guest {
  id: string;
  externalId?: string;
  email: string;
  firstName: string;
  lastName: string;
  axisEmail?: string;

  // Organization
  reportingLevel1?: string;
  reportingLevel2?: string;
  reportingLevel3?: string;
  function?: string;
  location?: string;

  // Flight Arrival
  arrivalDate?: Date;
  arrivalTime?: string;
  arrivalFlightNumber?: string;
  arrivalAirport?: string;
  arrivalFlightRoute?: string;

  // Flight Departure
  departureDate?: Date;
  departureTime?: string;
  departureFlightNumber?: string;
  departureAirport?: string;
  departureFlightRoute?: string;

  // Hotel
  hotelCheckinDate?: Date;
  hotelCheckoutDate?: Date;
  extendStayBefore?: boolean;
  extendStayAfter?: boolean;
  earlyCheckin?: string;
  lateCheckout?: string;

  // Transport
  needsArrivalTransfer?: boolean;
  needsDepartureTransfer?: boolean;

  // Status
  registrationStatus: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  travelType?: string;
  isDuplicate?: boolean;
  isRemoved?: boolean;

  // Metadata
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Vehicle types
export interface Vehicle {
  id: string;
  name: string;
  type: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  licensePlate?: string;
  isActive: boolean;
}

// Transport schedule types
export interface TransportSchedule {
  id: string;
  vehicleId: string;
  direction: 'arrival' | 'departure';
  scheduleDate: Date;
  pickupTime: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  vehicle?: Vehicle;
  assignments?: GuestTransportAssignment[];
}

// Guest transport assignment
export interface GuestTransportAssignment {
  id: string;
  guestId: string;
  scheduleId: string;
  assignmentType: 'arrival' | 'departure';
  status: 'assigned' | 'completed' | 'no_show';
  createdAt: Date;

  // Relations
  guest?: Guest;
  schedule?: TransportSchedule;
}

// Import types
export interface ImportSession {
  id: string;
  filename: string;
  fileHash?: string;
  uploadedBy: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  totalRows?: number;
  rowsAdded: number;
  rowsModified: number;
  rowsRemoved: number;
  rowsUnchanged: number;
  rowsError: number;
  errorDetails?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Audit log types
export interface AuditLog {
  id: string;
  entityType: 'guest' | 'vehicle' | 'transport_schedule' | 'assignment';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  changes: FieldChange[];
  changeSource: 'import' | 'manual' | 'system';
  importSessionId?: string;
  performedBy: string;
  performedAt: Date;
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  fieldType: 'string' | 'date' | 'boolean' | 'number' | 'enum';
}

// Import diff types
export interface ImportDiff {
  added: Partial<Guest>[];
  modified: {
    existing: Guest;
    changes: FieldChange[];
    newData: Partial<Guest>;
  }[];
  removed: Guest[];
  unchanged: Guest[];
  errors: ImportRowError[];
}

export interface ImportRowError {
  row: number;
  email?: string;
  errors: string[];
}

// Dashboard stats
export interface DashboardStats {
  totalGuests: number;
  confirmedGuests: number;
  pendingGuests: number;
  cancelledGuests: number;
  arrivingToday: number;
  arrivingTomorrow: number;
  departingToday: number;
  departingTomorrow: number;
  transportAssigned: number;
  transportPending: number;
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
