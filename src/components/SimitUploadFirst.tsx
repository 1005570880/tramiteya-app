"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SimitDownloadGuide from "./SimitDownloadGuide";

type RecordItem = { number?: string; numero?: string; numeroComparendo?: string; date?: string; fecha?: string; fechaInfraccion?: string; authority?: string; organismo?: string; plate?: string; placa?: string; status?: string; estado?: string; value?: number; valor?: number; valorMulta?: number; description?: string; documentNumber?: string; ownerName?: string; department?: string; infractionCode?: string; resolutionNumber?: string; resolutionDate?: string; notificationDate?: string; paymentDate?: string; organismId?: string; photoDetection?: boolean };
type SimitSession = { records: RecordItem[]; documentNumber: string; fileName: string; rawText?: string; selectedRecord?: RecordItem | null };
type ApiRecord = RecordItem & { [key: string]: unknown };
const SIMIT_SESSION_KEY = "tramiteya:simit-upload:v1";

function money(value?: number) { if (value == null) return "—"; return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value); }
function normalizeDocument(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function normalizeRecord(raw: ApiRecord): RecordItem | null {
  const number = String(raw.number ?? raw.numeroComparendo ?? raw.numero ?? "").replace(/\s+/g, "").trim();
  if (!number) return null;
  return { ...raw, number, date: raw.date ?? raw.fecha ?? raw.fechaInfraccion, authority: raw.authority ?? raw.organismo, plate: raw.plate ?? raw.placa, status: raw.status ?? raw.estado, value: raw.value ?? raw.valor ?? raw.valorMulta } as RecordItem;
}
function saveSession(records: RecordItem[], documentNumber: string, fileName: string, selectedRecord: RecordItem | null = null, rawText = "") { try { sessionStorage.setItem(SIMIT_SESSION_KEY, JSON.stringify({ records, documentNumber, fileName, rawText, selectedRecord } satisfies SimitSession)); } catch {} }

export default function SimitUploadFirst({ slug }: { slug: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [records, setRecords] = useState<RecordItem[]>([]); const [documentNumber, setDocumentNumber] = useState("");

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError("El PDF supera el límite de 10 MB."); return; }
    setLoading(true); setError(""); setRecords([]);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/simit/upload", { method: "POST", body: form });
      const payload: { ok?: boolean; success?: boolean; message?: string; records?: ApiRecord[]; comparendos?: ApiRecord[]; documentNumber?: unknown; extraction?: { documentNumber?: unknown }; extractionData?: { documentNumber?: unknown }; data?: { documentNumber?: unknown }; rawText?: string } = await response.json().catch(() => ({}));
      if (!response.ok || (!payload.ok && !payload.success)) throw new Error(payload.message || "No fue posible analizar el Estado de Cuenta.");
      const rawRecords: ApiRecord[] = Array.isArray(payload.records) ? payload.records : Array.isArray(payload.comparendos) ? payload.comparendos : [];
      const found = rawRecords.map((record: ApiRecord) => normalizeRecord(record)).filter((record): record is RecordItem => Boolean(record));
      if (!found.length) throw new Error("No encontramos comparendos en el PDF. Sube el Estado de Cuenta descargado directamente desde SIMIT.");
      const doc = normalizeDocument(payload.documentNumber ?? payload.extraction?.documentNumber ?? payload.extractionData?.documentNumber ?? payload.data?.documentNumber ?? found[0]?.documentNumber);
      const hydrated = found.map(record => ({ ...record, ...(doc ? { documentNumber: doc } : {}) }));
      const rawText = typeof payload.rawText === "string" ? payload.rawText : "";
      setDocumentNumber(doc); setRecords(hydrated); saveSession(hydrated, doc, file.name, null, rawText);
      if (hydrated.length === 1) select(hydrated[0], doc, hydrated, file.name);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible analizar el PDF."); } finally { setLoading(false); }
  }
  function select(record: RecordItem, doc: string, allRecords: RecordItem[] = records, fileName = "Estado de Cuenta SIMIT") {
    const document = normalizeDocument(doc || record.documentNumber); const hydratedRecords = allRecords.map(item => ({ ...item, ...(document ? { documentNumber: document } : {}) }));
    try { saveSession(hydratedRecords, document, fileName, { ...record, ...(document ? { documentNumber: document } : {}) }); router.push(`/tramites/${slug}/formulario-simit?comparendoId=${encodeURIComponent(record.number || "")}`); } catch { setError("No fue posible preparar los datos del documento."); }
  }
  return <div className="mt-6"><div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-6"><p className="text-sm font-semibold text-blue-700">Paso 1 · Estado de Cuenta SIMIT</p><h2 className="text-xl font-bold mt-1">Sube tu Estado de Cuenta de SIMIT</h2><p className="text-sm text-slate-600 mt-2">Empieza por el PDF. No necesitas escribir la cédula ni copiar datos. TrámiteYa analizará el documento y completará automáticamente todos los campos que pueda identificar de forma fiable.</p></div><SimitDownloadGuide /><div className="rounded-2xl border border-blue-100 bg-blue-50 p-6"><div className="rounded-xl border border-blue-200 bg-white p-4 text-sm text-slate-700"><strong>¿Qué necesitas?</strong><p className="mt-1">Ten a la mano el Estado de Cuenta oficial descargado desde SIMIT. El sistema utilizará únicamente la información contenida en ese documento.</p></div><label className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl px-5 py-4 text-center font-semibold text-white ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={loading} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = ""; }} />{loading ? "Analizando Estado de Cuenta..." : "Subir Estado de Cuenta SIMIT (PDF)"}</label><p className="mt-2 text-xs text-slate-500">PDF · máximo 10 MB</p>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{records.length > 1 && <div className="mt-5 space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Cédula detectada: <strong>{documentNumber || "no identificada"}</strong>. Se encontraron {records.length} comparendos. Selecciona uno; cada documento jurídico corresponde a un solo comparendo.</div><h3 className="font-bold">Selecciona el comparendo que vas a revisar</h3>{records.map((r, i) => <button key={`${r.number}-${i}`} onClick={() => select(r, documentNumber, records, "Estado de Cuenta SIMIT")} className="w-full text-left rounded-xl border bg-white p-4 hover:border-blue-500"><div className="flex justify-between"><strong>{r.number || `Registro ${i + 1}`}</strong><strong>{money(r.value)}</strong></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-slate-600"><span>Fecha: {r.date || "—"}</span><span>Placa: {r.plate || "—"}</span><span>Organismo: {r.authority || "—"}</span><span>Estado: {r.status || "—"}</span></div><span className="block mt-2 text-xs font-semibold text-blue-700">Usar este comparendo →</span></button>)}</div>}{records.length === 1 && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Comparendo identificado. Preparando automáticamente el formulario…</div>}</div></div>;
}