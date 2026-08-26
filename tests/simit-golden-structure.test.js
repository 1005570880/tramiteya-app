const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'simitOfficialParser.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, require, console });
const { parseOfficialSimitText } = module.exports;

const rows = [
  ['20001000000051832377', '11/10/2025', 'Valledupar', 'C02', 'Pendiente', 603939],
  ['20001000000050591416', '22/08/2025', 'Valledupar', 'C02', 'Pendiente', 603939],
];
for (let i = 3; i <= 27; i += 1) rows.push([`2000100000005${String(i).padStart(5, '0')}`, '01/01/2025', 'Valledupar', i % 2 ? 'C35' : 'C06', 'Pendiente', 898000]);
rows.push(['20001000000059999999', '02/02/2025', 'Valledupar', 'D02', 'Pendiente', 907558]);
rows.push(['2024-FAD-06924', '24/05/2024', 'Dptal Cesar - IDTRACESAR', 'C29', 'Cobro coactivo', 748361]);

const body = rows.map((r, i) => `${i + 1}. ${r[0]} ${r[1]} 10:00:00 ${r[2]} ${r[3]} ${r[4]} $${r[5].toLocaleString('es-CO')}`).join(' ');
const text = `ESTADO DE CUENTA 37312647 Fecha de expedición: 04/06/2026 Cédula: Comparendos y multas ${body} Total a pagar: $25.313.797`;
const result = parseOfficialSimitText(text);

assert.equal(result.length, 29, 'Debe extraer 29 registros en layout PDF colapsado');
assert.equal(result[0].number, '20001000000051832377');
assert.equal(result[0].date, '11/10/2025');
assert.equal(result[0].infractionCode, 'C02');
assert.equal(result[0].value, 603939);
assert.equal(result.at(-1).number, '2024-FAD-06924', 'Debe aceptar número alfanumérico');
assert.equal(result.at(-1).infractionCode, 'C29');
assert.equal(result.at(-1).status, 'Cobro coactivo');
assert.equal(result.reduce((sum, r) => sum + (r.value || 0), 0), 25313797, 'El total de los registros debe ser $25.313.797');
console.log('SIMIT golden structure passed: 29 records / $25.313.797 / alphanumeric identifier.');
