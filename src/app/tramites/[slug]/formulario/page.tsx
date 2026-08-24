"use client";

import React, { useEffect, useState } from "react";
import StepForm from "../../../../components/StepForm";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { validateProcedureAnswers } from "../../../../lib/multitramiteEngine";
import { evaluateTrafficCase } from "../../../../lib/legalRules";
import { analyzeLegalBasis } from "../../../../lib/normativeEngine";
import { useRouter, useSearchParams } from "next/navigation";
import { localDraftStorage } from "../../../../lib/draftStorage";
import { procedureStorage } from "../../../../lib/procedureStorage";
import { getSupabaseBrowser } from "../../../../lib/supabaseBrowserClient";
import type { FormAnswers } from "../../../../types/form";
import { procedures } from "../../../../data/procedures";
import { getDynamicFormDefinition } from "../../../../data/dynamicForms";

export default function ProcedureForm({ params }: { params: { slug: string } }) {
  const [loading, setLoading] = useState(false); const [resetSignal, setResetSignal] = useState(0); const [instanceId, setInstanceId] = useState<string | undefined>(); const [remoteAnswers, setRemoteAnswers] = useState<FormAnswers | undefined>(); const [analysis, setAnalysis] = useState<any[]>([]); const [preview, setPreview] = useState<FormAnswers | null>(null);
  const router = useRouter(); const search = useSearchParams(); const definition = getDynamicFormDefinition(params.slug); const procedure = procedures.find((p) => p.slug === params.slug); const draftKey = `procedure:${params.slug}`;

  useEffect(() => { (async () => { try { const requested = search.get("instance"); const saved = localDraftStorage.load(draftKey) as any; const supabase = getSupabaseBrowser(); if (!supabase) return; const { data: { session } } = await supabase.auth.getSession(); if (!session?.user) return; let id = requested || saved?.data?.__instanceId; if (!id) { const r = await fetch("/api/instances", { headers: { Authorization: `Bearer ${session.access_token}` } }); if (r.ok) { const p = await r.json(); const existing = (p.data || []).find((i: any) => i.procedureSlug === params.slug && (i.status === "in_progress" || i.status === "draft")); if (existing) id = existing.id; } } if (!id) return; const r = await fetch(`/api/instances/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); if (!r.ok) return; const i = await r.json(); setInstanceId(i.id); setRemoteAnswers(i.answers || {}); localDraftStorage.save(draftKey, { data: { ...(saved?.data || {}), ...(i.answers || {}), __instanceId: i.id }, savedAt: new Date().toISOString() }); } catch (e) { console.error(e); } })(); }, [search, draftKey, params.slug]);

  if (!definition || !procedure) return <main className="min-h-screen bg-slate-50"><Header/><section className="max-w-4xl mx-auto px-4 py-16"><h1 className="text-2xl font-bold">Trámite no disponible</h1></section><Footer/></main>;

  function analyze(a: FormAnswers) {
    const currentProcedure = procedure;
    if (!currentProcedure) return [];
    const procedureText = `${params.slug} ${currentProcedure.title} ${currentProcedure.category}`;
    const isTraffic = /multa|comparendo|fotomult|fotodeteccion|fotodetección|transito|tr[aá]nsito/i.test(procedureText);
    if (isTraffic) {
      const decisions = evaluateTrafficCase(a);
      setAnalysis(decisions);
      return decisions;
    }

    const legal = analyzeLegalBasis(params.slug, a);
    const answerText = Object.values(a).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
    const isPetition = legal.norms.some((n) => n.topics.includes("petition"));
    const isHealth = legal.norms.some((n) => n.topics.includes("health")) || /eps|ips|medic|tratamiento|cirug|salud|cita|especialista|afiliad/.test(answerText);
    const decisions: any[] = [];

    if (isPetition) {
      decisions.push({
        id: "derecho-peticion",
        label: isHealth ? "Derecho de petición en materia de salud" : "Derecho de petición: ruta identificada",
        level: "favorable",
        reason: isHealth
          ? "La información suministrada identifica una petición relacionada con la prestación o garantía del derecho a la salud. TrámiteYa puede estructurar la solicitud ante la autoridad o entidad correspondiente, delimitando las actuaciones que estén dentro de sus competencias."
          : "La información suministrada corresponde a una petición. La ruta principal es ejercer el derecho de petición y solicitar una respuesta de fondo, clara y oportuna.",
        nextStep: isHealth
          ? "Presentar la petición ante la entidad competente y solicitar que, si la autoridad receptora no es competente para resolver algún punto, se dé traslado a quien corresponda."
          : "Presentar la petición ante la autoridad o entidad competente y conservar la constancia de radicación.",
        legalBasis: legal.norms.filter((n) => n.topics.includes("petition") || (isHealth && n.topics.includes("health"))).map((n) => `${n.title}${n.article ? `, ${n.article}` : ""}`),
      });
    }

    if (!decisions.length && legal.norms.length) {
      decisions.push({
        id: "fundamento-normativo",
        label: "Ruta jurídica identificada",
        level: "possible",
        reason: legal.rationale[0] || "Se identificaron fuentes normativas relacionadas con el trámite seleccionado.",
        nextStep: "Revisar la autoridad competente y los requisitos específicos antes de presentar el documento.",
        legalBasis: legal.norms.slice(0, 5).map((n) => `${n.title}${n.article ? `, ${n.article}` : ""}`),
      });
    }

    setAnalysis(decisions);
    return decisions;
  }

  async function ensureInstance(a: FormAnswers) { const currentProcedure = procedure; if (!currentProcedure) throw new Error("Procedure not found"); const s = getSupabaseBrowser(); const saved = localDraftStorage.load(draftKey) as any; if (s) { const { data: { session } } = await s.auth.getSession(); if (session?.user) { if (instanceId) { const r = await fetch(`/api/instances/${instanceId}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); if (r.ok) return r.json(); } const r = await fetch("/api/instances", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ procedureId: currentProcedure.id, procedureSlug: currentProcedure.slug, answers: a }) }); if (r.ok) { const x = await r.json(); setInstanceId(x.id); return x; } } } const id = saved?.data?.__instanceId; if (id) { const x = procedureStorage.get(id); if (x) return x; } const x = procedureStorage.create(currentProcedure.id, currentProcedure.slug, a); setInstanceId(x.id); return x; }

  async function generate(a: FormAnswers) {
    const currentProcedure = procedure; if (!currentProcedure) { alert("Trámite no disponible"); return; }
    const issues = validateProcedureAnswers(currentProcedure, a); if (issues.length) { alert(`Faltan ${issues.length} campo(s) obligatorio(s).`); return; }
    setLoading(true);
    try {
      const decisions = analyze(a);
      // Guest checkout must never be blocked by instance persistence. The document
      // generation API is authoritative; a local instance is only needed to route
      // the browser to the result page after generation.
      let instance: any = null;
      try { instance = await ensureInstance(a); } catch (instanceError) {
        console.warn("Guest instance persistence skipped; continuing with document generation", instanceError);
        instance = { id: `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}` };
        setInstanceId(instance.id);
      }
      const enrichedAnswers = { ...a, __legalDecisionEngine: { version: 2, generatedAt: new Date().toISOString(), decisions } } as unknown as FormAnswers;
      const r = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ procedureSlug: currentProcedure.slug, answers: enrichedAnswers, instanceId: instance?.id }) });
      const responseText = await r.text();
      if (!r.ok) {
        console.error("Document generation API error", { status: r.status, response: responseText, procedureSlug: currentProcedure.slug });
        throw new Error(`Document generation failed (${r.status})`);
      }
      const document = JSON.parse(responseText);
      const s = getSupabaseBrowser(); if (s) { const { data: { session } } = await s.auth.getSession(); if (session?.user && instance?.id) await fetch(`/api/instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() }) }); }
      if (instance?.id) procedureStorage.update(instance.id, { answers: enrichedAnswers, status: "document_ready", document, completedAt: new Date().toISOString() });
      localDraftStorage.remove(draftKey); router.push(`/tramites/${params.slug}/resultado/${instance?.id || encodeURIComponent(document.id)}`);
    } catch (e) { console.error("TrámiteYa document generation flow failed", e); alert(e instanceof Error ? e.message : "No fue posible generar el documento. Inténtalo nuevamente"); } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><Header/><section className="max-w-4xl mx-auto px-4 py-12"><div className="bg-white p-6 md:p-8 rounded-2xl shadow"><div className="mb-6"><p className="text-sm font-medium text-blue-600">{procedure.category}</p><h1 className="text-2xl md:text-3xl font-bold mt-1">{definition.title}</h1><p className="text-slate-500 mt-2">Completa los datos. TrámiteYa adaptará el flujo según el trámite elegido.</p></div><div className="flex justify-end mb-4"><button onClick={() => { localDraftStorage.remove(draftKey); setInstanceId(undefined); setRemoteAnswers(undefined); setAnalysis([]); setPreview(null); setResetSignal(x => x + 1); }} className="px-3 py-1 rounded-md border text-sm">Borrar borrador</button></div>{!preview ? <StepForm steps={definition.steps} onComplete={a => { analyze(a); setPreview(a); }} draftKey={draftKey} resetSignal={resetSignal} instanceId={instanceId} onInstanceReady={setInstanceId} initialAnswers={remoteAnswers}/> : <div className="space-y-6"><div><p className="text-sm font-medium text-blue-600">Análisis preliminar</p><h2 className="text-2xl font-bold mt-1">Resultado de tu caso</h2><p className="text-sm text-slate-500 mt-2">Este resultado es preliminar y depende de la información suministrada.</p></div>{analysis.length ? analysis.map((d,i) => <div key={`${d.id}-${i}`} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-4"><strong>{d.label}</strong><span className="text-xs font-semibold uppercase">{d.level === "favorable" ? "Ruta identificada" : d.level === "possible" ? "Requiere verificación" : "Información insuficiente"}</span></div><p className="text-sm text-slate-600 mt-2">{d.reason}</p><p className="text-sm mt-2"><strong>Siguiente actuación:</strong> {d.nextStep}</p>{d.legalBasis?.length ? <p className="text-xs text-slate-500 mt-2"><strong>Fundamento:</strong> {d.legalBasis.join(" · ")}</p> : null}</div>) : <div className="rounded-xl border p-4 text-sm text-slate-600">No se identificó una ruta jurídica concluyente con la información suministrada.</div>}<div className="flex gap-3 pt-2"><button onClick={() => setPreview(null)} className="px-4 py-2 rounded-md border">Editar respuestas</button><button onClick={() => generate(preview)} disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold">{loading ? "Generando..." : "Generar documento"}</button></div></div>}{loading && <div className="mt-4 text-sm text-slate-500">Generando documento...</div>}</div></section><Footer/></main>;
}
