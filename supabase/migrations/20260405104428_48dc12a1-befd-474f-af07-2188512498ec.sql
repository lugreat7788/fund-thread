
-- Alert history table
CREATE TABLE public.ev_alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL, -- 'node_trigger' | 'market_panic' | 'earnings' | 'dca'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  trigger_reason TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ev_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.ev_alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.ev_alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.ev_alert_history FOR UPDATE USING (auth.uid() = user_id);

-- Earnings calendar table
CREATE TABLE public.ev_earnings_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  earnings_date DATE NOT NULL,
  notes TEXT,
  remind_7d BOOLEAN NOT NULL DEFAULT true,
  remind_1d BOOLEAN NOT NULL DEFAULT true,
  remind_0d BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ev_earnings_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own earnings" ON public.ev_earnings_calendar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own earnings" ON public.ev_earnings_calendar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own earnings" ON public.ev_earnings_calendar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own earnings" ON public.ev_earnings_calendar FOR DELETE USING (auth.uid() = user_id);
