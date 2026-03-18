-- GH出納帳 マイグレーション006: 利用者テーブル + 取引テーブル拡張 + 不足金/過剰金カテゴリ
-- ============================================================

-- ============================================================
-- RESIDENTS（利用者/入居者マスタ）
-- ============================================================
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_residents_location ON residents(location_id);
CREATE INDEX idx_residents_active ON residents(location_id, is_active);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_residents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION update_residents_updated_at();

-- ============================================================
-- TRANSACTIONS に resident_id カラム追加
-- ============================================================
ALTER TABLE transactions ADD COLUMN resident_id UUID REFERENCES residents(id);
CREATE INDEX idx_transactions_resident ON transactions(resident_id);

-- ============================================================
-- 不足金・過剰金カテゴリ追加（存在しない場合のみ）
-- ============================================================
INSERT INTO categories (name, code, transaction_type, income_expense, is_active, sort_order)
SELECT '不足金', 'shortage', 'shortage_entry', 'expense', true, 90
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'shortage');

INSERT INTO categories (name, code, transaction_type, income_expense, is_active, sort_order)
SELECT '過剰金', 'surplus', 'surplus_entry', 'income', true, 91
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'surplus');

-- ============================================================
-- RLSポリシー（利用者テーブル）
-- ============================================================
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

-- 閲覧: 権限のある拠点の利用者 (admin/課長は全件)
CREATE POLICY "residents_select" ON residents FOR SELECT TO authenticated
  USING (
    get_current_employee_role() IN ('hq_admin', 'section_chief')
    OR location_id IN (SELECT get_authorized_location_ids())
  );

-- 挿入: 書込権限のある拠点
CREATE POLICY "residents_insert" ON residents FOR INSERT TO authenticated
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM employee_location_authority
      WHERE employee_id = get_current_employee_id() AND can_write = true
    )
    OR get_current_employee_role() = 'hq_admin'
  );

-- 更新: 書込権限のある拠点 or admin
CREATE POLICY "residents_update" ON residents FOR UPDATE TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employee_location_authority
      WHERE employee_id = get_current_employee_id() AND can_write = true
    )
    OR get_current_employee_role() = 'hq_admin'
  );

-- 削除: adminのみ
CREATE POLICY "residents_delete" ON residents FOR DELETE TO authenticated
  USING (get_current_employee_role() = 'hq_admin');
