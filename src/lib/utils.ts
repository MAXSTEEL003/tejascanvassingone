import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import merchantsDirectory from '../data/merchants_directory.json';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | string | undefined | null) {
  if (amount === undefined || amount === null || amount === '') return '';
  
  let sign = '';
  let input = String(amount).trim();
  
  if (input.startsWith('+')) {
    sign = '+ ';
    input = input.substring(1).trim();
  } else if (input.startsWith('-')) {
    sign = '- ';
    input = input.substring(1).trim();
  }

  const numericAmount = parseFloat(input.replace(/[₹, ]/g, ""));
  
  if (isNaN(numericAmount)) return String(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: input.includes('.') ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);

  return sign + formatted;
}

export function getRegisteredSuppliers(): Array<{ id: string; name: string; phone?: string; email?: string; code?: string }> {
  try {
    const rawDel = localStorage.getItem('deleted_stakeholder_ids');
    const deletedIds: string[] = rawDel ? JSON.parse(rawDel) : [];
    const deletedSet = new Set(
      deletedIds
        .map(id => String(id).trim().toLowerCase().replace(/^#/, ''))
        .filter(id => id !== 'sup-01' && id !== 'buy-01')
    );

    const raw = localStorage.getItem('stakeholders_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.suppliers) && parsed.suppliers.length > 0) {
        return parsed.suppliers
          .filter((s: any) => s && s.name && s.status !== 'Inactive' && !deletedSet.has(String(s.id || '').toLowerCase()))
          .map((s: any) => ({
            id: s.id || '',
            name: String(s.name).trim(),
            phone: s.phone || '',
            email: s.email || '',
            code: s.code || s.supplierCode || ''
          }));
      }
    }

    const rawReg = localStorage.getItem('registered_suppliers');
    if (rawReg) {
      const parsed = JSON.parse(rawReg);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s: any) => s && s.name && s.status !== 'Inactive' && !deletedSet.has(String(s.id || '').toLowerCase()))
          .map((s: any) => ({
            id: s.id || '',
            name: String(s.name).trim(),
            phone: s.phone || '',
            email: s.email || '',
            code: s.code || s.supplierCode || ''
          }));
      }
    }
  } catch (e) {}
  return [];
}

export function getPrimaryRegisteredSupplier(fallback = 'DIRECT MILL'): string {
  const list = getRegisteredSuppliers();
  if (list.length > 0 && list[0].name) {
    return list[0].name;
  }
  return fallback;
}

export function sanitizeSupplierName(rawSupplier?: string, fallback = 'DIRECT MILL'): string {
  const list = getRegisteredSuppliers();
  // If exactly 1 supplier is registered in admin, all operations and products belong to that 1 supplier
  if (list.length === 1 && list[0].name) {
    return list[0].name;
  }

  const clean = (rawSupplier || '').trim();
  if (!clean) {
    return list.length > 0 ? list[0].name : fallback;
  }

  // Check if it matches a registered supplier ID or name
  const match = list.find(s => s.id === clean || s.name.toLowerCase() === clean.toLowerCase());
  if (match) return match.name;

  return clean;
}

export function formatDateToDDMMYYYY(val: any): string {
  if (!val) return '';
  let d: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [dd, mm, yyyy] = String(val).split('/');
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else if (/^\d{1,2}-[A-Za-z]+-\d{4}$/i.test(val)) {
    return val;
  } else {
    d = new Date(val);
  }

  if (!isNaN(d.getTime())) {
    const day = d.getDate();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return String(val);
}

export function cleanMerchantDisplayName(name: string): string {
  if (!name) return 'Merchant';
  let s = name.trim();
  if (s.includes('@')) {
    const prefix = s.split('@')[0];
    if (/^\d{10,}$/.test(prefix)) {
      return `+91 ${prefix.slice(-10)}`;
    }
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  if (/^\d{10,}$/.test(s)) {
    return `+91 ${s.slice(-10)}`;
  }
  return s;
}

export function getRegisteredBuyers(): Array<{
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  road?: string;
  mandi?: string;
  credit?: string;
  status?: string;
}> {
  try {
    const rawDel = localStorage.getItem('deleted_stakeholder_ids');
    const deletedIds: string[] = rawDel ? JSON.parse(rawDel) : [];
    const deletedSet = new Set(
      deletedIds
        .map(id => String(id).trim().toLowerCase().replace(/^#/, ''))
        .filter(id => id !== 'sup-01' && id !== 'buy-01')
    );

    const buyerMap = new Map<string, any>();

    // Start with all 547 verified APMC merchants from directory
    if (Array.isArray(merchantsDirectory)) {
      merchantsDirectory.forEach((b: any) => {
        if (b && b.name && !deletedSet.has(String(b.id || '').toLowerCase())) {
          buyerMap.set(b.name.trim().toUpperCase(), b);
        }
      });
    }

    // Incorporate cached Firestore cloud stakeholders so newly added buyers from other devices appear immediately
    const cacheRaw = localStorage.getItem('firestore_cache_stakeholders');
    if (cacheRaw) {
      try {
        const cacheItems = JSON.parse(cacheRaw);
        if (Array.isArray(cacheItems)) {
          cacheItems.forEach((b: any) => {
            if (!b || !b.name) return;
            const normId = String(b.id || '').trim().toLowerCase().replace(/^#/, '');
            if (deletedSet.has(normId)) return;
            const isBuyer = b.type === 'buyers' || String(b.id || '').toUpperCase().startsWith('BUY');
            if (isBuyer) {
              const k = b.name.trim().toUpperCase();
              const existing = buyerMap.get(k);
              buyerMap.set(k, { ...existing, ...b });
            }
          });
        }
      } catch (e) {}
    }

    const raw = localStorage.getItem('stakeholders_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.buyers)) {
        parsed.buyers.forEach((b: any) => {
          if (b && b.name && !deletedSet.has(String(b.id || '').toLowerCase())) {
            const k = b.name.trim().toUpperCase();
            const existing = buyerMap.get(k);
            buyerMap.set(k, { ...existing, ...b });
          }
        });
      }
    }

    return Array.from(buyerMap.values()).filter((b: any) => b.status !== 'Inactive');
  } catch (e) {}

  return Array.isArray(merchantsDirectory) ? (merchantsDirectory as any[]) : [];
}

export function getRegisteredBuyerNames(): string[] {
  const buyers = getRegisteredBuyers();
  return Array.from(new Set(buyers.map(b => String(b.name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

// Persistently deleted procurement requests
export function getDeletedProcurementIds(): Set<string> {
  try {
    const raw = localStorage.getItem('deleted_procurement_ids');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
    }
  } catch (e) {}
  return new Set();
}

export function addDeletedProcurementIds(ids: string[]): void {
  try {
    const current = getDeletedProcurementIds();
    ids.forEach(id => {
      const norm = String(id).trim().toLowerCase().replace(/^#/, '');
      if (norm) current.add(norm);
    });
    localStorage.setItem('deleted_procurement_ids', JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function removeDeletedProcurementId(id: string): void {
  try {
    const current = getDeletedProcurementIds();
    const norm = String(id).trim().toLowerCase().replace(/^#/, '');
    if (current.has(norm)) {
      current.delete(norm);
      localStorage.setItem('deleted_procurement_ids', JSON.stringify(Array.from(current)));
    }
  } catch (e) {}
}

// Persistently deleted placed orders
export function getDeletedPlacedOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem('deleted_placed_order_ids');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
    }
  } catch (e) {}
  return new Set();
}

export function addDeletedPlacedOrderIds(ids: string[]): void {
  try {
    const current = getDeletedPlacedOrderIds();
    ids.forEach(id => {
      const norm = String(id).trim().toLowerCase().replace(/^#/, '');
      if (norm) current.add(norm);
    });
    localStorage.setItem('deleted_placed_order_ids', JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function removeDeletedPlacedOrderId(id: string): void {
  try {
    const current = getDeletedPlacedOrderIds();
    const norm = String(id).trim().toLowerCase().replace(/^#/, '');
    if (current.has(norm)) {
      current.delete(norm);
      localStorage.setItem('deleted_placed_order_ids', JSON.stringify(Array.from(current)));
    }
  } catch (e) {}
}

// Persistently deleted arrival entries
export function getDeletedArrivalIds(): Set<string> {
  try {
    const raw = localStorage.getItem('deleted_arrival_entry_ids');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*)/i, '').replace(/^#/, '')));
    }
  } catch (e) {}
  return new Set();
}

export function addDeletedArrivalIds(ids: string[]): void {
  try {
    const current = getDeletedArrivalIds();
    ids.forEach(id => {
      const norm = String(id).trim().toLowerCase().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*)/i, '').replace(/^#/, '');
      if (norm) current.add(norm);
    });
    localStorage.setItem('deleted_arrival_entry_ids', JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function removeDeletedArrivalId(id: string): void {
  try {
    const current = getDeletedArrivalIds();
    const norm = String(id).trim().toLowerCase().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*)/i, '').replace(/^#/, '');
    if (current.has(norm)) {
      current.delete(norm);
      localStorage.setItem('deleted_arrival_entry_ids', JSON.stringify(Array.from(current)));
    }
  } catch (e) {}
}

// Persistently deleted arrival sheet IDs and sheet names
export function getDeletedSheetIds(): Set<string> {
  try {
    const raw = localStorage.getItem('deleted_arrival_sheet_ids');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const set = new Set<string>();
      arr.forEach((id: string) => {
        const norm = String(id).trim().toLowerCase();
        if (norm) {
          set.add(norm);
          const noPrefix = norm.replace(/^sheet-/, '');
          set.add(noPrefix);
          set.add(`sheet-${noPrefix.replace(/[^a-z0-9]/g, '-')}`);
          set.add(noPrefix.replace(/-/g, ' '));
        }
      });
      return set;
    }
  } catch (e) {}
  return new Set();
}

export function addDeletedSheetIds(ids: string[]): void {
  try {
    const current = getDeletedSheetIds();
    ids.forEach(id => {
      const norm = String(id).trim().toLowerCase();
      if (norm) {
        current.add(norm);
        const noPrefix = norm.replace(/^sheet-/, '');
        current.add(noPrefix);
        current.add(`sheet-${noPrefix.replace(/[^a-z0-9]/g, '-')}`);
        current.add(noPrefix.replace(/-/g, ' '));
      }
    });
    const arr = Array.from(current);
    localStorage.setItem('deleted_arrival_sheet_ids', JSON.stringify(arr));

    // Immediately sanitize all local storage sheet caches so deleted sheets NEVER render on cold start
    const isDeletedItem = (sheetOrDoc: any) => {
      if (!sheetOrDoc) return true;
      const sId = String(sheetOrDoc.id || '').trim().toLowerCase();
      const sName = String(sheetOrDoc.name || '').trim().toLowerCase();
      const sSlug = `sheet-${sName.replace(/[^a-z0-9]/g, '-')}`;
      const unslugged = sId.replace(/^sheet-/, '').replace(/-/g, ' ');
      return current.has(sId) || current.has(sName) || current.has(sSlug) || current.has(unslugged);
    };

    ['arrival_entry_sheets_v4', 'arrival_sheets', 'firestore_cache_arrival_sheets'].forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(item => !isDeletedItem(item));
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    });

    // Also sanitize arrival_entry_data_v4 and firestore_cache_arrival_entries to remove orphaned rows
    ['arrival_entry_data_v4', 'firestore_cache_arrival_entries'].forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(row => {
              if (!row) return false;
              const sId = String(row.sheetId || '').trim().toLowerCase();
              const sName = String(row.sheetName || '').trim().toLowerCase();
              return !current.has(sId) && !current.has(sName);
            });
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    });

    // Cloud fire-and-forget sync to Firestore app_metadata
    if (typeof window !== 'undefined') {
      import('./firebase').then(({ setCollectionDoc }) => {
        setCollectionDoc('app_metadata', 'deleted_arrival_sheets', {
          ids: arr,
          updatedAt: Date.now()
        }).catch(() => {});
      }).catch(() => {});
    }
  } catch (e) {}
}

export function removeDeletedSheetId(id: string): void {
  try {
    const current = getDeletedSheetIds();
    const norm = String(id).trim().toLowerCase();
    if (current.has(norm)) {
      current.delete(norm);
      localStorage.setItem('deleted_arrival_sheet_ids', JSON.stringify(Array.from(current)));
    }
  } catch (e) {}
}

export interface ResolvedBuyerProfile {
  id: string;
  name: string;
  username: string;
  phone: string;
  gstin: string;
  address: string;
  email?: string;
  profileLocked?: boolean;
  credit?: string;
}

/**
 * Resolves the official Buyer Name (Merchant Trade Name) and profile details
 * as saved by Admin in the Users Management / stakeholders database.
 */
export function resolveBuyerProfile(identifier?: string): ResolvedBuyerProfile | null {
  try {
    const rawSaved = localStorage.getItem('stakeholders_v2');
    let buyersList: any[] = [];
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed.buyers)) buyersList = parsed.buyers;
      } catch {}
    }

    // Also get merged list from getRegisteredBuyers
    const registered = getRegisteredBuyers();
    // Prioritize explicitly saved buyers from stakeholders_v2
    const allBuyers: any[] = [
      ...buyersList,
      ...registered.filter(r => !buyersList.some(b => (b.id && b.id === r.id) || (b.name && b.name.trim().toLowerCase() === (r.name || '').trim().toLowerCase())))
    ];

    if (!allBuyers.length) return null;

    // Collect query tokens to match
    const tokens: string[] = [];
    if (identifier && typeof identifier === 'string') tokens.push(identifier.trim());

    const storedUser = localStorage.getItem('user_session_v1') || sessionStorage.getItem('user_session_v1');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.sub) tokens.push(String(parsed.sub));
        if (parsed.username) tokens.push(String(parsed.username));
        if (parsed.email) tokens.push(String(parsed.email));
        if (parsed.name) tokens.push(String(parsed.name));
      } catch {}
    }

    const uId = localStorage.getItem('userId');
    if (uId) tokens.push(uId);

    const uPhone = localStorage.getItem('userPhone');
    if (uPhone) tokens.push(uPhone);

    const uEmail = localStorage.getItem('userEmail');
    if (uEmail) tokens.push(uEmail);

    const uName = localStorage.getItem('userName');
    if (uName) tokens.push(uName);

    // Normalize candidates
    const cleanTokens = Array.from(new Set(tokens.filter(Boolean)));

    for (const rawToken of cleanTokens) {
      const lowerToken = rawToken.toLowerCase().trim();
      const prefixToken = lowerToken.includes('@') ? lowerToken.split('@')[0].trim() : lowerToken;
      const digitsToken = rawToken.replace(/\D/g, '');

      const matched = allBuyers.find((b: any) => {
        if (!b) return false;
        const bId = String(b.id || '').toLowerCase().trim();
        const bUser = String(b.username || '').toLowerCase().trim();
        const bName = String(b.name || '').toLowerCase().trim();
        const bEmail = String(b.email || '').toLowerCase().trim();
        const bDigits = String(b.phone || '').replace(/\D/g, '');

        // 1. Direct ID match
        if (bId && (bId === lowerToken || bId === prefixToken)) return true;

        // 2. Phone match (10 digits)
        if (digitsToken.length >= 7 && bDigits.length >= 7) {
          if (bDigits === digitsToken || bDigits.endsWith(digitsToken) || digitsToken.endsWith(bDigits)) return true;
        }

        // 3. Username match
        if (bUser && (bUser === lowerToken || bUser === prefixToken)) return true;

        // 4. Email match
        if (bEmail && (bEmail === lowerToken || bEmail.split('@')[0] === prefixToken)) return true;

        // 5. Name match (case-insensitive exact or substring)
        if (bName) {
          if (bName === lowerToken || bName === prefixToken) return true;
          // If token is username slug (e.g. "mookambika"), check if buyer name contains it (e.g. "MOOKAMBIKA TRADERS")
          if (prefixToken.length >= 4 && bName.includes(prefixToken)) return true;
          // If token is buyer name containing prefix
          if (lowerToken.length >= 4 && !lowerToken.includes('@') && prefixToken.includes(bName)) return true;
        }

        return false;
      });

      if (matched && matched.name) {
        return {
          id: matched.id || `buy-${Date.now()}`,
          name: String(matched.name).trim(),
          username: matched.username || prefixToken,
          phone: matched.phone || '',
          gstin: matched.gstin || '',
          address: matched.address || '',
          email: matched.email || '',
          profileLocked: Boolean(matched.profileLocked),
          credit: matched.credit || ''
        };
      }
    }
  } catch (err) {
    console.warn('Error resolving buyer profile:', err);
  }
  return null;
}

/**
 * Synchronizes the active merchant trade profile across localStorage and events
 * using the verified buyer profile from Users Management.
 */
export function syncCurrentMerchantProfile(buyer?: any): void {
  try {
    const target = buyer || resolveBuyerProfile();
    if (!target) return;

    if (target.name) localStorage.setItem('userName', target.name);
    if (target.phone) localStorage.setItem('userPhone', target.phone);
    if (target.gstin) localStorage.setItem('userGstin', target.gstin);
    if (target.address) localStorage.setItem('userAddress', target.address);
    if (target.id) localStorage.setItem('userId', target.id);
    localStorage.setItem('profileLocked', target.profileLocked ? 'true' : 'false');

    // Update session user in local/sessionStorage
    const storedUser = localStorage.getItem('user_session_v1') || sessionStorage.getItem('user_session_v1');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        parsed.name = target.name;
        localStorage.setItem('user_session_v1', JSON.stringify(parsed));
        sessionStorage.setItem('user_session_v1', JSON.stringify(parsed));
      } catch {}
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('profile-updated'));
  } catch (err) {
    console.warn('Error syncing merchant profile:', err);
  }
}




