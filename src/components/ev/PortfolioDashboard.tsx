import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, Plus, Edit2, Check } from 'lucide-react';
import type { useEvStore } from '@/store/useEvStore';
import { getEvCash, setEvCash } from '@/store/useCloudTradeStore';

const STATUS_CONFIG = {
  safe: { label: '✅ 持有安全', cls: 'text-profit' },
  watch: { label: '⚠️ 观察', cls: 'text-yellow-400' },
  warning: { label: '🔴 警告', cls: 'text-loss' },
};

const PIE_COLORS = ['hsl(45,90%,55%)', 'hsl(142,70%,45%)', 'hsl(200,70%,50%)', 'hsl(280,70%,60%)', 'hsl(0,70%,50%)'];

export function PortfolioDashboard({ store }: { store: ReturnType<typeof useEvStore> }) {
  const h = store.holdings;
  const [cashUsd, setCashUsd] = useState(() => getEvCash() || 140);
  const [editingCash, setEditingCash] = useState(false);
  const [tempCash, setTempCash] = useState(cashUsd);

  // Re-read cash from localStorage periodically (in case trades update it)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = getEvCash();
      if (stored > 0) setCashUsd(stored);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalValue = useMemo(() =>
    h.reduce((s, x) => s + (x.currentPrice ? x.currentPrice * x.shares : x.totalCost), 0) + cashUsd, [h, cashUsd]);

  const totalCost = useMemo(() => h.reduce((s, x) => s + x.totalCost, 0), [h]);
  const totalPnL = useMemo(() =>
    h.reduce((s, x) => s + (x.currentPrice ? (x.currentPrice - x.avgPrice) * x.shares : 0), 0), [h]);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const pieData = useMemo(() => {
    const items = h.map(x => ({
      name: x.symbol,
      value: x.currentPrice ? x.currentPrice * x.shares : x.totalCost,
    }));
    items.push({ name: '现金', value: cashUsd });
    return items;
  }, [h, cashUsd]);

  return (
    <div className="space-y-4">
      {/* Init button */}
      {h.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <div className="text-3xl">📊</div>
          <p className="text-sm text-muted-foreground">暂无持仓数据</p>
          <Button size="sm" onClick={store.initializeDefaults} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> 导入初始持仓
          </Button>
        </div>
      )}

      {h.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="text-[10px] text-muted-foreground font-mono">总资产</div>
              <div className="text-xl font-display font-bold text-primary">${totalValue.toFixed(0)}</div>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="text-[10px] text-muted-foreground font-mono">总盈亏</div>
              <div className={`text-xl font-display font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(1)}
                <span className="text-xs ml-1">({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Pie */}
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-xs text-muted-foreground font-mono mb-2">持仓比例</div>
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} strokeWidth={1} stroke="hsl(220,18%,10%)">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220,18%,12%)', border: '1px solid hsl(220,15%,18%)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `$${v.toFixed(0)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Holdings List */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-muted-foreground">持仓标的</div>
            <Button variant="ghost" size="sm" onClick={store.refreshPrices} className="h-7 px-2 text-xs gap-1">
              <RefreshCw className="w-3 h-3" /> 刷新行情
            </Button>
          </div>

          <div className="space-y-2">
            {h.map(holding => {
              const pnl = holding.currentPrice ? (holding.currentPrice - holding.avgPrice) * holding.shares : 0;
              const pnlPct = holding.currentPrice ? ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100 : 0;
              const status = STATUS_CONFIG[holding.status];
              const positionValue = holding.currentPrice ? holding.currentPrice * holding.shares : holding.totalCost;
              const weightPct = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;

              return (
                <div key={holding.id} className="bg-card rounded-xl p-3 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-display font-semibold">{holding.symbol}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{holding.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">现价</div>
                      <div className="text-sm font-mono font-semibold">{holding.currentPrice ? `$${holding.currentPrice.toFixed(2)}` : '...'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">均价</div>
                      <div className="text-sm font-mono">${holding.avgPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">浮盈亏</div>
                      <div className={`text-sm font-mono font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{holding.shares}股 · ${holding.totalCost.toFixed(0)}成本</span>
                    <span>仓位 {weightPct.toFixed(1)}%</span>
                  </div>
                  {holding.notes && (
                    <div className="text-[10px] text-muted-foreground/70 bg-secondary/30 rounded-lg px-2 py-1">{holding.notes}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cash */}
          <div className="bg-card rounded-xl p-3 border border-border space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-display font-semibold">💵 现金储备</div>
              {!editingCash ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => { setTempCash(cashUsd); setEditingCash(true); }}>
                  <Edit2 className="w-3 h-3" /> 调整
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-primary" onClick={() => {
                  setCashUsd(tempCash);
                  setEvCash(tempCash);
                  setEditingCash(false);
                }}>
                  <Check className="w-3 h-3" /> 保存
                </Button>
              )}
            </div>
            {editingCash ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">$</span>
                <Input className="h-7 text-xs w-32" type="number" value={tempCash} onChange={e => setTempCash(parseFloat(e.target.value) || 0)} />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-lg font-mono font-bold text-primary">${cashUsd.toFixed(0)}</div>
                <div className="text-sm font-mono text-muted-foreground">{((cashUsd / totalValue) * 100).toFixed(1)}%</div>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground font-mono">平仓收益自动累加 · 建仓自动扣减</div>
          </div>
        </>
      )}
    </div>
  );
}
