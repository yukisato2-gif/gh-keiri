-- =============================================================================
-- GH経理 フェーズ2 Migration SQL
-- 設計書 Rev.4 準拠
-- payments テーブル + settlements テーブル
-- 前提: Phase 1 (billings, monthly_closes 等) が適用済みであること
-- =============================================================================

-- 1. payments テーブル（入金/返金記録）
-- =============================================================================
-- amount は常に正数。payment_kind で入金/返金を区別する。
-- receipt: 入金（paid_amount に加算）
-- refund:  返金（paid_amount から減算）
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

-- 2. settlements テーブル（拠点精算）
-- =============================================================================
-- INT×2 方式: settlement_year + settlement_month で月を管理
-- replenishment_amount = total_advance_amount - total_payment_received
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

-- 3. インデックス
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_billing_id
  ON payments (billing_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_date
  ON payments (payment_date);

CREATE INDEX IF NOT EXISTS idx_settlements_location_period
  ON settlements (location_id, settlement_year, settlement_month);

CREATE INDEX IF NOT EXISTS idx_settlements_status
  ON settlements (status);

-- 4. 更新トリガー（updated_at 自動更新）
-- =============================================================================
-- update_updated_at_column() 関数は Phase 1 で作成済み

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

-- 5. RLS ポリシー（必要に応じて有効化）
-- =============================================================================
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
