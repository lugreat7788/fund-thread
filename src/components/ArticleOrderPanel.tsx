import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileText, Image, Loader2, ChevronDown, ChevronUp, Sparkles, X, Check, Ban, Clock, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { PendingOrder, OperationLog, ParsedArticleResult } from '@/types/orders';
import { ACTION_LABELS, ACTION_COLORS, STATUS_LABELS } from '@/types/orders';
import { CURRENCY_SYMBOLS } from '@/types/trade';

interface Props {
  orders: PendingOrder[];
  logs: OperationLog[];
  pendingOrders: PendingOrder[];
  loading: boolean;
  onAddOrders: (items: ParsedArticleResult['orders'], source: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onExecute: (id: string, price: number) => Promise<void>;
  onParseArticle: (content: string, fileName: string, fileType: string) => Promise<ParsedArticleResult>;
  onReload: () => void;
  identityName?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ArticleOrderPanel({
  orders, logs, pendingOrders, loading,
  onAddOrders, onCancel, onExecute, onParseArticle, onReload,
  identityName,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedArticleResult | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'orders' | 'logs'>('orders');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File upload handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error('文件不超过 5MB'); return; }

    setParsing(true);
    try {
      let content: string;
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        content = await fileToBase64(file);
      } else {
        content = await readFileAsText(file);
      }
      const result = await onParseArticle(content, file.name, file.type);
      setParsedResult(result);
      if (result.orders.length > 0) {
        toast.success(`解析出 ${result.orders.length} 个操作节点`);
      } else {
        toast.info('未找到明确的操作节点');
      }
    } catch (err) {
      toast.error('文件解析失败');
      console.error(err);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Text content parse
  const handleParseText = async () => {
    if (!textContent.trim()) return;
    setParsing(true);
    try {
      const result = await onParseArticle(textContent, 'text-input.txt', 'text/plain');
      setParsedResult(result);
      if (result.orders.length > 0) {
        toast.success(`解析出 ${result.orders.length} 个操作节点`);
      } else {
        toast.info('未找到明确的操作节点');
      }
    } catch (err) {
      toast.error('解析失败');
    } finally {
      setParsing(false);
    }
  };

  // Confirm adding parsed orders
  const handleConfirmOrders = async () => {
    if (!parsedResult || parsedResult.orders.length === 0) return;
    try {
      await onAddOrders(parsedResult.orders, parsedResult.summary);
      toast.success('已录入挂单');
      setParsedResult(null);
      setTextContent('');
      setShowUpload(false);
    } catch (err) {
      toast.error('录入失败');
    }
  };

  // Fetch real-time prices for pending orders
  const fetchPrices = useCallback(async () => {
    if (pendingOrders.length === 0) return;
    const symbols = [...new Set(pendingOrders.map(o => o.symbol))];
    const newPrices: Record<string, number> = {};

    for (const sym of symbols) {
      try {
        const { data } = await supabase.functions.invoke('stock-kline', {
          body: { symbol: sym, period: 'daily', count: 1 },
        });
        if (data?.klines?.length > 0) {
          const last = data.klines[data.klines.length - 1];
          newPrices[sym] = last.close;
        }
      } catch {}
    }
    setPrices(newPrices);

    // Auto-execute logic
    for (const order of pendingOrders) {
      const currentPrice = newPrices[order.symbol];
      if (currentPrice == null) continue;

      let shouldExecute = false;
      if (order.action === 'open' || order.action === 'add') {
        // Buy at or below target
        if (order.direction === 'long' && currentPrice <= order.targetPrice) shouldExecute = true;
        if (order.direction === 'short' && currentPrice >= order.targetPrice) shouldExecute = true;
      } else if (order.action === 'reduce' || order.action === 'close') {
        // Sell at or above target
        if (order.direction === 'long' && currentPrice >= order.targetPrice) shouldExecute = true;
        if (order.direction === 'short' && currentPrice <= order.targetPrice) shouldExecute = true;
      }

      if (shouldExecute) {
        await onExecute(order.id, currentPrice);
        toast.success(`${order.name} ${ACTION_LABELS[order.action]}已成交 @ ${currentPrice}`);
      }
    }
  }, [pendingOrders, onExecute]);

  // Monitor toggle
  const toggleMonitor = () => {
    if (monitoring) {
      if (monitorRef.current) clearInterval(monitorRef.current);
      monitorRef.current = null;
      setMonitoring(false);
      toast.info('已停止监控');
    } else {
      fetchPrices();
      monitorRef.current = setInterval(fetchPrices, 30000); // every 30s
      setMonitoring(true);
      toast.success('开始实时监控挂单');
    }
  };

  useEffect(() => {
    return () => { if (monitorRef.current) clearInterval(monitorRef.current); };
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <input ref={fileInputRef} type="file" className="hidden"
        accept="image/*,.txt,.csv,.md,.json,.pdf,.doc,.docx" onChange={handleFileSelect} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 text-left">
          <Upload className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-semibold">文章解析 & 自动挂单</h2>
          {identityName && <span className="text-xs text-muted-foreground">— {identityName}</span>}
          {pendingOrders.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{pendingOrders.length} 待成交</Badge>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            {pendingOrders.length > 0 && (
              <Button variant={monitoring ? 'default' : 'outline'} size="sm" className="gap-1 text-xs" onClick={toggleMonitor}>
                <Activity className={`w-3 h-3 ${monitoring ? 'animate-pulse' : ''}`} />
                {monitoring ? '监控中' : '开始监控'}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowUpload(!showUpload)}>
              <Sparkles className="w-3 h-3" />{showUpload ? '取消' : '解析文章'}
            </Button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Upload area */}
          {showUpload && (
            <div className="bg-secondary/30 rounded-lg p-3 space-y-3 border border-border/50">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
                  <FileText className="w-3.5 h-3.5" /> 上传文件
                </Button>
                <span className="text-xs text-muted-foreground self-center">支持文字、图片、PDF、Word</span>
              </div>
              <Textarea value={textContent} onChange={e => setTextContent(e.target.value)}
                placeholder="或直接粘贴文章内容... 如：600519 在1700元建仓，1800元加仓，1650元止损..." rows={3} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleParseText} disabled={parsing || !textContent.trim()} className="gap-1">
                  {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {parsing ? 'AI 解析中...' : 'AI 解析'}
                </Button>
              </div>

              {/* Parsed result preview */}
              {parsedResult && (
                <div className="bg-background border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> 解析结果 ({parsedResult.orders.length} 个节点)
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setParsedResult(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  {parsedResult.summary && (
                    <p className="text-xs text-muted-foreground">{parsedResult.summary}</p>
                  )}
                  <div className="space-y-1.5">
                    {parsedResult.orders.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-secondary/40 rounded px-2 py-1.5">
                        <span className="font-mono font-semibold">{o.symbol}</span>
                        <span className="text-muted-foreground">{o.name}</span>
                        <span className={ACTION_COLORS[o.action]}>{ACTION_LABELS[o.action]}</span>
                        <span className="font-mono">{CURRENCY_SYMBOLS[o.currency || 'CNY']}{o.target_price}</span>
                        {o.shares > 0 && <span className="text-muted-foreground">{o.shares}股</span>}
                        <span className="text-muted-foreground truncate flex-1">{o.reason}</span>
                      </div>
                    ))}
                  </div>
                  {parsedResult.orders.length > 0 && (
                    <Button size="sm" className="w-full gap-1" onClick={handleConfirmOrders}>
                      <Check className="w-3.5 h-3.5" /> 确认录入挂单
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button onClick={() => setTab('orders')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${tab === 'orders' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              挂单 ({orders.length})
            </button>
            <button onClick={() => setTab('logs')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${tab === 'logs' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              操作记录 ({logs.length})
            </button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onReload}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-xs">加载中...</div>
          ) : tab === 'orders' ? (
            orders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <div className="text-2xl mb-1">📋</div>
                <div className="text-xs">暂无挂单</div>
                <div className="text-xs mt-0.5">上传策略文章，AI 自动解析操作节点</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {orders.map(order => (
                  <OrderItem key={order.id} order={order} currentPrice={prices[order.symbol]}
                    onCancel={onCancel} onExecute={onExecute} />
                ))}
              </div>
            )
          ) : (
            logs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <div className="text-2xl mb-1">📝</div>
                <div className="text-xs">暂无操作记录</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-xs bg-secondary/20 rounded-lg px-3 py-2">
                    <span className="font-mono font-semibold">{log.symbol}</span>
                    <span className="text-muted-foreground">{log.name}</span>
                    <span className={ACTION_COLORS[log.action]}>{ACTION_LABELS[log.action]}</span>
                    <span className="font-mono">{CURRENCY_SYMBOLS[log.currency]}{log.price}</span>
                    {log.shares > 0 && <span className="text-muted-foreground">{log.shares}股</span>}
                    <span className="text-muted-foreground truncate flex-1">{log.note}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function OrderItem({ order, currentPrice, onCancel, onExecute }: {
  order: PendingOrder;
  currentPrice?: number;
  onCancel: (id: string) => Promise<void>;
  onExecute: (id: string, price: number) => Promise<void>;
}) {
  const sym = CURRENCY_SYMBOLS[order.currency];
  const isPending = order.status === 'pending';
  const diff = currentPrice != null ? ((currentPrice - order.targetPrice) / order.targetPrice * 100) : null;

  return (
    <div className={`group flex items-center gap-2 text-xs rounded-lg px-3 py-2 border transition-colors ${
      order.status === 'executed' ? 'border-green-500/20 bg-green-500/5' :
      order.status === 'cancelled' ? 'border-border/50 bg-secondary/10 opacity-60' :
      'border-border/50 bg-secondary/20 hover:bg-secondary/40'
    }`}>
      <span className="font-mono font-semibold">{order.symbol}</span>
      <span className="text-muted-foreground">{order.name}</span>
      <span className={ACTION_COLORS[order.action]}>{ACTION_LABELS[order.action]}</span>
      <span className="font-mono">{sym}{order.targetPrice}</span>

      {currentPrice != null && isPending && (
        <span className="flex items-center gap-0.5 font-mono">
          {diff != null && diff > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
          <span className={diff != null && diff >= 0 ? 'text-green-500' : 'text-red-500'}>{sym}{currentPrice}</span>
          {diff != null && <span className={`text-[10px] ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)</span>}
        </span>
      )}

      {order.status === 'executed' && order.executedPrice != null && (
        <span className="font-mono text-green-500">成交 {sym}{order.executedPrice}</span>
      )}

      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
        order.status === 'pending' ? 'text-yellow-600 border-yellow-500/30' :
        order.status === 'executed' ? 'text-green-600 border-green-500/30' :
        'text-muted-foreground'
      }`}>
        {STATUS_LABELS[order.status]}
      </Badge>

      <span className="text-muted-foreground truncate flex-1">{order.reason}</span>

      {isPending && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onCancel(order.id)} title="取消">
            <Ban className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
