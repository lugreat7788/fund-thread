import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Save, Settings2 } from 'lucide-react';
import type { useEvStore, EvHolding } from '@/store/useEvStore';

const DEFAULT_MONTHLY_BUDGET_CNY = 1000;
const EXCHANGE_RATE = 7.25;

type NodeType = 'buy' | 'sell';

interface NodeRowProps {
  label: string;
  price?: number;
  current?: number;
  done: boolean;
  color: string;
  type: NodeType;
  sharesInfo?: string;
  isNextTarget?: boolean;
}

function NodeRow({ label, price, current, done, color, type, sharesInfo, isNextTarget }: NodeRowProps) {
  if (!price) return null;
  const distance = current ? ((current - price) / price * 100) : 0;

  // Fix: sell triggers when price rises TO target, buy triggers when price drops TO target
  const triggered = current
    ? type === 'sell' ? current >= price : current <= price
    : false;

  const statusLabel = done ? '已执行' : triggered ? '已触发' : '待触发';
  const statusCls = done
    ? 'text-muted-foreground line-through'
    : triggered
      ? 'text-green-600 font-bold'
      : 'text-muted-foreground';

  const rowBg = done
    ? 'bg-secondary/20'
    : triggered
      ? 'bg-green-500/10 border border-green-500/30'
      : isNextTarget
        ? 'bg-amber-500/10 border border-amber-400/50'
        : 'bg-secondary/30';

  return (
    <div className={`rounded-lg text-xs font-mono ${rowBg}`}>
      <div className="flex items-center justify-between py-1.5 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>${price.toFixed(2)}</span>
          {current != null && <span className="text-[10px]">{distance > 0 ? '+' : ''}{distance.toFixed(1)}%</span>}
          <span className={`text-[10px] ${statusCls}`}>
            {triggered && !done ? '✅ ' : ''}{statusLabel}
          </span>
          {isNextTarget && !done && !triggered && (
            <span className="text-[10px] text-amber-500 font-semibold">⭐ 下一目标</span>
          )}
        </div>
      </div>
      {sharesInfo && (
        <div className="px-2 pb-1.5 text-[10px] text-muted-foreground pl-6">
          {sharesInfo}
        </div>
      )}
    </div>
  );
}

function calcSellShares(totalShares: number) {
  const step1 = Math.floor(totalShares * 0.20);
  const step2 = Math.floor((totalShares - step1) * 0.30);
  const step3 = Math.floor((totalShares - step1 - step2) * 0.30);
  const base = Math.round((totalShares - step1 - step2 - step3) * 100) / 100;
  return { step1, step2, step3, base };
}

function calcBuyShares(budgetUsd: number, prices: (number | undefined)[]) {
  const [p1, p2, p3] = prices;
  const alloc1 = budgetUsd * 0.30;
  const alloc2 = budgetUsd * 0.50;
  const alloc3 = budgetUsd - alloc1 - alloc2; // remaining 20%
  return {
    tier1: p1 ? { shares: Math.floor(alloc1 / p1), cost: alloc1 } : undefined,
    tier2: p2 ? { shares: Math.floor(alloc2 / p2), cost: alloc2 } : undefined,
    tier3: p3 ? { shares: Math.floor(alloc3 / p3), cost: alloc3 } : undefined,
  };
}

function findNextTarget(
  current: number | undefined,
  nodes: { price?: number; done: boolean; type: NodeType }[],
): number | undefined {
  if (!current) return undefined;
  let closest: { price: number; dist: number } | undefined;

  for (const n of nodes) {
    if (!n.price || n.done) continue;
    const triggered = n.type === 'sell' ? current >= n.price : current <= n.price;
    if (triggered) continue;
    const dist = Math.abs(current - n.price);
    if (!closest || dist < closest.dist) {
      closest = { price: n.price, dist };
    }
  }
  return closest?.price;
}

function HoldingNodes({ holding, onSave, monthlyBudgetCny }: {
  holding: EvHolding;
  onSave: (id: string, u: Record<string, any>) => void;
  monthlyBudgetCny: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [high52w, setHigh52w] = useState(holding.high52w?.toString() ?? holding.recentHigh?.toString() ?? '');
  const [recentHigh, setRecentHigh] = useState(holding.recentHigh?.toString() ?? '');
  const [s1, setS1] = useState(holding.sellTier1Price?.toString() ?? '');
  const [s2, setS2] = useState(holding.sellTier2Price?.toString() ?? '');
  const [s3, setS3] = useState(holding.sellTier3Price?.toString() ?? '');

  const handleSave = () => {
    const rh = parseFloat(recentHigh) || undefined;
    const h52 = parseFloat(high52w) || undefined;
    onSave(holding.id, {
      recentHigh: rh,
      high52w: h52,
      buyTier1Price: rh ? +(rh * 0.85).toFixed(2) : undefined,
      buyTier2Price: rh ? +(rh * 0.75).toFixed(2) : undefined,
      buyTier3Price: rh ? +(rh * 0.65).toFixed(2) : undefined,
      sellTier1Price: parseFloat(s1) || undefined,
      sellTier2Price: parseFloat(s2) || undefined,
      sellTier3Price: parseFloat(s3) || undefined,
    });
    setEditing(false);
  };

  const cur = holding.currentPrice;
  const budgetUsd = monthlyBudgetCny / EXCHANGE_RATE;
  const sellShares = calcSellShares(holding.shares);
  const buyShares = calcBuyShares(budgetUsd, [holding.buyTier1Price, holding.buyTier2Price, holding.buyTier3Price]);

  const allNodes = [
    { price: holding.buyTier1Price, done: false, type: 'buy' as NodeType },
    { price: holding.buyTier2Price, done: false, type: 'buy' as NodeType },
    { price: holding.buyTier3Price, done: false, type: 'buy' as NodeType },
    { price: holding.sellTier1Price, done: holding.sellTier1Done, type: 'sell' as NodeType },
    { price: holding.sellTier2Price, done: holding.sellTier2Done, type: 'sell' as NodeType },
    { price: holding.sellTier3Price, done: holding.sellTier3Done, type: 'sell' as NodeType },
  ];
  const nextTargetPrice = findNextTarget(cur, allNodes);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-left">
        <div>
          <span className="text-sm font-display font-semibold">{holding.symbol}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{holding.name}</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">({holding.shares}股)</span>
        </div>
        <div className="flex items-center gap-2">
          {cur && <span className="text-xs font-mono">${cur.toFixed(2)}</span>}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* 52-week high and drawdown info */}
          {holding.high52w && (
            <div className="flex items-center justify-between bg-secondary/20 rounded-lg px-2 py-1.5 text-[10px] font-mono">
              <span className="text-muted-foreground">52周收盘高点：<span className="text-foreground font-semibold">${holding.high52w.toFixed(2)}</span></span>
              {cur && (
                <span className={`font-semibold ${cur < holding.high52w ? 'text-loss' : 'text-profit'}`}>
                  当前回撤：{((1 - cur / holding.high52w) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
          <div className="text-[10px] font-mono text-primary">📉 三档买入节点</div>
          <div className="text-[10px] text-muted-foreground/60 -mt-1">基于个股52周收盘高点回撤</div>
          <NodeRow label="第一档 (-15%)" price={holding.buyTier1Price} current={cur} done={false} color="hsl(45,90%,55%)"
            type="buy" isNextTarget={holding.buyTier1Price === nextTargetPrice}
            sharesInfo={buyShares.tier1 ? `买入 ${buyShares.tier1.shares}股（预计 ¥${Math.round(buyShares.tier1.cost * EXCHANGE_RATE)}）` : undefined} />
          <NodeRow label="第二档 (-25%)" price={holding.buyTier2Price} current={cur} done={false} color="hsl(30,90%,55%)"
            type="buy" isNextTarget={holding.buyTier2Price === nextTargetPrice}
            sharesInfo={buyShares.tier2 ? `买入 ${buyShares.tier2.shares}股（预计 ¥${Math.round(buyShares.tier2.cost * EXCHANGE_RATE)}）` : undefined} />
          <NodeRow label="第三档 (-35%)" price={holding.buyTier3Price} current={cur} done={false} color="hsl(0,70%,50%)"
            type="buy" isNextTarget={holding.buyTier3Price === nextTargetPrice}
            sharesInfo={buyShares.tier3 ? `买入 ${buyShares.tier3.shares}股（预计 ¥${Math.round(buyShares.tier3.cost * EXCHANGE_RATE)}）` : undefined} />

          <div className="text-[10px] font-mono text-profit mt-2">📈 三步减仓节点</div>
          <NodeRow label="第一步 (+25%)" price={holding.sellTier1Price} current={cur} done={holding.sellTier1Done} color="hsl(142,70%,45%)"
            type="sell" isNextTarget={holding.sellTier1Price === nextTargetPrice}
            sharesInfo={`卖出 ${sellShares.step1}股`} />
          <NodeRow label="第二步 (+50%)" price={holding.sellTier2Price} current={cur} done={holding.sellTier2Done} color="hsl(142,70%,55%)"
            type="sell" isNextTarget={holding.sellTier2Price === nextTargetPrice}
            sharesInfo={`卖出 ${sellShares.step2}股`} />
          <NodeRow label="第三步 (+80%)" price={holding.sellTier3Price} current={cur} done={holding.sellTier3Done} color="hsl(142,70%,65%)"
            type="sell" isNextTarget={holding.sellTier3Price === nextTargetPrice}
            sharesInfo={`卖出 ${sellShares.step3}股`} />
          <div className="flex items-center gap-2 py-1 px-2 text-[10px] font-mono text-muted-foreground bg-secondary/20 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            底仓保留 {sellShares.base}股
          </div>

          <div className="pt-2 border-t border-border">
            {!editing ? (
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setEditing(true)}>编辑节点</Button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">近期高点</label>
                    <Input value={recentHigh} onChange={e => setRecentHigh(e.target.value)} className="h-7 text-xs" placeholder="高点价格" />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">减仓价格</div>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={s1} onChange={e => setS1(e.target.value)} className="h-7 text-xs" placeholder="+25%" />
                  <Input value={s2} onChange={e => setS2(e.target.value)} className="h-7 text-xs" placeholder="+50%" />
                  <Input value={s3} onChange={e => setS3(e.target.value)} className="h-7 text-xs" placeholder="+80%" />
                </div>
                <Button size="sm" className="w-full text-xs gap-1" onClick={handleSave}>
                  <Save className="w-3 h-3" /> 保存
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OperationNodes({ store }: { store: ReturnType<typeof useEvStore> }) {
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(DEFAULT_MONTHLY_BUDGET_CNY.toString());
  const monthlyBudgetCny = parseFloat(budgetInput) || DEFAULT_MONTHLY_BUDGET_CNY;

  if (store.holdings.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">请先在「持仓」页面导入数据</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-muted-foreground">
          每只标的的买入/减仓触发节点及当前距离
        </div>
        <button onClick={() => setShowBudget(!showBudget)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <Settings2 className="w-3 h-3" />
          月预算 ¥{monthlyBudgetCny}
        </button>
      </div>
      {showBudget && (
        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
          <label className="text-[10px] text-muted-foreground whitespace-nowrap">每月可投入 (¥)</label>
          <Input value={budgetInput} onChange={e => setBudgetInput(e.target.value)} className="h-7 text-xs max-w-[120px]" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">≈ ${(monthlyBudgetCny / EXCHANGE_RATE).toFixed(0)} (汇率 {EXCHANGE_RATE})</span>
        </div>
      )}
      {store.holdings.map(h => (
        <HoldingNodes key={h.id} holding={h} onSave={store.updateHolding} monthlyBudgetCny={monthlyBudgetCny} />
      ))}
    </div>
  );
}
