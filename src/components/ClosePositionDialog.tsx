import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Trade } from '@/types/trade';

interface Props {
  trade: Trade;
  onClose: (id: string, sellDate: string, sellPrice: number, sellReason: string, sellShares: number) => void;
}

export function ClosePositionDialog({ trade, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10));
  const [sellPrice, setSellPrice] = useState('');
  const [sellShares, setSellShares] = useState(trade.shares.toString());
  const [sellReason, setSellReason] = useState('');

  const price = Number(sellPrice);
  const shares = Number(sellShares);
  const dir = trade.direction === 'long' ? 1 : -1;
  const pnl = price > 0 && shares > 0 ? dir * (price - trade.buyPrice) * shares : 0;
  const pnlPct = price > 0 ? dir * ((price - trade.buyPrice) / trade.buyPrice) * 100 : 0;
  const isPartial = shares > 0 && shares < trade.shares;

  const handleSubmit = () => {
    if (!sellPrice || shares <= 0 || shares > trade.shares) return;
    onClose(trade.id, sellDate, price, sellReason, shares);
    setOpen(false);
  };

  const handleOpen = (v: boolean) => {
    if (v) setSellShares(trade.shares.toString());
    setOpen(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
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
          <div>
            <Label>卖出股数</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={trade.shares}
                value={sellShares}
                onChange={e => setSellShares(e.target.value)}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">/ {trade.shares}股</span>
              {shares !== trade.shares && (
                <Button variant="ghost" size="sm" className="text-xs shrink-0 px-2" onClick={() => setSellShares(trade.shares.toString())}>
                  全部
                </Button>
              )}
            </div>
            {isPartial && (
              <div className="text-[10px] text-primary font-mono mt-1">
                部分平仓：卖出 {shares}股，保留 {(trade.shares - shares).toFixed(2)}股
              </div>
            )}
            {shares > trade.shares && (
              <div className="text-[10px] text-loss font-mono mt-1">
                不能超过持仓总数 {trade.shares}股
              </div>
            )}
          </div>
          {price > 0 && shares > 0 && (
            <div className={`rounded-lg p-3 text-center font-mono text-lg ${pnl >= 0 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
            </div>
          )}
          <div><Label>卖出原因</Label><Textarea value={sellReason} onChange={e => setSellReason(e.target.value)} placeholder="为什么卖出..." rows={3} /></div>
          <Button onClick={handleSubmit} disabled={shares <= 0 || shares > trade.shares || !sellPrice} className="w-full">
            {isPartial ? `确认部分平仓（${shares}股）` : '确认平仓（全部）'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
