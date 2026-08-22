import type { ProcedureInstance } from '../types/procedure';
import { readInstances, writeInstances } from './serverStorage';

function generateId(prefix = 'pi') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export const serverInstanceRepo = {
  list() {
    return readInstances();
  },
  get(id: string) {
    const all = readInstances();
    return all.find((i) => i.id === id) || null;
  },
  create(procedureId: string, procedureSlug: string, answers = {}, userId?: string) {
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
  update(id: string, patch: Partial<ProcedureInstance>) {
    const all = readInstances();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = all[idx];
    const updated: ProcedureInstance = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    writeInstances(all);
    return updated;
  },
  remove(id: string) {
    const all = readInstances();
    const filtered = all.filter((i) => i.id !== id);
    writeInstances(filtered);
    return true;
  },
  async generateDocumentAndAttach(id: string) {
    const inst = this.get(id);
    if (!inst) throw new Error('Instance not found');
    // basic document generation
    const doc = {
      id: `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title: `${inst.procedureSlug} - Documento generado`,
      procedureId: inst.procedureId,
      content: `Respuestas: ${JSON.stringify(inst.answers, null, 2)}`,
      createdAt: new Date().toISOString(),
      status: 'ready',
    };
    const updated = this.update(id, { document: doc, status: 'document_ready', completedAt: new Date().toISOString() } as any);
    return { instance: updated, document: doc };
  }
};
