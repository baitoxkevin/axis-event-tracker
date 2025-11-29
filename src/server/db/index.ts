import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get the database URL from environment
const connectionString = process.env.DATABASE_URL;

// Create drizzle database instance only if DATABASE_URL is set
let db: PostgresJsDatabase<typeof schema> | null = null;

if (connectionString) {
  // Create postgres connection
  const client = postgres(connectionString, {
    prepare: false, // Required for Supabase
  });

  // Create drizzle database instance
  db = drizzle(client, { schema });
}
// Note: When DATABASE_URL is not set, we use Supabase client directly in TRPC routes

export { db };

// Export schema for use in other files
export * from './schema';
