import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload,
  Plus, 
  Save, 
  ChevronDown, 
  Eraser, 
  Undo2, 
  Table as TableIcon, 
  Keyboard, 
  ArrowRight, 
  ArrowUpDown,
  Search,
  Check,
  Sparkles,
  Link,
  Coins,
  FileText,
  Filter,
  Loader2,
  Trash2,
  Edit2,
  Calendar,
  Camera,
  Scan,
  Eye,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection } from '../lib/firebase';
import { PRELOADED_TRANSACTIONS, getMonthYearLabel } from '../lib/analyticsEngine';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ManifestCameraScanner, { ParsedManifestData } from '../components/ManifestCameraScanner';
import BillPhotoModal from '../components/BillPhotoModal';

// Preset lists matching entities in UsersManagement.tsx and the ecosystem
const SUPPLIERS = [
  'ANNAPURNA RICE & AGRO INDUSTRIES'
];

const BUYERS = [
  'V.K FOODS'
];

const BRANDS = [
  'KESHAR KALI',
  '1121 Sella Rice',
  'Sona Masoori (Old)',
  'Organic Brown Rice',
  'Broken Rice (100%)'
];

// Excel-style Columns defined as requested
const COLS = [
  { id: 'date', label: 'DATE', width: 130, type: 'date', group: 'Meta' },
  { id: 'millerName', label: 'SUPPLIER (MILLER)', width: 220, type: 'select', options: SUPPLIERS, group: 'Entity' },
  { id: 'place', label: 'PLACE', width: 150, type: 'text', group: 'Meta' },
  { id: 'brand', label: 'BRAND', width: 140, type: 'select', options: BRANDS, group: 'Product' },
  { id: 'partyName', label: 'BUYER (PARTY)', width: 200, type: 'select', options: BUYERS, group: 'Entity' },
  { id: 'noOfDays', label: 'PENDING DAYS', width: 130, type: 'calc', group: 'Logistics' },
  { id: 'noOfDayRec', label: 'PAYMENT STATUS', width: 140, type: 'select', options: ['Not Cleared', 'Cleared'], group: 'Logistics' },
  { id: 'area', label: 'BUYER AREA (SHOP)', width: 160, type: 'text', group: 'Meta' },
  { id: 'billNo', label: 'BILL NO', width: 110, type: 'text', group: 'Meta' },
  { id: 'qty', label: 'QTLS', width: 115, type: 'number', group: 'Weight' },
  { id: 'rate', label: 'Rate', width: 110, type: 'number', group: 'Pricing' },
  { id: 'amount', label: 'Amount', width: 140, type: 'calc', group: 'Pricing' },
  { id: 'lh', label: 'L.H.', width: 100, type: 'number', group: 'Charges' },
  { id: 'cc', label: 'C.C', width: 100, type: 'number', group: 'Charges' },
  { id: 'tds', label: 'TDS', width: 100, type: 'number', group: 'Taxes' },
  { id: 'shortage', label: 'Shortage', width: 110, type: 'number', group: 'Charges' },
  { id: 'diffIn', label: 'Diff. in', width: 110, type: 'number', group: 'Pricing' },
  { id: 'netAmt', label: 'Net Amt', width: 140, type: 'calc', group: 'Pricing' },
  { id: 'chqAm', label: 'chq am', width: 120, type: 'number', group: 'Settlement' },
  { id: 'chqNo', label: 'Ch/DD No.', width: 130, type: 'text', group: 'Settlement' },
  { id: 'chqDt', label: 'CHQ DT', width: 130, type: 'date', group: 'Settlement' },
  { id: 'bank', label: 'bank', width: 150, type: 'text', group: 'Settlement' },
  { id: 'billPhoto', label: 'BILL PHOTO', width: 140, type: 'bill-photo', group: 'Document' },
  { id: 'purchaseOrderNo', label: 'purchase order no', width: 240, type: 'po-select', group: 'Fulfillment' }
];

const INITIAL_ROWS = 30;

const getPastDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const parseAnyDate = (val: any): Date | null => {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch.map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // DD-Mon-YYYY (e.g. 25-Jul-2026)
  const monMatch = str.match(/^(\d{1,2})[/-]([A-Za-z]+)[/-](\d{4})$/);
  if (monMatch) {
    const d = Number(monMatch[1]);
    const y = Number(monMatch[3]);
    const mStr = monMatch[2].toLowerCase();
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = months.findIndex(m => mStr.startsWith(m));
    if (mIdx !== -1) {
      const date = new Date(y, mIdx, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
};

const formatDateToDDMMYYYY = (val: any): string => {
  if (!val) return '';
  const d = parseAnyDate(val);
  if (d) {
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return String(val);
};

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'dt', 'entry date', 'arrival date', 'invoice date', 'bill date', 'transaction date'],
  millerName: ['supplier (miller)', 'millername', 'supplier', 'miller', 'supplier name', 'miller name', 'mill name', 'supplier/miller', 'mill', 'seller', 'seller name', 'miller_name', 'supplier_name'],
  place: ['place', 'location', 'city', 'origin', 'dispatch place', 'market place', 'place of origin', 'supplier place', 'mill place', 'miller place', 'origin place', 'supplier location'],
  brand: ['brand', 'brand name', 'item', 'quality', 'variety', 'rice brand', 'product'],
  partyName: ['buyer (party)', 'partyname', 'buyer', 'party', 'buyer name', 'party name', 'buyer/party', 'customer', 'customer name', 'client', 'client name', 'buyer_name', 'party_name'],
  noOfDays: ['pending days', 'noofdays', 'days pending', 'overdue days', 'days'],
  noOfDayRec: ['payment status', 'noofdayrec', 'status', 'cleared/not cleared', 'cleared status'],
  area: ['buyer area (shop)', 'area', 'buyer area', 'shop', 'destination', 'road', 'buyer location', 'shop area', 'party area', 'buyer shop', 'delivery area'],
  billNo: ['bill no', 'billno', 'bill number', 'bill #', 'bill', 'invoice no', 'invoice number', 'inv no', 'invoice', 'bill_no'],
  qty: ['qtls', 'qty', 'quantity', 'quintals', 'bags', 'total qtls', 'weight'],
  rate: ['rate', 'price', 'rate/qtl', 'unit price', 'rate per qtl'],
  amount: ['amount', 'amt', 'gross amt', 'total amt', 'value'],
  lh: ['l.h.', 'lh', 'loading', 'labour', 'loading charges'],
  cc: ['c.c', 'cc', 'commission', 'brokerage'],
  tds: ['tds', 'tax'],
  shortage: ['shortage', 'shortage amt'],
  diffIn: ['diff. in', 'diffin', 'difference', 'diff'],
  netAmt: ['net amt', 'netamt', 'net amount', 'final amount', 'balance', 'total payable', 'net payable'],
  chqAm: ['chq am', 'chqam', 'cheque amount', 'chq amt', 'paid amt', 'cheque amt'],
  chqNo: ['ch/dd no.', 'chqno', 'chq no', 'cheque no', 'dd no', 'cheque number', 'utr no', 'txn no'],
  chqDt: ['chq dt', 'chqdt', 'cheque date', 'chq date', 'payment date'],
  bank: ['bank', 'bank name', 'banker'],
  billPhoto: ['bill photo', 'photo of bill', 'billphoto', 'bill image', 'invoice photo', 'bilty photo', 'lr photo', 'bill_photo'],
  purchaseOrderNo: ['purchase order no', 'purchaseorderno', 'po no', 'po number', 'order no', 'contract no', 'purchase order']
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getDefaultDateForSheet = (sheetName: string): string => {
  if (!sheetName) return new Date().toISOString().split('T')[0];
  const clean = sheetName.toLowerCase().trim();
  const yearMatch = clean.match(/\b(20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '2026';

  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  for (const [mName, mNum] of Object.entries(monthMap)) {
    if (clean.includes(mName)) {
      return `${year}-${mNum}-01`;
    }
  }

  return new Date().toISOString().split('T')[0];
};

const MILLER_PLACES: Record<string, string> = {
  'ANNAPURNA RICE & AGRO INDUSTRIES': 'MIRYALGUDA',
};

const BUYER_AREAS: Record<string, string> = {
  'V.K FOODS': '4TH BLOCK',
};

const generateEmptyArrivalRows = (count = 100, defaultDate?: string): any[] => {
  const d = defaultDate || new Date().toISOString().split('T')[0];
  return Array(count).fill(0).map((_, i) => ({
    id: `row-empty-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
    date: d
  }));
};

const generateDefaultArrivalRows = (): any[] => {
  return generateEmptyArrivalRows(100);
};

export default function ArrivalEntry() {
  interface Sheet {
    id: string;
    name: string;
    data: any[];
  }

  const [sheets, setSheets] = useState<Sheet[]>(() => {
    const savedSheets = localStorage.getItem('arrival_entry_sheets_v4');
    if (savedSheets) {
      try {
        const parsed = JSON.parse(savedSheets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map((s, idx) => {
            const rowData = Array.isArray(s.data) ? s.data : [];
            const hasUserEntry = rowData.some(r => r && (r.partyName || r.millerName || (r.billNo && r.billNo !== '1042')));
            return {
              id: s.id || `sheet-${idx + 1}`,
              name: s.id === 'sheet-1' && (s.name === 'Sheet 1' || !s.name) ? 'All Arrivals (Main)' : (s.name || `Sheet ${idx + 1}`),
              data: hasUserEntry ? rowData : generateEmptyArrivalRows(100)
            };
          });
          return cleaned;
        }
      } catch (e) {
        // fallback
      }
    }
    return [{ id: 'sheet-1', name: 'All Arrivals (Main)', data: generateEmptyArrivalRows(100) }];
  });

  const [currentSheetId, setCurrentSheetId] = useState<string>(() => {
    return sheets[0]?.id || 'sheet-1';
  });

  const currentSheet = useMemo(() => {
    const found = sheets.find(s => s.id === currentSheetId) || sheets[0];
    if (found) {
      return {
        id: found.id || 'sheet-1',
        name: found.name || 'Sheet 1',
        data: Array.isArray(found.data) ? found.data : generateEmptyArrivalRows(100)
      };
    }
    return { id: 'sheet-1', name: 'All Arrivals (Main)', data: generateDefaultArrivalRows() };
  }, [sheets, currentSheetId]);

  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [dynamicSuppliers, setDynamicSuppliers] = useState<string[]>(SUPPLIERS);
  const [dynamicBuyers, setDynamicBuyers] = useState<string[]>(BUYERS);

  // Load registered stakeholders and product inventory for smart dropdown validation
  useEffect(() => {
    async function loadMetadata() {
      try {
        const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
        const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
        const deletedSet = new Set(deletedIds.map(id => String(id).trim().toLowerCase().replace(/^#/, '')));

        const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
        const cloudDocs = await getCollectionDocs('stakeholders').catch(() => []);

        const supSet = new Set<string>(SUPPLIERS);
        const buySet = new Set<string>(BUYERS);

        if (cached) {
          (cached.suppliers || []).forEach((s: any) => {
            if (s && s.name && !deletedSet.has(String(s.id || '').toLowerCase())) {
              supSet.add(s.name.trim());
            }
          });
          (cached.buyers || []).forEach((b: any) => {
            if (b && b.name && !deletedSet.has(String(b.id || '').toLowerCase())) {
              buySet.add(b.name.trim());
            }
          });
        }

        if (cloudDocs && cloudDocs.length > 0) {
          cloudDocs.forEach((d: any) => {
            if (!d || !d.name || deletedSet.has(String(d.id || '').toLowerCase())) return;
            const type = d.type || (d.id?.startsWith('SUP') ? 'suppliers' : 'buyers');
            if (type === 'suppliers') {
              supSet.add(d.name.trim());
            } else if (type === 'buyers') {
              buySet.add(d.name.trim());
            }
          });
        }

        // Product inventory
        let delProdSet = new Set<string>();
        try {
          const rawDelProd = localStorage.getItem('deleted_product_inventory_ids');
          if (rawDelProd) {
            const arr = JSON.parse(rawDelProd);
            if (Array.isArray(arr)) delProdSet = new Set(arr);
          }
        } catch (e) {}

        const localInv = JSON.parse(localStorage.getItem('product_inventory') || '[]')
          .filter((p: any) => p && p.id && !delProdSet.has(p.id));
        const cloudInv = (await getCollectionDocs('product_inventory').catch(() => []))
          .filter((p: any) => p && p.id && !delProdSet.has(p.id));

        const combined = [...localInv, ...cloudInv];
        const uniqueMap = new Map();
        combined.forEach(p => {
          if (p && (p.id || p.name)) {
            const key = p.id || `${p.supplier}_${p.name}`;
            uniqueMap.set(key, p);
          }
        });
        setInventoryProducts(Array.from(uniqueMap.values()));
        setDynamicSuppliers(Array.from(supSet).sort());
        setDynamicBuyers(Array.from(buySet).sort());
      } catch (e) {
        console.warn("Failed to load metadata in ArrivalEntry:", e);
      }
    }
    loadMetadata();
  }, []);

  const data = useMemo(() => {
    return Array.isArray(currentSheet?.data) ? currentSheet.data : [];
  }, [currentSheet]);

  const calculatePendingDays = useCallback((row: any) => {
    if (!row || !row.date) return '';
    const status = row.noOfDayRec || 'Not Cleared';
    
    if (status === 'Cleared') {
      if (row.chqDt) {
        const arrDate = parseAnyDate(row.date);
        const chqDate = parseAnyDate(row.chqDt);
        if (arrDate && chqDate) {
          arrDate.setHours(0,0,0,0);
          chqDate.setHours(0,0,0,0);
          const diffTime = chqDate.getTime() - arrDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= 0 ? `${diffDays} (Cleared)` : '0 (Cleared)';
        }
      }
      return 'Cleared';
    }

    // Payment is pending / "Not Cleared"
    const arrDate = parseAnyDate(row.date);
    if (!arrDate) return '';
    const today = new Date();
    arrDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = today.getTime() - arrDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? `${diffDays} Days` : '0 Days';
  }, []);

  const getPaymentStatus = useCallback((row: any) => {
    return row.noOfDayRec || 'Not Cleared';
  }, []);

  const getPendingDaysNum = useCallback((row: any) => {
    if (!row || !row.date) return 0;
    const status = row.noOfDayRec || 'Not Cleared';
    if (status === 'Cleared') return 0;

    const arrDate = parseAnyDate(row.date);
    if (!arrDate) return 0;
    const today = new Date();
    arrDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = today.getTime() - arrDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }, []);

  const setData = useCallback((newDataOrFn: any[] | ((prev: any[]) => any[])) => {
    setSheets(prevSheets => {
      const updated = prevSheets.map(s => {
        if (s.id === currentSheetId) {
          const resolvedData = typeof newDataOrFn === 'function' ? newDataOrFn(s.data) : newDataOrFn;
          return { ...s, data: resolvedData };
        }
        return s;
      });
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(updated));
      // Keep old single-sheet localStorage updated for backward compatibility (e.g., payments view, etc.)
      const activeSheet = updated.find(s => s.id === currentSheetId);
      if (activeSheet) {
        localStorage.setItem('arrival_entry_data_v4', JSON.stringify(activeSheet.data));
      }
      try {
        window.dispatchEvent(new CustomEvent('arrival-entry-updated'));
      } catch (e) {}
      return updated;
    });
  }, [currentSheetId]);

  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc' | 'none'>('desc');

  const handleSortByDate = useCallback((explicitOrder?: 'desc' | 'asc') => {
    const nextOrder = explicitOrder || (dateSortOrder === 'desc' ? 'asc' : 'desc');
    setDateSortOrder(nextOrder);

    setData(prevData => {
      const realRows = prevData.filter(r => r && (r.partyName || r.millerName || r.billNo || r.qty || r.netAmt));
      const emptyRows = prevData.filter(r => !r || !(r.partyName || r.millerName || r.billNo || r.qty || r.netAmt));

      realRows.sort((a, b) => {
        const timeA = parseAnyDate(a.date)?.getTime() || 0;
        const timeB = parseAnyDate(b.date)?.getTime() || 0;
        if (timeA !== timeB) {
          return nextOrder === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return String(b.billNo || '').localeCompare(String(a.billNo || ''));
      });

      return [...realRows, ...emptyRows];
    });
  }, [dateSortOrder, setData]);

  // Sheet Management Modal & Rename States
  const [isAddSheetModalOpen, setIsAddSheetModalOpen] = useState(false);
  const [createSheetMode, setCreateSheetMode] = useState<'month' | 'custom'>('month');
  const [selectedSheetMonth, setSelectedSheetMonth] = useState<string>('May');
  const [selectedSheetYear, setSelectedSheetYear] = useState<string>('2026');
  const [copyMainEntriesForMonth, setCopyMainEntriesForMonth] = useState<boolean>(true);
  const [newSheetInputName, setNewSheetInputName] = useState('');
  const [sheetToDelete, setSheetToDelete] = useState<Sheet | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');

  const handleOpenAddSheetModal = () => {
    const now = new Date();
    const currM = MONTH_NAMES[now.getMonth()] || 'May';
    setSelectedSheetMonth(currM);
    setSelectedSheetYear('2026');
    setCreateSheetMode('month');
    setCopyMainEntriesForMonth(true);
    setNewSheetInputName(`Sheet ${sheets.length + 1}`);
    setIsAddSheetModalOpen(true);
  };

  const handleConfirmCreateSheet = () => {
    let sheetName = '';
    let sheetData: any[] = [];
    const mainSheet = sheets.find(s => s.id === 'sheet-1') || sheets[0];

    if (createSheetMode === 'month') {
      sheetName = `${selectedSheetMonth} ${selectedSheetYear}`;
      const mIdx = MONTH_NAMES.indexOf(selectedSheetMonth);
      const monthNumStr = mIdx !== -1 ? String(mIdx + 1).padStart(2, '0') : '05';
      const monthPrefix = `${selectedSheetYear}-${monthNumStr}`;
      const defaultDate = `${selectedSheetYear}-${monthNumStr}-01`;

      if (copyMainEntriesForMonth && mainSheet && Array.isArray(mainSheet.data)) {
        // Extract matching entries from main sheet
        const matchedRows = mainSheet.data.filter(row => {
          if (!row || !row.date) return false;
          const isReal = !!(row.partyName || row.millerName || row.billNo || row.qty || row.netAmt);
          return isReal && row.date.startsWith(monthPrefix);
        }).map((row, idx) => ({
          ...row,
          id: `row-m-${Date.now()}-${idx}`
        }));

        const emptyPadding = generateEmptyArrivalRows(Math.max(50, 100 - matchedRows.length), defaultDate);
        sheetData = [...matchedRows, ...emptyPadding];
      } else {
        sheetData = generateEmptyArrivalRows(100, defaultDate);
      }
    } else {
      sheetName = newSheetInputName.trim() || `Sheet ${sheets.length + 1}`;
      const defaultDate = getDefaultDateForSheet(sheetName);
      sheetData = generateEmptyArrivalRows(100, defaultDate);
    }

    const newId = `sheet-${Date.now()}`;
    const newSheet = {
      id: newId,
      name: sheetName,
      data: sheetData
    };
    const updated = [...sheets, newSheet];
    setSheets(updated);
    localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(updated));
    try { window.dispatchEvent(new CustomEvent('arrival-entry-updated')); } catch (e) {}
    setCurrentSheetId(newId);
    setIsAddSheetModalOpen(false);
  };

  const handleConfirmDeleteSheet = () => {
    if (!sheetToDelete) return;
    const remaining = sheets.filter(s => s.id !== sheetToDelete.id);
    if (remaining.length > 0) {
      setSheets(remaining);
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(remaining));
      try { window.dispatchEvent(new CustomEvent('arrival-entry-updated')); } catch (e) {}
      if (currentSheetId === sheetToDelete.id) {
        setCurrentSheetId(remaining[0].id);
      }
    }
    setSheetToDelete(null);
  };

  const handleSaveRenameSheet = (id: string) => {
    const trimmed = editingSheetName.trim();
    if (trimmed) {
      setSheets(prev => {
        const updated = prev.map(s => s.id === id ? { ...s, name: trimmed } : s);
        localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(updated));
        try { window.dispatchEvent(new CustomEvent('arrival-entry-updated')); } catch (e) {}
        return updated;
      });
    }
    setEditingSheetId(null);
  };

  // Month Selection State
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Excel Column Filters State
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [openFilterColId, setOpenFilterColId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  const [selectedDueArea, setSelectedDueArea] = useState<string>('All');

  const getUniqueColValues = useCallback((colId: string) => {
    const values = new Set<string>();
    data.forEach(row => {
      const isReal = !!(row.partyName || row.millerName || row.billNo);
      if (isReal) {
        let val = row[colId];
        if (colId === 'noOfDays') {
          val = calculatePendingDays(row);
        } else if (colId === 'noOfDayRec') {
          val = row.noOfDayRec || 'Not Cleared';
        }
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          values.add(String(val).trim());
        }
      }
    });
    return Array.from(values).sort();
  }, [data, calculatePendingDays]);

  const handleClearColFilter = useCallback((colId: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.forEach(row => {
      if (!row) return;
      const isReal = !!(row.partyName || row.millerName || row.billNo);
      if (isReal && row.date) {
        months.add(getMonthYearLabel(row.date));
      }
    });
    const sortMonthLabel = (a: string, b: string) => {
      const dateA = new Date(a.replace(/([A-Z]+)-(\d+)/, '$1 1, $2'));
      const dateB = new Date(b.replace(/([A-Z]+)-(\d+)/, '$1 1, $2'));
      return dateB.getTime() - dateA.getTime();
    };
    return Array.from(months).sort(sortMonthLabel);
  }, [data]);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(columnFilters).some(colId => columnFilters[colId] && columnFilters[colId].length > 0);
  }, [columnFilters]);

  const filteredData = useMemo(() => {
    const hasMonthFilter = selectedMonth !== 'all';
    
    if (!hasActiveFilters && !hasMonthFilter) {
      return data;
    }

    return data.filter(row => {
      if (!row) return false;
      const isRowReal = !!(row.partyName || row.millerName || row.billNo);
      if (!isRowReal) {
        return false;
      }

      if (hasMonthFilter) {
        const rowMonth = getMonthYearLabel(row.date);
        if (rowMonth !== selectedMonth) return false;
      }

      for (const colId of Object.keys(columnFilters)) {
        const activeVals = columnFilters[colId];
        if (activeVals && activeVals.length > 0) {
          let rowVal = String(row[colId] || '').trim();
          if (colId === 'noOfDays') {
            rowVal = String(calculatePendingDays(row));
          } else if (colId === 'noOfDayRec') {
            rowVal = row.noOfDayRec || 'Not Cleared';
          }
          if (!activeVals.includes(rowVal)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, columnFilters, selectedMonth, hasActiveFilters, calculatePendingDays]);

  const forceReseedDemoData = async () => {
    if (window.confirm("This will overwrite the current sheet with the 155 preloaded transactions. Proceed?")) {
      const demoRows = generateDefaultArrivalRows();
      setData(demoRows);
      
      try {
        setCloudStatus('syncing');
        const syncedData = demoRows.map((row, idx) => ({
          ...row,
          id: `row-${idx}`,
          sheetId: currentSheet.id,
          sheetName: currentSheet.name,
          noOfDays: calculatePendingDays(row),
          noOfDayRec: row.noOfDayRec || 'Not Cleared'
        }));
        await syncCollection('arrival_entries', syncedData);
        setCloudStatus('synced');
        alert("Demo data seeded successfully! You can now see the 155 entries.");
      } catch (err) {
        setCloudStatus('error');
        alert("Demo data seeded locally, but cloud sync failed.");
      }
    }
  };

  const uniqueAreas = useMemo(() => {
    const areasSet = new Set<string>();
    data.forEach(row => {
      const hasBasicData = row.partyName || row.millerName || row.billNo || row.qty;
      const isPending = (row.noOfDayRec || 'Not Cleared') !== 'Cleared';
      if (hasBasicData && isPending && row.area && typeof row.area === 'string') {
        const trimmed = row.area.trim();
        if (trimmed) {
          areasSet.add(trimmed);
        }
      }
    });
    return ['All', ...Array.from(areasSet).sort()];
  }, [data]);

  const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>({ r: 0, c: 1 });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [history, setHistory] = useState<any[][]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const formulaInputRef = useRef<any>(null);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const activeScrollSourceRef = useRef<'top' | 'grid' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalTableWidth = useMemo(() => {
    return COLS.reduce((sum, col) => sum + col.width, 0) + 40; // 40px for row numbering column
  }, []);

  const handleTopScroll = () => {
    if (activeScrollSourceRef.current === 'grid') return;
    activeScrollSourceRef.current = 'top';
    const sLeft = topScrollRef.current?.scrollLeft || 0;
    if (gridRef.current) gridRef.current.scrollLeft = sLeft;
    
    window.requestAnimationFrame(() => {
      activeScrollSourceRef.current = null;
    });
  };

  const handleGridScroll = () => {
    if (activeScrollSourceRef.current === 'top') return;
    activeScrollSourceRef.current = 'grid';
    const sLeft = gridRef.current?.scrollLeft || 0;
    if (topScrollRef.current) topScrollRef.current.scrollLeft = sLeft;

    window.requestAnimationFrame(() => {
      activeScrollSourceRef.current = null;
    });
  };

  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [poFilterQuery, setPoFilterQuery] = useState('');

  // Paper Manifest Camera Scanner Modal State
  const [isManifestScannerOpen, setIsManifestScannerOpen] = useState(false);
  const [manifestSuccessToast, setManifestSuccessToast] = useState<string | null>(null);

  // Bill Photo Modal State
  const [billPhotoModalState, setBillPhotoModalState] = useState<{
    isOpen: boolean;
    rowIndex: number;
    row: any;
  }>({
    isOpen: false,
    rowIndex: -1,
    row: null
  });

  const handleApplyManifest = useCallback((parsed: ParsedManifestData, targetMode: 'new' | 'current') => {
    const newRow: any = {
      id: `row-manifest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: parsed.date || new Date().toISOString().split('T')[0],
      millerName: parsed.millerName || '',
      place: parsed.place || (parsed.millerName && (MILLER_PLACES as any)[parsed.millerName] ? (MILLER_PLACES as any)[parsed.millerName] : 'MIRYALGUDA'),
      brand: parsed.brand || 'KESHAR KALI',
      partyName: parsed.partyName || '',
      noOfDays: '',
      noOfDayRec: parsed.noOfDayRec || 'Not Cleared',
      area: parsed.area || (parsed.partyName && (BUYER_AREAS as any)[parsed.partyName] ? (BUYER_AREAS as any)[parsed.partyName] : '4TH BLOCK'),
      billNo: parsed.billNo ? String(parsed.billNo).trim() : '',
      qty: parsed.qty !== '' && parsed.qty !== undefined ? Number(parsed.qty) : '',
      rate: parsed.rate !== '' && parsed.rate !== undefined ? Number(parsed.rate) : '',
      amount: parsed.amount !== '' && parsed.amount !== undefined ? Number(parsed.amount) : '',
      lh: parsed.lh !== '' && parsed.lh !== undefined ? Number(parsed.lh) : '',
      cc: parsed.cc !== '' && parsed.cc !== undefined ? Number(parsed.cc) : '',
      tds: parsed.tds !== '' && parsed.tds !== undefined ? Number(parsed.tds) : '',
      shortage: parsed.shortage !== '' && parsed.shortage !== undefined ? Number(parsed.shortage) : '',
      diffIn: parsed.diffIn !== '' && parsed.diffIn !== undefined ? Number(parsed.diffIn) : '',
      netAmt: parsed.netAmt !== '' && parsed.netAmt !== undefined ? Number(parsed.netAmt) : '',
      chqAm: '',
      chqNo: '',
      chqDt: '',
      bank: '',
      billPhoto: parsed.billPhoto || '',
      purchaseOrderNo: parsed.purchaseOrderNo || ''
    };

    if (!newRow.amount && newRow.qty && newRow.rate) {
      newRow.amount = Math.round(Number(newRow.qty) * Number(newRow.rate));
    }
    if (!newRow.netAmt && newRow.amount) {
      const gross = Number(newRow.amount) || 0;
      const lh = Number(newRow.lh) || 0;
      const cc = Number(newRow.cc) || 0;
      const tds = Number(newRow.tds) || 0;
      const shortage = Number(newRow.shortage) || 0;
      const diffIn = Number(newRow.diffIn) || 0;
      newRow.netAmt = Math.round(gross + lh + cc - tds - shortage + diffIn);
    }

    setData(prevData => {
      let updated = [...prevData];
      if (targetMode === 'current' && activeCell && activeCell.r >= 0 && activeCell.r < updated.length) {
        const existingId = updated[activeCell.r]?.id || newRow.id;
        updated[activeCell.r] = {
          ...updated[activeCell.r],
          ...newRow,
          id: existingId
        };
      } else {
        const firstEmptyIdx = updated.findIndex(r => !r || !(r.partyName || r.millerName || r.billNo || r.qty));
        if (firstEmptyIdx !== -1) {
          updated[firstEmptyIdx] = newRow;
        } else {
          updated.unshift(newRow);
        }
      }
      return updated;
    });

    setManifestSuccessToast(`Shipment manifest ${newRow.billNo ? `#${newRow.billNo}` : ''} successfully scanned and added to ledger!`);
    setTimeout(() => {
      setManifestSuccessToast(null);
    }, 5000);
  }, [activeCell, setData]);

  // Load from Firebase and local placed orders on mount
  useEffect(() => {
    async function loadCloudAndOrders() {
      try {
        setCloudStatus('syncing');
        
        // 1. Fetch live arrival entries
        const cloudRows = await getCollectionDocs('arrival_entries');
        
        if (cloudRows && cloudRows.length > 0) {
          // Reconstruct sheets from cloud rows
          const cloudSheetsMap = new Map<string, { name: string, rows: any[] }>();
          cloudRows.forEach(row => {
            const sId = row.sheetId || 'sheet-1';
            const sName = row.sheetName || 'Sheet 1';
            const idx = parseInt(row.id.replace('row-', ''));
            if (!isNaN(idx) && idx >= 0) {
              if (!cloudSheetsMap.has(sId)) {
                cloudSheetsMap.set(sId, { name: sName, rows: [] });
              }
              const group = cloudSheetsMap.get(sId)!;
              group.rows[idx] = row;
            }
          });

          // Merge with local sheets
          setSheets(prevSheets => {
            const newSheets = [...prevSheets];
            cloudSheetsMap.forEach((cloudGroup, sId) => {
              let localSheetIndex = newSheets.findIndex(s => s.id === sId);
              if (localSheetIndex === -1) {
                newSheets.push({ id: sId, name: cloudGroup.name, data: [] });
                localSheetIndex = newSheets.length - 1;
              }
              const localSheet = newSheets[localSheetIndex];
              const mergedData = [...localSheet.data];
              
              const maxIdx = Math.max(cloudGroup.rows.length, mergedData.length, INITIAL_ROWS);
              const grid = Array(maxIdx).fill(0).map((_, i) => mergedData[i] || { date: new Date().toISOString().split('T')[0] });
              
              cloudGroup.rows.forEach((cloudRow, idx) => {
                if (cloudRow) {
                  const localRow = grid[idx];
                  const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
                  const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));
                  const isCloudDummy = cloudRow.billNo === '1042';

                  let shouldOverwrite = false;
                  if (isCloudDummy) {
                    shouldOverwrite = false;
                  } else if (!isLocalReal && isCloudReal) {
                    shouldOverwrite = true;
                  } else if (isLocalReal && isCloudReal) {
                    const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
                    const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
                    if (cloudTime > localTime || !localRow.lastUpdated) {
                      shouldOverwrite = true;
                    }
                  } else if (!isLocalReal && !isCloudReal) {
                    shouldOverwrite = true;
                  }

                  if (shouldOverwrite) {
                    grid[idx] = { ...cloudRow, id: `row-${idx}` };
                  }
                }
              });

              newSheets[localSheetIndex] = { ...localSheet, data: grid };
            });

            localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(newSheets));
            // Keep old single-sheet updated for backward compatibility
            const activeSheet = newSheets.find(s => s.id === currentSheetId) || newSheets[0];
            if (activeSheet) {
              localStorage.setItem('arrival_entry_data_v4', JSON.stringify(activeSheet.data));
            }
            return newSheets;
          });

          setCloudStatus('synced');
        } else {
          setCloudStatus('idle');
        }

        // 2. Fetch placed orders for dropdown relation
        const cloudOrders = await getCollectionDocs('placed_orders').catch(() => []);
        const localOrders = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        const combinedOrders = [...cloudOrders, ...localOrders];
        const uniqueOrders = Array.from(new Map(combinedOrders.map(item => [item.id, item])).values());
        setPlacedOrders(uniqueOrders);
      } catch (err) {
        console.error('Failed to load logs and orders from Firestore', err);
        setCloudStatus('error');
      }
    }
    loadCloudAndOrders();
  }, []);

  useEffect(() => {
    const handleGotoArrival = () => {
      const targetBillRef = sessionStorage.getItem('goto_arrival_bill');
      if (targetBillRef) {
        const index = data.findIndex(row => row && String(row.billNo).trim() === String(targetBillRef).trim());
        if (index !== -1) {
          const billColIndex = COLS.findIndex(col => col.id === 'billNo');
          setActiveCell({ r: index, c: billColIndex !== -1 ? billColIndex : 8 });
          
          setTimeout(() => {
            const el = document.getElementById(`grid-row-${index}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }
        sessionStorage.removeItem('goto_arrival_bill');
      }
    };
    handleGotoArrival();
    window.addEventListener('goto-arrival-event', handleGotoArrival);
    return () => window.removeEventListener('goto-arrival-event', handleGotoArrival);
  }, [data]);

  const renderPendingDaysCell = useCallback((row: any) => {
    const status = row.noOfDayRec || 'Not Cleared';
    if (status === 'Cleared') {
      return (
        <span className="text-secondary/60 text-[10px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded leading-none">
          {calculatePendingDays(row)}
        </span>
      );
    }

    const numDays = getPendingDaysNum(row);

    if (numDays > 60) {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5 w-full py-0.5 select-none">
          <span className="w-full text-center px-1.5 py-1 bg-red-600 dark:bg-red-900 text-white dark:text-red-200 text-[9px] font-black uppercase rounded flex items-center justify-center gap-1 border border-red-500 animate-pulse leading-none shadow-sm shadow-red-500/10">
            🚨 COLLECT ({numDays}D)
          </span>
          <span className="text-[7.5px] font-black text-red-650 dark:text-red-400 text-center tracking-wider uppercase whitespace-nowrap leading-none mt-0.5">
            COMPULSORY DUE!
          </span>
        </div>
      );
    } else if (numDays > 36) { // 37 to 60 days
      return (
        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/45 text-red-700 dark:text-red-400 border border-red-200/40 dark:border-red-900/40 text-[10px] font-black rounded w-full text-center block leading-none">
          ⚠️ {numDays} Days
        </span>
      );
    } else if (numDays > 28) { // 29 to 36 days
      return (
        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-950/45 text-orange-700 dark:text-orange-400 border border-orange-200/40 text-[10px] font-black rounded w-full text-center block leading-none">
          ⚡ {numDays} Days
        </span>
      );
    } else if (numDays > 14) { // 15 to 28 days
      return (
        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-950/45 text-amber-700 dark:text-amber-400 border border-amber-250/20 dark:border-amber-900/30 text-[10px] font-black rounded w-full text-center block leading-none">
          ⏳ {numDays} Days
        </span>
      );
    } else { // 0 to 14 days
      return (
        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400 border border-emerald-250/20 dark:border-emerald-900/30 text-[10px] font-black rounded w-full text-center block leading-none">
          🌿 {numDays} Days
        </span>
      );
    }
  }, [calculatePendingDays, getPendingDaysNum]);

  // Auto-focus the grid container for seamless keyboard navigation on cell activation
  useEffect(() => {
    if (activeCell && !isEditing) {
      gridRef.current?.focus();
    }
  }, [activeCell, isEditing]);

  // Stats calculation based on updated columns
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let totalNetAmt = 0;
    let totalChqIssued = 0;
    
    data.forEach(row => {
      if (!row) return;
      totalQty += parseFloat(row.qty) || 0;
      totalAmount += parseFloat(row.amount) || 0;
      totalNetAmt += parseFloat(row.netAmt) || 0;
      totalChqIssued += parseFloat(row.chqAm) || 0;
    });
    return { totalQty, totalAmount, totalNetAmt, totalChqIssued };
  }, [data]);

  useEffect(() => {
    // Auto-sync to Firebase
    const timer = setTimeout(async () => {
      try {
        setCloudStatus('syncing');
        // Let's attach on-the-fly calculated pending days and ensure status and sheet info is filled
        const syncedData = data
          .filter(row => row && (row.partyName || row.millerName || row.billNo || row.qty || row.netAmt || row.buyer))
          .map((row, idx) => ({
            ...row,
            id: row.id || `row-${idx}`, // ensure standard ID
            sheetId: currentSheet.id,
            sheetName: currentSheet.name,
            noOfDays: calculatePendingDays(row),
            noOfDayRec: row.noOfDayRec || 'Not Cleared'
          }));
        if (syncedData.length > 0) {
          await syncCollection('arrival_entries', syncedData);
        }
        setCloudStatus('synced');
      } catch (err) {
        setCloudStatus('error');
        console.error('Firebase sync failed', err);
      }
    }, 2000); // 2s debounce to avoid over-syncing while typing

    return () => clearTimeout(timer);
  }, [data, currentSheet, calculatePendingDays]);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [data, ...prev].slice(0, 50));
  }, [data]);

  // Handle live math updates for spreadsheet columns
  const handleUpdateCell = (r: number, cId: string, val: any) => {
    const newData = [...data];
    const row = { ...newData[r], [cId]: val, lastUpdated: Date.now() };
    
    // Auto-fill Supplier Place if empty when millerName changes
    if (cId === 'millerName' && val) {
      if (!row.place || row.place.trim() === '') {
        if (MILLER_PLACES[val]) {
          row.place = MILLER_PLACES[val];
        }
      }
    }

    // Auto-fill Buyer Area if empty when partyName changes
    if (cId === 'partyName' && val) {
      if (!row.area || row.area.trim() === '') {
        if (BUYER_AREAS[val]) {
          row.area = BUYER_AREAS[val];
        }
      }
    }

    // Auto-calculate Amount (QTLS * Rate)
    if (cId === 'qty' || cId === 'rate') {
      const q = parseFloat(row.qty) || 0;
      const rt = parseFloat(row.rate) || 0;
      row.amount = (q * rt).toFixed(2);
    }

    // Auto-calculate Net Amt (R = L - M - N - O - P - Q - S)
    if (['qty', 'rate', 'amount', 'lh', 'cc', 'tds', 'shortage', 'diffIn', 'chqAm'].includes(cId)) {
      const amt = parseFloat(row.amount) || 0;
      const lhVal = parseFloat(row.lh) || 0;
      const ccVal = parseFloat(row.cc) || 0;
      const tdsVal = parseFloat(row.tds) || 0;
      const shortageVal = parseFloat(row.shortage) || 0;
      const diffInVal = parseFloat(row.diffIn) || 0;
      const chqAmVal = parseFloat(row.chqAm) || 0;
      row.netAmt = (amt - lhVal - ccVal - tdsVal - shortageVal - diffInVal - chqAmVal).toFixed(2);
    }

    // Auto-set payment status based on cheque fields
    if (['chqAm', 'chqNo', 'chqDt', 'bank'].includes(cId)) {
      const hasAnyPaymentDetail = 
        (row.chqAm && parseFloat(row.chqAm) > 0) ||
        (row.chqNo && String(row.chqNo).trim() !== '') ||
        (row.chqDt && String(row.chqDt).trim() !== '') ||
        (row.bank && String(row.bank).trim() !== '');
      if (hasAnyPaymentDetail) {
        row.noOfDayRec = 'Cleared';
      } else {
        row.noOfDayRec = 'Not Cleared';
      }
    }

    if (cId === 'noOfDayRec' && val === 'Not Cleared') {
      row.chqAm = '';
      row.chqNo = '';
      row.chqDt = '';
      row.bank = '';
    }

    newData[r] = row;
    setData(newData);
  };

  const openBillPhotoModal = useCallback((rowIndex: number) => {
    if (rowIndex >= 0 && data[rowIndex]) {
      setBillPhotoModalState({
        isOpen: true,
        rowIndex,
        row: data[rowIndex]
      });
    }
  }, [data]);

  const handleSaveBillPhoto = useCallback((photoDataUrl: string) => {
    const targetIdx = billPhotoModalState.rowIndex;
    if (targetIdx >= 0) {
      setData(prev => {
        const next = [...prev];
        if (next[targetIdx]) {
          next[targetIdx] = { 
            ...next[targetIdx], 
            billPhoto: photoDataUrl, 
            lastUpdated: Date.now() 
          };
        }
        return next;
      });
      setBillPhotoModalState(prev => ({
        ...prev,
        row: prev.row ? { ...prev.row, billPhoto: photoDataUrl } : null
      }));
      setManifestSuccessToast('Bill photo saved to entry!');
      setTimeout(() => setManifestSuccessToast(null), 3500);
    }
  }, [billPhotoModalState.rowIndex]);

  const handleRemoveBillPhotoDirect = useCallback((targetIdx: number) => {
    if (targetIdx >= 0) {
      setData(prev => {
        const next = [...prev];
        if (next[targetIdx]) {
          next[targetIdx] = { 
            ...next[targetIdx], 
            billPhoto: '', 
            lastUpdated: Date.now() 
          };
        }
        return next;
      });
      setBillPhotoModalState(prev => ({
        ...prev,
        row: prev.row ? { ...prev.row, billPhoto: '' } : null
      }));
      setManifestSuccessToast('Bill photo removed from entry.');
      setTimeout(() => setManifestSuccessToast(null), 3000);
    }
  }, []);

  const handleRemoveBillPhoto = useCallback(() => {
    const targetIdx = billPhotoModalState.rowIndex;
    handleRemoveBillPhotoDirect(targetIdx);
  }, [billPhotoModalState.rowIndex, handleRemoveBillPhotoDirect]);

  const startEditing = (r: number, c: number) => {
    if (!data[r] || !COLS[c]) return;
    const colId = COLS[c].id;
    if (colId === 'noOfDays') return; // Read-only dynamic calendar days pending
    if (colId === 'billPhoto') {
      openBillPhotoModal(r);
      return;
    }
    
    setActiveCell({ r, c });
    setIsEditing(true);
    let initialVal = data[r][colId];
    if (COLS[c].type === 'date' && initialVal) {
      const parsed = parseAnyDate(initialVal);
      if (parsed) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        initialVal = `${yyyy}-${mm}-${dd}`;
      }
    }
    setEditValue(initialVal !== undefined ? initialVal : (colId === 'noOfDayRec' ? 'Not Cleared' : ''));
    setPoFilterQuery(''); // Clear dropdown search
    setTimeout(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current.select) inputRef.current.select();
        }
    }, 10);
  };

  const stopEditing = (save: boolean = true) => {
    if (save && activeCell !== null && data[activeCell.r] && COLS[activeCell.c]) {
      handleUpdateCell(activeCell.r, COLS[activeCell.c].id, editValue);
    }
    setIsEditing(false);
  };

  const addRow = () => {
    saveToHistory();
    const defaultDate = getDefaultDateForSheet(currentSheet.name);
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setData([...data, { id: newId, date: defaultDate }]);
  };

  // Autocomplete auto-fill behavior for linked Purchase Orders
  const handleSelectPO = (po: any) => {
    if (!activeCell || !data[activeCell.r]) return;
    
    // Find sub-order representing buyer inside consolidated order
    const currentRow = data[activeCell.r];
    const rowParty = String(currentRow.partyName || '').toLowerCase().trim();
    
    let subOrder = po.originalOrders?.find((sub: any) => {
      const subB = String(sub.buyer || '').toLowerCase().trim();
      return rowParty && (subB.includes(rowParty) || rowParty.includes(subB));
    });

    if (!subOrder && po.originalOrders && po.originalOrders.length > 0) {
      subOrder = po.originalOrders[0];
    }

    const linkedMiller = subOrder?.supplier || po.origin || SUPPLIERS[0];
    const linkedParty = subOrder?.buyer || po.buyer || BUYERS[0];
    const linkedQty = subOrder?.qty || parseFloat(po.items?.match(/\d+(\.\d+)?/)?.[0]) || 100;
    const linkedRate = subOrder?.rate || 4200;

    const updatedRow = {
      ...currentRow,
      purchaseOrderNo: po.id,
      millerName: currentRow.millerName || linkedMiller,
      partyName: currentRow.partyName || linkedParty,
      qty: currentRow.qty && parseFloat(currentRow.qty) > 0 ? currentRow.qty : linkedQty,
      rate: currentRow.rate && parseFloat(currentRow.rate) > 0 ? currentRow.rate : linkedRate,
      lastUpdated: Date.now()
    };

    // Calculate secondary fields
    const finalQty = parseFloat(updatedRow.qty) || 0;
    const finalRate = parseFloat(updatedRow.rate) || 0;
    updatedRow.amount = (finalQty * finalRate).toFixed(2);

    const amt = parseFloat(updatedRow.amount) || 0;
    const lhVal = parseFloat(updatedRow.lh) || 0;
    const ccVal = parseFloat(updatedRow.cc) || 0;
    const tdsVal = parseFloat(updatedRow.tds) || 0;
    const shortageVal = parseFloat(updatedRow.shortage) || 0;
    const diffInVal = parseFloat(updatedRow.diffIn) || 0;
    const chqAmVal = parseFloat(updatedRow.chqAm) || 0;
    updatedRow.netAmt = (amt - lhVal - ccVal - tdsVal - shortageVal - diffInVal - chqAmVal).toFixed(2);

    const newData = [...data];
    newData[activeCell.r] = updatedRow;
    setData(newData);
    setIsEditing(false);
  };

  // Sophisticated heuristic matchmaking logic between incoming log row data and PO contracts
  const suggestedPOs = useMemo(() => {
    if (!activeCell || !isEditing) return [];
    const col = COLS[activeCell.c];
    if (!col || col.type !== 'po-select') return [];

    const currentRow = data[activeCell.r];
    if (!currentRow) return [];

    const rowMiller = String(currentRow.millerName || '').toLowerCase().trim();
    const rowParty = String(currentRow.partyName || '').toLowerCase().trim();
    const rowQty = parseFloat(currentRow.qty) || 0;

    return placedOrders.map(order => {
      let score = 0;
      const reasons: string[] = [];

      // match buyer/party Name
      const orderBuyer = String(order.buyer || '').toLowerCase().trim();
      const directBuyerMatch = orderBuyer && rowParty && (orderBuyer.includes(rowParty) || rowParty.includes(orderBuyer));
      const subBuyerMatch = order.originalOrders?.some((sub: any) => {
        const subB = String(sub.buyer || '').toLowerCase().trim();
        return rowParty && (subB.includes(rowParty) || rowParty.includes(subB));
      });

      if (directBuyerMatch || subBuyerMatch) {
         score += 50;
         reasons.push("Matching Party");
      }

      // match supplier / miller name
      const orderOrigin = String(order.origin || '').toLowerCase().trim();
      const originMatch = orderOrigin && rowMiller && (orderOrigin.includes(rowMiller) || rowMiller.includes(orderOrigin));
      const subSupplierMatch = order.originalOrders?.some((sub: any) => {
         const subS = String(sub.supplier || '').toLowerCase().trim();
         return rowMiller && (subS.includes(rowMiller) || rowMiller.includes(subS));
      });

      if (originMatch || subSupplierMatch) {
        score += 40;
        reasons.push("Matching Miller");
      }

      // match quantity (within 20% tolerance)
      const orderQtyText = String(order.items || '').match(/\d+(\.\d+)?/)?.[0] || order.totalQty || "0";
      const orderQty = parseFloat(orderQtyText) || 0;
      const qtyMatchDirect = rowQty > 0 && orderQty > 0 && Math.abs(rowQty - orderQty) / orderQty < 0.20;
      
      const qtyMatchSub = order.originalOrders?.some((sub: any) => {
        const subQ = parseFloat(sub.qty) || 0;
        return rowQty > 0 && subQ > 0 && Math.abs(rowQty - subQ) / subQ < 0.20;
      });

      if (qtyMatchDirect || qtyMatchSub) {
        score += 30;
        reasons.push("Qty Matched (~20%)");
      }

      return {
        order,
        score,
        reasons,
        qty: orderQty,
        buyer: order.buyer || "Consolidated",
        supplier: order.originalOrders?.[0]?.supplier || order.origin || "Consolidated Hub"
      };
    })
    .filter(item => {
      // If user is searching, filter by matching ID search as well
      if (poFilterQuery.trim()) {
        const orderId = item?.order?.id || '';
        return orderId.toLowerCase().includes(poFilterQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);
  }, [placedOrders, activeCell, data, poFilterQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;

    // Undo stack shortcut
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
      return;
    }

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        stopEditing();
        if (activeCell.r < data.length - 1) {
            setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
        } else {
            addRow();
            setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        stopEditing();
        if (e.shiftKey) {
            setActiveCell({ r: activeCell.r, c: Math.max(0, activeCell.c - 1) });
        } else {
            if (activeCell.c < COLS.length - 1) {
                setActiveCell({ r: activeCell.r, c: activeCell.c + 1 });
            } else if (activeCell.r < data.length - 1) {
                setActiveCell({ r: activeCell.r + 1, c: 0 });
            }
        }
      }
      if (e.key === 'Escape') stopEditing(false);
      return;
    }

    const { r, c } = activeCell;

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        const fIdx = filteredData.findIndex(row => row.id === data[r]?.id);
        if (fIdx > 0) {
          const prevRow = filteredData[fIdx - 1];
          const newRIdx = data.findIndex(row => row.id === prevRow.id);
          if (newRIdx !== -1) setActiveCell({ r: newRIdx, c });
        } else if (fIdx === -1 && r > 0) {
          setActiveCell({ r: r - 1, c });
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const fIdx = filteredData.findIndex(row => row.id === data[r]?.id);
        if (fIdx < filteredData.length - 1 && fIdx !== -1) {
          const nextRow = filteredData[fIdx + 1];
          const newRIdx = data.findIndex(row => row.id === nextRow.id);
          if (newRIdx !== -1) setActiveCell({ r: newRIdx, c });
        } else if (fIdx === -1 && r < data.length - 1) {
          setActiveCell({ r: r + 1, c });
        } else if (fIdx === filteredData.length - 1 && !hasActiveFilters && selectedMonth === 'all') {
          addRow();
          setActiveCell({ r: r + 1, c });
        }
        break;
      }
      case 'ArrowLeft':
        e.preventDefault();
        setActiveCell({ r, c: Math.max(0, c - 1) });
        break;
      case 'ArrowRight':
        e.preventDefault();
        setActiveCell({ r, c: Math.min(COLS.length - 1, c + 1) });
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          setActiveCell({ r, c: Math.max(0, c - 1) });
        } else {
          if (c < COLS.length - 1) {
            setActiveCell({ r, c: c + 1 });
          } else {
            if (r === data.length - 1) addRow();
            setActiveCell({ r: r + 1, c: 0 });
          }
        }
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        startEditing(r, c);
        break;
      case 'Backspace':
      case 'Delete':
        handleUpdateCell(r, COLS[c].id, '');
        break;
      default:
        // Start typing directly to edit
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEditing(r, c);
            setEditValue(e.key);
        }
        break;
    }
  };

  const clearSheet = () => {
    if (window.confirm('Clear all data from this entry?')) {
      saveToHistory();
      setData(Array(INITIAL_ROWS).fill(0).map(() => ({ date: new Date().toISOString().split('T')[0] })));
    }
  };

  const exportToExcel = () => {
    const preparedData = data
      .filter(row => Object.keys(row).length > 1)
      .map(row => {
        const orderInfo: Record<string, any> = {};
        COLS.forEach(col => {
          let val = row[col.id];
          if (col.id === 'noOfDays') {
            val = calculatePendingDays(row);
          } else if (col.id === 'noOfDayRec') {
            val = row.noOfDayRec || 'Not Cleared';
          } else if (col.id === 'place') {
            val = row.place || (row.millerName && MILLER_PLACES[row.millerName]) || '';
          } else if (col.id === 'area') {
            val = row.area || (row.partyName && BUYER_AREAS[row.partyName]) || '';
          } else if (col.id === 'billPhoto') {
            val = row.billPhoto ? 'Attached' : '';
          } else if (col.type === 'date' && val) {
            val = formatDateToDDMMYYYY(val);
          }

          if (val === undefined || val === '') {
            orderInfo[col.label] = undefined;
          } else if (col.id !== 'noOfDays' && (col.type === 'number' || col.type === 'calc')) {
            const num = parseFloat(val);
            orderInfo[col.label] = !isNaN(num) ? num : undefined;
          } else {
            orderInfo[col.label] = val;
          }
        });
        return orderInfo;
      });

    const worksheet = XLSX.utils.json_to_sheet(preparedData, { header: COLS.map(col => col.label) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Arrival_Audit");
    
    // Format the current date as DD-MM-YYYY for filename to be clean and safe
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    XLSX.writeFile(workbook, `Arrival_Log_${dd}-${mm}-${yyyy}.xlsx`);
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const dataBuffer = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
        
        if (rows.length === 0) {
          alert("The Excel file seems to be empty or has invalid data.");
          return;
        }
        
        // Map Excel columns to grid keys
        const mappedRows = rows.map((rawRow, idx) => {
          const gridRow: any = {
            id: `row-imported-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
          };
          
          COLS.forEach(col => {
            const aliases = COLUMN_ALIASES[col.id] || [];
            const matchedKey = Object.keys(rawRow).find(key => {
              const normKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              const normLabel = col.label.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              const normId = col.id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

              if (normKey === normLabel || normKey === normId) return true;
              if (aliases.some(a => a.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey)) return true;

              if (col.id === 'partyName' && (normKey.includes('buyer') || normKey.includes('party') || normKey.includes('customer') || normKey.includes('client'))) return true;
              if (col.id === 'millerName' && (normKey.includes('supplier') || normKey.includes('miller') || normKey.includes('seller') || normKey.includes('mill'))) return true;

              return false;
            });

            if (matchedKey !== undefined) {
              let val = rawRow[matchedKey];
              if (val !== null && val !== undefined) {
                val = String(val).trim();
              } else {
                val = '';
              }

              // Handle dates robustly
              if (col.type === 'date' && val) {
                if (typeof rawRow[matchedKey] === 'number') {
                  try {
                    const date = new Date((rawRow[matchedKey] - 25569) * 86400 * 1000);
                    if (!isNaN(date.getTime())) {
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, '0');
                      const dd = String(date.getDate()).padStart(2, '0');
                      val = `${yyyy}-${mm}-${dd}`;
                    }
                  } catch (err) {}
                } else {
                  const parsed = parseAnyDate(val);
                  if (parsed) {
                    const yyyy = parsed.getFullYear();
                    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                    const dd = String(parsed.getDate()).padStart(2, '0');
                    val = `${yyyy}-${mm}-${dd}`;
                  }
                }
              }

              // Handle numbers robustly (clean commas/currencies)
              if (col.type === 'number' && val !== '') {
                const num = parseFloat(String(val).replace(/[₹\s,]/g, ''));
                val = !isNaN(num) ? num : '';
              }

              gridRow[col.id] = val;
            } else {
              gridRow[col.id] = '';
            }
          });
          
          if (!gridRow.date) {
            gridRow.date = new Date().toISOString().split('T')[0];
          }
          
          if (!gridRow.noOfDayRec) {
            gridRow.noOfDayRec = 'Not Cleared';
          }

          // Ensure Supplier Place (place) and Buyer Area (area) are correctly differentiated
          if (!gridRow.place) {
            if (gridRow.millerName && MILLER_PLACES[gridRow.millerName]) {
              gridRow.place = MILLER_PLACES[gridRow.millerName];
            } else if (gridRow.area && ['MIRYALGUDA', 'SURYAPET', 'GADCHIROLI', 'GADCHIROLLI', 'NELLORE', 'NAGPUR'].includes(String(gridRow.area).toUpperCase())) {
              gridRow.place = gridRow.area;
            } else {
              gridRow.place = 'MIRYALGUDA';
            }
          }

          if (!gridRow.area) {
            if (gridRow.partyName && BUYER_AREAS[gridRow.partyName]) {
              gridRow.area = BUYER_AREAS[gridRow.partyName];
            } else {
              gridRow.area = '4TH BLOCK';
            }
          }
          
          return gridRow;
        });

        // Filter out completely empty rows
        const nonWordyRows = mappedRows.filter(row => {
          return Object.keys(row).some(key => {
            if (key === 'id' || key === 'date' || key === 'noOfDayRec') return false;
            return row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '';
          });
        });

        if (nonWordyRows.length === 0) {
          alert("Could not map any columns! Please make sure your Excel headers match either standard labels (e.g., 'DATE', 'SUPPLIER (MILLER)', 'BILL NO', etc.) or column IDs.");
          return;
        }

        const choice = window.confirm(
          `Found ${nonWordyRows.length} valid entries in Excel. \n\nClick OK to OVERWRITE the current sheet, or CANCEL to APPEND to the current sheet.`
        );

        saveToHistory();

        let finalGrid: any[];
        if (choice) {
          finalGrid = nonWordyRows;
        } else {
          // Append and filter out blank padding rows
          const existingRealRows = data.filter(row => {
            return Object.keys(row).some(key => {
              if (key === 'id' || key === 'date' || key === 'noOfDayRec') return false;
              return row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '';
            });
          });
          finalGrid = [...existingRealRows, ...nonWordyRows];
        }

        if (finalGrid.length < INITIAL_ROWS) {
          const diff = INITIAL_ROWS - finalGrid.length;
          const paddingRows = Array(diff).fill(0).map((_, i) => ({
            id: `row-padding-${Date.now()}-${i}`,
            date: new Date().toISOString().split('T')[0]
          }));
          finalGrid = [...finalGrid, ...paddingRows];
        }

        setData(finalGrid);
        
        if (event.target) {
          event.target.value = '';
        }

        alert(`Successfully imported ${nonWordyRows.length} records!`);
      } catch (err) {
        console.error(err);
        alert("Error parsing Excel file. Please ensure it is a valid format.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const undo = () => {
    if (history.length > 0) {
      const [last, ...rest] = history;
      setData(last);
      setHistory(rest);
    }
  };

  const getColLetter = (index: number) => {
    let letter = "";
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  const generateDueListPDF = () => {
    // 1. Filter out empty rows and rows that are "Cleared"
    let pendingRows = data.filter(row => {
      // Row must have at least some basic data (e.g. partyName or billNo or date) to be considered active
      const hasBasicData = row.partyName || row.millerName || row.billNo || row.qty;
      if (!hasBasicData) return false;
      
      const status = row.noOfDayRec || 'Not Cleared';
      return status !== 'Cleared';
    });

    // Apply buyer area filter if set
    if (selectedDueArea !== 'All') {
      pendingRows = pendingRows.filter(row => {
        return row.area && String(row.area).trim() === selectedDueArea;
      });
    }

    if (pendingRows.length === 0) {
      alert(selectedDueArea === 'All' 
        ? "No pending payments found in the ledger to generate a Due List." 
        : `No pending payments found in the ledger for Area: "${selectedDueArea}".`
      );
      return;
    }

    // 2. Sort them in ascending order of buyer name (partyName)
    const sortedPendingRows = [...pendingRows].sort((a, b) => {
      const nameA = String(a.partyName || '').trim().toUpperCase();
      const nameB = String(b.partyName || '').trim().toUpperCase();
      return nameA.localeCompare(nameB);
    });

    // 3. Initialize jsPDF (A4 Portrait)
    const doc = new jsPDF('p', 'mm', 'a4');
    const primaryColor = [147, 0, 11]; // Deep crimson

    // 4. Draw Header Branding Block
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 32, 'F'); // Portrait width is 210mm

    // Title text inside banner, aligned with narrow 6mm margin
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(
      selectedDueArea === 'All' 
        ? "DUE LIST - PENDING OUTSTANDINGS" 
        : `DUE LIST - PENDING OUTSTANDINGS (${selectedDueArea.toUpperCase()})`, 
      6, 
      13
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Active Trade Registry`, 6, 20);
    doc.text(`Total Records: ${sortedPendingRows.length} Pending Transactions${selectedDueArea !== 'All' ? ` for ${selectedDueArea}` : ''}`, 6, 26);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("CENTRAL HUB - EXECUTIVE REGISTER", 152, 11);

    // 5. Prepare Table Data (Removing any rupee symbols or prefixes as requested)
    const tableHeaders = [
      'Date', 
      'Buyer Name', 
      'Miller Name', 
      'Pending Days', 
      'Road (Area)', 
      'Bill No', 
      'Qtls', 
      'Rate', 
      'Amount', 
      'L.H.'
    ];

    const tableBody = sortedPendingRows.map(row => {
      let formattedDate = 'N/A';
      if (row.date) {
        let d: Date;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(row.date)) {
          const [dd, mm, yyyy] = String(row.date).split('/');
          d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
          const [yyyy, mm, dd] = String(row.date).split('-');
          d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        } else {
          d = new Date(row.date);
        }
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          formattedDate = `${dd}-${mm}-${yyyy}`;
        } else {
          formattedDate = String(row.date);
        }
      }
      const buyerName = row.partyName || 'N/A';
      const millerName = row.millerName || 'N/A';
      
      const numDays = getPendingDaysNum(row);
      const pendingDaysText = `${numDays} Days`;
      
      const area = row.area || 'N/A';
      let billNoVal = row.billNo ? String(row.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '') : 'N/A';
      if (!billNoVal) {
        billNoVal = 'N/A';
      }
      
      const qtls = row.qty ? `${parseFloat(row.qty).toFixed(2)}` : '0.00';
      const rate = row.rate ? `${formatINR(row.rate)}` : '0';
      
      const calculatedAmt = parseFloat(row.amount) || ((parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0)) || 0;
      const amount = `${formatINR(calculatedAmt)}`;
      
      const lh = row.lh ? `${formatINR(row.lh)}` : '0';

      return [
        formattedDate,
        buyerName,
        millerName,
        pendingDaysText,
        area,
        billNoVal,
        qtls,
        rate,
        amount,
        lh
      ];
    });

    // 6. Generate autoTable on the document
    autoTable(doc, {
      startY: 38,
      head: [tableHeaders],
      body: tableBody,
      theme: 'striped',
      headStyles: { 
        fillColor: '#93000b', 
        textColor: '#ffffff', 
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center'
      },
      styles: { 
        fontSize: 8.5,
        cellPadding: 1.2, // Tighter vertical padding for narrow row sizes
        valign: 'middle',
        overflow: 'ellipsize' // Prevent text wrapping, keep rows clean and single-line
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' }, // Date
        1: { cellWidth: 38, halign: 'left', fontStyle: 'bold' },   // Buyer Name
        2: { cellWidth: 29, halign: 'left' },   // Miller Name
        3: { cellWidth: 14, halign: 'center' }, // Pending Days
        4: { cellWidth: 16, halign: 'left' },   // Road (Area) (Reduced width as requested)
        5: { cellWidth: 11, halign: 'center' }, // Bill No
        6: { cellWidth: 11, halign: 'right' },  // Qtls
        7: { cellWidth: 14, halign: 'right' },  // Rate
        8: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },  // Amount
        9: { cellWidth: 20, halign: 'right' }   // L.H. (Increased width so values are beautifully visible)
      },
      margin: { left: 6, right: 6 } // Narrow margins
    });

    // 7. Save Document
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const fileSuffix = selectedDueArea === 'All' ? '' : `_${selectedDueArea.replace(/[^a-zA-Z0-9]/g, '_')}`;
    doc.save(`Due_List_${dd}-${mm}-${yyyy}${fileSuffix}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col bg-surface-container-lowest font-sans relative">
      {/* Toast Notification for Manifest Scanned Successfully */}
      <AnimatePresence>
        {manifestSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 text-xs font-bold"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span>{manifestSuccessToast}</span>
            <button
              onClick={() => setManifestSuccessToast(null)}
              className="ml-2 text-white/70 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Excel Header Panel */}
      <div className="bg-surface p-4 border-b border-outline-variant flex flex-wrap items-center justify-between gap-3 shadow-sm z-30">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-on-surface">Arrival Entry Ledger</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest text-secondary font-black opacity-60">High-Speed Procurement Logging</p>
                {cloudStatus === 'syncing' ? (
                  <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Syncing Cloud...
                  </span>
                ) : (
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </div>

          <div className="h-10 w-px bg-outline-variant/30 hidden lg:block" />

          {/* Ribbon buttons */}
          <div className="flex items-center gap-1 p-1 bg-surface-container-low border border-outline-variant/30 rounded-xl">
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 hover:bg-surface-container-high rounded-lg text-secondary disabled:opacity-30 transition-all flex items-center gap-1"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
              <span className="text-[10px] font-bold">Undo</span>
            </button>
            <button 
              onClick={clearSheet}
              className="p-2 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg text-secondary transition-all flex items-center gap-1"
              title="Clear Sheet"
            >
              <Eraser className="w-4 h-4" />
              <span className="text-[10px] font-bold">Clear</span>
            </button>
            <button 
              onClick={forceReseedDemoData}
              className="p-2 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg text-secondary transition-all flex items-center gap-1"
              title="Preload 155 Seed Entries"
            >
              <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600">Seed 155 Rows</span>
            </button>
            <div className="w-px h-4 bg-outline-variant mx-1" />
            <button 
              onClick={addRow}
              className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg text-secondary transition-all flex items-center gap-1"
              title="Add Row"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[10px] font-bold">Add Row</span>
            </button>
            <div className="w-px h-4 bg-outline-variant mx-1" />
            <button 
              onClick={() => setIsManifestScannerOpen(true)}
              className="p-2 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg text-secondary transition-all flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/5 shadow-xs"
              title="Scan Paper Manifest / Bilty with Device Camera"
            >
              <Camera className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Scan Paper</span>
            </button>
            <div className="w-px h-4 bg-outline-variant mx-1" />
            <button 
              onClick={() => handleSortByDate()}
              className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg text-secondary transition-all flex items-center gap-1 border border-primary/20 bg-primary/5 shadow-sm"
              title="Sort Entries by Date"
            >
              <ArrowUpDown className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase text-primary">
                Sort Date {dateSortOrder === 'desc' ? '↓' : '↑'}
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic running statistics indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2 gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest leading-none">Total Weight</span>
              <span className="text-sm font-black text-primary">{stats.totalQty.toFixed(2)} QTLS</span>
            </div>
            <div className="w-px h-6 bg-outline-variant/50" />
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest leading-none">Total Net Due</span>
              <span className="text-sm font-black text-emerald-600">₹ {formatINR(stats.totalNetAmt)}</span>
            </div>
          </div>

          {/* Month Selector Dropdown */}
          <div className="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-1.5 gap-2">
            <span className="text-[9px] font-black text-secondary uppercase tracking-widest pl-1">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-on-surface outline-none border-none p-0 cursor-pointer max-w-[140px] truncate focus:ring-0 focus:outline-none"
            >
              <option value="all" className="bg-surface text-on-surface">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-surface text-on-surface">
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Buyer Area Filter Dropdown */}
          <div className="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-1.5 gap-2">
            <span className="text-[9px] font-black text-secondary uppercase tracking-widest pl-1">Due Area:</span>
            <select
              value={selectedDueArea}
              onChange={(e) => setSelectedDueArea(e.target.value)}
              className="bg-transparent text-xs font-bold text-on-surface outline-none border-none p-0 cursor-pointer max-w-[140px] truncate focus:ring-0 focus:outline-none"
            >
              {uniqueAreas.map(area => (
                <option key={area} value={area} className="bg-surface text-on-surface">
                  {area}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={generateDueListPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-800 shadow-lg shadow-red-700/20 active:scale-95 transition-all"
          >
            <FileText className="w-4 h-4" />
            Due List PDF
          </button>

          <button 
            id="scan-manifest-camera-btn"
            onClick={() => setIsManifestScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all border border-emerald-400/30 ring-2 ring-emerald-500/20"
            title="Scan paper manifests or bilty slips using device camera"
          >
            <Camera className="w-4 h-4 text-emerald-100 animate-pulse" />
            Scan Manifest
          </button>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Export XLS
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            title="Import Excel/CSV ledger file directly"
          >
            <Upload className="w-4 h-4" />
            Import XLS
          </button>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
        </div>
      </div>

      {/* Syncing Loading Animation Bar */}
      <AnimatePresence>
        {cloudStatus === 'syncing' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '4px' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full bg-amber-500/20 overflow-hidden relative z-40"
          >
            <motion.div
              className="h-full bg-amber-500 shadow-sm shadow-amber-500/50"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spreadsheet Formula Bar */}
      <div className="bg-surface-container-low border-b border-outline-variant px-4 py-2 flex items-center gap-4 text-xs">
        <div className="w-16 h-8 bg-surface border border-primary/20 rounded-lg flex items-center justify-center font-mono font-black text-primary shadow-sm">
          {activeCell ? `${getColLetter(activeCell.c)}${activeCell.r + 1}` : '--'}
        </div>
        <div className="w-6 h-8 flex items-center justify-center text-secondary opacity-40">
          <Keyboard className="w-4 h-4" />
        </div>
        <div className="flex-1 h-8 bg-surface rounded-xl flex items-center px-4 font-bold text-on-surface border border-outline-variant shadow-inner overflow-hidden relative group">
          <div className="absolute left-0 inset-y-0 w-1 bg-primary/20" />
          {activeCell && !isEditing && (
            <span className="opacity-80 italic text-secondary">
              {data[activeCell.r] && COLS[activeCell.c]
                ? COLS[activeCell.c].id === 'billPhoto'
                  ? data[activeCell.r].billPhoto
                    ? '📷 [Bill Photo Attached - Press Enter or double-click to view]'
                    : '(No Bill Photo - Press Enter or double-click to add)'
                  : data[activeCell.r][COLS[activeCell.c].id] || '(Empty Cell)'
                : '(Empty Cell)'}
            </span>
          )}
          {isEditing && (
            <input 
              ref={formulaInputRef}
              className="w-full bg-transparent outline-none py-1 text-primary"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') stopEditing();
                if (e.key === 'Escape') stopEditing(false);
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10">
          <ArrowRight className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-black uppercase tracking-widest text-primary">Live Buffer: 12ms</span>
        </div>
      </div>

      {/* Dynamic Sync Top Scrollbar for Seamless Horizontal Navigation */}
      <div 
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden bg-neutral-100 dark:bg-neutral-900 border-b border-outline-variant/60 scrollbar-thin scrollbar-thumb-outline-variant select-none shrink-0"
        style={{ height: '11px' }}
        onScroll={handleTopScroll}
      >
        <div style={{ width: `${totalTableWidth}px`, height: '1px' }} />
      </div>



      {/* Main Grid Container */}
      <div 
        ref={gridRef}
        className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900 focus:outline-none scrollbar-thin scrollbar-thumb-outline-variant"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleGridScroll}
      >
        <table className="border-collapse table-fixed bg-surface select-none min-w-max">
          <thead>
            <tr className="sticky top-0 z-20">
              <th className="w-10 h-10 bg-surface-container-highest border-r border-b border-outline-variant text-[10px] font-bold text-secondary uppercase flex items-center justify-center sticky left-0 z-30">
                <TableIcon className="w-3 h-3" />
              </th>
              {COLS.map((col, idx) => {
                const isOpen = openFilterColId === col.id;
                const isFiltered = columnFilters[col.id] && columnFilters[col.id].length > 0;
                const uniqueValues = isOpen ? getUniqueColValues(col.id) : [];
                const filteredUniqueValues = isOpen ? uniqueValues.filter(val => 
                  String(val ?? '').toLowerCase().includes(String(filterSearch ?? '').toLowerCase())
                ) : [];

                return (
                  <th 
                    key={col.id}
                    style={{ width: col.width }}
                    className={cn(
                      "h-12 border-r border-b border-outline-variant text-[10px] font-black text-secondary uppercase tracking-widest relative px-2 transition-colors",
                      activeCell?.c === idx ? "bg-primary/5 text-primary" : "bg-surface-container-highest"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 h-full w-full">
                      <div className="flex flex-col items-start truncate text-left pl-2 flex-1">
                        <span className="text-[8px] font-bold opacity-40">{getColLetter(idx)}</span>
                        <span className="text-[10px] font-black truncate">{col.label}</span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOpen) {
                            setOpenFilterColId(null);
                          } else {
                            setOpenFilterColId(col.id);
                            setFilterSearch('');
                          }
                        }}
                        className={cn(
                          "p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center relative",
                          isFiltered ? "text-emerald-600 font-bold bg-emerald-500/10" : "text-secondary/60 hover:text-secondary"
                        )}
                        title="Filter Column"
                      >
                        <Filter className="w-3 h-3" />
                        {isFiltered && (
                          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        )}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className={cn(
                            "absolute top-11 bg-surface border border-outline-variant rounded-xl shadow-2xl z-50 p-3 w-64 max-w-[calc(100vw-32px)] text-left font-normal normal-case tracking-normal text-on-surface",
                            idx < 3 ? "left-0" : "right-0"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/30">
                            <span className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-1">
                              <Filter className="w-3 h-3 text-primary" /> Filter {col.label}
                            </span>
                            {isFiltered && (
                              <button
                                onClick={() => handleClearColFilter(col.id)}
                                className="text-[9px] font-bold text-rose-500 hover:underline uppercase"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary/50" />
                            <input
                              type="text"
                              placeholder="Search values..."
                              value={filterSearch}
                              onChange={(e) => setFilterSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40 text-primary"
                            />
                          </div>

                          <div className="flex gap-2 mb-2 text-[9px] font-bold text-primary uppercase">
                            <button
                              onClick={() => {
                                setColumnFilters(prev => ({
                                  ...prev,
                                  [col.id]: uniqueValues
                                }));
                              }}
                              className="hover:underline text-[9px]"
                            >
                              Select All
                            </button>
                            <span className="opacity-35">|</span>
                            <button
                              onClick={() => {
                                setColumnFilters(prev => {
                                  const next = { ...prev };
                                  delete next[col.id];
                                  return next;
                                });
                              }}
                              className="hover:underline text-rose-500 text-[9px]"
                            >
                              Clear All
                            </button>
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-outline-variant pr-1">
                            {filteredUniqueValues.length === 0 ? (
                              <div className="text-[10px] text-secondary/60 text-center py-2">No matching values</div>
                            ) : (
                              filteredUniqueValues.map(val => {
                                const activeVals = columnFilters[col.id] || [];
                                const isChecked = activeVals.includes(val);
                                return (
                                  <label key={val} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setColumnFilters(prev => {
                                          const current = prev[col.id] || [];
                                          const next = current.includes(val)
                                            ? current.filter(v => v !== val)
                                            : [...current, val];
                                          
                                          const updated = { ...prev };
                                          if (next.length === 0) {
                                            delete updated[col.id];
                                          } else {
                                            updated[col.id] = next;
                                          }
                                          return updated;
                                        });
                                      }}
                                      className="rounded border-outline-variant text-primary focus:ring-primary/20 w-3.5 h-3.5"
                                    />
                                    <span className="text-xs font-medium text-secondary truncate" title={val}>
                                      {col.type === 'date' ? formatDateToDDMMYYYY(val) : val}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>

                          <div className="pt-2 mt-2 border-t border-outline-variant/30 flex justify-end">
                            <button
                              onClick={() => setOpenFilterColId(null)}
                              className="px-2.5 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-lg hover:bg-primary-hover uppercase tracking-widest transition-all"
                            >
                              OK
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filteredData.map((row, fIdx) => {
              const rIdx = data.indexOf(row) !== -1 ? data.indexOf(row) : fIdx;
              const rowKey = `${row.id ? `${row.id}-` : ''}f${fIdx}-r${rIdx}`;
              return (
                <tr id={`grid-row-${rIdx}`} key={rowKey} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className={cn(
                    "w-10 h-10 border-r border-b border-outline-variant text-[10px] font-mono font-black flex items-center justify-center sticky left-0 z-10 transition-colors",
                    activeCell?.r === rIdx ? "bg-primary text-on-primary" : "bg-surface-container-high text-secondary"
                  )}>
                    {rIdx + 1}
                  </td>
                  
                  {COLS.map((col, cIdx) => {
                    const isActive = activeCell?.r === rIdx && activeCell?.c === cIdx;
                    return (
                      <td 
                        key={col.id}
                        onClick={() => {
                          setActiveCell({ r: rIdx, c: cIdx });
                          gridRef.current?.focus();
                        }}
                        onDoubleClick={() => startEditing(rIdx, cIdx)}
                        className={cn(
                          "h-10 border-r border-b border-outline-variant p-0 relative transition-all duration-75",
                          isActive ? "ring-2 ring-primary ring-inset z-10 bg-primary/[0.03]" : "",
                          col.type === 'calc' && "bg-neutral-50 dark:bg-neutral-800/30 font-mono italic"
                        )}
                      >
                        <div className={cn(
                          "w-full h-full px-4 flex items-center text-xs truncate font-bold",
                          col.type === 'number' || col.type === 'calc' ? "justify-end text-right font-mono" : "justify-start text-on-surface",
                          isActive && "text-primary"
                        )}>
                          {col.id === 'noOfDays' ? (
                            renderPendingDaysCell(row)
                          ) : col.id === 'noOfDayRec' ? (
                            getPaymentStatus(row)
                          ) : col.id === 'billPhoto' ? (
                            row.billPhoto ? (
                              <div className="flex items-center gap-1 w-full justify-center group/photocell">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBillPhotoModal(rIdx);
                                  }}
                                  className="group/photo relative flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer transition-all shadow-2xs"
                                  title="View or edit Bill Photo"
                                >
                                  <img 
                                    src={row.billPhoto} 
                                    alt="Bill Thumbnail" 
                                    className="w-5 h-5 object-cover rounded shadow-2xs border border-emerald-500/40 shrink-0" 
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-tight">
                                    Bill
                                  </span>
                                  <Eye className="w-3 h-3 opacity-70 group-hover/photo:opacity-100 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveBillPhotoDirect(rIdx);
                                  }}
                                  className="opacity-0 group-hover/photocell:opacity-100 p-1 text-secondary/60 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title="Remove bill photo from row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center w-full">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBillPhotoModal(rIdx);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-bold text-secondary/60 hover:text-primary hover:bg-primary/10 border border-dashed border-outline-variant/70 hover:border-primary/50 transition-all cursor-pointer"
                                  title="Upload or attach Bill Document"
                                >
                                  <Upload className="w-3 h-3 text-secondary/60 group-hover:text-primary" />
                                  <span>+ Bill</span>
                                </button>
                              </div>
                            )
                          ) : col.type === 'calc' && row[col.id] ? (
                            (col.id === 'netAmt' || col.id === 'amount') ? `₹ ${formatINR(row[col.id])}` : row[col.id]
                          ) : col.type === 'date' ? (
                            formatDateToDDMMYYYY(row[col.id])
                          ) : (
                            row[col.id]
                          )}
                          {col.type === 'number' && row[col.id] && col.id === 'qty' && <span className="ml-1 text-[8px] opacity-40">QT</span>}
                        </div>

                        {isActive && isEditing && (
                          <div className="absolute inset-0 z-25">
                            {col.type === 'select' ? (
                              <div className="w-full h-full bg-surface shadow-2xl relative">
                                 <select 
                                   ref={inputRef}
                                   className="w-full h-full bg-transparent px-3 text-xs font-bold outline-none border-none focus:ring-0 appearance-none text-primary"
                                   value={editValue}
                                   onChange={(e) => {
                                     const val = e.target.value;
                                     setEditValue(val);
                                     handleUpdateCell(activeCell!.r, COLS[activeCell!.c].id, val);
                                     setIsEditing(false);
                                   }}
                                   onBlur={() => stopEditing()}
                                   onKeyDown={(e) => {
                                     if (e.key === 'Enter' || e.key === 'Tab') stopEditing();
                                     if (e.key === 'Escape') stopEditing(false);
                                     e.stopPropagation();
                                   }}
                                 >
                                   <option value="">-- Select --</option>
                                   {(() => {
                                     let baseOptions: string[] = col.options || [];
                                     if (col.id === 'millerName') {
                                       baseOptions = dynamicSuppliers;
                                     } else if (col.id === 'partyName') {
                                       baseOptions = dynamicBuyers;
                                     } else if (col.id === 'brand') {
                                       const rowMiller = (row.millerName || '').trim().toUpperCase();
                                       if (rowMiller) {
                                         const matchedBrands = inventoryProducts
                                           .filter(p => {
                                             if (!p || !p.supplier) return false;
                                             const sup = p.supplier.trim().toUpperCase();
                                             return sup === rowMiller || (rowMiller.length > 6 && sup.includes(rowMiller)) || (sup.length > 6 && rowMiller.includes(sup));
                                           })
                                           .map(p => p.name?.trim())
                                           .filter(Boolean);
                                         
                                         if (matchedBrands.length > 0) {
                                           baseOptions = Array.from(new Set(matchedBrands));
                                         } else if (rowMiller.includes('ANNAPURNA')) {
                                           baseOptions = ['KESHAR KALI', '1121 Sella Rice', 'Sona Masoori (Old)', 'Organic Brown Rice'];
                                         } else {
                                           baseOptions = [];
                                         }
                                       } else {
                                         const allInvBrands = inventoryProducts.map(p => p.name?.trim()).filter(Boolean);
                                         baseOptions = allInvBrands.length > 0 ? Array.from(new Set(allInvBrands)) : BRANDS;
                                       }
                                     }

                                     const optsSet = new Set<string>(baseOptions);
                                     if (editValue && typeof editValue === 'string' && editValue.trim()) {
                                       optsSet.add(editValue.trim());
                                     }
                                     if (row[col.id] && typeof row[col.id] === 'string' && row[col.id].trim()) {
                                       optsSet.add(row[col.id].trim());
                                     }
                                     return Array.from(optsSet).map(opt => (
                                       <option key={opt} value={opt}>{opt}</option>
                                     ));
                                   })()}
                                 </select>
                                 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-primary pointer-events-none" />
                              </div>
                            ) : col.type === 'po-select' ? (
                              /* Smart Relation Matching Dropdown for Purchase Orders */
                              <div className="absolute top-0 left-0 bg-surface shadow-2xl rounded-2xl border border-outline-variant z-50 p-3 flex flex-col w-[360px] max-h-80 overflow-hidden group">
                                <div className="flex items-center gap-2 pb-2 mb-2 border-b border-outline-variant/30">
                                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                <span className="text-[10px] uppercase font-black tracking-wider text-secondary">Relation-Matched POs</span>
                              </div>
                              
                              {/* Integrated search inside dropdown view */}
                              <div className="relative mb-2">
                                <input 
                                  ref={inputRef}
                                  type="text"
                                  placeholder="Search by Contract ID..."
                                  value={poFilterQuery}
                                  onChange={(e) => setPoFilterQuery(e.target.value)}
                                  className="w-full bg-surface-container pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-outline-variant/50 outline-none text-on-surface"
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                                <Search className="w-3.5 h-3.5 text-secondary absolute left-2 top-1/2 -translate-y-1/2" />
                              </div>

                              <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                                {suggestedPOs.length === 0 ? (
                                  <div className="text-[10px] text-center text-secondary py-6 font-semibold">
                                    No matching active PO contracts found.
                                  </div>
                                ) : (
                                  suggestedPOs.map((item) => {
                                    const isTopMatch = item.score >= 80;
                                    return (
                                      <div
                                        key={item.order.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault(); // Prevents instant blur of input
                                          handleSelectPO(item.order);
                                        }}
                                        className={cn(
                                          "p-2.5 rounded-xl cursor-pointer flex flex-col gap-1 transition-all text-left",
                                          isTopMatch 
                                            ? "bg-primary/[0.04] hover:bg-primary/[0.09] border border-primary/20" 
                                            : "hover:bg-on-background/5 border border-transparent"
                                        )}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono text-[11px] font-black text-primary flex items-center gap-1.5">
                                            <Link className="w-3 h-3 text-secondary" />
                                            {item.order.id}
                                          </span>
                                          {isTopMatch ? (
                                            <span className="text-[8px] font-black tracking-widest leading-none bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded uppercase">
                                              ⭐ Match {item.score}%
                                            </span>
                                          ) : (
                                            <span className="text-[8px] font-bold text-secondary">
                                              Match {item.score}%
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[9px] font-semibold text-secondary leading-tight truncate">
                                          {item.supplier} ➔ {item.buyer}
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[9px] text-secondary mt-1 font-bold">
                                          <span>Qty: {item.qty} QTLS</span>
                                          {item.reasons.length > 0 && (
                                            <span className="text-[8px] text-primary/80">
                                              ({item.reasons.join(', ')})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              <div className="pt-2 mt-2 border-t border-outline-variant/30 flex justify-end">
                                <button 
                                  onMouseDown={(e) => { e.preventDefault(); stopEditing(false); }}
                                  className="text-[9px] font-black uppercase text-secondary hover:text-primary pr-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <input 
                              ref={inputRef}
                              type={col.type === 'date' ? 'date' : 'text'}
                              className="w-full h-full bg-surface px-4 text-xs font-bold outline-none border-none focus:ring-0 shadow-2xl text-primary"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => stopEditing()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  e.preventDefault();
                                  stopEditing(true);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  stopEditing(false);
                                }
                                e.stopPropagation();
                              }}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Excel Sheet Tab Bar */}
      <div className="h-10 bg-neutral-100 dark:bg-neutral-900 border-t border-outline-variant px-4 flex items-center justify-between select-none shrink-0 z-30">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {sheets.map(sheet => {
            const isSelected = sheet.id === currentSheetId;
            const isEditingThisSheet = editingSheetId === sheet.id;
            return (
              <div 
                key={sheet.id}
                onClick={() => {
                  setCurrentSheetId(sheet.id);
                  setActiveCell({ r: 0, c: 1 });
                  setIsEditing(false);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingSheetId(sheet.id);
                  setEditingSheetName(sheet.name);
                }}
                className={cn(
                  "h-8 px-3 rounded-t-lg border-x border-t flex items-center gap-2 cursor-pointer text-xs font-bold transition-all relative select-none group",
                  isSelected 
                    ? "bg-surface text-primary border-outline-variant font-black z-10 -mb-[5px] shadow-sm" 
                    : "bg-neutral-200 dark:bg-neutral-800 text-secondary border-transparent hover:bg-neutral-150 dark:hover:bg-neutral-750"
                )}
              >
                {isEditingThisSheet ? (
                  <input
                    type="text"
                    value={editingSheetName}
                    onChange={(e) => setEditingSheetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRenameSheet(sheet.id);
                      if (e.key === 'Escape') setEditingSheetId(null);
                    }}
                    onBlur={() => handleSaveRenameSheet(sheet.id)}
                    autoFocus
                    className="w-24 px-1 py-0.5 text-xs font-bold bg-surface border border-primary rounded focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className={cn("w-3.5 h-3.5", isSelected ? "text-primary" : "text-secondary/50")} />
                    <span>{sheet.name}</span>
                  </span>
                )}

                {!isEditingThisSheet && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSheetId(sheet.id);
                      setEditingSheetName(sheet.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-secondary hover:text-primary transition-opacity"
                    title="Rename Sheet (or double click)"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}

                {sheets.length > 1 && !isEditingThisSheet && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetToDelete(sheet);
                    }}
                    className="p-0.5 rounded-full hover:bg-rose-500/10 text-secondary/40 hover:text-rose-600 transition-colors text-[10px] font-black w-4 h-4 flex items-center justify-center"
                    title="Delete Sheet"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          
          <button
            onClick={handleOpenAddSheetModal}
            className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all flex items-center gap-1 text-xs font-bold px-2.5 ml-1"
            title="Create New Sheet"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sheet</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-secondary/60 italic font-medium">Double click tab to rename • Click + Add Sheet to create ledger</span>
        </div>
      </div>

      {/* Footer / Excel Style Status Bar */}
      <div className="h-10 bg-surface-container border-t border-outline-variant px-6 flex items-center justify-between text-[10px] font-black text-secondary uppercase tracking-[0.1em]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span>Operational Hub Ready</span>
          </div>
          <div className="w-px h-4 bg-outline-variant/50" />
          <div className="flex gap-4">
             <span>Rows: <span className="text-on-surface">{data.length}</span></span>
             <span>Cols: <span className="text-on-surface">{COLS.length}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-8">
           <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-lg">
              <span className="opacity-50">SUM(AMT):</span>
              <span className="text-primary">₹ {formatINR(stats.totalAmount)}</span>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-lg">
              <span className="opacity-50">SUM(NET):</span>
              <span className="text-emerald-600">₹ {formatINR(stats.totalNetAmt)}</span>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-lg">
              <span className="opacity-50">CHQS:</span>
              <span className="text-indigo-600">₹ {formatINR(stats.totalChqIssued)}</span>
           </div>
           
           <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                cloudStatus === 'synced' && "bg-emerald-500",
                cloudStatus === 'syncing' && "bg-amber-500 animate-pulse",
                cloudStatus === 'error' && "bg-red-500 animate-bounce",
                cloudStatus === 'idle' && "bg-gray-400"
              )} />
              <span className={cn(
                "font-black tracking-widest uppercase flex items-center gap-1.5",
                cloudStatus === 'synced' && "text-emerald-600",
                cloudStatus === 'syncing' && "text-amber-600 font-bold",
                cloudStatus === 'error' && "text-red-500",
                cloudStatus === 'idle' && "text-gray-500"
              )}>
                {cloudStatus === 'synced' && "Cloud Storage Synced"}
                {cloudStatus === 'syncing' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600 inline" />
                    <span>Syncing Live Entry Data...</span>
                  </>
                )}
                {cloudStatus === 'error' && "Cloud Sync Error"}
                {cloudStatus === 'idle' && "Ready (Offline Failsafe)"}
              </span>
           </div>
        </div>
      </div>

      {/* Create New Sheet Modal */}
      <AnimatePresence>
        {isAddSheetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline-variant rounded-2xl shadow-2xl p-6 w-full max-w-md text-on-surface"
            >
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base tracking-tight">Create New Sheet</h3>
                    <p className="text-[10px] text-secondary font-medium">Add a month-wise ledger or custom sheet</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddSheetModalOpen(false)}
                  className="text-secondary hover:text-on-surface p-1 rounded-lg text-lg font-bold"
                >
                  ×
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleConfirmCreateSheet(); }}>
                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCreateSheetMode('month')}
                    className={cn(
                      "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                      createSheetMode === 'month' 
                        ? "bg-surface text-primary shadow-sm" 
                        : "text-secondary hover:text-on-surface"
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Month Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateSheetMode('custom')}
                    className={cn(
                      "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                      createSheetMode === 'custom' 
                        ? "bg-surface text-primary shadow-sm" 
                        : "text-secondary hover:text-on-surface"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Custom Name
                  </button>
                </div>

                {createSheetMode === 'month' ? (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">
                        Select Month & Year
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={selectedSheetMonth}
                          onChange={(e) => setSelectedSheetMonth(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          {MONTH_NAMES.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={selectedSheetYear}
                          onChange={(e) => setSelectedSheetYear(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          {['2025', '2026', '2027', '2028'].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs">
                      <div className="font-bold text-primary flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Generated Sheet Title: <span className="underline font-black">{selectedSheetMonth} {selectedSheetYear}</span>
                      </div>
                      <p className="text-[11px] text-secondary">
                        All new entries added to this sheet will default to dates in {selectedSheetMonth} {selectedSheetYear}.
                      </p>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-all">
                      <input
                        type="checkbox"
                        checked={copyMainEntriesForMonth}
                        onChange={(e) => setCopyMainEntriesForMonth(e.target.checked)}
                        className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-on-surface block">Extract {selectedSheetMonth} {selectedSheetYear} entries from Main Sheet</span>
                        <span className="text-[10px] text-secondary">Copies any existing arrival entries for this month into this sheet while keeping main entries intact.</span>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                      Sheet Name
                    </label>
                    <input
                      type="text"
                      value={newSheetInputName}
                      onChange={(e) => setNewSheetInputName(e.target.value)}
                      placeholder="e.g. Mill 2 Procurement, Special Consignment..."
                      autoFocus
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-100 dark:bg-neutral-800 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setIsAddSheetModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Create Sheet
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Sheet Confirmation Modal */}
      <AnimatePresence>
        {sheetToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline-variant rounded-2xl shadow-2xl p-6 w-full max-w-md text-on-surface"
            >
              <div className="flex items-center gap-2.5 text-rose-600 mb-3">
                <div className="p-2 rounded-xl bg-rose-500/10">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">Delete Sheet</h3>
                  <p className="text-[10px] text-secondary font-medium">Permanent action</p>
                </div>
              </div>
              <p className="text-xs text-secondary mb-6 leading-relaxed">
                Are you sure you want to delete <span className="font-black text-on-surface">"{sheetToDelete.name}"</span>? All local entry rows on this sheet will be deleted.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setSheetToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteSheet}
                  className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all"
                >
                  Delete Sheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paper Manifest Camera Scanner & AI Parser Modal */}
      <ManifestCameraScanner
        isOpen={isManifestScannerOpen}
        onClose={() => setIsManifestScannerOpen(false)}
        onApply={handleApplyManifest}
        hasSelectedRow={!!activeCell && activeCell.r >= 0}
        selectedRowIndex={activeCell?.r}
        knownSuppliers={dynamicSuppliers}
        knownBuyers={dynamicBuyers}
        knownBrands={BRANDS}
      />

      {/* Bill Photo View, Capture & Management Modal */}
      <BillPhotoModal
        isOpen={billPhotoModalState.isOpen}
        onClose={() => setBillPhotoModalState(prev => ({ ...prev, isOpen: false }))}
        row={billPhotoModalState.row}
        rowIndex={billPhotoModalState.rowIndex}
        onSavePhoto={handleSaveBillPhoto}
        onRemovePhoto={handleRemoveBillPhoto}
      />
    </div>
  );
}
