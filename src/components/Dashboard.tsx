import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Coins, 
  ShieldCheck, 
  ShieldAlert, 
  TrendingUp, 
  Search, 
  Filter, 
  ArrowRight, 
  Download, 
  Terminal, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText, 
  AlertTriangle,
  PlaySquare,
  Lock,
  ExternalLink,
  ChevronDown,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { PlanState, AuditLog } from '../types';
import SourceManager from './SourceManager';

interface DashboardProps {
  state: PlanState;
  correlationId: string;
  onEnterExpediente: (step: number) => void;
  onSetScenario: (type: 'PES' | 'PAD') => void;
  userRole: string;
}

interface Department {
  id: string;
  name: string;
  gad: string;
  status: string;
  inertiaFlag: boolean;
  code: string;
}

interface SectoralPlan {
  id: string;
  sector: string;
  title: string;
  threat: string;
  budget: number;
  isSigned: boolean;
  lastModified: string;
  ejePdes: string;
  riskLevel: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
}

export default function Dashboard({ state, correlationId, onEnterExpediente, onSetScenario, userRole }: DashboardProps) {
  // Metrics States
  const [metrics, setMetrics] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [catalog, setCatalog] = useState<SectoralPlan[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sorting/Filter states for PES Catalogue
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEje, setSelectedEje] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [sortBy, setSortBy] = useState<'budget' | 'sector' | 'riskLevel'>('budget');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal / Download Flotante State
  const [activeDownloadPlan, setActiveDownloadPlan] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load dashboards API
  const fetchDashboardData = async () => {
    try {
      const [mRes, dRes, sRes, aRes] = await Promise.all([
        fetch('/api/dashboard/metrics'),
        fetch('/api/dashboard/departments'),
        fetch('/api/dashboard/sectoral'),
        fetch('/api/audit/recent')
      ]);

      const [mData, dData, sData, aData] = await Promise.all([
        mRes.json(),
        dRes.json(),
        sRes.json(),
        aRes.json()
      ]);

      if (mData.success) setMetrics(mData);
      if (dData.success) setDepartments(dData.departments);
      if (sData.success) setCatalog(sData.catalog);
      if (aData.success) setRecentLogs(aData.logs);
    } catch (err) {
      console.error("Error loading dashboard GovTech endpoints:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh every 5 seconds to keep audit console alive
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [state]);

  const handleDepartmentClick = (dep: Department) => {
    if (dep.name === 'Tarija') {
      onSetScenario('PAD');
      onEnterExpediente(4); // Switch directly to active Step 4 page
    } else {
      // For demo purposes, we allow entering active mock folders
      alert(`Expediente Territorial de ${dep.name} (${dep.gad}) asignado temporalmente en Sandbox. Solo el expediente activo de Tarija (Caso B) y el Plan de Redes de Salud (Caso A) están habilitados en esta fase del simulador.`);
    }
  };

  const handleDownloadTrigger = (e: React.MouseEvent, plan: any) => {
    e.stopPropagation();
    setActiveDownloadPlan(plan);
  };

  const handleExecuteMockDownload = (format: 'docx' | 'xlsx') => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setActiveDownloadPlan(null);
      
      // Simulate download
      const boundaryMsg = format === 'docx' 
        ? `REPORTE NARRATIVO OFICIAL GIZ-MPDyMA CORRESPONDIENTE A: ${activeDownloadPlan.title || activeDownloadPlan.gad}.docx`
        : `MATRIZ PRESUPUESTARIA PLURIANUAL DE INVERSIÓN CLIMÁTICA: ${activeDownloadPlan.title || activeDownloadPlan.gad}.xlsx`;

      alert(`DESCARGA EXITOSA: Se ha transmitido un paquete binario inmutable.\n\nContenido: ${boundaryMsg}\nMetadata Certificación: \n- SHA256 Signature Approved\n- Fecha: ${new Date().toLocaleDateString()}\n- Autor: ${userRole || "Director GIZ"}\n- Correlation ID: ${correlationId}`);
    }, 1200);
  };

  // Filter Catalog
  const filteredCatalog = catalog.filter(plan => {
    const matchesSearch = plan.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          plan.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          plan.threat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEje = selectedEje === 'ALL' || plan.ejePdes.includes(selectedEje);
    const matchesRisk = selectedRisk === 'ALL' || plan.riskLevel === selectedRisk;
    return matchesSearch && matchesEje && matchesRisk;
  }).sort((a, b) => {
    let orderA: any = a[sortBy];
    let orderB: any = b[sortBy];
    
    if (sortBy === 'riskLevel') {
      const weight = { 'Verde': 1, 'Amarillo': 2, 'Naranja': 3, 'Rojo': 4 };
      orderA = weight[a.riskLevel];
      orderB = weight[b.riskLevel];
    }

    if (orderA < orderB) return sortDirection === 'asc' ? -1 : 1;
    if (orderA > orderB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: 'budget' | 'sector' | 'riskLevel') => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  if (isLoading || !metrics) {
    return (
      <div className="py-24 text-center select-none font-sans flex flex-col items-center justify-center">
        <Activity className="w-10 h-10 animate-spin text-[#0058be] mb-4" />
        <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Compilando Dashboard de Misión Crítica</p>
        <p className="text-[11px] text-slate-400 mt-1">Calculando visuales agregados de inversión territorial en menos de 800ms...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 select-none animate-fade-in font-sans">
      
      {/* Hero Welcome Banner */}
      <div className="p-6 bg-radial from-blue-900 via-blue-950 to-slate-950 text-white rounded-2xl border border-blue-900/40 relative overflow-hidden shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Layers className="w-48 h-48 text-white rotate-12" />
        </div>
        <div className="space-y-1.5 max-w-2xl z-10">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase tracking-wider rounded border border-blue-500/30">
              Proyecto NAP - GIZ Bolivia
            </span>
            <span className="p-1 px-2 bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wider rounded border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
              <span>Sincronizado</span>
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
            MONITOR ACC-RRD • SISTEMA SIPEB 2026-2030
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            Consola Gubernamental Unificada de Acompañamiento y Mitigación de Riesgos ante el Cambio Climático. Gestione y certifique flujos sectoriales (PES) y de gobiernos autónomos (PAD) bajo la Ley N° 777.
          </p>
        </div>
        <div className="flex gap-2.5 z-10 shrink-0">
          <button
            onClick={() => {
              onSetScenario('PES');
              onEnterExpediente(4);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>Caso A (PES)</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-300" />
          </button>
          <button
            onClick={() => {
              onSetScenario('PAD');
              onEnterExpediente(4);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow cursor-pointer transition-all border border-blue-550"
          >
            <span>Caso B (PAD Tarija)</span>
            <PlaySquare className="w-3.5 h-3.5 text-indigo-100" />
          </button>
        </div>
      </div>

      {/* 1.5 PANEL DE ALERTAS DE INERCIA GLOBAL (Exclusivo para SUPER_ADMIN y REVISOR_SENIOR) */}
      {(userRole === 'SUPER_ADMIN' || userRole === 'REVISOR_SENIOR') && (
        <div id="alertas-inercia-globales-panel" className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm space-y-3 relative overflow-hidden animate-fade-in group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-amber-900">
            <AlertTriangle className="w-24 h-24" />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 px-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded border border-amber-600 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                <span>NIVEL DIRECTIVO (IAM EXCLUSIVO)</span>
              </div>
              <h3 className="text-sm font-black text-amber-900 tracking-tight uppercase flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Módulo de Control: Alertas de Inercia Globales (2026-2030)</span>
              </h3>
            </div>
            
            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100/60 border border-amber-200/60 p-1 px-2.5 rounded">
              Atribución: <strong className="font-extrabold uppercase text-amber-800">{userRole}</strong>
            </span>
          </div>
          
          <p className="text-xs text-amber-850 leading-relaxed font-semibold">
            Atención: Su nivel de autorización global le permite supervisar las alertas de inercia institucionales gatilladas en el Sistema de Planificación Integral (SPIE). Estos bloqueos administrativos impiden de manera estricta la firma final (Paso 8) del expediente en el territorio afectado hasta comprobarse medidas compensatorias.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5">
            {/* Alerta de Tarija */}
            <div className="p-3.5 bg-white border border-amber-200 rounded-xl space-y-2 text-slate-800 shadow-2xs hover:border-amber-350 transition-colors">
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 font-mono">ID: AL-IN-PAD-02</span>
                <span className="p-1 text-[8.5px] font-black bg-rose-50 text-rose-700 rounded border border-rose-100 uppercase font-mono animate-pulse">CRÍTICA (BLOQUEANTE)</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-900">Tarija (GADP Tarija) - Instrumento Territorial PAD</p>
                <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                  Alerta disparada en el Paso 5: Diagnosticado con capacidad técnica deficiente (Capacidad Técnica = 0). Las firmas de consolidación del expediente continúan estrictamente suspendidas.
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 text-[10px] font-semibold text-slate-500 font-mono">
                <span>Estado de mitigación:</span>
                <span className={state.adaptationCapacity.inertiaFlagActive ? "text-rose-600 font-black animate-pulse" : "text-emerald-700 font-black flex items-center gap-1"}>
                  {state.adaptationCapacity.inertiaFlagActive ? "❌ BLOQUEANTE ACTIVO" : "✅ SOLUCIONADO (Fortalecimiento técnico de GIZ validado)"}
                </span>
              </div>
            </div>

            {/* Alerta de Chuquisaca */}
            <div className="p-3.5 bg-white/70 border border-amber-100 rounded-xl space-y-2 text-slate-800 shadow-2xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 font-mono">ID: AL-IN-PAD-05</span>
                <span className="p-1 text-[8.5px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200 uppercase font-mono">EN AUDITORÍA PREVIA</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-800">Chuquisaca (GADP Chuquisaca) - Instrumento Territorial PAD</p>
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                  Reportes preliminares levantados por la contraparte técnica de GIZ señalan debilidades financieras recurrentes en el sector de adaptación.
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 text-[10px] font-semibold text-slate-500 font-mono">
                <span>Estado de mitigación:</span>
                <span className="text-amber-700 font-bold">⚠️ BAJO REVISIÓN MÍNIMA</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. BARRA SUPERIOR DE MÉTRICAS GLOBALES (Suplemento Analítico Senior) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Progreso General */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-50 text-[#0058be] rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Avance PDES</span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{metrics.progress.percentagePDESA}%</span>
              <span className="text-[10px] font-bold text-slate-400">meta global</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal mt-1">
              Catálogo activo de <strong>{metrics.progress.totalPlans} planes</strong> registrados: {metrics.progress.pesPlans} sectoriales (PES) y {metrics.progress.padPlans} territoriales (PAD).
            </p>
          </div>
          <div className="mt-3.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${metrics.progress.percentagePDESA}%` }} />
          </div>
        </div>

        {/* KPI 2: Inversión Climática */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Inversión ACC-RRD</span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.investment.cumulativeInvestment.toLocaleString('es-BO')} Bs.
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-normal mt-1">
              Techo país: <strong>{(metrics.investment.ceiling / 1000000).toFixed(1)}M Bs</strong> assigned. {metrics.investment.percentage}% invertido eficazmente.
            </p>
          </div>
          <div className="mt-3.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${metrics.investment.percentage}%` }} />
          </div>
        </div>

        {/* KPI 3: Cumplimiento GEDSI */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Salvaguardas GEDSI</span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{metrics.gedsi.compliancePct}%</span>
              <span className="text-[10px] text-emerald-600 font-extrabold">▲ +4%</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal mt-1">
              Inclusión de género, comunidades originarias y grupos vulnerables validados por los analistas.
            </p>
          </div>
          <div className="mt-3.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${metrics.gedsi.compliancePct}%` }} />
          </div>
        </div>

        {/* KPI 4: Integridad Criptográfica */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Integridad Hash</span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span className={metrics.integrity.integrityPct < 100 ? "text-rose-600 animate-pulse font-black" : "text-slate-900"}>
                {metrics.integrity.integrityPct}%
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Estables</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal mt-1">
              Object Storage: <strong>{metrics.integrity.stableDocs}/{metrics.integrity.totalDocs}</strong> archivos válidos. 
              {metrics.integrity.integrityPct < 100 && <span className="text-rose-600 font-bold block">⚠️ Alerta: Evidencia Alterada en Servidor.</span>}
            </p>
          </div>
          <div className="mt-3.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>SHA256 Match</span>
            <span className={metrics.integrity.integrityPct < 100 ? "text-rose-600 font-extrabold" : "text-emerald-600 font-extrabold"}>
              {metrics.integrity.integrityPct < 100 ? "HASH_CORRUPT" : "SECURE_VAULT"}
            </span>
          </div>
        </div>

      </div>

      {/* 2. MÓDULO TERRITORIAL: MONITOR DE LOS 9 DEPARTAMENTOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h3 className="text-base font-black text-slate-900 tracking-tight">MONITOR TERRITORIAL: Los 9 Departamentos (Control PAD)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-semibold">
              Fiscalización y estado en workflow de los planes departamentales territoriales según el Comunicado GIZ/PD-02/2026.
            </p>
          </div>
          <div className="p-2 py-1 bg-slate-100 rounded-lg text-[10px] text-slate-500 font-mono border border-slate-200 self-start">
            Sincronización: <strong>Real-time</strong>
          </div>
        </div>

        {/* Interactive Grid of 9 Departments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dep) => {
            const isTarija = dep.name === 'Tarija';
            const isActive = isTarija && state.planType === 'PAD';
            const hasInertia = dep.inertiaFlag;
            const isConsolidado = dep.status === 'Consolidado';

            return (
              <div
                key={dep.id}
                onClick={() => handleDepartmentClick(dep)}
                className={`p-5 rounded-2xl relative select-none border-2 transition-all duration-300 flex flex-col justify-between gap-4 group cursor-pointer ${
                  hasInertia 
                    ? 'border-rose-500 bg-rose-50/40 shadow-sm shadow-rose-150 animate-pulse' 
                    : isActive
                    ? 'border-blue-600 bg-blue-50/20 shadow-md'
                    : 'border-slate-200/80 bg-slate-50/20 hover:border-slate-350 hover:bg-slate-50/60 hover:shadow-xs'
                }`}
              >
                {/* Inertia Alarm Background Glow */}
                {hasInertia && (
                  <div className="absolute inset-0 bg-red-400/5 pointer-events-none rounded-2xl" />
                )}

                <div className="space-y-1.5 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-bold text-slate-400">GAD-Code: {dep.code}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase ${
                      dep.status === 'Consolidado' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                        : dep.status === 'Validado'
                        ? 'bg-blue-50 text-[#0058be] border border-blue-200'
                        : dep.status === 'Riesgo Calculado'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-slate-150 text-slate-600 border border-slate-300/30'
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 group-hover:text-blue-900 transition-colors leading-tight">{dep.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">{dep.gad}</p>
                  </div>
                </div>

                {/* Conditional warning of Inertia flag block in Step 5 */}
                {hasInertia && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-1 pb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-black text-rose-700 uppercase tracking-wider">
                        [ALERTA DE INERCIA ACTIVA - BLOQUEADO]
                      </p>
                      <p className="text-[9.5px] text-rose-900 leading-normal font-semibold">
                        Se detectó una capacidad técnica deficiente en el diagnóstico. Las firmas estatales de consolidación final continúan bloqueadas.
                      </p>
                    </div>
                  </div>
                )}

                {/* Active Indicator & Action Drawer */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 relative z-10">
                  {isActive ? (
                    <span className="text-[10.5px] font-bold text-[#0058be] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#0058be] animate-ping" />
                      <span>Expediente Activo en Workflow</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                      Haga clic para ver expediente...
                    </span>
                  )}

                  {/* Actions floated */}
                  <div className="flex gap-1.5 items-center">
                    {isConsolidado && (
                      <button
                        title="Descarga Express - Reportes Ministerio"
                        onClick={(e) => handleDownloadTrigger(e, dep)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-250 cursor-pointer transition-all flex items-center justify-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="p-1.5 bg-blue-50 text-[#0058be] rounded-lg group-hover:bg-blue-100 transition-colors flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MÓDULO SECTORIAL: CATÁLOGO DE PLANES ESTRATÉGICOS (PES) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h3 className="text-base font-black text-slate-900 tracking-tight">MÓDULO SECTORIAL: Catálogo de Planes Estratégicos (PES)</h3>
          </div>
          <p className="text-xs text-slate-500 font-semibold">
            Monitoreo y filtrado en tiempo real de los Planes Sectoriales de Cambio Climático presentados por los Ministerios del Estado Plurinacional.
          </p>
        </div>

        {/* Dynamic hot filters and search toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por sector, plan o amenaza..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-xl font-medium outline-hidden transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter by Eje PDES */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            <select
              value={selectedEje}
              onChange={(e) => setSelectedEje(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl font-medium outline-hidden transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">Todos los Ejes PDES</option>
              <option value="Eje 1">Eje 1: Crecimiento Económico</option>
              <option value="Eje 2">Eje 2: Desarrollo Social</option>
              <option value="Eje 3">Eje 3: Seguridad Alimentaria</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          {/* Filter by Risk level */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl font-medium outline-hidden transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">Todos los Niveles de Riesgo</option>
              <option value="Verde">Riesgo Bajo (Verde)</option>
              <option value="Amarillo">Riesgo Moderado (Amarillo)</option>
              <option value="Naranja">Riesgo Alto (Naranja)</option>
              <option value="Rojo">Riesgo Crítico (Rojo)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          {/* Active stats badge */}
          <div className="bg-slate-50 border border-slate-150 p-2 px-3 rounded-xl flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Planes listados:</span>
            <span className="p-1 px-2.5 bg-[#0058be] text-white rounded text-[10px] font-black leading-none">
              {filteredCatalog.length} de {catalog.length}
            </span>
          </div>

        </div>

        {/* Data Table */}
        <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-150 text-[10px] uppercase select-none">
                  <th className="p-3.5 pl-4">Sector / Ministerio</th>
                  <th className="p-3.5">Título del Expediente</th>
                  <th className="p-3.5 hidden lg:table-cell">Amenaza Crítica Vinculada</th>
                  <th className="p-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors" onClick={() => toggleSort('budget')}>
                    <div className="flex items-center gap-1">
                      <span>Presupuesto Plurianual</span>
                      <ArrowRight className="w-3 h-3 rotate-90" />
                    </div>
                  </th>
                  <th className="p-3.5 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors" onClick={() => toggleSort('riskLevel')}>
                    Riesgo ACC
                  </th>
                  <th className="p-3.5 text-center">Firma Digital</th>
                  <th className="p-3.5 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                {filteredCatalog.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                      No se encontraron Planes Sectoriales con los criterios de filtrado seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredCatalog.map((plan) => {
                    const isPlanActive = state.planType === 'PES' && plan.sector.includes('Salud');

                    return (
                      <tr 
                        key={plan.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isPlanActive ? 'bg-blue-50/10' : ''
                        }`}
                      >
                        <td className="p-3.5 pl-4 font-bold text-slate-900">
                          {plan.sector}
                          {isPlanActive && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[8.5px] bg-[#0058be] text-white rounded font-bold uppercase tracking-tight">Alineado</span>
                          )}
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <p className="font-extrabold text-slate-850 truncate">{plan.title}</p>
                          <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">{plan.id}</p>
                        </td>
                        <td className="p-3.5 hidden lg:table-cell max-w-[200px] text-[11px] text-slate-500 font-semibold leading-relaxed">
                          {plan.threat}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800 text-[11.5px]">
                          {plan.budget.toLocaleString('es-BO')} Bs.
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`p-1 px-2.5 rounded text-[9.5px] font-black leading-none uppercase ${
                            plan.riskLevel === 'Verde'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : plan.riskLevel === 'Amarillo'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : plan.riskLevel === 'Naranja'
                              ? 'bg-orange-50 text-orange-700 border border-orange-250'
                              : 'bg-rose-50 text-rose-700 border border-rose-250'
                          }`}>
                            {plan.riskLevel}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {plan.isSigned ? (
                            <div className="flex items-center justify-center gap-1 text-emerald-600 font-bold" title="Digital Signature Validated via Agetic">
                              <ShieldCheck className="w-4 h-4" />
                              <span className="text-[10px] uppercase font-bold">FIRMADO</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-slate-400 font-semibold">
                              <Lock className="w-3.5 h-3.5" />
                              <span className="text-[10px] uppercase tracking-wide">Pte. Firma</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-4">
                          <div className="flex justify-end gap-1.5">
                            {isPlanActive ? (
                              <button
                                onClick={() => {
                                  onSetScenario('PES');
                                  onEnterExpediente(4);
                                }}
                                className="px-2 py-1 bg-[#0058be] hover:bg-blue-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>Ingresar</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => alert(`Plan Sectorial de ${plan.sector} en modo lectura. Solo el Plan de Salud Territorial Sectorial de GIZ (Caso A) está asignado en la instancia de simulación activa.`)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-[10px] font-semibold cursor-pointer border border-slate-250 transition-colors"
                              >
                                Ver Carpeta
                              </button>
                            )}
                            {plan.isSigned && (
                              <button
                                onClick={(e) => handleDownloadTrigger(e, plan)}
                                className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg cursor-pointer"
                                title="Descargar Reportes Oficiales"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3.5 MÓDULO DE CONSULTA: Gestor de Fuentes & Documentos de Referencia */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
            <h3 className="text-base font-black text-slate-900 tracking-tight">MÓDULO DE CONSULTA: Gestor de Fuentes & Base de Conocimiento</h3>
          </div>
          <p className="text-xs text-slate-500 font-semibold">
            Suba documentos normativos locales o vincule carpetas de Google Drive. El Asistente IA leerá e indexará estas fuentes dinámicamente en tiempo real para sus consultas.
          </p>
        </div>
        
        <SourceManager />
      </div>

      {/* 4. CAPA DE TRAZABILIDAD Y AUDITORÍA EN TIEMPO REAL (Actividad Reciente) */}
      <div className="bg-slate-900 border border-slate-805 text-slate-300 rounded-2xl p-5 shadow-inner space-y-4 font-mono text-[11px]">
        
        {/* Console Header */}
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-[10px] uppercase text-emerald-400 tracking-wider">
              BITÁCORA INTEGRAL DE AUDITORÍA EN TIEMPO REAL (instrumento_auditoria_logs)
            </span>
          </div>
          <span className="text-[9px] bg-slate-800 text-slate-400 p-1 px-2.5 rounded font-semibold">
            ESTADO: SEGURO (AES_256)
          </span>
        </div>

        {/* Live console-like feed list */}
        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 italic text-center p-4">No se registran eventos de auditoría previos en esta sesión.</p>
          ) : (
            recentLogs.map((log) => {
              // Highlight rollbacks
              const isRollback = log.action === 'TRANSACTIONAL_ROLLBACK';
              const isTamper = log.action === 'SERVER_FILE_SYSTEM_TAMPERING_DETECTED' || log.action === 'INTEGRITY_COMPROMISED_EVIDENCE_REJECTED';

              return (
                <div 
                  key={log.id} 
                  className={`p-2.5 rounded-lg border leading-relaxed select-text transition-colors flex flex-col md:flex-row md:items-start md:justify-between gap-1 ${
                    isRollback 
                      ? 'bg-rose-950/40 border-rose-900 text-rose-300' 
                      : isTamper 
                      ? 'bg-amber-950/30 border-amber-850 text-amber-300'
                      : 'bg-slate-950/50 border-slate-800 hover:bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                      <span className="text-emerald-500 font-bold">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-blue-400 font-black tracking-wide uppercase">{log.action}</span>
                      <span className="text-slate-400">by: <strong className="text-white">{log.user_id}</strong></span>
                    </div>
                    
                    {log.valores_modificados && (
                      <pre className="text-[9px] text-slate-400 bg-slate-900/50 p-1.5 rounded border border-slate-805 max-w-2xl overflow-x-auto">
                        {log.valores_modificados}
                      </pre>
                    )}
                  </div>
                  <div className="space-y-0.5 text-right font-semibold text-[9.5px] whitespace-nowrap shrink-0 md:self-center">
                    <p className="text-slate-400 font-mono">Corr ID: <span className="text-indigo-400">{log.correlation_id || correlationId}</span></p>
                    <p className="text-[8.5px] text-slate-500">Atomic State Lock: OK</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Modal for Report generation & Download */}
      {activeDownloadPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scale-up">
            
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-[#0058be]/10 text-[#0058be] rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <button 
                onClick={() => setActiveDownloadPlan(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded bg-slate-50 border border-slate-200 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 leading-tight">Motor de Reportes Oficiales SIPEB</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Está a punto de sincronizar y descargar los informes finales del expediente oficial para **{activeDownloadPlan.title || activeDownloadPlan.name || activeDownloadPlan.gad}**.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl rounded-b-none space-y-2 text-[11px] font-semibold text-slate-600 leading-relaxed">
              <div className="flex justify-between">
                <span>Régimen Regulatorio:</span>
                <span className="text-slate-900 font-bold">Ley 777 (Bolivia)</span>
              </div>
              <div className="flex justify-between">
                <span>Certificación Digital:</span>
                <span className="text-emerald-700 font-extrabold">Firma Agetic v3 Aprobada</span>
              </div>
              <div className="flex justify-between">
                <span>Hash Autor:</span>
                <code className="text-blue-700 text-[9px] select-all font-mono font-bold">d5c589b91fac53cf...</code>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => handleExecuteMockDownload('docx')}
                className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-extrabold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <Activity className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Reporte Word (Narrativo)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isDownloading}
                onClick={() => handleExecuteMockDownload('xlsx')}
                className="flex-1 py-2.5 bg-emerald-55 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <Activity className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Matriz Excel (Presupuesto)</span>
                  </>
                )}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
