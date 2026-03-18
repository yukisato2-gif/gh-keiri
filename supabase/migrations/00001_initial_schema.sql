-- GH出納帳 - AppSheet忠実再現スキーマ
-- 全テーブルをAppSheet仕様に合わせて定義

-- エリアマスタ
CREATE TABLE IF NOT EXISTS areas (
  "エリアid" TEXT PRIMARY KEY,
  "エリア" TEXT NOT NULL
);

-- 拠点マスタ
CREATE TABLE IF NOT EXISTS locations (
  "拠点id" TEXT PRIMARY KEY,
  "拠点" TEXT NOT NULL,
  "エリア" TEXT REFERENCES areas("エリアid")
);

-- 利用者マスタ (AppSheet: IMPORTRANGE from 利用者名簿)
CREATE TABLE IF NOT EXISTS users (
  "利用者id" TEXT PRIMARY KEY,
  "利用者" TEXT NOT NULL,
  "拠点" TEXT REFERENCES locations("拠点id")
);

-- 従業員マスタ
CREATE TABLE IF NOT EXISTS employees (
  "従業員id" TEXT PRIMARY KEY,
  "従業員名" TEXT NOT NULL,
  "メールアドレス" TEXT NOT NULL UNIQUE,
  "役職" TEXT NOT NULL CHECK ("役職" IN ('本社管理者', 'SV', 'ホーム長')),
  "担当拠点" TEXT REFERENCES locations("拠点id"),
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新日時" TIMESTAMPTZ DEFAULT NOW()
);

-- 権限マスタ
CREATE TABLE IF NOT EXISTS authority (
  "権限id" TEXT PRIMARY KEY,
  "従業員" TEXT NOT NULL, -- メールアドレス
  "拠点" TEXT REFERENCES locations("拠点id"),
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "作成者" TEXT,
  "更新日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新者" TEXT
);

-- 入出金記録 (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  "拠点" TEXT REFERENCES locations("拠点id"),
  "日付" DATE NOT NULL,
  "年月" INTEGER NOT NULL, -- YYYYMM形式
  "対応種別" TEXT NOT NULL CHECK ("対応種別" IN (
    '立替金', '本社入金', '入金', '出金', '手数料', '資金移動'
  )),
  "摘要カテゴリ" TEXT NOT NULL,
  "金額" INTEGER NOT NULL DEFAULT 0,
  "利用者" TEXT,
  "摘要" TEXT,
  "証憑" TEXT, -- 画像URL
  "締めステータス" TEXT NOT NULL DEFAULT '未' CHECK ("締めステータス" IN ('未', '済')),
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "作成者" TEXT,
  "更新日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新者" TEXT,
  "修正依頼フラグ" BOOLEAN DEFAULT FALSE,
  "修正依頼内容" TEXT,
  "修正依頼者" TEXT,
  "修正依頼日時" TIMESTAMPTZ,
  "使用金額" INTEGER,
  "入金おつり" INTEGER,
  "不明金" INTEGER,
  "不明金の理由" TEXT
);

-- 残高チェック (Check)
CREATE TABLE IF NOT EXISTS checks (
  check_id TEXT PRIMARY KEY,
  "拠点" TEXT REFERENCES locations("拠点id"),
  "日付" DATE NOT NULL,
  "一万円札" INTEGER DEFAULT 0,
  "五千円札" INTEGER DEFAULT 0,
  "二千円札" INTEGER DEFAULT 0,
  "千円札" INTEGER DEFAULT 0,
  "五百円玉" INTEGER DEFAULT 0,
  "百円硬貨" INTEGER DEFAULT 0,
  "五十円玉" INTEGER DEFAULT 0,
  "十円硬貨" INTEGER DEFAULT 0,
  "五円硬貨" INTEGER DEFAULT 0,
  "一円硬貨" INTEGER DEFAULT 0,
  "メモ特記事項" TEXT,
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "作成者" TEXT,
  "更新日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新者" TEXT,
  "差額登録済フラグ" BOOLEAN DEFAULT FALSE
);

-- 覚書マスタ (MOU)
CREATE TABLE IF NOT EXISTS mou (
  "覚書id" TEXT PRIMARY KEY,
  "利用者" TEXT REFERENCES users("利用者id"),
  "拠点" TEXT REFERENCES locations("拠点id"),
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "作成者" TEXT,
  "更新日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新者" TEXT
);

-- 月次請求集計 (MonthlyBilling)
CREATE TABLE IF NOT EXISTS monthly_billing (
  "請求id" TEXT PRIMARY KEY,
  "利用者" TEXT REFERENCES users("利用者id"),
  "拠点" TEXT REFERENCES locations("拠点id"),
  "対象年月" INTEGER NOT NULL, -- YYYYMM
  "合計金額" INTEGER DEFAULT 0,
  "作成日時" TIMESTAMPTZ DEFAULT NOW(),
  "更新日時" TIMESTAMPTZ DEFAULT NOW()
);

-- 集計結果
CREATE TABLE IF NOT EXISTS aggregation_results (
  id SERIAL PRIMARY KEY,
  "拠点コード" TEXT,
  "拠点名" TEXT,
  "対象月" INTEGER,
  "対応種別" TEXT,
  "取引件数" INTEGER DEFAULT 0,
  "合計金額" INTEGER DEFAULT 0
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_transactions_拠点_年月 ON transactions ("拠点", "年月");
CREATE INDEX IF NOT EXISTS idx_transactions_拠点_締め ON transactions ("拠点", "締めステータス");
CREATE INDEX IF NOT EXISTS idx_transactions_修正依頼 ON transactions ("拠点", "修正依頼フラグ") WHERE "修正依頼フラグ" = TRUE;
CREATE INDEX IF NOT EXISTS idx_checks_拠点_日付 ON checks ("拠点", "日付");
CREATE INDEX IF NOT EXISTS idx_authority_従業員 ON authority ("従業員");
CREATE INDEX IF NOT EXISTS idx_users_拠点 ON users ("拠点");

-- RLS (Row Level Security)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mou ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_billing ENABLE ROW LEVEL SECURITY;

-- RLS Policies: 認証済みユーザーは全操作可能 (アプリ層で権限制御)
CREATE POLICY "auth_all" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON authority FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON mou FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON monthly_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for receipts (証憑)
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'receipts');
