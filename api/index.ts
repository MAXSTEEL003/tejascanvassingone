import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

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
  } catch {}
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
    { id: "EMP-01", name: "Operations Employee", username: "employee", pass: "adinarayan1977", role: "Operations Staff", email: "employee@riceaggregator.com" },
    { id: "EMP-02", name: "Senior Operations Staff", username: "employee1", pass: "employee1977", role: "Operations Staff", email: "employee1@riceaggregator.com" },
    { id: "EMP-03", name: "Sortex Quality Officer", username: "sortex", pass: "sortex2026", role: "Quality Officer", email: "sortex@riceaggregator.com" }
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
      "tejasadinarayan@gmail.com"
    ];
    const isAdminUser = validAdminUsers.includes(lowerUser);
    const isDemoAdminPass = [
      "wholesale2026",
      "adinarayan1977",
      "admin",
      "tejas",
      "admin1977",
      "tejas1679"
    ].includes(cleanPass);
    const isAdminPass = verifyPassword(cleanPass, adminPasswordRecord.hash, adminPasswordRecord.salt) || isDemoAdminPass;

    // Check Admin Authentication
    if (roleHint === "admin" || isAdminUser) {
      if (isAdminPass) {
        const token = createSignedToken({
          sub: "admin-tejas-01",
          username: cleanUser || "tejasadinarayan",
          role: "admin",
          email: "tejasadinarayan@riceaggregator.com",
          name: "Tejas Adinarayan (Admin HQ)",
        });

        return res.json({
          success: true,
          token,
          user: {
            role: "admin",
            username: cleanUser || "tejasadinarayan",
            name: "Tejas Adinarayan (Admin HQ)",
            email: "tejasadinarayan@riceaggregator.com",
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
        const displayEmail = empRecord.email || `${(empRecord.username || lowerUser)}@riceaggregator.com`;
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
    let resolvedName = cleanUser.toUpperCase();
    const isPhone = /^[0-9+\s-]{8,15}$/.test(cleanUser);
    if (isPhone) {
      const digitsOnly = cleanUser.replace(/\D/g, "");
      resolvedEmail = `${digitsOnly}@riceaggregator.com`;
      resolvedName = `Merchant (+91 ${digitsOnly})`;
    } else if (!cleanUser.includes("@")) {
      const cleanU = cleanUser.toLowerCase().replace(/[^a-z0-9]/g, "");
      resolvedEmail = `${cleanU || "merchant"}@riceaggregator.com`;
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
    const isAcceptedAdminPass = [
      "wholesale2026",
      "adinarayan1977",
      "admin",
      "tejas",
      "admin1977",
      "tejas1679",
      DEFAULT_ADMIN_PASS
    ].includes(clean);
    if (verifyPassword(clean, adminPasswordRecord.hash, adminPasswordRecord.salt) || isAcceptedAdminPass) {
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
    email: employee.email || `${lowerUser}@riceaggregator.com`,
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
    return {
      valid: false,
      error: "META_APP_SECRET is not configured on the server.",
      code: 500,
    };
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
app.use((req, _res, next) => {
  const matched = (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]) as string | undefined;
  if (matched && (req.url === "/" || req.url === "/api" || req.url === "")) {
    req.url = matched;
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

// Server-side Authentication & Session Authorization routes
app.use("/api/auth", authRouter);

// Meta WhatsApp Cloud API Webhooks (GET verification & POST event reception)
// Support both /api/webhooks/whatsapp and /webhooks/whatsapp for local and Vercel serverless rewrites
app.use(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], whatsappWebhookRouter);

// Health check endpoints for container and Cloud Run readiness/liveness probes
app.all(["/api/health", "/health", "/healthz", "/_ah/health", "/readyz", "/livez"], (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Chat Bot endpoint for business data insights
app.post("/api/chat", async (req, res) => {
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
  type: "po_email" | "whatsapp" | "sms";
  target: string;
  recipientName?: string;
  subject?: string;
  message?: string;
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed" | "delivered_real" | "delivered_simulated";
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

// REAL / SIMULATED DISPATCH ROUTER: SMTP EMAILS
app.post("/api/dispatch-po", async (req, res) => {
  try {
    const { to, supplierName, subject, htmlContent, textContent, poNumber, html, text, batchId } = req.body;

    if (!to) {
      return res.status(400).json({ error: "Recipient email ('to') is required." });
    }

    const host = process.env.SMTP_HOST || "";
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = req.body.from || process.env.SMTP_FROM || user || "procurement@tejascanvassing.com";

    const isConfigured = !!(host && user && pass);
    const poRef = poNumber || batchId || "PO";
    const finalSubject = subject || `Purchase Order ${poRef} - Tejas Canvassing`;
    const finalHtml = htmlContent || html || `<p>Purchase Order ${poRef} compiled by Tejas Canvassing</p>`;
    const finalText = textContent || text || `Official Purchase Order ${poRef} for ${supplierName || 'Supplier'}.\nPlease inspect attached purchase order documents.`;

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalText)}`;

    console.log(`[Email Dispatcher] Target: ${to} (${supplierName || "Supplier"}), Configured: ${isConfigured}`);

    if (isConfigured) {
      const nodemailer = await import("nodemailer");
      const cleanPass = pass.replace(/\s+/g, "");
      const cleanUser = user.trim();

      const transporter = host.includes("gmail")
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: cleanUser, pass: cleanPass },
          })
        : nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user: cleanUser, pass: cleanPass },
          });

      const info = await transporter.sendMail({
        from: `"Tejas Canvassing" <${from}>`,
        to,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
      });

      const logged = recordDispatch({
        type: "po_email",
        target: to,
        recipientName: supplierName || "Supplier",
        subject: finalSubject,
        message: finalText,
        status: "delivered_real",
        details: `Successfully sent via SMTP relay ${host} (MessageID: ${info.messageId}).`,
        directLink: mailtoUrl,
      });

      console.log(`[Email Dispatcher] Real Email Sent! Message ID: ${info.messageId}`);
      return res.json({
        success: true,
        status: "real_success",
        isLiveSent: true,
        messageId: info.messageId,
        mailtoUrl,
        message: `Successfully transmitted PO to ${to} via SMTP ${host}.`,
        log: logged,
      });
    } else {
      // Fallback simulation mode with direct mailto client launcher
      const details = `SMTP server credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not set in environment. Simulated dispatch recorded in backend logs; direct mailto launcher generated.`;
      const logged = recordDispatch({
        type: "po_email",
        target: to,
        recipientName: supplierName || "Supplier",
        subject: finalSubject,
        message: finalText,
        status: "delivered_simulated",
        details,
        directLink: mailtoUrl,
      });

      return res.json({
        success: true,
        status: "simulated_success",
        isLiveSent: false,
        mailtoUrl,
        message: `PO logged in dispatch gateway. Add SMTP credentials to deliver directly to inboxes.`,
        details,
        log: logged,
      });
    }
  } catch (err: any) {
    console.warn("[Email Dispatcher Warning]:", err?.message || err);
    recordDispatch({
      type: "po_email",
      target: req.body?.to || "unknown",
      recipientName: req.body?.supplierName || "Supplier",
      subject: req.body?.subject || "PO Error",
      status: "failed",
      details: err.message || "Failed to dispatch email notification.",
    });
    return res.status(500).json({ error: err.message || "Failed to dispatch email notification." });
  }
});

// Helper for formatting phone numbers to E.164 and WhatsApp format
function formatPhoneNumber(phone: string) {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 10) {
    return { e164: `+91${digits}`, digits: `91${digits}`, national: digits };
  }
  if (digits.startsWith("91") && digits.length === 12) {
    return { e164: `+${digits}`, digits, national: digits.substring(2) };
  }
  return { e164: `+${digits}`, digits, national: digits };
}

// REAL DISPATCH ROUTER: WHATSAPP NOTIFICATIONS via Meta WhatsApp Cloud API or Direct WhatsApp
app.post("/api/dispatch-whatsapp", async (req, res) => {
  const { 
    to, 
    buyerName, 
    message, 
    contentSid, 
    phoneNumberId: reqPhoneId, 
    accessToken: reqToken, 
    templateName: reqTemplate,
    templateParams,
    languageCode,
    aisensyApiKey, // backward-compat support
    campaignName   // backward-compat support
  } = req.body;

  if (!to || (!message && !contentSid)) {
    return res.status(400).json({ error: "Recipient phone number ('to') and either 'message' or 'contentSid' are required." });
  }

  const { e164, digits } = formatPhoneNumber(String(to));
  const waDirectUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message || "")}`;

  // 1. Check for Meta WhatsApp Cloud API Credentials (prefer server-side environment variables)
  const rawPhoneId = String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || reqPhoneId || "").trim();
  const activePhoneId = rawPhoneId === "1395351100324748" ? "1335387812999639" : rawPhoneId;
  const activeToken = String(process.env.META_WHATSAPP_TOKEN || reqToken || aisensyApiKey || "").trim().replace(/^["']|["']$/g, '');
  const activeTemplate = String(process.env.META_WHATSAPP_TEMPLATE_NAME || reqTemplate || (campaignName !== "order_notification" ? campaignName : "") || "").trim();
  const activeLang = String(languageCode || "en").trim();

  if (activePhoneId && activeToken) {
    console.log("[Meta WhatsApp Cloud API] Initiating dispatch:", {
      destination: digits,
      phoneId: activePhoneId,
      template: activeTemplate || "(raw text)",
      tokenPrefix: `${activeToken.substring(0, 8)}...`
    });

    try {
      let metaPayload: any;

      if (activeTemplate) {
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
                parameters: Array.isArray(templateParams) && templateParams.length > 0
                  ? templateParams.map((p: any) => ({ type: "text", text: String(p) }))
                  : [
                      { type: "text", text: String(buyerName || "Valued Merchant") },
                      { type: "text", text: String(message || "Rice procurement update from Tejas Canvassing.").substring(0, 1024) }
                    ]
              }
            ]
          }
        };
      } else {
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digits,
          type: "text",
          text: {
            preview_url: false,
            body: String(message || "Rice procurement update from Tejas Canvassing.")
          }
        };
      }

      const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metaPayload)
      });

      const resText = await metaResponse.text();
      let metaData: any = {};
      try {
        metaData = JSON.parse(resText);
      } catch {
        metaData = { raw: resText };
      }

      console.log("[Meta WhatsApp API Response]:", {
        status: metaResponse.status,
        data: metaData
      });

      if (metaResponse.ok && !metaData.error) {
        const messageId = metaData.messages?.[0]?.id || "sent";
        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || "Buyer",
          message: message || `Meta Template: ${activeTemplate || 'text'}`,
          status: "sent",
          deliveryStatus: "sent",
          metaMessageId: messageId,
          details: `Successfully dispatched to Meta Graph API (Message ID: ${messageId}, Destination: ${digits}). Pending delivery confirmation from Webhook.`,
          directLink: waDirectUrl
        });

        return res.status(200).json({
          success: true,
          gateway: "meta_whatsapp",
          isLiveSent: true,
          status: "sent",
          messageId,
          formattedPhone: e164,
          directUrl: waDirectUrl,
          message: `WhatsApp alert successfully submitted to Meta Graph API for ${e164}! (Message ID: ${messageId})`,
          metaResponse: metaData,
          log: logged
        });
      } else {
        const errorMsg = metaData.error?.message || metaData.error?.error_user_msg || `Meta WhatsApp API error (HTTP ${metaResponse.status})`;
        console.warn("[Meta WhatsApp Cloud API Error]:", errorMsg);

        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || "Buyer",
          message: message || `Meta Template: ${activeTemplate || 'text'}`,
          status: "failed",
          details: `Meta WhatsApp Error: ${errorMsg}`,
          directLink: waDirectUrl
        });

        return res.status(metaResponse.status >= 400 && metaResponse.status < 600 ? metaResponse.status : 400).json({
          success: false,
          gateway: "meta_whatsapp",
          error: errorMsg,
          directUrl: waDirectUrl,
          formattedPhone: e164,
          metaResponse: metaData,
          log: logged
        });
      }
    } catch (networkErr: any) {
      console.error("[Meta WhatsApp Network Failure]:", networkErr);
      const logged = recordDispatch({
        type: "whatsapp",
        target: e164,
        recipientName: buyerName || "Buyer",
        message: message || `Meta Template: ${activeTemplate || 'text'}`,
        status: "failed",
        details: `Meta WhatsApp Network Error: ${networkErr?.message || "Failed to reach Meta Graph API"}`,
        directLink: waDirectUrl
      });

      return res.status(502).json({
        success: false,
        gateway: "meta_whatsapp",
        error: `Could not reach Meta WhatsApp Cloud API servers: ${networkErr?.message || "Network Timeout"}. Direct WhatsApp fallback available.`,
        directUrl: waDirectUrl,
        formattedPhone: e164,
        log: logged
      });
    }
  }

  // 2. Direct 1-Click WhatsApp Launcher (Default when Meta Cloud API is not configured)
  console.info(`[WhatsApp Dispatcher] Meta WhatsApp Cloud API not configured. Running in direct mode with 1-click WhatsApp launcher.`);

  const logged = recordDispatch({
    type: "whatsapp",
    target: e164,
    recipientName: buyerName || "Buyer",
    message: message || `Template: ${contentSid}`,
    status: "delivered_simulated",
    details: `Message logged in system audit trail; 1-click direct WhatsApp launcher generated.`,
    directLink: waDirectUrl,
  });

  return res.status(200).json({
    success: true,
    status: "simulated_success",
    isConfigured: false,
    isLiveSent: false,
    gateway: "direct",
    formattedPhone: e164,
    directUrl: waDirectUrl,
    message: `WhatsApp notification recorded in audit trail. Configure your Meta WhatsApp Cloud API credentials in Settings to dispatch automatically!`,
    log: logged,
  });
});

// REAL DISPATCH ROUTER: SMS NOTIFICATIONS
app.post("/api/dispatch-sms", async (req, res) => {
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

// Helper to verify admin authorization for sensitive service credential updates
export function verifyAdminRequest(req: express.Request): boolean {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  if (token) {
    const payload = verifySignedToken(token);
    if (payload && payload.role === "admin") {
      return true;
    }
  }

  // Accept admin password in body for backward-compatibility with direct admin actions
  const bodyPassword = req.body?.adminPassword || req.body?.password;
  if (bodyPassword) {
    const cleanPass = String(bodyPassword).trim();
    const adminPass = process.env.ADMIN_PASSWORD || "adinarayan1977";
    const acceptedAdminPass = [
      "wholesale2026",
      "adinarayan1977",
      "admin",
      "tejas",
      "admin1977",
      "tejas1679",
      adminPass
    ];
    if (acceptedAdminPass.includes(cleanPass)) {
      return true;
    }
  }

  return false;
}

// DISPATCH HISTORY & LIVE TEST BENCH ROUTE
app.get("/api/dispatch-history", (req, res) => {
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
    metaWhatsappTemplateName: process.env.META_WHATSAPP_TEMPLATE_NAME || "",
    metaWhatsappWabaId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    webhookConfigured,
    recentWebhookEvents: getRecentWebhookEvents().slice(0, 20),
  });
});

// UPDATE & CONNECT META WHATSAPP CLOUD API ROUTE
const handleUpdateMetaWhatsapp = async (req: any, res: any) => {
  if (!verifyAdminRequest(req)) {
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

  const actualPhoneId = cleanPhoneId === "1395351100324748" ? "1335387812999639" : cleanPhoneId;
  const actualWabaId = cleanWabaId || (cleanPhoneId === "1395351100324748" ? "1395351100324748" : "");

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

app.post("/api/update-meta-whatsapp-credentials", handleUpdateMetaWhatsapp);
app.post("/api/update-aisensy-credentials", handleUpdateMetaWhatsapp);

// UPDATE & TEST SMTP CREDENTIALS ROUTE
app.post("/api/update-smtp-credentials", async (req, res) => {
  if (!verifyAdminRequest(req)) {
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
app.post("/api/scan-manifest", async (req, res) => {
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
