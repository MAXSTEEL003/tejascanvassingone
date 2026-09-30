import { Parser } from 'hot-formula-parser';

export const COLS_ORDER = [
  'date',            // A (0)
  'millerName',      // B (1)
  'place',           // C (2)
  'brand',           // D (3)
  'partyName',       // E (4)
  'noOfDays',        // F (5)
  'noOfDayRec',      // G (6)
  'area',            // H (7)
  'billNo',          // I (8)
  'qty',             // J (9)
  'rate',            // K (10)
  'amount',          // L (11)
  'lh',              // M (12)
  'cc',              // N (13)
  'tds',             // O (14)
  'shortage',        // P (15)
  'diffIn',          // Q (16)
  'netAmt',          // R (17)
  'chqAm',           // S (18)
  'chqNo',           // T (19)
  'chqDt',           // U (20)
  'bank',            // V (21)
  'billPhoto',       // W (22)
  'purchaseOrderNo'  // X (23)
];

const NUMERIC_COLS = new Set([
  'qty', 'rate', 'amount', 'lh', 'cc', 'tds', 'shortage', 'diffIn', 'netAmt', 'chqAm'
]);

/**
 * Converts 0-based column index to spreadsheet column letter (0 -> A, 1 -> B, etc.)
 */
export function getColLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Converts spreadsheet column letter to 0-based index (A -> 0, B -> 1, etc.)
 */
export function getColIndexFromLetter(colStr: string): number {
  let colIdx = 0;
  const clean = colStr.toUpperCase().trim();
  for (let i = 0; i < clean.length; i++) {
    colIdx = colIdx * 26 + (clean.charCodeAt(i) - 64);
  }
  return colIdx - 1;
}

/**
 * Checks if a string is an Excel formula (starts with '=')
 */
export function isFormula(val: any): boolean {
  return typeof val === 'string' && val.trim().startsWith('=');
}

/**
 * Evaluates an Excel formula within the context of a dataset of rows
 */
export function evaluateFormula(
  formula: string,
  rows: any[],
  currentRowIndex = 0,
  depth = 0
): { error: string | null; result: any } {
  if (!formula || typeof formula !== 'string') {
    return { error: null, result: formula };
  }

  const cleanFormula = formula.trim().startsWith('=')
    ? formula.trim().slice(1)
    : formula.trim();

  // Prevent deep/infinite recursion loops
  if (depth > 10) {
    return { error: '#CYCLE!', result: '#CYCLE!' };
  }

  const parser = new Parser();

  parser.on('callCellValue', (coord, done) => {
    const r = coord.row.index; // 0-based
    const c = coord.column.index; // 0-based
    const row = rows[r];
    if (!row) return done(0);

    const colId = COLS_ORDER[c];
    if (!colId) return done(0);

    const val = row[colId];
    if (isFormula(val)) {
      const evalRes = evaluateFormula(val, rows, r, depth + 1);
      return done(evalRes.error ? 0 : evalRes.result);
    }

    if (typeof val === 'number') return done(val);
    const num = parseFloat(String(val).replace(/,/g, ''));
    if (!isNaN(num) && NUMERIC_COLS.has(colId)) {
      return done(num);
    }
    done(val || '');
  });

  parser.on('callRangeValue', (start, end, done) => {
    const matrix: any[][] = [];
    for (let r = start.row.index; r <= end.row.index; r++) {
      const rowVals: any[] = [];
      const row = rows[r];
      for (let c = start.column.index; c <= end.column.index; c++) {
        if (!row) {
          rowVals.push(0);
          continue;
        }
        const colId = COLS_ORDER[c];
        const val = row[colId];
        if (isFormula(val)) {
          const evalRes = evaluateFormula(val, rows, r, depth + 1);
          rowVals.push(evalRes.error ? 0 : evalRes.result);
        } else {
          const num = parseFloat(String(val).replace(/,/g, ''));
          rowVals.push(!isNaN(num) ? num : (val || 0));
        }
      }
      matrix.push(rowVals);
    }
    done(matrix);
  });

  const parsed = parser.parse(cleanFormula);
  if (parsed.error) {
    return { error: `#${parsed.error}`, result: `#${parsed.error}` };
  }
  return { error: null, result: parsed.result };
}

/**
 * Adjusts relative cell references in a formula when copied / filled down or right
 */
export function shiftFormula(formula: string, rowDelta: number, colDelta: number): string {
  if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
    return formula;
  }

  return formula.replace(
    /(\$?)([A-Z]+)(\$?)([0-9]+)(?!\w|\()/gi,
    (_match, colAbs, colStr, rowAbs, rowStr) => {
      let newCol = colStr.toUpperCase();
      let newRow = parseInt(rowStr, 10);

      if (!rowAbs) {
        newRow = Math.max(1, newRow + rowDelta);
      }

      if (!colAbs) {
        const colIdx = getColIndexFromLetter(colStr);
        const shiftedColIdx = Math.max(0, colIdx + colDelta);
        newCol = getColLetter(shiftedColIdx);
      }

      return `${colAbs}${newCol}${rowAbs}${newRow}`;
    }
  );
}

/**
 * Standard business automatic row calculations (QTLS * Rate, Net Amt deduction)
 */
export function recalculateRowBusinessLogic(row: any): any {
  if (!row) return row;
  const updated = { ...row };

  // 1. Amount calculation
  if (!isFormula(updated.amount)) {
    const q = parseFloat(String(updated.qty || 0).replace(/,/g, '')) || 0;
    const rt = parseFloat(String(updated.rate || 0).replace(/,/g, '')) || 0;
    if (q > 0 || rt > 0) {
      updated.amount = (q * rt).toFixed(2);
    }
  }

  // 2. Net Amt calculation: Net Amt = Amount - L.H - C.C - TDS - Shortage - DiffIn - ChqAm
  if (!isFormula(updated.netAmt)) {
    const amt = parseFloat(String(updated.amount || 0).replace(/,/g, '')) || 0;
    const lhVal = parseFloat(String(updated.lh || 0).replace(/,/g, '')) || 0;
    const ccVal = parseFloat(String(updated.cc || 0).replace(/,/g, '')) || 0;
    const tdsVal = parseFloat(String(updated.tds || 0).replace(/,/g, '')) || 0;
    const shortageVal = parseFloat(String(updated.shortage || 0).replace(/,/g, '')) || 0;
    const diffInVal = parseFloat(String(updated.diffIn || 0).replace(/,/g, '')) || 0;
    const chqAmVal = parseFloat(String(updated.chqAm || 0).replace(/,/g, '')) || 0;

    if (amt > 0 || lhVal > 0 || ccVal > 0 || tdsVal > 0 || shortageVal > 0 || diffInVal > 0 || chqAmVal > 0) {
      updated.netAmt = (amt - lhVal - ccVal - tdsVal - shortageVal - diffInVal - chqAmVal).toFixed(2);
    }
  }

  // 3. Payment Status auto-clearing based on cheque details
  const hasCheque =
    (updated.chqAm && parseFloat(String(updated.chqAm).replace(/,/g, '')) > 0) ||
    (updated.chqNo && String(updated.chqNo).trim() !== '') ||
    (updated.chqDt && String(updated.chqDt).trim() !== '') ||
    (updated.bank && String(updated.bank).trim() !== '');

  if (hasCheque && !updated.noOfDayRec) {
    updated.noOfDayRec = 'Cleared';
  } else if (!updated.noOfDayRec) {
    updated.noOfDayRec = 'Not Cleared';
  }

  return updated;
}
