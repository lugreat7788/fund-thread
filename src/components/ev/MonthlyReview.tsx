import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, Plus, Trash2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { useEvStore } from '@/store/useEvStore';

const STEP_LABELS = ['操作核对', '执行率', '冲动记录', '压力测试', 'Bug记录', '规则修订'];

const RULE_SOURCES = [
  '常规定投(每月1号)',
  '节点触发',
  '恐慌加码',
  '减仓节点触发',
  '规则外操作(违规)',
];

const MISS_REASONS = [
  '资金不足',
  '判断规则不适用',
  '情绪犹豫',
  '忘记了',
  '其他',
];

const PRESSURE_OPTIONS = [
  { value: 'ok', label: '能，且规则会正常触发' },
  { value: 'fund', label: '能，但我的资金会不够' },
  { value: 'unsure', label: '不确定，需要检查' },
  { value: 'fail', label: '不能，规则会崩' },
];

interface TradeRecord {
  id: string;
  symbol: string;
  name: string;
  date: string;
  action: string; // buy or sell
  price: number;
  shares: number;
  ruleSource?: string;
  violationReason?: string;
}

interface ImpulseRecord {
  date: string;
  action: string;
  emotion: string;
  restrainReason: string;
}

interface ReviewData {
  q1_operations: TradeRecord[];
  q2_triggerRate: { triggered: number; executed: number; misses: { reason: string; detail?: string }[] };
  q3_impulses: ImpulseRecord[];
  q4_pressure: { choice: string; reason: string };
  q5_bugs: string[];
  q6_revisions: string[];
}

export function MonthlyReview({ store }: { store: ReturnType<typeof useEvStore> }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const existingReview = store.reviews.find(r => r.month === currentMonth);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(!!existingReview);
  const [loadingTrades, setLoadingTrades] = useState(true);

  // Q1 state
  const [operations, setOperations] = useState<TradeRecord[]>([]);

  // Q2 state
  const [triggerData, setTriggerData] = useState({ triggered: 0, executed: 0, misses: [] as { reason: string; detail?: string }[] });

  // Q3 state
  const [impulses, setImpulses] = useState<ImpulseRecord[]>([]);
  const [showImpulseWarning, setShowImpulseWarning] = useState(false);

  // Q4 state
  const [pressureChoice, setPressureChoice] = useState('');
  const [pressureReason, setPressureReason] = useState('');

  // Q5 state
  const [bugs, setBugs] = useState<string[]>([]);

  // Q6 state
  const [revisions, setRevisions] = useState<string[]>([]);

  // Load this month's trades
  useEffect(() => {
    if (done) { setLoadingTrades(false); return; }
    (async () => {
      setLoadingTrades(true);
      const startDate = `${currentMonth}-01`;
      const endMonth = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 1);
      const endDate = endMonth.toISOString().slice(0, 10);

      // Get buys
      const { data: buys } = await supabase.from('trades')
        .select('id, symbol, name, buy_date, buy_price, shares')
        .gte('buy_date', startDate).lt('buy_date', endDate);

      // Get sells
      const { data: sells } = await supabase.from('trades')
        .select('id, symbol, name, sell_date, sell_price, shares')
        .not('sell_date', 'is', null)
        .gte('sell_date', startDate).lt('sell_date', endDate);

      // Get DCA records
      const { data: dcas } = await supabase.from('ev_dca_records' as any)
        .select('id, symbol, name, date, price, shares')
        .gte('date', startDate).lt('date', endDate);

      // Get operation logs
      const { data: opLogs } = await supabase.from('operation_logs')
        .select('id, symbol, name, created_at, action, price, shares')
        .gte('created_at', startDate).lt('created_at', endDate);

      const records: TradeRecord[] = [];
      const seen = new Set<string>();

      (buys ?? []).forEach((t: any) => {
        const key = `buy-${t.symbol}-${t.buy_date}`;
        if (!seen.has(key)) { seen.add(key); records.push({ id: t.id, symbol: t.symbol, name: t.name, date: t.buy_date, action: '买入', price: t.buy_price, shares: t.shares }); }
      });
      (sells ?? []).forEach((t: any) => {
        const key = `sell-${t.symbol}-${t.sell_date}`;
        if (!seen.has(key)) { seen.add(key); records.push({ id: t.id, symbol: t.symbol, name: t.name, date: t.sell_date, action: '卖出', price: t.sell_price, shares: t.shares }); }
      });
      (dcas ?? []).forEach((d: any) => {
        const key = `dca-${d.symbol}-${d.date}`;
        if (!seen.has(key)) { seen.add(key); records.push({ id: d.id, symbol: d.symbol, name: d.name, date: d.date, action: '定投买入', price: d.price, shares: d.shares, ruleSource: '常规定投(每月1号)' }); }
      });
      (opLogs ?? []).forEach((o: any) => {
        const key = `op-${o.symbol}-${o.created_at}`;
        if (!seen.has(key)) { seen.add(key); records.push({ id: o.id, symbol: o.symbol, name: o.name, date: o.created_at?.slice(0, 10), action: o.action, price: o.price, shares: o.shares }); }
      });

      records.sort((a, b) => a.date.localeCompare(b.date));
      setOperations(records);
      setLoadingTrades(false);
    })();
  }, [currentMonth, done]);

  const updateOperationRule = (idx: number, rule: string) => {
    setOperations(prev => prev.map((o, i) => i === idx ? { ...o, ruleSource: rule, violationReason: rule === '规则外操作(违规)' ? o.violationReason : undefined } : o));
  };
  const updateViolationReason = (idx: number, reason: string) => {
    setOperations(prev => prev.map((o, i) => i === idx ? { ...o, violationReason: reason } : o));
  };

  // Q2: add/remove misses
  const addMiss = () => setTriggerData(prev => ({ ...prev, misses: [...prev.misses, { reason: '', detail: '' }] }));
  const removeMiss = (i: number) => setTriggerData(prev => ({ ...prev, misses: prev.misses.filter((_, idx) => idx !== i) }));
  const updateMiss = (i: number, field: string, val: string) => setTriggerData(prev => ({
    ...prev, misses: prev.misses.map((m, idx) => idx === i ? { ...m, [field]: val } : m),
  }));

  // Q3: impulses
  const addImpulse = () => setImpulses(prev => [...prev, { date: '', action: '', emotion: '', restrainReason: '' }]);
  const removeImpulse = (i: number) => setImpulses(prev => prev.filter((_, idx) => idx !== i));
  const updateImpulse = (i: number, field: string, val: string) => setImpulses(prev => prev.map((imp, idx) => idx === i ? { ...imp, [field]: val } : imp));

  // Q5/Q6: list items
  const addBug = () => setBugs(prev => [...prev, '']);
  const removeBug = (i: number) => setBugs(prev => prev.filter((_, idx) => idx !== i));
  const addRevision = () => setRevisions(prev => [...prev, '']);
  const removeRevision = (i: number) => setRevisions(prev => prev.filter((_, idx) => idx !== i));

  // Validation per step
  const canProceed = useCallback(() => {
    switch (step) {
      case 0: // Q1: every operation must have a rule source; violations need reason
        return operations.length === 0 || operations.every(o =>
          o.ruleSource && (o.ruleSource !== '规则外操作(违规)' || (o.violationReason && o.violationReason.length >= 5))
        );
      case 1: // Q2: if misses exist, each needs a reason
        return triggerData.misses.every(m => m.reason.length > 0 && (m.reason !== '其他' || (m.detail && m.detail.length > 0)));
      case 2: // Q3: each impulse must be fully filled
        return impulses.every(imp => imp.date && imp.action && imp.emotion && imp.restrainReason);
      case 3: // Q4: choice + reason >= 30 chars
        return pressureChoice.length > 0 && pressureReason.length >= 30;
      case 4: // Q5: bugs optional, each non-empty if present
        return bugs.every(b => b.length > 0);
      case 5: // Q6: revisions optional, each non-empty if present
        return revisions.every(r => r.length > 0);
      default: return true;
    }
  }, [step, operations, triggerData, impulses, pressureChoice, pressureReason, bugs, revisions]);

  const handleSubmit = async () => {
    const reviewData: ReviewData = {
      q1_operations: operations,
      q2_triggerRate: triggerData,
      q3_impulses: impulses,
      q4_pressure: { choice: pressureChoice, reason: pressureReason },
      q5_bugs: bugs.filter(b => b.length > 0),
      q6_revisions: revisions.filter(r => r.length > 0),
    };

    const violationCount = operations.filter(o => o.ruleSource === '规则外操作(违规)').length;
    const execRate = triggerData.triggered > 0 ? Math.round((triggerData.executed / triggerData.triggered) * 100) : 100;
    const summaryViolations = `违规操作${violationCount}次 | 执行率${execRate}% | 冲动${impulses.length}次 | 压力测试:${PRESSURE_OPTIONS.find(p => p.value === pressureChoice)?.label}`;

    await store.addReview({
      month: currentMonth,
      violations: summaryViolations,
      holdingsStatus: reviewData,
      nextMonthPlan: revisions.join('; '),
      watchlist: bugs.join('; '),
    });
    setDone(true);
  };

  // Render completed reviews
  if (done) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-profit mx-auto mb-2" />
          <div className="text-sm font-mono">本月复盘已完成</div>
        </div>
        {store.reviews.map(r => {
          const rd = r.holdingsStatus as ReviewData | undefined;
          return (
            <div key={r.id} className="bg-card rounded-xl p-3 border border-border space-y-2 text-xs font-mono">
              <div className="font-display font-semibold text-sm">{r.month}</div>
              {r.violations && <div className="text-muted-foreground">{r.violations}</div>}
              {rd?.q1_operations && (
                <div>
                  <span className="text-primary">操作记录:</span> {rd.q1_operations.length}笔
                  {rd.q1_operations.filter(o => o.ruleSource === '规则外操作(违规)').length > 0 &&
                    <span className="text-loss ml-1">({rd.q1_operations.filter(o => o.ruleSource === '规则外操作(违规)').length}笔违规)</span>}
                </div>
              )}
              {rd?.q3_impulses && rd.q3_impulses.length > 0 && (
                <div><span className="text-primary">抑制冲动:</span> {rd.q3_impulses.length}次</div>
              )}
              {rd?.q4_pressure && (
                <div><span className="text-primary">压力测试:</span> {PRESSURE_OPTIONS.find(p => p.value === rd.q4_pressure.choice)?.label}</div>
              )}
              {rd?.q6_revisions && rd.q6_revisions.length > 0 && (
                <div><span className="text-primary">规则修订:</span> {rd.q6_revisions.join('; ')}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex gap-1">
        {STEP_LABELS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
            <div className={`text-[8px] text-center mt-1 font-mono ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</div>
          </div>
        ))}
      </div>

      {/* Q1: 操作清单核对 */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q1：操作清单核对</div>
          <div className="text-[10px] text-muted-foreground">本月所有买卖记录已自动拉取，请为每笔操作标注规则来源。</div>
          {loadingTrades ? (
            <div className="text-xs text-muted-foreground py-4 text-center">加载中...</div>
          ) : operations.length === 0 ? (
            <div className="bg-card rounded-lg p-4 border border-border text-center text-xs text-muted-foreground">
              本月暂无交易记录
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {operations.map((op, idx) => (
                <div key={op.id} className="bg-card rounded-lg p-2.5 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span>
                      <span className={op.action.includes('卖') ? 'text-loss' : 'text-profit'}>{op.action}</span>
                      {' '}{op.symbol} <span className="text-muted-foreground">{op.name}</span>
                    </span>
                    <span className="text-muted-foreground">{op.date}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ${op.price} × {op.shares}股
                  </div>
                  <Select value={op.ruleSource || ''} onValueChange={v => updateOperationRule(idx, v)}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue placeholder="选择规则来源..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_SOURCES.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {op.ruleSource === '规则外操作(违规)' && (
                    <Textarea
                      value={op.violationReason || ''}
                      onChange={e => updateViolationReason(idx, e.target.value)}
                      placeholder="请说明违规原因（至少5字）..."
                      className="text-[10px] min-h-[50px]"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Q2: 触发执行率 */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q2：触发执行率</div>
          <div className="text-[10px] text-muted-foreground">本月节点触发与实际执行情况。</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">节点触发次数</label>
              <Input type="number" min={0} value={triggerData.triggered} onChange={e => setTriggerData(prev => ({ ...prev, triggered: +e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">实际执行次数</label>
              <Input type="number" min={0} max={triggerData.triggered} value={triggerData.executed} onChange={e => setTriggerData(prev => ({ ...prev, executed: +e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>
          {triggerData.triggered > 0 && (
            <div className="bg-card rounded-lg p-2 border border-border text-xs font-mono text-center">
              执行率：<span className={triggerData.executed < triggerData.triggered ? 'text-loss' : 'text-profit'}>
                {Math.round((triggerData.executed / triggerData.triggered) * 100)}%
              </span>
            </div>
          )}
          {triggerData.executed < triggerData.triggered && (
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-loss" />
                请为每次"触发但未执行"填写原因
              </div>
              {triggerData.misses.map((m, i) => (
                <div key={i} className="bg-card rounded-lg p-2 border border-border space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Select value={m.reason} onValueChange={v => updateMiss(i, 'reason', v)}>
                      <SelectTrigger className="h-7 text-[10px] flex-1">
                        <SelectValue placeholder="选择原因..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MISS_REASONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeMiss(i)} className="h-6 w-6 p-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {m.reason === '其他' && (
                    <Input value={m.detail || ''} onChange={e => updateMiss(i, 'detail', e.target.value)} placeholder="详细说明..." className="h-7 text-[10px]" />
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMiss} className="text-[10px] h-7 w-full gap-1">
                <Plus className="w-3 h-3" /> 添加未执行记录
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Q3: 想做但忍住的操作 */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q3：想做但忍住的操作</div>
          <div className="text-[10px] text-muted-foreground">本月有几次想操作但忍住了？每次的触发原因是什么？</div>

          {impulses.length === 0 && showImpulseWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 text-[10px] font-mono flex items-start gap-2">
              <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <span>一个月完全没有冲动的交易想法，比有冲动更值得警惕——要么你没在观察市场，要么你没诚实面对自己。</span>
            </div>
          )}

          {impulses.map((imp, i) => (
            <div key={i} className="bg-card rounded-lg p-2.5 border border-border space-y-1.5">
              <div className="flex items-center gap-2">
                <Input type="date" value={imp.date} onChange={e => updateImpulse(i, 'date', e.target.value)} className="h-7 text-[10px] flex-1" />
                <Button variant="ghost" size="sm" onClick={() => removeImpulse(i)} className="h-6 w-6 p-0">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input value={imp.action} onChange={e => updateImpulse(i, 'action', e.target.value)} placeholder="想做的操作（如：想加仓AAPL）" className="h-7 text-[10px]" />
              <Input value={imp.emotion} onChange={e => updateImpulse(i, 'emotion', e.target.value)} placeholder="当时的情绪（如：FOMO、恐慌）" className="h-7 text-[10px]" />
              <Input value={imp.restrainReason} onChange={e => updateImpulse(i, 'restrainReason', e.target.value)} placeholder="忍住的理由" className="h-7 text-[10px]" />
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addImpulse} className="text-[10px] h-7 flex-1 gap-1">
              <Plus className="w-3 h-3" /> 添加冲动记录
            </Button>
            {impulses.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowImpulseWarning(true)} className="text-[10px] h-7 flex-1">
                本月无冲动
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Q4: 规则压力测试 */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q4：规则压力测试</div>
          <div className="text-[10px] text-muted-foreground">如果本月的行情波动再放大一倍，我的规则还能执行吗？</div>
          <div className="space-y-1.5">
            {PRESSURE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPressureChoice(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                  pressureChoice === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {pressureChoice && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">请说明理由（至少30字）<span className="text-loss">*</span></div>
              <Textarea
                value={pressureReason}
                onChange={e => setPressureReason(e.target.value)}
                placeholder="详细说明你的判断依据..."
                className="text-xs min-h-[80px]"
              />
              <div className={`text-[10px] text-right mt-0.5 ${pressureReason.length >= 30 ? 'text-profit' : 'text-muted-foreground'}`}>
                {pressureReason.length}/30
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q5: 系统Bug记录 */}
      {step === 4 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q5：系统Bug记录</div>
          <div className="text-[10px] text-muted-foreground">本月使用系统时，发现哪些规则不清晰、相互矛盾或执行起来有困难？</div>

          {bugs.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea
                value={b}
                onChange={e => setBugs(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`Bug #${i + 1}...`}
                className="text-[10px] min-h-[50px] flex-1"
              />
              <Button variant="ghost" size="sm" onClick={() => removeBug(i)} className="h-6 w-6 p-0 mt-1">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addBug} className="text-[10px] h-7 w-full gap-1">
            <Plus className="w-3 h-3" /> 添加Bug
          </Button>
          {bugs.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center">可填0条，直接进入下一步</div>
          )}
        </div>
      )}

      {/* Q6: 下月规则修订 */}
      {step === 5 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary font-semibold">Q6：下月规则修订</div>
          <div className="text-[10px] text-muted-foreground">基于本月的观察，我下月要修改或新增哪些规则？</div>

          {revisions.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea
                value={r}
                onChange={e => setRevisions(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`规则修订 #${i + 1}...`}
                className="text-[10px] min-h-[50px] flex-1"
              />
              <Button variant="ghost" size="sm" onClick={() => removeRevision(i)} className="h-6 w-6 p-0 mt-1">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRevision} className="text-[10px] h-7 w-full gap-1">
            <Plus className="w-3 h-3" /> 添加规则修订
          </Button>
          {revisions.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center">可填0条</div>
          )}

          <Button onClick={handleSubmit} disabled={!canProceed()} className="w-full text-xs mt-2">
            提交月度复盘报告
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="flex-1 text-xs">上一步</Button>}
        {step < 5 && (
          <Button
            size="sm"
            onClick={() => {
              if (step === 2 && impulses.length === 0) setShowImpulseWarning(true);
              setStep(s => s + 1);
            }}
            disabled={!canProceed()}
            className="flex-1 text-xs"
          >
            下一步
          </Button>
        )}
      </div>
    </div>
  );
}
