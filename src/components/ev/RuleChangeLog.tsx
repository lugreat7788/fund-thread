import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { AlertTriangle, FileText } from 'lucide-react';

interface RuleChange {
  id: string;
  rule_name: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  context: string;
  created_at: string;
}

const CONTEXT_COLORS: Record<string, string> = {
  '常规优化': 'bg-primary/10 text-primary',
  '复盘后调整': 'bg-accent text-accent-foreground',
  '市场剧烈波动中': 'bg-destructive/10 text-destructive',
  '持仓浮亏中': 'bg-destructive/10 text-destructive',
  '持仓浮盈中': 'bg-chart-2/20 text-chart-2',
  '其他': 'bg-muted text-muted-foreground',
};

export function RuleChangeLog() {
  const [changes, setChanges] = useState<RuleChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChanges();
  }, []);

  const loadChanges = async () => {
    const { data } = await supabase
      .from('ev_rule_changes' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setChanges((data as any[] ?? []) as RuleChange[]);
    setLoading(false);
  };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthChanges = changes.filter(c => {
    const d = new Date(c.created_at);
    return d >= monthStart && d <= monthEnd;
  });

  const riskyCount = thisMonthChanges.filter(c =>
    c.context === '持仓浮亏中' || c.context === '市场剧烈波动中'
  ).length;

  const contextCounts = thisMonthChanges.reduce<Record<string, number>>((acc, c) => {
    acc[c.context] = (acc[c.context] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>;

  return (
    <div className="space-y-4">
      {riskyCount > 2 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-destructive">
              本月在情绪化情境下修改了 {riskyCount} 次规则
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              频繁在浮亏或市场波动中修改规则是系统崩溃的前兆，请认真审视。
            </p>
          </div>
        </div>
      )}

      {/* Monthly stats */}
      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="text-sm font-medium mb-2">本月变更统计（共 {thisMonthChanges.length} 次）</h3>
        {thisMonthChanges.length === 0 ? (
          <p className="text-xs text-muted-foreground">本月暂无规则变更</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(contextCounts).map(([ctx, count]) => (
              <span key={ctx} className={`text-xs px-2 py-0.5 rounded-full ${CONTEXT_COLORS[ctx] || 'bg-muted text-muted-foreground'}`}>
                {ctx}: {count}次
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Change list */}
      <div className="space-y-2">
        {changes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">暂无规则变更记录</p>
          </div>
        ) : changes.map(c => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.rule_name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${CONTEXT_COLORS[c.context] || 'bg-muted text-muted-foreground'}`}>
                {c.context}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {c.old_value && <p>修改前：{c.old_value}</p>}
              {c.new_value && <p>修改后：{c.new_value}</p>}
              <p className="pt-1">{c.reason}</p>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {format(new Date(c.created_at), 'yyyy-MM-dd HH:mm')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper to fetch this month's changes for monthly review
export async function fetchMonthRuleChanges(month: string): Promise<RuleChange[]> {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(y, m, 0, 23, 59, 59).toISOString();
  const { data } = await supabase
    .from('ev_rule_changes' as any)
    .select('*')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });
  return (data as any[] ?? []) as RuleChange[];
}
