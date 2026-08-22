import { getSupabaseServer } from './supabaseServerClient';
import type { DocumentRepository } from './repository';
import type { DocumentItem } from '../types/procedure';

export const supabaseDocumentRepo: DocumentRepository = {
  async create(document) {
    const supabase = getSupabaseServer();
    const id = document.id || `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const payload = {
      id,
      title: document.title,
      procedure_id: document.procedureId,
      instance_id: document.instanceId || null,
      content: document.content,
      created_at: document.createdAt || new Date().toISOString(),
      meta: (document as any).meta || {},
    };
    const { error } = await supabase.from('documents').insert(payload);
    if (error) throw error;
    return { id: payload.id, title: payload.title, procedureId: payload.procedure_id, content: payload.content, createdAt: payload.created_at, status: 'ready' } as DocumentItem;
  },

  async get(id: string) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).limit(1).single();
    if (error) return null;
    const row: any = data;
    return { id: row.id, title: row.title, procedureId: row.procedure_id, content: row.content, createdAt: row.created_at, status: 'ready' } as DocumentItem;
  },
};
