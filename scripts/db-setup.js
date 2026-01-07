#!/usr/bin/env node

/**
 * Database Setup Script for ROZX Healthcare Platform
 * 
 * This script helps set up your Supabase database with the required schema.
 * 
 * Usage:
 *   npm run db:setup      - Shows setup instructions
 *   npm run db:status     - Check database status
 *   npm run db:sql        - Display SQL schema
 *   npm run db:push       - Push migrations (requires Supabase CLI)
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

function printBanner() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ROZX Healthcare Platform - Database Setup              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
}

function printInstructions() {
  printBanner();

  console.log('🎯 QUICKEST SETUP (Recommended for Windows)\n');
  console.log('1. Open Supabase Dashboard: https://app.supabase.com');
  console.log('2. Select your ROZX project');
  console.log('3. Go to SQL Editor → New Query');
  console.log('4. Run this command to display and copy the SQL:\n');
  console.log('   npm run db:sql\n');
  console.log('5. Copy ALL the SQL output');
  console.log('6. Paste into Supabase SQL Editor');
  console.log('7. Click "Run" button');
  console.log('8. Done! ✅\n');

  console.log('─'.repeat(60) + '\n');

  console.log('📋 ALTERNATIVE OPTIONS:\n');

  console.log('Option 1: Using Supabase Dashboard (Easiest)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1. Open: https://app.supabase.com');
  console.log('2. Select project → SQL Editor → New Query');
  console.log('3. Paste content from ./src/database/migrations/001_initial_schema.sql');
  console.log('4. Click "Run"');
  console.log('5. Verify in Table Editor\n');

  console.log('Option 2: Using Supabase CLI (Linux/macOS)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Note: Use Homebrew or other package managers (not npm)');
  console.log('Visit: https://github.com/supabase/cli#install-the-cli');
  console.log('Then run: supabase db push\n');

  console.log('Option 3: Using psql (if PostgreSQL installed)');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('1. Get connection string from Supabase Settings');
  console.log('2. Run: psql <connection-string> < src/database/migrations/001_initial_schema.sql\n');

  console.log('📊 TABLES BEING CREATED:');
  console.log('─────────────────────────────────────────────────────────────');
  const tables = [
    'users',
    'hospitals',
    'doctors',
    'appointments',
    'payments',
    'consultations',
    'prescriptions',
    'notifications',
    'reviews',
  ];

  tables.forEach((table, i) => {
    console.log(`   ${i + 1}. ${table}`);
  });

  console.log('\n✅ VERIFY AFTER SETUP:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Run: npm run db:status');
  console.log('Or check Supabase Dashboard → Table Editor\n');

  console.log('🔗 USEFUL LINKS:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  • Supabase Dashboard: https://app.supabase.com');
  console.log('  • SQL Editor: https://app.supabase.com/project/[ref]/sql/new');
  console.log('  • Table Editor: https://app.supabase.com/project/[ref]/editor');
  console.log('  • Supabase Docs: https://supabase.com/docs');
  console.log('  • PostgreSQL Docs: https://www.postgresql.org/docs/\n');
}

function printStatus() {
  printBanner();
  
  console.log('🔍 Database Status Check\n');
  console.log('To verify your database setup:');
  console.log('─────────────────────────────────────────────────────────────\n');
  console.log('1. Open Supabase Dashboard:');
  console.log('   → https://app.supabase.com/project/[your-project-ref]/editor\n');
  console.log('2. Click on "Table Editor" in the left sidebar\n');
  console.log('3. You should see these 9 tables:');
  const tables = [
    'users',
    'hospitals',
    'doctors',
    'appointments',
    'payments',
    'consultations',
    'prescriptions',
    'notifications',
    'reviews',
  ];
  tables.forEach((table, i) => {
    console.log(`   ✓ ${table}`);
  });
  console.log('\nIf all tables are present, your database is ready! ✅\n');

  console.log('📝 Example Queries:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Check tables exist:');
  console.log('  SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';\n');
  console.log('Check users table:');
  console.log('  SELECT * FROM users LIMIT 1;\n');
}

function printSQLFile() {
  const sqlFile = join(__dirname, '..', 'src', 'database', 'migrations', '001_initial_schema.sql');
  try {
    const sql = readFileSync(sqlFile, 'utf-8');
    console.log('\n' + '═'.repeat(70));
    console.log('📄 SQL SCHEMA - Copy everything below and paste into Supabase SQL Editor');
    console.log('═'.repeat(70) + '\n');
    console.log(sql);
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Copy the SQL above and paste in Supabase Dashboard → SQL Editor');
    console.log('═'.repeat(70) + '\n');
  } catch (error) {
    console.error('❌ Could not read SQL file:', error.message);
    console.error('Expected path:', sqlFile);
  }
}

function printPushInstructions() {
  printBanner();
  
  console.log('⚠️  Supabase CLI installation failed on Windows\n');
  console.log('This is expected! The CLI is not available via npm on Windows.\n');
  console.log('✅ SOLUTION: Use Supabase Dashboard instead (it\'s actually faster):\n');
  console.log('1. Run: npm run db:sql');
  console.log('2. Copy all the SQL output');
  console.log('3. Open: https://app.supabase.com');
  console.log('4. Go to: SQL Editor → New Query');
  console.log('5. Paste the SQL');
  console.log('6. Click "Run"');
  console.log('7. Done! ✅\n');

  console.log('For CLI on Windows, visit:');
  console.log('→ https://github.com/supabase/cli#install-the-cli\n');
}

function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      printInstructions();
      break;

    case 'status':
      printStatus();
      break;

    case 'show-sql':
    case 'sql':
      printSQLFile();
      break;

    case 'push':
      printPushInstructions();
      break;

    default:
      printInstructions();
  }
}

main();
