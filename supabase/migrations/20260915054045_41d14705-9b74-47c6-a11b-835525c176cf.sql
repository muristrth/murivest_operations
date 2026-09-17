
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('managing_director','secretariat','capital_advisor');
CREATE TYPE public.property_status AS ENUM ('draft','internal_review','approved','published','needs_update','archived');
CREATE TYPE public.review_status AS ENUM ('verified','needs_correction','awaiting_information');
CREATE TYPE public.priority_level AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.inquiry_source AS ENUM ('website','jiji','whatsapp','phone','referral','email','walk_in','other');
CREATE TYPE public.inquiry_category AS ENUM ('buyer','investor','owner_seller','tenant','landlord','vendor','partner','general');
CREATE TYPE public.inquiry_status AS ENUM ('new','contacted','qualification_pending','appointment_requested','appointment_confirmed','meeting_completed','handed_over','follow_up','converted','nurture','closed');
CREATE TYPE public.call_category AS ENUM ('buyer','investor','owner_seller','tenant','vendor','partner','general','wrong_number','spam','existing_client');
CREATE TYPE public.appointment_format AS ENUM ('physical_meeting','virtual_meeting','site_visit','office_meeting','phone_call','other');
CREATE TYPE public.appointment_status AS ENUM ('requested','pending_confirmation','confirmed','rescheduled','completed','cancelled','no_show');
CREATE TYPE public.followup_status AS ENUM ('pending','completed','cancelled');
CREATE TYPE public.contact_category AS ENUM ('client','investor','owner','broker','lawyer','bank','supplier','partner','advisor','corporate','other');
CREATE TYPE public.escalation_level AS ENUM ('none','requires_md','requires_capital_advisor','requires_property_review','requires_management_decision','urgent');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '[TO BE CONFIRMED BY MANAGEMENT]',
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- AUTH HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.can(_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(), _permission)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;

-- profile / role policies
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff());
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "managers update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.can('users.manage')) WITH CHECK (public.can('users.manage'));
CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can('users.view'));
CREATE POLICY "read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- user_roles writes go through a privileged function only
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.manage') THEN
    RAISE EXCEPTION 'Not authorised to manage users';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value)
  VALUES (auth.uid(), 'Permission changed', 'users', _user_id::text, _role::text);
END;
$$;

-- AUDIT LOG
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  record_label text,
  field text,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (public.can('audit.view'));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- PROPERTIES
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  name text NOT NULL,
  property_type text,
  location text,
  address text,
  city text,
  county text,
  description text,
  status public.property_status NOT NULL DEFAULT 'draft',
  price numeric,
  price_currency text DEFAULT 'KES',
  tenure text,
  land_size text,
  building_size text,
  units integer,
  occupancy numeric,
  annual_income numeric,
  monthly_income numeric,
  yield_percent numeric,
  investment_highlights text,
  income_information text,
  location_advantages text,
  asset_characteristics text,
  investment_summary text,
  primary_image_url text,
  internal_notes text,
  seller_information text,
  internal_valuation text,
  review_status public.review_status,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties read" ON public.properties FOR SELECT TO authenticated USING (public.can('properties.view'));
CREATE POLICY "properties create" ON public.properties FOR INSERT TO authenticated WITH CHECK (public.can('properties.create'));
CREATE POLICY "properties update" ON public.properties FOR UPDATE TO authenticated USING (public.can('properties.edit') OR public.can('properties.review')) WITH CHECK (public.can('properties.edit') OR public.can('properties.review'));

CREATE TABLE public.property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.property_images TO authenticated;
GRANT ALL ON public.property_images TO service_role;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images read" ON public.property_images FOR SELECT TO authenticated USING (public.can('properties.view'));
CREATE POLICY "images write" ON public.property_images FOR INSERT TO authenticated WITH CHECK (public.can('properties.edit'));
CREATE POLICY "images delete" ON public.property_images FOR DELETE TO authenticated USING (public.can('properties.edit'));

CREATE TABLE public.property_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status public.review_status NOT NULL,
  comment text,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.property_reviews TO authenticated;
GRANT ALL ON public.property_reviews TO service_role;
ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews read" ON public.property_reviews FOR SELECT TO authenticated USING (public.can('properties.view'));
CREATE POLICY "reviews write" ON public.property_reviews FOR INSERT TO authenticated WITH CHECK (public.can('properties.review') AND reviewed_by = auth.uid());

-- INQUIRIES
CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  prospect_name text NOT NULL,
  phone text,
  email text,
  source public.inquiry_source NOT NULL DEFAULT 'phone',
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  service_interest text,
  category public.inquiry_category NOT NULL DEFAULT 'general',
  inquiry_type text,
  notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.inquiry_status NOT NULL DEFAULT 'new',
  priority public.priority_level NOT NULL DEFAULT 'normal',
  escalation public.escalation_level NOT NULL DEFAULT 'none',
  next_action text,
  next_action_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries read" ON public.inquiries FOR SELECT TO authenticated
  USING (public.can('inquiries.view.all') OR (public.can('inquiries.view') AND (assigned_to = auth.uid() OR created_by = auth.uid())));
CREATE POLICY "inquiries create" ON public.inquiries FOR INSERT TO authenticated WITH CHECK (public.can('inquiries.create'));
CREATE POLICY "inquiries update" ON public.inquiries FOR UPDATE TO authenticated USING (public.can('inquiries.edit')) WITH CHECK (public.can('inquiries.edit'));

-- CALLS
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  caller_name text NOT NULL,
  phone text,
  email text,
  reason text,
  category public.call_category NOT NULL DEFAULT 'general',
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  source public.inquiry_source,
  action_taken text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  followup_required boolean NOT NULL DEFAULT false,
  followup_date date,
  status text NOT NULL DEFAULT 'answered',
  notes text,
  escalation public.escalation_level NOT NULL DEFAULT 'none',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls read" ON public.calls FOR SELECT TO authenticated USING (public.can('calls.view'));
CREATE POLICY "calls create" ON public.calls FOR INSERT TO authenticated WITH CHECK (public.can('calls.create'));
CREATE POLICY "calls update" ON public.calls FOR UPDATE TO authenticated USING (public.can('calls.edit')) WITH CHECK (public.can('calls.edit'));

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text,
  email text,
  purpose text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  format public.appointment_format NOT NULL DEFAULT 'office_meeting',
  location text,
  attendee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.appointment_status NOT NULL DEFAULT 'requested',
  notes text,
  outcome text,
  inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments read" ON public.appointments FOR SELECT TO authenticated USING (public.can('appointments.view'));
CREATE POLICY "appointments create" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.can('appointments.create'));
CREATE POLICY "appointments update" ON public.appointments FOR UPDATE TO authenticated USING (public.can('appointments.edit')) WITH CHECK (public.can('appointments.edit'));

-- FOLLOW-UPS
CREATE TABLE public.followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contact date,
  pending_action text NOT NULL,
  due_date date NOT NULL,
  priority public.priority_level NOT NULL DEFAULT 'normal',
  status public.followup_status NOT NULL DEFAULT 'pending',
  notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.followups TO authenticated;
GRANT ALL ON public.followups TO service_role;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followups read" ON public.followups FOR SELECT TO authenticated USING (public.can('followups.view'));
CREATE POLICY "followups create" ON public.followups FOR INSERT TO authenticated WITH CHECK (public.can('followups.create'));
CREATE POLICY "followups update" ON public.followups FOR UPDATE TO authenticated USING (public.can('followups.edit')) WITH CHECK (public.can('followups.edit'));

-- CONTACTS
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization text,
  role text,
  category public.contact_category NOT NULL DEFAULT 'other',
  phone text,
  email text,
  location text,
  notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated USING (public.can('contacts.view'));
CREATE POLICY "contacts create" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.can('contacts.create'));
CREATE POLICY "contacts update" ON public.contacts FOR UPDATE TO authenticated USING (public.can('contacts.edit')) WITH CHECK (public.can('contacts.edit'));

-- DAILY REPORTS
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  md_attention text,
  developments text,
  priorities_tomorrow text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_date, created_by)
);
GRANT SELECT, INSERT, UPDATE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports read" ON public.daily_reports FOR SELECT TO authenticated USING (public.can('reports.view'));
CREATE POLICY "reports create" ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (public.can('reports.create') AND created_by = auth.uid());
CREATE POLICY "reports update" ON public.daily_reports FOR UPDATE TO authenticated USING (public.can('reports.create') AND created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  module text,
  record_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- CALL SCRIPTS
CREATE TABLE public.call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  guidance text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_scripts TO authenticated;
GRANT ALL ON public.call_scripts TO service_role;
ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scripts read" ON public.call_scripts FOR SELECT TO authenticated USING (public.can('scripts.view'));
CREATE POLICY "scripts manage" ON public.call_scripts FOR ALL TO authenticated USING (public.can('scripts.manage')) WITH CHECK (public.can('scripts.manage'));

-- UPDATED_AT
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_inquiries_updated BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_calls_updated BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_followups_updated BEFORE UPDATE ON public.followups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_reports_updated BEFORE UPDATE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_scripts_updated BEFORE UPDATE ON public.call_scripts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PROPERTY GUARDS + AUDIT
CREATE OR REPLACE FUNCTION public.guard_property_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF (NEW.price IS DISTINCT FROM OLD.price
      OR NEW.annual_income IS DISTINCT FROM OLD.annual_income
      OR NEW.monthly_income IS DISTINCT FROM OLD.monthly_income
      OR NEW.yield_percent IS DISTINCT FROM OLD.yield_percent
      OR NEW.occupancy IS DISTINCT FROM OLD.occupancy
      OR NEW.land_size IS DISTINCT FROM OLD.land_size
      OR NEW.building_size IS DISTINCT FROM OLD.building_size)
     AND NOT public.has_permission(uid, 'properties.edit.financials') THEN
    RAISE EXCEPTION 'You are not authorised to change property financial information. Please request an update instead.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' AND NOT public.has_permission(uid, 'properties.approve') THEN
      RAISE EXCEPTION 'You are not authorised to approve properties.';
    END IF;
    IF NEW.status = 'published' AND NOT public.has_permission(uid, 'properties.publish') THEN
      RAISE EXCEPTION 'You are not authorised to publish properties.';
    END IF;
    IF NEW.status = 'archived' AND NOT public.has_permission(uid, 'properties.archive') THEN
      RAISE EXCEPTION 'You are not authorised to archive properties.';
    END IF;
  END IF;

  NEW.updated_by := uid;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    NEW.approved_by := uid; NEW.approved_at := now();
  END IF;
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_properties_guard BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.guard_property_changes();

CREATE OR REPLACE FUNCTION public.audit_property_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label)
    VALUES (auth.uid(), 'Property created', 'properties', NEW.id::text, NEW.name);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Property status changed', 'properties', NEW.id::text, NEW.name, 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Price changed', 'properties', NEW.id::text, NEW.name, 'price', OLD.price::text, NEW.price::text);
  END IF;
  IF NEW.annual_income IS DISTINCT FROM OLD.annual_income THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Financial figure changed', 'properties', NEW.id::text, NEW.name, 'annual_income', OLD.annual_income::text, NEW.annual_income::text);
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field)
    VALUES (auth.uid(), 'Description changed', 'properties', NEW.id::text, NEW.name, 'description');
  END IF;
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Review recorded', 'properties', NEW.id::text, NEW.name, 'review_status', OLD.review_status::text, NEW.review_status::text);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_properties_audit AFTER INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.audit_property_changes();

CREATE OR REPLACE FUNCTION public.audit_inquiry_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label)
    VALUES (auth.uid(), 'Inquiry created', 'inquiries', NEW.id::text, NEW.prospect_name);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Inquiry status changed', 'inquiries', NEW.id::text, NEW.prospect_name, 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, field, previous_value, new_value)
    VALUES (auth.uid(), 'Inquiry assigned', 'inquiries', NEW.id::text, NEW.prospect_name, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_inquiries_audit AFTER INSERT OR UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.audit_inquiry_changes();

-- Property review -> notify approvers
CREATE OR REPLACE FUNCTION public.on_property_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT name INTO p FROM public.properties WHERE id = NEW.property_id;
  UPDATE public.properties
     SET review_status = NEW.status, reviewed_by = NEW.reviewed_by, reviewed_at = now(),
         status = CASE WHEN NEW.status = 'needs_correction' THEN 'needs_update'::public.property_status ELSE status END
   WHERE id = NEW.property_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id,
         CASE WHEN NEW.status = 'needs_correction' THEN 'property_correction_requested' ELSE 'property_review_completed' END,
         CASE WHEN NEW.status = 'needs_correction' THEN 'Property correction requested' ELSE 'Property review completed' END,
         p.name || ' — ' || replace(NEW.status::text, '_', ' ') || COALESCE(': ' || NEW.comment, ''),
         'properties', NEW.property_id::text
    FROM public.user_roles ur
   WHERE ur.role = 'managing_director' AND ur.user_id <> NEW.reviewed_by;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, new_value)
  VALUES (NEW.reviewed_by, 'Property review completed', 'properties', NEW.property_id::text, p.name, NEW.status::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER t_property_review AFTER INSERT ON public.property_reviews FOR EACH ROW EXECUTE FUNCTION public.on_property_review();

-- New inquiry -> notify MD + assignee
CREATE OR REPLACE FUNCTION public.notify_new_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, 'new_inquiry', 'New inquiry received',
         NEW.prospect_name || ' — ' || replace(NEW.source::text,'_',' '), 'inquiries', NEW.id::text
    FROM public.user_roles ur
   WHERE ur.role = 'managing_director' AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END; $$;
CREATE TRIGGER t_inquiry_notify AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_new_inquiry();

-- NEW USER BOOTSTRAP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_md boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, job_title)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
          COALESCE(NEW.email, ''),
          COALESCE(NEW.raw_user_meta_data->>'job_title', '[TO BE CONFIRMED BY MANAGEMENT]'));

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'managing_director') INTO has_md;
  IF NOT has_md THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'managing_director');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROLE PERMISSION MATRIX
INSERT INTO public.role_permissions (role, permission) VALUES
('managing_director','dashboard.view'),
('managing_director','properties.view'),('managing_director','properties.create'),('managing_director','properties.edit'),
('managing_director','properties.edit.financials'),('managing_director','properties.review'),('managing_director','properties.approve'),
('managing_director','properties.publish'),('managing_director','properties.archive'),('managing_director','properties.internal.view'),
('managing_director','inquiries.view'),('managing_director','inquiries.view.all'),('managing_director','inquiries.create'),
('managing_director','inquiries.edit'),('managing_director','inquiries.assign'),
('managing_director','calls.view'),('managing_director','calls.create'),('managing_director','calls.edit'),
('managing_director','appointments.view'),('managing_director','appointments.create'),('managing_director','appointments.edit'),
('managing_director','followups.view'),('managing_director','followups.create'),('managing_director','followups.edit'),
('managing_director','contacts.view'),('managing_director','contacts.create'),('managing_director','contacts.edit'),
('managing_director','reports.view'),('managing_director','reports.create'),
('managing_director','scripts.view'),('managing_director','scripts.manage'),
('managing_director','users.view'),('managing_director','users.manage'),('managing_director','audit.view'),

('secretariat','dashboard.view'),
('secretariat','properties.view'),
('secretariat','inquiries.view'),('secretariat','inquiries.view.all'),('secretariat','inquiries.create'),('secretariat','inquiries.edit'),
('secretariat','calls.view'),('secretariat','calls.create'),('secretariat','calls.edit'),
('secretariat','appointments.view'),('secretariat','appointments.create'),('secretariat','appointments.edit'),
('secretariat','followups.view'),('secretariat','followups.create'),('secretariat','followups.edit'),
('secretariat','contacts.view'),('secretariat','contacts.create'),('secretariat','contacts.edit'),
('secretariat','reports.view'),('secretariat','reports.create'),
('secretariat','scripts.view'),

('capital_advisor','dashboard.view'),
('capital_advisor','properties.view'),('capital_advisor','properties.create'),('capital_advisor','properties.edit'),
('capital_advisor','properties.edit.financials'),('capital_advisor','properties.review'),
('capital_advisor','inquiries.view'),('capital_advisor','inquiries.edit'),
('capital_advisor','calls.view'),
('capital_advisor','appointments.view'),('capital_advisor','appointments.create'),('capital_advisor','appointments.edit'),
('capital_advisor','followups.view'),('capital_advisor','followups.create'),('capital_advisor','followups.edit'),
('capital_advisor','contacts.view'),
('capital_advisor','scripts.view');

-- CALL SCRIPTS (company standard scripts, not client data)
INSERT INTO public.call_scripts (category, title, body, guidance, sort_order) VALUES
('Opening','Standard opening','Good morning/afternoon, Murivest Group Ltd. This is [Name] speaking. How may I assist you?',NULL,1),
('General','General inquiry','Thank you for reaching out to Murivest. May I take your name and contact number so I can direct your inquiry appropriately? Are you calling regarding a property, an investment inquiry, property ownership, or another matter?',NULL,2),
('Inbound source','Website inquiry','Good morning, [Name]. This is [Secretary] calling from Murivest Group Ltd. We received your inquiry through our website. May I confirm which property or type of investment you are interested in?',NULL,3),
('Inbound source','Jiji inquiry','Good morning, this is [Secretary] calling from Murivest Group Ltd. We received your inquiry regarding our Jiji listing for [Property]. Are you looking to purchase the property, or would you like to arrange a viewing?',NULL,4),
('Pricing','Price question — verified','The current advertised price is [verified price], subject to confirmation of the current listing details.','Only quote a price that is approved and published in the system. Never invent prices.',5),
('Pricing','Price question — not verified','Let me verify the current pricing information with the responsible member of our team before I confirm it.','Escalate as Requires Property Review.',6),
('Owners','Property owner enquiry','Thank you. I will record these details and forward them to the responsible member of our team for review.','Record name, property, location, type, ownership/representation, contact details and availability. Never promise a mandate.',7),
('Company','What does Murivest do?','Murivest Group Ltd. is a real estate investment and advisory firm focused on commercial real estate opportunities and related property services.',NULL,8),
('Appointments','Booking an appointment','May I ask what you would like to discuss so that I can allocate the appropriate amount of time? I have availability on [Day] at [Time] or [Day] at [Time].',NULL,9),
('Appointments','24-hour confirmation','Good afternoon, [Name]. I am calling to confirm your appointment with [Mr. Muriithi/Advisor] tomorrow at [Time]. May I confirm it remains convenient?',NULL,10),
('Escalation','Unknown question','I want to make sure I give you accurate information. Let me verify that with the appropriate member of our team before I confirm it.',NULL,11),
('Escalation','Negotiation','Thank you for sharing your position. I will record your inquiry and refer it to the responsible member of our team.','Never accept, reject or counter an offer unless explicitly authorised.',12),
('Escalation','Complaint','I am sorry to hear that. I would like to record the details accurately so the appropriate person can review the matter.','Flag as Requires MD Attention.',13);

CREATE INDEX idx_inquiries_status ON public.inquiries(status);
CREATE INDEX idx_inquiries_received ON public.inquiries(received_at DESC);
CREATE INDEX idx_calls_occurred ON public.calls(occurred_at DESC);
CREATE INDEX idx_appointments_time ON public.appointments(scheduled_at);
CREATE INDEX idx_followups_due ON public.followups(due_date);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, read_at);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
