"use client";
import React, { useEffect, useState } from "react";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { generateDocument } from "../../../../lib/generateDocument";
import { validateProcedureAnswers } from "../../../../lib/multitramiteEngine";
import { useRouter } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";
import { procedures } from "../../../../data/procedures";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";

export default function ProcedureForm({ params }: { params: { slug: string } }) {
 const [loading,setLoading]=useState(false),[resetSignal,setResetSignal]=useState(0),[instanceId,setInstanceId]=useState<string|undefined>();
 const router=useRouter(); const definition=getDynamicFormDefinition(params.slug); const procedure=procedures.find(p=>p.slug===params.slug); const draftKey=`procedure:${params.slug}`;
 useEffect(()=>{const saved=localDraftStorage.load(draftKey) as any;if(saved?.data?.__instanceId)setInstanceId(saved.data.__instanceId)},[draftKey]);
 if(!definition||!procedure)return <main className="min-h-screen bg-slate-50"><Header/><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1><p className="mt-2 text-slate-600">Aún no existe un formulario configurado para este trámite.</p></section><Footer/></main>;
 async function ensureInstance(answers:FormAnswers){
  const supabase=getSupabaseBrowser(); const saved=localDraftStorage.load(draftKey) as any;
  if(supabase){const {data:{session}}=await supabase.auth.getSession(); if(session?.user){
   if(instanceId){const existing=await fetch(`/api/instances/${instanceId}`,{headers:{Authorization:`Bearer ${session.access_token}`}});if(existing.ok)return existing.json();}
   const response=await fetch('/api/instances',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({procedureId:procedure.id,procedureSlug:procedure.slug,answers})});
   if(response.ok){const created=await response.json();setInstanceId(created.id);localDraftStorage.save(draftKey,{...(saved?.data||{}),__instanceId:created.id});return created;}
  }}
  const id=saved?.data?.__instanceId;if(id){const existing=procedureStorage.get(id);if(existing)return existing;}
  const created=procedureStorage.create(procedure.id,procedure.slug,answers);localDraftStorage.save(draftKey,{...(saved?.data||{}),__instanceId:created.id});setInstanceId(created.id);return created;
 }
 async function handleComplete(answers:FormAnswers){
  const issues=validateProcedureAnswers(procedure,answers);if(issues.length){alert(`Faltan ${issues.length} campo(s) obligatorio(s):\n\n${issues.slice(0,8).map(i=>`• ${i.label}`).join("\n")}`);return;}
  setLoading(true);try{const instance=await ensureInstance(answers);const document=await generateDocument({procedure,answers});const supabase=getSupabaseBrowser();
   if(supabase){const {data:{session}}=await supabase.auth.getSession();if(session?.user)await fetch(`/api/instances/${instance.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({answers,status:'document_ready',document,completedAt:new Date().toISOString()})});}
   procedureStorage.update(instance.id,{answers,status:'document_ready',document,completedAt:new Date().toISOString()});localDraftStorage.remove(draftKey);router.push(`/tramites/${params.slug}/resultado/${instance.id}`);
  }catch(error){console.error(error);alert("No fue posible generar el documento. Inténtalo nuevamente.")}finally{setLoading(false)}
 }
 return <main className="min-h-screen bg-slate-50 text-slate-900 font-sans"><Header/><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow"><div className="mb-6"><p className="text-sm font-medium text-blue-600">{procedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">Completa los datos. TrámiteYa adaptará el flujo según el trámite elegido.</p></div><div className="flex justify-end mb-4"><button onClick={()=>{localDraftStorage.remove(draftKey);setInstanceId(undefined);setResetSignal(s=>s+1)}} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div><StepForm steps={definition.steps} onComplete={handleComplete} draftKey={draftKey} resetSignal={resetSignal} instanceId={instanceId} onInstanceReady={setInstanceId}/>{loading&&<div className="mt-4 text-sm text-slate-500">Generando documento...</div>}</div></section><Footer/></main>;
}
