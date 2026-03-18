-- 承認ワークフロー拡張

-- 差戻し理由カラムの追加
ALTER TABLE transactions ADD COLUMN rejection_reason TEXT;

-- 承認ステータスでの検索を高速化
CREATE INDEX idx_transactions_approval_status ON transactions(approval_status);

-- RLSポリシー更新: 記録者は差戻し状態のトランザクションも更新可能に
DROP POLICY "transactions_update" ON transactions;
CREATE POLICY "transactions_update" ON transactions FOR UPDATE TO authenticated
  USING (
    (recorded_by = get_current_employee_id() AND approval_status IN ('draft', 'rejected'))
    OR
    (get_current_employee_role() IN ('hq_admin', 'section_chief', 'supervisor')
     AND location_id IN (SELECT get_authorized_location_ids()))
  );
