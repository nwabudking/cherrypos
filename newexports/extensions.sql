-- ============================================
-- Cherry Dining POS - PostgreSQL Extensions
-- Supabase-compatible - Schema Only
-- ============================================

-- UUID generation extension (typically pre-installed in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- pgcrypto for password hashing (typically pre-installed in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
