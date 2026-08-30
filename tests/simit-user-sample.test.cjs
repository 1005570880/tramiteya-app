const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'simitOfficialParser.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const parserModule = { exports: {} };
vm.runInNewContext(output, { module: parserModule, exports: parserModule.exports, require, console });
const { parseOfficialSimitText } = parserModule.exports;

const text = `ESTADO DE CUENTA\nCédula:\n64553194\nFecha de expedición:\n05/08/2025\nComparendos y multas\n# Número multa Fecha Secretaría Infracción Estado Valor total\n1. 47001000000046390657 30/11/2024 15:39:00 Santa Marta D02 Pendiente $ 1,145,029\n2. 70670001000049917765 22/05/2025 13:35:00 Sampues - Dptal Sucre D02 Pendiente $ 1,207,860\n3. 70670001000049917774 22/05/2025 14:45:00 Sampues - Dptal Sucre D02 Pendiente $ 1,207,860\n4. 70670001000049917442 19/05/2025 11:54:00 Sampues - Dptal Sucre C29 Pendiente $ 603,930\n5. 70670001000049918283 22/05/2025 13:35:00 Sampues - Dptal Sucre C29 Pendiente $ 603,930\n6. 70670001000050076606 21/06/2025 15:31:00 Sampues - Dptal Sucre D02 Pendiente $ 1,207,860\nTotal a pagar comparendos y multas: $ 5,976,469`;

const result = parseOfficialSimitText(text);
assert.equal(result.length, 6, 'Debe extraer los 6 registros del Estado de Cuenta oficial');
assert.deepEqual(result.map(r => r.number), [
  '47001000000046390657',
  '70670001000049917765',
  '70670001000049917774',
  '70670001000049917442',
  '70670001000049918283',
  '70670001000050076606',
]);
assert.equal(result[0].date, '30/11/2024');
assert.equal(result[0].infractionCode, 'D02');
assert.equal(result[0].value, 1145029);
assert.equal(result[1].municipality, 'Sampues - Dptal Sucre');
assert.equal(result[3].infractionCode, 'C29');
assert.equal(result[5].value, 1207860);

console.log('SIMIT user sample passed: 6 records extracted.');
