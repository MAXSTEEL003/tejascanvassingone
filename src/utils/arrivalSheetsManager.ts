/**
 * Arrival Entry Month/Year Sheets Manager
 * Reorganizes Arrival records into Month + Year sheets based on actual Arrival Date.
 * Removes 'All Arrivals' sheet and defaults active sheet to current Month + Year.
 */

export interface ArrivalSheet {
  id: string;
  name: string;
  data: any[];
}

import { 
  getMonthYearFromDate, 
  normalizeDate, 
  MONTH_NAMES_LONG 
} from './dateUtils';

export { getMonthYearFromDate };

/**
 * Returns current local Month + Year sheet name (e.g. "September 2026")
 */
export function getCurrentMonthYearSheetName(): string {
  const now = new Date();
  return `${MONTH_NAMES_LONG[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Generates default date string YYYY-MM-DD for a given sheet name
 */
export function getDefaultDateForSheetName(sheetName: string): string {
  const parts = sheetName.trim().split(' ');
  if (parts.length === 2) {
    const monthIdx = MONTH_NAMES_LONG.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
    const year = parseInt(parts[1], 10);
    if (monthIdx !== -1 && !isNaN(year)) {
      const mm = String(monthIdx + 1).padStart(2, '0');
      return `${year}-${mm}-01`;
    }
  }
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Checks whether a row has meaningful arrival ledger content
 */
export function isMeaningfulRow(row: any): boolean {
  if (!row) return false;
  return Boolean(
    row.partyName || 
    row.millerName || 
    row.billNo || 
    row.qty || 
    row.rate || 
    row.amount || 
    row.netAmt || 
    row.area || 
    row.place ||
    row.purchaseOrderNo
  );
}

/**
 * Organizes all arrival records into Month + Year sheets.
 * Completely removes "All Arrivals".
 * Preserves all row fields, IDs, formulas, and document integrity.
 */
export function organizeArrivalSheetsByMonth(
  existingSheets: ArrivalSheet[],
  cloudRecords: any[] = [],
  initialRowsCount = 40,
  preferredActiveSheetId?: string
): {
  sheets: ArrivalSheet[];
  activeSheetId: string;
  migrationCounts: Record<string, number>;
} {
  const currentMonthYear = getCurrentMonthYearSheetName();
  const currentMonthId = `sheet-${currentMonthYear.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  // Pre-seed monthGroups and customSheetsData with ALL existing non-AllArrivals sheets
  // This guarantees that any user-created sheet (even if newly created or empty) is NEVER dropped!
  const monthGroups = new Map<string, any[]>();
  const customSheetsData = new Map<string, any[]>();
  const migrationCounts: Record<string, number> = {};

  existingSheets.forEach(s => {
    if (!/all\s*arrivals/i.test(s.name) && s.id !== 'sheet-1') {
      const isMonthYear = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(s.name.trim());
      if (isMonthYear) {
        if (!monthGroups.has(s.name.trim())) {
          monthGroups.set(s.name.trim(), []);
        }
      } else {
        if (!customSheetsData.has(s.name.trim())) {
          customSheetsData.set(s.name.trim(), []);
        }
      }
    }
  });

  // 1. Gather all meaningful rows across existing sheets and cloud records
  const allRowsMap = new Map<string, any>();

  existingSheets.forEach(s => {
    const isAllArrivals = /all\s*arrivals/i.test(s.name) || s.id === 'sheet-1';
    const isMonthYear = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(s.name.trim());

    if (Array.isArray(s.data)) {
      s.data.forEach((row, idx) => {
        if (!isMeaningfulRow(row)) return;

        // Determine unique key
        const billKey = row.billNo ? `bill-${String(row.billNo).trim().toUpperCase()}` : null;
        const rowId = row.id && !String(row.id).startsWith('row-empty') ? String(row.id) : null;
        const key = billKey || rowId || `row-${s.id}-${idx}`;

        // Preserve origin sheet name if custom
        if (!isAllArrivals && !isMonthYear) {
          if (!customSheetsData.has(s.name)) customSheetsData.set(s.name, []);
          customSheetsData.get(s.name)!.push(row);
        }

        const existing = allRowsMap.get(key);
        if (!existing) {
          allRowsMap.set(key, { ...row, _originSheetName: s.name });
        } else {
          // Merge keeping most recent / most complete
          const t1 = row.lastUpdated || 0;
          const t2 = existing.lastUpdated || 0;
          if (t1 >= t2) {
            allRowsMap.set(key, { ...existing, ...row, _originSheetName: s.name });
          }
        }
      });
    }
  });

  // Also include any cloud records
  cloudRecords.forEach((row, idx) => {
    if (!isMeaningfulRow(row)) return;
    const billKey = row.billNo ? `bill-${String(row.billNo).trim().toUpperCase()}` : null;
    const rowId = row.id && !String(row.id).startsWith('row-empty') ? String(row.id) : null;
    const key = billKey || rowId || `cloud-${idx}`;

    const existing = allRowsMap.get(key);
    if (!existing) {
      allRowsMap.set(key, row);
    } else {
      const t1 = row.lastUpdated || 0;
      const t2 = existing.lastUpdated || 0;
      if (t1 >= t2) {
        allRowsMap.set(key, { ...existing, ...row });
      }
    }
  });

  allRowsMap.forEach(row => {
    let targetSheetName = getMonthYearFromDate(row.date);

    // If date is unparseable but row was already in a Month + Year sheet, retain it
    if (!targetSheetName) {
      if (row._originSheetName && /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(row._originSheetName.trim())) {
        targetSheetName = row._originSheetName.trim();
      } else {
        targetSheetName = currentMonthYear;
      }
    }

    if (!monthGroups.has(targetSheetName)) {
      monthGroups.set(targetSheetName, []);
    }
    const cleanRow = { ...row };
    delete cleanRow._originSheetName;
    monthGroups.get(targetSheetName)!.push(cleanRow);
    migrationCounts[targetSheetName] = (migrationCounts[targetSheetName] || 0) + 1;
  });

  // Always ensure current month sheet exists
  if (!monthGroups.has(currentMonthYear)) {
    monthGroups.set(currentMonthYear, []);
  }

  // 3. Sort Month + Year sheets chronologically (earlier months first: April 2026, May 2026... September 2026)
  const sortedMonthNames = Array.from(monthGroups.keys()).sort((a, b) => {
    const parseKey = (name: string) => {
      const parts = name.trim().split(' ');
      if (parts.length === 2) {
        const m = MONTH_NAMES_LONG.findIndex(x => x.toLowerCase() === parts[0].toLowerCase());
        const y = parseInt(parts[1], 10);
        if (m !== -1 && !isNaN(y)) return y * 100 + m;
      }
      return 0;
    };
    return parseKey(a) - parseKey(b);
  });

  // 4. Construct final sheets array
  const finalSheets: ArrivalSheet[] = [];

  sortedMonthNames.forEach(monthName => {
    const sheetId = `sheet-${monthName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const rawRows = monthGroups.get(monthName) || [];
    const defaultDate = getDefaultDateForSheetName(monthName);

    // Sort meaningful rows oldest first, newest last by Arrival Date
    const rows = rawRows.slice().sort((a, b) => {
      const timeA = normalizeDate(a.date) ? new Date(normalizeDate(a.date)).getTime() : Infinity;
      const timeB = normalizeDate(b.date) ? new Date(normalizeDate(b.date)).getTime() : Infinity;
      return timeA - timeB;
    });

    // Assign correct sheetId and sheetName to every meaningful row
    const preparedRows = rows.map(r => ({
      ...r,
      sheetId,
      sheetName: monthName
    }));

    // Pad with empty rows up to initialRowsCount
    const emptyPaddingCount = Math.max(0, initialRowsCount - preparedRows.length);
    for (let i = 0; i < emptyPaddingCount; i++) {
      preparedRows.push({
        id: `row-empty-${Date.now()}-${preparedRows.length}-${Math.random().toString(36).substring(2, 6)}`,
        date: defaultDate,
        sheetId,
        sheetName: monthName
      });
    }

    finalSheets.push({
      id: sheetId,
      name: monthName,
      data: preparedRows
    });
  });

  // 5. Append any custom sheets (non-month, non-all-arrivals)
  customSheetsData.forEach((rows, name) => {
    const sheetId = `sheet-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const defaultDate = new Date().toISOString().split('T')[0];
    const preparedRows = rows.map(r => ({ ...r, sheetId, sheetName: name }));
    const emptyPaddingCount = Math.max(0, initialRowsCount - preparedRows.length);
    for (let i = 0; i < emptyPaddingCount; i++) {
      preparedRows.push({
        id: `row-empty-${Date.now()}-${preparedRows.length}-${Math.random().toString(36).substring(2, 6)}`,
        date: defaultDate,
        sheetId,
        sheetName: name
      });
    }
    finalSheets.push({
      id: sheetId,
      name,
      data: preparedRows
    });
  });

  // Active sheet selection: prefer preferredActiveSheetId if valid, otherwise current Month + Year
  let activeSheetId = currentMonthId;
  if (preferredActiveSheetId && finalSheets.some(s => s.id === preferredActiveSheetId)) {
    activeSheetId = preferredActiveSheetId;
  } else {
    const activeSheet = finalSheets.find(s => s.name.toLowerCase() === currentMonthYear.toLowerCase()) || finalSheets[0];
    if (activeSheet) {
      activeSheetId = activeSheet.id;
    }
  }

  return {
    sheets: finalSheets,
    activeSheetId,
    migrationCounts
  };
}
