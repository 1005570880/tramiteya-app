import { procedures } from '../../data/procedures';
import { readInstances, writeInstances } from '../../lib/serverStorage';
import type { Procedure } from '../../types';
import type { ProcedureInstance } from '../../types/procedure';
import type { FormAnswers } from '../../types/form';
import { generateDocumentServer } from '../../services/documentService';

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
  create(procedureId: string, procedureSlug: string, answers: FormAnswers = {}, userId?: string) {
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
    const proc = procedures.find((p) => p.slug === inst.procedureSlug);
    if (!proc) throw new Error('Procedure not found');
    const doc = await generateDocumentServer({ procedure: proc as Procedure, answers: inst.answers });
    const updated = this.update(id, { document: doc, status: 'document_ready', completedAt: new Date().toISOString() });
    return { instance: updated, document: doc };
  }
};
