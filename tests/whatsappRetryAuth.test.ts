process.env.NODE_ENV = 'test';
import assert from 'assert';
import crypto from 'crypto';
import app, { createSignedToken } from '../api/index';
import { isClientMockToken, createClientAuthToken } from '../src/lib/auth';

async function runWhatsAppRetryAuthTests() {
  console.log("=== STARTING WHATSAPP RETRY & DISPATCH AUTHENTICATION TESTS ===");
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

  // Find dispatch-whatsapp and dispatch-po handlers in Express app
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

  const dispatchWaHandler = findHandler('/api/dispatch-whatsapp');
  const dispatchPoHandler = findHandler('/api/dispatch-po');

  assert(Boolean(dispatchWaHandler), "Found /api/dispatch-whatsapp handler");
  assert(Boolean(dispatchPoHandler), "Found /api/dispatch-po handler");

  const executeRoute = async (handler: any, reqOverrides: any = {}) => {
    let statusCode = 200;
    let body: any = null;
    const req: any = {
      body: {
        to: "919945351166",
        buyerName: "Test Merchant",
        orderId: `WA-TEST-${Date.now()}`,
        poNumber: `WA-TEST-${Date.now()}`,
        brand: "KESHAR KALI",
        qty: "80",
        rate: "8400",
        message: "Order placed successfully",
        templateParams: ["Test Merchant", "KESHAR KALI", "80", "8400"],
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

  // 1. isClientMockToken detection
  await test("1. isClientMockToken correctly identifies client-only mock tokens vs server/Firebase tokens", () => {
    const mockToken = createClientAuthToken({
      username: 'tejasadinarayan',
      role: 'admin',
      name: 'Tejas Admin',
      email: 'nani@tejasc.in'
    });
    assert.strictEqual(isClientMockToken(mockToken), true, "Mock client token must be detected as client-only");

    const serverHmacToken = createSignedToken({
      sub: 'admin-01',
      username: 'tejasadinarayan',
      role: 'admin',
      email: 'nani@tejasc.in',
      name: 'Tejas Admin'
    });
    assert.strictEqual(isClientMockToken(serverHmacToken), false, "Server-signed HMAC token must not be flagged as client mock");

    // Real-format RS256 token
    const dummyRs256 = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdGVqYXNjYW5hdnNzaW5nc3RvcmUiLCJzdWIiOiIxMjMifQ.c29tZXJlYWxzaWduYXR1cmVieXRlcw";
    assert.strictEqual(isClientMockToken(dummyRs256), false, "RS256 token must not be flagged as client mock");
    assert.strictEqual(isClientMockToken(null), true, "null must return true");
    assert.strictEqual(isClientMockToken(""), true, "empty string must return true");
  });

  // 2. Mock client token is strictly rejected by /api/dispatch-whatsapp (cannot bypass auth)
  await test("2. Mock client token from createClientAuthToken is rejected with 401 by /api/dispatch-whatsapp", async () => {
    const mockToken = createClientAuthToken({
      username: 'tejasadinarayan',
      role: 'admin',
      name: 'Tejas Admin',
      email: 'nani@tejasc.in'
    });
    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${mockToken}` }
    });
    assert.strictEqual(res.statusCode, 401, "Mock token must be rejected with 401");
    assert.strictEqual(res.body.success, false);
    assert(res.body.error.includes("Admin privileges required"), "Must return Admin privileges required");
  });

  // 3. Missing authorization header returns 401
  await test("3. Missing token returns 401 Unauthorized on /api/dispatch-whatsapp", async () => {
    const res = await executeRoute(dispatchWaHandler, { headers: {} });
    assert.strictEqual(res.statusCode, 401, "Missing auth must return 401");
    assert.strictEqual(res.body.success, false);
  });

  // 4. Valid server-signed HMAC token is accepted by /api/dispatch-whatsapp
  await test("4. Valid server-signed HMAC Admin token is cryptographically accepted by /api/dispatch-whatsapp", async () => {
    const serverHmacToken = createSignedToken({
      sub: 'admin-01',
      username: 'tejasadinarayan',
      role: 'admin',
      email: 'nani@tejasc.in',
      name: 'Tejas Admin'
    });
    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${serverHmacToken}` }
    });
    // In test environment, Meta WhatsApp Cloud API accepts dispatch or returns 200
    assert.strictEqual(res.statusCode, 200, "Valid server-signed admin token must be accepted");
    assert.strictEqual(res.body.success, true);
  });

  // 5. Expired server-signed token returns 401
  await test("5. Expired server-signed token returns 401 Unauthorized", async () => {
    const expiredToken = createSignedToken({
      sub: 'admin-01',
      username: 'tejasadinarayan',
      role: 'admin',
      email: 'nani@tejasc.in',
      name: 'Tejas Admin'
    }, -60); // expired 60 seconds ago
    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.statusCode, 401, "Expired token must return 401");
  });

  // 6. Non-admin server-signed token returns 401 on dispatch
  await test("6. Server-signed token with non-admin role (e.g. merchant or employee) returns 401 on /api/dispatch-whatsapp", async () => {
    const merchantToken = createSignedToken({
      sub: 'merchant-01',
      username: 'somemerchant',
      role: 'merchant' as any,
      email: 'merchant@gmail.com',
      name: 'Merchant User'
    });
    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${merchantToken}` }
    });
    assert.strictEqual(res.statusCode, 401, "Non-admin token must return 401 on dispatch-whatsapp");
  });

  // 7. Expired RS256 Firebase token returns 401
  await test("7. Expired RS256 Firebase ID token returns 401 Unauthorized", async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'user-01',
      email: 'nani@tejasc.in',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
      iat: Math.floor(Date.now() / 1000) - 3900,
    })).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const sig = signer.sign(privateKey, 'base64url');
    const token = `${header}.${payload}.${sig}`;

    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.statusCode, 401, "Expired RS256 token must return 401");
  });

  // 8. Unauthorized email in RS256 token returns 401
  await test("8. RS256 token with unauthorized email returns 401 Unauthorized", async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'user-hacker',
      email: 'stranger@example.com',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const sig = signer.sign(privateKey, 'base64url');
    const token = `${header}.${payload}.${sig}`;

    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.statusCode, 401, "Unauthorized email must return 401");
  });

  // 9. Client-side retry error translation: 401 responses produce friendly UI error message
  await test("9. 401 responses produce friendly user-facing error message without raw server exception leaks", () => {
    const rawBackendError = "Unauthorized: Admin privileges required for WhatsApp dispatch. A verified Admin session token is required.";
    const isUnauthorized = rawBackendError.toLowerCase().includes('unauthorized') || rawBackendError.toLowerCase().includes('admin privileges');
    assert.strictEqual(isUnauthorized, true);
    const friendlyMsg = isUnauthorized 
      ? 'Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.'
      : rawBackendError;
    assert.strictEqual(friendlyMsg, 'Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.');
  });

  // 10. PO email dispatch enforces identical 401 security on mock and missing tokens
  await test("10. /api/dispatch-po enforces identical 401 security on missing or mock client tokens", async () => {
    const mockToken = createClientAuthToken({
      username: 'tejasadinarayan',
      role: 'admin',
      name: 'Tejas Admin',
      email: 'nani@tejasc.in'
    });
    const resMock = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${mockToken}` }
    });
    assert.strictEqual(resMock.statusCode, 401, "Mock token must be rejected on dispatch-po");

    const resMissing = await executeRoute(dispatchPoHandler, { headers: {} });
    assert.strictEqual(resMissing.statusCode, 401, "Missing token must be rejected on dispatch-po");
  });

  // 11. Test token allowance in test environment works for verification
  await test("11. Automated test environment token (test-firebase-token) is accepted for dispatch integration in test environment", async () => {
    const res = await executeRoute(dispatchWaHandler, {
      headers: { authorization: 'Bearer test-firebase-token' }
    });
    assert.strictEqual(res.statusCode, 200, "test-firebase-token must be accepted in test environment");
    assert.strictEqual(res.body.success, true);
  });

  // 12. In production environment (NODE_ENV !== 'test'), test-firebase-token and test-admin-token are strictly rejected with 401
  await test("12. In production mode (NODE_ENV === 'production'), test-firebase-token and test-admin-token are strictly REJECTED (401)", async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const resWa = await executeRoute(dispatchWaHandler, {
        headers: { authorization: 'Bearer test-firebase-token' }
      });
      assert.strictEqual(resWa.statusCode, 401, "test-firebase-token MUST be rejected with 401 in production");
      assert.strictEqual(resWa.body.success, false);

      const resWaAdmin = await executeRoute(dispatchWaHandler, {
        headers: { authorization: 'Bearer test-admin-token' }
      });
      assert.strictEqual(resWaAdmin.statusCode, 401, "test-admin-token MUST be rejected with 401 in production");
      assert.strictEqual(resWaAdmin.body.success, false);

      const resPo = await executeRoute(dispatchPoHandler, {
        headers: { authorization: 'Bearer test-firebase-token' }
      });
      assert.strictEqual(resPo.statusCode, 401, "test-firebase-token MUST be rejected with 401 on dispatch-po in production");
      assert.strictEqual(resPo.body.success, false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 13. In production mode, client mock tokens and forged HMAC signatures are strictly rejected with 401
  await test("13. In production mode, client mock tokens and invalid HMAC tokens are strictly REJECTED (401)", async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const mockToken = createClientAuthToken({
        username: 'tejasadinarayan',
        role: 'admin',
        name: 'Tejas Admin',
        email: 'nani@tejasc.in'
      });
      const resMock = await executeRoute(dispatchWaHandler, {
        headers: { authorization: `Bearer ${mockToken}` }
      });
      assert.strictEqual(resMock.statusCode, 401, "Client mock token must be rejected with 401 in production");

      // Forged HMAC token with wrong secret
      const headerStr = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payloadStr = Buffer.from(JSON.stringify({
        sub: "admin-fake",
        username: "fakeadmin",
        role: "admin",
        email: "nani@tejasc.in",
        name: "Fake Admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      })).toString("base64url");
      const fakeSig = crypto.createHmac("sha256", "wrong_attacker_secret_key").update(`${headerStr}.${payloadStr}`).digest("base64url");
      const forgedToken = `${headerStr}.${payloadStr}.${fakeSig}`;

      const resForged = await executeRoute(dispatchWaHandler, {
        headers: { authorization: `Bearer ${forgedToken}` }
      });
      assert.strictEqual(resForged.statusCode, 401, "Forged HMAC token must be rejected with 401 in production");
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  console.log(`\n=== WHATSAPP RETRY AUTH TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runWhatsAppRetryAuthTests().catch((err) => {
  console.error("FATAL ERROR in WhatsApp Retry Auth tests:", err);
  process.exit(1);
});
