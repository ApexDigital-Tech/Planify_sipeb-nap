import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  MessageSquare, 
  Sparkles, 
  HelpCircle,
  BrainCircuit,
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { PlanState } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PlanningAssistantProps {
  state: PlanState;
  correlationId: string;
}

export default function PlanningAssistant({ state, correlationId }: PlanningAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Estimado Arq. Marcelo, soy el chatbot asesor técnico ministerial para el Sistema de Planificación ACC-RRD. Le asisto con la Ley N° 777 (SPIE), el estándar cartográfico SIRGAS/WGS84, y el control de inercia institucional. ¿Qué dudas técnicas del SIPEB desea resolver hoy?'
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Model Selector
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput('');
    
    // Append user message immediately
    const updatedMessages = [...messages, { role: 'user' as const, content: userText }];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      // Gather runtime context to inject into user message or backend endpoint
      // This context represents the whole plan state, allowing the AI to guide the user perfectly.
      const stateSummary = `[CONTEXTO DE PLANIFICACIÓN EN CALIENTE - SIPEB:
- Paso Activo: ${state.currentStep}
- Cruce Cartográfico Geolocalizado: ${state.vulnerability.locationCrossoverStatus === 'COMPLETED' ? 'SIRGAS/WGS84 OK' : 'PENDIENTE'}
- Sensibilidad Vulnerabilidad: Nivel ${state.vulnerability.sensitivityLevel}
- Justificación Experta: "${state.vulnerability.expertJustification || 'Vacía'}"
- Justificación Inclusión GEDSI: "${state.vulnerability.gedsiText || 'Vacía'}" (Largo: ${state.vulnerability.gedsiText.length} chars)
- Capacidad Adaptación (Scores): Financiera=${state.adaptationCapacity.scores.Financiera}, Técnica=${state.adaptationCapacity.scores.Tecnica}, Normativa=${state.adaptationCapacity.scores.Normativa}, Gobernanza=${state.adaptationCapacity.scores.Gobernanza}
- Resiliencia Preparación: ${state.adaptationCapacity.readinessPct}%
- Bloqueo por Inercia Institucional: ${state.adaptationCapacity.inertiaFlagActive ? 'ACTIVO (Requiere Medida de Fortalecimiento Técnico con Presupuesto)' : 'RESOLVILDO/INACTIVO'}
- Medidas Registradas: ${state.measures.length} medidas. Presupuesto Total: BOB ${state.measures.reduce((acc, m) => acc + m.budget, 0).toLocaleString()}
- Consolidación de Firma Digital: ${state.isSigned ? 'FIRMADO CON TOKEN AGETIC' : 'PENDIENTE'}]`;

      // Prepend context to the last prompt or API call so server understands it:
      const payloadMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: `${stateSummary}\n\nConsulta del Planificador Marcelo Arce:\n${userText}` }
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        },
        body: JSON.stringify({
          messages: payloadMessages,
          model: selectedModel
        })
      });

      const data = await response.json();
      
      setIsTyping(false);

      if (response.ok && data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: `⚠️ Disculpas, se ha reportado un problema al interconectar con los modelos de IA de Google Studio: ${data.error || 'Clave de API ausente.'}` 
          }
        ]);
      }

    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Error de red: No se pudo contactar al asistente ministerial.' 
        }
      ]);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat limpio. ¿Qué consulta o asistencia requiere sobre el SIPEB?'
      }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Expanded assistant panel */}
      {isOpen && (
        <div className="w-[380px] h-[520px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 animate-fade-in-up">
          
          {/* Header */}
          <div className="bg-[#131b2e] text-white p-4 flex justify-between items-center select-none">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-xs font-black tracking-tight">Gabinete de Asistencia AI-SIPEB</h3>
                <span className="text-[9px] text-[#2170e4] uppercase font-bold font-mono tracking-widest block">
                  Planificador Virtual
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Model bar */}
          <div className="bg-slate-50 border-b border-slate-150 px-3 py-2 flex items-center justify-between gap-4 select-none">
            <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1 font-mono">
              <BrainCircuit className="w-3.5 h-3.5 text-blue-600" />
              Modelo activo:
            </span>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as any)}
              className="text-[10px] font-bold text-slate-600 border border-slate-200 rounded py-1 px-2 bg-white cursor-pointer"
            >
              <option value="gemini-3.5-flash">gemini-3.5-flash (General)</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro (Complejas)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Rápido)</option>
            </select>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-2.5 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 border select-none ${
                  msg.role === 'user' 
                    ? 'bg-blue-50 border-blue-200 text-blue-650' 
                    : 'bg-[#131b2e] border-white/5 text-white'
                }`}>
                  {msg.role === 'user' ? 'MA' : <Sparkles className="w-3.5 h-3.5" />}
                </div>

                <div className={`p-3 rounded-2xl text-[11.5px] leading-relaxed font-medium ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                }`}>
                  {/* Clean layout text rendering */}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2.5 max-w-[80%] items-center mr-auto">
                <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center border bg-[#131b2e] border-white/5 text-white select-none">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-white border border-slate-150 p-2.5 px-4 rounded-full text-[11px] text-slate-400 font-bold tracking-wide italic">
                  Escribiendo análisis del plan...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input field */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-150 bg-white flex gap-2 select-none">
            <button
              type="button"
              onClick={clearChat}
              className="p-2 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Borrar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <input
              type="text"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="¿Qué pasa con la inercia institucional?"
              className="flex-1 text-xs border border-slate-200 rounded-lg py-2 px-3 text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <button
              type="submit"
              disabled={isTyping}
              className="p-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}

      {/* Floating launcher button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-sm group cursor-pointer border border-blue-500"
        title="Consultar al Asistente Técnico AI-SIPEB"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-emerald-450 rounded-full animate-bounce" />
          </div>
        )}
      </button>

    </div>
  );
}
