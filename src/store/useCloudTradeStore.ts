import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppState, Trade, Identity, TradeEvent, TradeDirection, StrategyTag, EventType, ImpactLevel, Currency, MergedPosition } from '@/types/trade';
import type { User } from '@supabase/supabase-js';

export function useCloudTradeStore(user: User) {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeIdentityId, setActiveIdentityId] = useState('');
  const [loading, setLoading] = useState(true);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    const [idRes, trRes, evRes] = await Promise.all([
      supabase.from('identities').select('*').order('created_at'),
      supabase.from('trades').select('*').order('created_at', { ascending: false }),
      supabase.from('trade_events').select('*').order('date'),
    ]);

    const ids: Identity[] = (idRes.data ?? []).map(r => ({
      id: r.id, name: r.name, color: r.color, createdAt: r.created_at,
    }));

    const events: TradeEvent[] = (evRes.data ?? []).map(r => ({
      id: r.id, date: r.date, type: r.type as EventType, title: r.title,
      description: r.description ?? '', action: r.action ?? '', impact: r.impact as ImpactLevel,
    }));

    const trs: Trade[] = (trRes.data ?? []).map(r => ({
      id: r.id, identityId: r.identity_id, symbol: r.symbol, name: r.name,
      direction: r.direction as TradeDirection, buyDate: r.buy_date,
      buyPrice: Number(r.buy_price), shares: Number(r.shares),
      buyReason: r.buy_reason ?? '', strategy: r.strategy as StrategyTag,
      sellDate: r.sell_date ?? undefined, sellPrice: r.sell_price != null ? Number(r.sell_price) : undefined,
      sellReason: r.sell_reason ?? undefined,
      currency: ((r as any).currency as Currency) || 'CNY',
      events: events.filter(e => (evRes.data ?? []).find(er => er.id === e.id)?.trade_id === r.id),
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));

    setIdentities(ids);
    setTrades(trs);
    if (ids.length > 0 && !ids.find(i => i.id === activeIdentityId)) {
      setActiveIdentityId(ids[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addIdentity = useCallback(async (identity: { name: string; color: string }) => {
    const { data } = await supabase.from('identities').insert({
      user_id: user.id, name: identity.name, color: identity.color,
    }).select().single();
    if (data) {
      const newId: Identity = { id: data.id, name: data.name, color: data.color, createdAt: data.created_at };
      setIdentities(prev => [...prev, newId]);
      setActiveIdentityId(data.id);
    }
  }, [user.id]);

  const deleteIdentity = useCallback(async (id: string) => {
    await supabase.from('identities').delete().eq('id', id);
    setIdentities(prev => {
      const next = prev.filter(i => i.id !== id);
      if (activeIdentityId === id && next.length > 0) setActiveIdentityId(next[0].id);
      return next;
    });
    setTrades(prev => prev.filter(t => t.identityId !== id));
  }, [activeIdentityId]);

  const addTrade = useCallback(async (trade: Omit<Trade, 'id' | 'events' | 'createdAt' | 'updatedAt'>) => {
    const { data } = await supabase.from('trades').insert({
      user_id: user.id, identity_id: trade.identityId, symbol: trade.symbol, name: trade.name,
      direction: trade.direction, buy_date: trade.buyDate, buy_price: trade.buyPrice,
      shares: trade.shares, buy_reason: trade.buyReason, strategy: trade.strategy,
      currency: trade.currency,
    } as any).select().single();
    if (data) {
      const newTrade: Trade = {
        id: data.id, identityId: data.identity_id, symbol: data.symbol, name: data.name,
        direction: data.direction as TradeDirection, buyDate: data.buy_date,
        buyPrice: Number(data.buy_price), shares: Number(data.shares),
        buyReason: data.buy_reason ?? '', strategy: data.strategy as StrategyTag,
        currency: ((data as any).currency as Currency) || 'CNY',
        events: [], createdAt: data.created_at, updatedAt: data.updated_at,
      };
      setTrades(prev => [newTrade, ...prev]);
    }
  }, [user.id]);

  const closeTrade = useCallback(async (id: string, sellDate: string, sellPrice: number, sellReason: string) => {
    await supabase.from('trades').update({ sell_date: sellDate, sell_price: sellPrice, sell_reason: sellReason }).eq('id', id);
    setTrades(prev => prev.map(t =>
      t.id === id ? { ...t, sellDate, sellPrice, sellReason, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    await supabase.from('trades').delete().eq('id', id);
    setTrades(prev => prev.filter(t => t.id !== id));
  }, []);

  const addEvent = useCallback(async (tradeId: string, event: Omit<TradeEvent, 'id'>) => {
    const { data } = await supabase.from('trade_events').insert({
      user_id: user.id, trade_id: tradeId, date: event.date, type: event.type,
      title: event.title, description: event.description, action: event.action, impact: event.impact,
    }).select().single();
    if (data) {
      const newEvent: TradeEvent = {
        id: data.id, date: data.date, type: data.type as EventType, title: data.title,
        description: data.description ?? '', action: data.action ?? '', impact: data.impact as ImpactLevel,
      };
      setTrades(prev => prev.map(t =>
        t.id === tradeId ? { ...t, events: [...t.events, newEvent] } : t
      ));
    }
  }, [user.id]);

  const deleteEvent = useCallback(async (tradeId: string, eventId: string) => {
    await supabase.from('trade_events').delete().eq('id', eventId);
    setTrades(prev => prev.map(t =>
      t.id === tradeId ? { ...t, events: t.events.filter(e => e.id !== eventId) } : t
    ));
  }, []);

  const activeTrades = trades.filter(t => t.identityId === activeIdentityId);
  const activeIdentity = identities.find(i => i.id === activeIdentityId);

  return {
    identities, trades, activeIdentityId, activeIdentity, activeTrades, loading,
    setActiveIdentity: setActiveIdentityId,
    addIdentity, deleteIdentity, addTrade, closeTrade, deleteTrade, addEvent, deleteEvent,
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

export function mergePositions(trades: Trade[]): MergedPosition[] {
  const openTrades = trades.filter(t => !t.sellPrice);
  const grouped: Record<string, Trade[]> = {};
  openTrades.forEach(t => {
    const key = `${t.symbol}_${t.direction}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  return Object.values(grouped).map(group => {
    const totalShares = group.reduce((s, t) => s + t.shares, 0);
    const totalCost = group.reduce((s, t) => s + t.buyPrice * t.shares, 0);
    return {
      symbol: group[0].symbol,
      name: group[0].name,
      currency: group[0].currency,
      direction: group[0].direction,
      totalShares,
      avgPrice: totalCost / totalShares,
      totalCost,
      trades: group,
    };
  });
}
