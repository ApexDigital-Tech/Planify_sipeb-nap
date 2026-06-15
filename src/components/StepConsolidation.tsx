import React, { useState } from 'react';
import { 
  Fingerprint, 
  FileText, 
  FileSpreadsheet, 
  ShieldCheck, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Loader2,
  Mail,
  Send,
  Lock,
  Unlock
} from 'lucide-react';
import { PlanState } from '../types';

interface StepConsolidationProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  correlationId: string;
  userRole?: string;
}

export default function StepConsolidation({ state, onStateUpdate, correlationId, userRole }: StepConsolidationProps) {
  // Document draft content initialized to standard draft
  const defaultDraftText = `MINISTERIO DE PLANIFICACIÓN DEL DESARROLLO - BOLIVIA
EXPEDIENTE DE CONSOLIDACIÓN TÉCNICA - SIPEB 2026-2030
============================================================
Estándar Cartográfico Geodésico: SIRGAS / WGS84
Estado de Validación: APROBADO
Justificación GEDSI: Aprobada de acuerdo a Criterio de Inclusión Social
Resumen de Vulnerabilidad: Nivel de riesgo hidrológico estocástico certificado`;

  const [documentContent, setDocumentContent] = useState(defaultDraftText);
  const [isVerifyingHash, setIsVerifyingHash] = useState(false);
  const [hashResult, setHashResult] = useState<{ success: boolean; hash: string; msg: string; errMsg?: string } | null>(null);

  // Signing & Submission State
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const [signatureSuccess, setSignatureSuccess] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const isBlockedByInercia = state.adaptationCapacity.inertiaFlagActive;

  const handleVerifyHash = async () => {
    setIsVerifyingHash(true);
    setHashResult(null);
    try {
      const response = await fetch('/api/step8/verify-document-integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          documentType: 'PDF',
          content: documentContent
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setHashResult({
          success: true,
          hash: data.actualHash,
          msg: "✓ INTEGRIDAD VERIFICADA: El archivo coincide perfectamente con la firma PAdES oficial. Ninguna alteración semántica detectada en servidores."
        });
      } else {
        setHashResult({
          success: false,
          hash: data.actualHash || 'Calculando...',
          errMsg: data.error || 'Error de validación hash.'
        } as any);
      }
    } catch (e: any) {
      setHashResult({
        success: false,
        hash: 'Error de red',
        errMsg: 'Fallo al comunicar con el Hasher del Ministerio.'
      } as any);
    } finally {
      setIsVerifyingHash(false);
    }
  };

  const handleSignDocument = async () => {
    setIsSigning(true);
    setSignatureError('');
    setSignatureSuccess('');
    try {
      const response = await fetch('/api/step8/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onStateUpdate(data.state);
        setSignatureSuccess('✓ FIRMA ELECTRÓNICA IMPRESA: El token Agetic del Arq. Marcelo Arce fue validado de forma cronológica por el hardware criptográfico estatal.');
      } else {
        setSignatureError(data.error || 'Falla de validación al firmar.');
      }
    } catch (e: any) {
      setSignatureError('Ocurrió un error al intentar firmar el expediente.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleSubmitOfficial = async () => {
    setIsSubmitting(true);
    setSignatureError('');
    try {
      const response = await fetch('/api/plan/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onStateUpdate(data.state);
        setTrackingCode(data.trackingCode);
      } else {
        setSignatureError(data.error || 'Falla al procesar el envío ministerial.');
      }
    } catch (e: any) {
      setSignatureError('Error de red al registrar el expediente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 select-none">
      
      {/* Header section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-blue-600">
          <Fingerprint className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Mesa de Consolidación Ministerial</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paso 8: Firma e Institucionalidad del Expediente</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Complete los resguardos de auditoría del plan SIPEB 2026-2030. Estampe la firma digital respaldada por tokens de Agetic y exporte los formatos oficiales SIGEP.
        </p>
      </div>

      {signatureError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 text-xs font-semibold shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p>{signatureError}</p>
        </div>
      )}

      {signatureSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p>{signatureSuccess}</p>
        </div>
      )}

      {/* Main Layout Rows */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: SHA-256 Hashing Validator */}
        <section className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-blue-600" />
                <span>Validación de Hashing Instrumental (PAdES PDF)</span>
              </h3>
              <span className="text-[9px] bg-blue-105 border border-blue-200 text-blue-700 font-mono px-2 py-0.5 rounded uppercase font-extrabold">
                Algorítmo: SHA-256
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-normal mb-3">
              Modifique deliberadamente el borrador oficial en el editor inferior para simular sabotaje documental. El sistema re-calculará la firma digital y reportará inmediatamente la violación de integridad.
            </p>

            <textarea
              value={documentContent}
              onChange={(e) => {
                setDocumentContent(e.target.value);
                setHashResult(null);
              }}
              rows={7}
              className="w-full text-xs font-mono p-3 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:ring-1 focus:ring-blue-500 leading-relaxed overflow-y-auto"
            />
          </div>

          <div className="space-y-4">
            {/* Hash diagnostic status box */}
            {hashResult && (
              <div className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
                hashResult.success 
                  ? 'bg-emerald-50 border-emerald-350 text-emerald-900' 
                  : 'bg-rose-50 border-rose-350 text-rose-900 animate-shake'
              }`}>
                {hashResult.success ? (
                  <div>
                    <p className="font-extrabold">{hashResult.msg}</p>
                    <p className="font-mono text-[10px] mt-2 bg-emerald-100/50 p-2 border border-emerald-250 rounded font-semibold break-all text-emerald-800/80">
                      Calculado: {hashResult.hash}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-extrabold uppercase tracking-widest text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4.5 h-4.5" />
                      <span>SABOTAJE O PÉRDIDA DE INTEGRIDAD IDENTIFICADA</span>
                    </p>
                    <p className="font-bold mt-1 text-rose-950 leading-relaxed font-semibold">{hashResult.errMsg}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 font-mono text-[9px]">
                      <div className="p-2 border border-rose-200/50 bg-rose-100/30 rounded">
                        <span className="text-rose-500 font-extrabold block uppercase mb-1">Hash Registrado (Esperado)</span>
                        <span className="break-all text-rose-900 font-black">{state.padesHash}</span>
                      </div>
                      <div className="p-2 border border-rose-200/50 bg-rose-100/30 rounded">
                        <span className="text-rose-500 font-extrabold block uppercase mb-1">Hash Calculado (Real)</span>
                        <span className="break-all text-rose-900 font-black">{hashResult.hash}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                * PDF Oficial Signature Hash: {state.padesHash.substring(0, 16)}...
              </span>
              <button
                onClick={handleVerifyHash}
                disabled={isVerifyingHash}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-md active:scale-98"
              >
                {isVerifyingHash && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>Verificar Integridad SHA-250</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Interactive signing & export files */}
        <section className="col-span-12 lg:col-span-5 space-y-6 flex flex-col justify-between">
          
          {/* Downloads Group */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Formatos de Reportabilidad Oficial (Consolidación)
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-tight">
              Exporte las plantillas multianuales certificadas que exige el SPIE/SIGEP del MPDyMA:
            </p>

            <div className="space-y-2">
              <a 
                href="/api/export/excel" 
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Matriz SIGEP Plurianual (.csv)</h4>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">SHA: {state.sigepExcelHash.substring(0,12)}...</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </a>

              <a 
                href="/api/export/word" 
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Informe Técnico Consolidado (.txt)</h4>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">Estándar: MPDyMA Docx Compatible</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Secure Signing Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-250">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                {state.isSigned ? <Lock className="w-4 h-4 text-emerald-600" /> : <Unlock className="w-4 h-4 text-amber-500 animate-pulse" />}
                <span>Bloqueo Criptográfico Agetic</span>
              </h3>
              
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-extrabold ${state.isSigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>
                {state.isSigned ? 'FIRMADO' : 'PENDIENTE'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Estampe los certificados digitales del planificador estatal en el expediente. Si se detecta una inercia institucional latente en el Paso 5 o si posee credenciales de rol insuficiente para firmas gubernamentales AGETIC, el sistema no autorizará la firma.
            </p>

            {userRole && userRole !== 'SUPER_ADMIN' && userRole !== 'REVISOR_SENIOR' && (
              <div className="p-3 bg-rose-55 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold uppercase text-[9px] tracking-wider text-rose-700">Restricción de Perfil Autorizado</p>
                  <p>Su rol actual es "<strong>{userRole}</strong>". De acuerdo al régimen de firmas del SPIE y la GIZ, la firma del expediente consolidado está restringida exclusivamente a los roles de <strong>SUPER_ADMIN (Propietario / MPDyMA)</strong> o <strong>REVISOR_SENIOR (Coordinador GIZ)</strong>.</p>
                </div>
              </div>
            )}

            {state.isSigned ? (
              <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl flex flex-col gap-1 text-[11.5px] leading-relaxed">
                <p className="font-extrabold uppercase tracking-wide text-xs">Certificado Estampado de Forma Exitosa</p>
                <p><strong className="font-bold">Firmante:</strong> {state.signerName} ({state.signerRole})</p>
                <p><strong className="font-bold">Token:</strong> Agetica Autoridad Certificadora Regional V3</p>
              </div>
            ) : (
              <button
                onClick={handleSignDocument}
                disabled={isSigning}
                className="w-full py-2.5 bg-[#0058be] hover:bg-[#002f82] text-white font-black text-xs rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-98 transition-colors cursor-pointer"
              >
                {isSigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Estampando Criptografía Agetica...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4.5 h-4.5" />
                    <span>Firmar Expediente con Token Agetic</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Submit official dossier card */}
          {state.isSigned && (
            <div className="p-4 bg-blue-105 border border-blue-200 text-blue-900 rounded-xl space-y-3 shadow-md animate-fade-in select-none">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#0058be]">Vía Libre Ministerial</h3>
              <p className="text-[11px] text-blue-850 leading-relaxed font-semibold">
                ¡El expediente cumplió con todos los filtros de validación de integridad (WGS84, GEDSI, Presupuestación Sin Vacíos, No Inercia y Hashing SHA-256)! Está listo para guardarse en el banco de proyectos autorizado para Construcción SIPEB.
              </p>

              {state.isSubmitted ? (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 text-[11px] font-mono leading-relaxed select-none">
                  <p className="font-extrabold uppercase text-xs">✓ EXPEDIENTE ENVIADO AL MINISTERIO</p>
                  <p className="mt-1 font-bold">Código de Seguimiento: {trackingCode}</p>
                  <p className="mt-0.5">¡Aprobado para Construcción Exclusivamente en SIPEB!</p>
                </div>
              ) : (
                <button
                  onClick={handleSubmitOfficial}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Almacenando en Colección auditoria_negocio...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Finalizar y Enviar a MPDyMA</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

        </section>

      </div>
    </div>
  );
}
