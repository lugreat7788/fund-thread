import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import emailjs from '@emailjs/browser';
import type { EvHolding } from './useEvStore';
import { safeStorage } from '@/lib/safe-storage';

// --- Types ---
export interface AlertSettings {
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  receiverEmail: string;
  nodeAlertEnabled: boolean;
  panicAlertEnabled: boolean;
  earningsAlertEnabled: boolean;
  dcaAlertEnabled: boolean;
  silentStart: number; // hour 0-23
  silentEnd: number;   // hour 0-23
  dcaDay: number;      // day of month
  vixLevel1: number;
  vixLevel2: number;
  vixLevel3: number;
  nasdaqDropTrigger: number;
  fearGreedTrigger: number;
  browserNotifyEnabled: boolean;
}

export interface MarketSentiment {
  vix: number;
  nasdaqDrop: number;
  sp500Drop: number;
  fearGreed: number;
  updatedAt: string;
}

export interface EarningsEvent {
  id: string;
  symbol: string;
  name: string;
  earningsDate: string;
  notes?: string;
  remind7d: boolean;
  remind1d: boolean;
  remind0d: boolean;
}

export interface AlertRecord {
  id: string;
  alertType: string;
  title: string;
  content: string;
  triggerReason?: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
}

// --- Default settings ---
const DEFAULT_SETTINGS: AlertSettings = {
  emailjsServiceId: '', emailjsTemplateId: '', emailjsPublicKey: '', receiverEmail: '',
  nodeAlertEnabled: true, panicAlertEnabled: true, earningsAlertEnabled: true, dcaAlertEnabled: true,
  browserNotifyEnabled: true,
  silentStart: 23, silentEnd: 8, dcaDay: 1,
  vixLevel1: 20, vixLevel2: 25, vixLevel3: 30,
  nasdaqDropTrigger: 15, fearGreedTrigger: 30,
};

const STORAGE_KEY = 'ev_alert_settings';
const SENTIMENT_KEY = 'ev_market_sentiment';
const LAST_CHECK_KEY = 'ev_last_alert_check';

// --- Helpers ---
export function loadSettings(): AlertSettings {
  try {
    const s = safeStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(s: AlertSettings) {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function loadSentiment(): MarketSentiment {
  try {
    const s = safeStorage.getItem(SENTIMENT_KEY);
    return s ? JSON.parse(s) : { vix: 0, nasdaqDrop: 0, sp500Drop: 0, fearGreed: 50, updatedAt: '' };
  } catch { return { vix: 0, nasdaqDrop: 0, sp500Drop: 0, fearGreed: 50, updatedAt: '' }; }
}

export function saveSentiment(s: MarketSentiment) {
  safeStorage.setItem(SENTIMENT_KEY, JSON.stringify(s));
}

function isInSilentPeriod(settings: AlertSettings): boolean {
  const h = new Date().getHours();
  if (settings.silentStart <= settings.silentEnd) {
    return h >= settings.silentStart && h < settings.silentEnd;
  }
  return h >= settings.silentStart || h < settings.silentEnd;
}

function isEmailConfigured(s: AlertSettings): boolean {
  return !!(s.emailjsServiceId && s.emailjsTemplateId && s.emailjsPublicKey && s.receiverEmail);
}

export function getSentimentLevel(sentiment: MarketSentiment, settings: AlertSettings): { level: number; label: string; color: string } {
  const { vix, nasdaqDrop, fearGreed } = sentiment;
  let count3 = 0;
  if (vix > settings.vixLevel3) count3++;
  if (nasdaqDrop > 20) count3++;
  if (fearGreed < 20) count3++;
  if (count3 >= 2) return { level: 3, label: '🔴 黄金坑', color: 'text-red-500' };
  if (vix > settings.vixLevel2 || nasdaqDrop > settings.nasdaqDropTrigger || fearGreed < settings.fearGreedTrigger)
    return { level: 2, label: '🟠 机会', color: 'text-orange-400' };
  if (vix > settings.vixLevel1 || nasdaqDrop > 10)
    return { level: 1, label: '🟡 关注', color: 'text-yellow-400' };
  return { level: 0, label: '🟢 正常', color: 'text-green-400' };
}

// --- Send email helper ---
async function sendEmail(settings: AlertSettings, subject: string, message: string): Promise<boolean> {
  if (!isEmailConfigured(settings) || isInSilentPeriod(settings)) return false;
  try {
    await emailjs.send(settings.emailjsServiceId, settings.emailjsTemplateId, {
      to_email: settings.receiverEmail,
      subject,
      message,
      time: new Date().toLocaleString('zh-CN'),
    }, settings.emailjsPublicKey);
    return true;
  } catch (e) {
    console.error('EmailJS send failed:', e);
    return false;
  }
}

// --- Browser notification helper ---
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body: body.slice(0, 200),
      icon: '/placeholder.svg',
      tag: title, // deduplicate
    });
  } catch (e) {
    console.error('Browser notification failed:', e);
  }
}

// --- Check logic ---
export interface CheckResult {
  alerts: Array<{ type: string; title: string; content: string; reason: string }>;
  checkedAt: string;
}

export async function runAlertCheck(
  userId: string,
  holdings: EvHolding[],
  earnings: EarningsEvent[],
  sentiment: MarketSentiment,
  settings: AlertSettings,
): Promise<CheckResult> {
  const alerts: CheckResult['alerts'] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 1. Node trigger alerts
  if (settings.nodeAlertEnabled) {
    for (const h of holdings) {
      if (!h.currentPrice || h.isClosed) continue;
      const price = h.currentPrice;
      // Buy nodes
      const buyNodes = [
        { label: '买入第一档（-15%）', price: h.buyTier1Price },
        { label: '买入第二档（-25%）', price: h.buyTier2Price },
        { label: '买入第三档（-35%）', price: h.buyTier3Price },
      ];
      for (const node of buyNodes) {
        if (node.price && price <= node.price) {
          alerts.push({
            type: 'node_trigger',
            title: `【节点触发】${h.symbol} 已到达${node.label}`,
            content: `标的：${h.symbol} / ${h.name}\n触发节点：${node.label}\n节点价格：$${node.price}\n当前价格：$${price.toFixed(2)}\n\n——来自你的投资助手`,
            reason: `${h.symbol} 当前价 $${price.toFixed(2)} <= 节点 $${node.price}`,
          });
        }
      }
      // Sell nodes
      const sellNodes = [
        { label: '减仓第一步（+25%）', price: h.sellTier1Price, done: h.sellTier1Done },
        { label: '减仓第二步（+50%）', price: h.sellTier2Price, done: h.sellTier2Done },
        { label: '减仓第三步（+80%）', price: h.sellTier3Price, done: h.sellTier3Done },
      ];
      for (const node of sellNodes) {
        if (node.price && !node.done && price >= node.price) {
          const sellPct = node.label.includes('第一') ? 20 : 30;
          const sellShares = Math.round(h.shares * sellPct / 100 * 10) / 10;
          alerts.push({
            type: 'node_trigger',
            title: `【节点触发】${h.symbol} 已到达${node.label}`,
            content: `标的：${h.symbol} / ${h.name}\n触发节点：${node.label}\n节点价格：$${node.price}\n当前价格：$${price.toFixed(2)}\n建议操作：卖出 ${sellShares} 股\n预计回收：$${(sellShares * price).toFixed(0)}\n\n——来自你的投资助手`,
            reason: `${h.symbol} 当前价 $${price.toFixed(2)} >= 节点 $${node.price}`,
          });
        }
      }
    }
  }

  // 2. Market panic alerts
  if (settings.panicAlertEnabled && sentiment.vix > 0) {
    const level = getSentimentLevel(sentiment, settings);
    if (level.level >= 1) {
      const levelNames = ['', '关注', '机会', '黄金坑'];
      const titles = ['', '【市场关注】市场出现波动', '【市场机会】市场进入调整区', '⚠️【黄金坑预警】市场极度恐慌，加仓机会出现'];
      let content = `当前市场情绪：${levelNames[level.level]}\n\n指标读数：\n· VIX 恐慌指数：${sentiment.vix}${sentiment.vix > settings.vixLevel3 ? '（极度恐慌）' : ''}\n· 纳指跌幅：-${sentiment.nasdaqDrop}%（距历史高点）\n· 恐贪指数：${sentiment.fearGreed}`;
      if (level.level === 3) {
        content += '\n\n历史参考：\n2020年3月 VIX=85，随后一年纳指涨95%\n2022年10月 VIX=34，随后一年纳指涨55%\n这类极端恐慌通常是中长期买入的最佳时机';
      }
      content += '\n\n——来自你的投资助手\n（所有分析仅供参考，不构成投资建议）';
      alerts.push({ type: 'market_panic', title: titles[level.level], content, reason: `情绪等级：${levelNames[level.level]}` });
    }
  }

  // 3. Earnings alerts
  if (settings.earningsAlertEnabled) {
    for (const e of earnings) {
      const eDate = new Date(e.earningsDate);
      const diffDays = Math.round((eDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let label = '';
      if (diffDays === 7 && e.remind7d) label = '7天后';
      else if (diffDays === 1 && e.remind1d) label = '明天';
      else if (diffDays === 0 && e.remind0d) label = '今天';
      if (label) {
        alerts.push({
          type: 'earnings',
          title: `【财报提醒】${e.symbol} ${label}发布财报`,
          content: `标的：${e.symbol} / ${e.name}\n财报时间：${e.earningsDate}（${label}）\n${e.notes ? `\n备注：${e.notes}` : ''}\n\n——来自你的投资助手`,
          reason: `${e.symbol} 财报${label}`,
        });
      }
    }
  }

  // 4. DCA reminder
  if (settings.dcaAlertEnabled && now.getDate() === settings.dcaDay) {
    alerts.push({
      type: 'dca',
      title: '【定投提醒】本月¥1000定投计划',
      content: `本月可用定投金额：¥1,000\n\n请检查各标的买入节点优先级，按 P1→P4 分配资金。\n当前市场情绪：${getSentimentLevel(sentiment, settings).label}\n\n——来自你的投资助手`,
      reason: `每月${settings.dcaDay}号定投提醒`,
    });
  }

  // Save alerts, send emails, and push browser notifications
  const db = (t: string) => supabase.from(t as any);
  for (const a of alerts) {
    const emailSent = await sendEmail(settings, a.title, a.content);
    // Browser notification for node triggers and market panic
    if (settings.browserNotifyEnabled && (a.type === 'node_trigger' || a.type === 'market_panic')) {
      sendBrowserNotification(a.title, a.content);
    }
    await db('ev_alert_history').insert({
      user_id: userId, alert_type: a.type, title: a.title,
      content: a.content, trigger_reason: a.reason, email_sent: emailSent,
    });
  }

  const checkedAt = now.toLocaleString('zh-CN');
  safeStorage.setItem(LAST_CHECK_KEY, checkedAt);
  return { alerts, checkedAt };
}

// --- Hook ---
export function useAlertStore(userId: string) {
  const [settings, setSettingsState] = useState<AlertSettings>(loadSettings);
  const [sentiment, setSentimentState] = useState<MarketSentiment>(loadSentiment);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(safeStorage.getItem(LAST_CHECK_KEY) || '');
  const [lastCheckCount, setLastCheckCount] = useState(0);

  const updateSettings = useCallback((s: AlertSettings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const updateSentiment = useCallback((s: MarketSentiment) => {
    setSentimentState(s);
    saveSentiment(s);
  }, []);

  const db = (t: string) => supabase.from(t as any);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [aRes, eRes] = await Promise.all([
      db('ev_alert_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      db('ev_earnings_calendar').select('*').eq('user_id', userId).order('earnings_date'),
    ]);
    setAlerts((aRes.data ?? []).map((r: any) => ({
      id: r.id, alertType: r.alert_type, title: r.title, content: r.content,
      triggerReason: r.trigger_reason, isRead: r.is_read, emailSent: r.email_sent, createdAt: r.created_at,
    })));
    setEarnings((eRes.data ?? []).map((r: any) => ({
      id: r.id, symbol: r.symbol, name: r.name, earningsDate: r.earnings_date,
      notes: r.notes, remind7d: r.remind_7d, remind1d: r.remind_1d, remind0d: r.remind_0d,
    })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const markRead = useCallback(async (id: string) => {
    await db('ev_alert_history').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  const addEarnings = useCallback(async (e: Omit<EarningsEvent, 'id'>) => {
    const { data } = await db('ev_earnings_calendar').insert({
      user_id: userId, symbol: e.symbol, name: e.name, earnings_date: e.earningsDate,
      notes: e.notes, remind_7d: e.remind7d, remind_1d: e.remind1d, remind_0d: e.remind0d,
    }).select().single();
    if (data) {
      const d = data as any;
      setEarnings(prev => [...prev, { id: d.id, symbol: d.symbol, name: d.name, earningsDate: d.earnings_date, notes: d.notes, remind7d: d.remind_7d, remind1d: d.remind_1d, remind0d: d.remind_0d }]);
    }
  }, [userId]);

  const deleteEarnings = useCallback(async (id: string) => {
    await db('ev_earnings_calendar').delete().eq('id', id);
    setEarnings(prev => prev.filter(e => e.id !== id));
  }, []);

  const doCheck = useCallback(async (holdings: EvHolding[]) => {
    const result = await runAlertCheck(userId, holdings, earnings, sentiment, settings);
    setLastCheck(result.checkedAt);
    setLastCheckCount(result.alerts.length);
    await loadData();
    return result;
  }, [userId, earnings, sentiment, settings, loadData]);

  const sendTestEmail = useCallback(async () => {
    return sendEmail(settings, '【测试】邮件提醒配置成功', '恭喜！你的投资助手邮件提醒已配置成功。\n\n——来自你的投资助手');
  }, [settings]);

  return {
    settings, updateSettings, sentiment, updateSentiment,
    alerts, earnings, loading,
    lastCheck, lastCheckCount,
    markRead, addEarnings, deleteEarnings,
    doCheck, sendTestEmail, reload: loadData,
  };
}
