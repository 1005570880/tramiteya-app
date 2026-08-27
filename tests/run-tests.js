// Repository-level smoke tests. Keep this runner dependency-free (beyond the `typescript`
// dev dependency already used by other specs) so CI can execute it before the Next.js build.

const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load a TypeScript module by transpiling it to CommonJS and running it in a sandbox.
// `sandbox` lets callers inject globals (e.g. a `window`/`localStorage` shim) that the
// module expects at runtime.
function loadTsModule(relativePath, sandbox = {}) {
  const source = readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, { module, exports: module.exports, require, console, ...sandbox });
  return module.exports;
}

// Minimal in-memory localStorage so the browser-oriented procedureStorage module works in Node.
function createLocalStorageShim() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

function testProcedureStorage() {
  console.log('Running procedureStorage tests...');
  const windowShim = { localStorage: createLocalStorageShim() };
  const { procedureStorage } = loadTsModule('src/lib/procedureStorage.ts', { window: windowShim });

  const inst = procedureStorage.create('proc_test', 'proc-test', { a: 'b' });
  assert(inst.procedureSlug === 'proc-test', 'create slug');
  const fetched = procedureStorage.get(inst.id);
  assert(fetched && fetched.id === inst.id, 'get instance');
  const list = procedureStorage.list();
  assert(Array.isArray(list) && list.length === 1, 'list is array with one item');
  procedureStorage.update(inst.id, { status: 'document_ready' });
  const updated = procedureStorage.get(inst.id);
  assert(updated && updated.status === 'document_ready', 'update status');
  procedureStorage.remove(inst.id);
  const after = procedureStorage.get(inst.id);
  assert(after === null, 'remove');
  console.log('procedureStorage checks passed.');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function testPricingCatalog() {
  console.log('Running production pricing checks...');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'data', 'pricing.ts'), 'utf8');

  if (/launchPrice|regularPrice/i.test(source)) {
    throw new Error('El catálogo no debe contener precios de lanzamiento.');
  }

  const required = {
    'derecho-peticion-simple': 49900,
    'derecho-peticion-entidad': 69900,
    'eliminacion-comparendo': 79900,
    'eliminacion-reporte-negativo': 79900,
    'reclamacion-administrativa': 79900,
    'recurso-administrativo': 89900,
    'tutela-derecho-peticion': 89900,
    'tutela-salud-vital-proceso': 99900,
    'contrato-arrendamiento-comercial': 129900,
  };

  for (const [id, price] of Object.entries(required)) {
    const pattern = new RegExp(`['\\"]${id}['\\"]\\s*:\\s*\\{\\s*price:\\s*${price}\\b`);
    if (!pattern.test(source)) {
      throw new Error(`Precio vigente incorrecto o ausente: ${id}`);
    }
  }
  console.log('Production pricing checks passed.');
}

testProcedureStorage();
testPricingCatalog();
require('./simit-golden-structure.test.js');
console.log('All TrámiteYa smoke tests passed.');
