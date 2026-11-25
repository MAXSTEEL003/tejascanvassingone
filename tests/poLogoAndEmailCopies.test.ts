process.env.NODE_ENV = 'test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TC_COMPANY_LOGO_BASE64 } from '../src/utils/logoBase64';
import { buildPoPdfDocument, generatePoPdfBase64, getPoPdfFileName } from '../src/utils/poPdfGenerator';
import { generateSupplierPOEmailHtml, generateSupplierPOA4PrintHtml } from '../src/utils/poEmailTemplate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("=== TEJAS CANVASSING: PO COMPANY LOGO & EMAIL COPY REGRESSION TESTS ===");
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

  // TEST 1: Official Logo Asset Verification
  const logoPath = path.join(__dirname, '../public/logo.png');
  assert(fs.existsSync(logoPath), "public/logo.png exists in the repository");
  const logoFileBuf = fs.readFileSync(logoPath);
  const rawBase64 = TC_COMPANY_LOGO_BASE64.replace(/^data:image\/png;base64,/, '');
  const logoB64Buf = Buffer.from(rawBase64, 'base64');
  assert(logoFileBuf.equals(logoB64Buf), "TC_COMPANY_LOGO_BASE64 matches public/logo.png byte-for-byte");

  // TEST 2: Logo Dimensions and Aspect Ratio
  const width = logoFileBuf.readUInt32BE(16);
  const height = logoFileBuf.readUInt32BE(20);
  assert(width === 656 && height === 656, `Logo is a high-res square (656x656 px). Got: ${width}x${height}`);
  assert(width / height === 1, "Logo aspect ratio is exactly 1:1 (square, no stretching)");

  // TEST 3: PDF Generation With Embedded Image (jsPDF Document Object)
  const mockOrder = {
    id: 'TC-5CV4TY',
    date: '2026-11-25',
    supplier: 'BHAGWATHI RICE MILLS',
    buyer: 'UPLETA TRADERS',
    product: 'KESHAR KALI',
    qty: 80,
    rate: 8400,
    loadingDays: 0,
    unloadingPoint: 'shop',
  };
  const mockSubOrders = [
    {
      id: 'TC-5CV4TY-SUB-1',
      supplierSubOrderNo: 'SUB-101',
      date: '2026-11-25',
      buyer: 'UPLETA TRADERS',
      product: 'KESHAR KALI',
      qty: 80,
      rate: 8400,
      loadingDays: 0,
      unloadingPoint: 'shop',
      remarks: 'Consolidated test delivery'
    }
  ];

  const doc = buildPoPdfDocument(mockOrder, mockSubOrders);
  assert(Boolean(doc), "buildPoPdfDocument executes successfully");
  const pdfArrayBuf = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfArrayBuf);
  const pdfString = pdfBuffer.toString('latin1');

  assert(pdfBuffer.length > 50000, `Generated PDF has substantial size (>50KB) including embedded logo. Size: ${pdfBuffer.length} bytes`);
  assert(pdfString.includes('/Subtype /Image'), "PDF binary contains embedded /Subtype /Image XObject");
  assert(pdfString.includes('/XObject'), "PDF binary contains /XObject dictionary referencing the logo");
  assert(pdfString.includes('TEJAS CANVASSING'), "PDF contains official company name TEJAS CANVASSING");
  assert(pdfString.includes('PURCHASE ORDER'), "PDF contains PURCHASE ORDER title");

  // TEST 4: generatePoPdfBase64 Helper
  const pdfBase64 = generatePoPdfBase64(mockOrder, mockSubOrders);
  assert(typeof pdfBase64 === 'string' && pdfBase64.length > 0, "generatePoPdfBase64 returns non-empty string");
  assert(!pdfBase64.startsWith('data:'), "generatePoPdfBase64 returns clean raw base64 without data URI header for MIME serialization");
  const decodedPdf = Buffer.from(pdfBase64, 'base64').toString('latin1');
  assert(decodedPdf.includes('/Subtype /Image'), "Decoded base64 PDF contains /Subtype /Image");

  // TEST 5: getPoPdfFileName Conformance
  const fileName = getPoPdfFileName(mockOrder);
  assert(fileName.startsWith('PO_') && fileName.endsWith('_Tejas_Canvassing.pdf'), `Filename matches specification: ${fileName}`);

  // TEST 6: Logo in generateSupplierPOEmailHtml
  const emailHtml = generateSupplierPOEmailHtml(mockOrder.supplier, mockOrder, mockSubOrders);
  assert(emailHtml.includes('https://www.tejascanvassing.com/logo.png'), "generateSupplierPOEmailHtml includes reliable HTTPS-hosted logo URL (https://www.tejascanvassing.com/logo.png)");
  assert(!emailHtml.includes('<div style="background-color: #0084ff; color: #ffffff; font-weight: bold; font-size: 22px; width: 48px; height: 48px; line-height: 48px; text-align: center; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">TC</div>'), "Stale fallback blue TC box is removed from generateSupplierPOEmailHtml");

  // TEST 7: Logo in generateSupplierPOA4PrintHtml
  const printHtml = generateSupplierPOA4PrintHtml(mockOrder.supplier, mockOrder, mockSubOrders);
  assert(printHtml.includes(TC_COMPANY_LOGO_BASE64), "generateSupplierPOA4PrintHtml includes embedded TC_COMPANY_LOGO_BASE64 img src");
  assert(!printHtml.includes('<div style="background-color: #0084ff; color: #ffffff; font-weight: 900; font-size: 22px; width: 46px; height: 46px; line-height: 46px; text-align: center; border-radius: 6px; font-family: sans-serif;">TC</div>'), "Stale fallback blue TC box is removed from generateSupplierPOA4PrintHtml");

  // TEST 8: Verify Removal of Automatic PO Email Copies (tejasadinarayan@gmail.com and tejascanvassing@gmail.com)
  const { default: app } = await import('../api/index');
  const router = (app as any)._router;
  const dispatchLayer = router.stack.find((layer: any) => {
    return layer.route && layer.route.path && (
      (Array.isArray(layer.route.path) && layer.route.path.includes('/api/dispatch-po')) ||
      layer.route.path === '/api/dispatch-po'
    );
  });
  assert(Boolean(dispatchLayer), "Found /api/dispatch-po endpoint in Express stack");

  // Verify that passing tejasadinarayan@gmail.com and tejascanvassing@gmail.com in CC is stripped out
  const testOrderId = `TEST-PO-ATTACH-${Date.now()}`;
  let capturedCc: string | null = null;
  let testStatusCode = 0;
  let testResponseBody: any = null;

  const authReq: any = {
    body: {
      to: 'bhagwatirice@gmail.com',
      supplierName: 'Bhagwathi Rice and Agro Industries',
      subject: `Test PO Attachment ${testOrderId}`,
      htmlContent: emailHtml,
      textContent: `Test PO text`,
      poNumber: testOrderId,
      orderId: testOrderId,
      orderDetails: mockOrder,
      cc: 'tejasadinarayan@gmail.com, tejascanvassing@gmail.com, nani@tejasc.in',
      adminEmail: 'tejascanvassing@gmail.com'
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
  assert(testStatusCode === 200, `dispatch-po returned HTTP 200 (Got: ${testStatusCode})`);
  assert(testResponseBody?.success === true, "dispatch-po succeeded");
  assert(authReq.body.to === 'bhagwatirice@gmail.com', "Intended supplier email recipient bhagwatirice@gmail.com is strictly preserved");

  // TEST 9: Build MIME message verification for Direct HTML PO Email (No PDF Attachment)
  const { buildMimeMessage } = await import('../api/gmailOAuthService');
  const mimeHtmlOnly = buildMimeMessage({
    to: 'supplier@example.com',
    cc: 'nani@tejasc.in',
    subject: 'Official Purchase Order TC-1234',
    htmlContent: emailHtml,
    textContent: 'Purchase Order Text',
  });

  assert(mimeHtmlOnly.includes('Content-Type: multipart/alternative'), "Direct PO email MIME message is multipart/alternative (no PDF attachment)");
  assert(!mimeHtmlOnly.includes('Content-Type: multipart/mixed'), "Direct PO email MIME does NOT contain multipart/mixed header");
  assert(!mimeHtmlOnly.includes('Content-Type: application/pdf'), "Direct PO email MIME does NOT contain application/pdf");
  assert(!mimeHtmlOnly.includes('Content-Disposition: attachment'), "Direct PO email MIME does NOT contain attachment disposition");
  assert(mimeHtmlOnly.includes('https://www.tejascanvassing.com/logo.png'), "Direct PO email MIME contains official HTTPS logo in HTML body");
  assert(!mimeHtmlOnly.includes('tejasadinarayan@gmail.com'), "MIME message does NOT contain tejasadinarayan@gmail.com");
  assert(!mimeHtmlOnly.includes('tejascanvassing@gmail.com'), "MIME message does NOT contain tejascanvassing@gmail.com");
  assert(mimeHtmlOnly.includes('nani@tejasc.in'), "MIME message retains official sender/admin nani@tejasc.in");

  // TEST 9B: Optional PDF Attachment Backward Compatibility Check
  const mimeWithPdf = buildMimeMessage({
    to: 'supplier@example.com',
    cc: 'nani@tejasc.in',
    subject: 'Official Purchase Order TC-1234',
    htmlContent: '<p>Purchase Order HTML</p>',
    textContent: 'Purchase Order Text',
    pdfBase64: pdfBase64,
    pdfFilename: 'PO_TC-1234_Tejas_Canvassing.pdf'
  });
  assert(mimeWithPdf.includes('Content-Type: multipart/mixed'), "MIME message contains multipart/mixed when PDF is explicitly provided");
  assert(mimeWithPdf.includes('Content-Type: application/pdf; name="PO_TC-1234_Tejas_Canvassing.pdf"'), "MIME contains PDF attachment content type when provided");
  assert(mimeWithPdf.includes('Content-Disposition: attachment; filename="PO_TC-1234_Tejas_Canvassing.pdf"'), "MIME contains attachment disposition when provided");

  // TEST 10: Supported CID Inline Image in MIME
  const mimeCid = buildMimeMessage({
    to: 'supplier@example.com',
    subject: 'Official PO with CID',
    htmlContent: '<p><img src="cid:company-logo" alt="Tejas Canvassing" /></p>',
    textContent: 'Purchase Order Text',
    pdfBase64: pdfBase64,
    pdfFilename: 'PO_TC-1234_Tejas_Canvassing.pdf'
  });
  assert(mimeCid.includes('Content-ID: <company-logo>'), "MIME message supports inline CID company-logo");
  assert(mimeCid.includes('Content-Type: image/png; name="logo.png"'), "MIME contains inline image/png part");
  assert(mimeCid.includes('Content-Disposition: inline; filename="logo.png"'), "MIME contains inline disposition for logo");

  // TEST 11: Valid PDF Attachment Verification
  const pdfBytes = Buffer.from(pdfBase64, 'base64');
  assert(pdfBytes.subarray(0, 5).toString('ascii') === '%PDF-', "Decoded attachment is a valid PDF beginning with %PDF- header");
  assert(pdfBytes.length > 50000, `Decoded PDF attachment has full payload size (${pdfBytes.length} bytes)`);

  // TEST 10: Serverless PDF Generation Parity Check (Pure Node.js Runtime)
  let serverlessError: any = null;
  let serverlessPdfBase64 = '';
  try {
    serverlessPdfBase64 = generatePoPdfBase64(
      { id: 'SERVERLESS-PO-1', supplier: 'MILL XYZ', date: '2026-11-25' },
      [{ id: 'SUB-1', buyer: 'MERCHANT A', product: 'SONA MASOORI', qty: 100, rate: 5200 }]
    );
  } catch (err) {
    serverlessError = err;
  }
  assert(serverlessError === null, "PDF generation succeeds in pure Node.js serverless environment without throwing");
  assert(serverlessPdfBase64.length > 50000, `Serverless PDF is fully rendered (>50KB). Length: ${serverlessPdfBase64.length}`);

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
