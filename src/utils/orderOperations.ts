/**
 * Canonical Operational Purchase Order Service
 * Reuses existing Purchase Orders ('placed_orders'), Arrival Entries ('arrival_entries'),
 * Buyers ('stakeholders'), Suppliers, and Brands.
 * 
 * Provides unified, single-row-per-PO representation for Ledger and Pending Loadings.
 */

import { getCollectionDocs, deleteCollectionDoc } from '../lib/firebase';
import { sanitizeSupplierName, getDeletedPlacedOrderIds, getDeletedProcurementIds, getRegisteredSuppliers } from '../lib/utils';

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

  // Handle Date instances or Firestore Timestamp objects
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) return formatDateObj(val);
    return fallback;
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return formatDateObj(d);
      } catch {}
    }
    if (typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) return formatDateObj(d);
    }
  }

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
const SEED_OPERATIONAL_POS: OperationalPO[] = [];

export const CUTOFF_NOV_3_2026 = new Date(2026, 10, 3, 0, 0, 0, 0).getTime();

/**
 * Checks if a date is strictly before November 3, 2026
 */
export function isDateBeforeNov3(val: any): boolean {
  if (!val) return false;
  const parsed = parseOperationalDate(val);
  return parsed.timestamp < CUTOFF_NOV_3_2026;
}

/**
 * Known Default Supplier Codes
 */
export const KNOWN_SUPPLIER_CODES: Record<string, string> = {
  'BHAGWATI RICE AND AGRO INDUSTRIES': 'BRI',
  'RIDDHE SIDDHE RICE INDUSTRIES PVT LTD': 'RSR',
  'SRI LAKSHMI RICE INDUSTRIES': 'SLR',
  'SAI TEJA PARBOILED RICE MILLS (P) LTD': 'STP',
  'NIDHI AGROS': 'NAR',
  'VAISHNAVI FOOD PRODUCTS PVT LTD': 'VFP',
  'ANNAPURNA RICE & AGRO INDUSTRIES': 'ARA',
  'AMRITSAR GRAIN EXPORT LTD.': 'AGE'
};

/**
 * Automatically suggests a short supplier code derived from company name
 * E.g.: "Bhagwati Rice and Agro Industries" -> "BRI"
 *       "Riddhe Siddhe Rice Industries Pvt Ltd" -> "RSR"
 *       "Sri Lakshmi Rice Industries" -> "SLR"
 */
export function deriveSupplierCode(supplierName: string, existingCodes?: Set<string>): string {
  if (!supplierName) return 'SUP';
  const clean = supplierName.trim().toUpperCase();

  // 1. Check known lookup
  if (KNOWN_SUPPLIER_CODES[clean]) {
    return KNOWN_SUPPLIER_CODES[clean];
  }
  for (const [k, v] of Object.entries(KNOWN_SUPPLIER_CODES)) {
    if (clean === k || clean.includes(k) || k.includes(clean)) {
      return v;
    }
  }

  // 2. Tokenize words, filtering out generic corporate designations
  const stopWords = new Set([
    'PVT', 'LTD', 'PRIVATE', 'LIMITED', 'AND', '&', 'CO', 'CORP',
    'MILLS', 'MILL', 'COMPANY', 'ENTERPRISES', 'ENTERPRISE', '(P)', 'P'
  ]);

  const words = clean
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stopWords.has(w));

  let candidate = '';
  if (words.length >= 3) {
    candidate = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  } else if (words.length === 2) {
    candidate = (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    candidate = words[0].slice(0, 3).toUpperCase();
  } else {
    candidate = clean.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'SUP';
  }

  // Enforce 2-4 uppercase characters
  candidate = candidate.slice(0, 4);
  if (candidate.length < 2) candidate = candidate.padEnd(2, 'X');

  // If existingCodes provided, prevent duplicates
  if (existingCodes && existingCodes.has(candidate)) {
    let suffix = 2;
    while (existingCodes.has(`${candidate.slice(0, 3)}${suffix}`)) {
      suffix++;
    }
    candidate = `${candidate.slice(0, 3)}${suffix}`;
  }

  return candidate;
}

/**
 * Resolves a supplier's permanent code from registered stakeholders or lookup
 */
export function getSupplierCode(supplierNameOrId?: string): string {
  if (!supplierNameOrId) return 'SUP';
  const clean = String(supplierNameOrId).trim();

  try {
    const reg = getRegisteredSuppliers();
    const match = reg.find(s => 
      (s.id && s.id.toLowerCase() === clean.toLowerCase()) || 
      (s.name && s.name.toLowerCase() === clean.toLowerCase()) ||
      (s.name && (s.name.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(s.name.toLowerCase())))
    );
    if (match && match.code && String(match.code).trim()) {
      return String(match.code).trim().toUpperCase();
    }
  } catch {}

  return deriveSupplierCode(clean);
}

/**
 * Generates confidential random Grouped PO reference e.g. "TC-K8M492"
 * Avoids exposing total order volume through sequential numbers.
 */
export function generateRandomPoNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes ambiguous 0, O, 1, I
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TC-${rand}`;
}

/**
 * Resolves a valid confidential Grouped PO reference (e.g. "TC-K8M492").
 * Strictly filters out legacy IDs and buyer request references (MA-, MO-, SO-, OD-).
 * Generates a stable confidential reference if not already present.
 */
export function resolveGroupedPoNumber(order: any): string {
  if (!order) return generateRandomPoNumber();
  const candidates = [order.poNumber, order.batchId, order.id, order.purchaseOrderNo];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().toUpperCase();
      if (/^TC-[A-Z0-9]{4,10}$/i.test(clean)) {
        return clean;
      }
    }
  }

  // Derive a stable deterministic confidential code from order identifier if available
  const seedId = order.id || order.billNo || order.date;
  if (seedId) {
    const cleanId = String(seedId).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanId.length >= 3) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let hash = 0;
      for (let i = 0; i < cleanId.length; i++) {
        hash = ((hash << 5) - hash) + cleanId.charCodeAt(i);
        hash |= 0;
      }
      let code = '';
      let absHash = Math.abs(hash);
      for (let i = 0; i < 6; i++) {
        code += chars.charAt((absHash + i * 7) % chars.length);
      }
      const generated = `TC-${code}`;
      if (typeof order === 'object') {
        order.poNumber = generated;
      }
      return generated;
    }
  }

  const generated = generateRandomPoNumber();
  if (typeof order === 'object') {
    order.poNumber = generated;
  }
  return generated;
}

/**
 * Generates sequential buyer request numbering for manual orders starting from MO-0001
 */
export function getNextManualOrderNumber(): string {
  try {
    let maxIdx = 0;
    const rawProc = localStorage.getItem('procurement_requests');
    if (rawProc) {
      const procs = JSON.parse(rawProc);
      if (Array.isArray(procs)) {
        procs.forEach((o: any) => {
          if (!o) return;
          const str = String(o.buyerRequestNo || o.orderNo || o.id || '');
          const m = str.match(/MO[-_\s]*0*(\d+)/i);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num > maxIdx && num < 100000) maxIdx = num;
          }
        });
      }
    }

    const saved = parseInt(localStorage.getItem('mo_sequence_counter') || '0', 10);
    if (!isNaN(saved) && saved > maxIdx) maxIdx = saved;

    const nextIdx = maxIdx + 1;
    localStorage.setItem('mo_sequence_counter', String(nextIdx));
    return `MO-${String(nextIdx).padStart(4, '0')}`;
  } catch {
    return 'MO-0001';
  }
}

/**
 * Generates sequential buyer request numbering for online store orders starting from SO-0001
 */
export function getNextStoreOrderNumber(): string {
  try {
    let maxIdx = 0;
    const rawProc = localStorage.getItem('procurement_requests');
    if (rawProc) {
      const procs = JSON.parse(rawProc);
      if (Array.isArray(procs)) {
        procs.forEach((o: any) => {
          if (!o) return;
          const str = String(o.buyerRequestNo || o.orderNo || o.id || '');
          const m = str.match(/SO[-_\s]*0*(\d+)/i);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num > maxIdx && num < 100000) maxIdx = num;
          }
        });
      }
    }

    const saved = parseInt(localStorage.getItem('so_sequence_counter') || '0', 10);
    if (!isNaN(saved) && saved > maxIdx) maxIdx = saved;

    const nextIdx = maxIdx + 1;
    localStorage.setItem('so_sequence_counter', String(nextIdx));
    return `SO-${String(nextIdx).padStart(4, '0')}`;
  } catch {
    return 'SO-0001';
  }
}

/**
 * Generates sequential supplier-specific sub-order reference starting at 0001
 * Format: SUPPLIERCODE-XXXX (e.g. BRI-0001, BRI-0002, RSR-0001, SLR-0001)
 * Each supplier maintains an independent sequence.
 */
export function getNextSupplierSubOrderNumber(supplierNameOrCode: string): string {
  try {
    const code = (supplierNameOrCode && supplierNameOrCode.length <= 5 && /^[A-Z0-9]+$/i.test(supplierNameOrCode))
      ? supplierNameOrCode.toUpperCase()
      : getSupplierCode(supplierNameOrCode);

    let maxIdx = 0;
    const regex = new RegExp(`^${code}[-_\\s]*0*(\\d+)$`, 'i');

    // 1. Scan placed_orders (both top-level single orders and sub-orders)
    const rawPlaced = localStorage.getItem('placed_orders');
    if (rawPlaced) {
      const placed = JSON.parse(rawPlaced);
      if (Array.isArray(placed)) {
        placed.forEach((p: any) => {
          if (!p) return;
          const pStr = String(p.supplierSubOrderNo || p.subOrderNo || p.billNo || p.id || '');
          const pm = pStr.match(regex);
          if (pm && pm[1]) {
            const num = parseInt(pm[1], 10);
            if (num > maxIdx && num < 100000) maxIdx = num;
          }
          if (Array.isArray(p.originalOrders)) {
            p.originalOrders.forEach((sub: any) => {
              if (!sub) return;
              const subStr = String(sub.supplierSubOrderNo || sub.subOrderNo || sub.orderNo || sub.id || '');
              const m = subStr.match(regex);
              if (m && m[1]) {
                const num = parseInt(m[1], 10);
                if (num > maxIdx && num < 100000) maxIdx = num;
              }
            });
          }
        });
      }
    }

    // 2. Scan procurement_requests
    const rawProc = localStorage.getItem('procurement_requests');
    if (rawProc) {
      const procs = JSON.parse(rawProc);
      if (Array.isArray(procs)) {
        procs.forEach((o: any) => {
          if (!o) return;
          const oStr = String(o.supplierSubOrderNo || o.subOrderNo || o.orderNo || o.id || '');
          const m = oStr.match(regex);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num > maxIdx && num < 100000) maxIdx = num;
          }
        });
      }
    }

    // 3. Check persistent counter for this specific supplier
    const storageKey = `suborder_seq_${code}`;
    const saved = parseInt(localStorage.getItem(storageKey) || '0', 10);
    if (!isNaN(saved) && saved > maxIdx) maxIdx = saved;

    const nextIdx = maxIdx + 1;
    localStorage.setItem(storageKey, String(nextIdx));
    return `${code}-${String(nextIdx).padStart(4, '0')}`;
  } catch {
    const code = deriveSupplierCode(supplierNameOrCode);
    return `${code}-0001`;
  }
}

/**
 * Normalizes all placed orders so that sub-orders for each supplier are sequentially,
 * chronologically incremented (e.g. BRI-0001, BRI-0002, BRI-0003, RSR-0001, RSR-0002).
 * Eliminates duplicate sequence numbers and assigns valid confidential Grouped PO numbers (TC-XXXXXX).
 */
export function normalizePlacedOrdersSequential(placedOrders: any[]): any[] {
  if (!Array.isArray(placedOrders) || placedOrders.length === 0) return [];

  // Sort orders chronologically (oldest first) so earlier orders get earlier sequence numbers
  const indexed = placedOrders.map((o, idx) => ({ order: o ? { ...o } : o, origIdx: idx }));
  indexed.sort((a, b) => {
    const da = new Date(a.order?.date || a.order?.createdAt || 0).getTime();
    const db = new Date(b.order?.date || b.order?.createdAt || 0).getTime();
    if (da !== db && !isNaN(da) && !isNaN(db)) return da - db;
    return a.origIdx - b.origIdx;
  });

  const usedPerSupplier = new Map<string, Set<number>>();
  const maxPerSupplier = new Map<string, number>();

  const getNextSeq = (code: string): number => {
    const used = usedPerSupplier.get(code) || new Set<number>();
    usedPerSupplier.set(code, used);
    let cur = 1;
    while (used.has(cur)) {
      cur++;
    }
    used.add(cur);
    const prevMax = maxPerSupplier.get(code) || 0;
    if (cur > prevMax) maxPerSupplier.set(code, cur);
    return cur;
  };

  const registerUsedSeq = (code: string, num: number) => {
    const used = usedPerSupplier.get(code) || new Set<number>();
    used.add(num);
    usedPerSupplier.set(code, used);
    const prevMax = maxPerSupplier.get(code) || 0;
    if (num > prevMax) maxPerSupplier.set(code, num);
  };

  // First pass: register pre-existing, valid, non-duplicate supplier sub-order numbers
  indexed.forEach(({ order }) => {
    if (!order) return;
    const parentSupplier = order.supplier || 'Direct Mill';
    const subs = (Array.isArray(order.originalOrders) && order.originalOrders.length > 0)
      ? order.originalOrders
      : [order];

    subs.forEach(sub => {
      if (!sub) return;
      const subSup = sub.supplier || parentSupplier;
      const code = getSupplierCode(subSup);
      const direct = String(sub.supplierSubOrderNo || '').trim().toUpperCase();
      const m = direct.match(new RegExp(`^${code}-0*(\\d+)$`, 'i'));
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        const used = usedPerSupplier.get(code) || new Set<number>();
        if (!used.has(num)) {
          registerUsedSeq(code, num);
        }
      }
    });
  });

  // Second pass: assign sequential numbers to sub-orders that have no number or were duplicates
  indexed.forEach(({ order }) => {
    if (!order) return;
    const parentSupplier = order.supplier || 'Direct Mill';
    const poRef = resolveGroupedPoNumber(order);
    order.poNumber = poRef;

    if (Array.isArray(order.originalOrders) && order.originalOrders.length > 0) {
      order.originalOrders = order.originalOrders.map((sub: any, sIdx: number) => {
        const subSup = sub.supplier || parentSupplier;
        const code = getSupplierCode(subSup);
        const direct = String(sub.supplierSubOrderNo || '').trim().toUpperCase();
        const m = direct.match(new RegExp(`^${code}-0*(\\d+)$`, 'i'));
        let subRef = '';
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          subRef = `${code}-${String(num).padStart(4, '0')}`;
        } else {
          const nextNum = getNextSeq(code);
          subRef = `${code}-${String(nextNum).padStart(4, '0')}`;
        }

        return {
          ...sub,
          id: sub.id || `${order.id}-sub-${sIdx + 1}`,
          supplierSubOrderNo: subRef,
          subOrderNo: subRef,
          buyerRequestNo: sub.buyerRequestNo || sub.orderNo || sub.id,
          poNumber: poRef,
          supplier: subSup,
          supplierCode: code
        };
      });
      order.poNumber = poRef;
    } else {
      // Single order
      const code = getSupplierCode(parentSupplier);
      const direct = String(order.supplierSubOrderNo || '').trim().toUpperCase();
      const m = direct.match(new RegExp(`^${code}-0*(\\d+)$`, 'i'));
      let subRef = '';
      if (m && m[1]) {
        subRef = `${code}-${String(parseInt(m[1], 10)).padStart(4, '0')}`;
      } else {
        const nextNum = getNextSeq(code);
        subRef = `${code}-${String(nextNum).padStart(4, '0')}`;
      }
      order.supplierSubOrderNo = subRef;
      order.subOrderNo = subRef;
      order.supplierCode = code;
      order.poNumber = poRef;
    }
  });

  // Persist updated counters so future orders continue incrementing
  maxPerSupplier.forEach((maxVal, code) => {
    try {
      const storageKey = `suborder_seq_${code}`;
      const saved = parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (isNaN(saved) || maxVal > saved) {
        localStorage.setItem(storageKey, String(maxVal));
      }
    } catch {}
  });

  // Restore back to original array order
  indexed.sort((a, b) => a.origIdx - b.origIdx);
  return indexed.map(i => i.order);
}

/**
 * Resolves a sub-order's supplier-specific operational identifier (e.g. BRI-0001, RSR-0002)
 */
export function resolveSubOrderNumber(sub: any, sIdx: number = 0, fallbackSupplier?: string): string {
  if (!sub) return `SUP-${String(sIdx + 1).padStart(4, '0')}`;

  // 1. Direct property (exclude non-supplier prefixes such as MO-, SO-, MA-, ONI-, OD-, PO-, TC-)
  if (sub.supplierSubOrderNo && typeof sub.supplierSubOrderNo === 'string' && sub.supplierSubOrderNo.trim()) {
    const direct = sub.supplierSubOrderNo.trim().toUpperCase();
    if (!/^(MO|SO|MA|ONI|OD|PO|TC|BUY|SUP)-/i.test(direct)) {
      return direct;
    }
  }

  // 2. Check candidates for SUPPLIERCODE-XXXX pattern (e.g. BRI-0001, RSR-0002)
  // Must strictly exclude buyer requests (MO-, SO-, MA-, ONI-), internal orders (OD-), and grouped POs (PO-, TC-)
  const candidates = [sub.subOrderNo, sub.orderNo, sub.id, sub.subOrderId];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const trimmed = c.trim().toUpperCase();
      if (/^[A-Z]{2,5}-\d{4}$/.test(trimmed) && !/^(MO|SO|MA|ONI|OD|PO|TC|BUY|SUP)-/i.test(trimmed)) {
        return trimmed;
      }
    }
  }

  // 3. Derive code from supplier and format
  let resolvedSup = sub.supplier || sub.seller || sub.millerName || sub.assignedSupplier || sub.origin || fallbackSupplier;
  if (!resolvedSup) {
    try {
      const poKey = sub.poNumber || sub.purchaseOrderNo;
      if (poKey) {
        const raw = localStorage.getItem('placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const found = list.find((p: any) => p && (p.id === poKey || p.poNumber === poKey));
          if (found && found.supplier) {
            resolvedSup = found.supplier;
          }
        }
      }
    } catch {}
  }

  if (!resolvedSup || resolvedSup === 'DIRECT MILL') {
    try {
      const reg = getRegisteredSuppliers();
      if (reg.length > 0 && reg[0].name) {
        resolvedSup = reg[0].name;
      }
    } catch {}
  }

  const code = getSupplierCode(resolvedSup);
  return `${code}-${String(sIdx + 1).padStart(4, '0')}`;
}

// Backward-compatibility aliases
export const getNextPoNumber = generateRandomPoNumber;
export const getNextSubOrderNumber = getNextManualOrderNumber;

let isPurgingNov3 = false;
let hasPurgedNov3 = false;

/**
 * Purges all orders and ledger records dated before November 3, 2026 across LocalStorage and Cloud Firestore
 */
export async function purgeRecordsBeforeNov3(): Promise<void> {
  if (isPurgingNov3 || hasPurgedNov3) return;
  isPurgingNov3 = true;
  try {
    // 1. Clean localStorage 'ledgers'
    try {
      const rawLedgers = localStorage.getItem('ledgers');
      if (rawLedgers) {
        const ledgers = JSON.parse(rawLedgers);
        if (Array.isArray(ledgers)) {
          const remaining = ledgers.filter((l: any) => !isDateBeforeNov3(l?.date));
          localStorage.setItem('ledgers', JSON.stringify(remaining));
        }
      }
    } catch (e) {}

    // 2. Clean localStorage 'cached_operational_orders'
    try {
      const cached = localStorage.getItem('cached_operational_orders');
      if (cached) {
        const all: any[] = JSON.parse(cached);
        if (Array.isArray(all)) {
          const remaining = all.filter((po: any) => !isDateBeforeNov3(po?.dateTimestamp || po?.date));
          localStorage.setItem('cached_operational_orders', JSON.stringify(remaining));
        }
      }
    } catch (e) {}

    // 3. Clean localStorage 'placed_orders'
    try {
      const rawPlaced = localStorage.getItem('placed_orders');
      if (rawPlaced) {
        const placed = JSON.parse(rawPlaced);
        if (Array.isArray(placed)) {
          const remaining = placed.filter((p: any) => !isDateBeforeNov3(p?.date || p?.purchaseOrderSentAt || p?.createdAt));
          localStorage.setItem('placed_orders', JSON.stringify(remaining));
        }
      }
    } catch (e) {}

    // 4. Invalidate memory cache
    invalidateOperationalOrdersCache();

    // 5. Clean Firestore 'ledgers' and 'placed_orders' in background
    try {
      const cloudLedgers = await getCollectionDocs('ledgers').catch(() => []);
      if (Array.isArray(cloudLedgers) && cloudLedgers.length > 0) {
        const deletePromises: Promise<any>[] = [];
        cloudLedgers.forEach((l: any) => {
          if (l?.id && isDateBeforeNov3(l.date)) {
            deletePromises.push(deleteCollectionDoc('ledgers', l.id).catch(() => {}));
          }
        });
        if (deletePromises.length > 0) await Promise.allSettled(deletePromises);
      }
    } catch (e) {}

    try {
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      if (Array.isArray(cloudPlaced) && cloudPlaced.length > 0) {
        const deletePromises: Promise<any>[] = [];
        cloudPlaced.forEach((p: any) => {
          if (p?.id && isDateBeforeNov3(p.date || p.purchaseOrderSentAt || p.createdAt)) {
            deletePromises.push(deleteCollectionDoc('placed_orders', p.id).catch(() => {}));
          }
        });
        if (deletePromises.length > 0) await Promise.allSettled(deletePromises);
      }
    } catch (e) {}

    hasPurgedNov3 = true;
    // NOTE: Intentionally do NOT dispatch operational-orders-updated or ledgers-updated here,
    // to avoid triggering recursive infinite event loops with open views.
  } catch (err) {
    console.warn('Error during purgeRecordsBeforeNov3:', err);
  } finally {
    isPurgingNov3 = false;
  }
}

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
          const supplier = sanitizeSupplierName(sub.supplier || sub.seller || ord.supplier || ord.seller, 'DIRECT MILL');
          const subId = resolveSubOrderNumber(sub, sIdx, supplier);
          const normSubId = normalizePo(subId);
          const normSubPo = normalizePo(sub.purchaseOrderNo);

          // Confidential Grouped PO reference (e.g. TC-K8M492)
          const poNumber = resolveGroupedPoNumber(ord);

          const rowKey = `${normParentPo}_${normSubId}`;

          if (processedPoKeys.has(rowKey) || (normSubId && processedPoKeys.has(normSubId) && ord.originalOrders.length > 1)) return;
          processedPoKeys.add(rowKey);
          if (normSubId) processedPoKeys.add(normSubId);
          if (normSubPo) processedPoKeys.add(normSubPo);
          if (poNumber) processedPoKeys.add(normalizePo(poNumber));

          const dateMeta = parseOperationalDate(sub.date || ord.date || ord.createdAt);
          const buyer = String(sub.buyer || sub.partyName || ord.buyer || 'General Merchant').trim();
          
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

        const subId = resolveSubOrderNumber(ord, 0, supplier);
        const normSubId = normalizePo(subId);

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

        const billNo = Array.from(arrData.billNos)[0] || ord.billNo || undefined;

        const poNumber = resolveGroupedPoNumber(ord);

        results.push({
          id: `po-${normParentPo}`,
          poNumber: poNumber,
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

    // Filter out any deleted PO and any orders dated before November 3, 2026
    const activeResults = dedupedResults.filter(po => {
      const normPo = normalizePo(po.poNumber);
      const normId = normalizePo(po.id);
      const normSub = po.subOrderId ? normalizePo(po.subOrderId) : '';
      const normRaw = po.rawOrder?.id ? normalizePo(po.rawOrder.id) : '';
      if (isDeletedPo(normPo) || isDeletedPo(normId) || (normSub && isDeletedPo(normSub)) || (normRaw && isDeletedPo(normRaw))) {
        return false;
      }
      if (po.dateTimestamp && po.dateTimestamp < CUTOFF_NOV_3_2026) {
        return false;
      }
      return true;
    });

    if (activeResults.length === 0) {
      return [];
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
    return [];
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
