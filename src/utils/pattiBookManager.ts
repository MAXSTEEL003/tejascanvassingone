import { jsPDF } from 'jspdf';
import { normalizeDate } from './dateUtils';
import { formatINR } from '../lib/utils';
import { getCollectionDocs, setCollectionDoc } from '../lib/firebase';

export interface PattiRecordItem {
  id: string; // Unique stable identifier: e.g., 'arr-sheetId-idx' or 'po-id'
  sourceType: 'arrival_entry' | 'placed_order';
  sourceId: string;
  sheetId?: string;
  sheetName?: string;
  sheetIndex?: number;
  
  // Temporal fields
  date: string; // Original transaction date (YYYY-MM-DD)
  clearedDate: string; // Date marked cleared (YYYY-MM-DD)
  clearedAt: number; // Timestamp ms when marked cleared
  
  // Parties & Trade Info
  millerName: string;
  partyName: string;
  billNo: string[]; // 8 slots for bills
  rawBillNo: string;
  arrivalDt: string;
  
  // Financial Metrics
  qty: number;
  rate: number;
  grossAmount: number;
  
  // Deductions
  lorrySmall: number;
  discountPct: string;
  discountAmount: number;
  sellerCom: number;
  manualShortage: number;
  qDiff: number;
  expensesSum: number; // Total Deductibles
  netAmount: number;
  
  // Banking & Cheque
  chqAm: number;
  chqNo: string;
  chqDt: string;
  bank: string;
  remarks: string;
  shortageDelta: number; // chqAm - netAmount
  
  // Export status tracking
  exportStatus: 'pending' | 'exported';
  exportCount: number;
  lastExportedAt?: number;
  lastExportId?: string;
  
  // Raw references
  rawRow?: any;
  rawOrder?: any;
}

export type PattiPdfLayout = '2x2' | '1x4';

export interface PattiExportRecord {
  exportId: string;
  exportedAt: number;
  exportedDate: string;
  filename: string;
  recordCount: number;
  pattiIds: string[];
  recordsSummary: Array<{
    id: string;
    millerName: string;
    partyName: string;
    billNo: string;
    netAmount: number;
    chqAm: number;
  }>;
  pagesCount: number;
  separatePagesPerMiller: boolean;
  layout?: PattiPdfLayout;
  status: 'success';
}

const REGISTRY_STORAGE_KEY = 'patti_cleared_registry_v1';
const HISTORY_STORAGE_KEY = 'patti_export_history_v1';

// Consistent Indian currency formatter for PDFs (Pure ASCII, never corrupts into ' or ¹)
export function formatCurrencyForPdf(val: number | string | null | undefined, prefix: string = ''): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  if (isNaN(num)) return '0.00';
  const formatted = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num < 0) {
    return prefix ? `-${prefix}${formatted}` : `-${formatted}`;
  }
  return prefix ? `${prefix}${formatted}` : formatted;
}

export function formatNumberForPdf(val: number | string | null | undefined): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  if (isNaN(num)) return '0.00';
  if (num < 0) {
    return `-${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatQtyForPdf(val: number | string | null | undefined): string {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  if (isNaN(num) || num <= 0) return '-';
  return num % 1 === 0
    ? num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateForPdf(val: string | undefined | null): string {
  if (!val) return '-';
  const clean = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return clean || '-';
}

/**
 * Safely draw text within a maximum width boundary by shrinking font size if needed
 */
export function drawFittedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  options?: { align?: 'left' | 'center' | 'right'; maxFontSize?: number; minFontSize?: number }
): void {
  const maxFontSize = options?.maxFontSize || 6.8;
  const minFontSize = options?.minFontSize || 5.0;
  let fontSize = maxFontSize;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(text) > maxW - 0.5 && fontSize > minFontSize) {
    fontSize -= 0.2;
    doc.setFontSize(fontSize);
  }
  doc.text(text, x, y, { align: options?.align || 'left' });
}

/**
 * Load local registry cache of cleared payments and export logs
 */
export function getLocalRegistry(): Record<string, Partial<PattiRecordItem>> {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed reading patti registry from localStorage', e);
    return {};
  }
}

export function saveLocalRegistry(registry: Record<string, Partial<PattiRecordItem>>): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn('Failed writing patti registry to localStorage', e);
  }
}

export function getLocalExportHistory(): PattiExportRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed reading patti export history from localStorage', e);
    return [];
  }
}

export function saveLocalExportHistory(history: PattiExportRecord[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed writing patti export history to localStorage', e);
  }
}

/**
 * Record a payment cleared event for Patti Book without generating a PDF
 * Called from PaymentTracking when payment is successfully confirmed
 */
export async function recordPaymentClearedForPatti(metadata: {
  sourceType: 'arrival_entry' | 'placed_order';
  sourceId: string;
  sheetId?: string;
  sheetIndex?: number;
  clearedDate?: string;
  clearedAt?: number;
  millerName?: string;
  partyName?: string;
  billNo?: string;
  amount?: number;
  chqAm?: number;
  chqNo?: string;
  chqDt?: string;
  bank?: string;
  rawRow?: any;
}): Promise<void> {
  const id = metadata.sourceType === 'arrival_entry'
    ? `patti-arr-${metadata.sheetId || 'def'}-${metadata.sourceId || metadata.sheetIndex || 'idx'}`
    : `patti-po-${metadata.sourceId}`;

  const now = Date.now();
  const clearedAt = metadata.clearedAt || now;
  const clearedDate = metadata.clearedDate || new Date().toISOString().split('T')[0];

  const registry = getLocalRegistry();
  const existing = registry[id] || {};

  const updatedEntry: Partial<PattiRecordItem> = {
    ...existing,
    id,
    sourceType: metadata.sourceType,
    sourceId: metadata.sourceId,
    sheetId: metadata.sheetId,
    sheetIndex: metadata.sheetIndex,
    clearedDate,
    clearedAt,
    exportStatus: existing.exportStatus || 'pending',
    exportCount: existing.exportCount || 0,
    millerName: metadata.millerName || existing.millerName || '',
    partyName: metadata.partyName || existing.partyName || '',
    rawBillNo: metadata.billNo || existing.rawBillNo || '',
    chqAm: metadata.chqAm !== undefined ? metadata.chqAm : existing.chqAm,
    chqNo: metadata.chqNo || existing.chqNo || '',
    chqDt: metadata.chqDt || existing.chqDt || '',
    bank: metadata.bank || existing.bank || ''
  };

  registry[id] = updatedEntry;
  saveLocalRegistry(registry);

  // Sync to Firestore asynchronously if online (non-blocking)
  setCollectionDoc('patti_cleared_registry', id, updatedEntry).catch(err => {
    console.warn('Patti registry firestore sync notice:', err);
  });

  window.dispatchEvent(new Event('patti-registry-updated'));
}

/**
 * Handle payment reversal or reopening
 * Removes the cleared event or marks as reversed so it is excluded from Patti Book
 */
export async function unmarkPaymentClearedForPatti(sourceId: string, sheetId?: string): Promise<void> {
  const registry = getLocalRegistry();
  
  // Find matching key
  const matchKey = Object.keys(registry).find(key => {
    const item = registry[key];
    if (!item) return false;
    if (sheetId && item.sheetId && item.sheetId !== sheetId) return false;
    return item.sourceId === sourceId || item.id === sourceId || key === sourceId;
  });

  if (matchKey) {
    delete registry[matchKey];
    saveLocalRegistry(registry);
    window.dispatchEvent(new Event('patti-registry-updated'));
  }
}

/**
 * Helper to parse 8 bill number slots exactly as PattiView does
 */
function parse8Bills(rawBill: any): string[] {
  let bills = ['', '', '', '', '', '', '', ''];
  if (Array.isArray(rawBill)) {
    bills = [...rawBill, '', '', '', '', '', '', ''].slice(0, 8);
  } else if (rawBill) {
    const parts = String(rawBill).split(/[, ]+/).filter(Boolean);
    for (let i = 0; i < 8; i++) {
      bills[i] = parts[i] || '';
    }
  }
  return bills;
}

/**
 * Extract financial and settlement values from raw arrival row or placed order
 */
function normalizeRecordToPatti(
  id: string,
  sourceType: 'arrival_entry' | 'placed_order',
  sourceId: string,
  row: any,
  matchingOrder: any,
  registryEntry?: Partial<PattiRecordItem>
): PattiRecordItem {
  const getVal = (keys: string[], fallback: string = ''): string => {
    const sources = [row, matchingOrder, registryEntry];
    for (const src of sources) {
      if (!src) continue;
      for (const k of keys) {
        if (k in src && src[k] !== null && src[k] !== undefined && String(src[k]).trim() !== '') {
          return String(src[k]);
        }
      }
    }
    return fallback;
  };

  const millerName = getVal(['millerName', 'miller', 'supplier'], 'Not Assigned');
  const partyName = getVal(['partyName', 'party', 'buyer'], 'Not Assigned');
  
  const rawDate = getVal(['date', 'arrivalDt', 'arrival_date', 'dateShort'], new Date().toISOString().split('T')[0]);
  const date = normalizeDate(rawDate) || rawDate;
  const arrivalDt = date;

  const rawBills = getVal(['billNo', 'bill_no', 'billNumber'], '');
  const billSlots = parse8Bills(row?.billNo || rawBills);

  const qty = parseFloat(getVal(['qty', 'rateQty', 'quantity', 'totalQty'], '100')) || 0;
  const rate = parseFloat(getVal(['rate', 'rateRate', 'price'], '4200')) || 0;
  const grossAmount = Math.round(qty * rate * 100) / 100;

  const lorrySmall = parseFloat(getVal(['lh', 'lorrySmall', 'lorry_hire', 'freight'], '0')) || 0;
  
  // Consider seller commission only if it explicitly exists as sellerCom in the arrival entry (row)
  // In arrival entry, there is no seller commission (C.C. is canvassing commission, not seller commission).
  // If sellerCom does not exist in arrival entry, it is strictly 0.
  let sellerCom = 0;
  const rawSellerCom = row ? (row.sellerCom ?? row.sellerCommission ?? row.seller_com) : null;
  if (rawSellerCom !== null && rawSellerCom !== undefined && String(rawSellerCom).trim() !== '') {
    const parsed = parseFloat(String(rawSellerCom));
    if (!isNaN(parsed) && parsed > 0) {
      sellerCom = parsed;
    }
  } else if (sourceType !== 'arrival_entry' && registryEntry?.sellerCom) {
    sellerCom = parseFloat(String(registryEntry.sellerCom)) || 0;
  }

  const manualShortage = parseFloat(getVal(['shortage', 'manualShortage', 'shortage_val'], '0')) || 0;
  const qDiff = parseFloat(getVal(['diffIn', 'qDiff', 'diff_in', 'quality_difference'], '0')) || 0;

  // Cheque & banking details
  const chqAm = parseFloat(getVal(['chqAm', 'chq_am', 'cheque_amount', 'chequeAmount', 'amount'], '0')) || 0;
  const chqNo = getVal(['chqNo', 'chq_no', 'cheque_no', 'chequeNumber'], '');
  const rawChqDt = getVal(['chqDt', 'chq_dt', 'cheque_date', 'chequeDate'], '');
  const chqDt = normalizeDate(rawChqDt) || rawChqDt;
  const bank = getVal(['bank', 'bank_name'], '');
  const remarks = getVal(['remarks', 'remark', 'notes'], '');

  // Calculate discount
  let discountPct = '0';
  const explicitTds = getVal(['tds', 'discountAmount', 'discount'], '');
  if (explicitTds && parseFloat(explicitTds) > 0 && grossAmount > 0) {
    discountPct = String((parseFloat(explicitTds) / grossAmount).toFixed(6));
  } else if (arrivalDt && chqDt) {
    const start = new Date(arrivalDt);
    const end = new Date(chqDt);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 14) discountPct = '0.04';
      else if (diffDays <= 28) discountPct = '0.03';
      else if (diffDays <= 42) discountPct = '0.02';
      else if (diffDays <= 56) discountPct = '0.01';
    }
  }

  const numPct = parseFloat(discountPct) || 0;
  const discountAmount = Math.round((grossAmount * numPct) * 100) / 100;

  const expensesSum = Math.round((lorrySmall + discountAmount + sellerCom + manualShortage + qDiff) * 100) / 100;
  const netAmount = Math.round((grossAmount - expensesSum) * 100) / 100;
  const shortageDelta = Math.round((chqAm - netAmount) * 100) / 100;

  // Distinguish cleared date from transaction date
  const clearedDate = registryEntry?.clearedDate || chqDt || date;
  const clearedAt = registryEntry?.clearedAt || row?.lastUpdated || Date.now();

  return {
    id,
    sourceType,
    sourceId,
    sheetId: row?.sheetId,
    sheetName: row?.sheetName,
    sheetIndex: row?._sheetIndex,
    date,
    clearedDate,
    clearedAt,
    millerName,
    partyName,
    billNo: billSlots,
    rawBillNo: rawBills,
    arrivalDt,
    qty,
    rate,
    grossAmount,
    lorrySmall,
    discountPct,
    discountAmount,
    sellerCom,
    manualShortage,
    qDiff,
    expensesSum,
    netAmount,
    chqAm,
    chqNo,
    chqDt,
    bank,
    remarks,
    shortageDelta,
    exportStatus: registryEntry?.exportStatus || 'pending',
    exportCount: registryEntry?.exportCount || 0,
    lastExportedAt: registryEntry?.lastExportedAt,
    lastExportId: registryEntry?.lastExportId,
    rawRow: row,
    rawOrder: matchingOrder
  };
}

/**
 * Fetch all cleared payments matching the business rule
 * Combines arrival entry sheets, placed orders, and registry without duplicates
 */
export async function getClearedPattiRecords(): Promise<PattiRecordItem[]> {
  const registry = getLocalRegistry();
  
  // 1. Load arrival sheets from localStorage with fallback to Firestore
  let sheets: any[] = [];
  try {
    const rawSheets = localStorage.getItem('arrival_entry_sheets_v4');
    if (rawSheets) sheets = JSON.parse(rawSheets);
  } catch {}

  if (!sheets || sheets.length === 0) {
    try {
      const cloudArrival = await getCollectionDocs('arrival_entries').catch(() => []);
      if (cloudArrival.length > 0) {
        sheets = [{ id: 'sheet-default', name: 'General Arrivals', data: cloudArrival }];
      }
    } catch {}
  }

  // 2. Load placed orders
  let placedOrders: any[] = [];
  try {
    const rawOrders = localStorage.getItem('placed_orders');
    if (rawOrders) placedOrders = JSON.parse(rawOrders);
  } catch {}

  const orderById = new Map<string, any>();
  const orderByBill = new Map<string, any>();
  placedOrders.forEach(o => {
    if (o.id) orderById.set(String(o.id).trim(), o);
    if (o.billNo) orderByBill.set(String(o.billNo).trim().toLowerCase(), o);
  });

  const recordsMap = new Map<string, PattiRecordItem>();

  // 3. Process arrival sheets entries
  sheets.forEach((sheet: any) => {
    if (Array.isArray(sheet.data)) {
      sheet.data.forEach((row: any, idx: number) => {
        if (!row || (!row.partyName && !row.millerName && !row.billNo && !row.qty)) {
          return;
        }

        // Check if explicitly uncleared or reversed
        const isExplicitlyUncleared = 
          row.noOfDayRec === 'Not Cleared' ||
          /^(not\s*cleared|uncleared)$/i.test(String(row.noOfDayRec || '')) ||
          row.status === 'Reversed' ||
          row.status === 'Not Cleared';

        if (isExplicitlyUncleared) {
          return;
        }

        // Check if cleared
        const isRecCleared = row.noOfDayRec === 'Cleared' ||
          /^(cleared|clear|paid)$/i.test(String(row.noOfDayRec || '')) ||
          /^(cleared|clear|paid)$/i.test(String(row.noOfDays || ''));
        
        const hasChqInfo = Boolean(
          (parseFloat(row.chqAm) > 0) &&
          (row.chqNo && String(row.chqNo).trim())
        );

        let matchingOrder: any = null;
        if (row.purchaseOrderNo) matchingOrder = orderById.get(String(row.purchaseOrderNo).trim());
        if (!matchingOrder && row.billNo) matchingOrder = orderByBill.get(String(row.billNo).trim().toLowerCase());

        const isOrderCleared = matchingOrder && (
          matchingOrder.paymentStatus === 'Received' ||
          matchingOrder.paymentStatus === 'Settled' ||
          matchingOrder.paymentStatus === 'Cleared'
        );

        const rowKey = row.id ? String(row.id) : `row-${sheet.id || 'def'}-${idx}`;
        const pattiKey = `patti-arr-${sheet.id || 'def'}-${rowKey}`;
        const regEntry = registry[pattiKey];

        const isMarkedInRegistry = regEntry && regEntry.clearedDate;

        if (isRecCleared || hasChqInfo || isOrderCleared || isMarkedInRegistry) {
          const item = normalizeRecordToPatti(
            pattiKey,
            'arrival_entry',
            rowKey,
            { ...row, sheetId: sheet.id, sheetName: sheet.name, _sheetIndex: idx },
            matchingOrder,
            regEntry
          );
          recordsMap.set(pattiKey, item);
        }
      });
    }
  });

  // 4. Also check standalone placed orders if not already linked to an arrival
  placedOrders.forEach((order: any) => {
    const isCleared = order.paymentStatus === 'Received' ||
      order.paymentStatus === 'Settled' ||
      order.paymentStatus === 'Cleared' ||
      Boolean(order.paymentDetails);

    if (isCleared) {
      const poKey = `patti-po-${order.id}`;
      // Check if already covered by an arrival row matching this order
      const alreadyCovered = Array.from(recordsMap.values()).some(
        r => r.rawOrder?.id === order.id || (order.billNo && r.rawBillNo && r.rawBillNo.includes(order.billNo))
      );

      if (!alreadyCovered) {
        const regEntry = registry[poKey];
        const item = normalizeRecordToPatti(
          poKey,
          'placed_order',
          String(order.id),
          {
            partyName: order.buyer,
            millerName: order.supplier,
            billNo: order.billNo,
            date: order.date,
            qty: order.qty || order.totalQty,
            rate: order.rate,
            chqAm: order.paymentDetails?.amount || order.amount,
            chqNo: order.paymentDetails?.refNo || '',
            chqDt: order.paymentDetails?.date || '',
            bank: order.paymentDetails?.bank || '',
            remarks: order.remarks || order.notes || ''
          },
          order,
          regEntry
        );
        recordsMap.set(poKey, item);
      }
    }
  });

  // Return sorted by default: Miller (A-Z), then clearance date (Newest first)
  return Array.from(recordsMap.values()).sort((a, b) => {
    const millCmp = a.millerName.localeCompare(b.millerName);
    if (millCmp !== 0) return millCmp;
    return b.clearedAt - a.clearedAt;
  });
}

/**
 * Record a successful export in history and update individual items to 'exported'
 */
export async function recordPattiExport(
  records: PattiRecordItem[],
  separatePagesPerMiller: boolean = false,
  layout: PattiPdfLayout = '2x2'
): Promise<PattiExportRecord> {
  const exportId = `EXP-PATTI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = Date.now();
  const exportedDate = new Date().toISOString().split('T')[0];
  const filename = `Patti_Book_${layout}_${exportedDate}.pdf`;

  const pattiIds = records.map(r => r.id);
  const recordsSummary = records.map(r => ({
    id: r.id,
    millerName: r.millerName,
    partyName: r.partyName,
    billNo: r.billNo.filter(Boolean).join(', ') || r.rawBillNo || '-',
    netAmount: r.netAmount,
    chqAm: r.chqAm
  }));

  // Calculate pages (4 per page for both 2x2 and 1x4)
  let pagesCount = Math.ceil(records.length / 4) || 1;
  if (separatePagesPerMiller) {
    const byMiller = new Map<string, number>();
    records.forEach(r => {
      byMiller.set(r.millerName, (byMiller.get(r.millerName) || 0) + 1);
    });
    pagesCount = 0;
    byMiller.forEach(count => {
      pagesCount += Math.ceil(count / 4);
    });
  }

  const exportRecord: PattiExportRecord = {
    exportId,
    exportedAt: now,
    exportedDate,
    filename,
    recordCount: records.length,
    pattiIds,
    recordsSummary,
    pagesCount,
    separatePagesPerMiller,
    layout,
    status: 'success'
  };

  // Update export history
  const history = getLocalExportHistory();
  history.unshift(exportRecord);
  saveLocalExportHistory(history);

  // Update registry status for each record
  const registry = getLocalRegistry();
  pattiIds.forEach(id => {
    const existing = registry[id] || {};
    registry[id] = {
      ...existing,
      exportStatus: 'exported',
      exportCount: (existing.exportCount || 0) + 1,
      lastExportedAt: now,
      lastExportId: exportId
    };
  });
  saveLocalRegistry(registry);

  // Sync to Firestore non-blocking
  setCollectionDoc('patti_exports', exportId, exportRecord).catch(() => {});

  window.dispatchEvent(new Event('patti-registry-updated'));
  window.dispatchEvent(new Event('patti-export-recorded'));

  return exportRecord;
}

// --------------------------------------------------------------------------
// MANDATORY A4 PORTRAIT 2x2 & 1x4 PDF GENERATORS
// --------------------------------------------------------------------------

interface GeneratePdfOptions {
  records: PattiRecordItem[];
  layout?: PattiPdfLayout; // '2x2' | '1x4'
  separatePagesPerMiller?: boolean;
  logoDataUrl?: string | null;
  onProgress?: (progress: number, page: number) => void;
}

/**
 * Draw the shared Tejas Canvassing header ONCE at the top of an A4 page
 */
function drawSharedPageHeader(
  doc: jsPDF, 
  pageNumber: number, 
  totalPages: number, 
  logoDataUrl?: string | null
): void {
  const pageWidth = 210;
  const headerY = 7;
  const headerHeight = 18;

  // Header background: crisp white
  doc.setFillColor(255, 255, 255);
  doc.rect(7, headerY, pageWidth - 14, headerHeight, 'F');

  // Orange TC Brand Badge (Left)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 8, headerY + 1.5, 15, 15);
    } catch {
      drawVectorTcLogo(doc, 8, headerY + 1.5);
    }
  } else {
    drawVectorTcLogo(doc, 8, headerY + 1.5);
  }

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 32, 44); // Charcoal Slate-900
  doc.text('TEJAS CANVASSING', 26, headerY + 6.5);

  // Brand Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(217, 119, 6); // Warm Amber-600
  doc.text('COMMODITY BROKERAGE & MANDI SETTLEMENT BOOK', 26, headerY + 11);

  // Contact / Mandi info line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Depot No. 4, Commercial Complex, APMC Yard • Phone: +91 98881-22334 • GSTIN: 03AABCR1234F1ZP', 26, headerY + 15.5);

  // Right Header Card: Document Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PATTI BOOK VOUCHER', pageWidth - 8, headerY + 6.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(`Date: ${todayStr}`, pageWidth - 8, headerY + 11, { align: 'right' });
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 8, headerY + 15.5, { align: 'right' });

  // Subtle dividing line beneath the header
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(7, headerY + headerHeight + 1, pageWidth - 7, headerY + headerHeight + 1);

  // Amber accent highlight line
  doc.setDrawColor(245, 158, 11); // Amber-500
  doc.setLineWidth(0.6);
  doc.line(7, headerY + headerHeight + 1, 45, headerY + headerHeight + 1);
}

/**
 * Fallback vector TC Logo for razor-sharp offline rendering
 */
function drawVectorTcLogo(doc: jsPDF, x: number, y: number): void {
  // Rounded square with orange-amber fill
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.setDrawColor(217, 119, 6); // Amber-600
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, 15, 15, 2.5, 2.5, 'FD');

  // Text "TC" in bold white
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TC', x + 7.5, y + 10, { align: 'center' });
}

/**
 * Draw a single physical Patti inside its designated quadrant
 * Coordinates: x, y, width, height (approx 95mm x 128mm)
 */
function drawSinglePattiCell(
  doc: jsPDF,
  patti: PattiRecordItem | null,
  x: number,
  y: number,
  w: number,
  h: number,
  positionIndex: number
): void {
  // If no record (empty slot on final page), draw elegant blank placeholder outline
  if (!patti) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`[ Position ${positionIndex + 1} - Blank ]`, x + w / 2, y + h / 2, { align: 'center' });
    return;
  }

  // 1. Outer Box Border
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.35);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // 2. Top Ribbon Bar inside cell
  const ribbonH = 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(x + 0.35, y + 0.35, w - 0.7, ribbonH, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(x, y + ribbonH, x + w, y + ribbonH);

  // Voucher Ref on left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(180, 83, 9); // Amber-700
  const voucherRef = `PATTI-${String(patti.id).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  doc.text(voucherRef, x + 3, y + 4.2);

  // Clearance Date on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`CLR DT: ${patti.clearedDate || patti.date}`, x + w - 3, y + 4.2, { align: 'right' });

  // 3. Grid Table: 11 Physical Form Rows
  const tableTop = y + ribbonH;
  const labelColW = 26; // Width of field name label column
  const valColW = w - labelColW; // Width of data columns (approx 69mm)

  let curY = tableTop;

  const drawRowBorder = (rowH: number) => {
    doc.setDrawColor(218, 224, 233);
    doc.setLineWidth(0.25);
    doc.line(x, curY + rowH, x + w, curY + rowH);
    // Vertical line after label
    doc.line(x + labelColW, curY, x + labelColW, curY + rowH);
  };

  const drawLabel = (label: string, rowH: number, isUnderline: boolean = false, textColor?: [number, number, number]) => {
    doc.setFillColor(248, 250, 252); // Soft slate background
    doc.rect(x + 0.3, curY, labelColW - 0.3, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    if (textColor) {
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    } else {
      doc.setTextColor(71, 85, 105);
    }
    doc.text(label, x + 2.5, curY + (rowH / 2) + 2);
    if (isUnderline) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      const textWidth = doc.getTextWidth(label);
      doc.line(x + 2.5, curY + (rowH / 2) + 2.8, x + 2.5 + textWidth, curY + (rowH / 2) + 2.8);
    }
  };

  // Row 1: MILLERNAME (Height 9.5 mm)
  const r1H = 9.5;
  drawLabel('MILLERNAME', r1H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  const millerLines = doc.splitTextToSize(patti.millerName || 'Not Assigned', valColW - 4);
  doc.text(millerLines.slice(0, 2), x + labelColW + 2, curY + 4.2);
  drawRowBorder(r1H);
  curY += r1H;

  // Row 2: PARTYNAME (Height 9.5 mm)
  const r2H = 9.5;
  drawLabel('PARTYNAME', r2H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  const partyLines = doc.splitTextToSize(patti.partyName || 'Not Assigned', valColW - 4);
  doc.text(partyLines.slice(0, 2), x + labelColW + 2, curY + 4.2);
  drawRowBorder(r2H);
  curY += r2H;

  // Row 3: BILL NO (Height 7.5 mm)
  const r3H = 7.5;
  drawLabel('BILL NO', r3H);
  // 8 Slots for bill numbers
  const slotW = valColW / 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(30, 41, 59);
  for (let i = 0; i < 8; i++) {
    const slotX = x + labelColW + (i * slotW);
    if (i > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.line(slotX, curY, slotX, curY + r3H);
    }
    const bVal = patti.billNo[i] || '';
    if (bVal) {
      doc.text(String(bVal).slice(0, 6), slotX + slotW / 2, curY + 4.8, { align: 'center' });
    }
  }
  drawRowBorder(r3H);
  curY += r3H;

  // Row 4: ARRIVALDT (Height 7.5 mm)
  const r4H = 7.5;
  drawLabel('ARRIVALDT', r4H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  const arrivalFormatted = formatDateForPdf(patti.arrivalDt || patti.date);
  doc.text(arrivalFormatted, x + labelColW + 3, curY + 5);
  drawRowBorder(r4H);
  curY += r4H;

  // Row 5: RATE / QTY (Height 8 mm)
  const r5H = 8;
  drawLabel('RATE / QTY', r5H);
  let cX = x + labelColW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.rate > 0 ? patti.rate.toFixed(2) : '-', cX + 2, curY + 5.2);
  cX += 15;
  doc.setDrawColor(218, 224, 233);
  doc.line(cX, curY, cX, curY + r5H);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('×', cX + 2, curY + 5.2);
  cX += 6;
  doc.line(cX, curY, cX, curY + r5H);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatQtyForPdf(patti.qty), cX + 2, curY + 5.2);
  cX += 16;
  doc.line(cX, curY, cX, curY + r5H);
  // Gross Amount in soft blue accent
  const grossW = w - (cX - x);
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.rect(cX, curY, grossW, r5H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216); // Blue-700
  drawFittedText(doc, `Gross: ${formatCurrencyForPdf(patti.grossAmount)}`, cX + 2, curY + 5.2, grossW - 3, { maxFontSize: 6.8, minFontSize: 5.2 });
  drawRowBorder(r5H);
  curY += r5H;

  // Row 6: LORRYHIRE / DEDUCT SUM / CHQ AM (Height 8 mm)
  const r6H = 8;
  drawLabel('LORRYHIRE', r6H, true);
  cX = x + labelColW;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.lorrySmall > 0 ? formatNumberForPdf(patti.lorrySmall) : '-', cX + 2, curY + 5.2, 14, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 16;
  doc.line(cX, curY, cX, curY + r6H);
  
  // Deductibles Sum display (Rose accent)
  doc.setFillColor(255, 241, 242);
  doc.rect(cX, curY, 22, r6H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  drawFittedText(doc, `Ded: ${formatCurrencyForPdf(patti.expensesSum)}`, cX + 2, curY + 5.2, 20, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 22;
  doc.line(cX, curY, cX, curY + r6H);

  // CHQ AM Label & Value
  doc.setFillColor(248, 250, 252);
  doc.rect(cX, curY, 13, r6H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ AM', cX + 1.5, curY + 5.2);
  cX += 13;
  doc.line(cX, curY, cX, curY + r6H);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, formatCurrencyForPdf(patti.chqAm), cX + 2, curY + 5.2, 16, { maxFontSize: 6.5, minFontSize: 5.0 });
  drawRowBorder(r6H);
  curY += r6H;

  // Row 7: DISCOUNT / TDS / NET AM / CHQ NO (Height 8 mm)
  const r7H = 8;
  const discPctDisplay = (parseFloat(patti.discountPct || '0') * 100).toFixed(0);
  drawLabel(`DISCOUNT (${discPctDisplay}%)`, r7H, true);
  cX = x + labelColW;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(185, 28, 28);
  drawFittedText(doc, patti.discountAmount > 0 ? formatNumberForPdf(patti.discountAmount) : '0.00', cX + 2, curY + 5.2, 14, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 16;
  doc.line(cX, curY, cX, curY + r7H);

  // NET AMOUNT (Emerald highlight)
  doc.setFillColor(236, 253, 245);
  doc.rect(cX, curY, 22, r7H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // Emerald-700
  drawFittedText(doc, `NET: ${formatCurrencyForPdf(patti.netAmount)}`, cX + 2, curY + 5.2, 20, { maxFontSize: 6.8, minFontSize: 5.0 });
  cX += 22;
  doc.line(cX, curY, cX, curY + r7H);

  // CHQ NO
  doc.setFillColor(248, 250, 252);
  doc.rect(cX, curY, 13, r7H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ NO', cX + 1.5, curY + 5.2);
  cX += 13;
  doc.line(cX, curY, cX, curY + r7H);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, String(patti.chqNo || '-').slice(0, 12), cX + 2, curY + 5.2, 16, { maxFontSize: 6.2, minFontSize: 4.8 });
  drawRowBorder(r7H);
  curY += r7H;

  // Row 8: SELLERCOM / CHQ DT (Height 8 mm)
  const r8H = 8;
  drawLabel('SELLERCOM', r8H, true);
  cX = x + labelColW;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  // Strictly display '-' if sellerCom is 0 or not on arrival
  drawFittedText(doc, patti.sellerCom > 0 ? formatNumberForPdf(patti.sellerCom) : '-', cX + 2, curY + 5.2, 14, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 16;
  doc.line(cX, curY, cX, curY + r8H);

  // Cheque Paid / Settled Amount box
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.rect(cX, curY, 22, r8H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216); // Blue-700
  drawFittedText(doc, `Chq: ${formatCurrencyForPdf(patti.chqAm)}`, cX + 2, curY + 5.2, 20, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 22;
  doc.line(cX, curY, cX, curY + r8H);

  // CHQ DT
  doc.setFillColor(248, 250, 252);
  doc.rect(cX, curY, 13, r8H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ DT', cX + 1.5, curY + 5.2);
  cX += 13;
  doc.line(cX, curY, cX, curY + r8H);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const chqDtFormatted = formatDateForPdf(patti.chqDt || patti.clearedDate);
  drawFittedText(doc, chqDtFormatted, cX + 2, curY + 5.2, 16, { maxFontSize: 6.0, minFontSize: 4.8 });
  drawRowBorder(r8H);
  curY += r8H;

  // Row 9: SHORTAGE / BANK (Height 8 mm)
  const r9H = 8;
  drawLabel('SHORTAGE', r9H, true, [185, 28, 28]);
  cX = x + labelColW;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.manualShortage > 0 ? formatNumberForPdf(patti.manualShortage) : '0.00', cX + 2, curY + 5.2, 14, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 16;
  doc.line(cX, curY, cX, curY + r9H);

  // Shortage Delta
  const deltaColor: [number, number, number] = patti.shortageDelta >= 0 ? [4, 120, 87] : [185, 28, 28];
  doc.setFillColor(patti.shortageDelta >= 0 ? 236 : 255, patti.shortageDelta >= 0 ? 253 : 241, patti.shortageDelta >= 0 ? 245 : 242);
  doc.rect(cX, curY, 22, r9H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(deltaColor[0], deltaColor[1], deltaColor[2]);
  drawFittedText(doc, `Diff: ${formatNumberForPdf(patti.shortageDelta)}`, cX + 2, curY + 5.2, 20, { maxFontSize: 6.5, minFontSize: 5.0 });
  cX += 22;
  doc.line(cX, curY, cX, curY + r9H);

  // BANK
  doc.setFillColor(248, 250, 252);
  doc.rect(cX, curY, 13, r9H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('BANK', cX + 1.5, curY + 5.2);
  cX += 13;
  doc.line(cX, curY, cX, curY + r9H);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, String(patti.bank || '-').slice(0, 14), cX + 2, curY + 5.2, 16, { maxFontSize: 6.0, minFontSize: 4.8 });
  drawRowBorder(r9H);
  curY += r9H;

  // Row 10: Q-DIFF (Height 7.5 mm)
  const r10H = 7.5;
  drawLabel('Q-DIFF', r10H);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.qDiff > 0 ? formatNumberForPdf(patti.qDiff) : '0.00', x + labelColW + 2, curY + 5, 16, { maxFontSize: 6.5, minFontSize: 5.0 });
  drawRowBorder(r10H);
  curY += r10H;

  // Row 11: TOTAL DEDUCTIBLES & REMARKS (Height 9.5 mm)
  const r11H = 9.5;
  drawLabel('TOTAL DED.', r11H);
  cX = x + labelColW;
  doc.setFillColor(255, 241, 242);
  doc.rect(cX, curY, 22, r11H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  drawFittedText(doc, formatNumberForPdf(patti.expensesSum), cX + 2, curY + 6, 20, { maxFontSize: 7.2, minFontSize: 5.5 });
  cX += 22;
  doc.line(cX, curY, cX, curY + r11H);

  // Remarks
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Remarks:', cX + 2, curY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(30, 41, 59);
  const remarkLines = doc.splitTextToSize(patti.remarks || 'None', valColW - 24);
  doc.text(remarkLines.slice(0, 2), cX + 2, curY + 7.5);
  drawRowBorder(r11H);
  curY += r11H;

  // 4. Bottom Summary & Audit Seal strip (Height 8.5 mm)
  const bStripH = y + h - curY;
  if (bStripH > 2) {
    doc.setFillColor(248, 250, 252);
    doc.rect(x + 0.35, curY, w - 0.7, bStripH - 0.35, 'F');

    // Summary line on bottom left
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    drawFittedText(doc, `PAYABLE: Rs. ${formatNumberForPdf(patti.netAmount)}`, x + 3, curY + 5.5, (w / 2) - 3, { maxFontSize: 6.8, minFontSize: 5.5 });

    // Sign Line on bottom right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Auth Sign: ________________', x + w - 3, curY + 5.5, { align: 'right' });
  }
}

/**
 * Draw a single physical Patti in full-width 1x4 layout matching PattiFormDisplay exactly.
 * 10-column physical mandi settlement table:
 * - Top Header: Orange TC Badge + TEJAS CANVASSING, Clearance Date, Arrival Date, Voucher Ref, Status
 * - Row 1: MILLERNAME (cols 1-2) | [Full Miller Name] (cols 3-10)
 * - Row 2: PARTYNAME (cols 1-2) | [Full Party Name] (cols 3-10)
 * - Row 3: BILL NO (cols 1-2) | 8 Bill slots (cols 3-10)
 * - Row 4: ARRIVALDT (cols 1-2) | Arrival Date (cols 3-4) | 6 empty slots with dashes (cols 5-10)
 * - Row 5: RATE / QTY (cols 1-2) | Rate (col 3) | x (col 4) | Qty (col 5) | GROSS (cols 6-8, Light Blue) | SETTLEMENT DETAILS (cols 9-10)
 * - Row 6: LORRYHIRE (cols 1-2) | Lorry Hire (col 3) | - (cols 4-5) | TOTAL DED (cols 6-8, Soft Red) | CHQ AM (col 9) | Chq Am (col 10)
 * - Row 7: DISCOUNT / TDS (cols 1-2) | % (col 3) | Disc Amt (col 4) | - (col 5) | NET AMT (cols 6-8, Emerald) | CHQ NO (col 9) | Chq No (col 10)
 * - Row 8: SELLERCOM (cols 1-2) | Seller Com (col 3) | - (cols 4-5) | CHQ PAID (cols 6-8, Soft Blue) | CHQ DT (col 9) | Chq Date (col 10)
 * - Row 9: SHORTAGE (cols 1-2) | Shortage (col 3) | - (cols 4-5) | SHORTAGE DIFF (cols 6-8, Green/Red) | BANK (col 9) | Bank (col 10)
 * - Row 10: Q-DIFF (cols 1-2) | Q-Diff (col 3) | - (cols 4-10)
 * - Row 11: TOTAL DEDUCTIBLES (cols 1-2) | Sum (cols 3-4, Red) | REMARKS: (col 5) | Notes (cols 6-10)
 * - Bottom Row: PAYABLE (Left half, Emerald) | Auth Sign (Right half)
 */
function drawSinglePattiRow1x4(
  doc: jsPDF,
  patti: PattiRecordItem | null,
  x: number,
  y: number,
  w: number,
  h: number,
  positionIndex: number
): void {
  // If blank placeholder slot on final page
  if (!patti) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`[ Position ${positionIndex + 1} - Blank Slot ]`, x + w / 2, y + h / 2, { align: 'center' });
    return;
  }

  // 1. Outer Box Border
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.35);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  // 2. Top Header Ribbon inside slip (Height: 4.8 mm)
  const ribbonH = 4.8;
  doc.setFillColor(248, 250, 252);
  doc.rect(x + 0.35, y + 0.35, w - 0.7, ribbonH, 'F');
  doc.setDrawColor(218, 224, 233);
  doc.setLineWidth(0.25);
  doc.line(x, y + ribbonH, x + w, y + ribbonH);

  // Left: Orange TC icon badge
  doc.setFillColor(234, 88, 12); // #ea580c
  doc.roundedRect(x + 2, y + 0.9, 3.8, 3.1, 0.6, 0.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TC', x + 3.9, y + 3.2, { align: 'center' });

  // Company Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(234, 88, 12); // Orange #ea580c
  doc.text('TEJAS CANVASSING', x + 7.5, y + 3.4);

  // Metadata items along ribbon
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(`CLR DT: ${formatDateForPdf(patti.clearedDate || patti.chqDt || patti.date)}`, x + 56, y + 3.4);
  doc.text(`ARRIVAL DT: ${formatDateForPdf(patti.arrivalDt || patti.date)}`, x + 102, y + 3.4);

  const voucherRef = `PATTI-${String(patti.id).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  doc.setTextColor(180, 83, 9); // Amber-700
  doc.text(voucherRef, x + 148, y + 3.4);

  // Status on right
  const isExp = patti.exportStatus === 'exported';
  doc.setTextColor(isExp ? 4 : 180, isExp ? 120 : 83, isExp ? 87 : 9);
  doc.text(isExp ? 'STATUS: EXPORTED' : 'STATUS: CLEARED', x + w - 2.5, y + 3.4, { align: 'right' });

  // 3. Ten Column Physical Form Grid:
  // Col 1-2 (Label column): 38.8 mm (20% of 194 mm)
  // Cols 3-10 (8 data slots): 19.4 mm each (8 * 19.4 = 155.2 mm)
  // Total = 38.8 + 155.2 = 194 mm
  const colLabelW = 38.8;
  const colW = 19.4;
  const cX1 = x + colLabelW;
  const cX2 = cX1 + colW;
  const cX3 = cX2 + colW;
  const cX4 = cX3 + colW;
  const cX7 = cX1 + (5 * colW); // Starts at col 8/9 boundary: 38.8 + 97 = 135.8
  const cX8 = cX7 + colW;       // 135.8 + 19.4 = 155.2

  let curY = y + ribbonH;

  // Helper to draw horizontal row boundary
  const drawRowBorder = (rowH: number) => {
    doc.setDrawColor(218, 224, 233);
    doc.setLineWidth(0.25);
    doc.line(x, curY + rowH, x + w, curY + rowH);
  };

  // Helper to draw label cell (Cols 1-2)
  const drawRowLabel = (label: string, rowH: number, isUnderline: boolean = false, textColor?: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(x + 0.25, curY, colLabelW - 0.25, rowH, 'F');
    doc.setDrawColor(218, 224, 233);
    doc.setLineWidth(0.25);
    doc.line(cX1, curY, cX1, curY + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    if (textColor) {
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    } else {
      doc.setTextColor(71, 85, 105);
    }
    doc.text(label, x + (colLabelW / 2), curY + (rowH / 2) + 1.1, { align: 'center' });

    if (isUnderline) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      const textW = doc.getTextWidth(label);
      doc.line(x + (colLabelW / 2) - textW / 2, curY + (rowH / 2) + 1.8, x + (colLabelW / 2) + textW / 2, curY + (rowH / 2) + 1.8);
    }
  };

  // Build 8 bill slots
  const bills = Array(8).fill('-');
  if (patti.billNo && patti.billNo.length > 0) {
    patti.billNo.forEach((b, i) => {
      if (i < 8 && b) bills[i] = b;
    });
  } else if (patti.rawBillNo) {
    const parts = patti.rawBillNo.split(/[,/ ]+/).filter(Boolean);
    parts.forEach((b, i) => {
      if (i < 8) bills[i] = b;
    });
  }

  // Row 1: MILLERNAME (Height: 4.4 mm)
  const r1H = 4.4;
  drawRowLabel('MILLERNAME', r1H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.millerName || '-', cX1 + 2.5, curY + (r1H / 2) + 1.1, w - colLabelW - 4, { maxFontSize: 7.0, minFontSize: 5.2 });
  drawRowBorder(r1H);
  curY += r1H;

  // Row 2: PARTYNAME (Height: 4.4 mm)
  const r2H = 4.4;
  drawRowLabel('PARTYNAME', r2H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.partyName || '-', cX1 + 2.5, curY + (r2H / 2) + 1.1, w - colLabelW - 4, { maxFontSize: 7.0, minFontSize: 5.2 });
  drawRowBorder(r2H);
  curY += r2H;

  // Row 3: BILL NO (8 slots) (Height: 4.1 mm)
  const r3H = 4.1;
  drawRowLabel('BILL NO', r3H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  for (let i = 0; i < 8; i++) {
    const slotLeft = cX1 + (i * colW);
    if (i > 0) {
      doc.setDrawColor(218, 224, 233);
      doc.line(slotLeft, curY, slotLeft, curY + r3H);
    }
    const b = bills[i];
    if (b && b !== '-') {
      doc.setTextColor(15, 23, 42);
      doc.text(String(b).slice(0, 8), slotLeft + colW / 2, curY + (r3H / 2) + 1.1, { align: 'center' });
    } else {
      doc.setTextColor(203, 213, 225);
      doc.text('-', slotLeft + colW / 2, curY + (r3H / 2) + 1.1, { align: 'center' });
    }
  }
  drawRowBorder(r3H);
  curY += r3H;

  // Row 4: ARRIVALDT (Arrival date in cols 3-4, dashes in cols 5-10) (Height: 4.1 mm)
  const r4H = 4.1;
  drawRowLabel('ARRIVALDT', r4H);
  // Arrival Date in cols 3-4 (width 2 * colW = 38.8 mm)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  const arrDtStr = formatDateForPdf(patti.arrivalDt || patti.date);
  doc.text(arrDtStr, cX1 + colW, curY + (r4H / 2) + 1.1, { align: 'center' });
  // Vertical line after col 4
  doc.setDrawColor(218, 224, 233);
  doc.line(cX3, curY, cX3, curY + r4H);

  // Dashes in cols 5 to 10
  doc.setTextColor(203, 213, 225);
  for (let i = 2; i < 8; i++) {
    const slotLeft = cX1 + (i * colW);
    if (i > 2) {
      doc.line(slotLeft, curY, slotLeft, curY + r4H);
    }
    doc.text('-', slotLeft + colW / 2, curY + (r4H / 2) + 1.1, { align: 'center' });
  }
  drawRowBorder(r4H);
  curY += r4H;

  // Row 5: RATE / QTY + GROSS AMOUNT + SETTLEMENT DETAILS (Height: 4.5 mm)
  const r5H = 4.5;
  drawRowLabel('RATE / QTY', r5H);
  // Col 3: Rate
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.rate > 0 ? patti.rate.toFixed(2) : '-', cX1 + colW / 2, curY + (r5H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r5H);

  // Col 4: 'x'
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('x', cX2 + colW / 2, curY + (r5H / 2) + 1.1, { align: 'center' });
  doc.line(cX3, curY, cX3, curY + r5H);

  // Col 5: Qty
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatQtyForPdf(patti.qty), cX3 + colW / 2, curY + (r5H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r5H);

  // Cols 6-8: GROSS AMOUNT Highlight Box (width 3 * colW = 58.2 mm)
  doc.setFillColor(224, 242, 254); // Light Sky Blue #e0f2fe
  doc.rect(cX4, curY, 3 * colW, r5H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // Sky-700
  drawFittedText(doc, `GROSS: ${formatNumberForPdf(patti.grossAmount)}`, cX4 + colW * 1.5, curY + (r5H / 2) + 1.1, 3 * colW - 4, { align: 'center', maxFontSize: 7.2, minFontSize: 5.5 });
  doc.line(cX7, curY, cX7, curY + r5H);

  // Cols 9-10: SETTLEMENT DETAILS Header (width 2 * colW = 38.8 mm)
  doc.setFillColor(248, 250, 252);
  doc.rect(cX7, curY, 2 * colW - 0.25, r5H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.setTextColor(148, 163, 184);
  doc.text('SETTLEMENT DETAILS', cX7 + colW, curY + (r5H / 2) + 1.1, { align: 'center' });
  drawRowBorder(r5H);
  curY += r5H;

  // Row 6: LORRYHIRE + TOTAL DED + CHQ AM (Height: 4.4 mm)
  const r6H = 4.4;
  drawRowLabel('LORRYHIRE', r6H, true);
  // Col 3: Lorry hire value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.lorrySmall > 0 ? formatNumberForPdf(patti.lorrySmall) : '-', cX1 + colW / 2, curY + (r6H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r6H);

  // Cols 4-5: '-'
  doc.setTextColor(203, 213, 225);
  doc.text('-', cX2 + colW / 2, curY + (r6H / 2) + 1.1, { align: 'center' });
  doc.line(cX3, curY, cX3, curY + r6H);
  doc.text('-', cX3 + colW / 2, curY + (r6H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r6H);

  // Cols 6-8: TOTAL DED Highlight Box (width 3 * colW = 58.2 mm)
  doc.setFillColor(254, 242, 242); // Rose-50
  doc.rect(cX4, curY, 3 * colW, r6H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60); // Rose-700
  drawFittedText(doc, `TOTAL DED: ${formatNumberForPdf(patti.expensesSum)}`, cX4 + colW * 1.5, curY + (r6H / 2) + 1.1, 3 * colW - 4, { align: 'center', maxFontSize: 6.8, minFontSize: 5.2 });
  doc.line(cX7, curY, cX7, curY + r6H);

  // Col 9: CHQ AM label
  doc.setFillColor(248, 250, 252);
  doc.rect(cX7, curY, colW, r6H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ AM', cX7 + colW / 2, curY + (r6H / 2) + 1.1, { align: 'center' });
  doc.line(cX8, curY, cX8, curY + r6H);

  // Col 10: CHQ AM value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, patti.chqAm > 0 ? formatNumberForPdf(patti.chqAm) : '-', cX8 + colW / 2, curY + (r6H / 2) + 1.1, colW - 1, { align: 'center', maxFontSize: 6.2, minFontSize: 4.8 });
  drawRowBorder(r6H);
  curY += r6H;

  // Row 7: DISCOUNT / TDS + NET AMT + CHQ NO (Height: 4.4 mm)
  const r7H = 4.4;
  const discPctDisplay = (parseFloat(patti.discountPct || '0') * 100).toFixed(0);
  drawRowLabel(`DISCOUNT / TDS (${discPctDisplay}%)`, r7H, true);

  // Col 3: Pct
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${discPctDisplay}%`, cX1 + colW / 2, curY + (r7H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r7H);

  // Col 4: Discount Amount
  doc.setTextColor(190, 18, 60);
  drawFittedText(doc, patti.discountAmount > 0 ? formatNumberForPdf(patti.discountAmount) : '0.00', cX2 + colW / 2, curY + (r7H / 2) + 1.1, colW - 1, { align: 'center', maxFontSize: 5.8, minFontSize: 4.8 });
  doc.line(cX3, curY, cX3, curY + r7H);

  // Col 5: '-'
  doc.setTextColor(203, 213, 225);
  doc.text('-', cX3 + colW / 2, curY + (r7H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r7H);

  // Cols 6-8: NET AMT Highlight Box (Emerald-100 #dcfce7)
  doc.setFillColor(220, 252, 231);
  doc.rect(cX4, curY, 3 * colW, r7H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70); // Emerald-800
  drawFittedText(doc, `NET AMT: ${formatNumberForPdf(patti.netAmount)}`, cX4 + colW * 1.5, curY + (r7H / 2) + 1.1, 3 * colW - 4, { align: 'center', maxFontSize: 7.4, minFontSize: 5.5 });
  doc.line(cX7, curY, cX7, curY + r7H);

  // Col 9: CHQ NO label
  doc.setFillColor(248, 250, 252);
  doc.rect(cX7, curY, colW, r7H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ NO', cX7 + colW / 2, curY + (r7H / 2) + 1.1, { align: 'center' });
  doc.line(cX8, curY, cX8, curY + r7H);

  // Col 10: CHQ NO value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, String(patti.chqNo || '-').slice(0, 10), cX8 + colW / 2, curY + (r7H / 2) + 1.1, colW - 1, { align: 'center', maxFontSize: 6.0, minFontSize: 4.8 });
  drawRowBorder(r7H);
  curY += r7H;

  // Row 8: SELLERCOM + CHQ PAID + CHQ DT (Height: 4.4 mm)
  const r8H = 4.4;
  drawRowLabel('SELLERCOM', r8H, true);
  // Col 3: Seller com
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.sellerCom > 0 ? formatNumberForPdf(patti.sellerCom) : '-', cX1 + colW / 2, curY + (r8H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r8H);

  // Cols 4-5: '-'
  doc.setTextColor(203, 213, 225);
  doc.text('-', cX2 + colW / 2, curY + (r8H / 2) + 1.1, { align: 'center' });
  doc.line(cX3, curY, cX3, curY + r8H);
  doc.text('-', cX3 + colW / 2, curY + (r8H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r8H);

  // Cols 6-8: CHQ PAID Highlight Box (Blue-50)
  doc.setFillColor(239, 246, 255);
  doc.rect(cX4, curY, 3 * colW, r8H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216); // Blue-700
  drawFittedText(doc, `CHQ PAID: ${patti.chqAm > 0 ? formatNumberForPdf(patti.chqAm) : '0.00'}`, cX4 + colW * 1.5, curY + (r8H / 2) + 1.1, 3 * colW - 4, { align: 'center', maxFontSize: 6.8, minFontSize: 5.2 });
  doc.line(cX7, curY, cX7, curY + r8H);

  // Col 9: CHQ DT label
  doc.setFillColor(248, 250, 252);
  doc.rect(cX7, curY, colW, r8H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('CHQ DT', cX7 + colW / 2, curY + (r8H / 2) + 1.1, { align: 'center' });
  doc.line(cX8, curY, cX8, curY + r8H);

  // Col 10: CHQ DT value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  const chqDtText = formatDateForPdf(patti.chqDt || patti.clearedDate);
  drawFittedText(doc, chqDtText, cX8 + colW / 2, curY + (r8H / 2) + 1.1, colW - 1, { align: 'center', maxFontSize: 5.8, minFontSize: 4.8 });
  drawRowBorder(r8H);
  curY += r8H;

  // Row 9: SHORTAGE + SHORTAGE DIFF + BANK (Height: 4.4 mm)
  const r9H = 4.4;
  drawRowLabel('SHORTAGE', r9H, true, [190, 18, 60]);
  // Col 3: Shortage amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.manualShortage > 0 ? formatNumberForPdf(patti.manualShortage) : '0.00', cX1 + colW / 2, curY + (r9H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r9H);

  // Cols 4-5: '-'
  doc.setTextColor(203, 213, 225);
  doc.text('-', cX2 + colW / 2, curY + (r9H / 2) + 1.1, { align: 'center' });
  doc.line(cX3, curY, cX3, curY + r9H);
  doc.text('-', cX3 + colW / 2, curY + (r9H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r9H);

  // Cols 6-8: SHORTAGE DIFF Highlight Box
  const isDiffPositive = patti.shortageDelta >= 0;
  doc.setFillColor(isDiffPositive ? 230 : 255, isDiffPositive ? 249 : 241, isDiffPositive ? 240 : 242);
  doc.rect(cX4, curY, 3 * colW, r9H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isDiffPositive ? 6 : 190, isDiffPositive ? 95 : 18, isDiffPositive ? 70 : 60);
  drawFittedText(doc, `SHORTAGE DIFF: ${formatNumberForPdf(patti.shortageDelta)}`, cX4 + colW * 1.5, curY + (r9H / 2) + 1.1, 3 * colW - 4, { align: 'center', maxFontSize: 6.8, minFontSize: 5.2 });
  doc.line(cX7, curY, cX7, curY + r9H);

  // Col 9: BANK label
  doc.setFillColor(248, 250, 252);
  doc.rect(cX7, curY, colW, r9H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('BANK', cX7 + colW / 2, curY + (r9H / 2) + 1.1, { align: 'center' });
  doc.line(cX8, curY, cX8, curY + r9H);

  // Col 10: BANK value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  drawFittedText(doc, String(patti.bank || '-').slice(0, 14), cX8 + colW / 2, curY + (r9H / 2) + 1.1, colW - 1, { align: 'center', maxFontSize: 5.8, minFontSize: 4.8 });
  drawRowBorder(r9H);
  curY += r9H;

  // Row 10: Q-DIFF (Height: 4.1 mm)
  const r10H = 4.1;
  drawRowLabel('Q-DIFF', r10H);
  // Col 3: Q-Diff value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 23, 42);
  doc.text(patti.qDiff > 0 ? formatNumberForPdf(patti.qDiff) : '0.00', cX1 + colW / 2, curY + (r10H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX2, curY, cX2, curY + r10H);

  // Cols 4-10: '-'
  doc.setTextColor(203, 213, 225);
  for (let i = 1; i < 8; i++) {
    const slotLeft = cX1 + (i * colW);
    if (i > 1) {
      doc.line(slotLeft, curY, slotLeft, curY + r10H);
    }
    doc.text('-', slotLeft + colW / 2, curY + (r10H / 2) + 1.1, { align: 'center' });
  }
  drawRowBorder(r10H);
  curY += r10H;

  // Row 11: TOTAL DEDUCTIBLES & REMARKS (Height: 4.6 mm)
  const r11H = 4.6;
  drawRowLabel('TOTAL DEDUCTIBLES', r11H);

  // Cols 3-4: Deductibles Sum in Red-100 box
  doc.setFillColor(254, 226, 226); // Red-100 #fee2e2
  doc.rect(cX1, curY, 2 * colW, r11H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(190, 18, 60); // Rose-700
  doc.text(formatNumberForPdf(patti.expensesSum), cX1 + colW, curY + (r11H / 2) + 1.1, { align: 'center' });
  doc.setDrawColor(218, 224, 233);
  doc.line(cX3, curY, cX3, curY + r11H);

  // Col 5: REMARKS: label
  doc.setFillColor(248, 250, 252);
  doc.rect(cX3, curY, colW, r11H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REMARKS:', cX3 + colW / 2, curY + (r11H / 2) + 1.1, { align: 'center' });
  doc.line(cX4, curY, cX4, curY + r11H);

  // Cols 6-10: Remarks content
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.8);
  doc.setTextColor(51, 65, 85);
  drawFittedText(doc, patti.remarks || 'None', cX4 + 2.5, curY + (r11H / 2) + 1.1, w - (cX4 - x) - 4, { maxFontSize: 5.8, minFontSize: 4.8 });
  drawRowBorder(r11H);
  curY += r11H;

  // 4. Bottom Row: PAYABLE Highlight & Auth Sign (Height: y + h - curY)
  const botH = (y + h) - curY;
  if (botH > 2) {
    // Left side: PAYABLE: Rs. X,XX,XXX.00
    doc.setFillColor(220, 252, 231); // Emerald-100
    doc.rect(x + 0.35, curY, 97, botH - 0.35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70); // Emerald-800
    drawFittedText(doc, `PAYABLE: Rs. ${formatNumberForPdf(patti.netAmount)}`, x + 3.5, curY + (botH / 2) + 1.2, 90, { maxFontSize: 7.8, minFontSize: 5.8 });

    // Right side: Auth Sign
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Auth Sign: ___________________________', x + w - 3.5, curY + (botH / 2) + 1.2, { align: 'right' });
  }
}

/**
 * Generate A4 Portrait Patti Book PDF supporting both 2x2 and 1x4 layouts
 * with 4 Pattis per page and exactly ONE shared header per page.
 */
export async function generatePattiBookPdf(options: GeneratePdfOptions): Promise<{
  doc: jsPDF;
  blob: Blob;
  blobUrl: string;
  totalPages: number;
  filename: string;
}> {
  const { records, layout = '2x2', separatePagesPerMiller = false, logoDataUrl } = options;

  if (!records || records.length === 0) {
    throw new Error('No records selected for Patti Book PDF export.');
  }

  // 1. Group records into 4-per-page chunks according to miller setting
  let pageChunks: (PattiRecordItem | null)[][] = [];

  if (separatePagesPerMiller) {
    // Group by miller
    const millerMap = new Map<string, PattiRecordItem[]>();
    records.forEach(r => {
      const list = millerMap.get(r.millerName) || [];
      list.push(r);
      millerMap.set(r.millerName, list);
    });

    millerMap.forEach(millerRecords => {
      for (let i = 0; i < millerRecords.length; i += 4) {
        const chunk: (PattiRecordItem | null)[] = [
          millerRecords[i] || null,
          millerRecords[i + 1] || null,
          millerRecords[i + 2] || null,
          millerRecords[i + 3] || null
        ];
        pageChunks.push(chunk);
      }
    });
  } else {
    // Default: 4 consecutive records per page across millers
    for (let i = 0; i < records.length; i += 4) {
      const chunk: (PattiRecordItem | null)[] = [
        records[i] || null,
        records[i + 1] || null,
        records[i + 2] || null,
        records[i + 3] || null
      ];
      pageChunks.push(chunk);
    }
  }

  const totalPages = pageChunks.length;

  // 2. Initialize jsPDF A4 portrait: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // Cell Coordinates for 2x2 Grid (Printer-Safe Margins)
  const cellW_2x2 = 95; // mm
  const cellH_2x2 = 128; // mm
  const topGridY = 28; // mm (Immediately below shared header)
  const bottomGridY = 160; // mm
  const leftGridX = 8; // mm
  const rightGridX = 107; // mm

  const cellPositions2x2 = [
    { x: leftGridX, y: topGridY },     // Position 1: Top-Left
    { x: rightGridX, y: topGridY },    // Position 2: Top-Right
    { x: leftGridX, y: bottomGridY },  // Position 3: Bottom-Left
    { x: rightGridX, y: bottomGridY }  // Position 4: Bottom-Right
  ];

  // Cell Coordinates for 1x4 Stack (Full Page Width Stack)
  const cellW_1x4 = 194; // mm
  const cellH_1x4 = 62; // mm
  const cellPositions1x4 = [
    { x: leftGridX, y: 28 },     // Slip 1
    { x: leftGridX, y: 92.5 },   // Slip 2
    { x: leftGridX, y: 157 },    // Slip 3
    { x: leftGridX, y: 221.5 }   // Slip 4
  ];

  // 3. Render Each Page
  pageChunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage('a4', 'portrait');
    }

    const pageNum = pageIndex + 1;

    // A. Shared Tejas Canvassing Company Header (ONCE per page)
    drawSharedPageHeader(doc, pageNum, totalPages, logoDataUrl);

    // B. Four Pattis in designated layout
    if (layout === '1x4') {
      chunk.forEach((patti, cellIdx) => {
        const pos = cellPositions1x4[cellIdx];
        drawSinglePattiRow1x4(doc, patti, pos.x, pos.y, cellW_1x4, cellH_1x4, cellIdx);
      });
    } else {
      chunk.forEach((patti, cellIdx) => {
        const pos = cellPositions2x2[cellIdx];
        drawSinglePattiCell(doc, patti, pos.x, pos.y, cellW_2x2, cellH_2x2, cellIdx);
      });
    }

    if (options.onProgress) {
      options.onProgress(Math.round((pageNum / totalPages) * 100), pageNum);
    }
  });

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const exportedDate = new Date().toISOString().split('T')[0];
  const filename = `Patti_Book_${layout}_${exportedDate}.pdf`;

  return {
    doc,
    blob,
    blobUrl,
    totalPages,
    filename
  };
}

/**
 * Generate single Patti PDF in 4-up format (top-left, rest blank)
 */
export async function generateSinglePattiPdf(
  patti: PattiRecordItem, 
  logoDataUrl?: string | null
): Promise<{
  doc: jsPDF;
  blob: Blob;
  blobUrl: string;
  filename: string;
}> {
  const result = await generatePattiBookPdf({
    records: [patti],
    separatePagesPerMiller: false,
    logoDataUrl
  });

  const safeParty = (patti.partyName || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Patti_Receipt_${safeParty}_${patti.id.slice(-8)}.pdf`;

  return {
    doc: result.doc,
    blob: result.blob,
    blobUrl: result.blobUrl,
    filename
  };
}
