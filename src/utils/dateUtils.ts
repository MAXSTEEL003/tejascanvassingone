/**
 * Unified Date Engine for Tejas Canvassing
 * Single source of truth for:
 * - Parsing & normalising Excel serial dates, JS Dates, DD/MM/YYYY, YYYY-MM-DD
 * - Display formatting (DD-Mon-YYYY, DD/MM/YYYY)
 * - Sorting timestamps (ms UTC midnight)
 * - Sheet Month + Year derivation
 * - Days Pending calculation
 *
 * CRITICAL BUSINESS RULE:
 * Dates default to Indian/UK DD/MM/YYYY format:
 * 05/09/2026 = 5 September 2026 (Day: 05, Month: 09, Year: 2026).
 * No timezone shifts. No raw Excel serial numbers displayed.
 */

export const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export const MONTH_MAP_LOWER: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/**
 * Validates day within month and year (including leap years)
 */
function isValidDayInMonth(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const daysInMonth = [
    31,
    (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31
  ];
  return day <= daysInMonth[month - 1];
}

/**
 * Converts Excel serial number to ISO YYYY-MM-DD using UTC calculation.
 * Completely immune to local browser timezone shifts.
 */
function excelSerialToIso(serial: number): string | null {
  if (isNaN(serial) || serial < 1000 || serial > 100000) return null;
  // Excel epoch: 1899-12-30 (accounting for Excel leap-year bug at day 60)
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  if (isNaN(d.getTime())) return null;

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalizes ANY date input into canonical ISO YYYY-MM-DD.
 * Returns empty string '' if input is empty, null, or completely unparseable.
 */
export function normalizeDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  // 1. Firestore Timestamp
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    val = val.toDate();
  }

  // 2. JavaScript Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. Excel cell object (e.g. { v: 46215, t: 'n', w: '09-Apr-2026' })
  if (typeof val === 'object' && !Array.isArray(val)) {
    if ('w' in val && typeof val.w === 'string' && val.w.trim()) {
      const parsedW = normalizeDate(val.w);
      if (parsedW) return parsedW;
    }
    if ('v' in val && val.v !== undefined && val.v !== null) {
      val = val.v;
    }
  }

  // 4. Numeric Excel serial (e.g. 46215 or 45540)
  if (typeof val === 'number') {
    const fromSerial = excelSerialToIso(val);
    if (fromSerial) return fromSerial;
    return '';
  }

  let str = String(val).trim();
  if (!str) return '';

  // 5. String Excel serial (e.g. "46215" or "45540.5")
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    const fromSerial = excelSerialToIso(num);
    if (fromSerial) return fromSerial;
  }

  // Strip ISO time (e.g. 2026-04-03T10:30:00.000Z or T10:30:00)
  str = str.replace(/T\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i, '').trim();

  // Strip trailing 12-hour or 24-hour time (e.g. 10:30, 10:30 AM, 10:30:00 PM)
  str = str.replace(/[\s,]+\d{1,2}:\d{2}(:\d{2})?(\s*[APap][Mm])?$/, '').trim();

  // 6. ISO Format: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y >= 1900 && y <= 2100 && isValidDayInMonth(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 7. Named month first: e.g. "April 3, 2026", "Apr 3, 2026", "April 03, 2026", "Apr 3 2026"
  const monthFirstMatch = str.match(/^([a-zA-Z]+)[\s,-]+(\d{1,2})(?:st|nd|rd|th)?[\s,-]+(\d{2,4})$/);
  if (monthFirstMatch) {
    const mStr = monthFirstMatch[1].toLowerCase();
    const d = parseInt(monthFirstMatch[2], 10);
    let y = parseInt(monthFirstMatch[3], 10);
    if (y < 100) y += 2000;
    const m = MONTH_MAP_LOWER[mStr] || Object.entries(MONTH_MAP_LOWER).find(([k]) => mStr.startsWith(k))?.[1];
    if (m && y >= 1900 && y <= 2100 && isValidDayInMonth(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 8. Day first with named month: e.g. "3-April-2026", "03-April-2026", "3-Apr-2026", "03-Apr-2026", "3 April 2026", "3rd April 2026"
  const dayFirstNamedMatch = str.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s./-]+([a-zA-Z]+)[\s./-]+(\d{2,4})$/);
  if (dayFirstNamedMatch) {
    const d = parseInt(dayFirstNamedMatch[1], 10);
    const mStr = dayFirstNamedMatch[2].toLowerCase();
    let y = parseInt(dayFirstNamedMatch[3], 10);
    if (y < 100) y += 2000;
    const m = MONTH_MAP_LOWER[mStr] || Object.entries(MONTH_MAP_LOWER).find(([k]) => mStr.startsWith(k))?.[1];
    if (m && y >= 1900 && y <= 2100 && isValidDayInMonth(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 9. Numeric Indian / UK Business Standard: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, D/M/YYYY, D-M-YYYY, D.M.YYYY
  // 03/04/2026 -> 2026-04-03 (3 April 2026)
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000; // e.g. 26 -> 2026
    if (y >= 1900 && y <= 2100 && isValidDayInMonth(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * Checks if a sample value is likely a date representation
 */
export function isLikelyDateValue(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'object' && typeof val.toDate === 'function') return true;

  // Numbers: only check within sensible modern Excel serial range (e.g. 35000 to 55000: 1995 to 2050)
  if (typeof val === 'number') {
    return val >= 35000 && val <= 55000;
  }

  const str = String(val).trim();
  if (!str) return false;

  // Numeric string serial in range
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    return num >= 35000 && num <= 55000;
  }

  return isValidDate(val);
}

/**
 * Checks if a value represents a valid date (not an unparseable string or raw number)
 */
export function isValidDate(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;
  const iso = normalizeDate(val);
  return Boolean(iso && /^\d{4}-\d{2}-\d{2}$/.test(iso));
}

/**
 * Parses any date into a JavaScript Date object (at local midnight) for components that require Date.
 * Returns null if invalid or blank.
 */
export function parseDateToObj(val: any): Date | null {
  const iso = normalizeDate(val);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date value for UI grid display: DD-Mon-YYYY (e.g. 09-Apr-2026)
 * If invalid or raw number, normalizes it first. If unparseable, returns original string without throwing.
 */
export function formatDateDisplay(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const iso = normalizeDate(val);
  if (!iso) return String(val);

  const [y, m, d] = iso.split('-').map(Number);
  const mName = MONTH_NAMES_SHORT[m - 1] || 'Jan';
  return `${String(d).padStart(2, '0')}-${mName}-${y}`;
}

/**
 * Formats a date value into standard DD/MM/YYYY for CSV/text display
 */
export function formatDateDDMMYYYY(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const iso = normalizeDate(val);
  if (!iso) return String(val);

  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Converts a date value into UTC midnight timestamp (ms) for accurate chronological sorting.
 * Missing, blank, or invalid dates return Infinity so they stably sort to the very bottom.
 */
export function dateToTimestamp(val: any): number {
  if (val === null || val === undefined || val === '') return Infinity;
  const iso = normalizeDate(val);
  if (!iso) return Infinity;

  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Extracts Month + Year sheet name from any date value (e.g. "September 2026")
 * Returns null if invalid or blank.
 */
export function getMonthYearFromDate(val: any): string | null {
  const iso = normalizeDate(val);
  if (!iso) return null;

  const [y, m] = iso.split('-').map(Number);
  const monthName = MONTH_NAMES_LONG[m - 1];
  if (!monthName || !y) return null;
  return `${monthName} ${y}`;
}

/**
 * Calculates pending days between an arrival date and today (or cheque clearance date).
 */
export function computeDaysPending(dateVal: any, statusVal?: string, chqDtVal?: any): number {
  const iso = normalizeDate(dateVal);
  if (!iso) return 0;

  const [y, m, d] = iso.split('-').map(Number);
  const arrTime = Date.UTC(y, m - 1, d);

  const status = statusVal || 'Not Cleared';
  if (status === 'Cleared' && chqDtVal) {
    const chqIso = normalizeDate(chqDtVal);
    if (chqIso) {
      const [cy, cm, cd] = chqIso.split('-').map(Number);
      const chqTime = Date.UTC(cy, cm - 1, cd);
      const diffDays = Math.floor((chqTime - arrTime) / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    return 0;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUtc - arrTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
