# Cherry Dining POS - Database Schema Export

**Last Updated: 2026-02-10**

This folder contains the complete database schema for the Cherry Dining & Lounge POS System.
These files can be used to recreate the backend on a fresh Supabase or local PostgreSQL instance.

## Files

| File | Description |
|------|-------------|
| `extensions.sql` | PostgreSQL extensions (uuid-ossp, pgcrypto, pg_cron, pg_net) |
| `tables.sql` | All table definitions with constraints (18 tables) |
| `indexes.sql` | Performance indexes |
| `views.sql` | Database views (currently empty) |
| `functions.sql` | All database functions (20 functions incl. staff auth & transfers) |
| `triggers.sql` | Database triggers (updated_at, price sync, stock availability) |
| `rls_policies.sql` | Row Level Security policies (all 18 tables) |
| `grants.sql` | Permission grants |
| `schema_full.sql` | **Single file containing everything above** |

## Deployment Options

### Option 1: Single File (Recommended for new instances)
```bash
psql -d your_database -f schema_full.sql
```

### Option 2: Individual Files (For incremental updates)
```bash
psql -d your_database -f extensions.sql
psql -d your_database -f tables.sql
psql -d your_database -f indexes.sql
psql -d your_database -f functions.sql
psql -d your_database -f triggers.sql
psql -d your_database -f rls_policies.sql
psql -d your_database -f grants.sql
```

## Post-Deployment Steps

### 1. Create Auth Trigger (Supabase only)
After running the schema, create the auth trigger manually in the Supabase SQL Editor:

```sql
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Create Initial Admin User
Create your first admin user through Supabase Auth, then update their role:

```sql
UPDATE public.user_roles 
SET role = 'super_admin' 
WHERE user_id = 'your-user-uuid';
```

### 3. Create Initial Settings
Insert default restaurant settings:

```sql
INSERT INTO public.restaurant_settings (name, tagline)
VALUES ('Your Restaurant Name', 'Your Tagline');
```

### 4. Schedule Transfer Expiry (Optional)
If using pg_cron, schedule the expire-transfers edge function:

```sql
SELECT cron.schedule(
  'expire-pending-transfers',
  '0 * * * *',
  $$SELECT net.http_post('YOUR_SUPABASE_URL/functions/v1/expire-transfers', '{}', '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}')$$
);
```

## Important Notes

- **Schema Only**: These files contain NO DATA, only structure
- **No Secrets**: No API keys or credentials are included
- **Supabase Compatible**: Uses Supabase-specific features (auth.uid(), RLS)
- **PostgreSQL Version**: Tested with PostgreSQL 14+
- **Local Staff Auth**: Supports local staff login via `staff_users` table with bcrypt password hashing
- **Receipt Print Tracking**: `orders.receipt_printed` flag tracks print status globally across all users

## Tables Summary

| Table | Description |
|-------|-------------|
| `profiles` | Extends auth.users with display info |
| `user_roles` | Supabase auth user role assignments |
| `staff_users` | Local staff authentication (username/password) |
| `restaurant_settings` | Restaurant config & receipt settings |
| `suppliers` | Supplier contact information |
| `inventory_items` | Store inventory items |
| `menu_categories` | Menu category groupings |
| `menu_items` | Menu items with optional inventory linking |
| `bars` | Bar/outlet definitions |
| `bar_inventory` | Per-bar stock levels |
| `cashier_bar_assignments` | Staff-to-bar assignments |
| `orders` | Order records with receipt print tracking |
| `order_items` | Line items per order |
| `payments` | Payment records |
| `stock_movements` | Stock change audit trail |
| `inventory_transfers` | Store-to-bar transfer records |
| `bar_to_bar_transfers` | Inter-bar transfer requests |
| `audit_logs` | System-wide audit trail |

## Role Hierarchy

| Role | Access Level |
|------|--------------|
| `super_admin` | Full system access |
| `manager` | Store management, staff, reports |
| `cashier` | POS, assigned bar only |
| `waitstaff` | POS (multi-bar switching), no transfers |
| `bar_staff` | Bar operations |
| `kitchen_staff` | Kitchen display |
| `inventory_officer` | Inventory management |
| `store_admin` | Store-to-bar transfers |
| `store_user` | View store inventory |
| `accountant` | Financial reports |
