import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Key, 
  ShieldAlert, 
  Check, 
  RotateCcw, 
  Radio, 
  UserX,
  FileCheck2,
  Lock,
  Unlock,
  Building,
  Stethoscope,
  Info
} from 'lucide-react';

interface UserItem {
  name: string;
  email: string;
  role: string;
  force_password_reset: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('ESPECIALISTA_PAD');
  const [formPassword, setFormPassword] = useState('');
  const [formForceReset, setFormForceReset] = useState(true);

  // Quick Action State
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'No se pudo obtener la lista de usuarios.');
      }
    } catch (e) {
      setError('Error al comunicar con la API de administración de SIPEB.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formName || !formEmail || !formPassword || !formRole) {
      setError('Todos los campos son obligatorios para registrar un nuevo consultor.');
      return;
    }

    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          force_password_reset: formForceReset
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Creación exitosa: El usuario ${formEmail} ha sido registrado e inyectado con hashes de producción.`);
        setFormName('');
        setFormEmail('');
        setFormPassword('');
        setFormForceReset(true);
        fetchUsers();
      } else {
        setError(data.error || 'Error al intentar registrar el usuario.');
      }
    } catch (e) {
      setError('Error de comunicación con el backend SIPEB.');
    }
  };

  const handleUpdateUser = async (email: string, role: string, forceReset: boolean, customPassword?: string) => {
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          force_password_reset: forceReset,
          password: customPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Usuario ${email} actualizado exitosamente en la base de datos.`);
        setEditingEmail(null);
        setNewPass('');
        fetchUsers();
      } else {
        setError(data.error || 'No se pudo actualizar el usuario.');
      }
    } catch (e) {
      setError('Falla al enviar actualización a la API.');
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`¿Está seguro de revocar el acceso y firmas del usuario ${email}? Esta acción es irreversible.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Firma y acceso de ${email} han sido revocados reglamentariamente.`);
        fetchUsers();
      } else {
        setError(data.error || 'No se pudo procesar la revocación.');
      }
    } catch (e) {
      setError('Error de Red al revocar credencial.');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Super Admin</span>;
      case 'REVISOR_SENIOR':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Revisor Senior GIZ</span>;
      case 'ESPECIALISTA_PAD':
        return <span className="bg-sky-100 text-sky-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Especialista PAD (Territorial)</span>;
      case 'ESPECIALISTA_PES':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Especialista PES (Sectorial)</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{role}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2" id="user-management-control-panel">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 to-[#022a5e] text-white p-7 rounded-xl shadow-sm border border-slate-800">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <Users className="w-8 h-8 text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Módulo de Gestión de Accesos, Usuarios e Instrumentos</h1>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed max-w-4xl">
              Panel integrado exclusivo para el <strong className="text-white uppercase font-black text-rose-300">SUPER_ADMIN</strong>. 
              Configure los perfiles de los consultores de campo GIZ-NAP, defina el tipo de instrumento obligatorio asignado de acuerdo a la matriz de roles, 
              fuerce cambios de contraseña inicial bajo estándares de la AGETIC y mantenga la inmutabilidad de la bitácora de auditoría SIPEB.
            </p>
          </div>
        </div>
      </div>

      {notifyAlerts(error, success, setError, setSuccess)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Registration Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Registrar Nuevo Consultor</h2>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div>
              <label className="block text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wide mb-1">Nombre Completo del Profesional</label>
              <input 
                type="text" 
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ej. Ing. Diana Vargas"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:border-blue-500 focus:bg-white outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wide mb-1">Correo Electrónico Institucional</label>
              <input 
                type="email" 
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="diana.vargas@planificacion.gob.bo"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:border-blue-500 focus:bg-white outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wide mb-1">Rol / Grupo de Seguridad</label>
              <select 
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:border-blue-500 focus:bg-white outline-hidden font-extrabold text-slate-800"
              >
                <option value="ESPECIALISTA_PAD">ESPECIALISTA PAD (Consultor Territorial)</option>
                <option value="ESPECIALISTA_PES">ESPECIALISTA PES (Consultor Sectorial)</option>
                <option value="REVISOR_SENIOR">REVISOR SENIOR (Contraparte Estatal/GIZ)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Máxima Autoridad Root)</option>
              </select>
            </div>

            {/* Visual Indicator of Allowed Instruments */}
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-[11px] text-slate-700 flex items-start gap-2 select-none">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Determinación de Rol:</p>
                {formRole === 'ESPECIALISTA_PAD' && (
                  <p className="text-slate-600 mt-0.5 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-sky-600 inline" /> 
                    <span>Restringido exclusivamente a instrumentos <strong>PAD</strong> (Gobiernos Autónomos).</span>
                  </p>
                )}
                {formRole === 'ESPECIALISTA_PES' && (
                  <p className="text-slate-600 mt-0.5 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-600 inline" /> 
                    <span>Restringido exclusivamente a instrumentos <strong>PES</strong> (Ministerios).</span>
                  </p>
                )}
                {formRole === 'REVISOR_SENIOR' && (
                  <p className="text-slate-600 mt-0.5">Acceso de lectura global a todos los instrumentos. Autorizado para firmas y cierres finales.</p>
                )}
                {formRole === 'SUPER_ADMIN' && (
                  <p className="text-slate-600 mt-0.5 font-bold text-purple-700">Acceso institucional supremo. No formula planes, audita e invoca administración global.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-extrabold text-slate-600 uppercase tracking-wide mb-1">Contraseña Provisional</label>
              <input 
                type="text" 
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                placeholder="Introducir clave provisional"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded focus:border-blue-500 focus:bg-white outline-hidden font-mono"
              />
              <span className="text-[9.5px] text-slate-400 mt-1 block leading-tight">Será debidamente hasheada criptográficamente en el servidor antes de guardarse.</span>
            </div>

            <div className="flex items-center gap-2 pt-1 select-none">
              <input 
                type="checkbox" 
                id="forceResetNew"
                checked={formForceReset}
                onChange={e => setFormForceReset(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="forceResetNew" className="text-xs font-bold text-slate-700 uppercase tracking-tight cursor-pointer">
                Forzar restablecimiento en primer ingreso
              </label>
            </div>

            <button 
              type="submit"
              className="w-full text-xs font-extrabold uppercase bg-[#0058be] hover:bg-blue-800 text-white rounded p-2.5 transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Inyectar Consultor</span>
            </button>
          </form>
        </div>

        {/* User Accounts list */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Usuarios y Consultores Registrados</h2>
            </div>
            <button 
              onClick={fetchUsers} 
              className="p-1 px-2.5 text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Refrescar
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse font-bold uppercase tracking-widest">
              Sincronizando Base de Datos Maestra...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-2">Consultor</th>
                      <th className="py-2">Instrumento / Rol</th>
                      <th className="py-2 text-center">Estado Clave</th>
                      <th className="py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((u) => {
                      const isSuper = u.email === 'aliendredilan@gmail.com';
                      return (
                        <tr key={u.email} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col gap-1 items-start">
                              {getRoleBadge(u.role)}
                              {u.role === 'ESPECIALISTA_PAD' && (
                                <span className="text-[9.5px] font-semibold text-slate-500">Categoría Permitida: <strong>ONLY PAD</strong> (Territorial)</span>
                              )}
                              {u.role === 'ESPECIALISTA_PES' && (
                                <span className="text-[9.5px] font-semibold text-slate-500">Categoría Permitida: <strong>ONLY PES</strong> (Sectorial)</span>
                              )}
                              {u.role === 'REVISOR_SENIOR' && (
                                <span className="text-[9.5px] font-semibold text-slate-500">Categoría Permitida: <strong>PES + PAD (Lectura)</strong></span>
                              )}
                              {u.role === 'SUPER_ADMIN' && (
                                <span className="text-[9.5px] font-semibold text-slate-500">Módulo Administrativo Global</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            {u.force_password_reset ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-orange-50 text-orange-700 border border-orange-200/50 px-2 py-0.5 rounded">
                                <Lock className="w-3 h-3 text-orange-500" /> RESET ADVERTIDO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded">
                                <Unlock className="w-3 h-3 text-emerald-500" /> RESTABLECIDA
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right space-y-1">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Force Reset Button */}
                              <button
                                onClick={() => handleUpdateUser(u.email, u.role, !u.force_password_reset)}
                                title="Alternar requisito de restablecimiento de contraseña obligatorio"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 transition-colors cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Trigger Reset password workflow */}
                              <button
                                onClick={() => {
                                  setEditingEmail(editingEmail === u.email ? null : u.email);
                                  setNewPass('');
                                }}
                                className="text-[10px] font-extrabold uppercase bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
                              >
                                Clave
                              </button>

                              {/* Delete button (hidden for superadmin) */}
                              {!isSuper ? (
                                <button
                                  onClick={() => handleDeleteUser(u.email)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded text-rose-600 transition-colors cursor-pointer"
                                  title="Revocar acceso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="p-1 bg-slate-50 text-slate-300 text-[10px] rounded select-none border border-slate-100 font-extrabold">INMUTABLE</span>
                              )}
                            </div>

                            {editingEmail === u.email && (
                              <div className="bg-slate-50 p-2 rounded border border-slate-200 mt-2 text-left space-y-2 max-w-xs ml-auto">
                                <p className="text-[10px] font-bold text-slate-700 uppercase">Nueva contraseña provisional:</p>
                                <div className="flex gap-1">
                                  <input 
                                    type="text" 
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                    placeholder="Clave nueva..."
                                    className="p-1.5 text-xs bg-white border border-slate-300 rounded font-mono flex-1 outline-hidden"
                                  />
                                  <button
                                    onClick={() => handleUpdateUser(u.email, u.role, u.force_password_reset, newPass)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-1.5 px-2.5 rounded cursor-pointer"
                                  >
                                    Cargar
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function notifyAlerts(error: string, success: string, setError: any, setSuccess: any) {
  if (!error && !success) return null;
  return (
    <div className="space-y-2">
      {error && (
        <div className="p-3.5 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold uppercase text-[10px] tracking-wide">Error del Módulo Administrativo</p>
            <p className="mt-0.5 font-medium">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold px-1 select-none">×</button>
        </div>
      )}
      {success && (
        <div className="p-3.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold uppercase text-[10px] tracking-wide font-sans">Bitácora IAM Actualizada</p>
            <p className="mt-0.5 font-medium">{success}</p>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold px-1 select-none">×</button>
        </div>
      )}
    </div>
  );
}
