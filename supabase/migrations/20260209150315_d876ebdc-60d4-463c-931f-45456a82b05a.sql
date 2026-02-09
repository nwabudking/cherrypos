-- Add receipt_printed column to orders table for persistent print tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_printed boolean NOT NULL DEFAULT false;

-- Add receipt_printed_at to track when it was printed
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_printed_at timestamp with time zone DEFAULT null;

-- Add receipt_printed_by to track who printed it
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_printed_by text DEFAULT null;