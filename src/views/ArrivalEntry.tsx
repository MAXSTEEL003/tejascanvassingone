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
  Redo2,
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
  X,
  Columns3,
  SlidersHorizontal,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getRegisteredSuppliers, sanitizeSupplierName } from '../lib/utils';
import { getCollectionDocs, db } from '../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ManifestCameraScanner, { ParsedManifestData } from '../components/ManifestCameraScanner';
import BillPhotoModal from '../components/BillPhotoModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ColumnVisibilityModal from '../components/ColumnVisibilityModal';
import { 
  COLS_ORDER, 
  getColLetter, 
  getColIndexFromLetter, 
  isFormula, 
  evaluateFormula, 
  shiftFormula, 
  recalculateRowBusinessLogic 
} from '../utils/formulaEngine';

// Preset lists matching entities in UsersManagement.tsx and the ecosystem
const SUPPLIERS = (() => {
  const reg = getRegisteredSuppliers();
  return reg.length > 0 ? reg.map(s => s.name) : [];
})();

const BUYERS: string[] = [];

const BRANDS = [
  'KESHAR KALI',
  '1121 Sella Rice',
  'Sona Masoori (Old)',
  'Organic Brown Rice',
  'Broken Rice (100%)'
];

export interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  type: 'text' | 'number' | 'date' | 'select' | 'calc' | 'bill-photo' | 'po-select';
  options?: string[];
  group: string;
  frozen?: boolean;
}

const DEFAULT_COLS: ColumnConfig[] = [
  { id: 'date', label: 'DATE', width: 130, type: 'date', group: 'Meta', frozen: true },
  { id: 'millerName', label: 'SUPPLIER (MILLER)', width: 220, type: 'select', options: SUPPLIERS, group: 'Entity', frozen: true },
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

const INITIAL_ROWS = 40;
const ROW_HEIGHT = 40; // Virtual row height in px
const OVERSCAN = 10;   // Buffer rows above and below visible viewport

const parseAnyDate = (val: any): Date | null => {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch.map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
};

const formatDateToDDMMYYYY = (val: any): string => {
  if (!val) return '';
  const d = parseAnyDate(val);
  if (d) {
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = monthNames[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return String(val);
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
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', may2026: '05', jun: '06', june: '06',
    jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
  };

  for (const [mName, mNum] of Object.entries(monthMap)) {
    if (clean.includes(mName)) {
      return `${year}-${mNum}-01`;
    }
  }

  return new Date().toISOString().split('T')[0];
};

export const monthToNumber = (m: string): string => {
  const map: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12'
  };
  return map[m] || '01';
};

export const getDaysPendingNum = (row: any): number => {
  if (!row || !row.date) return 0;
  const status = row.noOfDayRec || 'Not Cleared';
  const arrDate = parseAnyDate(row.date);
  if (!arrDate) return 0;
  arrDate.setHours(0, 0, 0, 0);

  if (status === 'Cleared') {
    if (row.chqDt) {
      const chqDate = parseAnyDate(row.chqDt);
      if (chqDate) {
        chqDate.setHours(0, 0, 0, 0);
        const diffTime = chqDate.getTime() - arrDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
      }
    }
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - arrDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

const generateEmptyArrivalRows = (count = 100, defaultDate?: string): any[] => {
  const d = defaultDate || new Date().toISOString().split('T')[0];
  return Array(count).fill(0).map((_, i) => ({
    id: `row-empty-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
    date: d
  }));
};

interface FilterCondition {
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between' | 'blank' | 'notBlank' | 'in';
  value?: any;
  value2?: any;
  selectedValues?: string[];
}

export default function ArrivalEntry() {
  interface Sheet {
    id: string;
    name: string;
    data: any[];
  }

  // Sheets state
  const [sheets, setSheets] = useState<Sheet[]>(() => {
    const savedSheets = localStorage.getItem('arrival_entry_sheets_v4');
    if (savedSheets) {
      try {
        const parsed = JSON.parse(savedSheets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s, idx) => ({
            id: s.id || `sheet-${idx + 1}`,
            name: s.id === 'sheet-1' && (s.name === 'Sheet 1' || !s.name) ? 'All Arrivals (Main)' : (s.name || `Sheet ${idx + 1}`),
            data: Array.isArray(s.data) && s.data.length > 0 ? s.data : generateEmptyArrivalRows(INITIAL_ROWS)
          }));
        }
      } catch (e) {}
    }
    return [{ id: 'sheet-1', name: 'All Arrivals (Main)', data: generateEmptyArrivalRows(INITIAL_ROWS) }];
  });

  const [currentSheetId, setCurrentSheetId] = useState<string>(() => sheets[0]?.id || 'sheet-1');

  const currentSheet = useMemo(() => {
    const found = sheets.find(s => s.id === currentSheetId) || sheets[0];
    return {
      id: found?.id || 'sheet-1',
      name: found?.name || 'Sheet 1',
      data: Array.isArray(found?.data) ? found.data : generateEmptyArrivalRows(INITIAL_ROWS)
    };
  }, [sheets, currentSheetId]);

  const data = useMemo(() => {
    return Array.isArray(currentSheet?.data) ? currentSheet.data : [];
  }, [currentSheet]);

  // Column definitions with user-resizable widths
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const savedWidths = localStorage.getItem('arrival_entry_col_widths');
      if (savedWidths) {
        const widthsMap = JSON.parse(savedWidths);
        return DEFAULT_COLS.map(c => ({
          ...c,
          width: widthsMap[c.id] || c.width
        }));
      }
    } catch {}
    return DEFAULT_COLS;
  });

  // Column Visibility state
  const [hiddenColIds, setHiddenColIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('arrival_entry_col_visibility');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set<string>();
  });

  const visibleColumns = useMemo(() => {
    return columns.filter(c => !hiddenColIds.has(c.id));
  }, [columns, hiddenColIds]);

  // Excel-style Selection Range
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [selectionRange, setSelectionRange] = useState<{
    startR: number;
    startC: number;
    endR: number;
    endC: number;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');

  // Undo / Redo history stacks
  const [history, setHistory] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);

  // Autosave and Firestore sync status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const dirtyRowIds = useRef<Set<string>>(new Set());

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Filters & Sorting state
  const [columnFilters, setColumnFilters] = useState<Record<string, FilterCondition>>({});
  const [openFilterColId, setOpenFilterColId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ colId: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDueArea, setSelectedDueArea] = useState<string>('All');

  // Top Quick Control Bar Filters
  const [quickSearch, setQuickSearch] = useState<string>('');
  const [quickShopLoc, setQuickShopLoc] = useState<string>('All');
  const [quickRoad, setQuickRoad] = useState<string>('All');
  const [quickStatus, setQuickStatus] = useState<string>('All');
  const [quickDaysOp, setQuickDaysOp] = useState<'all' | '>' | '<' | '=' | '>=' | '<=' | 'between'>('all');
  const [quickDaysVal, setQuickDaysVal] = useState<string>('');
  const [quickDaysVal2, setQuickDaysVal2] = useState<string>('');

  // Due List PDF Options Modal state
  const [isDueListModalOpen, setIsDueListModalOpen] = useState(false);
  const [dueListRoad, setDueListRoad] = useState<string>('All');
  const [dueListStatus, setDueListStatus] = useState<'All' | 'Pending' | 'Cleared'>('Pending');
  const [dueListDaysOp, setDueListDaysOp] = useState<'all' | '>' | '<' | '=' | '>=' | '<=' | 'between'>('all');
  const [dueListDaysVal, setDueListDaysVal] = useState<string>('');
  const [dueListDaysVal2, setDueListDaysVal2] = useState<string>('');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isColVisibilityOpen, setIsColVisibilityOpen] = useState(false);
  const [isManifestScannerOpen, setIsManifestScannerOpen] = useState(false);
  const [manifestSuccessToast, setManifestSuccessToast] = useState<string | null>(null);
  const [billPhotoModalState, setBillPhotoModalState] = useState<{
    isOpen: boolean;
    rowIndex: number;
    row: any;
  }>({ isOpen: false, rowIndex: -1, row: null });

  // PO Relation match state
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [poFilterQuery, setPoFilterQuery] = useState('');

  // Stakeholders metadata
  const [dynamicSuppliers, setDynamicSuppliers] = useState<string[]>(SUPPLIERS);
  const [dynamicBuyers, setDynamicBuyers] = useState<string[]>(BUYERS);
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);

  // Sheet creation states
  const [isAddSheetModalOpen, setIsAddSheetModalOpen] = useState(false);
  const [createSheetMode, setCreateSheetMode] = useState<'month' | 'custom'>('month');
  const [selectedSheetMonth, setSelectedSheetMonth] = useState<string>('May');
  const [selectedSheetYear, setSelectedSheetYear] = useState<string>('2026');
  const [copyMainEntriesForMonth, setCopyMainEntriesForMonth] = useState<boolean>(true);
  const [newSheetInputName, setNewSheetInputName] = useState('');
  const [sheetToDelete, setSheetToDelete] = useState<Sheet | null>(null);

  // Sync Top Scrollbar
  const topScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Column resizing state
  const resizingCol = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  // Load Stakeholders and Orders
  useEffect(() => {
    async function loadMeta() {
      try {
        const cloudDocs = await getCollectionDocs('stakeholders').catch(() => []);
        const reg = getRegisteredSuppliers();
        const supSet = new Set<string>(reg.length > 0 ? reg.map(s => s.name) : SUPPLIERS);
        const buySet = new Set<string>(BUYERS);

        cloudDocs.forEach(d => {
          if (d && d.name) {
            if (d.type === 'suppliers') supSet.add(d.name.trim());
            if (d.type === 'buyers') buySet.add(d.name.trim());
          }
        });

        setDynamicSuppliers(Array.from(supSet).sort());
        setDynamicBuyers(Array.from(buySet).sort());

        const orders = await getCollectionDocs('placed_orders').catch(() => []);
        setPlacedOrders(orders);
      } catch (e) {
        console.warn('Metadata load error in ArrivalEntry:', e);
      }
    }
    loadMeta();
  }, []);

  // Set Data Helper (updates local state & marks dirty)
  const setData = useCallback((newDataOrFn: any[] | ((prev: any[]) => any[])) => {
    setSheets(prevSheets => {
      const updated = prevSheets.map(s => {
        if (s.id === currentSheetId) {
          const resolved = typeof newDataOrFn === 'function' ? newDataOrFn(s.data) : newDataOrFn;
          return { ...s, data: resolved };
        }
        return s;
      });
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(updated));
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

  // Undo / Redo actions
  const saveToHistory = useCallback(() => {
    setHistory(prev => [data, ...prev].slice(0, 40));
    setRedoStack([]);
  }, [data]);

  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      const [last, ...rest] = history;
      setRedoStack(prev => [data, ...prev]);
      setData(last);
      setHistory(rest);
    }
  }, [history, data, setData]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const [next, ...rest] = redoStack;
      setHistory(prev => [data, ...prev]);
      setData(next);
      setRedoStack(rest);
    }
  }, [redoStack, data, setData]);

  // Debounced Autosave for Dirty Rows only
  useEffect(() => {
    if (dirtyRowIds.current.size === 0) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const rowsToSave = data.filter(r => r && r.id && dirtyRowIds.current.has(r.id));
        if (rowsToSave.length > 0) {
          const batch = writeBatch(db);
          rowsToSave.forEach(row => {
            const cleanBill = row.billNo ? String(row.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
            const docId = cleanBill
              ? `row-${currentSheetId}-${cleanBill}`
              : (row.id ? String(row.id).replace(/^#/, '') : `row-${currentSheetId}-${Date.now()}`);
            const docRef = doc(db, 'arrival_entries', docId);
            batch.set(docRef, { ...row, sheetId: currentSheetId, sheetName: currentSheet.name, lastUpdated: Date.now() }, { merge: true });
          });
          await batch.commit();
        }
        dirtyRowIds.current.clear();
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      } catch (err) {
        console.error('Autosave batch commit error:', err);
        setSaveStatus('failed');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, currentSheetId, currentSheet.name]);

  // Handle cell edit commit
  const handleUpdateCell = useCallback((r: number, colId: string, val: any) => {
    saveToHistory();
    const newData = [...data];
    let row = { ...newData[r], [colId]: val, lastUpdated: Date.now() };

    // Standard business calculations if not overridden by explicit formula
    row = recalculateRowBusinessLogic(row);

    newData[r] = row;
    if (row.id) dirtyRowIds.current.add(row.id);
    setData(newData);
  }, [data, saveToHistory, setData]);

  // Unique dropdown option sets for Quick Controls
  const uniqueShopLocations = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      if (r?.area && String(r.area).trim()) {
        set.add(String(r.area).trim());
      }
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueRoads = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      if (r?.road && String(r.road).trim()) {
        set.add(String(r.road).trim());
      }
      if (r?.area && String(r.area).trim()) {
        set.add(String(r.area).trim());
      }
    });
    return Array.from(set).sort();
  }, [data]);

  const hasActiveQuickFilters = useMemo(() => {
    return (
      quickSearch.trim() !== '' ||
      quickShopLoc !== 'All' ||
      quickRoad !== 'All' ||
      quickStatus !== 'All' ||
      quickDaysOp !== 'all' ||
      Object.keys(columnFilters).length > 0 ||
      selectedDueArea !== 'All'
    );
  }, [quickSearch, quickShopLoc, quickRoad, quickStatus, quickDaysOp, columnFilters, selectedDueArea]);

  const handleClearQuickFilters = useCallback(() => {
    setQuickSearch('');
    setQuickShopLoc('All');
    setQuickRoad('All');
    setQuickStatus('All');
    setQuickDaysOp('all');
    setQuickDaysVal('');
    setQuickDaysVal2('');
    setColumnFilters({});
    setSelectedDueArea('All');
  }, []);

  // Filtered & Sorted Data Memo (UNDERLYING DATA IS NEVER MODIFIED)
  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Month tab filter
    if (selectedMonth !== 'all') {
      result = result.filter(row => {
        if (!row || !row.date) return false;
        return row.date.startsWith(selectedMonth);
      });
    }

    // 2. Buyer Area quick filter
    if (selectedDueArea !== 'All') {
      result = result.filter(row => {
        return row && row.area && String(row.area).trim() === selectedDueArea;
      });
    }

    // 3. Quick Control: Search (partyName, millerName, billNo, road, area, place)
    if (quickSearch.trim()) {
      const q = quickSearch.trim().toLowerCase();
      result = result.filter(row => {
        if (!row) return false;
        const p = String(row.partyName || '').toLowerCase();
        const m = String(row.millerName || '').toLowerCase();
        const b = String(row.billNo || '').toLowerCase();
        const r = String(row.road || '').toLowerCase();
        const a = String(row.area || '').toLowerCase();
        const pl = String(row.place || '').toLowerCase();
        return p.includes(q) || m.includes(q) || b.includes(q) || r.includes(q) || a.includes(q) || pl.includes(q);
      });
    }

    // 4. Quick Control: Shop Loc (Buyer Area)
    if (quickShopLoc !== 'All') {
      result = result.filter(row => row && row.area && String(row.area).trim() === quickShopLoc);
    }

    // 5. Quick Control: Road
    if (quickRoad !== 'All') {
      result = result.filter(row => {
        if (!row) return false;
        const roadVal = row.road ? String(row.road).trim() : '';
        const areaVal = row.area ? String(row.area).trim() : '';
        return roadVal === quickRoad || areaVal === quickRoad;
      });
    }

    // 6. Quick Control: Status
    if (quickStatus === 'Not Cleared') {
      result = result.filter(row => (row?.noOfDayRec || 'Not Cleared') !== 'Cleared');
    } else if (quickStatus === 'Cleared') {
      result = result.filter(row => row?.noOfDayRec === 'Cleared');
    }

    // 7. Quick Control: Days Pending
    if (quickDaysOp !== 'all') {
      const v1 = parseFloat(quickDaysVal);
      const v2 = parseFloat(quickDaysVal2);
      if (!isNaN(v1)) {
        result = result.filter(row => {
          if (!row) return false;
          const days = getDaysPendingNum(row);
          switch (quickDaysOp) {
            case '>': return days > v1;
            case '<': return days < v1;
            case '=': return days === v1;
            case '>=': return days >= v1;
            case '<=': return days <= v1;
            case 'between': {
              if (isNaN(v2)) return days >= v1;
              const min = Math.min(v1, v2);
              const max = Math.max(v1, v2);
              return days >= min && days <= max;
            }
            default: return true;
          }
        });
      }
    }

    // 8. Multi-column simultaneous filters
    Object.entries(columnFilters).forEach(([colId, filter]) => {
      result = result.filter(row => {
        if (!row) return false;
        const rawVal = row[colId];
        const strVal = String(rawVal ?? '').toLowerCase();

        switch (filter.operator) {
          case 'contains':
            return strVal.includes(String(filter.value ?? '').toLowerCase());
          case 'equals':
            return strVal === String(filter.value ?? '').toLowerCase();
          case 'startsWith':
            return strVal.startsWith(String(filter.value ?? '').toLowerCase());
          case 'endsWith':
            return strVal.endsWith(String(filter.value ?? '').toLowerCase());
          case 'blank':
            return rawVal === undefined || rawVal === null || strVal === '';
          case 'notBlank':
            return rawVal !== undefined && rawVal !== null && strVal !== '';
          case 'gt': {
            const num = parseFloat(strVal);
            return !isNaN(num) && num > parseFloat(filter.value);
          }
          case 'lt': {
            const num = parseFloat(strVal);
            return !isNaN(num) && num < parseFloat(filter.value);
          }
          case 'between': {
            const num = parseFloat(strVal);
            const min = parseFloat(filter.value);
            const max = parseFloat(filter.value2);
            return !isNaN(num) && num >= min && num <= max;
          }
          case 'in':
            if (!filter.selectedValues || filter.selectedValues.length === 0) return true;
            return filter.selectedValues.includes(String(rawVal ?? ''));
          default:
            return true;
        }
      });
    });

    // 9. Multi-column sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a ? a[sortConfig.colId] : '';
        const valB = b ? b[sortConfig.colId] : '';

        // Number comparison
        const numA = parseFloat(String(valA).replace(/,/g, ''));
        const numB = parseFloat(String(valB).replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        // Date comparison
        const dateA = parseAnyDate(valA)?.getTime();
        const dateB = parseAnyDate(valB)?.getTime();
        if (dateA && dateB) {
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // String comparison
        return sortConfig.direction === 'asc'
          ? String(valA ?? '').localeCompare(String(valB ?? ''))
          : String(valB ?? '').localeCompare(String(valA ?? ''));
      });
    }

    return result;
  }, [
    data,
    selectedMonth,
    selectedDueArea,
    quickSearch,
    quickShopLoc,
    quickRoad,
    quickStatus,
    quickDaysOp,
    quickDaysVal,
    quickDaysVal2,
    columnFilters,
    sortConfig
  ]);

  // Virtualization Calculations
  const totalRowsCount = filteredData.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalRowsCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = useMemo(() => {
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, startIndex, endIndex]);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRowsCount - endIndex) * ROW_HEIGHT);

  // Total Grid Width
  const totalTableWidth = useMemo(() => {
    return visibleColumns.reduce((acc, c) => acc + c.width, 48); // 48px for row header index
  }, [visibleColumns]);

  // Start / Stop Editing
  const startEditing = useCallback((r: number, c: number) => {
    const col = visibleColumns[c];
    if (!col || col.id === 'noOfDays') return;
    if (col.id === 'billPhoto') {
      setBillPhotoModalState({ isOpen: true, rowIndex: r, row: data[r] });
      return;
    }

    setActiveCell({ r, c });
    setSelectionRange({ startR: r, startC: c, endR: r, endC: c });
    setIsEditing(true);

    const rawVal = data[r] ? data[r][col.id] : '';
    setEditValue(rawVal !== undefined && rawVal !== null ? String(rawVal) : '');

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (inputRef.current.select) inputRef.current.select();
      }
    }, 10);
  }, [visibleColumns, data]);

  const stopEditing = useCallback((save: boolean = true) => {
    if (save && activeCell && data[activeCell.r] && visibleColumns[activeCell.c]) {
      handleUpdateCell(activeCell.r, visibleColumns[activeCell.c].id, editValue);
    }
    setIsEditing(false);
  }, [activeCell, data, visibleColumns, editValue, handleUpdateCell]);

  // Excel Copy (TSV) & Multi-Cell Paste
  const handleCopySelection = useCallback(() => {
    if (!activeCell) return;
    const startR = selectionRange ? Math.min(selectionRange.startR, selectionRange.endR) : activeCell.r;
    const endR = selectionRange ? Math.max(selectionRange.startR, selectionRange.endR) : activeCell.r;
    const startC = selectionRange ? Math.min(selectionRange.startC, selectionRange.endC) : activeCell.c;
    const endC = selectionRange ? Math.max(selectionRange.startC, selectionRange.endC) : activeCell.c;

    const rowsText: string[] = [];
    for (let r = startR; r <= endR; r++) {
      const row = data[r];
      const cells: string[] = [];
      for (let c = startC; c <= endC; c++) {
        const col = visibleColumns[c];
        const val = row && col ? row[col.id] : '';
        cells.push(val !== undefined && val !== null ? String(val) : '');
      }
      rowsText.push(cells.join('\t'));
    }

    const tsv = rowsText.join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {});
  }, [activeCell, selectionRange, data, visibleColumns]);

  const handlePasteSelection = useCallback(async () => {
    if (!activeCell) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      saveToHistory();
      const lines = text.split(/\r?\n/).filter(line => line.length > 0);
      const startR = activeCell.r;
      const startC = activeCell.c;

      const nextData = [...data];
      // Expand data if paste exceeds current rows
      while (nextData.length < startR + lines.length) {
        nextData.push({
          id: `row-paste-${Date.now()}-${nextData.length}`,
          date: getDefaultDateForSheet(currentSheet.name)
        });
      }

      lines.forEach((line, rOffset) => {
        const targetR = startR + rOffset;
        const cellVals = line.split('\t');
        let rowObj = { ...nextData[targetR] };

        cellVals.forEach((cellVal, cOffset) => {
          const targetC = startC + cOffset;
          const col = visibleColumns[targetC];
          if (col && col.id !== 'noOfDays') {
            rowObj[col.id] = cellVal.trim();
          }
        });

        rowObj = recalculateRowBusinessLogic(rowObj);
        nextData[targetR] = rowObj;
        if (rowObj.id) dirtyRowIds.current.add(rowObj.id);
      });

      setData(nextData);
    } catch (err) {
      console.warn('Paste failed or permission denied:', err);
    }
  }, [activeCell, data, visibleColumns, currentSheet.name, saveToHistory, setData]);

  // Fill Down (Ctrl+D) / Fill Right (Ctrl+R)
  const handleFillDown = useCallback(() => {
    if (!selectionRange) return;
    const minR = Math.min(selectionRange.startR, selectionRange.endR);
    const maxR = Math.max(selectionRange.startR, selectionRange.endR);
    const minC = Math.min(selectionRange.startC, selectionRange.endC);
    const maxC = Math.max(selectionRange.startC, selectionRange.endC);
    if (minR === maxR) return;

    saveToHistory();
    const nextData = [...data];

    for (let c = minC; c <= maxC; c++) {
      const col = visibleColumns[c];
      if (!col || col.id === 'noOfDays') continue;
      const sourceVal = nextData[minR]?.[col.id];

      for (let r = minR + 1; r <= maxR; r++) {
        let targetRow = { ...nextData[r] };
        if (isFormula(sourceVal)) {
          targetRow[col.id] = shiftFormula(sourceVal, r - minR, 0);
        } else {
          targetRow[col.id] = sourceVal;
        }
        targetRow = recalculateRowBusinessLogic(targetRow);
        nextData[r] = targetRow;
        if (targetRow.id) dirtyRowIds.current.add(targetRow.id);
      }
    }
    setData(nextData);
  }, [selectionRange, data, visibleColumns, saveToHistory, setData]);

  // Keyboard navigation & Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;

    // Shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === 'c') {
        e.preventDefault();
        handleCopySelection();
        return;
      }
      if (e.key === 'v') {
        e.preventDefault();
        handlePasteSelection();
        return;
      }
      if (e.key === 'd') {
        e.preventDefault();
        handleFillDown();
        return;
      }
    }

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        stopEditing(true);
        if (e.shiftKey) {
          if (activeCell.r > 0) setActiveCell({ r: activeCell.r - 1, c: activeCell.c });
        } else {
          if (activeCell.r < data.length - 1) setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
          else addRow();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        stopEditing(true);
        if (e.shiftKey) {
          if (activeCell.c > 0) setActiveCell({ r: activeCell.r, c: activeCell.c - 1 });
        } else {
          if (activeCell.c < visibleColumns.length - 1) setActiveCell({ r: activeCell.r, c: activeCell.c + 1 });
          else if (activeCell.r < data.length - 1) setActiveCell({ r: activeCell.r + 1, c: 0 });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing(false);
      }
      return;
    }

    const { r, c } = activeCell;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (r > 0) {
          const nextR = r - 1;
          setActiveCell({ r: nextR, c });
          if (e.shiftKey) {
            setSelectionRange(prev => ({
              startR: prev ? prev.startR : r,
              startC: prev ? prev.startC : c,
              endR: nextR,
              endC: c
            }));
          } else {
            setSelectionRange({ startR: nextR, startC: c, endR: nextR, endC: c });
          }
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (r < data.length - 1) {
          const nextR = r + 1;
          setActiveCell({ r: nextR, c });
          if (e.shiftKey) {
            setSelectionRange(prev => ({
              startR: prev ? prev.startR : r,
              startC: prev ? prev.startC : c,
              endR: nextR,
              endC: c
            }));
          } else {
            setSelectionRange({ startR: nextR, startC: c, endR: nextR, endC: c });
          }
        } else {
          addRow();
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (c > 0) {
          const nextC = c - 1;
          setActiveCell({ r, c: nextC });
          if (e.shiftKey) {
            setSelectionRange(prev => ({
              startR: prev ? prev.startR : r,
              startC: prev ? prev.startC : c,
              endR: r,
              endC: nextC
            }));
          } else {
            setSelectionRange({ startR: r, startC: nextC, endR: r, endC: nextC });
          }
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (c < visibleColumns.length - 1) {
          const nextC = c + 1;
          setActiveCell({ r, c: nextC });
          if (e.shiftKey) {
            setSelectionRange(prev => ({
              startR: prev ? prev.startR : r,
              startC: prev ? prev.startC : c,
              endR: r,
              endC: nextC
            }));
          } else {
            setSelectionRange({ startR: r, startC: nextC, endR: r, endC: nextC });
          }
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (c > 0) setActiveCell({ r, c: c - 1 });
        } else {
          if (c < visibleColumns.length - 1) setActiveCell({ r, c: c + 1 });
          else if (r < data.length - 1) setActiveCell({ r: r + 1, c: 0 });
        }
        break;

      case 'Enter':
      case 'F2':
        e.preventDefault();
        startEditing(r, c);
        break;

      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        handleUpdateCell(r, visibleColumns[c].id, '');
        break;

      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          startEditing(r, c);
          setEditValue(e.key);
        }
        break;
    }
  };

  const addRow = () => {
    saveToHistory();
    const defaultDate = getDefaultDateForSheet(currentSheet.name);
    const newId = `row-${currentSheetId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newRow = { id: newId, date: defaultDate };
    dirtyRowIds.current.add(newId);
    setData([...data, newRow]);
  };

  // Scroll Sync between top header scrollbar and grid
  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setViewportHeight(e.currentTarget.clientHeight);
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  // Column Resize Handlers
  const handleStartResize = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetCol = columns.find(c => c.id === colId);
    if (!targetCol) return;

    resizingCol.current = {
      colId,
      startX: e.clientX,
      startWidth: targetCol.width
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = moveEvent.clientX - resizingCol.current.startX;
      const newWidth = Math.max(70, resizingCol.current.startWidth + delta);

      setColumns(prev => {
        const next = prev.map(c => c.id === resizingCol.current?.colId ? { ...c, width: newWidth } : c);
        const map = next.reduce((acc, c) => ({ ...acc, [c.id]: c.width }), {});
        localStorage.setItem('arrival_entry_col_widths', JSON.stringify(map));
        return next;
      });
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Stats Calculation
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let totalNetAmt = 0;
    let totalChqIssued = 0;

    data.forEach(row => {
      if (!row) return;
      totalQty += parseFloat(String(row.qty || 0).replace(/,/g, '')) || 0;
      totalAmount += parseFloat(String(row.amount || 0).replace(/,/g, '')) || 0;
      totalNetAmt += parseFloat(String(row.netAmt || 0).replace(/,/g, '')) || 0;
      totalChqIssued += parseFloat(String(row.chqAm || 0).replace(/,/g, '')) || 0;
    });

    return { totalQty, totalAmount, totalNetAmt, totalChqIssued };
  }, [data]);

  // Export to Excel
  const exportToExcel = () => {
    const preparedData = data
      .filter(row => Object.keys(row).length > 1)
      .map(row => {
        const obj: Record<string, any> = {};
        visibleColumns.forEach(col => {
          let val = row[col.id];
          if (isFormula(val)) {
            const evaluated = evaluateFormula(val, data, data.indexOf(row));
            val = evaluated.error ? evaluated.error : evaluated.result;
          }
          obj[col.label] = val;
        });
        return obj;
      });

    const worksheet = XLSX.utils.json_to_sheet(preparedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentSheet.name || 'Arrival_Audit');

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    XLSX.writeFile(workbook, `Arrival_Log_${dd}-${mm}-${yyyy}.xlsx`);
  };

  // Due List PDF generation with independent options
  const handleGenerateDueListPDF = () => {
    // 1. Take candidate records from the CURRENT ACTIVE SHEET only
    let candidateRows = (currentSheet.data || []).filter(row => {
      const hasBasicData = !!(row && (row.partyName || row.millerName || row.billNo || row.qty || row.amount));
      return hasBasicData;
    });

    // 2. Filter by Road
    if (dueListRoad !== 'All') {
      candidateRows = candidateRows.filter(row => {
        const roadVal = row.road ? String(row.road).trim() : '';
        const areaVal = row.area ? String(row.area).trim() : '';
        return roadVal === dueListRoad || areaVal === dueListRoad;
      });
    }

    // 3. Filter by Status (Pending, Cleared, All)
    if (dueListStatus === 'Pending') {
      candidateRows = candidateRows.filter(row => (row.noOfDayRec || 'Not Cleared') !== 'Cleared');
    } else if (dueListStatus === 'Cleared') {
      candidateRows = candidateRows.filter(row => row.noOfDayRec === 'Cleared');
    }

    // 4. Filter by Days Pending
    if (dueListDaysOp !== 'all') {
      const v1 = parseFloat(dueListDaysVal);
      const v2 = parseFloat(dueListDaysVal2);
      if (!isNaN(v1)) {
        candidateRows = candidateRows.filter(row => {
          const days = getDaysPendingNum(row);
          switch (dueListDaysOp) {
            case '>': return days > v1;
            case '<': return days < v1;
            case '=': return days === v1;
            case '>=': return days >= v1;
            case '<=': return days <= v1;
            case 'between': {
              if (isNaN(v2)) return days >= v1;
              const min = Math.min(v1, v2);
              const max = Math.max(v1, v2);
              return days >= min && days <= max;
            }
            default: return true;
          }
        });
      }
    }

    if (candidateRows.length === 0) {
      alert(`No records found in "${currentSheet.name}" matching the selected Due List PDF criteria.`);
      return;
    }

    // Sort by Party Name (Buyer) ascending
    const sortedRows = [...candidateRows].sort((a, b) => {
      const nameA = String(a.partyName || '').trim().toUpperCase();
      const nameB = String(b.partyName || '').trim().toUpperCase();
      return nameA.localeCompare(nameB);
    });

    // Generate jsPDF (A4 Portrait)
    const doc = new jsPDF('p', 'mm', 'a4');
    const primaryColor: [number, number, number] = [147, 0, 11]; // Deep crimson

    // Crimson Top Header Banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 30, 'F');

    // Title inside banner
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`DUE LIST - ${currentSheet.name.toUpperCase()}`, 8, 12);

    // Subtitle inside banner
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const filterDesc = [
      `Road: ${dueListRoad}`,
      `Status: ${dueListStatus === 'Pending' ? 'Pending / Not Cleared' : dueListStatus}`,
      dueListDaysOp !== 'all' ? `Days: ${dueListDaysOp} ${dueListDaysVal}${dueListDaysOp === 'between' ? ` to ${dueListDaysVal2}` : ''}` : null,
      `Records: ${sortedRows.length}`
    ].filter(Boolean).join('  |  ');
    doc.text(filterDesc, 8, 20);

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    doc.text(`Generated: ${dd}-${mm}-${yyyy} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 8, 26);

    // Exact 10 Columns:
    // Date | Party Name | Party Loc | Miller Name | No. of Days Pending | Bill No | QTLs | Rate | Amount | LH
    const tableHeaders = [
      'Date',
      'Party Name',
      'Party Loc',
      'Miller Name',
      'No. of Days Pending',
      'Bill No',
      'QTLs',
      'Rate',
      'Amount',
      'LH'
    ];

    let totalQtls = 0;
    let totalAmount = 0;
    let totalLh = 0;

    const tableBody = sortedRows.map(row => {
      const formattedDate = formatDateToDDMMYYYY(row.date);
      const partyName = row.partyName || '';
      const partyLoc = row.area || row.road || '';
      const millerName = row.millerName || '';
      
      const isCleared = (row.noOfDayRec || 'Not Cleared') === 'Cleared';
      const daysPending = getDaysPendingNum(row);
      const daysPendingText = isCleared ? 'Cleared' : `${daysPending} Days`;

      const billNoVal = row.billNo
        ? String(row.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '')
        : '';

      const qVal = parseFloat(String(row.qty || 0).replace(/,/g, '')) || 0;
      totalQtls += qVal;
      const qtlsText = qVal > 0 ? qVal.toFixed(2) : (row.qty ? String(row.qty) : '');

      const rateVal = parseFloat(String(row.rate || 0).replace(/,/g, '')) || 0;
      const rateText = rateVal > 0 ? formatINR(rateVal) : (row.rate ? String(row.rate) : '');

      const amtVal = parseFloat(String(row.amount || 0).replace(/,/g, '')) || (qVal * rateVal) || 0;
      totalAmount += amtVal;
      const amountText = amtVal > 0 ? formatINR(amtVal) : (row.amount ? String(row.amount) : '');

      const lhVal = parseFloat(String(row.lh || 0).replace(/,/g, '')) || 0;
      totalLh += lhVal;
      const lhText = lhVal > 0 ? formatINR(lhVal) : (row.lh ? String(row.lh) : '');

      return [
        formattedDate,
        partyName,
        partyLoc,
        millerName,
        daysPendingText,
        billNoVal,
        qtlsText,
        rateText,
        amountText,
        lhText
      ];
    });

    autoTable(doc, {
      startY: 34,
      head: [tableHeaders],
      body: tableBody,
      foot: [
        [
          'Total',
          `${sortedRows.length} Rows`,
          '',
          '',
          '',
          '',
          totalQtls > 0 ? totalQtls.toFixed(2) : '',
          '',
          totalAmount > 0 ? formatINR(totalAmount) : '',
          totalLh > 0 ? formatINR(totalLh) : ''
        ]
      ],
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        valign: 'middle',
        overflow: 'ellipsize'
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' }, // Date
        1: { cellWidth: 34, halign: 'left', fontStyle: 'bold' }, // Party Name
        2: { cellWidth: 22, halign: 'left' },   // Party Loc
        3: { cellWidth: 28, halign: 'left' },   // Miller Name
        4: { cellWidth: 18, halign: 'center' }, // No. of Days Pending
        5: { cellWidth: 16, halign: 'center' }, // Bill No
        6: { cellWidth: 14, halign: 'right' },  // QTLs
        7: { cellWidth: 14, halign: 'right' },  // Rate
        8: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }, // Amount
        9: { cellWidth: 10, halign: 'right' }   // LH
      },
      margin: { left: 8, right: 8 }
    });

    const cleanSheetName = currentSheet.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Due_List_${cleanSheetName}_${dd}-${mm}-${yyyy}.pdf`);
    setIsDueListModalOpen(false);
  };

  // Add Sheet creation handler
  const handleCreateSheet = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let sheetName = '';
    if (createSheetMode === 'month') {
      sheetName = `${selectedSheetMonth} ${selectedSheetYear}`;
    } else {
      sheetName = newSheetInputName.trim();
    }

    if (!sheetName) {
      alert('Please enter a sheet name or select a month.');
      return;
    }

    const exists = sheets.some(s => s.name.trim().toLowerCase() === sheetName.toLowerCase());
    if (exists) {
      alert(`A sheet named "${sheetName}" already exists.`);
      return;
    }

    const newSheetId = `sheet-${Date.now()}`;
    const defaultDate = getDefaultDateForSheet(sheetName);

    let initialRows: any[] = [];
    if (createSheetMode === 'month' && copyMainEntriesForMonth) {
      const monthPrefix = `${selectedSheetYear}-${monthToNumber(selectedSheetMonth)}`;
      const matchingRows = (sheets[0]?.data || []).filter(r => r && r.date && r.date.startsWith(monthPrefix));
      if (matchingRows.length > 0) {
        initialRows = matchingRows.map(r => ({
          ...r,
          id: `row-${newSheetId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        }));
      }
    }

    if (initialRows.length === 0) {
      initialRows = generateEmptyArrivalRows(INITIAL_ROWS, defaultDate);
    }

    const newSheet: Sheet = {
      id: newSheetId,
      name: sheetName,
      data: initialRows
    };

    setSheets(prev => {
      const next = [...prev, newSheet];
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(next));
      return next;
    });

    setCurrentSheetId(newSheetId);
    setIsAddSheetModalOpen(false);
    setNewSheetInputName('');
  };

  // Paper Manifest camera capture apply
  const handleApplyManifest = useCallback((manifest: ParsedManifestData) => {
    const defaultDate = manifest.date || getDefaultDateForSheet(currentSheet.name);
    const newRow = {
      id: `row-${currentSheetId}-${manifest.billNo || Date.now()}`,
      date: defaultDate,
      billNo: manifest.billNo || '',
      millerName: manifest.millerName || '',
      partyName: manifest.partyName || '',
      brand: manifest.brand || '',
      qty: manifest.qty || '',
      rate: manifest.rate || '',
      amount: manifest.amount || '',
      netAmt: manifest.amount || '',
      noOfDayRec: 'Not Cleared',
      lastUpdated: Date.now()
    };

    saveToHistory();
    dirtyRowIds.current.add(newRow.id);
    setData(prev => [newRow, ...prev]);

    setManifestSuccessToast(`Shipment manifest #${newRow.billNo} successfully added to ledger!`);
    setTimeout(() => setManifestSuccessToast(null), 4000);
  }, [currentSheet.name, currentSheetId, saveToHistory, setData]);

  // Active cell display value and formula bar value
  const activeCellRawValue = useMemo(() => {
    if (!activeCell || !data[activeCell.r] || !visibleColumns[activeCell.c]) return '';
    const colId = visibleColumns[activeCell.c].id;
    return data[activeCell.r][colId] ?? '';
  }, [activeCell, data, visibleColumns]);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      
      {/* Top Header Workspace Bar */}
      <div className="bg-surface border-b border-outline-variant px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left: Title & Cloud/Autosave Indicators */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white shadow-md shadow-primary/20">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-on-surface tracking-tight">Arrival Entry Workspace</h1>
              
              {/* Autosave Status Badge */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all">
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" /> Saved {lastSavedTime ? `(${lastSavedTime})` : ''}
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Autosaving...
                  </span>
                )}
                {saveStatus === 'failed' && (
                  <span className="flex items-center gap-1 text-rose-600 border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Save Failed
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-secondary font-medium">
              Excel-Style High-Performance Ledger • {filteredData.length.toLocaleString()} Rows
            </p>
          </div>
        </div>

        {/* Action Controls & Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo / Redo */}
          <div className="flex items-center bg-surface-container border border-outline-variant rounded-xl p-0.5">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-1.5 rounded-lg hover:bg-surface text-secondary hover:text-on-surface disabled:opacity-30 cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 rounded-lg hover:bg-surface text-secondary hover:text-on-surface disabled:opacity-30 cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Column Visibility */}
          <button
            onClick={() => setIsColVisibilityOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-outline-variant hover:border-primary/50 text-secondary hover:text-on-surface rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Show / Hide Columns"
          >
            <Columns3 className="w-4 h-4" />
            <span>Columns</span>
          </button>

          {/* Due List PDF */}
          <button
            onClick={() => setIsDueListModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Due List</span>
          </button>

          {/* Camera Scanner */}
          <button
            onClick={() => setIsManifestScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Manifest</span>
          </button>

          {/* Import XLS Wizard */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import XLS</span>
          </button>

          {/* Export XLS */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export XLS</span>
          </button>
        </div>
      </div>

      {/* Top Quick Control Bar */}
      <div className="bg-surface-container-low/80 backdrop-blur-xs border-b border-outline-variant px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 select-none">
        
        {/* Left: Quick Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-secondary absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search party, miller, bill, road, area..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="pl-8 pr-7 py-1.5 bg-surface border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary w-52 md:w-64 transition-all"
            />
            {quickSearch && (
              <button
                onClick={() => setQuickSearch('')}
                className="absolute right-2 text-secondary hover:text-on-surface p-0.5"
                title="Clear Search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Shop Loc Dropdown */}
          <div className="flex items-center">
            <select
              value={quickShopLoc}
              onChange={(e) => setQuickShopLoc(e.target.value)}
              className={cn(
                "px-2.5 py-1.5 bg-surface border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px] truncate transition-colors",
                quickShopLoc !== 'All' ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-on-surface"
              )}
              title="Filter by Shop / Buyer Location (Area)"
            >
              <option value="All">Shop Loc: All</option>
              {uniqueShopLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Road Dropdown */}
          <div className="flex items-center">
            <select
              value={quickRoad}
              onChange={(e) => setQuickRoad(e.target.value)}
              className={cn(
                "px-2.5 py-1.5 bg-surface border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px] truncate transition-colors",
                quickRoad !== 'All' ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-on-surface"
              )}
              title="Filter by Road"
            >
              <option value="All">Road: All</option>
              {uniqueRoads.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center">
            <select
              value={quickStatus}
              onChange={(e) => setQuickStatus(e.target.value)}
              className={cn(
                "px-2.5 py-1.5 bg-surface border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors",
                quickStatus !== 'All' ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-on-surface"
              )}
              title="Filter by Payment Status"
            >
              <option value="All">Status: All</option>
              <option value="Not Cleared">Status: Pending</option>
              <option value="Cleared">Status: Cleared</option>
            </select>
          </div>

          {/* Days Pending Dropdown + Inputs */}
          <div className={cn(
            "flex items-center gap-1 bg-surface border rounded-xl p-0.5 transition-colors",
            quickDaysOp !== 'all' ? "border-primary bg-primary/5" : "border-outline-variant"
          )}>
            <select
              value={quickDaysOp}
              onChange={(e) => setQuickDaysOp(e.target.value as any)}
              className="px-2 py-1 bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
              title="Filter by Days Pending"
            >
              <option value="all">Days: All</option>
              <option value=">">&gt; (More than)</option>
              <option value="<">&lt; (Less than)</option>
              <option value="=">= (Equal to)</option>
              <option value=">=">&ge; (At least)</option>
              <option value="<=">&le; (At most)</option>
              <option value="between">Between</option>
            </select>

            {quickDaysOp !== 'all' && (
              <input
                type="number"
                min="0"
                placeholder="Days"
                value={quickDaysVal}
                onChange={(e) => setQuickDaysVal(e.target.value)}
                className="w-14 px-1.5 py-1 bg-surface border border-outline-variant rounded text-xs font-bold text-primary focus:outline-none"
              />
            )}

            {quickDaysOp === 'between' && (
              <>
                <span className="text-[10px] text-secondary font-bold px-0.5">to</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={quickDaysVal2}
                  onChange={(e) => setQuickDaysVal2(e.target.value)}
                  className="w-14 px-1.5 py-1 bg-surface border border-outline-variant rounded text-xs font-bold text-primary focus:outline-none"
                />
              </>
            )}
          </div>

          {/* Clear Filters Button */}
          {hasActiveQuickFilters && (
            <button
              onClick={handleClearQuickFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Clear all active quick filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right: Due List PDF & + Add Sheet Buttons */}
        <div className="flex items-center gap-2">
          {/* Due List PDF Trigger */}
          <button
            onClick={() => setIsDueListModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition-all cursor-pointer"
            title="Open Due List PDF Generator"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Due List PDF</span>
          </button>

          {/* + Add Sheet Trigger */}
          <button
            onClick={() => setIsAddSheetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold shadow-sm shadow-primary/20 transition-all cursor-pointer"
            title="Create New Sheet"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sheet</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Formula Bar */}
      <div className="bg-surface-container-low border-b border-outline-variant px-4 py-2 flex items-center gap-3 shrink-0">
        <div className="w-16 h-8 bg-surface border border-primary/30 rounded-lg flex items-center justify-center font-mono font-black text-primary text-xs shadow-xs">
          {activeCell ? `${getColLetter(activeCell.c)}${activeCell.r + 1}` : '--'}
        </div>
        <div className="text-secondary/50 font-mono text-xs font-bold select-none">
          fx
        </div>
        <div className="flex-1 h-8 bg-surface rounded-xl flex items-center px-3 border border-outline-variant shadow-inner overflow-hidden">
          {isEditing ? (
            <input
              ref={formulaInputRef}
              className="w-full bg-transparent outline-none text-xs font-mono font-bold text-primary"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') stopEditing(true);
                if (e.key === 'Escape') stopEditing(false);
              }}
            />
          ) : (
            <span className="text-xs font-mono text-secondary truncate">
              {String(activeCellRawValue || '(Empty Cell)')}
            </span>
          )}
        </div>
        {Object.keys(columnFilters).length > 0 && (
          <button
            onClick={() => setColumnFilters({})}
            className="text-[10px] font-bold text-rose-500 hover:underline uppercase flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear {Object.keys(columnFilters).length} Filters
          </button>
        )}
      </div>

      {/* Synchronized Horizontal Top Scrollbar */}
      <div 
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden bg-surface-container-high border-b border-outline-variant/60 scrollbar-thin select-none shrink-0"
        style={{ height: '10px' }}
        onScroll={handleTopScroll}
      >
        <div style={{ width: `${totalTableWidth}px`, height: '1px' }} />
      </div>

      {/* Main Virtualized Grid Container */}
      <div
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleGridScroll}
        className="flex-1 overflow-auto bg-surface-container-lowest focus:outline-none scrollbar-thin select-none relative"
      >
        <div style={{ width: `${totalTableWidth}px`, height: `${totalRowsCount * ROW_HEIGHT + 44}px`, position: 'relative' }}>
          
          {/* Sticky Table Header */}
          <div className="sticky top-0 z-30 flex bg-surface-container-high border-b border-outline-variant text-[10px] font-black text-secondary uppercase tracking-widest h-11">
            
            {/* Corner Cell */}
            <div className="w-12 h-11 border-r border-outline-variant flex items-center justify-center sticky left-0 z-40 bg-surface-container-highest">
              <TableIcon className="w-3.5 h-3.5" />
            </div>

            {/* Column Headers */}
            {visibleColumns.map((col, cIdx) => {
              const isFiltered = !!columnFilters[col.id];
              const isSorted = sortConfig?.colId === col.id;

              return (
                <div
                  key={col.id}
                  style={{ width: `${col.width}px` }}
                  className={cn(
                    "h-11 border-r border-outline-variant px-2 flex items-center justify-between relative group select-none transition-colors",
                    activeCell?.c === cIdx ? "bg-primary/5 text-primary" : "bg-surface-container-high"
                  )}
                  onClick={() => {
                    // Column selection
                    setActiveCell({ r: 0, c: cIdx });
                    setSelectionRange({ startR: 0, startC: cIdx, endR: data.length - 1, endC: cIdx });
                  }}
                >
                  <div className="flex flex-col truncate pr-1">
                    <span className="text-[8px] font-mono opacity-50">{getColLetter(cIdx)}</span>
                    <span className="truncate font-black">{col.label}</span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {/* Sort Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortConfig(prev => {
                          if (prev?.colId === col.id) {
                            return prev.direction === 'asc' ? { colId: col.id, direction: 'desc' } : null;
                          }
                          return { colId: col.id, direction: 'asc' };
                        });
                      }}
                      className={cn(
                        "p-1 rounded hover:bg-surface-container transition-colors",
                        isSorted ? "text-primary font-bold" : "text-secondary/50 opacity-0 group-hover:opacity-100"
                      )}
                      title="Sort Column"
                    >
                      {isSorted && sortConfig?.direction === 'desc' ? (
                        <ChevronDown className="w-3 h-3 text-primary" />
                      ) : isSorted && sortConfig?.direction === 'asc' ? (
                        <ChevronUp className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </button>

                    {/* Filter Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColId(openFilterColId === col.id ? null : col.id);
                        setFilterSearch('');
                      }}
                      className={cn(
                        "p-1 rounded hover:bg-surface-container transition-colors relative",
                        isFiltered ? "text-emerald-600 font-bold bg-emerald-500/10" : "text-secondary/50 opacity-0 group-hover:opacity-100"
                      )}
                      title="Filter Column"
                    >
                      <Filter className="w-3 h-3" />
                      {isFiltered && (
                        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      )}
                    </button>
                  </div>

                  {/* Column Resize Handle */}
                  <div
                    onMouseDown={(e) => handleStartResize(col.id, e)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-20"
                  />

                  {/* Filter Popup Menu */}
                  {openFilterColId === col.id && (
                    <div 
                      className="absolute top-11 right-0 bg-surface border border-outline-variant rounded-xl shadow-2xl z-50 p-3 w-64 text-left normal-case tracking-normal text-on-surface"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/30">
                        <span className="text-[10px] font-black uppercase text-secondary flex items-center gap-1">
                          <Filter className="w-3 h-3 text-primary" /> Filter {col.label}
                        </span>
                        {isFiltered && (
                          <button
                            onClick={() => {
                              setColumnFilters(prev => {
                                const next = { ...prev };
                                delete next[col.id];
                                return next;
                              });
                              setOpenFilterColId(null);
                            }}
                            className="text-[9px] font-bold text-rose-500 hover:underline uppercase"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Text Search in Column Filter */}
                      <input
                        type="text"
                        placeholder="Filter contains..."
                        value={columnFilters[col.id]?.value || filterSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilterSearch(val);
                          setColumnFilters(prev => ({
                            ...prev,
                            [col.id]: { operator: 'contains', value: val }
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />

                      <div className="flex gap-2 mt-2 pt-2 border-t border-outline-variant/20 text-[10px] font-bold text-secondary">
                        <button
                          onClick={() => {
                            setColumnFilters(prev => ({
                              ...prev,
                              [col.id]: { operator: 'blank' }
                            }));
                            setOpenFilterColId(null);
                          }}
                          className="hover:text-primary"
                        >
                          Blanks
                        </button>
                        <span>|</span>
                        <button
                          onClick={() => {
                            setColumnFilters(prev => ({
                              ...prev,
                              [col.id]: { operator: 'notBlank' }
                            }));
                            setOpenFilterColId(null);
                          }}
                          className="hover:text-primary"
                        >
                          Non-blanks
                        </button>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => setOpenFilterColId(null)}
                          className="px-3 py-1 bg-primary text-on-primary text-[10px] font-bold rounded-lg uppercase"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Virtual Top Spacer */}
          <div style={{ height: `${topSpacerHeight}px` }} />

          {/* Visible Rows Window */}
          {visibleRows.map((row, indexOffset) => {
            const rIdx = startIndex + indexOffset;
            const isRowSelected = selectionRange && selectionRange.startR <= rIdx && rIdx <= selectionRange.endR;

            return (
              <div
                key={row.id || rIdx}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="flex border-b border-outline-variant/20 hover:bg-surface-container-low/40 transition-colors"
              >
                {/* Row Number Header */}
                <div
                  onClick={() => {
                    setActiveCell({ r: rIdx, c: 0 });
                    setSelectionRange({ startR: rIdx, startC: 0, endR: rIdx, endC: visibleColumns.length - 1 });
                  }}
                  className={cn(
                    "w-12 h-full border-r border-outline-variant/60 text-[10px] font-mono font-black flex items-center justify-center sticky left-0 z-20 cursor-pointer select-none",
                    activeCell?.r === rIdx ? "bg-primary text-on-primary" : "bg-surface-container-high text-secondary"
                  )}
                >
                  {rIdx + 1}
                </div>

                {/* Cells */}
                {visibleColumns.map((col, cIdx) => {
                  const isActive = activeCell?.r === rIdx && activeCell?.c === cIdx;
                  const isCellInSelection = selectionRange &&
                    rIdx >= Math.min(selectionRange.startR, selectionRange.endR) &&
                    rIdx <= Math.max(selectionRange.startR, selectionRange.endR) &&
                    cIdx >= Math.min(selectionRange.startC, selectionRange.endC) &&
                    cIdx <= Math.max(selectionRange.startC, selectionRange.endC);

                  const rawVal = row ? row[col.id] : '';
                  let displayVal = rawVal;

                  // Formula Evaluation
                  if (isFormula(rawVal)) {
                    const evaluated = evaluateFormula(rawVal, data, rIdx);
                    displayVal = evaluated.error ? evaluated.error : evaluated.result;
                  } else if (col.type === 'calc' && (col.id === 'amount' || col.id === 'netAmt') && rawVal) {
                    displayVal = `₹ ${formatINR(rawVal)}`;
                  } else if (col.type === 'date' && rawVal) {
                    displayVal = formatDateToDDMMYYYY(rawVal);
                  }

                  // Days Pending formatting and cell badge styling
                  let daysBadgeClass: string | null = null;
                  if (col.id === 'noOfDays') {
                    const isCleared = (row?.noOfDayRec || 'Not Cleared') === 'Cleared';
                    const hasDate = !!(row && row.date && parseAnyDate(row.date));
                    const daysNum = getDaysPendingNum(row);

                    if (isCleared) {
                      displayVal = 'Cleared';
                    } else if (hasDate) {
                      displayVal = `${daysNum} Days`;
                      if (daysNum >= 0 && daysNum <= 14) {
                        daysBadgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                      } else if (daysNum >= 15 && daysNum <= 28) {
                        daysBadgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                      } else if (daysNum >= 29) {
                        daysBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/50 dark:border-rose-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                      }
                    } else {
                      displayVal = '';
                    }
                  }

                  return (
                    <div
                      key={col.id}
                      style={{ width: `${col.width}px` }}
                      onClick={() => {
                        setActiveCell({ r: rIdx, c: cIdx });
                        setSelectionRange({ startR: rIdx, startC: cIdx, endR: rIdx, endC: cIdx });
                      }}
                      onDoubleClick={() => startEditing(rIdx, cIdx)}
                      className={cn(
                        "h-full border-r border-outline-variant/20 px-2 flex items-center text-xs truncate relative cursor-cell",
                        isActive && "ring-2 ring-primary ring-inset z-10 bg-primary/[0.04]",
                        isCellInSelection && !isActive && "bg-primary/[0.08]",
                        col.id === 'noOfDays' ? "justify-center" : (col.type === 'number' || col.type === 'calc' ? "justify-end text-right font-mono" : "justify-start text-on-surface")
                      )}
                    >
                      {isActive && isEditing ? (
                        <div className="absolute inset-0 z-20 bg-surface">
                          {col.type === 'select' ? (
                            <select
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => {
                                setEditValue(e.target.value);
                                handleUpdateCell(rIdx, col.id, e.target.value);
                                setIsEditing(false);
                              }}
                              onBlur={() => stopEditing(true)}
                              className="w-full h-full bg-transparent px-2 text-xs font-bold outline-none text-primary"
                            >
                              <option value="">-- Select --</option>
                              {(col.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => stopEditing(true)}
                              className="w-full h-full bg-transparent px-2 text-xs font-mono font-bold text-primary outline-none"
                            />
                          )}
                        </div>
                      ) : col.id === 'noOfDays' ? (
                        daysBadgeClass ? (
                          <span className={daysBadgeClass}>
                            {displayVal}
                          </span>
                        ) : (
                          <span className="text-secondary/60 text-[10px] font-bold">
                            {displayVal}
                          </span>
                        )
                      ) : (
                        <span className="truncate">
                          {String(displayVal ?? '')}
                        </span>
                      )}

                      {/* Excel Small Corner Drag-Handle for Bottom-Right of selection */}
                      {isActive && !isEditing && (
                        <div 
                          className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-crosshair z-20"
                          title="Drag to fill down/right"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Virtual Bottom Spacer */}
          <div style={{ height: `${bottomSpacerHeight}px` }} />
        </div>
      </div>

      {/* Bottom Summary Bar & Sheet Tabs */}
      <div className="bg-surface border-t border-outline-variant px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 text-xs">
        
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          {sheets.map(sheet => (
            <div key={sheet.id} className="relative group flex items-center">
              <button
                onClick={() => setCurrentSheetId(sheet.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer",
                  sheet.id === currentSheetId
                    ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                    : "bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface"
                )}
              >
                {sheet.name}
              </button>
              {sheets.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetToDelete(sheet);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-secondary hover:text-rose-500 rounded transition-opacity cursor-pointer -ml-2 mr-1"
                  title={`Delete sheet "${sheet.name}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setIsAddSheetModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors cursor-pointer text-xs font-bold"
            title="Add New Sheet"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sheet</span>
          </button>
        </div>

        {/* Aggregated Totals Bar */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-secondary text-[10px] uppercase font-bold block">Total QTLS</span>
            <span className="font-black text-on-surface">{stats.totalQty.toLocaleString()}</span>
          </div>
          <div className="h-6 w-px bg-outline-variant" />
          <div>
            <span className="text-secondary text-[10px] uppercase font-bold block">Total Amount</span>
            <span className="font-black text-on-surface">₹ {formatINR(stats.totalAmount)}</span>
          </div>
          <div className="h-6 w-px bg-outline-variant" />
          <div>
            <span className="text-secondary text-[10px] uppercase font-bold block">Total Net Due</span>
            <span className="font-black text-emerald-600">₹ {formatINR(stats.totalNetAmt)}</span>
          </div>
        </div>
      </div>

      {/* Due List PDF Options Modal */}
      <AnimatePresence>
        {isDueListModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline-variant rounded-2xl shadow-2xl p-6 w-full max-w-lg text-on-surface"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base tracking-tight">Due List PDF Generation</h3>
                    <p className="text-[11px] text-secondary font-medium">
                      Active Sheet: <span className="font-bold text-on-surface">{currentSheet.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDueListModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Option 1: Road */}
                <div>
                  <label className="text-[11px] font-bold text-secondary uppercase block mb-1">
                    Road
                  </label>
                  <select
                    value={dueListRoad}
                    onChange={(e) => setDueListRoad(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="All">All Roads</option>
                    {uniqueRoads.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Option 2: Status */}
                <div>
                  <label className="text-[11px] font-bold text-secondary uppercase block mb-1">
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Pending', label: 'Pending Only' },
                      { id: 'Cleared', label: 'Cleared Only' },
                      { id: 'All', label: 'All Statuses' }
                    ].map(st => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setDueListStatus(st.id as any)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                          dueListStatus === st.id
                            ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400 font-black shadow-xs"
                            : "bg-surface-container-low border-outline-variant text-secondary hover:text-on-surface"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option 3: Days Pending */}
                <div>
                  <label className="text-[11px] font-bold text-secondary uppercase block mb-1">
                    Days Pending
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={dueListDaysOp}
                      onChange={(e) => setDueListDaysOp(e.target.value as any)}
                      className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    >
                      <option value="all">All Days</option>
                      <option value=">">&gt; (Greater than)</option>
                      <option value="<">&lt; (Less than)</option>
                      <option value="=">= (Equal to)</option>
                      <option value=">=">&ge; (Greater or equal)</option>
                      <option value="<=">&le; (Less or equal)</option>
                      <option value="between">Between</option>
                    </select>

                    {dueListDaysOp !== 'all' && (
                      <input
                        type="number"
                        min="0"
                        placeholder="Days"
                        value={dueListDaysVal}
                        onChange={(e) => setDueListDaysVal(e.target.value)}
                        className="w-24 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    )}

                    {dueListDaysOp === 'between' && (
                      <>
                        <span className="text-xs text-secondary font-bold">to</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Max"
                          value={dueListDaysVal2}
                          onChange={(e) => setDueListDaysVal2(e.target.value)}
                          className="w-24 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* PDF Specifications Summary */}
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-[11px] text-secondary space-y-1">
                  <p className="font-bold text-on-surface">Exact 10 PDF Columns:</p>
                  <p className="font-mono text-[10px] text-secondary">
                    Date • Party Name • Party Loc • Miller Name • No. of Days Pending • Bill No • QTLs • Rate • Amount • LH
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                    ✓ PDF filters operate independently and will not alter the live grid view or sheet data.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setIsDueListModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateDueListPDF}
                    className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Generate PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Sheet Modal */}
      <AnimatePresence>
        {isAddSheetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline-variant rounded-2xl shadow-2xl p-6 w-full max-w-md text-on-surface"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base tracking-tight">Create New Sheet</h3>
                    <p className="text-[11px] text-secondary font-medium">Add by Month or Custom Sheet Name</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddSheetModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl mb-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCreateSheetMode('month')}
                  className={cn(
                    "py-1.5 rounded-lg transition-all cursor-pointer",
                    createSheetMode === 'month' ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-on-surface"
                  )}
                >
                  By Month
                </button>
                <button
                  type="button"
                  onClick={() => setCreateSheetMode('custom')}
                  className={cn(
                    "py-1.5 rounded-lg transition-all cursor-pointer",
                    createSheetMode === 'custom' ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-on-surface"
                  )}
                >
                  Custom Name
                </button>
              </div>

              <form onSubmit={handleCreateSheet} className="space-y-4">
                {createSheetMode === 'month' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-secondary uppercase block mb-1">Month</label>
                        <select
                          value={selectedSheetMonth}
                          onChange={(e) => setSelectedSheetMonth(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          {MONTH_NAMES.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-secondary uppercase block mb-1">Year</label>
                        <select
                          value={selectedSheetYear}
                          onChange={(e) => setSelectedSheetYear(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          {['2024', '2025', '2026', '2027', '2028'].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyMainEntriesForMonth}
                        onChange={(e) => setCopyMainEntriesForMonth(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <span>Copy matching records from Main Sheet ({selectedSheetMonth} {selectedSheetYear})</span>
                    </label>
                  </>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-secondary uppercase block mb-1">Sheet Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Special Consignment, Buffer..."
                      value={newSheetInputName}
                      onChange={(e) => setNewSheetInputName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setIsAddSheetModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Sheet</span>
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
                Are you sure you want to delete <span className="font-black text-on-surface">"{sheetToDelete.name}"</span>? All local rows on this sheet will be deleted.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setSheetToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (sheets.length <= 1) {
                      alert('Cannot delete the only remaining sheet.');
                      setSheetToDelete(null);
                      return;
                    }
                    const toDelId = sheetToDelete.id;
                    setSheets(prev => {
                      const next = prev.filter(s => s.id !== toDelId);
                      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(next));
                      return next;
                    });
                    if (currentSheetId === toDelId) {
                      const remaining = sheets.filter(s => s.id !== toDelId);
                      setCurrentSheetId(remaining[0]?.id || 'sheet-1');
                    }
                    setSheetToDelete(null);
                  }}
                  className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Delete Sheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Excel / CSV Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentSheetId={currentSheetId}
        currentSheetName={currentSheet.name}
        onImportComplete={(importedRows, mode) => {
          if (mode === 'overwrite') {
            setData(importedRows);
          } else {
            setData(prev => [...prev.filter(r => r && (r.partyName || r.millerName || r.billNo)), ...importedRows]);
          }
          setIsImportModalOpen(false);
        }}
      />

      {/* Column Visibility Modal */}
      <ColumnVisibilityModal
        isOpen={isColVisibilityOpen}
        onClose={() => setIsColVisibilityOpen(false)}
        columns={columns}
        hiddenColIds={hiddenColIds}
        onToggleColumn={(colId) => {
          setHiddenColIds(prev => {
            const next = new Set(prev);
            if (next.has(colId)) next.delete(colId);
            else next.add(colId);
            localStorage.setItem('arrival_entry_col_visibility', JSON.stringify(Array.from(next)));
            return next;
          });
        }}
        onShowAll={() => {
          setHiddenColIds(new Set());
          localStorage.removeItem('arrival_entry_col_visibility');
        }}
        onResetDefaults={() => {
          setHiddenColIds(new Set());
          localStorage.removeItem('arrival_entry_col_visibility');
        }}
      />

      {/* Manifest Camera Scanner Modal */}
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

      {/* Bill Photo Modal */}
      <BillPhotoModal
        isOpen={billPhotoModalState.isOpen}
        onClose={() => setBillPhotoModalState(prev => ({ ...prev, isOpen: false }))}
        row={billPhotoModalState.row}
        rowIndex={billPhotoModalState.rowIndex}
        onSavePhoto={(photoUrl) => {
          if (billPhotoModalState.rowIndex >= 0) {
            handleUpdateCell(billPhotoModalState.rowIndex, 'billPhoto', photoUrl);
          }
        }}
        onRemovePhoto={() => {
          if (billPhotoModalState.rowIndex >= 0) {
            handleUpdateCell(billPhotoModalState.rowIndex, 'billPhoto', '');
          }
        }}
      />

    </div>
  );
}
