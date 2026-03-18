-- Phase 2: Payment & Settlement Management
-- Adds payment recording and location settlement tracking

-- 1. Payments (入金)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id),
  payment_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'transfer'
    CHECK (payment_method IN ('transfer', 'cash', 'other')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Settlements (拠点精算)
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  year_month TEXT NOT NULL,
  total_advance_amount INTEGER NOT NULL,
  total_payment_received INTEGER NOT NULL DEFAULT 0,
  replenishment_amount INTEGER NOT NULL,
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
  UNIQUE(location_id, year_month)
);

-- 3. Indexes
CREATE INDEX idx_payments_billing ON payments(billing_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_settlements_location ON settlements(location_id, year_month);

-- 4. Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "payments_select" ON payments FOR SELECT USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_update" ON payments FOR UPDATE USING (true);
CREATE POLICY "payments_delete" ON payments FOR DELETE USING (true);

-- RLS policies for settlements
CREATE POLICY "settlements_select" ON settlements FOR SELECT USING (true);
CREATE POLICY "settlements_insert" ON settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "settlements_update" ON settlements FOR UPDATE USING (true);
