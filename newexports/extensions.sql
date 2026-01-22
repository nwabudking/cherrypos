-- ============================================
-- Cherry Dining POS - PostgreSQL Extensions
-- Supabase-compatible - Schema Only
-- Updated: 2026-01-22
-- ============================================

-- UUID generation extension (typically pre-installed in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- pgcrypto for password hashing (typically pre-installed in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- pg_cron for scheduled jobs (transfer expiry)
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA pg_catalog;

-- pg_net for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
