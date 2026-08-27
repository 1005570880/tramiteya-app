const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'legalCaseAnalysis.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: sourcePath,
}).outputText;

const moduleShim = { exports: {} };
new Function('require', 'module', 'exports', transpiled)(require, moduleShim, moduleShim.exports);
const { analyzeTemporalCase } = moduleShim.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('Running traffic temporal/legal timeline checks...');

const oldCase = analyzeTemporalCase({
  comparendo: '1206707074',
  fecha: '17/07/2012',
  organismo: 'SECRETARÍA DE TRÁNSITO Y TRANSPORTE DPTAL SUCRE - SAMPUÉS',
  estado: 'multa',
});
assert(oldCase.caducityExpiryDate === '17/07/2013', 'Caducity deadline must be one year after the fact.');
assert(oldCase.initialExpiryDate === '17/07/2015', 'Prescription deadline must be three years after the fact.');
assert(oldCase.caducityStatus === 'HIPOTESIS_OBJETIVA', 'Missing decision/audience evidence must leave caducity as an objective hypothesis.');
assert(oldCase.evidenceQuestions.some((q) => /audiencia efectiva|decisión/i.test(q)), 'Caducity evidence request is missing.');

const lateDecision = analyzeTemporalCase({
  comparendo: 'X-SA',
  fecha: '01/01/2023',
  organismo: 'TEST',
  estado: 'sancion',
  fechaResolucion: '15/02/2024',
});
assert(lateDecision.caducityStatus === 'CONFIGURADO', 'A decision after the one-year deadline must flag a caducity issue.');

const currentCase = analyzeTemporalCase({
  comparendo: '2023-40590067-SA',
  fecha: '01/11/2023',
  organismo: 'INSTITUTO MUNICIPAL DE TRÁNSITO Y TRANSPORTE DE FUNDACIÓN',
  estado: 'sancion',
});
assert(currentCase.caducityExpiryDate === '01/11/2024', 'Current case caducity deadline must be calculated independently.');
assert(currentCase.initialExpiryDate === '01/11/2026', 'Current case prescription deadline must remain three years.');
assert(currentCase.mandamientoNotificationDate === null, 'Missing payment-order notification must remain unproven.');

console.log('Traffic temporal/legal timeline checks passed.');
