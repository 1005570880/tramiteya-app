const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'legalDocumentGuard.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: sourcePath,
}).outputText;

const moduleShim = { exports: {} };
new Function('require', 'module', 'exports', transpiled)(require, moduleShim, moduleShim.exports);
const { cleanLegalDocumentOutput, isLegallySafeTrafficDocument } = moduleShim.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('Running traffic document safety checks...');

const valid = `
SINCELEJO\n27/08/2026\n\nAUTORIDAD DE TRÁNSITO\n\nDERECHO DE PETICIÓN — SOLICITUD DE PRESCRIPCIÓN\n\nI. OBJETO\n\nSolicito que se declare la prescripción cuando corresponda, se termine la obligación y se ordene la cancelación, eliminación, depuración o actualización del registro de la multa o comparendo en el SIMIT.\n\nII. HECHOS\n\nLa información aportada identifica la actuación. No se encuentra acreditada la fecha de notificación del mandamiento de pago.\n\nIII. FUNDAMENTOS DE DERECHO\n\nArtículo 159 de la Ley 769 de 2002.\n\nIV. ANÁLISIS\n\nDebe reconstruirse la cronología documental.\n\nV. PETICIONES\n\n1. Que se declare la prescripción si se encuentra configurada.\n\n2. Que se termine y archive la obligación y cualquier actuación de cobro.\n\n3. Que se ordene la cancelación o eliminación de la multa o comparendo del registro del SIMIT.\n\nVI. ANEXOS\n\nEstado de Cuenta SIMIT.\n`;

const cleaned = cleanLegalDocumentOutput(valid + '\n\nPlaca: No especificada en PDF.');
assert(!/no especificad[oa] en pdf/i.test(cleaned), 'Unsupported OCR placeholder must be removed.');
assert(isLegallySafeTrafficDocument(cleaned), 'A complete traffic petition with explicit deletion relief must pass the guard.');

const duplicated = valid.replace('VI. ANEXOS', 'V. PETICIONES\n\n9. Duplicated section.\n\nVI. ANEXOS');
assert(!isLegallySafeTrafficDocument(duplicated), 'Duplicated major sections must be rejected.');

const weakened = valid.replace(/cancelación o eliminación de la multa o comparendo del registro del SIMIT/gi, 'revisión del registro');
assert(!isLegallySafeTrafficDocument(weakened), 'A petition that loses deletion/cancellation relief must be rejected.');

console.log('Traffic document safety checks passed.');
