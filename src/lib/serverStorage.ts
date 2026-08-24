import fs from 'fs';
import path from 'path';
import type { ProcedureInstance } from '../types/procedure';

const DATA_DIR = path.join(process.cwd(), '.data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

type StoredInstance = ProcedureInstance;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INSTANCES_FILE)) fs.writeFileSync(INSTANCES_FILE, '[]');
}

function isStoredInstance(item: unknown): item is StoredInstance {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
  const value = item as Record<string, unknown>;
  return typeof value.id === 'string'
    && typeof value.procedureId === 'string'
    && typeof value.procedureSlug === 'string'
    && typeof value.status === 'string'
    && typeof value.answers === 'object'
    && value.answers !== null
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

export function readInstances(): StoredInstance[] {
  try {
    ensureDir();
    const raw = fs.readFileSync(INSTANCES_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredInstance);
  } catch {
    return [];
  }
}

export function writeInstances(data: StoredInstance[]): void {
  ensureDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2));
}
