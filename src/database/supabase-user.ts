import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase Public Client (Anon Key)
 * - Respects Row Level Security (RLS)
 * - Safe for operations that should be scoped to a user
 */
export const supabasePublic = createClient(
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

/**
 * Create a Supabase client with a specific user's JWT
 * - Perfect for performing operations as a specific authenticated user
 */
export const createSupabaseUserClient = (jwt: string): SupabaseClient => {
    return createClient(
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
