const STORAGE_KEY = 'tramiteya:instances';

import type { ProcedureInstance } from '../types/procedure';

function generateId(prefix = 'inst') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function safeParse(raw: string | null): ProcedureInstance[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProcedureInstance[];
  } catch (e) {
    return [];
  }
}

export const procedureStorage = {
  create(procedureId: string, procedureSlug: string, answers: Record<string, unknown> = {}) {
    const all = safeParse(localStorage.getItem(STORAGE_KEY));
    const now = new Date().toISOString();
    const inst: ProcedureInstance = {
      id: generateId('pi'),
      procedureId,
      procedureSlug,
      status: 'in_progress',
      answers: answers as any,
      createdAt: now,
      updatedAt: now,
    };
    all.push(inst);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return inst;
  },

  get(id: string) {
    const all = safeParse(localStorage.getItem(STORAGE_KEY));
    return all.find((i) => i.id === id) || null;
  },

  list() {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  },

  update(id: string, patch: Partial<ProcedureInstance>) {
    const all = safeParse(localStorage.getItem(STORAGE_KEY));
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = all[idx];
    const updated: ProcedureInstance = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return updated;
  },

  remove(id: string) {
    const all = safeParse(localStorage.getItem(STORAGE_KEY));
    const filtered = all.filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};
