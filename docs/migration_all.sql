-- =============================================================================
-- GH経理 全フェーズ Migration SQL（Phase 1 + Phase 2 統合版）
-- 設計書 Rev.4 準拠
-- 依存順序を考慮した実行順序
-- =============================================================================

-- =============================================================================
-- Phase 1: テーブル拡張 + billings + monthly_closes
-- =============================================================================

-- 1. transactions テーブル拡張（billing_id 以外）
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
  over_limit_approved_by UUID REFERENCES employees(id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  over_limit_approved_at TIMESTAMPTZ;

-- 2. residents テーブル拡張
-- =============================================================================
ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  advance_limit INTEGER;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  billing_name TEXT;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  billing_address TEXT;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  billing_postal_code TEXT;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  billing_contact TEXT;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS
  billing_notes TEXT;

-- 3. locations テーブル拡張（全銀フォーマット対応）
-- =============================================================================
ALTER TABLE locations ADD COLUMN IF NOT EXISTS
  bank_code CHAR(4);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS
  bank_name_kana TEXT;

ALTER TABLE locations ADD COLUMN IF NOT EXISTS
  branch_code CHAR(3);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS
  branch_name_kana TEXT;

ALTER TABLE locations ADD COLUMN IF NOT EXISTS
  account_holder_kana TEXT;

-- 4. monthly_closes テーブル（SV締め）
-- =============================================================================
CREATE TABLE IF NOT EXISTS monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  close_year INTEGER NOT NULL,
  close_month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'modified')),
  closed_by UUID REFERENCES employees(id),
  closed_at TIMESTAMPTZ,
  modification_count INTEGER NOT NULL DEFAULT 0,
  last_modified_at TIMESTAMPTZ,
  last_modified_by UUID REFERENCES employees(id),
  last_modified_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, close_year, close_month)
);

-- 5. billings テーブル（請求書）
-- =============================================================================
CREATE TABLE IF NOT EXISTS billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_number TEXT NOT NULL UNIQUE,
  location_id UUID NOT NULL REFERENCES locations(id),
  resident_id UUID REFERENCES residents(id),
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
  created_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. transactions.billing_id（billings作成後に追加）
-- =============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS
  billing_id UUID REFERENCES billings(id);

-- 7. billing_items テーブル（請求明細）
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id)
);

-- =============================================================================
-- Phase 2: payments + settlements
-- =============================================================================

-- 8. payments テーブル（入金/返金記録）
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id),
  payment_date DATE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_kind TEXT NOT NULL
    CHECK (payment_kind IN ('receipt', 'refund')),
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('transfer', 'cash', 'other')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. settlements テーブル（拠点精算）
-- =============================================================================
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  settlement_year INTEGER NOT NULL,
  settlement_month INTEGER NOT NULL,
  total_advance_amount INTEGER NOT NULL DEFAULT 0,
  total_payment_received INTEGER NOT NULL DEFAULT 0,
  replenishment_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'requested', 'transferred', 'confirmed')),
  transfer_date DATE,
  transfer_amount INTEGER,
  transferred_by UUID REFERENCES employees(id),
  confirmed_by UUID REFERENCES employees(id),
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, settlement_year, settlement_month)
);

-- =============================================================================
-- インデックス（全フェーズ）
-- =============================================================================

-- Phase 1
CREATE INDEX IF NOT EXISTS idx_transactions_location_period
  ON transactions (location_id, billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_transactions_billing_status
  ON transactions (billing_status)
  WHERE billing_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billings_resident_period
  ON billings (resident_id, billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_billings_status
  ON billings (status);

-- Phase 2
CREATE INDEX IF NOT EXISTS idx_payments_billing_id
  ON payments (billing_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_date
  ON payments (payment_date);

CREATE INDEX IF NOT EXISTS idx_settlements_location_period
  ON settlements (location_id, settlement_year, settlement_month);

CREATE INDEX IF NOT EXISTS idx_settlements_status
  ON settlements (status);

-- =============================================================================
-- 更新トリガー（updated_at 自動更新）
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_settlements_updated_at'
  ) THEN
    CREATE TRIGGER update_settlements_updated_at
      BEFORE UPDATE ON settlements
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- RLS ポリシー（必要に応じて有効化）
-- =============================================================================
-- ALTER TABLE monthly_closes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE billings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
