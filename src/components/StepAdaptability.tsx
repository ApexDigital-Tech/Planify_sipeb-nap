import React, { useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Layers, 
  Activity, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  BookOpen,
  Loader2,
  Lock
} from 'lucide-react';
import { PlanState } from '../types';

interface StepAdaptabilityProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  onNext: () => void;
  correlationId: string;
}

type Dimension = 'Financiera' | 'Tecnica' | 'Normativa' | 'Gobernanza';

export default function StepAdaptability({ state, onStateUpdate, onNext, correlationId }: StepAdaptabilityProps) {
  const { scores, readinessPct, inertiaFlagActive } = state.adaptationCapacity;
  
  const [localScores, setLocalScores] = useState<{ [key in Dimension]: number }>({
    Financiera: scores.Financiera || 0,
    Tecnica: scores.Tecnica || 0,
    Normativa: scores.Normativa || 0,
    Gobernanza: scores.Gobernanza || 0
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const dimensionsList: { key: Dimension; title: string; desc: string; ref: string }[] = [
    { 
      key: 'Financiera', 
      title: 'Capacidad Financiera', 
      desc: 'Disponibilidad de fondos de contingencia, flexibilidad presupuestaria y alineación del POA municipal.',
      ref: 'REF-PDESA-2026-042'
    },
    { 
      key: 'Tecnica', 
      title: 'Capacidad Técnica estructural', 
      desc: 'Acceso a proyecciones científicas climáticas, personal de ingenierías capacitado y sensores territoriales.',
      ref: 'REF-PDESA-2026-088'
    },
    { 
      key: 'Normativa', 
      title: 'Agilidad Normativo-Legal', 
      desc: 'Existencia de leyes habilitantes de emergencia de desastres locales y agilidad en decretos autonomos.',
      ref: 'REF-PDESA-2026-115'
    },
    { 
      key: 'Gobernanza', 
      title: 'Gobernanza e Interinstitucionalidad', 
      desc: 'Claridad en jerarquías de decisión rápida y canales de comunicación abiertos con el COED/COEM.',
      ref: 'REF-PDESA-2026-140'
    }
  ];

  const handleScoreSelect = (dim: Dimension, score: number) => {
    if (state.isClosed) return;
    setLocalScores(prev => ({
      ...prev,
      [dim]: score
    }));
  };

  const getDimensionLabel = (score: number) => {
    switch (score) {
      case 1: return 'Crítico';
      case 2: return 'Limitado';
      case 3: return 'Funcional';
      case 4: return 'Óptimo';
      case 5: return 'Líder';
      default: return '--';
    }
  };

  // Live Calculations
  const activeScores = Object.values(localScores) as number[];
  const totalCalibrated = activeScores.filter(s => s > 0).length;
  const sum = activeScores.reduce((a, b) => a + b, 0);
  const avg = totalCalibrated > 0 ? (sum / totalCalibrated) : 0;
  const estimatedReadinessPct = totalCalibrated === 4 ? Math.round((sum / 20) * 100) : 0;
  const hasInertiaCritical = activeScores.some(s => s === 1);

  const canSave = totalCalibrated === 4;

  const handleSaveAndSubmit = async () => {
    if (state.isClosed) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/step5/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({ scores: localScores })
      });
      const data = await response.json();
      if (data.success) {
        onStateUpdate(data.state);
        onNext(); // Advance to Paso 6
      } else {
        setErrorMessage(data.error || 'Error al guardar capacidad institucional.');
      }
    } catch (e: any) {
      setErrorMessage('Error al comunicar con el servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 select-none">
      {/* Header section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-blue-600">
          <Shield className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Capacidad de Adaptación</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paso 5: Calibración de Resiliencia y Capacidad</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Evalúe el músculo operativo e institucional para asimilar amenazas hidrológicas. Calificaciones críticas de nivel 1 disparan el bloqueo de inercia técnica.
        </p>
      </div>

      {state.isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-sm select-none">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <span>MODO LECTURA INMUTABLE: El presente expediente está cerrado. No se permite alterar las calificaciones de capacidad adaptativa autonómica.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Main Board Block */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Dimensions Matrix Box */}
        <section className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Matriz de Auditoría de Resiliencia</h3>
            <span className="text-[10px] bg-blue-100/70 text-blue-700 px-3 py-1 rounded-full font-bold uppercase border border-blue-200/50">
              Validación Automatizada Activa
            </span>
          </div>

          <div className="divide-y divide-slate-100 p-6 space-y-6">
            {dimensionsList.map((dim) => {
              const currentScore = localScores[dim.key];

              return (
                <div key={dim.key} className="pt-5 first:pt-0">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <span>{dim.title}</span>
                        <span className="text-[9px] font-mono font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {dim.ref}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xl">{dim.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold font-mono px-2 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md block uppercase">
                        Nivel: {getDimensionLabel(currentScore)}
                      </span>
                    </div>
                  </div>

                  {/* 1 to 5 selector row */}
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const isActive = currentScore === level;
                      
                      let colorClass = 'hover:bg-blue-50 hover:border-blue-300 text-slate-700 border-slate-200';
                      if (isActive) {
                        if (level === 1) {
                          colorClass = 'bg-rose-55 text-rose-850 hover:bg-rose-50 border-rose-500 text-rose-800 font-extrabold ring-1 ring-rose-500/20';
                        } else if (level === 5) {
                          colorClass = 'bg-emerald-55 text-emerald-850 hover:bg-emerald-50 border-emerald-500 text-emerald-800 font-extrabold ring-1 ring-emerald-500/20';
                        } else {
                          colorClass = 'bg-blue-55 text-blue-855 hover:bg-blue-50 border-blue-500 text-blue-800 font-extrabold ring-1 ring-blue-500/20';
                        }
                      }

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleScoreSelect(dim.key, level)}
                          disabled={state.isClosed}
                          className={`p-3 border rounded-lg text-center flex flex-col justify-center items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${colorClass}`}
                        >
                          <span className="text-sm font-black font-mono">{level}</span>
                          <span className="text-[9px] tracking-tight font-bold select-none uppercase">
                            {getDimensionLabel(level)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Indicators Column */}
        <section className="col-span-12 lg:col-span-4 space-y-6 flex flex-col justify-between">
          
          {/* Dashboard Summary widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <span>Resumen de Capacidad</span>
            </h3>

            {/* Progress Circular representation or bar */}
            <div>
              <div className="flex justify-between items-baseline mb-1 text-xs">
                <span className="font-bold text-slate-600">Índice Adaptativo Estocástico</span>
                <span className="font-black text-blue-600 font-mono text-sm">{estimatedReadinessPct}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-700" 
                  style={{ width: `${estimatedReadinessPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Promedio</p>
                <p className="text-2xl font-extrabold text-slate-800 font-mono mt-1">
                  {avg > 0 ? avg.toFixed(1) : '--'}
                </p>
              </div>

              <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-center items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Rango Estatal</p>
                <p className={`text-base font-black uppercase mt-1 ${
                  estimatedReadinessPct === 0 ? 'text-slate-400' :
                  estimatedReadinessPct < 40 ? 'text-rose-600' :
                  estimatedReadinessPct < 75 ? 'text-blue-600' : 'text-emerald-600'
                }`}>
                  {estimatedReadinessPct === 0 ? 'Vacío' :
                   estimatedReadinessPct < 40 ? 'Vulnerable' :
                   estimatedReadinessPct < 75 ? 'Estable' : 'Firme / Líder'}
                </p>
              </div>
            </div>
          </div>

          {/* Business rule: Flag de Inercia alert */}
          <div className={`border p-5 rounded-xl transition-all duration-500 flex flex-col justify-between gap-4 ${
            hasInertiaCritical
              ? 'bg-rose-50/70 border-rose-300 text-rose-900 shadow-md ring-1 ring-rose-300/30'
              : 'bg-slate-50/40 border-slate-200 text-slate-400 opacity-40'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-10 h-10 shrink-0 ${hasInertiaCritical ? 'text-rose-600 animate-pulse' : 'text-slate-300'}`} />
              <div>
                <h4 className={`text-xs uppercase font-extrabold tracking-widest ${hasInertiaCritical ? 'text-rose-700' : 'text-slate-500'}`}>
                  Disparador: Inercia Institucional
                </h4>
                <p className="text-[10px] uppercase font-bold mt-0.5">
                  Establecido por: Gabinete MPDyMA / Rule A-5
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-white/70 border border-slate-200/50 rounded-lg text-[11px] leading-relaxed">
              {hasInertiaCritical ? (
                <span className="font-semibold text-rose-950">
                  ⚠️ CRÍTICO: Se ha activado la inercia del sistema. El Paso 8 (Firma Digital) quedará estructuralmente BLOQUEADO hasta que el Banco de Medidas en el Paso 7 incorpore una acción con la categoría "Fortalecimiento Técnico" financiada.
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  Atención: Calificar alguna dimensión con Nivel 1 (Crítico) dispara un bloqueo en el expediente que requiere una medida obligatoria posterior en el Paso 7.
                </span>
              )}
            </div>

            {hasInertiaCritical && (
              <span className="text-[9px] bg-rose-200 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full font-mono text-center font-extrabold select-none">
                ESTADO DE EXPEDIENTE: BLOQUEO TEMPORAL ACTIVO
              </span>
            )}
          </div>

          {/* Dossier Document widget */}
          <div className="bg-[#131b2e] text-white p-5 rounded-xl relative overflow-hidden group border border-white/5 shadow-md">
            <div className="relative z-10 space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#2170e4]">Dossier Técnico Regional</h3>
              <p className="text-[11px] text-white/75 leading-relaxed">
                Revise los parámetros históricos de la cuenca hídrica de Bolivia para la justificación del Plan Estratégico Multianual.
              </p>
              <button 
                type="button"
                className="text-[10px] text-white font-extrabold hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-all duration-300 bg-white/10 px-3 py-1.5 rounded-md cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Consultar Histórico 2021-2025</span>
              </button>
            </div>
            
            <Layers className="w-24 h-24 text-white/5 absolute -right-4 -bottom-4 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 pointer-events-none" />
          </div>

          {/* Dynamic validation action */}
          <div className="pt-2 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={handleSaveAndSubmit}
              disabled={!canSave || isSaving || state.isClosed}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold font-sans tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
                canSave && !isSaving && !state.isClosed
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-98'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
              }`}
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Validar Matriz y Continuar</span>
            </button>
          </div>

        </section>

      </div>
    </div>
  );
}
