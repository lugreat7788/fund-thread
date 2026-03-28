import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface EvHolding {
  id: string; symbol: string; name: string; assetType: string;
  avgPrice: number; shares: number; totalCost: number;
  status: 'safe' | 'watch' | 'warning';
  notes?: string; recentHigh?: number;
  buyTier1Price?: number; buyTier2Price?: number; buyTier3Price?: number;
  sellTier1Price?: number; sellTier2Price?: number; sellTier3Price?: number;
  sellTier1Done: boolean; sellTier2Done: boolean; sellTier3Done: boolean;
  isClosed: boolean; disposalPlan?: string;
  currentPrice?: number; changePct?: number;
  createdAt: string; updatedAt: string;
}

export interface EvDecision {
  id: string; holdingId?: string; symbol: string;
  admissionProfitable?: boolean; admissionMoat?: boolean;
  admissionVolume?: boolean; admissionMarketCap?: boolean;
  vetoNoRevenue: boolean; vetoGovContract: boolean; vetoLeveraged: boolean;
  admissionResult?: string;
  currentTier?: number; dropPercent?: number;
  fundamentalEarnings?: boolean; fundamentalGrowth?: boolean;
  fundamentalDeclineReason?: string; fundamentalIndustry?: boolean;
  fundamentalResult?: string;
  buyAmount?: number; buyPrice?: number; buyShares?: number;
  winProbability?: number; expectedGainPct?: number; expectedLossPct?: number;
  evValue?: number;
  executed: boolean; cancelled: boolean; createdAt: string;
}

export interface EvDcaRecord {
  id: string; date: string; symbol: string; name: string;
  amount: number; price: number; shares: number; priority: string;
  createdAt: string;
}

export interface EvMonthlyReview {
  id: string; month: string; violations?: string;
  holdingsStatus?: any; nextMonthPlan?: string; watchlist?: string;
  createdAt: string;
}

export interface EvError {
  id: string; errorType: string; occurredAt: string;
  symbol?: string; lossEstimate?: number; lesson: string;
  isRevoked: boolean; createdAt: string;
}

const db = (table: string) => supabase.from(table as any);

export async function fetchQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const { data } = await supabase.functions.invoke('stock-kline', {
      body: { symbol, period: 'daily', count: 1, market: 'us' },
    });
    if (data?.quote) return { price: data.quote.price, changePct: data.quote.changePercent };
    return null;
  } catch { return null; }
}

export function useEvStore(user: User) {
  const [holdings, setHoldings] = useState<EvHolding[]>([]);
  const [decisions, setDecisions] = useState<EvDecision[]>([]);
  const [dcaRecords, setDcaRecords] = useState<EvDcaRecord[]>([]);
  const [reviews, setReviews] = useState<EvMonthlyReview[]>([]);
  const [errors, setErrors] = useState<EvError[]>([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<Record<string, { price: number; changePct: number }>>({});

  const mapHolding = (r: any): EvHolding => ({
    id: r.id, symbol: r.symbol, name: r.name, assetType: r.asset_type,
    avgPrice: Number(r.avg_price), shares: Number(r.shares), totalCost: Number(r.total_cost),
    status: r.status, notes: r.notes, recentHigh: r.recent_high ? Number(r.recent_high) : undefined,
    buyTier1Price: r.buy_tier1_price ? Number(r.buy_tier1_price) : undefined,
    buyTier2Price: r.buy_tier2_price ? Number(r.buy_tier2_price) : undefined,
    buyTier3Price: r.buy_tier3_price ? Number(r.buy_tier3_price) : undefined,
    sellTier1Price: r.sell_tier1_price ? Number(r.sell_tier1_price) : undefined,
    sellTier2Price: r.sell_tier2_price ? Number(r.sell_tier2_price) : undefined,
    sellTier3Price: r.sell_tier3_price ? Number(r.sell_tier3_price) : undefined,
    sellTier1Done: r.sell_tier1_done, sellTier2Done: r.sell_tier2_done, sellTier3Done: r.sell_tier3_done,
    isClosed: r.is_closed, disposalPlan: r.disposal_plan,
    createdAt: r.created_at, updatedAt: r.updated_at,
  });

  const mapDecision = (r: any): EvDecision => ({
    id: r.id, holdingId: r.holding_id, symbol: r.symbol,
    admissionProfitable: r.admission_profitable, admissionMoat: r.admission_moat,
    admissionVolume: r.admission_volume, admissionMarketCap: r.admission_market_cap,
    vetoNoRevenue: r.veto_no_revenue, vetoGovContract: r.veto_gov_contract, vetoLeveraged: r.veto_leveraged,
    admissionResult: r.admission_result, currentTier: r.current_tier,
    dropPercent: r.drop_percent ? Number(r.drop_percent) : undefined,
    fundamentalEarnings: r.fundamental_earnings, fundamentalGrowth: r.fundamental_growth,
    fundamentalDeclineReason: r.fundamental_decline_reason, fundamentalIndustry: r.fundamental_industry,
    fundamentalResult: r.fundamental_result,
    buyAmount: r.buy_amount ? Number(r.buy_amount) : undefined,
    buyPrice: r.buy_price ? Number(r.buy_price) : undefined,
    buyShares: r.buy_shares ? Number(r.buy_shares) : undefined,
    winProbability: r.win_probability ? Number(r.win_probability) : undefined,
    expectedGainPct: r.expected_gain_pct ? Number(r.expected_gain_pct) : undefined,
    expectedLossPct: r.expected_loss_pct ? Number(r.expected_loss_pct) : undefined,
    evValue: r.ev_value ? Number(r.ev_value) : undefined,
    executed: r.executed, cancelled: r.cancelled, createdAt: r.created_at,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [hRes, dRes, dcaRes, rRes, eRes] = await Promise.all([
      db('ev_holdings').select('*').eq('user_id', user.id).eq('is_closed', false).order('created_at'),
      db('ev_decisions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      db('ev_dca_records').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      db('ev_monthly_reviews').select('*').eq('user_id', user.id).order('month', { ascending: false }),
      db('ev_errors').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setHoldings((hRes.data ?? []).map(mapHolding));
    setDecisions((dRes.data ?? []).map(mapDecision));
    setDcaRecords((dcaRes.data ?? []).map((r: any) => ({
      id: r.id, date: r.date, symbol: r.symbol, name: r.name,
      amount: Number(r.amount), price: Number(r.price), shares: Number(r.shares),
      priority: r.priority, createdAt: r.created_at,
    })));
    setReviews((rRes.data ?? []).map((r: any) => ({
      id: r.id, month: r.month, violations: r.violations,
      holdingsStatus: r.holdings_status, nextMonthPlan: r.next_month_plan,
      watchlist: r.watchlist, createdAt: r.created_at,
    })));
    setErrors((eRes.data ?? []).map((r: any) => ({
      id: r.id, errorType: r.error_type, occurredAt: r.occurred_at,
      symbol: r.symbol, lossEstimate: r.loss_estimate ? Number(r.loss_estimate) : undefined,
      lesson: r.lesson, isRevoked: r.is_revoked, createdAt: r.created_at,
    })));
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch prices for all active holdings
  const refreshPrices = useCallback(async () => {
    const active = holdings.filter(h => !h.isClosed);
    const results: Record<string, { price: number; changePct: number }> = {};
    await Promise.all(active.map(async h => {
      const q = await fetchQuote(h.symbol);
      if (q) results[h.symbol] = q;
    }));
    setPrices(results);
  }, [holdings]);

  useEffect(() => {
    if (holdings.length > 0) refreshPrices();
  }, [holdings.length]);

  // Holdings with real-time prices merged
  const holdingsWithPrices = holdings.map(h => ({
    ...h,
    currentPrice: prices[h.symbol]?.price,
    changePct: prices[h.symbol]?.changePct,
  }));

  // CRUD: Holdings
  const addHolding = useCallback(async (h: Omit<EvHolding, 'id' | 'createdAt' | 'updatedAt' | 'currentPrice' | 'changePct' | 'sellTier1Done' | 'sellTier2Done' | 'sellTier3Done' | 'isClosed'>) => {
    const { data } = await db('ev_holdings').insert({
      user_id: user.id, symbol: h.symbol, name: h.name, asset_type: h.assetType,
      avg_price: h.avgPrice, shares: h.shares, total_cost: h.totalCost, status: h.status,
      notes: h.notes, recent_high: h.recentHigh,
      buy_tier1_price: h.buyTier1Price, buy_tier2_price: h.buyTier2Price, buy_tier3_price: h.buyTier3Price,
      sell_tier1_price: h.sellTier1Price, sell_tier2_price: h.sellTier2Price, sell_tier3_price: h.sellTier3Price,
      disposal_plan: h.disposalPlan,
    }).select().single();
    if (data) setHoldings(prev => [...prev, mapHolding(data as any)]);
    return (data as any)?.id;
  }, [user.id]);

  const updateHolding = useCallback(async (id: string, updates: Record<string, any>) => {
    const dbUp: Record<string, any> = { updated_at: new Date().toISOString() };
    const fieldMap: Record<string, string> = {
      symbol: 'symbol', name: 'name', assetType: 'asset_type', avgPrice: 'avg_price',
      shares: 'shares', totalCost: 'total_cost', status: 'status', notes: 'notes',
      recentHigh: 'recent_high', buyTier1Price: 'buy_tier1_price', buyTier2Price: 'buy_tier2_price',
      buyTier3Price: 'buy_tier3_price', sellTier1Price: 'sell_tier1_price', sellTier2Price: 'sell_tier2_price',
      sellTier3Price: 'sell_tier3_price', sellTier1Done: 'sell_tier1_done', sellTier2Done: 'sell_tier2_done',
      sellTier3Done: 'sell_tier3_done', isClosed: 'is_closed', disposalPlan: 'disposal_plan',
    };
    Object.entries(updates).forEach(([k, v]) => { if (fieldMap[k]) dbUp[fieldMap[k]] = v; });
    await db('ev_holdings').update(dbUp).eq('id', id);
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h));
  }, []);

  const deleteHolding = useCallback(async (id: string) => {
    await db('ev_holdings').update({ is_closed: true }).eq('id', id);
    setHoldings(prev => prev.filter(h => h.id !== id));
  }, []);

  // CRUD: Decisions
  const addDecision = useCallback(async (d: Omit<EvDecision, 'id' | 'createdAt'>) => {
    const { data } = await db('ev_decisions').insert({
      user_id: user.id, holding_id: d.holdingId, symbol: d.symbol,
      admission_profitable: d.admissionProfitable, admission_moat: d.admissionMoat,
      admission_volume: d.admissionVolume, admission_market_cap: d.admissionMarketCap,
      veto_no_revenue: d.vetoNoRevenue, veto_gov_contract: d.vetoGovContract, veto_leveraged: d.vetoLeveraged,
      admission_result: d.admissionResult, current_tier: d.currentTier, drop_percent: d.dropPercent,
      fundamental_earnings: d.fundamentalEarnings, fundamental_growth: d.fundamentalGrowth,
      fundamental_decline_reason: d.fundamentalDeclineReason, fundamental_industry: d.fundamentalIndustry,
      fundamental_result: d.fundamentalResult,
      buy_amount: d.buyAmount, buy_price: d.buyPrice, buy_shares: d.buyShares,
      win_probability: d.winProbability, expected_gain_pct: d.expectedGainPct,
      expected_loss_pct: d.expectedLossPct, ev_value: d.evValue,
      executed: d.executed, cancelled: d.cancelled,
    }).select().single();
    if (data) setDecisions(prev => [mapDecision(data as any), ...prev]);
  }, [user.id]);

  // CRUD: DCA
  const addDcaRecord = useCallback(async (r: Omit<EvDcaRecord, 'id' | 'createdAt'>) => {
    const { data } = await db('ev_dca_records').insert({
      user_id: user.id, date: r.date, symbol: r.symbol, name: r.name,
      amount: r.amount, price: r.price, shares: r.shares, priority: r.priority,
    }).select().single();
    if (data) setDcaRecords(prev => [{
      id: data.id, date: (data as any).date, symbol: (data as any).symbol, name: (data as any).name,
      amount: Number((data as any).amount), price: Number((data as any).price),
      shares: Number(d.shares), priority: d.priority, createdAt: d.created_at,
    }, ...prev]); }
  }, [user.id]);

  // CRUD: Reviews
  const addReview = useCallback(async (r: Omit<EvMonthlyReview, 'id' | 'createdAt'>) => {
    const { data } = await db('ev_monthly_reviews').insert({
      user_id: user.id, month: r.month, violations: r.violations,
      holdings_status: r.holdingsStatus, next_month_plan: r.nextMonthPlan, watchlist: r.watchlist,
    }).select().single();
    if (data) setReviews(prev => [{
      id: data.id, month: (data as any).month, violations: (data as any).violations,
      holdingsStatus: (data as any).holdings_status, nextMonthPlan: (data as any).next_month_plan,
      watchlist: (data as any).watchlist, createdAt: (data as any).created_at,
    }, ...prev]);
  }, [user.id]);

  // CRUD: Errors
  const addError = useCallback(async (e: Omit<EvError, 'id' | 'createdAt' | 'isRevoked'>) => {
    const { data } = await db('ev_errors').insert({
      user_id: user.id, error_type: e.errorType, occurred_at: e.occurredAt,
      symbol: e.symbol, loss_estimate: e.lossEstimate, lesson: e.lesson,
    }).select().single();
    if (data) setErrors(prev => [{
      id: data.id, errorType: (data as any).error_type, occurredAt: (data as any).occurred_at,
      symbol: (data as any).symbol, lossEstimate: (data as any).loss_estimate ? Number((data as any).loss_estimate) : undefined,
      lesson: (data as any).lesson, isRevoked: (data as any).is_revoked, createdAt: (data as any).created_at,
    }, ...prev]);
  }, [user.id]);

  const revokeError = useCallback(async (id: string) => {
    await db('ev_errors').update({ is_revoked: true }).eq('id', id);
    setErrors(prev => prev.map(e => e.id === id ? { ...e, isRevoked: true } : e));
  }, []);

  // Initialize default data
  const initializeDefaults = useCallback(async () => {
    const defaults = [
      { symbol: 'QLD', name: 'ProShares 2倍纳指ETF', assetType: 'leveraged_etf', avgPrice: 67.10, shares: 2, totalCost: 134, status: 'watch' as const, notes: '杠杆品种，需要制定明确的处置计划', recentHigh: 79, disposalPlan: '若反弹至 $65 以上，减仓50%', sellTier1Price: 83.88, sellTier2Price: 100.65, sellTier3Price: 120.78 },
      { symbol: 'NVO', name: '诺和诺德', assetType: 'stock', avgPrice: 37.32, shares: 3.5, totalCost: 131, status: 'watch' as const, notes: '亏损-30%，处于第三档加仓区。待做：GLP-1竞争格局验证', recentHigh: 53, sellTier1Price: 46.65, sellTier2Price: 55.98, sellTier3Price: 67.18 },
      { symbol: 'FIGS', name: 'FIGS Inc 医疗服装', assetType: 'stock', avgPrice: 11.17, shares: 30.6, totalCost: 342, status: 'safe' as const, notes: '盈利持有 +38%，第一步减仓节点已触发', recentHigh: 18, sellTier1Price: 13.96, sellTier2Price: 16.76, sellTier3Price: 20.11 },
    ];
    for (const d of defaults) {
      const high = d.recentHigh;
      await addHolding({
        ...d,
        buyTier1Price: high ? +(high * 0.85).toFixed(2) : undefined,
        buyTier2Price: high ? +(high * 0.75).toFixed(2) : undefined,
        buyTier3Price: high ? +(high * 0.65).toFixed(2) : undefined,
      });
    }
    // Add MNTS error
    await addError({
      errorType: 'banned_asset', occurredAt: '2025-01-01',
      symbol: 'MNTS', lossEstimate: 91, lesson: '准入三条线中任何一条不满足，不买。MNTS无营收、依赖政府合同，亏损-68%',
    });
  }, [addHolding, addError]);

  return {
    holdings: holdingsWithPrices, decisions, dcaRecords, reviews, errors, loading, prices,
    addHolding, updateHolding, deleteHolding,
    addDecision, addDcaRecord, addReview,
    addError, revokeError,
    refreshPrices, initializeDefaults, reload: loadData,
  };
}
