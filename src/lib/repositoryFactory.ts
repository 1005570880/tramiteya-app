import { supabaseInstanceRepo } from './supabaseInstanceRepo';
import { supabaseProcedureRepo } from './supabaseProcedureRepo';
import { supabaseDocumentRepo } from './supabaseDocumentRepo';
import { serverInstanceRepo } from './serverInstanceRepo';
import { procedures } from '../data/procedures';

export function getRepositoryFactory() {
  const useSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  return {
    getInstanceRepo() {
      return useSupabase ? supabaseInstanceRepo : serverInstanceRepo;
    },
    getProcedureRepo() {
      return useSupabase ? supabaseProcedureRepo : {
        listProcedures: async () => procedures,
        getProcedureBySlug: async (slug: string) => procedures.find((p) => p.slug === slug) || null,
      };
    },
    getDocumentRepo() {
      return useSupabase ? supabaseDocumentRepo : null;
    }
  };
}
