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

/**
 * 8 operative states for the geodesic intersection module.
 * Replaces the previous binary PENDING/COMPLETED system.
 * PENDING, RUNNING, COMPLETED kept for backward DB compatibility.
 */
export type GeodesicStatus =
  | 'SIN_CAPA_BASE_CARGADA'        // No base layer uploaded for this instrument
  | 'SIN_CAPA_DE_AMENAZA_CARGADA'  // Hazard layer missing
  | 'GEOMETRIA_INVALIDA'           // Uploaded geometry failed topology validation
  | 'EN_PROCESAMIENTO'             // ST_Intersection actively running
  | 'PROCESADO_CON_RESULTADO'      // Intersection successful with spatial overlap
  | 'PROCESADO_SIN_INTERSECCION'   // Layers valid but no spatial overlap found
  | 'ERROR_DE_PROYECCION'          // SRID/EPSG incompatibility detected
  | 'REQUIERE_REVISION_TECNICA'    // PostGIS error or data quality issue
  // Legacy compatibility — maps to SIN_CAPA_BASE_CARGADA in UI
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED';

/** Risk classification by coverage percentage thresholds */
export type NivelRiesgoGeo = 'BAJO' | 'MODERADO' | 'ALTO' | 'CRÍTICO';

/** Full geodesic intersection result stored per instrument */
export interface GeodesicResult {
  capaAmenazaId: string;
  capaExposicionId: string;
  intersectionGeoJSON: string;         // GeoJSON string of intersection geometry
  areaInterseccionKm2: number;
  areaExposicionKm2: number;
  porcentajeAfectacion: number;
  nivelRiesgo: NivelRiesgoGeo;
  metricas: Record<string, string>;    // Key-value indicator display
  capaNombre: string;                  // Source hazard layer name
  capaFuente: string;                  // Data source attribution
  capaFecha: string;                   // Layer update date
  srid: string;                        // e.g. "EPSG:4326 (SIRGAS-WGS84)"
  ejecutadoEn: string;                 // ISO timestamp
  ejecutadoPor: string;                // User email
  corrId: string;
}

/** Uploaded geographic layer record */
export interface CapaGeografica {
  id: string;
  instrumento_id: string;
  tipo_capa: 'amenaza' | 'exposicion';
  nombre_archivo: string;
  epsg_origen: string;
  sha256_hash: string;
  tamanio_kb: number;
  cargado_por: string;
  fecha_carga: string;
  estado: 'PENDIENTE' | 'VALIDO' | 'ERROR_TOPOLOGIA';
  area_km2?: number;
}

export interface VulnerabilityState {
  sensitivityLevel: number;
  expertJustification: string;
  expertJustificationVerified: boolean;
  gedsiText: string;
  gedsiTextVerified: boolean;
  // Geodesic module fields
  locationCrossoverStatus: GeodesicStatus;
  geodesicResult: GeodesicResult | null;
  geodesicStatusMessage: string;       // Human-readable institutional message
  // Legacy indicator fields (kept for display compatibility)
  cropsAffectedHectares: number;
  populationExpCount: number;
  projectionStandard: string;          // must be SIRGAS/WGS84
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
