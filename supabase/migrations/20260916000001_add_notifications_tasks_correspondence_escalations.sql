-- NOTIFICATION PREFERENCES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desktop_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS in_app_notifications boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_task_assigned boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_task_deadline boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_appointment boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_followup boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_escalation boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_management_message boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_record_correction boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_property_review boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_announcement boolean NOT NULL DEFAULT true;

-- MD-specific: receive email for ALL CRUD operations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_all_crud boolean NOT NULL DEFAULT false;

-- TASKS TABLE
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'not_started',
  related_client text,
  related_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  related_inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL,
  related_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  related_deal_id uuid,
  due_date date,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completion_notes text,
  review_notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated USING (public.can('tasks.view'));
CREATE POLICY "tasks create" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.can('tasks.create'));
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated USING (public.can('tasks.edit') OR (assigned_to = auth.uid() AND public.can('tasks.edit'))) WITH CHECK (public.can('tasks.edit') OR (assigned_to = auth.uid() AND public.can('tasks.edit')));
CREATE POLICY "tasks assign" ON public.tasks FOR UPDATE TO authenticated USING (public.can('tasks.assign')) WITH CHECK (public.can('tasks.assign'));

-- TASK COMMENTS
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments read" ON public.task_comments FOR SELECT TO authenticated USING (public.can('tasks.view'));
CREATE POLICY "task_comments create" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (public.can('tasks.edit') AND user_id = auth.uid());
CREATE POLICY "task_comments update" ON public.task_comments FOR UPDATE TO authenticated USING (public.can('tasks.edit') AND user_id = auth.uid()) WITH CHECK (public.can('tasks.edit') AND user_id = auth.uid());

-- CORRESPONDENCE TABLE
CREATE TABLE public.correspondence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL, -- 'received' | 'sent'
  from_to text NOT NULL,
  subject text,
  channel text NOT NULL, -- 'email', 'whatsapp', 'phone', 'letter', 'website', 'other'
  action_required boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'closed'
  notes text,
  attachment_url text,
  related_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  related_inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.correspondence TO authenticated;
GRANT ALL ON public.correspondence TO service_role;
ALTER TABLE public.correspondence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "correspondence read" ON public.correspondence FOR SELECT TO authenticated USING (public.can('correspondence.view'));
CREATE POLICY "correspondence create" ON public.correspondence FOR INSERT TO authenticated WITH CHECK (public.can('correspondence.create'));
CREATE POLICY "correspondence update" ON public.correspondence FOR UPDATE TO authenticated USING (public.can('correspondence.edit')) WITH CHECK (public.can('correspondence.edit'));

-- ESCALATIONS TABLE
CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_module text NOT NULL, -- 'inquiries', 'calls', 'properties', 'appointments', 'tasks', 'correspondence', 'followups'
  related_record_id uuid NOT NULL,
  reason text NOT NULL,
  category text NOT NULL, -- 'negotiation', 'pricing', 'valuation', 'complaint', 'legal', 'confidential', 'investment_advice', 'major_client', 'institutional', 'transaction', 'media', 'unusual', 'other'
  priority public.priority_level NOT NULL DEFAULT 'high',
  status text NOT NULL DEFAULT 'open', -- 'open', 'under_review', 'resolved', 'closed'
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  management_response text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalations read" ON public.escalations FOR SELECT TO authenticated USING (public.can('escalations.view'));
CREATE POLICY "escalations create" ON public.escalations FOR INSERT TO authenticated WITH CHECK (public.can('escalations.create'));
CREATE POLICY "escalations update" ON public.escalations FOR UPDATE TO authenticated USING (public.can('escalations.resolve') OR created_by = auth.uid()) WITH CHECK (public.can('escalations.resolve') OR created_by = auth.uid());

-- KNOWLEDGE GUIDE TABLE
CREATE TABLE public.knowledge_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.knowledge_guide TO authenticated;
GRANT ALL ON public.knowledge_guide TO service_role;
ALTER TABLE public.knowledge_guide ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge read" ON public.knowledge_guide FOR SELECT TO authenticated USING (public.can('knowledge.view') AND is_active = true);
CREATE POLICY "knowledge manage" ON public.knowledge_guide FOR ALL TO authenticated USING (public.can('knowledge.manage')) WITH CHECK (public.can('knowledge.manage'));

-- APPOINTMENT CHECKLIST (embedded in appointments via JSONB)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '{"inquiry_received":false,"client_identified":false,"purpose_confirmed":false,"availability_checked":false,"appointment_proposed":false,"appointment_accepted":false,"calendar_entry_created":false,"confirmation_sent":false,"reminder_sent":false,"appointment_completed":false,"outcome_recorded":false,"followup_created":false}'::jsonb;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_message text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_message text;

-- MISSED CALL RETURN QUEUE (view from calls table)
-- We'll handle this in the application layer by filtering calls with status='missed'

-- ROLE PERMISSIONS for new modules
INSERT INTO public.role_permissions (role, permission) VALUES
-- Tasks
('managing_director','tasks.view'),('managing_director','tasks.create'),('managing_director','tasks.edit'),('managing_director','tasks.assign'),('managing_director','tasks.complete'),('managing_director','tasks.review'),
('secretariat','tasks.view'),('secretariat','tasks.create'),('secretariat','tasks.edit'),('secretariat','tasks.complete'),
('capital_advisor','tasks.view'),('capital_advisor','tasks.create'),('capital_advisor','tasks.edit'),('capital_advisor','tasks.complete'),
-- Correspondence
('managing_director','correspondence.view'),('managing_director','correspondence.create'),('managing_director','correspondence.edit'),
('secretariat','correspondence.view'),('secretariat','correspondence.create'),('secretariat','correspondence.edit'),
('capital_advisor','correspondence.view'),
-- Escalations
('managing_director','escalations.view'),('managing_director','escalations.create'),('managing_director','escalations.resolve'),
('secretariat','escalations.view'),('secretariat','escalations.create'),
('capital_advisor','escalations.view'),('capital_advisor','escalations.create'),
-- Knowledge
('managing_director','knowledge.view'),('managing_director','knowledge.manage'),
('secretariat','knowledge.view'),
('capital_advisor','knowledge.view')
ON CONFLICT (role, permission) DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_related ON public.tasks(related_property_id, related_inquiry_id, related_appointment_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_date ON public.correspondence(date DESC);
CREATE INDEX IF NOT EXISTS idx_correspondence_assigned ON public.correspondence(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalations_module_record ON public.escalations(related_module, related_record_id);
CREATE INDEX IF NOT EXISTS idx_escalations_assigned ON public.escalations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON public.escalations(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.knowledge_guide(category);

-- UPDATED_AT TRIGGERS
CREATE TRIGGER t_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_task_comments_updated BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_correspondence_updated BEFORE UPDATE ON public.correspondence FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_escalations_updated BEFORE UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_knowledge_updated BEFORE UPDATE ON public.knowledge_guide FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AUDIT TRIGGERS FOR NEW TABLES
CREATE OR REPLACE FUNCTION public.audit_task_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label)
    VALUES (auth.uid(), 'Task created', 'tasks', NEW.id::text, NEW.title);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Task status changed', 'tasks', NEW.id::text, NEW.title, 'status', OLD.status, NEW.status);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Task assigned', 'tasks', NEW.id::text, NEW.title, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_tasks_audit AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.audit_task_changes();

CREATE OR REPLACE FUNCTION public.audit_escalation_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, new_value)
    VALUES (auth.uid(), 'Escalation created', 'escalations', NEW.id::text, NEW.reason, NEW.category);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Escalation status changed', 'escalations', NEW.id::text, NEW.reason, 'status', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_escalations_audit AFTER INSERT OR UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.audit_escalation_changes();

-- NOTIFICATION TRIGGERS FOR NEW MODULES
-- New task assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> auth.uid() THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);
    
    -- Check if assignee wants email notification
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_task_assigned = true) THEN
      PERFORM public.send_email_notification(NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_task_notify AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- New escalation
CREATE OR REPLACE FUNCTION public.notify_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
BEGIN
  -- Notify MDs
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, 'escalation_created', 'New escalation: ' || NEW.category,
         NEW.reason || ' (' || NEW.related_module || ')', 'escalations', NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role = 'managing_director' AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Notify assignee if different
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'escalation_assigned', 'Escalation assigned to you', NEW.reason, 'escalations', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_escalation_notify AFTER INSERT ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.notify_escalation();

-- MD notification for ALL CRUD (via function called from edge function)
CREATE OR REPLACE FUNCTION public.notify_md_all_crud(_module text, _action text, _record_id text, _record_label text, _field text DEFAULT NULL, _old_value text DEFAULT NULL, _new_value text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  md_user uuid;
BEGIN
  FOR md_user IN SELECT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'managing_director' AND p.notify_all_crud = true LOOP
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (md_user, 'md_audit_' || _action, 'MD Audit: ' || initcap(_action) || ' in ' || _module,
            _record_label || ' — ' || COALESCE(_field || ': ' || _old_value || ' → ' || _new_value, ''), _module, _record_id);
  END LOOP;
END; $$;

-- Task overdue check (run via cron)
CREATE OR REPLACE FUNCTION public.check_overdue_tasks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM public.tasks WHERE status IN ('not_started','in_progress','waiting','blocked') AND due_date < CURRENT_DATE AND deleted_at IS NULL LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = t.assigned_to AND email_notifications = true AND notify_task_deadline = true) THEN
      PERFORM public.send_email_notification(t.assigned_to, 'task_overdue', 'Task overdue: ' || t.title, 'This task was due on ' || t.due_date, 'tasks', t.id::text);
    END IF;
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (t.assigned_to, 'task_overdue', 'Task overdue: ' || t.title, 'This task was due on ' || t.due_date, 'tasks', t.id::text)
    ON CONFLICT DO NOTHING;
  END LOOP;
END; $$;

-- Follow-up due/overdue notifications (run via cron)
CREATE OR REPLACE FUNCTION public.check_due_followups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT * FROM public.followups WHERE status = 'pending' AND due_date <= CURRENT_DATE + INTERVAL '1 day' AND deleted_at IS NULL LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = f.assigned_to AND email_notifications = true AND notify_followup = true) THEN
      PERFORM public.send_email_notification(f.assigned_to, 'followup_due', 'Follow-up due: ' || f.client_name, f.pending_action || ' (Due: ' || f.due_date || ')', 'followups', f.id::text);
    END IF;
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (f.assigned_to, 'followup_due', 'Follow-up due: ' || f.client_name, f.pending_action || ' (Due: ' || f.due_date || ')', 'followups', f.id::text)
    ON CONFLICT DO NOTHING;
  END LOOP;
END; $$;

-- Appointment reminders (run via cron)
CREATE OR REPLACE FUNCTION public.check_appointment_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a record;
BEGIN
  FOR a IN SELECT * FROM public.appointments WHERE status IN ('requested','pending_confirmation','confirmed') AND scheduled_at > NOW() AND scheduled_at <= NOW() + INTERVAL '24 hours' AND deleted_at IS NULL LOOP
    IF a.attendee_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = a.attendee_id AND email_notifications = true AND notify_appointment = true) THEN
      PERFORM public.send_email_notification(a.attendee_id, 'appointment_reminder', 'Appointment reminder: ' || a.client_name, 'Tomorrow at ' || to_char(a.scheduled_at, 'HH24:MI') || ' — ' || a.purpose, 'appointments', a.id::text);
    END IF;
    IF a.attendee_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
      VALUES (a.attendee_id, 'appointment_reminder', 'Appointment reminder: ' || a.client_name, 'Tomorrow at ' || to_char(a.scheduled_at, 'HH24:MI') || ' — ' || a.purpose, 'appointments', a.id::text)
      ON CONFLICT DO NOTHING;
    END IF;
    -- Update reminder_sent flag
    UPDATE public.appointments SET reminder_sent = true WHERE id = a.id AND reminder_sent = false;
  END LOOP;
END; $$;

-- Email notification function (stub - called by edge function)
CREATE OR REPLACE FUNCTION public.send_email_notification(_recipient_id uuid, _type text, _title text, _body text, _module text, _record_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- This is a stub. Actual email sending is done via Supabase Edge Function
  -- The edge function polls for unsent emails or is called via pg_notify
  NULL;
END; $$;

-- Function to queue email for edge function
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  module text,
  record_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_queue TO authenticated;
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_queue read" ON public.email_queue FOR SELECT TO authenticated USING (public.can('system.manage'));
CREATE POLICY "email_queue insert" ON public.email_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_email_queue_pending ON public.email_queue(sent_at) WHERE sent_at IS NULL;

-- Update send_email_notification to queue
CREATE OR REPLACE FUNCTION public.queue_email_notification(_recipient_id uuid, _type text, _title text, _body text, _module text, _record_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_queue (recipient_id, type, title, body, module, record_id)
  VALUES (_recipient_id, _type, _title, _body, _module, _record_id);
END; $$;

-- Replace the stub with queue version
CREATE OR REPLACE FUNCTION public.send_email_notification(_recipient_id uuid, _type text, _title text, _body text, _module text, _record_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.queue_email_notification(_recipient_id, _type, _title, _body, _module, _record_id);
END; $$;

-- Update notify_task_assigned to use queue
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> auth.uid() THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);
    
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_task_assigned = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Update notify_escalation to use queue
CREATE OR REPLACE FUNCTION public.notify_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, 'escalation_created', 'New escalation: ' || NEW.category,
         NEW.reason || ' (' || NEW.related_module || ')', 'escalations', NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role = 'managing_director' AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'escalation_assigned', 'Escalation assigned to you', NEW.reason, 'escalations', NEW.id::text);
    
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_escalation = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'escalation_assigned', 'Escalation assigned to you', NEW.reason, 'escalations', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Daily report submitted notification to MD
CREATE OR REPLACE FUNCTION public.notify_daily_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, 'daily_report_submitted', 'Daily report submitted',
         'Daily report for ' || NEW.report_date || ' submitted by ' || (SELECT full_name FROM public.profiles WHERE id = NEW.created_by),
         'daily_reports', NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role = 'managing_director';
  
  IF EXISTS (SELECT 1 FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'managing_director' AND p.email_notifications = true AND p.notify_management_message = true) THEN
    PERFORM public.queue_email_notification(
      (SELECT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id WHERE ur.role = 'managing_director' AND p.notify_management_message = true LIMIT 1),
      'daily_report_submitted', 'Daily report submitted',
      'Daily report for ' || NEW.report_date || ' submitted by ' || (SELECT full_name FROM public.profiles WHERE id = NEW.created_by),
      'daily_reports', NEW.id::text
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_daily_report_notify AFTER INSERT ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.notify_daily_report();