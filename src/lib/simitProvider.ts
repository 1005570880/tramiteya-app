export type SimitRecordKind = 'multa' | 'comparendo';

export type SimitProviderErrorCode =
  | 'AUTH_ERROR' | 'CREDITS_ERROR' | 'PROVIDER_ERROR' | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE' | 'SANDBOX_EMPTY' | 'CONFIGURATION_ERROR';

export class SimitProviderError extends Error {
  constructor(public readonly code: SimitProviderErrorCode, message: string) { super(message); this.name = 'SimitProviderError'; }
}
export class SimitDataIntegrityError extends Error { code = 'SIMIT_DATA_INTEGRITY_ERROR'; }

export type SimitComparendo = {
  kind?: SimitRecordKind; number?: string; date?: string; authority?: string; department?: string;
  plate?: string; ownerName?: string; documentNumber?: string; infractionCode?: string; description?: string; status?: string;
  value?: number; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string;
  organismId?: string; photoDetection?: boolean;
};
export type SimitLookupResult = {
  provider: 'verifik' | 'placapi' | 'coresoft' | 'official-manual'; source: 'SIMIT'; documentType: string;
  documentNumber: string; found: boolean; verificationRequired?: boolean; officialUrl?: string; totalDebt?: number;
  pendingCount?: number; personName?: string; comparendos: SimitComparendo[]; raw?: unknown;
  status?: 'SUCCESS' | 'NO_RESULTS' | 'SANDBOX_EMPTY';
};

function requiredEnv(name: string) { const value = process.env[name]?.trim(); if (!value) throw new SimitProviderError('CONFIGURATION_ERROR', `Falta configurar ${name} en las variables de entorno del servidor.`); return value; }
function getVerifikToken() { return process.env.VERIFIK_API_TOKEN?.trim() || process.env.VERIFIK_TOKEN?.trim() || ''; }
function unwrapVerifik(raw: any): any { return raw?.value?.value?.data ?? raw?.value?.data ?? raw?.data ?? raw?.resultado ?? raw?.result ?? raw; }
function firstDefined(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== ''); }
function normalizeIdentity(value: unknown) { return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').trim().toUpperCase(); }
function extractDocument(value: any): string | undefined {
  const candidate = firstDefined(value?.numeroDocumento,value?.documentNumber,value?.documento,value?.cedula,value?.identificacion,value?.numeroIdentificacion,
    value?.numeroIdentificacionPersona,value?.documentoIdentidad,value?.persona?.numeroDocumento,value?.persona?.documentNumber,value?.persona?.documento,
    value?.titular?.numeroDocumento,value?.titular?.documentNumber,value?.titular?.documento,value?.infractor?.numeroDocumento,value?.infractor?.documentNumber,
    value?.ciudadano?.numeroDocumento,value?.ciudadano?.documentNumber,value?.datosPersona?.numeroDocumento,value?.datosPersona?.documentNumber);
  const normalized = normalizeIdentity(candidate); return normalized || undefined;
}
function toArray(value: any): any[] { if (Array.isArray(value)) return value; if (Array.isArray(value?.items)) return value.items; if (Array.isArray(value?.results)) return value.results; if (Array.isArray(value?.data)) return value.data; return []; }
type RecordCollection = { kind: SimitRecordKind; items: any[] };
function findRecordCollections(raw: any): RecordCollection[] {
  const direct = unwrapVerifik(raw);
  const candidates: Array<[SimitRecordKind, any]> = [['multa',direct?.multas],['comparendo',direct?.comparendos],['comparendo',direct?.infracciones],['comparendo',direct?.data?.comparendos],['multa',direct?.data?.multas]];
  return candidates.map(([kind,candidate])=>({kind,items:toArray(candidate)})).filter(c=>c.items.length>0);
}
function normalizeRecords(provider: Exclude<SimitLookupResult['provider'],'official-manual'>, documentNumber: string, raw: any, fallbackKind?: SimitRecordKind) {
  const data = provider === 'verifik' ? unwrapVerifik(raw) : (raw?.data ?? raw?.resultado ?? raw?.result ?? raw);
  const collections = findRecordCollections(raw);
  const effectiveCollections = collections.length ? collections : fallbackKind ? [{kind:fallbackKind,items:[]}] : [];
  const allItems = effectiveCollections.flatMap(collection=>collection.items.map(item=>({item,kind:collection.kind})));
  const personName = String(firstDefined(data?.nombreCompleto,data?.nombre,data?.nombres,data?.titular?.nombreCompleto,data?.titular?.nombre,data?.propietario?.nombreCompleto,data?.persona?.nombreCompleto,data?.persona?.nombre,allItems[0]?.item?.infractor?.nombre ? `${allItems[0].item.infractor.nombre} ${allItems[0].item.infractor.apellido ?? ''}` : '') ?? '').trim() || undefined;
  const records: SimitComparendo[] = allItems.map(({item,kind})=>{
    const inf=Array.isArray(item?.infracciones)?item.infracciones[0]:null;
    const explicitDocument=extractDocument(item);
    const number=String(firstDefined(item?.numeroComparendo,item?.NúmeroComparendo,item?.comparendoId,item?.numero,item?.number,item?.comparendo,item?.numeroMulta)??'').trim()||undefined;
    return {kind,number,date:String(firstDefined(item?.fechaComparendo,item?.fecha,item?.date,item?.fechaCurso)??'').trim()||undefined,authority:String(firstDefined(item?.organismoTransito,item?.organismo,item?.secretariaComparendo,item?.secretaria,item?.autoridad)??'').trim()||undefined,department:String(firstDefined(item?.departamento,item?.department)??'').trim()||undefined,plate:String(firstDefined(item?.placa,item?.Placa,item?.placavehiculo,item?.vehiclePlate,item?.vehiculo?.placa)??'').trim()||undefined,ownerName:String(firstDefined(item?.nombrePropietario,item?.propietario?.nombreCompleto,item?.propietario,item?.titular?.nombreCompleto,item?.titular,item?.nombreCompleto,item?.infractorComparendo,item?.infractor?.nombre ? `${item.infractor.nombre} ${item.infractor.apellido ?? ''}` : '',personName)??'').trim()||undefined,documentNumber:explicitDocument,infractionCode:String(firstDefined(item?.codigoInfraccion,item?.codigo,item?.infraccion,inf?.codigoInfraccion)??'').trim()||undefined,description:String(firstDefined(item?.descripcionInfraccion,item?.descripcion,inf?.descripcionInfraccion)??'').trim()||undefined,status:String(firstDefined(item?.estadoComparendo,item?.estado,item?.status)??'').trim()||undefined,value:Number(firstDefined(item?.valorPagar,item?.valor,item?.valorMulta,item?.monto,item?.total,inf?.valorInfraccion)??0)||undefined,resolutionNumber:String(firstDefined(item?.numeroResolucion,item?.resolucion)??'').trim()||undefined,resolutionDate:String(firstDefined(item?.fechaResolucion)??'').trim()||undefined,notificationDate:String(firstDefined(item?.fechaNotificacion,item?.notificacion?.fecha)??'').trim()||undefined,paymentDate:String(firstDefined(item?.fechaPago,item?.pago?.fecha)??'').trim()||undefined,organismId:String(firstDefined(item?.idOrganismoTransito)??'').trim()||undefined,photoDetection:item?.fotodeteccion===true};
  });
  const requestedDocument=normalizeIdentity(documentNumber); const payloadDocument=extractDocument(data);
  if(payloadDocument && payloadDocument!==requestedDocument) throw new SimitDataIntegrityError(`El proveedor identificó el documento ${payloadDocument}, distinto al consultado ${requestedDocument}. TrámiteYa bloqueó la respuesta.`);
  const mismatchedRecords=records.filter(item=>item.documentNumber && item.documentNumber!==requestedDocument);
  if(mismatchedRecords.length>0) throw new SimitDataIntegrityError('El proveedor devolvió registros que pertenecen a otro documento. TrámiteYa bloqueó esos registros.');
  return {records,personName,totalDebt:Number(firstDefined(data?.total_deuda,data?.totalDeuda,data?.total_pendiente,data?.totalMultasPagar,data?.total)??0)||undefined,pendingCount:Number(firstDefined(data?.totalMultas,data?.cantMultasPagar,data?.pendingCount)??0)||0,payloadDocument};
}
function mergeRecords(primary:SimitComparendo[],secondary:SimitComparendo[]) { const merged=new Map<string,SimitComparendo>(); for(const record of [...primary,...secondary]) { const key=record.number?`number:${record.number}`:record.resolutionNumber?`resolution:${record.resolutionNumber}`:[record.date,record.plate,record.infractionCode,record.authority,record.value].join('|'); const previous=merged.get(key); if(!previous){merged.set(key,record);continue;} merged.set(key,{...previous,...Object.fromEntries(Object.entries(record).filter(([,value])=>value!==undefined&&value!=='')),kind:previous.kind==='multa'||record.kind==='multa'?'multa':'comparendo'});} return Array.from(merged.values()); }
function isEmptyVerifikPayload(raw:any){const direct=unwrapVerifik(raw);return Array.isArray(raw)&&raw.length===0||Array.isArray(direct)&&direct.length===0||Array.isArray(direct?.multas)&&direct.multas.length===0||Array.isArray(direct?.comparendos)&&direct.comparendos.length===0;}
function hasExplicitSandboxSignal(raw:any){return /sandbox|demo environment|test environment|simulated response|mock data/.test(JSON.stringify(raw??'').toLowerCase());}
function classifyVerifikHttpError(status:number):SimitProviderErrorCode{if(status===401||status===403)return'AUTH_ERROR';if(status===402||status===429)return'CREDITS_ERROR';if(status>=500)return'PROVIDER_ERROR';return'PROVIDER_ERROR';}
async function fetchVerifik(url:string,token:string){let response:Response;try{response=await fetch(url,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`},cache:'no-store'});}catch(error){console.error('[SIMIT AUDIT] verifik_network_error',JSON.stringify({url,message:error instanceof Error?error.message:String(error)}));throw new SimitProviderError('NETWORK_ERROR','No fue posible comunicarse con el proveedor SIMIT.');}const bodyText=await response.text().catch(()=> '');let parsedBody:unknown=null;try{parsedBody=bodyText?JSON.parse(bodyText):null;}catch{parsedBody=bodyText||null;}console.log('[SIMIT AUDIT] verifikResponse',JSON.stringify({url,status:response.status,ok:response.ok,headers:Object.fromEntries(['content-type','x-request-id','x-verifik-request-id'].map(name=>[name,response.headers.get(name)]).filter(([,value])=>value)),rawResponse:parsedBody}));if(!response.ok){throw new SimitProviderError(classifyVerifikHttpError(response.status),`Proveedor SIMIT respondió ${response.status}.`);}if(parsedBody===null||typeof parsedBody==='string')throw new SimitProviderError('INVALID_RESPONSE','El proveedor SIMIT devolvió una respuesta que no es JSON válido.');return parsedBody;}

async function verifyComparendoWithDetail(documentType:string,documentNumber:string,record:SimitComparendo,token:string) {
  if (!record.number || !record.organismId) return {valid:false, reason:'missing_detail_parameters'} as const;
  const query = new URLSearchParams({documentType,documentNumber,numeroComparendo:record.number,idOrganismoTransito:record.organismId});
  try {
    const raw = await fetchVerifik(`https://api.verifik.co/v2/co/simit/comparendo?${query.toString()}`,token);
    const data = unwrapVerifik(raw);
    const returnedDocument = extractDocument(data);
    if (returnedDocument && returnedDocument !== normalizeIdentity(documentNumber)) return {valid:false,reason:'detail_document_mismatch'} as const;
    const returnedNumber = String(firstDefined(data?.numeroComparendo,data?.NúmeroComparendo,record.number) ?? '').trim();
    const returnedOrganism = String(firstDefined(data?.idOrganismoTransito,record.organismId) ?? '').trim();
    if (returnedNumber !== record.number || returnedOrganism !== record.organismId) return {valid:false,reason:'detail_record_mismatch'} as const;
    return {valid:true,data,raw} as const;
  } catch (error) {
    console.warn('[SIMIT AUDIT] comparendo_detail_not_verified',JSON.stringify({documentType,documentNumber,number:record.number,organismId:record.organismId,reason:error instanceof Error?error.message:String(error)}));
    return {valid:false,reason:'detail_not_found'} as const;
  }
}

export async function lookupSimitByDocument(documentType:string,documentNumber:string):Promise<SimitLookupResult>{
  const normalizedNumber=documentNumber.replace(/[^0-9A-Za-z]/g,'');if(!normalizedNumber)throw new SimitProviderError('INVALID_RESPONSE','El número de documento es obligatorio.');
  const configuredProvider=(process.env.SIMIT_PROVIDER||'').toLowerCase().trim();const token=getVerifikToken();const provider=token&&(!configuredProvider||configuredProvider==='official-manual'||configuredProvider==='manual')?'verifik':configuredProvider;const officialUrl='https://www.fcm.org.co/simit/';
  if(!provider)throw new SimitProviderError('CONFIGURATION_ERROR','La consulta automática de SIMIT no está configurada. Falta el proveedor y/o la credencial del servicio SIMIT.');
  if(provider==='official-manual'||provider==='manual')throw new SimitProviderError('CONFIGURATION_ERROR',`La consulta automática de SIMIT no está habilitada en TrámiteYa. Configura VERIFIK_TOKEN o VERIFIK_API_TOKEN. Consulta oficial: ${officialUrl}`);
  if(provider==='verifik'){
    const verifikToken=token||requiredEnv('VERIFIK_API_TOKEN');const effectiveDocumentType=(documentType||'CC').trim().toUpperCase();const query=`documentType=${encodeURIComponent(effectiveDocumentType)}&documentNumber=${encodeURIComponent(normalizedNumber)}`;
    const consultarUrl=`https://api.verifik.co/v2/co/simit/consultar?${query}`;const comparendosUrl=`https://api.verifik.co/v2/co/simit/comparendos?${query}`;
    const [generalRaw,comparendosRaw]=await Promise.all([fetchVerifik(consultarUrl,verifikToken),fetchVerifik(comparendosUrl,verifikToken)]);
    const general=normalizeRecords('verifik',normalizedNumber,generalRaw,'multa');const tickets=normalizeRecords('verifik',normalizedNumber,comparendosRaw,'comparendo');
    const bothEmpty=isEmptyVerifikPayload(generalRaw)&&isEmptyVerifikPayload(comparendosRaw);const generalData=unwrapVerifik(generalRaw);const ticketData=unwrapVerifik(comparendosRaw);

    // Las respuestas de /comparendos pueden no repetir el documento. Verifik dispone de
    // /comparendo, que recibe documento + número + organismo y sirve como validación fuerte.
    const validatedTickets:SimitComparendo[]=[];
    for (const record of tickets.records) {
      const result=await verifyComparendoWithDetail(effectiveDocumentType,normalizedNumber,record,verifikToken);
      if(result.valid) {
        const detail=result.data;
        validatedTickets.push({...record,
          documentNumber:extractDocument(detail) ?? normalizedNumber,
          ownerName:String(firstDefined(detail?.infractorComparendo,record.ownerName)??'').trim()||record.ownerName,
          plate:String(firstDefined(detail?.placaVehiculo,detail?.placa,record.plate)??'').trim()||record.plate,
          authority:String(firstDefined(detail?.secretariaComparendo,record.authority)??'').trim()||record.authority,
          organismId:String(firstDefined(detail?.idOrganismoTransito,record.organismId)??'').trim()||record.organismId,
        });
      }
    }

    // /consultar sí incluye infractor.numeroDocumento. Solo aceptamos multas cuya identidad
    // coincida exactamente con la cédula consultada; nunca inferimos identidad por nombre.
    const validatedGeneral=general.records.filter(record=>!record.documentNumber || record.documentNumber===normalizedNumber);
    const unverifiableGeneral=general.records.filter(record=>!record.documentNumber);
    if(unverifiableGeneral.length>0) console.warn('[SIMIT AUDIT] general_identity_missing',JSON.stringify({documentType:effectiveDocumentType,documentNumber:normalizedNumber,count:unverifiableGeneral.length}));

    const comparendos=mergeRecords(validatedGeneral,validatedTickets);
    const rawDebt=firstDefined(generalData?.totalMultasPagar,ticketData?.totalMultasPagar);const totalDebt=general.totalDebt??tickets.totalDebt??(rawDebt!==undefined?Number(rawDebt)||undefined:undefined);
    const providerCount=Math.max(validatedGeneral.length,validatedTickets.length,Number(firstDefined(generalData?.multas?.length,0)??0),Number(firstDefined(ticketData?.comparendos?.length,0)??0));
    if(bothEmpty&&(hasExplicitSandboxSignal(generalRaw)||hasExplicitSandboxSignal(comparendosRaw)))throw new SimitProviderError('SANDBOX_EMPTY','Verifik respondió vacío en un entorno Sandbox/prueba; no se puede afirmar que el ciudadano no tenga comparendos.');
    if(comparendos.length===0 && (general.records.length>0 || tickets.records.length>0)) {
      throw new SimitDataIntegrityError('Verifik devolvió registros de SIMIT, pero ninguno pudo ser validado inequívocamente para la cédula consultada. TrámiteYa no mostrará datos de terceros.');
    }
    const found=comparendos.length>0||providerCount>0||Boolean(generalData?.tiene_deuda)||Boolean(ticketData?.tiene_deuda);
    return {provider:'verifik',source:'SIMIT',documentType:effectiveDocumentType,documentNumber:normalizedNumber,found,totalDebt,pendingCount:comparendos.length,personName:general.personName??tickets.personName,comparendos,status:found?'SUCCESS':'NO_RESULTS',raw:{general:generalRaw,comparendos:comparendosRaw}};
  }
  throw new SimitProviderError('CONFIGURATION_ERROR',`Proveedor SIMIT no soportado: ${provider}`);
}
