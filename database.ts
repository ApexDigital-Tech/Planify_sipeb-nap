import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PlanState, ClimateMeasure } from './src/types';

dotenv.config();

let connectionString = process.env.DATABASE_URL || "postgresql://postgres.nkxhwutffmyhrhnoaeex:Planify_sipeb-nap%232026@aws-1-us-east-2.pooler.supabase.com:6543/postgres";

// Defensive programming: rewrite direct IPv6-only Supabase hosts to the IPv4 pooler
if (connectionString.includes("db.nkxhwutffmyhrhnoaeex.supabase.co")) {
  console.log("⚡ [Postgres] Direct host detected in connection string. Rewriting to IPv4-compatible connection pooler...");
  connectionString = connectionString
    .replace("db.nkxhwutffmyhrhnoaeex.supabase.co:5432", "aws-1-us-east-2.pooler.supabase.com:6543")
    .replace("db.nkxhwutffmyhrhnoaeex.supabase.co", "aws-1-us-east-2.pooler.supabase.com:6543");
  
  if (!connectionString.includes("postgres.nkxhwutffmyhrhnoaeex:")) {
    connectionString = connectionString.replace("postgres:", "postgres.nkxhwutffmyhrhnoaeex:");
  }
}


export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase connections require SSL but rejectUnauthorized false is safe for sandbox env
  }
});

// Seed data templates
const initialPlanStatePAD: Omit<PlanState, 'measures'> = {
  currentStep: 4,
  stepsCompleted: {
    1: true,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false
  },
  vulnerability: {
    sensitivityLevel: 1,
    expertJustification: "",
    expertJustificationVerified: false,
    gedsiText: "",
    gedsiTextVerified: false,
    locationCrossoverStatus: 'PENDING',
    cropsAffectedHectares: 0,
    populationExpCount: 0,
    projectionStandard: "SIRGAS-WGS84"
  },
  adaptationCapacity: {
    scores: {
      Financiera: 0,
      Tecnica: 0,
      Normativa: 0,
      Gobernanza: 0
    },
    readinessPct: 0,
    inertiaFlagActive: false
  },
  climateRisk: {
    selectedZone: null,
    matrixFactors: {
      amenaza: 4,
      sensibilidad: 3,
      exposicion: 4,
      capacidad: 2
    },
    calculatedRisk: null
  },
  isSigned: false,
  isSubmitted: false,
  signerName: "Arq. Marcelo Arce",
  signerRole: "Planificador Regional V",
  signerCertificate: "Vigente (Agetic v3)",
  hashVerified: true,
  padesHash: "d5c589b91fac53cf7bebf45f06c11b0e35fa8b3db48fb3ef0eaef1eaf3060f27",
  sigepExcelHash: "a6869b2ffaf36691c7bfdf61a998ce73e21ba4c9acc02df61a9cf40e9421ea3a",
  threatLevel: 4,
  isClosed: false,
  planType: 'PAD',
  evidenceName: '',
  evidenceStatus: 'PENDING',
  evidenceError: '',
  evidenceHash: 'c7c8bc7f2e1e0a8169ffbfcb5210c128bd56f26d3a82efd2ba1fcdcf1a9cf40',
  evidenceTampered: false
};

const initialPlanStatePES: Omit<PlanState, 'measures'> = {
  currentStep: 4,
  stepsCompleted: {
    1: true,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false
  },
  vulnerability: {
    sensitivityLevel: 1,
    expertJustification: "",
    expertJustificationVerified: false,
    gedsiText: "",
    gedsiTextVerified: false,
    locationCrossoverStatus: 'PENDING',
    cropsAffectedHectares: 0,
    populationExpCount: 0,
    projectionStandard: "SIRGAS-WGS84"
  },
  adaptationCapacity: {
    scores: {
      Financiera: 0,
      Tecnica: 0,
      Normativa: 0,
      Gobernanza: 0
    },
    readinessPct: 0,
    inertiaFlagActive: false
  },
  climateRisk: {
    selectedZone: null,
    matrixFactors: {
      amenaza: 4,
      sensibilidad: 3,
      exposicion: 4,
      capacidad: 2
    },
    calculatedRisk: null
  },
  isSigned: false,
  isSubmitted: false,
  signerName: "Dr. Marcelo Arce",
  signerRole: "Director Nacional de Epidemiología",
  signerCertificate: "Vigente (Agetic v3)",
  hashVerified: true,
  padesHash: "d5c589b91fac53cf7bebf45f06c11b0e35fa8b3db48fb3ef0eaef1eaf3060f27",
  sigepExcelHash: "a6869b2ffaf36691c7bfdf61a998ce73e21ba4c9acc02df61a9cf40e9421ea3a",
  threatLevel: 4,
  isClosed: false,
  planType: 'PES',
  evidenceName: '',
  evidenceStatus: 'PENDING',
  evidenceError: '',
  evidenceHash: 'f6a19f2a2e1e0a8169ffbfcb5210c128bd56f26d3a82efd2ba1fcdcf1a9cf83',
  evidenceTampered: false
};

const initialMeasuresPAD: ClimateMeasure[] = [
  {
    id: "measure-pad-1",
    name: "Construcción de Defensivos de Tierra - Río Pilcomayo",
    description: "Amortiguación de crecidas fluviales mediante terraplenes estabilizados.",
    budget: 1540000,
    type: "standard",
    sourceId: "pilcomayo-oficial",
    budget2026: 308000,
    budget2027: 308000,
    budget2028: 308000,
    budget2029: 308000,
    budget2030: 308000
  },
  {
    id: "measure-pad-2",
    name: "Sistemas de Alerta Temprana Comunitaria",
    description: "Instalación de sensores telemétricos autónomos y capacitación social.",
    budget: 450000,
    type: "standard",
    sourceId: "pilcomayo-oficial",
    budget2026: 90000,
    budget2027: 90000,
    budget2028: 90000,
    budget2029: 90000,
    budget2030: 90000
  }
];

const initialMeasuresPES: ClimateMeasure[] = [
  {
    id: "measure-pes-1",
    name: "Servicio de Vigilancia Epidemiológica Amazónica",
    description: "Monitoreo móvil de inundaciones con enfoque GEDSI para hogares con jefatura femenina.",
    budget: 800000,
    type: "standard",
    sourceId: "salud-amazonia-oficial",
    budget2026: 160000,
    budget2027: 160000,
    budget2028: 160000,
    budget2029: 160000,
    budget2030: 160000
  }
];

export async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log("⚡ [Postgres] Inicializando esquema y validando tablas en Supabase...");
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        force_password_reset BOOLEAN DEFAULT TRUE
      );
    `);

    // Create plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(50) PRIMARY KEY,
        plan_type VARCHAR(10) NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 4,
        steps_completed JSONB NOT NULL,
        vulnerability JSONB NOT NULL,
        adaptation_capacity JSONB NOT NULL,
        climate_risk JSONB NOT NULL,
        is_signed BOOLEAN DEFAULT FALSE,
        is_submitted BOOLEAN DEFAULT FALSE,
        signer_name VARCHAR(255),
        signer_role VARCHAR(255),
        signer_certificate VARCHAR(255),
        hash_verified BOOLEAN DEFAULT TRUE,
        pades_hash VARCHAR(255),
        sigep_excel_hash VARCHAR(255),
        threat_level INTEGER DEFAULT 4,
        is_closed BOOLEAN DEFAULT FALSE,
        evidence_name VARCHAR(255),
        evidence_status VARCHAR(50) DEFAULT 'PENDING',
        evidence_error VARCHAR(255),
        evidence_hash VARCHAR(255),
        evidence_tampered BOOLEAN DEFAULT FALSE
      );
    `);

    // Create climate_measures table
    await client.query(`
      CREATE TABLE IF NOT EXISTS climate_measures (
        id VARCHAR(255) PRIMARY KEY,
        plan_id VARCHAR(50) NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        budget NUMERIC(15, 2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        source_id VARCHAR(255),
        budget_2026 NUMERIC(15, 2) NOT NULL DEFAULT 0,
        budget_2027 NUMERIC(15, 2) NOT NULL DEFAULT 0,
        budget_2028 NUMERIC(15, 2) NOT NULL DEFAULT 0,
        budget_2029 NUMERIC(15, 2) NOT NULL DEFAULT 0,
        budget_2030 NUMERIC(15, 2) NOT NULL DEFAULT 0
      );
    `);

    // Create instruments_inbox table
    await client.query(`
      CREATE TABLE IF NOT EXISTS instruments_inbox (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        department VARCHAR(100)
      );
    `);

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        state_before TEXT,
        state_after TEXT,
        valores_modificados TEXT,
        correlation_id VARCHAR(255)
      );
    `);

    // Create sources table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        gemini_file_uri TEXT,
        gemini_file_name TEXT,
        gemini_uploaded_at TIMESTAMP WITH TIME ZONE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- SEED USER ACCOUNTS ---
    const usersCountResult = await client.query("SELECT COUNT(*) FROM users;");
    if (parseInt(usersCountResult.rows[0].count) === 0) {
      console.log("🔒 Seeding user accounts with bcrypt hashes...");
      const salt = bcrypt.genSaltSync(10);
      
      const seedUsers = [
        {
          name: "Dilan Aliendre",
          email: "aliendredilan@gmail.com",
          passwordHash: bcrypt.hashSync("sipeb.Dilan#2026", salt),
          role: 'SUPER_ADMIN',
          force_password_reset: false
        },
        {
          name: "Carlos Saavedra",
          email: "revisor.giz@planificacion.gob.bo",
          passwordHash: bcrypt.hashSync("Revisor.2026#GIZ", salt),
          role: 'REVISOR_SENIOR',
          force_password_reset: true
        },
        {
          name: "Especialista Territorial GIZ",
          email: "especialista.pad@planificacion.gob.bo",
          passwordHash: bcrypt.hashSync("Pad.2026#Territorio", salt),
          role: 'ESPECIALISTA_PAD',
          force_password_reset: true
        },
        {
          name: "Especialista Sectorial GIZ",
          email: "especialista.pes@planificacion.gob.bo",
          passwordHash: bcrypt.hashSync("Pes.2026#Sectorial", salt),
          role: 'ESPECIALISTA_PES',
          force_password_reset: true
        }
      ];

      for (const u of seedUsers) {
        await client.query(
          "INSERT INTO users (email, name, password_hash, role, force_password_reset) VALUES ($1, $2, $3, $4, $5);",
          [u.email, u.name, u.passwordHash, u.role, u.force_password_reset]
        );
      }
    }

    // --- SEED PLANS ---
    const plansCountResult = await client.query("SELECT COUNT(*) FROM plans;");
    if (parseInt(plansCountResult.rows[0].count) === 0) {
      console.log("📈 Seeding default plan templates (PAD and PES) in plans table...");
      
      // Seed PAD
      await client.query(`
        INSERT INTO plans (
          id, plan_type, current_step, steps_completed, vulnerability, adaptation_capacity, climate_risk,
          is_signed, is_submitted, signer_name, signer_role, signer_certificate, hash_verified, pades_hash,
          sigep_excel_hash, threat_level, is_closed, evidence_name, evidence_status, evidence_error,
          evidence_hash, evidence_tampered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22);
      `, [
        'PAD', initialPlanStatePAD.planType, initialPlanStatePAD.currentStep,
        JSON.stringify(initialPlanStatePAD.stepsCompleted), JSON.stringify(initialPlanStatePAD.vulnerability),
        JSON.stringify(initialPlanStatePAD.adaptationCapacity), JSON.stringify(initialPlanStatePAD.climateRisk),
        initialPlanStatePAD.isSigned, initialPlanStatePAD.isSubmitted, initialPlanStatePAD.signerName,
        initialPlanStatePAD.signerRole, initialPlanStatePAD.signerCertificate, initialPlanStatePAD.hashVerified,
        initialPlanStatePAD.padesHash, initialPlanStatePAD.sigepExcelHash, initialPlanStatePAD.threatLevel,
        initialPlanStatePAD.isClosed, initialPlanStatePAD.evidenceName, initialPlanStatePAD.evidenceStatus,
        initialPlanStatePAD.evidenceError, initialPlanStatePAD.evidenceHash, initialPlanStatePAD.evidenceTampered
      ]);

      // Seed PES
      await client.query(`
        INSERT INTO plans (
          id, plan_type, current_step, steps_completed, vulnerability, adaptation_capacity, climate_risk,
          is_signed, is_submitted, signer_name, signer_role, signer_certificate, hash_verified, pades_hash,
          sigep_excel_hash, threat_level, is_closed, evidence_name, evidence_status, evidence_error,
          evidence_hash, evidence_tampered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22);
      `, [
        'PES', initialPlanStatePES.planType, initialPlanStatePES.currentStep,
        JSON.stringify(initialPlanStatePES.stepsCompleted), JSON.stringify(initialPlanStatePES.vulnerability),
        JSON.stringify(initialPlanStatePES.adaptationCapacity), JSON.stringify(initialPlanStatePES.climateRisk),
        initialPlanStatePES.isSigned, initialPlanStatePES.isSubmitted, initialPlanStatePES.signerName,
        initialPlanStatePES.signerRole, initialPlanStatePES.signerCertificate, initialPlanStatePES.hashVerified,
        initialPlanStatePES.padesHash, initialPlanStatePES.sigepExcelHash, initialPlanStatePES.threatLevel,
        initialPlanStatePES.isClosed, initialPlanStatePES.evidenceName, initialPlanStatePES.evidenceStatus,
        initialPlanStatePES.evidenceError, initialPlanStatePES.evidenceHash, initialPlanStatePES.evidenceTampered
      ]);

      // Seed climate measures for PAD
      for (const m of initialMeasuresPAD) {
        await client.query(`
          INSERT INTO climate_measures (
            id, plan_id, name, description, budget, type, source_id, budget_2026, budget_2027, budget_2028, budget_2029, budget_2030
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
        `, [m.id, 'PAD', m.name, m.description, m.budget, m.type, m.sourceId, m.budget2026, m.budget2027, m.budget2028, m.budget2029, m.budget2030]);
      }

      // Seed climate measures for PES
      for (const m of initialMeasuresPES) {
        await client.query(`
          INSERT INTO climate_measures (
            id, plan_id, name, description, budget, type, source_id, budget_2026, budget_2027, budget_2028, budget_2029, budget_2030
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
        `, [m.id, 'PES', m.name, m.description, m.budget, m.type, m.sourceId, m.budget2026, m.budget2027, m.budget2028, m.budget2029, m.budget2030]);
      }
    }

    // --- SEED INSTRUMENTS INBOX ---
    const inboxCountResult = await client.query("SELECT COUNT(*) FROM instruments_inbox;");
    if (parseInt(inboxCountResult.rows[0].count) === 0) {
      console.log("📥 Seeding default instruments inbox...");
      const seedInbox = [
        { id: 'PES-ST-2026-01', user_id: 'aliendredilan@gmail.com', name: 'Plan de Salud Sectorial Amazónico', status: 'EN_PROCESO', type: 'PES', last_modified: '2026-06-14T12:00:00Z', department: 'La Paz' },
        { id: 'PAD-TJ-2026-02', user_id: 'aliendredilan@gmail.com', name: 'Plan Autonómico Departamental Tarija', status: 'EN_PROCESO', type: 'PAD', last_modified: '2026-06-14T15:30:00Z', department: 'Tarija' },
        { id: 'PES-CB-2025-09', user_id: 'aliendredilan@gmail.com', name: 'Plan de Contingencia Dengue Cochabamba', status: 'CONSOLIDADO', type: 'PES', last_modified: '2025-11-20T09:15:00Z', department: 'Cochabamba' },
        { id: 'PAD-OR-2025-11', user_id: 'aliendredilan@gmail.com', name: 'Plan Autonómico Municipal Oruro', status: 'VALIDADO', type: 'PAD', last_modified: '2025-12-05T18:00:00Z', department: 'Oruro' }
      ];

      for (const i of seedInbox) {
        await client.query(`
          INSERT INTO instruments_inbox (id, user_id, name, status, type, last_modified, department)
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [i.id, i.user_id, i.name, i.status, i.type, i.last_modified, i.department]);
      }
    }

    // --- SEED SOURCES ---
    const sourcesCountResult = await client.query("SELECT COUNT(*) FROM sources;");
    if (parseInt(sourcesCountResult.rows[0].count) === 0) {
      console.log("📚 Seeding default methodological source...");
      await client.query(`
        INSERT INTO sources (id, name, type, url, user_id)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        'source-methodology-default',
        'Informe Técnico y Metodológico de la Plataforma SIPEB-NAP 2026-2030',
        'local_reference',
        '.agent/Informe Técnico y Metodológico de la Plataforma SIPEB-NAP 2026-2030.pdf',
        'aliendredilan@gmail.com'
      ]);
    }

    console.log("✓ [Postgres] Base de datos y semilla inicializadas correctamente en Supabase.");
  } catch (error) {
    console.error("❌ Error inicializando base de datos en Supabase:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function setScenarioState(type: 'PES' | 'PAD') {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await client.query("DELETE FROM plans WHERE id = $1;", [type]);
    
    const initialPlanState = type === 'PAD' ? initialPlanStatePAD : initialPlanStatePES;
    const initialMeasures = type === 'PAD' ? initialMeasuresPAD : initialMeasuresPES;
    
    await client.query(`
      INSERT INTO plans (
        id, plan_type, current_step, steps_completed, vulnerability, adaptation_capacity, climate_risk,
        is_signed, is_submitted, signer_name, signer_role, signer_certificate, hash_verified, pades_hash,
        sigep_excel_hash, threat_level, is_closed, evidence_name, evidence_status, evidence_error,
        evidence_hash, evidence_tampered
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22);
    `, [
      type, initialPlanState.planType, initialPlanState.currentStep,
      JSON.stringify(initialPlanState.stepsCompleted), JSON.stringify(initialPlanState.vulnerability),
      JSON.stringify(initialPlanState.adaptationCapacity), JSON.stringify(initialPlanState.climateRisk),
      initialPlanState.isSigned, initialPlanState.isSubmitted, initialPlanState.signerName,
      initialPlanState.signerRole, initialPlanState.signerCertificate, initialPlanState.hashVerified,
      initialPlanState.padesHash, initialPlanState.sigepExcelHash, initialPlanState.threatLevel,
      initialPlanState.isClosed, initialPlanState.evidenceName, initialPlanState.evidenceStatus,
      initialPlanState.evidenceError, initialPlanState.evidenceHash, initialPlanState.evidenceTampered
    ]);

    for (const m of initialMeasures) {
      await client.query(`
        INSERT INTO climate_measures (
          id, plan_id, name, description, budget, type, source_id, budget_2026, budget_2027, budget_2028, budget_2029, budget_2030
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
      `, [m.id, type, m.name, m.description, m.budget, m.type, m.sourceId, m.budget2026, m.budget2027, m.budget2028, m.budget2029, m.budget2030]);
    }
    
    await client.query("COMMIT;");
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
  }
}

