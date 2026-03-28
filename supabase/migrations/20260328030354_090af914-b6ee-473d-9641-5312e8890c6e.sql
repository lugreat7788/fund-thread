
CREATE TABLE ev_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'stock',
  avg_price numeric NOT NULL,
  shares numeric NOT NULL,
  total_cost numeric NOT NULL,
  status text NOT NULL DEFAULT 'watch',
  notes text,
  recent_high numeric,
  buy_tier1_price numeric,
  buy_tier2_price numeric,
  buy_tier3_price numeric,
  sell_tier1_price numeric,
  sell_tier2_price numeric,
  sell_tier3_price numeric,
  sell_tier1_done boolean DEFAULT false,
  sell_tier2_done boolean DEFAULT false,
  sell_tier3_done boolean DEFAULT false,
  is_closed boolean DEFAULT false,
  disposal_plan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE ev_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holding_id uuid REFERENCES ev_holdings(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  admission_profitable boolean,
  admission_moat boolean,
  admission_volume boolean,
  admission_market_cap boolean,
  veto_no_revenue boolean DEFAULT false,
  veto_gov_contract boolean DEFAULT false,
  veto_leveraged boolean DEFAULT false,
  admission_result text,
  current_tier integer,
  drop_percent numeric,
  fundamental_earnings boolean,
  fundamental_growth boolean,
  fundamental_decline_reason text,
  fundamental_industry boolean,
  fundamental_result text,
  buy_amount numeric,
  buy_price numeric,
  buy_shares numeric,
  win_probability numeric,
  expected_gain_pct numeric,
  expected_loss_pct numeric,
  ev_value numeric,
  executed boolean DEFAULT false,
  cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ev_dca_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  price numeric NOT NULL,
  shares numeric NOT NULL,
  priority text NOT NULL DEFAULT 'P2',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ev_monthly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,
  violations text,
  holdings_status jsonb,
  next_month_plan text,
  watchlist text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ev_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type text NOT NULL,
  occurred_at date NOT NULL,
  symbol text,
  loss_estimate numeric,
  lesson text NOT NULL,
  is_revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ev_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_dca_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_monthly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ev_holdings" ON ev_holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own ev_decisions" ON ev_decisions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own ev_dca_records" ON ev_dca_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own ev_monthly_reviews" ON ev_monthly_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own ev_errors" ON ev_errors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
