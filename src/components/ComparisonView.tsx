import type { Identity, Trade } from '@/types/trade';
import { calcStats } from '@/store/useTradeStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface Props {
  identities: Identity[];
  trades: Trade[];
}

export function ComparisonView({ identities, trades }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><BarChart3 className="w-4 h-4" />对比</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-xl">身份对比</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {identities.map(identity => {
              const idTrades = trades.filter(t => t.identityId === identity.id);
              const stats = calcStats(idTrades);
              const pnlColor = stats.totalPnL > 0 ? 'text-profit' : stats.totalPnL < 0 ? 'text-loss' : 'text-neutral';
              const openTrades = idTrades.filter(t => !t.sellPrice);

              return (
                <div key={identity.id} className="rounded-lg border border-border p-4" style={{ borderLeftColor: identity.color, borderLeftWidth: 3 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.color }} />
                    <span className="font-display text-lg">{identity.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    <div><span className="text-muted-foreground text-xs">总记录</span><div>{stats.total}</div></div>
                    <div><span className="text-muted-foreground text-xs">持仓中</span><div>{stats.openCount}</div></div>
                    <div><span className="text-muted-foreground text-xs">总盈亏</span><div className={pnlColor}>¥{stats.totalPnL.toFixed(2)}</div></div>
                    <div><span className="text-muted-foreground text-xs">胜率</span><div>{stats.closedCount > 0 ? `${stats.winRate.toFixed(1)}%` : '—'}</div></div>
                  </div>
                  {openTrades.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-1">当前持仓</div>
                      {openTrades.map(t => (
                        <div key={t.id} className="text-xs font-mono flex justify-between py-0.5">
                          <span>{t.symbol} {t.name}</span>
                          <span>¥{t.buyPrice} × {t.shares}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
