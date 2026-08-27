const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/lib/trafficDocumentTemplates.ts');
const source = fs.readFileSync(file, 'utf8');

const required = [
  'SOLICITUD PRINCIPAL — ELIMINACIÓN/CANCELACIÓN DE LA MULTA',
  'termine y archive la obligación',
  'cancelación, eliminación, depuración o actualización',
  'SIMIT',
  'No se afirma como hecho probado',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing legal-relief invariant: ${token}`);
  }
}

console.log('Traffic deletion-relief regression checks passed.');
