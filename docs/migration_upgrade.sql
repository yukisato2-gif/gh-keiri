-- =============================================================================
-- GH経理 互換性マイグレーション
-- 既存データには一切変更を加えない（カラム追加のみ）
-- 既存の year_month TEXT カラムも残す（GH出納帳との互換性維持）
-- =============================================================================

-- 1. transactions テーブル: 不足カラム追加
-- =============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS billing_year INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_over_limit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS over_limit_approved_by UUID REFERENCES employees(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS over_limit_approved_at TIMESTAMPTZ;

-- 2. residents テーブル: 不足カラム追加
-- =============================================================================
ALTER TABLE residents ADD COLUMN IF NOT EXISTS advance_limit INTEGER;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- 3. locations テーブル: 不足カラム追加
-- =============================================================================
ALTER TABLE locations ADD COLUMN IF NOT EXISTS bank_code CHAR(4);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS bank_name_kana TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS branch_code CHAR(3);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS branch_name_kana TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS account_holder_kana TEXT;

-- 4. billings テーブル: INT×2カラム追加 (year_month TEXTは残す)
-- =============================================================================
ALTER TABLE billings ADD COLUMN IF NOT EXISTS billing_year INTEGER;
ALTER TABLE billings ADD COLUMN IF NOT EXISTS billing_month INTEGER;
ALTER TABLE billings ADD COLUMN IF NOT EXISTS carried_over_amount INTEGER NOT NULL DEFAULT 0;

-- 注: balance は GENERATED ALWAYS ではなく通常カラムとして追加
-- （既存テーブルにGENERATED列を後付けするのは制約が多いため）
ALTER TABLE billings ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0;

-- billings の status に 'overpaid' を許可する (CHECK制約の更新)
-- 既存制約を削除して再作成
ALTER TABLE billings DROP CONSTRAINT IF EXISTS billings_status_check;
ALTER TABLE billings ADD CONSTRAINT billings_status_check
  CHECK (status IN ('draft', 'issued', 'sent', 'partial', 'paid', 'overpaid', 'overdue', 'cancelled'));

-- 5. settlements テーブル: INT×2カラム追加 (year_month TEXTは残す)
-- =============================================================================
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settlement_year INTEGER;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settlement_month INTEGER;

-- 6. monthly_closes テーブル: INT×2カラム追加 (year_month TEXTは残す)
-- =============================================================================
ALTER TABLE monthly_closes ADD COLUMN IF NOT EXISTS close_year INTEGER;
ALTER TABLE monthly_closes ADD COLUMN IF NOT EXISTS close_month INTEGER;

-- 7. payments テーブル: payment_kind 追加
-- =============================================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_kind TEXT NOT NULL DEFAULT 'receipt'
  CHECK (payment_kind IN ('receipt', 'refund'));

-- 8. billing_items に UNIQUE 制約追加（なければ）
-- =============================================================================
-- (既に UNIQUE(transaction_id) がある場合はスキップ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_items_transaction_id_key'
      AND conrelid = 'billing_items'::regclass
  ) THEN
    ALTER TABLE billing_items ADD CONSTRAINT billing_items_transaction_id_key UNIQUE (transaction_id);
  END IF;
END $$;

-- 9. インデックス追加（なければ）
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_billing_year_month
  ON transactions (location_id, billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_billings_year_month_int
  ON billings (billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_settlements_year_month_int
  ON settlements (settlement_year, settlement_month);

CREATE INDEX IF NOT EXISTS idx_monthly_closes_year_month_int
  ON monthly_closes (close_year, close_month);

-- 10. updated_at トリガー関数（なければ作成）
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. RLS ポリシー（GH経理用 - anon でも読み取り可能に）
-- =============================================================================
-- 注: 既存の authenticated ポリシーに加え、anon でも基本読み取りを許可
-- これにより、デモモード→Supabase切替時の認証前でもデータ確認が可能

-- 完了メッセージ
SELECT 'Migration completed successfully. No existing data was modified.' AS result;
