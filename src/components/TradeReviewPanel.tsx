import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, ChevronDown, Plus, Trash2, Edit2, Star, BookOpen, Loader2 } from 'lucide-react';
import type { Trade } from '@/types/trade';
import type { TradeReview } from '@/store/useReviewStore';
import { calcPnL } from '@/store/useCloudTradeStore';

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

const PERIOD_LABELS: Record<PeriodType, string> = {
  monthly: '月度', quarterly: '季度', yearly: '年度',
};

interface Props {
  reviews: TradeReview[];
  trades: Trade[];
  identityId: string;
  identityName?: string;
  loading: boolean;
  onAdd: (review: Omit<TradeReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<Pick<TradeReview, 'summary' | 'lessons' | 'goals' | 'rating'>>) => void;
  onDelete: (id: string) => void;
}

function getPeriodOptions(type: PeriodType): { label: string; start: string; end: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const options: { label: string; start: string; end: string }[] = [];

  if (type === 'monthly') {
    for (let i = 0; i < 12; i++) {
      const d = new Date(year, now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const end = new Date(y, m + 1, 0);
      options.push({
        label: `${y}年${m + 1}月`,
        start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        end: `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
      });
    }
  } else if (type === 'quarterly') {
    for (let i = 0; i < 8; i++) {
      const qMonth = now.getMonth() - i * 3;
      const d = new Date(year, qMonth, 1);
      const y = d.getFullYear();
      const q = Math.floor(d.getMonth() / 3);
      const startMonth = q * 3;
      const endDate = new Date(y, startMonth + 3, 0);
      options.push({
        label: `${y}年Q${q + 1}`,
        start: `${y}-${String(startMonth + 1).padStart(2, '0')}-01`,
        end: `${y}-${String(startMonth + 3).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
      });
    }
    // Deduplicate
    const seen = new Set<string>();
    return options.filter(o => { if (seen.has(o.label)) return false; seen.add(o.label); return true; });
  } else {
    for (let i = 0; i < 5; i++) {
      const y = year - i;
      options.push({ label: `${y}年`, start: `${y}-01-01`, end: `${y}-12-31` });
    }
  }
  return options;
}

function calcPeriodStats(trades: Trade[], start: string, end: string) {
  const periodTrades = trades.filter(t => {
    const closed = t.sellDate && t.sellDate >= start && t.sellDate <= end;
    const opened = t.buyDate >= start && t.buyDate <= end;
    return closed || opened;
  });
  const closedInPeriod = periodTrades.filter(t => t.sellDate && t.sellDate >= start && t.sellDate <= end);
  let totalPnL = 0;
  let wins = 0;
  closedInPeriod.forEach(t => {
    const { amount } = calcPnL(t);
    totalPnL += amount;
    if (amount > 0) wins++;
  });
  return {
    tradeCount: periodTrades.length,
    closedCount: closedInPeriod.length,
    totalPnL,
    winRate: closedInPeriod.length > 0 ? (wins / closedInPeriod.length) * 100 : 0,
  };
}

function RatingStars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)}
          className={`p-0 ${onChange ? 'cursor-pointer' : 'cursor-default'}`}>
          <Star className={`w-4 h-4 ${i <= value ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
}

export function TradeReviewPanel({ reviews, trades, identityId, identityName, loading, onAdd, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PeriodType>('monthly');
  const [addDialog, setAddDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const filteredReviews = useMemo(() =>
    reviews.filter(r => r.periodType === activeTab),
    [reviews, activeTab]
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card border border-border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-display font-medium">交易复盘与总结</span>
              <span className="text-xs text-muted-foreground">— {identityName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={e => { e.stopPropagation(); setAddDialog(true); }}>
                <Plus className="w-3 h-3" />撰写总结
              </Button>
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Period tabs */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
              {(['monthly', 'quarterly', 'yearly'] as const).map(type => (
                <button key={type} onClick={() => setActiveTab(type)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                    activeTab === type ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {PERIOD_LABELS[type]}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <div className="text-sm text-muted-foreground">暂无{PERIOD_LABELS[activeTab]}总结</div>
                <div className="text-xs text-muted-foreground mt-1">点击「撰写总结」开始复盘</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map(review => (
                  <ReviewCard key={review.id} review={review} trades={trades}
                    onEdit={() => setEditId(review.id)} onDelete={() => onDelete(review.id)} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>

      {/* Add dialog */}
      {addDialog && (
        <AddReviewDialog
          identityId={identityId}
          trades={trades}
          existingLabels={reviews.map(r => `${r.periodType}:${r.periodLabel}`)}
          onAdd={review => { onAdd(review); setAddDialog(false); }}
          onClose={() => setAddDialog(false)}
        />
      )}

      {/* Edit dialog */}
      {editId && (
        <EditReviewDialog
          review={reviews.find(r => r.id === editId)!}
          onUpdate={(updates) => { onUpdate(editId, updates); setEditId(null); }}
          onClose={() => setEditId(null)}
        />
      )}
    </Collapsible>
  );
}

function ReviewCard({ review, trades, onEdit, onDelete }: {
  review: TradeReview; trades: Trade[]; onEdit: () => void; onDelete: () => void;
}) {
  const stats = calcPeriodStats(trades, review.periodStart, review.periodEnd);

  return (
    <div className="bg-secondary/30 border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{review.periodLabel}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              {PERIOD_LABELS[review.periodType]}
            </span>
            <RatingStars value={review.rating} />
          </div>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground font-mono">
            <span>交易 {stats.tradeCount}笔</span>
            <span>平仓 {stats.closedCount}笔</span>
            <span className={stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}>
              盈亏 {stats.totalPnL >= 0 ? '+' : ''}¥{stats.totalPnL.toFixed(2)}
            </span>
            <span>胜率 {stats.winRate.toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-loss" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {review.summary && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">📝 总结回顾</div>
          <div className="text-sm whitespace-pre-wrap">{review.summary}</div>
        </div>
      )}
      {review.lessons && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">💡 经验教训</div>
          <div className="text-sm whitespace-pre-wrap">{review.lessons}</div>
        </div>
      )}
      {review.goals && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">🎯 下期目标</div>
          <div className="text-sm whitespace-pre-wrap">{review.goals}</div>
        </div>
      )}
    </div>
  );
}

function AddReviewDialog({ identityId, trades, existingLabels, onAdd, onClose }: {
  identityId: string; trades: Trade[];
  existingLabels: string[];
  onAdd: (review: Omit<TradeReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}) {
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [summary, setSummary] = useState('');
  const [lessons, setLessons] = useState('');
  const [goals, setGoals] = useState('');
  const [rating, setRating] = useState(3);

  const periodOptions = useMemo(() => getPeriodOptions(periodType), [periodType]);
  const selectedOption = periodOptions.find(o => o.label === selectedPeriod);

  const stats = useMemo(() => {
    if (!selectedOption) return null;
    return calcPeriodStats(trades, selectedOption.start, selectedOption.end);
  }, [trades, selectedOption]);

  const isDuplicate = selectedPeriod && existingLabels.includes(`${periodType}:${selectedPeriod}`);
  const hasContent = summary || lessons || goals || selectedPeriod;

  const handleClose = () => {
    if (hasContent) {
      if (!window.confirm('已填写的内容将丢失，确定退出吗？')) return;
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedOption || !summary || isDuplicate) return;
    onAdd({
      identityId, periodType, periodLabel: selectedPeriod,
      periodStart: selectedOption.start, periodEnd: selectedOption.end,
      summary, lessons, goals, rating,
    });
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto" onPointerDownOutside={e => { if (hasContent) e.preventDefault(); }} onEscapeKeyDown={e => { if (hasContent) e.preventDefault(); handleClose(); }}>
        <DialogHeader>
          <DialogTitle className="font-display">撰写交易复盘总结</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>周期类型</Label>
              <Select value={periodType} onValueChange={v => { setPeriodType(v as PeriodType); setSelectedPeriod(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>选择周期</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger><SelectValue placeholder="选择..." /></SelectTrigger>
                <SelectContent>
                  {periodOptions.map(o => (
                    <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isDuplicate && (
            <div className="text-xs text-loss bg-loss/10 rounded px-2 py-1">该周期已有总结，请选择其他周期</div>
          )}

          {stats && selectedOption && (
            <div className="bg-secondary/50 rounded-lg p-3 text-xs font-mono grid grid-cols-4 gap-2">
              <div><span className="text-muted-foreground">交易</span><div className="text-sm font-medium">{stats.tradeCount}笔</div></div>
              <div><span className="text-muted-foreground">平仓</span><div className="text-sm font-medium">{stats.closedCount}笔</div></div>
              <div><span className="text-muted-foreground">盈亏</span>
                <div className={`text-sm font-medium ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {stats.totalPnL >= 0 ? '+' : ''}¥{stats.totalPnL.toFixed(0)}
                </div>
              </div>
              <div><span className="text-muted-foreground">胜率</span><div className="text-sm font-medium">{stats.winRate.toFixed(0)}%</div></div>
            </div>
          )}

          <div>
            <Label>自我评分</Label>
            <RatingStars value={rating} onChange={setRating} />
          </div>
          <div>
            <Label>📝 总结回顾</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              placeholder="本期交易整体表现如何？做对了什么？" />
          </div>
          <div>
            <Label>💡 经验教训</Label>
            <Textarea value={lessons} onChange={e => setLessons(e.target.value)} rows={3}
              placeholder="有哪些值得反思的操作？学到了什么？" />
          </div>
          <div>
            <Label>🎯 下期目标</Label>
            <Textarea value={goals} onChange={e => setGoals(e.target.value)} rows={2}
              placeholder="下个周期的操作目标和改进方向" />
          </div>
          <Button onClick={handleSubmit} className="w-full"
            disabled={!selectedPeriod || !summary || !!isDuplicate}>
            保存总结
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditReviewDialog({ review, onUpdate, onClose }: {
  review: TradeReview;
  onUpdate: (updates: Partial<Pick<TradeReview, 'summary' | 'lessons' | 'goals' | 'rating'>>) => void;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState(review.summary);
  const [lessons, setLessons] = useState(review.lessons);
  const [goals, setGoals] = useState(review.goals);
  const [rating, setRating] = useState(review.rating);

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">编辑总结 · {review.periodLabel}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>自我评分</Label>
            <RatingStars value={rating} onChange={setRating} />
          </div>
          <div>
            <Label>📝 总结回顾</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>💡 经验教训</Label>
            <Textarea value={lessons} onChange={e => setLessons(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>🎯 下期目标</Label>
            <Textarea value={goals} onChange={e => setGoals(e.target.value)} rows={2} />
          </div>
          <Button onClick={() => onUpdate({ summary, lessons, goals, rating })} className="w-full">
            更新总结
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
