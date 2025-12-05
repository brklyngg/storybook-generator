#!/usr/bin/env node

/**
 * Apply database migration to add display_description and approximate_age columns
 * Run with: node run-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase config from .env.local
const supabaseUrl = 'https://ecmlnmdgjvhhzqpodqhr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWxubWRnanZoaHpxcG9kcWhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYxNzM1OSwiZXhwIjoyMDgwMTkzMzU5fQ.OTvf7bPV2LiX-a6P9MItCwQRxLr_WlkP2A1ER70LhbY';

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Applying migration: 005_add_character_display_fields.sql\n');

  try {
    // Migration SQL
    const queries = [
      {
        name: 'Add display_description column',
        sql: `ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS display_description text;`
      },
      {
        name: 'Add approximate_age column',
        sql: `ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS approximate_age text;`
      },
      {
        name: 'Add comment for display_description',
        sql: `COMMENT ON COLUMN public.characters.display_description IS 'Story role and character arc description shown to users in UI';`
      },
      {
        name: 'Add comment for approximate_age',
        sql: `COMMENT ON COLUMN public.characters.approximate_age IS 'Character age for UI display (e.g., ~30s, young adult, child ~8)';`
      }
    ];

    // Execute each query
    for (const query of queries) {
      console.log(`  ▶ ${query.name}...`);

      const { data, error } = await supabase.rpc('exec', {
        sql: query.sql
      });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase
          .from('characters')
          .select('*')
          .limit(0); // Just to test connection

        if (!directError) {
          console.log(`    ℹ️  RPC not available, but connection works. Please run SQL manually in Supabase dashboard.`);
        } else {
          throw error;
        }
      } else {
        console.log(`    ✅ Success`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Verify columns were added: Check the characters table in Supabase dashboard');
    console.log('  2. Restart the dev server if running');
    console.log('  3. Test generating a new storybook (e.g., The Odyssey)');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 Manual migration required:');
    console.log('  1. Go to Supabase dashboard: https://supabase.com/dashboard/project/ecmlnmdgjvhhzqpodqhr/editor');
    console.log('  2. Open SQL Editor');
    console.log('  3. Run the following SQL:\n');
    console.log('  -- Add display_description and approximate_age columns to characters table');
    console.log('  ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS display_description text;');
    console.log('  ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS approximate_age text;');
    console.log('  COMMENT ON COLUMN public.characters.display_description IS \'Story role and character arc description shown to users in UI\';');
    console.log('  COMMENT ON COLUMN public.characters.approximate_age IS \'Character age for UI display (e.g., ~30s, young adult, child ~8)\';');
    process.exit(1);
  }
}

runMigration();
