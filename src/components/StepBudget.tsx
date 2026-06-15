import React, { useState } from 'react';
import { 
  Database, 
  Trash2, 
  PlusCircle, 
  AlertOctagon, 
  CheckCircle, 
  Wallet, 
  TrendingUp,
  FileSpreadsheet,
  Shuffle,
  ShieldCheck,
  Loader2,
  Lock
} from 'lucide-react';
import { PlanState, ClimateMeasure } from '../types';

interface StepBudgetProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  onNext: () => void;
  correlationId: string;
}

export default function StepBudget({ state, onStateUpdate, onNext, correlationId }: StepBudgetProps) {
  const { measures, adaptationCapacity } = state;
  const isBlockedByInercia = adaptationCapacity.inertiaFlagActive;

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [isTechnical, setIsTechnical] = useState(false);

  // 2026-2030 Plurianual states
  const [b2026, setB2026] = useState('');
  const [b2027, setB2027] = useState('');
  const [b2028, setB2028] = useState('');
  const [b2029, setB2029] = useState('');
  const [b2030, setB2030] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('pilcomayo-oficial');

  // Status logs
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [errorRollback, setErrorRollback] = useState<{ msg: string; corrId: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState('');

  const totalBudget = measures.reduce((sum, m) => sum + m.budget, 0);

  const handleAutoDistribute = () => {
    const total = parseFloat(budget || '0');
    if (isNaN(total) || total <= 0) return;
    const split = Math.round((total / 5) * 100) / 100;
    setB2026(split.toString());
    setB2027(split.toString());
    setB2028(split.toString());
    setB2029(split.toString());
    setB2030((total - split * 4).toFixed(2)); // handle rounding residue
  };

  const handleSubmitMeasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.isClosed) return;
    setIsAdding(true);
    setErrorRollback(null);
    setSuccessBanner('');

    try {
      const response = await fetch('/api/step7/save-measure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          name,
          description,
          budget: budget === '' ? 0 : parseFloat(budget),
          isTechnicalStrengthening: isTechnical,
          sourceId: selectedSourceId,
          budget2026: b2026 === '' ? 0 : parseFloat(b2026),
          budget2027: b2027 === '' ? 0 : parseFloat(b2027),
          budget2028: b2028 === '' ? 0 : parseFloat(b2028),
          budget2029: b2029 === '' ? 0 : parseFloat(b2029),
          budget2030: b2030 === '' ? 0 : parseFloat(b2030)
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Rollback event occurred
        setErrorRollback({
          msg: data.error || 'Error transaccional en el servidor.',
          corrId: data.correlationId || correlationId
        });
        setIsAdding(false);
        return;
      }

      // Success
      onStateUpdate(data.state);
      setName('');
      setDescription('');
      setBudget('');
      setIsTechnical(false);
      setB2026('');
      setB2027('');
      setB2028('');
      setB2029('');
      setB2030('');

      if (data.inerciaResolved) {
        setSuccessBanner('¡TRATAMIENTO DE INERCIA COMPLETADO! Se ingresó una medida de Fortalecimiento Técnico financiada de manera atómica, desbloqueando la firma digital del Paso 8.');
      } else {
        setSuccessBanner('Medida climatológica consolidada en el banco con éxito de acuerdo a Ley No 777.');
      }

    } catch (e) {
      setErrorRollback({
        msg: 'Fallo de enlace de red con los servidores de validación.',
        corrId: correlationId
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMeasure = async (id: string) => {
    if (state.isClosed) return;
    setIsDeleting(id);
    setErrorRollback(null);
    setSuccessBanner('');
    try {
      const response = await fetch('/api/step7/delete-measure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        onStateUpdate(data.state);
        setSuccessBanner('Medida climatológica removida del expediente con éxito.');
      }
    } catch (e) {
      setErrorRollback({
        msg: 'Error al contactar al servidor para baja de medida.',
        corrId: correlationId
      });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 select-none">
      
      {/* Header section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-blue-600">
          <Wallet className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Planificación Financiera Plurianual</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paso 7: Presupuestación Atómica y Banco de Medidas</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Formule las medidas estructurales de resiliencia hídrica. Toda medida debe asociar un presupuesto real. Las omisiones presupuestarias gatillan una reversión rollback obligatoria.
        </p>
      </div>

      {state.isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-sm select-none">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <span>MODO LECTURA INMUTABLE: El presente expediente está cerrado oficialmente. No se permite dar de alta o baja medidas de inversión adaptativa.</span>
        </div>
      )}

      {/* Transactional feedback alerts */}
      {errorRollback && (
        <section className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-2 text-xs shadow-sm animate-shake">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h4 className="font-extrabold uppercase tracking-widest text-rose-700">ALERT: TRANSACTION ROLLBACK DISPARADO</h4>
              <p className="mt-1 font-semibold leading-relaxed">{errorRollback.msg}</p>
              <div className="flex gap-4 font-mono text-[10px] text-rose-500/80 mt-2 bg-rose-100/40 p-2 rounded-lg border border-rose-200/50">
                <span>Correlation ID: {errorRollback.corrId}</span>
                <span>•</span>
                <span>STATUS: TRANSACTION_ABORTED_ROLLBACK</span>
                <span>•</span>
                <span>SAFE RESTORE STATE: OK</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {successBanner && (
        <section className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-semibold animate-fade-in shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p>{successBanner}</p>
        </section>
      )}

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left column: Add form */}
        <section className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Database className="w-4.5 h-4.5 text-blue-600" />
            <span>Formular Medida Adaptativa</span>
          </h3>

          <form onSubmit={handleSubmitMeasure} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Medida (Ej. Canalización de Drenaje)</label>
              <input
                required
                disabled={state.isClosed}
                type="text"
                placeholder="Presas de contención hídrica rústicas..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-450"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción de la Medida</label>
              <textarea
                required
                disabled={state.isClosed}
                rows={2}
                placeholder="Detalle los beneficios técnicos, de contención fluvial o resiliencia..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-450"
              />
            </div>

            {/* Source Document Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Evidencia Territorial Vinculada (Paso 2)</label>
              <select
                disabled={state.isClosed}
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-bold bg-white"
              >
                {state.evidenceName ? (
                  <option value="evidencia-paso2">Estudio de Campo: {state.evidenceName}</option>
                ) : null}
                <option value="pilcomayo-oficial">Predeterminado: Diagnóstico Cuenca Pilcomayo (WGS84)</option>
                <option value="salud-amazonia-oficial">Predeterminado: Vulnerabilidad GEDSI Salud Amazonia</option>
                <option value="ninguno">Ninguno (Provocar Excepción de Consistencia Metodológica)</option>
              </select>
              <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                * Consistencia Metodológica: Toda medida de costo del Paso 7 debe estar vinculada a una fuente de diagnóstico territorial del Paso 2.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Costo Total Estimado (BOB)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold select-none">BOB</span>
                <input
                  type="number"
                  disabled={state.isClosed}
                  placeholder="254000"
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value);
                    setErrorRollback(null);
                  }}
                  className="w-full text-xs p-2.5 pl-12 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-bold disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-450"
                />
              </div>
            </div>

            {/* Plurianual budget split */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center bg-slate-100/50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-tight">Presupuesto Plurianual (2026-2030)</span>
                <button
                  type="button"
                  disabled={state.isClosed || !budget || parseFloat(budget) <= 0}
                  onClick={handleAutoDistribute}
                  className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-extrabold transition-all cursor-pointer"
                >
                  Distribuir Equitativamente
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1 font-mono">
                <div>
                  <span className="block text-[8px] text-slate-400 font-extrabold text-center mb-0.5">2026</span>
                  <input
                    required
                    type="number"
                    disabled={state.isClosed}
                    placeholder="0"
                    value={b2026}
                    onChange={(e) => setB2026(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-extrabold text-center mb-0.5">2027</span>
                  <input
                    required
                    type="number"
                    disabled={state.isClosed}
                    placeholder="0"
                    value={b2027}
                    onChange={(e) => setB2027(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-extrabold text-center mb-0.5">2028</span>
                  <input
                    required
                    type="number"
                    disabled={state.isClosed}
                    placeholder="0"
                    value={b2028}
                    onChange={(e) => setB2028(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-extrabold text-center mb-0.5">2029</span>
                  <input
                    required
                    type="number"
                    disabled={state.isClosed}
                    placeholder="0"
                    value={b2029}
                    onChange={(e) => setB2029(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-extrabold text-center mb-0.5">2030</span>
                  <input
                    required
                    type="number"
                    disabled={state.isClosed}
                    placeholder="0"
                    value={b2030}
                    onChange={(e) => setB2030(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
              </div>
              <p className="text-[9px] leading-tight text-slate-400 italic">
                * Suma total asignada: {((parseFloat(b2026 || '0') + parseFloat(b2027 || '0') + parseFloat(b2028 || '0') + parseFloat(b2029 || '0') + parseFloat(b2030 || '0')) || 0).toLocaleString('es-BO')} BOB. Debe ser matemática e idéntica al Costo Total Estimado.
              </p>
            </div>

            {/* Checkbox for Inercia Institutional bypass */}
            <div className={`p-4 rounded-xl border transition-all ${
              isTechnical 
                ? 'bg-blue-50 border-blue-300' 
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={state.isClosed}
                  checked={isTechnical}
                  onChange={(e) => setIsTechnical(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="block text-xs font-extrabold text-slate-900 uppercase tracking-tight">
                    Medida de Fortalecimiento Técnico
                  </span>
                  <span className="block text-[10px] text-slate-500 leading-normal mt-0.5">
                    Obligatorio para liberar bloqueos por baja capacidad de adaptación institucional de Nivel 1.
                  </span>
                </div>
              </label>

              {isBlockedByInercia && !isTechnical && (
                <span className="block text-[9px] mt-2 bg-yellow-105 border border-amber-300 text-amber-700 px-2 py-0.5 rounded-md font-bold animate-pulse text-center uppercase tracking-wide">
                  ⚠️ Necesita tildar esta opción para destrabar la firma ministerial.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isAdding || state.isClosed}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                state.isClosed
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                  : isAdding
                  ? 'bg-slate-450 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-98'
              }`}
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Procesando Transacción en Servidor...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4.5 h-4.5" />
                  <span>Incorporar al Expediente</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right column: Table and summary costs */}
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center select-none">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileSpreadsheet className="w-4.5 h-4.5" />
                <span>Base de Medidas de Inversión Regulada</span>
              </h3>
              <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold font-mono">
                Registros: {measures.length}
              </span>
            </div>

            {/* List */}
            {measures.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 select-none uppercase tracking-wider">
                    <th className="p-3 pl-4">Descripción</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Inversión (BOB)</th>
                    <th className="p-3 text-center width-[50px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {measures.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="p-3 pl-4">
                        <p className="font-extrabold text-slate-800">{m.name}</p>
                        <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed max-w-[340px]" title={m.description}>
                          {m.description}
                        </p>
                        {m.budget2026 !== undefined && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 text-[9px] font-mono text-slate-500 font-extrabold select-none bg-slate-50/50 p-1 rounded-md border border-slate-200/60 max-w-[340px]">
                            <span title="Presupuesto 2026" className="text-blue-700">26: {m.budget2026.toLocaleString('es-BO')} BOB</span>
                            <span title="Presupuesto 2027" className="border-l border-slate-200 pl-2 text-slate-600">27: {m.budget2027?.toLocaleString('es-BO')} BOB</span>
                            <span title="Presupuesto 2028" className="border-l border-slate-200 pl-2 text-slate-600">28: {m.budget2028?.toLocaleString('es-BO')} BOB</span>
                            <span title="Presupuesto 2029" className="border-l border-slate-200 pl-2 text-slate-600">29: {m.budget2029?.toLocaleString('es-BO')} BOB</span>
                            <span title="Presupuesto 2030" className="border-l border-slate-200 pl-2 text-slate-600">30: {m.budget2030?.toLocaleString('es-BO')} BOB</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {m.type === 'fortalecimiento_tecnico' ? (
                          <span className="text-[9px] bg-emerald-150 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded font-extrabold uppercase select-none">
                            F. Técnico
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase select-none">
                            General
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {m.budget.toLocaleString('es-BO')}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={isDeleting !== null || state.isClosed}
                          onClick={() => handleDeleteMeasure(m.id)}
                          className={`p-1.5 rounded text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer ${
                            isDeleting === m.id ? 'opacity-40' : ''
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {isDeleting === m.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400 select-none">
                <p className="text-xs font-bold uppercase">No se registran medidas</p>
                <p className="text-[10px] mt-1 text-slate-400">Ingrese proyectos adaptativos para rellenar la matriz financiera.</p>
              </div>
            )}

            {/* Total Footer row */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center select-none">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Presupuesto Consolidado</p>
                <p className="text-xs font-semibold text-slate-500">Multianual SIPEB 2026-2030</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black font-sans text-slate-500 mr-1.5">BOB</span>
                <span className="text-xl font-black font-mono text-slate-900">
                  {totalBudget.toLocaleString('es-BO')}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Status Check Card */}
          <div className={`p-4.5 rounded-xl border flex items-center justify-between gap-4 ${
            isBlockedByInercia 
              ? 'bg-rose-50/50 border-rose-300 text-rose-800 animate-pulse'
              : 'bg-emerald-50/70 border-emerald-300 text-[#004d34]'
          }`}>
            <div className="flex items-center gap-3">
              <ShieldCheck className={`w-10 h-10 shrink-0 ${isBlockedByInercia ? 'text-rose-600 font-extrabold pb-0.5' : 'text-emerald-600'}`} />
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest">
                  ESTADO DE GABINETE REGIONAL:
                </h4>
                <p className="text-[10px] font-bold mt-0.5">
                  {isBlockedByInercia 
                    ? 'BLOQUEADO: Falta ingresar medidas de Fortalecimiento Técnico para despejar inercia.' 
                    : 'LIBERADO: Aptitud técnica para firma digital ministerial cumplida exitosamente.'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation action bar */}
          <div className="pt-2 flex justify-end gap-3 select-none">
            <button
              onClick={onNext}
              className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
            >
              <span>{state.isClosed ? 'Continuar (Expediente Cerrado)' : 'Validar Presupuesto y Firmar'}</span>
            </button>
          </div>

        </section>

      </div>
    </div>
  );
}
