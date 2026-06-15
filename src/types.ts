/**
 * Shared types for Sistema de Planificación ACC-RRD (SIPEB)
 */

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;
  state_before: string; // JSON or descriptive string
  state_after: string;  // JSON or descriptive string
  correlation_id: string;
  valores_modificados: string; // JSON representing the precise delta fields
}

export interface ClimateMeasure {
  id: string;
  name: string;
  description: string;
  budget: number;
  type: 'fortalecimiento_tecnico' | 'standard';
  sourceId?: string; // Reference to Paso 2 Source Document
  budget2026?: number;
  budget2027?: number;
  budget2028?: number;
  budget2029?: number;
  budget2030?: number;
}

export interface VulnerabilityState {
  sensitivityLevel: number;
  expertJustification: string;
  expertJustificationVerified: boolean;
  gedsiText: string;
  gedsiTextVerified: boolean;
  locationCrossoverStatus: 'PENDING' | 'RUNNING' | 'COMPLETED';
  cropsAffectedHectares: number;
  populationExpCount: number;
  projectionStandard: string; // must be SIRGAS/WGS84
}

export interface AdaptationCapacityState {
  scores: {
    Financiera: number;
    Tecnica: number;
    Normativa: number;
    Gobernanza: number;
  };
  readinessPct: number;
  inertiaFlagActive: boolean;
}

export interface ClimateRiskState {
  selectedZone: { r: number; c: number } | null;
  matrixFactors: {
    amenaza: number; // A
    sensibilidad: number; // S
    exposicion: number; // E
    capacidad: number; // C
  };
  calculatedRisk: number | null; // (A * S * E) / C
}

export interface PlanState {
  currentStep: number;
  stepsCompleted: { [key: number]: boolean };
  vulnerability: VulnerabilityState;
  adaptationCapacity: AdaptationCapacityState;
  climateRisk: ClimateRiskState;
  measures: ClimateMeasure[];
  isSigned: boolean;
  isSubmitted: boolean;
  signerName: string;
  signerRole: string;
  signerCertificate: string;
  hashVerified: boolean;
  padesHash: string;
  sigepExcelHash: string;
  threatLevel: number; // Paso 3 Threat Level (1 to 5)
  isClosed: boolean;   // Flag de Cierre block for immutability
  planType: 'PES' | 'PAD'; // 'PES' for Case A (Salud), 'PAD' for Case B (Tarija)
  evidenceName: string;
  evidenceStatus: 'PENDING' | 'REJECTED' | 'APPROVED';
  evidenceError: string;
  evidenceHash?: string;
  evidenceTampered?: boolean;
}
