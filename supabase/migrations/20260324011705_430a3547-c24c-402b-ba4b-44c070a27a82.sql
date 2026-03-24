CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4A853',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own identities" ON public.identities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own identities" ON public.identities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own identities" ON public.identities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own identities" ON public.identities FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  buy_date DATE NOT NULL,
  buy_price NUMERIC NOT NULL,
  shares NUMERIC NOT NULL,
  buy_reason TEXT DEFAULT '',
  strategy TEXT NOT NULL CHECK (strategy IN ('trend', 'value', 'event_driven', 'arbitrage', 'speculation', 'defensive')),
  sell_date DATE,
  sell_price NUMERIC,
  sell_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trade_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  action TEXT DEFAULT '',
  impact INTEGER NOT NULL DEFAULT 0 CHECK (impact BETWEEN -2 AND 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.trade_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.trade_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.trade_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.trade_events FOR DELETE USING (auth.uid() = user_id);