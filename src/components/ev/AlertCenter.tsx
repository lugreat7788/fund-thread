import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Send, Plus, Trash2, Bell, Settings, Calendar, Activity, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAlertStore, getSentimentLevel, requestNotificationPermission, type AlertSettings, type MarketSentiment, type EarningsEvent } from '@/store/useAlertStore';
import type { useEvStore } from '@/store/useEvStore';

export function AlertCenter({ store }: { store: ReturnType<typeof useEvStore> }) {
  const userId = store.holdings.length > 0 ? '' : ''; // We'll get userId from parent
  return <AlertCenterInner store={store} />;
}

function AlertCenterInner({ store }: { store: ReturnType<typeof useEvStore> }) {
  // Get user ID from supabase session
  const [userId, setUserId] = useState('');
  useEffect(() => {
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
    });
  }, []);

  if (!userId) return null;
  return <AlertCenterContent userId={userId} store={store} />;
}

function AlertCenterContent({ userId, store }: { userId: string; store: ReturnType<typeof useEvStore> }) {
  const alert = useAlertStore(userId);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const hasAutoChecked = useRef(false);

  // Auto-check once on mount (not on every re-render)
  useEffect(() => {
    if (!alert.loading && store.holdings.length > 0 && !hasAutoChecked.current) {
      hasAutoChecked.current = true;
      handleCheck();
    }
  }, [alert.loading, store.holdings.length]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await alert.doCheck(store.holdings);
      if (result.alerts.length > 0) {
        toast.success(`检查完成，触发 ${result.alerts.length} 条提醒`);
      } else {
        toast.info('检查完成，暂无新提醒');
      }
    } catch (e) {
      toast.error('检查失败');
    }
    setChecking(false);
  };

  const isConfigured = !!(alert.settings.emailjsServiceId && alert.settings.receiverEmail);
  const sentimentLevel = getSentimentLevel(alert.sentiment, alert.settings);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">邮件推送：{isConfigured ? <span className="text-profit">已开启 ✅</span> : <span className="text-muted-foreground">未配置</span>}</div>
              {isConfigured && <div className="text-xs text-muted-foreground">接收邮箱：****{alert.settings.receiverEmail.slice(-8)}</div>}
            </div>
          </div>
          <Button size="sm" onClick={handleCheck} disabled={checking} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            立即检查
          </Button>
        </div>
        {alert.lastCheck && (
          <div className="text-xs text-muted-foreground">
            最后检查：{alert.lastCheck}　本次触发 {alert.lastCheckCount} 条提醒
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4 bg-muted/30">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><Activity className="w-3 h-3" />情绪</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><Bell className="w-3 h-3" />历史</TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs gap-1"><Calendar className="w-3 h-3" />财报</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1"><Settings className="w-3 h-3" />设置</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <SentimentDashboard alert={alert} />
        </TabsContent>
        <TabsContent value="history">
          <AlertHistory alert={alert} />
        </TabsContent>
        <TabsContent value="calendar">
          <EarningsCalendar alert={alert} />
        </TabsContent>
        <TabsContent value="settings">
          <AlertSettings alert={alert} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Sentiment Dashboard ---
function SentimentDashboard({ alert }: { alert: ReturnType<typeof useAlertStore> }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(alert.sentiment);
  const level = getSentimentLevel(values, alert.settings);

  const handleSave = () => {
    alert.updateSentiment({ ...values, updatedAt: new Date().toLocaleString('zh-CN') });
    setEditing(false);
    toast.success('市场情绪数据已更新');
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <div className={`text-3xl font-bold ${level.color}`}>{level.label}</div>
        <div className="text-xs text-muted-foreground mt-1">当前市场情绪等级</div>
        {alert.sentiment.updatedAt && <div className="text-xs text-muted-foreground mt-1">更新于：{alert.sentiment.updatedAt}</div>}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">市场指标录入</h3>
          {editing ? (
            <Button size="sm" variant="ghost" onClick={handleSave}><Check className="w-3.5 h-3.5 mr-1" />保存</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>编辑</Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'vix', label: 'VIX 恐慌指数', warn: values.vix > alert.settings.vixLevel2 },
            { key: 'nasdaqDrop', label: '纳指跌幅 %', warn: values.nasdaqDrop > alert.settings.nasdaqDropTrigger },
            { key: 'sp500Drop', label: '标普跌幅 %', warn: values.sp500Drop > 15 },
            { key: 'fearGreed', label: '恐贪指数 (0-100)', warn: values.fearGreed < alert.settings.fearGreedTrigger },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <Input
                type="number"
                value={values[f.key as keyof MarketSentiment] as number}
                disabled={!editing}
                onChange={e => setValues({ ...values, [f.key]: Number(e.target.value) })}
                className={`mt-1 h-9 text-sm ${f.warn ? 'border-loss text-loss' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Level descriptions */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-medium mb-2">触发规则</h3>
        {[
          { label: '🟡 关注', desc: `VIX>${alert.settings.vixLevel1} 或 纳指跌>10%` },
          { label: '🟠 机会', desc: `VIX>${alert.settings.vixLevel2} 或 纳指跌>${alert.settings.nasdaqDropTrigger}% 或 恐贪<${alert.settings.fearGreedTrigger}` },
          { label: '🔴 黄金坑', desc: `VIX>${alert.settings.vixLevel3} + 纳指跌>20% + 恐贪<20（需两项以上）` },
        ].map(r => (
          <div key={r.label} className="flex items-start gap-2 text-xs">
            <span className="shrink-0">{r.label}</span>
            <span className="text-muted-foreground">{r.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Alert History ---
function AlertHistory({ alert }: { alert: ReturnType<typeof useAlertStore> }) {
  const typeLabels: Record<string, string> = {
    node_trigger: '📍 节点', market_panic: '📉 恐慌', earnings: '📊 财报', dca: '💰 定投',
  };

  return (
    <div className="space-y-2">
      {alert.alerts.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">暂无提醒记录</div>}
      {alert.alerts.slice(0, 20).map(a => (
        <div key={a.id}
          className={`bg-card border rounded-xl p-3 space-y-1 cursor-pointer transition-colors ${a.isRead ? 'border-border opacity-60' : 'border-primary/30'}`}
          onClick={() => !a.isRead && alert.markRead(a.id)}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{typeLabels[a.alertType] || a.alertType}</span>
            <div className="flex items-center gap-2">
              {a.emailSent && <span className="text-[10px] text-profit">✉️ 已发送</span>}
              <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
          <div className="text-sm font-medium">{a.title}</div>
          {a.triggerReason && <div className="text-xs text-muted-foreground">{a.triggerReason}</div>}
          {!a.isRead && <div className="text-[10px] text-primary">点击标为已读</div>}
        </div>
      ))}
    </div>
  );
}

// --- Earnings Calendar ---
function EarningsCalendar({ alert }: { alert: ReturnType<typeof useAlertStore> }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ symbol: '', name: '', earningsDate: '', notes: '' });

  const handleAdd = async () => {
    if (!form.symbol || !form.earningsDate) { toast.error('请填写代码和日期'); return; }
    await alert.addEarnings({ ...form, remind7d: true, remind1d: true, remind0d: true });
    setForm({ symbol: '', name: '', earningsDate: '', notes: '' });
    setAdding(false);
    toast.success('财报事件已添加');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">财报日历</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
          <Plus className="w-3.5 h-3.5 mr-1" />{adding ? '取消' : '添加'}
        </Button>
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="股票代码" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} className="h-8 text-sm" />
            <Input placeholder="名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" />
          </div>
          <Input type="date" value={form.earningsDate} onChange={e => setForm({ ...form, earningsDate: e.target.value })} className="h-8 text-sm" />
          <Input placeholder="备注（可选）" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-8 text-sm" />
          <Button size="sm" onClick={handleAdd} className="w-full">确认添加</Button>
        </div>
      )}

      {alert.earnings.length === 0 && !adding && <div className="text-center text-muted-foreground text-sm py-8">暂无财报事件</div>}
      {alert.earnings.map(e => {
        const diff = Math.round((new Date(e.earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const isPast = diff < 0;
        return (
          <div key={e.id} className={`bg-card border border-border rounded-xl p-3 ${isPast ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-mono font-bold text-primary">{e.symbol}</span>
                <span className="text-xs text-muted-foreground ml-2">{e.name}</span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => alert.deleteEarnings(e.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-xs mt-1">
              <span className="text-muted-foreground">财报日期：</span>
              <span>{e.earningsDate}</span>
              {!isPast && <span className={`ml-2 ${diff <= 7 ? 'text-loss font-medium' : 'text-muted-foreground'}`}>（{diff}天后）</span>}
            </div>
            {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}

// --- Settings ---
function AlertSettings({ alert }: { alert: ReturnType<typeof useAlertStore> }) {
  const [s, setS] = useState(alert.settings);
  const [testing, setTesting] = useState(false);

  const update = (key: keyof AlertSettingsType, val: any) => {
    const next = { ...s, [key]: val };
    setS(next);
    alert.updateSettings(next);
  };

  type AlertSettingsType = typeof s;

  const handleTest = async () => {
    setTesting(true);
    const ok = await alert.sendTestEmail();
    setTesting(false);
    ok ? toast.success('测试邮件已发送，请检查收件箱') : toast.error('发送失败，请检查配置');
  };

  return (
    <div className="space-y-4">
      {/* EmailJS Config */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium">邮件服务配置（EmailJS）</h3>
        {[
          { key: 'receiverEmail', label: '接收邮箱', placeholder: 'your@email.com' },
          { key: 'emailjsServiceId', label: 'Service ID', placeholder: 'service_xxx' },
          { key: 'emailjsTemplateId', label: 'Template ID', placeholder: 'template_xxx' },
          { key: 'emailjsPublicKey', label: 'Public Key', placeholder: 'xxxx' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground">{f.label}</label>
            <Input
              value={(s as any)[f.key]}
              placeholder={f.placeholder}
              onChange={e => update(f.key as keyof AlertSettingsType, e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
        ))}
        <Button size="sm" onClick={handleTest} disabled={testing} className="w-full gap-1.5">
          <Send className="w-3.5 h-3.5" />{testing ? '发送中...' : '测试发送'}
        </Button>
      </div>

      {/* Alert toggles */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium">提醒开关</h3>
        {[
          { key: 'nodeAlertEnabled', label: '节点触发提醒' },
          { key: 'panicAlertEnabled', label: '市场恐慌提醒' },
          { key: 'earningsAlertEnabled', label: '财报提醒' },
          { key: 'dcaAlertEnabled', label: '定投提醒' },
          { key: 'browserNotifyEnabled', label: '浏览器桌面通知（节点/恐慌）' },
        ].map(f => (
          <div key={f.key} className="flex items-center justify-between">
            <span className="text-sm">{f.label}</span>
            <Switch checked={(s as any)[f.key]} onCheckedChange={async v => {
              if (f.key === 'browserNotifyEnabled' && v) {
                const granted = await requestNotificationPermission();
                if (!granted) { toast.error('浏览器通知权限被拒绝，请在浏览器设置中允许'); return; }
              }
              update(f.key as keyof AlertSettingsType, v);
            }} />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">静默时间</span>
          <Input type="number" min={0} max={23} value={s.silentStart} onChange={e => update('silentStart', Number(e.target.value))} className="h-7 w-14 text-xs text-center" />
          <span className="text-xs">~</span>
          <Input type="number" min={0} max={23} value={s.silentEnd} onChange={e => update('silentEnd', Number(e.target.value))} className="h-7 w-14 text-xs text-center" />
          <span className="text-xs text-muted-foreground">点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">每月定投提醒日</span>
          <Input type="number" min={1} max={28} value={s.dcaDay} onChange={e => update('dcaDay', Number(e.target.value))} className="h-7 w-14 text-xs text-center" />
          <span className="text-xs text-muted-foreground">号</span>
        </div>
      </div>

      {/* Threshold config */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium">提醒阈值配置</h3>
        {[
          { key: 'vixLevel1', label: 'VIX 级别一（关注）' },
          { key: 'vixLevel2', label: 'VIX 级别二（机会）' },
          { key: 'vixLevel3', label: 'VIX 级别三（黄金坑）' },
          { key: 'nasdaqDropTrigger', label: '纳指跌幅触发线 %' },
          { key: 'fearGreedTrigger', label: '恐贪指数触发线' },
        ].map(f => (
          <div key={f.key} className="flex items-center justify-between">
            <span className="text-xs">{f.label}</span>
            <Input type="number" value={(s as any)[f.key]} onChange={e => update(f.key as keyof AlertSettingsType, Number(e.target.value))} className="h-7 w-16 text-xs text-center" />
          </div>
        ))}
      </div>
    </div>
  );
}
