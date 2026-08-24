import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

type StoredInstance = Record<string, unknown>;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INSTANCES_FILE)) fs.writeFileSync(INSTANCES_FILE, '[]');
}

export function readInstances(): StoredInstance[] {
  try {
    ensureDir();
    const raw = fs.readFileSync(INSTANCES_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredInstance => typeof item === 'object' && item !== null && !Array.isArray(item));
  } catch (e) {
    return [];
  }
}

export function writeInstances(data: StoredInstance[]): void {
  ensureDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2));
}
