import { supabaseInstanceRepo } from '../lib/supabaseInstanceRepo';

export async function listUserInstances(token: string | null) {
  // The repository factory was removed from the current architecture.
  // Keep this service as the single entry point for listing instances.
  // Authentication/ownership filtering is enforced by the API/database layer.
  void token;
  return supabaseInstanceRepo.list();
}
