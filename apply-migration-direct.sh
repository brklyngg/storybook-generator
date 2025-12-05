#!/bin/bash

# Apply database migration using Supabase REST API
# This script runs SQL directly against the Supabase database

SUPABASE_URL="https://ecmlnmdgjvhhzqpodqhr.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWxubWRnanZoaHpxcG9kcWhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYxNzM1OSwiZXhwIjoyMDgwMTkzMzU5fQ.OTvf7bPV2LiX-a6P9MItCwQRxLr_WlkP2A1ER70LhbY"

echo "🔧 Applying database migration..."
echo ""

# SQL to execute
SQL=$(cat supabase/migrations/005_add_character_display_fields.sql)

echo "SQL to execute:"
echo "$SQL"
echo ""

# Execute using curl to Supabase SQL endpoint
# Note: This might not work directly - Supabase REST API doesn't support arbitrary SQL
# The proper way is to use the Supabase dashboard SQL editor

echo "❌ Cannot run SQL directly via REST API"
echo ""
echo "📋 MANUAL MIGRATION REQUIRED:"
echo "  1. Go to: https://supabase.com/dashboard/project/ecmlnmdgjvhhzqpodqhr/editor"
echo "  2. Click on 'SQL Editor' in the left sidebar"
echo "  3. Click '+ New query'"
echo "  4. Copy and paste this SQL:"
echo ""
echo "--------------------------------------------"
cat supabase/migrations/005_add_character_display_fields.sql
echo ""
echo "--------------------------------------------"
echo ""
echo "  5. Click 'Run' to execute the migration"
echo "  6. Verify the columns were added in the 'Table Editor' > 'characters' table"
