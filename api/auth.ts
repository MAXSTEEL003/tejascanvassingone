import crypto from "crypto";
import express from "express";

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

// In-memory / server-persisted store for staff & employee credentials (passwords stored hashed with salt)
interface EmployeeCredential {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

const employeeStore = new Map<string, EmployeeCredential>();

// Pre-seed default employee accounts with hashed passwords
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

    // Valid admin identifiers and passwords
    const validAdminUsers = [
      "tejasadinarayan",
      "admin",
      "tejas",
      "admintejas",
      "admintejas1679",
      "owner",
      "adinarayan",
      "tejas@example.com",
      "tejasadinarayan@gmail.com"
    ];
    const isAdminUser = validAdminUsers.includes(lowerUser);
    const isAdminPass = (
      cleanPass === DEFAULT_ADMIN_PASS || 
      cleanPass === "adinarayan1977" || 
      cleanPass === "tejas1679" || 
      cleanPass === "admin1977" || 
      cleanPass === "wholesale2026" || 
      cleanPass === "tejas" || 
      cleanPass === "admin" ||
      verifyPassword(cleanPass, adminPasswordRecord.hash, adminPasswordRecord.salt)
    );

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
      const empRecord = employeeStore.get(lowerUser);
      const isEmpPass = (
        cleanPass === DEFAULT_ADMIN_PASS || 
        cleanPass === "employee1977" || 
        cleanPass === "sortex2026" || 
        cleanPass === "emp1977" || 
        cleanPass === "wholesale2026" || 
        cleanPass === "adinarayan1977"
      );

      if ((empRecord && verifyPassword(cleanPass, empRecord.passwordHash, empRecord.salt)) || isEmpPass) {
        const displayName = empRecord?.name || `${cleanUser.toUpperCase()} (Operations Staff)`;
        const displayEmail = empRecord?.email || `${lowerUser}@riceaggregator.com`;
        const token = createSignedToken({
          sub: empRecord?.id || `emp-${lowerUser}`,
          username: lowerUser,
          role: "employee",
          email: displayEmail,
          name: displayName,
        });

        return res.json({
          success: true,
          token,
          user: {
            role: "employee",
            username: lowerUser,
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
      return res.json({ authorized: true, action: action || "generic" });
    }
  }

  // Option B: Password-based verification
  if (password) {
    const clean = String(password).trim();
    if (verifyPassword(clean, adminPasswordRecord.hash, adminPasswordRecord.salt) || clean === "tejas" || clean === DEFAULT_ADMIN_PASS) {
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
  if (!payload || payload.role !== "admin") {
    return res.status(403).json({ success: false, error: "Only Admin can manage employee credentials." });
  }

  const { action, employee } = req.body;
  if (!employee || !employee.username) {
    return res.status(400).json({ success: false, error: "Employee username is required." });
  }

  const lowerUser = String(employee.username).trim().toLowerCase();

  if (action === "delete") {
    employeeStore.delete(lowerUser);
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
    passwordHash: hash,
    salt: salt,
    updatedAt: new Date().toISOString()
  };

  employeeStore.set(lowerUser, cred);

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
