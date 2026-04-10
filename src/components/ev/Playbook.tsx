import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, BookOpen, ChevronDown, ChevronRight, Save, Trash2, AlertTriangle } from 'lucide-react';
import { RuleChangeDialog, type RuleChangeRequest } from './RuleChangeDialog';

interface PlaybookEntry {
  id: string;
  scenario_id: string;
  title: string;
  content: Record<string, string>;
  is_custom: boolean;
  updated_at: string;
}

const DEFAULT_SCENARIOS = [
  {
    id: 'crash_5pct',
    title: '情境1：单日-5%以上暴跌',
    fields: [
      { key: 'today', label: '今天做什么（具体到操作）' },
      { key: 'tomorrow', label: '明天做什么' },
      { key: 'data_check', label: '需要查看哪些数据再做决定' },
      { key: 'forbidden', label: '禁止做什么' },
    ],
  },
  {
    id: 'stock_crash_30pct',
    title: '情境2：持仓个股单日-30%爆雷',
    fields: [
      { key: 'first_reaction', label: '第一反应应该是什么' },
      { key: 'stop_vs_add', label: '判断"止损"vs"加仓"的标准' },
      { key: 'checklist', label: '需要核查的基本面信息清单' },
    ],
  },
  {
    id: 'slow_bear',
    title: '情境3：大盘连续3个月阴跌（慢熊）',
    fields: [
      { key: 'dca_continue', label: '常规定投是否继续' },
      { key: 'pace', label: '节奏是否调整' },
      { key: 'reserve_fund', label: '机动池资金的使用节奏' },
    ],
  },
  {
    id: 'gain_300pct',
    title: '情境4：单一持仓涨幅超过300%',
    fields: [
      { key: 'trigger_sell', label: '是否触发减仓' },
      { key: 'core_position', label: '底仓保留多少' },
      { key: 'profit_allocation', label: '利润如何再分配' },
    ],
  },
  {
    id: 'drawdown_20pct',
    title: '情境5：账户总回撤超过20%',
    fields: [
      { key: 'pause_days', label: '暂停交易的天数' },
      { key: 'pause_activity', label: '暂停期间做什么' },
      { key: 'resume_condition', label: '恢复交易的条件' },
    ],
  },
  {
    id: 'insufficient_funds',
    title: '情境6：规则触发但资金不足',
    fields: [
      { key: 'priority', label: '优先级排序逻辑' },
      { key: 'deep_reserve', label: '是否动用深渊池' },
      { key: 'unexecuted', label: '记录为"未执行"的处理方式' },
    ],
  },
];

export function Playbook() {
  const [entries, setEntries] = useState<PlaybookEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customFields, setCustomFields] = useState('');
  const [ruleChangeReq, setRuleChangeReq] = useState<RuleChangeRequest | null>(null);
  const [pendingChange, setPendingChange] = useState<{ scenarioId: string; content: Record<string, string> } | null>(null);

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const { data } = await supabase.from('ev_playbooks' as any).select('*').order('created_at');
    setEntries((data as any[] ?? []).map((r: any) => ({
      id: r.id,
      scenario_id: r.scenario_id,
      title: r.title,
      content: (r.content || {}) as Record<string, string>,
      is_custom: r.is_custom,
      updated_at: r.updated_at,
    })));
  };

  const getEntry = (scenarioId: string) => entries.find(e => e.scenario_id === scenarioId);
  const getDraft = (scenarioId: string) => drafts[scenarioId] || getEntry(scenarioId)?.content || {};

  const updateDraft = (scenarioId: string, key: string, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [scenarioId]: { ...getDraft(scenarioId), [scenarioId]: undefined, [key]: value, ...(prev[scenarioId] || {}), [key]: value },
    }));
    // Simplified:
    setDrafts(prev => {
      const current = prev[scenarioId] || getEntry(scenarioId)?.content || {};
      return { ...prev, [scenarioId]: { ...current, [key]: value } };
    });
  };

  const saveScenario = async (scenarioId: string, title: string, isCustom: boolean) => {
    const content = getDraft(scenarioId);
    const existing = getEntry(scenarioId);

    // If existing content changed, require rule change log
    if (existing && JSON.stringify(existing.content) !== JSON.stringify(content)) {
      const oldSummary = Object.entries(existing.content).map(([k, v]) => `${k}: ${v}`).join('; ');
      const newSummary = Object.entries(content).map(([k, v]) => `${k}: ${v}`).join('; ');
      setRuleChangeReq({
        ruleName: `预案手册 - ${title}`,
        oldValue: oldSummary.substring(0, 200),
        newValue: newSummary.substring(0, 200),
      });
      setPendingChange({ scenarioId, content });
      return;
    }

    await doSave(scenarioId, title, content, isCustom);
  };

  const doSave = async (scenarioId: string, title: string, content: Record<string, string>, isCustom: boolean) => {
    setSaving(scenarioId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = getEntry(scenarioId);
    if (existing) {
      await supabase.from('ev_playbooks' as any).update({
        content, title, updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('ev_playbooks' as any).insert({
        user_id: user.id, scenario_id: scenarioId, title, content, is_custom: isCustom,
      });
    }
    await loadEntries();
    setSaving(null);
  };

  const deleteCustom = async (id: string) => {
    await supabase.from('ev_playbooks' as any).delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const addCustomScenario = async () => {
    if (!customTitle.trim()) return;
    const scenarioId = `custom_${Date.now()}`;
    const fields = customFields.split('\n').filter(Boolean).map(f => f.trim());
    const content: Record<string, string> = {};
    fields.forEach(f => { content[f] = ''; });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ev_playbooks' as any).insert({
      user_id: user.id, scenario_id: scenarioId, title: customTitle, content, is_custom: true,
    });
    setCustomTitle('');
    setCustomFields('');
    setShowAddCustom(false);
    await loadEntries();
  };

  const customEntries = entries.filter(e => e.is_custom);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">预案手册</p>
            <p>在冷静期提前写好极端情境的执行脚本。当行情发生时，系统会提醒你调取对应预案，避免临场决策。</p>
          </div>
        </div>
      </div>

      {/* Default scenarios */}
      {DEFAULT_SCENARIOS.map(scenario => {
        const entry = getEntry(scenario.id);
        const draft = getDraft(scenario.id);
        const isExpanded = expanded === scenario.id;
        const filled = entry && Object.values(entry.content).some(v => v && v.trim());

        return (
          <div key={scenario.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : scenario.id)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-sm font-medium">{scenario.title}</span>
              </div>
              {filled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">已填写</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">未填写</span>
              )}
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                {scenario.fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium">{field.label}</label>
                    <Textarea
                      value={draft[field.key] || ''}
                      onChange={e => updateDraft(scenario.id, field.key, e.target.value)}
                      placeholder="填写你的应对方案..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={() => saveScenario(scenario.id, scenario.title, false)}
                  disabled={saving === scenario.id}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {saving === scenario.id ? '保存中...' : '保存'}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Custom scenarios */}
      {customEntries.map(entry => {
        const draft = getDraft(entry.scenario_id);
        const isExpanded = expanded === entry.scenario_id;
        return (
          <div key={entry.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : entry.scenario_id)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-sm font-medium">{entry.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">自定义</span>
              </div>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                {Object.keys(entry.content).map(key => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium">{key}</label>
                    <Textarea
                      value={draft[key] || ''}
                      onChange={e => updateDraft(entry.scenario_id, key, e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveScenario(entry.scenario_id, entry.title, true)} disabled={saving === entry.scenario_id}>
                    <Save className="w-3.5 h-3.5 mr-1" />{saving === entry.scenario_id ? '保存中...' : '保存'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteCustom(entry.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />删除
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add custom */}
      {showAddCustom ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <Input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="情境标题" />
          <Textarea
            value={customFields}
            onChange={e => setCustomFields(e.target.value)}
            placeholder="每行一个问题字段，例如：&#10;第一步做什么&#10;禁止做什么&#10;恢复条件"
            className="min-h-[80px] text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addCustomScenario} disabled={!customTitle.trim()}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddCustom(false)}>取消</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAddCustom(true)} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" /> 新增自定义情境
        </Button>
      )}

      {/* Quarterly reminder */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          系统每季度提醒一次：回顾你的预案手册，是否需要基于过去3个月的经验更新？
        </p>
      </div>

      <RuleChangeDialog
        request={ruleChangeReq}
        onConfirm={() => {
          if (pendingChange) {
            const scenario = [...DEFAULT_SCENARIOS, ...customEntries.map(e => ({ id: e.scenario_id, title: e.title }))].find(s => s.id === pendingChange.scenarioId);
            doSave(pendingChange.scenarioId, scenario?.title || '', pendingChange.content, !!customEntries.find(e => e.scenario_id === pendingChange.scenarioId));
          }
          setRuleChangeReq(null);
          setPendingChange(null);
        }}
        onCancel={() => { setRuleChangeReq(null); setPendingChange(null); }}
      />
    </div>
  );
}
