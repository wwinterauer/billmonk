-- Add naming settings column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS naming_settings jsonb DEFAULT '{
  "template": "{datum}_{lieferant}_{betrag}",
  "replaceUmlauts": true,
  "replaceSpaces": true,
  "removeSpecialChars": true,
  "lowercase": false,
  "dateFormat": "YYYY-MM-DD"
}'::jsonb;