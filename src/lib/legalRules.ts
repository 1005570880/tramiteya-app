import type { FormAnswers } from '../types/form';
export type LegalRule = { id:string; label:string; description:string; applies:(answers:FormAnswers)=>boolean; instruction:string };
export const trafficRules: LegalRule[] = [
 { id:'prescripcion', label:'Prescripción', description:'Revisar si el término aplicable para el cobro o ejecución se encuentra cumplido.', applies:a=>String(a.causal ?? '').toLowerCase().includes('prescrip'), instruction:'Verificar fechas relevantes, actuaciones de cobro y régimen jurídico aplicable antes de afirmar que la obligación está prescrita.' },
 { id:'caducidad', label:'Caducidad', description:'Revisar el término legal para ejercer la potestad sancionatoria.', applies:a=>String(a.causal ?? '').toLowerCase().includes('caduc'), instruction:'Identificar fecha del hecho, actuación y decisión para determinar el término de caducidad jurídicamente aplicable.' },
 { id:'fotomulta', label:'Fotodetección', description:'Revisar identificación del infractor, notificación y soportes de la detección electrónica.', applies:a=>/foto|fotomult|detecci[oó]n electr[oó]nica/i.test(String(a.causal ?? '')+' '+String(a.hechos ?? '')), instruction:'Solicitar soportes de detección, evidencia, notificación y actuaciones administrativas relacionadas.' },
 { id:'soportes', label:'Solicitud de soportes', description:'Pedir copia de documentos que sustentan la actuación.', applies:()=>true, instruction:'Solicitar copia íntegra de comparendo, evidencia, constancias de notificación, actos administrativos y demás soportes pertinentes.' },
];
export function getApplicableTrafficRules(answers:FormAnswers){ return trafficRules.filter(rule=>rule.applies(answers)); }
