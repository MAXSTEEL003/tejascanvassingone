import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  getDocs, 
  setDoc, 
  addDoc,
  doc, 
  deleteDoc, 
  updateDoc,
  getDoc,
  getDocFromServer,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeSupplierName } from './utils';

// Initialize Firebase App safely (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore safely with singleton persistence across reloads/HMR
const globalScope = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
let firestoreInstance: Firestore;

if (globalScope.__tejas_firestore_instance__) {
  firestoreInstance = globalScope.__tejas_firestore_instance__;
} else {
  try {
    let localCacheSetting: any = undefined;
    if (typeof window !== 'undefined') {
      try {
        localCacheSetting = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
      } catch (cacheErr) {
        console.warn("Firestore persistent cache notice:", cacheErr);
      }
    }

    firestoreInstance = initializeFirestore(app, {
      ...(localCacheSetting ? { localCache: localCacheSetting } : {}),
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch (err: any) {
    // If initializeFirestore() was already called with different options (e.g. HMR, multiple imports, or re-renders):
    // Gracefully return the existing instance via getFirestore() as instructed by Firebase
    console.info("Firestore already initialized, reusing existing instance:", err?.message || err);
    try {
      firestoreInstance = firebaseConfig.firestoreDatabaseId 
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);
    } catch (fallbackErr) {
      firestoreInstance = getFirestore(app);
    }
  }

  globalScope.__tejas_firestore_instance__ = firestoreInstance;
}

export const db = firestoreInstance;

export const auth = getAuth(app);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Background connection test (deferred to idle time so it doesn't block initial page load)
async function testConnection() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.warn("Firebase connection status: Browser is currently offline. Will retry once connection is restored.");
    return;
  }
  try {
    // Non-blocking connectivity probe
    await getDoc(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const errCode = error?.code || '';
    if (errMsg.includes('the client is offline') || errCode === 'unavailable' || errMsg.includes('unavailable')) {
      console.warn("Firebase connection: Client is operating in offline/fallback mode until connection is restored.");
    } else {
      console.log("Firebase connection check completed:", errMsg);
    }
  }

  // Auto-seed empty collections so all collections are immediately visible in Firebase Console
  ensureFirestoreSeeded().catch(err => console.warn("Firestore seed check notice:", err));
}

let hasAttemptedSeed = false;

// Auto-seed Firestore collections (No-op in production)
export async function ensureFirestoreSeeded(): Promise<void> {
  if (hasAttemptedSeed) return;
  hasAttemptedSeed = true;
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection().catch(err => console.warn('Background connection check notice:', err));
  }, 4000);
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

// Helper: Determine caller role from authenticated tokens/session without circular imports
export function getCurrentCallerRole(): 'admin' | 'employee' | 'merchant' | null {
  try {
    const user = auth.currentUser;
    if (user?.email) {
      const email = user.email.toLowerCase().trim();
      if (email === 'nani@tejasc.in' || email === 'tejasadinarayan@gmail.com' || email === 'tejascanvassing@gmail.com') {
        return 'admin';
      }
    }
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('tejas_auth_token_v1') || localStorage.getItem('tejas_auth_token_v1')) : null;
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.role) return payload.role;
        } catch {}
      }
    }
    const sessionUser = typeof window !== 'undefined' ? (sessionStorage.getItem('tejas_auth_user_v1') || localStorage.getItem('tejas_auth_user_v1')) : null;
    if (sessionUser) {
      try {
        const parsed = JSON.parse(sessionUser);
        if (parsed.role) return parsed.role;
      } catch {}
    }
    const rawRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    if (rawRole === 'merchant' || rawRole === 'employee' || rawRole === 'admin') {
      return rawRole as any;
    }
  } catch {}
  return null;
}

// Helper: Get single document from a collection with strict role guard
export async function getSingleDoc(collectionName: string, docId: string): Promise<any | null> {
  if (!docId) return null;
  const callerRole = getCurrentCallerRole();

  // Strict role isolation: Merchants cannot query ledgers, patti, pending_loadings, or other stakeholders
  if (callerRole === 'merchant') {
    if (collectionName === 'ledgers' || collectionName === 'patti' || collectionName === 'pending_loadings') {
      console.warn(`[Security Guard] Merchant query blocked for single doc in ${collectionName}/${docId}`);
      return null;
    }
    if (collectionName === 'stakeholders') {
      const myUid = auth.currentUser?.uid || localStorage.getItem('userId');
      if (myUid && docId !== myUid) {
        console.warn(`[Security Guard] Merchant blocked from inspecting foreign stakeholder document: ${docId}`);
        return null;
      }
    }
  }

  // Staff cannot query corporate financial ledgers or patti
  if (callerRole === 'employee' && (collectionName === 'ledgers' || collectionName === 'patti')) {
    console.warn(`[Security Guard] Staff query blocked for single doc in ${collectionName}/${docId}`);
    return null;
  }

  try {
    const rawId = String(docId).trim().replace(/^#/, '');
    const docRef = doc(db, collectionName, rawId);
    let snap = await getDoc(docRef);
    if (!snap.exists()) {
      snap = await getDoc(doc(db, collectionName, `#${rawId}`));
    }
    if (snap.exists()) {
      return { id: rawId, ...snap.data() };
    }
  } catch (e) {
    console.warn(`Firestore getSingleDoc notice for ${collectionName}/${docId}:`, e);
  }

  // Fallback to local storage if available
  if (typeof window !== 'undefined') {
    try {
      const localKey = collectionName === 'arrival_entries' ? 'arrival_entry_data_v4' : collectionName;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const rawId = String(docId).trim().replace(/^#/, '');
          return parsed.find((item: any) => String(item.id || '').replace(/^#/, '') === rawId) || null;
        }
      }
    } catch {}
  }
  return null;
}

interface CollectionCacheEntry {
  data: any[];
  timestamp: number;
}

const collectionCache = new Map<string, CollectionCacheEntry>();
const inFlightQueries = new Map<string, Promise<any[]>>();
const CACHE_TTL_MS = 60000; // 60-second in-memory freshness window

export function invalidateCollectionCache(collectionName?: string) {
  if (collectionName) {
    collectionCache.delete(collectionName);
    inFlightQueries.delete(collectionName);
  } else {
    collectionCache.clear();
    inFlightQueries.clear();
  }
}

// Helper to retrieve local storage backup for instant hydration on boot & refresh (0ms delay)
function getLocalBackup(collectionName: string): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Honor explicit user wipes
    if (collectionName === 'placed_orders') {
      if (localStorage.getItem('cleared_placed_orders') === 'true' || localStorage.getItem('placed_orders_cleared_all') === 'true') {
        const raw = localStorage.getItem('placed_orders');
        if (!raw || raw === '[]') return [];
      }
    } else if (collectionName === 'procurement_requests') {
      if (localStorage.getItem('cleared_procurement_requests') === 'true') {
        const raw = localStorage.getItem('procurement_requests');
        if (!raw || raw === '[]') return [];
      }
    } else if (collectionName === 'ledgers') {
      if (localStorage.getItem('cleared_ledgers') === 'true') {
        const raw = localStorage.getItem('ledgers');
        if (!raw || raw === '[]') return [];
      }
    }

    // 2. Candidate storage keys (prefer canonical dataset keys first)
    const candidateKeys: string[] = [];
    if (collectionName === 'arrival_entries') {
      candidateKeys.push('arrival_entry_data_v4');
    } else if (collectionName === 'arrival_sheets') {
      candidateKeys.push('arrival_entry_sheets_v4');
    } else if (collectionName === 'stakeholders') {
      candidateKeys.push('stakeholders_v2');
    } else if (collectionName === 'product_inventory') {
      candidateKeys.push('product_inventory');
    } else if (collectionName === 'placed_orders') {
      candidateKeys.push('placed_orders');
    } else if (collectionName === 'procurement_requests') {
      candidateKeys.push('procurement_requests');
    } else if (collectionName === 'ledgers') {
      candidateKeys.push('ledgers');
    }
    candidateKeys.push(`firestore_cache_${collectionName}`);
    candidateKeys.push(collectionName);

    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (collectionName === 'placed_orders') {
            const isWiped = localStorage.getItem('cleared_placed_orders') === 'true' || localStorage.getItem('placed_orders_cleared_all') === 'true';
            if (isWiped && parsed.length === 0) return [];
            const delRaw = localStorage.getItem('deleted_placed_order_ids');
            if (delRaw) {
              const delSet = new Set(JSON.parse(delRaw).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
              return parsed.filter((item: any) => item && item.id && !delSet.has(String(item.id).trim().toLowerCase().replace(/^#/, '')));
            }
          }
          return parsed;
        }
        if (collectionName === 'stakeholders' && parsed && typeof parsed === 'object') {
          const flat: any[] = [];
          if (Array.isArray(parsed.suppliers)) {
            flat.push(...parsed.suppliers.map((s: any) => ({ ...s, type: 'suppliers' })));
          }
          if (Array.isArray(parsed.buyers)) {
            flat.push(...parsed.buyers.map((b: any) => ({ ...b, type: 'buyers' })));
          }
          if (flat.length > 0) return flat;
        }
      }
    }
  } catch (e) {}
  return null;
}

// Background fresh fetch & sync worker
async function fetchAndSyncFreshCollection(collectionName: string): Promise<any[]> {
  const inFlight = inFlightQueries.get(collectionName);
  if (inFlight) {
    return inFlight;
  }

  const queryPromise = (async () => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const itemsMap = new Map<string, any>();
      
      querySnapshot.forEach((docSnap) => {
        const docData = docSnap.data();
        const rawId = docSnap.id.replace(/^#/, '');
        const canonicalKey = rawId.toLowerCase();

        const item = { id: rawId, ...docData };
        if (item.id && typeof item.id === 'string') {
          item.id = item.id.replace(/^#/, '');
        }

        // If already encountered, prefer un-prefixed canonical ID over '#'-prefixed
        if (!itemsMap.has(canonicalKey) || !docSnap.id.startsWith('#')) {
          itemsMap.set(canonicalKey, item);
        }
      });

      let items = Array.from(itemsMap.values());
      if (typeof window !== 'undefined') {
        if (collectionName === 'placed_orders') {
          const isWiped = localStorage.getItem('cleared_placed_orders') === 'true' || localStorage.getItem('placed_orders_cleared_all') === 'true';
          const rawPlaced = localStorage.getItem('placed_orders');
          if (isWiped && (!rawPlaced || rawPlaced === '[]')) {
            items = [];
          } else {
            const delRaw = localStorage.getItem('deleted_placed_order_ids');
            if (delRaw) {
              try {
                const delSet = new Set(JSON.parse(delRaw).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
                items = items.filter((item: any) => item && item.id && !delSet.has(String(item.id).trim().toLowerCase().replace(/^#/, '')));
              } catch {}
            }
          }
        } else if (collectionName === 'procurement_requests') {
          const delProcRaw = localStorage.getItem('deleted_procurement_ids');
          const delPlacedRaw = localStorage.getItem('deleted_placed_order_ids');
          const delSet = new Set<string>();
          if (delProcRaw) {
            try { JSON.parse(delProcRaw).forEach((id: string) => delSet.add(String(id).trim().toLowerCase().replace(/^#/, ''))); } catch {}
          }
          if (delPlacedRaw) {
            try { JSON.parse(delPlacedRaw).forEach((id: string) => delSet.add(String(id).trim().toLowerCase().replace(/^#/, ''))); } catch {}
          }
          if (delSet.size > 0) {
            items = items.filter((item: any) => item && item.id && !delSet.has(String(item.id).trim().toLowerCase().replace(/^#/, '')));
          }
        }
      }
      collectionCache.set(collectionName, { data: items, timestamp: Date.now() });

      // Save to localStorage for instant cold start on next refresh/launch
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`firestore_cache_${collectionName}`, JSON.stringify(items));
        } catch (e) {}

        // Global event dispatch so views can update reactively without freezing
        window.dispatchEvent(new CustomEvent('collection-synced', {
          detail: { collectionName, count: items.length }
        }));
      }

      return items;
    } catch (error: any) {
      console.warn(`Firestore getCollectionDocs notice for ${collectionName}:`, error?.message || error);
      if (typeof window !== 'undefined') {
        const localData = getLocalBackup(collectionName);
        if (localData) {
          collectionCache.set(collectionName, { data: localData, timestamp: Date.now() - (CACHE_TTL_MS - 5000) });
          return localData;
        }
      }
      return [];
    } finally {
      inFlightQueries.delete(collectionName);
    }
  })();

  inFlightQueries.set(collectionName, queryPromise);
  return queryPromise;
}

// Helper: Get all documents from a collection with SWR (Stale-While-Revalidate) instant rendering & strict role boundary
export async function getCollectionDocs(collectionName: string, forceFresh = false): Promise<any[]> {
  const callerRole = getCurrentCallerRole();

  // Strict data isolation:
  // 1. Merchants cannot query corporate financial ledgers, patti, pending loadings, arrival entries, or stakeholder lists
  if (callerRole === 'merchant') {
    const forbiddenForMerchant = ['ledgers', 'patti', 'pending_loadings', 'arrival_entries', 'stakeholders', 'users'];
    if (forbiddenForMerchant.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized merchant query to collection: ${collectionName}`);
      return [];
    }
  }

  // 2. Operations Staff cannot query corporate financial ledgers or patti
  if (callerRole === 'employee') {
    const forbiddenForEmployee = ['ledgers', 'patti', 'users'];
    if (forbiddenForEmployee.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized staff query to collection: ${collectionName}`);
      return [];
    }
  }

  // Fast path 1: Fresh in-memory cached data
  if (!forceFresh) {
    const cached = collectionCache.get(collectionName);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    // Fast path 2 (SWR): Instant LocalStorage Hydration for cold start & page refreshes (0ms delay)
    const localData = getLocalBackup(collectionName);
    if (localData && localData.length > 0) {
      // Seed in-memory cache temporarily
      collectionCache.set(collectionName, { data: localData, timestamp: Date.now() });

      // Silently revalidate fresh Firestore data in background
      fetchAndSyncFreshCollection(collectionName).catch(err => {
        console.warn(`Background revalidation notice for ${collectionName}:`, err?.message || err);
      });

      return localData;
    }

    // Deduplicate in-flight queries
    const inFlight = inFlightQueries.get(collectionName);
    if (inFlight) {
      return inFlight;
    }
  }

  // If forceFresh or no local data exists, await fresh fetch directly
  return fetchAndSyncFreshCollection(collectionName);
}

// Helper: Set/Write a specific document by ID with strict role isolation
export async function setCollectionDoc(collectionName: string, docId: string, data: any): Promise<void> {
  const callerRole = getCurrentCallerRole();

  if (callerRole === 'merchant') {
    const forbiddenForMerchant = ['ledgers', 'patti', 'pending_loadings', 'arrival_entries', 'product_inventory', 'users'];
    if (forbiddenForMerchant.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized merchant write to collection: ${collectionName}`);
      return;
    }
    if (collectionName === 'stakeholders') {
      const myUid = auth.currentUser?.uid || localStorage.getItem('userId');
      const cleanId = String(docId).replace(/^#/, '');
      if (myUid && cleanId !== myUid) {
        console.warn(`[Security Guard] Merchant blocked from writing to foreign stakeholder document: ${docId}`);
        return;
      }
    }
  }

  if (callerRole === 'employee') {
    const forbiddenForEmployee = ['ledgers', 'patti', 'users'];
    if (forbiddenForEmployee.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized staff write to collection: ${collectionName}`);
      return;
    }
  }

  try {
    const rawId = String(docId).trim().replace(/^#/, '');
    const cleanData = JSON.parse(JSON.stringify(data));
    if (cleanData && typeof cleanData === 'object' && cleanData.id) {
      cleanData.id = String(cleanData.id).trim().replace(/^#/, '');
    }
    
    // Write ONLY canonical rawId (Do NOT write duplicate '#id' document!)
    await setDoc(doc(db, collectionName, rawId), cleanData, { merge: true });

    // Clean up any legacy duplicate '#rawId' document in Firestore
    deleteDoc(doc(db, collectionName, `#${rawId}`)).catch(() => {});
    invalidateCollectionCache(collectionName);
  } catch (error) {
    console.warn(`Firestore setDoc warning for ${collectionName}/${docId}:`, error);
    throw error;
  }
}

// Helper: Add a document with auto-generated ID
export async function addCollectionDoc(collectionName: string, data: any): Promise<any> {
  const callerRole = getCurrentCallerRole();
  if (callerRole === 'merchant') {
    const forbiddenForMerchant = ['ledgers', 'patti', 'pending_loadings', 'arrival_entries', 'product_inventory', 'users'];
    if (forbiddenForMerchant.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized merchant addDoc to collection: ${collectionName}`);
      return { id: `denied-${Date.now()}` };
    }
  }
  if (callerRole === 'employee') {
    const forbiddenForEmployee = ['ledgers', 'patti', 'users'];
    if (forbiddenForEmployee.includes(collectionName)) {
      console.warn(`[Security Guard] Blocked unauthorized staff addDoc to collection: ${collectionName}`);
      return { id: `denied-${Date.now()}` };
    }
  }

  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    const docRef = await addDoc(collection(db, collectionName), cleanData);
    invalidateCollectionCache(collectionName);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.warn(`Firestore addDoc warning for ${collectionName}:`, error);
    return { id: `local-${Date.now()}`, ...data };
  }
}

// Helper: Delete a document with strict role boundary and deterministic multi-key cleanup
export async function deleteCollectionDoc(collectionName: string, docId: string): Promise<void> {
  const callerRole = getCurrentCallerRole();
  if (callerRole === 'merchant') {
    console.warn(`[Security Guard] Merchant forbidden from deleting document in: ${collectionName}/${docId}`);
    return;
  }
  if (callerRole === 'employee') {
    const forbiddenForEmployee = ['ledgers', 'patti', 'users', 'placed_orders'];
    if (forbiddenForEmployee.includes(collectionName)) {
      console.warn(`[Security Guard] Staff blocked from deleting document in: ${collectionName}/${docId}`);
      return;
    }
  }

  const rawId = String(docId).trim().replace(/^#/, '');
  const hashedId = `#${rawId}`;
  const targets = Array.from(new Set([docId, rawId, hashedId].filter(Boolean)));

  try {
    const results = await Promise.allSettled(
      targets.map(id => deleteDoc(doc(db, collectionName, id)))
    );
    const failure = results.find(r => r.status === 'rejected');
    if (failure && failure.status === 'rejected') {
      console.error(`Firestore deleteCollectionDoc failure for ${collectionName}/${docId}:`, failure.reason);
      throw failure.reason;
    }
    invalidateCollectionCache(collectionName);
  } catch (error) {
    console.warn(`Firestore deleteCollectionDoc notice for ${collectionName}/${docId}:`, error);
    throw error;
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

  invalidateCollectionCache();

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
    invalidateCollectionCache(collectionName);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${docId}`);
  }
}

// Global Sync helper to persist entire arrays in controlled batches with rate limit resilience
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

    if (meaningfulItems.length === 0) return;

    // Deduplicate items by canonical rawId
    const itemMap = new Map<string, any>();
    meaningfulItems.forEach((item, idx) => {
      const rawId = item.id ? String(item.id).trim().replace(/^#/, '') : `row-${idx}`;
      const cleanItem = JSON.parse(JSON.stringify(item));
      cleanItem.id = rawId;
      itemMap.set(rawId, cleanItem);
    });

    const uniqueItems = Array.from(itemMap.values());
    const BATCH_SIZE = 150;

    for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
      const chunk = uniqueItems.slice(i, i + BATCH_SIZE);
      let attempts = 0;
      let committed = false;

      while (attempts < 3 && !committed) {
        try {
          const batch = writeBatch(db);
          chunk.forEach((item) => {
            const docRef = doc(db, collectionName, item.id);
            batch.set(docRef, item, { merge: true });
          });
          await batch.commit();
          committed = true;
          if (i + BATCH_SIZE < uniqueItems.length) {
            await new Promise(res => setTimeout(res, 50));
          }
        } catch (err: any) {
          attempts++;
          console.warn(`[syncCollection] ${collectionName} batch attempt ${attempts} warning:`, err?.message || err);
          if (attempts >= 3) break;
          await new Promise(res => setTimeout(res, 300 * Math.pow(2, attempts - 1)));
        }
      }
    }

    invalidateCollectionCache(collectionName);
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
        const subBrand = sub.brand || sub.product || sub.variety || groupedOrder.brand || groupedOrder.product || "Standard Rice";

        // 1. Buyer/Shop entry
        const buyerEntry = {
          id: `LEDG-B-${Math.floor(100000 + Math.random() * 900000)}`,
          purchaseOrderNo: poNo,
          date,
          partyName: sub.buyer || groupedOrder.buyer || "Standard Buyer",
          partyType: 'Buyer',
          brand: subBrand,
          product: subBrand,
          qty,
          amount,
          status: 'Placed'
        };

        // 2. Supplier/Miller entry
        const supplierEntry = {
          id: `LEDG-S-${Math.floor(100000 + Math.random() * 900000)}`,
          purchaseOrderNo: poNo,
          date,
          partyName: sub.supplier || groupedOrder.supplier || "Amritsar Grain Export Ltd.",
          partyType: 'Supplier',
          brand: subBrand,
          product: subBrand,
          qty,
          amount,
          status: 'Placed'
        };
        ledgerEntries.push(buyerEntry, supplierEntry);
      });
    } else {
      // Fallback if there are no sub-orders
      const totalQty = parseFloat(groupedOrder.items?.match(/\d+(\.\d+)?/)?.[0] || groupedOrder.totalQty || groupedOrder.qty || "10");
      const totalAmount = parseFloat(groupedOrder.total?.replace(/[^0-9]/g, '') || String(totalQty * (groupedOrder.rate || 4200)));
      const brand = groupedOrder.brand || groupedOrder.product || "Standard Rice";

      const buyerEntry = {
        id: `LEDG-B-${Math.floor(100000 + Math.random() * 900000)}`,
        purchaseOrderNo: poNo,
        date,
        partyName: groupedOrder.buyer || "Standard Buyer",
        partyType: 'Buyer',
        brand,
        product: brand,
        qty: totalQty,
        amount: totalAmount,
        status: 'Placed'
      };

      const supplierEntry = {
        id: `LEDG-S-${Math.floor(100000 + Math.random() * 900000)}`,
        purchaseOrderNo: poNo,
        date,
        partyName: groupedOrder.supplier || "Amritsar Grain Export Ltd.",
        partyType: 'Supplier',
        brand,
        product: brand,
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
  customBillNo?: string | {[subId: string]: string},
  lhPerQtl?: number | {[subId: string]: number}
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
        
        const subCustomBill = (typeof customBillNo === 'object' && customBillNo !== null)
          ? (customBillNo[subId] || customBillNo[orderId] || '')
          : (typeof customBillNo === 'string' ? customBillNo : '');
        const bNo = subCustomBill.trim() || sub.actualSupplierBillNo || sub.billNo || targetOrder.actualSupplierBillNo || targetOrder.billNo || `BIL-${Math.floor(1000 + Math.random() * 9000)}`;

        const partyName = sub.redirectedTo || (sub.isLifted ? targetOrder.currentShop : null) || sub.buyer || targetOrder.currentShop || targetOrder.redirectedShop || targetOrder.buyer || targetOrder.partyName || "General Merchant";
        const isLifted = !!(sub.redirectedTo || sub.isLifted || targetOrder.currentShop || targetOrder.redirectedShop || (targetOrder.liftingRecords && targetOrder.liftingRecords.length > 0));

        const subMiller = sanitizeSupplierName(sub.supplier || sub.seller || targetOrder.origin || targetOrder.supplier, "DIRECT MILL");

        const subLhRate = (typeof lhPerQtl === 'object' && lhPerQtl !== null)
          ? (lhPerQtl[subId] !== undefined ? Number(lhPerQtl[subId]) : (lhPerQtl[orderId] !== undefined ? Number(lhPerQtl[orderId]) : 0))
          : (typeof lhPerQtl === 'number' ? lhPerQtl : (sub.lhPerQtl || targetOrder.lhPerQtl || 0));

        const subLh = subLhRate > 0
          ? Math.round(qty * subLhRate)
          : (parseFloat(String(sub.lh || 0)) || 0);
        const netAmt = Math.max(0, amount - subLh);

        newItemsToInject.push({
          date: dateStr,
          millerName: subMiller,
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
          lh: subLh > 0 ? subLh : 0,
          lhPerQtl: subLhRate || 0,
          cc: 0,
          tds: 0,
          shortage: 0,
          seller: subMiller,
          diffIn: 0,
          netAmt: netAmt.toFixed(2),
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
      
      const singleCustomBill = (typeof customBillNo === 'object' && customBillNo !== null)
        ? (customBillNo[orderId] || '')
        : (typeof customBillNo === 'string' ? customBillNo : '');
      const bNo = singleCustomBill.trim() || targetOrder.actualSupplierBillNo || targetOrder.billNo || `BIL-${Math.floor(1000 + Math.random() * 9000)}`;

      const partyName = targetOrder.currentShop || targetOrder.redirectedShop || targetOrder.buyer || targetOrder.partyName || "General Merchant";
      const isLifted = !!(targetOrder.currentShop || targetOrder.redirectedShop || (targetOrder.liftingRecords && targetOrder.liftingRecords.length > 0));

      const orderMiller = sanitizeSupplierName(targetOrder.supplier || targetOrder.seller || targetOrder.origin, "DIRECT MILL");

      const singleLhRate = (typeof lhPerQtl === 'object' && lhPerQtl !== null)
        ? (lhPerQtl[orderId] !== undefined ? Number(lhPerQtl[orderId]) : 0)
        : (typeof lhPerQtl === 'number' ? lhPerQtl : (targetOrder.lhPerQtl || 0));

      const singleLh = singleLhRate > 0
        ? Math.round(totalQty * singleLhRate)
        : (parseFloat(String(targetOrder.lh || 0)) || 0);
      const netAmt = Math.max(0, amount - singleLh);

      newItemsToInject.push({
        date: dateStr,
        millerName: orderMiller,
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
        lh: singleLh > 0 ? singleLh : 0,
        lhPerQtl: singleLhRate || 0,
        cc: 0,
        tds: 0,
        shortage: 0,
        seller: orderMiller,
        diffIn: 0,
        netAmt: netAmt.toFixed(2),
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

    // 5. Dual-write only the newly injected items to Cloud Firestore asynchronously
    const targetSheetId = sheets[mainSheetIndex]?.id || 'sheet-1';
    const targetSheetName = sheets[mainSheetIndex]?.name || 'All Arrivals (Main)';
    const cloudFormatted = newItemsToInject.map((row, idx) => {
      const existingId = row.id && !String(row.id).startsWith('row-empty-') ? String(row.id).replace(/^#/, '') : null;
      const cleanBill = row.billNo ? String(row.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
      const docId = existingId || (cleanBill ? `row-${targetSheetId}-${cleanBill}-${idx + 1}` : `row-${targetSheetId}-${idx + 1}-${Date.now()}`);
      return {
        ...row,
        id: docId,
        sheetId: targetSheetId,
        sheetName: targetSheetName
      };
    });
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

