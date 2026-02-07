import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase Admin Client (Service Role)
 * - Bypasses RLS
 * - Full access to all tables
 * - Use only in secure server-side logic
 */
export const supabaseAdmin = createClient(
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
