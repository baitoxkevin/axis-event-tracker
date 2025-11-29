import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { AppShell } from '@/components/layout/app-shell';

// Helper to extract display name from Supabase user
function getDisplayName(authUser: { email?: string | null; user_metadata?: { name?: string; full_name?: string } }): string {
  // Try user_metadata first (from OAuth providers or custom signup)
  if (authUser.user_metadata?.full_name) {
    return authUser.user_metadata.full_name;
  }
  if (authUser.user_metadata?.name) {
    return authUser.user_metadata.name;
  }
  // Fall back to email username
  if (authUser.email) {
    return authUser.email.split('@')[0];
  }
  return 'User';
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if we're in demo mode (no Supabase configured)
  const isDemoMode = !isSupabaseConfigured();

  if (isDemoMode) {
    // Demo mode - use mock user
    return (
      <AppShell
        user={{
          name: 'Demo User',
          email: 'demo@example.com',
          role: 'event_registration_crew',
        }}
      >
        {children}
      </AppShell>
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    redirect('/login');
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect('/login');
  }

  // Try to get user from our database for role information
  let userName = getDisplayName(authUser);
  let userEmail = authUser.email || 'unknown@example.com';
  let userRole: 'event_registration_crew' | 'transport_arranger' = 'event_registration_crew';

  // Only query database if it's configured
  if (process.env.DATABASE_URL && db) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, authUser.email!),
    });

    if (dbUser) {
      // Use database user info (more authoritative for name and role)
      userName = dbUser.name;
      userEmail = dbUser.email;
      userRole = dbUser.role;
    }
    // If user is authenticated via Supabase but not in our DB,
    // we still let them in with default role (crew) and their Supabase info
  }

  return (
    <AppShell
      user={{
        name: userName,
        email: userEmail,
        role: userRole,
      }}
    >
      {children}
    </AppShell>
  );
}
