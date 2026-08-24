'use client';

import { useEffect, useMemo, useState } from 'react';
import TransitComparendosEditor from './TransitComparendosEditor';
import type { Comparendo } from '@/lib/transitPrescription';
import type { TransitPrescriptionAnswers } from '@/data/transitPrescriptionInterview';
import { localDraftStorage } from '@/lib/draftStorage';

type Props = {
  draftKey: string;
  initialAnswers?: TransitPrescriptionAnswers;
  onComplete: (answers: TransitPrescriptionAnswers & { __legalQuality?: any }) => void;
};

const empty: TransitPrescriptionAnswers = {
  fullName: '', documentType: 'CC', documentNumber: '', email: '',
  authorityMunicipality: '', authorityDepartment: 'Sucre',
  comparendos: [{ number: '' }],
};

export default function TransitPrescriptionWizard({ draftKey, initialAnswers, onComplete }: Props) {
  const [answers, setAnswers] = useState<TransitPrescriptionAnswers>(initialAnswers || empty);
  const [step, setStep] = useState(0); const [error, setError] = useState(''); const [quality, setQuality] = useState<any>(null);
  useEffect(() => { const saved = localDraftStorage.load(draftKey) as any; if (saved?.data) setAnswers({ ...empty, ...saved.data }); }, [draftKey]);
  useEffect(() => { localDraftStorage.save(draftKey, { data: answers, savedAt: new Date().toISOString() }); }, [answers, draftKey]);
  const comparendos = useMemo(() => answers.comparendos as Comparendo[], [answers.comparendos]);
  function patch(patch: Partial<TransitPrescriptionAnswers>) { setAnswers((current) => ({ ...current, ...patch })); setError(''); setQuality(null); }
  async function next() {
    if (step === 0 && (!answers.fullName.trim() || !answers.documentNumber.trim() || !answers.email.trim())) { setError('Completa nombre, documento y correo.'); return; }
    if (step === 1 && (!answers.authorityMunicipality.trim() || !answers.authorityDepartment.trim())) { setError('Indica el municipio y departamento donde ocurrió el comparendo.'); return; }
    if (step === 2 && answers.comparendos.some((c) => !c.number.trim())) { setError('Cada comparendo debe tener un número.'); return; }
    if (step < 3) { setStep(step + 1); return; }
    const payload = { applicant: { fullName: answers.fullName, documentType: answers.documentType, documentNumber: answers.documentNumber, email: answers.email }, authority: { name: answers.authorityName || '', municipality: answers.authorityMunicipality, department: answers.authorityDepartment }, comparendos };
    try {
      const response = await fetch('/api/legal-quality/transito-prescripcion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json(); setQuality(result);
      if (!response.ok) { setError('TrámiteYa necesita verificar información del expediente antes de generar el documento.'); return; }
      onComplete({ ...answers, __legalQuality: result });
    } catch { setError('No fue posible validar el caso. Inténtalo nuevamente.'); }
  }
  const labels = ['Tus datos', 'Lugar', 'Comparendos', 'Revisión automática'];
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-blue-600">Paso {step + 1} de 4</p><h2 className="text-xl font-bold">{labels[step]}</h2></div><div className="text-right"><div className="text-xs text-slate-500">Nivel de preparación</div><div className="text-lg font-bold">{quality ? `${quality.score}%` : 'En revisión'}</div></div></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {step === 0 && <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Nombre completo<input className="mt-1 w-full rounded-xl border p-3" value={answers.fullName} onChange={(e) => patch({ fullName: e.target.value })} placeholder="Ej. Deiner Jose Julio Clemente" /></label><label className="text-sm font-medium">Tipo de documento<select className="mt-1 w-full rounded-xl border p-3" value={answers.documentType} onChange={(e) => patch({ documentType: e.target.value })}><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="PAS">Pasaporte</option></select></label><label className="text-sm font-medium">Número de documento<input className="mt-1 w-full rounded-xl border p-3" value={answers.documentNumber} onChange={(e) => patch({ documentNumber: e.target.value })} /></label><label className="text-sm font-medium">Correo electrónico<input type="email" className="mt-1 w-full rounded-xl border p-3" value={answers.email} onChange={(e) => patch({ email: e.target.value })} /></label></div>}
    {step === 1 && <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Municipio<input className="mt-1 w-full rounded-xl border p-3" value={answers.authorityMunicipality} onChange={(e) => patch({ authorityMunicipality: e.target.value })} placeholder="Ej. Sampués" /></label><label className="text-sm font-medium">Departamento<input className="mt-1 w-full rounded-xl border p-3" value={answers.authorityDepartment} onChange={(e) => patch({ authorityDepartment: e.target.value })} placeholder="Ej. Sucre" /></label><div className="md:col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No necesitas conocer el nombre exacto de la Secretaría. El sistema deberá identificar la autoridad competente antes de generar el documento.</div></div>}
    {step === 2 && <div><p className="mb-4 text-sm text-slate-500">Escribe únicamente los números de los comparendos que quieres incluir.</p><TransitComparendosEditor value={comparendos} onChange={(value) => patch({ comparendos: value })} /></div>}
    {step === 3 && <div className="space-y-4"><div className="rounded-2xl border bg-slate-50 p-5"><p className="font-semibold">No tienes que adivinar fechas ni actuaciones jurídicas.</p><p className="mt-2 text-sm text-slate-600">TrámiteYa tratará como datos por verificar la fecha de infracción, fecha de cobro coactivo, notificación del mandamiento de pago, acuerdos de pago, embargos y demás actuaciones. Cuando esa información sea necesaria, se solicitará soporte o se consultará el expediente, en lugar de pedirte que la recuerdes.</p></div><div className="rounded-2xl border p-5"><p className="font-semibold">Preparación del trámite</p>{quality ? <div className={`mt-3 rounded-xl p-4 ${quality.level === 'green' ? 'bg-emerald-50 text-emerald-800' : quality.level === 'yellow' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}><strong>{quality.score}% — {quality.level === 'green' ? 'Listo para generar' : quality.level === 'yellow' ? 'Requiere verificación' : 'No listo para generar'}</strong><p className="mt-1 text-sm">{quality.issues?.filter((i:any) => i.severity !== 'info').map((i:any) => i.message).join(' ')}</p></div> : <p className="mt-2 text-sm text-slate-500">Pulsa “Analizar caso” y TrámiteYa revisará qué información falta verificar.</p>}</div></div>}
    <div className="flex items-center justify-between border-t pt-5"><button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Atrás</button><div className="flex gap-3">{step === 3 && <button type="button" onClick={() => setQuality(null)} className="rounded-xl border px-4 py-2">Editar</button>}<button type="button" onClick={next} className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white">{step === 3 ? 'Analizar caso' : 'Continuar'}</button></div></div>
  </div>;
}
