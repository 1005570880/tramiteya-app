import type { Procedure } from '../types';
export type ProcedureLine = { id: string; title: string; description: string; procedureIds: string[] };
export const procedureLines: ProcedureLine[] = [
 { id:'peticiones', title:'Derechos de petición', description:'Solicitudes de información, reconocimiento, corrección o protección administrativa de derechos.', procedureIds:['derecho-peticion','derecho-eliminar-multa','derecho-eliminar-comparendo'] },
 { id:'multas-comparendos', title:'Multas y comparendos', description:'Herramientas para controvertir, revisar y solicitar actuaciones sobre comparendos, multas y fotomultas.', procedureIds:['derecho-eliminar-multa','derecho-eliminar-comparendo','prescripcion-comparendo','caducidad-comparendo','revocatoria-comparendo','solicitud-soportes-comparendo','fotomultas','impugnacion-comparendos'] },
 { id:'tutelas', title:'Acciones de tutela', description:'Preparación estructurada de acciones para la protección inmediata de derechos fundamentales.', procedureIds:['accion-de-tutela'] },
 { id:'contratos', title:'Contratos', description:'Contratos parametrizados con cláusulas y condiciones según las respuestas del usuario.', procedureIds:['contrato-arrendamiento'] },
 { id:'laboral', title:'Derecho laboral', description:'Reclamaciones y documentos para conflictos y obligaciones derivados de relaciones laborales.', procedureIds:['reclamacion-laboral'] },
 { id:'administrativo', title:'Administrativo', description:'Actuaciones administrativas y documentos dirigidos a entidades públicas.', procedureIds:['derecho-peticion','poder-especial'] },
];
export function getProcedureLines(procedures: Procedure[]) { return procedureLines.map(line => ({ ...line, procedures: line.procedureIds.map(id => procedures.find(p => p.id === id)).filter(Boolean) as Procedure[] })); }
