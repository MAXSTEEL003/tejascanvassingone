/**
 * Canonical Supplier and Purchase Order Numbering Service (Backend-safe)
 * Zero frontend dependencies, zero DOM/localStorage references, zero JSON import attributes needed.
 */

export const KNOWN_SUPPLIER_CODES: Record<string, string> = {
  'BHAGWATI RICE AND AGRO INDUSTRIES': 'BRI',
  'RIDDHE SIDDHE RICE INDUSTRIES PVT LTD': 'RSR',
  'SRI LAKSHMI RICE INDUSTRIES': 'SLR',
  'SAI TEJA PARBOILED RICE MILLS (P) LTD': 'STP',
  'NIDHI AGROS': 'NAR',
  'VAISHNAVI FOOD PRODUCTS PVT LTD': 'VFP',
  'ANNAPURNA RICE & AGRO INDUSTRIES': 'ARA',
  'AMRITSAR GRAIN EXPORT LTD.': 'AGE',
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
    'MILLS', 'MILL', 'COMPANY', 'ENTERPRISES', 'ENTERPRISE', '(P)', 'P',
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
    return `${candidate.slice(0, 3)}${suffix}`;
  }

  return candidate;
}

/**
 * Resolves a supplier's permanent code from name
 */
export function getSupplierCode(supplierNameOrId?: string): string {
  if (!supplierNameOrId) return 'SUP';
  const clean = String(supplierNameOrId).trim();
  return deriveSupplierCode(clean);
}

/**
 * Generates confidential random Grouped PO reference e.g. "TC-K8M492"
 */
export function generateRandomPoNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TC-${rand}`;
}

/**
 * Resolves or derives canonical confidential grouped PO reference (e.g. TC-K8M492)
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
  const resolvedSup = sub.supplier || sub.seller || sub.millerName || sub.assignedSupplier || sub.origin || fallbackSupplier;
  const code = getSupplierCode(resolvedSup);
  return `${code}-${String(sIdx + 1).padStart(4, '0')}`;
}
