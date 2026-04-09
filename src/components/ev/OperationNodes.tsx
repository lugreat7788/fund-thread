import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Save, Settings2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { useEvStore, EvHolding } from '@/store/useEvStore';

const DEFAULT_MONTHLY_BUDGET_CNY = 1000;
const EXCHANGE_RATE = 7.25;

// Default market temperature thresholds (user-adjustable)
const DEFAULT_TEMP_THRESHOLDS = {
  fearGreedAbove: 75,
  vixBelow: 13,
  nasdaqMa200Deviation: 15,
};

type NodeType = 'buy' | 'sell';

interface MarketTempStatus {
  fearGreedMet: boolean;
  vixMet: boolean;
  nasdaqDeviationMet: boolean;
  anyMet: boolean;
  fearGreed?: number;
  vix?: number;
}

interface SellNodeRowProps {
  label: string;
  triggerPrice?: number;
  current?: number;
  done: boolean;
  color: string;
  sharesInfo?: string;
  isNextTarget?: boolean;
  conditionAMet: boolean;
  conditionBMet: boolean;
  marketTemp: MarketTempStatus;
}

function SellNodeRow({ label, triggerPrice, current, done, color, sharesInfo, isNextTarget, conditionAMet, conditionBMet, marketTemp }: SellNodeRowProps) {
  if (!triggerPrice) return null;
  const distance = current ? ((current - triggerPrice) / triggerPrice * 100) : 0;

  const bothMet = conditionAMet && conditionBMet;
  const statusLabel = done ? '已执行' : bothMet ? '已触发，待执行' : '待触发';
  const statusCls = done
    ? 'text-muted-foreground line-through'
    : bothMet
      ? 'text-red-500 font-bold'
      : 'text-muted-foreground';

  const rowBg = done
    ? 'bg-secondary/20'
    : bothMet
      ? 'bg-red-500/10 border border-red-500/30'
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
          <span>${triggerPrice.toFixed(2)}</span>
          {current != null && <span className="text-[10px]">{distance > 0 ? '+' : ''}{distance.toFixed(1)}%</span>}
          <span className={`text-[10px] ${statusCls}`}>
            {bothMet && !done ? '🔴 ' : ''}{statusLabel}
          </span>
        </div>
      </div>
      {/* Condition A & B status */}
      {!done && (
        <div className="px-2 pb-1.5 pl-6 space-y-0.5">
          <div className="text-[10px] text-muted-foreground">
            条件A（价格）：{conditionAMet ? '✅ 已满足' : '⏳ 待满足'}
            {current != null && !conditionAMet && (
              <span className="ml-1 text-muted-foreground/60">距触发 {Math.abs(distance).toFixed(1)}%</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            条件B（市场温度）：{conditionBMet ? '✅ 已满足' : '⏳ 待满足'}
            {!conditionBMet && (
              <span className="ml-1 text-muted-foreground/60">
                {marketTemp.fearGreed != null ? `恐贪${marketTemp.fearGreed}` : ''}
                {marketTemp.vix != null ? ` VIX${marketTemp.vix}` : ''}
              </span>
            )}
          </div>
        </div>
      )}
      {sharesInfo && (
        <div className="px-2 pb-1.5 text-[10px] text-muted-foreground pl-6">
          {sharesInfo}
        </div>
      )}
    </div>
  );
}

interface BuyNodeRowProps {
  label: string;
  price?: number;
  current?: number;
  done: boolean;
  color: string;
  sharesInfo?: string;
  isNextTarget?: boolean;
}

function BuyNodeRow({ label, price, current, done, color, sharesInfo, isNextTarget }: BuyNodeRowProps) {
  if (!price) return null;
  const distance = current ? ((current - price) / price * 100) : 0;
  const triggered = current ? current <= price : false;

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
  const alloc3 = budgetUsd - alloc1 - alloc2;
  return {
    tier1: p1 ? { shares: Math.floor(alloc1 / p1), cost: alloc1 } : undefined,
    tier2: p2 ? { shares: Math.floor(alloc2 / p2), cost: alloc2 } : undefined,
    tier3: p3 ? { shares: Math.floor(alloc3 / p3), cost: alloc3 } : undefined,
  };
}

function findNextBuyTarget(
  current: number | undefined,
  nodes: { price?: number; done: boolean }[],
): number | undefined {
  if (!current) return undefined;
  let closest: { price: number; dist: number } | undefined;
  for (const n of nodes) {
    if (!n.price || n.done) continue;
    if (current <= n.price) continue; // already triggered
    const dist = Math.abs(current - n.price);
    if (!closest || dist < closest.dist) closest = { price: n.price, dist };
  }
  return closest?.price;
}

function getMarketTempStatus(sentiment?: { fearGreed?: number; vix?: number }, thresholds = DEFAULT_TEMP_THRESHOLDS): MarketTempStatus {
  const fg = sentiment?.fearGreed;
  const vix = sentiment?.vix;
  const fearGreedMet = fg != null ? fg > thresholds.fearGreedAbove : false;
  const vixMet = vix != null ? vix < thresholds.vixBelow : false;
  // nasdaqDeviation not available from current data, default false
  const nasdaqDeviationMet = false;

  return {
    fearGreedMet,
    vixMet,
    nasdaqDeviationMet,
    anyMet: fearGreedMet || vixMet || nasdaqDeviationMet,
    fearGreed: fg,
    vix,
  };
}

function HoldingNodes({ holding, onSave, monthlyBudgetCny, marketTemp }: {
  holding: EvHolding;
  onSave: (id: string, u: Record<string, any>) => void;
  monthlyBudgetCny: number;
  marketTemp: MarketTempStatus;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [high52w, setHigh52w] = useState(holding.high52w?.toString() ?? holding.recentHigh?.toString() ?? '');
  const [recentHigh, setRecentHigh] = useState(holding.recentHigh?.toString() ?? '');
  const [low12m, setLow12m] = useState(holding.recentHigh ? (holding.recentHigh * 0.6).toFixed(2) : '');
  const [s1, setS1] = useState(holding.sellTier1Price?.toString() ?? '');
  const [s2, setS2] = useState(holding.sellTier2Price?.toString() ?? '');
  const [s3, setS3] = useState(holding.sellTier3Price?.toString() ?? '');

  const handleSave = () => {
    const rh = parseFloat(recentHigh) || undefined;
    const h52 = parseFloat(high52w) || undefined;
    const lowBase = parseFloat(low12m) || undefined;
    onSave(holding.id, {
      recentHigh: rh,
      high52w: h52,
      buyTier1Price: rh ? +(rh * 0.85).toFixed(2) : undefined,
      buyTier2Price: rh ? +(rh * 0.75).toFixed(2) : undefined,
      buyTier3Price: rh ? +(rh * 0.65).toFixed(2) : undefined,
      // Sell prices: user can override, or auto-calc from 12-month low
      sellTier1Price: parseFloat(s1) || (lowBase ? +(lowBase * 1.40).toFixed(2) : undefined),
      sellTier2Price: parseFloat(s2) || (lowBase ? +(lowBase * 1.70).toFixed(2) : undefined),
      sellTier3Price: parseFloat(s3) || (lowBase ? +(lowBase * 2.00).toFixed(2) : undefined),
    });
    setEditing(false);
  };

  const cur = holding.currentPrice;
  const budgetUsd = monthlyBudgetCny / EXCHANGE_RATE;
  const sellShares = calcSellShares(holding.shares);
  const buyShares = calcBuyShares(budgetUsd, [holding.buyTier1Price, holding.buyTier2Price, holding.buyTier3Price]);

  // Condition A: price reached sell target
  const sellConditionA = (price?: number) => {
    if (!price || !cur) return false;
    return cur >= price;
  };

  const buyNodes = [
    { price: holding.buyTier1Price, done: false },
    { price: holding.buyTier2Price, done: false },
    { price: holding.buyTier3Price, done: false },
  ];
  const nextBuyTarget = findNextBuyTarget(cur, buyNodes);

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

          {/* Buy nodes */}
          <div className="text-[10px] font-mono text-primary">📉 三档买入节点</div>
          <div className="text-[10px] text-muted-foreground/60 -mt-1">基于个股52周收盘高点回撤</div>
          <BuyNodeRow label="第一档 (-15%)" price={holding.buyTier1Price} current={cur} done={false} color="hsl(45,90%,55%)"
            isNextTarget={holding.buyTier1Price === nextBuyTarget}
            sharesInfo={buyShares.tier1 ? `买入 ${buyShares.tier1.shares}股（预计 ¥${Math.round(buyShares.tier1.cost * EXCHANGE_RATE)}）` : undefined} />
          <BuyNodeRow label="第二档 (-25%)" price={holding.buyTier2Price} current={cur} done={false} color="hsl(30,90%,55%)"
            isNextTarget={holding.buyTier2Price === nextBuyTarget}
            sharesInfo={buyShares.tier2 ? `买入 ${buyShares.tier2.shares}股（预计 ¥${Math.round(buyShares.tier2.cost * EXCHANGE_RATE)}）` : undefined} />
          <BuyNodeRow label="第三档 (-35%)" price={holding.buyTier3Price} current={cur} done={false} color="hsl(0,70%,50%)"
            isNextTarget={holding.buyTier3Price === nextBuyTarget}
            sharesInfo={buyShares.tier3 ? `买入 ${buyShares.tier3.shares}股（预计 ¥${Math.round(buyShares.tier3.cost * EXCHANGE_RATE)}）` : undefined} />

          {/* Sell nodes - dual condition */}
          <div className="text-[10px] font-mono text-profit mt-2">📈 三步减仓节点（双条件触发）</div>
          <SellNodeRow label="第一步 (+40%)" triggerPrice={holding.sellTier1Price} current={cur}
            done={holding.sellTier1Done} color="hsl(142,70%,45%)"
            conditionAMet={sellConditionA(holding.sellTier1Price)}
            conditionBMet={marketTemp.anyMet}
            marketTemp={marketTemp}
            sharesInfo={`卖出 ${sellShares.step1}股`} />
          <SellNodeRow label="第二步 (+70%)" triggerPrice={holding.sellTier2Price} current={cur}
            done={holding.sellTier2Done} color="hsl(142,70%,55%)"
            conditionAMet={sellConditionA(holding.sellTier2Price)}
            conditionBMet={marketTemp.anyMet}
            marketTemp={marketTemp}
            sharesInfo={`卖出 ${sellShares.step2}股`} />
          <SellNodeRow label="第三步 (+100%)" triggerPrice={holding.sellTier3Price} current={cur}
            done={holding.sellTier3Done} color="hsl(142,70%,65%)"
            conditionAMet={sellConditionA(holding.sellTier3Price)}
            conditionBMet={marketTemp.anyMet}
            marketTemp={marketTemp}
            sharesInfo={`卖出 ${sellShares.step3}股`} />
          <div className="flex items-center gap-2 py-1 px-2 text-[10px] font-mono text-muted-foreground bg-secondary/20 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            底仓保留 {sellShares.base}股
          </div>

          {/* Edit section */}
          <div className="pt-2 border-t border-border">
            {!editing ? (
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setEditing(true)}>编辑节点</Button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">52周收盘高点</label>
                    <Input value={high52w} onChange={e => setHigh52w(e.target.value)} className="h-7 text-xs" placeholder="52周高点" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">近期高点（算买入节点）</label>
                    <Input value={recentHigh} onChange={e => setRecentHigh(e.target.value)} className="h-7 text-xs" placeholder="高点价格" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">近12个月最低收盘价（算减仓基准）</label>
                  <Input value={low12m} onChange={e => setLow12m(e.target.value)} className="h-7 text-xs" placeholder="12个月低点" />
                </div>
                <div className="text-[10px] text-muted-foreground">减仓价格（基于12个月低点反弹）</div>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={s1} onChange={e => setS1(e.target.value)} className="h-7 text-xs" placeholder="+40%" />
                  <Input value={s2} onChange={e => setS2(e.target.value)} className="h-7 text-xs" placeholder="+70%" />
                  <Input value={s3} onChange={e => setS3(e.target.value)} className="h-7 text-xs" placeholder="+100%" />
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

export function OperationNodes({ store, sentiment }: {
  store: ReturnType<typeof useEvStore>;
  sentiment?: { fearGreed?: number; vix?: number };
}) {
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(DEFAULT_MONTHLY_BUDGET_CNY.toString());
  const monthlyBudgetCny = parseFloat(budgetInput) || DEFAULT_MONTHLY_BUDGET_CNY;

  const marketTemp = getMarketTempStatus(sentiment);

  if (store.holdings.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">请先在「持仓」页面导入数据</div>;
  }

  return (
    <div className="space-y-3">
      {/* Dual-condition explanation */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-mono text-primary font-semibold">
          <Info className="w-3.5 h-3.5" />
          双条件减仓逻辑
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          减仓同时需要<span className="text-foreground font-medium">条件A（价格已涨到位）</span>和
          <span className="text-foreground font-medium">条件B（市场整体过热）</span>都满足才触发，
          避免在牛市中段过早清仓。减仓价格基于近12个月最低收盘价反弹幅度计算。
        </p>
      </div>

      {/* Market temperature status bar */}
      <div className="bg-secondary/30 rounded-xl p-2.5 space-y-1">
        <div className="text-[10px] font-mono text-muted-foreground">📊 当前市场温度（条件B）</div>
        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
          <span className={marketTemp.fearGreedMet ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
            {marketTemp.fearGreedMet ? '✅' : '⏳'} 恐贪指数 {marketTemp.fearGreed ?? 'N/A'} {marketTemp.fearGreedMet ? '> 75' : '≤ 75'}
          </span>
          <span className={marketTemp.vixMet ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
            {marketTemp.vixMet ? '✅' : '⏳'} VIX {marketTemp.vix ?? 'N/A'} {marketTemp.vixMet ? '< 13' : '≥ 13'}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground/60">
          条件B状态：{marketTemp.anyMet ? '✅ 至少一项满足' : '⏳ 均未满足'}（任意一条满足即可）
        </div>
      </div>

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
        <HoldingNodes key={h.id} holding={h} onSave={store.updateHolding} monthlyBudgetCny={monthlyBudgetCny} marketTemp={marketTemp} />
      ))}
    </div>
  );
}
