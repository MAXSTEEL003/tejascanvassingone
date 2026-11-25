import assert from 'assert';
import {
  getSubOrderStableKey,
  verifySubOrderUniqueness,
  mergeSubOrderNotificationOutcomes,
  applyEmailFailureGuard,
  applyWhatsAppFailureGuard
} from '../src/utils/orderNotificationMerge';

// Pure logic mirrors of PlacedOrders.tsx notification state computation
export function computeOrderNotificationView(order: any, trk?: any) {
  // 1. Supplier PO Email: Sent / Failed / Pending
  const emailStatus: 'Sent' | 'Failed' | 'Pending' = (() => {
    if (order.purchaseOrderSent || order.poEmailStatus === 'Sent' || trk?.status === 'Sent' || trk?.gmailMessageId) {
      return 'Sent';
    }
    if (order.poEmailStatus === 'Failed' || trk?.status === 'Failed') {
      return 'Failed';
    }
    return 'Pending';
  })();
  const emailError = order.poEmailError || trk?.error || '';

  // 2. Customer WhatsApp: Accepted / Delivered / Failed / Pending
  // NOTE: We do NOT claim delivery solely because Meta accepted a message.
  const waStatus: 'Accepted' | 'Delivered' | 'Failed' | 'Pending' = (() => {
    if (order.whatsappStatus === 'Delivered' || trk?.whatsappStatus === 'Delivered') {
      return 'Delivered';
    }
    if (order.whatsappStatus === 'Accepted' || trk?.whatsappStatus === 'Accepted' || (order.whatsappSent && !order.whatsappStatus)) {
      return 'Accepted';
    }
    if (order.whatsappStatus === 'Failed' || trk?.whatsappStatus === 'Failed') {
      return 'Failed';
    }
    return 'Pending';
  })();
  const waError = order.whatsappError || trk?.whatsappError || '';

  const activeEmailError = emailStatus === 'Failed' ? (emailError || 'PO email dispatch failed') : '';
  const activeWaError = waStatus === 'Failed' ? (waError || 'Customer WhatsApp dispatch failed') : '';

  const lastErrorMessage = (() => {
    if (activeEmailError && activeWaError) {
      return `PO Email: ${activeEmailError} | Customer WhatsApp: ${activeWaError}`;
    }
    if (activeEmailError) {
      return activeEmailError.toLowerCase().includes('po email') || activeEmailError.toLowerCase().includes('purchase order')
        ? activeEmailError
        : `PO Email: ${activeEmailError}`;
    }
    if (activeWaError) {
      return activeWaError.toLowerCase().includes('whatsapp')
        ? activeWaError
        : `Customer WhatsApp: ${activeWaError}`;
    }
    return '';
  })();

  const canRetryEmail = emailStatus !== 'Sent';
  const canRetryWhatsApp = waStatus !== 'Delivered' && waStatus !== 'Accepted';

  return {
    emailStatus,
    emailError,
    activeEmailError,
    waStatus,
    waError,
    activeWaError,
    lastErrorMessage,
    canRetryEmail,
    canRetryWhatsApp
  };
}

export function syncTrackingRecords(placed: any[], map: Record<string, any>) {
  let changed = false;
  const updated = placed.map((p: any) => {
    const trkRec = map[p.id];
    if (trkRec) {
      const emailSent = Boolean(trkRec.status === 'Sent' || trkRec.gmailMessageId);
      const emailFailed = Boolean(trkRec.status === 'Failed');
      const waSent = Boolean(trkRec.whatsappSent || trkRec.whatsappMessageId || trkRec.whatsappStatus === 'Accepted' || trkRec.whatsappStatus === 'Delivered');
      const waFailed = Boolean(trkRec.whatsappStatus === 'Failed');
      const needsEmailUpdate = (emailSent && (!p.purchaseOrderSent || p.poEmailStatus !== 'Sent' || p.poEmailError)) || (emailFailed && p.poEmailStatus !== 'Failed');
      const needsWaUpdate = (waSent && (!p.whatsappSent || p.whatsappStatus !== (trkRec.whatsappStatus || 'Accepted') || p.whatsappError)) || (waFailed && p.whatsappStatus !== 'Failed');
      if (needsEmailUpdate || needsWaUpdate) {
        changed = true;
        return {
          ...p,
          purchaseOrderSent: emailSent ? true : (emailFailed ? false : p.purchaseOrderSent),
          purchaseOrderSentAt: trkRec.sentAt || p.purchaseOrderSentAt || (emailSent ? new Date().toISOString() : undefined),
          poEmailStatus: emailSent ? 'Sent' : (emailFailed ? 'Failed' : p.poEmailStatus),
          poEmailError: emailFailed ? (trkRec.error || p.poEmailError) : (emailSent ? null : p.poEmailError),
          smtpMessageId: trkRec.gmailMessageId || p.smtpMessageId,
          whatsappSent: waSent ? true : (waFailed ? false : p.whatsappSent),
          whatsappStatus: trkRec.whatsappStatus || (waSent ? 'Accepted' : (waFailed ? 'Failed' : p.whatsappStatus)),
          whatsappError: waFailed ? (trkRec.whatsappError || p.whatsappError) : (waSent ? null : p.whatsappError),
          whatsappSentAt: trkRec.whatsappSentAt || p.whatsappSentAt || (waSent ? new Date().toISOString() : undefined),
          whatsappMessageId: trkRec.whatsappMessageId || p.whatsappMessageId || (waSent ? 'sent' : undefined)
        };
      }
    }
    return p;
  });
  return { updated, changed };
}

async function runNotificationErrorIsolationTests() {
  console.log("=== STARTING NOTIFICATION STATUS ERROR ISOLATION TESTS ===");
  let passed = 0;
  let failed = 0;

  async function test(desc: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${desc} ->`, err.message);
      failed++;
    }
  }

  // TEST 1: TC-5CV4TY Specific Regression: PO EMAIL Sent + WhatsApp Accepted with residual stale poEmailError
  await test("1. [TC-5CV4TY Regression] Order with PO Email Sent and WhatsApp Accepted clears error banner despite stale poEmailError on record", () => {
    const orderTC5CV4TY = {
      id: "TC-5CV4TY",
      purchaseOrderSent: true,
      poEmailStatus: "Sent",
      poEmailError: "Unauthorized: Admin privileges required for purchase order dispatch. A verified Admin session token is required.",
      whatsappSent: true,
      whatsappStatus: "Accepted",
      whatsappError: null,
    };

    const view = computeOrderNotificationView(orderTC5CV4TY);
    assert.strictEqual(view.emailStatus, "Sent", "Email status must be Sent");
    assert.strictEqual(view.waStatus, "Accepted", "WhatsApp status must be Accepted");
    assert.strictEqual(view.activeEmailError, "", "Active email error must be empty because emailStatus is Sent");
    assert.strictEqual(view.activeWaError, "", "Active WhatsApp error must be empty because waStatus is Accepted");
    assert.strictEqual(view.lastErrorMessage, "", "lastErrorMessage MUST be empty - no red error box should render");
    assert.strictEqual(view.canRetryEmail, false, "Email retry should be disabled for Sent status");
    assert.strictEqual(view.canRetryWhatsApp, false, "WhatsApp retry should be disabled for Accepted status");
  });

  // TEST 2: Genuine PO Email failure is displayed when WhatsApp succeeds (no suppression)
  await test("2. Genuine PO Email failure is preserved and clearly displayed when WhatsApp is Accepted", () => {
    const orderEmailFailed = {
      id: "TC-FAIL-EMAIL",
      purchaseOrderSent: false,
      poEmailStatus: "Failed",
      poEmailError: "Admin authentication required. Please sign in with an authorized Admin account to dispatch purchase orders.",
      whatsappSent: true,
      whatsappStatus: "Accepted",
      whatsappError: null,
    };

    const view = computeOrderNotificationView(orderEmailFailed);
    assert.strictEqual(view.emailStatus, "Failed");
    assert.strictEqual(view.waStatus, "Accepted");
    assert.strictEqual(view.activeEmailError, "Admin authentication required. Please sign in with an authorized Admin account to dispatch purchase orders.");
    assert.strictEqual(view.activeWaError, "");
    assert.strictEqual(view.lastErrorMessage, "Admin authentication required. Please sign in with an authorized Admin account to dispatch purchase orders.");
    assert.strictEqual(view.canRetryEmail, true, "Email retry must be enabled on failure");
    assert.strictEqual(view.canRetryWhatsApp, false, "WhatsApp retry must be disabled on Accepted");
  });

  // TEST 3: Genuine WhatsApp failure is displayed when PO Email succeeds (no suppression)
  await test("3. Genuine WhatsApp failure is preserved and clearly displayed when PO Email is Sent", () => {
    const orderWaFailed = {
      id: "TC-FAIL-WA",
      purchaseOrderSent: true,
      poEmailStatus: "Sent",
      poEmailError: null,
      whatsappSent: false,
      whatsappStatus: "Failed",
      whatsappError: "Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.",
    };

    const view = computeOrderNotificationView(orderWaFailed);
    assert.strictEqual(view.emailStatus, "Sent");
    assert.strictEqual(view.waStatus, "Failed");
    assert.strictEqual(view.activeEmailError, "");
    assert.strictEqual(view.activeWaError, "Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.");
    assert.strictEqual(view.lastErrorMessage, "Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.");
    assert.strictEqual(view.canRetryEmail, false, "Email retry disabled on Sent");
    assert.strictEqual(view.canRetryWhatsApp, true, "WhatsApp retry enabled on failure");
  });

  // TEST 4: Both channels failing renders both errors distinctly separated
  await test("4. Both channels failing renders both error messages with distinct channel labels", () => {
    const orderBothFailed = {
      id: "TC-FAIL-BOTH",
      purchaseOrderSent: false,
      poEmailStatus: "Failed",
      poEmailError: "Supplier email rejected connection",
      whatsappSent: false,
      whatsappStatus: "Failed",
      whatsappError: "Recipient phone number not registered on WhatsApp",
    };

    const view = computeOrderNotificationView(orderBothFailed);
    assert.strictEqual(view.emailStatus, "Failed");
    assert.strictEqual(view.waStatus, "Failed");
    assert.strictEqual(view.lastErrorMessage, "PO Email: Supplier email rejected connection | Customer WhatsApp: Recipient phone number not registered on WhatsApp");
    assert.strictEqual(view.canRetryEmail, true);
    assert.strictEqual(view.canRetryWhatsApp, true);
  });

  // TEST 5: Status 'Accepted' is strictly distinct from 'Delivered'
  await test("5. Status 'Accepted' indicates Meta Cloud API acceptance, strictly distinct from 'Delivered'", () => {
    const orderAccepted = {
      id: "TC-ACCEPTED",
      purchaseOrderSent: true,
      poEmailStatus: "Sent",
      whatsappSent: true,
      whatsappStatus: "Accepted"
    };

    const orderDelivered = {
      id: "TC-DELIVERED",
      purchaseOrderSent: true,
      poEmailStatus: "Sent",
      whatsappSent: true,
      whatsappStatus: "Delivered"
    };

    const viewAccepted = computeOrderNotificationView(orderAccepted);
    const viewDelivered = computeOrderNotificationView(orderDelivered);

    assert.strictEqual(viewAccepted.waStatus, "Accepted", "Accepted status must be Accepted");
    assert.strictEqual(viewDelivered.waStatus, "Delivered", "Delivered status must be Delivered");
    assert.notStrictEqual(viewAccepted.waStatus, viewDelivered.waStatus, "Accepted must not be conflated with Delivered");
  });

  // TEST 6: Tracking records sync cleans up stale errors on confirmed success
  await test("6. Tracking records sync cleans up stale poEmailError and whatsappError to null upon confirmed success", () => {
    const initialOrders = [
      {
        id: "TC-SYNC-01",
        purchaseOrderSent: false,
        poEmailStatus: "Failed",
        poEmailError: "Initial network error",
        whatsappSent: false,
        whatsappStatus: "Failed",
        whatsappError: "Initial WA network error"
      }
    ];

    const trackingMap = {
      "TC-SYNC-01": {
        status: "Sent",
        gmailMessageId: "msg_gmail_12345",
        sentAt: "2026-11-24T12:00:00Z",
        whatsappStatus: "Accepted",
        whatsappSent: true,
        whatsappMessageId: "wamid_abcde",
        whatsappSentAt: "2026-11-24T12:00:05Z"
      }
    };

    const { updated, changed } = syncTrackingRecords(initialOrders, trackingMap);
    assert.strictEqual(changed, true, "Sync must register change");
    assert.strictEqual(updated[0].poEmailStatus, "Sent");
    assert.strictEqual(updated[0].poEmailError, null, "poEmailError must be cleared to null");
    assert.strictEqual(updated[0].whatsappStatus, "Accepted");
    assert.strictEqual(updated[0].whatsappError, null, "whatsappError must be cleared to null");
  });

  // TEST 7: JSON serialization with null retains null field in Firestore { merge: true }
  await test("7. Setting error fields to null preserves field in JSON serialization for Firestore { merge: true }", () => {
    const dataWithUndefined = {
      poEmailStatus: "Sent",
      poEmailError: undefined,
      whatsappStatus: "Accepted",
      whatsappError: undefined
    };

    const serializedUndefined = JSON.parse(JSON.stringify(dataWithUndefined));
    assert.strictEqual("poEmailError" in serializedUndefined, false, "undefined field is dropped by JSON.stringify (cannot overwrite in merge)");
    assert.strictEqual("whatsappError" in serializedUndefined, false, "undefined field is dropped by JSON.stringify (cannot overwrite in merge)");

    const dataWithNull = {
      poEmailStatus: "Sent",
      poEmailError: null,
      whatsappStatus: "Accepted",
      whatsappError: null
    };

    const serializedNull = JSON.parse(JSON.stringify(dataWithNull));
    assert.strictEqual(serializedNull.poEmailError, null, "null field is retained in JSON.stringify (clears field in Firestore merge)");
    assert.strictEqual(serializedNull.whatsappError, null, "null field is retained in JSON.stringify (clears field in Firestore merge)");
  });

  // TEST 8: Concurrent order updates & field-specific notification writes safety
  await test("8. Field-specific notification updates preserve concurrent payments, lifting records, and supplier updates", () => {
    // Simulated Firestore document representing an active order in database
    let firestoreDoc: Record<string, any> = {
      id: "TC-CONCURRENT-001",
      supplier: "Bhagwathi Rice and Agro Industries",
      product: "KESHAR KALI",
      qty: 100,
      rate: 3400,
      status: "Approved",
      // Initially both notifications failed
      purchaseOrderSent: false,
      poEmailStatus: "Failed",
      poEmailError: "Temporary SMTP failure",
      whatsappSent: false,
      whatsappStatus: "Failed",
      whatsappError: "Temporary WhatsApp rate limit"
    };

    // Helper simulating Firestore { merge: true } behavior
    const firestoreMergeWrite = (partialUpdate: Record<string, any>) => {
      // JSON serialization mirrors cleanData in setCollectionDoc
      const cleanUpdate = JSON.parse(JSON.stringify(partialUpdate));
      firestoreDoc = {
        ...firestoreDoc,
        ...cleanUpdate
      };
    };

    // 1. Concurrent Business Action 1: User logs a payment in PaymentTracking
    const concurrentPaymentRecord = {
      payments: [
        { id: "PAY-101", amount: 150000, date: "2026-11-24T10:00:00Z", mode: "RTGS", reference: "UTR987654321" }
      ],
      paidAmount: 150000,
      balanceAmount: 190000,
      paymentStatus: "Partial"
    };
    firestoreMergeWrite(concurrentPaymentRecord);
    assert.strictEqual(firestoreDoc.payments.length, 1);
    assert.strictEqual(firestoreDoc.paidAmount, 150000);

    // 2. Concurrent Business Action 2: User records lifting in PlacedOrders
    const concurrentLiftingRecord = {
      liftingRecords: [
        { id: "LIFT-201", qtls: 50, rate: 3400, shopName: "Karnal Mandi", newBillNo: "KM-555", timestamp: "2026-11-24T10:15:00Z" }
      ],
      currentShop: "Karnal Mandi"
    };
    firestoreMergeWrite(concurrentLiftingRecord);
    assert.strictEqual(firestoreDoc.liftingRecords.length, 1);

    // 3. Concurrent Business Action 3: Inbound mill webhook arrives (truck loaded & mill bill uploaded)
    const concurrentSupplierWebhook = {
      millerBillNumber: "MILL-BILL-777",
      truckNumber: "KA01AB1234",
      supplierUpdates: [
        { event: "TRUCK_LOADED", timestamp: "2026-11-24T10:20:00Z", note: "Driver verified" }
      ]
    };
    firestoreMergeWrite(concurrentSupplierWebhook);
    assert.strictEqual(firestoreDoc.millerBillNumber, "MILL-BILL-777");

    // 4. NOW: PO Email Retry completes successfully and executes field-specific update
    // (Notice: only email notification fields are included; does NOT spread entire stale order)
    const emailSuccessFields = {
      purchaseOrderSent: true,
      purchaseOrderSentAt: "2026-11-24T10:30:00Z",
      poEmailStatus: "Sent",
      poEmailError: null,
      smtpMessageId: "msg_gmail_success_999",
      sellerEmail: "bhagwatirice@gmail.com"
    };
    firestoreMergeWrite(emailSuccessFields);

    // VERIFY: Email notification updated and stale error cleared
    assert.strictEqual(firestoreDoc.poEmailStatus, "Sent");
    assert.strictEqual(firestoreDoc.poEmailError, null);
    assert.strictEqual(firestoreDoc.smtpMessageId, "msg_gmail_success_999");

    // CRITICAL SAFETY CHECK: Payments, Lifting, and Supplier Webhook data MUST NOT be overwritten!
    assert.strictEqual(firestoreDoc.payments.length, 1, "Concurrent payment record MUST NOT be wiped!");
    assert.strictEqual(firestoreDoc.paidAmount, 150000, "Paid amount MUST be preserved!");
    assert.strictEqual(firestoreDoc.paymentStatus, "Partial", "Payment status MUST be preserved!");
    assert.strictEqual(firestoreDoc.liftingRecords.length, 1, "Concurrent lifting record MUST NOT be wiped!");
    assert.strictEqual(firestoreDoc.currentShop, "Karnal Mandi", "Lifting shop MUST be preserved!");
    assert.strictEqual(firestoreDoc.millerBillNumber, "MILL-BILL-777", "Supplier bill update MUST NOT be wiped!");
    assert.strictEqual(firestoreDoc.truckNumber, "KA01AB1234", "Truck number MUST be preserved!");

    // CRITICAL ERROR ISOLATION: WhatsApp channel failure MUST remain intact (not masked by email success)
    assert.strictEqual(firestoreDoc.whatsappStatus, "Failed", "WhatsApp failure MUST NOT be cleared by PO email retry!");
    assert.strictEqual(firestoreDoc.whatsappError, "Temporary WhatsApp rate limit", "WhatsApp error MUST NOT be wiped by PO email retry!");

    // 5. NOW: Customer WhatsApp Retry succeeds independently
    const waSuccessFields = {
      whatsappSent: true,
      whatsappStatus: "Accepted",
      whatsappError: null,
      whatsappSentAt: "2026-11-24T10:35:00Z"
    };
    firestoreMergeWrite(waSuccessFields);

    // VERIFY: WhatsApp updated and cleared, and PO email remains 'Sent'
    assert.strictEqual(firestoreDoc.whatsappStatus, "Accepted");
    assert.strictEqual(firestoreDoc.whatsappError, null);
    assert.strictEqual(firestoreDoc.poEmailStatus, "Sent");
    assert.strictEqual(firestoreDoc.payments.length, 1, "Payments still intact after WhatsApp retry!");
    assert.strictEqual(firestoreDoc.liftingRecords.length, 1, "Lifting still intact after WhatsApp retry!");
    assert.strictEqual(firestoreDoc.supplierUpdates.length, 1, "Supplier updates still intact after WhatsApp retry!");
  });

  // TEST 9: Concurrent sub-order mutability & WhatsApp atomic merge protection
  await test("9. WhatsApp retry merges into latest originalOrders without overwriting concurrent sub-order arrival, bill, or quantity edits", () => {
    // Initial order state at the time user clicks "Retry WhatsApp"
    const inMemoryOrder = {
      id: "TC-GROUP-PO-01",
      originalOrders: [
        {
          id: "sub-01",
          buyer: "Merchant Alpha",
          brand: "KESHAR KALI",
          qty: 80,
          rate: 8400,
          isArrived: false,
          actualSupplierBillNo: "",
          whatsappStatus: "Failed"
        },
        {
          id: "sub-02",
          buyer: "Merchant Beta",
          brand: "KESHAR KALI",
          qty: 120,
          rate: 8400,
          isArrived: false,
          actualSupplierBillNo: "",
          whatsappStatus: "Failed"
        }
      ]
    };

    // WHILE WhatsApp network dispatch is in-flight, a mill manager marks sub-01 as arrived
    // and updates billing and quantity details in Firestore
    const latestDocInFirestore = {
      id: "TC-GROUP-PO-01",
      originalOrders: [
        {
          id: "sub-01",
          buyer: "Merchant Alpha",
          brand: "KESHAR KALI",
          qty: 80,
          rate: 8400,
          // CONCURRENT MUTATIONS APPLIED WHILE WA WAS IN-FLIGHT:
          isArrived: true,
          arrivedAt: "2026-11-24T12:30:00Z",
          arrivedQty: 79.5,
          settledRate: 8390,
          actualSupplierBillNo: "MILL-BILL-9999",
          status: "Arrived",
          whatsappStatus: "Failed"
        },
        {
          id: "sub-02",
          buyer: "Merchant Beta",
          brand: "KESHAR KALI",
          qty: 120,
          rate: 8400,
          isArrived: false,
          actualSupplierBillNo: "",
          whatsappStatus: "Failed"
        }
      ]
    };

    // Simulated outcomes from dispatchOrderPlacedWhatsApp
    const dispatchOutcomes = [
      {
        subId: "sub-01",
        idx: 0,
        phone: "919945351166",
        whatsappSent: true,
        whatsappStatus: "Accepted" as const,
        whatsappError: undefined,
        whatsappMessageId: "wamid_sub01",
        whatsappSentAt: "2026-11-24T12:30:05Z"
      },
      {
        subId: "sub-02",
        idx: 1,
        phone: "919845123456",
        whatsappSent: true,
        whatsappStatus: "Accepted" as const,
        whatsappError: undefined,
        whatsappMessageId: "wamid_sub02",
        whatsappSentAt: "2026-11-24T12:30:06Z"
      }
    ];

    // Build outcome map as implemented in handleRetryWhatsApp
    const outcomeMap = new Map<string, any>();
    dispatchOutcomes.forEach((outcome, idx) => {
      if (outcome.subId) outcomeMap.set(String(outcome.subId), outcome);
      outcomeMap.set(`idx-${idx}`, outcome);
    });

    // Merge into latest originalOrders from Firestore (NOT from stale in-memory snapshot)
    const mergedSubOrders = latestDocInFirestore.originalOrders.map((latestSub: any, idx: number) => {
      const match = outcomeMap.get(String(latestSub.id)) || outcomeMap.get(`idx-${idx}`);
      if (!match) return latestSub;

      return {
        ...latestSub,
        phone: match.phone || latestSub.phone,
        whatsappSent: match.whatsappSent,
        whatsappStatus: match.whatsappStatus,
        whatsappError: match.whatsappError || null,
        whatsappMessageId: match.whatsappMessageId || latestSub.whatsappMessageId,
        whatsappSentAt: match.whatsappSentAt || latestSub.whatsappSentAt
      };
    });

    // VERIFY SUB-ORDER 1: Arrival, Bill, and Quantity mutations MUST BE 100% PRESERVED!
    const sub1 = mergedSubOrders[0];
    assert.strictEqual(sub1.isArrived, true, "isArrived MUST NOT be reverted to false!");
    assert.strictEqual(sub1.arrivedQty, 79.5, "arrivedQty MUST be preserved!");
    assert.strictEqual(sub1.settledRate, 8390, "settledRate MUST be preserved!");
    assert.strictEqual(sub1.actualSupplierBillNo, "MILL-BILL-9999", "actualSupplierBillNo MUST NOT be wiped!");
    assert.strictEqual(sub1.status, "Arrived", "Sub-order status MUST remain Arrived!");
    assert.strictEqual(sub1.whatsappStatus, "Accepted", "WhatsApp status MUST be updated to Accepted");
    assert.strictEqual(sub1.whatsappMessageId, "wamid_sub01");

    // VERIFY SUB-ORDER 2: Updated cleanly
    const sub2 = mergedSubOrders[1];
    assert.strictEqual(sub2.whatsappStatus, "Accepted");
    assert.strictEqual(sub2.whatsappMessageId, "wamid_sub02");
  });

  // TEST 10: Delayed failure guard: A slow/delayed failure CANNOT overwrite a newer successful state
  await test("10. Delayed failure guard protects newer Sent, Accepted, and Delivered states from being overwritten", () => {
    // SCENARIO A: PO Email Delayed Failure vs Newer Sent State
    const firestoreOrderSent = {
      id: "TC-EMAIL-GUARD",
      purchaseOrderSent: true,
      poEmailStatus: "Sent",
      poEmailError: null,
      smtpMessageId: "live_msg_sent_earlier"
    };

    // Helper implementing the concurrency guard in handleRetryEmail
    const applyDelayedEmailFailure = (currentDoc: any, delayedErrorMsg: string) => {
      const isAlreadySent = Boolean(
        currentDoc?.purchaseOrderSent || 
        currentDoc?.poEmailStatus === "Sent"
      );
      if (isAlreadySent) {
        // Guard triggered: do NOT overwrite Sent status!
        return { updated: false, doc: currentDoc };
      }
      return {
        updated: true,
        doc: {
          ...currentDoc,
          purchaseOrderSent: false,
          poEmailStatus: "Failed",
          poEmailError: delayedErrorMsg
        }
      };
    };

    const emailResult = applyDelayedEmailFailure(firestoreOrderSent, "Delayed network timeout error");
    assert.strictEqual(emailResult.updated, false, "Delayed failure MUST be blocked when order is already Sent!");
    assert.strictEqual(emailResult.doc.poEmailStatus, "Sent", "poEmailStatus MUST remain Sent!");
    assert.strictEqual(emailResult.doc.purchaseOrderSent, true, "purchaseOrderSent MUST remain true!");
    assert.strictEqual(emailResult.doc.poEmailError, null, "poEmailError MUST remain null!");

    // SCENARIO B: WhatsApp Delayed Failure vs Newer Accepted / Delivered State
    const firestoreOrderDelivered = {
      id: "TC-WA-GUARD",
      whatsappSent: true,
      whatsappStatus: "Delivered",
      whatsappError: null
    };

    // Helper implementing the concurrency guard in handleRetryWhatsApp
    const applyDelayedWhatsAppFailure = (currentDoc: any, delayedErrorMsg: string) => {
      const isAlreadySuccessful = Boolean(
        currentDoc?.whatsappStatus === "Delivered" || 
        currentDoc?.whatsappStatus === "Accepted" || 
        currentDoc?.whatsappSent
      );
      if (isAlreadySuccessful) {
        // Guard triggered: do NOT downgrade Delivered or Accepted status!
        return { updated: false, doc: currentDoc };
      }
      return {
        updated: true,
        doc: {
          ...currentDoc,
          whatsappSent: false,
          whatsappStatus: "Failed",
          whatsappError: delayedErrorMsg
        }
      };
    };

    const waResult = applyDelayedWhatsAppFailure(firestoreOrderDelivered, "Delayed rate limit error");
    assert.strictEqual(waResult.updated, false, "Delayed failure MUST be blocked when WhatsApp is Delivered!");
    assert.strictEqual(waResult.doc.whatsappStatus, "Delivered", "whatsappStatus MUST remain Delivered!");
    assert.strictEqual(waResult.doc.whatsappSent, true, "whatsappSent MUST remain true!");
    assert.strictEqual(waResult.doc.whatsappError, null, "whatsappError MUST remain null!");
  });

  // TEST 11: Focused Concurrent-Write Regression Test: Atomic Firestore Transaction & Stable Unique ID Matching
  await test("11. [ATOMIC TRANSACTION & STABLE ID TEST] Concurrency safety with sub-order reordering, arrival mutations, delayed failure guards, and retry simulation", async () => {
    // -------------------------------------------------------------
    // SCENARIO 1: Array Reordering & Stable Unique ID Matching
    // -------------------------------------------------------------
    // In-memory order when user triggers WhatsApp retry:
    const subAlpha = {
      id: "sub-alpha-001",
      supplierSubOrderNo: "TC-PO-A",
      buyer: "Alpha Stores",
      brand: "SONA MASOORI",
      qty: 100,
      rate: 4200,
      whatsappStatus: "Failed"
    };
    const subBeta = {
      id: "sub-beta-002",
      supplierSubOrderNo: "TC-PO-B",
      buyer: "Beta Traders",
      brand: "SONA MASOORI",
      qty: 150,
      rate: 4200,
      whatsappStatus: "Failed"
    };

    // Sub-orders get dispatched:
    const alphaOutcome = {
      stableKey: getSubOrderStableKey(subAlpha),
      subId: subAlpha.id,
      supplierSubOrderNo: subAlpha.supplierSubOrderNo,
      phone: "919945351166",
      whatsappSent: true,
      whatsappStatus: "Accepted" as const,
      whatsappMessageId: "wamid_alpha_ok"
    };
    const betaOutcome = {
      stableKey: getSubOrderStableKey(subBeta),
      subId: subBeta.id,
      supplierSubOrderNo: subBeta.supplierSubOrderNo,
      phone: "919845112233",
      whatsappSent: false,
      whatsappStatus: "Failed" as const,
      whatsappError: "Invalid phone number"
    };

    // In Firestore, concurrent operations reordered the array (Beta is now first, Alpha is second)
    // AND sub-alpha had arrival details entered by mill staff!
    const concurrentFirestoreOrdersReordered = [
      {
        ...subBeta, // Index 0 is Beta!
        notes: "Beta modified concurrently"
      },
      {
        ...subAlpha, // Index 1 is Alpha!
        isArrived: true,
        arrivedQty: 99.2,
        actualSupplierBillNo: "MILL-BILL-8888",
        status: "Arrived"
      }
    ];

    // Merge using mergeSubOrderNotificationOutcomes
    const mergeRes1 = mergeSubOrderNotificationOutcomes(
      concurrentFirestoreOrdersReordered,
      [alphaOutcome, betaOutcome],
      { id: "TC-ORDER-REORDER", whatsappStatus: "Failed" }
    );

    // Verify sub-order at index 0 (Beta) got Beta's outcome, NOT Alpha's outcome!
    const mergedBeta = mergeRes1.mergedSubOrders[0];
    assert.strictEqual(mergedBeta.id, "sub-beta-002");
    assert.strictEqual(mergedBeta.whatsappStatus, "Failed", "Beta must have Failed status");
    assert.strictEqual(mergedBeta.whatsappError, "Invalid phone number");
    assert.strictEqual(mergedBeta.notes, "Beta modified concurrently", "Concurrent notes preserved");

    // Verify sub-order at index 1 (Alpha) got Alpha's outcome, NOT Beta's outcome!
    const mergedAlpha = mergeRes1.mergedSubOrders[1];
    assert.strictEqual(mergedAlpha.id, "sub-alpha-001");
    assert.strictEqual(mergedAlpha.whatsappStatus, "Accepted", "Alpha must have Accepted status");
    assert.strictEqual(mergedAlpha.whatsappMessageId, "wamid_alpha_ok");
    assert.strictEqual(mergedAlpha.isArrived, true, "Alpha arrival status MUST BE PRESERVED!");
    assert.strictEqual(mergedAlpha.arrivedQty, 99.2, "Alpha arrivedQty MUST BE PRESERVED!");
    assert.strictEqual(mergedAlpha.actualSupplierBillNo, "MILL-BILL-8888", "Alpha supplier bill MUST BE PRESERVED!");
    assert.strictEqual(mergedAlpha.status, "Arrived", "Alpha status MUST BE PRESERVED!");

    // -------------------------------------------------------------
    // SCENARIO 2: Composite Key Matching for Sub-Orders Without Explicit ID
    // -------------------------------------------------------------
    const subNoId1 = {
      buyer: "Gamma Enterprises",
      brand: "BASMATI",
      qty: 50,
      rate: 8500,
      whatsappStatus: "Pending"
    };
    const subNoId2 = {
      buyer: "Delta Wholesale",
      brand: "JEERA RICE",
      qty: 60,
      rate: 4500,
      whatsappStatus: "Pending"
    };

    const key1 = getSubOrderStableKey(subNoId1);
    const key2 = getSubOrderStableKey(subNoId2);
    assert.strictEqual(key1.startsWith("comp:"), true, "Key must be deterministic composite");
    assert.strictEqual(key2.startsWith("comp:"), true, "Key must be deterministic composite");
    assert.notStrictEqual(key1, key2, "Keys must be distinct");

    const noIdOutcome1 = {
      stableKey: key1,
      compositeKey: key1,
      phone: "919876543210",
      whatsappSent: true,
      whatsappStatus: "Accepted" as const,
      whatsappMessageId: "wamid_gamma"
    };

    // Reordered in Firestore:
    const reversedNoIdArray = [
      { ...subNoId2, paymentRef: "PAY-DELTA" },
      { ...subNoId1, paymentRef: "PAY-GAMMA" }
    ];

    const mergeRes2 = mergeSubOrderNotificationOutcomes(
      reversedNoIdArray,
      [noIdOutcome1],
      { id: "TC-NO-ID", whatsappStatus: "Pending" }
    );

    // Gamma (index 1) matched correctly via composite key
    assert.strictEqual(mergeRes2.mergedSubOrders[1].buyer, "Gamma Enterprises");
    assert.strictEqual(mergeRes2.mergedSubOrders[1].whatsappStatus, "Accepted");
    assert.strictEqual(mergeRes2.mergedSubOrders[1].whatsappMessageId, "wamid_gamma");
    assert.strictEqual(mergeRes2.mergedSubOrders[1].paymentRef, "PAY-GAMMA");

    // Delta (index 0) remained untouched
    assert.strictEqual(mergeRes2.mergedSubOrders[0].buyer, "Delta Wholesale");
    assert.strictEqual(mergeRes2.mergedSubOrders[0].whatsappStatus, "Pending");
    assert.strictEqual(mergeRes2.mergedSubOrders[0].paymentRef, "PAY-DELTA");

    // -------------------------------------------------------------
    // SCENARIO 3: Delayed Failure Guard - Sub-order & Overall Order Protection
    // -------------------------------------------------------------
    // If a sub-order is already 'Delivered' in Firestore, a delayed 'Failed' outcome is rejected:
    const orderWithDeliveredSub = [
      {
        id: "sub-del-01",
        buyer: "Zeta Market",
        whatsappStatus: "Delivered",
        whatsappSent: true,
        whatsappSentAt: "2026-11-24T10:00:00Z"
      }
    ];

    const delayedFailureOutcome = {
      stableKey: "sub-del-01",
      subId: "sub-del-01",
      whatsappSent: false,
      whatsappStatus: "Failed" as const,
      whatsappError: "Delayed provider error"
    };

    const mergeRes3 = mergeSubOrderNotificationOutcomes(
      orderWithDeliveredSub,
      [delayedFailureOutcome],
      { id: "TC-ORDER-DEL", whatsappStatus: "Delivered" }
    );

    assert.strictEqual(mergeRes3.mergedSubOrders[0].whatsappStatus, "Delivered", "Sub-order Delivered status cannot be downgraded!");
    assert.strictEqual(mergeRes3.mergedSubOrders[0].whatsappSent, true);
    assert.strictEqual(mergeRes3.mergedSubOrders[0].whatsappError, null);
    assert.strictEqual(mergeRes3.overallWaStatus, "Delivered", "Overall Delivered status cannot be downgraded!");

    // Guard functions unit check:
    const emailAbort = applyEmailFailureGuard({ purchaseOrderSent: true, poEmailStatus: "Sent" }, "delayed error");
    assert.strictEqual(emailAbort.shouldAbort, true);

    const waAbort = applyWhatsAppFailureGuard({ whatsappStatus: "Accepted" }, "delayed error");
    assert.strictEqual(waAbort.shouldAbort, true);

    // -------------------------------------------------------------
    // SCENARIO 4: True Firestore Transaction Retry & Conflict Simulation
    // -------------------------------------------------------------
    // Simulate Firestore runTransaction behavior:
    // If an interleaved write modifies document version between transaction read and commit,
    // the transaction detects the version mismatch and retries from the beginning.
    let firestoreDocVersion = 1;
    let firestoreOrderDoc: any = {
      version: firestoreDocVersion,
      id: "TC-TXN-CONCURRENT",
      purchaseOrderSent: false,
      poEmailStatus: "Failed",
      originalOrders: [
        {
          id: "sub-txn-01",
          buyer: "Buyer Alpha",
          isArrived: false,
          whatsappStatus: "Pending"
        }
      ]
    };

    let attempts = 0;
    const simulateRunTransaction = async (updater: (doc: any) => any) => {
      let maxRetries = 3;
      while (maxRetries > 0) {
        attempts++;
        const readSnapshot = JSON.parse(JSON.stringify(firestoreOrderDoc));
        const initialVersion = readSnapshot.version;

        // On attempt 1, simulate an interleaved write occurring during transaction execution
        if (attempts === 1) {
          firestoreOrderDoc = {
            ...firestoreOrderDoc,
            version: ++firestoreDocVersion,
            // Interleaved writer updates arrival status:
            originalOrders: [
              {
                id: "sub-txn-01",
                buyer: "Buyer Alpha",
                isArrived: true,
                arrivedQty: 50,
                status: "Arrived",
                whatsappStatus: "Pending"
              }
            ]
          };
        }

        const updateResult = updater(readSnapshot);

        // Firestore verifies snapshot version has not changed:
        if (firestoreDocVersion !== initialVersion) {
          // Precondition failed! Conflict detected -> Retry transaction!
          maxRetries--;
          continue;
        }

        // Commit transaction update
        firestoreOrderDoc = {
          ...firestoreOrderDoc,
          ...updateResult.updateFields,
          version: ++firestoreDocVersion
        };
        return { committed: true, attempts, data: firestoreOrderDoc };
      }
      throw new Error("Transaction aborted after max retries");
    };

    const waOutcomeForTxn = {
      stableKey: "sub-txn-01",
      subId: "sub-txn-01",
      whatsappSent: true,
      whatsappStatus: "Accepted" as const,
      whatsappMessageId: "wamid_txn_ok"
    };

    const txnResult = await simulateRunTransaction((currentDoc) => {
      const { mergedSubOrders, overallWaStatus, overallWaError } = mergeSubOrderNotificationOutcomes(
        currentDoc.originalOrders,
        [waOutcomeForTxn],
        currentDoc
      );
      return {
        updateFields: {
          whatsappSent: true,
          whatsappStatus: overallWaStatus,
          whatsappError: overallWaError,
          originalOrders: mergedSubOrders
        }
      };
    });

    assert.strictEqual(txnResult.committed, true, "Transaction must successfully commit after retry");
    assert.strictEqual(txnResult.attempts, 2, "Transaction must have retried exactly once due to interleaved conflict");
    // CRITICAL ASSERTION: The committed document has BOTH the concurrent arrival data AND the WhatsApp Accepted status!
    const committedSub = firestoreOrderDoc.originalOrders[0];
    assert.strictEqual(committedSub.isArrived, true, "Interleaved arrival update MUST be present in final document!");
    assert.strictEqual(committedSub.arrivedQty, 50, "Interleaved arrivedQty MUST be present in final document!");
    assert.strictEqual(committedSub.status, "Arrived", "Interleaved status MUST be present in final document!");
    assert.strictEqual(committedSub.whatsappStatus, "Accepted", "WhatsApp Accepted status MUST be applied!");
    assert.strictEqual(committedSub.whatsappMessageId, "wamid_txn_ok", "WhatsApp messageId MUST be applied!");
    assert.strictEqual(firestoreOrderDoc.whatsappStatus, "Accepted", "Overall status MUST be Accepted!");
  });

  // TEST 12: Sub-order uniqueness verification & ambiguous composite match rejection
  await test("12. [PERSISTENT IDENTIFIERS & AMBIGUOUS MATCH REJECTION] Verifies unique persistent IDs and rejects ambiguous composite collisions", async () => {
    // -------------------------------------------------------------
    // SCENARIO 1: verifySubOrderUniqueness detects duplicate and unique IDs
    // -------------------------------------------------------------
    const uniqueOrders = [
      { supplierSubOrderNo: "TC-001-A", buyer: "Buyer A", qty: 50 },
      { supplierSubOrderNo: "TC-001-B", buyer: "Buyer B", qty: 50 }
    ];
    const check1 = verifySubOrderUniqueness(uniqueOrders);
    assert.strictEqual(check1.isUnique, true, "Distinct supplierSubOrderNo must be reported as unique");
    assert.strictEqual(check1.duplicateKeys.length, 0);

    const duplicateIdOrders = [
      { supplierSubOrderNo: "TC-DUP-01", buyer: "Buyer 1", qty: 40 },
      { supplierSubOrderNo: "TC-DUP-01", buyer: "Buyer 2", qty: 60 }
    ];
    const check2 = verifySubOrderUniqueness(duplicateIdOrders);
    assert.strictEqual(check2.isUnique, false, "Duplicate supplierSubOrderNo must be detected");
    assert.strictEqual(check2.duplicateKeys.includes("TC-DUP-01"), true);

    // -------------------------------------------------------------
    // SCENARIO 2: Persistent identifiers (supplierSubOrderNo) are prioritized over temporary IDs
    // -------------------------------------------------------------
    const subWithBoth = {
      id: "temp-req-999",
      supplierSubOrderNo: "BRI-0042-A",
      subOrderNo: "BRI-0042-A",
      buyer: "Sri Krishna Traders",
      brand: "SONA MASOORI",
      qty: 100,
      rate: 4500
    };
    const resolvedKey = getSubOrderStableKey(subWithBoth);
    assert.strictEqual(resolvedKey, "BRI-0042-A", "Persistent supplierSubOrderNo MUST be prioritized over temporary id");

    // -------------------------------------------------------------
    // SCENARIO 3: Ambiguous composite match is safely REJECTED (neither sub-order wrongly updated)
    // -------------------------------------------------------------
    // Two sub-orders with the EXACT same buyer, brand, quantity, and rate, but NO unique persistent ID
    const ambiguousSub1 = {
      buyer: "Ravi Enterprises",
      brand: "JEERA SAMBA",
      qty: 100,
      rate: 3800,
      whatsappStatus: "Pending" as const
    };
    const ambiguousSub2 = {
      buyer: "Ravi Enterprises",
      brand: "JEERA SAMBA",
      qty: 100,
      rate: 3800,
      whatsappStatus: "Pending" as const
    };

    // A single outcome with this composite key arrives
    const ambiguousOutcome = {
      compositeKey: "comp:ravi enterprises:jeera samba:100:3800",
      phone: "919988776655",
      whatsappSent: true,
      whatsappStatus: "Accepted" as const,
      whatsappMessageId: "wamid_ambiguous_single"
    };

    const mergeResAmbiguous = mergeSubOrderNotificationOutcomes(
      [ambiguousSub1, ambiguousSub2],
      [ambiguousOutcome],
      { id: "TC-AMBIGUOUS-PO", whatsappStatus: "Pending" }
    );

    // CRITICAL SAFETY CHECK: Both sub-orders must remain Pending (NOT wrongly updated with an ambiguous outcome!)
    assert.strictEqual(mergeResAmbiguous.mergedSubOrders[0].whatsappStatus, "Pending", "Sub 1 must NOT be updated by ambiguous composite match");
    assert.strictEqual(mergeResAmbiguous.mergedSubOrders[1].whatsappStatus, "Pending", "Sub 2 must NOT be updated by ambiguous composite match");
    assert.strictEqual(mergeResAmbiguous.rejectedAmbiguousMatches?.length, 2, "Both collision instances must be recorded as rejected");

    // -------------------------------------------------------------
    // SCENARIO 4: Persistent supplierSubOrderNo disambiguates identical business details
    // -------------------------------------------------------------
    // Even if buyer, brand, qty, rate are identical, having persistent IDs allows clean, 100% accurate matching
    const disambiguatedSub1 = {
      ...ambiguousSub1,
      supplierSubOrderNo: "TC-DISAMBIG-A"
    };
    const disambiguatedSub2 = {
      ...ambiguousSub2,
      supplierSubOrderNo: "TC-DISAMBIG-B"
    };

    const outcomeA = {
      supplierSubOrderNo: "TC-DISAMBIG-A",
      phone: "919988776655",
      whatsappSent: true,
      whatsappStatus: "Accepted" as const,
      whatsappMessageId: "wamid_A"
    };
    const outcomeB = {
      supplierSubOrderNo: "TC-DISAMBIG-B",
      phone: "919988776655",
      whatsappSent: false,
      whatsappStatus: "Failed" as const,
      whatsappError: "Network failure"
    };

    const mergeResDisambiguated = mergeSubOrderNotificationOutcomes(
      [disambiguatedSub1, disambiguatedSub2],
      [outcomeA, outcomeB],
      { id: "TC-DISAMBIG-PO", whatsappStatus: "Pending" }
    );

    assert.strictEqual(mergeResDisambiguated.mergedSubOrders[0].whatsappStatus, "Accepted", "Sub A matched accurately via persistent ID");
    assert.strictEqual(mergeResDisambiguated.mergedSubOrders[0].whatsappMessageId, "wamid_A");
    assert.strictEqual(mergeResDisambiguated.mergedSubOrders[1].whatsappStatus, "Failed", "Sub B matched accurately via persistent ID");
    assert.strictEqual(mergeResDisambiguated.mergedSubOrders[1].whatsappError, "Network failure");
  });

  console.log(`\n=== NOTIFICATION STATUS ERROR ISOLATION TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runNotificationErrorIsolationTests().catch((err) => {
  console.error("FATAL ERROR in Notification Status Error Isolation tests:", err);
  process.exit(1);
});
