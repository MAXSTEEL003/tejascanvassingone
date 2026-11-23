import { test } from "node:test";
import assert from "node:assert";
import {
  firebaseConfig,
  DEFAULT_CONFIG,
  EXPECTED_FIREBASE_PROJECT_ID,
  validateFirebaseConfig,
} from "../api/firebaseAppletConfig.js";
import {
  KNOWN_SUPPLIER_CODES as BACKEND_CODES,
  deriveSupplierCode as backendDeriveCode,
  getSupplierCode as backendGetCode,
  generateRandomPoNumber as backendGenPo,
  resolveGroupedPoNumber as backendResolvePo,
  resolveSubOrderNumber as backendResolveSubNo,
} from "../api/orderNumbering.js";
import {
  KNOWN_SUPPLIER_CODES as FRONTEND_CODES,
  deriveSupplierCode as frontendDeriveCode,
  getSupplierCode as frontendGetCode,
  generateRandomPoNumber as frontendGenPo,
  resolveGroupedPoNumber as frontendResolvePo,
  resolveSubOrderNumber as frontendResolveSubNo,
} from "../src/utils/orderOperations.js";

test("=== PRE-DEPLOYMENT SAFETY: FIREBASE CONFIG VALIDATION ===", async (t) => {
  await t.test("1. firebaseConfig always resolves to intended project tejascanavssingstore", () => {
    assert.strictEqual(
      firebaseConfig.projectId,
      EXPECTED_FIREBASE_PROJECT_ID,
      `firebaseConfig.projectId must strictly equal "${EXPECTED_FIREBASE_PROJECT_ID}"`
    );
    assert.strictEqual(
      DEFAULT_CONFIG.projectId,
      EXPECTED_FIREBASE_PROJECT_ID,
      `DEFAULT_CONFIG.projectId must strictly equal "${EXPECTED_FIREBASE_PROJECT_ID}"`
    );
  });

  await t.test("2. validateFirebaseConfig rejects null or undefined config", () => {
    assert.throws(
      () => validateFirebaseConfig(null as any),
      /\[Firebase Config Error\]/,
      "Must reject null configuration"
    );
    assert.throws(
      () => validateFirebaseConfig(undefined as any),
      /\[Firebase Config Error\]/,
      "Must reject undefined configuration"
    );
  });

  await t.test("3. validateFirebaseConfig rejects missing required fields", () => {
    const required = ["projectId", "appId", "apiKey", "authDomain"] as const;
    for (const field of required) {
      const copy = { ...DEFAULT_CONFIG, [field]: "" };
      assert.throws(
        () => validateFirebaseConfig(copy),
        new RegExp(`missing required non-empty field: "${field}"`),
        `Must throw if ${field} is empty or missing`
      );
    }
  });

  await t.test("4. validateFirebaseConfig strictly rejects unintended project IDs (fail closed)", () => {
    const maliciousProjects = [
      "other-project",
      "tejascanavssingstore-dev",
      "unintended-firebase-project",
      "tejascanvassing-test",
    ];

    for (const proj of maliciousProjects) {
      const badConfig = { ...DEFAULT_CONFIG, projectId: proj };
      assert.throws(
        () => validateFirebaseConfig(badConfig),
        /Security mismatch in configuration: expected projectId "tejascanavssingstore"/,
        `Must block unintended project "${proj}"`
      );
    }
  });

  await t.test("5. Fallback configuration is non-sensitive and has no private keys", () => {
    assert.strictEqual((DEFAULT_CONFIG as any).private_key, undefined, "No private_key in config");
    assert.strictEqual((DEFAULT_CONFIG as any).client_email, undefined, "No service account email in web config");
    assert.ok(DEFAULT_CONFIG.apiKey.startsWith("AIzaSy"), "Valid public web client API key format");
    assert.strictEqual(DEFAULT_CONFIG.authDomain, "tejascanavssingstore.firebaseapp.com");
  });
});

test("=== PRE-DEPLOYMENT SAFETY: ORDER NUMBERING & PARITY ===", async (t) => {
  await t.test("1. KNOWN_SUPPLIER_CODES has exact parity", () => {
    assert.deepStrictEqual(
      BACKEND_CODES,
      FRONTEND_CODES,
      "Backend and frontend KNOWN_SUPPLIER_CODES must be completely identical"
    );
  });

  await t.test("2. deriveSupplierCode returns identical results across representative supplier names", () => {
    const testNames = [
      "BHAGWATI RICE AND AGRO INDUSTRIES",
      "RIDDHE SIDDHE RICE INDUSTRIES PVT LTD",
      "SRI LAKSHMI RICE INDUSTRIES",
      "SAI TEJA PARBOILED RICE MILLS (P) LTD",
      "NIDHI AGROS",
      "VAISHNAVI FOOD PRODUCTS PVT LTD",
      "ANNAPURNA RICE & AGRO INDUSTRIES",
      "AMRITSAR GRAIN EXPORT LTD.",
      "bhagwati rice and agro industries",
      "  Riddhe Siddhe Rice Industries Pvt Ltd  ",
      "Sri Lakshmi Rice Industries Limited",
      "Custom Miller Private Limited",
      "Singleword",
      "Two Words",
      "Three Words Here",
      "Four Words Here Too",
      "A",
      "",
    ];

    for (const name of testNames) {
      const backendResult = backendDeriveCode(name);
      const frontendResult = frontendDeriveCode(name);
      assert.strictEqual(
        backendResult,
        frontendResult,
        `deriveSupplierCode mismatch for input: "${name}": backend="${backendResult}", frontend="${frontendResult}"`
      );
    }
  });

  await t.test("3. deriveSupplierCode collision handling with existingCodes set", () => {
    const existing = new Set(["AMB", "AMB2"]);
    const bRes = backendDeriveCode("American Beverage Company", existing);
    const fRes = frontendDeriveCode("American Beverage Company", existing);
    assert.strictEqual(bRes, "AMB3", "Increments suffix on collision");
    assert.strictEqual(bRes, fRes, "Backend and frontend deriveSupplierCode with collisions are identical");
  });

  await t.test("4. getSupplierCode returns identical results for all known and unknown millers", () => {
    const testCases = [
      "Bhagwati Rice and Agro Industries",
      "Riddhe Siddhe Rice Industries",
      "Nidhi Agros",
      "DIRECT MILL",
      "Unknown Supplier X",
      "",
    ];

    for (const sup of testCases) {
      const bCode = backendGetCode(sup);
      const fCode = frontendGetCode(sup);
      assert.strictEqual(
        bCode,
        fCode,
        `getSupplierCode mismatch for "${sup}": backend="${bCode}", frontend="${fCode}"`
      );
    }
  });

  await t.test("5. generateRandomPoNumber generates valid TC-XXXXXX format", () => {
    for (let i = 0; i < 20; i++) {
      const po = backendGenPo();
      assert.match(po, /^TC-[A-Z0-9]{6}$/, `Generated PO "${po}" must match TC-XXXXXX`);
    }
  });

  await t.test("6. resolveGroupedPoNumber parity across representative order structures", () => {
    const testOrders = [
      { poNumber: "TC-ABC123" },
      { poNumber: "tc-xyz987" },
      { batchId: "TC-998877" },
      { id: "ORD-2026-11-20-001" },
      { id: "12345678" },
      { billNo: "BILL-90812" },
      { date: "2026-11-20" },
      { purchaseOrderNo: "TC-PURCHASE-01" },
      {},
      null,
      undefined,
    ];

    for (const ord of testOrders) {
      const clone1 = ord ? JSON.parse(JSON.stringify(ord)) : ord;
      const clone2 = ord ? JSON.parse(JSON.stringify(ord)) : ord;

      const res1 = backendResolvePo(clone1);
      const res2 = frontendResolvePo(clone2);

      // If existing TC- poNumber or deterministic seed: must match exactly
      if (ord && (ord.poNumber || ord.batchId || ord.id || ord.billNo || ord.date)) {
        assert.strictEqual(
          res1,
          res2,
          `resolveGroupedPoNumber mismatch for input ${JSON.stringify(ord)}: backend="${res1}", frontend="${res2}"`
        );
      } else {
        // If random generation, both must match the TC- format
        assert.match(res1, /^TC-[A-Z0-9]{4,10}$/);
        assert.match(res2, /^TC-[A-Z0-9]{4,10}$/);
      }
    }
  });

  await t.test("7. resolveSubOrderNumber parity across sub-order edge cases", () => {
    const testCases: Array<{ sub: any; sIdx: number; fallbackSupplier?: string }> = [
      // Direct supplierSubOrderNo
      { sub: { supplierSubOrderNo: "BRI-0001" }, sIdx: 0 },
      { sub: { supplierSubOrderNo: "RSR-0005" }, sIdx: 4 },
      // Sub-order candidate properties
      { sub: { subOrderNo: "SLR-0003" }, sIdx: 2 },
      { sub: { orderNo: "STP-0002" }, sIdx: 1 },
      { sub: { id: "VFP-0004" }, sIdx: 3 },
      { sub: { subOrderId: "ARA-0007" }, sIdx: 6 },
      // Excluded buyer prefixes (must NOT be treated as supplier sub-order number)
      { sub: { supplierSubOrderNo: "MO-0001", supplier: "Bhagwati Rice and Agro Industries" }, sIdx: 0 },
      { sub: { subOrderNo: "SO-0002", supplier: "Riddhe Siddhe Rice Industries Pvt Ltd" }, sIdx: 1 },
      { sub: { subOrderNo: "MA-0003", supplier: "Sri Lakshmi Rice Industries" }, sIdx: 2 },
      { sub: { subOrderNo: "ONI-0004", supplier: "Nidhi Agros" }, sIdx: 3 },
      { sub: { subOrderNo: "OD-0005", supplier: "Vaishnavi Food Products Pvt Ltd" }, sIdx: 4 },
      { sub: { subOrderNo: "PO-0006", supplier: "Annapurna Rice & Agro Industries" }, sIdx: 5 },
      { sub: { subOrderNo: "TC-0007", supplier: "Amritsar Grain Export Ltd." }, sIdx: 6 },
      { sub: { subOrderNo: "BUY-0008", supplier: "Bhagwati Rice and Agro Industries" }, sIdx: 7 },
      { sub: { subOrderNo: "SUP-0009", supplier: "Riddhe Siddhe Rice Industries Pvt Ltd" }, sIdx: 8 },
      // Derived from supplier property
      { sub: { supplier: "Bhagwati Rice and Agro Industries" }, sIdx: 0 },
      { sub: { seller: "Riddhe Siddhe Rice Industries Pvt Ltd" }, sIdx: 1 },
      { sub: { millerName: "Sri Lakshmi Rice Industries" }, sIdx: 2 },
      { sub: { assignedSupplier: "Sai Teja Parboiled Rice Mills (P) Ltd" }, sIdx: 3 },
      // Fallback supplier parameter
      { sub: {}, sIdx: 0, fallbackSupplier: "Bhagwati Rice and Agro Industries" },
      { sub: {}, sIdx: 3, fallbackSupplier: "Riddhe Siddhe Rice Industries Pvt Ltd" },
      // Empty / undefined sub-orders
      { sub: null, sIdx: 0 },
      { sub: null, sIdx: 4 },
      { sub: undefined, sIdx: 1 },
    ];

    for (const { sub, sIdx, fallbackSupplier } of testCases) {
      const bRes = backendResolveSubNo(sub, sIdx, fallbackSupplier);
      const fRes = frontendResolveSubNo(sub, sIdx, fallbackSupplier);
      assert.strictEqual(
        bRes,
        fRes,
        `resolveSubOrderNumber mismatch for sub=${JSON.stringify(sub)}, sIdx=${sIdx}: backend="${bRes}", frontend="${fRes}"`
      );
    }
  });
});
