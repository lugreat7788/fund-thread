import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pin, PinOff, Trash2, Plus, ChevronDown, ChevronUp, BookOpen, Paperclip, Image, FileText, Sparkles, X, Loader2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TradeNote, NoteCategory } from '@/types/notes';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_ICONS } from '@/types/notes';
import { toast } from 'sonner';

const CATEGORIES = Object.keys(NOTE_CATEGORY_LABELS) as NoteCategory[];

interface Props {
  notes: TradeNote[];
  loading: boolean;
  onAdd: (note: {
    category: NoteCategory;
    content: string;
    isPinned?: boolean;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    aiSummary?: string;
  }) => void;
  onUpdate: (id: string, updates: { content?: string; isPinned?: boolean; category?: NoteCategory; aiSummary?: string }) => void;
  onDelete: (id: string) => void;
  onParseAttachment?: (content: string, fileName: string, fileType: string, userPrompt?: string) => Promise<string>;
  identityName?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function TradeNotesPanel({ notes, loading, onAdd, onUpdate, onDelete, onParseAttachment, identityName }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<NoteCategory>('risk_control');
  const [newContent, setNewContent] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NoteCategory | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  // Attachment state
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [parsing, setParsing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredNotes = activeCategory === 'all' ? notes : notes.filter(n => n.category === activeCategory);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('文件大小不能超过 5MB');
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      setAttachment({ url: dataUrl, type: file.type, name: file.name });
      toast.success(`已添加附件: ${file.name}`);
    } catch {
      toast.error('文件读取失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAiParse = async () => {
    if (!attachment || !onParseAttachment) return;
    setParsing(true);
    try {
      let content: string;
      if (attachment.type.startsWith('image/')) {
        content = attachment.url; // send base64 data URL for images
      } else {
        // For text files, decode base64 to text
        const base64Data = attachment.url.split(',')[1];
        content = atob(base64Data);
      }
      const summary = await onParseAttachment(content, attachment.name, attachment.type, aiPrompt || undefined);
      setAiSummary(summary);
      toast.success('AI 分析完成');
    } catch (err) {
      toast.error('AI 分析失败，请稍后重试');
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleAdd = () => {
    if (!newContent.trim() && !attachment) return;
    onAdd({
      category: newCategory,
      content: newContent.trim() || (attachment ? `[附件] ${attachment.name}` : ''),
      isPinned: newPinned,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      attachmentName: attachment?.name,
      aiSummary: aiSummary || undefined,
    });
    setNewContent('');
    setNewPinned(false);
    setAttachment(null);
    setAiSummary('');
    setAiPrompt('');
    setIsAdding(false);
  };

  const resetForm = () => {
    setIsAdding(false);
    setNewContent('');
    setNewPinned(false);
    setAttachment(null);
    setAiSummary('');
    setAiPrompt('');
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.txt,.csv,.md,.json,.pdf,.doc,.docx"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 text-left">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-semibold">交易纪律 & 注意事项</h2>
          {identityName && <span className="text-xs text-muted-foreground">— {identityName}</span>}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {!collapsed && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => isAdding ? resetForm() : setIsAdding(true)}>
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
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-3.5 h-3.5" />
                  上传附件
                </Button>
              </div>

              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="输入注意事项内容..."
                rows={2}
                className="text-sm"
              />

              {/* Attachment preview */}
              {attachment && (
                <div className="bg-background rounded-md border border-border p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    {attachment.type.startsWith('image/') ? (
                      <Image className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className="text-xs font-mono truncate flex-1">{attachment.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setAttachment(null); setAiSummary(''); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  {attachment.type.startsWith('image/') && (
                    <img src={attachment.url} alt={attachment.name} className="max-h-32 rounded-md object-contain" />
                  )}

                  {/* AI parsing */}
                  {onParseAttachment && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Textarea
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                          placeholder="可选：输入自定义 AI 分析提示语..."
                          rows={1}
                          className="text-xs flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs shrink-0"
                          onClick={handleAiParse}
                          disabled={parsing}
                        >
                          {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {parsing ? 'AI 分析中...' : 'AI 解析'}
                        </Button>
                      </div>
                      {aiSummary && (
                        <div className="bg-primary/5 border border-primary/20 rounded-md p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-semibold text-primary">AI 分析结果</span>
                          </div>
                          <div className="text-xs whitespace-pre-wrap text-foreground">{aiSummary}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleAdd} size="sm" className="w-full" disabled={!newContent.trim() && !attachment}>
                确认添加
              </Button>
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
                <NoteItem key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} onParseAttachment={onParseAttachment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({ note, onUpdate, onDelete, onParseAttachment }: {
  note: TradeNote;
  onUpdate: (id: string, updates: { content?: string; isPinned?: boolean; aiSummary?: string }) => void;
  onDelete: (id: string) => void;
  onParseAttachment?: (content: string, fileName: string, fileType: string, userPrompt?: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [showPreview, setShowPreview] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleSave = () => {
    if (editContent.trim() && editContent !== note.content) {
      onUpdate(note.id, { content: editContent.trim() });
    }
    setEditing(false);
  };

  const handleReparse = async () => {
    if (!note.attachmentUrl || !onParseAttachment) return;
    setParsing(true);
    try {
      let content: string;
      if (note.attachmentType?.startsWith('image/')) {
        content = note.attachmentUrl;
      } else {
        const base64Data = note.attachmentUrl.split(',')[1];
        content = atob(base64Data);
      }
      const summary = await onParseAttachment(content, note.attachmentName || 'file', note.attachmentType || 'text/plain');
      onUpdate(note.id, { aiSummary: summary });
      toast.success('AI 重新分析完成');
    } catch {
      toast.error('AI 分析失败');
    } finally {
      setParsing(false);
    }
  };

  const isImage = note.attachmentType?.startsWith('image/');

  return (
    <>
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

          {/* Attachment indicator */}
          {note.attachmentName && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {isImage ? <Image className="w-3 h-3 text-primary" /> : <FileText className="w-3 h-3 text-primary" />}
              <span className="text-[10px] font-mono text-muted-foreground truncate">{note.attachmentName}</span>
              {isImage && note.attachmentUrl && (
                <button onClick={() => setShowPreview(true)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />查看
                </button>
              )}
            </div>
          )}

          {/* AI summary */}
          {note.aiSummary && (
            <div className="mt-1.5 bg-primary/5 border border-primary/15 rounded px-2 py-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <Sparkles className="w-2.5 h-2.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary">AI 分析</span>
              </div>
              <div className="text-[11px] whitespace-pre-wrap text-foreground/80">{note.aiSummary}</div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground font-mono">{NOTE_CATEGORY_LABELS[note.category]}</span>
            {note.isPinned && <Pin className="w-2.5 h-2.5 text-primary" />}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {note.attachmentUrl && onParseAttachment && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleReparse} disabled={parsing} title="重新 AI 分析">
              {parsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
            </Button>
          )}
          <Button
            variant="ghost" size="sm" className="h-6 w-6 p-0"
            onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
            title={note.isPinned ? '取消置顶' : '置顶'}
          >
            {note.isPinned ? <PinOff className="w-3 h-3 text-primary" /> : <Pin className="w-3 h-3 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(note.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Image preview dialog */}
      {isImage && note.attachmentUrl && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono">{note.attachmentName}</DialogTitle>
            </DialogHeader>
            <img src={note.attachmentUrl} alt={note.attachmentName || ''} className="w-full rounded-md" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
