import React, { useState } from 'react';
import { 
  FileUp, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Loader2, 
  Lock,
  Download,
  Database,
  ShieldAlert,
  FileWarning
} from 'lucide-react';
import { PlanState } from '../types';

interface StepEvidenceProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  onNext: () => void;
  correlationId: string;
}

export default function StepEvidence({ state, onStateUpdate, onNext, correlationId }: StepEvidenceProps) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(1024); // default non-empty
  const [normMatched, setNormMatched] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [integrityMsg, setIntegrityMsg] = useState('');
  const [integrityErr, setIntegrityErr] = useState('');
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const [isTampering, setIsTampering] = useState(false);

  const handleTamper = async () => {
    setIsTampering(true);
    setIntegrityMsg('');
    setIntegrityErr('');
    try {
      const resp = await fetch('/api/step2/tamper-evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });
      const data = await resp.json();
      if (data.success) {
        onStateUpdate(data.state);
        setIntegrityErr('SABOTAJE SIMULADO: Se han alterado los bytes físicos en el servidor volumen hídrico.');
      }
    } catch (err) {
      setIntegrityErr('Error de red al ejecutar simulación de sabotaje.');
    } finally {
      setIsTampering(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifyingIntegrity(true);
    setIntegrityMsg('');
    setIntegrityErr('');
    try {
      const resp = await fetch('/api/step2/verify-evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setIntegrityErr(data.error || 'Evidencia corrupta detectada.');
        onStateUpdate(data.state || state);
      } else {
        setIntegrityMsg(data.msg || '✓ Integridad de Hash SHA-256 confirmada con éxito.');
        onStateUpdate(data.state);
      }
    } catch (err) {
      setIntegrityErr('Fallo de red en la llamada del validador de Hash.');
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const currentScenarioName = state.planType === 'PES' 
    ? 'Caso A: Plan de Salud Sectorial Amazónico' 
    : 'Caso B: Plan Autonómico Tarija (GADM)';

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.isClosed) return;
    setIsUploading(true);
    setBackendError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/step2/upload-evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          fileName: fileName || (state.planType === 'PES' ? 'Evidencia_Salud_Amazonia.pdf' : 'Diagnostico_Hidrico_Tarija.pdf'),
          contentLength: fileSize,
          normativityMatched: normMatched
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setBackendError(data.error || 'Err en validación de evidencia.');
        onStateUpdate(data.state || {
          ...state,
          evidenceStatus: 'REJECTED',
          evidenceError: data.error || 'Error: Evidencia no cumple con estándares de auditoría'
        });
      } else {
        setSuccessMsg(data.msg || '✓ Evidencia aprobada.');
        onStateUpdate(data.state);
      }
    } catch (err) {
      setBackendError('Falla crítica de red al autorizar evidencia en el cargador SIPEB.');
    } finally {
      setIsUploading(false);
    }
  };

  const simulateScenario = (type: 'valid' | 'empty' | 'nonconforming') => {
    if (type === 'valid') {
      setFileName(state.planType === 'PES' ? 'Diagnostico_Clinico_Amazonia_25.pdf' : 'Pliego_Deficit_Hidrico_Tarija_Signed.pdf');
      setFileSize(15420);
      setNormMatched(true);
    } else if (type === 'empty') {
      setFileName('Archivo_Vacio_Prueba.pdf');
      setFileSize(0);
      setNormMatched(true);
    } else {
      setFileName('Diagnostico_Informal_Sin_Firmas.pdf');
      setFileSize(450);
      setNormMatched(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 select-none max-w-4xl mx-auto">
      
      {/* Header section */}
      <div className="flex flex-col gap-1.5 text-center sm:text-left">
        <div className="flex items-center gap-2 text-blue-600 justify-center sm:justify-start">
          <Database className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Control de Evidencias Integradas del Territorio</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paso 2: Diagnóstico Territorial y Evidencia de Auditoría</h2>
        <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
          Toda planificación sectorial o regional debe contar con respaldos de estudios de campo validados en su estructura, normados bajo el SIPEB y cargados con firmas certificadas.
        </p>
      </div>

      {state.isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-sm">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <span>MODO LECTURA INMUTABLE: El presente expediente está cerrado. Las fuentes y evidencias ya no pueden modificarse.</span>
        </div>
      )}

      {/* Main interface card */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left load options and uploader */}
        <section className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Cargador Técnico de Evidencias
            </h3>
            <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-extrabold font-mono uppercase">
              {state.planType}
            </span>
          </div>

          <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-xl text-xs text-blue-900 leading-normal">
            <strong>Plan Técnico Seleccionado:</strong> {currentScenarioName}
          </div>

          {/* Quick Sandbox Simulation Presets */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Preconfigurar Simulador UAT:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={state.isClosed}
                onClick={() => simulateScenario('valid')}
                className="py-2 px-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-extrabold text-emerald-800 transition-colors cursor-pointer"
              >
                ✓ Simular Válido
              </button>
              <button
                type="button"
                disabled={state.isClosed}
                onClick={() => simulateScenario('empty')}
                className="py-2 px-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-extrabold text-amber-800 transition-colors cursor-pointer"
              >
                ✕ Simular Vacío (0B)
              </button>
              <button
                type="button"
                disabled={state.isClosed}
                onClick={() => simulateScenario('nonconforming')}
                className="py-2 px-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg text-[10px] font-extrabold text-rose-800 transition-colors cursor-pointer"
              >
                ✕ Fuera Normativa
              </button>
            </div>
          </div>

          {/* Dynamic feedback messages */}
          {backendError && (
            <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl flex items-start gap-3 text-xs font-bold shadow-xs animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="uppercase text-[10px] tracking-widest text-rose-700 font-black">AUDITORÍA GUBERNAMENTAL RECHAZADA</p>
                <p className="mt-1 leading-relaxed">{backendError}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-3 text-xs font-bold shadow-xs animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre del Archivo de Evidencias</label>
              <input
                required
                disabled={state.isClosed}
                type="text"
                placeholder="Diagnostico_Territorial_Tarija_V4_SPIB.pdf"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-450 font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tamaño del Expediente (Kilobytes)</label>
                <input
                  required
                  disabled={state.isClosed}
                  type="number"
                  placeholder="2450"
                  value={fileSize}
                  onChange={(e) => setFileSize(parseInt(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Estructura SIPEB Cumplida</label>
                <select
                  disabled={state.isClosed}
                  value={normMatched ? 'si' : 'no'}
                  onChange={(e) => setNormMatched(e.target.value === 'si')}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 font-bold"
                >
                  <option value="si">Sí (Conforme Norma)</option>
                  <option value="no">No (Inconforme Norma)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || state.isClosed}
              className={`w-full py-3 px-4 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 shadow transition-all active:scale-98 cursor-pointer ${
                state.isClosed
                  ? 'bg-slate-150 border border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                  : isUploading
                  ? 'bg-slate-500 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Validando en Servidores del MPDyMA...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4.5 h-4.5" />
                  <span>Subir e Integrar Evidencia Territorial</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right validation status visualizer */}
        <section className="col-span-12 lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3 mb-4">
                Filtro de Integridad de Diagnóstico
              </h3>

              <div className="space-y-4">
                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    state.evidenceStatus === 'APPROVED' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-250'
                      : state.evidenceStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-600 border border-rose-250'
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    <ShieldCheck className="w-6 h-6 shrink-0" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-tight">Estado Oficial:</span>
                    <span className={`block text-xs font-black ${
                      state.evidenceStatus === 'APPROVED'
                        ? 'text-emerald-700'
                        : state.evidenceStatus === 'REJECTED'
                        ? 'text-rose-700 animate-pulse'
                        : 'text-slate-500'
                    }`}>
                      {state.evidenceStatus === 'APPROVED' 
                        ? 'CONFORME (APROBADO)' 
                        : state.evidenceStatus === 'REJECTED' 
                        ? 'RECHAZADO (SABOTAJE O VACÍO)' 
                        : 'PENDIENTE DE CARGA'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs font-medium text-slate-600">
                  <p className="flex justify-between">
                    <span>Expediente:</span>
                    <strong className="text-slate-800 break-all font-mono text-[10px]">{state.evidenceName || '--'}</strong>
                  </p>
                  <p className="flex justify-between border-t border-slate-50 pt-1.5">
                    <span>Asociación de Medidas:</span>
                    <strong className="text-slate-800">Obligatoria en Paso 7</strong>
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-tight">Verificación de Cifrado y Sabotaje UAT:</span>
                  
                  {state.evidenceName ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyIntegrity}
                          disabled={isVerifyingIntegrity || state.isClosed}
                          className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-750 font-sans rounded-lg text-[10px] font-semibold flex justify-center items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {isVerifyingIntegrity ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                          <span>Validar Hash SHA-256</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTamper}
                          disabled={isTampering || state.evidenceTampered || state.isClosed}
                          className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-semibold flex justify-center items-center gap-1.5 cursor-pointer transition-colors ${
                            state.evidenceTampered 
                              ? 'bg-rose-100/50 border border-rose-250 text-rose-700 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>{state.evidenceTampered ? 'Archivo Alterado' : 'Alterar Archivo'}</span>
                        </button>
                      </div>

                      {integrityMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg text-[10.5px] font-semibold leading-relaxed flex items-start gap-1.5 animate-fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{integrityMsg}</span>
                        </div>
                      )}

                      {integrityErr && (
                        <div className="p-3 bg-rose-50 border border-rose-250 text-rose-850 rounded-lg text-[10.5px] leading-relaxed flex flex-col gap-1 shadow-sm animate-shake">
                          <div className="flex items-start gap-1.5 font-semibold text-rose-700">
                            <FileWarning className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span className="uppercase text-[9px] tracking-wider font-extrabold">ALERTA: EVIDENCIA CORRUPTA</span>
                          </div>
                          <p className="font-semibold text-rose-950">{integrityErr}</p>
                          <div className="bg-rose-100/50 p-1.5 rounded text-[8.5px] font-mono text-rose-800 border border-rose-200 mt-1">
                            Calculated Hash Error: SHA256_MISMATCH // FILE_SYSTEM_MUTATION_SUSPECTED
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-[10px] text-slate-500 font-medium text-center">
                      Suba un archivo de evidencia territorial para activar el validador de integridad criptográfica SHA-256.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 select-none">
              <button
                type="button"
                onClick={onNext}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md active:scale-98"
              >
                <span>Siguiente Paso (Priorización)</span>
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
