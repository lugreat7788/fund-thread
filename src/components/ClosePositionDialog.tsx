import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Trade } from '@/types/trade';

interface Props {
  trade: Trade;
  onClose: (id: string, sellDate: string, sellPrice: number, sellReason: string) => void;
}

export function ClosePositionDialog({ trade, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10));
  const [sellPrice, setSellPrice] = useState('');
  const [sellReason, setSellReason] = useState('');

  const price = Number(sellPrice);
  const dir = trade.direction === 'long' ? 1 : -1;
  const pnl = price > 0 ? dir * (price - trade.buyPrice) * trade.shares : 0;
  const pnlPct = price > 0 ? dir * ((price - trade.buyPrice) / trade.buyPrice) * 100 : 0;

  const handleSubmit = () => {
    if (!sellPrice) return;
    onClose(trade.id, sellDate, price, sellReason);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">平仓</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader><DialogTitle className="font-display">平仓 — {trade.symbol} {trade.name}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>卖出日期</Label><Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} /></div>
            <div><Label>卖出价格</Label><Input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0.00" /></div>
          </div>
          {price > 0 && (
            <div className={`rounded-lg p-3 text-center font-mono text-lg ${pnl >= 0 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
            </div>
          )}
          <div><Label>卖出原因</Label><Textarea value={sellReason} onChange={e => setSellReason(e.target.value)} placeholder="为什么卖出..." rows={3} /></div>
          <Button onClick={handleSubmit} className="w-full">确认平仓</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
