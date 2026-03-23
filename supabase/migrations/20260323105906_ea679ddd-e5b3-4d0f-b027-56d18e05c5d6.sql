
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published FAQs
CREATE POLICY "Authenticated users can read published FAQs"
  ON public.faqs FOR SELECT TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

-- Admins can insert FAQs
CREATE POLICY "Admins can insert FAQs"
  ON public.faqs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update FAQs
CREATE POLICY "Admins can update FAQs"
  ON public.faqs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete FAQs
CREATE POLICY "Admins can delete FAQs"
  ON public.faqs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
