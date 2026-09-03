"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Scale, ShieldCheck } from "lucide-react";

// AUDIT MODE — temporal. Reactivar Wompi eliminando este flag y restaurando el gate.
const AUDIT_MODE = true;

function cleanDisplayText(value: string) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/^\s*#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^\s*[-•]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function isProtectionStart(line: string) {
  return /^\s*(?:III\.?\s+HECHOS\s+Y\s+ANTECEDENTES|Yo,\s+)/i.test(line.trim());
}

function lineClass(line: string) {
  const text = line.trim();
  if (/^(SEÑORES|ASUNTO:|PETICIONARIO:|REFERENCIA:)/i.test(text)) return "font-bold text-slate-950";
  if (/^(?:[IVX]+)\.?\s+/.test(text)) return "font-bold text-slate-950 tracking-[0.02em]";
  if (/^4\.[1-4]\./.test(text)) return "font-semibold text-slate-950";
  if (/^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO):/i.test(text)) return "font-semibold text-slate-950";
  return "";
}

export default function DocumentPreview({ content, procedureId, instanceId }: { content: string; procedureId: string; instanceId?: string; }) {
  const [downloadLoading, setDownloadLoading] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Wompi queda resguardado durante la auditoría y no se inicializa ni precarga.
  useEffect(() => {
    if (AUDIT_MODE) return;
  }, []);

  const sections = useMemo(() => {
    const lines = cleanDisplayText(content).split("\n");
    const index = lines.findIndex(isProtectionStart);
    if (index < 0) return { visible: lines, protected: [] as string[] };
    return { visible: lines.slice(0, index), protected: lines.slice(index) };
  }, [content]);

  async function download(format: "pdf" | "docx") {
    if (!procedureId) return;
    setDownloadLoading(format);
    setDownloadError(null);
    try {
      const response = await fetch("/api/documents/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(instanceId ? { "x-guest-access-token": instanceId } : {}),
          ...(AUDIT_MODE ? { "x-tramiteya-audit-mode": "true" } : {}),
        },
        body: JSON.stringify({
          format,
          content: cleanDisplayText(content),
          procedureId,
          instanceId: instanceId || undefined,
          title: "TramiteYa - Derecho de Petición",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No fue posible descargar el documento.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = format === "pdf" ? "TramiteYa-Derecho-de-Peticion.pdf" : "TramiteYa-Derecho-de-Peticion.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "No fue posible descargar el documento.");
    } finally {
      setDownloadLoading(null);
    }
  }

  return <div className="relative">
    <div className="whitespace-pre-wrap p-8 font-sans leading-relaxed text-slate-900">
      {sections.visible.map((line, index) => <div key={index} className={`whitespace-pre-wrap min-h-[1.5rem] ${lineClass(line)}`}>{line || "\u00a0"}</div>)}
    </div>

    {sections.protected.length > 0 && <div className="relative mt-6">
      <div className="pointer-events-auto select-text">
        {sections.protected.map((line, index) => <div key={index} className={`whitespace-pre-wrap min-h-[1.5rem] ${lineClass(line)}`}>{line || "\u00a0"}</div>)}
      </div>
    </div>}

    <div className="mx-8 mb-6 space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <ShieldCheck className="h-5 w-5" />
        Modo auditoría activo: documento completo visible y descargas habilitadas para pruebas.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => download("pdf")} disabled={Boolean(downloadLoading)} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
          <Download className="h-5 w-5" />
          {downloadLoading === "pdf" ? "Generando PDF…" : "Descargar PDF"}
        </button>
        <button type="button" onClick={() => download("docx")} disabled={Boolean(downloadLoading)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
          <FileText className="h-5 w-5" />
          {downloadLoading === "docx" ? "Generando Word…" : "Descargar Word (.DOCX)"}
        </button>
      </div>
      {downloadError && <p className="text-center text-xs font-semibold text-red-600">{downloadError}</p>}
    </div>
  </div>;
}
