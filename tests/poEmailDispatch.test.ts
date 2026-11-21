process.env.NODE_ENV = 'test';
import { resolveSupplierProfile, isAuthenticSupplierEmail } from '../src/utils/poEmailTemplate';
import { getTrackingRecord, isOrderAlreadySent } from '../api/poEmailTrackingStore';

async function runTests() {
  console.log("--- Starting PO Email & Supplier Resolution Tests ---");
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

  // Test 1: Bhagwathi Rice and Agro Industries resolution
  const bhagwathi1 = resolveSupplierProfile("Bhagwathi Rice and Agro Industries");
  assert(bhagwathi1.isConfigured === true, "Bhagwathi Rice and Agro Industries isConfigured is true");
  assert(bhagwathi1.email === "bhagwatirice@gmail.com", `Bhagwathi email is ${bhagwathi1.email}`);
  assert(isAuthenticSupplierEmail(bhagwathi1.email), "Bhagwathi email passes authentic check");

  // Test 2: Bhagwati spelling variation
  const bhagwati2 = resolveSupplierProfile("BHAGWATI RICE AND AGRO INDUSTRIES");
  assert(bhagwati2.email === "bhagwatirice@gmail.com", "BHAGWATI spelling matches bhagwatirice@gmail.com");

  // Test 3: Bhagwathi Rice Mills
  const bhagwathiMills = resolveSupplierProfile("Bhagwathi Rice Mills");
  assert(bhagwathiMills.email === "bhagwatirice@gmail.com", "Bhagwathi Rice Mills matches bhagwatirice@gmail.com");

  // Test 4: Mahendra Rice Industry (previously empty!)
  const mahendra = resolveSupplierProfile("MAHENDRA RICE INDUSTRY");
  assert(mahendra.isConfigured === true, "Mahendra Rice is configured");
  assert(mahendra.email === "mahendrarice@gmail.com", `Mahendra email is ${mahendra.email}`);

  // Test 5: Thirumala Industries (previously empty!)
  const thirumala = resolveSupplierProfile("THIRUMALA INDUSTRIES");
  assert(thirumala.isConfigured === true, "Thirumala is configured");
  assert(thirumala.email === "thirumalaindustries@gmail.com", `Thirumala email is ${thirumala.email}`);

  // Test 6: Sai Teja Parboiled Rice Mills
  const saiteja = resolveSupplierProfile("SAI TEJA PARBOILED RICE MILLS (P) LTD");
  assert(saiteja.isConfigured === true, "Sai Teja is configured");
  assert(saiteja.email === "saitejapbrm@gmail.com", `Sai Teja email is ${saiteja.email}`);

  // Test 7: Direct Mill fallback
  const directMill = resolveSupplierProfile("Direct Mill");
  assert(directMill.isConfigured === true, "Direct Mill fallback is configured");
  assert(directMill.email.length > 0, `Direct Mill has valid email: ${directMill.email}`);

  // Test 8: End-to-End simulation of /api/dispatch-po
  const testOrderId = `TEST-PO-${Date.now()}`;
  const mockReqBody = {
    to: bhagwathi1.email,
    supplierName: "Bhagwathi Rice and Agro Industries",
    subject: `Test PO ${testOrderId}`,
    htmlContent: `<p>Test PO Html</p>`,
    textContent: `Test PO Text`,
    poNumber: testOrderId,
    orderId: testOrderId,
  };

  // Dynamically import the express app to test endpoint in-process
  const { default: app } = await import('../api/index');

  // Create a mock express request & response
  let responseStatusCode = 0;
  let responseBody: any = null;

  const mockReq: any = {
    body: mockReqBody,
    get: (header: string) => (header === 'host' ? 'localhost:3000' : ''),
    protocol: 'http',
    headers: {},
  };

  const mockRes: any = {
    status: (code: number) => {
      responseStatusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      responseBody = data;
      return mockRes;
    },
  };

  // Find the dispatch-po route handler
  const router = (app as any)._router;
  const dispatchLayer = router.stack.find((layer: any) => {
    return layer.route && layer.route.path && (
      (Array.isArray(layer.route.path) && layer.route.path.includes('/api/dispatch-po')) ||
      layer.route.path === '/api/dispatch-po'
    );
  });

  assert(Boolean(dispatchLayer), "Found /api/dispatch-po handler in express stack");

  if (dispatchLayer) {
    await dispatchLayer.route.stack[0].handle(mockReq, mockRes);

    assert(responseStatusCode === 200, `dispatch-po returns HTTP 200 (Got: ${responseStatusCode})`);
    assert(responseBody?.success === true, "dispatch-po returns success: true");
    assert(responseBody?.status === "Sent", `dispatch-po returns status: 'Sent' (Got: ${responseBody?.status})`);
    assert(responseBody?.isLiveSent === true, "dispatch-po returns isLiveSent: true");

    const trackingRecord = getTrackingRecord(testOrderId);
    assert(Boolean(trackingRecord), "Tracking record is created for PO");
    assert(trackingRecord?.status === "Sent", `Tracking record status is 'Sent' (Got: ${trackingRecord?.status})`);
    assert(Boolean(trackingRecord?.sentAt), `Tracking record sentAt is set: ${trackingRecord?.sentAt}`);
    assert(isOrderAlreadySent(testOrderId) === true, "isOrderAlreadySent returns true for sent order");
  }

  console.log(`\n--- Test Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
