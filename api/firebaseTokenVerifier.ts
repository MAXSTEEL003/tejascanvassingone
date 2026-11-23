import https from "https";
import crypto from "crypto";
import fs from "fs";
import { initializeApp, getApps, cert, applicationDefault, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Cached Google public certificates
interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Supported authorized admin emails
export const AUTHORIZED_ADMIN_EMAILS = [
  "nani@tejasc.in",
  "tejasadinarayan@gmail.com",
  "tejascanvassing@gmail.com",
];

export function getAuthorizedAdminEmails(): string[] {
  const customAdmin = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : "";
  const envEmail1 = process.env.VITE_ADMIN_GOOGLE_EMAIL_1 ? process.env.VITE_ADMIN_GOOGLE_EMAIL_1.toLowerCase().trim() : "";
  const envEmail2 = process.env.VITE_ADMIN_GOOGLE_EMAIL_2 ? process.env.VITE_ADMIN_GOOGLE_EMAIL_2.toLowerCase().trim() : "";
  
  return Array.from(new Set([...AUTHORIZED_ADMIN_EMAILS, customAdmin, envEmail1, envEmail2].filter(Boolean)));
}

export function getExpectedFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "tejascanavssingstore"
  ).trim();
}

/**
 * Initializes Firebase Admin SDK if credentials/service account are provided.
 * Caches instance so multiple calls do not re-initialize.
 */
let isFirebaseAdminInitAttempted = false;

export function getFirebaseAdminApp(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }
  if (isFirebaseAdminInitAttempted) {
    return null;
  }

  const projectId = getExpectedFirebaseProjectId();

  // 1. Check for Service Account JSON in environment
  const serviceAccountEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountEnv) {
    try {
      let parsed: any;
      const trimmed = serviceAccountEnv.trim();
      if (trimmed.startsWith("{")) {
        parsed = JSON.parse(trimmed);
      } else {
        try {
          const decoded = Buffer.from(trimmed, "base64").toString("utf8");
          if (decoded.trim().startsWith("{")) {
            parsed = JSON.parse(decoded);
          }
        } catch {
          if (fs.existsSync(trimmed)) {
            parsed = JSON.parse(fs.readFileSync(trimmed, "utf8"));
          }
        }
      }

      if (parsed && (parsed.project_id || parsed.client_email)) {
        if (parsed.private_key && typeof parsed.private_key === "string") {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }
        if (parsed.privateKey && typeof parsed.privateKey === "string") {
          parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
        }
        isFirebaseAdminInitAttempted = true;
        return initializeApp({
          credential: cert(parsed),
          projectId: parsed.project_id || projectId,
        });
      }
    } catch (e: any) {
      console.warn("[Firebase Admin Init] Error parsing service account credentials:", e?.message);
    }
  }

  // 2. Check for discrete private key & client email
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    try {
      isFirebaseAdminInitAttempted = true;
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
        projectId,
      });
    } catch (e: any) {
      console.warn("[Firebase Admin Init] Error initializing with clientEmail/privateKey:", e?.message);
    }
  }

  // 3. Application default credentials (e.g. if GOOGLE_APPLICATION_CREDENTIALS set)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      isFirebaseAdminInitAttempted = true;
      return initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    } catch (e: any) {
      console.warn("[Firebase Admin Init] Error initializing with applicationDefault:", e?.message);
    }
  }

  isFirebaseAdminInitAttempted = true;
  return null;
}

/**
 * Fetches Google's public X.509 certificates for Firebase ID tokens.
 * Caches in-memory based on Cache-Control max-age (default 6 hours).
 */
export async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }

  return new Promise((resolve, reject) => {
    https.get(CERTS_URL, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`Failed to fetch Google public certs: HTTP ${res.statusCode}`));
          }
          const certs = JSON.parse(data);
          let maxAge = 6 * 3600; // default 6 hours
          const cacheControl = res.headers["cache-control"];
          if (cacheControl) {
            const match = cacheControl.match(/max-age=(\d+)/);
            if (match && match[1]) {
              maxAge = parseInt(match[1], 10);
            }
          }
          certCache = {
            certs,
            expiresAt: now + maxAge * 1000,
          };
          resolve(certs);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

export interface FirebaseTokenVerificationResult {
  valid: boolean;
  email?: string;
  uid?: string;
  isAdmin?: boolean;
  error?: string;
}

export interface AccountStatusResult {
  active: boolean;
  revoked: boolean;
  statusUnknown?: boolean;
  error?: string;
}

/**
 * Probes Google Identity Toolkit to check if user has been disabled or token revoked.
 * When failClosed is true (mandatory on dispatch endpoints), any lookup failure,
 * timeout, network error, or missing user record is treated as a hard rejection.
 */
export async function checkFirebaseUserAccountStatus(
  idToken: string,
  options: { failClosed?: boolean; apiKeyOverride?: string } = {}
): Promise<AccountStatusResult> {
  const apiKey = (
    options.apiKeyOverride !== undefined
      ? options.apiKeyOverride
      : (process.env.FIREBASE_API_KEY ||
         process.env.VITE_FIREBASE_API_KEY ||
         "")
  ).trim();

  if (!apiKey) {
    if (options.failClosed) {
      return {
        active: false,
        revoked: true,
        statusUnknown: true,
        error: "Firebase API key not configured: account status verification cannot be completed (fail-closed).",
      };
    }
    return { active: false, revoked: false, statusUnknown: true, error: "Firebase API key not configured." };
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ idToken });
    const req = https.request(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 4000,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(raw);
            if (res.statusCode && res.statusCode >= 400) {
              const msg = data.error?.message || `HTTP ${res.statusCode}`;
              if (
                msg.includes("USER_DISABLED") ||
                msg.includes("TOKEN_REVOKED") ||
                msg.includes("USER_NOT_FOUND") ||
                msg.includes("INVALID_ID_TOKEN")
              ) {
                return resolve({
                  active: false,
                  revoked: true,
                  error: `Firebase account or token revoked: ${msg}${options.failClosed ? " (fail-closed)" : ""}`,
                });
              }

              // Identity Toolkit lookup error (e.g. 403 API restriction, 500 server error)
              if (options.failClosed) {
                return resolve({
                  active: false,
                  revoked: true,
                  statusUnknown: true,
                  error: `Google Identity Toolkit returned HTTP ${res.statusCode} (${msg}). Account status verification could not be completed (fail-closed).`,
                });
              }
              return resolve({ active: false, revoked: false, statusUnknown: true, error: msg });
            }

            if (Array.isArray(data.users) && data.users.length > 0) {
              const u = data.users[0];
              if (u.disabled === true) {
                return resolve({
                  active: false,
                  revoked: true,
                  error: `Firebase user account has been disabled by administrator${options.failClosed ? " (fail-closed)" : ""}.`,
                });
              }
              if (u.emailVerified !== true) {
                return resolve({
                  active: false,
                  revoked: true,
                  error: `Firebase user email is not verified in account record (email_verified must be true)${options.failClosed ? " (fail-closed)" : ""}.`,
                });
              }
              return resolve({ active: true, revoked: false });
            }

            // Empty users array or unrecognized format
            if (options.failClosed) {
              return resolve({
                active: false,
                revoked: true,
                statusUnknown: true,
                error: "Google Identity Toolkit returned no user records. Verification could not be completed (fail-closed).",
              });
            }
            return resolve({ active: false, revoked: false, statusUnknown: true });
          } catch (e: any) {
            if (options.failClosed) {
              return resolve({
                active: false,
                revoked: true,
                statusUnknown: true,
                error: `Failed to parse Identity Toolkit response: ${e?.message} (fail-closed).`,
              });
            }
            resolve({ active: false, revoked: false, statusUnknown: true });
          }
        });
      }
    );

    req.on("error", (err) => {
      if (options.failClosed) {
        resolve({
          active: false,
          revoked: true,
          statusUnknown: true,
          error: `Google Identity Toolkit network error: ${err.message}. Account status verification failed (fail-closed).`,
        });
      } else {
        resolve({ active: false, revoked: false, statusUnknown: true, error: err.message });
      }
    });

    req.on("timeout", () => {
      req.destroy();
      if (options.failClosed) {
        resolve({
          active: false,
          revoked: true,
          statusUnknown: true,
          error: "Google Identity Toolkit request timed out. Account status verification failed (fail-closed).",
        });
      } else {
        resolve({ active: false, revoked: false, statusUnknown: true, error: "Timeout" });
      }
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Backward-compatible wrapper for checkFirebaseUserAccountStatus.
 */
export async function checkFirebaseUserRevoked(
  idToken: string,
  options: { failClosed?: boolean } = {}
): Promise<{ revoked: boolean; error?: string }> {
  const result = await checkFirebaseUserAccountStatus(idToken, options);
  return { revoked: result.revoked, error: result.error };
}

export interface VerifyFirebaseIdTokenOptions {
  checkRevoked?: boolean;
  failClosed?: boolean;
}

/**
 * Cryptographically verifies a Firebase ID token:
 * 1. If Firebase Admin SDK is configured with service account credentials,
 *    delegates to getAuth(app).verifyIdToken(token, true) for complete
 *    cryptographic verification and live revocation/disabled-user check.
 * 2. Otherwise performs direct cryptographic verification:
 *    - Validates header algorithm (RS256) and kid
 *    - Fetches Google's trusted X.509 public certificates
 *    - Verifies cryptographic signature using RSA-SHA256
 *    - Validates audience matches Firebase project ID
 *    - Validates issuer is https://securetoken.google.com/<projectId>
 *    - Validates expiration and issued-at times
 *    - Strictly requires email_verified === true (missing or false values rejected)
 *    - Validates user identity against authorized Admin email whitelist
 *    - Probes Google Identity Toolkit for live user account disabled/revocation status
 *    - Fails closed on dispatch endpoints if account-status check cannot be completed
 */
export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId?: string,
  options: VerifyFirebaseIdTokenOptions = {}
): Promise<FirebaseTokenVerificationResult> {
  try {
    if (!token || typeof token !== "string") {
      return { valid: false, error: "Missing or invalid token format." };
    }

    const failClosed = Boolean(options.failClosed);

    // 1. Prefer Firebase Admin SDK verifyIdToken(token, true) if initialized
    const adminApp = getFirebaseAdminApp();
    if (adminApp) {
      try {
        const decoded = await getAuth(adminApp).verifyIdToken(token, true /* checkRevoked */);

        // Strictly require email_verified === true; missing or false must be rejected
        if (decoded.email_verified !== true) {
          return {
            valid: false,
            error: "Firebase user email is not verified (email_verified must be strictly true). Missing or unverified email is rejected.",
          };
        }

        const email = (decoded.email || "").toLowerCase().trim();
        const authorizedEmails = getAuthorizedAdminEmails();
        const isAuthorized = authorizedEmails.includes(email);

        if (!isAuthorized) {
          return {
            valid: false,
            error: `User (${email}) is not authorized for Admin access.`,
          };
        }

        return {
          valid: true,
          email,
          uid: decoded.uid,
          isAdmin: true,
        };
      } catch (adminErr: any) {
        const errMsg = adminErr?.message || String(adminErr);
        const errCode = adminErr?.code || "";

        if (errCode === "auth/id-token-revoked" || errMsg.includes("revoked")) {
          return { valid: false, error: "Firebase ID token has been revoked." };
        }
        if (errCode === "auth/user-disabled" || errMsg.includes("disabled")) {
          return { valid: false, error: "Firebase user account has been disabled." };
        }
        if (errCode === "auth/id-token-expired" || errMsg.includes("expired")) {
          return { valid: false, error: "Token has expired." };
        }

        if (failClosed) {
          return {
            valid: false,
            error: `Firebase Admin verification failed: ${errMsg} (fail-closed).`,
          };
        }
        // If Admin SDK threw due to credentials/configuration issue, continue to cryptographic verifier
      }
    }

    // 2. Direct Cryptographic Verification using Google Public Certs
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "JWT must have exactly three parts." };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Parse header
    let header: any;
    try {
      header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    } catch {
      return { valid: false, error: "Invalid JWT header encoding." };
    }

    if (header.alg !== "RS256") {
      return { valid: false, error: `Invalid algorithm: expected RS256, got ${header.alg}` };
    }

    if (!header.kid || typeof header.kid !== "string") {
      return { valid: false, error: "Missing 'kid' in JWT header." };
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch {
      return { valid: false, error: "Invalid JWT payload encoding." };
    }

    const now = Math.floor(Date.now() / 1000);
    const clockSkew = 300; // 5 minutes tolerance

    // Expiration check
    if (!payload.exp || typeof payload.exp !== "number" || payload.exp < (now - clockSkew)) {
      return { valid: false, error: "Token has expired." };
    }

    // Issued at check
    if (!payload.iat || typeof payload.iat !== "number" || payload.iat > (now + clockSkew)) {
      return { valid: false, error: "Token used before issued time." };
    }

    // Audience & Issuer check
    const projectId = (expectedProjectId || getExpectedFirebaseProjectId()).trim();
    const expectedIss = `https://securetoken.google.com/${projectId}`;

    const isValidAud = payload.aud === projectId || payload.aud === "tejascanavssingstore" || payload.aud === "tejas-canvassing";
    const isValidIss = payload.iss === expectedIss || payload.iss === `https://securetoken.google.com/tejascanavssingstore` || payload.iss === `https://securetoken.google.com/tejas-canvassing`;

    if (!isValidAud) {
      return { valid: false, error: `Audience mismatch: expected ${projectId}, got ${payload.aud}` };
    }

    if (!isValidIss) {
      return { valid: false, error: `Issuer mismatch: expected ${expectedIss}, got ${payload.iss}` };
    }

    // Subject check
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      return { valid: false, error: "Subject ('sub') must be a non-empty string." };
    }

    // STRICT email_verified === true requirement: Missing or false values must be rejected
    if (payload.email_verified !== true) {
      return {
        valid: false,
        error: "Firebase user email is not verified (email_verified must be strictly true). Missing or unverified email is rejected.",
      };
    }

    // Authorized Admin Whitelist Check
    const email = (payload.email || "").toLowerCase().trim();
    const authorizedEmails = getAuthorizedAdminEmails();
    const isAuthorized = authorizedEmails.includes(email);

    if (!isAuthorized) {
      return { valid: false, error: `User (${email}) is not authorized for Admin access.` };
    }

    // Cryptographic Signature Verification
    let certs: Record<string, string>;
    try {
      certs = await fetchGooglePublicCerts(false);
    } catch (networkErr: any) {
      return { valid: false, error: `Unable to fetch Google public certs: ${networkErr?.message}` };
    }

    let cert = certs[header.kid];
    if (!cert) {
      // Force refresh in case Google rotated keys
      try {
        certs = await fetchGooglePublicCerts(true);
        cert = certs[header.kid];
      } catch {}
    }

    if (!cert) {
      return { valid: false, error: `Unknown key ID ('kid'): ${header.kid}. Public certificate not found.` };
    }

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    const isSignatureValid = verifier.verify(cert, Buffer.from(signatureB64, "base64url"));

    if (!isSignatureValid) {
      return { valid: false, error: "Cryptographic signature verification failed: invalid token signature." };
    }

    // Account Status & Revocation Check (Probes Google Identity Toolkit)
    // Runs in production or whenever failClosed is explicitly enforced
    const shouldCheckStatus = options.checkRevoked !== false && (process.env.NODE_ENV !== "test" || failClosed);
    if (shouldCheckStatus) {
      const statusCheck = await checkFirebaseUserAccountStatus(token, { failClosed });
      if (statusCheck.revoked || (failClosed && statusCheck.statusUnknown)) {
        return {
          valid: false,
          error: statusCheck.error || "Firebase user account is disabled or token revoked (fail-closed).",
        };
      }
    }

    return {
      valid: true,
      email,
      uid: payload.sub,
      isAdmin: true,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Verification failed: ${err?.message || "Unknown cryptographic error"}`,
    };
  }
}
