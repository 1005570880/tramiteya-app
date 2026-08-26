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

const rows = [
  ['20001000000051832377', '11/10/2025', 'Valledupar', 'C02', 'Pendiente', 603939],
  ['20001000000050591416', '22/08/2025', 'Valledupar', 'C02', 'Pendiente', 603939],
];
for (let i = 3; i <= 27; i += 1) rows.push([`2000100000005${String(i).padStart(5, '0')}`, '01/01/2025', 'Valledupar', i % 2 ? 'C35' : 'C06', 'Pendiente', 898000]);
rows.push(['20001000000059999999', '02/02/2025', 'Valledupar', 'D02', 'Pendiente', 907558]);
rows.push(['2024-FAD-06924', '24/05/2024', 'Dptal Cesar - IDTRACESAR', 'C29', 'Cobro coactivo', 748361]);

// Simulates PDF extraction where numbering is intercalated and rows are collapsed.
const body = rows.map((r, i) => i % 2 === 0
  ? `${r[0]} ${i + 1}. ${r[1]} 10:00:00 ${r[2]} ${r[3]} ${r[4]} $${r[5].toLocaleString('es-CO')}`
  : `${i + 1}. ${r[0]} ${r[1]} 10:00:00 ${r[2]} ${r[3]} ${r[4]} $${r[5].toLocaleString('es-CO')}`
).join(' ');
const text = `ESTADO DE CUENTA 37312647 Fecha de expedición: 04/06/2026 Cédula: Comparendos y multas ${body} Total a pagar: $25.313.797`;
const result = parseOfficialSimitText(text);

assert.equal(result.length, 29, 'Debe extraer 29 registros en layout PDF colapsado');
assert.equal(result[0].number, '20001000000051832377');
assert.equal(result[0].date, '11/10/2025');
assert.equal(result[0].infractionCode, 'C02');
assert.equal(result[0].value, 603939);
assert.equal(result.at(-1).number, '2024-FAD-06924', 'Debe aceptar número FAD');
assert.equal(result.at(-1).infractionCode, 'C29');
assert.equal(result.at(-1).status, 'Cobro coactivo');
assert.equal(result.reduce((sum, r) => sum + (r.value || 0), 0), 25313797, 'El total de los registros debe ser $25.313.797');

const formats = ['1234567890', '20001000000051832377', '2024-FAD-06924', 'TC-2025-12345', '2025-12345-SA'];
const formatText = formats.map((id, i) => `${id} ${String(i + 1).padStart(2, '0')}/01/2026 08:00:00 Valledupar C0${(i % 6) + 1} Pendiente $100.000`).join(' ');
const formatResult = parseOfficialSimitText(formatText);
assert.equal(formatResult.length, formats.length, 'Debe reconocer todos los formatos de identificador');
assert.deepEqual(formatResult.map(r => r.number), formats);

const minimal = parseOfficialSimitText(`ESTADO DE CUENTA\n37312647\nFecha de expedición: 04/06/2026\nCédula:\nComparendos y multas\n1.\n20001000000051832377 11/10/2025\n13:21:00\nValledupar\n`);
assert.equal(minimal.length, 1, 'Debe aceptar un registro oficial aunque el PDF no muestre código o valor');
assert.equal(minimal[0].number, '20001000000051832377');
assert.equal(minimal[0].date, '11/10/2025');
assert.equal(minimal[0].time, '13:21:00');
assert.equal(minimal[0].municipality, 'Valledupar');
assert.equal(minimal[0].infractionCode, undefined, 'No debe inventar código de infracción');
assert.equal(minimal[0].value, undefined, 'No debe inventar valor');

console.log('SIMIT golden structure passed: 29 records + identifier variants + sparse official row.');
