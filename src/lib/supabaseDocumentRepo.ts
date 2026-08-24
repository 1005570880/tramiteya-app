import { getSupabaseServer } from './supabaseServerClient';
import type { DocumentRepository } from './repository';
import type { DocumentItem, DocumentSnapshot } from '../types/procedure';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const id = UUID_RE.test(document.id) ? document.id : crypto.randomUUID();
    const createdAt = document.createdAt || new Date().toISOString();

    // The application uses procedure slugs as local procedure ids, while Supabase
    // stores procedures.id as UUID. Resolve the slug before inserting the FK.
    let procedureId: string | null = null;
    if (document.procedureId) {
      if (UUID_RE.test(document.procedureId)) {
        procedureId = document.procedureId;
      } else {
        const { data: procedure } = await supabase
          .from('procedures')
          .select('id')
          .eq('slug', document.procedureId)
          .limit(1)
          .maybeSingle();
        procedureId = procedure?.id || null;
      }
    }

    // Guest/local instances use ids such as inst_... which are not UUIDs and
    // cannot be stored in the Supabase FK. The document remains valid without it.
    const instanceId = document.instanceId && UUID_RE.test(document.instanceId) ? document.instanceId : null;

    const payload = {
      id,
      title: document.title,
      procedure_id: procedureId,
      instance_id: instanceId,
      content: document.content,
      created_at: createdAt,
      updated_at: createdAt,
      meta: {
        version: document.version,
        generatedAt: document.generatedAt,
        sourceVersion: document.sourceVersion,
        snapshot: document.snapshot,
        procedureSlug: document.procedureId,
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
