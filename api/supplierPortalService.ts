import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  initSyncRecord,
  updateSyncRecord,
  getSyncRecord,
  SupplierPortalSyncRecord,
  PortalSyncStatus,
} from "./supplierPortalSyncStore.js";
import { resolveSubOrderNumber, resolveGroupedPoNumber } from "../src/utils/orderOperations.js";

// Initialize Firebase client for backend Firestore access
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Standard date parser converting "9-Nov-2026", ISO dates, or Date objects to "YYYY-MM-DD"
 */
function toIsoDate(d: any): string {
  if (!d) return new Date().toISOString().split("T")[0];
  if (typeof d === "string") {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
    // Handles "9-Nov-2026" or "09-Nov-2026"
    const months: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const parts = d.trim().split(/[-/ ]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const monStr = parts[1].slice(0, 3);
      const mon = months[monStr] || (!isNaN(Number(monStr)) ? monStr.padStart(2, "0") : "11");
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${mon}-${day}`;
    }
  }
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split("T")[0];
    }
  } catch {}
  return new Date().toISOString().split("T")[0];
}

/**
 * Maps Application A's Firestore placed_orders document to Application B's receiving contract
 */
export function buildSupplierPortalPayload(order: any): {
  payload: any;
  poNumber: string;
  idempotencyKey: string;
} {
  const poNumber = resolveGroupedPoNumber(order);
  const idempotencyKey = `SYNC_PO_${poNumber}_V1`;
  const supplierName = String(order.supplier || order.origin || "Supplier").trim();

  const rawSubOrders = Array.isArray(order.originalOrders) && order.originalOrders.length > 0
    ? order.originalOrders
    : [order];

  // 1. Map individual sub-orders
  const mappedSubOrders = rawSubOrders.map((so: any, idx: number) => {
    const qty = parseFloat(so.qty) || 0;
    const rate = parseFloat(so.rate) || 0;
    const amount = parseFloat(so.amount) || Math.round(qty * rate);
    const subOrderNo = resolveSubOrderNumber(so, idx, supplierName);

    return {
      subOrderNo,
      buyerName: String(so.buyer || order.buyer || "Authorized Buyer").trim(),
      productName: String(so.product || so.items?.replace(/\(\d+.*$/, "").trim() || order.product || "KESHAR KALI").trim().toUpperCase(),
      orderedQuantity: qty,
      rate,
      amount,
      deliveryLocation: String(so.unloadingPoint || so.destination || order.destination || "shop").trim(),
      status: so.status || "Approved",
      billNo: so.billNo || null,
    };
  });

  // 2. Aggregate distinct product varieties
  const productAggMap = new Map<string, { qty: number; totalAmt: number; rateSum: number; count: number }>();
  for (const so of mappedSubOrders) {
    const pName = so.productName;
    const existing = productAggMap.get(pName) || { qty: 0, totalAmt: 0, rateSum: 0, count: 0 };
    existing.qty += so.orderedQuantity;
    existing.totalAmt += so.amount;
    existing.rateSum += so.rate;
    existing.count += 1;
    productAggMap.set(pName, existing);
  }

  const products = Array.from(productAggMap.entries()).map(([name, data]) => ({
    name,
    quantity: Math.round(data.qty * 100) / 100,
    rate: data.qty > 0 ? Math.round(data.totalAmt / data.qty) : Math.round(data.rateSum / data.count),
    unit: "QTL",
    totalAmount: Math.round(data.totalAmt),
  }));

  const totalOrderedQuantity = mappedSubOrders.reduce((sum, s) => sum + s.orderedQuantity, 0);
  const totalOrderValue = mappedSubOrders.reduce((sum, s) => sum + s.amount, 0);

  // 3. Agreed rate calculation (only populate single agreedRate if accurate)
  const allSameRate = mappedSubOrders.length > 0 && mappedSubOrders.every(s => s.rate === mappedSubOrders[0].rate);
  const agreedRate = allSameRate ? mappedSubOrders[0].rate : (totalOrderedQuantity > 0 ? Math.round(totalOrderValue / totalOrderedQuantity) : 0);

  // 4. Customer Contact resolution
  let customerContact = "";
  if (Array.isArray(order.dispatchedBuyers) && order.dispatchedBuyers[0]?.phone) {
    customerContact = String(order.dispatchedBuyers[0].phone).trim();
  } else if (order.phone) {
    customerContact = String(order.phone).trim();
  } else if (rawSubOrders[0]?.phone) {
    customerContact = String(rawSubOrders[0].phone).trim();
  }
  if (customerContact && !customerContact.startsWith("+") && !customerContact.startsWith("91") && customerContact.length === 10) {
    customerContact = `+91${customerContact}`;
  } else if (customerContact && customerContact.startsWith("91") && !customerContact.startsWith("+")) {
    customerContact = `+${customerContact}`;
  }

  // 5. Expected Loading Date calculation (from loadingDays)
  let expectedLoadingDate: string | null = null;
  const maxLoadingDays = Math.max(0, ...rawSubOrders.map((so: any) => Number(so.loadingDays) || 0));
  if (maxLoadingDays > 0) {
    const baseDate = new Date(toIsoDate(order.date));
    baseDate.setDate(baseDate.getDate() + maxLoadingDays);
    expectedLoadingDate = baseDate.toISOString().split("T")[0];
  }

  // 6. Remarks / special instructions
  const remarksList = Array.from(new Set(
    rawSubOrders.map((so: any) => (so.remarks || "").trim()).filter(Boolean)
  ));
  if (order.remarks && String(order.remarks).trim() && !remarksList.includes(String(order.remarks).trim())) {
    remarksList.push(String(order.remarks).trim());
  }

  const payload = {
    poNumber,
    originalOrderId: poNumber,
    idempotencyKey,
    supplierName,
    customerName: String(order.buyer || (mappedSubOrders.length === 1 ? mappedSubOrders[0].buyerName : "Consolidated Merchants")).trim(),
    customerContact: customerContact || "+919448023088",
    deliveryLocation: String(order.destination || (mappedSubOrders.length === 1 ? mappedSubOrders[0].deliveryLocation : "Multiple Destinations")).trim(),
    totalOrderedQuantity: Math.round(totalOrderedQuantity * 100) / 100,
    agreedRate,
    totalOrderValue: Math.round(totalOrderValue),
    orderAcceptanceDate: toIsoDate(order.date),
    expectedLoadingDate,
    deliveryRequirements: "",
    specialInstructions: remarksList.join(" | ") || "",
    status: "New",
    products,
    subOrders: mappedSubOrders,
  };

  return { payload, poNumber, idempotencyKey };
}

/**
 * Outbound integration executor transmitting PO to Application B with HMAC-SHA256 authentication
 */
export async function syncPoToSupplierPortal(
  poNumber: string,
  options?: { isManualRetry?: boolean }
): Promise<{
  success: boolean;
  status: PortalSyncStatus;
  poNumber: string;
  portalPoId?: number | string | null;
  message?: string;
  error?: string;
  record?: SupplierPortalSyncRecord;
}> {
  const normPo = (poNumber || "").trim().toUpperCase();
  if (!normPo) {
    return { success: false, status: "Failed", poNumber: "", error: "Missing PO number" };
  }

  // 1. Check idempotency: if already synced and not a manual retry, return existing record
  const existingRecord = getSyncRecord(normPo);
  if (existingRecord && existingRecord.status === "Synced" && !options?.isManualRetry) {
    return {
      success: true,
      status: "Synced",
      poNumber: normPo,
      portalPoId: existingRecord.portalPoId,
      message: "Order is already successfully synchronized with Keshar Kali Supplier Portal.",
      record: existingRecord,
    };
  }

  // 2. Load authentic persisted grouped PO from Firestore (Never trust browser payload)
  let orderData: any = null;
  try {
    const snap = await getDoc(doc(db, "placed_orders", normPo));
    if (snap.exists()) {
      orderData = snap.data();
    }
  } catch (dbErr: any) {
    console.error(`[Supplier Portal Sync] Error fetching Firestore placed_orders/${normPo}:`, dbErr);
  }

  if (!orderData) {
    const errMsg = `Grouped PO ${normPo} not found in Firestore placed_orders. Ensure order is placed first.`;
    const record = updateSyncRecord(normPo, {
      status: "Failed",
      lastError: errMsg,
      lastAttemptAt: new Date().toISOString(),
    }, {
      title: "Sync Aborted: Order Not Found",
      details: errMsg,
      source: "app_a",
    });
    return { success: false, status: "Failed", poNumber: normPo, error: errMsg, record };
  }

  // 3. Construct receiving API payload
  const { payload, idempotencyKey } = buildSupplierPortalPayload(orderData);
  const supplierName = payload.supplierName;

  // Initialize or update tracking record
  let currentRecord = initSyncRecord(normPo, supplierName);
  currentRecord = updateSyncRecord(normPo, {
    attempts: currentRecord.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
    supplierName,
  });

  // 4. Configuration validation (Fail safely if secret missing; never expose or hardcode)
  const appBUrl = (process.env.APP_B_URL || "https://kesharkali.vercel.app").replace(/\/$/, "");
  const sharedSecret = (process.env.INTEGRATION_SHARED_SECRET || "").trim();

  if (!sharedSecret) {
    const errMsg = "INTEGRATION_SHARED_SECRET is not configured in server environment. Transmission halted for security.";
    console.error(`[Supplier Portal Sync Config Error]: ${errMsg}`);
    const record = updateSyncRecord(normPo, {
      status: "Failed",
      lastError: errMsg,
    }, {
      title: "Configuration Error",
      details: errMsg,
      source: "app_a",
    });
    return { success: false, status: "Failed", poNumber: normPo, error: errMsg, record };
  }

  // 5. Generate HMAC-SHA256 signature
  const timestamp = Date.now().toString();
  const bodyString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", sharedSecret)
    .update(`${timestamp}.${bodyString}`)
    .digest("hex");

  const targetEndpoint = `${appBUrl}/api/integration/receive-po`;
  console.log(`[Supplier Portal Sync] Transmitting ${normPo} to ${targetEndpoint} (Key: ${idempotencyKey})...`);

  // 6. Send POST request with transient retry
  let attempt = 0;
  const maxAttempts = 2;
  let lastErrorMsg = "";
  let resJson: any = null;
  let responseOk = false;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-integration-signature": signature,
          "x-integration-timestamp": timestamp,
          "x-idempotency-key": idempotencyKey,
        },
        body: bodyString,
      });

      const responseText = await response.text();
      try {
        resJson = JSON.parse(responseText);
      } catch {
        resJson = { raw: responseText };
      }

      if (response.ok) {
        responseOk = true;
        break;
      } else {
        lastErrorMsg = `HTTP ${response.status}: ${resJson?.error || resJson?.message || responseText || "Unknown portal error"}`;
        // Permanent validation / auth error: do not retry
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          break;
        }
      }
    } catch (networkErr: any) {
      lastErrorMsg = networkErr?.message || "Network connection failure to Application B";
    }

    if (attempt < maxAttempts) {
      // Exponential backoff delay for transient failure
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }

  // 7. Process response & record integration result
  if (responseOk && resJson) {
    const portalPoId = resJson.poId || resJson.id || null;
    const isDuplicate = Boolean(resJson.duplicate);
    const successMsg = isDuplicate
      ? `Already synchronized with Application B (Idempotent duplicate acknowledged, PO ID: ${portalPoId || "N/A"})`
      : `Successfully synchronized with Application B (Supplier Portal PO ID: ${portalPoId || "N/A"})`;

    const record = updateSyncRecord(normPo, {
      status: "Synced",
      syncedAt: new Date().toISOString(),
      portalPoId,
      lastError: null,
      lastResponse: resJson,
    }, {
      title: isDuplicate ? "Idempotent Re-sync Acknowledged" : "PO Transmitted & Accepted",
      details: successMsg,
      source: "app_b",
    });

    // Update Firestore sync status in dedicated collection & order document
    try {
      await setDoc(doc(db, "supplier_portal_sync", normPo), record, { merge: true });
      await updateDoc(doc(db, "placed_orders", normPo), {
        supplierPortalSynced: true,
        supplierPortalSyncedAt: new Date().toISOString(),
        supplierPortalPoId: portalPoId,
      }).catch(() => {});
    } catch (fsErr) {
      console.warn(`[Supplier Portal Sync] Non-critical Firestore status notice:`, fsErr);
    }

    console.log(`[Supplier Portal Sync Success] ${normPo} -> Portal PO ID: ${portalPoId}`);
    return {
      success: true,
      status: "Synced",
      poNumber: normPo,
      portalPoId,
      message: successMsg,
      record,
    };
  } else {
    console.error(`[Supplier Portal Sync Failure] ${normPo}: ${lastErrorMsg}`);

    const record = updateSyncRecord(normPo, {
      status: "Failed",
      lastError: lastErrorMsg,
      lastResponse: resJson,
    }, {
      title: "Transmission Failed",
      details: `Failed after ${attempt} attempt(s): ${lastErrorMsg}`,
      source: "app_a",
    });

    // Record failure in separate Firestore collection without altering original placed order
    try {
      await setDoc(doc(db, "supplier_portal_sync", normPo), record, { merge: true });
    } catch {}

    return {
      success: false,
      status: "Failed",
      poNumber: normPo,
      error: lastErrorMsg,
      record,
    };
  }
}
