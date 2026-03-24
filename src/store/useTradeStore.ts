import { useState, useCallback, useEffect } from 'react';
import type { AppState, Trade, Identity, TradeEvent } from '@/types/trade';

const STORAGE_KEY = 'trade-journal-data';

const DEFAULT_IDENTITY: Identity = {
  id: 'default',
  name: '默认账户',
  color: '#D4A853',
  createdAt: new Date().toISOString(),
};

const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { identities: [DEFAULT_IDENTITY], trades: [], activeIdentityId: 'default' };
};

const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export function useTradeStore() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const setActiveIdentity = useCallback((id: string) => {
    setState(s => ({ ...s, activeIdentityId: id }));
  }, []);

  const addIdentity = useCallback((identity: Omit<Identity, 'id' | 'createdAt'>) => {
    const newId: Identity = { ...identity, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setState(s => ({ ...s, identities: [...s.identities, newId], activeIdentityId: newId.id }));
  }, []);

  const deleteIdentity = useCallback((id: string) => {
    setState(s => {
      const identities = s.identities.filter(i => i.id !== id);
      const trades = s.trades.filter(t => t.identityId !== id);
      const activeIdentityId = s.activeIdentityId === id ? (identities[0]?.id ?? '') : s.activeIdentityId;
      return { identities, trades, activeIdentityId };
    });
  }, []);

  const addTrade = useCallback((trade: Omit<Trade, 'id' | 'events' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTrade: Trade = { ...trade, id: crypto.randomUUID(), events: [], createdAt: now, updatedAt: now };
    setState(s => ({ ...s, trades: [newTrade, ...s.trades] }));
  }, []);

  const closeTrade = useCallback((id: string, sellDate: string, sellPrice: number, sellReason: string) => {
    setState(s => ({
      ...s,
      trades: s.trades.map(t =>
        t.id === id ? { ...t, sellDate, sellPrice, sellReason, updatedAt: new Date().toISOString() } : t
      ),
    }));
  }, []);

  const deleteTrade = useCallback((id: string) => {
    setState(s => ({ ...s, trades: s.trades.filter(t => t.id !== id) }));
  }, []);

  const addEvent = useCallback((tradeId: string, event: Omit<TradeEvent, 'id'>) => {
    const newEvent: TradeEvent = { ...event, id: crypto.randomUUID() };
    setState(s => ({
      ...s,
      trades: s.trades.map(t =>
        t.id === tradeId ? { ...t, events: [...t.events, newEvent], updatedAt: new Date().toISOString() } : t
      ),
    }));
  }, []);

  const deleteEvent = useCallback((tradeId: string, eventId: string) => {
    setState(s => ({
      ...s,
      trades: s.trades.map(t =>
        t.id === tradeId ? { ...t, events: t.events.filter(e => e.id !== eventId), updatedAt: new Date().toISOString() } : t
      ),
    }));
  }, []);

  const activeTrades = state.trades.filter(t => t.identityId === state.activeIdentityId);
  const activeIdentity = state.identities.find(i => i.id === state.activeIdentityId);

  return {
    ...state,
    activeIdentity,
    activeTrades,
    setActiveIdentity,
    addIdentity,
    deleteIdentity,
    addTrade,
    closeTrade,
    deleteTrade,
    addEvent,
    deleteEvent,
  };
}

export function calcPnL(trade: Trade) {
  if (trade.sellPrice == null) return { amount: 0, percent: 0, isOpen: true };
  const dir = trade.direction === 'long' ? 1 : -1;
  const amount = dir * (trade.sellPrice - trade.buyPrice) * trade.shares;
  const percent = dir * ((trade.sellPrice - trade.buyPrice) / trade.buyPrice) * 100;
  return { amount, percent, isOpen: false };
}

export function calcStats(trades: Trade[]) {
  const total = trades.length;
  const openTrades = trades.filter(t => !t.sellPrice);
  const closedTrades = trades.filter(t => t.sellPrice != null);
  let totalPnL = 0;
  let wins = 0;
  closedTrades.forEach(t => {
    const { amount } = calcPnL(t);
    totalPnL += amount;
    if (amount > 0) wins++;
  });
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  return { total, openCount: openTrades.length, closedCount: closedTrades.length, totalPnL, winRate };
}
