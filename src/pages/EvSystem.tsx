import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEvStore } from '@/store/useEvStore';
import { PortfolioDashboard } from '@/components/ev/PortfolioDashboard';
import { OperationNodes } from '@/components/ev/OperationNodes';
import { BuyDecisionFlow } from '@/components/ev/BuyDecisionFlow';
import { DcaPlan } from '@/components/ev/DcaPlan';
import { MonthlyReview } from '@/components/ev/MonthlyReview';
import { ErrorLog } from '@/components/ev/ErrorLog';
import { AuthPage } from '@/components/AuthPage';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Briefcase, Target, ShoppingCart, Wallet, FileText, AlertTriangle, Bell } from 'lucide-react';
import { AlertCenter } from '@/components/ev/AlertCenter';
import type { User } from '@supabase/supabase-js';

const TABS = [
  { key: 'portfolio', label: '持仓', icon: Briefcase },
  { key: 'nodes', label: '节点', icon: Target },
  { key: 'buy', label: '买入', icon: ShoppingCart },
  { key: 'dca', label: '定投', icon: Wallet },
  { key: 'review', label: '复盘', icon: FileText },
  { key: 'errors', label: '错误', icon: AlertTriangle },
] as const;

type TabKey = typeof TABS[number]['key'];

function EvDashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const store = useEvStore(user);
  const [tab, setTab] = useState<TabKey>('portfolio');

  if (store.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="px-1.5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-display text-lg font-semibold">
              <span className="text-primary">EV</span> 投资管理
            </h1>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => supabase.auth.signOut()}>
            退出
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-5xl mx-auto px-3 py-4">
          {tab === 'portfolio' && <PortfolioDashboard store={store} />}
          {tab === 'nodes' && <OperationNodes store={store} />}
          {tab === 'buy' && <BuyDecisionFlow store={store} />}
          {tab === 'dca' && <DcaPlan store={store} />}
          {tab === 'review' && <MonthlyReview store={store} />}
          {tab === 'errors' && <ErrorLog store={store} />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-1 py-1.5 z-50">
        <div className="max-w-5xl mx-auto flex justify-around">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const EvSystem = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  return user ? <EvDashboard user={user} /> : <AuthPage />;
};

export default EvSystem;
