import type { ProcedureInstance, Procedure, DocumentItem } from '../types/procedure';
import type { FormAnswers } from '../types/form';
export interface ProcedureRepository { listProcedures(): Promise<Procedure[]>; getProcedureBySlug(slug: string): Promise<Procedure | null>; }
export interface InstanceRepository { create(procedureId: string, procedureSlug: string, answers?: FormAnswers, userId?: string): Promise<ProcedureInstance>; get(id: string): Promise<ProcedureInstance | null>; list(): Promise<ProcedureInstance[]>; update(id: string, patch: Partial<ProcedureInstance>): Promise<ProcedureInstance | null>; remove(id: string): Promise<boolean>; }
export interface DocumentRepository { create(document: Omit<DocumentItem, 'id' | 'createdAt'>): Promise<DocumentItem>; get(id: string): Promise<DocumentItem | null>; listByInstance?(instanceId: string): Promise<DocumentItem[]>; }
export function createRepositories(env: any) { return null; }
