import { getSupabaseServer } from './supabaseServerClient';
import type { ProcedureRepository } from './repository';
import type { Procedure } from '../types';

export const supabaseProcedureRepo: ProcedureRepository = {
  async listProcedures() {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('procedures').select('*');
    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      estimatedTime: row.estimated_time,
      available: !!row.available,
    }));
  },

  async getProcedureBySlug(slug: string) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('procedures').select('*').eq('slug', slug).limit(1).single();
    if (error) return null;
    const row: any = data;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      estimatedTime: row.estimated_time,
      available: !!row.available,
    } as Procedure;
  },
};
