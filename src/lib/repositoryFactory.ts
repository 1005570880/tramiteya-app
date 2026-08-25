import type { DocumentRepository, InstanceRepository, ProcedureRepository } from './repository';
import { procedures } from '../data/procedures';
import { supabaseDocumentRepo } from './supabaseDocumentRepo';
import { supabaseInstanceRepo } from './supabaseInstanceRepo';
import { supabaseProcedureRepo } from './supabaseProcedureRepo';
import { serverInstanceRepo } from './serverInstanceRepo';

export interface RepositoryFactory {
  getInstanceRepo(): InstanceRepository;
  getProcedureRepo(): ProcedureRepository;
  getDocumentRepo(): DocumentRepository | null;
}

export function getRepositoryFactory(): RepositoryFactory {
  const useSupabase = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  return {
    getInstanceRepo(): InstanceRepository {
      return useSupabase ? supabaseInstanceRepo : serverInstanceRepo;
    },
    getProcedureRepo(): ProcedureRepository {
      if (useSupabase) return supabaseProcedureRepo;
      return {
        listProcedures: async () => procedures,
        getProcedureBySlug: async (slug: string) => procedures.find((p) => p.slug === slug) || null,
      };
    },
    getDocumentRepo(): DocumentRepository | null {
      return useSupabase ? supabaseDocumentRepo : null;
    },
  };
}
