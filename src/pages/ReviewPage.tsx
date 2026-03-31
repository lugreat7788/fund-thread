import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCloudTradeStore } from '@/store/useCloudTradeStore';
import { useReviewStore } from '@/store/useReviewStore';
import { TradeReviewPanel } from '@/components/TradeReviewPanel';
import { AuthPage } from '@/components/AuthPage';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

function ReviewDashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const store = useCloudTradeStore(user);
  const reviewStore = useReviewStore(user, store.activeIdentityId);

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
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
          <h1 className="font-display text-lg font-semibold tracking-tight">
            交易复盘与总结
          </h1>
          {store.activeIdentity && (
            <span className="text-xs text-muted-foreground">— {store.activeIdentity.name}</span>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
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
      </main>
    </div>
  );
}

const ReviewPage = () => {
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

  return user ? <ReviewDashboard user={user} /> : <AuthPage />;
};

export default ReviewPage;
