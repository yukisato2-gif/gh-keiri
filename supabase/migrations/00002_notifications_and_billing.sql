-- GH出納帳 - 通知テーブル + 月次集計関数

-- 通知テーブル (AppSheet Bot再現)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  "拠点" TEXT REFERENCES locations("拠点id"),
  recipient_email TEXT,
  recipient_role TEXT,
  related_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_email, read);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications (recipient_role, "拠点", read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === 月次利用者請求集計関数 (AppSheet Bot「月次利用者請求集計（自動）」再現) ===
-- 毎月1日に実行: 前月の利用者ごとの立替金を集計してmonthly_billingに反映
CREATE OR REPLACE FUNCTION run_monthly_billing(target_yyyymm INTEGER DEFAULT NULL)
RETURNS TABLE(処理件数 INTEGER, 新規作成 INTEGER, 更新件数 INTEGER) AS $$
DECLARE
  v_ym INTEGER;
  v_new INTEGER := 0;
  v_upd INTEGER := 0;
  v_total INTEGER := 0;
  rec RECORD;
BEGIN
  -- 対象年月: 指定なしの場合は前月
  IF target_yyyymm IS NULL THEN
    v_ym := EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '1 month'))::INTEGER * 100
           + EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '1 month'))::INTEGER;
  ELSE
    v_ym := target_yyyymm;
  END IF;

  -- 利用者ごとの立替金合計を集計
  FOR rec IN
    SELECT
      t."利用者",
      t."拠点",
      SUM(t."金額") AS total
    FROM transactions t
    WHERE t."年月" = v_ym
      AND t."対応種別" = '立替金'
      AND t."利用者" IS NOT NULL
    GROUP BY t."利用者", t."拠点"
  LOOP
    v_total := v_total + 1;

    -- 重複チェック (AppSheet: 重複チェック分岐)
    IF EXISTS (
      SELECT 1 FROM monthly_billing
      WHERE "利用者" = rec."利用者"
        AND "拠点" = rec."拠点"
        AND "対象年月" = v_ym
    ) THEN
      -- 既存レコードを更新
      UPDATE monthly_billing
      SET "合計金額" = rec.total,
          "更新日時" = NOW()
      WHERE "利用者" = rec."利用者"
        AND "拠点" = rec."拠点"
        AND "対象年月" = v_ym;
      v_upd := v_upd + 1;
    ELSE
      -- 新規作成
      INSERT INTO monthly_billing ("請求id", "利用者", "拠点", "対象年月", "合計金額", "作成日時", "更新日時")
      VALUES (
        'mb-' || v_ym || '-' || rec."利用者" || '-' || rec."拠点",
        rec."利用者",
        rec."拠点",
        v_ym,
        rec.total,
        NOW(),
        NOW()
      );
      v_new := v_new + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_new, v_upd;
END;
$$ LANGUAGE plpgsql;

-- pg_cron で毎月1日12:00に自動実行 (Supabase Pro以上で利用可能)
-- Free プランでは手動実行 or アプリからのHTTP呼び出しで代替
-- SELECT cron.schedule('monthly-billing', '0 12 1 * *', 'SELECT * FROM run_monthly_billing()');
