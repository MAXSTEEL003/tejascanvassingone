process.env.NODE_ENV = 'test';
import assert from 'assert';
import crypto from 'crypto';
import app, { createSignedToken, verifySignedToken, verifyAdminRequest } from '../api/index';
import {
  isServerSignedAdminToken,
  isClientMockToken,
  createClientAuthToken,
  getValidAuthToken,
  parseTokenPayload,
  setAuthSession,
  clearAuthSession,
  AuthenticatedUser
} from '../src/lib/auth';
import { dispatchPurchaseOrderEmail } from '../src/services/poEmailClient';
import { dispatchOrderPlacedWhatsApp } from '../src/lib/whatsapp';

// Mock browser storage for Node.js test environment
const mockStorage: Record<string, string> = {};
(global as any).sessionStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
(global as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
(global as any).window = {
  dispatchEvent: () => true
};

async function runAutomaticDispatchAuthTests() {
  console.log("=== TEJAS CANVASSING: AUTOMATIC DISPATCH AUTHENTICATION REGRESSION TESTS ===");
  let passed = 0;
  let failed = 0;

  function test(desc: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`✅ PASS: ${desc}`);
            passed++;
          })
          .catch((err) => {
            console.error(`❌ FAIL: ${desc} ->`, err.message);
            failed++;
          });
      }
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${desc} ->`, err.message);
      failed++;
    }
  }

  // Find Express route handlers
  const router = (app as any)._router;
  const findHandler = (pathName: string) => {
    const layer = router.stack.find((l: any) => {
      return l.route && l.route.path && (
        (Array.isArray(l.route.path) && l.route.path.includes(pathName)) ||
        l.route.path === pathName
      );
    });
    return layer?.route?.stack[0]?.handle;
  };

  const dispatchPoHandler = findHandler('/api/dispatch-po');
  const dispatchWaHandler = findHandler('/api/dispatch-whatsapp');

  assert(Boolean(dispatchPoHandler), "Found /api/dispatch-po handler");
  assert(Boolean(dispatchWaHandler), "Found /api/dispatch-whatsapp handler");

  const executeRoute = async (handler: any, reqOverrides: any = {}) => {
    let statusCode = 200;
    let body: any = null;
    const req: any = {
      body: {
        to: "bhagwatirice@gmail.com",
        supplierName: "Bhagwathi Rice and Agro Industries",
        orderId: `AUTO-TEST-${Date.now()}`,
        poNumber: `AUTO-TEST-${Date.now()}`,
        subject: "Auto Dispatch Test PO",
        htmlContent: "<p>Test PO Content</p>",
        message: "Test message",
        ...reqOverrides.body,
      },
      get: (h: string) => (h === 'host' ? 'localhost:3000' : ''),
      protocol: 'http',
      headers: { ...reqOverrides.headers },
    };
    const res: any = {
      status: (code: number) => { statusCode = code; return res; },
      json: (data: any) => { body = data; return res; },
    };
    await handler(req, res);
    return { statusCode, body };
  };

  // 1. isServerSignedAdminToken accurately identifies valid server-signed HMAC Admin tokens
  await test("1. isServerSignedAdminToken validates authentic server-signed HMAC Admin token", () => {
    const adminToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    });

    assert.strictEqual(isServerSignedAdminToken(adminToken), true, "Valid server-signed admin token must return true");
  });

  // 2. isServerSignedAdminToken strictly rejects client-only mock tokens
  await test("2. isServerSignedAdminToken rejects client-side mock tokens (sig_ prefix)", () => {
    const mockToken = createClientAuthToken({
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Admin",
      email: "nani@tejasc.in"
    });

    assert.strictEqual(isClientMockToken(mockToken), true, "Mock token must be detected as mock");
    assert.strictEqual(isServerSignedAdminToken(mockToken), false, "isServerSignedAdminToken must reject mock token");
  });

  // 3. isServerSignedAdminToken rejects non-admin roles (e.g. merchant or employee)
  await test("3. isServerSignedAdminToken rejects tokens with non-admin roles (merchant / employee)", () => {
    const merchantToken = createSignedToken({
      sub: "merchant-01",
      username: "merchant_user",
      role: "merchant" as any,
      name: "Merchant Name",
      email: "merchant@example.com"
    });

    const employeeToken = createSignedToken({
      sub: "emp-01",
      username: "staff_user",
      role: "employee" as any,
      name: "Staff Name",
      email: "employee@tejasc.in"
    });

    assert.strictEqual(isServerSignedAdminToken(merchantToken), false, "Merchant token must be rejected");
    assert.strictEqual(isServerSignedAdminToken(employeeToken), false, "Employee token must be rejected");
  });

  // 4. isServerSignedAdminToken rejects expired HMAC tokens
  await test("4. isServerSignedAdminToken rejects expired server-signed tokens", () => {
    const expiredToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    }, -300); // Expired 5 minutes ago

    assert.strictEqual(isServerSignedAdminToken(expiredToken), false, "Expired token must return false");
  });

  // 5. isServerSignedAdminToken rejects empty, malformed, or garbage strings
  await test("5. isServerSignedAdminToken rejects null, empty, and malformed strings", () => {
    assert.strictEqual(isServerSignedAdminToken(null), false);
    assert.strictEqual(isServerSignedAdminToken(undefined), false);
    assert.strictEqual(isServerSignedAdminToken(""), false);
    assert.strictEqual(isServerSignedAdminToken("not.a.valid.jwt"), false);
    assert.strictEqual(isServerSignedAdminToken("random-string-without-dots"), false);
  });

  // 6. getValidAuthToken returns server-signed HMAC token directly from storage
  await test("6. getValidAuthToken retrieves stored server-signed HMAC Admin token immediately", async () => {
    (global as any).sessionStorage.clear();
    (global as any).localStorage.clear();

    const adminToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    });

    setAuthSession(adminToken, {
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    });

    const token = await getValidAuthToken();
    assert.strictEqual(token, adminToken, "getValidAuthToken must return the stored server-signed HMAC admin token");
  });

  // 7. Express verifyAdminRequest accepts the token returned by getValidAuthToken
  await test("7. Server verifyAdminRequest accepts token from getValidAuthToken for PO Email dispatch", async () => {
    const token = await getValidAuthToken();
    assert(Boolean(token), "Token must exist");

    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.statusCode, 200, `PO Email dispatch must return 200 with admin token (got ${res.statusCode})`);
    assert.strictEqual(res.body.success, true);
  });

  // 8. Express verifyAdminRequest accepts the token returned by getValidAuthToken for WhatsApp dispatch
  await test("8. Server verifyAdminRequest accepts token from getValidAuthToken for WhatsApp dispatch", async () => {
    const token = await getValidAuthToken();
    assert(Boolean(token), "Token must exist");

    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${token}` },
      body: { to: "919945351166" }
    });
    assert.strictEqual(res.statusCode, 200, `WhatsApp dispatch must return 200 with admin token (got ${res.statusCode})`);
    assert.strictEqual(res.body.success, true);
  });

  // 9. Simulated order placement automatic dispatch flow:
  // When an admin signs in with username/password, both dispatches receive the valid token
  await test("9. Automatic notification dispatch flow simulates Place Order with server-signed token", async () => {
    // Setup Admin session as created upon username/password sign-in
    const adminUser = {
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin" as const,
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    };
    const validServerToken = createSignedToken(adminUser);
    setAuthSession(validServerToken, adminUser as AuthenticatedUser);

    // Order details simulating grouped purchase order TC-K8M492
    const batchId = "TC-K8M492";
    const resolvedAuthToken = await getValidAuthToken();
    assert.strictEqual(resolvedAuthToken, validServerToken, "Pre-dispatch token resolution matches server token");

    // Mock global fetch for dispatchPurchaseOrderEmail and dispatchOrderPlacedWhatsApp
    const originalFetch = global.fetch;
    const fetchCalls: { url: string; headers: any; body: any }[] = [];

    global.fetch = (async (url: any, init?: any) => {
      const urlStr = String(url);
      fetchCalls.push({ url: urlStr, headers: init?.headers, body: init?.body ? JSON.parse(init.body) : null });

      if (urlStr.includes('/api/dispatch-po')) {
        const authHeader = init?.headers?.Authorization || init?.headers?.authorization;
        const reqToken = authHeader?.replace('Bearer ', '');
        const payload = verifySignedToken(reqToken);
        if (payload && payload.role === 'admin') {
          return {
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ success: true, isLiveSent: true, status: 'Sent', messageId: 'po-msg-12345' }),
            text: async () => JSON.stringify({ success: true, isLiveSent: true, status: 'Sent' })
          } as any;
        }
        return {
          ok: false,
          status: 401,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ success: false, error: 'Unauthorized: Admin privileges required.' }),
          text: async () => JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required.' })
        } as any;
      }

      if (urlStr.includes('/api/dispatch-whatsapp')) {
        const authHeader = init?.headers?.Authorization || init?.headers?.authorization;
        const reqToken = authHeader?.replace('Bearer ', '');
        const payload = verifySignedToken(reqToken);
        if (payload && payload.role === 'admin') {
          return {
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ success: true, status: 200, deliveryStatus: 'Accepted', messageId: 'wa-msg-67890' }),
            text: async () => JSON.stringify({ success: true, status: 200, deliveryStatus: 'Accepted' })
          } as any;
        }
        return {
          ok: false,
          status: 401,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ success: false, error: 'Unauthorized: Admin privileges required.' }),
          text: async () => JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required.' })
        } as any;
      }

      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true })
      } as any;
    }) as any;

    try {
      // 1. Automatic PO Email dispatch immediately after order placement
      const emailResult = await dispatchPurchaseOrderEmail({
        to: "bhagwatirice@gmail.com",
        from: "nani@tejasc.in",
        subject: `Tejas Canvassing: Purchase Order ${batchId} - BHAGWATHI RICE MILLS`,
        html: "<p>Original HTML PO Email</p>",
        orderId: batchId,
        poNumber: batchId,
        batchId: batchId,
        supplierName: "BHAGWATHI RICE MILLS",
        authToken: resolvedAuthToken || undefined
      });

      assert.strictEqual(emailResult.success, true, "Automatic PO email dispatch must succeed");
      assert.strictEqual(emailResult.status, 'Sent', "Automatic PO email status must be 'Sent'");
      assert.strictEqual(emailResult.messageId, 'po-msg-12345', "Message ID must be captured");

      // 2. Automatic WhatsApp dispatch immediately after order placement
      const waResult = await dispatchOrderPlacedWhatsApp({
        to: "919945351166",
        buyerName: "UPLETA TRADERS",
        brand: "KESHAR KALI",
        qty: 100,
        rate: 8500,
        orderId: batchId,
        poNumber: batchId,
        authToken: resolvedAuthToken || undefined
      });

      assert.strictEqual(waResult.success, true, "Automatic WhatsApp dispatch must succeed");
      assert.strictEqual(waResult.deliveryStatus, 'Accepted', "Automatic WhatsApp deliveryStatus must be 'Accepted'");
      assert.strictEqual(waResult.messageId, 'wa-msg-67890', "WhatsApp messageId must be captured");

      // 3. Verify Authorization header was properly sent for both dispatches
      const poCall = fetchCalls.find(c => c.url.includes('/api/dispatch-po'));
      const waCall = fetchCalls.find(c => c.url.includes('/api/dispatch-whatsapp'));

      assert(Boolean(poCall), "PO email fetch call must have been executed");
      assert(Boolean(waCall), "WhatsApp fetch call must have been executed");
      assert.strictEqual(poCall?.headers?.Authorization, `Bearer ${validServerToken}`, "PO email carried correct Bearer token");
      assert.strictEqual(waCall?.headers?.Authorization, `Bearer ${validServerToken}`, "WhatsApp carried correct Bearer token");

    } finally {
      global.fetch = originalFetch;
    }
  });

  // 10. Manual retry in PlacedOrders.tsx invariance:
  // When authToken is NOT explicitly provided, dispatchPurchaseOrderEmail and dispatchOrderPlacedWhatsApp
  // fall back cleanly to getValidAuthToken() and succeed.
  await test("10. Manual retry invariance: functions without explicit authToken fallback to getValidAuthToken()", async () => {
    const adminToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    });
    setAuthSession(adminToken, {
      sub: "admin-tejas-01",
      username: "admintejas1679",
      role: "admin",
      name: "Tejas Adinarayan (Admin)",
      email: "nani@tejasc.in"
    });

    const originalFetch = global.fetch;
    let poRetryAuthHeader = '';
    let waRetryAuthHeader = '';

    global.fetch = (async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/dispatch-po')) {
        poRetryAuthHeader = init?.headers?.Authorization || '';
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ success: true, isLiveSent: true, status: 'Sent', messageId: 'retry-email-ok' }),
          text: async () => JSON.stringify({ success: true })
        } as any;
      }
      if (urlStr.includes('/api/dispatch-whatsapp')) {
        waRetryAuthHeader = init?.headers?.Authorization || '';
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ success: true, status: 200, deliveryStatus: 'Accepted', messageId: 'retry-wa-ok' }),
          text: async () => JSON.stringify({ success: true })
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }) as any;

    try {
      // Manual retry: no authToken parameter passed (exact call signature used in PlacedOrders.tsx)
      const retryEmailRes = await dispatchPurchaseOrderEmail({
        to: "bhagwatirice@gmail.com",
        from: "nani@tejasc.in",
        subject: "Manual Retry PO Email",
        html: "<p>Manual Retry</p>",
        orderId: "TC-RETRY-01",
        supplierName: "BHAGWATHI RICE MILLS"
      });

      assert.strictEqual(retryEmailRes.success, true, "Manual retry PO email must succeed");
      assert.strictEqual(poRetryAuthHeader, `Bearer ${adminToken}`, "Manual retry email used correct Bearer token");

      const retryWaRes = await dispatchOrderPlacedWhatsApp({
        phone: "919945351166",
        buyerName: "VALUED MERCHANT",
        brand: "KESHAR KALI",
        qty: 80,
        rate: 8400,
        orderId: "TC-RETRY-01"
      });

      assert.strictEqual(retryWaRes.success, true, "Manual retry WhatsApp must succeed");
      assert.strictEqual(waRetryAuthHeader, `Bearer ${adminToken}`, "Manual retry WhatsApp used correct Bearer token");

    } finally {
      global.fetch = originalFetch;
    }
  });

  // 11. Clear session properly removes tokens and prevents unauthenticated dispatch
  await test("11. clearAuthSession removes session and causes subsequent dispatch without token to fail gracefully", async () => {
    clearAuthSession();
    assert.strictEqual(sessionStorage.getItem('tejas_auth_token_v1'), null);
    assert.strictEqual(localStorage.getItem('tejas_auth_token_v1'), null);

    const tokenAfterClear = await getValidAuthToken();
    assert.strictEqual(tokenAfterClear, null, "getValidAuthToken must return null after clearAuthSession");

    // Attempt dispatch without authentication
    const unauthPoRes = await dispatchPurchaseOrderEmail({
      to: "bhagwatirice@gmail.com",
      from: "nani@tejasc.in",
      subject: "Unauth Test",
      html: "<p>Unauth</p>",
      orderId: "TC-UNAUTH",
      supplierName: "BHAGWATHI RICE MILLS"
    });

    assert.strictEqual(unauthPoRes.success, false, "Dispatch without auth must fail");
    assert(unauthPoRes.error?.includes("Admin authentication required"), "Must state Admin authentication required");

    const unauthWaRes = await dispatchOrderPlacedWhatsApp({
      to: "919945351166",
      buyerName: "BUYER",
      brand: "RICE",
      qty: 10,
      rate: 8000,
      orderId: "TC-UNAUTH"
    });

    assert.strictEqual(unauthWaRes.success, false, "WhatsApp dispatch without auth must fail");
    assert(unauthWaRes.error?.includes("Admin authentication required"), "Must state Admin authentication required");
  });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAutomaticDispatchAuthTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
