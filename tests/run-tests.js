// Repository-level smoke tests. Keep this runner dependency-free so CI can execute it before Next.js build.

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { procedureStorage } = require('../src/lib/procedureStorage');

function testProcedureStorage() {
  console.log('Running procedureStorage tests...');
  const inst = procedureStorage.create('proc_test', 'proc-test', { a: 'b' });
  console.assert(inst.procedureSlug === 'proc-test', 'create slug');
  const fetched = procedureStorage.get(inst.id);
  console.assert(fetched && fetched.id === inst.id, 'get instance');
  const list = procedureStorage.list();
  console.assert(Array.isArray(list), 'list is array');
  procedureStorage.update(inst.id, { status: 'document_ready' });
  const updated = procedureStorage.get(inst.id);
  console.assert(updated && updated.status === 'document_ready', 'update status');
  procedureStorage.remove(inst.id);
  const after = procedureStorage.get(inst.id);
  console.assert(after === null, 'remove');
  console.log('procedureStorage checks passed.');
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
    const pattern = new RegExp(`['\"]${id}['\"]\\s*:\\s*\\{\\s*price:\\s*${price}\\b`);
    if (!pattern.test(source)) {
      throw new Error(`Precio vigente incorrecto o ausente: ${id}`);
    }
  }
  console.log('Production pricing checks passed.');
}

testProcedureStorage();
testPricingCatalog();
console.log('All TrámiteYa smoke tests passed.');
