import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INSTANCES_FILE)) fs.writeFileSync(INSTANCES_FILE, '[]');
}

export function readInstances(): any[] {
  try {
    ensureDir();
    const raw = fs.readFileSync(INSTANCES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
}

export function writeInstances(data: any[]) {
  ensureDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2));
}
