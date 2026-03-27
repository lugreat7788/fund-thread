import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { PendingOrder, OperationLog, OrderAction, OrderStatus, ParsedArticleResult } from '@/types/orders';
import type { Currency, TradeDirection, StrategyTag } from '@/types/trade';

export function useOrderStore(user: User, identityId: string) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!identityId) return;
    setLoading(true);
    const [ordRes, logRes] = await Promise.all([
      supabase.from('pending_orders').select('*').eq('identity_id', identityId).order('created_at', { ascending: false }),
      supabase.from('operation_logs').select('*').eq('identity_id', identityId).order('created_at', { ascending: false }),
    ]);

    setOrders((ordRes.data ?? []).map((r: any) => ({
      id: r.id, identityId: r.identity_id, symbol: r.symbol, name: r.name,
      direction: r.direction as TradeDirection, action: r.action as OrderAction,
      targetPrice: Number(r.target_price), shares: Number(r.shares),
      currency: (r.currency as Currency) || 'CNY', strategy: (r.strategy as StrategyTag) || 'trend',
      reason: r.reason || '', sourceArticle: r.source_article || '',
      status: r.status as OrderStatus,
      executedAt: r.executed_at || undefined, executedPrice: r.executed_price != null ? Number(r.executed_price) : undefined,
      createdAt: r.created_at,
    })));

    setLogs((logRes.data ?? []).map((r: any) => ({
      id: r.id, identityId: r.identity_id, orderId: r.order_id || undefined,
      symbol: r.symbol, name: r.name, action: r.action as OrderAction,
      price: Number(r.price), shares: Number(r.shares),
      direction: (r.direction as TradeDirection) || 'long',
      currency: (r.currency as Currency) || 'CNY',
      note: r.note || '', createdAt: r.created_at,
    })));
    setLoading(false);
  }, [identityId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addOrders = useCallback(async (items: ParsedArticleResult['orders'], sourceArticle: string) => {
    const inserts = items.map(o => ({
      user_id: user.id, identity_id: identityId,
      symbol: o.symbol, name: o.name, direction: o.direction,
      action: o.action, target_price: o.target_price,
      shares: o.shares || 0, currency: o.currency || 'CNY',
      strategy: o.strategy || 'trend', reason: o.reason,
      source_article: sourceArticle, status: 'pending' as const,
    }));
    const { data } = await supabase.from('pending_orders').insert(inserts).select();
    if (data) await loadData();
  }, [user.id, identityId, loadData]);

  const cancelOrder = useCallback(async (id: string) => {
    await supabase.from('pending_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' as OrderStatus } : o));
  }, []);

  const executeOrder = useCallback(async (orderId: string, executedPrice: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();
    await supabase.from('pending_orders').update({
      status: 'executed', executed_at: now, executed_price: executedPrice, updated_at: now,
    }).eq('id', orderId);

    await supabase.from('operation_logs').insert({
      user_id: user.id, identity_id: identityId, order_id: orderId,
      symbol: order.symbol, name: order.name, action: order.action,
      price: executedPrice, shares: order.shares, direction: order.direction,
      currency: order.currency,
      note: `自动成交: 目标价 ${order.targetPrice}, 成交价 ${executedPrice}`,
    });

    await loadData();
  }, [user.id, identityId, orders, loadData]);

  const parseArticle = useCallback(async (content: string, fileName: string, fileType: string): Promise<ParsedArticleResult> => {
    const { data, error } = await supabase.functions.invoke('parse-trade-article', {
      body: { content, fileName, fileType },
    });
    if (error) throw error;
    return data as ParsedArticleResult;
  }, []);

  const pendingOrders = orders.filter(o => o.status === 'pending');

  return {
    orders, logs, loading, pendingOrders,
    addOrders, cancelOrder, executeOrder, parseArticle, reload: loadData,
  };
}
