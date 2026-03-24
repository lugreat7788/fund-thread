import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

const PERIODS = [
  { value: 'daily', label: '日K' },
  { value: 'weekly', label: '周K' },
  { value: '60min', label: '60分' },
  { value: '30min', label: '30分' },
  { value: '15min', label: '15分' },
];

export function KlineChart({ symbol, name, buyPrice, sellPrice }: Props) {
  const [data, setData] = useState<KlineData[]>([]);
  const [quote, setQuote] = useState<{ price: number; changePercent: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('daily');

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-medium">{symbol} {name}</span>
          {quote && (
            <span className={`font-mono text-sm font-semibold ${quote.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
              ¥{quote.price.toFixed(2)}
              <span className="ml-1 text-xs">
                {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-20 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Candlestick Chart */}
      <CandlestickCanvas data={data} buyPrice={buyPrice} sellPrice={sellPrice} />

      {/* Summary */}
      <div className="flex gap-4 text-xs text-muted-foreground font-mono">
        <span>最高 ¥{Math.max(...data.map(d => d.high)).toFixed(2)}</span>
        <span>最低 ¥{Math.min(...data.map(d => d.low)).toFixed(2)}</span>
        <span>数据量 {data.length}条</span>
      </div>
    </div>
  );
}

function CandlestickCanvas({ data, buyPrice, sellPrice }: {
  data: KlineData[]; buyPrice: number; sellPrice?: number;
}) {
  const width = 640;
  const chartHeight = 160;
  const volHeight = 40;
  const totalHeight = chartHeight + volHeight + 30;
  const padding = { top: 10, right: 60, bottom: 5, left: 5 };
  const chartW = width - padding.left - padding.right;

  const allHigh = Math.max(...data.map(d => d.high), buyPrice, sellPrice ?? 0);
  const allLow = Math.min(...data.map(d => d.low), buyPrice, sellPrice ?? Infinity);
  const priceRange = allHigh - allLow || 1;
  const maxVol = Math.max(...data.map(d => d.volume)) || 1;

  const candleW = Math.max(2, (chartW / data.length) * 0.7);
  const gap = chartW / data.length;

  const yPrice = (p: number) => padding.top + (1 - (p - allLow) / priceRange) * chartHeight;
  const yVol = (v: number) => chartHeight + 20 + (1 - v / maxVol) * volHeight;

  return (
    <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full" style={{ maxHeight: 260 }}>
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
            {/* Wick */}
            <line x1={x} x2={x} y1={yPrice(d.high)} y2={yPrice(d.low)}
              stroke={color} strokeWidth={1} />
            {/* Body */}
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
              fill={isUp ? 'transparent' : color} stroke={color} strokeWidth={1} rx={0.5} />
            {/* Volume */}
            <rect x={x - candleW / 2} y={yVol(d.volume)} width={candleW}
              height={chartHeight + 20 + volHeight - yVol(d.volume)}
              fill={color} fillOpacity={0.3} />
          </g>
        );
      })}

      {/* Buy price line */}
      <line x1={padding.left} x2={width - padding.right}
        y1={yPrice(buyPrice)} y2={yPrice(buyPrice)}
        stroke="var(--primary)" strokeWidth={1} strokeDasharray="4,3" />
      <text x={width - padding.right + 4} y={yPrice(buyPrice) + 3}
        fill="var(--primary)" fontSize={9} fontFamily="monospace" fontWeight="bold">
        买 {buyPrice.toFixed(2)}
      </text>

      {/* Sell price line */}
      {sellPrice != null && (
        <>
          <line x1={padding.left} x2={width - padding.right}
            y1={yPrice(sellPrice)} y2={yPrice(sellPrice)}
            stroke="var(--accent)" strokeWidth={1} strokeDasharray="4,3" />
          <text x={width - padding.right + 4} y={yPrice(sellPrice) + 3}
            fill="var(--accent)" fontSize={9} fontFamily="monospace" fontWeight="bold">
            卖 {sellPrice.toFixed(2)}
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
  );
}
