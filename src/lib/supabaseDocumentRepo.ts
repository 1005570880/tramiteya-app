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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const supabaseDocumentRepo: DocumentRepository = {
  async create(document) {
    const supabase = getSupabaseServer();
    // Supabase documents.id is UUID. The document engine may intentionally
    // create local descriptive ids (doc_...). Never send those ids to Postgres.
    const id = crypto.randomUUID();
    // Guest/local procedure instances use pi_... ids and cannot be stored in a
    // UUID foreign-key column. Persist the document independently instead.
    const instanceId = isUuid(document.instanceId) ? document.instanceId : null;
    const payload = {
      id,
      title: document.title,
      procedure_id: document.procedureId,
      instance_id: instanceId,
      content: document.content,
      created_at: new Date().toISOString(),
      meta: {
        ...(document as any).meta || {},
        version: document.version,
        generatedAt: document.generatedAt,
        sourceVersion: document.sourceVersion,
        snapshot: document.snapshot,
        sourceDocumentId: document.id,
      },
    };

    // The current Supabase client is intentionally untyped, so the generic
    // table schema resolves inserts to never[]. Keep this boundary local.
    const documentsTable = supabase.from('documents') as any;
    const { data, error } = await documentsTable
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return mapRow(data || payload);
  },

  async get(id) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();
    return error ? null : mapRow(data);
  },

  async listByInstance(instanceId) {
    const supabase = getSupabaseServer();
    if (!isUuid(instanceId)) return [];
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true });
    return error ? [] : (data || []).map(mapRow);
  },
};
