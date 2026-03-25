import { useState } from 'react';
import type { Identity } from '@/types/trade';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Plus, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#D4A853', '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

interface Props {
  identities: Identity[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (identity: { name: string; color: string }) => void;
  onDelete: (id: string) => void;
}

export function IdentitySelector({ identities, activeId, onSelect, onAdd, onDelete }: Props) {
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim(), color: newColor });
    setNewName('');
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 overflow-x-auto max-w-full">
        {identities.map(identity => (
          <button
            key={identity.id}
            onClick={() => onSelect(identity.id)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              identity.id === activeId ? 'bg-card shadow-sm' : 'hover:bg-card/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: identity.color }} />
            {identity.name}
          </button>
        ))}
      </div>

      <Dialog open={mgmtOpen} onOpenChange={setMgmtOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Settings className="w-4 h-4" /></Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">身份管理</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {identities.map(identity => (
                <div key={identity.id} className="flex items-center justify-between p-2 rounded bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.color }} />
                    <span className="text-sm font-mono">{identity.name}</span>
                  </div>
                  {identities.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-loss" onClick={() => onDelete(identity.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-3">
              <div><Label>新身份名称</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：激进型" /></div>
              <div>
                <Label>颜色</Label>
                <div className="flex gap-2 mt-1">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full gap-1" size="sm"><Plus className="w-3 h-3" />添加身份</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
