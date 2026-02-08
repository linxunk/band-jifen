-- Migration: enable_rls_policies
-- Created at: 1770437201


ALTER TABLE bank_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read bank_cards" ON bank_cards FOR SELECT USING (true);
CREATE POLICY "Allow public insert bank_cards" ON bank_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update bank_cards" ON bank_cards FOR UPDATE USING (true);
CREATE POLICY "Allow public delete bank_cards" ON bank_cards FOR DELETE USING (true);

CREATE POLICY "Allow public read deposit_requests" ON deposit_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert deposit_requests" ON deposit_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update deposit_requests" ON deposit_requests FOR UPDATE USING (true);

CREATE POLICY "Allow public read transfer_rules" ON transfer_rules FOR SELECT USING (true);
CREATE POLICY "Allow public insert transfer_rules" ON transfer_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update transfer_rules" ON transfer_rules FOR UPDATE USING (true);
CREATE POLICY "Allow public delete transfer_rules" ON transfer_rules FOR DELETE USING (true);

CREATE POLICY "Allow public all admin_logs" ON admin_logs FOR ALL USING (true);
;