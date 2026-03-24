import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TradeNote, NoteCategory } from '@/types/notes';
import type { User } from '@supabase/supabase-js';

export function useNotesStore(user: User, activeIdentityId: string) {
  const [notes, setNotes] = useState<TradeNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    if (!activeIdentityId) return;
    setLoading(true);
    const { data } = await supabase
      .from('trade_notes')
      .select('*')
      .eq('identity_id', activeIdentityId)
      .order('is_pinned', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    setNotes((data ?? []).map(r => ({
      id: r.id,
      identityId: r.identity_id,
      category: r.category as NoteCategory,
      content: r.content,
      priority: r.priority,
      isPinned: r.is_pinned,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      attachmentUrl: r.attachment_url,
      attachmentType: r.attachment_type,
      attachmentName: r.attachment_name,
      aiSummary: r.ai_summary,
    })));
    setLoading(false);
  }, [activeIdentityId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = useCallback(async (note: {
    category: NoteCategory;
    content: string;
    isPinned?: boolean;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    aiSummary?: string;
  }) => {
    const { data } = await supabase.from('trade_notes').insert({
      user_id: user.id,
      identity_id: activeIdentityId,
      category: note.category,
      content: note.content,
      is_pinned: note.isPinned ?? false,
      attachment_url: note.attachmentUrl ?? null,
      attachment_type: note.attachmentType ?? null,
      attachment_name: note.attachmentName ?? null,
      ai_summary: note.aiSummary ?? null,
    }).select().single();
    if (data) {
      const newNote: TradeNote = {
        id: data.id, identityId: data.identity_id, category: data.category as NoteCategory,
        content: data.content, priority: data.priority, isPinned: data.is_pinned,
        createdAt: data.created_at, updatedAt: data.updated_at,
        attachmentUrl: data.attachment_url,
        attachmentType: data.attachment_type,
        attachmentName: data.attachment_name,
        aiSummary: data.ai_summary,
      };
      setNotes(prev => [newNote, ...prev].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }));
    }
  }, [user.id, activeIdentityId]);

  const updateNote = useCallback(async (id: string, updates: {
    content?: string;
    isPinned?: boolean;
    category?: NoteCategory;
    aiSummary?: string;
  }) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;
    await supabase.from('trade_notes').update(dbUpdates).eq('id', id);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    await supabase.from('trade_notes').delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const parseAttachment = useCallback(async (content: string, fileName: string, fileType: string, userPrompt?: string) => {
    const { data, error } = await supabase.functions.invoke('parse-attachment', {
      body: { content, fileName, fileType, userPrompt },
    });
    if (error) throw error;
    return data.summary as string;
  }, []);

  return { notes, loading, addNote, updateNote, deleteNote, parseAttachment };
}
