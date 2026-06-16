# MEMORY.md - Historial de Decisiones Arquitectónicas & Estado de la Plataforma

Este archivo registra las decisiones clave de ingeniería, la estructura actual del sistema y el estado de la plataforma SIPEB-NAP v1.1.

---

## 🏗️ 1. Decisiones Arquitectónicas Recientes

### A. Capa de Persistencia Real (Supabase / PostgreSQL)
*   **Decisión**: Migración definitiva de almacenamiento volátil en memoria a base de datos relacional PostgreSQL hospedada en Supabase.
*   **Razonamiento**: Se requería garantizar la integridad transaccional plurianual para los presupuestos de medidas y la trazabilidad de las auditorías en producción.
*   **Detalles Técnicos**:
    *   Se implementó un pool de conexiones optimizado con `pg` en `database.ts` manejando reconexión automática y reescritura de hosts directos a pools compatibles con entornos serverless.
    *   El paso 7 (`save-measure`) implementa bloques `BEGIN`, `COMMIT` y `ROLLBACK` explícitos para proteger la consistencia financiera en caso de fallo en alguna de las inserciones de años individuales (2026-2030).

### B. Esquemas de Validación Estrictos (Zod)
*   **Decisión**: Introducir validadores estricto a nivel de API en la capa de persistencia para evitar inconsistencias de negocio.
*   **Validadores Implementados**:
    *   **GEDSI (Paso 4)**: Si la sensibilidad social es "Alta" o "Crítica", es mandatorio proveer una justificación GEDSI con un mínimo de 150 caracteres.
    *   **Costos Plurianuales (Paso 7)**: La sumatoria de presupuestos plurianuales (2026-2030) debe coincidir exactamente con el presupuesto total estimado de la medida.

### C. Asistente IA Integrado (Gemini 2.5 Pro & Function Calling)
*   **Decisión**: Implementación de un chatbot de asistencia técnica contextualizada mediante el SDK `@google/genai` v2.4.0.
*   **Mecanismo de Autocuración (RAG)**:
    *   Los archivos subidos a la Files API de Gemini expiran tras 48 horas. Se diseñó un backend que almacena copias físicas en `uploads/`. Al iniciar un chat, si el token de Gemini expiró, se re-sube el archivo de forma transparente (auto-healing).
*   **Function Calling con Control de Roles (RBAC Gatekeeper)**:
    *   El modelo de IA invoca herramientas de base de datos (`get_plan_details`, `get_climate_measures`, `get_audit_logs`).
    *   El backend intercepta estas llamadas y comprueba el rol de la sesión. Si un especialista PAD intenta leer un plan PES (o viceversa), la consulta a la base de datos se cancela y se retorna una denegación estructurada que Gemini formatea de forma cordial.

### D. React Query (TanStack Query)
*   **Decisión**: Sincronización del estado global de la app y caché con `@tanstack/react-query`.
*   **Beneficio**: Alivió la cascada de renders y llamadas fetch redundantes. Permite la invalidación de consultas y la actualización en tiempo real de la bitácora de auditoría al guardar datos.

### E. Capa de Sesión Sin Estado con Cookies Cifradas y AsyncLocalStorage (Soporte Vercel/Serverless)
*   **Decisión**: Migración de sesión global en memoria a una arquitectura de sesión basada en cookies HTTP-only cifradas simétricamente con AES-256-CBC, combinada con `AsyncLocalStorage` de Node.js.
*   **Razonamiento**: En plataformas serverless como Vercel, las instancias de backend se destruyen y recrean de forma dinámica (stateless). Las variables globales en memoria causan pérdidas inmediatas de sesión (errores 401 recurrentes).
*   **Detalles Técnicos**:
    *   **Cifrado Simétrico**: Los datos de sesión del usuario logueado se serializan y encriptan simétricamente mediante la API de `crypto` nativa, enviándose al cliente como cookie segura (`session`).
    *   **Aislamiento de Hilo (AsyncLocalStorage)**: Un middleware de Express intercepta cada request, desencripta la cookie, y monta el contexto `{ user, planType }` en un almacenamiento local asíncrono. Los getters globales de `currentSessionUser`, `activePlanType` y `activeUserRole` leen dinámicamente de este contexto sin requerir refactorización invasiva de las llamadas del codebase.
    *   **Inicialización Diferida (Lazy DB Init)**: Dado que Vercel no ejecuta el bloque `app.listen()` de Express, se habilitó la inicialización y el sembrado de tablas (`initDatabase()`) en el primer request asíncrono entrante.

---

## 📈 2. Estado Actual de la Web

*   **Servidor Backend**: Escuchando en `http://localhost:3000` con soporte multi-usuario.
*   **Compilación TypeScript**: `npm run lint` reporta **0 errores** de tipos.
*   **Vite Production Build**: `npm run build` genera el bundle optimizado sin advertencias ni fallos.
*   **Base de Datos**: Esquema inicializado y sembrado de forma completa en Supabase.
*   **Integración IA**: Clave `GEMINI_API_KEY` configurada exitosamente en el archivo `.env`. Probada y validada en su totalidad con respuestas completas del asistente de planificación.

---

## 📋 3. Historial de Cambios (SIPEB-NAP v1.1)

1.  **Capa de Datos**:
    *   Diseño y creación de tabla `sources` (id, name, type, url, file_path, gemini_file_uri, gemini_upload_time, created_at).
    *   Inicialización de semillas de usuario (`revisor.giz@planificacion.gob.bo`, `especialista.pad@planificacion.gob.bo`, `especialista.pes@planificacion.gob.bo`).
2.  **Backend (`server.ts`)**:
    *   Creación de endpoints CRUD `/api/sources` para el gestor de fuentes.
    *   Reescritura del endpoint `/api/chat` incorporando autocuración, Function Calling y validación estricta de RBAC.
    *   **Refactorización Serverless**: Sustitución de estado en memoria por cookies seguras firmadas y `AsyncLocalStorage` de Node.js.
    *   **[FIX v1.1.1 - 2026-06-16] Upload Serverless**: Corregido bug crítico donde `POST /api/sources` fallaba en Vercel al intentar escribir en `uploads/` (filesystem readonly). Solución: uso de `/tmp` (único directorio writable en Vercel Functions) como staging para el archivo antes del upload a Gemini File API, con limpieza automática post-upload. La URL almacenada en BD ahora es el `gemini_file_uri` directamente en lugar de una ruta local `/uploads/...`.
    *   **[FIX v1.1.1] Delete Serverless**: Eliminada lógica de borrado de archivos locales en `DELETE /api/sources/:id` (ya no aplica en serverless). Ahora solo llama a `aiClient.files.delete()` de forma no-fatal.
3.  **Frontend (`src/`)**:
    *   Componente `SourceManager.tsx` con soporte para subida de archivos locales y enlaces de Google Drive.
    *   Integración de pestaña "Módulo de Consulta" en `Dashboard.tsx`.
    *   Actualización de `PlanningAssistant.tsx` con parser Markdown personalizado para tablas de costos e indicadores.

---

## ⚠️ 4. Notas para Próxima Sesión

*   **Validar en Vercel**: Confirmar que el POST `/api/sources` con `direct_upload` ahora funciona en producción tras el fix de `/tmp`.
*   **SESSION_SECRET en Vercel**: Para producción segura, agregar `SESSION_SECRET` como variable de entorno en el panel de Vercel (actualmente usa el valor default hardcodeado, funcional pero inseguro).
*   **Expiración de archivos en Gemini Files API**: Los archivos subidos expiran tras 48h. Si las fuentes expiran frecuentemente, evaluar migración a **Supabase Storage** o **Vercel Blob** para persistencia permanente.
*   **[CERRADO - 2026-06-16] Título de pestaña**: Corregido en `index.html` de "My Google AI Studio App" → **"Planify SIPEB"**. Idioma del HTML actualizado a `lang="es"`. Meta description SEO añadida.
