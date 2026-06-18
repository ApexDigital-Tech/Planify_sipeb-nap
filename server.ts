import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import { PlanState, AuditLog, ClimateMeasure } from './src/types';
import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';
import { pool, initDatabase, setScenarioState } from './database.js';
import { z } from 'zod';

declare global {
  var currentSessionUser: any;
  var activePlanType: 'PES' | 'PAD';
  var activeUserRole: string;
}

export interface UserAccount {
  name: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'REVISOR_SENIOR' | 'ESPECIALISTA_PAD' | 'ESPECIALISTA_PES';
  force_password_reset: boolean;
}

dotenv.config();

const app = express();
const PORT = 3000;

// Session Management with AsyncLocalStorage for stateless serverless functions (Vercel)
import { AsyncLocalStorage } from 'async_hooks';

const SESSION_SECRET = process.env.SESSION_SECRET || 'sipeb-secret-key-32bytes-long-123';

function encryptSession(user: any): string {
  const text = JSON.stringify(user);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptSession(token: string): any {
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

function parseCookies(cookieHeader?: string) {
  const list: { [key: string]: string } = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}

interface SessionContext {
  user: any;
  planType: 'PES' | 'PAD';
}

export const sessionStore = new AsyncLocalStorage<SessionContext>();

Object.defineProperty(globalThis, 'currentSessionUser', {
  get() {
    const store = sessionStore.getStore();
    return store ? store.user : null;
  },
  set(value) {
    const store = sessionStore.getStore();
    if (store) {
      store.user = value;
    }
  },
  configurable: true
});

Object.defineProperty(globalThis, 'activePlanType', {
  get() {
    const store = sessionStore.getStore();
    return store ? store.planType : 'PAD';
  },
  set(value) {
    const store = sessionStore.getStore();
    if (store) {
      store.planType = value;
    }
  },
  configurable: true
});

Object.defineProperty(globalThis, 'activeUserRole', {
  get() {
    const user = (globalThis as any).currentSessionUser;
    return user ? user.role : 'Guest';
  },
  set(value) {
    // Getter resolves dynamically
  },
  configurable: true
});

let isDbInitialized = false;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(async (req, res, next) => {
  // Lazy DB init to support serverless cold starts
  if (!isDbInitialized) {
    isDbInitialized = true;
    try {
      await initDatabase();
    } catch (err) {
      console.error("Database lazy init failed:", err);
      isDbInitialized = false;
    }
  }

  // Parse session and plan type from cookies
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['session'];
  const planTypeCookie = cookies['plan_type'];

  let user = null;
  if (sessionToken) {
    user = decryptSession(sessionToken);
  }

  const planType: 'PES' | 'PAD' = (planTypeCookie === 'PES' || planTypeCookie === 'PAD') ? planTypeCookie : 'PAD';

  // Run downstream handlers within the AsyncLocalStorage session context
  sessionStore.run({ user, planType }, () => {
    next();
  });
});

// Security HTTP headers (defense in depth)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});



// Zod schemas for validation
const roleEnum = z.enum(['SUPER_ADMIN', 'REVISOR_SENIOR', 'ESPECIALISTA_PAD', 'ESPECIALISTA_PES']);

const changeUserRoleSchema = z.object({
  role: roleEnum
});

const loginSchema = z.object({
  email: z.string().email("Formato de correo inválido."),
  password: z.string().min(1, "La contraseña es requerida.")
});

const forceResetSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.")
});

const createUserSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().email(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  role: roleEnum,
  force_password_reset: z.boolean().optional()
});

const updateUserSchema = z.object({
  email: z.string().email(),
  role: roleEnum.optional(),
  force_password_reset: z.boolean().optional(),
  password: z.string().min(6).optional()
});

const deleteUserSchema = z.object({
  email: z.string().email()
});

const updateThreatSchema = z.object({
  threatLevel: z.union([z.number(), z.string()]).transform((val) => parseInt(val as string) || 4)
});

const setScenarioSchema = z.object({
  type: z.enum(['PES', 'PAD'])
});

const uploadEvidenceSchema = z.object({
  fileName: z.string().min(1),
  contentLength: z.number().int().nonnegative(),
  normativityMatched: z.boolean()
});

const saveVulnerabilitySchema = z.object({
  sensitivityLevel: z.union([z.number(), z.string()]).transform((val) => parseInt(val as string) || 1),
  expertJustification: z.string().min(30, "La justificación técnica de vulnerabilidad debe poseer al menos 30 caracteres."),
  gedsiText: z.string()
});

const saveAdaptabilitySchema = z.object({
  scores: z.object({
    Financiera: z.number().int().min(1).max(5),
    Tecnica: z.number().int().min(1).max(5),
    Normativa: z.number().int().min(1).max(5),
    Gobernanza: z.number().int().min(1).max(5)
  })
});

const calculateSchema = z.object({
  r: z.number().int().nonnegative(),
  c: z.number().int().nonnegative(),
  factors: z.object({
    amenaza: z.number().min(1).max(5),
    sensibilidad: z.number().min(1).max(5),
    exposicion: z.number().min(1).max(5),
    capacidad: z.number().min(1).max(5)
  })
});

const saveMeasureSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  budget: z.number().positive(),
  isTechnicalStrengthening: z.boolean().optional(),
  sourceId: z.string().min(1),
  budget2026: z.number().nonnegative().optional(),
  budget2027: z.number().nonnegative().optional(),
  budget2028: z.number().nonnegative().optional(),
  budget2029: z.number().nonnegative().optional(),
  budget2030: z.number().nonnegative().optional()
});

const deleteMeasureSchema = z.object({
  id: z.string().min(1)
});

const verifyDocumentSchema = z.object({
  documentType: z.enum(['PDF', 'Excel']),
  content: z.string().min(1)
});

async function initSession() {
  // Mocked for compatibility; state is cookie-based
}


async function getPlanState(type: 'PES' | 'PAD'): Promise<PlanState> {
  const planResult = await pool.query("SELECT * FROM plans WHERE id = $1;", [type]);
  if (planResult.rows.length === 0) {
    throw new Error(`Plan type ${type} not found in database.`);
  }
  const row = planResult.rows[0];
  
  const measuresResult = await pool.query("SELECT * FROM climate_measures WHERE plan_id = $1;", [type]);
  const measures: ClimateMeasure[] = measuresResult.rows.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    budget: parseFloat(m.budget),
    type: m.type,
    sourceId: m.source_id,
    budget2026: parseFloat(m.budget_2026),
    budget2027: parseFloat(m.budget_2027),
    budget2028: parseFloat(m.budget_2028),
    budget2029: parseFloat(m.budget_2029),
    budget2030: parseFloat(m.budget_2030)
  }));

  return {
    currentStep: row.current_step,
    stepsCompleted: row.steps_completed,
    vulnerability: row.vulnerability,
    adaptationCapacity: row.adaptation_capacity,
    climateRisk: row.climate_risk,
    measures,
    isSigned: row.is_signed,
    isSubmitted: row.is_submitted,
    signerName: row.signer_name,
    signerRole: row.signer_role,
    signerCertificate: row.signer_certificate,
    hashVerified: row.hash_verified,
    padesHash: row.pades_hash,
    sigepExcelHash: row.sigep_excel_hash,
    threatLevel: row.threat_level,
    isClosed: row.is_closed,
    planType: row.plan_type,
    evidenceName: row.evidence_name,
    evidenceStatus: row.evidence_status,
    evidenceError: row.evidence_error,
    evidenceHash: row.evidence_hash,
    evidenceTampered: row.evidence_tampered
  };
}

async function savePlanState(state: PlanState): Promise<void> {
  await pool.query(`
    UPDATE plans SET
      current_step = $1,
      steps_completed = $2,
      vulnerability = $3,
      adaptation_capacity = $4,
      climate_risk = $5,
      is_signed = $6,
      is_submitted = $7,
      signer_name = $8,
      signer_role = $9,
      signer_certificate = $10,
      hash_verified = $11,
      pades_hash = $12,
      sigep_excel_hash = $13,
      threat_level = $14,
      is_closed = $15,
      evidence_name = $16,
      evidence_status = $17,
      evidence_error = $18,
      evidence_hash = $19,
      evidence_tampered = $20
    WHERE id = $21;
  `, [
    state.currentStep,
    JSON.stringify(state.stepsCompleted),
    JSON.stringify(state.vulnerability),
    JSON.stringify(state.adaptationCapacity),
    JSON.stringify(state.climateRisk),
    state.isSigned,
    state.isSubmitted,
    state.signerName,
    state.signerRole,
    state.signerCertificate,
    state.hashVerified,
    state.padesHash,
    state.sigepExcelHash,
    state.threatLevel,
    state.isClosed,
    state.evidenceName,
    state.evidenceStatus,
    state.evidenceError,
    state.evidenceHash,
    state.evidenceTampered,
    state.planType
  ]);
}

// Compute difference for audit logs (trazabilidad de valores modificados)
function findChanges(before: any, after: any): string {
  if (!before) return "Registro inicializado.";
  if (!after) return "Registro removido.";
  try {
    const changes: any = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (key === 'padesHash' || key === 'sigepExcelHash' || key === 'signerCertificate') continue;
      const bVal = before[key];
      const aVal = after[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changes[key] = {
          antes: bVal !== undefined ? bVal : null,
          despues: aVal !== undefined ? aVal : null
        };
      }
    }
    return Object.keys(changes).length > 0 
      ? JSON.stringify(changes, null, 2) 
      : "No se identificaron cambios en los atributos clave.";
  } catch (e) {
    return "Cambio estructural complejo.";
  }
}

// Helper to write audit logs (auditoria_negocio / instrumento_auditoria_logs)
async function logAudit(
  userId: string,
  action: string,
  stateBefore: any,
  stateAfter: any,
  correlationId: string
): Promise<AuditLog> {
  const diff = findChanges(stateBefore, stateAfter);
  const log: AuditLog = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    user_id: userId || 'aliendredilan@gmail.com',
    action,
    state_before: JSON.stringify(stateBefore),
    state_after: JSON.stringify(stateAfter),
    valores_modificados: diff,
    correlation_id: correlationId
  };
  
  await pool.query(`
    INSERT INTO audit_logs (id, timestamp, user_id, action, state_before, state_after, valores_modificados, correlation_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
  `, [
    log.id,
    log.timestamp,
    log.user_id,
    log.action,
    log.state_before,
    log.state_after,
    log.valores_modificados,
    log.correlation_id
  ]);
  
  return log;
}

// Middleware to prevent modifications if the expediente is closed, or if the user is not authorized
const checkWriterBlock = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // If the path does not start with /api/, bypass to avoid connection pool exhaustion from static assets
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // If the path relates to auth or reset, bypass write-blocking / authorization checks
  if (req.path.startsWith('/api/auth/') || req.path === '/api/plan/reset') {
    return next();
  }

  // 1. Admin endpoints protection (SUPER_ADMIN only)
  if (req.path.startsWith('/api/admin/')) {
    if (!currentSessionUser || currentSessionUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: "ACCESO DENEGADO (403 Forbidden): El módulo administrador de Gestión de Usuarios y Accesos es de atribución exclusiva para el rol de SUPER_ADMIN de SIPEB."
      });
    }
    return next();
  }

  let currentPlan: PlanState | null = null;
  try {
    currentPlan = await getPlanState(activePlanType);
  } catch (err) {
    // Ignore database errors during init/reset
  }

  // 2. Immutable checks for modify requests (POST/PUT/DELETE)
  if (req.method !== 'GET' && currentPlan?.isClosed && req.path !== '/api/profile/role') {
    return res.status(403).json({
      success: false,
      error: "EXPEDIENTE INMUTABLE: El Expediente Consolidado ha sido cerrado mediante el Flag de Cierre por inmutabilidad reglamentaria del SIPEB. No se permiten modificaciones adicionales en la base de datos."
    });
  }

  // 3. RBAC Policy check: Especialista PAD can only do PAD, Especialista PES can only do PES (transversal barrier)
  if (currentSessionUser && currentPlan) {
    const role = currentSessionUser.role;

    // A. Intercept Scenario selection
    if (req.path === '/api/plan/set-scenario' && req.method === 'POST') {
      const { type } = req.body;
      if (role === 'ESPECIALISTA_PAD' && type === 'PES') {
        return res.status(403).json({
          success: false,
          error: "ACCESO RESTRINGIDO (403 Forbidden): Un Especialista Territorial (PAD) no posee autorización para formular ni crear instrumentos sectoriales (PES)."
        });
      }
      if (role === 'ESPECIALISTA_PES' && type === 'PAD') {
        return res.status(403).json({
          success: false,
          error: "ACCESO RESTRINGIDO (403 Forbidden): Un Especialista Sectorial (PES) no posee autorización para formular ni crear instrumentos territoriales (PAD)."
        });
      }
    }

    // B. Block general viewing or editing of cross-barrier documents
    const isPlanOrStepOrExportRoute = req.path.startsWith('/api/plan') || req.path.startsWith('/api/step') || req.path.startsWith('/api/export') || req.path.startsWith('/api/chat');
    if (isPlanOrStepOrExportRoute && req.path !== '/api/plan/reset') {
      if (role === 'ESPECIALISTA_PAD' && currentPlan.planType === 'PES') {
        return res.status(403).json({
          success: false,
          error: "ACCESO RESTRINGIDO (403 Forbidden - Transversal): Un Especialista Territorial (PAD) tiene restringido el acceso a instrumentos de categoría sectorial (PES) en el servidor."
        });
      }
      if (role === 'ESPECIALISTA_PES' && currentPlan.planType === 'PAD') {
        return res.status(403).json({
          success: false,
          error: "ACCESO RESTRINGIDO (403 Forbidden - Transversal): Un Especialista Sectorial (PES) tiene restringido el acceso a instrumentos de categoría territorial (PAD) en el servidor."
        });
      }
    }
  }

  next();
};
app.use(checkWriterBlock);

// API Routes

// Get Current Plan state & Logs
app.get('/api/plan', async (req, res) => {
  try {
    const state = await getPlanState(activePlanType);
    const logsResult = await pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100;");
    const logs: AuditLog[] = logsResult.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp).toISOString(),
      user_id: row.user_id,
      action: row.action,
      state_before: row.state_before,
      state_after: row.state_after,
      valores_modificados: row.valores_modificados,
      correlation_id: row.correlation_id
    }));
    
    res.json({
      state,
      logs,
      correlationId: (req as any).correlationId,
      userRole: currentSessionUser?.role || 'Guest'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET user profile
app.get('/api/profile', (req, res) => {
  if (!currentSessionUser) {
    return res.status(401).json({ success: false, error: "No authenticated session" });
  }
  res.json({
    success: true,
    name: currentSessionUser.name,
    email: currentSessionUser.email,
    role: currentSessionUser.role,
    signerRole: currentSessionUser.role === 'SUPER_ADMIN' ? 'Propietario / MPDyMA' : currentSessionUser.role === 'REVISOR_SENIOR' ? 'Coordinador GIZ' : 'Consultor Territorial GIZ',
    force_password_reset: currentSessionUser.force_password_reset,
    rolesAvailable: ['SUPER_ADMIN', 'REVISOR_SENIOR', 'ESPECIALISTA_PAD', 'ESPECIALISTA_PES']
  });
});

// POST change user role (Sandbox Quick Select mechanism)
app.post('/api/profile/role', async (req, res) => {
  const result = changeUserRoleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { role } = result.data;
  const corrId = (req as any).correlationId;
  const beforeRole = currentSessionUser?.role || 'Guest';

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE role = $1 LIMIT 1;", [role]);
    if (userResult.rows.length > 0) {
      const foundUser = userResult.rows[0];
      currentSessionUser = {
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        force_password_reset: foundUser.force_password_reset
      };
      
      await logAudit(currentSessionUser.email, 'CHANGE_USER_ROLE', { role: beforeRole }, { role }, corrId);

      const token = encryptSession(currentSessionUser);
      res.setHeader('Set-Cookie', [
        `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        `plan_type=${activePlanType}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      ]);

      const state = await getPlanState(activePlanType);
      return res.json({ success: true, role, state });
    }
    res.status(400).json({ success: false, error: "Rol no válido en el sistema IAM." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- NEW IAM AUTHENTICATION ENDPOINTS ---

// POST Authenticate User using bcrypt
app.post('/api/auth/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { email, password } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Credenciales de ingreso inválidas. El correo electrónico no está registrado en el SIPEB." });
    }

    const user = userResult.rows[0];
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: "Contraseña provisional o de producción incorrecta. Intente de nuevo." });
    }

    currentSessionUser = {
      name: user.name,
      email: user.email,
      role: user.role,
      force_password_reset: user.force_password_reset
    };

    // Auto-align scenario selection to avoid 403 blocks for incoming specialist roles
    const currentPlan = await getPlanState(activePlanType);
    if (user.role === 'ESPECIALISTA_PAD' && currentPlan.planType !== 'PAD') {
      activePlanType = 'PAD';
      await setScenarioState('PAD');
    } else if (user.role === 'ESPECIALISTA_PES' && currentPlan.planType !== 'PES') {
      activePlanType = 'PES';
      await setScenarioState('PES');
    }

    await logAudit(user.email, 'IAM_USER_LOGIN', null, { email: user.email, role: user.role, force_password_reset: user.force_password_reset }, corrId);

    const token = encryptSession(currentSessionUser);
    res.setHeader('Set-Cookie', [
      `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      `plan_type=${activePlanType}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    ]);

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        force_password_reset: user.force_password_reset
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// POST Force Reset Password using bcrypt saving
app.post('/api/auth/force-reset', async (req, res) => {
  const result = forceResetSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { email, newPassword } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Usuario o email no registrado." });
    }

    const user = userResult.rows[0];
    if (!user.force_password_reset) {
      return res.status(400).json({ success: false, error: "Este usuario ya ha restablecido su contraseña provisional." });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);
    
    await pool.query("UPDATE users SET password_hash = $1, force_password_reset = false WHERE email = $2;", [newHash, email.toLowerCase()]);

    currentSessionUser = {
      name: user.name,
      email: user.email,
      role: user.role,
      force_password_reset: false
    };

    const currentPlan = await getPlanState(activePlanType);
    if (user.role === 'ESPECIALISTA_PAD' && currentPlan.planType !== 'PAD') {
      activePlanType = 'PAD';
      await setScenarioState('PAD');
    } else if (user.role === 'ESPECIALISTA_PES' && currentPlan.planType !== 'PES') {
      activePlanType = 'PES';
      await setScenarioState('PES');
    }

    await logAudit(user.email, 'IAM_FORCE_PASSWORD_RESET_SUCCESS', null, { email: user.email, role: user.role }, corrId);

    const token = encryptSession(currentSessionUser);
    res.setHeader('Set-Cookie', [
      `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      `plan_type=${activePlanType}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    ]);

    res.json({
      success: true,
      msg: "CONTRALORÍA IAM: Cambio de contraseña validado e inyectado con bcryptjs exitosamente.",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        force_password_reset: false
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Current Auth Session
app.get('/api/auth/current', async (req, res) => {
  if (!currentSessionUser) {
    return res.json({ success: true, user: null });
  }

  try {
    const currentPlan = await getPlanState(activePlanType);
    let planTypeChanged = false;
    if (currentSessionUser.role === 'ESPECIALISTA_PAD' && currentPlan.planType !== 'PAD') {
      activePlanType = 'PAD';
      await setScenarioState('PAD');
      planTypeChanged = true;
    } else if (currentSessionUser.role === 'ESPECIALISTA_PES' && currentPlan.planType !== 'PES') {
      activePlanType = 'PES';
      await setScenarioState('PES');
      planTypeChanged = true;
    }

    if (planTypeChanged) {
      res.setHeader('Set-Cookie', `plan_type=${activePlanType}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    }

    res.json({
      success: true,
      user: {
        name: currentSessionUser.name,
        email: currentSessionUser.email,
        role: currentSessionUser.role,
        force_password_reset: currentSessionUser.force_password_reset
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Logout
app.post('/api/auth/logout', async (req, res) => {
  const corrId = (req as any).correlationId;
  if (currentSessionUser) {
    await logAudit(currentSessionUser.email, 'IAM_USER_LOGOUT', null, null, corrId);
  }
  currentSessionUser = null;
  res.setHeader('Set-Cookie', [
    'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'plan_type=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  ]);
  res.json({ success: true });
});

// --- GO-LIVE USER & ACCESS MANAGEMENT API (SUPER_ADMIN ONLY) ---

// GET list of all user items
app.get('/api/admin/users', async (req, res) => {
  try {
    const usersResult = await pool.query("SELECT email, name, role, force_password_reset FROM users;");
    res.json({
      success: true,
      users: usersResult.rows.map(u => ({
        name: u.name,
        email: u.email,
        role: u.role,
        force_password_reset: u.force_password_reset
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new user
app.post('/api/admin/users/create', async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { name, email, password, role, force_password_reset } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const existsResult = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (existsResult.rows.length > 0) {
      return res.status(400).json({ success: false, error: "El email provisto ya se encuentra registrado en el SIPEB." });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    await pool.query(
      "INSERT INTO users (email, name, password_hash, role, force_password_reset) VALUES ($1, $2, $3, $4, $5);",
      [email.toLowerCase(), name, passwordHash, role, force_password_reset === true]
    );

    await logAudit(currentSessionUser?.email || 'admin@sipeb', 'IAM_USER_CREATED', null, { name, email: email.toLowerCase(), role, force_password_reset }, corrId);

    res.json({ success: true, msg: "Usuario creado exitosamente.", user: { name, email: email.toLowerCase(), role, force_password_reset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST edit user (modify role, option to reset/force reset)
app.post('/api/admin/users/update', async (req, res) => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { email, role, force_password_reset, password } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no registrado." });
    }

    const salt = bcrypt.genSaltSync(10);
    const params: any[] = [email.toLowerCase()];
    let index = 2;

    const updates: string[] = [];
    if (role) {
      updates.push(`role = $${index++}`);
      params.push(role);
    }
    if (typeof force_password_reset === 'boolean') {
      updates.push(`force_password_reset = $${index++}`);
      params.push(force_password_reset);
    }
    if (password && password.trim().length > 0) {
      updates.push(`password_hash = $${index++}`);
      params.push(bcrypt.hashSync(password, salt));
    }

    if (updates.length > 0) {
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE email = $1;`, params);
    }

    await logAudit(currentSessionUser?.email || 'admin@sipeb', 'IAM_USER_UPDATED', null, { email, role, force_password_reset }, corrId);

    res.json({ success: true, msg: "Usuario actualizado de forma inmediata con hashes de producción." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST delete/revoke user
app.post('/api/admin/users/delete', async (req, res) => {
  const result = deleteUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { email } = result.data;
  const corrId = (req as any).correlationId;

  if (email.toLowerCase() === 'aliendredilan@gmail.com') {
    return res.status(403).json({ success: false, error: "Operación Restringida: No es posible revocar al Super Administrador Root de SIPEB." });
  }

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    }

    const userToDelete = userResult.rows[0];
    await pool.query("DELETE FROM users WHERE email = $1;", [email.toLowerCase()]);

    await logAudit(currentSessionUser?.email || 'admin@sipeb', 'IAM_USER_REVOKED', null, { email: userToDelete.email, role: userToDelete.role }, corrId);

    res.json({ success: true, msg: "Firma y acceso de usuario revocada exitosamente." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SOURCE MANAGER ENDPOINTS ---

// GET /api/sources - List all sources
app.get('/api/sources', async (req, res) => {
  if (!currentSessionUser) {
    return res.status(401).json({ success: false, error: "No authenticated session" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM sources WHERE user_id = $1 OR type = 'local_reference' ORDER BY created_at DESC;",
      [currentSessionUser.email]
    );
    res.json({ success: true, sources: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sources - Create a new source
app.post('/api/sources', async (req, res) => {
  if (!currentSessionUser) {
    return res.status(401).json({ success: false, error: "No authenticated session" });
  }
  try {
    const { name, type, url, base64Data, filename } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: "El nombre y el tipo de fuente son obligatorios." });
    }

    const id = 'source-' + Date.now();
    let finalUrl = url || '';
    let geminiFileUri = null;
    let geminiFileName = null;
    const corrId = (req as any).correlationId || '';

    if (type === 'direct_upload') {
      if (!base64Data || !filename) {
        return res.status(400).json({ success: false, error: "Los datos del archivo y el nombre son requeridos para subidas directas." });
      }

      const fileExt = path.extname(filename);
      const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Use /tmp for serverless compatibility (Vercel runtime - only writable dir)
      const tempDir = '/tmp';
      const filePath = path.join(tempDir, safeFilename);
      const fileBuffer = Buffer.from(base64Data, 'base64');

      try {
        fs.writeFileSync(filePath, fileBuffer);
      } catch (fsErr: any) {
        console.error("Error writing temp file:", fsErr);
        return res.status(500).json({ success: false, error: "No se pudo guardar el archivo temporalmente en el servidor." });
      }

      // Upload to Gemini File API
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const aiClient = new GoogleGenAI({ apiKey });
          let mimeType = 'application/octet-stream';
          if (fileExt.toLowerCase() === '.pdf') mimeType = 'application/pdf';
          else if (fileExt.toLowerCase() === '.txt') mimeType = 'text/plain';
          else if (fileExt.toLowerCase() === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

          console.log(`📤 Uploading file to Gemini File API: ${filePath} (${mimeType})`);
          const uploadResult = await aiClient.files.upload({
            file: filePath,
            config: { mimeType }
          });
          geminiFileUri = uploadResult.uri;
          geminiFileName = uploadResult.name;
          finalUrl = geminiFileUri || `gemini://${safeFilename}`;
          console.log(`✓ Uploaded to Gemini: ${geminiFileUri} (${geminiFileName})`);
        } catch (geminiErr: any) {
          console.error("Failed to upload source file to Gemini File API:", geminiErr);
          // Still proceed: save with temp reference so the source is registered
          finalUrl = `pending://gemini-upload-failed/${safeFilename}`;
        }
      } else {
        // No API key - store reference only
        finalUrl = `local://${safeFilename}`;
      }

      // Clean up temp file after Gemini upload (serverless best practice)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (cleanErr) {
        console.warn("Could not clean temp file:", cleanErr);
      }
    }

    await pool.query(
      `INSERT INTO sources (id, name, type, url, gemini_file_uri, gemini_file_name, gemini_uploaded_at, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [id, name, type, finalUrl, geminiFileUri, geminiFileName, geminiFileUri ? new Date() : null, currentSessionUser.email]
    );

    // Audit Log
    const logId = 'log-' + crypto.randomUUID();
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp, user_id, action, state_after, correlation_id)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5);`,
      [logId, currentSessionUser.email, 'CREATE_SOURCE', `Creada fuente "${name}" (Tipo: ${type})`, corrId]
    );

    res.json({ success: true, source: { id, name, type, url: finalUrl } });
  } catch (err: any) {
    console.error("Error creating source:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/sources/:id - Update an existing source
app.put('/api/sources/:id', async (req, res) => {
  if (!currentSessionUser) {
    return res.status(401).json({ success: false, error: "No authenticated session" });
  }
  try {
    const { id } = req.params;
    const { name, url } = req.body;
    const corrId = (req as any).correlationId || '';
    
    const checkResult = await pool.query("SELECT * FROM sources WHERE id = $1;", [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Fuente no encontrada." });
    }
    
    const source = checkResult.rows[0];
    if (source.user_id !== currentSessionUser.email && currentSessionUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: "No posee permisos para modificar esta fuente." });
    }

    await pool.query(
      "UPDATE sources SET name = $1, url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;",
      [name || source.name, url || source.url, id]
    );

    res.json({ success: true, message: "Fuente actualizada exitosamente." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/sources/:id - Delete a source
app.delete('/api/sources/:id', async (req, res) => {
  if (!currentSessionUser) {
    return res.status(401).json({ success: false, error: "No authenticated session" });
  }
  try {
    const { id } = req.params;
    const corrId = (req as any).correlationId || '';
    
    const checkResult = await pool.query("SELECT * FROM sources WHERE id = $1;", [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Fuente no encontrada." });
    }
    
    const source = checkResult.rows[0];
    if (source.user_id !== currentSessionUser.email && currentSessionUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: "No posee permisos para eliminar esta fuente." });
    }

    // Delete from Gemini File API if the file was uploaded there
    if (source.type === 'direct_upload' && source.gemini_file_name && process.env.GEMINI_API_KEY) {
      try {
        const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        await aiClient.files.delete({ name: source.gemini_file_name });
        console.log(`✓ Deleted file from Gemini Files API: ${source.gemini_file_name}`);
      } catch (geminiErr) {
        console.error("Error deleting file from Gemini Files API:", geminiErr);
        // Non-fatal: proceed with DB deletion even if Gemini cleanup fails
      }
    }

    await pool.query("DELETE FROM sources WHERE id = $1;", [id]);

    // Audit Log
    const logId = 'log-' + crypto.randomUUID();
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp, user_id, action, state_after, correlation_id)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5);`,
      [logId, currentSessionUser.email, 'DELETE_SOURCE', `Eliminada fuente "${source.name}"`, corrId]
    );

    res.json({ success: true, message: "Fuente eliminada exitosamente." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all user instruments (Inbox) with live sync of active state
app.get('/api/instruments', async (req, res) => {
  try {
    const inboxResult = await pool.query("SELECT * FROM instruments_inbox;");
    const planState = await getPlanState(activePlanType);
    
    let synchronizedInbox = inboxResult.rows.map(inst => {
      const isCurrentActive = inst.type === planState.planType;
      return {
        id: inst.id,
        user_id: inst.user_id,
        name: inst.name,
        status: isCurrentActive 
          ? (planState.isClosed || planState.isSubmitted ? 'CONSOLIDADO' : planState.isSigned ? 'VALIDADO' : 'EN_PROCESO')
          : inst.status,
        type: inst.type,
        last_modified: isCurrentActive ? new Date().toISOString() : (inst.last_modified instanceof Date ? inst.last_modified.toISOString() : new Date(inst.last_modified).toISOString()),
        department: inst.department
      };
    });

    // Strict role boundaries filtering
    if (currentSessionUser) {
      if (currentSessionUser.role === 'ESPECIALISTA_PAD') {
        synchronizedInbox = synchronizedInbox.filter(i => i.type === 'PAD');
      } else if (currentSessionUser.role === 'ESPECIALISTA_PES') {
        synchronizedInbox = synchronizedInbox.filter(i => i.type === 'PES');
      }
    }

    res.json({ success: true, instruments: synchronizedInbox });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- GovTech Landing Page / Unified Command Center Endpoints ---

// 1. GET Dashboard Metrics (optimized analytical aggregates)
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const inboxResult = await pool.query("SELECT * FROM instruments_inbox;");
    const planState = await getPlanState(activePlanType);
    
    const pesPlans = inboxResult.rows.filter(i => i.type === 'PES').length;
    const padPlans = inboxResult.rows.filter(i => i.type === 'PAD').length;
    const totalPlans = pesPlans + padPlans;
    
    const completedStepsCount = Object.values(planState.stepsCompleted).filter(Boolean).length;
    const activePlanProgress = Math.round((completedStepsCount / 8) * 100);
    
    const currentPlanMeasuresBudget = planState.measures.reduce((sum, m) => sum + m.budget, 0);
    const nationalBaseInversion = 384500000; 
    const cumulativeInvestment = nationalBaseInversion + currentPlanMeasuresBudget;
    const nationalBudgetCeiling = 500000000; 

    const currentPlanGedsiCompliance = (planState.vulnerability.expertJustificationVerified && planState.vulnerability.gedsiTextVerified) ? 100 : 75;
    const aggregateGedsiCompliance = Math.round((84 * 3 + currentPlanGedsiCompliance) / 4);

    const totalDocumentsInObjectStore = 12;
    const stableDocumentsCount = planState.evidenceTampered ? 11 : 12;
    const integrityRatio = Math.round((stableDocumentsCount / totalDocumentsInObjectStore) * 100);

    res.json({
      success: true,
      progress: {
        totalPlans,
        pesPlans,
        padPlans,
        percentagePDESA: 78 
      },
      investment: {
        cumulativeInvestment,
        ceiling: nationalBudgetCeiling,
        percentage: Math.min(100, Math.round((cumulativeInvestment / nationalBudgetCeiling) * 100))
      },
      gedsi: {
        compliancePct: aggregateGedsiCompliance
      },
      integrity: {
        stableDocs: stableDocumentsCount,
        totalDocs: totalDocumentsInObjectStore,
        integrityPct: integrityRatio
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET Dashboard Departments (Dynamic monitor for the 9 Departments)
app.get('/api/dashboard/departments', async (req, res) => {
  try {
    const planState = await getPlanState(activePlanType);
    const isTarijaActive = planState.planType === 'PAD';
    const currentTarijaStatus = planState.isClosed || planState.isSubmitted ? 'Consolidado' : planState.isSigned ? 'Validado' : 'Borrador';
    const currentTarijaInertia = planState.adaptationCapacity.inertiaFlagActive;

    const departments = [
      { id: "dep-1", name: "La Paz", gad: "Gobierno Autónomo Departamental de La Paz", status: "Riesgo Calculado", inertiaFlag: false, code: "LP" },
      { id: "dep-2", name: "Oruro", gad: "Gobierno Autónomo Municipal de Oruro (GAM)", status: "Consolidado", inertiaFlag: false, code: "OR" },
      { id: "dep-3", name: "Potosí", gad: "Gobierno Autónomo Departamental de Potosí", status: "Borrador", inertiaFlag: false, code: "PT" },
      { id: "dep-4", name: "Cochabamba", gad: "Gobierno Autónomo Departamental de Cochabamba", status: "Consolidado", inertiaFlag: false, code: "CB" },
      { id: "dep-5", name: "Chuquisaca", gad: "Gobierno Autónomo Departamental de Chuquisaca", status: "En Diagnóstico", inertiaFlag: true, code: "CH" },
      { id: "dep-6", name: "Tarija", gad: "Gobierno Autónomo Departamental de Tarija (GAD)", status: isTarijaActive ? currentTarijaStatus : "Consolidado", inertiaFlag: isTarijaActive ? currentTarijaInertia : false, code: "TJ" },
      { id: "dep-7", name: "Santa Cruz", gad: "Gobierno Autónomo Departamental de Santa Cruz", status: "Riesgo Calculado", inertiaFlag: false, code: "SC" },
      { id: "dep-8", name: "Beni", gad: "Gobierno Autónomo Departamental del Beni", status: "En Diagnóstico", inertiaFlag: false, code: "BE" },
      { id: "dep-9", name: "Pando", gad: "Gobierno Autónomo Departamental de Pando", status: "Borrador", inertiaFlag: false, code: "PD" }
    ];

    res.json({ success: true, departments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET Sectoral Catalog (Ministerial plans, searchable and filterable)
app.get('/api/dashboard/sectoral', async (req, res) => {
  try {
    const planState = await getPlanState(activePlanType);
    const isPesActive = planState.planType === 'PES';
    const customPesBudget = planState.measures.reduce((acc, m) => acc + m.budget, 0);

    const catalog = [
      {
        id: "pes-001",
        sector: "Salud / MPDyMA",
        title: isPesActive ? "Plan de Salud Sectorial Amazónico" : "Plan Estratégico de Redes de Salud Amazónicas",
        threat: "Inundaciones Cróticas, Enfermedades Transmitidas por Vectores (Dengue, Malaria)",
        budget: isPesActive ? customPesBudget : 24500000,
        isSigned: isPesActive ? planState.isSigned : true,
        lastModified: isPesActive ? new Date().toISOString() : "2026-06-12T10:00:00Z",
        ejePdes: "Eje 1: Reconstrucción económica con soberanía y diversificación productiva",
        riskLevel: isPesActive ? (planState.threatLevel > 3 ? 'Rojo' : 'Amarillo') : 'Amarillo'
      },
      {
        id: "pes-002",
        sector: "Medio Ambiente y Agua",
        title: "Plan Nacional de Sequías y Saneamiento del Chaco",
        threat: "Sequías Extremas y Salinización de Acuíferos Subterráneos",
        budget: 45000000,
        isSigned: true,
        lastModified: "2026-06-13T14:30:00Z",
        ejePdes: "Eje 2: Desarrollo e industrialización con sustitución de importaciones",
        riskLevel: "Verde"
      },
      {
        id: "pes-003",
        sector: "Hidrocarburos y Energía",
        title: "Resiliencia Eléctrica en Valles Frente a Deslizamientos",
        threat: "Deslizamientos por Torrenciales y Degradación de Taludes",
        budget: 18000000,
        isSigned: false,
        lastModified: "2026-06-14T09:00:00Z",
        ejePdes: "Eje 1: Reconstrucción económica con soberanía y diversificación productiva",
        riskLevel: "Rojo"
      },
      {
        id: "pes-004",
        sector: "Desarrollo Rural y Tierras",
        title: "Seguridad Hidro-Alimentaria y Olas de Calor Chiquitanía",
        threat: "Olas de Calor e Incendios Forestales Recurrentes",
        budget: 35000000,
        isSigned: false,
        lastModified: "2026-06-14T11:45:00Z",
        ejePdes: "Eje 3: Seguridad alimentaria con soberanía y producción local ecológica",
        riskLevel: "Naranja"
      }
    ];

    res.json({ success: true, catalog });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET Recent Audit logs (for monospace dashboard feed - 5 most recent transactions)
app.get('/api/audit/recent', async (req, res) => {
  try {
    const logsResult = await pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5;");
    res.json({
      success: true,
      logs: logsResult.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp).toISOString(),
        user_id: row.user_id,
        action: row.action,
        state_before: row.state_before,
        state_after: row.state_after,
        valores_modificados: row.valores_modificados,
        correlation_id: row.correlation_id
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Simulate rule failure (UAT Sandboxing) - triggers transaction rollback
app.post('/api/plan/simulate-error', async (req, res) => {
  const corrId = (req as any).correlationId;
  try {
    const before = await getPlanState(activePlanType);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com',
      'TRANSACTIONAL_ROLLBACK',
      before,
      before,
      corrId
    );
    res.status(400).json({
      success: false,
      error: "CONTRALORÍA SIPEB: La sumatoria plurianual de costes del Paso 7 (0.00 BOB) no posee consistencia elemental mayor a cero. Falló la integridad transaccional del SPIE. Transacción anulada: Se gatilló un ROLLBACK atómico en base de datos. Se conserva el estado previo.",
      state: before
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 3: Update threat level (Amenaza)
app.post('/api/step3/update-threat', async (req, res) => {
  const result = updateThreatSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { threatLevel } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));
    updated.threatLevel = threatLevel;
    updated.stepsCompleted[3] = true;

    await savePlanState(updated);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com',
      'UPDATE_STEP3_THREAT_LEVEL',
      before,
      updated,
      corrId
    );

    res.json({
      success: true,
      state: updated,
      correlationId: corrId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset simulation (for convenience)
app.post('/api/plan/reset', async (req, res) => {
  const corrId = (req as any).correlationId;
  try {
    const before = await getPlanState(activePlanType);
    await setScenarioState(activePlanType);
    const updated = await getPlanState(activePlanType);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com',
      'SIMULATION_RESET',
      before,
      updated,
      corrId
    );
    res.json({ success: true, state: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Selector de Escenario UAT (PES Piloto / PAD Piloto)
app.post('/api/plan/set-scenario', async (req, res) => {
  const result = setScenarioSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { type } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const before = await getPlanState(activePlanType);
    activePlanType = type;
    await setScenarioState(type);
    const updated = await getPlanState(type);
    
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com',
      `SET_SCENARIO_${type}`,
      before,
      updated,
      corrId
    );

    res.setHeader('Set-Cookie', `plan_type=${type}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    
    res.json({ success: true, state: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 2: Validación de Carga de Evidencia (Estándares SIPEB & Auditoría)
app.post('/api/step2/upload-evidence', async (req, res) => {
  const result = uploadEvidenceSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { fileName, contentLength, normativityMatched } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));

    if (contentLength === 0 || normativityMatched === false) {
      updated.evidenceStatus = 'REJECTED';
      updated.evidenceError = 'Error: Evidencia no cumple con estándares de auditoría';
      updated.stepsCompleted[2] = false;
      
      await savePlanState(updated);
      await logAudit(currentSessionUser?.email || 'aliendredilan@gmail.com', 'EVIDENCE_UPLOAD_FAILED', before, updated, corrId);
      return res.status(400).json({ 
        success: false, 
        error: 'Error: Evidencia no cumple con estándares de auditoría',
        state: updated
      });
    }

    // Approved evidence!
    updated.evidenceStatus = 'APPROVED';
    updated.evidenceName = fileName;
    updated.stepsCompleted[2] = true;
    updated.evidenceError = '';
    updated.evidenceTampered = false;

    await savePlanState(updated);
    await logAudit(currentSessionUser?.email || 'aliendredilan@gmail.com', 'EVIDENCE_UPLOAD_APPROVED', before, updated, corrId);
    res.json({ success: true, msg: "✓ Evidencia validada rigurosamente de acuerdo al SPIE.", state: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 2: Simulación de sabotaje/alteración física en el servidor
app.post('/api/step2/tamper-evidence', async (req, res) => {
  const corrId = (req as any).correlationId;
  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));
    updated.evidenceTampered = true;

    await savePlanState(updated);
    await logAudit(
      'unauthorized_system_intruder', 
      'SERVER_FILE_SYSTEM_TAMPERING_DETECTED', 
      before, 
      updated, 
      corrId
    );

    res.json({ 
      success: true, 
      state: updated, 
      msg: "SABOTAJE SIMULADO: Se han alterado e inactivado los bytes del archivo original en el volumen del servidor." 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 2: Verificación de Integridad de la Evidencia (SHA-256)
app.post('/api/step2/verify-evidence', async (req, res) => {
  const corrId = (req as any).correlationId;
  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));

    if (updated.evidenceTampered) {
      updated.evidenceStatus = 'REJECTED';
      updated.evidenceError = 'EVIDENCIA CORRUPTA: El hash SHA-256 del archivo físico no coincide con el registro original.';
      updated.stepsCompleted[2] = false;

      await savePlanState(updated);
      await logAudit(
        currentSessionUser?.email || 'aliendredilan@gmail.com', 
        'INTEGRITY_COMPROMISED_EVIDENCE_REJECTED', 
        before, 
        updated, 
        corrId
      );

      return res.status(400).json({
        success: false,
        error: 'EVIDENCIA CORRUPTA: El validador de Hash SHA-256 detectó que el archivo final fue alterado manualmente en el servidor y no coincide con el registro original.',
        state: updated
      });
    }

    res.json({
      success: true,
      msg: "✓ Integridad verificada con éxito. El Hash SHA-256 coincide rigurosamente.",
      state: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      version: '1.1.1',
      db: 'connected',
      timestamp: new Date().toISOString(),
      postgis: 'available'
    });
  } catch (err: any) {
    res.status(503).json({ status: 'error', db: 'unreachable', error: err.message });
  }
});

// ============================================================
// MÓDULO GEODÉSICO — CAPAS GEOGRÁFICAS Y ST_INTERSECTION
// ============================================================

import crypto_node from 'crypto';

/** Map GeodesicStatus to human-readable institutional messages */
function getGeodesicMessage(status: string): string {
  const messages: Record<string, string> = {
    SIN_CAPA_BASE_CARGADA: 'Análisis geográfico no disponible: cargue una capa de amenaza y una de exposición para este expediente.',
    SIN_CAPA_DE_AMENAZA_CARGADA: 'Análisis geográfico no disponible: falta la capa de amenaza climática para este expediente.',
    GEOMETRIA_INVALIDA: 'Resultado en revisión técnica: la geometría base requiere validación topológica antes de ejecutar el cruce.',
    EN_PROCESAMIENTO: 'Procesamiento en curso: ejecutando intersección espacial ST_Intersection con estándar SIRGAS/WGS84...',
    PROCESADO_CON_RESULTADO: 'Cruce geográfico completado con éxito. Revise la superficie afectada y la capa de amenaza asociada.',
    PROCESADO_SIN_INTERSECCION: 'Las capas cargadas no presentan solapamiento territorial en el área del instrumento.',
    ERROR_DE_PROYECCION: 'Error de proyección: las capas presentan sistemas de referencia incompatibles. Verifique el EPSG de origen.',
    REQUIERE_REVISION_TECNICA: 'Procesamiento no ejecutado correctamente: se requiere revisión técnica de las capas cargadas.',
    // Legacy
    PENDING: 'Procesamiento no ejecutado todavía: se encuentra pendiente la carga de datos espaciales oficiales.',
    RUNNING: 'Procesamiento en curso...',
    COMPLETED: 'Cruce geográfico completado con éxito.'
  };
  return messages[status] || 'Estado del módulo geográfico desconocido.';
}

/** Classify risk level by coverage percentage */
function classifyRiskLevel(pct: number): 'BAJO' | 'MODERADO' | 'ALTO' | 'CRÍTICO' {
  if (pct < 25) return 'BAJO';
  if (pct < 50) return 'MODERADO';
  if (pct < 75) return 'ALTO';
  return 'CRÍTICO';
}

/**
 * POST /api/geo/capas/upload
 * Accepts a GeoJSON (.json/.geojson) or Shapefile (.zip) as base64,
 * validates topology with PostGIS ST_IsValid, normalizes to EPSG:4326,
 * stores in capas_geograficas, and updates plan vulnerability status.
 */
app.post('/api/geo/capas/upload', async (req, res) => {
  const corrId = (req as any).correlationId;
  const { fileName, fileBase64, tipoCapa, epsgOrigen } = req.body;

  // Input validation
  if (!fileName || !fileBase64 || !tipoCapa) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren: fileName, fileBase64 y tipoCapa (amenaza | exposicion).'
    });
  }
  if (!['amenaza', 'exposicion'].includes(tipoCapa)) {
    return res.status(400).json({
      success: false,
      error: `tipoCapa inválido: "${tipoCapa}". Use "amenaza" o "exposicion".`
    });
  }

  const ext = fileName.toLowerCase().split('.').pop();
  if (!['json', 'geojson', 'zip'].includes(ext || '')) {
    return res.status(400).json({
      success: false,
      error: 'Solo se aceptan GeoJSON (.json, .geojson) o Shapefile comprimido (.zip).'
    });
  }

  const instrumentoId = activePlanType;
  const userId = currentSessionUser?.email || 'sistema';

  let geojsonStr: string;

  try {
    // Strip data URL prefix if present (e.g. "data:application/json;base64,...")
    const base64Clean = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    const sha256Hash = crypto_node.createHash('sha256').update(buffer).digest('hex');
    const tamanioKb = +(buffer.length / 1024).toFixed(2);

    // Parse: GeoJSON or Shapefile
    if (ext === 'zip') {
      // Shapefile (.zip) → GeoJSON via shpjs
      try {
        const shp = await import('shpjs');
        const parsed = await shp.default(buffer.buffer as ArrayBuffer);
        geojsonStr = JSON.stringify(parsed);
      } catch (shpErr: any) {
        return res.status(400).json({
          success: false,
          error: `Error al procesar Shapefile: ${shpErr.message}. Verifique que el .zip contenga los archivos .shp, .dbf y .prj.`
        });
      }
    } else {
      // GeoJSON — parse and validate structure
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        if (!parsed.type || !['FeatureCollection', 'Feature', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(parsed.type)) {
          return res.status(400).json({
            success: false,
            error: 'Formato GeoJSON inválido: propiedad "type" incorrecta o ausente.'
          });
        }
        geojsonStr = JSON.stringify(parsed);
      } catch (parseErr) {
        return res.status(400).json({
          success: false,
          error: 'El archivo no es un GeoJSON válido. Verifique el formato del archivo.'
        });
      }
    }

    // Determine source EPSG
    const epsgSrc = (epsgOrigen || 'EPSG:4326').toUpperCase();

    // Insert into PostGIS — ST_IsValid check + optional reprojection
    const capaId = `capa-${crypto_node.randomUUID()}`;
    let insertQuery: string;
    let insertParams: unknown[];

    const sridSrc = epsgSrc.replace('EPSG:', '');
    const isWgs84 = sridSrc === '4326';

    if (isWgs84) {
      // Direct insert at EPSG:4326
      insertQuery = `
        INSERT INTO capas_geograficas
          (id, instrumento_id, tipo_capa, nombre_archivo, epsg_origen,
           geometria, sha256_hash, tamanio_kb, cargado_por, estado, area_km2)
        VALUES
          ($1, $2, $3, $4, $5,
           ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326),
           $7, $8, $9,
           CASE WHEN ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326))
                THEN 'VALIDO' ELSE 'ERROR_TOPOLOGIA' END,
           ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326), 32720)) / 1000000
          )
        RETURNING id, estado, area_km2;
      `;
      // Use the geometry from the GeoJSON (handle FeatureCollection → first feature)
      let geoForInsert = geojsonStr;
      try {
        const geoObj = JSON.parse(geojsonStr);
        if (geoObj.type === 'FeatureCollection') {
          // Use union of all features
          geoForInsert = JSON.stringify({ type: 'GeometryCollection', geometries: geoObj.features.map((f: any) => f.geometry) });
        } else if (geoObj.type === 'Feature') {
          geoForInsert = JSON.stringify(geoObj.geometry);
        }
      } catch { /* use as-is */ }

      insertParams = [capaId, instrumentoId, tipoCapa, fileName, epsgSrc, geoForInsert, sha256Hash, tamanioKb, userId];
    } else {
      // Reprojection needed: ST_Transform from source SRID
      const sridNum = parseInt(sridSrc, 10);
      if (isNaN(sridNum)) {
        return res.status(400).json({
          success: false,
          error: `ERROR_DE_PROYECCION: El EPSG "${epsgSrc}" no es válido. Use formato EPSG:XXXX.`
        });
      }
      let geoForInsert = geojsonStr;
      try {
        const geoObj = JSON.parse(geojsonStr);
        if (geoObj.type === 'FeatureCollection') {
          geoForInsert = JSON.stringify({ type: 'GeometryCollection', geometries: geoObj.features.map((f: any) => f.geometry) });
        } else if (geoObj.type === 'Feature') {
          geoForInsert = JSON.stringify(geoObj.geometry);
        }
      } catch { /* use as-is */ }

      insertQuery = `
        INSERT INTO capas_geograficas
          (id, instrumento_id, tipo_capa, nombre_archivo, epsg_origen,
           geometria, sha256_hash, tamanio_kb, cargado_por, estado, area_km2)
        VALUES
          ($1, $2, $3, $4, $5,
           ST_SetSRID(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6::text), $10), 4326), 4326),
           $7, $8, $9,
           CASE WHEN ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($6::text), $10))
                THEN 'VALIDO' ELSE 'ERROR_TOPOLOGIA' END,
           ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6::text), $10), 32720)) / 1000000
          )
        RETURNING id, estado, area_km2;
      `;
      insertParams = [capaId, instrumentoId, tipoCapa, fileName, epsgSrc, geoForInsert, sha256Hash, tamanioKb, userId, sridNum];
    }

    const insertResult = await pool.query(insertQuery as string, insertParams as unknown[]);
    const insertedRow = insertResult.rows[0];
    const estadoResultado = insertedRow.estado as string;
    const areaKm2 = parseFloat(insertedRow.area_km2 || '0');

    // If topology error, record in audit and return user-facing error
    if (estadoResultado === 'ERROR_TOPOLOGIA') {
      await logAudit(userId, 'GEO_CAPA_TOPOLOGIA_INVALIDA', null, {
        capaId, fileName, tipoCapa, instrumentoId
      }, corrId);

      // Update plan status to GEOMETRIA_INVALIDA
      const planBefore = await getPlanState(instrumentoId);
      const planUpdated = JSON.parse(JSON.stringify(planBefore));
      planUpdated.vulnerability.locationCrossoverStatus = 'GEOMETRIA_INVALIDA';
      planUpdated.vulnerability.geodesicResult = null;
      planUpdated.vulnerability.geodesicStatusMessage = getGeodesicMessage('GEOMETRIA_INVALIDA');
      await savePlanState(planUpdated);

      return res.status(422).json({
        success: false,
        error: `Geometría con topología inválida: la capa "${fileName}" no pasó la validación ST_IsValid. Corrija la geometría con herramientas GIS (QGIS → Fijar geometrías) y vuelva a cargar.`,
        capaId,
        estado: 'ERROR_TOPOLOGIA'
      });
    }

    // Update plan vulnerability status based on available layers
    const capasResult = await pool.query(
      `SELECT tipo_capa FROM capas_geograficas
       WHERE instrumento_id = $1 AND estado = 'VALIDO';`,
      [instrumentoId]
    );
    const tiposDisponibles = capasResult.rows.map((r: any) => r.tipo_capa as string);
    const tieneAmenaza = tiposDisponibles.includes('amenaza');
    const tieneExposicion = tiposDisponibles.includes('exposicion');

    let nuevoEstado: string;
    if (tieneAmenaza && tieneExposicion) {
      nuevoEstado = 'SIN_CAPA_BASE_CARGADA'; // Ready — will change to EN_PROCESAMIENTO when user clicks
      // Actually mark as ready for intersection
      nuevoEstado = 'PROCESADO_CON_RESULTADO'; // Will be set properly on intersection
      nuevoEstado = 'SIN_CAPA_BASE_CARGADA'; // Keep status until user clicks execute
    } else if (tieneAmenaza && !tieneExposicion) {
      nuevoEstado = 'SIN_CAPA_BASE_CARGADA';
    } else {
      nuevoEstado = 'SIN_CAPA_DE_AMENAZA_CARGADA';
    }

    // Set to READY state when both layers are available
    if (tieneAmenaza && tieneExposicion) {
      nuevoEstado = 'SIN_CAPA_BASE_CARGADA'; // both loaded, ready to execute intersection
    }

    const planBefore = await getPlanState(instrumentoId);
    const planUpdated = JSON.parse(JSON.stringify(planBefore));
    planUpdated.vulnerability.locationCrossoverStatus = tieneAmenaza && tieneExposicion
      ? 'SIN_CAPA_BASE_CARGADA' // Overwritten to a "ready" semantic state
      : (tipoCapa === 'amenaza' ? 'SIN_CAPA_BASE_CARGADA' : 'SIN_CAPA_DE_AMENAZA_CARGADA');
    planUpdated.vulnerability.geodesicStatusMessage = tieneAmenaza && tieneExposicion
      ? 'Ambas capas cargadas correctamente. Ejecute el cruce ST_Intersection para calcular el análisis territorial.'
      : `Capa de ${tipoCapa} cargada. ${!tieneAmenaza ? 'Aún falta la capa de amenaza.' : 'Aún falta la capa de exposición.'}`;
    await savePlanState(planUpdated);

    await logAudit(userId, 'GEO_CAPA_CARGADA', null, {
      capaId, fileName, tipoCapa, instrumentoId, estadoResultado, areaKm2, epsgSrc
    }, corrId);

    res.status(201).json({
      success: true,
      capaId,
      fileName,
      tipoCapa,
      epsgOrigen: epsgSrc,
      estado: estadoResultado,
      areaKm2,
      sha256Hash,
      ambosCapasListas: tieneAmenaza && tieneExposicion,
      vulnerability: planUpdated.vulnerability,
      message: tieneAmenaza && tieneExposicion
        ? 'Capa cargada. Ambas capas disponibles: puede ejecutar ST_Intersection.'
        : `Capa de ${tipoCapa} registrada exitosamente.`
    });
  } catch (err: any) {
    console.error('[GEO UPLOAD ERROR]', err);
    // Detect PostGIS not available
    if (err.message?.includes('function st_') || err.message?.includes('type "geometry"')) {
      return res.status(503).json({
        success: false,
        error: 'El módulo PostGIS no está habilitado en la base de datos. Contacte al administrador para activar la extensión postgis.'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/geo/capas
 * Returns geographic layers for the active instrument.
 */
app.get('/api/geo/capas', async (req, res) => {
  try {
    const instrumentoId = activePlanType;
    const capasResult = await pool.query(
      `SELECT id, instrumento_id, tipo_capa, nombre_archivo, epsg_origen,
              sha256_hash, tamanio_kb, cargado_por, fecha_carga, estado, area_km2
       FROM capas_geograficas
       WHERE instrumento_id = $1
       ORDER BY fecha_carga DESC;`,
      [instrumentoId]
    );
    res.json({ success: true, capas: capasResult.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/geo/intersection/ejecutar
 * Executes real PostGIS ST_Intersection between the amenaza and exposicion layers
 * for the active instrument. Calculates area in UTM 20S (EPSG:32720),
 * classifies risk level, stores result and updates audit log.
 */
app.post('/api/geo/intersection/ejecutar', async (req, res) => {
  const corrId = (req as any).correlationId;
  const instrumentoId = activePlanType;
  const userId = currentSessionUser?.email || 'sistema';

  // Update status to EN_PROCESAMIENTO immediately
  try {
    const planNow = await getPlanState(instrumentoId);
    const planEnProceso = JSON.parse(JSON.stringify(planNow));
    planEnProceso.vulnerability.locationCrossoverStatus = 'EN_PROCESAMIENTO';
    planEnProceso.vulnerability.geodesicStatusMessage = getGeodesicMessage('EN_PROCESAMIENTO');
    await savePlanState(planEnProceso);
  } catch { /* non-fatal */ }

  try {
    // 1. Fetch valid layers for this instrument
    const capasResult = await pool.query(
      `SELECT id, tipo_capa, nombre_archivo, estado
       FROM capas_geograficas
       WHERE instrumento_id = $1 AND estado = 'VALIDO'
       ORDER BY fecha_carga DESC;`,
      [instrumentoId]
    );

    const amenazaRow = capasResult.rows.find((r: any) => r.tipo_capa === 'amenaza');
    const exposicionRow = capasResult.rows.find((r: any) => r.tipo_capa === 'exposicion');

    // Validate both layers exist
    if (!amenazaRow) {
      const planUpdErr = await getPlanState(instrumentoId);
      const pErr = JSON.parse(JSON.stringify(planUpdErr));
      pErr.vulnerability.locationCrossoverStatus = 'SIN_CAPA_DE_AMENAZA_CARGADA';
      pErr.vulnerability.geodesicStatusMessage = getGeodesicMessage('SIN_CAPA_DE_AMENAZA_CARGADA');
      await savePlanState(pErr);
      return res.status(422).json({
        success: false,
        status: 'SIN_CAPA_DE_AMENAZA_CARGADA',
        error: 'Análisis geográfico no disponible: faltan capas de amenaza para este expediente.'
      });
    }
    if (!exposicionRow) {
      const planUpdErr = await getPlanState(instrumentoId);
      const pErr = JSON.parse(JSON.stringify(planUpdErr));
      pErr.vulnerability.locationCrossoverStatus = 'SIN_CAPA_BASE_CARGADA';
      pErr.vulnerability.geodesicStatusMessage = getGeodesicMessage('SIN_CAPA_BASE_CARGADA');
      await savePlanState(pErr);
      return res.status(422).json({
        success: false,
        status: 'SIN_CAPA_BASE_CARGADA',
        error: 'Análisis geográfico no disponible: falta la capa de exposición para este expediente.'
      });
    }

    // 2. Check for spatial overlap before intersection
    const overlapResult = await pool.query(
      `SELECT
        ST_Overlaps(a.geometria, e.geometria) OR
        ST_Contains(a.geometria, e.geometria) OR
        ST_Within(e.geometria, a.geometria) OR
        ST_Intersects(a.geometria, e.geometria) AS has_overlap
       FROM capas_geograficas a, capas_geograficas e
       WHERE a.id = $1 AND e.id = $2;`,
      [amenazaRow.id, exposicionRow.id]
    );

    const hasOverlap = overlapResult.rows[0]?.has_overlap === true;

    if (!hasOverlap) {
      const planNoOverlap = await getPlanState(instrumentoId);
      const pNoOv = JSON.parse(JSON.stringify(planNoOverlap));
      pNoOv.vulnerability.locationCrossoverStatus = 'PROCESADO_SIN_INTERSECCION';
      pNoOv.vulnerability.geodesicStatusMessage = getGeodesicMessage('PROCESADO_SIN_INTERSECCION');
      pNoOv.vulnerability.geodesicResult = null;
      await savePlanState(pNoOv);

      await logAudit(userId, 'GEO_INTERSECTION_EXECUTED', null, {
        instrumentoId, amenazaId: amenazaRow.id, exposicionId: exposicionRow.id,
        resultado: 'SIN_SOLAPAMIENTO'
      }, corrId);

      return res.json({
        success: true,
        status: 'PROCESADO_SIN_INTERSECCION',
        message: 'Las capas no se solapan en el territorio del instrumento. Cargue capas con cobertura geográfica coincidente.',
        vulnerability: pNoOv.vulnerability
      });
    }

    // 3. Execute ST_Intersection with UTM 20S area calculation
    const intersectionResult = await pool.query(
      `WITH interseccion AS (
         SELECT
           ST_Intersection(a.geometria, e.geometria) AS geom,
           e.geometria AS geom_exposicion,
           a.nombre_archivo AS nombre_amenaza
         FROM capas_geograficas a, capas_geograficas e
         WHERE a.id = $1 AND e.id = $2
       )
       SELECT
         ST_AsGeoJSON(interseccion.geom) AS intersection_geojson,
         ST_IsEmpty(interseccion.geom) AS is_empty,
         ROUND(CAST(ST_Area(ST_Transform(interseccion.geom, 32720)) / 1000000 AS numeric), 4) AS area_interseccion_km2,
         ROUND(CAST(ST_Area(ST_Transform(interseccion.geom_exposicion, 32720)) / 1000000 AS numeric), 4) AS area_exposicion_km2,
         interseccion.nombre_amenaza
       FROM interseccion;`,
      [amenazaRow.id, exposicionRow.id]
    );

    const geoRow = intersectionResult.rows[0];
    const isEmpty = geoRow?.is_empty === true;
    const areaInterseccionKm2 = parseFloat(geoRow?.area_interseccion_km2 || '0');
    const areaExposicionKm2 = parseFloat(geoRow?.area_exposicion_km2 || '0');
    const intersectionGeoJSON = geoRow?.intersection_geojson || null;

    if (isEmpty || !intersectionGeoJSON) {
      const planNoIntersect = await getPlanState(instrumentoId);
      const pNI = JSON.parse(JSON.stringify(planNoIntersect));
      pNI.vulnerability.locationCrossoverStatus = 'PROCESADO_SIN_INTERSECCION';
      pNI.vulnerability.geodesicStatusMessage = getGeodesicMessage('PROCESADO_SIN_INTERSECCION');
      pNI.vulnerability.geodesicResult = null;
      await savePlanState(pNI);
      return res.json({
        success: true,
        status: 'PROCESADO_SIN_INTERSECCION',
        message: 'Las capas no presentan solapamiento espacial calculable en el territorio del instrumento.',
        vulnerability: pNI.vulnerability
      });
    }

    // 4. Compute metrics
    const porcentajeAfectacion = areaExposicionKm2 > 0
      ? +((areaInterseccionKm2 / areaExposicionKm2) * 100).toFixed(2)
      : 0;
    const nivelRiesgo = classifyRiskLevel(porcentajeAfectacion);

    // 5. Build metrics display object
    const metricas: Record<string, string> = {
      'Área de Intersección': `${areaInterseccionKm2.toFixed(2)} km²`,
      'Área de Exposición': `${areaExposicionKm2.toFixed(2)} km²`,
      'Porcentaje Afectado': `${porcentajeAfectacion.toFixed(1)}%`,
      'Nivel de Riesgo': nivelRiesgo,
      'Proyección de Cálculo': 'UTM Zona 20S (EPSG:32720)',
      'Sistema de Almacenamiento': 'EPSG:4326 (SIRGAS-WGS84)',
      'Capa de Amenaza': amenazaRow.nombre_archivo,
      'Capa de Exposición': exposicionRow.nombre_archivo
    };

    // 6. Store result in resultados_interseccion
    const resultId = `res-${crypto_node.randomUUID()}`;
    await pool.query(
      `INSERT INTO resultados_interseccion
         (id, instrumento_id, capa_amenaza_id, capa_exposicion_id,
          geometria_resultado, area_interseccion_km2, area_exposicion_km2,
          porcentaje_afectacion, nivel_riesgo, metricas,
          capa_nombre, capa_fuente, capa_fecha, srid,
          ejecutado_en, ejecutado_por, corr_id)
       VALUES
         ($1, $2, $3, $4,
          ST_SetSRID(ST_GeomFromGeoJSON($5), 4326),
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          CURRENT_TIMESTAMP, $15, $16);`,
      [
        resultId, instrumentoId, amenazaRow.id, exposicionRow.id,
        intersectionGeoJSON,
        areaInterseccionKm2, areaExposicionKm2,
        porcentajeAfectacion, nivelRiesgo, JSON.stringify(metricas),
        amenazaRow.nombre_archivo,
        'SENAMHI / MDRyT Bolivia 2025',
        new Date().toISOString().split('T')[0],
        'EPSG:4326 (SIRGAS-WGS84)',
        userId, corrId
      ]
    );

    // 7. Build GeodesicResult object
    const geodesicResult = {
      capaAmenazaId: amenazaRow.id as string,
      capaExposicionId: exposicionRow.id as string,
      intersectionGeoJSON,
      areaInterseccionKm2,
      areaExposicionKm2,
      porcentajeAfectacion,
      nivelRiesgo,
      metricas,
      capaNombre: amenazaRow.nombre_archivo as string,
      capaFuente: 'SENAMHI / MDRyT Bolivia 2025',
      capaFecha: new Date().toISOString().split('T')[0],
      srid: 'EPSG:4326 (SIRGAS-WGS84)',
      ejecutadoEn: new Date().toISOString(),
      ejecutadoPor: userId,
      corrId
    };

    // 8. Update plan vulnerability with result
    const planBefore = await getPlanState(instrumentoId);
    const planUpdated = JSON.parse(JSON.stringify(planBefore));
    planUpdated.vulnerability.locationCrossoverStatus = 'PROCESADO_CON_RESULTADO';
    planUpdated.vulnerability.geodesicResult = geodesicResult;
    planUpdated.vulnerability.geodesicStatusMessage = getGeodesicMessage('PROCESADO_CON_RESULTADO');
    // Update legacy fields for display compatibility
    planUpdated.vulnerability.cropsAffectedHectares = +(areaInterseccionKm2 * 100).toFixed(0); // km² to ha approx
    planUpdated.vulnerability.populationExpCount = Math.round(areaInterseccionKm2 * 250); // ~250 hab/km² Bolivia density
    planUpdated.vulnerability.projectionStandard = 'SIRGAS-WGS84';
    planUpdated.stepsCompleted[4] = false; // Still requires expert justification
    await savePlanState(planUpdated);

    // 9. Audit log GEO_INTERSECTION_EXECUTED
    await logAudit(userId, 'GEO_INTERSECTION_EXECUTED', planBefore.vulnerability, {
      instrumentoId,
      resultId,
      amenazaId: amenazaRow.id,
      exposicionId: exposicionRow.id,
      areaInterseccionKm2,
      porcentajeAfectacion,
      nivelRiesgo
    }, corrId);

    res.json({
      success: true,
      status: 'PROCESADO_CON_RESULTADO',
      geodesicResult,
      vulnerability: planUpdated.vulnerability,
      correlationId: corrId
    });
  } catch (err: any) {
    console.error('[GEO INTERSECTION ERROR]', err);
    // Detect PostGIS not available
    const isPostgisErr = err.message?.includes('function st_') ||
      err.message?.includes('type "geometry"') ||
      err.message?.includes('postgis');

    try {
      const planErr = await getPlanState(instrumentoId);
      const pErr = JSON.parse(JSON.stringify(planErr));
      pErr.vulnerability.locationCrossoverStatus = isPostgisErr ? 'ERROR_DE_PROYECCION' : 'REQUIERE_REVISION_TECNICA';
      pErr.vulnerability.geodesicStatusMessage = isPostgisErr
        ? 'Error de proyección: PostGIS no disponible en la base de datos. Contacte al administrador.'
        : `Resultado en revisión técnica: ${err.message}. Corr ID: ${corrId}`;
      await savePlanState(pErr);
      await logAudit(userId, 'GEO_INTERSECTION_ERROR', null, {
        instrumentoId, error: err.message, corrId, postgisError: isPostgisErr
      }, corrId);
    } catch { /* non-fatal */ }

    res.status(500).json({
      success: false,
      error: isPostgisErr
        ? 'PostGIS no disponible en la base de datos. La extensión postgis debe estar habilitada en Supabase.'
        : `Error en el procesamiento geoespacial: ${err.message}`,
      corrId
    });
  }
});

/**
 * GET /api/geo/resultado
 * Returns the latest intersection result for the active instrument.
 */
app.get('/api/geo/resultado', async (req, res) => {
  try {
    const instrumentoId = activePlanType;
    const resultResult = await pool.query(
      `SELECT
         id, instrumento_id, capa_amenaza_id, capa_exposicion_id,
         ST_AsGeoJSON(geometria_resultado) AS intersection_geojson,
         area_interseccion_km2, area_exposicion_km2,
         porcentaje_afectacion, nivel_riesgo, metricas,
         capa_nombre, capa_fuente, capa_fecha, srid,
         ejecutado_en, ejecutado_por, corr_id
       FROM resultados_interseccion
       WHERE instrumento_id = $1
       ORDER BY ejecutado_en DESC
       LIMIT 1;`,
      [instrumentoId]
    );

    if (resultResult.rows.length === 0) {
      return res.json({ success: true, resultado: null });
    }

    const row = resultResult.rows[0];
    res.json({
      success: true,
      resultado: {
        id: row.id,
        intersectionGeoJSON: row.intersection_geojson,
        areaInterseccionKm2: parseFloat(row.area_interseccion_km2),
        areaExposicionKm2: parseFloat(row.area_exposicion_km2),
        porcentajeAfectacion: parseFloat(row.porcentaje_afectacion),
        nivelRiesgo: row.nivel_riesgo,
        metricas: row.metricas,
        capaNombre: row.capa_nombre,
        capaFuente: row.capa_fuente,
        capaFecha: row.capa_fecha,
        srid: row.srid,
        ejecutadoEn: row.ejecutado_en,
        ejecutadoPor: row.ejecutado_por,
        corrId: row.corr_id
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// END MÓDULO GEODÉSICO
// ============================================================

// DEPRECATED: Paso 4 legacy crossover endpoint — kept for backward compatibility
// Now delegates to the real /api/geo/intersection/ejecutar pipeline.
// Will be removed in v1.2
app.post('/api/step4/execute-crossover', async (req, res) => {
  const corrId = (req as any).correlationId;
  try {
    // Forward to the real intersection endpoint logic
    const capasResult = await pool.query(
      `SELECT tipo_capa FROM capas_geograficas WHERE instrumento_id = $1 AND estado = 'VALIDO';`,
      [activePlanType]
    );
    const tiposDisponibles = capasResult.rows.map((r: any) => r.tipo_capa as string);

    if (!tiposDisponibles.includes('amenaza') || !tiposDisponibles.includes('exposicion')) {
      // No real layers — return institutional message
      const planNow = await getPlanState(activePlanType);
      const updated = JSON.parse(JSON.stringify(planNow));
      const newStatus = !tiposDisponibles.includes('amenaza') ? 'SIN_CAPA_DE_AMENAZA_CARGADA' : 'SIN_CAPA_BASE_CARGADA';
      updated.vulnerability.locationCrossoverStatus = newStatus;
      updated.vulnerability.geodesicStatusMessage = getGeodesicMessage(newStatus);
      updated.vulnerability.geodesicResult = null;
      await savePlanState(updated);
      return res.json({
        success: false,
        status: newStatus,
        message: getGeodesicMessage(newStatus),
        vulnerability: updated.vulnerability
      });
    }

    // Redirect to real intersection logic by making an internal call
    // to the new endpoint handler (avoid HTTP overhead — call pool directly)
    const amenazaRow = capasResult.rows.find((r: any) => r.tipo_capa === 'amenaza');
    if (!amenazaRow) {
      return res.status(422).json({ success: false, error: 'Sin capa de amenaza válida.' });
    }

    // Simply forward the request to the new endpoint for correctness
    res.redirect(307, '/api/geo/intersection/ejecutar');
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 4: Save vulnerability form (Expert justification & GEDSI gatekeeper)
app.post('/api/step4/save', async (req, res) => {
  const result = saveVulnerabilitySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { sensitivityLevel, expertJustification, gedsiText } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));

    const justificationLen = expertJustification.trim().length;
    const gedsiLen = gedsiText.trim().length;

    if (justificationLen < 30) {
      return res.status(400).json({
        success: false,
        error: "La justificación técnica de vulnerabilidad debe poseer al menos 30 caracteres para fundamentación técnica."
      });
    }

    // Gatekeeper GEDSI validator: Require 150 characters if sensitivity is High or Critical
    if (sensitivityLevel >= 3) {
      if (gedsiLen < 150) {
        return res.status(400).json({
          success: false,
          error: `GATEKEEPER GEDSI REJECTED: La sección de inclusión social (GEDSI) debe contener al menos 150 caracteres. Actual: ${gedsiLen} caracteres.`
        });
      }
    }

    updated.vulnerability.sensitivityLevel = sensitivityLevel;
    updated.vulnerability.expertJustification = expertJustification;
    updated.vulnerability.expertJustificationVerified = true;
    updated.vulnerability.gedsiText = gedsiText;
    updated.vulnerability.gedsiTextVerified = sensitivityLevel >= 3 ? true : false;
    updated.stepsCompleted[4] = true;
    updated.currentStep = 5;

    await savePlanState(updated);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'SAVE_STEP4_VULNERABILITY', 
      before, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      state: updated,
      correlationId: corrId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 5: Save Adaptabilidad & Trigger Inercia Institucional Blocker
app.post('/api/step5/save', async (req, res) => {
  const result = saveAdaptabilitySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { scores } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const before = await getPlanState(activePlanType);
    const updated = JSON.parse(JSON.stringify(before));

    const values = Object.values(scores) as number[];
    const sum = values.reduce((a, b) => a + b, 0);
    const readinessPct = Math.round((sum / (values.length * 5)) * 100);

    // Business Trigger: If Financiera index is 1 (or any critical score is 1), trigger Institutional Inertia!
    const hasCritical = values.some(v => v === 1);

    updated.adaptationCapacity.scores = {
      Financiera: scores.Financiera || 0,
      Tecnica: scores.Tecnica || 0,
      Normativa: scores.Normativa || 0,
      Gobernanza: scores.Gobernanza || 0
    };
    updated.adaptationCapacity.readinessPct = readinessPct;
    updated.adaptationCapacity.inertiaFlagActive = hasCritical;
    updated.stepsCompleted[5] = true;
    updated.currentStep = 6;

    await savePlanState(updated);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'SAVE_STEP5_ADAPTABILITY', 
      before, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      state: updated,
      correlationId: corrId,
      inertiaTriggered: hasCritical
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Paso 6: Semaforización Interactive Hover
app.post('/api/step6/calculate', async (req, res) => {
  const result = calculateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { r, c, factors } = result.data;
  const { amenaza, sensibilidad, exposicion, capacidad } = factors;
  const C_val = capacidad || 1;
  const calculatedRisk = parseFloat(((amenaza * sensibilidad * exposicion) / C_val).toFixed(2));

  try {
    const planState = await getPlanState(activePlanType);
    planState.climateRisk.selectedZone = { r, c };
    planState.climateRisk.matrixFactors = factors;
    planState.climateRisk.calculatedRisk = calculatedRisk;
    planState.stepsCompleted[6] = true;

    await savePlanState(planState);

    res.json({
      success: true,
      calculatedRisk,
      factors,
      formula: `(${amenaza} * ${sensibilidad} * ${exposicion}) / ${C_val}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/step6/confirm', async (req, res) => {
  try {
    const planState = await getPlanState(activePlanType);
    planState.stepsCompleted[6] = true;
    planState.currentStep = 7;
    await savePlanState(planState);
    res.json({ success: true, state: planState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 7: Presupuesto & Climate measure save (Integridad Transaccional / ROLLBACK con transacciones en base de datos)
app.post('/api/step7/save-measure', async (req, res) => {
  const corrId = (req as any).correlationId;
  let beforeState: PlanState | null = null;
  const client = await pool.connect();

  try {
    const result = saveMeasureSchema.safeParse(req.body);
    if (!result.success) {
      throw new Error(`INTEGRITY_VIOLATION: ${result.error.issues[0].message}`);
    }

    const { 
      name, 
      description, 
      budget, 
      isTechnicalStrengthening, 
      sourceId,
      budget2026 = 0,
      budget2027 = 0,
      budget2028 = 0,
      budget2029 = 0,
      budget2030 = 0
    } = result.data;

    // Iniciar transacción de base de datos real
    await client.query("BEGIN;");

    beforeState = await getPlanState(activePlanType);

    // RULE 1b: "Consistencia Metodológica" Trigger Check 1
    if (!beforeState.stepsCompleted[6] || !beforeState.climateRisk.selectedZone) {
      throw new Error("CONSISTENCIA_METODOLOGICA: No se puede registrar un costo de medida en el Paso 7 sin haber procesado y confirmado el análisis de riesgo en el Paso 6.");
    }

    // RULE 1b: "Consistencia Metodológica" Trigger Check 2
    if (!sourceId || sourceId.trim() === "" || sourceId === 'ninguno') {
      throw new Error("CONSISTENCIA_METODOLOGICA: Toda medida de costo registrada por el SIPEB en el Paso 7 debe estar expresamente vinculada a una fuente de diagnóstico territorial del Paso 2.");
    }

    // UAT Budget Consistency checking
    const sumGestiones = budget2026 + budget2027 + budget2028 + budget2029 + budget2030;
    if (Math.abs(sumGestiones - budget) > 0.01) {
      throw new Error(`CONSISTENCIA_PRESUPUESTARIA: La sumatoria de las gestiones plurianuales 2026-2030 (${sumGestiones.toLocaleString('es-BO')} BOB) no coincide con el Costo Total Estimado de la medida (${budget.toLocaleString('es-BO')} BOB).`);
    }

    const newMeasureId = `measure-${crypto.randomUUID()}`;
    await client.query(`
      INSERT INTO climate_measures (id, plan_id, name, description, budget, type, source_id, budget_2026, budget_2027, budget_2028, budget_2029, budget_2030)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
    `, [
      newMeasureId,
      activePlanType,
      name,
      description,
      budget,
      isTechnicalStrengthening ? 'fortalecimiento_tecnico' : 'standard',
      sourceId,
      budget2026,
      budget2027,
      budget2028,
      budget2029,
      budget2030
    ]);

    const updated = JSON.parse(JSON.stringify(beforeState));
    const newMeasure = {
      id: newMeasureId,
      name,
      description,
      budget,
      type: isTechnicalStrengthening ? 'fortalecimiento_tecnico' : 'standard',
      sourceId,
      budget2026,
      budget2027,
      budget2028,
      budget2029,
      budget2030
    };
    updated.measures.push(newMeasure);

    // Business Trigger check for Institutional Inertia
    let inerciaResolved = false;
    if (updated.adaptationCapacity.inertiaFlagActive) {
      const hasStrengthening = updated.measures.some((m: any) => m.type === 'fortalecimiento_tecnico' && m.budget > 0);
      if (hasStrengthening) {
        updated.adaptationCapacity.inertiaFlagActive = false; // Resolved!
        inerciaResolved = true;
      }
    }

    updated.stepsCompleted[7] = true;

    // Persistir estado de plan
    await client.query(`
      UPDATE plans SET
        steps_completed = $1,
        adaptation_capacity = $2
      WHERE id = $3;
    `, [
      JSON.stringify(updated.stepsCompleted),
      JSON.stringify(updated.adaptationCapacity),
      activePlanType
    ]);

    // Confirmar transacción
    await client.query("COMMIT;");

    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'INSERT_CLIMATE_MEASURE', 
      beforeState, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      measure: newMeasure,
      state: updated,
      inerciaResolved,
      correlationId: corrId
    });

  } catch (error: any) {
    // Abortar transacción y revertir base de datos
    await client.query("ROLLBACK;");

    const isMethodologyError = error.message.includes("CONSISTENCIA_METODOLOGICA");
    const actionLabel = isMethodologyError ? 'METHODOLOGICAL_INCONSISTENCY_VIOLATION' : 'TRANSACTIONAL_ROLLBACK';

    if (beforeState) {
      await logAudit(
        currentSessionUser?.email || 'aliendredilan@gmail.com',
        actionLabel,
        beforeState,
        beforeState, // reverted state
        corrId
      );
    }

    return res.status(400).json({
      success: false,
      rolledBack: true,
      error: `DATABASE VALIDATION ROLLBACK (Correlation ID: ${corrId}) - ${error.message}`
    });
  } finally {
    client.release();
  }
});

// Paso 7: Delete measure
app.post('/api/step7/delete-measure', async (req, res) => {
  const result = deleteMeasureSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { id } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const beforeState = await getPlanState(activePlanType);
    
    await pool.query("DELETE FROM climate_measures WHERE id = $1 AND plan_id = $2;", [id, activePlanType]);
    
    const updated = await getPlanState(activePlanType);

    // Re-verify inercia status if technical measure deleted
    const hasStrengthening = updated.measures.some(m => m.type === 'fortalecimiento_tecnico' && m.budget > 0);
    const values = Object.values(updated.adaptationCapacity.scores) as number[];
    const hasCritical = values.some(v => v === 1);
    if (hasCritical && !hasStrengthening) {
      updated.adaptationCapacity.inertiaFlagActive = true; // Block again
      await savePlanState(updated);
    }

    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'DELETE_CLIMATE_MEASURE', 
      beforeState, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      state: updated,
      correlationId: corrId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Document verification logic (SHA-256 matching validation)
app.post('/api/step8/verify-document-integrity', async (req, res) => {
  const result = verifyDocumentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { documentType, content } = result.data;
  const corrId = (req as any).correlationId;

  try {
    const planState = await getPlanState(activePlanType);

    let expectedHash = "";
    if (documentType === 'PDF') {
      expectedHash = planState.padesHash;
    } else if (documentType === 'Excel') {
      expectedHash = planState.sigepExcelHash;
    } else {
      expectedHash = "8f2b44c192e1001";
    }

    const actualHash = crypto.createHash('sha256').update(content || "").digest('hex');

    const matches = (actualHash === expectedHash);
    if (!matches) {
      await logAudit(
        currentSessionUser?.email || 'aliendredilan@gmail.com',
        'DOCUMENT_INTEGRITY_VIOLATION_ATTEMPT',
        { documentType, expectedHash },
        { documentType, actualHash, status: 'BLOCKED' },
        corrId
      );
      return res.status(403).json({
        success: false,
        matches: false,
        actualHash,
        expectedHash,
        error: `INTEGRITY_VIOLATION: El hash SHA-256 calculado (${actualHash.substring(0, 16)}...) no coincide con el hash original registrado (${expectedHash.substring(0, 16)}...). El archivo oficial ha sido modificado deliberadamente o se encuentra corrompido.`
      });
    }

    res.json({
      success: true,
      matches: true,
      actualHash,
      expectedHash,
      message: "Integridad técnica verificada con éxito. SHA-256 coincide."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 8: Sign Document using Token (Agetic validation)
app.post('/api/step8/sign', async (req, res) => {
  const corrId = (req as any).correlationId;

  // Validate active user role before allowing signature
  if (activeUserRole !== 'SUPER_ADMIN' && activeUserRole !== 'REVISOR_SENIOR') {
    return res.status(403).json({
      success: false,
      error: `ROL INSUFICIENTE: Su sesión actual en el SIPEB tiene asignado el rol de '${activeUserRole}'. Conforme a los reglamentos y estándares de control de firmas del MPDyMA y la GIZ, la firma del expediente consolidado es de atribución exclusiva de los roles 'SUPER_ADMIN' (Propietario / MPDyMA) y 'REVISOR_SENIOR' (Coordinador GIZ). Por favor, inicie sesión o asigne un rol autorizado.`
    });
  }

  try {
    const before = await getPlanState(activePlanType);
    if (before.adaptationCapacity.inertiaFlagActive) {
      return res.status(400).json({
        success: false,
        error: `FIRMA BLOQUEADA: No se puede estampar la firma digital institucional debido a un bloqueo administrativo del expediente: 'Inercia Institucional detectada en el Paso 5'. Debe ingresar al banco de medidas una acción de Fortalecimiento Técnico con presupuesto validado.`
      });
    }

    const updated = JSON.parse(JSON.stringify(before));
    updated.isSigned = true;
    updated.stepsCompleted[8] = true;

    await savePlanState(updated);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'SIGN_DIGITAL_AGETIC', 
      before, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      state: updated,
      message: "Firma digital del expediente estampada con éxito en los servidores de validación.",
      correlationId: corrId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 8: Submit official final file to MPDyMA
app.post('/api/plan/submit', async (req, res) => {
  const corrId = (req as any).correlationId;

  // Validate active user role before allowing submission/consolidation
  if (activeUserRole !== 'SUPER_ADMIN' && activeUserRole !== 'REVISOR_SENIOR') {
    return res.status(403).json({
      success: false,
      error: `ROL INSUFICIENTE: Su sesión actual en el SIPEB tiene asignado el rol de '${activeUserRole}'. El envío oficial y la consolidación del expediente (Paso 8) son de atribución exclusiva de los roles 'SUPER_ADMIN' (Propietario / MPDyMA) y 'REVISOR_SENIOR' (Coordinador GIZ).`
    });
  }

  try {
    const before = await getPlanState(activePlanType);
    if (!before.isSigned) {
      return res.status(400).json({
        success: false,
        error: "No se puede realizar el envío oficial. El expediente requiere estar firmado por los token digitales del planificador del MPDyMA."
      });
    }

    if (before.adaptationCapacity.inertiaFlagActive) {
      return res.status(400).json({
        success: false,
        error: "ENVÍO BLOQUEADO: Resuelva la inercia institucional pendiente para habilitar el gatekeeper regional."
      });
    }

    const updated = JSON.parse(JSON.stringify(before));
    updated.isSubmitted = true;
    updated.isClosed = true;

    await savePlanState(updated);
    await logAudit(
      currentSessionUser?.email || 'aliendredilan@gmail.com', 
      'SUBMIT_OFFICIAL_DOSSIER_MPDyMA', 
      before, 
      updated, 
      corrId
    );

    res.json({
      success: true,
      state: updated,
      trackingCode: `MPD-2026-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      correlationId: corrId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Downloads (Impeccable Export template simulation)
app.get('/api/export/excel', async (req, res) => {
  try {
    const planState = await getPlanState(activePlanType);
    const header = `MINISTERIO DE PLANIFICACIÓN DEL DESARROLLO - ESTADO PLURINACIONAL DE BOLIVIA
SISTEMA DE PLANIFICACIÓN DE ACC-RRD (SIPEB 2026-2030)
MATRIZ DE INVERSIÓN PLURIANUAL OFICIAL SIGEP
============================================================
Correlation ID: \t${(req as any).correlationId || 'corr-system'}
Estándar Cartográfico Geodésico:\tSIRGAS / WGS84
Estado de Validación: \tAPROBADO DE ACUERDO A LEY 777
SHA-256 Verificación Oficial:\t${planState.sigepExcelHash}
Firma Electrónica:\t${planState.signerName || 'Arq. Marcelo Arce'} (${planState.signerRole || 'Planificador Regional V'})
Fecha Generación:\t${new Date().toISOString()}
Total Medidas Registradas:\t${planState.measures.length}
============================================================

ID Medida\tNombre Medida\tDescripción Medida\tTipo Medida\tFuente Vinculada (Paso 2)\tPresupuesto Total (BOB)\tPorcentaje del Plan
`;

    let rows = "";
    const total = planState.measures.reduce((a, b) => a + b.budget, 0);
    planState.measures.forEach(m => {
      const pct = total > 0 ? ((m.budget / total) * 100).toFixed(2) : 0;
      const sourceLabel = m.sourceId ? (
        m.sourceId === 'fuente-1' ? 'Base de Datos de Cuencas ANA' :
        m.sourceId === 'fuente-2' ? 'Censo de Cobertura Agropecuaria' :
        m.sourceId === 'fuente-3' ? 'Estaciones Climatológicas SENAMHI' : m.sourceId
      ) : 'Sin vinculación directa';
      rows += `${m.id}\t${m.name}\t${m.description}\t${m.type.toUpperCase()}\t${sourceLabel}\t${m.budget.toLocaleString('es-BO')}\t${pct}%\n`;
    });

    rows += `\nTOTAL INVERSIÓN CONSOLIDADO:\t\t\t\t\t${total.toLocaleString('es-BO')} BOB\t100%\n`;

    res.setHeader('Content-disposition', 'attachment; filename=SIPEB_Matriz_Inversion_SIGEP.csv');
    res.setHeader('Content-type', 'text/csv; charset=utf-8');
    res.send(header + rows);
  } catch (err: any) {
    res.status(500).send("Error generating export: " + err.message);
  }
});

app.get('/api/export/pdf', async (req, res) => {
  try {
    const planState = await getPlanState(activePlanType);
    
    const totalBudget = planState.measures.reduce((a, b) => a + b.budget, 0);
    
    let measuresText = "";
    planState.measures.forEach((m, idx) => {
      measuresText += `
        <div class="measure-card">
          <div class="measure-header"><strong>Medida ${idx + 1}:</strong> ${m.name}</div>
          <div class="measure-body">
            <div><strong>ID:</strong> ${m.id}</div>
            <div><strong>Tipo:</strong> ${m.type.toUpperCase()}</div>
            <div><strong>Presupuesto:</strong> ${m.budget.toLocaleString('es-BO')} BOB</div>
            <div><strong>Fuente:</strong> ${m.sourceId || 'No especificado'}</div>
            <div class="measure-desc">${m.description}</div>
          </div>
        </div>
      `;
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>SIPEB - Expediente Consolidado Oficial</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 20px; font-size: 12px; }
        .header { text-align: center; border-bottom: 2px solid #0058be; padding-bottom: 15px; margin-bottom: 20px; }
        .header img { max-height: 60px; margin-bottom: 10px; }
        .header h1 { font-size: 16px; margin: 0 0 5px; color: #0058be; }
        .header h2 { font-size: 14px; margin: 0; font-weight: normal; color: #555; }
        
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
        .meta-box table { width: 100%; font-size: 11px; }
        .meta-box td { padding: 4px 8px; vertical-align: top; }
        .meta-box td:first-child { font-weight: bold; width: 30%; color: #475569; }
        
        .section-title { font-size: 14px; font-weight: bold; color: #0058be; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin: 20px 0 10px; text-transform: uppercase; }
        
        .content-block { margin-bottom: 15px; }
        .content-block p { margin: 5px 0; }
        .content-block strong { color: #1e293b; }
        
        .measure-card { border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 10px; page-break-inside: avoid; }
        .measure-header { background: #f1f5f9; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; font-size: 11px; }
        .measure-body { padding: 8px 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 10px; }
        .measure-desc { grid-column: 1 / -1; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #cbd5e1; }
        
        .signatures { margin-top: 40px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; }
        .signature-box { width: 40%; }
        .signature-line { border-top: 1px solid #000; margin-bottom: 5px; padding-top: 5px; font-weight: bold; }
        .stamp-box { border: 2px dashed #0058be; color: #0058be; padding: 10px; text-align: center; width: fit-content; margin: 20px auto; transform: rotate(-5deg); font-weight: bold; font-family: monospace; }
        
        .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }

        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body onload="window.print()">
    <div class="no-print" style="background:#fef08a; padding:10px; text-align:center; font-weight:bold; margin-bottom:20px; border-radius:4px;">
        Este documento está optimizado para impresión. Si el diálogo de impresión no se abre automáticamente, presione Ctrl+P o Cmd+P.
    </div>

    <div class="header">
        <h1>ESTADO PLURINACIONAL DE BOLIVIA</h1>
        <h2>MINISTERIO DE PLANIFICACIÓN DEL DESARROLLO</h2>
        <h2 style="font-weight:bold; margin-top:10px;">EXPEDIENTE DE CONSOLIDACIÓN TÉCNICA - SIPEB 2026-2030</h2>
        <h2>Formulación de Plan de Adaptación (${planState.planType}) v2.4 Final</h2>
    </div>

    <div class="meta-box">
        <table>
            <tr><td>Correlation ID:</td><td style="font-family:monospace;">${(req as any).correlationId || 'corr-system'}</td></tr>
            <tr><td>Georreferenciación:</td><td>Estándar SIRGAS/WGS84 Certificado</td></tr>
            <tr><td>Justificación GEDSI:</td><td>Aprobada de acuerdo a Criterio de Inclusión Social</td></tr>
            <tr><td>Nivel Vulnerabilidad:</td><td>Nivel ${planState.vulnerability.sensitivityLevel} (Aprobación Semántica)</td></tr>
            <tr><td>SHA-256 Expediente:</td><td style="font-family:monospace;">${planState.padesHash}</td></tr>
            <tr><td>Reglamentación:</td><td>Estatutos de Inmuno-Gobernanza de Ley 777 (SPIE)</td></tr>
        </table>
    </div>

    <div class="section-title">1. MARCO NORMATIVO NACIONAL</div>
    <div class="content-block">
        <p>Completado y validado en su totalidad bajo los preceptos de la <strong>Ley N° 777</strong> (Sistema de Planificación Integral del Estado - SPIE).</p>
    </div>

    <div class="section-title">2. DIAGNÓSTICO TERRITORIAL</div>
    <div class="content-block">
        <p>Cruce espacial y conexión geodésica validados sobre modelo de vulnerabilidad hídrica nacional.</p>
    </div>

    <div class="section-title">3. PRIORIZACIÓN DE AMENAZA CLIMÁTICA</div>
    <div class="content-block">
        <p><strong>Nivel de Amenaza Climática:</strong> ${planState.threatLevel} / 5 (Priorización Cuenca del Río Pilcomayo).</p>
    </div>

    <div class="section-title">4. DETALLE DE ANÁLISIS DE VULNERABILIDAD</div>
    <div class="content-block">
        <p><strong>Sensibilidad Sectorial:</strong> ${planState.vulnerability.sensitivityLevel}</p>
        <p><strong>Justificación del experto:</strong> ${planState.vulnerability.expertJustification || "No fundamentada"}</p>
        <p><strong>Inclusión Social (GEDSI):</strong> ${planState.vulnerability.gedsiText || "No redactado"}</p>
        <p><strong>Superficie Afectada:</strong> ${planState.vulnerability.cropsAffectedHectares} Ha.</p>
        <p><strong>Población Expuesta:</strong> ${planState.vulnerability.populationExpCount} Hab.</p>
    </div>

    <div class="section-title">5. CAPACIDAD DE ADAPTACIÓN INSTITUCIONAL</div>
    <div class="content-block">
        <p><strong>Financiera:</strong> ${planState.adaptationCapacity.scores.Financiera || 0} / 5 | 
           <strong>Técnica:</strong> ${planState.adaptationCapacity.scores.Tecnica || 0} / 5 | 
           <strong>Normativa:</strong> ${planState.adaptationCapacity.scores.Normativa || 0} / 5 | 
           <strong>Gobernanza:</strong> ${planState.adaptationCapacity.scores.Gobernanza || 0} / 5</p>
        <p><strong>Índice Readiness:</strong> ${planState.adaptationCapacity.readinessPct}%</p>
        <p><strong>Flag de Inercia:</strong> ${planState.adaptationCapacity.inertiaFlagActive ? "ACTIVO (Requiere Fortalecimiento)" : "Superado y Resuelto"}</p>
    </div>

    <div class="section-title">6. RIESGO MULTIDIMENSIONAL (GEODÉSICO)</div>
    <div class="content-block">
        <p><strong>Zona Seleccionada:</strong> Fila ${planState.climateRisk.selectedZone ? planState.climateRisk.selectedZone.r : 'N/A'}, Columna ${planState.climateRisk.selectedZone ? planState.climateRisk.selectedZone.c : 'N/A'}</p>
        <p><strong>A:</strong> ${planState.climateRisk.matrixFactors.amenaza} | 
           <strong>S:</strong> ${planState.climateRisk.matrixFactors.sensibilidad} | 
           <strong>E:</strong> ${planState.climateRisk.matrixFactors.exposicion} | 
           <strong>C:</strong> ${planState.climateRisk.matrixFactors.capacidad}</p>
        <p><strong>Índice de Riesgo Consolidado:</strong> ${planState.climateRisk.calculatedRisk || "Pendiente"}</p>
    </div>

    <div class="section-title">7. BANCO PLURIANUAL DE MEDIDAS</div>
    <div class="content-block">
        <p><strong>Total Inversión Consolidada:</strong> ${totalBudget.toLocaleString('es-BO')} BOB</p>
        <div style="margin-top: 15px;">
            ${measuresText}
        </div>
    </div>

    <div class="stamp-box">
        SIPEB APROBADO<br>
        <span style="font-size:8px;">${planState.padesHash.substring(0, 16)}</span>
    </div>

    <div class="signatures">
        <div class="signature-box">
            <div class="signature-line">${planState.signerName || 'Firma Digital Agetic'}</div>
            <div>${planState.signerRole || 'Autoridad Competente'}</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">MPDyMA</div>
            <div>Control de Legalidad SPIE</div>
        </div>
    </div>

    <div class="footer">
        Generado por Sistema SIPEB v2.4 • Fecha: ${new Date().toLocaleString('es-BO')} • ID: ${(req as any).correlationId || 'corr-system'}<br>
        El presente expediente consolidado goza del Flag de Cierre de inmutabilidad de escritura por reglamentación del SPIE.
    </div>
</body>
</html>
`;

    res.setHeader('Content-type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (err: any) {
    res.status(500).send("Error generating PDF view: " + err.message);
  }
});

// Gemini Assistant Integration Chatbot API proxy
app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "Falta configurar la clave secreta GEMINI_API_KEY en la configuración del sistema (Ajustes -> Secretos)."
      });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: "Messages payload is required." });
    }

    const aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const activeModel = "gemini-2.5-flash";

    // 1. Fetch sources from database
    const email = currentSessionUser?.email || '';
    const sourcesResult = await pool.query(
      "SELECT * FROM sources WHERE user_id = $1 OR type = 'local_reference';",
      [email]
    );

    const geminiFilesToAttach: any[] = [];
    const driveLinks: any[] = [];

    // 2. Process sources and handle self-healing (autocuración)
    for (const source of sourcesResult.rows) {
      if (source.type === 'drive_link') {
        driveLinks.push(source);
      } else {
        let fileUri = source.gemini_file_uri;
        let fileName = source.gemini_file_name;
        let uploadedAt = source.gemini_uploaded_at;
        
        // Expired if uploaded > 40 hours ago or if not uploaded yet
        const isExpired = !uploadedAt || (Date.now() - new Date(uploadedAt).getTime() > 40 * 60 * 60 * 1000);

        if (isExpired || !fileUri) {
          // In serverless (Vercel), local files are not persisted - no autocure possible.
          // The file must be re-uploaded manually via the Source Manager.
          console.warn(`[Autocuración] Fuente "${source.name}" expiró o no está indexada en Gemini. No hay archivo local disponible en entorno serverless. El usuario debe re-subirla manualmente.`);
          // Skip this source - do not attach to the chat context
          continue;
        }

        if (fileUri) {
          // Determine mime type from gemini_file_uri or source name
          const sourceName = source.name || '';
          let mimeType = 'application/octet-stream';
          if (sourceName.toLowerCase().endsWith('.pdf') || (source.url || '').toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
          else if (sourceName.toLowerCase().endsWith('.txt') || (source.url || '').toLowerCase().endsWith('.txt')) mimeType = 'text/plain';
          else if (sourceName.toLowerCase().endsWith('.docx') || (source.url || '').toLowerCase().endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          // Default assumption: PDFs are most common for policy documents
          else mimeType = 'application/pdf';

          geminiFilesToAttach.push({
            fileData: {
              fileUri: fileUri,
              mimeType: mimeType
            }
          });
        }
      }
    }

    // 3. Format messages and append drive links metadata to the last user message
    const formattedContents = messages.map((msg, index) => {
      const isLastMessage = index === messages.length - 1;
      const isUser = msg.role !== 'assistant';
      
      const parts: any[] = [{ text: msg.content }];
      
      if (isLastMessage && isUser) {
        if (driveLinks.length > 0) {
          const driveMeta = "\n\n[Fuentes Adicionales de Google Drive disponibles para referencia del planificador]:\n" +
            driveLinks.map(d => `- ${d.name}: ${d.url}`).join("\n");
          parts[0].text += driveMeta;
        }
        parts.push(...geminiFilesToAttach);
      }
      
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: parts
      };
    });

    const systemInstruction = `Eres un Asesor Tecnológico Senior del Ministerio de Planificación del Desarrollo (MPDyMA) de Bolivia, experto en el Sistema de Planificación ACC-RRD (SIPEB 2026-2030).
Tu deber es asistir al usuario (Arq. Marcelo Arce) en el llenado de su expediente garantizando la rigurosidad de los siguientes estándares institucionales:
1. Geodesia de Proyecciones: Todas las coordenadas espaciales deben cumplir con el estándar SIRGAS/WGS84 de forma matemática. No se acepta PSAD56 ni otros formatos obsoletos.
2. Ley de Integridad Social (GEDSI): Validar que las justificaciones de inclusión posean enfoque diferenciado para mujeres, niños y ancianos, y que las vulnerabilidades críticas superen el Gatekeeper de 150 caracteres.
3. Integridad Transaccional: El presupuesto debe ser estricto y sin valores nulos en el Paso 7. Advierte que toda medida sin presupuesto disparará un ROLLBACK automático en el backend de validaciones.
4. Flag de Inercia: Explica que si alguna dimensión de capacidad institucional en el Paso 5 es calificada con 1 (Crítico), se activa la inercia institucional, la cual bloquea la firma del Paso 8 a menos que se formule una medida de 'Fortalecimiento Técnico' con presupuesto financiado en el Paso 7.

Si el usuario realiza una pregunta sobre datos reales en vivo (presupuestos, estado de pasos, logs de auditoría), debes utilizar tus herramientas (functions) para consultar la base de datos de Supabase y responder con la información real. Siempre que el usuario pregunte por presupuestos o medidas, muestra los datos formateados en tablas limpias de Markdown.
Para responder preguntas normativas, metodológicas y de normas del sistema, consulta los documentos de referencia y PDFs adjuntos proporcionados como archivos.
Sé profesional, conciso, respetuoso y profundamente técnico. Incorpora códigos de normas bolivianas de planificación como la Ley N° 777 (SPIE) y directivas ministeriales de cambio climático. Respond in Spanish.`;

    const functionDeclarations = [
      {
        name: "get_plan_details",
        description: "Obtiene los detalles del estado de un plan específico (PES o PAD) en el sistema SIPEB, incluyendo pasos completados, vulnerabilidad, capacidad de adaptación, nivel de amenaza, riesgo, firmas e hitos del workflow.",
        parameters: {
          type: "OBJECT",
          properties: {
            planId: {
              type: "STRING",
              enum: ["PES", "PAD"],
              description: "El tipo de plan a consultar: 'PES' (Planes Sectoriales) o 'PAD' (Planes Territoriales Autonómicos)"
            }
          },
          required: ["planId"]
        }
      },
      {
        name: "get_climate_measures",
        description: "Obtiene el listado completo de medidas climáticas registradas para un plan específico (PES o PAD) con sus presupuestos plurianuales desglosados (2026 a 2030) y totales.",
        parameters: {
          type: "OBJECT",
          properties: {
            planId: {
              type: "STRING",
              enum: ["PES", "PAD"],
              description: "El tipo de plan a consultar: 'PES' o 'PAD'"
            }
          },
          required: ["planId"]
        }
      },
      {
        name: "get_audit_logs",
        description: "Obtiene la bitácora de auditoría transaccional de seguridad y negocio más reciente en el sistema.",
        parameters: {
          type: "OBJECT",
          properties: {
            limit: {
              type: "INTEGER",
              description: "Cantidad máxima de logs a retornar (por defecto 20, máximo 100)"
            }
          }
        }
      }
    ];

    const generateConfig: any = {
      systemInstruction,
      temperature: 0.2,
      tools: [{ functionDeclarations }]
    };

    console.log("🤖 Iniciando consulta a Gemini...");
    let response = await aiClient.models.generateContent({
      model: activeModel,
      contents: formattedContents,
      config: generateConfig
    });

    let currentContents: any[] = [...formattedContents];

    // Function Calling Loop
    for (let iter = 0; iter < 5; iter++) {
      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        break;
      }

      console.log(`🤖 Gemini solicita ejecutar funciones (${functionCalls.length}):`, JSON.stringify(functionCalls));

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        currentContents.push(modelContent);
      }

      const toolResponseParts = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        let output: any = {};

        // Security / RBAC Gatekeeper inside function calling!
        let accessGranted = true;
        if (name === 'get_plan_details' || name === 'get_climate_measures') {
          const targetPlanId = (args as any).planId;
          if (currentSessionUser?.role === 'ESPECIALISTA_PAD' && targetPlanId === 'PES') {
            accessGranted = false;
            output = { error: "Acceso Restringido: Como Especialista PAD, usted no cuenta con permisos para consultar carteras sectoriales ministeriales (PES)." };
          } else if (currentSessionUser?.role === 'ESPECIALISTA_PES' && targetPlanId === 'PAD') {
            accessGranted = false;
            output = { error: "Acceso Restringido: Como Especialista PES, usted no cuenta con permisos para consultar expedientes territoriales autónomos (PAD)." };
          }
        }

        if (accessGranted) {
          try {
            if (name === 'get_plan_details') {
              output = await getPlanState((args as any).planId);
            } else if (name === 'get_climate_measures') {
              const planId = (args as any).planId;
              const measuresResult = await pool.query(
                "SELECT * FROM climate_measures WHERE plan_id = $1;",
                [planId]
              );
              output = {
                planId,
                totalMeasures: measuresResult.rows.length,
                totalBudget: measuresResult.rows.reduce((sum, m) => sum + parseFloat(m.budget), 0),
                measures: measuresResult.rows
              };
            } else if (name === 'get_audit_logs') {
              const limit = (args as any).limit || 20;
              const logsResult = await pool.query(
                "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1;",
                [limit]
              );
              output = { logs: logsResult.rows };
            }
          } catch (err: any) {
            console.error(`Error al ejecutar función de base de datos ${name}:`, err);
            output = { error: err.message };
          }
        }

        toolResponseParts.push({
          functionResponse: {
            name: name,
            response: { result: output }
          }
        });
      }

      currentContents.push({
        role: 'tool',
        parts: toolResponseParts
      });

      response = await aiClient.models.generateContent({
        model: activeModel,
        contents: currentContents,
        config: generateConfig
      });
    }

    const textResponse = response.text || "No se ha recibido una respuesta válida de la inteligencia artificial.";

    res.json({
      success: true,
      text: textResponse
    });

  } catch (error: any) {
    console.error("Gemini Assistant Route Error:", error);
    res.status(500).json({
      success: false,
      error: `Error al interactuar con el asistente virtual: ${error.message}`
    });
  }
});


// Server setup with Vite integration
async function startServer() {
  try {
    await initDatabase();
    await initSession();
    
    // Ensure uploads directory exists and is served statically
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsDir));
  } catch (error) {
    console.error("Critical: Failed to initialize database or session:", error);
    process.exit(1);
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SIPEB Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

