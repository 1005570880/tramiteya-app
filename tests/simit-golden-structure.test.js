const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadParser() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'simitOfficialParser.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, { module, exports: module.exports, require, console });
  return module.exports;
}

function buildGoldenStructure() {
  const rows = [
    ['20001000000051832377', '11/10/2025', '13:21:00', 'Valledupar', 'C02', 'Pendiente', 603939],
    ['20001000000050591416', '22/08/2025', '09:10:00', 'Valledupar', 'C02', 'Pendiente', 603939],
  ];
  for (let i = 3; i <= 27; i += 1) rows.push([`2000100000005${String(i).padStart(5, '0')}`, '01/01/2025', '10:00:00', 'Valledupar', i % 2 ? 'C35' : 'C06', 'Pendiente', 898000]);
  rows.push(['20001000000059999999', '02/02/2025', '11:00:00', 'Valledupar', 'D02', 'Pendiente', 907558]);
  rows.push(['2024-FAD-06924', '24/05/2024', '12:00:00', 'Dptal Cesar - IDTRACESAR', 'C29', 'Cobro coactivo', 748361]);

  const body = rows.map((r, i) => `${i + 1}.\n${r[0]}\n${r[1]}\n${r[2]}\n${r[3]}\n${r[4]}\n${r[5]}\n$${r[6].toLocaleString('es-CO')}`).join('\n');
  return `ESTADO DE CUENTA\nCédula: 37312647\nComparendos y multas\n${body}\nTotal a pagar: $25.313.797`;
}

function buildInlinePdfStructure() {
  return `ESTADO DE CUENTA\nCédula: 37312647\nComparendos y multas\n1.\n20001000000051832377 11/10/2025\n13:21:00\nValledupar\nC02\nPendiente\n$603.939\n2.\n2024-FAD-06924 24/05/2024\n12:00:00\nDptal Cesar - IDTRACESAR\nC29\nCobro coactivo\n$748.361\nTotal a pagar: $1.352.300`;
}

const { parseOfficialSimitStatement } = loadParser();
const result = parseOfficialSimitStatement(buildGoldenStructure());

assert.equal(result.isSimitStatement, true, 'Debe identificar la estructura SIMIT');
assert.equal(result.recordCount, 29, 'El golden test debe producir 29 registros');
assert.equal(result.totalDebt, 25313797, 'El total debe conservar $25.313.797');
assert.equal(result.records[0].number, '20001000000051832377');
assert.equal(result.records[0].date, '11/10/2025');
assert.equal(result.records[0].authority, 'Valledupar');
assert.equal(result.records[0].infractionCode, 'C02');
assert.equal(result.records[0].value, 603939);
assert.equal(result.records.at(-1).number, '2024-FAD-06924', 'Debe aceptar identificadores alfanuméricos');
assert.equal(result.records.at(-1).status, 'Cobro coactivo');
assert.equal(result.records.at(-1).value, 748361);

const inline = parseOfficialSimitStatement(buildInlinePdfStructure());
assert.equal(inline.isSimitStatement, true, 'El PDF con columnas inline debe seguir identificándose como SIMIT');
assert.equal(inline.recordCount, 2, 'Las filas inline deben producir dos registros');
assert.equal(inline.records[0].number, '20001000000051832377');
assert.equal(inline.records[0].date, '11/10/2025');
assert.equal(inline.records[0].infractionCode, 'C02');
assert.equal(inline.records[0].value, 603939);
assert.equal(inline.records[1].number, '2024-FAD-06924');
assert.equal(inline.records[1].date, '24/05/2024');
assert.equal(inline.records[1].value, 748361);

console.log('SIMIT parser tests passed: 29-record golden + inline PDF rows.');
