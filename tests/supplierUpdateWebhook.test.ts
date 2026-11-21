import crypto from "crypto";
import assert from "assert";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.VERCEL = "1";
process.env.INTEGRATION_SHARED_SECRET = "test_integration_shared_secret_2026";
process.env.AUTH_SECRET = "test_auth_secret_key_tejas_2026";

import {
  processSupplierUpdateWebhook,
  verifyIntegrationSignature,
} from "../api/millerUpdatesService.js";
import {
  getAllMillerUpdates,
  getUnreadUpdatesCount,
  markAllUpdatesAsRead,
  markUpdateAsRead,
} from "../api/millerUpdatesStore.js";

function computeSignature(payload: any, secret: string, timestamp: string): string {
  const bodyString = typeof payload === "string" ? payload : JSON.stringify(payload);
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyString}`)
    .digest("hex");
}

async function runTests() {
  console.log("=== STARTING IN-PROCESS SUPPLIER UPDATE WEBHOOK TESTS ===\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  const secret = process.env.INTEGRATION_SHARED_SECRET!;

  // 1. Missing signature header returns 401
  await test("1. Inbound webhook rejects request when x-integration-signature is missing", async () => {
    const payload = { poNumber: "TC-5693", eventType: "PO_ACCEPTED" };
    const res = await processSupplierUpdateWebhook(payload, {}, JSON.stringify(payload));
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 401);
    assert.ok(res.error?.includes("Missing"));
  });

  // 2. Invalid signature returns 401
  await test("2. Inbound webhook rejects invalid HMAC signature", async () => {
    const payload = { poNumber: "TC-5693", eventType: "PO_ACCEPTED" };
    const timestamp = Date.now().toString();
    const headers = {
      "x-integration-signature": "0000000000000000000000000000000000000000000000000000000000000000",
      "x-integration-timestamp": timestamp,
    };
    const res = await processSupplierUpdateWebhook(payload, headers, JSON.stringify(payload));
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 401);
    assert.ok(res.error?.includes("verification failed"));
  });

  // 3. Event A: Mill Bill Uploaded (SUB_ORDER_BILL_UPLOADED)
  await test("3. Ingests mill bill upload webhook (SUB_ORDER_BILL_UPLOADED)", async () => {
    const payload = {
      orderId: "TC-5693",
      poNumber: "TC-5693",
      eventType: "SUB_ORDER_BILL_UPLOADED",
      eventPayload: {
        subOrderNo: "BRI-0003",
        billNo: "1300",
        billUrl: "/uploads/bills/bill_TC-5693_BRI-0003_1732170000.pdf",
        fileName: "mill_bill_1300.pdf",
        buyerName: "MUDIT AGRO FOODS",
        uploadedAt: "2026-11-21T07:15:00.000Z",
      },
      actor: "Bhagwathi Rice and Agro Industries",
    };

    const timestamp = Date.now().toString();
    const signature = computeSignature(payload, secret, timestamp);
    const headers = {
      "x-integration-signature": signature,
      "x-integration-timestamp": timestamp,
    };

    const res = await processSupplierUpdateWebhook(payload, headers, JSON.stringify(payload));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.code, 200);
    assert.ok(res.update);
    assert.strictEqual(res.update.type, "BILL_UPLOADED");
    assert.strictEqual(res.update.poNumber, "TC-5693");
    assert.strictEqual(res.update.subOrderNo, "BRI-0003");
    assert.strictEqual(res.update.billNo, "1300");
    assert.strictEqual(res.update.billUrl, "/uploads/bills/bill_TC-5693_BRI-0003_1732170000.pdf");
    assert.strictEqual(res.update.buyerName, "MUDIT AGRO FOODS");
    assert.strictEqual(res.update.millerName, "Bhagwathi Rice and Agro Industries");
  });

  // 4. Event B: Truck Loaded at Mill Yard (LOADING_ADDED)
  await test("4. Ingests truck loaded webhook (LOADING_ADDED)", async () => {
    const payload = {
      orderId: "TC-5693",
      poNumber: "TC-5693",
      eventType: "LOADING_ADDED",
      eventPayload: {
        loadingId: "load_12",
        loadingNumber: "LDG-2026-0001",
        poNumber: "TC-5693",
        subOrderNo: "BRI-0003",
        loadingDate: "2026-11-21",
        loadingQuantity: 18.0,
        vehicleNumber: "KA-01-AB-1234",
        driverPhone: "+91 98800 12345",
        weighbridgeSlip: "WB-1002",
      },
      actor: "Bhagwathi Rice and Agro Industries",
    };

    const timestamp = Date.now().toString();
    const signature = computeSignature(payload, secret, timestamp);
    const headers = {
      "x-integration-signature": signature,
      "x-integration-timestamp": timestamp,
    };

    const res = await processSupplierUpdateWebhook(payload, headers, JSON.stringify(payload));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.code, 200);
    assert.ok(res.update);
    assert.strictEqual(res.update.type, "TRUCK_LOADED");
    assert.strictEqual(res.update.vehicleNumber, "KA-01-AB-1234");
    assert.strictEqual(res.update.driverPhone, "+91 98800 12345");
    assert.strictEqual(res.update.weighbridgeSlip, "WB-1002");
    assert.strictEqual(res.update.loadedQuantity, 18.0);
    assert.strictEqual(res.update.millerName, "Bhagwathi Rice and Agro Industries");
  });

  // 5. Event C: Order Confirmed (PO_ACCEPTED)
  await test("5. Ingests order confirmed webhook (PO_ACCEPTED)", async () => {
    const payload = {
      orderId: "TC-5693",
      poNumber: "TC-5693",
      eventType: "PO_ACCEPTED",
      eventPayload: { status: "Accepted" },
      actor: "Bhagwathi Rice and Agro Industries",
    };

    const timestamp = Date.now().toString();
    const signature = computeSignature(payload, secret, timestamp);
    const headers = {
      "x-integration-signature": signature,
      "x-integration-timestamp": timestamp,
    };

    const res = await processSupplierUpdateWebhook(payload, headers, JSON.stringify(payload));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.code, 200);
    assert.ok(res.update);
    assert.strictEqual(res.update.type, "PO_ACCEPTED");
    assert.strictEqual(res.update.status, "Accepted");
    assert.strictEqual(res.update.millerName, "Bhagwathi Rice and Agro Industries");
  });

  // 6. Miller Updates Store Verification
  await test("6. Updates store maintains ingested items and accurate unread count", async () => {
    const updates = getAllMillerUpdates();
    assert.ok(Array.isArray(updates));
    assert.ok(updates.length >= 3);
    const unread = getUnreadUpdatesCount();
    assert.ok(unread >= 3);
  });

  // 7. Mark all updates as read clears unread badge
  await test("7. Mark all updates as read clears unread badge", async () => {
    const marked = markAllUpdatesAsRead();
    assert.ok(marked >= 3);
    const unread = getUnreadUpdatesCount();
    assert.strictEqual(unread, 0);
  });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
