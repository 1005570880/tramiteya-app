import { getRepositoryFactory } from '../lib/repositoryFactory';

const factory = getRepositoryFactory();

export async function listUserInstances(token: string | null) {
  // server helper: fetch instances for current user via repository
  const repo = factory.getInstanceRepo();
  const list = await repo.list();
  // if token present and supabase used, ownership filtering should be done in repo
  return list;
}
