import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from '../common/logger.js';
import type { Database } from '../types/database.types.js';

// Supabase client for server-side operations (with service role key)
let supabaseAdmin: SupabaseClient<Database> | null = null;

// Supabase client for client-side operations (with anon key)
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get Supabase admin client (service role - full access)
 * Use for server-side operations that need to bypass RLS
 */
export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }
    );
    logger.info('Supabase admin client initialized');
  }
  return supabaseAdmin;
};

/**
 * Get Supabase client (anon key - respects RLS)
 * Use for operations that should respect Row Level Security
 */
export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }
    );
    logger.info('Supabase client initialized');
  }
  return supabaseClient;
};

/**
 * Create a Supabase client with a specific user's JWT
 * Useful for performing operations as a specific user
 */
export const getSupabaseClientWithAuth = (jwt: string): SupabaseClient<Database> => {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

/**
 * Test database connection
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      throw error;
    }
    
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    return false;
  }
};

// Export a default instance
export const db = {
  admin: getSupabaseAdmin,
  client: getSupabaseClient,
  withAuth: getSupabaseClientWithAuth,
  testConnection: testDatabaseConnection,
};
