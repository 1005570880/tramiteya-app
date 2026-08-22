import type { DocumentItem, ProcedureInstance } from '../types/procedure';

/**
 * Persistence boundary for Phase 6.2.
 * The browser fallback remains available while the authenticated Supabase
 * adapter is wired to the project's concrete schema/environment.
 */
export interface DocumentPersistence {
  save(instance: ProcedureInstance, document: DocumentItem): Promise<void>;
  get(instanceId: string): Promise<DocumentItem | null>;
  list(instanceId: string): Promise<DocumentItem[]>;
}

const KEY = 'tramiteya:documents';

function read(): Record<string, DocumentItem[]> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export const localDocumentPersistence: DocumentPersistence = {
  async save(instance, document) {
    const all = read();
    all[instance.id] = [...(all[instance.id] || []).filter((d) => d.id !== document.id), document];
    window.localStorage.setItem(KEY, JSON.stringify(all));
  },
  async get(instanceId) {
    const docs = read()[instanceId] || [];
    return docs[docs.length - 1] || null;
  },
  async list(instanceId) { return read()[instanceId] || []; },
};
