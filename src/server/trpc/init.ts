import { initTRPC, TRPCError } from '@trpc/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createDbClient } from '@/lib/supabase/db-client';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Context {
  db: typeof db | null;
  supabase: SupabaseClient | null;
  user: {
    id: string;
    email: string;
    role: UserRole;
  } | null;
  isDemoMode: boolean;
}

export async function createContext(): Promise<Context> {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    // Return demo user for testing UI without database
    return {
      db: null,
      supabase: null,
      user: {
        id: 'demo-user-id',
        email: 'demo@example.com',
        role: 'event_registration_crew',
      },
      isDemoMode: true,
    };
  }

  // Create Supabase client for database operations
  const supabase = await createDbClient();

  // If we have DATABASE_URL, also use Drizzle
  const hasDb = !!process.env.DATABASE_URL && db !== null;

  const authClient = await createClient();
  let user: Context['user'] = null;

  if (authClient) {
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (authUser && supabase) {
      // Fetch user role from our users table using Supabase client
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email!)
        .single();

      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role as UserRole,
        };
      } else {
        // User exists in Supabase Auth but not in users table
        // Use the auth user's email and default to crew role
        user = {
          id: authUser.id,
          email: authUser.email!,
          role: 'event_registration_crew',
        };
      }
    }
  }

  return {
    db: hasDb ? db : null,
    supabase,
    user,
    isDemoMode: !supabase,
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to check if user is authenticated
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Middleware to check if user has specific role
const hasRole = (allowedRoles: UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthenticated);

// Crew only procedure - requires event_registration_crew role
export const crewOnlyProcedure = t.procedure.use(
  hasRole(['event_registration_crew'])
);

// Transport procedure - allows both roles
export const transportProcedure = t.procedure.use(
  hasRole(['event_registration_crew', 'transport_arranger'])
);
