import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  History, 
  Database, 
  Fingerprint, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { PlanState, AuditLog } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StepVulnerability from './components/StepVulnerability';
import StepAdaptability from './components/StepAdaptability';
import StepClimateRisk from './components/StepClimateRisk';
import StepBudget from './components/StepBudget';
import StepConsolidation from './components/StepConsolidation';
import PlanningAssistant from './components/PlanningAssistant';
import StepEvidence from './components/StepEvidence';
import TransactionalActions from './components/TransactionalActions';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import UserManagement from './components/UserManagement';

export default function App() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isLogsOpen, setIsLogsOpen] = useState(true);

  // Query: check current user session
  const { data: currentUser, isLoading: sessionLoading } = useQuery({
    queryKey: ['authSession'],
    queryFn: async () => {
      const res = await fetch('/api/auth/current');
      const data = await res.json();
      return data.success && data.user ? data.user : null;
    }
  });

  // Query: plan state and audit logs
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['planState'],
    queryFn: async () => {
      const res = await fetch('/api/plan');
      const data = await res.json();
      return data;
    },
    enabled: !!currentUser
  });

  const state = planData?.state || null;
  const logs = planData?.logs || [];
  const correlationId = planData?.correlationId || '';
  const userRole = planData?.userRole || (currentUser?.role || 'Guest');
  const authLoading = sessionLoading || (!!currentUser && planLoading);

  const handleStateUpdate = (updated: PlanState) => {
    queryClient.setQueryData(['planState'], (old: any) => {
      if (!old) return old;
      return { ...old, state: updated };
    });
    queryClient.invalidateQueries({ queryKey: ['planState'] });
  };

  const refreshState = () => {
    queryClient.invalidateQueries({ queryKey: ['planState'] });
    queryClient.invalidateQueries({ queryKey: ['authSession'] });
  };

  useEffect(() => {
    if (state && activeStep === 8 && state.adaptationCapacity.inertiaFlagActive) {
      setActiveStep(7); // Prevent unauthorized backdoor navigation
    }
  }, [activeStep, state?.adaptationCapacity?.inertiaFlagActive]);

  const handleLoginSuccess = (user: any) => {
    queryClient.setQueryData(['authSession'], user);
    queryClient.invalidateQueries({ queryKey: ['authSession'] });
    queryClient.invalidateQueries({ queryKey: ['planState'] });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.setQueryData(['authSession'], null);
      queryClient.invalidateQueries({ queryKey: ['authSession'] });
      queryClient.invalidateQueries({ queryKey: ['planState'] });
      setActiveStep(0);
    } catch (e) {
      console.error("Error logging out:", e);
    }
  };

  const handleResetSimulation = async () => {
    try {
      const res = await fetch('/api/plan/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        handleStateUpdate(data.state);
        setActiveStep(4);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (authLoading || (currentUser && !state)) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#2170e4]">Sincronizando con SIPEB Back-end</h2>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">Estableciendo canal seguro con servidores del Ministerio de Planificación...</p>
      </div>
    );
  }

  // Render Login page if no authenticated user session
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      
      {/* Sidebar Stepper */}
      <Sidebar 
        state={state} 
        onSelectStep={(step) => setActiveStep(step)} 
        activeStep={activeStep} 
        onStateUpdate={handleStateUpdate}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <div className="flex-1 ml-[280px] min-h-screen flex flex-col pb-64 relative">
        
        {/* Professional Header */}
        <Header 
          correlationId={correlationId} 
          isSigned={state.isSigned} 
          onReset={handleResetSimulation} 
          userRole={userRole}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Content Body Pane (Offset by header height) */}
        <main className="px-10 py-8 mt-16 max-w-6xl w-full mx-auto flex-1">
          
          {/* Dashboard (Step 0) render, pre-completed steps 1 and 3, and interactive Step 2 */}
          {activeStep === 0 ? (
            <Dashboard 
              state={state}
              correlationId={correlationId}
              onEnterExpediente={(step) => setActiveStep(step)}
              onSetScenario={async (type) => {
                try {
                  const response = await fetch('/api/plan/set-scenario', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type })
                  });
                  const data = await response.json();
                  if (data.success) {
                    handleStateUpdate(data.state);
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              userRole={userRole}
            />
          ) : activeStep === 2 ? (
            <StepEvidence 
              state={state} 
              onStateUpdate={handleStateUpdate} 
              onNext={() => setActiveStep(3)} 
              correlationId={correlationId}
            />
          ) : (activeStep < 4 && activeStep > 0) ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-4 max-w-2xl mx-auto text-center select-none animate-fade-in mt-12">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto fill-emerald-500/10" />
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Paso {activeStep} Completado & Validado</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">SISTEMA INTEGRADO DE PLANIFICACIÓN ESTATAL</p>
              </div>
              
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-left text-xs leading-relaxed max-w-md mx-auto space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-[#0058be]" />
                  <span>Detalle de Validación Previa:</span>
                </p>
                {activeStep === 1 && (
                  <p className="text-slate-600 font-medium">El marco normativo nacional cumple con la Ley N° 777 (Sistema de Planificación Integral del Estado - SPIE) y convenios internacionales. Expediente aprobado sin disconformidades.</p>
                )}
                {activeStep === 2 && (
                  <p className="text-slate-600 font-medium">Diagnóstico de capacidades territoriales e hidrografía nacional indexado por planificaciones locales autonómicas el 12/01/2026. Hash certificado.</p>
                )}
                {activeStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-slate-600 font-medium">Buzón de problemas históricos territoriales priorizado y jerarquizado. Cuenca del Río Pilcomayo señalada como punto crítico de mitigación fluvial prioritaria.</p>
                    
                    <div className="mt-4 border-t border-slate-200 pt-4 text-left">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                        <span>Ajustar Nivel de Amenaza Climática (Paso 3):</span>
                        <span className="text-blue-600 font-black font-mono bg-blue-50 px-1.5 rounded">{state.threatLevel || 4} / 5</span>
                      </label>
                      <input
                        type="type"
                        style={{ display: 'none' }}
                        readOnly
                      />
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={state.threatLevel || 4}
                        onChange={async (e) => {
                          const val = parseInt(e.target.value);
                          try {
                            const res = await fetch('/api/step3/update-threat', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ threatLevel: val })
                            });
                            const data = await res.json();
                            if (data.success) {
                              handleStateUpdate(data.state);
                            }
                          } catch (err) {
                            console.error("Error setting threat Level:", err);
                          }
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0058be] mt-1"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                        <span>1: Mínimo</span>
                        <span>3: Moderado</span>
                        <span>5: Crítico (Río Pilcomayo)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        💡 El nivel de amenaza establecido aquí viaja al back-end e **influye en tiempo real sobre la semaforización espacial del Paso 6 (Riesgo Multidimensional)** conforme con las vinculaciones georreferenciadas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-5 py-2.5 bg-[#0058be] hover:bg-[#002f82] text-white text-xs font-bold rounded-lg cursor-pointer shadow transition-all duration-300"
                >
                  Regresar al Análisis de Vulnerabilidad (Paso 4)
                </button>
              </div>
            </div>
          ) : (
            /* Active interactive steps */
            <div className="pb-16">
              {activeStep === 4 && (
                <StepVulnerability 
                  state={state} 
                  onStateUpdate={handleStateUpdate} 
                  onNext={() => setActiveStep(5)} 
                  correlationId={correlationId}
                />
              )}
              {activeStep === 5 && (
                <StepAdaptability 
                  state={state} 
                  onStateUpdate={handleStateUpdate} 
                  onNext={() => setActiveStep(6)} 
                  correlationId={correlationId}
                />
              )}
              {activeStep === 6 && (
                <StepClimateRisk 
                  state={state} 
                  onStateUpdate={handleStateUpdate} 
                  onNext={() => setActiveStep(7)} 
                />
              )}
              {activeStep === 7 && (
                <StepBudget 
                  state={state} 
                  onStateUpdate={handleStateUpdate} 
                  onNext={() => setActiveStep(8)} 
                  correlationId={correlationId}
                />
              )}
              {activeStep === 8 && (
                <StepConsolidation 
                  state={state} 
                  onStateUpdate={handleStateUpdate} 
                  correlationId={correlationId}
                  userRole={userRole}
                />
              )}
              {activeStep === 9 && (
                <UserManagement />
              )}
            </div>
          )}

        </main>

        {/* Live Business Audit Log Monitor (auditoria_negocio) panel docked at bottom */}
        <section className={`fixed bottom-0 right-0 w-[calc(100%-280px)] bg-slate-950 text-white border-t border-slate-800 transition-all z-35 select-none ${
          isLogsOpen ? 'h-52' : 'h-10'
        }`}>
          <div 
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            className="px-6 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-850 select-none"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#2170e4]" />
              <span className="text-[10px] tracking-wider uppercase font-black">
                Bitácora de Auditoría en Tiempo Real (<code className="font-mono text-emerald-400">instrumento_auditoria_logs</code>)
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
              <span>Registros Guardados: {logs.length}</span>
              <button className="text-xs font-bold font-sans text-blue-400 hover:underline">
                {isLogsOpen ? 'Colapsar Monitor' : 'Expandir Monitor'}
              </button>
            </div>
          </div>

          {isLogsOpen && (
            <div className="p-4 h-[168px] overflow-y-auto space-y-2 font-mono text-[10px]">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const isRollback = log.action === 'TRANSACTIONAL_ROLLBACK';
                  const isCrossover = log.action === 'EXECUTE_GEOGRAPHICAL_CROSSOVER';
                  const isSign = log.action === 'SIGN_DIGITAL_AGETIC';

                  return (
                    <div 
                      key={log.id} 
                      className={`p-2.5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors ${
                        isRollback 
                          ? 'bg-rose-950/45 border-rose-500/30 text-rose-350' 
                          : isCrossover
                          ? 'bg-blue-950/30 border-blue-500/25 text-blue-300'
                          : isSign
                          ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-300'
                          : 'bg-white/5 border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded font-bold">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        
                        <span className={`px-2 py-0.5 border rounded text-[9px] font-black ${
                          isRollback 
                            ? 'bg-rose-500/20 border-rose-320 text-rose-400 animate-pulse' 
                            : 'bg-white/10 border-white/10 text-slate-400'
                        }`}>
                          {log.action}
                        </span>

                        <span className="text-slate-400 uppercase">
                          User: <strong className="text-slate-150 font-bold">{log.user_id}</strong>
                        </span>

                        <span className="text-slate-400">
                          Corr ID: <strong className="font-bold font-mono text-[#2170e4] bg-blue-950/20 px-1 rounded border border-blue-500/10">{log.correlation_id}</strong>
                        </span>
                      </div>

                      <div className="text-[9.5px] italic text-slate-300 max-w-sm xl:max-w-md truncate" title={log.valores_modificados}>
                        {isRollback 
                          ? '❗ Se disparó un ROLLBACK atómico en base de datos. Se revirtieron todos los cambios.' 
                          : `Modificados: ${log.valores_modificados}`}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-600 font-bold">
                  Sin transacciones auditadas todavía en la sesión actual.
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Persistent planning assistant drawer chatbot */}
      <PlanningAssistant state={state} correlationId={correlationId} />

      {/* Persistent menu and transactional quick actions bar block */}
      <TransactionalActions 
        state={state} 
        onStateUpdate={handleStateUpdate} 
        correlationId={correlationId} 
      />

    </div>
  );
}

