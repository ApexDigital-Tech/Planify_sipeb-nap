import React from 'react';
import { 
  Bell, 
  Settings, 
  User, 
  Layers, 
  Fingerprint, 
  FileCode,
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  correlationId: string;
  isSigned: boolean;
  onReset: () => void;
  userRole?: string;
  currentUser?: any;
  onLogout?: () => void;
}

export default function Header({ correlationId, isSigned, onReset, userRole, currentUser, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 right-0 h-16 flex justify-between items-center px-10 border-b border-[#e4e2e4] bg-white/80 backdrop-blur-md ml-[280px] w-[calc(100%-280px)] z-40 select-none">
      {/* Search/Workflow title area */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-800">
          <Layers className="w-5 h-5 text-[#0058be]" />
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            Planificación Estratégica (NAP)
          </span>
        </div>
        
        <div className="h-4 w-px bg-slate-200" />
        
        <nav className="hidden md:flex gap-5 text-xs font-semibold text-slate-500">
          <a className="hover:text-[#0058be] transition-colors" href="#dashboard">Dashboard</a>
          <a className="hover:text-[#0058be] transition-colors" href="#doc">Documentación</a>
          <a className="hover:text-[#0058be] transition-colors" href="#ayuda">Ayuda</a>
        </nav>
      </div>

      {/* Notifications, Settings & Profile */}
      <div className="flex items-center gap-5">
        {/* Dynamic Correlation ID Tracker badge for QA */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-md font-mono text-[10px] text-slate-600">
          <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-slate-400">CORR_ID:</span>
          <span className="font-bold text-slate-800">{correlationId || 'Cargando...'}</span>
        </div>

        <button 
          onClick={onReset}
          className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 rounded transition-colors cursor-pointer"
          title="Reiniciar Simulación de Datos"
        >
          Reiniciar Paso
        </button>

        <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
          <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-full transition-all cursor-pointer relative">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
          </button>
          
          <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-full transition-all cursor-pointer">
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* User Badge Profile */}
        <div className="flex items-center gap-3 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 leading-none">{currentUser?.name || "Arq. Marcelo Arce"}</p>
            <p className="text-[9px] text-[#0058be] uppercase tracking-wider font-extrabold mt-0.5">
              {currentUser?.role || userRole || "Planificador Regional V"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 hover:border-blue-300 transition-colors dropdown-avatar">
            {isSigned ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 animate-pulse" />
            ) : (
              <User className="w-4.5 h-4.5 text-[#0058be]" />
            )}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="text-[9.5px] bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-slate-600 rounded px-2.5 py-1 tracking-wider uppercase font-extrabold cursor-pointer transition-all"
            >
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
