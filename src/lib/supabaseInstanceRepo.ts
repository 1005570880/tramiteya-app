import { getSupabaseServer } from './supabaseServerClient';
import type { InstanceRepository } from './repository';
import type { ProcedureInstance } from '../types/procedure';
import type { FormAnswers } from '../types/form';

function generateId(prefix = 'pi') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export const supabaseInstanceRepo: InstanceRepository = {
  async create(procedureId: string, procedureSlug: string, answers: FormAnswers = {}, userId?: string) {
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

    // The generated Supabase client does not currently carry the database
    // schema, so its table inference can resolve inserts/updates to never[].
    // Keep this boundary explicit until generated DB types are introduced.
    const instancesTable = supabase.from('procedure_instances') as any;
    const { error } = await instancesTable.insert(payload);
    if (error) throw error;
    return {
      id,
      procedureId: procedureId || '',
      procedureSlug,
      status: 'in_progress' as const,
      answers,
      createdAt: now,
      updatedAt: now,
      userId: userId || undefined,
    } satisfies ProcedureInstance;
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
    return (data || []).map((row: any): ProcedureInstance => ({
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
    const safePatch = { ...patch } as Record<string, unknown>;
    delete safePatch.userId;
    delete safePatch.createdAt;
    delete safePatch.id;
    safePatch.updated_at = new Date().toISOString();
    const instancesTable = supabase.from('procedure_instances') as any;
    const { error } = await instancesTable.update(safePatch).eq('id', id);
    if (error) return null;
    return this.get(id);
  },

  async remove(id: string) {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('procedure_instances').delete().eq('id', id);
    if (error) return false;
    return true;
  },
};
