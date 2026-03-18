-- Phase 3: Master Extensions
-- Add billing address info to residents and bank info to locations

-- 1. Resident billing info
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS billing_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact TEXT,
  ADD COLUMN IF NOT EXISTS billing_notes TEXT;

-- 2. Location bank info
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT
    CHECK (account_type IS NULL OR account_type IN ('ordinary', 'checking')),
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS account_holder TEXT;
