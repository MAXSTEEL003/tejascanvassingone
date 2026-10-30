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

export function getRegisteredSuppliers(): Array<{ id: string; name: string; phone?: string; email?: string }> {
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
            email: s.email || ''
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
            email: s.email || ''
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



