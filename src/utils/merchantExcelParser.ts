import * as XLSX from 'xlsx';

export interface ParsedMerchant {
  id: string;
  name: string;
  mandi: string;
  road: string;
  address: string;
  gstin: string;
  contact: string;
  phone: string;
  email: string;
  status: 'Active';
  type: 'buyers';
  role: 'Merchant / Buyer';
  credit: string;
}

/**
 * Universal parser for Merchant / Buyer Excel files.
 * Supports:
 * 1. Multi-sheet block / card format (like All Merchants.xlsx)
 * 2. Flat tabular format (columns: Name, Road/Area, Phone/Mobile, GSTIN, etc.)
 */
export function parseMerchantsFromWorkbook(wb: XLSX.WorkBook, existingMaxId = 0): ParsedMerchant[] {
  const merchants: ParsedMerchant[] = [];
  const seenNames = new Set<string>();
  let idCounter = existingMaxId + 1;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length === 0) continue;

    // Check if sheet is standard flat table (header in row 0 or 1 with 'Buyer' or 'Name' or 'GSTIN')
    const flatHeaderRowIdx = findFlatHeaderRow(data);

    if (flatHeaderRowIdx !== -1) {
      // Parse as flat table
      const headerRow = data[flatHeaderRowIdx].map(c => String(c || '').trim().toLowerCase());
      const colMap = mapTableColumns(headerRow);

      for (let r = flatHeaderRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        const name = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
        if (!name || isHeaderOrTotal(name)) continue;

        const normKey = name.toLowerCase();
        if (seenNames.has(normKey)) continue;
        seenNames.add(normKey);

        const road = colMap.road !== -1 ? String(row[colMap.road] || '').trim() : '';
        const mandi = colMap.mandi !== -1 ? String(row[colMap.mandi] || '').trim() : sheetName.trim();
        const gstin = colMap.gstin !== -1 ? cleanPrefix(row[colMap.gstin], 'gstin') : '';
        const contact = colMap.contact !== -1 ? cleanPrefix(row[colMap.contact], 'name') : name;
        const phone = colMap.phone !== -1 ? cleanPrefix(row[colMap.phone], 'mobile', 'phone') : '';
        const email = colMap.email !== -1 ? cleanPrefix(row[colMap.email], 'email') : '';
        const address = colMap.address !== -1 ? String(row[colMap.address] || '').trim() : road;
        const credit = colMap.credit !== -1 && row[colMap.credit] ? String(row[colMap.credit]).trim() : '₹ 25.0 Lakh';

        merchants.push({
          id: `BUY-${String(idCounter++).padStart(3, '0')}`,
          name,
          mandi: mandi || sheetName.trim(),
          road: road || mandi,
          address: address || `${road}, ${mandi}`,
          gstin,
          contact: contact || name,
          phone,
          email,
          status: 'Active',
          type: 'buyers',
          role: 'Merchant / Buyer',
          credit
        });
      }
    } else {
      // Parse as multi-line card / block format (like All Merchants.xlsx)
      let current: any = null;

      for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        const col0 = row[0] != null ? String(row[0]).trim() : '';

        // If col 0 has a non-header name, it starts a new merchant
        if (col0 && !isHeaderOrTotal(col0)) {
          if (current && current.name) {
            finalizeMerchant(current, seenNames, merchants, idCounter++);
          }

          current = {
            name: col0,
            mandi: sheetName.trim(),
            road: row[1] != null ? String(row[1]).replace(/\u00a0/g, ' ').trim() : '',
            _addrLines: [] as string[],
            gstin: '',
            contact: '',
            phone: '',
            email: '',
            credit: '₹ 25.0 Lakh'
          };
        }

        // Collect fields across current block
        if (current) {
          for (let c = 0; c < row.length; c++) {
            const rawVal = row[c] != null ? String(row[c]).replace(/\u00a0/g, ' ').trim() : '';
            if (!rawVal) continue;

            // Address line in col 1
            if (c === 1 && rawVal !== current.name) {
              if (!current._addrLines.some((l: string) => l.toLowerCase() === rawVal.toLowerCase() || l.toLowerCase().includes(rawVal.toLowerCase()))) {
                current._addrLines.push(rawVal);
              }
            }

            if (/gstin\s*:/i.test(rawVal)) {
              current.gstin = rawVal.replace(/gstin\s*:\s*/i, '').trim();
            }
            if (/name\s*:/i.test(rawVal)) {
              current.contact = rawVal.replace(/name\s*:\s*/i, '').trim();
            }
            if (/mobile\s*:/i.test(rawVal)) {
              const m = rawVal.replace(/mobile\s*:\s*/i, '').trim();
              if (m) current.phone = m;
            }
            if (/phone\s*:/i.test(rawVal)) {
              const ph = rawVal.replace(/phone\s*:\s*/i, '').trim();
              if (ph && !current.phone) current.phone = ph;
            }
            if (/email\s*:/i.test(rawVal)) {
              const em = rawVal.replace(/email\s*:\s*/i, '').trim();
              if (em) current.email = em;
            }
          }
        }
      }

      if (current && current.name) {
        finalizeMerchant(current, seenNames, merchants, idCounter++);
      }
    }
  }

  return merchants;
}

function finalizeMerchant(raw: any, seen: Set<string>, out: ParsedMerchant[], idNum: number) {
  const normKey = raw.name.toLowerCase().trim();
  if (seen.has(normKey)) return;
  seen.add(normKey);

  const cleanAddr = (raw._addrLines || []).filter(Boolean).join(', ');

  out.push({
    id: `BUY-${String(idNum).padStart(3, '0')}`,
    name: raw.name.trim(),
    mandi: raw.mandi || 'APMC YARD',
    road: raw.road || raw.mandi || '',
    address: cleanAddr || raw.road || raw.mandi || '',
    gstin: raw.gstin || '',
    contact: raw.contact || raw.name.trim(),
    phone: raw.phone || '',
    email: raw.email || '',
    status: 'Active',
    type: 'buyers',
    role: 'Merchant / Buyer',
    credit: raw.credit || '₹ 25.0 Lakh'
  });
}

function findFlatHeaderRow(data: any[][]): number {
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;
    const str = row.map(c => String(c || '').toLowerCase()).join(' ');
    if ((str.includes('buyer') || str.includes('party') || str.includes('shop') || str.includes('merchant')) && 
        (str.includes('place') || str.includes('phone') || str.includes('gstin') || str.includes('address') || str.includes('contact') || str.includes('amount') || str.includes('sl no'))) {
      return i;
    }
  }
  return -1;
}

function mapTableColumns(headerRow: string[]) {
  const map = {
    name: -1,
    road: -1,
    mandi: -1,
    address: -1,
    gstin: -1,
    contact: -1,
    phone: -1,
    email: -1,
    credit: -1
  };

  headerRow.forEach((h, idx) => {
    if (map.name === -1 && (h.includes('buyer') || h.includes('party') || h.includes('shop') || h.includes('firm') || h.includes('merchant'))) map.name = idx;
    else if (map.road === -1 && (h.includes('road') || h.includes('place') || h.includes('area') || h.includes('market'))) map.road = idx;
    else if (map.mandi === -1 && (h.includes('mandi') || h.includes('hub') || h.includes('region') || h.includes('city'))) map.mandi = idx;
    else if (map.address === -1 && h.includes('address')) map.address = idx;
    else if (map.gstin === -1 && h.includes('gst')) map.gstin = idx;
    else if (map.contact === -1 && (h.includes('contact') || h.includes('person') || h.includes('owner'))) map.contact = idx;
    else if (map.phone === -1 && (h.includes('phone') || h.includes('mobile') || h.includes('cell'))) map.phone = idx;
    else if (map.email === -1 && h.includes('email')) map.email = idx;
    else if (map.credit === -1 && h.includes('credit')) map.credit = idx;
  });

  return map;
}

function cleanPrefix(val: any, ...prefixes: string[]): string {
  if (val == null) return '';
  let str = String(val).replace(/\u00a0/g, ' ').trim();
  for (const p of prefixes) {
    const reg = new RegExp(`^${p}\\s*:\\s*`, 'i');
    str = str.replace(reg, '');
  }
  return str.trim();
}

function isHeaderOrTotal(str: string): boolean {
  const s = str.toLowerCase().trim();
  return (
    s === 'sl no' || 
    s === 'sl.no' || 
    s === 'total' || 
    s === 'grand total' || 
    s.startsWith('total ') || 
    s === 'buyer name' || 
    s === 'party name' || 
    s === 'shop name'
  );
}
