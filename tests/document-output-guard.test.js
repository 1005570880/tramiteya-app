const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Static regression test: the generator must no longer append internal analysis blocks.
const generatorPath = path.join(process.cwd(), 'src/lib/generateDocument.ts');
const generator = fs.readFileSync(generatorPath, 'utf8');

assert.ok(!generator.includes("'FUNDAMENTO NORMATIVO DE REFERENCIA', ...normativeLines"));
assert.ok(!generator.includes('function appendLegalBasis'));
assert.ok(generator.includes('assertFinalDocument'));
assert.ok(generator.includes('No incluyas LEGAL_CONTEXT'));
assert.ok(generator.includes('No incluyas secciones llamadas FUNDAMENTO NORMATIVO DE REFERENCIA'));

const guardPath = path.join(process.cwd(), 'src/lib/documentOutputGuard.ts');
const guard = fs.readFileSync(guardPath, 'utf8');
assert.ok(guard.includes('FUNDAMENTO NORMATIVO DE REFERENCIA'));
assert.ok(guard.includes('CRITERIO DE SELECCIÓN'));
assert.ok(guard.includes('UNRESOLVED_PLACEHOLDER_PATTERNS'));

console.log('document-output-guard tests passed');
