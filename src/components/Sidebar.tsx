import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  CircleDot, 
  RefreshCw, 
  FileText, 
  AlertTriangle, 
  FileCheck, 
  Stethoscope, 
  Building, 
  LayoutDashboard,
  Activity
} from 'lucide-react';
import { PlanState } from '../types';

interface SidebarProps {
  state: PlanState;
  onSelectStep: (step: number) => void;
  activeStep: number;
  onStateUpdate: (updatedState: PlanState) => void;
  currentUser?: any;
}

export default function Sidebar({ state, onSelectStep, activeStep, onStateUpdate, currentUser }: SidebarProps) {
  const [isChanging, setIsChanging] = useState(false);
  const steps = [
    { num: 1, label: 'Marco Normativo' },
    { num: 2, label: 'Diagnóstico Territorial' },
    { num: 3, label: 'Priorización de Problemas' },
    { num: 4, label: 'Análisis de Vulnerabilidad' },
    { num: 5, label: 'Capacidad de Adaptación' },
    { num: 6, label: 'Semaforización del Riesgo' },
    { num: 7, label: 'Presupuesto Plurianual' },
    { num: 8, label: 'Firma e Institucionalidad' }
  ];

  const handleStepClick = (num: number) => {
    // RULE 1a: No step can be accessed unless the previous one has its green checkmark of validation
    const isUnlocked = num === 1 || state.stepsCompleted[num - 1];
    
    // RULE 1c: "Inercia Institucional" blocks access to the final consolidation phase (Step 8)
    const isBlockedByInertia = num === 8 && state.adaptationCapacity.inertiaFlagActive;
    
    if (isUnlocked && !isBlockedByInertia) {
      onSelectStep(num);
    }
  };

  const handleToggleScenario = async (type: 'PES' | 'PAD') => {
    if (state.isClosed || isChanging) return;
    setIsChanging(true);
    try {
      const response = await fetch('/api/plan/set-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await response.json();
      if (data.success) {
        onStateUpdate(data.state);
        onSelectStep(4); // Move directly to Step 4 so user is on active analysis pane!
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-white flex flex-col z-50 text-slate-800 border-r border-slate-200 shadow-sm select-none">
      {/* Brand Header */}
      <div className="p-6 flex flex-col gap-2 border-b border-slate-200 justify-center">
        <div className="flex items-center gap-3">
          <img 
            alt="Escudo de Bolivia" 
            className="w-10 h-10 object-contain grayscale opacity-90 contrast-125" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuArSqk7o1tETsvCj8b4FnlnIiFiubPjOOLefm2f6sQY6eEcAeG9P1FG94Jv3kzLdZN3jmplG9vqNcxuE80wh40vyk5LgPvGugUzBaOZsaN6oHC7veiVrmoK9FunK0zu0SI9_F_tBPbTZrf5lNS9F307kjNOc98Huzucj434txuBwn_Q4cDRWDs1izSK9cMoqEkHsQANEmibV3VgnJZcOFd7DBr0Q5gb-kWhbmJeg3SSYxEzZkTb8VYf1tZSnO36A1R3YycCqt1KkIA"
          />
          <div>
            <h1 className="text-base font-black text-blue-900 tracking-tight leading-tight">SIPEB <span className="text-blue-500 font-bold">2026-2030</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">Planificación ACC-RRD</p>
          </div>
        </div>
        
        {/* Scenario Toggle Component */}
        <div className="mt-3 bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1">
          <button
            onClick={() => handleToggleScenario('PES')}
            disabled={state.isClosed || isChanging}
            className={`flex-1 py-1 px-2 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              state.planType === 'PES'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            } disabled:opacity-50`}
          >
            <Stethoscope className="w-3 h-3 shrink-0" />
            <span>Caso A (PES)</span>
          </button>
          <button
            onClick={() => handleToggleScenario('PAD')}
            disabled={state.isClosed || isChanging}
            className={`flex-1 py-1 px-2 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              state.planType === 'PAD'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            } disabled:opacity-50`}
          >
            <Building className="w-3 h-3 shrink-0" />
            <span>Caso B (PAD)</span>
          </button>
        </div>
        {state.isClosed && (
          <span className="text-[9px] text-center text-amber-600 font-bold bg-amber-50 rounded p-1 border border-amber-200/50 mt-1 uppercase tracking-wider">
            ⚠️ EXPEDIENTE CERRADO
          </span>
        )}
      </div>

      {/* Stepper Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        
        {/* Dynamic GovTech Dashboard entry */}
        <button
          onClick={() => onSelectStep(0)}
          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all relative group text-xs mb-2 ${
            activeStep === 0
              ? 'bg-blue-600 border-l-4 border-blue-900 text-white font-extrabold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer font-medium'
          }`}
        >
          <LayoutDashboard className={`w-4.5 h-4.5 ${activeStep === 0 ? 'text-white' : 'text-[#0058be]'}`} />
          <div className="flex-1 min-w-0 pr-1">
            <p className={`truncate ${activeStep === 0 ? 'text-white font-bold' : 'text-slate-700'}`}>
              Inicio / Dashboard
            </p>
          </div>
        </button>

        {currentUser?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => onSelectStep(9)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all relative group text-xs mb-2 border border-blue-100 ${
              activeStep === 9
                ? 'bg-[#002f6c] border-l-4 border-blue-400 text-white font-extrabold shadow-xs'
                : 'bg-blue-50/50 text-blue-800 hover:bg-blue-50 cursor-pointer font-semibold'
            }`}
          >
            <ShieldCheck className={`w-4.5 h-4.5 group-hover:scale-110 transition-transform ${activeStep === 9 ? 'text-blue-300 animate-pulse' : 'text-blue-750'}`} />
            <div className="flex-1 min-w-0 pr-1">
              <p className={`truncate ${activeStep === 9 ? 'text-white font-bold' : 'text-blue-900'}`}>
                Gestor de Usuarios
              </p>
            </div>
          </button>
        )}

        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 py-2 select-none border-t border-slate-100 pt-2 flex items-center gap-1">
          <Activity className="w-3 h-3 text-slate-450 text-slate-400" />
          <span>FASES DEL EXPEDIENTE</span>
        </div>
        {steps.map((st) => {
          const isCompleted = state.stepsCompleted[st.num];
          const isActive = activeStep === st.num;
          
          // RULE 1a & 1c: Block step if previous is incomplete, or if step is 8 and inertia is unresolved
          const isLocked = (st.num > 1 && !state.stepsCompleted[st.num - 1]) ||
                           (st.num === 8 && state.adaptationCapacity.inertiaFlagActive);

          // Special style overrides based on inertia blocker in Paso 5
          const isPaso5 = st.num === 5;
          const isPaso8 = st.num === 8;
          const hasInertiaFlag = state.adaptationCapacity.inertiaFlagActive;

          return (
            <button
              key={st.num}
              onClick={() => handleStepClick(st.num)}
              disabled={isLocked && !isCompleted}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all relative group text-xs ${
                isActive
                  ? 'bg-blue-50 border-l-4 border-blue-600 text-blue-700 font-bold shadow-xs'
                  : isLocked
                  ? 'opacity-40 cursor-not-allowed hover:bg-transparent text-slate-400'
                  : 'text-slate-600 hover:bg-slate-55 hover:text-slate-900 hover:bg-slate-50 cursor-pointer font-medium'
              }`}
            >
              <div className="shrink-0">
                {isCompleted ? (
                   <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 fill-emerald-500/5" />
                ) : isPaso8 && hasInertiaFlag ? (
                   <AlertTriangle className="w-4.5 h-4.5 text-orange-500 animate-bounce" />
                ) : isLocked ? (
                   <Lock className="w-4 h-4 text-slate-300" />
                ) : isActive ? (
                   <CircleDot className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                ) : (
                   <div className="w-4.5 h-4.5 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-500 bg-white">
                     {st.num}
                   </div>
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p className={`truncate ${isActive ? 'text-blue-900 font-bold' : 'text-slate-700 group-hover:text-slate-900'}`}>
                  {st.label}
                </p>
                {isPaso5 && hasInertiaFlag && (
                  <span className="text-[9px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-mono block w-max mt-1 animate-pulse border border-orange-200 font-bold">
                    Alerta de Inercia
                  </span>
                )}
                {isPaso8 && state.isSubmitted && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono block w-max mt-1 border border-emerald-250 font-bold">
                    CONSOLIDADO
                  </span>
                )}
              </div>

              {/* Status indicators */}
              {!isLocked && !isCompleted && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Version Details with SHA-256 validation */}
      <div className="p-4 bg-slate-100 mt-auto border-t border-slate-200">
        <div className="flex items-center justify-between text-[10px] mb-1.5 font-sans select-none">
          <span className="text-slate-400 uppercase font-black">AUDITORÍA ACTIVA</span>
          <span className="text-emerald-600 font-bold font-mono">AUDIT_LOGS</span>
        </div>
        <div className="truncate font-mono text-[9px] text-slate-500 leading-tight">
          instrumento_auditoria_logs
        </div>
      </div>
    </aside>
  );
}
