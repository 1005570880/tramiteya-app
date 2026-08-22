"use client";
import React, { useEffect, useState } from "react";
import { procedureStorage } from "../lib/procedureStorage";
import type { ProcedureInstance } from "../types/procedure";
import Link from "next/link";

const labels: Record<string,string> = { draft: "Borrador", in_progress: "En progreso", pending_information: "Información pendiente", review: "En revisión", document_ready: "Documento listo", downloaded: "Descargado", completed: "Completado" };
export default function DashboardClient() {
 const [instances,setInstances]=useState<ProcedureInstance[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
 useEffect(()=>{try{setInstances(procedureStorage.list())}catch{setError("Error al cargar trámites")}finally{setLoading(false)}},[]);
 function handleRemove(id:string){if(!confirm("¿Eliminar este trámite?"))return;procedureStorage.remove(id);setInstances(s=>s.filter(i=>i.id!==id));}
 if(loading)return <div className="bg-white p-6 rounded-xl border">Cargando tus trámites...</div>;
 if(error)return <div className="bg-white p-6 rounded-xl border text-red-600">{error}</div>;
 if(!instances.length)return <div className="bg-white p-8 rounded-xl border text-center"><h3 className="text-lg font-bold">Todavía no tienes trámites</h3><p className="text-sm text-slate-500 mt-2">Comienza uno y aparecerá aquí.</p><Link href="/tramites" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">Iniciar trámite</Link></div>;
 return <div className="grid gap-4">{instances.map(inst=><div key={inst.id} className="bg-white p-5 rounded-xl border"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><div className="font-semibold capitalize">{inst.procedureSlug.replace(/-/g," ")}</div><div className="text-sm text-slate-500 mt-1">{labels[inst.status]||inst.status} · {new Date(inst.updatedAt).toLocaleString("es-CO")}</div></div><div className="flex gap-2 flex-wrap"><Link href={`/tramites/${inst.procedureSlug}/formulario`} className="px-3 py-2 rounded-md border">Continuar</Link>{inst.document&&<Link href={`/tramites/${inst.procedureSlug}/resultado/${inst.id}`} className="px-3 py-2 rounded-md bg-blue-600 text-white">Ver documento</Link>}<button onClick={()=>handleRemove(inst.id)} className="px-3 py-2 rounded-md border text-red-600">Eliminar</button></div></div></div>)}</div>;
}
