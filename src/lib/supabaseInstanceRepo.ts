import { getSupabaseServer } from './supabaseServerClient';
import type { InstanceRepository } from './repository';
import type { ProcedureInstance } from '../types/procedure';
import type { FormAnswers } from '../types/form';

function generateId(prefix = 'pi') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export const supabaseInstanceRepo: InstanceRepository = {
  async create(procedureId: string, procedureSlug: string, answers = {}, userId?: string) {
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const id = generateId('pi');
    const payload = {
      id,
      user_id: userId || null,
      procedure_id: procedureId || null,
      procedure_slug: procedureSlug,
      status: 'in_progress',
      answers,
      created_at: now,
      updated_at: now,
    };
    const procedureInstancesTable = supabase.from('procedure_instances') as any;
    const { error } = await procedureInstancesTable.insert(payload);
    if (error) throw error;
    const inst: ProcedureInstance = {
      id,
      procedureId: procedureId || '',
      procedureSlug,
      status: 'in_progress',
      answers: answers as FormAnswers,
      createdAt: now,
      updatedAt: now,
      userId: userId || undefined,
    };
    return inst;
  },

  async get(id: string) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('procedure_instances').select('*').eq('id', id).limit(1).single();
    if (error) return null;
    const row: any = data;
    const inst: ProcedureInstance = {
      id: row.id,
      procedureId: row.procedure_id,
      procedureSlug: row.procedure_slug,
      status: row.status,
      answers: row.answers || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      userId: row.user_id || undefined,
      document: row.document || undefined,
    };
    return inst;
  },

  async list() {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('procedure_instances').select('*');
    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      procedureId: row.procedure_id,
      procedureSlug: row.procedure_slug,
      status: row.status,
      answers: row.answers || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      userId: row.user_id || undefined,
      document: row.document || undefined,
    }));
  },

  async update(id: string, patch: Partial<ProcedureInstance>) {
    const supabase = getSupabaseServer();
    const safePatch: Record<string, unknown> = {};

    if (patch.procedureId !== undefined) safePatch.procedure_id = patch.procedureId;
    if (patch.procedureSlug !== undefined) safePatch.procedure_slug = patch.procedureSlug;
    if (patch.status !== undefined) safePatch.status = patch.status;
    if (patch.answers !== undefined) safePatch.answers = patch.answers;
    if (patch.completedAt !== undefined) safePatch.completed_at = patch.completedAt;
    if (patch.document !== undefined) safePatch.document = patch.document;
    if (patch.updatedAt !== undefined) safePatch.updated_at = patch.updatedAt;

    // Server-controlled timestamp; never trust a client-supplied updatedAt.
    safePatch.updated_at = new Date().toISOString();

    const procedureInstancesTable = supabase.from('procedure_instances') as any;
    const { error } = await procedureInstancesTable.update(safePatch).eq('id', id);
    if (error) return null;
    return this.get(id);
  },

  async remove(id: string) {
    const supabase = getSupabaseServer();
    const procedureInstancesTable = supabase.from('procedure_instances') as any;
    const { error } = await procedureInstancesTable.delete().eq('id', id);
    if (error) return false;
    return true;
  },
};
