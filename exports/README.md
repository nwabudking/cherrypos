# CherryPOS Full Offline Backup

**Backup Date:** 2026-01-17  
**Last Updated:** 2026-01-18

This folder contains a complete offline backup of the CherryPOS project for local deployment and disaster recovery.

---

## 📁 Directory Structure

```
exports/
├── tables_json/                    # Database table exports
│   ├── bar_inventory.json          # Inventory levels per bar
│   ├── bar_to_bar_transfers.json   # Bar-to-bar transfer requests
│   ├── bars.json                   # Bar/outlet definitions
│   ├── cashier_bar_assignments.json# Cashier bar assignments
│   ├── inventory_transfers.json    # Store-to-bar transfers
│   ├── menu_categories.json        # Menu categories
│   ├── order_items.json            # Order line items
│   ├── orders.json                 # All orders
│   ├── payments.json               # Payment records
│   ├── profiles.json               # User profiles
│   ├── restaurant_settings.json    # Restaurant configuration
│   ├── stock_movements.json        # Stock movement history
│   ├── suppliers.json              # Supplier information
│   ├── user_roles.json             # User role assignments
│   └── LARGE_TABLES_README.md      # Instructions for large tables
├── auth_users.json                 # User accounts with roles
├── storage_info.md                 # Storage bucket configuration
├── .env.example                    # Environment variable template
└── README.md                       # This file
```

---

## 📊 Exported Tables Summary

| Table | Description | Status |
|-------|-------------|--------|
| `profiles` | User profiles (name, email, avatar) | ✅ Exported |
| `user_roles` | User role assignments | ✅ Exported |
| `bars` | Bar/outlet definitions | ✅ Exported |
| `menu_categories` | Menu categories | ✅ Exported |
| `suppliers` | Supplier information | ✅ Exported |
| `orders` | All orders | ✅ Exported |
| `order_items` | Order line items | ✅ Exported |
| `payments` | Payment records | ✅ Exported |
| `bar_inventory` | Inventory per bar | ✅ Exported |
| `bar_to_bar_transfers` | Bar-to-bar transfer requests | ✅ Exported |
| `inventory_transfers` | Store-to-bar transfers | ✅ Exported |
| `stock_movements` | Stock movement history | ✅ Exported |
| `cashier_bar_assignments` | Cashier bar assignments | ✅ Exported |
| `restaurant_settings` | Restaurant configuration | ✅ Exported |
| `menu_items` | Menu items (~300 items) | ⚠️ See LARGE_TABLES_README.md |
| `inventory_items` | Store inventory (~300 items) | ⚠️ See LARGE_TABLES_README.md |
| `audit_logs` | Audit trail | ⚠️ See LARGE_TABLES_README.md |

---

## 👤 User Accounts

**File:** `auth_users.json`

Contains 14 user accounts with roles:
- 1 Super Admin
- 1 Manager  
- 12 Cashiers

> ⚠️ **Note:** Passwords cannot be exported. Users will need password resets after restoration.

---

## 🗄️ Storage Buckets

**File:** `storage_info.md`

| Bucket | Public | Status |
|--------|--------|--------|
| `menu-images` | Yes | Empty (no files) |

---

## 🔧 Restoration Instructions

### Prerequisites
- Local Supabase instance (`supabase start`)
- Node.js 18+ / Deno for edge functions
- PostgreSQL client (psql)

### Step 1: Apply Database Schema

```bash
cd your-project
supabase db reset
# Or apply migrations manually:
supabase db push
```

### Step 2: Import Table Data

```javascript
// Use Supabase client to import JSON data
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Import each table
const profiles = JSON.parse(fs.readFileSync('exports/tables_json/profiles.json'));
await supabase.from('profiles').upsert(profiles);

// Repeat for other tables...
```

### Step 3: Recreate Users

Use the Supabase Admin API or dashboard to create users from `auth_users.json`:

```javascript
const authUsers = JSON.parse(fs.readFileSync('exports/auth_users.json'));

for (const user of authUsers) {
  await supabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    user_metadata: { full_name: user.full_name }
  });
}
```

### Step 4: Deploy Edge Functions

```bash
supabase functions deploy migrate-openpos
supabase functions deploy sync-menu-inventory
supabase functions deploy import-staff
supabase functions deploy manage-staff
```

### Step 5: Configure Storage

```sql
-- Create the menu-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true);
```

See `storage_info.md` for complete RLS policies.

---

## ⚠️ Important Notes

1. **Passwords** - Auth passwords cannot be exported; users need password resets
2. **Large Tables** - `menu_items`, `inventory_items`, and `audit_logs` require separate export (see `LARGE_TABLES_README.md`)
3. **Storage Files** - No files in storage buckets at time of backup
4. **Environment Variables** - Update `.env` with your local Supabase credentials
5. **RLS Policies** - Already included in migration files under `supabase/migrations/`

---

## 📋 Environment Variables

Copy `.env.example` and configure:

```bash
cp exports/.env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Your project ID

---

## 📅 Backup History

| Date | Description |
|------|-------------|
| 2026-01-17 | Initial full backup created |
| 2026-01-18 | Documentation updated |
