import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  UploadCloud, 
  Link2, 
  Trash2, 
  Edit, 
  Plus, 
  FileText, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileCode,
  Globe
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: 'direct_upload' | 'drive_link' | 'local_reference';
  url: string;
  gemini_file_uri?: string;
  created_at: string;
}

export default function SourceManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'direct_upload' | 'drive_link'>('direct_upload');
  const [formUrl, setFormUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sources');
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
      } else {
        setError(data.error || 'No se pudo obtener la lista de fuentes.');
      }
    } catch (e) {
      setError('Error al comunicar con la API de fuentes de SIPEB.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);
      // Auto-fill name if empty
      if (!formName) {
        // Strip extension
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setFormName(cleanName);
      }
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formName) {
      setError('El nombre de la fuente es obligatorio.');
      return;
    }

    if (formType === 'drive_link' && !formUrl) {
      setError('El enlace de Google Drive es obligatorio.');
      return;
    }

    if (formType === 'direct_upload' && !uploadFile) {
      setError('Debe seleccionar un archivo para realizar la subida.');
      return;
    }

    setSubmitting(true);

    try {
      let payload: any = {
        name: formName,
        type: formType,
      };

      if (formType === 'drive_link') {
        payload.url = formUrl;
      } else if (formType === 'direct_upload' && uploadFile) {
        // Convert file to Base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data:*/*;base64, prefix
            const base64 = result.substring(result.indexOf(',') + 1);
            resolve(base64);
          };
          reader.onerror = (err) => reject(err);
        });
        reader.readAsDataURL(uploadFile);
        
        const base64Data = await base64Promise;
        payload.base64Data = base64Data;
        payload.filename = uploadFile.name;
      }

      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Fuente "${formName}" agregada e indexada exitosamente para consultas de IA.`);
        setFormName('');
        setFormUrl('');
        setUploadFile(null);
        // Clear file input manually
        const fileInput = document.getElementById('source-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        fetchSources();
      } else {
        setError(data.error || 'Error al agregar la fuente.');
      }
    } catch (e) {
      setError('Falla de red o comunicación con el servidor SIPEB.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSource = async (id: string) => {
    setError('');
    setSuccess('');

    if (!editName) {
      setError('El nombre no puede estar vacío.');
      return;
    }

    try {
      const res = await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName,
          url: editUrl
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Fuente actualizada exitosamente.');
        setEditingId(null);
        fetchSources();
      } else {
        setError(data.error || 'No se pudo actualizar la fuente.');
      }
    } catch (e) {
      setError('Error al enviar actualización al backend.');
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la fuente "${name}"? El asistente ya no podrá consultar esta información.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/sources/${id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`La fuente "${name}" ha sido eliminada y desvinculada del API de Gemini.`);
        fetchSources();
      } else {
        setError(data.error || 'No se pudo eliminar la fuente.');
      }
    } catch (e) {
      setError('Error de comunicación al eliminar la fuente.');
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'direct_upload':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'drive_link':
        return <Link2 className="w-4 h-4 text-[#00a86b]" />;
      case 'local_reference':
        return <Globe className="w-4 h-4 text-purple-600 animate-pulse" />;
      default:
        return <FileCode className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSourceBadge = (type: string) => {
    switch (type) {
      case 'direct_upload':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Subida Directa</span>;
      case 'drive_link':
        return <span className="bg-[#e6f7ed] text-[#00875a] border border-[#b2e5c9] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Google Drive</span>;
      case 'local_reference':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Referencia Global</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 select-none font-sans" id="source-manager-section">
      
      {/* Notifications bar */}
      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div className="p-3.5 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded-xl flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold uppercase text-[10px] tracking-wide">Error en Fuentes</p>
                <p className="mt-0.5 font-semibold">{error}</p>
              </div>
              <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold px-1 cursor-pointer">×</button>
            </div>
          )}
          {success && (
            <div className="p-3.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-xl flex items-start gap-2.5 shadow-2xs">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold uppercase text-[10px] tracking-wide">Base de Conocimiento Actualizada</p>
                <p className="mt-0.5 font-semibold">{success}</p>
              </div>
              <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold px-1 cursor-pointer">×</button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Registration Form */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UploadCloud className="w-5 h-5 text-blue-700" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Agregar Nueva Fuente</h3>
          </div>

          <form onSubmit={handleCreateSource} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Nombre Descriptivo</label>
              <input 
                type="text" 
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ej. Normas de Inversión Climática PDES"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 focus:bg-white outline-hidden rounded-xl font-semibold transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Tipo de Recurso</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setFormType('direct_upload'); setError(''); }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formType === 'direct_upload'
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Subir PDF/Texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFormType('drive_link'); setError(''); }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formType === 'drive_link'
                      ? 'bg-emerald-50 border-emerald-450 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Enlace de Drive</span>
                </button>
              </div>
            </div>

            {formType === 'direct_upload' ? (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Seleccionar Documento (.pdf, .txt)</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors relative">
                  <input 
                    type="file" 
                    id="source-file-input"
                    accept=".pdf,.txt,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-[11px] font-extrabold text-slate-600">
                    {uploadFile ? uploadFile.name : 'Selecciona o arrastra el archivo'}
                  </p>
                  <p className="text-[9px] text-slate-450 mt-1">Soporta PDF, TXT o DOCX hasta 10MB</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">URL Enlace de Google Drive</label>
                <input 
                  type="url" 
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-500 focus:bg-white outline-hidden rounded-xl font-semibold transition-all"
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={submitting}
              className="w-full text-xs font-black uppercase bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl p-2.5 shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando en Gemini Files...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Añadir Fuente</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing sources list */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Fuentes de Consulta Activas</h3>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 rounded-md p-1 px-2.5 text-slate-500 font-mono font-bold">
              Total: {sources.length}
            </span>
          </div>

          {loading ? (
            <div className="py-24 text-center text-xs text-slate-400 animate-pulse font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>Sincronizando Base de Conocimiento...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-550 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider">
                      <th className="p-3 pl-4">Nombre / Origen</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Estado / Sincronía</th>
                      <th className="p-3 text-right pr-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                          No se han configurado fuentes de consulta personalizadas todavía.
                        </td>
                      </tr>
                    ) : (
                      sources.map((s) => {
                        const isEditing = editingId === s.id;
                        const isGlobal = s.type === 'local_reference';
                        
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 pl-4">
                              {isEditing ? (
                                <div className="space-y-2 max-w-xs">
                                  <input 
                                    type="text" 
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="p-1.5 text-xs bg-white border border-slate-350 rounded-lg outline-hidden w-full font-semibold"
                                  />
                                  {s.type === 'drive_link' && (
                                    <input 
                                      type="url" 
                                      value={editUrl}
                                      onChange={e => setEditUrl(e.target.value)}
                                      className="p-1.5 text-xs bg-white border border-slate-350 rounded-lg outline-hidden w-full font-mono"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg shrink-0">
                                    {getSourceIcon(s.type)}
                                  </div>
                                  <div>
                                    <p className="font-extrabold text-slate-850">{s.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">{s.url}</p>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {getSourceBadge(s.type)}
                            </td>
                            <td className="p-3">
                              {s.type === 'drive_link' ? (
                                <span className="text-[9.5px] font-bold text-slate-500">Mapeado en Prompt</span>
                              ) : s.gemini_file_uri ? (
                                <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/50 p-1 px-2 rounded-md">
                                  Sincronizado
                                </span>
                              ) : (
                                <span className="text-[9.5px] font-extrabold text-slate-500 bg-slate-100 border border-slate-200 p-1 px-2 rounded-md">
                                  Fuera de línea / Local
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right pr-4">
                              <div className="flex justify-end gap-1.5 items-center">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateSource(s.id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-3xs"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-600 rounded-lg text-[10px] font-semibold cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Action links */}
                                    {s.type === 'drive_link' && (
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
                                        title="Abrir enlace de Drive"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    {s.type === 'direct_upload' && (
                                      <a
                                        href={s.url}
                                        download
                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
                                        title="Descargar archivo local"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}

                                    {/* Edit / Delete buttons (hidden for read-only global references) */}
                                    {!isGlobal && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingId(s.id);
                                            setEditName(s.name);
                                            setEditUrl(s.url);
                                          }}
                                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg cursor-pointer"
                                          title="Editar fuente"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSource(s.id, s.name)}
                                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-350 rounded-lg text-rose-600 transition-colors cursor-pointer"
                                          title="Eliminar fuente"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </>
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
          )}
        </div>

      </div>
    </div>
  );
}
