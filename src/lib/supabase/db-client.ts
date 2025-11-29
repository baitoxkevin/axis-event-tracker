'use server';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Create a simple Supabase client for database operations
// This bypasses the need for DATABASE_URL and works with just the anon key
export async function createDbClient(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore errors from Server Components
        }
      },
    },
  });
}

// Type definitions for database tables
export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  arrival_flight: string | null;
  arrival_flight_status: string | null;
  arrival_verified_time: string | null;
  arrival_time_mismatch: boolean;
  departure_date: string | null;
  departure_time: string | null;
  departure_flight: string | null;
  departure_flight_status: string | null;
  departure_verified_time: string | null;
  departure_time_mismatch: boolean;
  travel_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  vehicle_type: string;
  license_plate: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TransportSchedule {
  id: string;
  vehicle_id: string;
  pickup_time: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  direction: 'arrival' | 'departure';
  status: string;
  scheduled_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
  assignments?: TransportAssignment[];
}

export interface TransportAssignment {
  id: string;
  schedule_id: string;
  guest_id: string;
  assignment_type: 'arrival' | 'departure';
  status: string;
  created_at: string;
  updated_at: string;
  guest?: Guest;
  schedule?: TransportSchedule;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'event_registration_crew' | 'transport_arranger';
  created_at: string;
}
