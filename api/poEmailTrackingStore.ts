import crypto from "crypto";
import fs from "fs";
import path from "path";

export type PoEmailStatus = 
  | 'Queued'
  | 'Sending'
  | 'Sent'
  | 'Delivered'
  | 'Bounced/Failed'
  | 'Delivery unconfirmed'
  | 'Acknowledged'
  | 'Opened';

export interface PoEmailTimelineEvent {
  event: string;
  timestamp: string;
  details: string;
  source: 'backend' | 'gmail_api' | 'supplier' | 'tracker';
}

export interface PoEmailTrackingRecord {
  orderId: string;
  poRef: string;
  supplierName: string;
  recipientEmail: string;
  status: PoEmailStatus;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  bouncedAt?: string;
  acknowledgedAt?: string;
  acknowledgedByIp?: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
  attempts: number;
  maxAttempts: number;
  gmailMessageId?: string;
  threadId?: string;
  failureReason?: string;
  bounceDiagnostics?: string;
  pdfFilename?: string;
  pdfSizeBytes?: number;
  timeline: PoEmailTimelineEvent[];
  lastUpdated: string;
  acknowledgementUrl?: string;
  notes?: string;
}

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const TRACKING_FILE = path.join(DATA_DIR, "po_email_tracking.json");

// In-memory record store
const trackingStore = new Map<string, PoEmailTrackingRecord>();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn("Could not create data directory for tracking:", e);
  }
}

function loadPersistedRecords() {
  try {
    ensureDataDir();
    if (fs.existsSync(TRACKING_FILE)) {
      const raw = fs.readFileSync(TRACKING_FILE, "utf-8");
      const records: PoEmailTrackingRecord[] = JSON.parse(raw);
      if (Array.isArray(records)) {
        records.forEach((r) => {
          if (r.orderId) {
            trackingStore.set(r.orderId, r);
          }
        });
      }
    }
  } catch (err) {
    console.warn("Could not load persisted email tracking records:", err);
  }
}

function persistRecords() {
  try {
    ensureDataDir();
    const array = Array.from(trackingStore.values());
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(array, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist email tracking records to disk:", err);
  }
}

// Initial load on startup
loadPersistedRecords();

/**
 * Secret key used for cryptographic HMAC-SHA256 acknowledgement tokens
 */
const SERVER_AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "tejas_secure_auth_secret_2026_salt_wholesalemandi";

/**
 * Generates an unguessable, cryptographic HMAC-SHA256 acknowledgement token
 */
export function generateAcknowledgementToken(orderId: string, recipientEmail: string, issuedAtDate?: string): {
  token: string;
  dateStr: string;
} {
  const dateStr = issuedAtDate || new Date().toISOString().split("T")[0];
  const payload = `${orderId}:${(recipientEmail || "").trim().toLowerCase()}:${dateStr}`;
  const token = crypto.createHmac("sha256", SERVER_AUTH_SECRET).update(payload).digest("hex");
  return { token, dateStr };
}

/**
 * Verifies that the acknowledgement token is valid and unexpired (30-day validity)
 */
export function verifyAcknowledgementToken(orderId: string, recipientEmail: string, token: string, dateStr: string): boolean {
  if (!orderId || !token || !dateStr) return false;

  try {
    // Check expiration (30 days)
    const issuedTime = new Date(dateStr).getTime();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (isNaN(issuedTime) || now - issuedTime > thirtyDaysMs || issuedTime > now + (24 * 60 * 60 * 1000)) {
      return false; // Expired or invalid date
    }

    const expected = generateAcknowledgementToken(orderId, recipientEmail, dateStr).token;
    const a = Buffer.from(token, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Retrieves a tracking record by orderId
 */
export function getTrackingRecord(orderId: string): PoEmailTrackingRecord | null {
  const cleanId = String(orderId || "").trim();
  return trackingStore.get(cleanId) || null;
}

/**
 * Retrieves all tracked PO emails
 */
export function getAllTrackingRecords(): PoEmailTrackingRecord[] {
  return Array.from(trackingStore.values()).sort(
    (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()
  );
}

/**
 * Checks if an order was already sent successfully or acknowledged to prevent duplicate sends
 */
export function isOrderAlreadySent(orderId: string): boolean {
  const record = getTrackingRecord(orderId);
  if (!record) return false;
  return record.status === 'Sent' || record.status === 'Delivered' || record.status === 'Acknowledged' || record.status === 'Sending';
}

/**
 * Creates or updates an email tracking job in 'Queued' status
 */
export function queueEmailJob(params: {
  orderId: string;
  poRef: string;
  supplierName: string;
  recipientEmail: string;
  pdfFilename?: string;
  pdfSizeBytes?: number;
  acknowledgementUrl?: string;
}): PoEmailTrackingRecord {
  const now = new Date().toISOString();
  const existing = getTrackingRecord(params.orderId);

  const initialRecord: PoEmailTrackingRecord = {
    orderId: params.orderId,
    poRef: params.poRef,
    supplierName: params.supplierName,
    recipientEmail: params.recipientEmail,
    status: 'Queued',
    queuedAt: existing?.queuedAt || now,
    attempts: existing ? existing.attempts + 1 : 1,
    maxAttempts: 3,
    openCount: existing?.openCount || 0,
    pdfFilename: params.pdfFilename || 'Direct HTML Email Body',
    pdfSizeBytes: params.pdfSizeBytes || existing?.pdfSizeBytes,
    acknowledgementUrl: params.acknowledgementUrl || existing?.acknowledgementUrl,
    timeline: existing?.timeline || [
      {
        event: 'Order Placed & Email Queued',
        timestamp: now,
        details: `Purchase Order ${params.poRef} registered. Queued for automatic transmission to ${params.recipientEmail}.`,
        source: 'backend',
      },
    ],
    lastUpdated: now,
  };

  trackingStore.set(params.orderId, initialRecord);
  persistRecords();
  return initialRecord;
}

/**
 * Updates a tracking record's status and logs timeline event
 */
export function updateTrackingStatus(
  orderId: string,
  update: Partial<PoEmailTrackingRecord>,
  timelineEvent?: {
    event: string;
    details: string;
    source: 'backend' | 'gmail_api' | 'supplier' | 'tracker';
  }
): PoEmailTrackingRecord | null {
  const record = getTrackingRecord(orderId);
  if (!record) return null;

  const now = new Date().toISOString();

  if (timelineEvent) {
    record.timeline.push({
      ...timelineEvent,
      timestamp: now,
    });
  }

  Object.assign(record, update, { lastUpdated: now });
  trackingStore.set(orderId, record);
  persistRecords();
  return record;
}

/**
 * Records explicit supplier acknowledgement of receipt
 */
export function recordAcknowledgement(
  orderId: string,
  ipAddress?: string,
  notes?: string
): { success: boolean; alreadyAcknowledged: boolean; record: PoEmailTrackingRecord | null } {
  const record = getTrackingRecord(orderId);
  if (!record) return { success: false, alreadyAcknowledged: false, record: null };

  const now = new Date().toISOString();

  if (record.acknowledgedAt) {
    return { success: true, alreadyAcknowledged: true, record };
  }

  record.status = 'Acknowledged';
  record.acknowledgedAt = now;
  record.acknowledgedByIp = ipAddress;
  if (notes) record.notes = notes;

  record.timeline.push({
    event: 'Supplier Acknowledged Receipt',
    timestamp: now,
    details: `Supplier ${record.supplierName} clicked confirmation button on mobile/web portal. Receipt confirmed.`,
    source: 'supplier',
  });

  record.lastUpdated = now;
  trackingStore.set(orderId, record);
  persistRecords();
  return { success: true, alreadyAcknowledged: false, record };
}

/**
 * Records an email open event (from tracking pixel)
 */
export function recordEmailOpen(orderId: string): PoEmailTrackingRecord | null {
  const record = getTrackingRecord(orderId);
  if (!record) return null;

  const now = new Date().toISOString();
  record.openCount = (record.openCount || 0) + 1;
  if (!record.firstOpenedAt) record.firstOpenedAt = now;
  record.lastOpenedAt = now;

  // Only update status to Opened if not already Acknowledged or Delivered
  if (record.status === 'Sent' || record.status === 'Delivery unconfirmed') {
    record.status = 'Opened';
  }

  record.timeline.push({
    event: 'Email Opened (Approximate)',
    timestamp: now,
    details: `1x1 Tracking pixel loaded by recipient's email client (View #${record.openCount}). Subject to email privacy protections.`,
    source: 'tracker',
  });

  record.lastUpdated = now;
  trackingStore.set(orderId, record);
  persistRecords();
  return record;
}
