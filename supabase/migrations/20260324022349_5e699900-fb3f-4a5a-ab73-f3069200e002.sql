
CREATE TABLE public.trade_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  identity_id UUID REFERENCES public.identities(id) ON DELETE CASCADE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  lessons TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, identity_id, period_type, period_label)
);

ALTER TABLE public.trade_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reviews" ON public.trade_reviews
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
