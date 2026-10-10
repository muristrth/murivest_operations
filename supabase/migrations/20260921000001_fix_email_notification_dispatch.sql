-- FIX: email notifications were never delivered.
-- Root cause: the `send-email` edge function (which drains public.email_queue
-- over SMTP) was only invoked by `notification-cron`, and nothing scheduled
-- `notification-cron`. Emails queued by triggers and stayed unsent forever.
-- Also: most event changes (new inquiry, escalation, property review) only
-- created in-app notifications for the MD and never queued an email.
--
-- This migration:
--   1. Queues emails for BOTH the Managing Director and the staff member on
--      event changes (inquiry, task, escalation, appointment, follow-up,
--      property review, daily report), respecting each profile's preferences.
--   2. Adds an optional pg_cron + http fallback that invokes the send-email
--      edge function every 2 minutes so time-based reminders (overdue tasks,
--      due follow-ups, appointment reminders) are delivered even when nobody
--      is using the app.
--
-- ONE-TIME SETUP for the pg_cron fallback (optional; the app also flushes the
-- queue immediately after every event change):
--   a) Enable the `pg_cron` and `http` extensions in the Supabase dashboard
--      (Database -> Extensions) if CREATE EXTENSION below reports they are
--      unavailable.
--   b) Insert your project URL and service role key (never commit these):
--        INSERT INTO public.notification_dispatch (supabase_url, service_role_key, enabled)
--        VALUES ('https://<project-ref>.supabase.co', '<service_role_key>', true);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_inquiry boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- New inquiry (create or assignment) -> MD in-app + email, assignee email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text := 'New inquiry received';
  v_body text := NEW.prospect_name || ' — ' || replace(NEW.source::text, '_', ' ');
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  -- MDs: new inquiry on create
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    SELECT ur.user_id, 'new_inquiry', v_title, v_body, 'inquiries', NEW.id::text
      FROM public.user_roles ur
     WHERE ur.role = 'managing_director' AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

    PERFORM public.queue_email_notification(ur.user_id, 'new_inquiry', v_title, v_body, 'inquiries', NEW.id::text)
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'managing_director'
       AND p.email_notifications = true
       AND p.notify_inquiry = true
       AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  -- Assignee: notified when an inquiry is assigned to them
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'new_inquiry', 'Inquiry assigned to you', v_body, 'inquiries', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_inquiry = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'new_inquiry', 'Inquiry assigned to you', v_body, 'inquiries', NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS t_inquiry_notify ON public.inquiries;
CREATE TRIGGER t_inquiry_notify AFTER INSERT OR UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_new_inquiry();

-- ---------------------------------------------------------------------------
-- Task create/assign/status change -> assignee (staff) + MD emails
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_body text;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_task_assigned = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'task_assigned', 'New task assigned', NEW.title, 'tasks', NEW.id::text);
    END IF;
  END IF;

  -- Keep the MD in the loop on every task event (create, assign, status change)
  v_body := 'Status: ' || NEW.status || ' · Assigned to: ' ||
            COALESCE((SELECT full_name FROM public.profiles WHERE id = NEW.assigned_to), 'unassigned');
  PERFORM public.queue_email_notification(ur.user_id, 'task_assigned', 'Task update: ' || NEW.title, v_body, 'tasks', NEW.id::text)
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role = 'managing_director'
     AND ur.user_id <> v_actor
     AND p.email_notifications = true
     AND p.notify_task_assigned = true;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- Escalation create/update -> MDs + assignee emails (incl. resolution)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_niche uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- In-app: MDs on creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    SELECT ur.user_id, 'escalation_created', 'New escalation: ' || NEW.category,
           NEW.reason || ' (' || NEW.related_module || ')', 'escalations', NEW.id::text
      FROM public.user_roles ur
     WHERE ur.role = 'managing_director' AND ur.user_id <> COALESCE(NEW.created_by, v_niche);

    -- Email MDs who opted in
    PERFORM public.queue_email_notification(ur.user_id, 'escalation_created', 'New escalation: ' || NEW.category,
           NEW.reason || ' (' || NEW.related_module || ')', 'escalations', NEW.id::text)
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'managing_director'
       AND p.email_notifications = true
       AND p.notify_escalation = true
       AND ur.user_id <> COALESCE(NEW.created_by, v_niche);
  END IF;

  -- Assignee: in-app + email (on assign or reassignment)
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
     AND NEW.assigned_to <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'escalation_assigned', 'Escalation assigned to you', NEW.reason, 'escalations', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_escalation = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'escalation_assigned', 'Escalation assigned to you', NEW.reason, 'escalations', NEW.id::text);
    END IF;
  END IF;

  -- Resolution / closure -> notify assignee + MDs
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('resolved', 'closed') THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    SELECT ur.user_id, 'escalation_resolved', 'Escalation resolved',
           COALESCE(NEW.management_response, 'Status: ' || NEW.status), 'escalations', NEW.id::text
      FROM public.user_roles ur
     WHERE ur.role = 'managing_director' AND ur.user_id <> v_actor;

    PERFORM public.queue_email_notification(ur.user_id, 'escalation_resolved', 'Escalation resolved',
           COALESCE(NEW.management_response, 'Status: ' || NEW.status), 'escalations', NEW.id::text)
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'managing_director'
       AND p.email_notifications = true
       AND p.notify_escalation = true
       AND ur.user_id <> v_actor;

    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_actor THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
      VALUES (NEW.assigned_to, 'escalation_resolved', 'Escalation resolved',
              COALESCE(NEW.management_response, 'Status: ' || NEW.status), 'escalations', NEW.id::text);
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_escalation = true) THEN
        PERFORM public.queue_email_notification(NEW.assigned_to, 'escalation_resolved', 'Escalation resolved',
                COALESCE(NEW.management_response, 'Status: ' || NEW.status), 'escalations', NEW.id::text);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS t_escalation_notify ON public.escalations;
CREATE TRIGGER t_escalation_notify AFTER INSERT OR UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.notify_escalation();

-- ---------------------------------------------------------------------------
-- Follow-up created -> assignee (staff) in-app + email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_followup_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_body text := NEW.client_name || ' — ' || NEW.pending_action || ' (Due: ' || NEW.due_date || ')';
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'followup_due', 'Follow-up assigned', v_body, 'followups', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_followup = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'followup_due', 'Follow-up assigned', v_body, 'followups', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_followup_notify AFTER INSERT ON public.followups FOR EACH ROW EXECUTE FUNCTION public.notify_followup_assigned();

-- ---------------------------------------------------------------------------
-- Appointment created -> attendee (staff) in-app + email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_appointment_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_body text := NEW.client_name || ' — ' || to_char(NEW.scheduled_at, 'YYYY-MM-DD HH24:MI') || ' — ' || NEW.purpose;
BEGIN
  IF NEW.attendee_id IS NOT NULL AND NEW.attendee_id <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.attendee_id, 'appointment_reminder', 'Appointment scheduled', v_body, 'appointments', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.attendee_id AND email_notifications = true AND notify_appointment = true) THEN
      PERFORM public.queue_email_notification(NEW.attendee_id, 'appointment_reminder', 'Appointment scheduled', v_body, 'appointments', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_appointment_notify AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_created();

-- ---------------------------------------------------------------------------
-- Property review -> MDs also get an email (they previously only got in-app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_property_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
  v_title text := CASE WHEN NEW.status = 'needs_correction' THEN 'Property correction requested' ELSE 'Property review completed' END;
  v_type text := CASE WHEN NEW.status = 'needs_correction' THEN 'property_correction_requested' ELSE 'property_review_completed' END;
BEGIN
  SELECT name INTO p FROM public.properties WHERE id = NEW.property_id;
  UPDATE public.properties
     SET review_status = NEW.status, reviewed_by = NEW.reviewed_by, reviewed_at = now(),
         status = CASE WHEN NEW.status = 'needs_correction' THEN 'needs_update'::public.property_status ELSE status END
   WHERE id = NEW.property_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, v_type, v_title,
         p.name || ' — ' || replace(NEW.status::text, '_', ' ') || COALESCE(': ' || NEW.comment, ''),
         'properties', NEW.property_id::text
    FROM public.user_roles ur
   WHERE ur.role = 'managing_director' AND ur.user_id <> NEW.reviewed_by;

  PERFORM public.queue_email_notification(ur.user_id, v_type, v_title,
         p.name || ' — ' || replace(NEW.status::text, '_', ' ') || COALESCE(': ' || NEW.comment, ''),
         'properties', NEW.property_id::text)
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id = ur.user_id
   WHERE ur.role = 'managing_director'
     AND pr.email_notifications = true
     AND pr.notify_property_review = true
     AND ur.user_id <> NEW.reviewed_by;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, new_value)
  VALUES (NEW.reviewed_by, 'Property review completed', 'properties', NEW.property_id::text, p.name, NEW.status::text);
  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- Correspondence created/assigned -> assignee (staff) + MD emails
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_correspondence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_body text := NEW.subject || ' — ' || NEW.from_to || ' (' || NEW.channel || ')';
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
    VALUES (NEW.assigned_to, 'md_audit_create', 'Correspondence assigned', v_body, 'correspondence', NEW.id::text);

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND email_notifications = true AND notify_management_message = true) THEN
      PERFORM public.queue_email_notification(NEW.assigned_to, 'md_audit_create', 'Correspondence assigned', v_body, 'correspondence', NEW.id::text);
    END IF;
  END IF;

  -- MD copy of all new correspondence
  PERFORM public.queue_email_notification(ur.user_id, 'md_audit_create', 'New correspondence logged', v_body, 'correspondence', NEW.id::text)
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role = 'managing_director'
     AND ur.user_id <> v_actor
     AND p.email_notifications = true
     AND p.notify_management_message = true;

  RETURN NEW;
END; $$;
CREATE TRIGGER t_correspondence_notify AFTER INSERT ON public.correspondence FOR EACH ROW EXECUTE FUNCTION public.notify_correspondence();

-- ---------------------------------------------------------------------------
-- Scheduled fallback: pg_cron invokes the send-email edge function every 2
-- minutes so the queue drains (and time-based reminders fire) even when no
-- one is using the app. Requires the pg_cron and http extensions.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension is not available on this project. Enable it in the Supabase dashboard (Database -> Extensions) and re-run this section, or rely on the in-app flush which sends emails immediately after every event change.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS http;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'http extension is not available on this project. Enable it in the Supabase dashboard (Database -> Extensions).';
END $$;

CREATE TABLE IF NOT EXISTS public.notification_dispatch (
  id smallint PRIMARY KEY DEFAULT 1,
  supabase_url text,
  service_role_key text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_dispatch_single_row CHECK (id = 1)
);
ALTER TABLE public.notification_dispatch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_dispatch FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_email_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg record;
BEGIN
  SELECT * INTO cfg FROM public.notification_dispatch WHERE id = 1 AND enabled = true;
  IF NOT FOUND OR cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
    RETURN;
  END IF;
  PERFORM http.post(
    rtrim(cfg.supabase_url, '/') || '/functions/v1/send-email',
    jsonb_build_object(
      'Authorization', 'Bearer ' || cfg.service_role_key,
      'Content-Type', 'application/json'
    ),
    '{}'::jsonb
  );
END; $$;

DO $$
BEGIN
  PERFORM cron.schedule('murivest-email-dispatch', '*/2 * * * *', 'SELECT public.dispatch_email_queue()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule the pg_cron job (%). Schedule "SELECT public.dispatch_email_queue();" manually, or rely on the in-app flush.', sqlerrm;
END $$;
