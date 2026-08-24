import type { ProcedureInstance } from '../types/procedure';
import type { FormAnswers } from '../types/form';
import { readInstances, writeInstances } from './serverStorage';

function generateId(prefix = 'pi') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export const serverInstanceRepo = {
  list(): ProcedureInstance[] {
    return readInstances();
  },
  get(id: string): ProcedureInstance | null {
    const all = readInstances();
    return all.find((i) => i.id === id) || null;
  },
  create(procedureId: string, procedureSlug: string, answers: FormAnswers = {}, userId?: string): ProcedureInstance {
    const all = readInstances();
    const now = new Date().toISOString();
    const inst: ProcedureInstance = {
      id: generateId('pi'),
      procedureId,
      procedureSlug,
      status: 'in_progress',
      answers,
      createdAt: now,
      updatedAt: now,
      userId: userId || undefined,
    };
    all.push(inst);
    writeInstances(all);
    return inst;
  },
  update(id: string, patch: Partial<ProcedureInstance>): ProcedureInstance | null {
    const all = readInstances();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = all[idx];
    const updated: ProcedureInstance = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    writeInstances(all);
    return updated;
  },
  remove(id: string): boolean {
    const all = readInstances();
    const filtered = all.filter((i) => i.id !== id);
    writeInstances(filtered);
    return true;
  },
};
