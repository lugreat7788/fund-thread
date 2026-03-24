export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';
export type StrategyTag = 'trend' | 'value' | 'event_driven' | 'arbitrage' | 'speculation' | 'defensive';

export const STRATEGY_LABELS: Record<StrategyTag, string> = {
  trend: '趋势',
  value: '价值',
  event_driven: '事件驱动',
  arbitrage: '套利',
  speculation: '投机',
  defensive: '防御',
};

export type EventType =
  | 'earnings' | 'policy' | 'black_swan' | 'dividend' | 'split'
  | 'merger' | 'insider' | 'analyst' | 'macro' | 'sector'
  | 'technical' | 'sentiment' | 'regulatory' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  earnings: '财报', policy: '政策', black_swan: '黑天鹅', dividend: '分红',
  split: '拆股', merger: '并购', insider: '内部交易', analyst: '分析师',
  macro: '宏观', sector: '行业', technical: '技术面', sentiment: '市场情绪',
  regulatory: '监管', other: '其他',
};

export type ImpactLevel = -2 | -1 | 0 | 1 | 2;
export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  [-2]: '大幅利空', [-1]: '利空', [0]: '中性', [1]: '利好', [2]: '大幅利好',
};
export const IMPACT_COLORS: Record<ImpactLevel, string> = {
  [-2]: 'var(--loss)', [-1]: 'var(--loss-muted)', [0]: 'var(--muted-foreground)',
  [1]: 'var(--profit-muted)', [2]: 'var(--profit)',
};

export interface TradeEvent {
  id: string;
  date: string;
  type: EventType;
  title: string;
  description: string;
  action: string;
  impact: ImpactLevel;
}

export interface Trade {
  id: string;
  identityId: string;
  symbol: string;
  name: string;
  direction: TradeDirection;
  buyDate: string;
  buyPrice: number;
  shares: number;
  buyReason: string;
  strategy: StrategyTag;
  sellDate?: string;
  sellPrice?: number;
  sellReason?: string;
  events: TradeEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Identity {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface AppState {
  identities: Identity[];
  trades: Trade[];
  activeIdentityId: string;
}
