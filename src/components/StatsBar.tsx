import type { Trade } from '@/types/trade';
import { calcStats } from '@/store/useTradeStore';

export function StatsBar({ trades }: { trades: Trade[] }) {
  const { total, openCount, closedCount, totalPnL, winRate } = calcStats(trades);
  const pnlColor = totalPnL > 0 ? 'text-profit' : totalPnL < 0 ? 'text-loss' : 'text-neutral';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: '总记录', value: total },
        { label: '持仓中', value: openCount },
        { label: '已平仓盈亏', value: `¥${totalPnL.toFixed(2)}`, className: pnlColor },
        { label: '胜率', value: closedCount > 0 ? `${winRate.toFixed(1)}%` : '—' },
      ].map(item => (
        <div key={item.label} className="bg-card rounded-lg p-4 border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{item.label}</div>
          <div className={`text-xl font-medium font-mono ${item.className ?? 'text-foreground'}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
