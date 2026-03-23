
-- Trigger: Log receipt uploads to activity log
CREATE OR REPLACE FUNCTION public.log_receipt_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_activity_log (event_type, user_id, user_email, details)
  SELECT 'upload', NEW.user_id, p.email, 
    jsonb_build_object('file_name', NEW.file_name, 'source', COALESCE(NEW.source, 'upload'))
  FROM public.profiles p WHERE p.id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_receipt_uploaded
  AFTER INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_receipt_upload();

-- Trigger: Log plan changes to activity log
CREATE OR REPLACE FUNCTION public.log_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    INSERT INTO public.admin_activity_log (event_type, user_id, user_email, details)
    VALUES (
      CASE WHEN NEW.plan = 'free' AND OLD.plan != 'free' THEN 'cancellation' ELSE 'plan_change' END,
      NEW.id, NEW.email,
      jsonb_build_object('old_plan', OLD.plan, 'new_plan', NEW.plan)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_plan_changed
  AFTER UPDATE OF plan ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_plan_change();

-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  replied_at timestamp with time zone,
  replied_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tickets
CREATE POLICY "Users can insert own tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update tickets (reply)
CREATE POLICY "Admins can update tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete tickets
CREATE POLICY "Admins can delete tickets"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
