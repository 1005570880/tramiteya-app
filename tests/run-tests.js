// Repository-level smoke tests. Keep this runner dependency-free so CI can execute it before Next.js build.

const { readFileSync } = require('node:fs');
const path = require('node:path');

function testProcedureStorageSource() {
  console.log('Running procedureStorage source checks...');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'procedureStorage.ts'), 'utf8');
  for (const method of ['create', 'get', 'list', 'update', 'markDownloaded', 'remove']) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(source)) {
      throw new Error(`procedureStorage missing method: ${method}`);
    }
  }
  if (!source.includes("STORAGE_KEY = 'tramiteya:instances'")) {
    throw new Error('procedureStorage storage key missing.');
  }
  console.log('procedureStorage source checks passed.');
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

testProcedureStorageSource();
testPricingCatalog();
console.log('All TrámiteYa smoke tests passed.');
