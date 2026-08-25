import type { SimitComparendo, SimitLookupResult } from '@/lib/simitProvider';

const BASE = 'https://api.verifik.co/v2/co/simit';
const clean = (v: unknown) => String(v ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
const cleanName = (v: unknown) => clean(v).replace(/[^0-9A-Z]/g, '');
const first = (...xs: unknown[]) => xs.find(x => x !== undefined && x !== null && String(x).trim() !== '');
const unwrap = (x: any) => x?.value?.value?.data ?? x?.value?.data ?? x?.data ?? x?.resultado ?? x?.result ?? x;
const doc = (x: any): string | undefined => {
  const v = first(x?.documentNumber,x?.numeroDocumento,x?.documento,x?.cedula,x?.identificacion,x?.numeroIdentificacion,
    x?.infractor?.documentNumber,x?.infractor?.numeroDocumento,x?.persona?.documentNumber,x?.persona?.numeroDocumento,
    x?.titular?.documentNumber,x?.titular?.numeroDocumento);
  const n = clean(v); return n || undefined;
};
const name = (x: any): string | undefined => {
  const v = first(x?.nombreCompleto,x?.nombre,x?.nombres,x?.fullName,x?.infractorComparendo,x?.infractor?.nombreCompleto,
    x?.persona?.nombreCompleto,x?.titular?.nombreCompleto);
  return v ? String(v).trim() : undefined;
};
const val = (x: any, ...keys: string[]) => first(...keys.map(k => x?.[k]));
function item(x:any, kind:'multa'|'comparendo'):SimitComparendo {
  const inf=Array.isArray(x?.infracciones)?x.infracciones[0]:x?.infraccion;
  return { kind,
    number: val(x,'numeroComparendo','NúmeroComparendo','comparendoId','numero','number','comparendo','numeroMulta') as string|undefined,
    date: val(x,'fechaComparendo','fecha','date') as string|undefined,
    authority: val(x,'organismoTransito','organismo','secretariaComparendo','secretaria','autoridad') as string|undefined,
    department: val(x,'departamento','department') as string|undefined,
    plate: val(x,'placa','Placa','placavehiculo','vehiclePlate') as string|undefined,
    ownerName: val(x,'nombrePropietario','propietario','nombreCompleto','infractorComparendo','titular') as string|undefined,
    documentNumber: doc(x),
    infractionCode: val(x,'codigoInfraccion','codigo','infraccion',inf?.codigoInfraccion) as string|undefined,
    description: val(x,'descripcionInfraccion','descripcion',inf?.descripcionInfraccion) as string|undefined,
    status: val(x,'estadoComparendo','estado','status') as string|undefined,
    value: Number(val(x,'valorPagar','valor','valorMulta','monto','total',inf?.valorInfraccion) ?? 0) || undefined,
    resolutionNumber: val(x,'numeroResolucion','resolucion') as string|undefined,
    resolutionDate: val(x,'fechaResolucion') as string|undefined,
    notificationDate: val(x,'fechaNotificacion') as string|undefined,
    paymentDate: val(x,'fechaPago') as string|undefined,
    organismId: val(x,'idOrganismoTransito','organismoTransitoId','organismId') as string|undefined,
    photoDetection: x?.fotodeteccion === true
  };
}
function arrays(x:any, key:string):any[] {
  const d=unwrap(x); const a=d?.[key]; return Array.isArray(a)?a:[];
}
async function call(url:string,token:string,label:string){
  const r=await fetch(url,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`},cache:'no-store'});
  const t=await r.text(); let raw:any=null; try{raw=t?JSON.parse(t):null}catch{raw=t;}
  console.log('[SIMIT AUDIT] verifikResponse',JSON.stringify({label,url,status:r.status,rawResponse:raw}));
  if(!r.ok) throw new Error(`Verifik ${r.status}`); return raw;
}

export async function lookupSimitByDocumentStrict(documentType:string,documentNumber:string):Promise<SimitLookupResult>{
  const token=process.env.VERIFIK_API_TOKEN?.trim()||process.env.VERIFIK_TOKEN?.trim();
  if(!token) throw new Error('Falta VERIFIK_API_TOKEN/VERIFIK_TOKEN.');
  const dt=(documentType||'CC').trim().toUpperCase(); const dn=clean(documentNumber);
  const qs=new URLSearchParams({documentType:dt,documentNumber:dn});
  const [generalRaw,listRaw]=await Promise.all([
    call(`${BASE}/consultar?${qs}`,token,'consultar'),
    call(`${BASE}/comparendos?${qs}`,token,'comparendos')
  ]);
  const general=unwrap(generalRaw); const list=unwrap(listRaw);
  const generalDoc=doc(general);
  const generalName=name(general);
  if(generalDoc && generalDoc!==dn) throw new Error(`SIMIT_DATA_INTEGRITY_ERROR: /consultar identificó ${generalDoc}, no ${dn}.`);

  const rawRecords=arrays(list,'comparendos');
  const directRecords=rawRecords.map(x=>item(x,'comparendo'));
  const accepted:SimitComparendo[]=[];
  for(const r of directRecords){
    if(r.documentNumber){
      if(r.documentNumber===dn && (!generalName || !r.ownerName || cleanName(r.ownerName)===cleanName(generalName))) accepted.push(r);
      else console.error('[SIMIT AUDIT] rejected_identity',JSON.stringify({documentNumber:dn,number:r.number,returnedDocument:r.documentNumber,returnedName:r.ownerName??null,generalName:generalName??null,reason:'document_or_name_mismatch'}));
      continue;
    }
    if(!r.number || !r.organismId) continue;
    const q=new URLSearchParams({documentType:dt,documentNumber:dn,numeroComparendo:String(r.number),idOrganismoTransito:String(r.organismId)});
    try{
      const detailRaw=await call(`${BASE}/comparendo?${q}`,token,'comparendo-detail');
      const detail=unwrap(detailRaw); const returnedDoc=doc(detail); const returnedName=name(detail);
      if(!returnedDoc || returnedDoc!==dn){
        console.error('[SIMIT AUDIT] rejected_identity',JSON.stringify({documentNumber:dn,number:r.number,returnedDocument:returnedDoc??null,returnedName:returnedName??null,reason:returnedDoc?'document_mismatch':'detail_without_document'}));
        continue;
      }
      if(generalName && returnedName && cleanName(returnedName)!==cleanName(generalName)){
        console.error('[SIMIT AUDIT] rejected_identity',JSON.stringify({documentNumber:dn,number:r.number,returnedDocument:returnedDoc,returnedName,generalName,reason:'name_mismatch'}));
        continue;
      }
      const returnedNumber=String(first(detail?.numeroComparendo,detail?.NúmeroComparendo,r.number));
      const returnedOrg=String(first(detail?.idOrganismoTransito,r.organismId));
      if(clean(returnedNumber)!==clean(r.number)||clean(returnedOrg)!==clean(r.organismId)) continue;
      accepted.push({...r,documentNumber:returnedDoc,ownerName:returnedName||r.ownerName,plate:(first(detail?.placaVehiculo,detail?.placa,r.plate) as string|undefined)});
    }catch{}
  }
  const unique=new Map<string,SimitComparendo>(); for(const r of accepted) unique.set(r.number?`n:${r.number}`:JSON.stringify(r),r);
  const comparendos=[...unique.values()];
  const personName=generalName || comparendos[0]?.ownerName;
  const totalDebt=Number(first(general?.totalMultasPagar,general?.total_deuda,general?.totalDeuda,general?.total_pendiente)??0)||undefined;
  console.log('[SIMIT AUDIT] strict-normalized',JSON.stringify({documentType:dt,documentNumber:dn,candidates:directRecords.length,accepted:comparendos.length,generalDocument:generalDoc??null,generalName:generalName??null}));
  return {provider:'verifik',source:'SIMIT',documentType:dt,documentNumber:dn,found:comparendos.length>0,verificationRequired:false,officialUrl:'https://www.fcm.org.co/simit/',totalDebt,pendingCount:comparendos.length,personName,comparendos,status:comparendos.length?'SUCCESS':'NO_RESULTS',raw:{consultar:generalRaw,comparendos:listRaw}};
}
