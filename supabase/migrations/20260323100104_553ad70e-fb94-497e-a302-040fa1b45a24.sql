
-- Table: admin_activity_log
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
ON public.admin_activity_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Table: announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active announcements"
ON public.announcements FOR SELECT TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: log new registrations
CREATE OR REPLACE FUNCTION public.log_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_activity_log (event_type, user_id, user_email, details)
  VALUES ('registration', NEW.id, NEW.email, jsonb_build_object('plan', NEW.plan));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_log
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_new_registration();
