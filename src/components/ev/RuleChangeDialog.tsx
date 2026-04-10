import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CONTEXTS = [
  '常规优化',
  '复盘后调整',
  '市场剧烈波动中',
  '持仓浮亏中',
  '持仓浮盈中',
  '其他',
];

const RISKY_CONTEXTS = ['市场剧烈波动中', '持仓浮亏中'];

export interface RuleChangeRequest {
  ruleName: string;
  oldValue: string;
  newValue: string;
}

interface Props {
  request: RuleChangeRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RuleChangeDialog({ request, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [context, setContext] = useState('');
  const [riskConfirmStep, setRiskConfirmStep] = useState(false);

  if (!request) return null;

  const isRisky = RISKY_CONTEXTS.includes(context);
  const canSubmit = reason.length >= 20 && context !== '';

  const handleSubmit = async () => {
    if (isRisky && !riskConfirmStep) {
      setRiskConfirmStep(true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('ev_rule_changes' as any).insert({
      user_id: user.id,
      rule_name: request.ruleName,
      old_value: request.oldValue,
      new_value: request.newValue,
      reason,
      context,
    });

    setReason('');
    setContext('');
    setRiskConfirmStep(false);
    onConfirm();
  };

  const handleCancel = () => {
    setReason('');
    setContext('');
    setRiskConfirmStep(false);
    onCancel();
  };

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {riskConfirmStep ? (
              <><AlertTriangle className="w-5 h-5 text-destructive" /> 情绪化修改警告</>
            ) : '规则变更确认'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              {riskConfirmStep ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive mb-2">
                    ⚠️ 在情绪化情境下修改规则是交易系统最常见的失败模式。
                  </p>
                  <p className="text-muted-foreground">
                    建议做法：先记录想修改的内容，等冷静后（至少48小时）再执行修改。是否仍要立即修改？
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">规则：</span>{request.ruleName}</p>
                    <p><span className="text-muted-foreground">修改前：</span>{request.oldValue}</p>
                    <p><span className="text-muted-foreground">修改后：</span>{request.newValue}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">触发修改的情境</label>
                    <Select value={context} onValueChange={setContext}>
                      <SelectTrigger><SelectValue placeholder="选择情境" /></SelectTrigger>
                      <SelectContent>
                        {CONTEXTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">修改原因（至少20字）</label>
                    <Textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="详细说明为什么要修改这条规则..."
                      className="min-h-[80px]"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{reason.length}/20</p>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!riskConfirmStep && !canSubmit}
            className={riskConfirmStep ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {riskConfirmStep ? '仍然修改' : '确认修改'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
