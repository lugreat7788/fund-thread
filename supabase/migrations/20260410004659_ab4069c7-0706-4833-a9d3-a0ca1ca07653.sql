
-- Rule change log table
CREATE TABLE public.ev_rule_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '常规优化',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ev_rule_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rule changes" ON public.ev_rule_changes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own rule changes" ON public.ev_rule_changes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own rule changes" ON public.ev_rule_changes FOR DELETE USING (auth.uid() = user_id);

-- Playbook table
CREATE TABLE public.ev_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scenario_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ev_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playbooks" ON public.ev_playbooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own playbooks" ON public.ev_playbooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own playbooks" ON public.ev_playbooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own playbooks" ON public.ev_playbooks FOR DELETE USING (auth.uid() = user_id);
