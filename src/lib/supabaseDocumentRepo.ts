import { getSupabaseServer } from './supabaseServerClient';
import type { DocumentRepository } from './repository';
import type { DocumentItem, DocumentSnapshot } from '../types/procedure';

function mapRow(row: any): DocumentItem {
  return {
    id: row.id,
    title: row.title,
    procedureId: row.procedure_id,
    content: row.content,
    createdAt: row.created_at,
    status: 'ready',
    version: row.meta?.version,
    generatedAt: row.meta?.generatedAt,
    instanceId: row.instance_id || undefined,
    sourceVersion: row.meta?.sourceVersion,
    snapshot: row.meta?.snapshot as DocumentSnapshot | undefined,
  };
}

export const supabaseDocumentRepo: DocumentRepository = {
  async create(document) {
    const supabase = getSupabaseServer();
    const id = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const createdAt = new Date().toISOString();
    const payload = {
      id,
      title: document.title,
      procedure_id: document.procedureId,
      instance_id: document.instanceId || null,
      content: document.content,
      created_at: createdAt,
      meta: {
        version: document.version,
        generatedAt: document.generatedAt,
        sourceVersion: document.sourceVersion,
        snapshot: document.snapshot,
      },
    };
    const documentsTable = supabase.from('documents') as any;
    const { data, error } = await documentsTable.insert(payload).select('*').single();
    if (error) throw error;
    return mapRow(data || payload);
  },

  async get(id) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).limit(1).single();
    return error ? null : mapRow(data);
  },

  async listByInstance(instanceId) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('documents').select('*').eq('instance_id', instanceId).order('created_at', { ascending: true });
    return error ? [] : (data || []).map(mapRow);
  },
};
