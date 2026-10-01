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
 * Checks whether a row has meaningful arrival ledger content.
 * Checks all possible operational fields to prevent dropping valid user rows.
 */
export function isMeaningfulRow(row: any): boolean {
  if (!row) return false;
  
  const hasText = (val: any) => typeof val === 'string' && val.trim().length > 0;
  const hasAnyVal = (val: any) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return !isNaN(val) && val !== 0;
    return true;
  };

  return Boolean(
    hasText(row.partyName) || 
    hasText(row.millerName) || 
    hasAnyVal(row.billNo) || 
    hasAnyVal(row.qty) || 
    hasAnyVal(row.rate) || 
    hasAnyVal(row.amount) || 
    hasAnyVal(row.netAmt) || 
    hasText(row.area) || 
    hasText(row.place) ||
    hasText(row.brand) ||
    hasAnyVal(row.purchaseOrderNo) ||
    hasAnyVal(row.chqAm) ||
    hasText(row.chqNo) ||
    hasText(row.payment) ||
    hasText(row.noOfDays) ||
    hasText(row.noOfDayRec) ||
    hasText(row.billAttachment) ||
    hasText(row.billPhotoUrl) ||
    hasText(row.broker) ||
    hasText(row.truckNo) ||
    hasText(row.driverPhone) ||
    hasText(row.bank) ||
    hasText(row.chqDt) ||
    hasText(row.notes)
  );
}

/**
 * Organizes all arrival records into Month + Year sheets.
 * Completely removes "All Arrivals".
 * Preserves all row fields, IDs, formulas, and document integrity.
 * NEVER drops rows across sheets or deduplicates by billNo!
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

  // Map each sheet name to a Map of rows: sheetName -> Map<rowId, row>
  const sheetRowMaps = new Map<string, Map<string, any>>();
  const migrationCounts: Record<string, number> = {};

  const isMonthYearName = (name: string) => 
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(name.trim());

  // 1. Process all existing sheets - rows ALREADY in a sheet STAY in that sheet!
  existingSheets.forEach(s => {
    const isLegacyAllArrivals = /all\s*arrivals/i.test(s.name) || s.id === 'sheet-1';

    if (isLegacyAllArrivals) {
      // Legacy "All Arrivals" rows get distributed by date to their respective Month + Year
      if (Array.isArray(s.data)) {
        s.data.forEach((row, idx) => {
          if (!isMeaningfulRow(row)) return;
          const targetSheetName = getMonthYearFromDate(row.date) || currentMonthYear;
          if (!sheetRowMaps.has(targetSheetName)) {
            sheetRowMaps.set(targetSheetName, new Map());
          }
          const rowId = row.id && !String(row.id).startsWith('row-empty-') ? String(row.id).replace(/^#/, '') : `legacy-${s.id}-${idx}`;
          const sheetMap = sheetRowMaps.get(targetSheetName)!;
          if (!sheetMap.has(rowId)) {
            sheetMap.set(rowId, { ...row, id: rowId });
          }
          migrationCounts[targetSheetName] = (migrationCounts[targetSheetName] || 0) + 1;
        });
      }
    } else {
      // Regular Month + Year or Custom sheet: PRESERVE ALL ITS ROWS DIRECTLY IN THIS SHEET!
      const sheetName = s.name.trim();
      if (!sheetRowMaps.has(sheetName)) {
        sheetRowMaps.set(sheetName, new Map());
      }
      const sheetMap = sheetRowMaps.get(sheetName)!;

      if (Array.isArray(s.data)) {
        s.data.forEach((row, idx) => {
          if (!isMeaningfulRow(row)) return;
          const rowId = row.id && !String(row.id).startsWith('row-empty-') ? String(row.id).replace(/^#/, '') : `row-${s.id}-${idx}`;
          const existing = sheetMap.get(rowId);
          if (!existing) {
            sheetMap.set(rowId, { ...row, id: rowId });
          } else {
            const t1 = row.lastUpdated || 0;
            const t2 = existing.lastUpdated || 0;
            if (t1 >= t2) {
              sheetMap.set(rowId, { ...existing, ...row, id: rowId });
            }
          }
        });
      }
    }
  });

  // 2. Merge Cloud Records into their corresponding sheets
  cloudRecords.forEach((row, idx) => {
    if (!isMeaningfulRow(row)) return;

    let targetSheetName = '';
    if (row.sheetName && !/all\s*arrivals/i.test(row.sheetName)) {
      targetSheetName = row.sheetName.trim();
    } else if (row.sheetId) {
      const matchingSheet = existingSheets.find(s => s.id === row.sheetId);
      if (matchingSheet && !/all\s*arrivals/i.test(matchingSheet.name)) {
        targetSheetName = matchingSheet.name.trim();
      }
    }

    if (!targetSheetName) {
      targetSheetName = getMonthYearFromDate(row.date) || currentMonthYear;
    }

    if (!sheetRowMaps.has(targetSheetName)) {
      sheetRowMaps.set(targetSheetName, new Map());
    }
    const sheetMap = sheetRowMaps.get(targetSheetName)!;

    const rowId = row.id && !String(row.id).startsWith('row-empty-') ? String(row.id).replace(/^#/, '') : `cloud-${targetSheetName}-${idx}`;
    const existing = sheetMap.get(rowId);
    if (!existing) {
      sheetMap.set(rowId, { ...row, id: rowId });
    } else {
      const t1 = row.lastUpdated || 0;
      const t2 = existing.lastUpdated || 0;
      if (t1 >= t2) {
        sheetMap.set(rowId, { ...existing, ...row, id: rowId });
      }
    }
  });

  // Always ensure current month sheet exists
  if (!sheetRowMaps.has(currentMonthYear)) {
    sheetRowMaps.set(currentMonthYear, new Map());
  }

  // 3. Separate Month+Year sheets from custom sheets
  const allSheetNames = Array.from(sheetRowMaps.keys());
  const monthSheetNames = allSheetNames.filter(isMonthYearName);
  const customSheetNames = allSheetNames.filter(name => !isMonthYearName(name));

  // Sort Month + Year sheets chronologically
  monthSheetNames.sort((a, b) => {
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

  const buildSheetObj = (name: string, isMonth: boolean): ArrivalSheet => {
    const sheetId = `sheet-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const rowMap = sheetRowMaps.get(name) || new Map();
    const rawRows = Array.from(rowMap.values());
    const defaultDate = isMonth ? getDefaultDateForSheetName(name) : new Date().toISOString().split('T')[0];

    // Sort rows oldest first, newest last by Arrival Date (stable)
    const rows = rawRows.slice().sort((a, b) => {
      const timeA = normalizeDate(a.date) ? new Date(normalizeDate(a.date)).getTime() : Infinity;
      const timeB = normalizeDate(b.date) ? new Date(normalizeDate(b.date)).getTime() : Infinity;
      return timeA - timeB;
    });

    const preparedRows = rows.map((r, rIdx) => ({
      ...r,
      sheetId,
      sheetName: name,
      id: r.id || `row-${sheetId}-${rIdx + 1}`
    }));

    // Pad with empty rows only up to initialRowsCount
    const emptyPaddingCount = Math.max(0, initialRowsCount - preparedRows.length);
    for (let i = 0; i < emptyPaddingCount; i++) {
      preparedRows.push({
        id: `row-empty-${Date.now()}-${preparedRows.length}-${Math.random().toString(36).substring(2, 6)}`,
        date: defaultDate,
        sheetId,
        sheetName: name
      });
    }

    return {
      id: sheetId,
      name,
      data: preparedRows
    };
  };

  monthSheetNames.forEach(name => finalSheets.push(buildSheetObj(name, true)));
  customSheetNames.forEach(name => finalSheets.push(buildSheetObj(name, false)));

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
