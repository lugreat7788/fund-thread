import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Activity, Edit2, Check, Clock, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuoteItem {
  symbol: string;
  label: string;
  price: number;
  changePercent: number;
  category: string;
  marketState?: string;
  marketTime?: string;
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
  usMarketState?: string;
  latestDataTime?: string;
  advice?: string[];
  updatedAt: string;
}

// ─── Manual settings ───
interface ManualSettings {
  nasdaqATH: number;
  sp500ATH: number;
  cnnFearGreed: number;
}

const SETTINGS_KEY = 'sentiment-manual-settings';
const DEFAULT_SETTINGS: ManualSettings = { nasdaqATH: 540, sp500ATH: 610, cnnFearGreed: 50 };

function loadSettings(): ManualSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: ManualSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Sentiment levels ───
type SentimentLevel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

const SENTIMENT_CONFIG: Record<SentimentLevel, { color: string; bg: string; label: string; emoji: string; advice: string }> = {
  extreme_fear:  { color: 'text-[hsl(0,80%,55%)]',   bg: 'bg-[hsl(0,60%,15%)]',   label: '极度恐慌', emoji: '😱', advice: '核心仓位加仓机会，关注黄金坑' },
  fear:          { color: 'text-[hsl(20,80%,55%)]',  bg: 'bg-[hsl(20,50%,14%)]',  label: '悲观',     emoji: '😨', advice: '可小幅加仓优质标的，做好风控' },
  neutral:       { color: 'text-muted-foreground',   bg: 'bg-secondary/40',        label: '中性',     emoji: '😐', advice: '维持现有仓位，按纪律操作' },
  greed:         { color: 'text-[hsl(142,70%,45%)]', bg: 'bg-[hsl(142,40%,12%)]', label: '乐观',     emoji: '😏', advice: '注意止盈，逐步兑现浮盈' },
  extreme_greed: { color: 'text-profit',             bg: 'bg-[hsl(45,50%,12%)]',  label: '极度贪婪', emoji: '🤑', advice: '开始分批减仓，最少保留6成底仓' },
};

function vixLabel(vix: number): { text: string; color: string } {
  if (vix < 15) return { text: '极度贪婪', color: 'text-profit' };
  if (vix < 20) return { text: '正常', color: 'text-muted-foreground' };
  if (vix < 30) return { text: '警惕', color: 'text-[hsl(20,80%,55%)]' };
  return { text: '恐慌', color: 'text-[hsl(0,80%,55%)]' };
}

function calcCompositeSentiment(vix: number | undefined, nasdaqDrop: number | undefined, sp500Drop: number | undefined, cnn: number): { score: number; level: SentimentLevel } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  let totalWeight = 0;
  let weighted = 0;

  if (vix != null && vix > 0) {
    const s = clamp((40 - vix) / 30, 0, 1) * 100;
    weighted += s * 0.4;
    totalWeight += 0.4;
  }

  const drops = [nasdaqDrop, sp500Drop].filter((d): d is number => d != null);
  if (drops.length > 0) {
    const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    const s = clamp((avgDrop + 30) / 30, 0, 1) * 100;
    weighted += s * 0.35;
    totalWeight += 0.35;
  }

  weighted += clamp(cnn, 0, 100) * 0.25;
  totalWeight += 0.25;

  const score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 50;

  let level: SentimentLevel;
  if (score <= 20) level = 'extreme_fear';
  else if (score <= 40) level = 'fear';
  else if (score <= 60) level = 'neutral';
  else if (score <= 80) level = 'greed';
  else level = 'extreme_greed';

  return { score, level };
}

// ─── Market state helpers ───
const MARKET_STATE_LABEL: Record<string, { text: string; color: string; dot: string }> = {
  REGULAR:  { text: '交易中',  color: 'text-green-500', dot: 'bg-green-500' },
  PRE:      { text: '盘前',   color: 'text-amber-500', dot: 'bg-amber-500' },
  POST:     { text: '盘后',   color: 'text-amber-500', dot: 'bg-amber-500' },
  PREPRE:   { text: '盘前',   color: 'text-amber-500', dot: 'bg-amber-500' },
  POSTPOST: { text: '盘后',   color: 'text-amber-500', dot: 'bg-amber-500' },
  CLOSED:   { text: '已收盘',  color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

function formatDataTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

// ─── Components ───
function QuoteTile({ item }: { item: QuoteItem }) {
  const up = item.changePercent > 0;
  const down = item.changePercent < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const changeColor = up ? 'text-profit' : down ? 'text-loss' : 'text-muted-foreground';

  const fmt = (v: number) => {
    if (v >= 10000) return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    if (v >= 1000)  return v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
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

function CoreCard({ label, value, sub, subColor, extra }: {
  label: string; value: string; sub: string; subColor?: string; extra?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 flex flex-col gap-1">
      <div className="text-[10px] text-muted-foreground font-mono">{label}</div>
      <div className="text-lg font-display font-bold leading-tight">{value}</div>
      <div className={`text-[10px] font-mono ${subColor ?? 'text-muted-foreground'}`}>{sub}</div>
      {extra}
    </div>
  );
}

function GaugeBar({ score }: { score: number }) {
  const zones = [
    { label: '极度恐慌', color: 'bg-[hsl(0,80%,45%)]',   width: 20 },
    { label: '悲观',     color: 'bg-[hsl(20,80%,50%)]',  width: 20 },
    { label: '中性',     color: 'bg-muted/60',            width: 20 },
    { label: '乐观',     color: 'bg-[hsl(142,60%,40%)]', width: 20 },
    { label: '极度贪婪', color: 'bg-profit',              width: 20 },
  ];

  return (
    <div className="space-y-1.5">
      <div className="relative h-3 rounded-full overflow-hidden flex">
        {zones.map(z => (
          <div key={z.label} className={`${z.color} h-full`} style={{ width: `${z.width}%` }} />
        ))}
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-md transition-all duration-700"
          style={{ left: `${Math.min(98, Math.max(2, score))}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground font-mono px-0.5">
        <span>极度恐慌</span><span>悲观</span><span>中性</span><span>乐观</span><span>极度贪婪</span>
      </div>
    </div>
  );
}

export function SentimentDashboard() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState<ManualSettings>(loadSettings);
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  useEffect(() => { saveSettings(settings); }, [settings]);

  // Auto-load market data on mount
  useEffect(() => { load(); }, [load]);

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

  const nasdaqQuote = data?.usIndices.find(q => q.symbol === 'QQQ');
  const sp500Quote = data?.usIndices.find(q => q.symbol === 'SPY');
  const vixQuote = data?.macroIndicators.find(q => q.symbol === '^VIX');

  const nasdaqDrop = nasdaqQuote && settings.nasdaqATH > 0
    ? ((nasdaqQuote.price - settings.nasdaqATH) / settings.nasdaqATH) * 100 : undefined;
  const sp500Drop = sp500Quote && settings.sp500ATH > 0
    ? ((sp500Quote.price - settings.sp500ATH) / settings.sp500ATH) * 100 : undefined;

  const composite = useMemo(() =>
    calcCompositeSentiment(vixQuote?.price, nasdaqDrop, sp500Drop, settings.cnnFearGreed),
    [vixQuote?.price, nasdaqDrop, sp500Drop, settings.cnnFearGreed],
  );

  const cfg = SENTIMENT_CONFIG[composite.level];
  const vixInfo = vixQuote ? vixLabel(vixQuote.price) : undefined;

  // Market state
  const usState = data?.usMarketState ?? 'CLOSED';
  const stateInfo = MARKET_STATE_LABEL[usState] ?? MARKET_STATE_LABEL.CLOSED;
  const isLive = usState === 'REGULAR';
  const dataTimeStr = formatDataTime(data?.latestDataTime);

  const handleSaveSettings = () => {
    setSettings(tempSettings);
    setEditingSettings(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-display font-semibold">市场情绪仪表盘</span>
          <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bg}`}>
            {cfg.emoji} {cfg.label} · {composite.score}
          </span>
          {data && (
            <span className={`flex items-center gap-1 text-[10px] font-mono ${stateInfo.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stateInfo.dot} ${isLive ? 'animate-pulse' : ''}`} />
              {stateInfo.text}
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

      {/* Body */}
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

          {/* 1. Core Indicator Cards - always show */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CoreCard
              label="纳斯达克 (QQQ)"
              value={nasdaqQuote ? `$${nasdaqQuote.price.toFixed(1)}` : '--'}
              sub={nasdaqDrop != null ? `距高点 ${nasdaqDrop.toFixed(1)}%` : '未设置高点'}
              subColor={nasdaqDrop != null ? (nasdaqDrop < -10 ? 'text-loss' : nasdaqDrop < 0 ? 'text-[hsl(20,80%,55%)]' : 'text-profit') : undefined}
            />
            <CoreCard
              label="标普500 (SPY)"
              value={sp500Quote ? `$${sp500Quote.price.toFixed(1)}` : '--'}
              sub={sp500Drop != null ? `距高点 ${sp500Drop.toFixed(1)}%` : '未设置高点'}
              subColor={sp500Drop != null ? (sp500Drop < -10 ? 'text-loss' : sp500Drop < 0 ? 'text-[hsl(20,80%,55%)]' : 'text-profit') : undefined}
            />
            <CoreCard
              label="VIX 恐慌指数"
              value={vixQuote ? vixQuote.price.toFixed(1) : '--'}
              sub={vixInfo ? vixInfo.text : '--'}
              subColor={vixInfo?.color}
              extra={vixQuote ? (
                <div className="mt-0.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${vixQuote.price < 15 ? 'bg-profit' : vixQuote.price < 20 ? 'bg-muted-foreground' : vixQuote.price < 30 ? 'bg-[hsl(20,80%,55%)]' : 'bg-[hsl(0,80%,55%)]'}`}
                    style={{ width: `${Math.min(100, (vixQuote.price / 50) * 100)}%` }}
                  />
                </div>
              ) : undefined}
            />
            <CoreCard
              label="CNN恐贪指数"
              value={settings.cnnFearGreed.toString()}
              sub={settings.cnnFearGreed <= 25 ? '极度恐慌' : settings.cnnFearGreed <= 45 ? '恐慌' : settings.cnnFearGreed <= 55 ? '中性' : settings.cnnFearGreed <= 75 ? '贪婪' : '极度贪婪'}
              subColor={settings.cnnFearGreed <= 25 ? 'text-[hsl(0,80%,55%)]' : settings.cnnFearGreed <= 45 ? 'text-[hsl(20,80%,55%)]' : settings.cnnFearGreed <= 55 ? 'text-muted-foreground' : settings.cnnFearGreed <= 75 ? 'text-[hsl(142,70%,45%)]' : 'text-profit'}
              extra={<div className="text-[9px] text-muted-foreground">手动录入</div>}
            />
          </div>

          {/* 2. Composite Score + Gauge - always show */}
          <div className={`rounded-xl p-4 border border-border ${cfg.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">综合情绪评估</div>
              <div className={`text-[10px] font-mono ${cfg.color}`}>
                {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '基于手动参数'}
              </div>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <div className={`text-5xl font-display font-bold leading-none ${cfg.color}`}>
                {composite.score}
              </div>
              <div className="pb-1">
                <div className={`text-base font-display font-semibold ${cfg.color}`}>
                  {cfg.emoji} {cfg.label}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">VIX(40%) + 距高点跌幅(35%) + CNN恐贪(25%)</div>
              </div>
            </div>
            <GaugeBar score={composite.score} />
            {/* Quick advice */}
            <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg border ${cfg.bg} border-border`}>
              <span className="text-sm leading-none mt-0.5">💡</span>
              <div>
                <div className="text-[10px] text-muted-foreground font-mono mb-0.5">推荐操作</div>
                <div className={`text-xs font-semibold ${cfg.color}`}>{cfg.advice}</div>
              </div>
            </div>
          </div>

          {/* 3. Detailed Investment Advice - from API */}
          {data?.advice && data.advice.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {isLive ? '实时投资建议' : '基于最新收盘数据的投资建议'}
              </div>
              {data.advice.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono">
                  <span className="text-primary mt-0.5 shrink-0">{tip.startsWith('建议') ? '👉' : tip.startsWith('注意') ? '⚠️' : '📊'}</span>
                  <span className="text-foreground/80">{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* 4. Manual Settings - always show */}
          <div className="bg-secondary/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">手动参数设置</div>
              {!editingSettings ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => { setTempSettings(settings); setEditingSettings(true); }}>
                  <Edit2 className="w-3 h-3" /> 编辑
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-primary" onClick={handleSaveSettings}>
                  <Check className="w-3 h-3" /> 保存
                </Button>
              )}
            </div>
            {editingSettings ? (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground">纳指(QQQ)历史高点</label>
                  <Input className="h-7 text-xs" value={tempSettings.nasdaqATH} onChange={e => setTempSettings(p => ({ ...p, nasdaqATH: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">标普(SPY)历史高点</label>
                  <Input className="h-7 text-xs" value={tempSettings.sp500ATH} onChange={e => setTempSettings(p => ({ ...p, sp500ATH: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">CNN恐贪指数 (0-100)</label>
                  <Input className="h-7 text-xs" value={tempSettings.cnnFearGreed} onChange={e => setTempSettings(p => ({ ...p, cnnFearGreed: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))} />
                </div>
              </div>
            ) : (
              <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
                <span>QQQ高点: ${settings.nasdaqATH}</span>
                <span>SPY高点: ${settings.sp500ATH}</span>
                <span>CNN: {settings.cnnFearGreed}</span>
              </div>
            )}
          </div>

          {/* 5. Market Sections - only when API data available */}
          {data && (
            <>
              {/* Market status bar */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 ${stateInfo.color}`}>
                    {isLive ? <Radio className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    美股{stateInfo.text}
                  </span>
                  {!isLive && (
                    <span className="text-muted-foreground">
                      显示前一交易日收盘数据
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {dataTimeStr && `数据时间: ${dataTimeStr}`}
                </span>
              </div>

              {data.cnIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">A股主要指数</div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.cnIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {data.usIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">美股主要指数</div>
                  <div className="grid grid-cols-3 gap-2">
                    {data.usIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {data.hkGlobalIndices.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">港股 / 全球</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.hkGlobalIndices.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {data.macroIndicators.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">宏观指标</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.macroIndicators.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}

              {data.crypto.length > 0 && (
                <section>
                  <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">加密货币</div>
                  <div className="grid grid-cols-2 gap-2">
                    {data.crypto.map(q => <QuoteTile key={q.symbol} item={q} />)}
                  </div>
                </section>
              )}
            </>
          )}

          {/* 6. Scoring factors - always show */}
          <section className="bg-secondary/30 rounded-xl p-3 space-y-1.5">
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">综合评分因子</div>
            {[
              { label: 'VIX 恐慌指数', weight: '40%', desc: '<15极度贪婪 / 15-20正常 / 20-30警惕 / >30恐慌' },
              { label: '距历史高点跌幅', weight: '35%', desc: '纳指+标普平均跌幅，跌越多越恐慌' },
              { label: 'CNN 恐贪指数', weight: '25%', desc: '0极度恐慌 → 100极度贪婪，手动录入' },
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
        </div>
      )}
    </div>
  );
}
