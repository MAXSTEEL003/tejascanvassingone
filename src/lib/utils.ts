import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
    const deletedSet = new Set(deletedIds.map(id => String(id).trim().toLowerCase().replace(/^#/, '')));

    const raw = localStorage.getItem('stakeholders_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.suppliers)) {
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
  if (!clean || clean.toUpperCase().includes('ANNAPURNA')) {
    return list.length > 0 ? list[0].name : fallback;
  }

  // Check if it matches a registered supplier ID or name
  const match = list.find(s => s.id === clean || s.name.toLowerCase() === clean.toLowerCase());
  if (match) return match.name;

  return clean;
}
