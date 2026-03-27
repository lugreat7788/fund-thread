import type { Currency, TradeDirection, StrategyTag } from './trade';

export type OrderAction = 'open' | 'add' | 'reduce' | 'close';
export type OrderStatus = 'pending' | 'executed' | 'cancelled';

export const ACTION_LABELS: Record<OrderAction, string> = {
  open: '建仓', add: '加仓', reduce: '减仓', close: '平仓',
};
export const ACTION_COLORS: Record<OrderAction, string> = {
  open: 'text-primary', add: 'text-green-500', reduce: 'text-orange-500', close: 'text-red-500',
};
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待成交', executed: '已成交', cancelled: '已取消',
};

export interface PendingOrder {
  id: string;
  identityId: string;
  symbol: string;
  name: string;
  direction: TradeDirection;
  action: OrderAction;
  targetPrice: number;
  shares: number;
  currency: Currency;
  strategy: StrategyTag;
  reason: string;
  sourceArticle: string;
  status: OrderStatus;
  executedAt?: string;
  executedPrice?: number;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  identityId: string;
  orderId?: string;
  symbol: string;
  name: string;
  action: OrderAction;
  price: number;
  shares: number;
  direction: TradeDirection;
  currency: Currency;
  note: string;
  createdAt: string;
}

export interface ParsedArticleResult {
  orders: {
    symbol: string;
    name: string;
    direction: TradeDirection;
    action: OrderAction;
    target_price: number;
    shares: number;
    currency: Currency;
    strategy: StrategyTag;
    reason: string;
  }[];
  summary: string;
}
