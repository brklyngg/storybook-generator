#!/usr/bin/env node
/**
 * Run pending Supabase migrations
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.ecmlnmdgjvhhzqpodqhr.supabase.co:5432/postgres" node scripts/run-migration.js
 *
 * Or set DATABASE_URL in .env.local and run:
 *   node scripts/run-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATION_SQL = `
-- Add scene awareness to pages table for clothing consistency
-- Scene grouping allows characters to have consistent outfits within a scene,
-- but different outfits between scenes (for epic tales spanning years)

ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS scene_id text;

ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS scene_outfits jsonb;

COMMENT ON COLUMN public.pages.scene_id IS 'Scene identifier for grouping consecutive pages (e.g., scene_1_trojan_camp)';
COMMENT ON COLUMN public.pages.scene_outfits IS 'Character outfits for this scene as JSON (e.g., {"Odysseus": "bronze armor, red cape"})';
`;

async function runMigration() {
  // Try to load from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
      }
    });
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    console.log('\nYou can find your database URL in the Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/ecmlnmdgjvhhzqpodqhr/settings/database');
    console.log('2. Copy the "Connection string" (URI format)');
    console.log('3. Run: DATABASE_URL="your_connection_string" node scripts/run-migration.js');
    console.log('\nAlternatively, run this SQL directly in the Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/ecmlnmdgjvhhzqpodqhr/sql/new');
    console.log('\n--- SQL to run ---');
    console.log(MIGRATION_SQL);
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Running migration: Add scene_id and scene_outfits columns...');
    await client.query(MIGRATION_SQL);

    // Verify the columns exist
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pages'
      AND column_name IN ('scene_id', 'scene_outfits')
      ORDER BY column_name;
    `);

    console.log('\nMigration successful!');
    console.log('Verified columns:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    if (verifyResult.rows.length !== 2) {
      console.warn('\nWARNING: Expected 2 columns but found', verifyResult.rows.length);
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
