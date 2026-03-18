-- Phase 1: Billing System & Monthly Close
-- Adds billing management, monthly close, and transaction billing status

-- 1. Monthly Closes (SV締め)
CREATE TABLE monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  year_month TEXT NOT NULL,
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
  UNIQUE(location_id, year_month)
);

-- 2. Billings (請求書)
CREATE TABLE billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_number TEXT NOT NULL UNIQUE,
  location_id UUID NOT NULL REFERENCES locations(id),
  resident_id UUID NOT NULL REFERENCES residents(id),
  year_month TEXT NOT NULL,
  billing_date DATE NOT NULL,
  due_date DATE,
  total_amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Billing Items (請求明細)
CREATE TABLE billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Extend transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'unbilled'
    CHECK (billing_status IN ('unbilled', 'billed', 'paid', 'partial', 'carried_over')),
  ADD COLUMN IF NOT EXISTS billing_id UUID REFERENCES billings(id),
  ADD COLUMN IF NOT EXISTS billing_month TEXT;

-- 5. Indexes
CREATE INDEX idx_monthly_closes_location ON monthly_closes(location_id, year_month);
CREATE INDEX idx_billings_location ON billings(location_id, year_month);
CREATE INDEX idx_billings_resident ON billings(resident_id);
CREATE INDEX idx_billing_items_billing ON billing_items(billing_id);
CREATE INDEX idx_transactions_billing_status ON transactions(billing_status);
CREATE INDEX idx_transactions_billing_month ON transactions(billing_month);

-- 6. Enable RLS
ALTER TABLE monthly_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for monthly_closes
CREATE POLICY "monthly_closes_select" ON monthly_closes FOR SELECT USING (true);
CREATE POLICY "monthly_closes_insert" ON monthly_closes FOR INSERT WITH CHECK (true);
CREATE POLICY "monthly_closes_update" ON monthly_closes FOR UPDATE USING (true);

-- RLS policies for billings
CREATE POLICY "billings_select" ON billings FOR SELECT USING (true);
CREATE POLICY "billings_insert" ON billings FOR INSERT WITH CHECK (true);
CREATE POLICY "billings_update" ON billings FOR UPDATE USING (true);

-- RLS policies for billing_items
CREATE POLICY "billing_items_select" ON billing_items FOR SELECT USING (true);
CREATE POLICY "billing_items_insert" ON billing_items FOR INSERT WITH CHECK (true);
CREATE POLICY "billing_items_delete" ON billing_items FOR DELETE USING (true);
