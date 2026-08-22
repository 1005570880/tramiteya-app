import type { ProcedureInstance } from '../types/procedure';
import type { FormAnswers } from '../types/form';

const STORAGE_KEY = 'tramiteya:instances';

function read(): ProcedureInstance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProcedureInstance[]) : [];
  } catch {
    return [];
  }
}

function write(instances: ProcedureInstance[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export const procedureStorage = {
  create(procedureId: string, procedureSlug: string, answers: FormAnswers = {}) {
    const all = read();
    const now = new Date().toISOString();
    const instance: ProcedureInstance = {
      id: `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      procedureId,
      procedureSlug,
      status: 'in_progress',
      answers,
      createdAt: now,
      updatedAt: now,
    };
    write([...all, instance]);
    return instance;
  },

  get(id: string): ProcedureInstance | null {
    return read().find((instance) => instance.id === id) ?? null;
  },

  list(): ProcedureInstance[] {
    return read();
  },

  update(id: string, patch: Partial<ProcedureInstance>): ProcedureInstance | null {
    const all = read();
    const index = all.findIndex((instance) => instance.id === id);
    if (index === -1) return null;

    const updated: ProcedureInstance = {
      ...all[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    write(all);
    return updated;
  },

  remove(id: string): boolean {
    const all = read();
    const filtered = all.filter((instance) => instance.id !== id);
    write(filtered);
    return filtered.length !== all.length;
  },
};
