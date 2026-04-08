import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppState, Trade, Identity, TradeEvent, TradeDirection, StrategyTag, EventType, ImpactLevel, Currency, MergedPosition } from '@/types/trade';
import type { User } from '@supabase/supabase-js';
import { safeStorage } from '@/lib/safe-storage';

// ─── Cash reserve tracking via localStorage ───
const CASH_KEY = 'ev-cash-reserve';

export function getEvCash(): number {
  try {
    const raw = safeStorage.getItem(CASH_KEY);
    return raw ? parseFloat(raw) || 0 : 0;
  } catch { return 0; }
}

export function setEvCash(amount: number) {
  safeStorage.setItem(CASH_KEY, amount.toFixed(2));
}

export function addEvCash(amount: number) {
  setEvCash(getEvCash() + amount);
}

export function subtractEvCash(amount: number) {
  setEvCash(Math.max(0, getEvCash() - amount));
}

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

  // Sync a symbol's aggregate position to ev_holdings
  const syncToEvHolding = useCallback(async (symbol: string, name: string) => {
    try {
      const { data: openTrades } = await supabase.from('trades')
        .select('buy_price, shares')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .is('sell_date', null);

      const rows = openTrades ?? [];
      const totalShares = rows.reduce((s: number, t: any) => s + Number(t.shares), 0);
      const totalCost = rows.reduce((s: number, t: any) => s + Number(t.buy_price) * Number(t.shares), 0);
      const avgPrice = totalShares > 0 ? +(totalCost / totalShares).toFixed(4) : 0;

      const { data: existing } = await (supabase as any).from('ev_holdings')
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('is_closed', false)
        .maybeSingle();

      if (totalShares > 0) {
        if (existing) {
          await (supabase as any).from('ev_holdings').update({
            shares: totalShares, avg_price: avgPrice, total_cost: +totalCost.toFixed(2),
            name, is_closed: false, updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await (supabase as any).from('ev_holdings').insert({
            user_id: user.id, symbol, name, asset_type: 'stock',
            shares: totalShares, avg_price: avgPrice, total_cost: +totalCost.toFixed(2),
            status: 'watch',
          });
        }
      } else if (existing) {
        await (supabase as any).from('ev_holdings').update({
          shares: 0, is_closed: true, updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      }
    } catch (e) {
      console.error('syncToEvHolding error:', e);
    }
  }, [user.id]);

  // Bulk sync: recalculate all EV holdings from current trades
  const syncAllToEv = useCallback(async () => {
    const openTrades = trades.filter(t => !t.sellPrice);
    const symbols = new Map<string, string>();
    openTrades.forEach(t => symbols.set(t.symbol, t.name));
    await Promise.all(Array.from(symbols.entries()).map(([sym, name]) => syncToEvHolding(sym, name)));
  }, [trades, syncToEvHolding]);

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
      subtractEvCash(trade.buyPrice * trade.shares);
      syncToEvHolding(trade.symbol, trade.name);
    }
  }, [user.id, syncToEvHolding]);

  const updateTrade = useCallback(async (id: string, updates: Partial<Pick<Trade, 'symbol' | 'name' | 'direction' | 'buyDate' | 'buyPrice' | 'shares' | 'buyReason' | 'strategy' | 'currency'>>) => {
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.symbol !== undefined) dbUpdates.symbol = updates.symbol;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.direction !== undefined) dbUpdates.direction = updates.direction;
    if (updates.buyDate !== undefined) dbUpdates.buy_date = updates.buyDate;
    if (updates.buyPrice !== undefined) dbUpdates.buy_price = updates.buyPrice;
    if (updates.shares !== undefined) dbUpdates.shares = updates.shares;
    if (updates.buyReason !== undefined) dbUpdates.buy_reason = updates.buyReason;
    if (updates.strategy !== undefined) dbUpdates.strategy = updates.strategy;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    await supabase.from('trades').update(dbUpdates).eq('id', id);
    setTrades(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ));
    // Sync if shares, price, or symbol changed
    if (updates.shares !== undefined || updates.buyPrice !== undefined || updates.symbol !== undefined) {
      const trade = trades.find(t => t.id === id);
      if (trade) {
        const sym = updates.symbol ?? trade.symbol;
        const name = updates.name ?? trade.name;
        syncToEvHolding(sym, name);
        // If symbol changed, also sync the old symbol
        if (updates.symbol && updates.symbol !== trade.symbol) {
          syncToEvHolding(trade.symbol, trade.name);
        }
      }
    }
  }, [trades, syncToEvHolding]);

  const closeTrade = useCallback(async (id: string, sellDate: string, sellPrice: number, sellReason: string, sellShares?: number) => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    const qty = sellShares ?? trade.shares;
    const isPartial = qty < trade.shares;

    if (isPartial) {
      // Partial close: reduce original trade shares, create a new closed trade for sold portion
      const remaining = +(trade.shares - qty).toFixed(4);
      await supabase.from('trades').update({ shares: remaining, updated_at: new Date().toISOString() }).eq('id', id);

      const { data } = await supabase.from('trades').insert({
        user_id: user.id, identity_id: trade.identityId, symbol: trade.symbol, name: trade.name,
        direction: trade.direction, buy_date: trade.buyDate, buy_price: trade.buyPrice,
        shares: qty, buy_reason: trade.buyReason, strategy: trade.strategy,
        currency: trade.currency,
        sell_date: sellDate, sell_price: sellPrice, sell_reason: sellReason,
      } as any).select().single();

      setTrades(prev => {
        const updated = prev.map(t =>
          t.id === id ? { ...t, shares: remaining, updatedAt: new Date().toISOString() } : t
        );
        if (data) {
          const closed: Trade = {
            id: data.id, identityId: data.identity_id, symbol: data.symbol, name: data.name,
            direction: data.direction as TradeDirection, buyDate: data.buy_date,
            buyPrice: Number(data.buy_price), shares: Number(data.shares),
            buyReason: data.buy_reason ?? '', strategy: data.strategy as StrategyTag,
            currency: ((data as any).currency as Currency) || 'CNY',
            sellDate: data.sell_date, sellPrice: Number(data.sell_price), sellReason: data.sell_reason,
            events: [], createdAt: data.created_at, updatedAt: data.updated_at,
          };
          updated.push(closed);
        }
        return updated;
      });
      addEvCash(sellPrice * qty);
      syncToEvHolding(trade.symbol, trade.name);
    } else {
      // Full close
      await supabase.from('trades').update({ sell_date: sellDate, sell_price: sellPrice, sell_reason: sellReason }).eq('id', id);
      setTrades(prev => prev.map(t =>
        t.id === id ? { ...t, sellDate, sellPrice, sellReason, updatedAt: new Date().toISOString() } : t
      ));
      addEvCash(sellPrice * trade.shares);
      syncToEvHolding(trade.symbol, trade.name);
    }
  }, [trades, user.id, syncToEvHolding]);

  const deleteTrade = useCallback(async (id: string) => {
    const trade = trades.find(t => t.id === id);
    await supabase.from('trades').delete().eq('id', id);
    setTrades(prev => prev.filter(t => t.id !== id));
    if (trade) syncToEvHolding(trade.symbol, trade.name);
  }, [trades, syncToEvHolding]);

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
    addIdentity, deleteIdentity, addTrade, updateTrade, closeTrade, deleteTrade, addEvent, deleteEvent, syncAllToEv,
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
