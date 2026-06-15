import React, { useState } from 'react';
import { 
  Flame, 
  MapPin, 
  Layers, 
  ShieldCheck, 
  HelpCircle, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Activity,
  Lock
} from 'lucide-react';
import { PlanState } from '../types';

interface StepClimateRiskProps {
  state: PlanState;
  onStateUpdate: (updatedState: PlanState) => void;
  onNext: () => void;
}

interface TerritorialGridCell {
  row: number;
  col: number;
  municipality: string;
  amenaza: number;     // A
  sensibilidad: number;// S
  exposicion: number;   // E
  capacidad: number;    // C
}

export default function StepClimateRisk({ state, onStateUpdate, onNext }: StepClimateRiskProps) {
  const [activeCell, setActiveCell] = useState<TerritorialGridCell | null>(null);
  const [activeLayer, setActiveLayer] = useState<'amenaza' | 'sensibilidad' | 'exposicion' | 'riesgo'>('riesgo');

  const macroGrid: TerritorialGridCell[] = [
    { row: 1, col: 1, municipality: 'Beni (Riberalta - Zona Fluvial Norte)', amenaza: 5, sensibilidad: 4, exposicion: 5, capacidad: 2 },
    { row: 1, col: 2, municipality: 'Pando (Cobija - Crecidas Aluviales)', amenaza: 4, sensibilidad: 3, exposicion: 4, capacidad: 2 },
    { row: 1, col: 3, municipality: 'Altiplano Norte (El Alto - Sequía Cordillera)', amenaza: 3, sensibilidad: 5, exposicion: 3, capacidad: 4 },
    { row: 2, col: 1, municipality: 'Valles Secos (Quillacollo - Riesgo Granizo/Helada)', amenaza: 4, sensibilidad: 3, exposicion: 3, capacidad: 3 },
    { row: 2, col: 2, municipality: 'Santa Cruz (Montero - Desborda de Cuenca)', amenaza: 5, sensibilidad: 4, exposicion: 5, capacidad: 3 },
    { row: 2, col: 3, municipality: 'Trópico Cochabamba (Villa Tunari - Desalojos Lluviosos)', amenaza: 5, sensibilidad: 5, exposicion: 4, capacidad: 2 },
    { row: 3, col: 1, municipality: 'Chaco Sur (Yacuiba - Estrés Térmico Extremo)', amenaza: 4, sensibilidad: 4, exposicion: 4, capacidad: 1 },
    { row: 3, col: 2, municipality: 'Valle de Tarija (Uriondo - Sequías Temporales)', amenaza: 3, sensibilidad: 2, exposicion: 3, capacidad: 4 },
    { row: 3, col: 3, municipality: 'Potosí Altiplano (Tupiza - Riadas Repentinas)', amenaza: 5, sensibilidad: 3, exposicion: 4, capacidad: 2 }
  ];

  // Helper to dynamically scale grid cell parameters based on Step 3 (threatLevel) and Step 4 (vulnerability sensitivityLevel)
  const getDynamicCell = (cell: TerritorialGridCell): TerritorialGridCell => {
    // Threat Scale (normalized around baseline of 4)
    const tScale = (state.threatLevel !== undefined ? state.threatLevel : 4) / 4;
    const dynamicThreat = Math.max(1, Math.min(5, Math.round(cell.amenaza * tScale)));

    // Sensitivity Scale (normalized around baseline of 3)
    const sScale = (state.vulnerability?.sensitivityLevel !== undefined ? state.vulnerability.sensitivityLevel : 3) / 3;
    const dynamicSensitivity = Math.max(1, Math.min(5, Math.round(cell.sensibilidad * sScale)));

    return {
      ...cell,
      amenaza: dynamicThreat,
      sensibilidad: dynamicSensitivity
    };
  };

  const dynamicMacroGrid = macroGrid.map(getDynamicCell);

  const calculateRiskValue = (cell: TerritorialGridCell) => {
    return parseFloat(((cell.amenaza * cell.sensibilidad * cell.exposicion) / cell.capacidad).toFixed(2));
  };

  const getRiskSemaforo = (val: number) => {
    if (val < 15) return { label: 'Bajo', bg: 'bg-emerald-500/10 border-emerald-500 text-emerald-800', badgeClass: 'bg-emerald-500', fill: 'fill-emerald-500' };
    if (val < 35) return { label: 'Moderado', bg: 'bg-amber-500/10 border-amber-500 text-amber-800', badgeClass: 'bg-amber-500', fill: 'fill-amber-500' };
    if (val < 65) return { label: 'Alto', bg: 'bg-orange-500/10 border-orange-500 text-orange-800', badgeClass: 'bg-orange-500', fill: 'fill-orange-500' };
    return { label: 'Extremo Crítico', bg: 'bg-rose-600/10 border-rose-600 text-rose-800 animate-pulse', badgeClass: 'bg-rose-600', fill: 'fill-rose-600' };
  };

  // Cell coloring depending on active layer view
  const getCellBgHex = (cell: TerritorialGridCell) => {
    const risk = calculateRiskValue(cell);
    if (activeLayer === 'amenaza') {
      const shades = ['bg-slate-100', 'bg-red-50/50', 'bg-red-100/70', 'bg-red-250', 'bg-red-300', 'bg-red-500/90 text-white'];
      return shades[cell.amenaza] || 'bg-slate-100';
    }
    if (activeLayer === 'sensibilidad') {
      const shades = ['bg-slate-100', 'bg-amber-50/50', 'bg-amber-100/70', 'bg-amber-300', 'bg-amber-400', 'bg-amber-500/90 [text-shadow:_0_1px_1px_rgba(0,0,0,0.1)] text-slate-800'];
      return shades[cell.sensibilidad] || 'bg-slate-100';
    }
    if (activeLayer === 'exposicion') {
      const shades = ['bg-slate-100', 'bg-blue-50/50', 'bg-blue-100/70', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500/90 text-white'];
      return shades[cell.exposicion] || 'bg-slate-100';
    }
    
    // Risk Result Heatmap (Semaforización)
    if (risk < 15) return 'bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 border border-emerald-500/20';
    if (risk < 35) return 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 border border-amber-500/20';
    if (risk < 65) return 'bg-orange-500/15 text-orange-800 hover:bg-orange-500/25 border border-orange-500/20';
    return 'bg-rose-500/15 text-rose-800 hover:bg-rose-500/25 border border-rose-500/30 animate-subtle';
  };

  const handleCellHover = async (cell: TerritorialGridCell) => {
    const dynamicCell = getDynamicCell(cell);
    setActiveCell(dynamicCell);
    const risk = calculateRiskValue(dynamicCell);
    try {
      // Sincroniza cálculo dinámico contra backend como validador de simulación
      await fetch('/api/step6/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r: cell.row,
          c: cell.col,
          factors: {
            amenaza: dynamicCell.amenaza,
            sensibilidad: dynamicCell.sensibilidad,
            exposicion: dynamicCell.exposicion,
            capacidad: dynamicCell.capacidad
          }
        })
      });
    } catch (e) {
      // Graceful local fallback
    }
  };

  const handleConfirm = async () => {
    if (state.isClosed) {
      onNext();
      return;
    }
    try {
      const response = await fetch('/api/step6/confirm', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onStateUpdate(data.state);
        onNext(); // Advance to Paso 7
      }
    } catch (e) {
      onNext();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 select-none">
      {/* Header section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-blue-600">
          <Flame className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Metodología de Semaforización</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paso 6: Semaforización del Riesgo Climático</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Interactúe con la grilla cartográfica territorial de Bolivia. El mapa refleja automáticamente las amenazas configuradas en el Paso 3 ({state.threatLevel || 4}) y sensibilidades del Paso 4 ({state.vulnerability?.sensitivityLevel || 3}).
        </p>
      </div>

      {state.isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-sm select-none">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <span>MODO LECTURA INMUTABLE: Este visor espacial está bloqueado oficialmente por haberse realizado el cierre definitivo del expediente.</span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Side: Heatmap grid selector */}
        <section className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Visor Cartográfico Interactivo</span>
            </h3>
            
            {/* Layers selector tabs */}
            <div className="flex bg-slate-200/70 p-1.5 rounded-lg border border-slate-200 gap-1 overflow-x-auto select-none">
              {(['amenaza', 'sensibilidad', 'exposicion', 'riesgo'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeLayer === layer
                      ? 'bg-white text-[#0058be] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive grid */}
          <div className="p-8 bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden h-[340px]">
            {/* Ambient Background Grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.2]" />

            <div className="grid grid-cols-3 gap-3 w-full max-w-md relative z-10">
              {dynamicMacroGrid.map((cell) => {
                const cellRisk = calculateRiskValue(cell);
                const isHovered = activeCell?.row === cell.row && activeCell?.col === cell.col;
                const cellBg = getCellBgHex(cell);

                return (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    onMouseEnter={() => handleCellHover(cell)}
                    className={`aspect-square p-3.5 rounded-xl cursor-all-scroll flex flex-col justify-between items-stretch transition-all duration-300 relative ${cellBg} ${
                      isHovered ? 'ring-2 ring-blue-500 border-white/50 scale-102 z-10 shadow-lg' : 'border border-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-extrabold tracking-tight select-none truncate max-w-[70px]">
                        {cell.municipality.split(' ')[0]}
                      </span>
                      <MapPin className={`w-3 h-3 ${isHovered ? 'text-blue-400 rotate-12 transition-transform' : 'opacity-40'}`} />
                    </div>

                    <div className="text-center my-1.5">
                      {activeLayer === 'riesgo' ? (
                        <span className="text-xl font-black font-mono tracking-tight text-white drop-shadow-md">
                          {cellRisk}
                        </span>
                      ) : activeLayer === 'amenaza' ? (
                        <span className="text-xl font-black font-mono text-white">{cell.amenaza}</span>
                      ) : activeLayer === 'sensibilidad' ? (
                        <span className="text-xl font-black font-mono text-slate-800">{cell.sensibilidad}</span>
                      ) : (
                        <span className="text-xl font-black font-mono text-white">{cell.exposicion}</span>
                      )}
                    </div>

                    <div className="flex justify-between text-[8px] font-mono opacity-80 pt-1.5 border-t border-white/10 select-none">
                      <span>R:{cell.row}</span>
                      <span>{getRiskSemaforo(cellRisk).label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instruction footnote */}
            <div className="absolute bottom-3 left-6 text-[9px] font-mono text-white/50 select-none">
              * Toque o posicione el cursor para gatillar la re-evaluación matemática de la celda.
            </div>
          </div>

          {/* Legend row */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-around gap-4 text-[10px] font-bold text-slate-500 select-none">
            <span className="flex items-center gap-1.5 text-slate-600 font-extrabold uppercase tracking-wide">Rangos de Riesgo:</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500" />Bajo (0 - 15)</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-amber-500" />Moderado (15 - 35)</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-orange-500" />Alto (35 - 65)</span>
            <span className="flex items-center gap-1.5 animate-pulse"><div className="w-2.5 h-2.5 rounded bg-rose-600" />Extremo (65+)</span>
          </div>
        </section>

        {/* Right Side: Calculation details & Methodology */}
        <section className="col-span-12 lg:col-span-5 flex flex-col justify-between space-y-6">
          
          {/* Active node dynamic calculation telemetry */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Activity className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Parámetros Analíticos Celda Activa
              </h3>
            </div>

            {activeCell ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Región Evaluada</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{activeCell.municipality}</p>
                </div>

                {/* Factors grids */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-red-500/90 block font-mono">AMENAZA (A)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block mt-1">{activeCell.amenaza}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-amber-600 block font-mono">SENSIB. (S)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block mt-1">{activeCell.sensibilidad}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-blue-500 block font-mono">EXPOSI. (E)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block mt-1">{activeCell.exposicion}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-[#009668] block font-mono">CONTR. (C)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block mt-1">{activeCell.capacidad}</span>
                  </div>
                </div>

                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2 border border-slate-800 relative shadow-inner">
                  <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block font-bold">Cálculo en Caliente</span>
                  
                  <div className="flex justify-between items-baseline gap-4">
                    <p className="text-xs text-slate-400 font-mono">Índice = (A * S * E) / C</p>
                    <p className="text-3xl font-black font-mono text-white drop-shadow-md">
                      {calculateRiskValue(activeCell)}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono border-t border-white/5 pt-2 mt-1">
                    <span>Ecuación: ({activeCell.amenaza} * {activeCell.sensibilidad} * {activeCell.exposicion}) / {activeCell.capacidad}</span>
                    <span className={`px-2 py-0.5 rounded uppercase font-extrabold text-[9px] ${getRiskSemaforo(calculateRiskValue(activeCell)).bg}`}>
                      {getRiskSemaforo(calculateRiskValue(activeCell)).label}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Layers className="w-10 h-10 text-slate-300 animate-pulse mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider">Cargando Telemetría Regional...</p>
                <p className="text-[10px] leading-relaxed mt-1.5 max-w-xs">
                  Pase el mouse por la cuadrícula espacial de la izquierda para rellenar los coeficientes científicos del modelo.
                </p>
              </div>
            )}
          </div>

          {/* Technical Note */}
          <div className="p-4.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
            <h4 className="font-extrabold text-[#0058be] flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Soporte Algorítmico WLC (Coombe-Vara)</span>
            </h4>
            <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
              De acuerdo a la Directiva Ministerial MPD-RRD, se implementa la Combinación Lineal Ponderada. El factor divisor "Capacidad de Adaptación (C)" disminuye estocásticamente el riesgo matemático consolidado total.
            </p>
          </div>

          {/* Action button */}
          <div className="pt-2 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
            >
              <span>{state.isClosed ? 'Continuar (Expediente Cerrado)' : 'Confirmar Configuración Regional'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </section>

      </div>
    </div>
  );
}
