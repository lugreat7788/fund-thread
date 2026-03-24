import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarPlus } from 'lucide-react';
import type { EventType, ImpactLevel, TradeEvent } from '@/types/trade';
import { EVENT_TYPE_LABELS } from '@/types/trade';

interface Props {
  onAdd: (event: Omit<TradeEvent, 'id'>) => void;
}

export function EventForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'other' as EventType,
    title: '',
    description: '',
    action: '',
    impact: 0 as ImpactLevel,
  });

  const handleSubmit = () => {
    if (!form.title) return;
    onAdd(form);
    setForm({ date: new Date().toISOString().slice(0, 10), type: 'other', title: '', description: '', action: '', impact: 0 });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs"><CalendarPlus className="w-3 h-3" />事件</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader><DialogTitle className="font-display">添加特殊事件</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>日期</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as EventType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>标题</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="事件标题" /></div>
          <div><Label>详情</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div><Label>应对动作</Label><Input value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} placeholder="采取了什么措施" /></div>
          <div>
            <Label>影响程度</Label>
            <Select value={String(form.impact)} onValueChange={v => setForm(f => ({ ...f, impact: Number(v) as ImpactLevel }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">大幅利好</SelectItem>
                <SelectItem value="1">利好</SelectItem>
                <SelectItem value="0">中性</SelectItem>
                <SelectItem value="-1">利空</SelectItem>
                <SelectItem value="-2">大幅利空</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">添加事件</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
