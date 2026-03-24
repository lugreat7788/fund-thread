import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { TradeDirection, StrategyTag } from '@/types/trade';
import { STRATEGY_LABELS } from '@/types/trade';

interface Props {
  identityId: string;
  onAdd: (trade: {
    identityId: string; symbol: string; name: string; direction: TradeDirection;
    buyDate: string; buyPrice: number; shares: number; buyReason: string; strategy: StrategyTag;
  }) => void;
}

export function TradeForm({ identityId, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    symbol: '', name: '', direction: 'long' as TradeDirection,
    buyDate: new Date().toISOString().slice(0, 10), buyPrice: '', shares: '', buyReason: '',
    strategy: 'trend' as StrategyTag,
  });

  const handleSubmit = () => {
    if (!form.symbol || !form.buyPrice || !form.shares) return;
    onAdd({
      identityId, symbol: form.symbol, name: form.name, direction: form.direction,
      buyDate: form.buyDate, buyPrice: Number(form.buyPrice), shares: Number(form.shares),
      buyReason: form.buyReason, strategy: form.strategy,
    });
    setForm({ symbol: '', name: '', direction: 'long', buyDate: new Date().toISOString().slice(0, 10), buyPrice: '', shares: '', buyReason: '', strategy: 'trend' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />新建交易</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader><DialogTitle className="font-display text-xl">新建交易记录</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>股票代码</Label><Input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="600519" /></div>
            <div><Label>股票名称</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="贵州茅台" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>方向</Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v as TradeDirection }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="long">做多</SelectItem><SelectItem value="short">做空</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>策略</Label>
              <Select value={form.strategy} onValueChange={v => setForm(f => ({ ...f, strategy: v as StrategyTag }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STRATEGY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>买入日期</Label><Input type="date" value={form.buyDate} onChange={e => setForm(f => ({ ...f, buyDate: e.target.value }))} /></div>
            <div><Label>买入价格</Label><Input type="number" step="0.01" value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} placeholder="0.00" /></div>
            <div><Label>股数</Label><Input type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} placeholder="100" /></div>
          </div>
          <div><Label>买入理由</Label><Textarea value={form.buyReason} onChange={e => setForm(f => ({ ...f, buyReason: e.target.value }))} placeholder="简述买入逻辑..." rows={3} /></div>
          <Button onClick={handleSubmit} className="w-full">确认建仓</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
