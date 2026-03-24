import type { Trade, TradeEvent } from '@/types/trade';
import { STRATEGY_LABELS } from '@/types/trade';
import { calcPnL } from '@/store/useCloudTradeStore';
import { ClosePositionDialog } from './ClosePositionDialog';
import { EventForm } from './EventForm';
import { EventTimeline } from './EventTimeline';
import { KlineChart } from './KlineChart';
import { Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Props {
  trade: Trade;
  onClose: (id: string, sellDate: string, sellPrice: number, sellReason: string) => void;
  onDelete: (id: string) => void;
  onAddEvent: (tradeId: string, event: Omit<TradeEvent, 'id'>) => void;
  onDeleteEvent: (tradeId: string, eventId: string) => void;
}

export function TradeCard({ trade, onClose, onDelete, onAddEvent, onDeleteEvent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const { amount, percent, isOpen } = calcPnL(trade);
  const isProfit = amount >= 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {trade.direction === 'long' ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
            <span className="font-mono text-base font-medium">{trade.symbol}</span>
            <span className="text-sm text-muted-foreground">{trade.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {STRATEGY_LABELS[trade.strategy]}
            </span>
            {isOpen ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">持仓中</span>
            ) : (
              <span className={`text-xs px-1.5 py-0.5 rounded ${isProfit ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}`}>已平仓</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span>买入 {trade.buyDate} @ ¥{trade.buyPrice.toFixed(2)} × {trade.shares}股</span>
            {!isOpen && trade.sellDate && (
              <span>卖出 {trade.sellDate} @ ¥{trade.sellPrice?.toFixed(2)}</span>
            )}
          </div>
          {!isOpen && (
            <div className={`font-mono text-sm mt-1 ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}{amount.toFixed(2)} ({isProfit ? '+' : ''}{percent.toFixed(2)}%)
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${showChart ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setShowChart(!showChart)} title="K线图">
            <BarChart3 className="w-3.5 h-3.5" />
          </Button>
          {isOpen && <ClosePositionDialog trade={trade} onClose={onClose} />}
          <EventForm onAdd={e => onAddEvent(trade.id, e)} />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-loss" onClick={() => onDelete(trade.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* K-line Chart */}
      {showChart && (
        <div className="mt-3 pt-3 border-t border-border relative">
          <KlineChart symbol={trade.symbol} name={trade.name} buyPrice={trade.buyPrice}
            sellPrice={trade.sellPrice} events={trade.events}
            onAddEvent={e => onAddEvent(trade.id, e)} />
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {trade.buyReason && (
            <div className="text-xs"><span className="text-muted-foreground">买入理由：</span>{trade.buyReason}</div>
          )}
          {trade.sellReason && (
            <div className="text-xs"><span className="text-muted-foreground">卖出原因：</span>{trade.sellReason}</div>
          )}
          <EventTimeline events={trade.events} onDelete={id => onDeleteEvent(trade.id, id)} />
        </div>
      )}
      {!expanded && trade.events.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">{trade.events.length} 个事件</div>
      )}
    </div>
  );
}
