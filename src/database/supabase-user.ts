import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { Request } from 'express';

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
 * - Uses ANON key so RLS policies are enforced (unlike supabaseAdmin which bypasses RLS)
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
            db: {
                schema: 'public',
            },
        }
    );
};

/**
 * Create a per-request Supabase client from an Express request.
 *
 * Extracts the user's JWT from either the Authorization header or
 * the HttpOnly access-token cookie and creates a client that
 * enforces RLS policies as that user.
 *
 * Use this for **all PHI-sensitive operations** (health records,
 * prescriptions, patient data, lab results) so that Supabase RLS
 * acts as a server-side defence-in-depth layer.
 *
 * Falls back to the anonymous public client if no token is found
 * (RLS will block unauthenticated access).
 *
 * @example
 *   import { createUserClientFromRequest } from '../database/supabase-user.js';
 *
 *   const supabase = createUserClientFromRequest(req);
 *   const { data } = await supabase.from('health_records').select('*');
 */
export function createUserClientFromRequest(req: Request): SupabaseClient {
    const authHeader = req.headers.authorization;
    const token =
        authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : (req as any).cookies?.rozx_access ?? undefined;

    if (!token) {
        return supabasePublic;
    }

    return createSupabaseUserClient(token);
}
