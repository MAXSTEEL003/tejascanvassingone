/**
 * Canonical Operational Purchase Order Service
 * Reuses existing Purchase Orders ('placed_orders'), Arrival Entries ('arrival_entries'),
 * Buyers ('stakeholders'), Suppliers, and Brands.
 * 
 * Provides unified, single-row-per-PO representation for Ledger and Pending Loadings.
 */

import { getCollectionDocs, deleteCollectionDoc } from '../lib/firebase';
import { sanitizeSupplierName, getDeletedPlacedOrderIds, getDeletedProcurementIds } from '../lib/utils';

export interface OperationalPO {
  id: string;                // Unique row key
  poNumber: string;          // Purchase Order No (e.g. TC-4398)
  subOrderId?: string;
  date: string;              // Formatted date string (e.g. 30 Sep 2026)
  dateShort: string;         // Short date (e.g. 30 Sep)
  dateGroupKey: string;      // Daily grouping header (e.g. 30 September 2026)
  dateTimestamp: number;     // Milliseconds timestamp for sorting & date filtering
  buyer: string;             // Buyer name (e.g. Tejas Stores)
  supplier: string;          // Supplier/Miller name (e.g. Riddhee Sidhee Rice)
  brand: string;             // Brand name (e.g. Brand A)
  poQtl: number;             // Original Purchase Order quantity
  arrivalQtl: number;        // Actual quantity recorded in Arrival Entry
  rate: number;              // Historical rate attached to this specific PO
  difference: number;        // arrivalQtl - poQtl (Quantity only)
  status: 'Arrived' | 'Pending Loading' | 'Partial Arrival';
  billNo?: string;
  notes?: string;
  rawOrder?: any;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Normalizes any date into timestamp and standard formatted strings
 */
export function parseOperationalDate(val: any): {
  timestamp: number;
  displayLong: string;
  displayShort: string;
  groupKey: string;
} {
  const fallback = {
    timestamp: Date.now(),
    displayLong: 'Today',
    displayShort: 'Today',
    groupKey: 'Today'
  };

  if (!val) return fallback;

  // 1. Numeric Excel serial
  if (typeof val === 'number') {
    if (val > 1000 && val <= 100000) {
      const utcMs = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return formatDateObj(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    } else if (val > 1000000000) {
      // Unix timestamp
      const d = new Date(val);
      if (!isNaN(d.getTime())) return formatDateObj(d);
    }
    return fallback;
  }

  const str = String(val).trim();
  if (!str) return fallback;

  // 2. Numeric string Excel serial (e.g. "45565")
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 1000 && num <= 100000) {
      const utcMs = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return formatDateObj(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    }
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch.map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dObj = new Date(y, m - 1, d);
      if (!isNaN(dObj.getTime())) return formatDateObj(dObj);
    }
  }

  // 4. DD-Mon-YYYY (e.g. "30-Sep-2026" or "30 Sep 2026")
  const monMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{4})$/);
  if (monMatch) {
    const d = Number(monMatch[1]);
    const mStr = monMatch[2].toLowerCase();
    const y = Number(monMatch[3]);
    const mIdx = MONTH_NAMES_SHORT.findIndex(m => mStr.startsWith(m.toLowerCase()));
    if (mIdx !== -1) {
      const dObj = new Date(y, mIdx, d);
      if (!isNaN(dObj.getTime())) return formatDateObj(dObj);
    }
  }

  // 5. ISO YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dObj = new Date(y, m - 1, d);
      if (!isNaN(dObj.getTime())) return formatDateObj(dObj);
    }
  }

  // Fallback to standard Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatDateObj(parsed);
  }

  return fallback;
}

function formatDateObj(d: Date) {
  const day = d.getDate();
  const monthShort = MONTH_NAMES_SHORT[d.getMonth()];
  const monthLong = MONTH_NAMES_LONG[d.getMonth()];
  const year = d.getFullYear();

  return {
    timestamp: d.getTime(),
    displayLong: `${day} ${monthShort} ${year}`,
    displayShort: `${day} ${monthShort}`,
    groupKey: `${day} ${monthLong} ${year}`
  };
}

/**
 * Normalizes PO numbers for safe comparison (strips '#', trims, uppercase)
 */
export function normalizePo(po: string | undefined | null): string {
  if (!po) return '';
  return String(po).trim().toUpperCase().replace(/^#/, '');
}

/**
 * Normalizes party names for comparison (lowercase, trimmed)
 */
export function normalizeParty(name: string | undefined | null): string {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Fallback seed orders strictly matching operational examples when database is completely empty
 */
const SEED_OPERATIONAL_POS: OperationalPO[] = [
  {
    id: 'PO-TC-4398',
    poNumber: 'TC-4398',
    date: '30 Sep 2026',
    dateShort: '30 Sep',
    dateGroupKey: '30 September 2026',
    dateTimestamp: new Date(2026, 8, 30, 11, 0).getTime(),
    buyer: 'Tejas Stores',
    supplier: 'Riddhee Sidhee Rice',
    brand: 'Brand A',
    poQtl: 500,
    arrivalQtl: 498,
    rate: 8400,
    difference: -2,
    status: 'Partial Arrival',
    billNo: 'RS-9012'
  },
  {
    id: 'PO-TC-4421',
    poNumber: 'TC-4421',
    date: '30 Sep 2026',
    dateShort: '30 Sep',
    dateGroupKey: '30 September 2026',
    dateTimestamp: new Date(2026, 8, 30, 10, 30).getTime(),
    buyer: 'ABC Traders',
    supplier: 'Miller A',
    brand: 'Brand X',
    poQtl: 250,
    arrivalQtl: 0,
    rate: 7800,
    difference: -250,
    status: 'Pending Loading'
  },
  {
    id: 'PO-TC-4425',
    poNumber: 'TC-4425',
    date: '30 Sep 2026',
    dateShort: '30 Sep',
    dateGroupKey: '30 September 2026',
    dateTimestamp: new Date(2026, 8, 30, 9, 15).getTime(),
    buyer: 'XYZ Traders',
    supplier: 'Miller B',
    brand: 'Brand Y',
    poQtl: 400,
    arrivalQtl: 0,
    rate: 7600,
    difference: -400,
    status: 'Pending Loading'
  },
  {
    id: 'PO-TC-4102',
    poNumber: 'TC-4102',
    date: '29 Sep 2026',
    dateShort: '29 Sep',
    dateGroupKey: '29 September 2026',
    dateTimestamp: new Date(2026, 8, 29, 14, 20).getTime(),
    buyer: 'Tejas Stores',
    supplier: 'Sri Krishna Agro',
    brand: 'Brand B',
    poQtl: 300,
    arrivalQtl: 300,
    rate: 8100,
    difference: 0,
    status: 'Arrived',
    billNo: 'SKA-4411'
  },
  {
    id: 'PO-TC-4095',
    poNumber: 'TC-4095',
    date: '29 Sep 2026',
    dateShort: '29 Sep',
    dateGroupKey: '29 September 2026',
    dateTimestamp: new Date(2026, 8, 29, 11, 45).getTime(),
    buyer: 'South Karnataka Traders',
    supplier: 'Amritsar Grain Export Ltd.',
    brand: 'Royal Classic',
    poQtl: 200,
    arrivalQtl: 204,
    rate: 8600,
    difference: 4,
    status: 'Arrived',
    billNo: 'AGE-1088'
  }
];

let operationalOrdersMemCache: { data: OperationalPO[]; timestamp: number } | null = null;
const OP_CACHE_TTL_MS = 60000;

export function invalidateOperationalOrdersCache() {
  operationalOrdersMemCache = null;
}

/**
 * Permanently purges ledger entries and operational order records
 * associated with deleted placed orders across Cloud Firestore and LocalStorage.
 */
export async function purgeOperationalAndLedgerRecords(orderIds: string[]): Promise<void> {
  if (!orderIds || orderIds.length === 0) return;

  const normalizeKey = (k: any) => String(k || '').trim().toLowerCase().replace(/^#/, '');
  const delSet = new Set(orderIds.map(normalizeKey).filter(Boolean));

  // 1. Purge from localStorage 'ledgers'
  try {
    const rawLedgers = localStorage.getItem('ledgers');
    if (rawLedgers) {
      const ledgers = JSON.parse(rawLedgers);
      if (Array.isArray(ledgers)) {
        const remaining = ledgers.filter((l: any) => {
          if (!l) return false;
          const poNorm = normalizeKey(l.purchaseOrderNo);
          const idNorm = normalizeKey(l.id);
          const ordIdNorm = normalizeKey(l.orderId);
          return !delSet.has(poNorm) && !delSet.has(idNorm) && !delSet.has(ordIdNorm);
        });
        localStorage.setItem('ledgers', JSON.stringify(remaining));
      }
    }
  } catch (e) {
    console.warn('Error purging local ledgers:', e);
  }

  // 2. Purge from Firestore 'ledgers' collection
  try {
    const cloudLedgers = await getCollectionDocs('ledgers').catch(() => []);
    if (Array.isArray(cloudLedgers) && cloudLedgers.length > 0) {
      const deletePromises: Promise<any>[] = [];
      cloudLedgers.forEach((l: any) => {
        if (!l || !l.id) return;
        const poNorm = normalizeKey(l.purchaseOrderNo);
        const idNorm = normalizeKey(l.id);
        const ordIdNorm = normalizeKey(l.orderId);
        if (delSet.has(poNorm) || delSet.has(idNorm) || delSet.has(ordIdNorm)) {
          deletePromises.push(deleteCollectionDoc('ledgers', l.id).catch(() => {}));
        }
      });
      if (deletePromises.length > 0) {
        await Promise.allSettled(deletePromises);
      }
    }
  } catch (e) {
    console.warn('Error purging cloud ledgers:', e);
  }

  // 3. Purge from localStorage 'cached_operational_orders' (Pending Loadings & Ledger cache)
  try {
    const cached = localStorage.getItem('cached_operational_orders');
    if (cached) {
      const all: any[] = JSON.parse(cached);
      if (Array.isArray(all)) {
        const remaining = all.filter((po: any) => {
          if (!po) return false;
          const poNorm = normalizeKey(po.poNumber);
          const idNorm = normalizeKey(po.id);
          const subNorm = normalizeKey(po.subOrderId);
          const rawIdNorm = normalizeKey(po.rawOrder?.id);
          return !delSet.has(poNorm) && !delSet.has(idNorm) && !delSet.has(subNorm) && !delSet.has(rawIdNorm);
        });
        localStorage.setItem('cached_operational_orders', JSON.stringify(remaining));
      }
    }
  } catch (e) {
    console.warn('Error purging cached operational orders:', e);
  }

  // 4. Invalidate in-memory operational cache
  invalidateOperationalOrdersCache();

  // 5. Dispatch reactive window events so open views update immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-orders-updated', { detail: { deletedIds: orderIds } }));
    window.dispatchEvent(new CustomEvent('ledgers-updated', { detail: { deletedIds: orderIds } }));
  }
}

/**
 * Permanently purges all ledger entries and operational order records across Cloud Firestore and LocalStorage.
 */
export async function purgeAllOperationalAndLedgerRecords(): Promise<void> {
  // 1. Clear local ledgers & operational cache
  try {
    localStorage.removeItem('ledgers');
    localStorage.setItem('ledgers', '[]');
    localStorage.removeItem('cached_operational_orders');
  } catch (e) {}

  // 2. Invalidate in-memory operational cache
  invalidateOperationalOrdersCache();

  // 3. Delete all documents from Firestore 'ledgers'
  try {
    const cloudLedgers = await getCollectionDocs('ledgers').catch(() => []);
    if (Array.isArray(cloudLedgers) && cloudLedgers.length > 0) {
      const deletePromises = cloudLedgers.map((l: any) => {
        if (l?.id) return deleteCollectionDoc('ledgers', l.id).catch(() => {});
        return Promise.resolve();
      });
      await Promise.allSettled(deletePromises);
    }
  } catch (e) {
    console.warn('Error purging all cloud ledgers:', e);
  }

  // 4. Dispatch reactive window events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-orders-updated', { detail: { clearedAll: true } }));
    window.dispatchEvent(new CustomEvent('ledgers-updated', { detail: { clearedAll: true } }));
  }
}

/**
 * Loads all Purchase Orders, reconciles with recorded Arrival Entries,
 * and produces clean single-row-per-PO records.
 */
export async function fetchOperationalOrders(forceFresh = false): Promise<OperationalPO[]> {
  try {
    if (!forceFresh && operationalOrdersMemCache && (Date.now() - operationalOrdersMemCache.timestamp < OP_CACHE_TTL_MS)) {
      return operationalOrdersMemCache.data;
    }

    // 1. Fetch Placed Orders, Arrival Entries, and Ledgers in PARALLEL
    const [cloudPlaced, cloudArrivals, cloudLedgers] = await Promise.all([
      getCollectionDocs('placed_orders', forceFresh).catch(() => []),
      getCollectionDocs('arrival_entries', forceFresh).catch(() => []),
      getCollectionDocs('ledgers', forceFresh).catch(() => [])
    ]);

    let localPlaced: any[] = [];
    try {
      localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
    } catch {}

    // Deduplicate placed orders by normalized ID
    const deletedPlaced = getDeletedPlacedOrderIds();
    const deletedProc = getDeletedProcurementIds();
    const isDeletedPo = (id: string) => {
      const norm = normalizePo(id);
      return deletedPlaced.has(norm) || deletedProc.has(norm);
    };

    const isWiped = localStorage.getItem('cleared_placed_orders') === 'true' || localStorage.getItem('placed_orders_cleared_all') === 'true';

    const placedOrderMap = new Map<string, any>();
    if (!isWiped || localPlaced.length > 0) {
      [...cloudPlaced, ...localPlaced].forEach(ord => {
        if (!ord || !ord.id) return;
        if (ord.status === 'Rejected') return;
        const key = normalizePo(ord.purchaseOrderNo || ord.id);
        if (key && !isDeletedPo(key) && !placedOrderMap.has(key)) {
          placedOrderMap.set(key, ord);
        }
      });
    }

    let localArrivals: any[] = [];
    try {
      localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
    } catch {}

    // Also extract rows from sheet tabs if present
    try {
      const sheetsRaw = localStorage.getItem('arrival_entry_sheets_v4');
      if (sheetsRaw) {
        const sheets = JSON.parse(sheetsRaw);
        if (Array.isArray(sheets)) {
          sheets.forEach(s => {
            if (Array.isArray(s.data)) {
              localArrivals.push(...s.data);
            }
          });
        }
      }
    } catch {}

    // Build Arrival Map keyed by normalized PO number
    const arrivedMap = new Map<string, { totalQty: number; billNos: Set<string>; rows: any[] }>();
    [...cloudArrivals, ...localArrivals].forEach(arr => {
      if (!arr) return;
      const poKey = normalizePo(arr.purchaseOrderNo || arr.poNo);
      if (!poKey) return;

      const qty = Number(arr.qty) || 0;
      if (!arrivedMap.has(poKey)) {
        arrivedMap.set(poKey, { totalQty: 0, billNos: new Set(), rows: [] });
      }
      const entry = arrivedMap.get(poKey)!;
      entry.totalQty += qty;
      if (arr.billNo && String(arr.billNo).trim()) {
        entry.billNos.add(String(arr.billNo).trim());
      }
      entry.rows.push(arr);
    });

    // 3. Historical Ledgers Fallback (Ensure no older orders are missing)
    let localLedgers: any[] = [];
    try {
      localLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');
    } catch {}
    const historicalLedgers = [...cloudLedgers, ...localLedgers];

    const ledgerPoMap = new Map<string, { buyer?: string; supplier?: string; date?: any; qty?: number; rate?: number; amount?: number; brand?: string; product?: string }>();
    historicalLedgers.forEach(l => {
      if (!l || !l.purchaseOrderNo) return;
      const poKey = normalizePo(l.purchaseOrderNo);
      if (!poKey || isDeletedPo(poKey) || isDeletedPo(l.id) || (l.orderId && isDeletedPo(l.orderId))) return;

      if (!ledgerPoMap.has(poKey)) {
        ledgerPoMap.set(poKey, {});
      }
      const rec = ledgerPoMap.get(poKey)!;
      if (l.partyType === 'Buyer') {
        rec.buyer = l.partyName;
      } else if (l.partyType === 'Supplier') {
        rec.supplier = l.partyName;
      }
      if (!rec.date && l.date) rec.date = l.date;
      if (!rec.qty && l.qty) rec.qty = Number(l.qty) || 0;
      if (!rec.rate && l.rate) rec.rate = Number(l.rate) || 0;
      if (!rec.amount && l.amount) rec.amount = Number(l.amount) || 0;
      if (!rec.brand && (l.brand || l.product || l.variety || l.itemName)) {
        rec.brand = l.brand || l.product || l.variety || l.itemName;
      }
    });

    // Track sub-order keys that belong to grouped batches so they are not treated as independent orders
    const groupedSubOrderIds = new Set<string>();
    Array.from(placedOrderMap.values()).forEach(ord => {
      if (ord.originalOrders && Array.isArray(ord.originalOrders) && ord.originalOrders.length > 0) {
        ord.originalOrders.forEach((sub: any) => {
          if (sub?.id) groupedSubOrderIds.add(normalizePo(sub.id));
          if (sub?.purchaseOrderNo) groupedSubOrderIds.add(normalizePo(sub.purchaseOrderNo));
        });
      }
    });

    // Remove any standalone orders from placedOrderMap that are already inside a grouped order
    groupedSubOrderIds.forEach(subKey => {
      if (placedOrderMap.has(subKey)) {
        placedOrderMap.delete(subKey);
      }
    });

    const results: OperationalPO[] = [];
    const processedPoKeys = new Set<string>();

    // A. Process Placed Orders
    Array.from(placedOrderMap.values()).forEach(ord => {
      const parentPo = ord.purchaseOrderNo || ord.id || '';
      const normParentPo = normalizePo(parentPo);
      if (!normParentPo) return;

      // Handle multi-suborder batch contracts
      if (ord.originalOrders && Array.isArray(ord.originalOrders) && ord.originalOrders.length > 0) {
        // Mark parent PO and ID as processed
        processedPoKeys.add(normParentPo);
        if (ord.id) processedPoKeys.add(normalizePo(ord.id));
        if (ord.purchaseOrderNo) processedPoKeys.add(normalizePo(ord.purchaseOrderNo));

        ord.originalOrders.forEach((sub: any, sIdx: number) => {
          const subId = sub.id ? String(sub.id).trim().toUpperCase() : `${normParentPo}-${sIdx + 1}`;
          const normSubId = normalizePo(subId);
          const normSubPo = normalizePo(sub.purchaseOrderNo);

          // Use parent PO number for single-suborder batches, or parentPo if sub has no independent PO
          const poNumber = (ord.originalOrders.length === 1 || !sub.purchaseOrderNo) 
            ? parentPo 
            : (sub.purchaseOrderNo || parentPo);

          const rowKey = `${normParentPo}_${normSubId}`;

          if (processedPoKeys.has(rowKey) || (normSubId && processedPoKeys.has(normSubId) && ord.originalOrders.length > 1)) return;
          processedPoKeys.add(rowKey);
          if (normSubId) processedPoKeys.add(normSubId);
          if (normSubPo) processedPoKeys.add(normSubPo);
          if (poNumber) processedPoKeys.add(normalizePo(poNumber));

          const dateMeta = parseOperationalDate(sub.date || ord.date || ord.createdAt);
          const buyer = String(sub.buyer || sub.partyName || ord.buyer || 'General Merchant').trim();
          const supplier = sanitizeSupplierName(sub.supplier || sub.seller || ord.supplier || ord.seller, 'DIRECT MILL');
          
          // Accurately resolve brand without falling back to hardcoded 1121 Sella Rice
          const brand = String(
            sub.brand ||
            sub.product ||
            sub.variety ||
            sub.itemName ||
            (ord.brand && !ord.brand.startsWith('TC Grouped') ? ord.brand : '') ||
            (ord.product && !ord.product.startsWith('TC Grouped') ? ord.product : '') ||
            (ord.items && !ord.items.startsWith('TC Grouped') ? ord.items.replace(/\(\d+.*$/, '').trim() : '') ||
            'Standard Rice'
          ).trim();

          const poQtl = Number(sub.qty || sub.totalQty) || 0;
          if (poQtl <= 0) return;

          let rate = Number(sub.rate || sub.pricePerUnit) || Number(ord.rate) || 0;
          if (rate <= 0 && ord.totalAmount && ord.qty) {
            rate = Math.round(Number(ord.totalAmount) / Number(ord.qty));
          }

          // Link Arrival Entry
          const arrData = arrivedMap.get(normSubId) || arrivedMap.get(normParentPo) || { totalQty: 0, billNos: new Set(), rows: [] };
          const arrivalQtl = arrData.totalQty;
          const difference = arrivalQtl - poQtl;

          let status: 'Arrived' | 'Pending Loading' | 'Partial Arrival' = 'Pending Loading';
          if (arrivalQtl >= poQtl && poQtl > 0) {
            status = 'Arrived';
          } else if (arrivalQtl > 0) {
            status = 'Partial Arrival';
          }

          const billNo = Array.from(arrData.billNos)[0] || sub.billNo || ord.billNo || undefined;

          results.push({
            id: `po-${rowKey}`,
            poNumber,
            subOrderId: subId,
            date: dateMeta.displayLong,
            dateShort: dateMeta.displayShort,
            dateGroupKey: dateMeta.groupKey,
            dateTimestamp: dateMeta.timestamp,
            buyer,
            supplier,
            brand,
            poQtl,
            arrivalQtl,
            rate,
            difference,
            status,
            billNo,
            rawOrder: sub
          });
        });
      } else {
        // Single PO Order
        if (processedPoKeys.has(normParentPo)) return;
        processedPoKeys.add(normParentPo);
        if (ord.id) processedPoKeys.add(normalizePo(ord.id));
        if (ord.purchaseOrderNo) processedPoKeys.add(normalizePo(ord.purchaseOrderNo));

        const dateMeta = parseOperationalDate(ord.date || ord.createdAt);
        const buyer = String(ord.buyer || ord.partyName || 'General Merchant').trim();
        const supplier = sanitizeSupplierName(ord.supplier || ord.seller, 'DIRECT MILL');
        
        const brand = String(
          ord.brand ||
          ord.product ||
          ord.variety ||
          ord.itemName ||
          (ord.items && !ord.items.startsWith('TC Grouped') ? ord.items.replace(/\(\d+.*$/, '').trim() : '') ||
          'Standard Rice'
        ).trim();

        let poQtl = Number(ord.qty || ord.totalQty) || 0;
        if (poQtl <= 0 && ord.items) {
          poQtl = parseFloat(ord.items.match(/\d+(\.\d+)?/)?.[0] || '0');
        }
        if (poQtl <= 0) return;

        let rate = Number(ord.rate) || 0;
        if (rate <= 0 && ord.totalAmount) {
          rate = Math.round(Number(ord.totalAmount) / poQtl);
        } else if (rate <= 0 && ord.total) {
          const rawAmt = parseFloat(String(ord.total).replace(/[^0-9.]/g, ''));
          if (rawAmt && poQtl) rate = Math.round(rawAmt / poQtl);
        }

        // Link Arrival Entry
        const arrData = arrivedMap.get(normParentPo) || { totalQty: 0, billNos: new Set(), rows: [] };
        const arrivalQtl = arrData.totalQty;
        const difference = arrivalQtl - poQtl;

        let status: 'Arrived' | 'Pending Loading' | 'Partial Arrival' = 'Pending Loading';
        if (arrivalQtl >= poQtl && poQtl > 0) {
          status = 'Arrived';
        } else if (arrivalQtl > 0) {
          status = 'Partial Arrival';
        }

        const billNo = Array.from(arrData.billNos)[0] || ord.billNo || undefined;

        results.push({
          id: `po-${normParentPo}`,
          poNumber: parentPo,
          date: dateMeta.displayLong,
          dateShort: dateMeta.displayShort,
          dateGroupKey: dateMeta.groupKey,
          dateTimestamp: dateMeta.timestamp,
          buyer,
          supplier,
          brand,
          poQtl,
          arrivalQtl,
          rate,
          difference,
          status,
          billNo,
          rawOrder: ord
        });
      }
    });

    // B. Historical Ledger Reconciliation (if PO not present in placed_orders)
    ledgerPoMap.forEach((rec, poKey) => {
      if (isDeletedPo(poKey)) return;
      if (processedPoKeys.has(poKey)) return;
      if (groupedSubOrderIds.has(poKey)) return;
      processedPoKeys.add(poKey);

      const dateMeta = parseOperationalDate(rec.date);
      const buyer = String(rec.buyer || 'General Merchant').trim();
      const supplier = sanitizeSupplierName(rec.supplier, 'DIRECT MILL');
      const poQtl = Number(rec.qty) || 0;
      if (poQtl <= 0) return;

      let rate = Number(rec.rate) || 0;
      if (rate <= 0 && rec.amount && poQtl) {
        rate = Math.round(Number(rec.amount) / poQtl);
      }

      // Check arrival entry for brand and arrival qty
      const arrData = arrivedMap.get(poKey) || { totalQty: 0, billNos: new Set(), rows: [] };
      const arrivalQtl = arrData.totalQty;
      const difference = arrivalQtl - poQtl;
      const brand = String(arrData.rows[0]?.brand || rec.brand || rec.product || 'Standard Rice').trim();

      let status: 'Arrived' | 'Pending Loading' | 'Partial Arrival' = 'Pending Loading';
      if (arrivalQtl >= poQtl && poQtl > 0) {
        status = 'Arrived';
      } else if (arrivalQtl > 0) {
        status = 'Partial Arrival';
      }

      const billNo = Array.from(arrData.billNos)[0] || undefined;

      results.push({
        id: `po-hist-${poKey}`,
        poNumber: poKey,
        date: dateMeta.displayLong,
        dateShort: dateMeta.displayShort,
        dateGroupKey: dateMeta.groupKey,
        dateTimestamp: dateMeta.timestamp,
        buyer,
        supplier,
        brand,
        poQtl,
        arrivalQtl,
        rate,
        difference,
        status,
        billNo
      });
    });

    // Robust deduplication pass: Guarantee an order is never shown twice with different brands
    const dedupedResults: OperationalPO[] = [];
    const seenOrderKeys = new Set<string>();

    for (const po of results) {
      const normPo = normalizePo(po.poNumber);
      const normSubId = po.subOrderId ? normalizePo(po.subOrderId) : '';
      const normBuyer = normalizeParty(po.buyer);

      // Composite deduplication keys
      const poBuyerKey = `${normPo}__${normBuyer}`;
      const subBuyerKey = normSubId ? `${normSubId}__${normBuyer}` : '';

      if (seenOrderKeys.has(poBuyerKey) || (subBuyerKey && seenOrderKeys.has(subBuyerKey))) {
        // Skip duplicate row for the same order and buyer
        continue;
      }

      seenOrderKeys.add(poBuyerKey);
      if (subBuyerKey) seenOrderKeys.add(subBuyerKey);
      dedupedResults.push(po);
    }

    // Filter out any deleted PO before caching and returning
    const activeResults = dedupedResults.filter(po => {
      const normPo = normalizePo(po.poNumber);
      const normId = normalizePo(po.id);
      const normSub = po.subOrderId ? normalizePo(po.subOrderId) : '';
      const normRaw = po.rawOrder?.id ? normalizePo(po.rawOrder.id) : '';
      return !isDeletedPo(normPo) && !isDeletedPo(normId) && (!normSub || !isDeletedPo(normSub)) && (!normRaw || !isDeletedPo(normRaw));
    });

    // If completely empty in storage, fallback to seed records only if not explicitly wiped
    if (activeResults.length === 0) {
      return isWiped ? [] : [...SEED_OPERATIONAL_POS];
    }

    // Sort chronologically by dateTimestamp (newest date first)
    const sorted = activeResults.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
    operationalOrdersMemCache = { data: sorted, timestamp: Date.now() };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cached_operational_orders', JSON.stringify(sorted));
      } catch (e) {}
    }
    return sorted;
  } catch (error) {
    console.error('Error fetching operational orders:', error);
    return [...SEED_OPERATIONAL_POS];
  }
}

/**
 * Format Quantity (e.g. 500 QTL)
 */
export function formatQtl(qtl: number | undefined | null): string {
  if (qtl === undefined || qtl === null || isNaN(qtl)) return '0 QTL';
  const clean = Number(qtl);
  return `${clean.toLocaleString('en-IN', { maximumFractionDigits: 2 })} QTL`;
}

/**
 * Format Difference Quantity with explicit + or - sign
 */
export function formatDifference(diff: number | undefined | null): {
  text: string;
  colorClass: string;
  badgeClass: string;
} {
  if (diff === undefined || diff === null || isNaN(diff)) {
    return { text: '0 QTL', colorClass: 'text-slate-500', badgeClass: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-slate-300' };
  }

  const clean = Number(diff);
  if (clean > 0) {
    return {
      text: `+${clean.toLocaleString('en-IN', { maximumFractionDigits: 2 })} QTL`,
      colorClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
    };
  } else if (clean < 0) {
    return {
      text: `${clean.toLocaleString('en-IN', { maximumFractionDigits: 2 })} QTL`,
      colorClass: 'text-rose-600 dark:text-rose-400 font-bold',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
    };
  } else {
    return {
      text: '0 QTL',
      colorClass: 'text-slate-600 dark:text-slate-400 font-medium',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-slate-300'
    };
  }
}
