import { useState, useMemo } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { StatsBar } from '@/components/StatsBar';
import { TradeForm } from '@/components/TradeForm';
import { TradeCard } from '@/components/TradeCard';
import { IdentitySelector } from '@/components/IdentitySelector';
import { ComparisonView } from '@/components/ComparisonView';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type Filter = 'all' | 'open' | 'closed';

const Index = () => {
  const store = useTradeStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filteredTrades = useMemo(() => {
    let trades = store.activeTrades;
    if (filter === 'open') trades = trades.filter(t => !t.sellPrice);
    if (filter === 'closed') trades = trades.filter(t => t.sellPrice != null);
    if (search) {
      const q = search.toLowerCase();
      trades = trades.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }
    return trades;
  }, [store.activeTrades, filter, search]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              <span className="text-primary">Trade</span>Journal
            </h1>
            <IdentitySelector
              identities={store.identities}
              activeId={store.activeIdentityId}
              onSelect={store.setActiveIdentity}
              onAdd={store.addIdentity}
              onDelete={store.deleteIdentity}
            />
          </div>
          <div className="flex items-center gap-2">
            <ComparisonView identities={store.identities} trades={store.trades} />
            <TradeForm identityId={store.activeIdentityId} onAdd={store.addTrade} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <StatsBar trades={store.activeTrades} />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            {([['all', '全部'], ['open', '持仓中'], ['closed', '已平仓']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                  filter === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索代码或名称..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Trade List */}
        <div className="space-y-3">
          {filteredTrades.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3 font-display">📊</div>
              <div className="text-sm">暂无交易记录</div>
              <div className="text-xs mt-1">点击「新建交易」开始记录</div>
            </div>
          ) : (
            filteredTrades.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                onClose={store.closeTrade}
                onDelete={store.deleteTrade}
                onAddEvent={store.addEvent}
                onDeleteEvent={store.deleteEvent}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
