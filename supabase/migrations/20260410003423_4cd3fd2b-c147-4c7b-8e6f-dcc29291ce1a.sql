
ALTER TABLE public.ev_monthly_reviews
ADD COLUMN IF NOT EXISTS review_data JSONB DEFAULT '{}'::jsonb;
