
-- Pending orders parsed from articles
CREATE TABLE public.pending_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  identity_id UUID REFERENCES public.identities(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'long',
  action TEXT NOT NULL DEFAULT 'open', -- open, add, reduce, close
  target_price NUMERIC NOT NULL,
  shares NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  strategy TEXT NOT NULL DEFAULT 'trend',
  reason TEXT DEFAULT '',
  source_article TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, executed, cancelled
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending_orders" ON public.pending_orders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Operation logs for position adjustments
CREATE TABLE public.operation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  identity_id UUID REFERENCES public.identities(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.pending_orders(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL, -- open, add, reduce, close
  price NUMERIC NOT NULL,
  shares NUMERIC NOT NULL,
  direction TEXT NOT NULL DEFAULT 'long',
  currency TEXT NOT NULL DEFAULT 'CNY',
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own operation_logs" ON public.operation_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
