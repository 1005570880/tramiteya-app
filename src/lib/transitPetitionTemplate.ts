import type { Comparendo } from './transitPrescription';

export function buildTransitComparendosTable(comparendos: Comparendo[]) {
  return comparendos
    .map((item) => {
      const amount = typeof item.totalFine === 'number'
        ? item.totalFine.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
        : 'No informado';
      return [
        `Comparendo: ${item.number || 'No informado'}`,
        `Fecha coactivo: ${item.coactiveDate || 'No informada'}`,
        `Origen / Secretaría: ${item.origin || 'No informado'}`,
        `Infracción: ${item.infraction || 'No informada'}`,
        `Total multa: ${amount}`,
      ].join(' | ');
    })
    .join('\n');
}

export function buildTransitTimeline(comparendos: Comparendo[], analyses: Array<{ analysis: { threeYearDate: string; elapsedYears: number; basisDate: string } | null }>) {
  return comparendos.map((item, index) => {
    const analysis = analyses[index]?.analysis;
    if (!analysis) return `- ${item.number}: no fue posible calcular la línea de tiempo.`;
    return `- ${item.coactiveDate || item.violationDate}: comparendo ${item.number} → ${analysis.elapsedYears} año(s) transcurrido(s); umbral de tres años: ${analysis.threeYearDate}.`;
  }).join('\n');
}
