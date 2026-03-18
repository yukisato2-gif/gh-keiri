-- GH出納帳 初期スキーマ
-- ============================================================

-- ENUM定義
CREATE TYPE user_role AS ENUM ('hq_admin', 'section_chief', 'supervisor', 'home_manager');
CREATE TYPE transaction_type AS ENUM ('cash_advance', 'hq_deposit', 'fund_transfer', 'fee', 'shortage_entry', 'surplus_entry');
CREATE TYPE income_expense_type AS ENUM ('income', 'expense');
CREATE TYPE approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'corrected');

-- ============================================================
-- AREAS（エリアマスタ）
-- ============================================================
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOCATIONS（拠点マスタ）
-- ============================================================
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  area_id UUID NOT NULL REFERENCES areas(id),
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_area ON locations(area_id);

-- ============================================================
-- EMPLOYEES（従業員マスタ）
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'home_manager',
  primary_location_id UUID REFERENCES locations(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_auth ON employees(auth_user_id);
CREATE INDEX idx_employees_location ON employees(primary_location_id);

-- ============================================================
-- EMPLOYEE_LOCATION_AUTHORITY（権限マッピング）
-- ============================================================
CREATE TABLE employee_location_authority (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, location_id)
);
CREATE INDEX idx_ela_employee ON employee_location_authority(employee_id);
CREATE INDEX idx_ela_location ON employee_location_authority(location_id);

-- ============================================================
-- CATEGORIES（摘要カテゴリマスタ）
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  transaction_type transaction_type NOT NULL,
  income_expense income_expense_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRANSACTIONS（入出金記録）
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  income_expense income_expense_type NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  receipt_image_path TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES employees(id),
  approval_status approval_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_transaction_date CHECK (
    transaction_date <= CURRENT_DATE
    AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'
  )
);
CREATE INDEX idx_transactions_location ON transactions(location_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_recorded_by ON transactions(recorded_by);
CREATE INDEX idx_transactions_location_date ON transactions(location_id, transaction_date);

-- ============================================================
-- CASH_CHECKS（残高チェック）
-- ============================================================
CREATE TABLE cash_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  check_date DATE NOT NULL,
  yen_10000 INTEGER NOT NULL DEFAULT 0 CHECK (yen_10000 >= 0),
  yen_5000  INTEGER NOT NULL DEFAULT 0 CHECK (yen_5000 >= 0),
  yen_2000  INTEGER NOT NULL DEFAULT 0 CHECK (yen_2000 >= 0),
  yen_1000  INTEGER NOT NULL DEFAULT 0 CHECK (yen_1000 >= 0),
  yen_500   INTEGER NOT NULL DEFAULT 0 CHECK (yen_500 >= 0),
  yen_100   INTEGER NOT NULL DEFAULT 0 CHECK (yen_100 >= 0),
  yen_50    INTEGER NOT NULL DEFAULT 0 CHECK (yen_50 >= 0),
  yen_10    INTEGER NOT NULL DEFAULT 0 CHECK (yen_10 >= 0),
  yen_5     INTEGER NOT NULL DEFAULT 0 CHECK (yen_5 >= 0),
  yen_1     INTEGER NOT NULL DEFAULT 0 CHECK (yen_1 >= 0),
  total_amount INTEGER GENERATED ALWAYS AS (
    yen_10000 * 10000 + yen_5000 * 5000 + yen_2000 * 2000 +
    yen_1000 * 1000 + yen_500 * 500 + yen_100 * 100 +
    yen_50 * 50 + yen_10 * 10 + yen_5 * 5 + yen_1 * 1
  ) STORED,
  expected_balance INTEGER,
  difference INTEGER GENERATED ALWAYS AS (
    (yen_10000 * 10000 + yen_5000 * 5000 + yen_2000 * 2000 +
     yen_1000 * 1000 + yen_500 * 500 + yen_100 * 100 +
     yen_50 * 50 + yen_10 * 10 + yen_5 * 5 + yen_1 * 1)
    - COALESCE(expected_balance, 0)
  ) STORED,
  checked_by UUID NOT NULL REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, check_date)
);
CREATE INDEX idx_cash_checks_location ON cash_checks(location_id);
CREATE INDEX idx_cash_checks_date ON cash_checks(check_date);

-- ============================================================
-- SYSTEM_CONFIG（システム設定）
-- ============================================================
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES employees(id)
);

INSERT INTO system_config (key, value, description) VALUES
  ('high_value_alert_threshold', '{"amount": 10000}', '高額取引アラート閾値 (円)'),
  ('max_petty_cash_balance', '{"amount": 200000}', '小口現金上限額 (円)');

-- ============================================================
-- ヘルパー関数
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_employee_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION get_current_employee_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION get_authorized_location_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT location_id FROM employee_location_authority
  WHERE employee_id = get_current_employee_id() AND can_read = true;
$$;

-- 月次サマリ関数
CREATE OR REPLACE FUNCTION get_monthly_summary(p_location_id UUID, p_year_month TEXT)
RETURNS TABLE(total_income INTEGER, total_expense INTEGER, transaction_count INTEGER, balance INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN income_expense = 'income' THEN amount ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN income_expense = 'expense' THEN amount ELSE 0 END), 0)::INTEGER,
    COUNT(*)::INTEGER,
    COALESCE(SUM(CASE WHEN income_expense = 'income' THEN amount ELSE -amount END), 0)::INTEGER
  FROM transactions
  WHERE location_id = p_location_id AND to_char(transaction_date, 'YYYY-MM') = p_year_month;
$$;

-- 帳簿残高計算関数
CREATE OR REPLACE FUNCTION calculate_expected_balance(p_location_id UUID, p_as_of_date DATE)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN income_expense = 'income' THEN amount ELSE -amount END
  ), 0)::INTEGER
  FROM transactions
  WHERE location_id = p_location_id AND transaction_date <= p_as_of_date;
$$;

-- ============================================================
-- RLSポリシー
-- ============================================================
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_location_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Areas: 全員閲覧可
CREATE POLICY "areas_select" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_manage" ON areas FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');

-- Locations: 権限拠点のみ (admin/課長は全件)
CREATE POLICY "locations_select" ON locations FOR SELECT TO authenticated
  USING (get_current_employee_role() IN ('hq_admin', 'section_chief') OR id IN (SELECT get_authorized_location_ids()));
CREATE POLICY "locations_manage" ON locations FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');

-- Employees: 自分 + 権限拠点の従業員
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR get_current_employee_role() IN ('hq_admin', 'section_chief') OR primary_location_id IN (SELECT get_authorized_location_ids()));
CREATE POLICY "employees_manage" ON employees FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');

-- Authority: 自分の権限のみ
CREATE POLICY "ela_select" ON employee_location_authority FOR SELECT TO authenticated
  USING (employee_id = get_current_employee_id() OR get_current_employee_role() IN ('hq_admin', 'section_chief'));
CREATE POLICY "ela_manage" ON employee_location_authority FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');

-- Categories: 全員閲覧可
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_manage" ON categories FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');

-- Transactions: 権限拠点のみ
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO authenticated
  USING (get_current_employee_role() IN ('hq_admin', 'section_chief') OR location_id IN (SELECT get_authorized_location_ids()));
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO authenticated
  WITH CHECK (location_id IN (SELECT location_id FROM employee_location_authority WHERE employee_id = get_current_employee_id() AND can_write = true));
CREATE POLICY "transactions_update" ON transactions FOR UPDATE TO authenticated
  USING ((recorded_by = get_current_employee_id() AND approval_status = 'draft') OR (get_current_employee_role() IN ('hq_admin', 'section_chief', 'supervisor') AND location_id IN (SELECT get_authorized_location_ids())));

-- Cash Checks: 権限拠点のみ
CREATE POLICY "cash_checks_select" ON cash_checks FOR SELECT TO authenticated
  USING (get_current_employee_role() IN ('hq_admin', 'section_chief') OR location_id IN (SELECT get_authorized_location_ids()));
CREATE POLICY "cash_checks_insert" ON cash_checks FOR INSERT TO authenticated
  WITH CHECK (location_id IN (SELECT location_id FROM employee_location_authority WHERE employee_id = get_current_employee_id() AND can_write = true));

-- System Config: 全員閲覧、管理者のみ更新
CREATE POLICY "config_select" ON system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_manage" ON system_config FOR ALL TO authenticated USING (get_current_employee_role() = 'hq_admin');
