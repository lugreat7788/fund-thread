import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuoteItem {
  symbol: string;
  label: string;
  price: number;
  changePercent: number;
  category: string;
}

interface SentimentData {
  fearGreedScore: number;
  sentimentLabel: string;
  sentimentLevel: string;
  cnIndices: QuoteItem[];
  usIndices: QuoteItem[];
  hkGlobalIndices: QuoteItem[];
  macroIndicators: QuoteItem[];
  crypto: QuoteItem[];
  updatedAt: string;
}

// ─── Sentiment colour & config ───
const SENTIMENT_CONFIG: Record<string, { color: string; bg: string; bar: string }> = {
  extreme_fear:  { color: 'text-[hsl(0,80%,55%)]',   bg: 'bg-[hsl(0,60%,15%)]',   bar: 'bg-[hsl(0,80%,55%)]' },
  fear:          { color: 'text-[hsl(20,80%,55%)]',  bg: 'bg-[hsl(20,50%,14%)]',  bar: 'bg-[hsl(20,80%,55%)]' },
  neutral:       { color: 'text-muted-foreground',   bg: 'bg-secondary/40',        bar: 'bg-muted-foreground' },
  greed:         { color: 'text-[hsl(142,70%,45%)]', bg: 'bg-[hsl(142,40%,12%)]', bar: 'bg-[hsl(142,70%,45%)]' },
  extreme_greed: { color: 'text-profit',             bg: 'bg-[hsl(45,50%,12%)]',  bar: 'bg-profit' },
};

const LEVEL_EMOJI: Record<string, string> = {
  extreme_fear: '😱', fear: '😨', neutral: '😐', greed: '😏', extreme_greed: '🤑',
};

// ─── Small quote tile ───
function QuoteTile({ item }: { item: QuoteItem }) {
  const up = item.changePercent > 0;
  const down = item.changePercent < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const changeColor = up ? 'text-profit' : down ? 'text-loss' : 'text-muted-foreground';

  const fmt = (v: number) => {
    if (v >= 10000) return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    if (v >= 1000)  return v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
    if (v >= 100)   return v.toFixed(2);
    return v.toFixed(2);
  };

  return (
    <div className="bg-card rounded-lg px-3 py-2.5 border border-border flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground font-mono truncate">{item.label}</span>
        <Icon className={`w-3 h-3 shrink-0 ${changeColor}`} />
      </div>
      <div className="text-sm font-display font-semibold">{fmt(item.price)}</div>
      <div className={`text-[10px] font-mono font-medium ${changeColor}`}>
        {up ? '+' : ''}{item.changePercent.toFixed(2)}%
      </div>
    </div>
  );
}

// ─── Gauge bar (linear progress-style) ───
function GaugeBar({ score, level }: { score: number; level: string }) {
  const cfg = SENTIMENT_CONFIG[level] ?? SENTIMENT_CONFIG.neutral;
  const zones = [
    { label: '极度恐慌', color: 'bg-[hsl(0,80%,45%)]',   width: 25 },
    { label: '恐慌',     color: 'bg-[hsl(20,80%,50%)]',  width: 20 },
    { label: '中性',     color: 'bg-muted/60',            width: 10 },
    { label: '贪婪',     color: 'bg-[hsl(142,60%,40%)]', width: 20 },
    { label: '极度贪婪', color: 'bg-profit',              width: 25 },
  ];

  return (
    <div className="space-y-1.5">
      {/* Colour-band bar */}
      <div className="relative h-3 rounded-full overflow-hidden flex">
        {zones.map(z => (
          <div key={z.label} className={`${z.color} h-full`} style={{ width: `${z.width}%` }} />
        ))}
        {/* Indicator needle */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-md transition-all duration-700"
          style={{ left: `${Math.min(98, Math.max(2, score))}%` }}
        />
      </div>
      {/* Zone labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground font-mono px-0.5">
        <span>极度恐慌</span><span>恐慌</span><span>中性</span><span>贪婪</span><span>极度贪婪</span>
      </div>
    </div>
  );
}

export function SentimentDashboard() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('market-sentiment');
      if (err) throw err;
      if (!res?.success) throw new Error(res?.error ?? '获取失败');
      setData(res.data);
    } catch (e: any) {
      setError(e?.message ?? '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = () => {
    if (!open) {
      setOpen(true);
      if (!data) load();
    } else {
      setOpen(false);
    }
  };

  const sentimentLevel = data?.sentimentLevel ?? 'neutral';
  const cfg = SENTIMENT_CONFIG[sentimentLevel] ?? SENTIMENT_CONFIG.neutral;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header / toggle ── */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-display font-semibold">市场情绪仪表盘</span>
          {data && (
            <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bg}`}>
              {LEVEL_EMOJI[sentimentLevel]} {data.sentimentLabel} · {data.fearGreedScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <Button
              variant="ghost" size="sm"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={e => { e.stopPropagation(); load(); }}
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {error && (
            <div className="text-xs text-loss bg-loss/10 rounded-lg px-3 py-2">{error}</div>
          )}
          {loading && !data && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 加载市场数据…
            </div>
          )}

          {data && (
            <>
              {/* ── Fear & Greed Score ── */}
              <div className={`rounded-xl p-4 border border-border ${cfg.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">恐惧贪婪指数</div>
                  <div className={`text-[10px] font-mono ${cfg.color}`}>
                    {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                <div className="flex items-end gap-3 mb-4">
                  <div className={`text-5xl font-display font-bold leading-none ${cfg.color}`}>
                    {data.fearGreedScore}
                  </div>
                  <div className="pb-1">
                    <div className={`text-base font-display font-semibold ${cfg.color}`}>
                      {LEVEL_EMOJI[sentimentLevel]} {data.sentimentLabel}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">0 极度恐慌 → 100 极度贪婪</div>
                  </div>
                </div>
                <GaugeBar score={data.fearGreedScore} level={sentimentLevel} />
              </div>

              {/* ── A-share Indices ── */}
              {data.cnIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">A股主要指数</div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.cnIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {/* ── US Indices ── */}
              {data.usIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">美股主要指数</div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.usIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {/* ── HK & Global ── */}
              {data.hkGlobalIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">港股 / 全球</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.hkGlobalIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {/* ── Macro Indicators ── */}
              {data.macroIndicators.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">宏观指标</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.macroIndicators.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {/* ── Crypto ── */}
              {data.crypto.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">加密货币</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.crypto.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {/* ── Score Factor Explanation ── */}
              <section className="bg-secondary/30 rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">指数构成因子</div>
                {[
                  { label: 'VIX 恐慌指数', weight: '40%', desc: '低VIX = 贪婪，高VIX = 恐慌' },
                  { label: '市场动量 (SPY)', weight: '35%', desc: '当日涨跌反映短期情绪' },
                  { label: '避险需求 (黄金)', weight: '25%', desc: '黄金上涨 = 避险情绪升温' },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-foreground/80">{f.label}</span>
                      <span className="text-muted-foreground ml-1.5">{f.desc}</span>
                    </div>
                    <span className="text-primary shrink-0 ml-2">{f.weight}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
