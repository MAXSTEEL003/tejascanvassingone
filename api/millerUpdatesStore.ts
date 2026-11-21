import fs from "fs";
import path from "path";

export type MillerUpdateType = "BILL_UPLOADED" | "TRUCK_LOADED" | "PO_ACCEPTED";

export interface MillerUpdateRecord {
  id: string;
  type: MillerUpdateType;
  poNumber: string;
  subOrderNo?: string;
  buyerName?: string;
  billNo?: string;
  billUrl?: string;
  fileName?: string;
  millerName: string;
  vehicleNumber?: string;
  driverPhone?: string;
  weighbridgeSlip?: string;
  loadedQuantity?: number;
  loadingDate?: string;
  loadingNumber?: string;
  loadingId?: string;
  status?: string;
  timestamp: string; // ISO string
  read: boolean;
  createdAt: string;
  rawPayload?: any;
}

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const UPDATES_FILE = path.join(DATA_DIR, "miller_updates.json");

// In-memory cache
const updatesStore = new Map<string, MillerUpdateRecord>();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[MillerUpdatesStore] Could not create data dir:", err);
  }
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(UPDATES_FILE)) {
      const content = fs.readFileSync(UPDATES_FILE, "utf-8");
      const records: MillerUpdateRecord[] = JSON.parse(content);
      for (const r of records) {
        if (r && r.id) {
          updatesStore.set(r.id, r);
        }
      }
    }
  } catch (err) {
    console.warn("[MillerUpdatesStore] Could not load updates from disk:", err);
  }
}

function persistToDisk() {
  try {
    ensureDataDir();
    const array = Array.from(updatesStore.values());
    fs.writeFileSync(UPDATES_FILE, JSON.stringify(array, null, 2), "utf-8");
  } catch (err) {
    console.warn("[MillerUpdatesStore] Could not persist updates to disk:", err);
  }
}

// Initial load on boot
loadFromDisk();

export function addMillerUpdate(update: MillerUpdateRecord): MillerUpdateRecord {
  updatesStore.set(update.id, update);
  persistToDisk();
  return update;
}

export function getAllMillerUpdates(): MillerUpdateRecord[] {
  loadFromDisk();
  return Array.from(updatesStore.values())
    .filter(u => u.poNumber !== "TC-5693" && !u.poNumber?.includes("5693"))
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export function removeTestUpdates(): number {
  let removed = 0;
  for (const [id, item] of updatesStore.entries()) {
    if (item.poNumber === "TC-5693" || item.poNumber?.includes("5693") || id.includes("5693")) {
      updatesStore.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    persistToDisk();
  }
  return removed;
}

export function clearAllMillerUpdates(): void {
  updatesStore.clear();
  persistToDisk();
}

export function getMillerUpdateById(id: string): MillerUpdateRecord | undefined {
  return updatesStore.get(id);
}

export function getUnreadUpdatesCount(): number {
  let count = 0;
  for (const item of updatesStore.values()) {
    if (!item.read) count++;
  }
  return count;
}

export function markUpdateAsRead(id: string): boolean {
  const item = updatesStore.get(id);
  if (!item) return false;
  item.read = true;
  persistToDisk();
  return true;
}

export function markAllUpdatesAsRead(): number {
  let marked = 0;
  for (const item of updatesStore.values()) {
    if (!item.read) {
      item.read = true;
      marked++;
    }
  }
  if (marked > 0) {
    persistToDisk();
  }
  return marked;
}
