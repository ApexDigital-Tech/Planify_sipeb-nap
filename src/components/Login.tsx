import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Mail, 
  UserCheck, 
  RefreshCw, 
  AlertCircle, 
  Fingerprint, 
  CheckSquare, 
  Server,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Reset phase when force_password_reset is active
  const [resetUser, setResetUser] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor complete todos los campos de ingreso.');
      return;
    }

    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setError(data.error || 'Credenciales de autenticación incorrectas.');
        setLoading(false);
        return;
      }

      if (data.user.force_password_reset) {
        setResetUser(data.user);
        setInfoMsg('⚠️ CAMBIO DE CONTRASEÑA REQUERIDO: Su perfil del SUPER_ADMIN requiere de forma mandataria el remplazo de la contraseña semilla mediante encriptación irreversible bcrypt.');
      } else {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError('Error de Red/Servidor e ingress con el API de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Por favor llene los campos de la nueva contraseña.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden. Verifique la igualdad.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe poseer al menos 6 caracteres por políticas de seguridad Agetica.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/force-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetUser.email, newPassword })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Fallo al procesar el cambio de credencial.');
        setLoading(false);
        return;
      }

      setResetUser(null);
      onLoginSuccess(data.user);
    } catch (err) {
      setError('Error del servidor al cambiar clave.');
    } finally {
      setLoading(false);
    }
  };

  // Pre-seed credentials dynamic buttons
  const seedUsers = [
    {
      name: "Dilan Aliendre",
      role: "SUPER_ADMIN",
      email: "aliendredilan@gmail.com",
      pass: "sipeb.Dilan#2026",
      desc: "Acceso Root"
    },
    {
      name: "Carlos Saavedra",
      role: "REVISOR_SENIOR",
      email: "revisor.giz@planificacion.gob.bo",
      pass: "Revisor.2026#GIZ",
      desc: "Coordinador GIZ (Firmador)"
    },
    {
      name: "Especialista PAD",
      role: "ESPECIALISTA_PAD",
      email: "especialista.pad@planificacion.gob.bo",
      pass: "Pad.2026#Territorio",
      desc: "Escritura PAD"
    },
    {
      name: "Especialista PES",
      role: "ESPECIALISTA_PES",
      email: "especialista.pes@planificacion.gob.bo",
      pass: "Pes.2026#Sectorial",
      desc: "Escritura PES"
    }
  ];

  const handleQuickBypass = (user: any) => {
    setEmail(user.email);
    setPassword(user.pass);
    setError('');
    setInfoMsg(`Semilla Seleccionada: ${user.name} (${user.role})`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-lg z-10 space-y-6">
        
        {/* State Branding and Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0058be] bg-white border border-slate-200 py-1 px-2.5 rounded-md">
              SISTEMA SIPEB 2026-2030
            </span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white uppercase sm:text-2xl">
            Control de Identidad y Roles (IAM)
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Proyecto Nacional NAP • Planificación del Estado Plurinacional de Bolivia • Cooperación GIZ
          </p>
        </div>

        {/* Errors / Info Alerts */}
        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-start gap-1.5 leading-normal animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="p-3 bg-amber-950/80 border border-amber-800 text-amber-200 text-xs rounded-xl flex items-start gap-1.5 leading-normal">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Core Form Card */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
          
          {!resetUser ? (
            /* PHASE 1: STANDARD LOGIN */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                <Fingerprint className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Ingreso de Credenciales Autorizadas</h2>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email del Funcionario</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@planificacion.gob.bo"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contraseña de Acceso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 active:scale-98"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                <span>Verificar Firma de Acceso</span>
              </button>
            </form>
          ) : (
            /* PHASE 2: FORCE RESET FORM */
            <form onSubmit={handleForceReset} className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 pb-2 border-b border-amber-800 text-amber-400">
                <Shield className="w-5 h-5 text-amber-500 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-wider">Restablecer Contraseña Obligatoria</h2>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Su cuenta de <strong>{resetUser.name} ({resetUser.email})</strong> requiere que defina una nueva credencial permanente. Se encriptará inmediatamente usando criptografía irreversible de nivel gubernamental en el servidor.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nueva Contraseña de Producción</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Contraseña robusta nueva..."
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-amber-900/80 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita nueva clave..."
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-amber-900/80 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-98"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                <span>Guardar Credencial y Acceder</span>
              </button>
            </form>
          )}

        </div>

        {/* Dynamic Sandbox Credentials Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-slate-400 pb-1 border-b border-slate-800">
            <Server className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
              UAT Bypass: Credenciales Semilla del Sistema
            </h3>
          </div>
          
          <p className="text-[10.5px] text-slate-400 leading-normal">
            Haga clic en cualquiera de estas cuentas semilla inyectadas para rellenar instantáneamente el email y la contraseña provisional pre-configurada.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {seedUsers.map(user => (
              <div 
                key={user.email}
                onClick={() => handleQuickBypass(user)}
                className="p-3.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/40 rounded-xl cursor-pointer text-left transition-all active:scale-98 relative group flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10.5px] font-black text-slate-100 group-hover:text-blue-400 transition-colors">{user.name}</span>
                  <span className="text-[8px] font-mono leading-none bg-blue-950 text-blue-300 border border-blue-900 px-1 py-0.5 rounded font-extrabold uppercase">
                    {user.role}
                  </span>
                </div>
                
                <div className="mt-1 flex flex-col">
                  <span className="text-[9.5px] text-slate-400 font-semibold truncate">{user.email}</span>
                  <span className="text-[9px] text-slate-500 font-mono">Clave: <strong className="text-slate-300">{user.pass}</strong></span>
                </div>
                
                <div className="text-[9.5px] text-slate-400 font-extrabold mt-1 border-t border-slate-700/60 pt-1 flex items-center justify-between">
                  <span>{user.desc}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
