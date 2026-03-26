import { useState, useEffect } from 'react';
import type { MergedPosition } from '@/types/trade';
import { CURRENCY_SYMBOLS } from '@/types/trade';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuoteData {
  price: number;
  changePercent: number;
}

function MergedPositionRow({ pos }: { pos: MergedPosition & { quote?: QuoteData | null; quoteLoading?: boolean } }) {
  const cs = CURRENCY_SYMBOLS[pos.currency] || '¥';
  const q = pos.quote;

  let unrealizedPnL = 0;
  let unrealizedPct = 0;
  if (q && q.price > 0) {
    const dir = pos.direction === 'long' ? 1 : -1;
    unrealizedPnL = dir * (q.price - pos.avgPrice) * pos.totalShares;
    unrealizedPct = dir * ((q.price - pos.avgPrice) / pos.avgPrice) * 100;
  }

  const isProfit = unrealizedPnL >= 0;

  return (
    <div className="bg-secondary/30 rounded-md px-3 py-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{pos.symbol}</span>
          <span className="text-xs text-muted-foreground">{pos.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            {pos.direction === 'long' ? '多' : '空'}
          </span>
          <span className="text-xs text-muted-foreground">{pos.trades.length}笔</span>
        </div>
        <div className="text-right font-mono text-xs">
          <div>均价 {cs}{pos.avgPrice.toFixed(2)}</div>
          <div className="text-muted-foreground">总{pos.totalShares}股 · 成本 {cs}{pos.totalCost.toFixed(0)}</div>
        </div>
      </div>

      {/* Real-time quote and unrealized PnL */}
      {pos.quoteLoading ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> 获取行情...
        </div>
      ) : q && q.price > 0 ? (
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">现价</span>
            <span className={q.changePercent >= 0 ? 'text-profit' : 'text-loss'}>
              {cs}{q.price.toFixed(2)}
            </span>
            <span className={`${q.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
              ({q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            {isProfit ? <TrendingUp className="w-3 h-3 text-profit" /> : <TrendingDown className="w-3 h-3 text-loss" />}
            <span className={isProfit ? 'text-profit' : 'text-loss'}>
              {isProfit ? '+' : ''}{cs}{unrealizedPnL.toFixed(2)}
            </span>
            <span className={`${isProfit ? 'text-profit' : 'text-loss'}`}>
              ({isProfit ? '+' : ''}{unrealizedPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  positions: MergedPosition[];
}

export function MergedPositionsPanel({ positions }: Props) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData | null>>({});
  const [loading, setLoading] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
    const results: Record<string, QuoteData | null> = {};

    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const pos = positions.find(p => p.symbol === symbol);
          const market = /^[0-9]+$/.test(symbol.trim()) ? 'cn' : 'us';
          const { data } = await supabase.functions.invoke('stock-kline', {
            body: { symbol, period: 'daily', count: 1, market },
          });
          if (data?.success && data.quote) {
            results[symbol] = { price: data.quote.price, changePercent: data.quote.changePercent };
          } else {
            results[symbol] = null;
          }
        } catch {
          results[symbol] = null;
        }
      })
    );

    setQuotes(results);
    setLoading(false);
  };

  useEffect(() => {
    if (positions.length > 0) fetchQuotes();
  }, [positions.map(p => p.symbol).join(',')]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-display font-medium text-foreground">📦 合并持仓视图</div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={fetchQuotes} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> 刷新行情
        </Button>
      </div>
      <div className="grid gap-2">
        {positions.map(m => (
          <MergedPositionRow
            key={`${m.symbol}_${m.direction}`}
            pos={{ ...m, quote: quotes[m.symbol], quoteLoading: loading && !quotes[m.symbol] }}
          />
        ))}
      </div>
    </div>
  );
}
