-- Notifications table for in-app notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL CHECK (type IN ('approval_request', 'approved', 'rejected')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (recipient_id = get_current_employee_id());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = get_current_employee_id());

-- Function to create notifications on approval status change
CREATE OR REPLACE FUNCTION notify_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  tx_desc TEXT;
  recorder_id UUID;
  approver RECORD;
BEGIN
  -- Only fire when approval_status changes
  IF OLD.approval_status = NEW.approval_status THEN
    RETURN NEW;
  END IF;

  tx_desc := NEW.description;
  recorder_id := NEW.recorded_by;

  -- When submitted for approval (draft -> pending), notify approvers
  IF NEW.approval_status = 'pending' THEN
    FOR approver IN
      SELECT DISTINCT e.id
      FROM employees e
      LEFT JOIN employee_location_authority ela ON ela.employee_id = e.id AND ela.location_id = NEW.location_id
      WHERE e.is_active = true
        AND e.id != recorder_id
        AND (
          e.role IN ('hq_admin', 'section_chief')
          OR (e.role = 'supervisor' AND ela.can_approve = true)
        )
    LOOP
      INSERT INTO notifications (recipient_id, type, transaction_id, title, message)
      VALUES (approver.id, 'approval_request', NEW.id, '承認申請', tx_desc || ' の承認申請があります');
    END LOOP;
  END IF;

  -- When approved, notify recorder
  IF NEW.approval_status = 'approved' THEN
    INSERT INTO notifications (recipient_id, type, transaction_id, title, message)
    VALUES (recorder_id, 'approved', NEW.id, '承認完了', tx_desc || ' が承認されました');
  END IF;

  -- When rejected, notify recorder
  IF NEW.approval_status = 'rejected' THEN
    INSERT INTO notifications (recipient_id, type, transaction_id, title, message)
    VALUES (recorder_id, 'rejected', NEW.id, '差戻し', tx_desc || ' が差戻しされました');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_status_change
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_status_change();
