import { useState, useEffect } from 'react';
import type { MergedPosition } from '@/types/trade';
import { CURRENCY_SYMBOLS } from '@/types/trade';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuoteData {
  price: number;
  changePercent: number;
}

interface EvMeta {
  status: string;
  sellTier1Price?: number;
  sellTier2Price?: number;
  sellTier3Price?: number;
  buyTier1Price?: number;
  buyTier2Price?: number;
  buyTier3Price?: number;
  notes?: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  safe: { label: '✅ 安全', cls: 'text-profit' },
  watch: { label: '⚠️ 观察', cls: 'text-yellow-400' },
  warning: { label: '🔴 警告', cls: 'text-loss' },
};

function MergedPositionRow({ pos }: { pos: MergedPosition & { quote?: QuoteData | null; quoteLoading?: boolean; evMeta?: EvMeta | null } }) {
  const cs = CURRENCY_SYMBOLS[pos.currency] || '¥';
  const q = pos.quote;
  const ev = pos.evMeta;

  let unrealizedPnL = 0;
  let unrealizedPct = 0;
  if (q && q.price > 0) {
    const dir = pos.direction === 'long' ? 1 : -1;
    unrealizedPnL = dir * (q.price - pos.avgPrice) * pos.totalShares;
    unrealizedPct = dir * ((q.price - pos.avgPrice) / pos.avgPrice) * 100;
  }

  const isProfit = unrealizedPnL >= 0;
  const statusBadge = ev ? STATUS_BADGE[ev.status] : null;

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
        <div className="flex items-center gap-2">
          {statusBadge && (
            <span className={`text-[10px] font-mono ${statusBadge.cls}`}>{statusBadge.label}</span>
          )}
          <div className="text-right font-mono text-xs">
            <div>均价 {cs}{pos.avgPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>总{pos.totalShares}股 · 成本 {cs}{pos.totalCost.toFixed(0)}</span>
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

      {/* EV tiers info */}
      {ev && (ev.sellTier1Price || ev.buyTier1Price) && (
        <div className="flex items-center gap-1 pt-1 border-t border-border/50 text-[10px] font-mono text-muted-foreground flex-wrap">
          <Target className="w-3 h-3 text-primary shrink-0" />
          {ev.buyTier1Price && <span>买①{cs}{ev.buyTier1Price.toFixed(1)}</span>}
          {ev.buyTier2Price && <span>②{cs}{ev.buyTier2Price.toFixed(1)}</span>}
          {ev.sellTier1Price && <span className="ml-1">卖①{cs}{ev.sellTier1Price.toFixed(1)}</span>}
          {ev.sellTier2Price && <span>②{cs}{ev.sellTier2Price.toFixed(1)}</span>}
        </div>
      )}
    </div>
  );
}

interface Props {
  positions: MergedPosition[];
}

export function MergedPositionsPanel({ positions }: Props) {
  const [quotes, setQuotes] = useState<Record<string, QuoteData | null>>({});
  const [evMetas, setEvMetas] = useState<Record<string, EvMeta | null>>({});
  const [loading, setLoading] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
    const results: Record<string, QuoteData | null> = {};

    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
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

  const fetchEvMetas = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const userId = session.session.user.id;
      const { data } = await (supabase as any).from('ev_holdings')
        .select('symbol, status, sell_tier1_price, sell_tier2_price, sell_tier3_price, buy_tier1_price, buy_tier2_price, buy_tier3_price, notes')
        .eq('user_id', userId)
        .eq('is_closed', false);
      if (data) {
        const metas: Record<string, EvMeta> = {};
        (data as any[]).forEach(h => {
          metas[h.symbol] = {
            status: h.status,
            sellTier1Price: h.sell_tier1_price ? Number(h.sell_tier1_price) : undefined,
            sellTier2Price: h.sell_tier2_price ? Number(h.sell_tier2_price) : undefined,
            sellTier3Price: h.sell_tier3_price ? Number(h.sell_tier3_price) : undefined,
            buyTier1Price: h.buy_tier1_price ? Number(h.buy_tier1_price) : undefined,
            buyTier2Price: h.buy_tier2_price ? Number(h.buy_tier2_price) : undefined,
            buyTier3Price: h.buy_tier3_price ? Number(h.buy_tier3_price) : undefined,
            notes: h.notes,
          };
        });
        setEvMetas(metas);
      }
    } catch (e) {
      console.error('fetchEvMetas error:', e);
    }
  };

  useEffect(() => {
    if (positions.length > 0) {
      fetchQuotes();
      fetchEvMetas();
    }
  }, [positions.map(p => p.symbol).join(',')]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-display font-medium text-foreground">📦 合并持仓视图</div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => { fetchQuotes(); fetchEvMetas(); }} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> 刷新行情
        </Button>
      </div>
      <div className="grid gap-2">
        {positions.map(m => (
          <MergedPositionRow
            key={`${m.symbol}_${m.direction}`}
            pos={{ ...m, quote: quotes[m.symbol], quoteLoading: loading && !quotes[m.symbol], evMeta: evMetas[m.symbol] }}
          />
        ))}
      </div>
    </div>
  );
}
