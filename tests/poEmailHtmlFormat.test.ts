process.env.NODE_ENV = 'test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSupplierPOEmailHtml, TC_OFFICIAL_LOGO_URL } from '../src/utils/poEmailTemplate';
import { buildPoPdfDocument, getPoPdfFileName, generatePoPdfBase64 } from '../src/utils/poPdfGenerator';
import { buildMimeMessage } from '../api/gmailOAuthService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("=== TEJAS CANVASSING: RESTORE ORIGINAL PO EMAIL HTML FORMAT REGRESSION TESTS ===");
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

  const mockOrder = {
    id: 'TC-9PYCSW',
    poNumber: 'TC-9PYCSW',
    date: '2026-11-25',
    supplier: 'BHAGWATHI RICE MILLS',
    buyer: 'UPLETA TRADERS',
    product: 'KESHAR KALI STEAM RICE',
    qty: 120,
    rate: 8450,
    loadingDays: 2,
    unloadingPoint: 'shop',
    remarks: 'Deliver to main warehouse platform'
  };

  const mockSubOrders = [
    {
      id: 'TC-9PYCSW-SUB-1',
      supplierSubOrderNo: 'SUB-901',
      date: '2026-11-25',
      buyer: 'UPLETA TRADERS',
      product: 'KESHAR KALI STEAM RICE',
      qty: 120,
      rate: 8450,
      loadingDays: 2,
      unloadingPoint: 'shop',
      remarks: 'Deliver to main warehouse platform'
    }
  ];

  // 1. Verify complete PO HTML formatting in generateSupplierPOEmailHtml
  const emailHtml = generateSupplierPOEmailHtml(mockOrder.supplier, mockOrder, mockSubOrders);

  assert(emailHtml.includes('Tejas Canvassing'), "HTML email contains company header 'Tejas Canvassing'");
  assert(emailHtml.includes('Bangalore'), "HTML email contains company location 'Bangalore'");
  assert(emailHtml.includes(TC_OFFICIAL_LOGO_URL), `HTML email references official HTTPS logo: ${TC_OFFICIAL_LOGO_URL}`);
  assert(emailHtml.includes('https://www.tejascanvassing.com/logo.png'), "HTML email uses https://www.tejascanvassing.com/logo.png directly");
  assert(emailHtml.includes('PURCHASE ORDER'), "HTML email contains 'PURCHASE ORDER' header");
  assert(emailHtml.includes('Grouped PO: TC-9PYCSW'), "HTML email contains Grouped PO number");
  assert(emailHtml.includes('BHAGWATHI RICE MILLS'), "HTML email contains supplier salutation 'Dear BHAGWATHI RICE MILLS,'");
  assert(emailHtml.includes("Today's orders:"), "HTML email contains 'Today's orders:' section");

  // Table columns and data
  assert(emailHtml.includes('Date</th>'), "HTML email table includes Date column");
  assert(emailHtml.includes('Buyer</th>'), "HTML email table includes Buyer column");
  assert(emailHtml.includes('Product</th>'), "HTML email table includes Product column");
  assert(emailHtml.includes('Qty<br/>(quintals)</th>'), "HTML email table includes Qty (quintals) column");
  assert(emailHtml.includes('Rate<br/>(per<br/>qtl.)</th>'), "HTML email table includes Rate (per qtl.) column");
  assert(emailHtml.includes('Details</th>'), "HTML email table includes Details column");

  // Row content
  assert(emailHtml.includes('UPLETA TRADERS'), "HTML email includes buyer name in row");
  assert(emailHtml.includes('29AAFFU0240D2ZI'), "HTML email includes buyer GSTIN in row");
  assert(emailHtml.includes('9972786170'), "HTML email includes buyer phone in row");
  assert(emailHtml.includes('KESHAR<BR/>KALI<BR/>STEAM<BR/>RICE') || emailHtml.includes('KESHAR<br/>KALI<br/>STEAM<br/>RICE'), "HTML email includes formatted product name");
  assert(emailHtml.includes('120'), "HTML email includes quantity");
  assert(emailHtml.includes('8450'), "HTML email includes rate");
  assert(emailHtml.includes('No of days for loading:') || emailHtml.includes('Loading Days:'), "HTML email includes loading days");
  assert(emailHtml.includes('Unloading Point:'), "HTML email includes unloading point");
  assert(emailHtml.includes('Deliver to main warehouse platform'), "HTML email includes order remarks");

  // 2. Client dispatch client (poEmailClient.ts) inspection
  const emailClientSrc = fs.readFileSync(path.join(__dirname, '../src/services/poEmailClient.ts'), 'utf8');

  assert(!emailClientSrc.includes('generatePoPdfBase64'), 
    "poEmailClient.ts does NOT import or execute generatePoPdfBase64");
  assert(!emailClientSrc.includes('pdfBase64'), 
    "poEmailClient.ts does NOT serialize or send pdfBase64");
  assert(!emailClientSrc.includes('pdfFilename'), 
    "poEmailClient.ts does NOT serialize or send pdfFilename");
  assert(!emailClientSrc.includes('keepalive: true'), 
    "poEmailClient.ts does NOT contain keepalive: true");

  // 3. Backend dispatch route (api/index.ts) inspection
  const apiIndexSrc = fs.readFileSync(path.join(__dirname, '../api/index.ts'), 'utf8');

  assert(!apiIndexSrc.includes('generatePoPdfBase64(orderForPdf'), 
    "api/index.ts does NOT generate fallback PO PDFs during /api/dispatch-po");
  assert(!apiIndexSrc.includes('generatePoPdfBase64(orderForPdf, subOrdersForPdf)'), 
    "api/index.ts does NOT generate fallback PO PDFs during /api/po-tracking/:orderId/retry");
  assert(!apiIndexSrc.includes('application/pdf'), 
    "api/index.ts does NOT attach application/pdf content type to emails");

  // 4. Build MIME message for direct HTML PO email
  const mime = buildMimeMessage({
    to: 'supplier@example.com',
    cc: 'nani@tejasc.in',
    subject: 'Official Purchase Order TC-9PYCSW',
    htmlContent: emailHtml,
    textContent: "Today's orders:\nOfficial Purchase Order for BHAGWATHI RICE MILLS.",
  });

  assert(mime.includes('Content-Type: multipart/alternative'), 
    "MIME message is formatted as multipart/alternative for direct in-body rendering");
  assert(!mime.includes('Content-Type: multipart/mixed'), 
    "MIME message does NOT contain multipart/mixed header");
  assert(!mime.includes('Content-Type: application/pdf'), 
    "MIME message does NOT contain application/pdf part");
  assert(!mime.includes('Content-Disposition: attachment'), 
    "MIME message does NOT contain attachment disposition");
  assert(!mime.includes('tejascanvassing@gmail.com'), 
    "MIME message does NOT contain tejascanvassing@gmail.com");
  assert(!mime.includes('tejasadinarayan@gmail.com'), 
    "MIME message does NOT contain tejasadinarayan@gmail.com");
  assert(mime.includes('To: supplier@example.com'), 
    "MIME message recipient is intended supplier");
  assert(mime.includes('https://www.tejascanvassing.com/logo.png'), 
    "MIME HTML body contains official HTTPS logo link");
  assert(mime.includes('Grouped PO: TC-9PYCSW'), 
    "MIME HTML body contains complete Purchase Order details");

  // 5. Backend End-to-End Simulation via /api/dispatch-po
  const { default: app } = await import('../api/index');
  const router = (app as any)._router;
  const dispatchLayer = router.stack.find((layer: any) => {
    return layer.route && layer.route.path && (
      (Array.isArray(layer.route.path) && layer.route.path.includes('/api/dispatch-po')) ||
      layer.route.path === '/api/dispatch-po'
    );
  });
  assert(Boolean(dispatchLayer), "Found /api/dispatch-po handler in express router");

  let testStatusCode = 0;
  let testResponseBody: any = null;

  const testPoId = `TEST-PO-HTML-${Date.now()}`;
  const authReq: any = {
    body: {
      to: 'bhagwatirice@gmail.com',
      supplierName: 'BHAGWATHI RICE MILLS',
      subject: `Official Purchase Order ${testPoId}`,
      htmlContent: emailHtml,
      textContent: `Official PO text`,
      poNumber: testPoId,
      orderId: testPoId,
      orderDetails: { ...mockOrder, id: testPoId, poNumber: testPoId },
      cc: 'tejasadinarayan@gmail.com, tejascanvassing@gmail.com, nani@tejasc.in',
    },
    get: (header: string) => (header === 'host' ? 'localhost:3000' : ''),
    protocol: 'http',
    headers: {
      authorization: 'Bearer test-admin-token',
      'x-admin-email': 'nani@tejasc.in',
    },
  };

  const mockRes: any = {
    status: (code: number) => {
      testStatusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      testResponseBody = data;
      return mockRes;
    },
  };

  await dispatchLayer.route.stack[0].handle(authReq, mockRes);
  assert(testStatusCode === 200, `/api/dispatch-po returns HTTP 200 (Got: ${testStatusCode})`);
  assert(testResponseBody?.success === true, "dispatch-po returns success: true");
  assert(testResponseBody?.status === 'Sent', "dispatch-po returns status: 'Sent'");

  // 6. Confirm Website PDF generation and download remains fully functional
  const webPdfDoc = buildPoPdfDocument(mockOrder, mockSubOrders);
  assert(Boolean(webPdfDoc), "Website PDF generator (buildPoPdfDocument) executes successfully for web downloads");
  const webPdfFilename = getPoPdfFileName(mockOrder);
  assert(webPdfFilename === 'PO_TC-9PYCSW_Tejas_Canvassing.pdf', 
    `getPoPdfFileName returns expected filename: ${webPdfFilename}`);
  const webPdfBase64 = generatePoPdfBase64(mockOrder, mockSubOrders);
  assert(webPdfBase64.length > 50000, 
    `generatePoPdfBase64 generates full PDF document for web users (${webPdfBase64.length} chars)`);

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
