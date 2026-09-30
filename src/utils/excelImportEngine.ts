import * as XLSX from 'xlsx';
import { db, invalidateCollectionCache } from '../lib/firebase';
import { writeBatch, doc } from 'firebase/firestore';

export interface ColumnDefinition {
  id: string;
  label: string;
  type: string;
  group?: string;
}

export interface DetectedColumn {
  index: number;
  rawHeader: string;
  mappedFieldId: string | null;
  confidence: number;
  sampleValues: any[];
  warning?: string;
  ignored?: boolean;
  detectedType: 'Date' | 'Text' | 'Number' | 'Select' | 'Calc';
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  invalidRows: number;
  sampleRows: any[];
  detectedColumns: DetectedColumn[];
}

export interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  rejected: number;
  currentBatch: number;
  totalBatches: number;
  percent: number;
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'completed' | 'error';
  errorMessage?: string;
  errors: Array<{ row: number; billNo?: string; error: string }>;
}

export const TARGET_COLUMNS: ColumnDefinition[] = [
  { id: 'date', label: 'DATE', type: 'date', group: 'Meta' },
  { id: 'millerName', label: 'SUPPLIER (MILLER)', type: 'select', group: 'Entity' },
  { id: 'place', label: 'SUPPLIER PLACE', type: 'text', group: 'Meta' },
  { id: 'brand', label: 'BRAND', type: 'select', group: 'Product' },
  { id: 'partyName', label: 'BUYER (PARTY)', type: 'select', group: 'Entity' },
  { id: 'noOfDays', label: 'NO. OF DAYS', type: 'text', group: 'Logistics' },
  { id: 'noOfDayRec', label: 'PAYMENT STATUS', type: 'select', group: 'Logistics' },
  { id: 'area', label: 'BUYER AREA (SHOP)', type: 'text', group: 'Meta' },
  { id: 'billNo', label: 'BILL NO', type: 'text', group: 'Meta' },
  { id: 'qty', label: 'QTLS (QUANTITY)', type: 'number', group: 'Weight' },
  { id: 'rate', label: 'RATE', type: 'number', group: 'Pricing' },
  { id: 'amount', label: 'AMOUNT', type: 'calc', group: 'Pricing' },
  { id: 'lh', label: 'L.H. (LOADING)', type: 'number', group: 'Charges' },
  { id: 'cc', label: 'C.C (BROKERAGE)', type: 'number', group: 'Charges' },
  { id: 'tds', label: 'TDS (TAX)', type: 'number', group: 'Taxes' },
  { id: 'shortage', label: 'SHORTAGE', type: 'number', group: 'Charges' },
  { id: 'diffIn', label: 'DIFF. IN', type: 'number', group: 'Pricing' },
  { id: 'netAmt', label: 'NET AMT', type: 'calc', group: 'Pricing' },
  { id: 'chqAm', label: 'CHQ AM (PAID)', type: 'number', group: 'Settlement' },
  { id: 'chqNo', label: 'CH/DD NO.', type: 'text', group: 'Settlement' },
  { id: 'chqDt', label: 'CHQ DT', type: 'date', group: 'Settlement' },
  { id: 'bank', label: 'BANK', type: 'text', group: 'Settlement' },
  { id: 'purchaseOrderNo', label: 'PURCHASE ORDER NO', type: 'po-select', group: 'Fulfillment' }
];

export const TARGET_COL_TYPE_MAP: Record<string, string> = {
  date: 'date',
  millerName: 'text',
  place: 'text',
  brand: 'text',
  partyName: 'text',
  noOfDays: 'text',
  noOfDayRec: 'select',
  payment: 'text',
  area: 'text',
  billNo: 'text',
  qty: 'number',
  rate: 'number',
  amount: 'calc',
  lh: 'number',
  cc: 'number',
  tds: 'number',
  shortage: 'number',
  diffIn: 'number',
  netAmt: 'calc',
  chqAm: 'number',
  chqNo: 'text',
  chqDt: 'date',
  bank: 'text',
  billPhoto: 'text',
  purchaseOrderNo: 'text'
};

/**
 * Business rules for deriving payment status and preserving payment history:
 *
 * Example A:
 *   Payment = "19 days", Payment Status = "Cleared", CHQ = "123456"
 *   -> Payment = "19 days", Payment Status = "Cleared"
 *
 * Example B:
 *   Payment = "19 days", Payment Status = "Pending", CHQ = blank
 *   -> Payment = "19 days", Payment Status = "Not Cleared"
 *
 * Example C:
 *   Payment = "19 days", Payment Status = blank, CHQ = "123456"
 *   -> Payment = "19 days", Payment Status = "Cleared"
 */
export function derivePaymentStatus(row: Record<string, any>): {
  effectiveStatus: 'Cleared' | 'Not Cleared' | string;
  originalPayment: string;
} {
  let rawNoOfDays = row.noOfDays !== undefined && row.noOfDays !== null ? String(row.noOfDays).trim() : '';
  let rawNoOfDayRec = row.noOfDayRec !== undefined && row.noOfDayRec !== null ? String(row.noOfDayRec).trim() : '';

  const isDaysStatusWord = /^(cleared|clear|paid|pending|not cleared|not-cleared|unpaid)$/i.test(rawNoOfDays);
  const isRecDayCount = /^\d+\s*days?$/i.test(rawNoOfDayRec) || (!isNaN(Number(rawNoOfDayRec)) && Number(rawNoOfDayRec) > 0 && Number(rawNoOfDayRec) < 1000);

  // If columns are reversed (e.g. noOfDays has 'Cleared' and noOfDayRec has '17 days'), swap them
  if (isDaysStatusWord && isRecDayCount) {
    const temp = rawNoOfDays;
    rawNoOfDays = rawNoOfDayRec;
    rawNoOfDayRec = temp;
    row.noOfDays = rawNoOfDays;
    row.noOfDayRec = rawNoOfDayRec;
  } else if (isDaysStatusWord && !rawNoOfDayRec) {
    rawNoOfDayRec = rawNoOfDays;
    rawNoOfDays = '';
    row.noOfDays = '';
    row.noOfDayRec = rawNoOfDayRec;
  } else if (isRecDayCount && !rawNoOfDays) {
    rawNoOfDays = rawNoOfDayRec;
    row.noOfDays = rawNoOfDays;
  }

  // 1. Extract raw payment terms / history (must NOT be a status word)
  const rawPayment = row.payment !== undefined && row.payment !== null
    ? String(row.payment).trim()
    : (!isDaysStatusWord && rawNoOfDays ? rawNoOfDays : '');

  // 2. Extract raw status from any available alias
  const rawStatus = rawNoOfDayRec !== ''
    ? rawNoOfDayRec
    : (row.paymentStatus !== undefined && row.paymentStatus !== null && String(row.paymentStatus).trim() !== ''
      ? String(row.paymentStatus).trim()
      : (row.status !== undefined && row.status !== null ? String(row.status).trim() : ''));

  // 3. Extract raw cheque / reference / paid amount
  const rawChq = row.chqNo !== undefined && row.chqNo !== null ? String(row.chqNo).trim() : '';
  const hasMeaningfulChq = rawChq !== '' && rawChq !== '-' && rawChq !== '0' && rawChq.toLowerCase() !== 'null' && rawChq.toLowerCase() !== 'undefined';
  const hasMeaningfulChqAmt = row.chqAm !== undefined && row.chqAm !== null && parseFloat(String(row.chqAm).replace(/[₹,\s]/g, '')) > 0;

  const statusLower = rawStatus.toLowerCase();
  const isExplicitCleared = ['cleared', 'clear', 'paid', 'complete', 'completed', 'received', 'done'].includes(statusLower);
  const isExplicitPending = ['pending', 'not cleared', 'not-cleared', 'unpaid', 'due'].includes(statusLower);

  // If status contains a days pattern like "19 days" or "25 days", treat it as payment value, NOT status
  let finalPayment = rawPayment;
  if (/^\d+\s*days?$/i.test(statusLower) || /^\d+$/.test(statusLower)) {
    if (!finalPayment) finalPayment = rawStatus;
  }

  // Precedence Rule 1: Explicit Cleared/Paid AND meaningful CHQ or paid amount -> Cleared
  if (isExplicitCleared && (hasMeaningfulChq || hasMeaningfulChqAmt)) {
    return { effectiveStatus: 'Cleared', originalPayment: finalPayment };
  }

  // Precedence Rule 2: Explicit Cleared/Paid -> preserve Cleared
  if (isExplicitCleared) {
    return { effectiveStatus: 'Cleared', originalPayment: finalPayment };
  }

  // Precedence Rule 3: Status is blank/unspecified, but meaningful CHQ or paid amount exists -> Cleared
  if ((!rawStatus || /^\d+\s*days?$/i.test(statusLower)) && (hasMeaningfulChq || hasMeaningfulChqAmt)) {
    return { effectiveStatus: 'Cleared', originalPayment: finalPayment };
  }

  // Precedence Rule 4: Explicit Pending/Unpaid/Not Cleared and no evidence of clearance -> Not Cleared
  if (isExplicitPending) {
    return { effectiveStatus: 'Not Cleared', originalPayment: finalPayment };
  }

  // Precedence Rule 5: If rawStatus is another known business status (e.g. 'Partial') -> preserve it
  if (rawStatus && !isExplicitPending && !/^\d+\s*days?$/i.test(statusLower)) {
    return { effectiveStatus: rawStatus, originalPayment: finalPayment };
  }

  return { effectiveStatus: 'Not Cleared', originalPayment: finalPayment };
}

import { 
  normalizeDate, 
  dateToTimestamp, 
  formatDateDisplay, 
  isValidDate,
  isLikelyDateValue
} from './dateUtils';

/**
 * Safe normalization of cell values preventing blank displays for valid types
 */
export function normalizeCellValue(val: any, colType?: string): any {
  if (val === null || val === undefined) return '';

  // Dates
  if (colType === 'date') {
    return normalizeDate(val);
  }

  // Firestore Timestamp
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    val = val.toDate();
  }

  // JavaScript Date
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return normalizeDate(val);
  }

  // Excel cell object (e.g. { v: "...", t: "s" })
  if (typeof val === 'object' && !Array.isArray(val)) {
    if ('v' in val && val.v !== undefined && val.v !== null) {
      val = val.v;
    } else if ('w' in val && typeof val.w === 'string') {
      val = val.w;
    } else if ('text' in val && typeof val.text === 'string') {
      val = val.text;
    }
  }

  // Numbers (keep 0!)
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return val;
  }

  const str = String(val).trim();
  if (!str) return '';

  // Formula quoted strings e.g. ="K.K." -> K.K.
  const formulaStrMatch = str.match(/^="([^"]+)"$/);
  if (formulaStrMatch) {
    return formulaStrMatch[1];
  }

  if (colType === 'number' || colType === 'calc') {
    const num = parseFloat(str.replace(/[₹\s,]/g, ''));
    if (!isNaN(num)) return num;
    if (str.startsWith('=')) return str; // Actual math formula
  }

  return str;
}

export const KNOWN_MILLER_REGIONS = new Set([
  'MIRYALGUDA', 'SURYAPET', 'GADCHIROLI', 'GADCHIROLLI', 'NELLORE', 'NAGPUR',
  'HUZURNAGAR', 'WARANGAL', 'KARIMNAGAR', 'RAICHUR', 'BELLARY', 'DAVANAGERE', 'NIZAMABAD'
]);

export const KNOWN_BUYER_REGIONS = new Set([
  '4TH BLOCK', '5TH BLOCK', 'YESHWANTHPUR', 'APMC', 'WHITEFIELD', 'K R PURAM',
  'CHIKPET', 'TIPTUR', 'TUMKUR', 'MANDYA', 'MYSORE', 'HOSUR', 'BANGALORE'
]);

// Canonical aliases to ensure ONE reliable date function throughout
export const parseDate = normalizeDate;
export const parseDateToTime = dateToTimestamp;
export const formatDateToDisplayLong = formatDateDisplay;
export const isValidDateValue = isValidDate;

/**
 * Stable sort records by Arrival Date ASCENDING (oldest first, newest last)
 */
export function sortArrivalRowsOldestToNewest<T extends { date?: any }>(rows: T[]): T[] {
  return rows
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const timeA = dateToTimestamp(a.item.date);
      const timeB = dateToTimestamp(b.item.date);
      if (timeA !== timeB) {
        return timeA - timeB; // Oldest first, newest last
      }
      return a.index - b.index; // Stable sort preserving relative order
    })
    .map(x => x.item);
}

/**
 * Intelligent Column Matcher with Position and Context Awareness
 */
export function detectColumnMapping(
  rawHeaders: string[],
  sampleRows: any[][]
): DetectedColumn[] {
  const detected: DetectedColumn[] = [];

  // Pass 1: find Miller Name index and Buyer Name index to disambiguate position-based duplicate "AREA" columns
  let millerColIdx = -1;
  let buyerColIdx = -1;

  rawHeaders.forEach((h, idx) => {
    const norm = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      norm.includes('miller') ||
      norm.includes('supplier') ||
      norm.includes('mill') ||
      norm.includes('seller')
    ) {
      if (!norm.includes('area') && !norm.includes('place') && !norm.includes('loc')) {
        millerColIdx = idx;
      }
    }
    if (
      norm.includes('buyer') ||
      norm.includes('party') ||
      norm.includes('shop') ||
      norm.includes('customer') ||
      norm.includes('client')
    ) {
      if (!norm.includes('area') && !norm.includes('place') && !norm.includes('loc')) {
        buyerColIdx = idx;
      }
    }
  });

  // Pass 2: map every column by header text, position, and sample values
  rawHeaders.forEach((rawHeader, colIdx) => {
    const cleanHeader = String(rawHeader || '').trim();
    const norm = cleanHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
    const colSamples = sampleRows.map(r => r[colIdx]).filter(v => v !== undefined && v !== '');

    let mappedFieldId: string | null = null;
    let confidence = 0;
    let warning: string | undefined;

    // 1. DUPLICATE / POSITION-BASED "AREA" DISAMBIGUATION
    if (norm === 'area' || norm === 'place' || norm === 'location' || norm === 'city') {
      // Check proximity to Miller vs Buyer
      const distToMiller = millerColIdx !== -1 ? Math.abs(colIdx - millerColIdx) : 999;
      const distToBuyer = buyerColIdx !== -1 ? Math.abs(colIdx - buyerColIdx) : 999;

      // Also sample check if values match known miller origins (e.g. Miryalguda) or buyer areas (e.g. 4th Block)
      let millerRegionMatches = 0;
      let buyerRegionMatches = 0;
      colSamples.forEach(val => {
        const up = String(val).toUpperCase();
        if (Array.from(KNOWN_MILLER_REGIONS).some(r => up.includes(r))) millerRegionMatches++;
        if (Array.from(KNOWN_BUYER_REGIONS).some(r => up.includes(r))) buyerRegionMatches++;
      });

      if (colIdx < buyerColIdx || millerRegionMatches > buyerRegionMatches || (colIdx === millerColIdx + 1)) {
        mappedFieldId = 'place'; // Miller Place
        confidence = 0.85;
      } else {
        mappedFieldId = 'area'; // Buyer Area
        confidence = 0.85;
      }
    }
    // 2. Direct exact or regex matching for Dates
    const isChqDate = (
      norm.includes('chqdate') ||
      norm.includes('chequedate') ||
      norm === 'chqdt' ||
      norm === 'chequedt' ||
      norm.includes('paymentdate') ||
      norm === 'paydate' ||
      norm.includes('cleardate') ||
      norm.includes('clearancedate') ||
      ((norm.includes('date') || norm === 'dt') && (norm.includes('chq') || norm.includes('cheque') || norm.includes('pay')))
    );

    const isArrivalDate = !isChqDate && (
      norm === 'date' ||
      norm === 'arrivaldate' ||
      norm === 'dateofarrival' ||
      norm === 'billdate' ||
      norm === 'invoicedate' ||
      norm === 'orderdate' ||
      norm === 'dt' ||
      norm === 'arrdate' ||
      norm === 'arrdt' ||
      norm === 'arrivaldt' ||
      norm === 'loadingdate' ||
      norm === 'loaddate' ||
      norm === 'dispatchdate' ||
      norm === 'entrydate' ||
      norm.includes('date') ||
      norm === 'arrival'
    );

    if (isChqDate) {
      mappedFieldId = 'chqDt';
      confidence = 0.99;
    } else if (isArrivalDate) {
      mappedFieldId = 'date';
      confidence = 0.99;
    }
    else if (
      norm.includes('miller') ||
      norm.includes('supplier') ||
      norm === 'mill' ||
      norm === 'millname' ||
      norm === 'suppliername'
    ) {
      if (norm.includes('place') || norm.includes('loc') || norm.includes('area') || norm.includes('origin')) {
        mappedFieldId = 'place';
      } else {
        mappedFieldId = 'millerName';
      }
      confidence = 0.95;
    }
    else if (
      norm.includes('party') ||
      norm.includes('buyer') ||
      norm === 'shop' ||
      norm === 'shopname' ||
      norm === 'buyernamer' ||
      norm === 'buyername' ||
      norm === 'partyname' ||
      norm === 'customer' ||
      norm === 'client'
    ) {
      if (norm.includes('area') || norm.includes('loc') || norm.includes('place') || norm.includes('shoparea')) {
        mappedFieldId = 'area';
      } else {
        mappedFieldId = 'partyName';
      }
      confidence = 0.95;
    }
    else if (norm.includes('brand') || norm === 'item' || norm === 'variety' || norm === 'quality') {
      mappedFieldId = 'brand';
      confidence = 0.9;
    }
    else if (
      norm.includes('bill') ||
      norm.includes('invoice') ||
      norm === 'invno' ||
      norm === 'billno' ||
      norm === 'invoiceno'
    ) {
      if (norm.includes('photo') || norm.includes('image')) {
        mappedFieldId = 'billPhoto';
      } else {
        mappedFieldId = 'billNo';
      }
      confidence = 0.95;
    }
    else if (norm.includes('qtl') || norm === 'qty' || norm === 'quantity' || norm === 'quintals' || norm === 'weight') {
      mappedFieldId = 'qty';
      confidence = 0.95;
    }
    else if (norm === 'rate' || norm === 'price' || norm.includes('rateperqtl') || norm === 'unitprice') {
      mappedFieldId = 'rate';
      confidence = 0.95;
    }
    else if (norm === 'amount' || norm === 'amt' || norm === 'grossamt' || norm === 'totalamt') {
      mappedFieldId = 'amount';
      confidence = 0.9;
    }
    else if (norm === 'lh' || norm.includes('loading') || norm.includes('labour')) {
      mappedFieldId = 'lh';
      confidence = 0.9;
    }
    else if (norm === 'cc' || norm.includes('commission') || norm.includes('brokerage')) {
      mappedFieldId = 'cc';
      confidence = 0.9;
    }
    else if (norm === 'tds' || norm === 'tax') {
      mappedFieldId = 'tds';
      confidence = 0.9;
    }
    else if (norm.includes('shortage')) {
      mappedFieldId = 'shortage';
      confidence = 0.9;
    }
    else if (norm.includes('diff') || norm === 'difference') {
      mappedFieldId = 'diffIn';
      confidence = 0.9;
    }
    else if (norm.includes('netamt') || norm.includes('netamount') || norm === 'finalamount' || norm === 'balance') {
      mappedFieldId = 'netAmt';
      confidence = 0.95;
    }
    else if (norm.includes('chqam') || norm.includes('paidamt') || norm.includes('chequeamt') || norm.includes('receivedamt')) {
      mappedFieldId = 'chqAm';
      confidence = 0.95;
    }
    else if (
      norm === 'chq' || norm === 'cheque' || norm.startsWith('chq') || norm.startsWith('cheque') ||
      norm.includes('chqno') || norm.includes('chequeno') || norm.includes('chequenum') ||
      norm.includes('chequenumber') || norm.includes('ddno') || norm.includes('utr') ||
      norm.includes('chequeref') || norm.includes('chqref') || norm === 'refno' || norm === 'transactionno'
    ) {
      if (!norm.includes('am') && !norm.includes('amt') && !norm.includes('amount') && !norm.includes('date') && !norm.includes('dt')) {
        mappedFieldId = 'chqNo';
        confidence = 0.95;
      }
    }
    else if (norm.includes('bank')) {
      mappedFieldId = 'bank';
      confidence = 0.9;
    }
    // Sample-value-based inspection for Days vs Status
    const hasStatusSamples = colSamples.some(v => /^(cleared|clear|paid|pending|not cleared|not-cleared|unpaid)$/i.test(String(v).trim()));
    const hasDaysSamples = colSamples.some(v => /^\d+\s*days?$/i.test(String(v).trim()) || (!isNaN(Number(v)) && Number(v) > 0 && Number(v) < 1000));

    // Content-based prioritization for days vs payment status
    if (hasStatusSamples && !hasDaysSamples && (norm.includes('day') || norm.includes('status') || norm.includes('rec') || norm.includes('pay'))) {
      mappedFieldId = 'noOfDayRec'; // Payment Status
      confidence = 0.99;
    }
    else if (hasDaysSamples && !hasStatusSamples && (norm.includes('day') || norm.includes('rec') || norm.includes('pending') || norm.includes('terms'))) {
      mappedFieldId = 'noOfDays'; // No. of Days
      confidence = 0.99;
    }
    // REVERSED AS REQUESTED:
    // Header "NOOFDAYS" / "NO OF DAYS" contains "Cleared" -> mapped to PAYMENT STATUS (noOfDayRec)
    else if (
      norm === 'noofdays' || norm === 'noofday' || norm === 'status' ||
      norm === 'paymentstatus' || norm === 'paystatus' || norm === 'recstatus' ||
      (norm.includes('status') && !norm.includes('order'))
    ) {
      mappedFieldId = 'noOfDayRec';
      confidence = 0.99;
    }
    // Header "NOOFDAYREC" / "NO OF DAYS REC" contains "17 days" -> mapped to NO. OF DAYS (noOfDays)
    else if (
      norm === 'noofdaysrec' || norm === 'noofdayrec' || norm === 'daysrec' || norm === 'dayrec' ||
      norm === 'noofdaysreceived' || norm === 'daysreceived' || (norm.includes('day') && norm.includes('rec')) ||
      norm === 'days' || norm === 'pendingdays' || norm === 'noofdayspending' || norm === 'nodays' || norm === 'day'
    ) {
      mappedFieldId = 'noOfDays';
      confidence = 0.99;
    }
    // PAYMENT TERMS / PAYMENT: "PAYMENT", "PAYMENT DAYS", "PAYMENT TERMS", "PAY TERMS"
    else if (
      norm === 'payment' || norm === 'paymentterms' || norm === 'payterms' ||
      norm === 'terms' || norm.includes('paymentterms')
    ) {
      mappedFieldId = 'noOfDays';
      confidence = 0.95;
    }
    else if (norm === 'po' || norm === 'pono' || norm === 'purchaseorder' || norm === 'purchaseorderno' || ((norm.includes('po') || norm.includes('order')) && !norm.includes('date')) || norm.includes('contract')) {
      mappedFieldId = 'purchaseOrderNo';
      confidence = 0.85;
    }

    // Check sample values if still unmapped: if sample values are dates, auto-detect type = Date and map to date!
    const likelyDateSamples = colSamples.filter(s => isLikelyDateValue(s));
    const isMostlyDates = colSamples.length > 0 && (likelyDateSamples.length / colSamples.length >= 0.6);

    if (!mappedFieldId && isMostlyDates) {
      if (norm.includes('chq') || norm.includes('cheque') || norm.includes('pay')) {
        mappedFieldId = 'chqDt';
      } else {
        mappedFieldId = 'date';
      }
      confidence = 0.95;
    }

    // Deduce detectedType: 'Date' | 'Text' | 'Number' | 'Select' | 'Calc'
    let detectedType: 'Date' | 'Text' | 'Number' | 'Select' | 'Calc' = 'Text';
    if (mappedFieldId === 'date' || mappedFieldId === 'chqDt' || isMostlyDates) {
      detectedType = 'Date';
    } else if (mappedFieldId === 'amount' || mappedFieldId === 'netAmt') {
      detectedType = 'Calc';
    } else if (mappedFieldId && TARGET_COL_TYPE_MAP[mappedFieldId] === 'select') {
      detectedType = 'Select';
    } else if (mappedFieldId && TARGET_COL_TYPE_MAP[mappedFieldId] === 'number') {
      detectedType = 'Number';
    } else {
      const numericSamples = colSamples.filter(s => {
        if (typeof s === 'number') return true;
        const clean = String(s).replace(/[₹,\s]/g, '');
        return clean !== '' && !isNaN(Number(clean));
      });
      if (colSamples.length > 0 && numericSamples.length / colSamples.length >= 0.7) {
        detectedType = 'Number';
      } else {
        detectedType = 'Text';
      }
    }

    // For date columns, check sample values to see if any are unparseable
    if (detectedType === 'Date') {
      const invalidSample = colSamples.find(s => !isValidDate(s));
      if (invalidSample) {
        warning = `Sample value "${invalidSample}" is not recognized as a valid calendar date.`;
      }
    } else if (!mappedFieldId && cleanHeader) {
      warning = `Column "${cleanHeader}" could not be automatically matched to a ledger field.`;
    }

    detected.push({
      index: colIdx,
      rawHeader: cleanHeader || `Column ${colIdx + 1}`,
      mappedFieldId,
      confidence,
      sampleValues: colSamples.slice(0, 3),
      warning,
      detectedType
    });
  });

  return detected;
}

/**
 * Validates parsed rows against mapped columns
 */
export function validateImportDataset(
  rawRows: any[][],
  detectedCols: DetectedColumn[]
): ImportValidationSummary {
  const totalRows = rawRows.length;
  let validRows = 0;
  let warningRows = 0;
  let invalidRows = 0;
  const sampleRows: any[] = [];

  const activeMappings = detectedCols.filter(c => c.mappedFieldId && !c.ignored);

  rawRows.forEach((r, idx) => {
    let hasData = false;
    let hasBill = false;
    let hasPartyOrMiller = false;

    const rowObj: Record<string, any> = {};

    activeMappings.forEach(col => {
      const rawVal = r[col.index];
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
        hasData = true;
        rowObj[col.mappedFieldId!] = rawVal;
        if (col.mappedFieldId === 'billNo') hasBill = true;
        if (col.mappedFieldId === 'partyName' || col.mappedFieldId === 'millerName') {
          hasPartyOrMiller = true;
        }
      }
    });

    if (!hasData) {
      invalidRows++;
    } else if (hasBill && hasPartyOrMiller) {
      validRows++;
    } else {
      warningRows++;
    }

    if (idx < 5 && hasData) {
      sampleRows.push(rowObj);
    }
  });

  return {
    totalRows,
    validRows,
    warningRows,
    invalidRows,
    sampleRows,
    detectedColumns: detectedCols
  };
}

/**
 * Executes a controlled, chunked Firestore batch import.
 * Eliminates "Database exceeded" quota errors by:
 * 1. Chunking into max 350 docs per writeBatch
 * 2. Throttled concurrency (1 batch at a time)
 * 3. Exponential backoff retry on RESOURCE_EXHAUSTED
 * 4. Idempotent document IDs to prevent duplicates on retry
 */
export async function executeChunkedBatchImport(
  sheetId: string,
  sheetName: string,
  rawRows: any[][],
  columnMappings: DetectedColumn[],
  onProgress?: (progress: ImportProgress) => void
): Promise<{
  expected: number;
  imported: number;
  rejected: number;
  errors: Array<{ row: number; billNo?: string; error: string }>;
  structuredEntries: any[];
}> {
  const activeMappings = columnMappings.filter(c => c.mappedFieldId && !c.ignored);

  // 1. Transform raw matrix into structured arrival entries
  const structuredEntries: any[] = [];
  const errors: Array<{ row: number; billNo?: string; error: string }> = [];
  const seenDocIds = new Set<string>();

  rawRows.forEach((r, rIdx) => {
    const entry: Record<string, any> = {
      sheetId,
      sheetName,
      lastUpdated: Date.now()
    };

    activeMappings.forEach(col => {
      const val = r[col.index];
      if (val !== undefined && val !== null) {
        const colDef = TARGET_COLUMNS.find(t => t.id === col.mappedFieldId);
        const colType = colDef?.type || TARGET_COL_TYPE_MAP[col.mappedFieldId!] || 'text';

        if (col.mappedFieldId === 'date' || col.mappedFieldId === 'chqDt') {
          entry[col.mappedFieldId] = parseDate(val);
        } else {
          entry[col.mappedFieldId!] = normalizeCellValue(val, colType);
        }
      }
    });

    // Derive and normalize payment status according to business rules
    const { effectiveStatus, originalPayment } = derivePaymentStatus(entry);
    entry.noOfDayRec = effectiveStatus;
    if (originalPayment && !entry.payment) {
      entry.payment = originalPayment;
    }
    if (originalPayment && !entry.noOfDays) {
      entry.noOfDays = originalPayment;
    }

    // Validate normalized date
    if (entry.date) {
      const normalizedD = normalizeDate(entry.date);
      if (!normalizedD) {
        errors.push({
          row: rIdx + 1,
          billNo: entry.billNo,
          error: `Unrecognized or invalid date: "${String(entry.date)}"`
        });
      } else {
        entry.date = normalizedD;
      }
    }

    // Check if row has meaningful data
    const isMeaningful = !!(
      entry.partyName ||
      entry.millerName ||
      entry.billNo ||
      entry.qty ||
      entry.amount ||
      entry.netAmt
    );

    if (isMeaningful) {
      // Deterministic Idempotent Document ID with duplicate protection
      const cleanBill = entry.billNo ? String(entry.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
      const baseDocId = cleanBill
        ? `row-${sheetId}-${cleanBill}`
        : `row-${sheetId}-${rIdx}-${Date.now().toString(36)}`;
      
      const docId = seenDocIds.has(baseDocId)
        ? `${baseDocId}-sub-${rIdx}`
        : baseDocId;
      seenDocIds.add(docId);

      entry.id = docId;
      structuredEntries.push(entry);
    }
  });

  const total = structuredEntries.length;
  if (total === 0) {
    return { expected: 0, imported: 0, rejected: 0, errors: [], structuredEntries: [] };
  }

  // Sort rows oldest first, newest last by Arrival Date (stable sort)
  const sortedEntries = sortArrivalRowsOldestToNewest(structuredEntries);

  // 2. Chunking parameters: 150 documents per batch ensures high reliability and zero rate limit spikes
  const BATCH_SIZE = 150;
  const chunks: any[][] = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    chunks.push(sortedEntries.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let successful = 0;
  let rejected = 0;

  // 3. Process batches sequentially with retries and delay to prevent rate limiting
  for (let bIdx = 0; bIdx < chunks.length; bIdx++) {
    const chunk = chunks[bIdx];
    let attempts = 0;
    let committed = false;

    while (attempts < 5 && !committed) {
      try {
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(db, 'arrival_entries', item.id);
          batch.set(docRef, item, { merge: true });
        });

        await batch.commit();
        committed = true;
        successful += chunk.length;
        processed += chunk.length;

        if (onProgress) {
          onProgress({
            total,
            processed,
            successful,
            rejected,
            currentBatch: bIdx + 1,
            totalBatches: chunks.length,
            percent: Math.round((processed / total) * 100),
            status: 'importing',
            errors
          });
        }

        // Pacing delay between batches to respect Firestore rate limits
        if (bIdx + 1 < chunks.length) {
          await new Promise(res => setTimeout(res, 100));
        }
      } catch (err: any) {
        attempts++;
        console.warn(`Batch ${bIdx + 1} attempt ${attempts} warning:`, err);
        if (attempts >= 5) {
          rejected += chunk.length;
          processed += chunk.length;
          chunk.forEach((item, itemIdx) => {
            errors.push({
              row: bIdx * BATCH_SIZE + itemIdx + 1,
              billNo: item.billNo,
              error: err?.message || 'Firestore batch commit failed after 5 retries.'
            });
          });
        } else {
          // Exponential backoff wait (400ms, 800ms, 1600ms, 3200ms)
          await new Promise(res => setTimeout(res, 400 * Math.pow(2, attempts - 1)));
        }
      }
    }
  }

  invalidateCollectionCache('arrival_entries');

  return {
    expected: total,
    imported: successful,
    rejected,
    errors,
    structuredEntries: sortedEntries
  };
}
