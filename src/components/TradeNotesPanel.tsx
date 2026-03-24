import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pin, PinOff, Trash2, Plus, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import type { TradeNote, NoteCategory } from '@/types/notes';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_ICONS } from '@/types/notes';

const CATEGORIES = Object.keys(NOTE_CATEGORY_LABELS) as NoteCategory[];

interface Props {
  notes: TradeNote[];
  loading: boolean;
  onAdd: (note: { category: NoteCategory; content: string; isPinned?: boolean }) => void;
  onUpdate: (id: string, updates: { content?: string; isPinned?: boolean; category?: NoteCategory }) => void;
  onDelete: (id: string) => void;
  identityName?: string;
}

export function TradeNotesPanel({ notes, loading, onAdd, onUpdate, onDelete, identityName }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<NoteCategory>('risk_control');
  const [newContent, setNewContent] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NoteCategory | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const filteredNotes = activeCategory === 'all' ? notes : notes.filter(n => n.category === activeCategory);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onAdd({ category: newCategory, content: newContent.trim(), isPinned: newPinned });
    setNewContent('');
    setNewPinned(false);
    setIsAdding(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 text-left">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-semibold">
            交易纪律 & 注意事项
          </h2>
          {identityName && <span className="text-xs text-muted-foreground">— {identityName}</span>}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {!collapsed && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setIsAdding(!isAdding)}>
            <Plus className="w-3 h-3" />{isAdding ? '取消' : '添加'}
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Add form */}
          {isAdding && (
            <div className="bg-secondary/30 rounded-lg p-3 space-y-3 border border-border/50">
              <div className="flex items-center gap-2">
                <Select value={newCategory} onValueChange={v => setNewCategory(v as NoteCategory)}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {NOTE_CATEGORY_ICONS[c]} {NOTE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={newPinned ? 'default' : 'ghost'}
                  size="sm" className="h-8 w-8 p-0"
                  onClick={() => setNewPinned(!newPinned)}
                  title={newPinned ? '取消置顶' : '置顶'}
                >
                  {newPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="输入注意事项内容..."
                rows={2}
                className="text-sm"
              />
              <Button onClick={handleAdd} size="sm" className="w-full">确认添加</Button>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                activeCategory === 'all' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              全部 ({notes.length})
            </button>
            {CATEGORIES.map(c => {
              const count = notes.filter(n => n.category === c).length;
              if (count === 0 && activeCategory !== c) return null;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                    activeCategory === c ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {NOTE_CATEGORY_ICONS[c]} {NOTE_CATEGORY_LABELS[c]} ({count})
                </button>
              );
            })}
          </div>

          {/* Notes list */}
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-xs">加载中...</div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-xs">暂无注意事项</div>
              <div className="text-xs mt-0.5">点击「添加」开始记录交易纪律</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotes.map(note => (
                <NoteItem key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({ note, onUpdate, onDelete }: {
  note: TradeNote;
  onUpdate: (id: string, updates: { content?: string; isPinned?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = () => {
    if (editContent.trim() && editContent !== note.content) {
      onUpdate(note.id, { content: editContent.trim() });
    }
    setEditing(false);
  };

  return (
    <div className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
      note.isPinned ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-secondary/20 hover:bg-secondary/40'
    }`}>
      <div className="text-sm mt-0.5 shrink-0">{NOTE_CATEGORY_ICONS[note.category]}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} className="text-sm" />
            <div className="flex gap-1">
              <Button size="sm" onClick={handleSave} className="h-6 text-xs px-2">保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-6 text-xs px-2">取消</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap cursor-pointer" onClick={() => setEditing(true)}>
            {note.content}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground font-mono">{NOTE_CATEGORY_LABELS[note.category]}</span>
          {note.isPinned && <Pin className="w-2.5 h-2.5 text-primary" />}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0"
          onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
          title={note.isPinned ? '取消置顶' : '置顶'}
        >
          {note.isPinned ? <PinOff className="w-3 h-3 text-primary" /> : <Pin className="w-3 h-3 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-loss" onClick={() => onDelete(note.id)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
