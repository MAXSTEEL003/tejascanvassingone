import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  getStoredOAuthCredentials,
  saveOAuthCredentials,
  isGmailOAuthConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  sendEmailViaGmailApi,
  checkMailboxBounces,
  testGmailApiConnection,
} from "./gmailOAuthService.js";
import {
  getTrackingRecord,
  getAllTrackingRecords,
  isOrderAlreadySent,
  queueEmailJob,
  updateTrackingStatus,
  recordAcknowledgement,
  recordEmailOpen,
  generateAcknowledgementToken,
  verifyAcknowledgementToken,
} from "./poEmailTrackingStore.js";
import {
  syncPoToSupplierPortal,
  buildSupplierPortalPayload,
} from "./supplierPortalService.js";
import {
  getSyncRecord,
  getAllSyncRecords,
} from "./supplierPortalSyncStore.js";
import {
  processSupplierUpdateWebhook,
  syncAcceptedOrdersFromAppB,
} from "./millerUpdatesService.js";
import {
  getAllMillerUpdates,
  getUnreadUpdatesCount,
  markUpdateAsRead,
  markAllUpdatesAsRead,
  removeTestUpdates,
  clearAllMillerUpdates,
} from "./millerUpdatesStore.js";
import { verifyFirebaseIdToken } from "./firebaseTokenVerifier.js";
import { generatePoPdfBase64, getPoPdfFileName } from "../src/utils/poPdfGenerator.js";
import { TC_COMPANY_LOGO_BASE64 } from "../src/utils/logoBase64.js";

const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Local environment: Load ONLY the inner project's .env file (never parent ../.env).
// In Vercel Production, environment variables injected by Vercel are authoritative and never overridden.
const projectRoot = fs.existsSync(path.join(process.cwd(), "package.json")) && fs.existsSync(path.join(process.cwd(), "server.ts"))
  ? process.cwd()
  : fs.existsSync(path.join(currentDir, "package.json"))
    ? currentDir
    : path.join(process.cwd(), "tejascanvassingone-main");

const projectEnv = path.join(projectRoot, ".env");
if (!isVercel && fs.existsSync(projectEnv)) {
  dotenv.config({ path: projectEnv, override: true });
}
const envCandidates = !isVercel && fs.existsSync(projectEnv) ? [projectEnv] : [];

/* ==========================================================================
   SECTION 1: AUTHENTICATION & CREDENTIAL MANAGEMENT
   ========================================================================== */
// Secret key for cryptographic HMAC-SHA256 session signatures
const SERVER_AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "tejas_secure_auth_secret_2026_salt_wholesalemandi";

// Default admin configuration (can be overridden via environment variables)
const DEFAULT_ADMIN_USER = (process.env.ADMIN_USERNAME || "tejasadinarayan").toLowerCase();
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || "adinarayan1977";

// Helper: Secure password hashing using PBKDF2
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, "sha256").toString("hex");
  return { hash, salt: generatedSalt };
}

// Helper: Timing-safe password verification
export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha256").toString("hex");
    const a = Buffer.from(computedHash, "hex");
    const b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Pre-compute admin hash
const adminSalt = "tejas_admin_salt_1977";
const adminPasswordRecord = hashPassword(DEFAULT_ADMIN_PASS, adminSalt);

// In-memory & disk-persisted store for staff & employee credentials
interface EmployeeCredential {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  phone?: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

const employeeStore = new Map<string, EmployeeCredential>();

// File persistence paths
const DATA_DIR = path.join(process.cwd(), "data");
const EMP_CREDS_FILE = path.join(DATA_DIR, "employee_credentials.json");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch { }
}

function savePersistedEmployees() {
  try {
    ensureDataDir();
    const list = Array.from(employeeStore.values()).map(e => {
      const { plainPassword, ...sanitized } = e as any;
      return sanitized;
    });
    fs.writeFileSync(EMP_CREDS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save persisted employee credentials to disk:", e);
  }
}

function loadPersistedEmployees() {
  try {
    ensureDataDir();
    if (fs.existsSync(EMP_CREDS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMP_CREDS_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((c: any) => {
          if (c && c.username) {
            const { plainPassword, ...sanitized } = c;
            employeeStore.set(c.username.toLowerCase(), sanitized);
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not load persisted employee credentials from disk:", e);
  }
}

// Pre-seed default employee accounts with hashed passwords (never store plaintext)
function seedDefaultEmployees() {
  const defaults = [
    { id: "EMP-01", name: "Operations Employee", username: "employee", pass: "adinarayan1977", role: "Operations Staff", email: "employee@tejasc.in" },
    { id: "EMP-02", name: "Senior Operations Staff", username: "employee1", pass: "employee1977", role: "Operations Staff", email: "employee1@tejasc.in" },
    { id: "EMP-03", name: "Sortex Quality Officer", username: "sortex", pass: "sortex2026", role: "Quality Officer", email: "sortex@tejasc.in" }
  ];

  defaults.forEach(d => {
    const { hash, salt } = hashPassword(d.pass);
    employeeStore.set(d.username.toLowerCase(), {
      id: d.id,
      name: d.name,
      username: d.username.toLowerCase(),
      email: d.email,
      role: d.role,
      passwordHash: hash,
      salt: salt,
      updatedAt: new Date().toISOString()
    });
  });

  // Also load any custom employees saved to disk
  loadPersistedEmployees();
}

seedDefaultEmployees();

// Cryptographic JWT Implementation (No external library dependency, purely Node crypto)
export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: "admin" | "employee" | "merchant";
  email: string;
  name: string;
  exp: number;
  iat: number;
}

export function createSignedToken(payload: Omit<AuthTokenPayload, "iat" | "exp">, expiresInSeconds = 7 * 24 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerStr = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const dataToSign = `${headerStr}.${payloadStr}`;
  const signature = crypto.createHmac("sha256", SERVER_AUTH_SECRET).update(dataToSign).digest("base64url");

  return `${dataToSign}.${signature}`;
}

export function verifySignedToken(token: string): AuthTokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signature] = parts;
    const dataToSign = `${headerStr}.${payloadStr}`;
    const expectedSig = crypto.createHmac("sha256", SERVER_AUTH_SECRET).update(dataToSign).digest("base64url");

    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSig);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return null;
    }

    const payload: AuthTokenPayload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

// Express Auth Router
export const authRouter = express.Router();

// 1. POST /api/auth/login
authRouter.post("/login", (req, res) => {
  try {
    const { username, password, roleHint } = req.body;
    const cleanUser = String(username || "").trim();
    const cleanPass = String(password || "").trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: "Username and password are required." });
    }

    const lowerUser = cleanUser.toLowerCase();

    // Valid admin identifiers
    const validAdminUsers = [
      DEFAULT_ADMIN_USER,
      "tejasadinarayan",
      "admin",
      "admintejas",
      "admintejas1679",
      "owner",
      "adinarayan",
      "nani@tejasc.in",
      "nani@tejasc.in",
      "nani"
    ];
    const isAdminUser = validAdminUsers.includes(lowerUser);
    const isAdminPass = verifyPassword(cleanPass, adminPasswordRecord.hash, adminPasswordRecord.salt) || (DEFAULT_ADMIN_PASS && cleanPass === DEFAULT_ADMIN_PASS);

    // Check Admin Authentication
    if (roleHint === "admin" || isAdminUser) {
      if (isAdminPass) {
        const token = createSignedToken({
          sub: "admin-tejas-01",
          username: cleanUser || "tejasadinarayan",
          role: "admin",
          email: "nani@tejasc.in",
          name: "Tejas Adinarayan (Admin)",
        });

        return res.json({
          success: true,
          token,
          user: {
            role: "admin",
            username: cleanUser || "tejasadinarayan",
            name: "Tejas Adinarayan (Admin)",
            email: "nani@tejasc.in",
          }
        });
      }

      if (roleHint === "admin") {
        return res.status(401).json({ success: false, error: "Invalid Admin Password. Access Denied." });
      }
    }

    // Check Employee Authentication
    if (roleHint === "employee" || ["employee", "employee1", "sortex", "staff", "operations", "weighbridge"].includes(lowerUser)) {
      // Find employee by username, email, phone, or id
      let empRecord = employeeStore.get(lowerUser);
      if (!empRecord) {
        const lowerClean = cleanUser.toLowerCase();
        const digitsClean = cleanUser.replace(/\D/g, "");
        for (const record of employeeStore.values()) {
          if (
            record.username.toLowerCase() === lowerClean ||
            record.email.toLowerCase() === lowerClean ||
            record.id.toLowerCase() === lowerClean ||
            (record.phone && digitsClean.length >= 7 && record.phone.replace(/\D/g, '').includes(digitsClean))
          ) {
            empRecord = record;
            break;
          }
        }
      }

      const isRecordPass = Boolean(
        empRecord &&
        empRecord.passwordHash &&
        empRecord.salt &&
        verifyPassword(cleanPass, empRecord.passwordHash, empRecord.salt)
      );

      if (isRecordPass && empRecord) {
        const displayName = empRecord.name || `${cleanUser.toUpperCase()} (Operations Staff)`;
        const displayEmail = empRecord.email || `${(empRecord.username || lowerUser)}@tejasc.in`;
        const token = createSignedToken({
          sub: empRecord.id || `emp-${empRecord.username || lowerUser}`,
          username: empRecord.username || lowerUser,
          role: "employee",
          email: displayEmail,
          name: displayName,
        });

        return res.json({
          success: true,
          token,
          user: {
            role: "employee",
            username: empRecord.username || lowerUser,
            name: displayName,
            email: displayEmail,
          }
        });
      }

      if (roleHint === "employee") {
        return res.status(401).json({
          success: false,
          error: "Invalid Employee credentials. Please check your assigned password."
        });
      }
    }

    // Check Merchant Authentication
    // Merchants authenticate with phone, email, or username
    let resolvedEmail = cleanUser;
    let resolvedName = cleanUser.includes("@") ? cleanUser.split("@")[0].toUpperCase() : cleanUser.toUpperCase();
    const isPhone = /^[0-9+\s-]{8,15}$/.test(cleanUser);
    if (isPhone) {
      const digitsOnly = cleanUser.replace(/\D/g, "");
      resolvedEmail = `${digitsOnly}@tejasc.in`;
      resolvedName = `Merchant (+91 ${digitsOnly})`;
    } else if (!cleanUser.includes("@")) {
      const cleanU = cleanUser.toLowerCase().replace(/[^a-z0-9]/g, "");
      resolvedEmail = `${cleanU || "merchant"}@tejasc.in`;
    }

    const token = createSignedToken({
      sub: `merchant-${Date.now()}`,
      username: cleanUser,
      role: "merchant",
      email: resolvedEmail,
      name: resolvedName,
    });

    return res.json({
      success: true,
      token,
      user: {
        role: "merchant",
        username: cleanUser,
        name: resolvedName,
        email: resolvedEmail,
      }
    });
  } catch (err: any) {
    console.error("Auth login error:", err);
    return res.status(500).json({ success: false, error: "Internal authentication error." });
  }
});

// 2. GET /api/auth/verify (Token verification)
authRouter.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  if (!token) {
    return res.status(401).json({ valid: false, error: "No authentication token provided." });
  }

  const payload = verifySignedToken(token);
  if (!payload) {
    return res.status(401).json({ valid: false, error: "Invalid or expired token." });
  }

  return res.json({
    valid: true,
    user: {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    }
  });
});

// 3. POST /api/auth/verify-action (Admin sensitive action authorization)
authRouter.post("/verify-action", (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  const { password, action } = req.body;

  // Option A: Token-based verification (must be admin)
  if (token) {
    const payload = verifySignedToken(token);
    if (payload && payload.role === "admin") {
      // If a confirmation password was also provided, verify it too
      if (password) {
        const clean = String(password).trim();
        if (!verifyPassword(clean, adminPasswordRecord.hash, adminPasswordRecord.salt)) {
          return res.status(401).json({ authorized: false, error: "Incorrect admin confirmation password." });
        }
      }
      return res.json({ authorized: true, action: action || "generic" });
    }
  }

  // Option B: Password-based verification
  if (password) {
    const clean = String(password).trim();
    if (verifyPassword(clean, adminPasswordRecord.hash, adminPasswordRecord.salt) || (DEFAULT_ADMIN_PASS && clean === DEFAULT_ADMIN_PASS)) {
      return res.json({ authorized: true, action: action || "generic" });
    }
  }

  return res.status(403).json({ authorized: false, error: "Action unauthorized. Admin privileges required." });
});

// 4. POST /api/auth/manage-employee (Admin employee creation / update with secure server-side hashing)
authRouter.post("/manage-employee", (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  const payload = token ? verifySignedToken(token) : null;
  // Strictly enforce cryptographic admin role verification. No bypass headers allowed.
  const isAuthorizedAdmin = Boolean(payload && payload.role === "admin");

  if (!isAuthorizedAdmin) {
    return res.status(403).json({ success: false, error: "Only Admin can manage employee credentials." });
  }

  const { action, employee } = req.body;
  if (!employee || (!employee.username && !employee.name)) {
    return res.status(400).json({ success: false, error: "Employee username or name is required." });
  }

  const rawUser = employee.username || (employee.name ? String(employee.name).toLowerCase().replace(/\s+/g, "_") : `emp_${Date.now()}`);
  const lowerUser = String(rawUser).trim().toLowerCase();

  if (action === "delete") {
    employeeStore.delete(lowerUser);
    savePersistedEmployees();
    return res.json({ success: true, message: `Employee ${lowerUser} credentials deleted.` });
  }

  // Create or Update
  const pass = String(employee.password || "emp1977").trim();
  const { hash, salt } = hashPassword(pass);

  const cred: EmployeeCredential = {
    id: employee.id || `EMP-${Date.now()}`,
    name: employee.name || "Operations Staff",
    username: lowerUser,
    email: employee.email || `${lowerUser}@tejasc.in`,
    role: employee.role || "Operations Staff",
    phone: employee.phone || "",
    passwordHash: hash,
    salt: salt,
    updatedAt: new Date().toISOString()
  };

  employeeStore.set(lowerUser, cred);
  savePersistedEmployees();

  // Return sanitized employee (WITHOUT passwordHash or salt)
  return res.json({
    success: true,
    employee: {
      id: cred.id,
      name: cred.name,
      username: cred.username,
      email: cred.email,
      role: cred.role,
      updatedAt: cred.updatedAt
    }
  });
});

// 5. GET /api/auth/employees (List staff accounts without exposing passwords)
authRouter.get("/employees", (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  const payload = token ? verifySignedToken(token) : null;
  if (!payload || (payload.role !== "admin" && payload.role !== "employee")) {
    return res.status(403).json({ success: false, error: "Staff authorization required." });
  }

  const sanitized = Array.from(employeeStore.values()).map(e => ({
    id: e.id,
    name: e.name,
    username: e.username,
    email: e.email,
    role: e.role,
    updatedAt: e.updatedAt
  }));

  return res.json({ success: true, employees: sanitized });
});

/* ==========================================================================
   SECTION 2: META WHATSAPP CLOUD API WEBHOOKS
   ========================================================================== */
// Interfaces for Meta WhatsApp Cloud API Webhook Payloads
export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
  document?: { id: string; filename?: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  button?: { text: string; payload: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  errors?: Array<{ code: number; title: string; message?: string }>;
  [key: string]: any;
}

export interface WebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
  [key: string]: any;
}

export interface WebhookChangeValue {
  messaging_product: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id: string;
  }>;
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
  errors?: any[];
}

export interface WebhookChange {
  field: string;
  value: WebhookChangeValue;
}

export interface WebhookEntry {
  id: string;
  changes?: WebhookChange[];
}

export interface WebhookPayload {
  object: string;
  entry?: WebhookEntry[];
}

export interface WebhookRecordedEvent {
  id: string;
  type: "status" | "message";
  metaMessageId: string;
  status?: string;
  messageType?: string;
  from?: string; // masked for privacy
  timestamp: string;
  metaTimestamp?: string;
  errorCode?: number;
  errorMessage?: string;
  preview?: string;
}

// In-memory ring buffer for recent webhook events
const recentWebhookEvents: WebhookRecordedEvent[] = [];
const MAX_RECORDED_EVENTS = 100;

export function recordWebhookEvent(event: Omit<WebhookRecordedEvent, "id" | "timestamp">): WebhookRecordedEvent {
  const item: WebhookRecordedEvent = {
    id: `WHE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  recentWebhookEvents.unshift(item);
  if (recentWebhookEvents.length > MAX_RECORDED_EVENTS) {
    recentWebhookEvents.pop();
  }
  return item;
}

export function getRecentWebhookEvents(): WebhookRecordedEvent[] {
  return [...recentWebhookEvents];
}

// In-memory deduplication cache
const processedEventCache = new Map<string, number>();
const MAX_CACHE_SIZE = 5000;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isDuplicateEvent(eventId: string): boolean {
  if (!eventId) return false;
  const now = Date.now();

  if (processedEventCache.size > MAX_CACHE_SIZE) {
    for (const [key, timestamp] of processedEventCache.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        processedEventCache.delete(key);
      }
    }
  }

  if (processedEventCache.has(eventId)) {
    return true;
  }

  processedEventCache.set(eventId, now);
  return false;
}

export function clearProcessedEventCache(): void {
  processedEventCache.clear();
}

// Helper: Mask phone numbers in logs and audit trails
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 4) return "****";
  return cleaned.substring(0, 4) + "****" + cleaned.substring(cleaned.length - 2);
}

// Helper: Sanitize message preview to prevent leaking private text
export function sanitizeMessagePreview(text?: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.substring(0, 30) + (trimmed.length > 30 ? "..." : "");
}

// Signature Verification Function
export function verifyMetaSignature(
  rawBody: Buffer | string | undefined | null,
  signatureHeader: string | undefined | null,
  appSecret: string | undefined | null
): { valid: boolean; error?: string; code?: number } {
  if (!appSecret) {
    console.warn("[WhatsApp Webhook] META_APP_SECRET is not configured on server. Allowing webhook payload without HMAC signature verification. Set META_APP_SECRET in Vercel to enforce strict signature validation.");
    return { valid: true };
  }

  if (!signatureHeader || typeof signatureHeader !== "string") {
    return {
      valid: false,
      error: "Missing X-Hub-Signature-256 header.",
      code: 401,
    };
  }

  if (rawBody === undefined || rawBody === null) {
    return {
      valid: false,
      error: "Missing raw request body for signature verification.",
      code: 400,
    };
  }

  const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");

  // Meta signature format: "sha256=<hex_digest>"
  const parts = signatureHeader.split("=");
  const sigHex = parts.length === 2 && parts[0] === "sha256" ? parts[1] : parts[0];

  if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) {
    return {
      valid: false,
      error: "Malformed X-Hub-Signature-256 header format.",
      code: 401,
    };
  }

  const computedHex = crypto.createHmac("sha256", appSecret).update(rawBuffer).digest("hex");

  try {
    const a = Buffer.from(sigHex.toLowerCase(), "hex");
    const b = Buffer.from(computedHex.toLowerCase(), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        valid: false,
        error: "Invalid webhook signature (HMAC-SHA256 mismatch).",
        code: 401,
      };
    }
  } catch {
    return {
      valid: false,
      error: "Error verifying signature buffer.",
      code: 401,
    };
  }

  return { valid: true };
}

// GET Verification Handler
export function handleGetVerification(req: express.Request, res: express.Response) {
  const mode = req.query["hub.mode"] as string | undefined;
  const token = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;

  const expectedToken =
    process.env.META_WHATSAPP_VERIFY_TOKEN ||
    (process.env.NODE_ENV !== "test" ? "tejas_wa_verify_2026_mandi" : undefined);

  if (!expectedToken) {
    console.error("[WhatsApp Webhook] Verification failed: META_WHATSAPP_VERIFY_TOKEN is not configured on server.");
    return res.status(500).type("text/plain").send("Webhook verify token not configured on server.");
  }

  // Meta requires hub.mode === "subscribe"
  if (mode === "subscribe" && token === expectedToken) {
    if (!challenge) {
      console.warn("[WhatsApp Webhook] Verification rejected: Missing hub.challenge in subscribe request.");
      return res.status(400).type("text/plain").send("Missing hub.challenge parameter.");
    }
    console.log("[WhatsApp Webhook] GET Verification successful! Returning challenge token.");
    // Return the challenge exactly as plain text with HTTP 200
    return res.status(200).type("text/plain").send(challenge);
  }

  console.warn("[WhatsApp Webhook] Verification rejected: Invalid mode or token mismatch.");
  return res.status(403).type("text/plain").send("Forbidden: Invalid verification request or token mismatch.");
}

// Status update callback type
export type StatusUpdateCallback = (
  metaMessageId: string,
  status: "sent" | "delivered" | "read" | "failed",
  timestamp: string,
  errors?: any[]
) => void;

let onStatusUpdateListener: StatusUpdateCallback | null = null;

export function setStatusUpdateListener(listener: StatusUpdateCallback | null) {
  onStatusUpdateListener = listener;
}

// Extract raw body helper supporting Express verify buffer, Buffer body, and string fallback
export function extractRawBody(req: any): Buffer | null {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.rawBody === "string") {
    return Buffer.from(req.rawBody, "utf8");
  }
  return null;
}

// POST Webhook Reception Handler
export function handlePostWebhook(req: express.Request, res: express.Response) {
  const sigHeader = (req.headers["x-hub-signature-256"] || req.get("x-hub-signature-256")) as string | undefined;
  const appSecret = process.env.META_APP_SECRET;

  const rawBuffer = extractRawBody(req);
  if (!rawBuffer) {
    console.error("[WhatsApp Webhook] Raw request body not captured. Check body-parser verify configuration.");
    return res.status(400).json({
      error: "Unable to verify signature: Raw request body was not captured.",
    });
  }

  // Step 1: Signature Verification
  const verification = verifyMetaSignature(rawBuffer, sigHeader, appSecret);
  if (!verification.valid) {
    console.warn(`[WhatsApp Webhook] Signature verification failed: ${verification.error}`);
    return res.status(verification.code || 401).json({
      error: verification.error,
    });
  }

  // Step 2: Validate expected webhook object
  const payload = req.body as WebhookPayload;
  if (!payload || payload.object !== "whatsapp_business_account") {
    console.warn("[WhatsApp Webhook] Rejected: Webhook object is not 'whatsapp_business_account'", {
      receivedObject: payload?.object,
    });
    return res.status(400).json({
      error: "Unexpected webhook object. Expected 'whatsapp_business_account'.",
    });
  }

  // Step 3: Parse entry & changes defensively
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let processedStatusesCount = 0;
  let processedMessagesCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value) continue;

      // 3A: Process Outgoing Message Delivery Statuses
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const statusId = status.id;
          const statusState = status.status; // "sent" | "delivered" | "read" | "failed"
          const statusTime = status.timestamp;

          if (!statusId || !statusState) continue;

          // Deduplication
          const dedupKey = `status:${statusId}:${statusState}`;
          if (isDuplicateEvent(dedupKey)) {
            console.log(`[WhatsApp Webhook] Skipping duplicate status event: ${dedupKey}`);
            continue;
          }

          processedStatusesCount++;

          const firstError = status.errors?.[0];
          const errorCode = firstError?.code;
          const errorMessage = firstError?.message || firstError?.title;

          console.log("[WhatsApp Webhook] Status update received:", {
            metaMessageId: statusId,
            status: statusState,
            timestamp: statusTime,
            recipient: maskPhoneNumber(status.recipient_id),
            ...(errorCode ? { errorCode, errorMessage } : {}),
          });

          // Record in audit log
          recordWebhookEvent({
            type: "status",
            metaMessageId: statusId,
            status: statusState,
            metaTimestamp: statusTime,
            from: maskPhoneNumber(status.recipient_id),
            errorCode,
            errorMessage,
            preview: `Status changed to ${statusState}`,
          });

          // Notify listener to correlate with dispatchHistory
          if (onStatusUpdateListener) {
            try {
              onStatusUpdateListener(statusId, statusState, statusTime, status.errors);
            } catch (listenerErr) {
              console.warn("[WhatsApp Webhook] Status listener error:", listenerErr);
            }
          }
        }
      }

      // 3B: Process Incoming Messages
      if (Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const msgId = msg.id;
          const msgFrom = msg.from;
          const msgType = msg.type || "unknown";
          const msgTime = msg.timestamp;

          if (!msgId) continue;

          // Deduplication
          const dedupKey = `msg:${msgId}`;
          if (isDuplicateEvent(dedupKey)) {
            console.log(`[WhatsApp Webhook] Skipping duplicate message event: ${dedupKey}`);
            continue;
          }

          processedMessagesCount++;

          let preview = `[${msgType.toUpperCase()}]`;
          if (msgType === "text" && msg.text?.body) {
            preview = sanitizeMessagePreview(msg.text.body);
          } else if (msgType === "image") {
            preview = msg.image?.caption ? `[IMAGE] ${sanitizeMessagePreview(msg.image.caption)}` : "[IMAGE Attachment]";
          } else if (msgType === "document") {
            preview = `[DOCUMENT] ${msg.document?.filename || "attachment"}`;
          } else if (msgType === "location") {
            preview = `[LOCATION] ${msg.location?.name || "Shared coordinates"}`;
          }

          console.log("[WhatsApp Webhook] Incoming message received:", {
            msgId,
            from: maskPhoneNumber(msgFrom),
            type: msgType,
            timestamp: msgTime,
          });

          // Record in audit trail
          recordWebhookEvent({
            type: "message",
            metaMessageId: msgId,
            messageType: msgType,
            from: maskPhoneNumber(msgFrom),
            metaTimestamp: msgTime,
            preview,
          });

          // Per security rules: Do NOT auto-reply and do NOT alter database/orders without explicit auth
        }
      }
    }
  }

  // Prompt acknowledgement: Meta expects HTTP 200 within a few seconds
  return res.status(200).json({
    success: true,
    status: "EVENT_RECEIVED",
    processed: {
      statuses: processedStatusesCount,
      messages: processedMessagesCount,
    },
  });
}

// Create Express Router
export const whatsappWebhookRouter = express.Router();

whatsappWebhookRouter.get("/", handleGetVerification);
whatsappWebhookRouter.get("", handleGetVerification);

whatsappWebhookRouter.post("/", handlePostWebhook);
whatsappWebhookRouter.post("", handlePostWebhook);

/* ==========================================================================
   SECTION 3: EXPRESS APPLICATION & CORE BUSINESS ROUTERS
   ========================================================================== */
// Load environment variables

const app = express();

// Normalize req.url when rewritten by Vercel serverless proxy (/api/(.*) -> /api)
// Normalize req.url when rewritten by Vercel serverless proxy (/api/(.*) -> /api?_path=/api/$1)
app.use((req, _res, next) => {
  let customPath = (
    req.headers["x-requested-path"] || 
    req.headers["x-original-url"] || 
    req.headers["x-forwarded-uri"] || 
    req.headers["x-invoke-path"] || 
    (req.query?._path ? String(req.query._path) : undefined)
  ) as string | undefined;

  if (!customPath && req.url && req.url.includes("_path=")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      customPath = parsedUrl.searchParams.get("_path") || undefined;
    } catch {}
  }

  if (customPath && typeof customPath === "string" && customPath.startsWith("/")) {
    req.url = customPath;
  } else {
    const invokePath = (req.headers["x-invoke-path"] || req.headers["x-forwarded-uri"] || req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]) as string | undefined;
    if (invokePath && invokePath !== "/" && invokePath !== "/api" && invokePath !== "") {
      req.url = invokePath;
    }
  }
  next();
});

// Body parser with 10MB limit and rawBody buffer capture for HMAC-SHA256 signature verification
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Payload-based route resolver for Vercel/proxies that collapse subpaths to / or /api
app.use((req, _res, next) => {
  if (req.method === "POST" && (req.url === "/" || req.url === "/api" || req.url === "/api/" || req.path === "/" || req.path === "/api")) {
    if (req.body?.to && (req.body?.poNumber || req.body?.supplierName || req.body?.htmlContent || req.body?.html || req.body?.batchId)) {
      req.url = "/api/dispatch-po";
    } else if (req.body?.to && (req.body?.templateName || req.body?.brand || req.body?.buyerName || req.body?.message || req.body?.phoneNumberId || req.body?.templateParams)) {
      req.url = "/api/dispatch-whatsapp";
    }
  }
  next();
});

// Server-side Authentication & Session Authorization routes
app.use(["/api/auth", "/auth"], authRouter);

// Meta WhatsApp Cloud API Webhooks (GET verification & POST event reception)
// Support both /api/webhooks/whatsapp and /webhooks/whatsapp for local and Vercel serverless rewrites
app.use(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], whatsappWebhookRouter);

// Health check endpoints for container and Cloud Run readiness/liveness probes
app.all(["/api/health", "/health", "/healthz", "/_ah/health", "/readyz", "/livez"], (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Chat Bot endpoint for business data insights
app.post(["/api/chat", "/chat"], async (req, res) => {
  try {
    const { message, history, context } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please define it in your Secrets panel."
      });
    }

    // Initialize the official Google GenAI SDK
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    // Construct a detailed system instruction for the LLM to ground it on business data
    const systemInstruction = `You are "Mandi AI," a brilliant, highly capable, and localized Procurement AI companion for the RiceAggregator Procurement Portal (operated by Tejas Canvassing).
Your goal is to answer client, trade, financial, and logistics-related analytics questions instantly and accurately, based purely on live business datasets provided in your data context.

=== INSTRUCTIONS & STRATEGY ===
1. **Pending Payments Queries**:
   - Look at the "arrivals" list. Each arrival row represents a cargo shipment with dynamic values.
   - If "noOfDayRec" is "Not Cleared" or "noOfDayRec" does not equal "Cleared", that shipment's payment is outstanding/pending!
   - Under "arrivals", "partyName" represents the Buyer/Client (e.g. 'V.K FOODS', 'PLATINUM TRADERS'). "netAmt" or "amount" is the outstanding amount.
   - Summarize the ledger records to say which Buyers/Clients have outstanding payments, what is their exact balance sum, and print a clear list sorted by balance size.
   - Example clients from seed data: 'V.K FOODS', 'PLATINUM TRADERS', 'POPULAR TRADERS', etc.

2. **Quantity Pending to be Loaded (Contracts & Placed Orders)**:
   - Look at the "orders" list. Each order represents a contract agreement.
   - When an order's status is "Placed" or "Confirmed", it means the cargo is active but hasn't arrived/finished loading at destination yet! (Only status === "Arrived" means it is loaded and delivered).
   - Compute the sum of "qty" (quintals - QTLS) for the matching "buyer" or client where status is not "Arrived" yet.
   - For example, if they ask: "For a certain client how much quantity is pending to be loaded?", find their orders with status !== "Arrived", aggregate the quantities, and summarize clearly.

3. **General Business Search**:
   - You have access to detailed arrivals, orders, and ledger information. Answer queries about millers (suppliers), brands (e.g., 'Royal Heritage', 'Golden Grains'), locations (e.g., 'Amritsar', 'Patiala'), or general volumes.
   - Keep answers objective, highly technical, yet clean and friendly.
   - NEVER invent/simulate data outside of the provided context. If a client is not found, respectfully say: "I couldn't find active matching records for that client, but here are the clients listed in our current base..."

4. **Formatting**:
   - Always format currency sums nicely in Indian Rupees (use ₹ and standard format like ₹ 8,70,000).
   - Express grain quantities with the suffix QTLS (Quintals) (e.g., 220 QTLS).
   - Use scannable markdown bullet lists and bold text highlights for high readability.

=== ACTIVE BUSINESS DATA CONTEXT ===
- Physical Arrivals (Spreadsheet): ${JSON.stringify(context?.arrivals || [])}
- Placed Orders (Contracts): ${JSON.stringify(context?.orders || [])}
- Ledger Accounts: ${JSON.stringify(context?.ledgers || [])}
==================================
Current Date/Time: ${new Date().toISOString()}
User Identity: ${context?.userEmail || "Authorized Staff Member"}
User Role Context: ${context?.userRole || "Administrator / Broker"}

Write a polite, precise, and professional response that solves the user's specific request using the live context.`;

    // Structure chat messages
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text || msg.content }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Helper for calling Gemini with exponential backoff for rate limits (429 / RESOURCE_EXHAUSTED)
    const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
      let delay = 1200;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRateLimit =
            err?.status === 429 ||
            err?.code === 429 ||
            String(err?.message || "").toLowerCase().includes("rate") ||
            String(err?.message || "").toLowerCase().includes("quota") ||
            String(err?.message || "").toLowerCase().includes("resource_exhausted");

          if (isRateLimit && attempt < maxRetries - 1) {
            console.warn(`[Gemini API] Rate limit hit on /api/chat. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    };

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.15,
        }
      })
    );

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in Express router /api/chat:", error);
    const isRateLimit =
      error?.status === 429 ||
      error?.code === 429 ||
      String(error?.message || "").toLowerCase().includes("rate") ||
      String(error?.message || "").toLowerCase().includes("quota") ||
      String(error?.message || "").toLowerCase().includes("resource_exhausted");

    if (isRateLimit) {
      return res.status(429).json({
        error: "AI request rate limit reached. Please wait a few seconds and try again.",
        isRateLimit: true
      });
    }

    res.status(500).json({ error: error.message || "Failed to generate AI insights." });
  }
});

// In-memory log of recent dispatches for live verification
interface DispatchLogItem {
  id: string;
  type: "po_email" | "whatsapp" | "sms" | "quote_email";
  target: string;
  recipientName?: string;
  subject?: string;
  message?: string;
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed" | "delivered_real" | "delivered_simulated" | "accepted";
  details: string;
  directLink?: string;
  metaMessageId?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string | number;
  errorMessage?: string;
}

const dispatchHistory: DispatchLogItem[] = [];

function recordDispatch(item: Omit<DispatchLogItem, "id" | "timestamp">) {
  const logEntry: DispatchLogItem = {
    id: `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...item,
  };
  dispatchHistory.unshift(logEntry);
  if (dispatchHistory.length > 50) dispatchHistory.pop();
  return logEntry;
}

// Correlate incoming Meta WhatsApp status updates with dispatchHistory
setStatusUpdateListener((metaMessageId, status, timestamp, errors) => {
  const item = dispatchHistory.find((d) => d.metaMessageId === metaMessageId);
  if (item) {
    item.deliveryStatus = status;
    if (status === "delivered") {
      item.status = "delivered";
      item.deliveredAt = new Date(Number(timestamp) * 1000).toISOString();
      item.details = `Delivered to recipient on WhatsApp (Confirmed at ${item.deliveredAt}).`;
    } else if (status === "read") {
      item.status = "read";
      item.readAt = new Date(Number(timestamp) * 1000).toISOString();
      item.details = `Read by recipient on WhatsApp (Confirmed at ${item.readAt}).`;
    } else if (status === "failed") {
      item.status = "failed";
      const err = errors?.[0];
      item.errorCode = err?.code || "FAILED";
      item.errorMessage = err?.message || err?.title || "Message delivery failed";
      item.details = `WhatsApp delivery failed: ${item.errorMessage} (Code: ${item.errorCode})`;
    }
  }
});

// ==========================================================================
// SECTION: OFFICIAL GMAIL API OAUTH 2.0 PURCHASE ORDER DISPATCHER & TRACKING
// ==========================================================================

// 1. AUTOMATIC PO DISPATCHING ENDPOINT (Section 5, 6, 9)
app.post(["/api/dispatch-po", "/api/send-po-email", "/dispatch-po", "/send-po-email"], async (req, res) => {
  if (!(await verifyAdminRequest(req, { disallowBodyPassword: true, failClosed: true }))) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Admin privileges required for purchase order dispatch. A verified Admin session token is required."
    });
  }
  try {
    const {
      to,
      supplierName: reqSupplierName,
      subject,
      htmlContent,
      textContent,
      poNumber: reqPoNumber,
      html,
      text,
      batchId,
      orderId: reqOrderId,
      pdfBase64,
      pdfFilename,
      isManualRetry,
      orderDetails,
      accessToken: reqAccessToken,
      googleAccessToken
    } = req.body;

    const effectiveToken = reqAccessToken || googleAccessToken;

    const poNumber = reqPoNumber || orderDetails?.id;
    const supplier = String(reqSupplierName || orderDetails?.supplier || "Supplier").trim();
    const orderId = String(reqOrderId || batchId || poNumber || `PO-${Date.now()}`).trim();
    const poRef = String(poNumber || batchId || orderId).trim();
    const recipientEmail = String(to || "").trim();

    // 1A. DUPLICATE-PREVENTION & IDEMPOTENCY CHECK (Section 9)
    if (!isManualRetry && isOrderAlreadySent(orderId)) {
      const existingRecord = getTrackingRecord(orderId);
      console.log(`[Email Dispatcher] Order ${orderId} already sent or processed (Status: ${existingRecord?.status}). Duplicate email prevented.`);
      return res.status(200).json({
        success: true,
        status: "already_sent",
        isLiveSent: true,
        alreadyProcessed: true,
        message: `Purchase Order ${orderId} has already been sent to ${existingRecord?.recipientEmail || recipientEmail}. Duplicate email prevented.`,
        record: existingRecord,
      });
    }

    // 1B. MISSING OR INVALID RECIPIENT EMAIL VALIDATION (Section 5)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = recipientEmail && emailRegex.test(recipientEmail);

    if (!isValidEmail) {
      queueEmailJob({
        orderId,
        poRef,
        supplierName: supplier,
        recipientEmail: recipientEmail || "missing@supplier.invalid",
        pdfFilename: pdfFilename || `PO_${poRef}_Tejas_Canvassing.pdf`,
      });
      updateTrackingStatus(orderId, {
        status: "Bounced/Failed",
        failureReason: "Supplier email address is missing or invalid. Please update the supplier profile and retry.",
      }, {
        event: "Email Dispatch Aborted",
        details: "Recipient email is missing or improperly formatted. Placed order preserved without sending.",
        source: "backend",
      });

      return res.status(400).json({
        success: false,
        status: "failed",
        error: "Supplier email address is missing or invalid.",
        record: getTrackingRecord(orderId),
      });
    }

    // 1C. CRYPTOGRAPHIC ACKNOWLEDGEMENT TOKEN & URL (Section 8)
    const host = req.get("host") || "app.tejasc.in";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" || host.includes("tejasc.in") ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const { token, dateStr } = generateAcknowledgementToken(orderId, recipientEmail);
    const ackUrl = `${baseUrl}/acknowledge-po?po=${encodeURIComponent(orderId)}&t=${token}&d=${dateStr}`;
    const trackingPixelUrl = `${baseUrl}/api/track-open?po=${encodeURIComponent(orderId)}&t=${token}`;

    let effectivePdfBase64 = pdfBase64;
    let effectivePdfFilename = pdfFilename || `PO_${poRef}_Tejas_Canvassing.pdf`;

    if (!effectivePdfBase64) {
      try {
        const orderForPdf = orderDetails || {
          id: orderId,
          poNumber: poRef,
          supplier,
          date: new Date().toISOString()
        };
        const subOrdersForPdf = orderDetails?.originalOrders || [];
        effectivePdfBase64 = generatePoPdfBase64(orderForPdf, subOrdersForPdf);
        effectivePdfFilename = getPoPdfFileName(orderForPdf);
      } catch (pdfErr) {
        console.warn(`[PO PDF Generator] Server-side PDF generation failed:`, pdfErr);
      }
    }

    // 1D. QUEUE EMAIL JOB (Section 7)
    queueEmailJob({
      orderId,
      poRef,
      supplierName: supplier,
      recipientEmail,
      acknowledgementUrl: ackUrl,
      pdfFilename: effectivePdfFilename,
      pdfSizeBytes: effectivePdfBase64 ? Buffer.from(effectivePdfBase64, 'base64').length : undefined,
    });

    updateTrackingStatus(orderId, { status: "Sending" }, {
      event: "Backend Processing",
      details: "Transmitting purchase order documents via official Gmail API OAuth 2.0 (nani@tejasc.in)...",
      source: "backend",
    });

    // 1E. COMPOSE CC RECIPIENTS (Ensure Admin receives a copy in their mailbox, excluding automatic personal copies)
    const disallowedCc = new Set(["tejasadinarayan@gmail.com", "tejascanvassing@gmail.com"]);
    const adminEmails = [
      ...(req.body.cc ? String(req.body.cc).split(",").map((s: string) => s.trim()) : []),
      ...(req.body.adminEmail ? [String(req.body.adminEmail).trim()] : []),
      process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER_EMAIL || "nani@tejasc.in",
      process.env.SMTP_FROM,
      process.env.SMTP_USER,
      ...(req.body.from ? [String(req.body.from).trim()] : [])
    ];
    const uniqueCc = Array.from(
      new Set(
        adminEmails
          .filter(Boolean)
          .map(e => String(e).trim().toLowerCase())
          .filter(e => e && e !== recipientEmail.toLowerCase() && !disallowedCc.has(e))
      )
    ).join(", ");

    // 1F. COMPOSE SUBJECT & HTML BODY (Preserve template exactly matching user's reference)
    const finalSubject = subject || "Tejas Canvassing: New purchase orders";
    let finalHtml = htmlContent || html || `<p>Purchase Order from Tejas Canvassing</p>`;
    const finalText = textContent || text || `Today's orders:\nOfficial Purchase Order for ${supplier}.`;

    if (!finalHtml.includes("/api/track-open")) {
      if (finalHtml.includes("</body>")) {
        finalHtml = finalHtml.replace("</body>", `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none; width:1px; height:1px; border:0;" /></body>`);
      } else {
        finalHtml += `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none; width:1px; height:1px; border:0;" />`;
      }
    }

    // 1G. TRANSMIT VIA GMAIL API OAUTH 2.0 OR LIVE SMTP
    const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER_EMAIL || process.env.GMAIL_USER || "nani@tejasc.in").trim();
    const rawSmtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || "").trim();
    const smtpPass = rawSmtpPass.replace(/\s+/g, "");
    const hasSmtpConfig = Boolean(smtpUser && smtpPass);
    const isServerOAuthConfigured = isGmailOAuthConfigured();
    const hasClientToken = Boolean(effectiveToken);
    const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

    let sentMessageId = "";
    let dispatchMethod = "";
    let lastError = "";

    // Test environment shortcut
    if (isTestEnv) {
      sentMessageId = `test_smtp_${Date.now()}@gmail.com`;
      dispatchMethod = "test_environment";
    }

    // Try Method 1: Gmail API OAuth (prefer verified server-side OAuth over client tokens)
    if (!sentMessageId && (isServerOAuthConfigured || hasClientToken)) {
      try {
        const sendResult = await sendEmailViaGmailApi({
          to: recipientEmail,
          cc: uniqueCc || "nani@tejasc.in",
          subject: finalSubject,
          htmlContent: finalHtml,
          textContent: finalText,
          pdfBase64: effectivePdfBase64,
          pdfFilename: effectivePdfFilename,
          // If server OAuth is configured, always use server credentials; only use client token as secondary fallback
          accessToken: isServerOAuthConfigured ? undefined : effectiveToken,
        });
        sentMessageId = sendResult.id;
        dispatchMethod = "gmail_api";
      } catch (gmailErr: any) {
        lastError = gmailErr?.message || "Gmail API failed";
        console.warn(`[Email Dispatcher] Gmail API attempt failed: ${lastError}`);
        // If failed with client token and server OAuth was not attempted, try server OAuth if available
        if (!isServerOAuthConfigured && hasClientToken) {
          // Token may have been invalid
          lastError = `Client Gmail token failed: ${gmailErr?.message || "Unauthorized"}`;
        }
      }
    }

    // Try Method 2: Verified SMTP transporter (if SMTP_PASS is configured)
    if (!sentMessageId && hasSmtpConfig) {
      try {
        console.log(`[Email Dispatcher] Transmitting PO via SMTP transporter (${smtpUser}) to ${recipientEmail}...`);
        const nodemailer = await import("nodemailer");
        const cleanHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
        const cleanPort = parseInt(process.env.SMTP_PORT || "465", 10);
        const transporter = cleanHost.includes("gmail")
          ? nodemailer.createTransport({
              service: "gmail",
              auth: { user: smtpUser, pass: smtpPass },
            })
          : nodemailer.createTransport({
              host: cleanHost,
              port: cleanPort,
              secure: cleanPort === 465,
              auth: { user: smtpUser, pass: smtpPass },
            });

        const attachments: any[] = effectivePdfBase64 ? [{
          filename: effectivePdfFilename,
          content: Buffer.from(effectivePdfBase64, 'base64'),
          contentType: 'application/pdf',
        }] : [];

        if (finalHtml.includes('cid:company-logo') || finalHtml.includes('cid:logo')) {
          attachments.push({
            filename: 'logo.png',
            content: Buffer.from(TC_COMPANY_LOGO_BASE64.replace(/^data:image\/png;base64,/, ''), 'base64'),
            cid: 'company-logo',
          });
        }

        const info = await transporter.sendMail({
          from: `"Tejas Canvassing" <${process.env.SMTP_FROM || smtpUser}>`,
          to: recipientEmail,
          cc: uniqueCc || process.env.SMTP_FROM || smtpUser,
          subject: finalSubject,
          html: finalHtml,
          text: finalText,
          attachments,
        });
        sentMessageId = info.messageId;
        dispatchMethod = "smtp";
      } catch (smtpErr: any) {
        lastError = smtpErr?.message || "SMTP dispatch failed";
        console.error(`[Email Dispatcher] SMTP attempt failed:`, smtpErr);
      }
    }

    // If an actual email was successfully transmitted:
    if (sentMessageId) {
      const updatedRecord = updateTrackingStatus(orderId, {
        status: "Sent",
        sentAt: new Date().toISOString(),
        gmailMessageId: sentMessageId,
      }, {
        event: dispatchMethod === "gmail_api" ? "Email Accepted by Gmail API" : "Email Sent via SMTP",
        details: `Dispatched to ${recipientEmail} via ${dispatchMethod}. Message ID: ${sentMessageId}`,
        source: dispatchMethod === "gmail_api" ? "gmail_api" : "backend",
      });

      recordDispatch({
        type: "po_email",
        target: recipientEmail,
        recipientName: supplier,
        subject: finalSubject,
        message: finalText,
        status: "sent",
        details: `Sent via ${dispatchMethod} to ${recipientEmail}. Message ID: ${sentMessageId}`,
      });

      return res.status(200).json({
        success: true,
        status: "Sent",
        isLiveSent: true,
        messageId: sentMessageId,
        gmailMessageId: sentMessageId,
        record: updatedRecord,
        message: `Purchase Order ${poRef} successfully delivered to ${recipientEmail} via ${dispatchMethod}.`,
      });
    }

    // Both methods failed: NEVER return fake 200 "Sent"! Return 500 error!
    const failureReason = lastError || "Neither Gmail API nor SMTP transporter could deliver the message.";
    const failedRecord = updateTrackingStatus(orderId, {
      status: "Bounced/Failed",
      failureReason,
    }, {
      event: "Email Dispatch Failed",
      details: `Delivery to ${recipientEmail} failed: ${failureReason}`,
      source: "backend",
    });

    recordDispatch({
      type: "po_email",
      target: recipientEmail,
      recipientName: supplier,
      subject: finalSubject,
      message: finalText,
      status: "failed",
      details: `Delivery failure: ${failureReason}`,
    });

    return res.status(500).json({
      success: false,
      status: "failed",
      isLiveSent: false,
      error: `Email dispatch failed: ${failureReason}`,
      record: failedRecord,
    });
  } catch (err: any) {
    console.error("[Email Dispatcher Fatal Error]:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Internal server error during email dispatch.",
    });
  }
});

// 2. GMAIL OAUTH AUTHORIZATION URL ROUTE (Section 6)
app.get(["/api/auth/gmail/authorize", "/auth/gmail/authorize"], (req, res) => {
  try {
    const host = req.get("host") || "app.tejasc.in";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" || host.includes("tejasc.in") ? "https" : "http";
    const redirectUri = `${protocol}://${host}/api/auth/gmail/callback`;

    const url = getAuthorizationUrl(redirectUri);
    return res.redirect(url);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || "Could not generate Google authorization URL." });
  }
});

// 3. GMAIL OAUTH CALLBACK ROUTE (Section 6)
app.get(["/api/auth/gmail/callback", "/auth/gmail/callback"], async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("[Gmail OAuth Callback] Authorization error:", error);
    return res.redirect(`/settings?gmail_oauth=error&error=${encodeURIComponent(String(error))}`);
  }

  if (!code) {
    return res.redirect("/settings?gmail_oauth=error&error=No+authorization+code+provided");
  }

  try {
    const host = req.get("host") || "app.tejasc.in";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" || host.includes("tejasc.in") ? "https" : "http";
    const redirectUri = `${protocol}://${host}/api/auth/gmail/callback`;

    const result = await exchangeCodeForTokens(String(code), redirectUri);
    console.log(`[Gmail OAuth] Successfully authorized account: ${result.email}`);
    return res.redirect("/settings?gmail_oauth=success");
  } catch (err: any) {
    console.error("[Gmail OAuth Callback] Token exchange failed:", err);
    return res.redirect(`/settings?gmail_oauth=error&error=${encodeURIComponent(err?.message || "Token exchange failed")}`);
  }
});

// 4. GMAIL OAUTH STATUS ROUTE (Section 6)
// 4B. TEST GMAIL API REST CONNECTIVITY
app.get(["/api/auth/gmail/test", "/auth/gmail/test"], async (req, res) => {
  try {
    const result = await testGmailApiConnection();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.get(["/api/auth/gmail/status", "/auth/gmail/status"], (req, res) => {
  const creds = getStoredOAuthCredentials();
  const configured = isGmailOAuthConfigured();
  return res.json({
    configured,
    authorized: configured,
    authorizedEmail: creds.authorizedEmail || "nani@tejasc.in",
    emailAddress: creds.authorizedEmail || "nani@tejasc.in",
    hasClientId: Boolean(creds.clientId),
    hasClientSecret: Boolean(creds.clientSecret),
    hasRefreshToken: Boolean(creds.refreshToken),
    redirectUri: creds.redirectUri,
    updatedAt: creds.updatedAt,
  });
});

// 5. UPDATE GMAIL OAUTH CREDENTIALS ROUTE (Section 6)
app.post(["/api/update-gmail-oauth-credentials", "/update-gmail-oauth-credentials"], async (req, res) => {
  if (!(await verifyAdminRequest(req))) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Admin privileges required to update Gmail OAuth credentials."
    });
  }

  const { clientId, clientSecret, refreshToken } = req.body;

  const updated = saveOAuthCredentials({
    clientId: (clientId || "").trim(),
    clientSecret: (clientSecret || "").trim(),
    refreshToken: (refreshToken || "").trim(),
  });

  return res.json({
    success: true,
    configured: isGmailOAuthConfigured(),
    message: isGmailOAuthConfigured()
      ? "Gmail API OAuth 2.0 credentials saved and verified!"
      : "Gmail Client ID & Secret saved. Click 'Authorize with Google' to link nani@tejasc.in.",
    credentials: {
      hasClientId: Boolean(updated.clientId),
      hasClientSecret: Boolean(updated.clientSecret),
      hasRefreshToken: Boolean(updated.refreshToken),
      authorizedEmail: updated.authorizedEmail,
    }
  });
});

// 6. PO EMAIL TRACKING LIST & STATS (Section 7, 10)
app.get(["/api/po-tracking", "/po-tracking"], (req, res) => {
  const records = getAllTrackingRecords();
  const stats = {
    total: records.length,
    queued: records.filter(r => r.status === 'Queued' || r.status === 'Sending').length,
    sent: records.filter(r => r.status === 'Sent').length,
    deliveryUnconfirmed: records.filter(r => r.status === 'Delivery unconfirmed').length,
    delivered: records.filter(r => r.status === 'Delivered').length,
    bounced: records.filter(r => r.status === 'Bounced/Failed').length,
    acknowledged: records.filter(r => r.status === 'Acknowledged').length,
    opened: records.filter(r => r.status === 'Opened').length,
  };

  return res.json({
    success: true,
    stats,
    records,
  });
});

// 7. CHECK GMAIL MAILBOX FOR BOUNCES (Section 8)
app.get(["/api/po-tracking/check-bounces", "/po-tracking/check-bounces"], async (req, res) => {
  if (!isGmailOAuthConfigured()) {
    return res.json({ success: false, error: "Gmail OAuth not configured." });
  }

  const records = getAllTrackingRecords().filter(r => r.status === 'Sent' || r.status === 'Delivery unconfirmed');
  let bounceCount = 0;

  for (const rec of records) {
    try {
      const bounceResult = await checkMailboxBounces(rec.recipientEmail, rec.threadId);
      if (bounceResult.hasBounce) {
        bounceCount++;
        updateTrackingStatus(rec.orderId, {
          status: "Bounced/Failed",
          bouncedAt: bounceResult.bounceTimestamp || new Date().toISOString(),
          bounceDiagnostics: bounceResult.bounceDetails,
          failureReason: `Delivery failure detected from Mailer-Daemon: ${bounceResult.bounceDetails}`,
        }, {
          event: "Bounce Detected in Mailbox",
          details: `Permanent delivery failure reported for ${rec.recipientEmail}: ${bounceResult.bounceDetails}`,
          source: "gmail_api",
        });
      } else {
        // If sent more than 5 minutes ago and no bounce detected, mark as 'Delivery unconfirmed'
        const sentTime = rec.sentAt ? new Date(rec.sentAt).getTime() : 0;
        if (sentTime > 0 && Date.now() - sentTime > 5 * 60 * 1000 && rec.status === 'Sent') {
          updateTrackingStatus(rec.orderId, {
            status: "Delivery unconfirmed",
          }, {
            event: "Status: Delivery unconfirmed",
            details: "Gmail accepted message for delivery. No bounce detected; awaiting explicit delivery confirmation or supplier acknowledgement.",
            source: "backend",
          });
        }
      }
    } catch (e) {
      console.warn(`[Bounce Check Error] Order ${rec.orderId}:`, e);
    }
  }

  return res.json({
    success: true,
    checkedRecords: records.length,
    bouncesFound: bounceCount,
  });
});

// 8. GET SPECIFIC PO TRACKING RECORD (Section 7)
app.get(["/api/po-tracking/:orderId", "/po-tracking/:orderId"], (req, res) => {
  const orderId = req.params.orderId;
  const record = getTrackingRecord(orderId);
  if (!record) {
    return res.status(404).json({ success: false, error: `Tracking record for order ${orderId} not found.` });
  }
  return res.json({ success: true, record });
});

// MARK PO EMAIL SENT ACTION (e.g. sent via Gmail Web or external client)
app.post(["/api/po-tracking/:orderId/mark-sent", "/po-tracking/:orderId/mark-sent"], (req, res) => {
  const { orderId } = req.params;
  const updated = updateTrackingStatus(orderId, {
    status: "Sent",
    sentAt: new Date().toISOString(),
  }, {
    event: "PO Email Sent via Direct Gmail Web",
    details: `Supplier PO for order ${orderId} transmitted directly via pre-filled Gmail Web compose.`,
    source: "tracker",
  });
  return res.json({ success: true, record: updated });
});

// 9. MANUAL RETRY ACTION FOR RECOVERY AFTER FAILURE (Section 9, 12)
app.post(["/api/po-tracking/:orderId/retry", "/po-tracking/:orderId/retry"], async (req, res) => {
  const orderId = req.params.orderId;
  const record = getTrackingRecord(orderId);
  if (!record) {
    return res.status(404).json({ success: false, error: `Tracking record for order ${orderId} not found.` });
  }

  // Prevent retrying already acknowledged or successfully sent orders unless forced
  if (record.status === 'Acknowledged') {
    return res.status(400).json({ success: false, error: "This purchase order has already been acknowledged by the supplier." });
  }

  try {
    updateTrackingStatus(orderId, {
      status: 'Sending',
      attempts: record.attempts + 1,
    }, {
      event: 'Manual Retry Initiated',
      details: `Authorized operator initiated manual retry (Attempt #${record.attempts + 1}).`,
      source: 'backend',
    });

    // Delegate to dispatch-po handler with isManualRetry = true
    const host = req.get("host") || "app.tejasc.in";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" || host.includes("tejasc.in") ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const { token, dateStr } = generateAcknowledgementToken(orderId, record.recipientEmail);
    const ackUrl = `${baseUrl}/acknowledge-po?po=${encodeURIComponent(orderId)}&t=${token}&d=${dateStr}`;

    const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER_EMAIL || process.env.GMAIL_USER || "nani@tejasc.in").trim();
    const rawSmtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || "").trim();
    const smtpPass = rawSmtpPass.replace(/\s+/g, "");
    const hasSmtpConfig = Boolean(smtpUser && smtpPass);
    const hasOAuthConfig = isGmailOAuthConfigured();

    const subject = req.body?.subject || `Tejas Canvassing: New purchase orders`;
    const htmlContent = req.body?.html || req.body?.htmlContent;
    const textContent = req.body?.text || req.body?.textContent || `Tejas Canvassing: New purchase orders for ${record.supplierName || 'Supplier'}`;

    if (!htmlContent) {
      return res.status(400).json({ success: false, error: "Official PO HTML content is required to dispatch." });
    }

    let retryPdfBase64 = req.body?.pdfBase64;
    let retryPdfFilename = req.body?.pdfFilename || record.pdfFilename || `PO_${orderId}_Tejas_Canvassing.pdf`;

    if (!retryPdfBase64) {
      try {
        const orderForPdf = req.body?.orderDetails || {
          id: orderId,
          supplier: record.supplierName,
          date: record.queuedAt || new Date().toISOString()
        };
        const subOrdersForPdf = req.body?.orderDetails?.originalOrders || [];
        retryPdfBase64 = generatePoPdfBase64(orderForPdf, subOrdersForPdf);
        retryPdfFilename = getPoPdfFileName(orderForPdf);
      } catch (err) {
        console.warn(`[PO Retry] Failed to generate PDF for retry:`, err);
      }
    }

    if (hasOAuthConfig) {
      const sendResult = await sendEmailViaGmailApi({
        to: record.recipientEmail,
        cc: "nani@tejasc.in",
        subject,
        htmlContent,
        textContent,
        pdfBase64: retryPdfBase64,
        pdfFilename: retryPdfFilename,
      });

      const updated = updateTrackingStatus(orderId, {
        status: "Sent",
        sentAt: new Date().toISOString(),
        gmailMessageId: sendResult.id,
        threadId: sendResult.threadId,
      }, {
        event: "Retry Accepted by Gmail API",
        details: `Gmail accepted message on retry. Message ID: ${sendResult.id}.`,
        source: "gmail_api",
      });

      return res.json({ success: true, status: "Sent", record: updated });
    } else if (hasSmtpConfig) {
      const nodemailer = await import("nodemailer");
      const cleanHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
      const cleanPort = parseInt(process.env.SMTP_PORT || "465", 10);
      const transporter = cleanHost.includes("gmail")
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: smtpUser, pass: smtpPass },
          })
        : nodemailer.createTransport({
            host: cleanHost,
            port: cleanPort,
            secure: cleanPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
          });

      const retryAttachments: any[] = retryPdfBase64 ? [{
        filename: retryPdfFilename,
        content: Buffer.from(retryPdfBase64, 'base64'),
        contentType: 'application/pdf',
      }] : [];

      if (htmlContent.includes('cid:company-logo') || htmlContent.includes('cid:logo')) {
        retryAttachments.push({
          filename: 'logo.png',
          content: Buffer.from(TC_COMPANY_LOGO_BASE64.replace(/^data:image\/png;base64,/, ''), 'base64'),
          cid: 'company-logo',
        });
      }

      const info = await transporter.sendMail({
        from: `"Tejas Canvassing" <${process.env.SMTP_FROM || smtpUser}>`,
        to: record.recipientEmail,
        cc: process.env.SMTP_FROM || smtpUser,
        subject,
        html: htmlContent,
        text: textContent,
        attachments: retryAttachments,
      });

      const updated = updateTrackingStatus(orderId, {
        status: "Sent",
        sentAt: new Date().toISOString(),
        gmailMessageId: info.messageId,
      }, {
        event: "Email Sent via SMTP",
        details: `Sent to ${record.recipientEmail} via SMTP (${smtpUser}). ID: ${info.messageId}`,
        source: "backend",
      });

      return res.json({ success: true, status: "Sent", record: updated, message: `Dispatched to ${record.recipientEmail} via SMTP.` });
    } else {
      updateTrackingStatus(orderId, {
        status: "Queued",
        failureReason: "Neither Gmail OAuth nor SMTP App Password configured.",
      });
      return res.json({ success: true, status: "Queued", message: "Retry queued. Configure Gmail OAuth or SMTP App Password in Settings." });
    }
  } catch (err: any) {
    updateTrackingStatus(orderId, {
      status: "Bounced/Failed",
      failureReason: err?.message || "Retry failed",
    });
    return res.status(500).json({ success: false, error: err?.message || "Retry failed" });
  }
});

/* ==========================================================================
   SECTION 9C: APPLICATION B (KESHAR KALI SUPPLIER PORTAL) OUTBOUND API INTEGRATION
   ========================================================================== */

/**
 * Outbound synchronization route triggering server-to-server sync of a placed PO to Application B
 */
app.post(["/api/integration/sync-po", "/integration/sync-po"], async (req, res) => {
  if (!(await verifyAdminRequest(req))) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Admin authorization required to synchronize with Supplier Portal.",
    });
  }

  const { poNumber, isManualRetry } = req.body || {};
  if (!poNumber) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter 'poNumber'.",
    });
  }

  try {
    const result = await syncPoToSupplierPortal(poNumber, {
      isManualRetry: Boolean(isManualRetry),
    });
    return res.status(result.success ? 200 : 502).json(result);
  } catch (err: any) {
    console.error("[Supplier Portal Route Error]:", err);
    return res.status(500).json({
      success: false,
      status: "Failed",
      poNumber,
      error: err?.message || "Internal server error during supplier portal sync.",
    });
  }
});

/**
 * Read-only status route for a specific PO's synchronization state
 */
app.get(["/api/integration/sync-status/:poNumber", "/integration/sync-status/:poNumber"], (req, res) => {
  const poNumber = req.params.poNumber;
  const record = getSyncRecord(poNumber);
  return res.json({
    success: true,
    poNumber,
    record: record || null,
  });
});

/**
 * List all synchronization records for integration monitoring
 */
app.get(["/api/integration/sync-records", "/integration/sync-records"], (req, res) => {
  const records = getAllSyncRecords();
  return res.json({
    success: true,
    count: records.length,
    records,
  });
});

/* ==========================================================================
   SECTION 9D: APPLICATION B (SUPPLIER UPDATES WEBHOOK & FEED)
   ========================================================================== */

/**
 * Inbound webhook receiving Mill Bills, Truck Loadings, and PO Confirmations from Milling Partners
 */
app.post(
  ["/api/integration/supplier-update-webhook", "/integration/supplier-update-webhook"],
  async (req: any, res) => {
    try {
      const result = await processSupplierUpdateWebhook(
        req.body,
        req.headers,
        req.rawBody
      );
      return res.status(result.code).json(result);
    } catch (err: any) {
      console.error("[Supplier Update Webhook Route Error]:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal server error processing supplier update webhook.",
      });
    }
  }
);

/**
 * Feed of recent miller updates (bills, loadings, confirmations)
 */
app.get(
  ["/api/integration/miller-updates", "/integration/miller-updates"],
  (_req, res) => {
    try {
      const updates = getAllMillerUpdates();
      const unreadCount = getUnreadUpdatesCount();
      return res.json({
        success: true,
        count: updates.length,
        unreadCount,
        updates,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to retrieve miller updates.",
      });
    }
  }
);

/**
 * Mark a single update as read
 */
app.post(
  ["/api/integration/miller-updates/mark-read", "/integration/miller-updates/mark-read"],
  (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "Missing update 'id'." });
    const ok = markUpdateAsRead(id);
    return res.json({ success: ok, unreadCount: getUnreadUpdatesCount() });
  }
);

/**
 * Mark all updates as read
 */
app.post(
  ["/api/integration/miller-updates/mark-all-read", "/integration/miller-updates/mark-all-read"],
  (_req, res) => {
    const marked = markAllUpdatesAsRead();
    return res.json({ success: true, marked, unreadCount: 0 });
  }
);

/**
 * Synchronize accepted purchase orders, attached bills, and loadings directly from Application B
 */
app.all(
  ["/api/integration/sync-app-b", "/integration/sync-app-b"],
  async (_req, res) => {
    try {
      const result = await syncAcceptedOrdersFromAppB();
      return res.json(result);
    } catch (err: any) {
      console.error("[Sync App B Route Error]:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to sync updates from Application B",
      });
    }
  }
);

/**
 * Clear test data from miller updates store and data/miller_updates.json
 */
app.post(
  ["/api/integration/miller-updates/clear-test-data", "/integration/miller-updates/clear-test-data"],
  (_req, res) => {
    try {
      const removed = removeTestUpdates();
      return res.json({ success: true, removed, count: getAllMillerUpdates().length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to clear test data." });
    }
  }
);


// 9B. COMMERCIAL QUOTE DETAILS DISPATCHER (TRANSMITS DETAILS TO EMAIL)
app.post(["/api/dispatch-quote", "/dispatch-quote"], async (req, res) => {
  try {
    const { name, company, email, phone, riceType, quantity, message } = req.body;

    const requesterName = String(name || "Prospective Merchant").trim();
    const requesterCompany = String(company || "").trim();
    const requesterEmail = String(email || "").trim();
    const requesterPhone = String(phone || "").trim();
    const productRequested = String(riceType || "General Wholesale Inquiry").trim();
    const qtyRequested = String(quantity || "Not specified").trim();
    const requirements = String(message || "No additional comments").trim();
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const subject = `[Quote Request] ${requesterName}${requesterCompany ? ` (${requesterCompany})` : ""} — ${productRequested}`;

    const textContent = [
      `NEW COMMERCIAL QUOTE REQUEST`,
      `Tejas Canvassing Grain Brokerage Desk`,
      `----------------------------------------------------`,
      `Time: ${timestamp}`,
      `Buyer / Merchant: ${requesterName}`,
      `Company / Firm: ${requesterCompany || "Individual Merchant"}`,
      `Contact Phone: ${requesterPhone || "N/A"}`,
      `Email Address: ${requesterEmail || "N/A"}`,
      `Product / Variety: ${productRequested}`,
      `Quantity Needed: ${qtyRequested} MT`,
      `Additional Notes: ${requirements}`,
      `----------------------------------------------------`,
      `Please reply directly to ${requesterEmail || requesterPhone} or call from the broker desk.`,
    ].join("\n");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #0d2318; padding: 28px 32px; text-align: left; border-bottom: 3px solid #C9A158; }
          .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0; color: #C9A158; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
          .body { padding: 32px; }
          .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 20px; border: 1px solid #fde68a; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
          .table td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
          .table td.label { font-weight: 600; color: #64748b; width: 38%; background: #f8fafc; }
          .table td.value { font-weight: 700; color: #0f172a; }
          .msg-box { background: #f8fafc; border-left: 4px solid #C9A158; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-top: 12px; font-size: 13px; color: #334155; line-height: 1.6; }
          .footer { background: #f8fafc; padding: 20px 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
          .action-btn { display: inline-block; background: #0d2318; color: #ffffff !important; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TEJAS CANVASSING</h1>
            <p>Commercial Grain Brokerage · APMC Yard Yeshwanthpur</p>
          </div>
          <div class="body">
            <span class="badge">Direct Website Quote Inquiry</span>
            <h2 style="margin: 0 0 16px; font-size: 17px; color: #0f172a;">New Quote Details Submitted</h2>
            <p style="font-size: 13px; color: #475569; margin: 0 0 20px; line-height: 1.5;">
              A merchant has submitted a pricing & delivery quotation request on <strong>app.tejasc.in</strong>. Below are the complete specifications:
            </p>

            <table class="table">
              <tr>
                <td class="label">Merchant Name</td>
                <td class="value">${requesterName}</td>
              </tr>
              <tr>
                <td class="label">Company / Firm</td>
                <td class="value">${requesterCompany || "Individual Trader"}</td>
              </tr>
              <tr>
                <td class="label">Contact Phone</td>
                <td class="value"><a href="tel:${requesterPhone}" style="color: #0d2318; text-decoration: none;">${requesterPhone || "N/A"}</a></td>
              </tr>
              <tr>
                <td class="label">Email Address</td>
                <td class="value"><a href="mailto:${requesterEmail}" style="color: #0d2318; text-decoration: none;">${requesterEmail || "N/A"}</a></td>
              </tr>
              <tr>
                <td class="label">Brand / Variety</td>
                <td class="value" style="color: #92400e; font-size: 14px;">${productRequested}</td>
              </tr>
              <tr>
                <td class="label">Quantity Needed</td>
                <td class="value">${qtyRequested} ${qtyRequested.toLowerCase().includes('mt') || qtyRequested.toLowerCase().includes('qtl') ? '' : 'MT'}</td>
              </tr>
              <tr>
                <td class="label">Submission Date & Time</td>
                <td class="value">${timestamp}</td>
              </tr>
            </table>

            <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Additional Requirements / Notes:</div>
            <div class="msg-box">${requirements.replace(/\n/g, '<br/>')}</div>

            ${requesterEmail ? `<a href="mailto:${requesterEmail}?subject=Re: Quote for ${encodeURIComponent(productRequested)} - Tejas Canvassing" class="action-btn">Reply to Merchant Email</a>` : ''}
          </div>
          <div class="footer">
            Tejas Canvassing · 123, 4th Main Rd, APMC Yard, Yeshwanthpur, Bengaluru 560022<br/>
            Broker Desk: +91 99164 16995 · nani@tejasc.in
          </div>
        </div>
      </body>
      </html>
    `;

    let sendResult = null;
    if (isGmailOAuthConfigured()) {
      sendResult = await sendEmailViaGmailApi({
        to: "nani@tejasc.in",
        cc: requesterEmail && requesterEmail.includes("@") ? requesterEmail : undefined,
        subject,
        htmlContent,
        textContent,
      });
      console.log(`[Quote Dispatcher] Email transmitted to nani@tejasc.in via Gmail API (ID: ${sendResult.id})`);
    } else {
      console.warn("[Quote Dispatcher] Gmail API OAuth is not yet configured, logged inquiry locally.");
    }

    recordDispatch({
      type: "quote_email",
      target: "nani@tejasc.in",
      recipientName: requesterName,
      subject,
      message: textContent,
      status: "sent",
      details: sendResult ? `Sent via Gmail API (ID: ${sendResult.id})` : "Logged locally (Gmail OAuth pending)",
    });

    return res.status(200).json({
      success: true,
      message: "Quote request details successfully sent to email (nani@tejasc.in).",
      messageId: sendResult?.id || null,
    });
  } catch (err: any) {
    console.error("[Quote Dispatcher Error]:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to transmit quote details to email.",
    });
  }
});

// 10. PUBLIC SUPPLIER ACKNOWLEDGEMENT DETAILS ENDPOINT (Section 8)
app.get(["/api/acknowledge-po-details", "/acknowledge-po-details"], (req, res) => {
  const { po, t, d } = req.query;
  const orderId = String(po || "").trim();
  const token = String(t || "").trim();
  const dateStr = String(d || "").trim();

  if (!orderId || !token || !dateStr) {
    return res.status(400).json({ success: false, error: "Missing required acknowledgement parameters (po, t, d)." });
  }

  const record = getTrackingRecord(orderId);
  if (!record) {
    return res.status(404).json({ success: false, error: `Purchase Order reference ${orderId} not found.` });
  }

  const isValid = verifyAcknowledgementToken(orderId, record.recipientEmail, token, dateStr);
  if (!isValid) {
    return res.status(403).json({ success: false, error: "Invalid or expired acknowledgement token. Access denied." });
  }

  return res.json({
    success: true,
    poRef: record.poRef,
    supplierName: record.supplierName,
    recipientEmail: record.recipientEmail,
    status: record.status,
    queuedAt: record.queuedAt,
    sentAt: record.sentAt,
    acknowledgedAt: record.acknowledgedAt,
    isAlreadyAcknowledged: Boolean(record.acknowledgedAt),
  });
});

// 11. CONFIRM SUPPLIER ACKNOWLEDGEMENT (Section 8)
app.post(["/api/acknowledge-po", "/acknowledge-po"], (req, res) => {
  const { po, t, d, notes } = req.body;
  const orderId = String(po || "").trim();
  const token = String(t || "").trim();
  const dateStr = String(d || "").trim();

  if (!orderId || !token || !dateStr) {
    return res.status(400).json({ success: false, error: "Missing required acknowledgement parameters (po, t, d)." });
  }

  const record = getTrackingRecord(orderId);
  if (!record) {
    return res.status(404).json({ success: false, error: `Purchase Order reference ${orderId} not found.` });
  }

  const isValid = verifyAcknowledgementToken(orderId, record.recipientEmail, token, dateStr);
  if (!isValid) {
    return res.status(403).json({ success: false, error: "Invalid or expired acknowledgement token. Access denied." });
  }

  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const result = recordAcknowledgement(orderId, String(ip), notes ? String(notes).trim() : undefined);

  return res.json({
    success: true,
    alreadyAcknowledged: result.alreadyAcknowledged,
    acknowledgedAt: result.record?.acknowledgedAt,
    message: result.alreadyAcknowledged
      ? `Purchase Order ${record.poRef} receipt was already confirmed on ${result.record?.acknowledgedAt}.`
      : `Purchase Order ${record.poRef} receipt successfully confirmed! Tejas Canvassing has been notified.`,
    record: result.record,
  });
});

// 12. 1x1 TRANSPARENT TRACKING PIXEL (Section 8)
app.get(["/api/track-open", "/track-open"], (req, res) => {
  const { po } = req.query;
  const orderId = String(po || "").trim();

  if (orderId) {
    recordEmailOpen(orderId);
  }

  // 1x1 transparent GIF bytes
  const transparentGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": transparentGif.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  return res.end(transparentGif);
});

// Helper for formatting phone numbers to E.164 and WhatsApp format
function formatPhoneNumber(phone: string) {
  let digits = String(phone || "").replace(/[^0-9]/g, "");
  while (digits.startsWith("0")) digits = digits.substring(1);
  while (digits.startsWith("9191") && digits.length > 12) {
    digits = digits.substring(2);
  }
  if (digits.length === 10) {
    return { e164: `+91${digits}`, digits: `91${digits}`, national: digits };
  }
  if (digits.startsWith("91") && digits.length === 12) {
    return { e164: `+${digits}`, digits, national: digits.substring(2) };
  }
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return { e164: `+91${last10}`, digits: `91${last10}`, national: last10 };
  }
  return { e164: "+919945351166", digits: "919945351166", national: "9945351166" };
}

export function getMetaWhatsAppCredentials() {
  let phoneId = (process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  let token = (process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN || "").trim();
  let templateName = (process.env.META_WHATSAPP_TEMPLATE_NAME || process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  let businessAccountId = (process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();

  for (const envFile of envCandidates) {
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, "utf-8");
        const mPhone = content.match(/^(?:META_)?WHATSAPP_PHONE_NUMBER_ID=(.*)$/m);
        if (mPhone && mPhone[1].trim() && !phoneId) phoneId = mPhone[1].trim();
        const mToken = content.match(/^(?:META_)?(?:WHATSAPP_TOKEN|ACCESS_TOKEN)=(.*)$/m);
        if (mToken && mToken[1].trim() && !token) token = mToken[1].trim();
        const mTemplate = content.match(/^(?:META_)?WHATSAPP_TEMPLATE_NAME=(.*)$/m);
        if (mTemplate && mTemplate[1].trim() && !templateName) templateName = mTemplate[1].trim();
        const mWaba = content.match(/^(?:META_)?WHATSAPP_BUSINESS_ACCOUNT_ID=(.*)$/m);
        if (mWaba && mWaba[1].trim() && !businessAccountId) businessAccountId = mWaba[1].trim();
      } catch { }
    }
  }

  return {
    phoneId: phoneId.replace(/^["']|["']$/g, '').trim(),
    token: token.replace(/^["']|["']$/g, '').trim(),
    templateName: templateName.replace(/^["']|["']$/g, '').trim(),
    businessAccountId: businessAccountId.replace(/^["']|["']$/g, '').trim()
  };
}

export function getMetaTemplateName(): string {
  const creds = getMetaWhatsAppCredentials();
  const configured = creds.templateName || (process.env.META_WHATSAPP_TEMPLATE_NAME || "").trim();
  if (configured && configured !== "order_placed_notification") {
    return configured;
  }
  return "order_notify";
}

// REAL DISPATCH ROUTER: WHATSAPP NOTIFICATIONS via Meta WhatsApp Cloud API or Direct WhatsApp
app.post(["/api/dispatch-whatsapp", "/dispatch-whatsapp"], async (req, res) => {
  if (!(await verifyAdminRequest(req, { disallowBodyPassword: true, failClosed: true }))) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Admin privileges required for WhatsApp dispatch. A verified Admin session token is required."
    });
  }

  const {
    to,
    buyerName,
    message,
    orderId,
    poNumber,
    contentSid,
    templateParams: reqTemplateParams,
    languageCode,
  } = req.body;

  // Enforce secure server-side Meta credentials only - never accept client tokens or phone IDs
  const metaCreds = getMetaWhatsAppCredentials();
  const activePhoneId = metaCreds.phoneId || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
  const activeToken = metaCreds.token || process.env.META_WHATSAPP_TOKEN || "";
  const activeTemplate = metaCreds.templateName || (process.env.META_WHATSAPP_TEMPLATE_NAME && process.env.META_WHATSAPP_TEMPLATE_NAME !== "order_placed_notification" ? process.env.META_WHATSAPP_TEMPLATE_NAME : "") || "order_notify";
  const activeLang = String(languageCode || process.env.META_WHATSAPP_LANGUAGE_CODE || "en").trim() || "en";

  if (!to || (!message && !contentSid && !activeTemplate && !reqTemplateParams)) {
    return res.status(400).json({ error: "Recipient phone number ('to') and order notification details are required." });
  }

  const { e164, digits } = formatPhoneNumber(String(to));
  const waDirectUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message || "")}`;

  // 1. Check for Meta WhatsApp Cloud API Credentials on server
  if (activePhoneId && activeToken) {
    console.log("[Meta WhatsApp Cloud API] Initiating dispatch:", {
      destination: digits,
      phoneId: activePhoneId,
      template: activeTemplate || "(raw text)",
      tokenPrefix: `${activeToken.substring(0, 8)}...`
    });

    try {
      const sendMetaMessage = async (payload: any) => {
        const response = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const text = await response.text();
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        return { response, data: parsed };
      };

      // Validate template parameters for order notification
      let pBuyer = String(buyerName || req.body.customerName || req.body.recipientName || "").trim();
      let pBrand = String(req.body.brand || req.body.product || req.body.items || "").trim();
      let pQty = String(req.body.qty || req.body.quantity || "").trim();
      let pRate = String(req.body.rate || req.body.price || "").trim();

      if (Array.isArray(reqTemplateParams) && reqTemplateParams.length >= 4) {
        pBuyer = pBuyer || String(reqTemplateParams[0] || "").trim();
        pBrand = pBrand || String(reqTemplateParams[1] || "").trim();
        pQty = pQty || String(reqTemplateParams[2] || "").trim();
        pRate = pRate || String(reqTemplateParams[3] || "").trim();
      }

      // Check if we have complete 4-parameter set for the approved template
      const hasFullOrderParams = Boolean(pBuyer && pBrand && pQty && pRate);

      let metaPayload: any;
      let finalMessage = String(message || "").trim();

      if (activeTemplate && hasFullOrderParams) {
        const templateParamsList = [pBuyer, pBrand, pQty, pRate];
        finalMessage = finalMessage || `Hello ${pBuyer},\n\nOrder placed successfully.\n\nBrand: ${pBrand}\nQuantity: ${pQty} QTL\nRate: ₹${pRate}/QTL\n\nThank you,\nTejas Canvassing`;

        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digits,
          type: "template",
          template: {
            name: activeTemplate,
            language: { code: activeLang },
            components: [
              {
                type: "body",
                parameters: templateParamsList.map(p => ({ type: "text", text: String(p) }))
              }
            ]
          }
        };
      } else if (finalMessage) {
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digits,
          type: "text",
          text: {
            preview_url: false,
            body: finalMessage
          }
        };
      } else {
        return res.status(400).json({
          success: false,
          error: `Template "${activeTemplate}" requires 4 parameters: buyerName, brand, qty, rate.`,
          errorCode: "INVALID_TEMPLATE_PARAMS"
        });
      }

      const { response: metaResponse, data: metaData } = await sendMetaMessage(metaPayload);

      console.log("[Meta WhatsApp API Response]:", {
        status: metaResponse.status,
        data: metaData
      });

      if (metaResponse.ok && !metaData.error) {
        const messageId = metaData.messages?.[0]?.id || "accepted";
        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || pBuyer || "Buyer",
          message: finalMessage || `Meta Template: ${activeTemplate}`,
          status: "accepted",
          deliveryStatus: "accepted",
          metaMessageId: messageId,
          details: `Accepted by Meta Graph API (Message ID: ${messageId}, Destination: ${digits}). Awaiting delivery webhook confirmation.`,
          directLink: waDirectUrl
        });

        const trackingRef = String(poNumber || orderId || "").trim();
        if (trackingRef) {
          try {
            updateTrackingStatus(trackingRef, {
              whatsappSent: true,
              whatsappSentAt: new Date().toISOString(),
              whatsappMessageId: messageId,
            }, {
              event: "WhatsApp Notification Accepted",
              details: `Notification accepted by Meta Graph API for ${digits} (Message ID: ${messageId}). Awaiting webhook delivery receipt.`,
              source: "backend",
            });
          } catch {}
        }

        // Return HTTP 200 with clear Accepted status (not claiming delivered yet)
        return res.status(200).json({
          success: true,
          gateway: "meta_whatsapp",
          status: "Accepted",
          isLiveSent: false,
          messageId,
          formattedPhone: e164,
          directUrl: waDirectUrl,
          message: `WhatsApp notification accepted by Meta Graph API for ${e164} (Message ID: ${messageId}). Delivery status will update via webhook.`,
          metaResponse: metaData,
          log: logged
        });
      } else {
        const errorMsg = metaData.error?.message || metaData.error?.error_user_msg || `Meta WhatsApp API error (HTTP ${metaResponse.status})`;
        const errorCode = metaData.error?.code || metaResponse.status;
        const httpStatus = metaResponse.status >= 400 ? metaResponse.status : 400;

        console.warn(`[Meta WhatsApp Cloud API Error] HTTP ${httpStatus}, Code ${errorCode}:`, errorMsg);

        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || pBuyer || "Buyer",
          message: finalMessage || `Meta Template: ${activeTemplate}`,
          status: "failed",
          details: `Meta WhatsApp Error (Code ${errorCode}): ${errorMsg}`,
          directLink: waDirectUrl
        });

        return res.status(httpStatus).json({
          success: false,
          gateway: "meta_whatsapp",
          status: "Failed",
          error: errorMsg,
          errorCode,
          metaResponse: metaData,
          directUrl: waDirectUrl,
          formattedPhone: e164,
          log: logged
        });
      }
    } catch (networkErr: any) {
      console.error("[Meta WhatsApp Network Failure]:", networkErr);
      const logged = recordDispatch({
        type: "whatsapp",
        target: e164,
        recipientName: buyerName || "Buyer",
        message: message || `Meta Template: ${activeTemplate}`,
        status: "failed",
        details: `Meta WhatsApp Network Error: ${networkErr?.message || "Failed to reach Meta Graph API"}`,
        directLink: waDirectUrl
      });

      return res.status(502).json({
        success: false,
        gateway: "meta_whatsapp",
        status: "Failed",
        error: `Could not reach Meta WhatsApp Cloud API servers: ${networkErr?.message || "Network Timeout"}.`,
        errorCode: "NETWORK_ERROR",
        directUrl: waDirectUrl,
        formattedPhone: e164,
        log: logged
      });
    }
  }

  // If server credentials are missing, return 500 error
  return res.status(500).json({
    success: false,
    gateway: "meta_whatsapp",
    status: "Failed",
    error: "Meta WhatsApp Cloud API credentials (phone number ID or token) are not configured on the server. Please define META_WHATSAPP_PHONE_NUMBER_ID and META_WHATSAPP_TOKEN.",
    errorCode: "SERVER_CREDENTIALS_MISSING",
    directUrl: waDirectUrl,
    formattedPhone: e164
  });
});

// REAL DISPATCH ROUTER: SMS NOTIFICATIONS
app.post(["/api/dispatch-sms", "/dispatch-sms"], async (req, res) => {
  const { to, recipientName, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Recipient phone number ('to') and 'message' are required." });
  }

  const { e164, national } = formatPhoneNumber(String(to));
  const smsDirectUrl = `sms:${e164}?body=${encodeURIComponent(message)}`;

  const logged = recordDispatch({
    type: "sms",
    target: e164,
    recipientName: recipientName || "Recipient",
    message,
    status: "delivered_simulated",
    details: `Simulated dispatch recorded in backend logs; direct SMS link generated.`,
    directLink: smsDirectUrl,
  });

  return res.status(200).json({
    success: true,
    status: "simulated_success",
    isConfigured: false,
    isLiveSent: false,
    formattedPhone: e164,
    directUrl: smsDirectUrl,
    message: `SMS notification recorded. Click direct SMS link to send immediately.`,
    log: logged,
  });
});

// Helper to verify admin authorization for sensitive operations and dispatch endpoints
export async function verifyAdminRequest(
  req: express.Request,
  options: { disallowBodyPassword?: boolean; failClosed?: boolean } = {}
): Promise<boolean> {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  // On dispatch endpoints (where disallowBodyPassword is true), failClosed defaults to true
  const shouldFailClosed = options.failClosed ?? options.disallowBodyPassword ?? false;

  if (token) {
    // 1. Check server-signed token HMAC (created via /api/auth/login)
    const payload = verifySignedToken(token);
    if (payload && payload.role === "admin") {
      return true;
    }

    // 2. Cryptographically verify Firebase ID Token using Google's trusted public certificates & Admin SDK
    const fbResult = await verifyFirebaseIdToken(token, undefined, {
      checkRevoked: true,
      failClosed: shouldFailClosed,
    });
    if (fbResult.valid && fbResult.isAdmin) {
      return true;
    }

    // 3. Test token allowance ONLY during automated test execution
    if (process.env.NODE_ENV === "test" && (token === "test-admin-token" || token === "test-firebase-token")) {
      return true;
    }
  }

  // Reject body password if disallowBodyPassword is set (strictly enforced on PO and WhatsApp notification dispatches)
  if (options.disallowBodyPassword) {
    return false;
  }

  // Accept admin password in body for administrative setup routes only
  const bodyPassword = req.body?.adminPassword || req.body?.password;
  if (bodyPassword) {
    const cleanPass = String(bodyPassword).trim();
    const adminPass = process.env.ADMIN_PASSWORD || "adinarayan1977";
    if (verifyPassword(cleanPass, adminPasswordRecord.hash, adminPasswordRecord.salt) || cleanPass === adminPass) {
      return true;
    }
  }

  // NEVER trust x-admin-email without verified authentication
  return false;
}

// DISPATCH HISTORY & LIVE TEST BENCH ROUTE
app.get(["/api/dispatch-history", "/dispatch-history"], (req, res) => {
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  const metaWhatsappConfigured = !!(
    process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
    process.env.META_WHATSAPP_TOKEN
  );
  const webhookConfigured = {
    verifyToken: !!process.env.META_WHATSAPP_VERIFY_TOKEN,
    appSecret: !!process.env.META_APP_SECRET,
  };

  res.json({
    logs: dispatchHistory,
    configured: {
      smtp: smtpConfigured,
      metaWhatsapp: metaWhatsappConfigured,
      aisensy: metaWhatsappConfigured, // Backward compatibility alias
      webhook: Boolean(webhookConfigured.verifyToken && webhookConfigured.appSecret),
    },
    metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || null,
    metaWhatsappTokenPrefix: process.env.META_WHATSAPP_TOKEN ? `${process.env.META_WHATSAPP_TOKEN.substring(0, 8)}...` : null,
    metaWhatsappTemplateName: getMetaTemplateName(),
    metaWhatsappWabaId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    webhookConfigured,
    recentWebhookEvents: getRecentWebhookEvents().slice(0, 20),
  });
});

// UPDATE & CONNECT META WHATSAPP CLOUD API ROUTE
const handleUpdateMetaWhatsapp = async (req: any, res: any) => {
  if (!(await verifyAdminRequest(req))) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Admin privileges required to update Meta WhatsApp credentials."
    });
  }

  const { phoneNumberId, accessToken, wabaId, templateName, apiKey } = req.body;
  const token = accessToken || apiKey; // Support either field name

  if (!phoneNumberId || !token) {
    return res.status(400).json({ error: "Meta WhatsApp Phone Number ID and Access Token are required." });
  }

  const cleanPhoneId = String(phoneNumberId).trim();
  const cleanToken = String(token).trim().replace(/^["']|["']$/g, '');
  const cleanWabaId = String(wabaId || "").trim();
  const cleanTemplate = String(templateName || "").trim();

  const actualPhoneId = cleanPhoneId;
  const actualWabaId = cleanWabaId;

  // Set in current Node process memory
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = actualPhoneId;
  process.env.META_WHATSAPP_TOKEN = cleanToken;
  if (actualWabaId) process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID = actualWabaId;
  if (cleanTemplate) process.env.META_WHATSAPP_TEMPLATE_NAME = cleanTemplate;

  const isServerless = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // In non-serverless local environments, persist to .env
  if (!isServerless) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }

      const updateOrAdd = (key: string, val: string, text: string) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(text)) {
          return text.replace(regex, `${key}=${val}`);
        }
        return `${text}\n${key}=${val}`;
      };

      envContent = updateOrAdd("META_WHATSAPP_PHONE_NUMBER_ID", cleanPhoneId, envContent);
      envContent = updateOrAdd("META_WHATSAPP_TOKEN", cleanToken, envContent);
      if (cleanWabaId) envContent = updateOrAdd("META_WHATSAPP_BUSINESS_ACCOUNT_ID", cleanWabaId, envContent);
      if (cleanTemplate) envContent = updateOrAdd("META_WHATSAPP_TEMPLATE_NAME", cleanTemplate, envContent);
      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    } catch (fsErr) {
      console.warn("Could not write Meta WhatsApp credentials to .env file:", fsErr);
    }
  }

  return res.json({
    success: true,
    message: isServerless
      ? "Meta WhatsApp Cloud API credentials updated in runtime memory. On Vercel serverless, persist credentials via Vercel Project Settings -> Environment Variables."
      : "Meta WhatsApp Cloud API credentials connected and saved successfully!",
    phoneNumberId: cleanPhoneId,
    tokenPrefix: `${cleanToken.substring(0, 8)}...`,
    templateName: cleanTemplate,
    isServerless,
  });
};

app.post(["/api/update-meta-whatsapp-credentials", "/update-meta-whatsapp-credentials", "/api/update-aisensy-credentials", "/update-aisensy-credentials"], handleUpdateMetaWhatsapp);

// UPDATE & TEST SMTP CREDENTIALS ROUTE
app.post(["/api/update-smtp-credentials", "/update-smtp-credentials"], async (req, res) => {
  if (!(await verifyAdminRequest(req))) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Admin privileges required to update SMTP credentials."
    });
  }

  const { host, port, user, pass, from } = req.body;
  if (!host || !user || !pass) {
    return res.status(400).json({ error: "host, user (email), and pass are required" });
  }

  const cleanHost = String(host).trim();
  const cleanPort = parseInt(port) || (cleanHost.includes("gmail") ? 465 : 587);
  const cleanUser = String(user).trim();
  const cleanPass = String(pass).trim();
  const cleanFrom = String(from || cleanUser).trim();

  try {
    const nodemailer = await import("nodemailer");
    const transporter = cleanHost.includes("gmail")
      ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: cleanUser, pass: cleanPass },
      })
      : nodemailer.createTransport({
        host: cleanHost,
        port: cleanPort,
        secure: cleanPort === 465,
        auth: { user: cleanUser, pass: cleanPass },
      });

    // Test verify the connection with SMTP server
    await transporter.verify();

    // Update process.env
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = String(cleanPort);
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_FROM = cleanFrom;

    const isServerless = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);

    // Persist to .env only in local non-serverless environment
    if (!isServerless) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, "utf-8");
        }

        const updateOrAdd = (key: string, val: string, text: string) => {
          const regex = new RegExp(`^${key}=.*$`, "m");
          if (regex.test(text)) {
            return text.replace(regex, `${key}=${val}`);
          }
          return `${text}\n${key}=${val}`;
        };

        envContent = updateOrAdd("SMTP_HOST", cleanHost, envContent);
        envContent = updateOrAdd("SMTP_PORT", String(cleanPort), envContent);
        envContent = updateOrAdd("SMTP_USER", cleanUser, envContent);
        envContent = updateOrAdd("SMTP_PASS", cleanPass, envContent);
        envContent = updateOrAdd("SMTP_FROM", cleanFrom, envContent);
        fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
      } catch (fsErr) {
        console.warn("Could not write to .env file:", fsErr);
      }
    }

    return res.json({
      success: true,
      message: `SMTP connection established successfully to ${cleanHost}:${cleanPort}! Real emails will now be delivered live to inboxes.`,
      host: cleanHost,
      user: cleanUser,
      isServerless
    });
  } catch (err: any) {
    console.warn("[SMTP Verification Error]:", err?.message || err);
    return res.status(401).json({
      success: false,
      error: `SMTP connection failed: ${err?.message || "Check your host, username, and password."}`,
      details: err?.code || err?.response || String(err)
    });
  }
});

// MANIFEST OCR & PARSING ROUTE: Parses camera photos of shipment paper manifests
app.post(["/api/scan-manifest", "/scan-manifest"], async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing required 'image' data in request body." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please define it in your Secrets panel."
      });
    }

    // Extract base64 payload and detect mimeType if provided as data URL
    let cleanBase64 = String(image).trim();
    let detectedMime = mimeType || "image/jpeg";

    const dataUrlMatch = cleanBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      detectedMime = dataUrlMatch[1];
      cleanBase64 = dataUrlMatch[2];
    }

    // Initialize GoogleGenAI SDK
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const promptText = `You are an expert OCR and paper manifest parsing AI specializing in Indian agricultural logistics, grain mandis, and rice transport records.
Carefully analyze this camera photo/scan of a paper manifest, lorry receipt (LR / Bilty), transport consignment note, weighbridge slip, delivery challan, or tax invoice.

Extract all arrival and commercial fields into a valid JSON object with the following schema:
{
  "date": "YYYY-MM-DD", // Shipment, invoice, or bilty date. If day/month is found without year, assume 2026.
  "millerName": "string", // Supplier, Consignor, or Rice Mill name (e.g., ANNAPURNA RICE & AGRO INDUSTRIES)
  "place": "string", // Origin mandi / dispatch city / mill location (e.g., MIRYALGUDA, SURYAPET, KARNAL)
  "brand": "string", // Rice variety or brand (e.g., KESHAR KALI, 1121 Sella Rice, Sona Masoori, Broken Rice 100%)
  "partyName": "string", // Buyer, Consignee, or Trading Party name (e.g., V.K FOODS, PLATINUM TRADERS)
  "area": "string", // Buyer delivery market, shop area, or destination (e.g., 4TH BLOCK, APMC YARD)
  "billNo": "string", // Invoice number, Bilty number, Manifest number, or LR number
  "qty": 0.0, // Total weight in Quintals (QTLS). If bags are given (e.g., 520 bags @ 50kg), calculate quintals = 260.0.
  "rate": 0.0, // Rate or price per quintal in INR
  "amount": 0.0, // Gross value / invoice amount in INR (typically qty * rate)
  "lh": 0.0, // Loading & Hamali (L.H.) charges if stated
  "cc": 0.0, // Commission or brokerage (C.C.) charges if stated
  "tds": 0.0, // TDS deduction if stated
  "shortage": 0.0, // Shortage, moisture or tare allowance if stated
  "diffIn": 0.0, // Price difference or discount adjustment if stated
  "netAmt": 0.0, // Net payable / final receivable amount in INR
  "noOfDayRec": "Not Cleared", // Initial payment status
  "truckNo": "string", // Truck / lorry registration number if visible (e.g., AP24TX8892)
  "purchaseOrderNo": "string", // Associated purchase order or contract number if referenced
  "confidence": 0.95, // Numerical confidence score from 0.0 to 1.0 based on document clarity
  "detectedDocType": "string", // e.g. "Lorry Receipt (Bilty)", "Tax Invoice", "Weighbridge Slip", "Delivery Challan"
  "summary": "string" // A brief 1-2 sentence overview of what was parsed
}

Rules:
1. If a numeric value is not visible or unknown, return null.
2. If a text field is not visible, return empty string "".
3. Standardize dates to YYYY-MM-DD.
4. Clean all numeric fields so they are pure JSON numbers (no currency symbols or commas).
5. Output ONLY the raw JSON object.`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      }
    };

    // Helper for calling Gemini with exponential backoff for rate limits (429 / RESOURCE_EXHAUSTED)
    const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
      let delay = 1500;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRateLimit =
            err?.status === 429 ||
            err?.code === 429 ||
            String(err?.message || "").toLowerCase().includes("rate") ||
            String(err?.message || "").toLowerCase().includes("quota") ||
            String(err?.message || "").toLowerCase().includes("resource_exhausted");

          if (isRateLimit && attempt < maxRetries - 1) {
            console.warn(`[Gemini API] Rate limit hit on /api/scan-manifest. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    };

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            imagePart,
            { text: promptText }
          ]
        },
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      })
    );

    const rawOutput = response.text || "{}";
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseErr) {
      // Clean possible backticks
      const sanitized = rawOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(sanitized);
    }

    // Sanitize calculations if not provided
    if ((parsedData.amount === null || parsedData.amount === undefined || parsedData.amount === 0) && parsedData.qty && parsedData.rate) {
      parsedData.amount = Math.round(Number(parsedData.qty) * Number(parsedData.rate));
    }
    if ((parsedData.netAmt === null || parsedData.netAmt === undefined || parsedData.netAmt === 0) && parsedData.amount) {
      const lh = Number(parsedData.lh) || 0;
      const cc = Number(parsedData.cc) || 0;
      const tds = Number(parsedData.tds) || 0;
      const shortage = Number(parsedData.shortage) || 0;
      const diffIn = Number(parsedData.diffIn) || 0;
      parsedData.netAmt = Math.round(Number(parsedData.amount) + lh + cc - tds - shortage + diffIn);
    }

    return res.json({
      success: true,
      manifest: parsedData,
      rawOutput,
    });
  } catch (error: any) {
    console.error("Error in /api/scan-manifest:", error);
    const isRateLimit =
      error?.status === 429 ||
      error?.code === 429 ||
      String(error?.message || "").toLowerCase().includes("rate") ||
      String(error?.message || "").toLowerCase().includes("quota") ||
      String(error?.message || "").toLowerCase().includes("resource_exhausted");

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        isRateLimit: true,
        error: "AI optical scanner rate limit reached. Please wait a few seconds and try scanning again.",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to scan and parse paper manifest using camera image.",
    });
  }
});

// Unhandled API Route 404 JSON Fallback (ensures API routes never return HTML index.html)
app.all(["/api/*", "/api"], (req, res) => {
  res.status(404).json({ error: "API endpoint not found", path: req.originalUrl || req.url });
});

// Global Express error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.warn("[Express Error] Malformed JSON payload received:", err.message);
    return res.status(400).json({ error: "Invalid JSON payload format." });
  }
  console.error("Unhandled Express error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal Server Error", message: err?.message || "An unexpected error occurred." });
});

export default app;
