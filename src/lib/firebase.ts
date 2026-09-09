import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  getDocs, 
  setDoc, 
  addDoc,
  doc, 
  deleteDoc, 
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firestoreDbId);

export const auth = getAuth();

// CRITICAL CONSTRAINT: Test connection upon boot & auto-seed Firestore collections
async function testConnection() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.warn("Firebase connection status: Browser is currently offline. Will retry once connection is restored.");
    return;
  }
  try {
    // Attempting a connection test by fetching a dummy path
    await getDocFromServer(doc(db, 'arrival_entries', 'connection_test_dummy'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase connection: Client appears offline. Working in offline fallback mode.");
    } else {
      console.log("Firebase initialized. Connection check completed:", error instanceof Error ? error.message : String(error));
    }
  }

  // Auto-seed empty collections so all collections are immediately visible in Firebase Console
  ensureFirestoreSeeded().catch(err => console.warn("Firestore seed check notice:", err));
}

let hasAttemptedSeed = false;

// Auto-seed Firestore collections if they don't contain documents yet
export async function ensureFirestoreSeeded(): Promise<void> {
  if (hasAttemptedSeed) return;
  hasAttemptedSeed = true;
  try {
    if (typeof window !== 'undefined' && sessionStorage.getItem('firestore_seeded') === 'true') {
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('firestore_seeded', 'true');
    }
  } catch (e) {
    console.warn('Storage warning during seed check:', e);
  }

  // In production deployment mode, seedCollections is empty so no test data is auto-inserted
  const seedCollections: { [key: string]: any[] } = {};

  for (const [colName, seedDocs] of Object.entries(seedCollections)) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty && !localStorage.getItem(`cleared_${colName}`)) {
        let deletedProcSet = new Set<string>();
        if (colName === 'procurement_requests') {
          try {
            const rawDel = localStorage.getItem('deleted_procurement_ids');
            if (rawDel) {
              const parsed = JSON.parse(rawDel);
              if (Array.isArray(parsed)) {
                deletedProcSet = new Set(parsed.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
              }
            }
          } catch (e) {}
        } else if (colName === 'product_inventory') {
          try {
            const rawDel = localStorage.getItem('deleted_product_inventory_ids');
            if (rawDel) {
              const parsed = JSON.parse(rawDel);
              if (Array.isArray(parsed)) {
                deletedProcSet = new Set(parsed.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
              }
            }
          } catch (e) {}
        } else if (colName === 'ledgers') {
          if (localStorage.getItem('ledger_cleared_all') === 'true') {
            continue;
          }
          try {
            const rawDel = localStorage.getItem('deleted_ledger_ids');
            if (rawDel) {
              const parsed = JSON.parse(rawDel);
              if (Array.isArray(parsed)) {
                deletedProcSet = new Set(parsed.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
              }
            }
          } catch (e) {}
        } else if (colName === 'placed_orders') {
          if (localStorage.getItem('placed_orders_cleared_all') === 'true' || localStorage.getItem('cleared_placed_orders') === 'true') {
            continue;
          }
        }

        console.log(`Seeding empty collection in Firestore: ${colName}`);
        for (const seedItem of seedDocs) {
          const seedNorm = String(seedItem.id || '').trim().toLowerCase().replace(/^#/, '');
          if (!deletedProcSet.has(seedNorm)) {
            await setDoc(doc(db, colName, seedItem.id), seedItem, { merge: true });
          }
        }
      }
    } catch (e) {
      console.warn(`Seed check skipped for ${colName}:`, e);
      break; // Stop seeding attempts if rate limit or quota is exceeded
    }
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection().catch(err => console.warn('Background connection check notice:', err));
  }, 100);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper: Get all documents from a collection with automatic LocalStorage fallback
export async function getCollectionDocs(collectionName: string): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: any[] = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    if (collectionName === 'procurement_requests') {
      try {
        const rawDel = localStorage.getItem('deleted_procurement_ids');
        if (rawDel) {
          const deletedSet = new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
          return items.filter(item => {
            const norm = String(item.id || '').trim().toLowerCase().replace(/^#/, '');
            return !deletedSet.has(norm);
          });
        }
      } catch (e) {}
    }

    if (collectionName === 'product_inventory') {
      try {
        const rawDel = localStorage.getItem('deleted_product_inventory_ids');
        if (rawDel) {
          const deletedSet = new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
          return items.filter(item => {
            const norm = String(item.id || '').trim().toLowerCase().replace(/^#/, '');
            return !deletedSet.has(norm);
          });
        }
      } catch (e) {}
    }

    if (collectionName === 'ledgers') {
      try {
        const rawDel = localStorage.getItem('deleted_ledger_ids');
        if (rawDel) {
          const deletedSet = new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
          return items.filter(item => {
            const norm = String(item.id || '').trim().toLowerCase().replace(/^#/, '');
            return !deletedSet.has(norm);
          });
        }
      } catch (e) {}
    }

    return items;
  } catch (error) {
    console.warn(`Firestore getCollectionDocs notice for ${collectionName}:`, error);
    if (typeof window !== 'undefined') {
      try {
        const localKey = collectionName === 'arrival_entries' ? 'arrival_entry_data_v4' : collectionName;
        const cached = localStorage.getItem(localKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            if (collectionName === 'procurement_requests') {
              try {
                const rawDel = localStorage.getItem('deleted_procurement_ids');
                if (rawDel) {
                  const deletedSet = new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
                  return parsed.filter((item: any) => {
                    const norm = String(item.id || '').trim().toLowerCase().replace(/^#/, '');
                    return !deletedSet.has(norm);
                  });
                }
              } catch (e) {}
            }
            if (collectionName === 'ledgers') {
              try {
                const rawDel = localStorage.getItem('deleted_ledger_ids');
                if (rawDel) {
                  const deletedSet = new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
                  return parsed.filter((item: any) => {
                    const norm = String(item.id || '').trim().toLowerCase().replace(/^#/, '');
                    return !deletedSet.has(norm);
                  });
                }
              } catch (e) {}
            }
            return parsed;
          }
        }
      } catch (e) {
        console.warn('LocalStorage fallback read error:', e);
      }
    }
    return [];
  }
}

// Helper: Set/Write a specific document by ID (ensures presence under both raw and hash-prefixed IDs in Firestore)
export async function setCollectionDoc(collectionName: string, docId: string, data: any): Promise<void> {
  try {
    const rawId = String(docId).replace(/^#/, '');
    const cleanData = JSON.parse(JSON.stringify(data));
    
    await Promise.all([
      setDoc(doc(db, collectionName, rawId), cleanData, { merge: true }),
      setDoc(doc(db, collectionName, `#${rawId}`), cleanData, { merge: true })
    ]);
  } catch (error) {
    console.warn(`Firestore setDoc warning for ${collectionName}/${docId}:`, error);
  }
}

// Helper: Add a document with auto-generated ID
export async function addCollectionDoc(collectionName: string, data: any): Promise<any> {
  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    const docRef = await addDoc(collection(db, collectionName), cleanData);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.warn(`Firestore addDoc warning for ${collectionName}:`, error);
    return { id: `local-${Date.now()}`, ...data };
  }
}

// Helper: Delete a document
export async function deleteCollectionDoc(collectionName: string, docId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.warn(`Firestore deleteCollectionDoc notice for ${collectionName}/${docId}:`, error);
  }
}

// Helper: Thoroughly clear all Firestore collections and LocalStorage for arrival entry, payments, orders, and ledgers
export async function clearAllFirestoreAndLocalData(): Promise<void> {
  const collectionsToClear = [
    'arrival_entries',
    'placed_orders',
    'procurement_requests',
    'ledgers',
    'product_inventory',
    'patti_history',
    'stakeholders_v2',
    'stakeholders',
    'complaints',
    'store_catalog',
    'store_config'
  ];
  for (const colName of collectionsToClear) {
    try {
      const snapshot = await getDocs(collection(db, colName));
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, colName, docSnap.id)));
      await Promise.all(deletePromises);
      console.log(`Cleared Firestore collection: ${colName}`);
    } catch (e) {
      console.warn(`Error clearing collection ${colName}:`, e);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('arrival_entry_data_v4');
    localStorage.removeItem('arrival_entry_sheets_v4');
    localStorage.removeItem('placed_orders');
    localStorage.removeItem('procurement_requests');
    localStorage.removeItem('ledgers');
    localStorage.removeItem('just_placed_order');
    localStorage.removeItem('product_inventory');
    localStorage.removeItem('stakeholders_v2');
    localStorage.removeItem('deleted_product_inventory_ids');
    localStorage.removeItem('deleted_procurement_ids');
    localStorage.removeItem('deleted_ledger_ids');
    localStorage.removeItem('deleted_stakeholder_ids');
  }
}

// Helper: Update a document
export async function updateCollectionDoc(collectionName: string, docId: string, data: any): Promise<void> {
  try {
    await updateDoc(doc(db, collectionName, docId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${docId}`);
  }
}

// Global Sync helper to persist entire arrays (acting as a dual-write fallback + server-synced cloud storage)
export async function syncCollection(collectionName: string, localData: any[]): Promise<void> {
  if (!Array.isArray(localData) || localData.length === 0) return;
  try {
    // Filter out blank or empty spacer items to prevent sending hundreds of empty network calls
    const meaningfulItems = localData.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (collectionName === 'arrival_entries') {
        return !!(item.partyName || item.millerName || item.billNo || item.vehicleNo || item.gatePassNo || item.qty || item.netAmt || item.rate || item.itemDesc || item.buyer);
      }
      return true;
    });

    const promises = meaningfulItems.map(async (item, idx) => {
      try {
        const docId = item.id || `row-${idx}`;
        const cleanItem = JSON.parse(JSON.stringify(item));
        await setDoc(doc(db, collectionName, docId), cleanItem, { merge: true });
      } catch (e) {
        console.warn(`Failed to sync item ${item?.id || idx} in ${collectionName}:`, e);
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.warn(`Background sync issue for ${collectionName}:`, error);
  }
}

// Helper: Create ledger entries for placed orders automatically
export async function createLedgerEntriesForOrder(groupedOrder: any): Promise<void> {
  try {
    const poNo = groupedOrder.id;
    const date = groupedOrder.date || (() => {
      const d = new Date();
      const day = d.getDate();
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const m = monthNames[d.getMonth()];
      const yyyy = d.getFullYear();
      return `${day}-${m}-${yyyy}`;
    })();
    
    // We create entries for each sub-order if they exist (contains real individual supplier + buyer names)
    const ledgerEntries: any[] = [];
    
    if (groupedOrder.originalOrders && groupedOrder.originalOrders.length > 0) {
      groupedOrder.originalOrders.forEach((sub: any) => {
        const qty = sub.qty || 10;
        const rate = sub.rate || 4200;
        const amount = qty * rate;

        // 1. Buyer/Shop entry
        const buyerEntry = {
          id: `LEDG-B-${Math.floor(100000 + Math.random() * 900000)}`,
          purchaseOrderNo: poNo,
          date,
          partyName: sub.buyer || groupedOrder.buyer || "Standard Buyer",
          partyType: 'Buyer',
          qty,
          amount,
          status: 'Placed'
        };

        // 2. Supplier/Miller entry
        const supplierEntry = {
          id: `LEDG-S-${Math.floor(100000 + Math.random() * 900000)}`,
          purchaseOrderNo: poNo,
          date,
          partyName: sub.supplier || "Amritsar Grain Export Ltd.",
          partyType: 'Supplier',
          qty,
          amount,
          status: 'Placed'
        };
        ledgerEntries.push(buyerEntry, supplierEntry);
      });
    } else {
      // Fallback if there are no sub-orders
      const totalQty = parseFloat(groupedOrder.items?.match(/\d+(\.\d+)?/)?.[0] || groupedOrder.totalQty || "10");
      const totalAmount = parseFloat(groupedOrder.total?.replace(/[^0-9]/g, '') || "42000");

      const buyerEntry = {
        id: `LEDG-B-${Math.floor(100000 + Math.random() * 900000)}`,
        purchaseOrderNo: poNo,
        date,
        partyName: groupedOrder.buyer || "Standard Buyer",
        partyType: 'Buyer',
        qty: totalQty,
        amount: totalAmount,
        status: 'Placed'
      };

      const supplierEntry = {
        id: `LEDG-S-${Math.floor(100000 + Math.random() * 900000)}`,
        purchaseOrderNo: poNo,
        date,
        partyName: "Amritsar Grain Export Ltd.",
        partyType: 'Supplier',
        qty: totalQty,
        amount: totalAmount,
        status: 'Placed'
      };
      ledgerEntries.push(buyerEntry, supplierEntry);
    }

    // Save to Firestore 'ledgers'
    for (const entry of ledgerEntries) {
      await setDoc(doc(db, 'ledgers', entry.id), entry);
    }

    // Also update LocalStorage as a dual-write fallback
    const existingLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');
    localStorage.setItem('ledgers', JSON.stringify([...ledgerEntries, ...existingLedgers]));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'ledgers');
  }
}

// Helper: Mark ledger entries as Arrived automatically using purchaseOrderNo
export async function markLedgerEntriesAsArrived(
  poNo: string, 
  targetOrder?: any,
  customQtys?: {[subId: string]: number}, 
  customRates?: {[subId: string]: number}
): Promise<void> {
  try {
    const cloudLedgers = await getCollectionDocs('ledgers').catch(() => []);
    const localLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');

    const ledgersToSave: any[] = [];
    const mergedLedgersMap = new Map<string, any>();
    localLedgers.forEach((l: any) => { if (l && l.id) mergedLedgersMap.set(l.id, l); });
    cloudLedgers.forEach((l: any) => { if (l && l.id) mergedLedgersMap.set(l.id, l); });

    const allLedgers = Array.from(mergedLedgersMap.values());
    const poLedgers = allLedgers.filter((l: any) => l.purchaseOrderNo === poNo);

    poLedgers.forEach((l: any) => {
      let originalQty = Number(l.qty) || 0;
      let originalRate = originalQty > 0 ? (Number(l.amount) / originalQty) : 4200;
      let arrivedQty = originalQty;
      let arrivedRate = originalRate;

      if (targetOrder && targetOrder.originalOrders && targetOrder.originalOrders.length > 0) {
        const matchingSub = targetOrder.originalOrders.find((sub: any) => {
          if (l.partyType === 'Buyer') {
            return sub.buyer === l.partyName;
          } else {
            return (sub.supplier || sub.seller || targetOrder.origin) === l.partyName;
          }
        });

        if (matchingSub) {
          const subId = matchingSub.id || '';
          originalQty = parseFloat(matchingSub.qty) || parseFloat(matchingSub.totalQty) || originalQty;
          originalRate = parseFloat(matchingSub.rate) || originalRate;

          if (customQtys && customQtys[subId] !== undefined) {
            arrivedQty = customQtys[subId];
          }
          if (customRates && customRates[subId] !== undefined) {
            arrivedRate = customRates[subId];
          }
        }
      } else if (targetOrder) {
        if (customQtys && customQtys[poNo] !== undefined) {
          arrivedQty = customQtys[poNo];
        }
        if (customRates && customRates[poNo] !== undefined) {
          arrivedRate = customRates[poNo];
        }
      }

      if (arrivedQty < originalQty && arrivedQty > 0) {
        // 1. Arrived portion
        l.status = 'Arrived';
        l.qty = arrivedQty;
        l.amount = arrivedQty * arrivedRate;

        // 2. Pending portion (balance qtl pending to be loaded)
        const pendingEntryId = `${l.id}-pending-${Math.floor(1000 + Math.random() * 9000)}`;
        const pendingEntry = {
          ...l,
          id: pendingEntryId,
          qty: originalQty - arrivedQty,
          amount: (originalQty - arrivedQty) * originalRate,
          status: 'Placed'
        };
        ledgersToSave.push(pendingEntry);
      } else {
        l.status = 'Arrived';
        l.qty = arrivedQty;
        l.amount = arrivedQty * arrivedRate;
      }

      ledgersToSave.push(l);
    });

    const cloudPromises = ledgersToSave.map((l: any) => {
      return setDoc(doc(db, 'ledgers', l.id), l);
    });
    await Promise.all(cloudPromises);

    const updatedLocalMap = new Map<string, any>();
    localLedgers.forEach((l: any) => { if (l && l.id) updatedLocalMap.set(l.id, l); });
    ledgersToSave.forEach((l: any) => {
      updatedLocalMap.set(l.id, l);
    });

    const finalLocalList = Array.from(updatedLocalMap.values());
    localStorage.setItem('ledgers', JSON.stringify(finalLocalList));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ledgers-update-${poNo}`);
  }
}

// Helper: Automatically create high-speed arrival entry log row when order status goes to Arrived
export async function autoCreateArrivalEntryForIncomingLog(
  orderId: string, 
  targetOrder: any,
  customQtys?: {[subId: string]: number}, 
  customRates?: {[subId: string]: number},
  customBillNo?: string
): Promise<string> {
  try {
    if (!targetOrder) return orderId;

    const dateStr = new Date().toISOString().split('T')[0];

    // 1. Read local sheets and local single data
    const rawSheets = localStorage.getItem('arrival_entry_sheets_v4');
    let sheets: any[] = [];
    if (rawSheets) {
      try {
        sheets = JSON.parse(rawSheets);
      } catch (e) {
        sheets = [];
      }
    }

    if (!Array.isArray(sheets) || sheets.length === 0) {
      const localSingle = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      sheets = [{ id: 'sheet-1', name: 'All Arrivals (Main)', data: Array.isArray(localSingle) && localSingle.length > 0 ? localSingle : [] }];
    }

    // Main sheet data grid
    const mainSheetIndex = sheets.findIndex(s => s.id === 'sheet-1' || s.name?.includes('Main')) !== -1 
      ? sheets.findIndex(s => s.id === 'sheet-1' || s.name?.includes('Main')) 
      : 0;
    
    let currentGrid: any[] = Array.isArray(sheets[mainSheetIndex]?.data) ? [...sheets[mainSheetIndex].data] : [];

    // Ensure grid has at least 30 rows
    while (currentGrid.length < 30) {
      currentGrid.push({ id: `row-empty-${Date.now()}-${currentGrid.length}`, date: dateStr });
    }

    // 2. Formulate the arrival entries to inject
    const newItemsToInject: any[] = [];

    if (targetOrder.originalOrders && targetOrder.originalOrders.length > 0) {
      targetOrder.originalOrders.forEach((sub: any, sIdx: number) => {
        const subId = sub.id || `sub-${sIdx}`;
        const qty = (customQtys && customQtys[subId] !== undefined) ? customQtys[subId] : (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 10);
        const rate = (customRates && customRates[subId] !== undefined) ? customRates[subId] : (parseFloat(sub.rate) || 4200);
        const amount = qty * rate;
        const normPo = String(orderId).trim().toUpperCase().replace(/^#/, '');
        const bNo = customBillNo?.trim() || targetOrder.actualSupplierBillNo || targetOrder.billNo || sub.billNo || `BIL-${Math.floor(1000 + Math.random() * 9000)}`;

        const partyName = sub.redirectedTo || (sub.isLifted ? targetOrder.currentShop : null) || sub.buyer || targetOrder.currentShop || targetOrder.redirectedShop || targetOrder.buyer || targetOrder.partyName || "V.K FOODS";
        const isLifted = !!(sub.redirectedTo || sub.isLifted || targetOrder.currentShop || targetOrder.redirectedShop || (targetOrder.liftingRecords && targetOrder.liftingRecords.length > 0));

        newItemsToInject.push({
          date: dateStr,
          millerName: sub.supplier || sub.seller || targetOrder.origin || targetOrder.supplier || "ANNAPURNA RICE & AGRO INDUSTRIES",
          place: sub.location || targetOrder.location || "MIRYALGUDA",
          brand: sub.brand || targetOrder.brand || targetOrder.product || "1121 Sella Rice",
          partyName,
          noOfDays: 0,
          noOfDayRec: 'Not Cleared',
          area: sub.area || targetOrder.area || "4TH BLOCK",
          billNo: bNo,
          qty,
          rate,
          amount: amount.toFixed(2),
          lh: 0,
          cc: 0,
          tds: 0,
          shortage: 0,
          seller: sub.supplier || sub.seller || targetOrder.origin || targetOrder.supplier || "ANNAPURNA RICE & AGRO INDUSTRIES",
          diffIn: 0,
          netAmt: amount.toFixed(2),
          chqAm: 0,
          chqNo: '',
          chqDt: '',
          bank: '',
          purchaseOrderNo: normPo,
          isLifted,
          originalBuyer: sub.buyer || targetOrder.originalBuyer || targetOrder.buyer || '',
          redirectedTo: partyName,
          lastUpdated: new Date().toISOString()
        });
      });
    } else {
      const totalQty = (customQtys && customQtys[orderId] !== undefined) 
        ? customQtys[orderId] 
        : parseFloat(targetOrder.items?.match(/\d+(\.\d+)?/)?.[0] || targetOrder.totalQty || targetOrder.qty || "10");
      const rate = (customRates && customRates[orderId] !== undefined) 
        ? customRates[orderId] 
        : (parseFloat(targetOrder.rate) || 4200);
      const amount = totalQty * rate;
      const normPo = String(orderId).trim().toUpperCase().replace(/^#/, '');
      const bNo = customBillNo?.trim() || targetOrder.actualSupplierBillNo || targetOrder.billNo || `BIL-${Math.floor(1000 + Math.random() * 9000)}`;

      const partyName = targetOrder.currentShop || targetOrder.redirectedShop || targetOrder.buyer || targetOrder.partyName || "V.K FOODS";
      const isLifted = !!(targetOrder.currentShop || targetOrder.redirectedShop || (targetOrder.liftingRecords && targetOrder.liftingRecords.length > 0));

      newItemsToInject.push({
        date: dateStr,
        millerName: targetOrder.supplier || targetOrder.seller || targetOrder.origin || "ANNAPURNA RICE & AGRO INDUSTRIES",
        place: targetOrder.location || "MIRYALGUDA",
        brand: targetOrder.product || targetOrder.brand || "1121 Sella Rice",
        partyName,
        noOfDays: 0,
        noOfDayRec: 'Not Cleared',
        area: targetOrder.area || "4TH BLOCK",
        billNo: bNo,
        qty: totalQty,
        rate,
        amount: amount.toFixed(2),
        lh: 0,
        cc: 0,
        tds: 0,
        shortage: 0,
        seller: targetOrder.supplier || targetOrder.seller || targetOrder.origin || "ANNAPURNA RICE & AGRO INDUSTRIES",
        diffIn: 0,
        netAmt: amount.toFixed(2),
        chqAm: 0,
        chqNo: '',
        chqDt: '',
        bank: '',
        purchaseOrderNo: normPo,
        isLifted,
        originalBuyer: targetOrder.originalBuyer || targetOrder.buyer || '',
        redirectedTo: partyName,
        lastUpdated: new Date().toISOString()
      });
    }

    const firstBillNo = newItemsToInject[0]?.billNo || orderId;

    // 3. Insert or update items in currentGrid
    newItemsToInject.forEach(newItem => {
      // Look for existing row with matching purchaseOrderNo or billNo
      const existingIdx = currentGrid.findIndex((r: any) => 
        r && (
          (r.purchaseOrderNo && String(r.purchaseOrderNo).trim().toUpperCase().replace(/^#/, '') === String(newItem.purchaseOrderNo).trim().toUpperCase().replace(/^#/, '')) ||
          (r.billNo && String(r.billNo).trim().toUpperCase() === String(newItem.billNo).trim().toUpperCase())
        )
      );

      if (existingIdx !== -1) {
        currentGrid[existingIdx] = {
          ...currentGrid[existingIdx],
          ...newItem,
          id: currentGrid[existingIdx].id || `row-${existingIdx}`
        };
      } else {
        // Find first blank row
        let blankIdx = currentGrid.findIndex((r: any) => !r || (!r.purchaseOrderNo && !r.partyName && !r.millerName && (!r.qty || parseFloat(r.qty) === 0)));
        if (blankIdx !== -1) {
          currentGrid[blankIdx] = { ...newItem, id: `row-${blankIdx}` };
        } else {
          currentGrid.push({ ...newItem, id: `row-${currentGrid.length}` });
        }
      }
    });

    // 4. Save back to localStorage synchronously
    sheets[mainSheetIndex] = {
      ...sheets[mainSheetIndex],
      data: currentGrid
    };
    localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(sheets));
    localStorage.setItem('arrival_entry_data_v4', JSON.stringify(currentGrid));

    // Save goto_arrival_bill so ArrivalEntry highlights it
    sessionStorage.setItem('goto_arrival_bill', firstBillNo);

    // 5. Dual-write to Cloud Firestore asynchronously
    const cloudFormatted = currentGrid.map((row, idx) => ({
      ...row,
      id: `row-${idx}`,
      sheetId: sheets[mainSheetIndex]?.id || 'sheet-1',
      sheetName: sheets[mainSheetIndex]?.name || 'All Arrivals (Main)'
    }));
    syncCollection('arrival_entries', cloudFormatted).catch(e => console.error('Cloud arrival entry sync error:', e));

    return firstBillNo;
  } catch (error) {
    console.error("Arrival Registry creation error:", error);
    return orderId;
  }
}

// Helper: Update party ledger entries when an order or vehicle is lifted / redirected to a new shop
export async function updateLedgersForLifting(
  orderId: string,
  liftingShopName: string,
  liftingBillNo: string,
  liftingRecord: any,
  selectedSubOrderIds?: string[]
): Promise<void> {
  try {
    const rawLocal = localStorage.getItem('ledgers');
    let localLedgers: any[] = rawLocal ? JSON.parse(rawLocal) : [];
    
    let updated = false;
    const normPo = String(orderId).trim().toUpperCase().replace(/^#/, '');

    const updatedLedgers = localLedgers.map((l: any) => {
      if (!l) return l;
      
      const poInLedger = String(l.purchaseOrderNo || '').trim().toUpperCase().replace(/^#/, '');
      const isMatchingPO = poInLedger === normPo || l.id?.includes(orderId);
      
      if (isMatchingPO) {
        if (l.partyType === 'Buyer') {
          updated = true;
          return {
            ...l,
            originalPartyName: l.originalPartyName || l.partyName,
            partyName: liftingShopName,
            billNo: liftingBillNo || l.billNo,
            isLifted: true,
            liftingShopName,
            notes: `LIFTED TO ${liftingShopName} (Bill #${liftingBillNo || l.billNo || 'N/A'})`
          };
        }
      }
      return l;
    });

    if (updated) {
      localStorage.setItem('ledgers', JSON.stringify(updatedLedgers));
      await syncCollection('ledgers', updatedLedgers).catch(err => console.error("Cloud ledgers sync error:", err));
    }
  } catch (err) {
    console.error("Error updating ledgers for lifting:", err);
  }
}

