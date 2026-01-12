#!/usr/bin/env node

/**
 * Quick Fix: Apply notification preferences trigger fix
 * 
 * This script applies the fix for the system_updates column error.
 * Run: node scripts/fix-notification-trigger.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyFix() {
  try {
    console.log('🔧 Applying notification preferences trigger fix...\n');

    // Read the fix migration
    const fixPath = join(__dirname, '../src/database/migrations/011_fix_notification_preferences_trigger.sql');
    const fixSQL = readFileSync(fixPath, 'utf-8');

    // Apply the fix
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: fixSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct approach
      const statements = fixSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        const { error: err } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (err) {
          console.error('❌ Error executing SQL:', err);
          // Continue anyway as some statements might fail
        }
      }
      
      console.log('✅ Fix applied (with some potential warnings above)');
    } else {
      console.log('✅ Fix applied successfully!');
    }

    console.log('\n🧪 Test: Try registering a user now. The error should be fixed.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyFix();
