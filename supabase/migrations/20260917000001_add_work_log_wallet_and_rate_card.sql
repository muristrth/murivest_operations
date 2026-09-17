-- ============================================================================
-- MURIVEST — WORK LOG & UPLOAD TRACKER, RATE CARD AND STAFF WALLET
-- Tracks work done for properties published on any platform (Murivest Studio,
-- Jiji, etc.), prices each logged item against the rate card, and derives what
-- is owed to each member of staff.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RATE CARD
-- ---------------------------------------------------------------------------
CREATE TABLE public.rate_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  section text NOT NULL DEFAULT 'upload' CHECK (section IN ('upload', 'additional')),
  name text NOT NULL,
  description text,
  rate_kes numeric(12, 2) NOT NULL DEFAULT 0 CHECK (rate_kes >= 0),
  bonus_kes numeric(12, 2) NOT NULL DEFAULT 0 CHECK (bonus_kes >= 0),
  -- 'master_db' means the bonus is only earned when the item is also uploaded
  -- to the Murivest Master database.
  bonus_condition text,
  unit_label text NOT NULL DEFAULT 'upload',
  requires_master_db boolean NOT NULL DEFAULT false,
  tracks_property boolean NOT NULL DEFAULT true,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  total_possible_kes numeric(12, 2) GENERATED ALWAYS AS (rate_kes + bonus_kes) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rate_card TO authenticated;
GRANT ALL ON public.rate_card TO service_role;
ALTER TABLE public.rate_card ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_card read" ON public.rate_card FOR SELECT TO authenticated USING (public.can('ratecard.view'));
CREATE POLICY "rate_card manage" ON public.rate_card FOR ALL TO authenticated USING (public.can('ratecard.manage')) WITH CHECK (public.can('ratecard.manage'));

-- ---------------------------------------------------------------------------
-- WALLET PAYMENTS (payouts against approved work)
-- ---------------------------------------------------------------------------
CREATE TABLE public.wallet_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_kes numeric(12, 2) NOT NULL CHECK (amount_kes > 0),
  period_start date,
  period_end date,
  method text NOT NULL DEFAULT 'mpesa' CHECK (method IN ('mpesa', 'bank_transfer', 'cash', 'other')),
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallet_payments TO authenticated;
GRANT ALL ON public.wallet_payments TO service_role;
ALTER TABLE public.wallet_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_payments read own" ON public.wallet_payments FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR public.can('wallet.view_all'));
CREATE POLICY "wallet_payments create" ON public.wallet_payments FOR INSERT TO authenticated
  WITH CHECK (public.can('wallet.pay'));
CREATE POLICY "wallet_payments update" ON public.wallet_payments FOR UPDATE TO authenticated
  USING (public.can('wallet.pay')) WITH CHECK (public.can('wallet.pay'));

-- ---------------------------------------------------------------------------
-- WORK LOG ENTRIES (the upload tracker)
-- ---------------------------------------------------------------------------
CREATE TABLE public.work_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rate_card_id uuid NOT NULL REFERENCES public.rate_card(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  property_type text,
  platform text,
  country text,
  master_db_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (master_db_status IN ('yes', 'no', 'not_applicable')),
  related_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  reference_url text,
  notes text,
  -- Rates are snapshotted so historical entries are not re-priced when the
  -- rate card changes.
  unit_rate_kes numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_rate_kes >= 0),
  unit_bonus_kes numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_bonus_kes >= 0),
  amount_kes numeric(12, 2) GENERATED ALWAYS AS (
    quantity * (unit_rate_kes + CASE WHEN master_db_status = 'yes' THEN unit_bonus_kes ELSE 0 END)
  ) STORED,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'verified', 'approved', 'rejected', 'paid')),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  payment_id uuid REFERENCES public.wallet_payments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.work_log_entries TO authenticated;
GRANT ALL ON public.work_log_entries TO service_role;
ALTER TABLE public.work_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_log read" ON public.work_log_entries FOR SELECT TO authenticated
  USING (public.can('worklog.view') AND (staff_id = auth.uid() OR public.can('worklog.view_all')));
CREATE POLICY "work_log create" ON public.work_log_entries FOR INSERT TO authenticated
  WITH CHECK (public.can('worklog.create') AND (staff_id = auth.uid() OR public.can('worklog.view_all')));
-- Staff may correct their own entries while they are still pending.
CREATE POLICY "work_log update own" ON public.work_log_entries FOR UPDATE TO authenticated
  USING (public.can('worklog.edit') AND staff_id = auth.uid() AND status IN ('submitted', 'rejected'))
  WITH CHECK (public.can('worklog.edit') AND staff_id = auth.uid() AND status IN ('submitted', 'rejected'));
CREATE POLICY "work_log approve" ON public.work_log_entries FOR UPDATE TO authenticated
  USING (public.can('worklog.approve')) WITH CHECK (public.can('worklog.approve'));

CREATE INDEX idx_work_log_staff_date ON public.work_log_entries(staff_id, entry_date DESC);
CREATE INDEX idx_work_log_status ON public.work_log_entries(status);
CREATE INDEX idx_work_log_rate_card ON public.work_log_entries(rate_card_id);
CREATE INDEX idx_work_log_property ON public.work_log_entries(related_property_id);

-- ---------------------------------------------------------------------------
-- RATE SNAPSHOT: fill unit rates from the rate card when not supplied
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_rate_card_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rc public.rate_card%ROWTYPE;
BEGIN
  SELECT * INTO rc FROM public.rate_card WHERE id = NEW.rate_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown rate card item';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.rate_card_id IS DISTINCT FROM OLD.rate_card_id THEN
    NEW.unit_rate_kes := rc.rate_kes;
    NEW.unit_bonus_kes := rc.bonus_kes;
  END IF;
  IF rc.bonus_kes = 0 THEN
    NEW.master_db_status := CASE WHEN NEW.master_db_status = 'yes' THEN 'not_applicable' ELSE NEW.master_db_status END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_work_log_rate_snapshot BEFORE INSERT OR UPDATE ON public.work_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.apply_rate_card_snapshot();

CREATE TRIGGER t_rate_card_updated BEFORE UPDATE ON public.rate_card FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_wallet_payments_updated BEFORE UPDATE ON public.wallet_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_work_log_updated BEFORE UPDATE ON public.work_log_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- AUDIT + NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_work_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, new_value)
    VALUES (auth.uid(), 'Work logged', 'work_log', NEW.id::text,
            NEW.quantity || ' × ' || COALESCE(NEW.property_type, 'item'), NEW.amount_kes::text);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Work log status changed', 'work_log', NEW.id::text,
            NEW.quantity || ' × ' || COALESCE(NEW.property_type, 'item'), 'status', OLD.status, NEW.status);

    IF NEW.status IN ('approved', 'rejected', 'paid') AND NEW.staff_id <> COALESCE(auth.uid(), NEW.staff_id) THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
      VALUES (NEW.staff_id, 'work_log_' || NEW.status,
              'Work log ' || NEW.status,
              'KES ' || NEW.amount_kes || ' logged on ' || NEW.entry_date, 'work_log', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_work_log_audit AFTER INSERT OR UPDATE ON public.work_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_work_log_changes();

CREATE OR REPLACE FUNCTION public.notify_wallet_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  VALUES (NEW.staff_id, 'wallet_payment', 'Payment recorded',
          'KES ' || NEW.amount_kes || ' paid via ' || NEW.method, 'wallet', NEW.id::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER t_wallet_payment_notify AFTER INSERT ON public.wallet_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_payment();

-- ---------------------------------------------------------------------------
-- WALLET SUMMARY VIEW — what each member of staff has earned and is owed
-- security_invoker keeps the underlying RLS policies in force.
-- ---------------------------------------------------------------------------
CREATE VIEW public.staff_wallet_summary
WITH (security_invoker = true) AS
SELECT
  p.id                                       AS staff_id,
  p.full_name,
  p.email,
  p.job_title,
  COALESCE(w.entry_count, 0)::bigint         AS entry_count,
  COALESCE(w.unit_count, 0)::bigint          AS unit_count,
  COALESCE(w.earned_kes, 0)::numeric         AS earned_kes,
  COALESCE(w.pending_kes, 0)::numeric        AS pending_kes,
  COALESCE(w.approved_kes, 0)::numeric       AS approved_kes,
  COALESCE(w.rejected_kes, 0)::numeric       AS rejected_kes,
  COALESCE(pay.paid_kes, 0)::numeric         AS paid_kes,
  (COALESCE(w.approved_kes, 0) - COALESCE(pay.paid_kes, 0))::numeric AS balance_kes,
  w.last_entry_date
FROM public.profiles p
LEFT JOIN (
  SELECT
    staff_id,
    count(*)                                                                     AS entry_count,
    sum(quantity)                                                                AS unit_count,
    sum(amount_kes) FILTER (WHERE status <> 'rejected')                          AS earned_kes,
    sum(amount_kes) FILTER (WHERE status IN ('submitted', 'verified'))            AS pending_kes,
    sum(amount_kes) FILTER (WHERE status IN ('approved', 'paid'))                 AS approved_kes,
    sum(amount_kes) FILTER (WHERE status = 'rejected')                            AS rejected_kes,
    max(entry_date)                                                              AS last_entry_date
  FROM public.work_log_entries
  WHERE deleted_at IS NULL
  GROUP BY staff_id
) w ON w.staff_id = p.id
LEFT JOIN (
  SELECT staff_id, sum(amount_kes) AS paid_kes
  FROM public.wallet_payments
  GROUP BY staff_id
) pay ON pay.staff_id = p.id;
GRANT SELECT ON public.staff_wallet_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- RATE CARD SEED — murivest.co.ke/studio upload rate card
-- ---------------------------------------------------------------------------
INSERT INTO public.rate_card
  (code, section, name, description, rate_kes, bonus_kes, bonus_condition, unit_label, requires_master_db, tracks_property, notes, sort_order)
VALUES
  ('rental_space_upload', 'upload', 'Rental Space Upload',
   'Upload individual rental spaces to murivest.co.ke/studio', 10, 0, NULL, 'upload', false, true,
   'Per upload. Residential/commercial rental listings.', 1),
  ('kenya_property_upload', 'upload', 'Kenya Property Upload',
   'Upload Kenya properties to studio platform', 20, 10, 'master_db', 'upload', false, true,
   '+KES 10 bonus per upload to Murivest Master database.', 2),
  ('international_property_upload', 'upload', 'International Property Upload',
   'Upload international properties + Murivest Master integration', 30, 0, NULL, 'upload', true, true,
   'Full integration with Murivest Master required per upload.', 3),
  ('property_research_vetting', 'additional', 'Property Research & Vetting',
   'Research and verify property listings before upload', 5, 0, NULL, 'property', false, true,
   'Rate to be agreed.', 4),
  ('client_followup_call', 'additional', 'Client Follow-Up Calls',
   'Follow up with prospective investors/tenants', 10, 0, NULL, 'confirmed lead', false, false,
   'Per confirmed lead.', 5),
  ('investor_report', 'additional', 'Investor Report Preparation',
   'Compile property performance reports for investors', 100, 0, NULL, 'report', false, true,
   'Per report.', 6),
  ('market_analysis', 'additional', 'Market Analysis Write-Up',
   'Research & write market analysis for specific property zones using AI with supervision on exact prompts to use',
   30, 0, NULL, 'analysis', false, false, 'Per analysis.', 7),
  ('social_media_content', 'additional', 'Social Media Content Upload',
   'Upload and manage property content on social platforms, created with ChatGPT only; prompts require supervision',
   20, 0, NULL, 'post/batch', false, true, 'Per post/batch.', 8)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PERMISSIONS — the work log, rate card and wallet are available to all roles;
-- verification, approval and payment stay with the Managing Director.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('managing_director', 'worklog.view'),
  ('managing_director', 'worklog.view_all'),
  ('managing_director', 'worklog.create'),
  ('managing_director', 'worklog.edit'),
  ('managing_director', 'worklog.verify'),
  ('managing_director', 'worklog.approve'),
  ('managing_director', 'wallet.view'),
  ('managing_director', 'wallet.view_all'),
  ('managing_director', 'wallet.pay'),
  ('managing_director', 'ratecard.view'),
  ('managing_director', 'ratecard.manage'),
  ('secretariat', 'worklog.view'),
  ('secretariat', 'worklog.create'),
  ('secretariat', 'worklog.edit'),
  ('secretariat', 'wallet.view'),
  ('secretariat', 'ratecard.view'),
  ('capital_advisor', 'worklog.view'),
  ('capital_advisor', 'worklog.create'),
  ('capital_advisor', 'worklog.edit'),
  ('capital_advisor', 'wallet.view'),
  ('capital_advisor', 'ratecard.view')
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------------------
-- KNOWLEDGE GUIDE — how to access and use the Studio
-- ---------------------------------------------------------------------------
INSERT INTO public.knowledge_guide (category, title, content, sort_order) VALUES
  ('Studio Access', 'Step 1 — Open the Studio',
   E'Go to https://murivest.co.ke/studio in Chrome (desktop is required for uploads).\nBookmark the page — every upload you are paid for must be made here, not on any other site.', 1),
  ('Studio Access', 'Step 2 — Sign in',
   E'Sign in with the Murivest Studio account issued to you by the Managing Director.\nIf you do not have credentials, raise a request in Correspondence addressed to the Secretariat.\nNever share your credentials; every upload is attributed to the signed-in account.', 2),
  ('Studio Access', 'Step 3 — Choose the correct upload type',
   E'Rental Space — individual residential/commercial rental spaces.\nKenya Property — Kenyan sale/land-banking listings.\nInternational Property — non-Kenyan listings; these must always be integrated with Murivest Master.', 3),
  ('Studio Access', 'Step 4 — Complete the listing',
   E'Add title, location, price, tenure, description and at least three images.\nVerify the property against source documents before publishing (Property Research & Vetting is separately payable).', 4),
  ('Studio Access', 'Step 5 — Mirror to the Murivest Master database',
   E'Kenya uploads earn a KES 10 bonus per upload when they are also added to the Murivest Master database.\nInternational uploads require full Murivest Master integration — they are not payable without it.', 5),
  ('Studio Access', 'Step 6 — Log the work',
   E'Open Properties → Work Log in this system and record the date, upload type, quantity, platform, country and whether the Master database was updated.\nEntries are priced automatically from the rate card and appear in your Wallet.', 6),
  ('Studio Access', 'Step 7 — Verification and payment',
   E'The Managing Director verifies and approves each entry.\nApproved entries move to your Wallet balance; payments recorded against your wallet reduce that balance.\nRejected entries show the reason and can be corrected and resubmitted.', 7)
ON CONFLICT DO NOTHING;
