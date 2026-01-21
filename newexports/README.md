# Cherry Dining POS - Database Schema Export

This folder contains the complete database schema for the Cherry Dining & Lounge POS System.
These files can be used to recreate the backend on a fresh Supabase or local PostgreSQL instance.

## Files

| File | Description |
|------|-------------|
| `extensions.sql` | PostgreSQL extensions (uuid-ossp, pgcrypto) |
| `tables.sql` | All table definitions with constraints |
| `indexes.sql` | Performance indexes |
| `views.sql` | Database views (currently empty) |
| `functions.sql` | All database functions (RPC calls, triggers) |
| `triggers.sql` | Database triggers |
| `rls_policies.sql` | Row Level Security policies |
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

## Important Notes

- **Schema Only**: These files contain NO DATA, only structure
- **No Secrets**: No API keys or credentials are included
- **Supabase Compatible**: Uses Supabase-specific features (auth.uid(), RLS)
- **PostgreSQL Version**: Tested with PostgreSQL 14+

## Role Hierarchy

| Role | Access Level |
|------|--------------|
| `super_admin` | Full system access |
| `manager` | Store management, staff, reports |
| `cashier` | POS, assigned bar only |
| `waitstaff` | POS and transfers only |
| `bar_staff` | Bar operations |
| `kitchen_staff` | Kitchen display |
| `inventory_officer` | Inventory management |
| `store_admin` | Store-to-bar transfers |
| `store_user` | View store inventory |
| `accountant` | Financial reports |
