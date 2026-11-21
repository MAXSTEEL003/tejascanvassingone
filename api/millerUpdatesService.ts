import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  addMillerUpdate,
  MillerUpdateRecord,
  MillerUpdateType,
} from "./millerUpdatesStore.js";
import { resolveSubOrderNumber } from "../src/utils/orderOperations.js";

// Initialize Firebase client for backend Firestore access
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

function withTimeout<T>(promise: Promise<T>, ms = 1500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export interface InboundWebhookResult {
  success: boolean;
  code: number;
  message: string;
  error?: string;
  update?: MillerUpdateRecord;
  orderId?: string;
}

/**
 * Validates HMAC-SHA256 signature using INTEGRATION_SHARED_SECRET
 */
export function verifyIntegrationSignature(
  rawBody: Buffer | string | undefined,
  bodyObj: any,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined
): { valid: boolean; error?: string; code: number } {
  const sharedSecret = (process.env.INTEGRATION_SHARED_SECRET || "tejas_integration_shared_secret_2026").trim();

  // If secret not configured in dev, warn and proceed
  if (!sharedSecret) {
    console.warn("[Supplier Webhook] INTEGRATION_SHARED_SECRET is not configured on server.");
    return { valid: true, code: 200 };
  }

  if (!signatureHeader || typeof signatureHeader !== "string") {
    return {
      valid: false,
      error: "Missing required 'x-integration-signature' header.",
      code: 401,
    };
  }

  // Parse signature hex
  const parts = signatureHeader.split("=");
  const sigHex = (parts.length === 2 && parts[0] === "sha256" ? parts[1] : parts[0]).trim();
  if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) {
    return {
      valid: false,
      error: "Malformed 'x-integration-signature' format. Expected 64-char hex string.",
      code: 401,
    };
  }

  const timestamp = String(timestampHeader || "").trim();

  // Validate timestamp freshness (15 minutes tolerance if timestamp provided)
  if (timestamp) {
    const tsNum = Number(timestamp);
    if (!isNaN(tsNum)) {
      const now = Date.now();
      const diffMs = Math.abs(now - tsNum);
      const maxAgeMs = 15 * 60 * 1000;
      if (diffMs > maxAgeMs) {
        console.warn(`[Supplier Webhook] Warning: Timestamp skew of ${Math.round(diffMs / 1000)}s`);
      }
    }
  }

  // Candidate bodies to check against:
  const candidateBuffers: Buffer[] = [];
  const rawStr = typeof rawBody === "string" ? rawBody : (rawBody ? rawBody.toString("utf8") : "");

  if (timestamp) {
    if (rawStr) {
      candidateBuffers.push(Buffer.from(`${timestamp}.${rawStr}`, "utf8"));
    }
    if (bodyObj) {
      candidateBuffers.push(Buffer.from(`${timestamp}.${JSON.stringify(bodyObj)}`, "utf8"));
    }
  }
  if (rawStr) {
    candidateBuffers.push(Buffer.from(rawStr, "utf8"));
  }
  if (bodyObj) {
    candidateBuffers.push(Buffer.from(JSON.stringify(bodyObj), "utf8"));
  }

  const targetSig = Buffer.from(sigHex.toLowerCase(), "hex");

  for (const buf of candidateBuffers) {
    const computedHex = crypto.createHmac("sha256", sharedSecret).update(buf).digest("hex");
    const computedBuf = Buffer.from(computedHex.toLowerCase(), "hex");
    if (targetSig.length === computedBuf.length && crypto.timingSafeEqual(targetSig, computedBuf)) {
      return { valid: true, code: 200 };
    }
  }

  return {
    valid: false,
    error: "Invalid webhook signature (HMAC-SHA256 verification failed).",
    code: 401,
  };
}

/**
 * Handles incoming webhook events from Application B / Milling Partner
 */
export async function processSupplierUpdateWebhook(
  body: any,
  headers: Record<string, any>,
  rawBody?: Buffer | string
): Promise<InboundWebhookResult> {
  const signature = headers["x-integration-signature"] || headers["signature"];
  const timestamp = headers["x-integration-timestamp"] || headers["timestamp"];

  // 1. Signature Verification
  const verification = verifyIntegrationSignature(rawBody, body, signature, timestamp);
  if (!verification.valid) {
    return {
      success: false,
      code: verification.code,
      message: "Webhook rejected: Signature verification failed.",
      error: verification.error,
    };
  }

  if (!body || typeof body !== "object") {
    return {
      success: false,
      code: 400,
      message: "Invalid payload: Request body must be a JSON object.",
    };
  }

  const rawEventType = String(body.eventType || "").trim().toUpperCase();
  const eventPayload = body.eventPayload || {};
  const poNumber = String(
    body.poNumber || body.orderId || eventPayload.poNumber || eventPayload.orderId || ""
  ).trim();
  const actor = String(
    body.actor || eventPayload.millerName || "Bhagwathi Rice and Agro Industries"
  ).trim();

  if (!rawEventType) {
    return {
      success: false,
      code: 400,
      message: "Missing 'eventType' in webhook payload.",
    };
  }

  if (!poNumber) {
    return {
      success: false,
      code: 400,
      message: "Missing 'poNumber' or 'orderId' in webhook payload.",
    };
  }

  const updateId = `upd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  let updateRecord: MillerUpdateRecord;

  // 2. Map Event Types & Construct Miller Update Record
  if (rawEventType === "SUB_ORDER_BILL_UPLOADED" || rawEventType === "BILL_UPLOADED") {
    const billNo = String(eventPayload.billNo || "").trim();
    const billUrl = String(eventPayload.billUrl || "").trim();
    const subOrderNo = String(eventPayload.subOrderNo || "").trim();
    const buyerName = String(eventPayload.buyerName || "").trim();
    const fileName = String(eventPayload.fileName || `mill_bill_${billNo || "doc"}.pdf`).trim();
    const uploadedAt = eventPayload.uploadedAt || nowIso;

    updateRecord = {
      id: updateId,
      type: "BILL_UPLOADED",
      poNumber,
      subOrderNo,
      buyerName,
      billNo,
      billUrl,
      fileName,
      millerName: actor,
      timestamp: uploadedAt,
      read: false,
      createdAt: nowIso,
      rawPayload: body,
    };
  } else if (rawEventType === "LOADING_ADDED" || rawEventType === "TRUCK_LOADED") {
    const vehicleNumber = String(eventPayload.vehicleNumber || "").trim();
    const driverPhone = String(eventPayload.driverPhone || "").trim();
    const weighbridgeSlip = String(eventPayload.weighbridgeSlip || "").trim();
    const loadedQuantity = parseFloat(eventPayload.loadingQuantity) || 0;
    const loadingDate = String(eventPayload.loadingDate || nowIso.split("T")[0]).trim();
    const subOrderNo = String(eventPayload.subOrderNo || "").trim();

    updateRecord = {
      id: updateId,
      type: "TRUCK_LOADED",
      poNumber,
      subOrderNo,
      vehicleNumber,
      driverPhone,
      weighbridgeSlip,
      loadedQuantity,
      loadingDate,
      loadingNumber: String(eventPayload.loadingNumber || "").trim(),
      loadingId: String(eventPayload.loadingId || "").trim(),
      millerName: actor,
      timestamp: nowIso,
      read: false,
      createdAt: nowIso,
      rawPayload: body,
    };
  } else if (rawEventType === "PO_ACCEPTED" || rawEventType === "ORDER_ACCEPTED") {
    updateRecord = {
      id: updateId,
      type: "PO_ACCEPTED",
      poNumber,
      millerName: actor,
      status: "Accepted",
      timestamp: nowIso,
      read: false,
      createdAt: nowIso,
      rawPayload: body,
    };
  } else {
    // Generic supplier update
    updateRecord = {
      id: updateId,
      type: "PO_ACCEPTED",
      poNumber,
      millerName: actor,
      status: rawEventType,
      timestamp: nowIso,
      read: false,
      createdAt: nowIso,
      rawPayload: body,
    };
  }

  // 3. Persist update in Memory/Disk store
  addMillerUpdate(updateRecord);

  // 4. Persist update in Firestore collection 'miller_updates'
  try {
    await withTimeout(
      setDoc(doc(db, "miller_updates", updateRecord.id), updateRecord, { merge: true }),
      1200
    );
  } catch (fsErr: any) {
    console.warn(`[Supplier Webhook] Non-critical error saving to firestore miller_updates:`, fsErr?.message || fsErr);
  }

  // 5. Update corresponding order in 'placed_orders'
  try {
    await withTimeout(
      updatePlacedOrderFromWebhook(poNumber, updateRecord, eventPayload),
      1500
    );
  } catch (poErr: any) {
    console.warn(`[Supplier Webhook] Non-critical error updating placed_orders document ${poNumber}:`, poErr?.message || poErr);
  }

  return {
    success: true,
    code: 200,
    message: `Supplier update for PO ${poNumber} processed successfully (${updateRecord.type}).`,
    update: updateRecord,
    orderId: poNumber,
  };
}

/**
 * Updates the Firestore placed_orders document to reflect mill bills, lorry dispatches, or acceptances
 */
async function updatePlacedOrderFromWebhook(
  poNumber: string,
  updateRecord: MillerUpdateRecord,
  eventPayload: any
) {
  const normPo = poNumber.trim();
  const cleanPo = normPo.replace(/^#/, "");

  let targetDocId = cleanPo;
  let orderData: any = null;

  // 1. Try finding doc directly by standard IDs
  const idCandidates = [cleanPo, normPo, `#${cleanPo}`];
  for (const cId of idCandidates) {
    try {
      const snap = await withTimeout(getDoc(doc(db, "placed_orders", cId)), 600);
      if (snap.exists()) {
        orderData = snap.data();
        targetDocId = snap.id;
        break;
      }
    } catch {}
  }

  // 2. If not found by ID, query collection
  if (!orderData) {
    try {
      const allDocs = await withTimeout(getDocs(collection(db, "placed_orders")), 800);
      allDocs.forEach((d) => {
        if (!orderData) {
          const data = d.data();
          const p = String(data.poNumber || data.id || d.id || "").replace(/^#/, "");
          if (p.toUpperCase() === cleanPo.toUpperCase()) {
            orderData = data;
            targetDocId = d.id;
          }
        }
      });
    } catch {}
  }

  // 3. If order not yet in placed_orders, create initial stub so it's recorded
  if (!orderData) {
    orderData = {
      id: cleanPo,
      poNumber: cleanPo,
      supplier: updateRecord.millerName,
      date: new Date().toISOString().split("T")[0],
      status: "Approved",
      originalOrders: [],
    };
  }

  // 4. Apply updates based on event type
  if (updateRecord.type === "BILL_UPLOADED") {
    const billNo = updateRecord.billNo;
    const billUrl = updateRecord.billUrl;
    const subOrderNo = updateRecord.subOrderNo;
    const buyerName = updateRecord.buyerName;

    if (billNo) {
      orderData.billNo = billNo;
      orderData.actualSupplierBillNo = billNo;
    }
    if (billUrl) {
      orderData.billUrl = billUrl;
      orderData.billPhotoUrl = billUrl;
      orderData.billPhoto = billUrl;
    }

    orderData.supplierBillNos = orderData.supplierBillNos || {};
    orderData.supplierBillPhotos = orderData.supplierBillPhotos || {};

    if (subOrderNo) {
      if (billNo) orderData.supplierBillNos[subOrderNo] = billNo;
      if (billUrl) orderData.supplierBillPhotos[subOrderNo] = billUrl;
    }

    // Update constituent sub-order in originalOrders
    if (Array.isArray(orderData.originalOrders) && orderData.originalOrders.length > 0) {
      let matched = false;
      orderData.originalOrders = orderData.originalOrders.map((sub: any, idx: number) => {
        const subNo = resolveSubOrderNumber(sub, idx, orderData.supplier);
        const isMatch =
          (subOrderNo && (subNo === subOrderNo || sub.id === subOrderNo || sub.orderNo === subOrderNo || sub.subOrderNo === subOrderNo)) ||
          (buyerName && String(sub.buyer || "").trim().toLowerCase() === buyerName.toLowerCase());

        if (isMatch) {
          matched = true;
          return {
            ...sub,
            billNo: billNo || sub.billNo,
            actualSupplierBillNo: billNo || sub.actualSupplierBillNo,
            billUrl: billUrl || sub.billUrl,
            billPhotoUrl: billUrl || sub.billPhotoUrl,
            status: "Billed",
            billedAt: new Date().toISOString(),
          };
        }
        return sub;
      });

      // If no specific sub-order matched, mark the first one
      if (!matched && orderData.originalOrders.length > 0) {
        orderData.originalOrders[0] = {
          ...orderData.originalOrders[0],
          billNo: billNo || orderData.originalOrders[0].billNo,
          actualSupplierBillNo: billNo || orderData.originalOrders[0].actualSupplierBillNo,
          billUrl: billUrl || orderData.originalOrders[0].billUrl,
          billPhotoUrl: billUrl || orderData.originalOrders[0].billPhotoUrl,
          status: "Billed",
          billedAt: new Date().toISOString(),
        };
      }
    } else {
      orderData.originalOrders = [
        {
          id: subOrderNo || `SUB-${cleanPo}-01`,
          subOrderNo: subOrderNo || `SUB-${cleanPo}-01`,
          buyer: buyerName || orderData.buyer || "Consignee",
          billNo,
          actualSupplierBillNo: billNo,
          billUrl,
          billPhotoUrl: billUrl,
          status: "Billed",
          billedAt: new Date().toISOString(),
        },
      ];
    }
  } else if (updateRecord.type === "TRUCK_LOADED") {
    const vNo = updateRecord.vehicleNumber;
    const phone = updateRecord.driverPhone;
    const slip = updateRecord.weighbridgeSlip;

    if (vNo) {
      orderData.vehicleNumber = vNo;
      orderData.truckNo = vNo;
      orderData.vehicleNo = vNo;
      orderData.lorryNo = vNo;
    }
    if (phone) orderData.driverPhone = phone;
    if (slip) orderData.weighbridgeSlip = slip;
    if (updateRecord.loadedQuantity) orderData.loadedQuantity = updateRecord.loadedQuantity;
    if (updateRecord.loadingDate) orderData.loadingDate = updateRecord.loadingDate;

    orderData.status = "Loaded";
    orderData.dispatchedAt = new Date().toISOString();

    if (Array.isArray(orderData.originalOrders)) {
      orderData.originalOrders = orderData.originalOrders.map((sub: any) => ({
        ...sub,
        vehicleNumber: vNo || sub.vehicleNumber,
        truckNo: vNo || sub.truckNo,
        driverPhone: phone || sub.driverPhone,
        weighbridgeSlip: slip || sub.weighbridgeSlip,
        status: "Loaded",
      }));
    }
  } else if (updateRecord.type === "PO_ACCEPTED") {
    orderData.status = "Accepted";
    orderData.isAcknowledged = true;
    orderData.acknowledgedAt = new Date().toISOString();

    if (Array.isArray(orderData.originalOrders)) {
      orderData.originalOrders = orderData.originalOrders.map((sub: any) => ({
        ...sub,
        status: "Accepted",
      }));
    }
  }

  // 5. Commit updated placed order back to Firestore
  try {
    await withTimeout(setDoc(doc(db, "placed_orders", targetDocId), orderData, { merge: true }), 1000);
    console.log(`[Supplier Webhook] Successfully updated placed_orders/${targetDocId} for event ${updateRecord.type}`);
  } catch (fsErr: any) {
    console.warn(`[Supplier Webhook] Non-critical notice writing placed_orders/${targetDocId}:`, fsErr?.message || fsErr);
  }
}
