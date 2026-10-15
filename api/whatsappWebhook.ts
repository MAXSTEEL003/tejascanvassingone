import express from "express";
import crypto from "crypto";

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
