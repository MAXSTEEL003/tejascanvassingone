import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
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
  { id: 'noOfDayRec', label: 'PAYMENT STATUS', type: 'select', group: 'Logistics' },
  { id: 'purchaseOrderNo', label: 'PURCHASE ORDER NO', type: 'po-select', group: 'Fulfillment' }
];

export const KNOWN_MILLER_REGIONS = new Set([
  'MIRYALGUDA', 'SURYAPET', 'GADCHIROLI', 'GADCHIROLLI', 'NELLORE', 'NAGPUR',
  'HUZURNAGAR', 'WARANGAL', 'KARIMNAGAR', 'RAICHUR', 'BELLARY', 'DAVANAGERE', 'NIZAMABAD'
]);

export const KNOWN_BUYER_REGIONS = new Set([
  '4TH BLOCK', '5TH BLOCK', 'YESHWANTHPUR', 'APMC', 'WHITEFIELD', 'K R PURAM',
  'CHIKPET', 'TIPTUR', 'TUMKUR', 'MANDYA', 'MYSORE', 'HOSUR', 'BANGALORE'
]);

/**
 * Parses any date format (Excel serial, ISO, DD-MM-YYYY, DD/MM/YYYY)
 */
export function parseDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    try {
      const date = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy.map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return str;
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
    // 2. Direct exact or regex matching
    else if (norm.includes('date') || norm === 'dt') {
      if (norm.includes('chq') || norm.includes('payment') || norm.includes('cheque')) {
        mappedFieldId = 'chqDt';
      } else {
        mappedFieldId = 'date';
      }
      confidence = 0.95;
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
    else if (norm.includes('chqno') || norm.includes('ddno') || norm.includes('utr') || norm.includes('chequeno')) {
      mappedFieldId = 'chqNo';
      confidence = 0.9;
    }
    else if (norm.includes('bank')) {
      mappedFieldId = 'bank';
      confidence = 0.9;
    }
    else if (norm.includes('status') || norm.includes('paymentstatus')) {
      mappedFieldId = 'noOfDayRec';
      confidence = 0.85;
    }
    else if (norm.includes('po') || norm.includes('order') || norm.includes('contract')) {
      mappedFieldId = 'purchaseOrderNo';
      confidence = 0.85;
    }

    if (!mappedFieldId && cleanHeader) {
      warning = `Column "${cleanHeader}" could not be automatically matched to a ledger field.`;
    }

    detected.push({
      index: colIdx,
      rawHeader: cleanHeader || `Column ${colIdx + 1}`,
      mappedFieldId,
      confidence,
      sampleValues: colSamples.slice(0, 3),
      warning
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
}> {
  const activeMappings = columnMappings.filter(c => c.mappedFieldId && !c.ignored);

  // 1. Transform raw matrix into structured arrival entries
  const structuredEntries: any[] = [];
  const errors: Array<{ row: number; billNo?: string; error: string }> = [];

  rawRows.forEach((r, rIdx) => {
    const entry: Record<string, any> = {
      sheetId,
      sheetName,
      lastUpdated: Date.now()
    };

    activeMappings.forEach(col => {
      const val = r[col.index];
      if (val !== undefined && val !== null) {
        const cleanStr = String(val).trim();
        if (col.mappedFieldId === 'date' || col.mappedFieldId === 'chqDt') {
          entry[col.mappedFieldId] = parseDate(val);
        } else if (
          ['qty', 'rate', 'amount', 'lh', 'cc', 'tds', 'shortage', 'diffIn', 'netAmt', 'chqAm'].includes(
            col.mappedFieldId!
          )
        ) {
          const num = parseFloat(cleanStr.replace(/[₹\s,]/g, ''));
          entry[col.mappedFieldId!] = !isNaN(num) ? num : (cleanStr.startsWith('=') ? cleanStr : '');
        } else {
          entry[col.mappedFieldId!] = cleanStr;
        }
      }
    });

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
      // Deterministic Idempotent Document ID
      const cleanBill = entry.billNo ? String(entry.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
      const docId = cleanBill
        ? `row-${sheetId}-${cleanBill}`
        : `row-${sheetId}-${rIdx}-${Date.now().toString(36)}`;
      entry.id = docId;
      structuredEntries.push(entry);
    }
  });

  const total = structuredEntries.length;
  if (total === 0) {
    return { expected: 0, imported: 0, rejected: 0, errors: [] };
  }

  // 2. Chunking parameters
  const BATCH_SIZE = 350; // Well below Firestore's 500 limit
  const chunks: any[][] = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    chunks.push(structuredEntries.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let successful = 0;
  let rejected = 0;

  // 3. Process batches sequentially with retries and delay to prevent rate limiting
  for (let bIdx = 0; bIdx < chunks.length; bIdx++) {
    const chunk = chunks[bIdx];
    let attempts = 0;
    let committed = false;

    while (attempts < 4 && !committed) {
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

        // Brief 50ms pause between batches to respect Firestore write rate quotas
        await new Promise(res => setTimeout(res, 50));
      } catch (err: any) {
        attempts++;
        console.warn(`Batch ${bIdx + 1} attempt ${attempts} failed:`, err);
        if (attempts >= 4) {
          rejected += chunk.length;
          processed += chunk.length;
          chunk.forEach((item, itemIdx) => {
            errors.push({
              row: bIdx * BATCH_SIZE + itemIdx + 1,
              billNo: item.billNo,
              error: err?.message || 'Firestore batch commit failed after 4 retries.'
            });
          });
        } else {
          // Exponential backoff wait (300ms, 600ms, 1200ms)
          await new Promise(res => setTimeout(res, 300 * Math.pow(2, attempts - 1)));
        }
      }
    }
  }

  return {
    expected: total,
    imported: successful,
    rejected,
    errors
  };
}
