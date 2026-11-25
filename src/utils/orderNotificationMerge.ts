/**
 * Order Notification Concurrency & Sub-Order Merging Utilities
 * 
 * Provides concurrency-safe merging and stable unique ID resolution for sub-orders,
 * preventing race conditions between concurrent business data writes (arrivals, bills, payments)
 * and asynchronous notification updates (WhatsApp, PO Email).
 */

/**
 * Returns a stable, deterministic identifier for a sub-order.
 * Prioritizes persistent identifiers (supplierSubOrderNo, subOrderNo) over temporary/request IDs.
 * NEVER relies on array index or positional order.
 */
export function getSubOrderStableKey(sub: any): string {
  if (!sub || typeof sub !== 'object') return '';
  
  // 1. Persistent identifiers (supplierSubOrderNo is canonical in Tejas Canvassing)
  if (sub.supplierSubOrderNo && String(sub.supplierSubOrderNo).trim()) {
    return String(sub.supplierSubOrderNo).trim();
  }
  if (sub.subOrderNo && String(sub.subOrderNo).trim()) {
    return String(sub.subOrderNo).trim();
  }
  // 2. Primary document/entity ID
  if (sub.id && String(sub.id).trim()) {
    return String(sub.id).trim().replace(/^#/, '');
  }
  // 3. Secondary order references
  if (sub.itemRef && String(sub.itemRef).trim()) {
    return String(sub.itemRef).trim();
  }
  if (sub.buyerRequestNo && String(sub.buyerRequestNo).trim()) {
    return String(sub.buyerRequestNo).trim();
  }
  if (sub.orderNo && String(sub.orderNo).trim()) {
    return String(sub.orderNo).trim();
  }

  // 4. Deterministic composite identity from invariant business fields (NOT array index!)
  const buyer = String(sub.buyer || '').trim().toLowerCase();
  const brand = String(sub.brand || sub.product || '').trim().toLowerCase();
  const qty = String(sub.qty || '').trim();
  const rate = String(sub.rate || '').trim();
  if (buyer || brand) {
    return `comp:${buyer}:${brand}:${qty}:${rate}`;
  }
  return '';
}

export interface SubOrderUniquenessCheck {
  isUnique: boolean;
  duplicateKeys: string[];
  keyCounts: Record<string, number>;
}

/**
 * Verifies whether all sub-orders within a grouped PO possess unique identifiers.
 */
export function verifySubOrderUniqueness(subOrders: any[]): SubOrderUniquenessCheck {
  if (!Array.isArray(subOrders) || subOrders.length <= 1) {
    return { isUnique: true, duplicateKeys: [], keyCounts: {} };
  }

  const counts: Record<string, number> = {};
  subOrders.forEach((sub) => {
    const key = getSubOrderStableKey(sub);
    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const duplicateKeys = Object.keys(counts).filter((k) => counts[k] > 1);
  return {
    isUnique: duplicateKeys.length === 0,
    duplicateKeys,
    keyCounts: counts
  };
}

export interface SubOrderNotificationOutcome {
  stableKey?: string;
  subId?: string | null;
  supplierSubOrderNo?: string | null;
  subOrderNo?: string | null;
  buyerRequestNo?: string | null;
  orderNo?: string | null;
  compositeKey?: string | null;
  phone?: string;
  whatsappSent: boolean;
  whatsappStatus: 'Accepted' | 'Delivered' | 'Failed' | 'Pending';
  whatsappError?: string | null;
  whatsappMessageId?: string;
  whatsappSentAt?: string;
  adminCopySent?: boolean;
}

export interface MergeNotificationResult {
  mergedSubOrders: any[];
  overallWaStatus: 'Accepted' | 'Delivered' | 'Failed' | 'Pending';
  overallWaError: string | null;
  anySubDelivered: boolean;
  allSubsAcceptedOrDelivered: boolean;
  anySubFailed: boolean;
  rejectedAmbiguousMatches?: string[];
  duplicateIdentifiersFound?: string[];
}

/**
 * Merges WhatsApp notification outcomes into current originalOrders from Firestore.
 * Matches strictly by stable unique IDs / keys (NO positional array index fallback).
 * Prioritizes persistent identifiers (supplierSubOrderNo).
 * Rejects ambiguous composite matches rather than updating the wrong sub-order.
 * Guards against overwriting newer successful Delivered / Accepted states with delayed failures.
 * Preserves all concurrent mutations on sub-orders (arrival, billing, quantities, rates).
 */
export function mergeSubOrderNotificationOutcomes(
  currentOriginalOrders: any[],
  outcomes: SubOrderNotificationOutcome[],
  currentOrderData?: any
): MergeNotificationResult {
  const safeCurrentOrders = Array.isArray(currentOriginalOrders) && currentOriginalOrders.length > 0
    ? currentOriginalOrders
    : (currentOrderData ? [currentOrderData] : []);

  // 1. Verify sub-order identifier uniqueness within this grouped PO
  const uniquenessCheck = verifySubOrderUniqueness(safeCurrentOrders);
  const duplicateKeysSet = new Set(uniquenessCheck.duplicateKeys);
  const rejectedAmbiguousMatches: string[] = [];

  // 2. Count composite keys across current sub-orders to detect ambiguous composites
  const currentCompositeCounts = new Map<string, number>();
  safeCurrentOrders.forEach((sub) => {
    const buyer = String(sub.buyer || '').trim().toLowerCase();
    const brand = String(sub.brand || sub.product || '').trim().toLowerCase();
    const qty = String(sub.qty || '').trim();
    const rate = String(sub.rate || '').trim();
    if (buyer || brand) {
      const compKey = `comp:${buyer}:${brand}:${qty}:${rate}`;
      currentCompositeCounts.set(compKey, (currentCompositeCounts.get(compKey) || 0) + 1);
    }
  });

  // 3. Count outcomes by composite key to detect multiple matching outcomes
  const outcomeCompositeCounts = new Map<string, number>();
  outcomes.forEach((outcome) => {
    if (outcome.compositeKey) {
      outcomeCompositeCounts.set(outcome.compositeKey, (outcomeCompositeCounts.get(outcome.compositeKey) || 0) + 1);
    }
  });

  // 4. Index outcomes by persistent IDs and unique stable keys
  const persistentOutcomeMap = new Map<string, SubOrderNotificationOutcome>();
  const explicitIdOutcomeMap = new Map<string, SubOrderNotificationOutcome>();
  const compositeOutcomeMap = new Map<string, SubOrderNotificationOutcome>();

  outcomes.forEach((outcome) => {
    if (outcome.supplierSubOrderNo && String(outcome.supplierSubOrderNo).trim()) {
      persistentOutcomeMap.set(String(outcome.supplierSubOrderNo).trim(), outcome);
    }
    if (outcome.subOrderNo && String(outcome.subOrderNo).trim()) {
      persistentOutcomeMap.set(String(outcome.subOrderNo).trim(), outcome);
    }
    if (outcome.subId && String(outcome.subId).trim()) {
      explicitIdOutcomeMap.set(String(outcome.subId).trim().replace(/^#/, ''), outcome);
    }
    if (outcome.buyerRequestNo && String(outcome.buyerRequestNo).trim()) {
      explicitIdOutcomeMap.set(String(outcome.buyerRequestNo).trim(), outcome);
    }
    if (outcome.orderNo && String(outcome.orderNo).trim()) {
      explicitIdOutcomeMap.set(String(outcome.orderNo).trim(), outcome);
    }
    if (outcome.stableKey && !outcome.stableKey.startsWith('comp:')) {
      explicitIdOutcomeMap.set(outcome.stableKey, outcome);
    }
    if (outcome.compositeKey) {
      compositeOutcomeMap.set(outcome.compositeKey, outcome);
    } else if (outcome.stableKey && outcome.stableKey.startsWith('comp:')) {
      compositeOutcomeMap.set(outcome.stableKey, outcome);
    }
  });

  // Track matched outcome references so a single outcome cannot be applied to multiple sub-orders
  const matchedOutcomes = new Set<SubOrderNotificationOutcome>();

  const mergedSubOrders = safeCurrentOrders.map((latestSub: any) => {
    let match: SubOrderNotificationOutcome | undefined = undefined;

    // A. Priority 1: Persistent identifier (supplierSubOrderNo, subOrderNo)
    const supplierSubNo = latestSub.supplierSubOrderNo ? String(latestSub.supplierSubOrderNo).trim() : '';
    const subNo = latestSub.subOrderNo ? String(latestSub.subOrderNo).trim() : '';

    if (supplierSubNo && !duplicateKeysSet.has(supplierSubNo) && persistentOutcomeMap.has(supplierSubNo)) {
      match = persistentOutcomeMap.get(supplierSubNo);
    } else if (subNo && !duplicateKeysSet.has(subNo) && persistentOutcomeMap.has(subNo)) {
      match = persistentOutcomeMap.get(subNo);
    }

    // B. Priority 2: Explicit ID (sub.id, itemRef, buyerRequestNo, orderNo)
    if (!match) {
      const subId = latestSub.id ? String(latestSub.id).trim().replace(/^#/, '') : '';
      const itemRef = latestSub.itemRef ? String(latestSub.itemRef).trim() : '';
      const reqNo = latestSub.buyerRequestNo ? String(latestSub.buyerRequestNo).trim() : '';
      const oNo = latestSub.orderNo ? String(latestSub.orderNo).trim() : '';

      if (subId && !duplicateKeysSet.has(subId) && explicitIdOutcomeMap.has(subId)) {
        match = explicitIdOutcomeMap.get(subId);
      } else if (itemRef && !duplicateKeysSet.has(itemRef) && explicitIdOutcomeMap.has(itemRef)) {
        match = explicitIdOutcomeMap.get(itemRef);
      } else if (reqNo && !duplicateKeysSet.has(reqNo) && explicitIdOutcomeMap.has(reqNo)) {
        match = explicitIdOutcomeMap.get(reqNo);
      } else if (oNo && !duplicateKeysSet.has(oNo) && explicitIdOutcomeMap.has(oNo)) {
        match = explicitIdOutcomeMap.get(oNo);
      }
    }

    // C. Priority 3: Composite fallback with strict ambiguity rejection
    if (!match) {
      const buyer = String(latestSub.buyer || '').trim().toLowerCase();
      const brand = String(latestSub.brand || latestSub.product || '').trim().toLowerCase();
      const qty = String(latestSub.qty || '').trim();
      const rate = String(latestSub.rate || '').trim();
      const compKey = (buyer || brand) ? `comp:${buyer}:${brand}:${qty}:${rate}` : '';

      if (compKey) {
        const isAmbiguousInCurrent = (currentCompositeCounts.get(compKey) || 0) > 1;
        const isAmbiguousInOutcomes = (outcomeCompositeCounts.get(compKey) || 0) > 1;

        if (isAmbiguousInCurrent || isAmbiguousInOutcomes) {
          // Requirement 3: Reject ambiguous composite matches rather than updating the wrong sub-order
          console.warn(`[mergeSubOrderNotificationOutcomes] Rejected ambiguous composite match for key "${compKey}" (current occurrences: ${currentCompositeCounts.get(compKey)}, outcome occurrences: ${outcomeCompositeCounts.get(compKey)})`);
          rejectedAmbiguousMatches.push(compKey);
          return latestSub; // Preserve completely untouched!
        }

        if (compositeOutcomeMap.has(compKey)) {
          match = compositeOutcomeMap.get(compKey);
        }
      }
    }

    // If no match was resolved, or the match was already claimed by another sub-order:
    if (!match || matchedOutcomes.has(match)) {
      // Sub-order not targeted or ambiguous: preserve 100% as-is
      return latestSub;
    }

    // Mark outcome as matched
    matchedOutcomes.add(match);

    const isSubAlreadySuccessful = latestSub.whatsappStatus === 'Delivered' || latestSub.whatsappStatus === 'Accepted';
    
    // Delayed failure guard: Do NOT downgrade an already Delivered or Accepted sub-order with a delayed failure
    if (isSubAlreadySuccessful && match.whatsappStatus === 'Failed') {
      return {
        ...latestSub,
        whatsappError: null
      };
    }

    return {
      ...latestSub,
      phone: match.phone || latestSub.phone,
      whatsappSent: isSubAlreadySuccessful ? true : match.whatsappSent,
      whatsappStatus: isSubAlreadySuccessful ? latestSub.whatsappStatus : match.whatsappStatus,
      whatsappError: isSubAlreadySuccessful ? null : (match.whatsappError || null),
      whatsappMessageId: match.whatsappMessageId || latestSub.whatsappMessageId,
      whatsappSentAt: isSubAlreadySuccessful ? latestSub.whatsappSentAt : (match.whatsappSentAt || latestSub.whatsappSentAt)
    };
  });

  const isOverallAlreadyDelivered = Boolean(
    currentOrderData?.whatsappStatus === 'Delivered'
  );
  const isOverallAlreadyAccepted = Boolean(
    currentOrderData?.whatsappStatus === 'Accepted'
  );

  const anySubDelivered = mergedSubOrders.some((s: any) => s.whatsappStatus === 'Delivered');
  const allSubsAcceptedOrDelivered = mergedSubOrders.length > 0 && mergedSubOrders.every((s: any) => s.whatsappStatus === 'Accepted' || s.whatsappStatus === 'Delivered');
  const anySubFailed = mergedSubOrders.some((s: any) => s.whatsappStatus === 'Failed');

  let overallWaStatus: 'Accepted' | 'Delivered' | 'Failed' | 'Pending' = 'Pending';
  if (anySubDelivered || isOverallAlreadyDelivered) {
    overallWaStatus = 'Delivered';
  } else if (allSubsAcceptedOrDelivered || isOverallAlreadyAccepted) {
    overallWaStatus = 'Accepted';
  } else if (anySubFailed) {
    // Delayed failure guard on order-level: if already Accepted or Delivered, do NOT overwrite with Failed!
    if (isOverallAlreadyDelivered) {
      overallWaStatus = 'Delivered';
    } else if (isOverallAlreadyAccepted) {
      overallWaStatus = 'Accepted';
    } else {
      overallWaStatus = 'Failed';
    }
  }

  const overallWaError = (overallWaStatus === 'Delivered' || overallWaStatus === 'Accepted')
    ? null
    : (mergedSubOrders.find((s: any) => s.whatsappError)?.whatsappError || null);

  return {
    mergedSubOrders,
    overallWaStatus,
    overallWaError,
    anySubDelivered,
    allSubsAcceptedOrDelivered,
    anySubFailed,
    rejectedAmbiguousMatches,
    duplicateIdentifiersFound: uniquenessCheck.duplicateKeys
  };
}

/**
 * Concurrency guard for PO Email failure writes.
 * If the order is already in a Sent state, aborts the write so delayed failures never overwrite success.
 */
export function applyEmailFailureGuard(
  currentOrderData: any,
  errorMsg: string
): { shouldAbort: boolean; abortReason?: string; updateFields?: Record<string, any> } {
  const isAlreadySent = Boolean(
    currentOrderData?.purchaseOrderSent ||
    currentOrderData?.poEmailStatus === 'Sent'
  );

  if (isAlreadySent) {
    return {
      shouldAbort: true,
      abortReason: 'Order is already marked as Sent for PO email'
    };
  }

  return {
    shouldAbort: false,
    updateFields: {
      purchaseOrderSent: false,
      poEmailStatus: 'Failed' as const,
      poEmailError: errorMsg
    }
  };
}

/**
 * Concurrency guard for WhatsApp failure writes.
 * If the order is already in an Accepted or Delivered state, aborts the write.
 */
export function applyWhatsAppFailureGuard(
  currentOrderData: any,
  errorMsg: string
): { shouldAbort: boolean; abortReason?: string; updateFields?: Record<string, any> } {
  const isAlreadySuccessful = Boolean(
    currentOrderData?.whatsappStatus === 'Delivered' ||
    currentOrderData?.whatsappStatus === 'Accepted' ||
    currentOrderData?.whatsappSent
  );

  if (isAlreadySuccessful) {
    return {
      shouldAbort: true,
      abortReason: 'Order is already in a successful WhatsApp state (Accepted or Delivered)'
    };
  }

  return {
    shouldAbort: false,
    updateFields: {
      whatsappSent: false,
      whatsappStatus: 'Failed' as const,
      whatsappError: errorMsg
    }
  };
}
