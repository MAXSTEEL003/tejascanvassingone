import fs from "fs";
import path from "path";

export type PortalSyncStatus = "Pending" | "Synced" | "Failed";

export interface PortalSyncTimelineEvent {
  event: string;
  timestamp: string;
  details?: string;
  source: "app_a" | "app_b";
}

export interface SupplierPortalSyncRecord {
  poNumber: string;
  originalOrderId: string;
  idempotencyKey: string;
  supplierName: string;
  status: PortalSyncStatus;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  syncedAt?: string;
  portalPoId?: number | string | null;
  lastError?: string | null;
  lastResponse?: any;
  timeline: PortalSyncTimelineEvent[];
  lastUpdated: string;
}

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const SYNC_FILE = path.join(DATA_DIR, "supplier_portal_sync.json");

// In-memory cache
const syncStore = new Map<string, SupplierPortalSyncRecord>();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[SupplierPortalSyncStore] Could not create data dir:", err);
  }
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(SYNC_FILE)) {
      const content = fs.readFileSync(SYNC_FILE, "utf-8");
      const records: SupplierPortalSyncRecord[] = JSON.parse(content);
      for (const r of records) {
        if (r && r.poNumber) {
          syncStore.set(r.poNumber.toUpperCase(), r);
        }
      }
    }
  } catch (err) {
    console.warn("[SupplierPortalSyncStore] Could not load tracking records from disk:", err);
  }
}

function persistToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(syncStore.values());
    fs.writeFileSync(SYNC_FILE, JSON.stringify(array, null, 2), "utf-8");
  } catch (err) {
    console.warn("[SupplierPortalSyncStore] Could not persist tracking records to disk:", err);
  }
}

// Initial load
loadFromDisk();

export function getSyncRecord(poNumber: string): SupplierPortalSyncRecord | undefined {
  if (!poNumber) return undefined;
  return syncStore.get(poNumber.toUpperCase());
}

export function getAllSyncRecords(): SupplierPortalSyncRecord[] {
  return Array.from(syncStore.values()).sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}

export function isPoAlreadySynced(poNumber: string): boolean {
  const record = getSyncRecord(poNumber);
  return record?.status === "Synced";
}

export function initSyncRecord(
  poNumber: string,
  supplierName: string = "Supplier"
): SupplierPortalSyncRecord {
  const normPo = poNumber.trim().toUpperCase();
  const existing = syncStore.get(normPo);
  if (existing) return existing;

  const idempotencyKey = `SYNC_PO_${normPo}_V1`;
  const now = new Date().toISOString();

  const record: SupplierPortalSyncRecord = {
    poNumber: normPo,
    originalOrderId: normPo,
    idempotencyKey,
    supplierName,
    status: "Pending",
    attempts: 0,
    createdAt: now,
    lastUpdated: now,
    timeline: [
      {
        event: "Sync Queued",
        timestamp: now,
        details: `Outbound sync initialized for supplier ${supplierName}. Key: ${idempotencyKey}`,
        source: "app_a",
      },
    ],
  };

  syncStore.set(normPo, record);
  persistToDisk();
  return record;
}

export function updateSyncRecord(
  poNumber: string,
  updates: Partial<SupplierPortalSyncRecord>,
  event?: { title: string; details?: string; source?: "app_a" | "app_b" }
): SupplierPortalSyncRecord {
  const normPo = poNumber.trim().toUpperCase();
  let record = syncStore.get(normPo);

  if (!record) {
    record = initSyncRecord(normPo, updates.supplierName || "Supplier");
  }

  const now = new Date().toISOString();

  Object.assign(record, updates);
  record.lastUpdated = now;

  if (event) {
    record.timeline.push({
      event: event.title,
      timestamp: now,
      details: event.details,
      source: event.source || "app_a",
    });
  }

  syncStore.set(normPo, record);
  persistToDisk();
  return record;
}
