"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RecordItem = {
  number?: string; date?: string; authority?: string; plate?: string;
  status?: string; value?: number; description?: string; documentNumber?: string;
};

function money(value?: number) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export default function SimitUploadFirst({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [documentNumber, setDocumentNumber] = useState("");

  async function upload(file: File) {
    setLoading(true); setError(""); setRecords([]);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/simit/upload", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "No fue posible analizar el Estado de Cuenta.");
      const found = (payload.records || []) as RecordItem[];
      if (!found.length) throw new Error("No encontramos comparendos en el PDF.");
      setDocumentNumber(String(payload.documentNumber || found[0]?.documentNumber || ""));
      setRecords(found);
      if (found.length === 1) select(found[0], payload.documentNumber || found[0]?.documentNumber || "");
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible analizar el PDF."); }
    finally { setLoading(false); }
  }

  function select(record: RecordItem, doc: string) {
    const document = String(doc || record.documentNumber || "").replace(/\D/g, "");
    const answers = {
      documentType: "CC", documentNumber: document, cedula: document, numeroDocumento: document,
      nombreCompleto: record.documentNumber ? "" : "", comparendo: record.number || "", numeroComparendo: record.number || "", multa: record.number || "",
      fechaComparendo: record.date || "", autoridad: record.authority || "", organismoTransito: record.authority || "",
      placa: record.plate || "", estadoComparendo: record.status || "", valorMulta: record.value ?? "",
      descripcionInfraccion: record.description || "", __simitRecord: record,
    };
    try {
      localStorage.setItem(`tramiteya:simit:${slug}`, JSON.stringify({ documentNumber: document, record, answers, savedAt: new Date().toISOString() }));
      router.push(`/tramites/${slug}/formulario?simitReady=1`);
    } catch { router.push(`/tramites/${slug}/formulario`); }
  }

  return <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-6">
    <p className="text-sm font-semibold text-blue-700">Paso 1 · Fuente oficial</p>
    <h2 className="text-xl font-bold mt-1">Sube primero tu Estado de Cuenta de SIMIT</h2>
    <p className="text-sm text-slate-600 mt-2">No necesitas escribir la cédula ni copiar datos. Sube el PDF descargado directamente de SIMIT y TrámiteYa intentará extraer automáticamente la cédula y todos los comparendos.</p>
    <label className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl px-5 py-4 text-center font-semibold text-white ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
      <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={loading} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = ""; }} />
      {loading ? "Analizando Estado de Cuenta..." : "Subir Estado de Cuenta SIMIT (PDF)"}
    </label>
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {records.length > 1 && <div className="mt-5 space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Cédula detectada: <strong>{documentNumber || "no identificada"}</strong>. Se encontraron {records.length} comparendos. Selecciona uno; cada documento jurídico corresponde a un solo comparendo.</div><h3 className="font-bold">¿Cuál comparendo quieres revisar?</h3>{records.map((r, i) => <button key={`${r.number}-${i}`} onClick={() => select(r, documentNumber)} className="w-full text-left rounded-xl border bg-white p-4 hover:border-blue-500"><div className="flex justify-between"><strong>{r.number || `Registro ${i + 1}`}</strong><strong>{money(r.value)}</strong></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-slate-600"><span>Fecha: {r.date || "—"}</span><span>Placa: {r.plate || "—"}</span><span>Organismo: {r.authority || "—"}</span><span>Estado: {r.status || "—"}</span></div><span className="block mt-2 text-xs font-semibold text-blue-700">Usar este comparendo →</span></button>)}</div>}
    {records.length === 1 && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Comparendo identificado. Preparando automáticamente el trámite…</div>}
  </div>;
}
