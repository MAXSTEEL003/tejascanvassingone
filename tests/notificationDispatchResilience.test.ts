process.env.NODE_ENV = 'test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { DEFAULT_FIREBASE_API_KEY, checkFirebaseUserAccountStatus } from '../api/firebaseTokenVerifier';
import { generatePoPdfBase64, buildPoPdfDocument } from '../src/utils/poPdfGenerator';
import { createSignedToken, verifySignedToken, verifyAdminRequest, hashPassword, verifyPassword } from '../api/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runResilienceTests() {
  console.log("=== TEJAS CANVASSING: NOTIFICATION DISPATCH RESILIENCE & AUTH TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // TEST 1: DEFAULT_FIREBASE_API_KEY fallback is present and non-empty
  assert(typeof DEFAULT_FIREBASE_API_KEY === 'string' && DEFAULT_FIREBASE_API_KEY.length > 20, 
    `DEFAULT_FIREBASE_API_KEY is configured with valid length (${DEFAULT_FIREBASE_API_KEY.length} chars)`);
  assert(DEFAULT_FIREBASE_API_KEY.startsWith('AIzaSy'), 
    "DEFAULT_FIREBASE_API_KEY matches standard Google Cloud API key format");

  // TEST 2: checkFirebaseUserAccountStatus does not reject for missing API key when env is unset
  const originalEnvKey = process.env.FIREBASE_API_KEY;
  const originalViteKey = process.env.VITE_FIREBASE_API_KEY;
  delete process.env.FIREBASE_API_KEY;
  delete process.env.VITE_FIREBASE_API_KEY;

  try {
    const statusResult = await checkFirebaseUserAccountStatus('invalid-dummy-token', { failClosed: true });
    assert(!statusResult.error?.includes('Firebase API key not configured'), 
      "checkFirebaseUserAccountStatus uses DEFAULT_FIREBASE_API_KEY fallback and does not fail with 'Firebase API key not configured'");
  } finally {
    if (originalEnvKey) process.env.FIREBASE_API_KEY = originalEnvKey;
    if (originalViteKey) process.env.VITE_FIREBASE_API_KEY = originalViteKey;
  }

  // TEST 3: PDF Generation Stream Compression (< 200 KB instead of 2.3 MB)
  const mockOrder = {
    id: 'TC-9PYCSW',
    date: '2026-11-25',
    supplier: 'BHAGWATHI RICE MILLS',
    buyer: 'UPLETA TRADERS',
    product: 'KESHAR KALI',
    qty: 100,
    rate: 8500,
    loadingDays: 0,
    remarks: 'Urgent Dispatch Test'
  };

  const pdfBase64 = generatePoPdfBase64(mockOrder, [mockOrder]);
  assert(typeof pdfBase64 === 'string' && pdfBase64.length > 0, "generatePoPdfBase64 produces valid string");
  
  const pdfBytes = Buffer.from(pdfBase64, 'base64');
  assert(pdfBytes.length < 250 * 1024, 
    `PDF document size is compressed and lightweight (${(pdfBytes.length / 1024).toFixed(1)} KB < 250 KB; previously 2.3 MB)`);
  assert(pdfBytes.toString('ascii', 0, 5) === '%PDF-', 
    "PDF begins with standard '%PDF-' magic bytes");

  // TEST 4: poEmailClient.ts does NOT set keepalive: true (prevents 64 KiB browser abort)
  const emailClientSrc = fs.readFileSync(path.join(__dirname, '../src/services/poEmailClient.ts'), 'utf8');
  assert(!emailClientSrc.includes('keepalive: true'), 
    "poEmailClient.ts does NOT contain 'keepalive: true' (enables payloads > 64 KiB without browser abort)");
  assert(emailClientSrc.includes("fetch('/api/dispatch-po"), 
    "poEmailClient.ts dispatches to /api/dispatch-po");

  // TEST 5: whatsapp.ts does NOT set keepalive: true
  const whatsappSrc = fs.readFileSync(path.join(__dirname, '../src/lib/whatsapp.ts'), 'utf8');
  assert(!whatsappSrc.includes('keepalive: true'), 
    "whatsapp.ts does NOT contain 'keepalive: true'");

  // TEST 6: HMAC Admin session token generation & verification
  const testAdminToken = createSignedToken({
    sub: 'admin-tejas-01',
    username: 'admintejas1679',
    role: 'admin',
    email: 'nani@tejasc.in',
    name: 'Tejas Adinarayan (Admin)'
  });

  const verifiedPayload = verifySignedToken(testAdminToken);
  assert(Boolean(verifiedPayload && verifiedPayload.role === 'admin'), 
    "verifySignedToken successfully validates server-signed admin token");
  assert(verifiedPayload?.username === 'admintejas1679', 
    "Verified token username matches admintejas1679");

  // TEST 7: verifyAdminRequest accepts server-signed admin token with failClosed: true
  const mockReq = {
    headers: {
      authorization: `Bearer ${testAdminToken}`,
      'x-admin-email': 'nani@tejasc.in'
    },
    body: {}
  } as any;

  const isReqAuthorized = await verifyAdminRequest(mockReq, { disallowBodyPassword: true, failClosed: true });
  assert(isReqAuthorized === true, 
    "verifyAdminRequest authorizes server-signed admin token under strict failClosed: true and disallowBodyPassword: true");

  // TEST 8: verifyAdminRequest rejects mock client-only tokens
  const mockClientToken = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.c2lnX2FkbWluXzE3OTU2MTY4NDk';
  const mockReqWithClientToken = {
    headers: {
      authorization: `Bearer ${mockClientToken}`,
      'x-admin-email': 'nani@tejasc.in'
    },
    body: {}
  } as any;

  const isClientTokenRejected = await verifyAdminRequest(mockReqWithClientToken, { disallowBodyPassword: true, failClosed: true });
  assert(isClientTokenRejected === false, 
    "verifyAdminRequest strictly rejects client-generated mock tokens (fail-closed)");

  // TEST 9: Order TC-9PYCSW can generate clean PDF with official logo embedded
  const tc9Doc = buildPoPdfDocument({
    id: 'TC-9PYCSW',
    date: '25 November 2026',
    supplier: 'BHAGWATHI RICE MILLS',
    buyer: 'UPLETA TRADERS',
    product: 'KESHAR KALI',
    qty: 100,
    rate: 8500
  });
  const tc9PdfString = Buffer.from(tc9Doc.output('arraybuffer')).toString('binary');
  assert(tc9PdfString.includes('/Subtype /Image'), 
    "Order TC-9PYCSW generated PDF embeds the official company logo (/Subtype /Image)");
  assert(tc9PdfString.length > 1000 && tc9PdfString.length < 250000, 
    `Order TC-9PYCSW PDF size is optimal (${(tc9PdfString.length / 1024).toFixed(1)} KB)`);

  // TEST 10: PBKDF2 Password Verification & Security
  const testSalt = "test_salt_123456";
  const correctPass = "SecureAdminPass2026!";
  const wrongPass = "WrongPassword!";
  const { hash: hashedExpected } = hashPassword(correctPass, testSalt);

  assert(verifyPassword(correctPass, hashedExpected, testSalt) === true, 
    "verifyPassword successfully verifies matching password using PBKDF2");
  assert(verifyPassword(wrongPass, hashedExpected, testSalt) === false, 
    "verifyPassword strictly rejects incorrect password");
  assert(verifyPassword("tejas1679", hashedExpected, testSalt) === false, 
    "verifyPassword rejects unconfigured plaintext passwords");

  // TEST 11: Expired Server-Signed Token Rejection
  const expiredToken = createSignedToken({
    sub: 'admin-tejas-01',
    username: 'admintejas1679',
    role: 'admin',
    email: 'nani@tejasc.in',
    name: 'Tejas Adinarayan (Admin)'
  }, -3600); // Expired 1 hour ago

  assert(verifySignedToken(expiredToken) === null, 
    "verifySignedToken returns null for expired token");
  const expiredReq = {
    headers: { authorization: `Bearer ${expiredToken}` },
    body: {}
  } as any;
  assert(await verifyAdminRequest(expiredReq, { disallowBodyPassword: true, failClosed: true }) === false, 
    "verifyAdminRequest rejects expired session token (fail-closed)");

  // TEST 12: Tampered Token Signature Rejection
  const parts = testAdminToken.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
    username: 'attacker'
  })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert(verifySignedToken(tamperedToken) === null, 
    "verifySignedToken rejects token with tampered payload (signature mismatch)");

  // TEST 13: Non-Admin Role in Signed Token Rejection
  const merchantToken = createSignedToken({
    sub: 'merchant-01',
    username: 'merchant_user',
    role: 'merchant' as any,
    email: 'merchant@example.com',
    name: 'Sample Merchant'
  });
  const merchantReq = {
    headers: { authorization: `Bearer ${merchantToken}` },
    body: {}
  } as any;
  assert(await verifyAdminRequest(merchantReq, { disallowBodyPassword: true, failClosed: true }) === false, 
    "verifyAdminRequest strictly rejects non-admin role tokens for administrative dispatch");

  // TEST 14: Header-only Impersonation (x-admin-email without token) Rejection
  const spoofReq = {
    headers: {
      'x-admin-email': 'nani@tejasc.in'
    },
    body: {}
  } as any;
  assert(await verifyAdminRequest(spoofReq, { disallowBodyPassword: true, failClosed: true }) === false, 
    "verifyAdminRequest strictly rejects spoofed x-admin-email header without cryptographically verified token");

  // TEST 15: No Admin Passwords Hardcoded in api/index.ts
  const apiIndexSrc = fs.readFileSync(path.join(__dirname, '../api/index.ts'), 'utf8');
  assert(!apiIndexSrc.includes('"tejas1679"'), 
    "api/index.ts does NOT contain hardcoded 'tejas1679'");
  assert(!apiIndexSrc.includes('cleanPass === DEFAULT_ADMIN_PASS'), 
    "api/index.ts does NOT use plaintext equality check (cleanPass === DEFAULT_ADMIN_PASS)");

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runResilienceTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
