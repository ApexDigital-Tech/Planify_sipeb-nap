import React, { useState, useEffect } from 'react';
import { 
  FolderLock, 
  UserCheck, 
  BellRing, 
  FileDown, 
  FlaskConical, 
  X, 
  ShieldAlert, 
  Database,
  CheckCircle2, 
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  ShieldCheck,
  Building,
  Stethoscope,
  Info
} from 'lucide-react';
import { PlanState } from '../types';

interface TransactionalActionsProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  correlationId: string;
}

interface Instrument {
  id: string;
  user_id: string;
  name: string;
  status: 'EN_PROCESO' | 'VALIDADO' | 'CONSOLIDADO';
  type: 'PES' | 'PAD';
  last_modified: string;
  department: string;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  rolesAvailable: string[];
}

export default function TransactionalActions({ state, onStateUpdate, correlationId }: TransactionalActionsProps) {
  // Navigation tabs / Modals active
  const [activeTab, setActiveTab] = useState<'inbox' | 'profile' | 'alerts' | 'sandbox' | null>(null);
  
  // Dynamic datasets from back-end
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Instruments list (Mis Instrumentos)
  const fetchInstruments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/instruments');
      const data = await res.json();
      if (data.success) {
        setInstruments(data.instruments);
      }
    } catch (err) {
      console.error("Error cargando bandeja de instrumentos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch User Profile Active Role
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error al cargar perfil de usuario:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [state.planType, state.isClosed]);

  // Open & trigger specific modals
  const handleOpenTab = (tab: 'inbox' | 'profile' | 'alerts' | 'sandbox') => {
    setFeedbackMsg(null);
    setActiveTab(tab);
    if (tab === 'inbox') {
      fetchInstruments();
    }
    if (tab === 'profile') {
      fetchProfile();
    }
  };

  // Execute Role Switch and Update Server state
  const handleRoleSwitch = async (newRole: string) => {
    setFeedbackMsg(null);
    try {
      const response = await fetch('/api/profile/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await response.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, role: newRole } : null);
        setFeedbackMsg({
          type: 'success',
          text: `✓ ROL ACTUALIZADO: Ha cambiado al rol de '${newRole}'. Los permisos y flujos de firmas en el Paso 8 han sido recalculados dinámicamente.`
        });
        // Force refresh parent State to apply live permission blocks
        onStateUpdate(data.state);
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Error al cambiar rol en el servidor.' });
    }
  };

  // Sandbox: Trigger the Rollback / Rule Failure simulation
  const handleSimulateRuleFailure = async () => {
    setFeedbackMsg(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/plan/simulate-error', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedbackMsg({
          type: 'error',
          text: data.error || 'Fallo transaccional detectado.'
        });
        // Log transaction error internally
        onStateUpdate(data.state || state);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: 'Falla crítica de red al interactuar con el validador transaccional del MPDyMA.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate dynamic contextual warnings / alerts for the Notification Center
  const generateAlerts = () => {
    const alertsList = [];
    
    // Alert 1: Unresolved Institutional Inertia block
    if (state.adaptationCapacity.inertiaFlagActive) {
      alertsList.push({
        id: 'cap-inertia',
        severity: 'CRITICAL',
        title: "Bloqueo por Inercia Institucional Activa",
        desc: "El Paso 5 detectó insuficiente capacidad de adaptación reglamentaria. Se bloqueó la consolidación final hasta inyectar medidas de Fortalecimiento Técnico."
      });
    }

    // Alert 2: Budget consistency checks
    const totalMeasuresBudget = state.measures.reduce((acc, m) => acc + m.budget, 0);
    if (!state.measures || state.measures.length === 0) {
      alertsList.push({
        id: 'no-measures',
        severity: 'WARNING',
        title: "Falta de Medidas de Mitigación",
        desc: "El expediente del instrumento actual todavía no dispone de medidas de mitigación o adaptación indexadas en el Paso 7."
      });
    } else {
      // Check measure with empty or 0 budget (if possible)
      const hasZeroBudget = state.measures.some(m => m.budget <= 0);
      if (hasZeroBudget) {
        alertsList.push({
          id: 'zero-budget',
          severity: 'CRITICAL',
          title: "Inconsistencia Presupuestaria Mayor a Cero",
          desc: "Toda medida del SIPEB requiere financiamiento plurianual mayor a cero para pasar filtros de Contraloría."
        });
      }
    }

    // Alert 3: Lack of Evidence Status
    if (state.evidenceStatus === 'PENDING') {
      alertsList.push({
        id: 'evidence-pending',
        severity: 'WARNING',
        title: "Diagnóstico Territorial sin Evidencia Certificada",
        desc: "La evidencia del Paso 2 aún no se ha cargado. Vincular un diagnóstico legalizado es obligatorio para auditar la inversión."
      });
    } else if (state.evidenceStatus === 'REJECTED') {
      alertsList.push({
        id: 'evidence-rejected',
        severity: 'CRITICAL',
        title: "Evidencia Territorial Rechazada por Auditoría",
        desc: `La evidencia física "${state.evidenceName || 'Archivo'}" fue marcada como INVÁLIDA de acuerdo al MPDyMA.`
      });
    }

    // Default general messages if clean
    if (alertsList.length === 0) {
      alertsList.push({
        id: 'all-clean',
        severity: 'INFO',
        title: "Normatividad e Integridad Conforme (100%)",
        desc: "El expediente no reporta alertas técnicas pendientes de resolución. Los semáforos se encuentran en verde."
      });
    }

    return alertsList;
  };

  const activeAlerts = generateAlerts();
  const alertCount = activeAlerts.filter(a => a.severity !== 'INFO').length;

  return (
    <>
      {/* FLOATING ACTION BAR */}
      <div id="transactional-dock" className="fixed bottom-12 right-10 z-45 flex items-center gap-3 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200/80 animate-fade-in select-none">
        
        {/* Inbox trigger */}
        <button
          onClick={() => handleOpenTab('inbox')}
          title="Mis Instrumentos (Bandeja de Entrada)"
          className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-700 rounded-xl transition-all cursor-pointer relative group flex items-center justify-center border border-slate-250/20 active:scale-95"
        >
          <FolderLock className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white font-mono font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow">4</span>
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-all duration-300">Mis Instrumentos</span>
        </button>

        {/* User profile role settings */}
        <button
          onClick={() => handleOpenTab('profile')}
          title="Configuración de Perfil y Rol"
          className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-700 rounded-xl transition-all cursor-pointer relative group flex items-center justify-center border border-slate-250/20 active:scale-95"
        >
          <UserCheck className="w-5 h-5" />
          {profile?.role && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white font-mono text-[7px] px-1 py-0.5 rounded font-extrabold uppercase leading-none truncate max-w-[48px]">{profile.role.split('/')[0]}</span>
          )}
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-all duration-300">Configuración Perfil</span>
        </button>

        {/* Alert Notifications Center */}
        <button
          onClick={() => handleOpenTab('alerts')}
          title="Centro de Alertas y Notificaciones"
          className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-700 rounded-xl transition-all cursor-pointer relative group flex items-center justify-center border border-slate-250/20 active:scale-95"
        >
          <BellRing className="w-5 h-5" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow animate-pulse">{alertCount}</span>
          )}
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-all duration-300">Alertas de Auditoría</span>
        </button>

        {/* PDF Export Shortcut */}
        <div className="relative group">
          {state.isClosed ? (
            <a
              href="/api/export/word"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-95"
              title="Descargar Expediente Consolidado Oficial"
            >
              <FileDown className="w-5 h-5" />
            </a>
          ) : (
            <button
              onClick={() => alert("Solo expedientes consolidados y validados por el MPDyMA pueden ser exportados de forma oficial conforme a las reglas del SPIE boliviano. Por favor proceda a firmar digitalmente y finalizar en el Paso 8.")}
              className="p-3 bg-slate-100 text-slate-400 border border-slate-200/55 rounded-xl cursor-not-allowed flex items-center justify-center transition-all duration-200"
              title="Solo expedientes validados pueden ser exportados de manera reglamentaria."
            >
              <FileDown className="w-5 h-5" />
            </button>
          )}
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded font-bold whitespace-wrap max-w-[150px] leading-relaxed text-center transition-all duration-300">
            {state.isClosed ? "Descargar de Servidores" : "Exportar (Deshabilitado: Requiere Consolidación)"}
          </span>
        </div>

        {/* UAT Sandboxing Fallo de Regla button */}
        <button
          onClick={() => handleOpenTab('sandbox')}
          title="Sandbox de Pruebas UAT (Simulador Fallo de Regla)"
          className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl transition-all cursor-pointer relative group flex items-center justify-center active:scale-95"
        >
          <FlaskConical className="w-5 h-5 animate-pulse" />
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-all duration-300">UAT: Simular Fallo</span>
        </button>

      </div>

      {/* MODALS RENDER OVERLAYS */}
      {activeTab !== null && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[85vh] animate-scale-up text-slate-800">
            
            {/* Modal Header */}
            <header className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50 select-none">
              <div className="flex items-center gap-2.5">
                {activeTab === 'inbox' && (
                  <>
                    <FolderLock className="w-5 h-5 text-blue-700" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Mis Instrumentos y Expedientes Activos</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Bandeja de Entrada del Planificador Regional</p>
                    </div>
                  </>
                )}
                {activeTab === 'profile' && (
                  <>
                    <UserCheck className="w-5 h-5 text-blue-700" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Configuración de Perfil y Auditoría de Atribuciones</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Reglamento del control de firmas SIPEB</p>
                    </div>
                  </>
                )}
                {activeTab === 'alerts' && (
                  <>
                    <BellRing className="w-5 h-5 text-red-600 animate-pulse" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Centro de Alertas de Auditoría Territorial</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Notificaciones de inconsistencia metodológica y financiera</p>
                    </div>
                  </>
                )}
                {activeTab === 'sandbox' && (
                  <>
                    <FlaskConical className="w-5 h-5 text-blue-700 animate-bounce" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Caja de Herramientas de Pruebas UAT (Sandbox)</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Prueba de resiliencia de transacciones relacionales</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => { setActiveTab(null); setFeedbackMsg(null); }}
                className="p-1 px-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Modal Body Scroll Container */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* TAB 1: MIS INSTRUMENTOS (INBOX) */}
              {activeTab === 'inbox' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-xl text-xs text-blue-900 flex gap-2.5 leading-relaxed">
                    <Info className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                    <div>
                      El sistema SIPEB conecta directamente con las bases georreferenciadas. Aquí se listan todos los instrumentos regionales sincronizados con su cuenta oficial. El estado de consolidación se actualiza en tiempo real de acuerdo a sus firmas digitales.
                    </div>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                          <th className="p-3 pl-4">Código / ID</th>
                          <th className="p-3">Instrumento Planificado</th>
                          <th className="p-3">Departamento</th>
                          <th className="p-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {instruments.map((inst) => {
                          const isCurrent = inst.type === state.planType;
                          return (
                            <tr 
                              key={inst.id} 
                              className={`transition-all ${
                                isCurrent 
                                  ? 'bg-blue-50/40 hover:bg-blue-50 font-bold border-l-4 border-blue-600' 
                                  : 'hover:bg-slate-50/50 text-slate-500'
                              }`}
                            >
                              <td className="p-3 pl-4 font-mono font-black text-slate-700">{inst.id}</td>
                              <td className="p-3">
                                <p className="font-bold text-slate-950">{inst.name}</p>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  Última edición: {new Date(inst.last_modified).toLocaleString()}
                                </p>
                              </td>
                              <td className="p-3 font-semibold">{inst.department}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                  inst.status === 'CONSOLIDADO' 
                                    ? 'bg-emerald-100 border border-emerald-200 text-emerald-800'
                                    : inst.status === 'VALIDADO'
                                    ? 'bg-blue-100 border border-blue-200 text-blue-800'
                                    : 'bg-amber-100 border border-amber-200 text-amber-800'
                                }`}>
                                  {inst.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: CONFIGURACIÓN DE PERFIL */}
              {activeTab === 'profile' && profile && (
                <div className="space-y-5">
                  <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/50 flex flex-col sm:flex-row gap-5 items-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center font-black text-xl text-blue-700 shrink-0 shadow-inner select-none">
                      {profile.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-center sm:text-left space-y-1">
                      <h4 className="text-base font-black text-slate-900">{profile.name}</h4>
                      <p className="text-xs text-slate-500 font-semibold">{profile.email}</p>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-black uppercase mt-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Rol Actual: {profile.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                      Asignación de Roles de Firma Autorizada (IAM Matrix):
                    </span>
                    <p className="text-xs text-slate-500 leading-normal">
                      Seleccione su nivel de atribución técnica. Recuerde que el control presupuestario y de firmas restringe la consolidación final de manera exclusiva para perfiles autorizados de SUPER_ADMIN o REVISOR_SENIOR.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {profile.rolesAvailable.map((roleOpt) => {
                        const isSelected = profile.role === roleOpt;
                        return (
                          <button
                            key={roleOpt}
                            onClick={() => handleRoleSwitch(roleOpt)}
                            className={`p-3.5 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-24 relative select-none active:scale-98 ${
                              isSelected 
                                ? 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-600/10' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{roleOpt}</span>
                            <span className={`text-[9px] block leading-tight ${isSelected ? 'text-blue-100 font-semibold' : 'text-slate-400 font-medium'}`}>
                              {roleOpt === 'ESPECIALISTA_PAD' ? 'Especialista Territorial GIZ. Escritura limitada de instrumentos del tipo PAD.' :
                               roleOpt === 'ESPECIALISTA_PES' ? 'Especialista Sectorial GIZ. Escritura limitada de instrumentos del tipo PES.' :
                               roleOpt === 'REVISOR_SENIOR' ? 'Coordinador GIZ. Lectura global y aprobación oficial en Paso 4 y 8.' :
                               'Propietario / MPDyMA. Acceso global definitivo y control de auditorías.'}
                            </span>
                            {isSelected && (
                              <span className="absolute top-3.5 right-3.5 bg-white text-blue-600 border border-blue-600 rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold text-[9px]">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ALERTAS DE NOTIFICACIONES */}
              {activeTab === 'alerts' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>Estado Metodológico de Instrumento ACC-RRD</span>
                    <span className="font-mono bg-slate-100 border px-1.5 font-bold uppercase py-0.5 rounded text-[10px]">{state.planType}</span>
                  </div>

                  <div className="space-y-3">
                    {activeAlerts.map((alert) => {
                      const isCritical = alert.severity === 'CRITICAL';
                      const isWarning = alert.severity === 'WARNING';
                      return (
                        <div 
                          key={alert.id}
                          className={`p-4 border rounded-xl flex gap-3.5 items-start ${
                            isCritical 
                              ? 'bg-rose-50 border-rose-200 text-rose-950 shadow-xs'
                              : isWarning
                              ? 'bg-amber-50 border-amber-200 text-amber-950 shadow-xs'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isCritical
                              ? 'bg-rose-500 text-white'
                              : isWarning
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-500 text-white'
                          }`}>
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-black tracking-tight uppercase flex items-center gap-2">
                              {alert.title}
                              <span className={`text-[8px] font-mono px-1.5 rounded leading-normal border ${
                                isCritical 
                                  ? 'bg-rose-600 border-rose-300 text-white font-extrabold animate-pulse'
                                  : isWarning
                                  ? 'bg-amber-650 border-amber-300 text-white'
                                  : 'bg-emerald-600 border-emerald-300 text-white'
                              }`}>
                                {alert.severity}
                              </span>
                            </h4>
                            <p className="text-xs font-medium text-slate-600 leading-normal">{alert.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider select-none mt-4">
                    🔍 Sistema de Alertas Conectado a la Bitácora de Base de Datos
                  </div>
                </div>
              )}

              {/* TAB 4: ENTORNO SANDBOX DE PRUEBAS */}
              {activeTab === 'sandbox' && (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-3">
                    <h4 className="text-xs font-black text-orange-900 tracking-tight uppercase flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-orange-600 animate-bounce" />
                      <span>Área de Simulación de Reglas de Negocio en Tiempo Real</span>
                    </h4>
                    <p className="text-xs text-orange-850 leading-relaxed">
                      Esta herramienta permite verificar que las transacciones y validaciones del SIPEB protegen el sistema contra fallos de consistencia presupuestaria en tiempo real. 
                      Al hacer clic abajo, se inyectará una <strong>falsa medida de presupuesto BOB 0.00</strong>. El backend simulará un rechazo atómico de datos, retornando un error HTTP y registrando un evento de rollback: <code className="bg-orange-100 px-1 rounded font-mono text-[10.5px]">TRANSACTIONAL_ROLLBACK</code> en la base de datos de auditoría.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleSimulateRuleFailure}
                      disabled={isLoading}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex justify-center items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer disabled:opacity-50"
                    >
                      <FlaskConical className="w-4.5 h-4.5 animate-pulse" />
                      <span>Provocar Transacción Fallida (Gatillar DB Rollback & Alerta)</span>
                    </button>
                    <p className="text-[10px] text-slate-400 italic text-center mt-2 leading-relaxed">
                      * El resultado podrá ser verificado instantáneamente en la Bitácora de Auditoría ubicada en la parte inferior de la pantalla. ¡Pruébelo!
                    </p>
                  </div>
                </div>
              )}

              {/* Success / Error feedbacks within Modal body */}
              {feedbackMsg && (
                <div className={`mt-5 p-4 rounded-xl border flex gap-3 text-xs font-bold leading-relaxed shadow-sm items-start animate-fade-in ${
                  feedbackMsg.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${feedbackMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600 animate-bounce'}`} />
                  <div>
                    <h5 className="uppercase text-[9px] tracking-wider font-extrabold mb-1">
                      {feedbackMsg.type === 'success' ? 'ÉXITO EN EL SERVIDOR' : 'RECHAZADO POR CONTRALORÍA DE DATOS'}
                    </h5>
                    <p>{feedbackMsg.text}</p>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <footer className="bg-slate-50 px-6 py-4 border-t border-slate-200 text-right select-none">
              <button
                onClick={() => { setActiveTab(null); setFeedbackMsg(null); }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-sm active:scale-98"
              >
                Cerrar Panel
              </button>
            </footer>

          </div>
        </div>
      )}
    </>
  );
}
