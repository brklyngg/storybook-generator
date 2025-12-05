#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load migration file
const migrationPath = join(__dirname, 'supabase/migrations/005_add_character_display_fields.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

// Supabase config
const supabaseUrl = 'https://ecmlnmdgjvhhzqpodqhr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWxubWRnanZoaHpxcG9kcWhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYxNzM1OSwiZXhwIjoyMDgwMTkzMzU5fQ.OTvf7bPV2LiX-a6P9MItCwQRxLr_WlkP2A1ER70LhbY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying migration: 005_add_character_display_fields.sql');
  console.log('Migration SQL:');
  console.log(migrationSQL);
  console.log('\n---\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('Response:', data);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

applyMigration();
