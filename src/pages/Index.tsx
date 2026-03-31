import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCloudTradeStore, mergePositions } from '@/store/useCloudTradeStore';
import { useNotesStore } from '@/store/useNotesStore';
import { StatsBar } from '@/components/StatsBar';
import { TradeForm } from '@/components/TradeForm';
import { TradeCard } from '@/components/TradeCard';
import { IdentitySelector } from '@/components/IdentitySelector';
import { ComparisonView } from '@/components/ComparisonView';
import { MergedPositionsPanel } from '@/components/MergedPositionsPanel';
import { TradeNotesPanel } from '@/components/TradeNotesPanel';
import { SentimentDashboard } from '@/components/SentimentDashboard';
import { AuthPage } from '@/components/AuthPage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LogOut, Loader2, Bot, Layers, TrendingUp, BookOpen, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import type { User } from '@supabase/supabase-js';

type Filter = 'all' | 'open' | 'closed';

function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const store = useCloudTradeStore(user);
  const notesStore = useNotesStore(user, store.activeIdentityId);
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [showMerged, setShowMerged] = useState(false);

  const mergedPositions = useMemo(() => mergePositions(store.activeTrades), [store.activeTrades]);

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
        <div className="max-w-5xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-display text-xl font-semibold tracking-tight shrink-0">
              <span className="text-primary">Trade</span>Journal
            </h1>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => navigate('/ev')} className="gap-1 px-2 sm:px-3">
                <TrendingUp className="w-4 h-4" /> <span className="hidden sm:inline">EV系统</span>
              </Button>
              <Button variant="ghost" size="sm" disabled={syncing} className="gap-1 px-2 text-muted-foreground"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await store.syncAllToEv();
                    toast({ title: '同步完成', description: '持仓数据已同步到EV模块' });
                  } catch {
                    toast({ title: '同步失败', description: '请稍后重试', variant: 'destructive' });
                  } finally { setSyncing(false); }
                }}>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline text-xs">同步EV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/review')} className="gap-1 px-2 sm:px-3">
                <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">复盘总结</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/ai-assistant')} className="gap-1 px-2 sm:px-3">
                <Bot className="w-4 h-4" /> <span className="hidden sm:inline">策略助手</span>
              </Button>
              <ComparisonView identities={store.identities} trades={store.trades} />
              {store.activeIdentityId && <TradeForm identityId={store.activeIdentityId} onAdd={store.addTrade} />}
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => supabase.auth.signOut()}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
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
        <SentimentDashboard />
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
          <button onClick={() => setShowMerged(!showMerged)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono transition-all border ${showMerged ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            <Layers className="w-3 h-3" /> 合并持仓
          </button>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索代码或名称..." className="pl-8 h-8 text-sm" />
          </div>
        </div>

        {showMerged && mergedPositions.length > 0 && (
          <MergedPositionsPanel positions={mergedPositions} />
        )}

        <div className="space-y-3">
          {filteredTrades.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3 font-display">📊</div>
              <div className="text-sm">暂无交易记录</div>
              <div className="text-xs mt-1">点击「新建交易」开始记录</div>
            </div>
          ) : (
            filteredTrades.map(trade => (
              <TradeCard key={trade.id} trade={trade} onClose={store.closeTrade} onUpdate={store.updateTrade} onDelete={store.deleteTrade}
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
