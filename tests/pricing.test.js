const { readFileSync } = require('node:fs');
const path = require('node:path');

function run() {
  console.log('Running pricing catalog checks...');
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

  console.log('Pricing catalog checks passed.');
}

run();
