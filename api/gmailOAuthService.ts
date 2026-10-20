import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const GMAIL_SENDER = "nani@tejasc.in";
const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const OAUTH_FILE = path.join(DATA_DIR, "gmail_oauth.json");

export interface GmailOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
  authorizedEmail?: string;
  redirectUri?: string;
  updatedAt?: string;
}

// In-memory cache of token
let cachedCreds: GmailOAuthCredentials | null = null;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn("Could not create data directory:", e);
  }
}

/**
 * Loads OAuth credentials from environment variables or encrypted/persisted disk storage
 */
export function getStoredOAuthCredentials(): GmailOAuthCredentials {
  if (cachedCreds && cachedCreds.refreshToken) {
    return cachedCreds;
  }

  // 1. Check process.env first
  let envClientId = (process.env.GMAIL_CLIENT_ID || "").trim();
  let envClientSecret = (process.env.GMAIL_CLIENT_SECRET || "").trim();
  let envRefreshToken = (process.env.GMAIL_REFRESH_TOKEN || "").trim();
  let envRedirectUri = (process.env.GMAIL_REDIRECT_URI || "https://app.tejasc.in/api/auth/gmail/callback").trim();

  // 2. Check local .env candidates if environment variables are not yet loaded
  const envCandidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "tejascanvassingone-main", ".env"),
    path.join(typeof __dirname !== "undefined" ? __dirname : process.cwd(), ".env"),
    path.join(typeof __dirname !== "undefined" ? __dirname : process.cwd(), "..", ".env"),
  ];
  for (const envFile of envCandidates) {
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, "utf-8");
        const mClient = content.match(/^GMAIL_CLIENT_ID=(.*)$/m);
        if (mClient && mClient[1].trim() && !envClientId) envClientId = mClient[1].trim();
        const mSecret = content.match(/^GMAIL_CLIENT_SECRET=(.*)$/m);
        if (mSecret && mSecret[1].trim() && !envClientSecret) envClientSecret = mSecret[1].trim();
        const mRefresh = content.match(/^GMAIL_REFRESH_TOKEN=(.*)$/m);
        if (mRefresh && mRefresh[1].trim() && !envRefreshToken) envRefreshToken = mRefresh[1].trim();
        const mRedirect = content.match(/^GMAIL_REDIRECT_URI=(.*)$/m);
        if (mRedirect && mRedirect[1].trim() && !envRedirectUri) envRedirectUri = mRedirect[1].trim();
      } catch {}
    }
  }

  let fileCreds: Partial<GmailOAuthCredentials> = {};
  try {
    ensureDataDir();
    if (fs.existsSync(OAUTH_FILE)) {
      const raw = fs.readFileSync(OAUTH_FILE, "utf-8");
      fileCreds = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not read gmail_oauth.json from disk:", err);
  }

  cachedCreds = {
    clientId: envClientId || fileCreds.clientId || "",
    clientSecret: envClientSecret || fileCreds.clientSecret || "",
    refreshToken: envRefreshToken || fileCreds.refreshToken || "",
    accessToken: fileCreds.accessToken || "",
    tokenExpiry: fileCreds.tokenExpiry || 0,
    authorizedEmail: fileCreds.authorizedEmail || (process.env.GMAIL_SENDER || GMAIL_SENDER),
    redirectUri: envRedirectUri || fileCreds.redirectUri || "https://app.tejasc.in/api/auth/gmail/callback",
    updatedAt: fileCreds.updatedAt || new Date().toISOString(),
  };

  return cachedCreds;
}

/**
 * Saves or updates OAuth credentials to persistent storage
 */
export function saveOAuthCredentials(creds: Partial<GmailOAuthCredentials>): GmailOAuthCredentials {
  ensureDataDir();
  const existing = getStoredOAuthCredentials();
  const updated: GmailOAuthCredentials = {
    ...existing,
    ...creds,
    updatedAt: new Date().toISOString(),
  };

  cachedCreds = updated;

  // Persist to disk
  try {
    fs.writeFileSync(OAUTH_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write gmail_oauth.json to disk:", err);
  }

  // Also update process.env runtime
  if (updated.clientId) process.env.GMAIL_CLIENT_ID = updated.clientId;
  if (updated.clientSecret) process.env.GMAIL_CLIENT_SECRET = updated.clientSecret;
  if (updated.refreshToken) process.env.GMAIL_REFRESH_TOKEN = updated.refreshToken;

  return updated;
}

/**
 * Returns whether Gmail API OAuth 2.0 is fully configured
 */
export function isGmailOAuthConfigured(): boolean {
  const creds = getStoredOAuthCredentials();
  return Boolean(creds.clientId && creds.clientSecret && creds.refreshToken);
}

/**
 * Generates the Google OAuth 2.0 Authorization URL for one-time admin approval of nani@tejasc.in
 */
export function getAuthorizationUrl(redirectUri?: string, state?: string): string {
  const creds = getStoredOAuthCredentials();
  if (!creds.clientId) {
    throw new Error("GMAIL_CLIENT_ID is not configured. Please supply your Google OAuth Client ID.");
  }

  const effectiveRedirectUri = redirectUri || creds.redirectUri || "https://app.tejasc.in/api/auth/gmail/callback";
  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: effectiveRedirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    login_hint: GMAIL_SENDER,
    state: state || "tejas_gmail_oauth_init",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for tokens and verifies account identity
 */
export async function exchangeCodeForTokens(code: string, redirectUri?: string): Promise<{
  success: boolean;
  email: string;
  refreshToken?: string;
}> {
  const creds = getStoredOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error("Google OAuth Client ID or Client Secret is missing.");
  }

  const effectiveRedirectUri = redirectUri || creds.redirectUri || "https://app.tejasc.in/api/auth/gmail/callback";

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: effectiveRedirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Google OAuth Token Exchange Failed: ${data.error_description || data.error || response.statusText}`);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = data.expires_in || 3600;

  // Verify the authorized user profile is strictly nani@tejasc.in
  const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profile = await profileRes.json();
  const authorizedEmail = (profile.emailAddress || "").toLowerCase().trim();

  if (authorizedEmail !== GMAIL_SENDER) {
    throw new Error(`Authorized account mismatch: Expected ${GMAIL_SENDER}, but Google authenticated ${authorizedEmail || "unknown"}. Access denied.`);
  }

  saveOAuthCredentials({
    refreshToken: refreshToken || creds.refreshToken,
    accessToken,
    tokenExpiry: Date.now() + (expiresIn - 60) * 1000,
    authorizedEmail,
    redirectUri: effectiveRedirectUri,
  });

  return {
    success: true,
    email: authorizedEmail,
    refreshToken,
  };
}

/**
 * Retrieves a fresh, verified access token using the stored refresh token
 */
export async function getVerifiedAccessToken(): Promise<string> {
  const creds = getStoredOAuthCredentials();

  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error("Gmail API OAuth 2.0 is not configured. Missing Client ID, Client Secret, or Refresh Token.");
  }

  // Return cached token if valid for more than 2 minutes
  if (creds.accessToken && creds.tokenExpiry && creds.tokenExpiry > Date.now() + 120000) {
    return creds.accessToken;
  }

  // Refresh token from Google OAuth endpoint
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Gmail OAuth token refresh failed: ${data.error_description || data.error || response.statusText}`);
  }

  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  saveOAuthCredentials({
    accessToken: newAccessToken,
    tokenExpiry: Date.now() + (expiresIn - 60) * 1000,
  });

  return newAccessToken;
}

/**
 * Builds RFC 2822 MIME formatted email message with attached PDF
 */
export function buildMimeMessage(options: {
  to: string;
  cc?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  pdfBase64?: string;
  pdfFilename?: string;
}): string {
  const boundaryMixed = `mixed_${crypto.randomBytes(12).toString("hex")}`;
  const boundaryAlt = `alt_${crypto.randomBytes(12).toString("hex")}`;

  const cleanTo = options.to.trim();
  const cleanCc = (options.cc && options.cc.toLowerCase() !== cleanTo.toLowerCase()) ? options.cc.trim() : GMAIL_SENDER;
  const cleanSubject = options.subject.replace(/[\r\n]/g, " ").trim();
  const encodedSubject = `=?UTF-8?B?${Buffer.from(cleanSubject).toString("base64")}?=`;

  const headers = [
    `From: "Tejas Canvassing" <${GMAIL_SENDER}>`,
    `To: ${cleanTo}`,
    cleanCc ? `Cc: ${cleanCc}` : null,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <PO-${Date.now()}-${crypto.randomBytes(6).toString("hex")}@tejasc.in>`,
    `MIME-Version: 1.0`,
    options.pdfBase64
      ? `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`
      : `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
  ].filter(Boolean).join("\r\n");

  const textPart = [
    `--${boundaryAlt}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    options.textContent,
    ``,
  ].join("\r\n");

  const htmlPart = [
    `--${boundaryAlt}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    options.htmlContent,
    ``,
  ].join("\r\n");

  let attachmentPart = "";
  if (options.pdfBase64) {
    const filename = options.pdfFilename || "PO_Tejas_Canvassing.pdf";
    // Ensure clean base64 string
    const cleanBase64 = options.pdfBase64.replace(/\s+/g, "");
    attachmentPart = [
      `--${boundaryMixed}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      cleanBase64,
      ``,
    ].join("\r\n");
  }

  if (!options.pdfBase64) {
    return [
      headers,
      ``,
      textPart,
      htmlPart,
      `--${boundaryAlt}--`,
      ``,
    ].join("\r\n");
  }

  const mime = [
    headers,
    ``,
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    ``,
    textPart,
    htmlPart,
    `--${boundaryAlt}--`,
    ``,
    attachmentPart,
    `--${boundaryMixed}--`,
  ].filter(Boolean).join("\r\n");

  return mime;
}

/**
 * Sends official Purchase Order email through the Gmail API using OAuth 2.0
 */
export async function sendEmailViaGmailApi(options: {
  to: string;
  cc?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  pdfBase64?: string;
  pdfFilename?: string;
}): Promise<{
  id: string;
  threadId: string;
  sender: string;
}> {
  const accessToken = await getVerifiedAccessToken();

  const mime = buildMimeMessage(options);
  const base64UrlMessage = Buffer.from(mime).toString("base64url");

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_SENDER)}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlMessage,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Gmail API Message Send Error: ${data.error?.message || data.error || response.statusText}`);
  }

  return {
    id: data.id,
    threadId: data.threadId,
    sender: GMAIL_SENDER,
  };
}

/**
 * Checks for bounce / delivery status failure notifications in the Gmail mailbox
 */
export async function checkMailboxBounces(recipientEmail: string, threadId?: string): Promise<{
  hasBounce: boolean;
  bounceDetails?: string;
  bounceTimestamp?: string;
}> {
  try {
    const accessToken = await getVerifiedAccessToken();

    // Query messages by thread or recipient
    let query = `to:${recipientEmail} (from:mailer-daemon OR from:postmaster OR "Delivery Status Notification")`;
    if (threadId) {
      query = `thread:${threadId} (from:mailer-daemon OR from:postmaster OR "Delivery Status Notification")`;
    }

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_SENDER)}/messages?q=${encodeURIComponent(query)}&maxResults=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listRes.ok) return { hasBounce: false };
    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      return { hasBounce: false };
    }

    // Inspect the first matching bounce message
    const firstMsgId = listData.messages[0].id;
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_SENDER)}/messages/${firstMsgId}?format=snippet`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (msgRes.ok) {
      const msgData = await msgRes.json();
      return {
        hasBounce: true,
        bounceDetails: msgData.snippet || "Permanent failure delivery notification received from Mailer-Daemon.",
        bounceTimestamp: new Date().toISOString(),
      };
    }

    return { hasBounce: true, bounceDetails: "Bounce message detected in mailbox." };
  } catch (err: any) {
    console.warn("[Gmail Bounce Check] Warning:", err?.message || err);
    return { hasBounce: false };
  }
}
