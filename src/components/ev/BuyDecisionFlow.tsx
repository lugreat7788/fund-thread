import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, RotateCcw, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isLeveragedETF } from '@/lib/leveraged-etf';
import type { useEvStore } from '@/store/useEvStore';

const STEPS = ['准入审核', '跌幅档位', '基本面验证', '买入计划', 'EV估算', '确认执行'];

interface FlowState {
  symbol: string;
  // Step 1 - Admission
  profitable: boolean; moat: boolean; volume: boolean; marketCap: boolean;
  vetoNoRev: boolean; vetoGov: boolean;
  // Leveraged ETF specific
  isManualLeveraged: boolean;
  levHasSellNodes: boolean; levPositionOk: boolean; levRebalanceOk: boolean;
  levPositionLimit: string;
  // Step 2 - Tier
  tier: number; dropPct: number;
  // Step 3 - Fundamental
  earnings: boolean; growth: boolean; declineReason: string; industry: boolean;
  // Step 4 - Buy plan
  amount: string; price: string; shares: string;
  sellP1: string; sellP2: string; sellP3: string;
  // Step 5 - EV
  winProb: string; gainPct: string; lossPct: string;
  // First-time leveraged warning shown
  levWarningShown: boolean;
}

const init = (): FlowState => ({
  symbol: '', profitable: false, moat: false, volume: false, marketCap: false,
  vetoNoRev: false, vetoGov: false,
  isManualLeveraged: false,
  levHasSellNodes: false, levPositionOk: false, levRebalanceOk: false,
  levPositionLimit: '30',
  tier: 1, dropPct: 0,
  earnings: false, growth: false, declineReason: 'macro', industry: false,
  amount: '', price: '', shares: '', sellP1: '', sellP2: '', sellP3: '',
  winProb: '60', gainPct: '30', lossPct: '15',
  levWarningShown: false,
});

function CheckItem({ checked, onChange, label, veto }: { checked: boolean; onChange: (v: boolean) => void; label: string; veto?: boolean }) {
  return (
    <label className={`flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer ${veto ? 'bg-loss/10 border border-loss/20' : 'bg-secondary/30'}`}>
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <span className={`text-xs font-mono ${veto ? 'text-loss' : ''}`}>{label}</span>
    </label>
  );
}

function LeveragedETFWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
        <AlertTriangle className="w-4 h-4" />
        杠杆ETF风险提示
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        杠杆ETF有<span className="text-foreground font-medium">波动率衰减</span>和<span className="text-foreground font-medium">路径依赖</span>风险，
        长期持有可能导致收益远低于标的指数的倍数表现。系统要求强制配套减仓规则和仓位上限，不允许"裸持"杠杆ETF。
      </p>
      <Button size="sm" variant="outline" className="text-xs" onClick={onDismiss}>
        我已了解风险
      </Button>
    </div>
  );
}

export function BuyDecisionFlow({ store }: { store: ReturnType<typeof useEvStore> }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FlowState>(init());
  const [done, setDone] = useState(false);

  const u = (k: Partial<FlowState>) => setF(prev => ({ ...prev, ...k }));

  const symbolIsLeveraged = isLeveragedETF(f.symbol) || f.isManualLeveraged;
  const leveragedPass = !symbolIsLeveraged || (f.levHasSellNodes && f.levPositionOk && f.levRebalanceOk);

  // For leveraged ETFs, skip standard admission checks (profitable/moat not applicable)
  const standardAdmissionPass = f.profitable && f.moat && f.volume && f.marketCap && !f.vetoNoRev && !f.vetoGov;
  const admissionPass = symbolIsLeveraged
    ? (f.volume && f.marketCap && !f.vetoNoRev && !f.vetoGov && leveragedPass)
    : standardAdmissionPass;

  const fundamentalPass = f.earnings && f.growth && f.industry && f.declineReason === 'macro';
  const fundamentalDoubt = f.earnings && f.growth && f.industry && f.declineReason !== 'macro';

  const winP = parseFloat(f.winProb) / 100 || 0;
  const gainP = parseFloat(f.gainPct) / 100 || 0;
  const lossP = parseFloat(f.lossPct) / 100 || 0;
  const ev = (winP * gainP - (1 - winP) * lossP) * 100;

  const handleSubmit = async (execute: boolean) => {
    const holdingMatch = store.holdings.find(h => h.symbol.toLowerCase() === f.symbol.toLowerCase());
    await store.addDecision({
      holdingId: holdingMatch?.id, symbol: f.symbol.toUpperCase(),
      admissionProfitable: symbolIsLeveraged ? null as any : f.profitable,
      admissionMoat: symbolIsLeveraged ? null as any : f.moat,
      admissionVolume: f.volume, admissionMarketCap: f.marketCap,
      vetoNoRevenue: f.vetoNoRev, vetoGovContract: f.vetoGov, vetoLeveraged: false,
      admissionResult: admissionPass ? 'pass' : 'fail',
      currentTier: f.tier, dropPercent: f.dropPct,
      fundamentalEarnings: f.earnings, fundamentalGrowth: f.growth,
      fundamentalDeclineReason: f.declineReason, fundamentalIndustry: f.industry,
      fundamentalResult: fundamentalPass ? 'pass' : fundamentalDoubt ? 'doubt' : 'fail',
      buyAmount: parseFloat(f.amount) || undefined, buyPrice: parseFloat(f.price) || undefined,
      buyShares: parseFloat(f.shares) || undefined,
      winProbability: winP, expectedGainPct: gainP, expectedLossPct: lossP, evValue: ev,
      executed: execute, cancelled: !execute,
    });
    setDone(true);
  };

  const reset = () => { setF(init()); setStep(0); setDone(false); };

  if (done) {
    return (
      <div className="text-center py-12 space-y-3">
        <CheckCircle2 className="w-12 h-12 text-profit mx-auto" />
        <div className="text-sm font-mono">决策已记录</div>
        <Button size="sm" onClick={reset} className="gap-1"><RotateCcw className="w-3 h-3" /> 新建决策</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
            <span className={`text-[8px] font-mono ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</span>
          </div>
        ))}
      </div>

      {/* Symbol input - always visible at top */}
      {step === 0 && (
        <div>
          <label className="text-xs text-muted-foreground">标的代码</label>
          <Input value={f.symbol} onChange={e => u({ symbol: e.target.value })} placeholder="如 AAPL" className="h-8 text-sm mt-1" />
          {f.symbol && isLeveragedETF(f.symbol) && (
            <div className="mt-1 text-[10px] text-amber-500 font-mono flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> 系统识别为杠杆ETF，将启用专项审核
            </div>
          )}
          {f.symbol && !isLeveragedETF(f.symbol) && (
            <label className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground cursor-pointer">
              <Checkbox checked={f.isManualLeveraged} onCheckedChange={v => u({ isManualLeveraged: !!v })} />
              手动标记为杠杆ETF
            </label>
          )}
        </div>
      )}

      {/* Leveraged ETF first-time warning */}
      {step === 0 && symbolIsLeveraged && !f.levWarningShown && (
        <LeveragedETFWarning onDismiss={() => u({ levWarningShown: true })} />
      )}

      {/* Step 1: Admission */}
      {step === 0 && (
        <div className="space-y-2">
          {/* Standard checks - hide moat/profitable for leveraged ETFs */}
          <div className="text-xs font-mono text-primary">必须全部满足</div>
          {!symbolIsLeveraged && (
            <>
              <CheckItem checked={f.profitable} onChange={v => u({ profitable: v })} label="公司已盈利，或1年内有清晰盈利路径" />
              <CheckItem checked={f.moat} onChange={v => u({ moat: v })} label="有品牌/技术/规模护城河" />
            </>
          )}
          <CheckItem checked={f.volume} onChange={v => u({ volume: v })} label="日均成交量 > 100万美元" />
          <CheckItem checked={f.marketCap} onChange={v => u({ marketCap: v })} label="市值 > 5亿美元" />

          <div className="text-xs font-mono text-loss mt-3">一票否决（勾选=存在该问题）</div>
          <CheckItem veto checked={f.vetoNoRev} onChange={v => u({ vetoNoRev: v })} label="无营收或营收持续萎缩" />
          <CheckItem veto checked={f.vetoGov} onChange={v => u({ vetoGov: v })} label="高度依赖单一政府合同" />

          {/* Leveraged ETF specific review */}
          {symbolIsLeveraged && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-amber-500">⚡ 杠杆ETF专用审核</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px] text-xs">
                      杠杆ETF有波动率衰减和路径依赖风险，必须配套风控规则才允许持有。
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-[10px] text-muted-foreground -mt-1">以下三条必须全部满足</div>
              <CheckItem checked={f.levHasSellNodes} onChange={v => u({ levHasSellNodes: v })} label="已配套明确的减仓节点（至少3档减仓价位）" />
              <CheckItem checked={f.levPositionOk} onChange={v => u({ levPositionOk: v })} label={`该标的仓位占总仓位比例不超过${f.levPositionLimit}%`} />
              <div className="flex items-center gap-2 pl-3">
                <span className="text-[10px] text-muted-foreground">仓位上限:</span>
                <Input
                  value={f.levPositionLimit}
                  onChange={e => u({ levPositionLimit: e.target.value })}
                  className="h-6 text-xs w-16"
                  type="number"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <CheckItem checked={f.levRebalanceOk} onChange={v => u({ levRebalanceOk: v })} label="有最长持有期限或强制再平衡规则（默认每季度一次）" />

              {!leveragedPass && (f.levHasSellNodes || f.levPositionOk || f.levRebalanceOk || (!f.levHasSellNodes && !f.levPositionOk && !f.levRebalanceOk)) && (
                <div className="bg-loss/10 border border-loss/20 rounded-lg p-2.5 space-y-1.5">
                  <div className="text-xs font-mono text-loss font-semibold">
                    ❌ 不通过 - 杠杆ETF必须配套风险控制规则
                  </div>
                  <a href="/ev" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                    onClick={(e) => { e.preventDefault(); /* Navigate to nodes tab */ }}>
                    <ExternalLink className="w-3 h-3" /> 前往节点页配置减仓节点
                  </a>
                </div>
              )}
            </div>
          )}

          <div className={`text-sm font-mono font-bold mt-2 ${admissionPass ? 'text-profit' : 'text-loss'}`}>
            审核结果：{admissionPass ? '✅ 通过' : '❌ 不通过'}
          </div>
        </div>
      )}

      {/* Step 2: Tier */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary">当前处于第几档买入区间？</div>
          <div className="space-y-2">
            {[
              { t: 1, label: '第一档（轻仓试探）', desc: '跌幅 -15%，买入当月定投30%' },
              { t: 2, label: '第二档（主力加仓）', desc: '跌幅 -25%，买入当月定投50%，需重新验证基本面' },
              { t: 3, label: '第三档（底部重仓）', desc: '跌幅 -35%+，最大化买入，需验证 VIX>25 或恐贪指数<30' },
            ].map(item => (
              <button key={item.t} onClick={() => u({ tier: item.t })}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-mono ${f.tier === item.t ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
                <div className="font-semibold">{item.label}</div>
                <div className="text-[10px] mt-0.5 opacity-70">{item.desc}</div>
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">距近期高点跌幅 (%)</label>
            <Input type="number" value={f.dropPct || ''} onChange={e => u({ dropPct: parseFloat(e.target.value) || 0 })} className="h-7 text-xs mt-1" placeholder="-25" />
          </div>
        </div>
      )}

      {/* Step 3: Fundamental */}
      {step === 2 && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-primary">基本面快速验证（5分钟完成）</div>
          <CheckItem checked={f.earnings} onChange={v => u({ earnings: v })} label="最近一季财报符合预期" />
          <CheckItem checked={f.growth} onChange={v => u({ growth: v })} label="核心业务营收/利润增速无拐点" />
          <CheckItem checked={f.industry} onChange={v => u({ industry: v })} label="行业主线仍然成立" />
          <div className="mt-2">
            <label className="text-[10px] text-muted-foreground">下跌原因</label>
            <Select value={f.declineReason} onValueChange={v => u({ declineReason: v })}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="macro">宏观/情绪性（可买）</SelectItem>
                <SelectItem value="fundamental">竞争颠覆/业务恶化（暂停）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={`text-sm font-mono font-bold mt-2 ${fundamentalPass ? 'text-profit' : fundamentalDoubt ? 'text-yellow-400' : 'text-loss'}`}>
            验证结果：{fundamentalPass ? '✅ 通过' : fundamentalDoubt ? '⚠️ 存疑（减半仓位）' : '❌ 不通过'}
          </div>
        </div>
      )}

      {/* Step 4: Buy Plan */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary">填写买入计划</div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-muted-foreground">金额($)</label><Input value={f.amount} onChange={e => u({ amount: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">价格</label><Input value={f.price} onChange={e => u({ price: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">股数</label><Input value={f.shares} onChange={e => u({ shares: e.target.value })} className="h-7 text-xs mt-1" /></div>
          </div>
          <div className="text-xs font-mono text-profit">三步减仓价格（必填）</div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-muted-foreground">+40%卖</label><Input value={f.sellP1} onChange={e => u({ sellP1: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">+70%卖</label><Input value={f.sellP2} onChange={e => u({ sellP2: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">+100%卖</label><Input value={f.sellP3} onChange={e => u({ sellP3: e.target.value })} className="h-7 text-xs mt-1" /></div>
          </div>
          <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded-lg p-2">
            减仓策略：+40%卖20% → +70%再卖30% → +100%再卖30% → 底仓20%长期持有
            <br />
            <span className="text-amber-500">注：减仓价基于近12个月最低收盘价反弹计算，需同时满足市场温度条件才触发</span>
          </div>
        </div>
      )}

      {/* Step 5: EV */}
      {step === 4 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary">期望值(EV)估算</div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-muted-foreground">胜率(%)</label><Input value={f.winProb} onChange={e => u({ winProb: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">预期盈(%)</label><Input value={f.gainPct} onChange={e => u({ gainPct: e.target.value })} className="h-7 text-xs mt-1" /></div>
            <div><label className="text-[10px] text-muted-foreground">预期亏(%)</label><Input value={f.lossPct} onChange={e => u({ lossPct: e.target.value })} className="h-7 text-xs mt-1" /></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground font-mono">EV = 胜率×盈 - (1-胜率)×亏</div>
            <div className={`text-2xl font-display font-bold mt-1 ${ev >= 0 ? 'text-profit' : 'text-loss'}`}>
              {ev >= 0 ? '+' : ''}{ev.toFixed(2)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {ev > 5 ? '✅ EV为正，值得买入' : ev > 0 ? '⚠️ EV略正，谨慎买入' : '❌ EV为负，建议放弃'}
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Confirm */}
      {step === 5 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-primary">决策摘要</div>
          <div className="bg-card border border-border rounded-xl p-3 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">标的</span><span>{f.symbol.toUpperCase()} {symbolIsLeveraged && <span className="text-amber-500">⚡杠杆</span>}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">准入</span><span className={admissionPass ? 'text-profit' : 'text-loss'}>{admissionPass ? '通过' : '不通过'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">档位</span><span>第{f.tier}档 ({f.dropPct}%)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">基本面</span><span className={fundamentalPass ? 'text-profit' : 'text-yellow-400'}>{fundamentalPass ? '通过' : '存疑'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">买入</span><span>${f.amount} @ ${f.price} × {f.shares}股</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">EV</span><span className={ev >= 0 ? 'text-profit' : 'text-loss'}>{ev.toFixed(2)}%</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleSubmit(false)} className="text-xs gap-1"><XCircle className="w-3 h-3" /> 放弃</Button>
            <Button onClick={() => handleSubmit(true)} className="text-xs gap-1"><CheckCircle2 className="w-3 h-3" /> 确认执行</Button>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-2 pt-2">
        {step > 0 && (
          <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="flex-1 text-xs gap-1">
            <ArrowLeft className="w-3 h-3" /> 上一步
          </Button>
        )}
        {step < 5 && (
          <Button size="sm" onClick={() => setStep(s => s + 1)} className="flex-1 text-xs gap-1"
            disabled={step === 0 && !f.symbol}>
            下一步 <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Decision History */}
      {store.decisions.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-mono text-muted-foreground">历史决策记录</div>
          {store.decisions.slice(0, 10).map(d => (
            <div key={d.id} className="bg-card border border-border rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="font-semibold">{d.symbol}</span>
                <span className="text-muted-foreground ml-2">{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                {d.evValue != null && <span className={d.evValue >= 0 ? 'text-profit' : 'text-loss'}>EV {d.evValue.toFixed(1)}%</span>}
                <span className={d.executed ? 'text-profit' : 'text-muted-foreground'}>{d.executed ? '已执行' : '已放弃'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
