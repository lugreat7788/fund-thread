import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCloudTradeStore, calcStats } from '@/store/useCloudTradeStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useReviewStore } from '@/store/useReviewStore';
import { StatsBar } from '@/components/StatsBar';
import { TradeForm } from '@/components/TradeForm';
import { TradeCard } from '@/components/TradeCard';
import { IdentitySelector } from '@/components/IdentitySelector';
import { ComparisonView } from '@/components/ComparisonView';
import { TradeNotesPanel } from '@/components/TradeNotesPanel';
import { TradeReviewPanel } from '@/components/TradeReviewPanel';
import { AuthPage } from '@/components/AuthPage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LogOut, Loader2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type Filter = 'all' | 'open' | 'closed';

function Dashboard({ user }: { user: User }) {
  const store = useCloudTradeStore(user);
  const notesStore = useNotesStore(user, store.activeIdentityId);
  const reviewStore = useReviewStore(user, store.activeIdentityId);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  // Auto-create default identity if none exist
  useEffect(() => {
    if (!store.loading && store.identities.length === 0) {
      store.addIdentity({ name: '默认账户', color: '#D4A853' });
    }
  }, [store.loading, store.identities.length]);

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

  if (store.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              <span className="text-primary">Trade</span>Journal
            </h1>
            {store.identities.length > 0 && (
              <IdentitySelector
                identities={store.identities}
                activeId={store.activeIdentityId}
                onSelect={store.setActiveIdentity}
                onAdd={store.addIdentity}
                onDelete={store.deleteIdentity}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ComparisonView identities={store.identities} trades={store.trades} />
            {store.activeIdentityId && <TradeForm identityId={store.activeIdentityId} onAdd={store.addTrade} />}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <TradeNotesPanel
          notes={notesStore.notes}
          loading={notesStore.loading}
          onAdd={notesStore.addNote}
          onUpdate={notesStore.updateNote}
          onDelete={notesStore.deleteNote}
          onParseAttachment={notesStore.parseAttachment}
          identityName={store.activeIdentity?.name}
        />
        <TradeReviewPanel
          reviews={reviewStore.reviews}
          trades={store.activeTrades}
          identityId={store.activeIdentityId}
          identityName={store.activeIdentity?.name}
          loading={reviewStore.loading}
          onAdd={reviewStore.addReview}
          onUpdate={reviewStore.updateReview}
          onDelete={reviewStore.deleteReview}
        />
        <StatsBar trades={store.activeTrades} />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            {([['all', '全部'], ['open', '持仓中'], ['closed', '已平仓']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${filter === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索代码或名称..." className="pl-8 h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredTrades.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3 font-display">📊</div>
              <div className="text-sm">暂无交易记录</div>
              <div className="text-xs mt-1">点击「新建交易」开始记录</div>
            </div>
          ) : (
            filteredTrades.map(trade => (
              <TradeCard key={trade.id} trade={trade} onClose={store.closeTrade} onDelete={store.deleteTrade}
                onAddEvent={store.addEvent} onDeleteEvent={store.deleteEvent} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <AuthPage />;
};

export default Index;
