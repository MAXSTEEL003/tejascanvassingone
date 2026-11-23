process.env.NODE_ENV = 'test';
import assert from 'assert';
import crypto from 'crypto';
import app, { createSignedToken } from '../api/index';
import { verifyFirebaseIdToken, checkFirebaseUserAccountStatus, getExpectedFirebaseProjectId } from '../api/firebaseTokenVerifier';

async function runSecurityTests() {
  console.log("=== STARTING ADMIN AUTHENTICATION CRYPTOGRAPHIC SECURITY TESTS ===");
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

  // Find dispatch-po and dispatch-whatsapp route handlers
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
        orderId: `SEC-TEST-${Date.now()}`,
        poNumber: `SEC-TEST-${Date.now()}`,
        subject: "Security Test PO",
        htmlContent: "<p>Security Test</p>",
        message: "Security Test",
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

  // 1. Forged RS256 token signed by attacker key
  await test("1. Forged Firebase token with attacker RS256 key is rejected cryptographically", async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid-123', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'forged-user-01',
      email: 'nani@tejasc.in',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const forgedSig = signer.sign(privateKey, 'base64url');
    const forgedToken = `${header}.${payload}.${forgedSig}`;

    // Test verifier function directly
    const verifyRes = await verifyFirebaseIdToken(forgedToken);
    assert.strictEqual(verifyRes.valid, false, "Verifier must reject forged token");

    // Test /api/dispatch-po endpoint
    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${forgedToken}` }
    });
    assert.strictEqual(res.statusCode, 401, `Endpoint must return 401 for forged token (got ${res.statusCode})`);
    assert.strictEqual(res.body.success, false);
  });

  // 2. Token with alg: 'none'
  await test("2. Unsecured JWT with alg: 'none' is rejected immediately", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'attacker-01',
      email: 'nani@tejasc.in',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const verifyRes = await verifyFirebaseIdToken(noneToken);
    assert.strictEqual(verifyRes.valid, false, "Verifier must reject alg: none");

    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${noneToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 3. Expired token
  await test("3. Expired token is rejected", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'expired-user',
      email: 'nani@tejasc.in',
      exp: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
    })).toString('base64url');
    const expiredToken = `${header}.${payload}.fake-signature`;

    const verifyRes = await verifyFirebaseIdToken(expiredToken);
    assert.strictEqual(verifyRes.valid, false);
    assert.ok(verifyRes.error?.includes("expired"));

    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 4. Token with audience mismatch
  await test("4. Token with foreign audience/project is rejected", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/attacker-foreign-project',
      aud: 'attacker-foreign-project',
      sub: 'attacker-user',
      email: 'nani@tejasc.in',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');
    const foreignToken = `${header}.${payload}.fake-signature`;

    const verifyRes = await verifyFirebaseIdToken(foreignToken);
    assert.strictEqual(verifyRes.valid, false);
    assert.ok(verifyRes.error?.includes("Audience mismatch") || verifyRes.error?.includes("Issuer mismatch"));
  });

  // 5. Token with non-admin email
  await test("5. Valid format token from non-admin user is rejected", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'regular-user',
      email: 'random_customer@gmail.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');
    const nonAdminToken = `${header}.${payload}.fake-signature`;

    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${nonAdminToken}` }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // 6. Header spoofing: x-admin-email alone WITHOUT verified token is REJECTED
  await test("6. Request presenting x-admin-email header without valid token is strictly REJECTED (401)", async () => {
    const resPo = await executeRoute(dispatchPoHandler, {
      headers: { 'x-admin-email': 'nani@tejasc.in' }
    });
    assert.strictEqual(resPo.statusCode, 401, `x-admin-email spoof on dispatch-po must be 401 (got ${resPo.statusCode})`);

    const resWa = await executeRoute(dispatchWaHandler, {
      headers: { 'x-admin-email': 'nani@tejasc.in' }
    });
    assert.strictEqual(resWa.statusCode, 401, `x-admin-email spoof on dispatch-whatsapp must be 401 (got ${resWa.statusCode})`);
  });

  // 7. Request with no auth headers at all
  await test("7. Request with no auth headers returns 401", async () => {
    const res = await executeRoute(dispatchPoHandler, { headers: {} });
    assert.strictEqual(res.statusCode, 401);
  });

  // 8. Server-signed HMAC admin token is ACCEPTED
  await test("8. Valid server-signed HMAC token for Admin is cryptographically ACCEPTED", async () => {
    const adminToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "tejasadinarayan",
      role: "admin",
      name: "Tejas Adinarayan",
      email: "nani@tejasc.in",
    });

    const resPo = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resPo.statusCode, 200, `dispatch-po returns 200 for HMAC admin token (got ${resPo.statusCode})`);
    assert.strictEqual(resPo.body.success, true);

    const resWa = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer ${adminToken}` },
      body: { to: "919945351166" }
    });
    assert.strictEqual(resWa.statusCode, 200, `dispatch-whatsapp returns 200 for HMAC admin token (got ${resWa.statusCode})`);
    assert.strictEqual(resWa.body.success, true);
  });

  // 9. Admin password in request body alone is REJECTED on dispatch endpoints (401), but ACCEPTED on admin config routes
  await test("9. Admin password in request body alone is REJECTED on dispatch endpoints (401), but ACCEPTED on admin config routes", async () => {
    const resPo = await executeRoute(dispatchPoHandler, {
      body: { adminPassword: "adinarayan1977" }
    });
    assert.strictEqual(resPo.statusCode, 401, `dispatch-po must reject body password alone (got ${resPo.statusCode})`);

    const resWa = await executeRoute(dispatchWaHandler, {
      body: { adminPassword: "adinarayan1977", to: "919945351166" }
    });
    assert.strictEqual(resWa.statusCode, 401, `dispatch-whatsapp must reject body password alone (got ${resWa.statusCode})`);

    // Verify admin config route allows password
    const configHandler = findHandler('/api/update-gmail-oauth-credentials');
    if (configHandler) {
      let configStatus = 200;
      const configReq: any = {
        body: { adminPassword: "adinarayan1977", clientId: "c", clientSecret: "s", refreshToken: "r" },
        headers: {}
      };
      const configRes: any = {
        status: (code: number) => { configStatus = code; return configRes; },
        json: () => configRes
      };
      await configHandler(configReq, configRes);
      assert.strictEqual(configStatus, 200, "Administrative config route accepts body password");
    }
  });

  // 10. Both endpoints enforce identical security
  await test("10. Both /api/dispatch-po and /api/dispatch-whatsapp enforce identical 401 protection", async () => {
    const poUnauth = await executeRoute(dispatchPoHandler, { headers: {} });
    const waUnauth = await executeRoute(dispatchWaHandler, { headers: {} });
    assert.strictEqual(poUnauth.statusCode, 401);
    assert.strictEqual(waUnauth.statusCode, 401);
  });

  // 11. Token with unverified email (email_verified: false) is REJECTED
  await test("11. Token with email_verified: false is REJECTED", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'unverified-user',
      email: 'nani@tejasc.in',
      email_verified: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');
    const unverifiedToken = `${header}.${payload}.fake-sig`;

    const verifyRes = await verifyFirebaseIdToken(unverifiedToken);
    assert.strictEqual(verifyRes.valid, false, "Verifier must reject unverified email");
    assert.ok(verifyRes.error?.includes("email is not verified"));
  });

  // 12. Token with MISSING email_verified (omitted/undefined) is strictly REJECTED
  await test("12. Token with MISSING email_verified (omitted/undefined) is strictly REJECTED", async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/tejascanavssingstore',
      aud: 'tejascanavssingstore',
      sub: 'missing-email-verified-user',
      email: 'nani@tejasc.in',
      // email_verified omitted entirely
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })).toString('base64url');
    const missingVerifiedToken = `${header}.${payload}.fake-sig`;

    const verifyRes = await verifyFirebaseIdToken(missingVerifiedToken);
    assert.strictEqual(verifyRes.valid, false, "Verifier must reject missing email_verified");
    assert.ok(verifyRes.error?.includes("email_verified must be strictly true"), `Expected strict email_verified error, got: ${verifyRes.error}`);

    const res = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer ${missingVerifiedToken}` }
    });
    assert.strictEqual(res.statusCode, 401, `dispatch-po returns 401 for token with missing email_verified (got ${res.statusCode})`);
  });

  // 13. Account-status lookup failure fails closed on dispatch endpoints (no bypass allowed)
  await test("13. Account-status lookup failure fails closed on dispatch endpoints (no bypass allowed)", async () => {
    // 13A. Direct verifier with failClosed: true rejects when account status check fails
    const statusResult = await checkFirebaseUserAccountStatus("invalid-id-token-lookup-failure", { failClosed: true });
    assert.strictEqual(statusResult.revoked, true, "checkFirebaseUserAccountStatus with failClosed: true returns revoked: true on failure");
    assert.ok(statusResult.error?.includes("fail-closed"), "Error message specifies fail-closed rejection");

    // 13B. verifyFirebaseIdToken with failClosed: true rejects when account check fails
    const verifyRes = await verifyFirebaseIdToken("invalid-id-token-lookup-failure", undefined, { failClosed: true });
    assert.strictEqual(verifyRes.valid, false, "verifyFirebaseIdToken must reject when account check fails closed");

    // 13C. Dispatch endpoints reject with 401
    const resPo = await executeRoute(dispatchPoHandler, {
      headers: { authorization: `Bearer invalid-id-token-lookup-failure` }
    });
    assert.strictEqual(resPo.statusCode, 401, `dispatch-po returns 401 when account status check cannot be completed`);

    const resWa = await executeRoute(dispatchWaHandler, {
      headers: { authorization: `Bearer invalid-id-token-lookup-failure` }
    });
    assert.strictEqual(resWa.statusCode, 401, `dispatch-whatsapp returns 401 when account status check cannot be completed`);
  });

  // 14. checkFirebaseUserAccountStatus fails closed when API key is missing or invalid
  await test("14. checkFirebaseUserAccountStatus fails closed when API key is missing", async () => {
    const statusRes = await checkFirebaseUserAccountStatus("any-token", { failClosed: true, apiKeyOverride: "" });
    assert.strictEqual(statusRes.revoked, true, "Must fail closed if API key unavailable");
    assert.strictEqual(statusRes.statusUnknown, true, "Status marked as unknown");
    assert.ok(statusRes.error?.includes("fail-closed"), "Error notes fail-closed");
  });

  // 15. Service account parsing & initialization support
  await test("15. Service account parsing handles JSON with escaped newlines and initializes with project tejascanavssingstore", async () => {
    const { cert, initializeApp, deleteApp } = await import('firebase-admin/app');
    const { privateKey } = (crypto as any).generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    
    // Simulate Vercel environment variable with escaped \n characters
    const escapedKey = (privateKey as string).replace(/\n/g, '\\n');
    const serviceAccountObj = {
      project_id: "tejascanavssingstore",
      client_email: "firebase-adminsdk@tejascanavssingstore.iam.gserviceaccount.com",
      private_key: escapedKey,
    };
    const jsonString = JSON.stringify(serviceAccountObj);
    const parsed = JSON.parse(jsonString);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    const testApp = initializeApp({ credential: cert(parsed), projectId: parsed.project_id }, 'unit-test-sa-app');
    assert.strictEqual(testApp.options.projectId, 'tejascanavssingstore', 'Project ID must match tejascanavssingstore');
    await deleteApp(testApp);
  });

  // 16. Missing or invalid service account fails securely
  await test("16. Missing or invalid service account credentials fail securely", async () => {
    const { cert } = await import('firebase-admin/app');
    let threw = false;
    try {
      cert({ project_id: 'bad', client_email: 'bad@bad.com', private_key: 'not-a-valid-key' } as any);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, 'Invalid private key format must throw and be handled securely');
  });

  console.log(`\n=== SECURITY TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runSecurityTests().catch((err) => {
  console.error("Security tests crashed:", err);
  process.exitCode = 1;
});
