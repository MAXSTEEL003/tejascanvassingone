/**
 * Canonical Operational Purchase Order Service
 * Reuses existing Purchase Orders ('placed_orders'), Arrival Entries ('arrival_entries'),
 * Buyers ('stakeholders'), Suppliers, and Brands.
 * 
 * Provides unified, single-row-per-PO representation for Ledger and Pending Loadings.
 */

import { getCollectionDocs } from '../lib/firebase';
import { sanitizeSupplierName } from '../lib/utils';

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

/**
 * Loads all Purchase Orders, reconciles with recorded Arrival Entries,
 * and produces clean single-row-per-PO records.
 */
export async function fetchOperationalOrders(): Promise<OperationalPO[]> {
  try {
    // 1. Load Placed Orders (Cloud Firestore + LocalStorage fallback)
    const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
    let localPlaced: any[] = [];
    try {
      localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
    } catch {}

    // Deduplicate placed orders by normalized ID
    const placedOrderMap = new Map<string, any>();
    [...cloudPlaced, ...localPlaced].forEach(ord => {
      if (!ord || !ord.id) return;
      if (ord.status === 'Rejected') return;
      const key = normalizePo(ord.purchaseOrderNo || ord.id);
      if (key && !placedOrderMap.has(key)) {
        placedOrderMap.set(key, ord);
      }
    });

    // 2. Load Arrival Entries (Cloud Firestore + LocalStorage sheets & array)
    const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
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
    let historicalLedgers: any[] = [];
    try {
      const cloudLedgers = await getCollectionDocs('ledgers').catch(() => []);
      const localLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');
      historicalLedgers = [...cloudLedgers, ...localLedgers];
    } catch {}

    const ledgerPoMap = new Map<string, { buyer?: string; supplier?: string; date?: any; qty?: number; rate?: number; amount?: number }>();
    historicalLedgers.forEach(l => {
      if (!l || !l.purchaseOrderNo) return;
      const poKey = normalizePo(l.purchaseOrderNo);
      if (!poKey) return;

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
        ord.originalOrders.forEach((sub: any, sIdx: number) => {
          const subId = sub.id ? String(sub.id).trim().toUpperCase() : `${normParentPo}-${sIdx + 1}`;
          const poNumber = sub.purchaseOrderNo || sub.id || parentPo;
          const rowKey = `${normParentPo}_${normalizePo(subId)}`;

          if (processedPoKeys.has(rowKey)) return;
          processedPoKeys.add(rowKey);

          const dateMeta = parseOperationalDate(sub.date || ord.date || ord.createdAt);
          const buyer = String(sub.buyer || sub.partyName || ord.buyer || 'General Merchant').trim();
          const supplier = sanitizeSupplierName(sub.supplier || sub.seller || ord.supplier || ord.seller, 'DIRECT MILL');
          const brand = String(sub.brand || sub.product || ord.brand || ord.product || '1121 Sella Rice').trim();
          const poQtl = Number(sub.qty || sub.totalQty) || 0;
          if (poQtl <= 0) return;

          let rate = Number(sub.rate || sub.pricePerUnit) || Number(ord.rate) || 0;
          if (rate <= 0 && ord.totalAmount && ord.qty) {
            rate = Math.round(Number(ord.totalAmount) / Number(ord.qty));
          }

          // Link Arrival Entry
          const arrData = arrivedMap.get(normalizePo(subId)) || arrivedMap.get(normParentPo) || { totalQty: 0, billNos: new Set(), rows: [] };
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

        const dateMeta = parseOperationalDate(ord.date || ord.createdAt);
        const buyer = String(ord.buyer || ord.partyName || 'General Merchant').trim();
        const supplier = sanitizeSupplierName(ord.supplier || ord.seller, 'DIRECT MILL');
        const brand = String(ord.brand || ord.product || ord.items?.replace(/\(\d+.*$/, '').trim() || '1121 Sella Rice').trim();

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
      if (processedPoKeys.has(poKey)) return;
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
      const brand = arrData.rows[0]?.brand || '1121 Sella Rice';

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

    // If completely empty in storage, fallback to seed records
    if (results.length === 0) {
      return [...SEED_OPERATIONAL_POS];
    }

    // Sort chronologically by dateTimestamp (newest date first)
    return results.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
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
