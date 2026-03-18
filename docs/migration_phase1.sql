-- =============================================================================
-- GH経理 Phase 1 Migration SQL
-- 設計書 Rev.4 準拠
-- 前提: GH出納帳の既存テーブル（transactions, users, locations 等）が存在すること
-- =============================================================================

-- 1. transactions テーブル拡張（経理フィールド追加）
-- =============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  billing_status TEXT DEFAULT 'unbilled'
    CHECK (billing_status IN ('unbilled', 'billed', 'paid', 'partial', 'carried_over'));

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  billing_year INTEGER;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  billing_month INTEGER;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  is_over_limit BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  over_limit_approved_by TEXT;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  over_limit_approved_at TIMESTAMPTZ;

-- 2. users テーブル拡張（立替上限・請求先情報）
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  advance_limit INTEGER;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  billing_name TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  billing_address TEXT;

-- 3. monthly_closes テーブル（SV締め）
-- =============================================================================
CREATE TABLE IF NOT EXISTS monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  拠点 TEXT NOT NULL,
  close_year INTEGER NOT NULL,
  close_month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'modified')),
  closed_by TEXT,                     -- メールアドレス
  closed_at TIMESTAMPTZ,
  modification_count INTEGER NOT NULL DEFAULT 0,
  last_modified_at TIMESTAMPTZ,
  last_modified_by TEXT,              -- メールアドレス
  last_modified_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(拠点, close_year, close_month)
);

-- 4. billings テーブル（請求書）
-- =============================================================================
CREATE TABLE IF NOT EXISTS billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_number TEXT NOT NULL UNIQUE,
  拠点 TEXT NOT NULL,
  利用者 TEXT,                         -- NULL可（共通費対応）
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  billing_date DATE NOT NULL,
  due_date DATE,
  total_amount INTEGER NOT NULL,
  carried_over_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL GENERATED ALWAYS AS
    (total_amount + carried_over_amount - paid_amount) STORED,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'sent', 'partial', 'paid', 'overpaid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by TEXT NOT NULL,            -- メールアドレス
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. transactions.billing_id（billings作成後に追加）
-- =============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  billing_id UUID REFERENCES billings(id);

-- 6. billing_items テーブル（請求明細）
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id)
);

-- 7. インデックス
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_billing_status
  ON transactions (billing_status)
  WHERE billing_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_billing_period
  ON transactions (billing_year, billing_month)
  WHERE billing_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billings_period
  ON billings (billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_billings_status
  ON billings (status);

-- 8. updated_at 自動更新トリガー
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_monthly_closes_updated_at'
  ) THEN
    CREATE TRIGGER update_monthly_closes_updated_at
      BEFORE UPDATE ON monthly_closes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_billings_updated_at'
  ) THEN
    CREATE TRIGGER update_billings_updated_at
      BEFORE UPDATE ON billings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
