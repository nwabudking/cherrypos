# CherryPOS Full Backup

**Backup Date:** 2026-01-17

This folder contains a complete offline backup of the CherryPOS project including:

## Contents

### `/tables_json/`
JSON exports of all database tables:
- `profiles.json` - User profiles
- `user_roles.json` - User role assignments
- `bars.json` - Bar/outlet definitions
- `menu_categories.json` - Menu categories
- `menu_items.json` - Menu items
- `inventory_items.json` - Store inventory
- `suppliers.json` - Supplier information
- `orders.json` - All orders
- `order_items.json` - Order line items
- `payments.json` - Payment records
- `bar_inventory.json` - Inventory per bar
- `bar_to_bar_transfers.json` - Bar-to-bar transfer requests
- `inventory_transfers.json` - Store-to-bar transfers
- `stock_movements.json` - Stock movement history
- `cashier_bar_assignments.json` - Cashier bar assignments
- `restaurant_settings.json` - Restaurant configuration
- `audit_logs.json` - Audit trail

### `/auth_users.json`
Export of user profiles with roles (email, full_name, role)

### `/storage_info.md`
Information about storage buckets and files

## Restoration Instructions

### Prerequisites
- Local Supabase instance (`supabase start`)
- Node.js/Deno for running edge functions

### Steps

1. **Apply Database Schema:**
   ```bash
   # Run all migrations in order
   psql -d your_database -f supabase/migrations/20251223063607_remix_migration_from_pg_dump.sql
   # ... continue with all migration files
   ```

2. **Import Data:**
   ```sql
   -- Use Supabase client or psql to insert data from JSON files
   -- Example with psql:
   \copy profiles FROM 'exports/tables_json/profiles.json' WITH (FORMAT json)
   ```

3. **Create Users:**
   - Use the auth_users.json to recreate users in your local Supabase auth system
   - Passwords will need to be reset as they cannot be exported

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy migrate-openpos
   supabase functions deploy sync-menu-inventory
   supabase functions deploy import-staff
   supabase functions deploy manage-staff
   ```

5. **Configure Storage:**
   - Create the `menu-images` bucket as a public bucket

## Notes
- Auth passwords cannot be exported - users will need password resets
- Storage files are not included in this backup (no files in storage buckets)
- Environment variables must be reconfigured for your local instance
