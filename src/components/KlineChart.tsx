import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TradeEvent, EventType, ImpactLevel } from '@/types/trade';
import { EVENT_TYPE_LABELS, IMPACT_LABELS, IMPACT_COLORS } from '@/types/trade';

interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  symbol: string;
  name: string;
  buyPrice: number;
  sellPrice?: number;
  events?: TradeEvent[];
  onAddEvent?: (event: Omit<TradeEvent, 'id'>) => void;
}

const PERIODS = [
  { value: 'daily', label: '日K' },
  { value: 'weekly', label: '周K' },
  { value: '60min', label: '60分' },
  { value: '30min', label: '30分' },
  { value: '15min', label: '15分' },
];

const IMPACT_MARKER_COLORS: Record<number, string> = {
  [-2]: '#ef4444', [-1]: '#f97316', [0]: '#94a3b8', [1]: '#22c55e', [2]: '#10b981',
};

export function KlineChart({ symbol, name, buyPrice, sellPrice, events = [], onAddEvent }: Props) {
  const [data, setData] = useState<KlineData[]>([]);
  const [quote, setQuote] = useState<{ price: number; changePercent: number } | null>(null);
  const [market, setMarket] = useState<'cn' | 'us'>('cn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('daily');

  const isUS = market === 'us';
  const currency = isUS ? '$' : '¥';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res, error: err } = await supabase.functions.invoke('stock-kline', {
        body: { symbol, period, count: 60 },
      });
      if (err) throw err;
      if (!res.success) throw new Error(res.error);
      setData(res.data || []);
      setQuote(res.quote || null);
      if (res.market) setMarket(res.market);
    } catch (e: any) {
      setError(e.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">正在加载 {name} K线数据...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-loss mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>重试</Button>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-center py-6 text-sm text-muted-foreground">暂无K线数据</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-medium">{symbol} {name}</span>
          {quote && (
            <span className={`font-mono text-sm font-semibold ${quote.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
              {currency}{quote.price.toFixed(2)}
              <span className="ml-1 text-xs">
                {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onAddEvent && (
            <span className="text-xs text-muted-foreground">点击K线添加事件</span>
          )}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CandlestickCanvas data={data} buyPrice={buyPrice} sellPrice={sellPrice}
        events={events} onAddEvent={onAddEvent} currency={currency} />

      <div className="flex gap-4 text-xs text-muted-foreground font-mono">
        <span>最高 {currency}{Math.max(...data.map(d => d.high)).toFixed(2)}</span>
        <span>最低 {currency}{Math.min(...data.map(d => d.low)).toFixed(2)}</span>
        <span>数据量 {data.length}条</span>
        {events.length > 0 && <span>📍 {events.length} 个事件</span>}
      </div>
    </div>
  );
}

function CandlestickCanvas({ data, buyPrice, sellPrice, events, onAddEvent, currency = '¥' }: {
  data: KlineData[]; buyPrice: number; sellPrice?: number;
  events: TradeEvent[]; onAddEvent?: (event: Omit<TradeEvent, 'id'>) => void; currency?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; event: TradeEvent } | null>(null);
  const [addDialog, setAddDialog] = useState<{ date: string; price: number } | null>(null);

  const width = 640;
  const chartHeight = 160;
  const volHeight = 40;
  const markerSpace = 20;
  const totalHeight = chartHeight + volHeight + markerSpace + 30;
  const padding = { top: 10, right: 60, bottom: 5, left: 5 };
  const chartW = width - padding.left - padding.right;

  const allHigh = Math.max(...data.map(d => d.high), buyPrice, sellPrice ?? 0);
  const allLow = Math.min(...data.map(d => d.low), buyPrice, sellPrice ?? Infinity);
  const priceRange = allHigh - allLow || 1;
  const maxVol = Math.max(...data.map(d => d.volume)) || 1;

  const candleW = Math.max(2, (chartW / data.length) * 0.7);
  const gap = chartW / data.length;

  const yPrice = (p: number) => padding.top + (1 - (p - allLow) / priceRange) * chartHeight;
  const volBaseY = chartHeight + markerSpace + 20;
  const yVol = (v: number) => volBaseY + (1 - v / maxVol) * volHeight;

  // Map events to K-line data indices
  const eventMap = new Map<number, TradeEvent[]>();
  events.forEach(ev => {
    // Find closest date match
    let bestIdx = -1;
    let bestDiff = Infinity;
    data.forEach((d, i) => {
      const diff = Math.abs(new Date(d.date).getTime() - new Date(ev.date).getTime());
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    if (bestIdx >= 0) {
      if (!eventMap.has(bestIdx)) eventMap.set(bestIdx, []);
      eventMap.get(bestIdx)!.push(ev);
    }
  });

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onAddEvent || !svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * width;
    const svgY = (e.clientY - rect.top) / rect.height * totalHeight;

    // Only respond to clicks in the chart area
    if (svgX < padding.left || svgX > width - padding.right) return;
    if (svgY < padding.top || svgY > padding.top + chartHeight) return;

    // Find which candle was clicked
    const idx = Math.floor((svgX - padding.left) / gap);
    if (idx < 0 || idx >= data.length) return;

    const clickedData = data[idx];
    const price = allLow + (1 - (svgY - padding.top) / chartHeight) * priceRange;

    setAddDialog({ date: clickedData.date.slice(0, 10), price: Math.round(price * 100) / 100 });
  };

  return (
    <>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${totalHeight}`} className="w-full cursor-crosshair"
        style={{ maxHeight: 280 }} onClick={handleSvgClick}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => {
          const price = allLow + priceRange * (1 - f);
          const y = padding.top + chartHeight * f;
          return (
            <g key={f}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y}
                stroke="currentColor" strokeOpacity={0.07} strokeDasharray="2,3" />
              <text x={width - padding.right + 4} y={y + 3}
                className="fill-muted-foreground" fontSize={9} fontFamily="monospace">
                {price.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Candlesticks */}
        {data.map((d, i) => {
          const x = padding.left + i * gap + gap / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? 'var(--profit)' : 'var(--loss)';
          const bodyTop = yPrice(Math.max(d.open, d.close));
          const bodyBot = yPrice(Math.min(d.open, d.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);

          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yPrice(d.high)} y2={yPrice(d.low)}
                stroke={color} strokeWidth={1} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={isUp ? 'transparent' : color} stroke={color} strokeWidth={1} rx={0.5} />
              <rect x={x - candleW / 2} y={yVol(d.volume)} width={candleW}
                height={volBaseY + volHeight - yVol(d.volume)}
                fill={color} fillOpacity={0.3} />
            </g>
          );
        })}

        {/* Event markers */}
        {Array.from(eventMap.entries()).map(([idx, evts]) => {
          const x = padding.left + idx * gap + gap / 2;
          const d = data[idx];
          const markerY = chartHeight + 8;
          const mainEvent = evts[0];
          const markerColor = IMPACT_MARKER_COLORS[mainEvent.impact] || '#94a3b8';

          return (
            <g key={`evt-${idx}`} className="cursor-pointer"
              onMouseEnter={(e) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    event: mainEvent,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}>
              {/* Vertical line from candle to marker */}
              <line x1={x} x2={x} y1={yPrice(d.low)} y2={markerY}
                stroke={markerColor} strokeWidth={1} strokeDasharray="2,2" strokeOpacity={0.5} />
              {/* Marker dot */}
              <circle cx={x} cy={markerY} r={5} fill={markerColor} stroke="var(--card)"
                strokeWidth={1.5} />
              {/* Count badge if multiple events */}
              {evts.length > 1 && (
                <text x={x} y={markerY + 3} textAnchor="middle" fontSize={7}
                  fill="white" fontWeight="bold" fontFamily="monospace">
                  {evts.length}
                </text>
              )}
              {/* Event type label */}
              <text x={x} y={markerY + 14} textAnchor="middle" fontSize={7}
                fill={markerColor} fontFamily="monospace">
                {EVENT_TYPE_LABELS[mainEvent.type]?.slice(0, 2) || '事'}
              </text>
            </g>
          );
        })}

        {/* Buy price line */}
        <line x1={padding.left} x2={width - padding.right}
          y1={yPrice(buyPrice)} y2={yPrice(buyPrice)}
          stroke="var(--primary)" strokeWidth={1} strokeDasharray="4,3" />
        <text x={width - padding.right + 4} y={yPrice(buyPrice) + 3}
          fill="var(--primary)" fontSize={9} fontFamily="monospace" fontWeight="bold">
          买 {currency}{buyPrice.toFixed(2)}
        </text>

        {/* Sell price line */}
        {sellPrice != null && (
          <>
            <line x1={padding.left} x2={width - padding.right}
              y1={yPrice(sellPrice)} y2={yPrice(sellPrice)}
              stroke="var(--accent)" strokeWidth={1} strokeDasharray="4,3" />
            <text x={width - padding.right + 4} y={yPrice(sellPrice) + 3}
              fill="var(--accent)" fontSize={9} fontFamily="monospace" fontWeight="bold">
              卖 {currency}{sellPrice.toFixed(2)}
            </text>
          </>
        )}

        {/* Date labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0).map((d, i) => {
          const idx = data.indexOf(d);
          const x = padding.left + idx * gap + gap / 2;
          return (
            <text key={i} x={x} y={totalHeight - 2}
              className="fill-muted-foreground" fontSize={8} fontFamily="monospace" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute pointer-events-none bg-card border border-border rounded-md shadow-lg p-2 text-xs z-50"
          style={{ left: tooltip.x + 8, top: tooltip.y - 60 }}>
          <div className="font-medium mb-1">{tooltip.event.title}</div>
          <div className="text-muted-foreground">{tooltip.event.date} · {EVENT_TYPE_LABELS[tooltip.event.type]}</div>
          <div style={{ color: IMPACT_MARKER_COLORS[tooltip.event.impact] }}>
            {IMPACT_LABELS[tooltip.event.impact]}
          </div>
          {tooltip.event.action && (
            <div className="text-muted-foreground mt-1">动作: {tooltip.event.action}</div>
          )}
        </div>
      )}

      {/* Add Event Dialog */}
      {addDialog && onAddEvent && (
        <AddEventFromChart
          defaultDate={addDialog.date}
          defaultPrice={addDialog.price}
          onAdd={(event) => { onAddEvent(event); setAddDialog(null); }}
          onClose={() => setAddDialog(null)}
        />
      )}
    </>
  );
}

function AddEventFromChart({ defaultDate, defaultPrice, onAdd, onClose }: {
  defaultDate: string; defaultPrice: number;
  onAdd: (event: Omit<TradeEvent, 'id'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    date: defaultDate,
    type: 'other' as EventType,
    title: '',
    description: `价位: ¥${defaultPrice.toFixed(2)}`,
    action: '',
    impact: 0 as ImpactLevel,
  });

  const handleSubmit = () => {
    if (!form.title) return;
    onAdd(form);
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            在K线图上添加事件 · {defaultDate}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="text-xs text-muted-foreground font-mono bg-secondary/50 rounded px-2 py-1">
            📍 点击价位: ¥{defaultPrice.toFixed(2)} · 日期: {defaultDate}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>日期</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as EventType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>标题</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="事件标题" autoFocus />
          </div>
          <div>
            <Label>详情</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>应对动作</Label>
            <Input value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              placeholder="采取了什么措施" />
          </div>
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
          <Button type="button" onClick={handleSubmit} className="w-full">添加事件</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
