import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Plus, Info } from 'lucide-react';
import type { useEvStore } from '@/store/useEvStore';

const PRIORITIES = [
  { key: 'P1', label: 'P1：已触发买点（优先补仓）', color: 'hsl(0,70%,50%)' },
  { key: 'P2', label: 'P2：盈利且逻辑完好', color: 'hsl(45,90%,55%)' },
  { key: 'P3', label: 'P3：观察名单新标的', color: 'hsl(200,70%,50%)' },
  { key: 'P4', label: 'P4：杠杆品种（最低）', color: 'hsl(280,70%,60%)' },
];

const PANIC_RULES = [
  { range: '大盘跌 10-15%', amount: '¥1,000', note: '正常投入' },
  { range: '大盘跌 15-25%', amount: '¥2,000', note: '加倍（动用1月储备）' },
  { range: '大盘跌 25%+', amount: '¥3,000', note: '三倍（动用2-3月储备）' },
];

export function DcaPlan({ store }: { store: ReturnType<typeof useEvStore> }) {
  const [adding, setAdding] = useState(false);
  const [sym, setSym] = useState('');
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [priority, setPriority] = useState('P2');

  const monthlyBudget = 140; // $140 ≈ ¥1000
  const reserve = 280; // ¥2000

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRecords = store.dcaRecords.filter(r => r.date.startsWith(currentMonth));
  const thisMonthTotal = thisMonthRecords.reduce((s, r) => s + r.amount, 0);
  const remaining = monthlyBudget - thisMonthTotal;

  const monthlyChart = useMemo(() => {
    const map: Record<string, number> = {};
    store.dcaRecords.forEach(r => {
      const m = r.date.slice(0, 7);
      map[m] = (map[m] || 0) + r.amount;
    });
    return Object.entries(map).sort().slice(-6).map(([month, total]) => ({ month: month.slice(5), total }));
  }, [store.dcaRecords]);

  // Auto priority suggestions
  const suggestions = useMemo(() => {
    return store.holdings
      .filter(h => !h.isClosed)
      .map(h => {
        let p = 'P2';
        if (h.assetType === 'leveraged_etf') p = 'P4';
        else if (h.currentPrice && h.buyTier1Price && h.currentPrice <= h.buyTier1Price) p = 'P1';
        else if (h.status === 'safe') p = 'P2';
        else p = 'P3';
        return { symbol: h.symbol, name: h.name, priority: p };
      })
      .sort((a, b) => a.priority.localeCompare(b.priority));
  }, [store.holdings]);

  const handleAdd = async () => {
    if (!sym || !amt || !price || !shares) return;
    await store.addDcaRecord({
      date: new Date().toISOString().slice(0, 10), symbol: sym, name: name || sym,
      amount: parseFloat(amt), price: parseFloat(price), shares: parseFloat(shares), priority,
    });
    setSym(''); setName(''); setAmt(''); setPrice(''); setShares('');
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Budget Status */}
      <div className="bg-card rounded-xl p-3 border border-border space-y-2">
        <div className="text-xs font-mono text-muted-foreground">本月定投预算</div>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-display font-bold text-primary">${remaining.toFixed(0)}</span>
            <span className="text-xs text-muted-foreground ml-1">剩余</span>
          </div>
          <div className="text-xs font-mono text-muted-foreground">已投 ${thisMonthTotal.toFixed(0)} / ${monthlyBudget}</div>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (thisMonthTotal / monthlyBudget) * 100)}%` }} />
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">💰 现金储备：¥2,000（${reserve}）始终保持</div>
      </div>

      {/* Priority Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-muted-foreground">本月优先级排序</div>
          {suggestions.map(s => {
            const pConfig = PRIORITIES.find(p => p.key === s.priority);
            return (
              <div key={s.symbol} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border text-xs font-mono">
                <span>{s.symbol} <span className="text-muted-foreground">{s.name}</span></span>
                <span style={{ color: pConfig?.color }}>{s.priority}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Panic Rules */}
      <div className="bg-card rounded-xl p-3 border border-border space-y-1.5">
        <div className="text-xs font-mono text-loss">🔥 恐慌加码规则</div>
        {PANIC_RULES.map(r => (
          <div key={r.range} className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">{r.range}</span>
            <span>{r.amount} <span className="text-muted-foreground">({r.note})</span></span>
          </div>
        ))}
      </div>

      {/* Add Record */}
      {!adding ? (
        <Button size="sm" onClick={() => setAdding(true)} className="w-full text-xs gap-1">
          <Plus className="w-3 h-3" /> 记录定投
        </Button>
      ) : (
        <div className="bg-card rounded-xl p-3 border border-border space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground">代码</label><Input value={sym} onChange={e => setSym(e.target.value)} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">名称</label><Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs mt-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-muted-foreground">金额($)</label><Input value={amt} onChange={e => setAmt(e.target.value)} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">价格</label><Input value={price} onChange={e => setPrice(e.target.value)} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">股数</label><Input value={shares} onChange={e => setShares(e.target.value)} className="h-7 text-xs mt-1" /></div>
          </div>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p.key} value={p.key}>{p.key}: {p.label.split('：')[1]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="flex-1 text-xs">取消</Button>
            <Button size="sm" onClick={handleAdd} className="flex-1 text-xs">确认</Button>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      {monthlyChart.length > 0 && (
        <div className="bg-card rounded-xl p-3 border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">月度定投汇总</div>
          <div className="h-32">
            <ResponsiveContainer>
              <BarChart data={monthlyChart}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,12%,50%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,12%,50%)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'hsl(220,18%,12%)', border: '1px solid hsl(220,15%,18%)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `$${v}`} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {monthlyChart.map((_, i) => <Cell key={i} fill="hsl(45,90%,55%)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Records */}
      {thisMonthRecords.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-muted-foreground">本月记录</div>
          {thisMonthRecords.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border text-xs font-mono">
              <div><span className="font-semibold">{r.symbol}</span> <span className="text-muted-foreground">{r.date}</span></div>
              <div><span>${r.amount}</span> <span className="text-muted-foreground ml-1">{r.priority}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
