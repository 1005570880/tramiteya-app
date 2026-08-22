import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export function listMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}
