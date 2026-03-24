export type NoteCategory = 'risk_control' | 'entry_rules' | 'exit_rules' | 'position_sizing' | 'general';

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  risk_control: '风控纪律',
  entry_rules: '加仓节点',
  exit_rules: '卖出规则',
  position_sizing: '仓位管理',
  general: '其他注意事项',
};

export const NOTE_CATEGORY_ICONS: Record<NoteCategory, string> = {
  risk_control: '🛡️',
  entry_rules: '📍',
  exit_rules: '🚪',
  position_sizing: '⚖️',
  general: '📝',
};

export interface TradeNote {
  id: string;
  identityId: string;
  category: NoteCategory;
  content: string;
  priority: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}
