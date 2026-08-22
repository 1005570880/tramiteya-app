import { supabaseInstanceRepo } from './supabaseInstanceRepo';
import { supabaseDocumentRepo } from './supabaseDocumentRepo';
import { procedureStorage } from './procedureStorage';
import type { FormAnswers } from '../types/form';

export const authenticatedRepository = {
  async createInstance(procedureId: string, slug: string, answers: FormAnswers, userId: string) {
    return supabaseInstanceRepo.create(procedureId, slug, answers, userId);
  },
  async getInstance(id: string) { return supabaseInstanceRepo.get(id); },
  async listInstances() { return supabaseInstanceRepo.list(); },
  async updateInstance(id: string, patch: any) { return supabaseInstanceRepo.update(id, patch); },
  async saveDocument(document: any) { return supabaseDocumentRepo.create(document); },
  async getDocument(id: string) { return supabaseDocumentRepo.get(id); },
  async listDocuments(instanceId: string) { return supabaseDocumentRepo.listByInstance?.(instanceId) || []; },
  fallback: procedureStorage,
};
