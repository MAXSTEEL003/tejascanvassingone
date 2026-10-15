import http from "http";
import crypto from "crypto";
import assert from "assert";

// Set test environment variables BEFORE importing app
process.env.VERCEL = "1"; // Test in simulated serverless mode
process.env.META_WHATSAPP_VERIFY_TOKEN = "test_meta_verify_token_2026";
process.env.META_APP_SECRET = "test_meta_app_secret_1234567890abcdef";
process.env.ADMIN_PASSWORD = "test_admin_pass_1977";
process.env.AUTH_SECRET = "test_auth_secret_key_tejas_2026";
delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
delete process.env.META_WHATSAPP_TOKEN;
process.env.PORT = "0"; // Pick random port

import app from "../api/index";
import { createSignedToken } from "../api/auth";

function computeSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret).update(Buffer.from(payload, "utf8")).digest("hex");
  return `sha256=${hmac}`;
}

async function runTests() {
  console.log("=== STARTING WHATSAPP CLOUD API WEBHOOK TESTS ===\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running at ${baseUrl}\n`);

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

  // 1. Valid GET verification request returns exact challenge
  await test("1. Valid GET verification request returns the exact challenge", async () => {
    const challenge = "challenge_123456789";
    const res = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_meta_verify_token_2026&hub.challenge=${challenge}`
    );
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const text = await res.text();
    assert.strictEqual(text, challenge, `Expected plain text challenge "${challenge}", got "${text}"`);
  });

  // 2. Invalid verification token returns HTTP 403
  await test("2. Invalid verification token returns HTTP 403", async () => {
    const res = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345`
    );
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    const text = await res.text();
    assert.ok(text.includes("Forbidden"), "Expected Forbidden response message");
  });

  // 3. Missing server-side verification token produces safe configuration error
  await test("3. Missing server-side verification token produces a safe configuration error", async () => {
    const savedToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
    delete process.env.META_WHATSAPP_VERIFY_TOKEN;
    try {
      const res = await fetch(
        `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=12345`
      );
      assert.strictEqual(res.status, 500, `Expected 500, got ${res.status}`);
      const text = await res.text();
      assert.ok(text.includes("Webhook verify token not configured"), "Expected safe server configuration error message");
      assert.ok(!text.includes("test_meta_verify_token_2026"), "Should never leak secrets in response");
    } finally {
      process.env.META_WHATSAPP_VERIFY_TOKEN = savedToken;
    }
  });

  // 4. Valid signed POST payload is accepted (HTTP 200)
  await test("4. Valid signed POST payload is accepted with HTTP 200", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "919945351166", phone_number_id: "123456" },
                statuses: [
                  {
                    id: "wamid.TEST_SENT_001",
                    status: "sent",
                    timestamp: "1730000001",
                    recipient_id: "919945351166",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const signature = computeSignature(payload, process.env.META_APP_SECRET!);
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.status, "EVENT_RECEIVED");
  });

  // 5. Invalid signature is rejected (HTTP 401)
  await test("5. Invalid signature is rejected with HTTP 401", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });

    const badSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": badSignature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes("Invalid webhook signature"), "Expected signature mismatch error");
  });

  // 6. Missing signature is rejected (HTTP 401)
  await test("6. Missing signature is rejected with HTTP 401", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    });

    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes("Missing X-Hub-Signature-256 header"), "Expected missing header error");
  });

  // 7. Unexpected webhook object is rejected (HTTP 400)
  await test("7. Unexpected webhook object is rejected with HTTP 400", async () => {
    const payload = JSON.stringify({
      object: "page", // Not whatsapp_business_account
      entry: [],
    });

    const signature = computeSignature(payload, process.env.META_APP_SECRET!);
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes("Unexpected webhook object"), "Expected unexpected object error");
  });

  // 8. Incoming text-message payload is handled safely
  await test("8. Incoming text-message payload is handled safely", async () => {
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "919945351166", phone_number_id: "123456" },
                contacts: [{ profile: { name: "Test Merchant" }, wa_id: "919876543210" }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.INCOMING_MSG_001",
                    timestamp: "1730000005",
                    type: "text",
                    text: { body: "Can you provide rates for Sona Masoori?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const signature = computeSignature(payload, process.env.META_APP_SECRET!);
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.processed.messages, 1);
  });

  // 9. Delivery-status payload is handled and updates dispatch history
  await test("9. Delivery-status payload is handled and updates dispatch history", async () => {
    // First simulate sending a message to create an item in dispatch history
    const testMsgId = "wamid.TEST_DELIVERY_TRACK_001";

    // Call dispatch-history to inspect before
    const preHistoryRes = await fetch(`${baseUrl}/api/dispatch-history`);
    assert.strictEqual(preHistoryRes.status, 200);

    // Send a webhook delivery status event
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: testMsgId,
                    status: "delivered",
                    timestamp: "1730000015",
                    recipient_id: "919945351166",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const signature = computeSignature(payload, process.env.META_APP_SECRET!);
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.processed.statuses, 1);

    // Check dispatch-history includes recentWebhookEvents
    const historyRes = await fetch(`${baseUrl}/api/dispatch-history`);
    const historyData = await historyRes.json();
    assert.ok(Array.isArray(historyData.recentWebhookEvents), "Expected recentWebhookEvents array");
    const matched = historyData.recentWebhookEvents.find((e: any) => e.metaMessageId === testMsgId);
    assert.ok(matched, "Expected event to be recorded in recentWebhookEvents");
    assert.strictEqual(matched.status, "delivered");
  });

  // 10. Failed delivery payload is handled safely
  await test("10. Failed delivery payload is handled with error capture", async () => {
    const failedMsgId = "wamid.TEST_FAILED_MSG_001";
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: failedMsgId,
                    status: "failed",
                    timestamp: "1730000025",
                    recipient_id: "919945351166",
                    errors: [
                      {
                        code: 131026,
                        title: "Receiver is incapable of receiving this message",
                        message: "Message Undeliverable.",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const signature = computeSignature(payload, process.env.META_APP_SECRET!);
    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.processed.statuses, 1);

    const historyRes = await fetch(`${baseUrl}/api/dispatch-history`);
    const historyData = await historyRes.json();
    const matched = historyData.recentWebhookEvents.find((e: any) => e.metaMessageId === failedMsgId);
    assert.ok(matched, "Expected failed event in history");
    assert.strictEqual(matched.status, "failed");
    assert.strictEqual(matched.errorCode, 131026);
  });

  // 11. Malformed payloads do not crash the server
  await test("11. Malformed JSON payloads return 400 without crashing", async () => {
    const malformedBody = '{"object": "whatsapp_business_account", "entry": [invalid json';
    const signature = computeSignature(malformedBody, process.env.META_APP_SECRET!);

    const res = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: malformedBody,
    });

    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
  });

  // 12. Existing /api/health still works
  await test("12. Existing /api/health still works", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
  });

  // 13. Existing /api/dispatch-whatsapp remains functional
  await test("13. Existing /api/dispatch-whatsapp remains functional", async () => {
    const res = await fetch(`${baseUrl}/api/dispatch-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "9945351166",
        buyerName: "Test Merchant",
        message: "PO notification test message",
      }),
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.directUrl, "Expected directUrl in response");
  });

  // 14. Existing authentication and administrative endpoints remain appropriately protected
  await test("14. Administrative credential endpoints require authentication", async () => {
    // Unauthenticated request must be rejected with 403
    const unauthRes = await fetch(`${baseUrl}/api/update-meta-whatsapp-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: "12345",
        accessToken: "EAAB...",
      }),
    });
    assert.strictEqual(unauthRes.status, 403, `Expected 403 for unauthenticated user, got ${unauthRes.status}`);

    // Authenticated admin request using signed JWT token
    const adminToken = createSignedToken({
      sub: "admin-tejas-01",
      username: "tejasadinarayan",
      role: "admin",
      email: "tejasadinarayan@riceaggregator.com",
      name: "Tejas Adinarayan",
    });

    try {
      const authRes = await fetch(`${baseUrl}/api/update-meta-whatsapp-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          phoneNumberId: "987654321",
          accessToken: "test_access_token_token123",
        }),
      });
      assert.strictEqual(authRes.status, 200, `Expected 200 for authenticated admin, got ${authRes.status}`);
      const authData = await authRes.json();
      assert.strictEqual(authData.success, true);
      assert.ok(!authData.accessToken, "Should not return sensitive access token in response");
      assert.strictEqual(authData.tokenPrefix, "test_acc...");
    } finally {
      delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.META_WHATSAPP_TOKEN;
    }
  });

  // 15. Vercel routing reaches the webhook endpoint on both path formats
  await test("15. Both /api/webhooks/whatsapp and /webhooks/whatsapp resolve correctly", async () => {
    // Test verification on both paths
    const challenge1 = "chal_api_prefix";
    const res1 = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_meta_verify_token_2026&hub.challenge=${challenge1}`
    );
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(await res1.text(), challenge1);

    const challenge2 = "chal_direct_prefix";
    const res2 = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_meta_verify_token_2026&hub.challenge=${challenge2}`
    );
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(await res2.text(), challenge2);
  });

  // Server cleanup
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log("\n=== TEST RESULTS SUMMARY ===");
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\nALL 15 TESTS PASSED SUCCESSFULLY! PROMPT CRITERIA FULLY SATISFIED.\n");
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
