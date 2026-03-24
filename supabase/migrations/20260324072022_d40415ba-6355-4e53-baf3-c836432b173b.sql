
ALTER TABLE public.support_tickets
  ADD COLUMN ticket_type TEXT NOT NULL DEFAULT 'bug',
  ADD COLUMN area TEXT,
  ADD COLUMN reward_status TEXT,
  ADD COLUMN reward_applied_at TIMESTAMPTZ;
