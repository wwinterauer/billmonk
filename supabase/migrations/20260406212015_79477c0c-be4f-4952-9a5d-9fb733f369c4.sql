
-- 1. Add newsletter_opt_out to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS newsletter_opt_out boolean DEFAULT false;

-- 2. Members table
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  street text,
  zip text,
  city text,
  country text DEFAULT 'AT',
  member_number text,
  member_type text DEFAULT 'Mitglied',
  membership_fee numeric DEFAULT 0,
  joined_at date,
  is_active boolean DEFAULT true,
  newsletter_opt_out boolean DEFAULT false,
  notes text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own members" ON public.members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own members" ON public.members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own members" ON public.members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own members" ON public.members FOR DELETE USING (auth.uid() = user_id);

-- 3. Member types table
CREATE TABLE public.member_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#8B5CF6',
  icon text DEFAULT 'users',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.member_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own member_types" ON public.member_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own member_types" ON public.member_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own member_types" ON public.member_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own member_types" ON public.member_types FOR DELETE USING (auth.uid() = user_id);

-- 4. CRM field config table
CREATE TABLE public.crm_field_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT 'customer',
  visible_fields jsonb DEFAULT '[]',
  list_columns jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_type)
);

ALTER TABLE public.crm_field_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crm_field_config" ON public.crm_field_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crm_field_config" ON public.crm_field_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own crm_field_config" ON public.crm_field_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own crm_field_config" ON public.crm_field_config FOR DELETE USING (auth.uid() = user_id);

-- 5. Newsletters table
CREATE TABLE public.newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  recipient_type text NOT NULL DEFAULT 'all',
  recipient_filter jsonb DEFAULT '{}',
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own newsletters" ON public.newsletters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own newsletters" ON public.newsletters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own newsletters" ON public.newsletters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own newsletters" ON public.newsletters FOR DELETE USING (auth.uid() = user_id);

-- 6. Newsletter recipients table
CREATE TABLE public.newsletter_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.newsletter_recipients ENABLE ROW LEVEL SECURITY;

-- Access via newsletter ownership
CREATE POLICY "Users can view own newsletter_recipients" ON public.newsletter_recipients FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
CREATE POLICY "Users can insert own newsletter_recipients" ON public.newsletter_recipients FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
CREATE POLICY "Users can update own newsletter_recipients" ON public.newsletter_recipients FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
CREATE POLICY "Users can delete own newsletter_recipients" ON public.newsletter_recipients FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
