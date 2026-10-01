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
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getRegisteredSuppliers, sanitizeSupplierName } from '../lib/utils';
import { getCollectionDocs, db, invalidateCollectionCache } from '../lib/firebase';
import { doc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ManifestCameraScanner, { ParsedManifestData } from '../components/ManifestCameraScanner';
import BillPhotoModal from '../components/BillPhotoModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ColumnVisibilityModal from '../components/ColumnVisibilityModal';
import ExcelColumnFilter, { FilterCondition as ExcelFilterCondition } from '../components/ExcelColumnFilter';
import { 
  getMonthYearFromDate, 
  getCurrentMonthYearSheetName, 
  getDefaultDateForSheetName, 
  isMeaningfulRow, 
  organizeArrivalSheetsByMonth 
} from '../utils/arrivalSheetsManager';
import { sortArrivalRowsOldestToNewest } from '../utils/excelImportEngine';
import { 
  normalizeDate,
  isValidDate,
  parseDateToObj,
  formatDateDisplay,
  formatDateDDMMYYYY,
  dateToTimestamp,
  computeDaysPending
} from '../utils/dateUtils';
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
  { id: 'noOfDays', label: 'NO. OF DAYS', width: 130, type: 'text', group: 'Logistics' },
  { id: 'noOfDayRec', label: 'PAYMENT STATUS', width: 140, type: 'select', options: ['Not Cleared', 'Cleared'], group: 'Logistics' },
  { id: 'area', label: 'BUYER AREA (SHOP)', width: 160, type: 'text', group: 'Meta' },
  { id: 'billNo', label: 'BILL NO', width: 140, type: 'text', group: 'Meta' },
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
  { id: 'purchaseOrderNo', label: 'purchase order no', width: 240, type: 'po-select', group: 'Fulfillment' }
];

const INITIAL_ROWS = 40;
const ROW_HEIGHT = 40; // Virtual row height in px
const OVERSCAN = 10;   // Buffer rows above and below visible viewport

const MONTH_MAP_LOWER: Record<string, number> = {
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

export const parseAnyDate = (val: any): Date | null => parseDateToObj(val);

export const formatDateToDDMMYYYY = (val: any): string => formatDateDisplay(val);

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
  return computeDaysPending(row?.date, row?.noOfDayRec, row?.chqDt);
};

const generateEmptyArrivalRows = (count = 100, defaultDate?: string): any[] => {
  const d = defaultDate || new Date().toISOString().split('T')[0];
  return Array(count).fill(0).map((_, i) => ({
    id: `row-empty-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
    date: d
  }));
};

export type FilterCondition = ExcelFilterCondition;

export const normalizeRowDaysAndStatus = (row: any) => {
  if (!row) return row;
  const dVal = String(row.noOfDays ?? '').trim();
  const sVal = String(row.noOfDayRec ?? '').trim();
  const isDStatus = /^(cleared|clear|paid|pending|not cleared|not-cleared|unpaid)$/i.test(dVal);
  const isSDays = /^\d+\s*days?$/i.test(sVal) || (!isNaN(Number(sVal)) && Number(sVal) > 0 && Number(sVal) < 1000);

  if (isDStatus && isSDays) {
    return {
      ...row,
      noOfDays: sVal,
      noOfDayRec: /clear|paid/i.test(dVal) ? 'Cleared' : 'Not Cleared'
    };
  } else if (isDStatus && !sVal) {
    return {
      ...row,
      noOfDays: '',
      noOfDayRec: /clear|paid/i.test(dVal) ? 'Cleared' : 'Not Cleared'
    };
  } else if (isSDays && !dVal) {
    return {
      ...row,
      noOfDays: sVal
    };
  }
  return row;
};

export default function ArrivalEntry() {
  interface Sheet {
    id: string;
    name: string;
    data: any[];
  }

  // Sheets state - Automatically organized into Month + Year sheets; "All Arrivals" is removed
  const [sheets, setSheets] = useState<Sheet[]>(() => {
    let initialSheets: Sheet[] = [];
    const savedSheets = localStorage.getItem('arrival_entry_sheets_v4');
    if (savedSheets) {
      try {
        const parsed = JSON.parse(savedSheets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialSheets = parsed;
        }
      } catch (e) {}
    }

    if (initialSheets.length === 0) {
      try {
        const fallbackData = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          initialSheets = [{ id: 'sheet-fallback', name: getCurrentMonthYearSheetName(), data: fallbackData }];
        }
      } catch (e) {}
    }

    const organized = organizeArrivalSheetsByMonth(initialSheets, [], INITIAL_ROWS);
    localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(organized.sheets));
    return organized.sheets;
  });

  // Automatically determine today's local date and open the corresponding Month + Year sheet
  const [currentSheetId, setCurrentSheetId] = useState<string>(() => {
    const currentMonthYear = getCurrentMonthYearSheetName();
    const found = sheets.find(s => s.name.toLowerCase() === currentMonthYear.toLowerCase());
    return found?.id || sheets[sheets.length - 1]?.id || `sheet-${currentMonthYear.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  });

  const currentSheet = useMemo(() => {
    const found = sheets.find(s => s.id === currentSheetId) || sheets[0];
    const defaultDate = found ? getDefaultDateForSheetName(found.name) : new Date().toISOString().split('T')[0];
    return {
      id: found?.id || 'sheet-current',
      name: found?.name || getCurrentMonthYearSheetName(),
      data: Array.isArray(found?.data) ? found.data : generateEmptyArrivalRows(INITIAL_ROWS, defaultDate)
    };
  }, [sheets, currentSheetId]);

  const data = useMemo(() => {
    const raw = Array.isArray(currentSheet?.data) ? currentSheet.data : [];
    return raw.map(normalizeRowDaysAndStatus);
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
  const [gridKey, setGridKey] = useState(0);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Filters & Sorting state
  const [columnFilters, setColumnFilters] = useState<Record<string, FilterCondition>>({});
  const [openFilterColId, setOpenFilterColId] = useState<string | null>(null);
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

  // Export XLS Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'current' | 'merge'>('current');
  const [selectedSheetsForMerge, setSelectedSheetsForMerge] = useState<string[]>([]);

  // Synchronize default selected sheets for merge when opening
  useEffect(() => {
    if (isExportModalOpen) {
      setSelectedSheetsForMerge(sheets.map(s => s.id));
    }
  }, [isExportModalOpen, sheets]);

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
  const [isDeletingSheet, setIsDeletingSheet] = useState(false);

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

  // Track sheets loaded from Firestore in this session to prevent repeated downloads
  const loadedSheetIdsRef = useRef<Set<string>>(new Set());
  // Track document IDs marked for deletion from Firestore
  const deletedDocIdsRef = useRef<Set<string>>(new Set());

  // Load active sheet entries from Firestore once on demand without downloading repeatedly
  useEffect(() => {
    let isMounted = true;
    async function loadSheetData() {
      if (loadedSheetIdsRef.current.has(currentSheetId)) return;
      loadedSheetIdsRef.current.add(currentSheetId);

      try {
        const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
        if (!isMounted || !Array.isArray(cloudArrivals) || cloudArrivals.length === 0) return;

        if (cloudArrivals.length > 0) {
          setSheets(prevSheets => {
            const organized = organizeArrivalSheetsByMonth(prevSheets, cloudArrivals, INITIAL_ROWS, currentSheetId);
            localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(organized.sheets));
            const activeSheet = organized.sheets.find(s => s.id === currentSheetId) || organized.sheets[0];
            if (activeSheet) {
              localStorage.setItem('arrival_entry_data_v4', JSON.stringify(activeSheet.data));
            }
            return organized.sheets;
          });
        }
      } catch (e) {
        console.warn('ArrivalEntry Firestore sheet load notice:', e);
      }
    }

    loadSheetData();
    return () => { isMounted = false; };
  }, [currentSheetId]);

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

  // Debounced Autosave for Dirty Rows & Deletions
  useEffect(() => {
    if (dirtyRowIds.current.size === 0 && deletedDocIdsRef.current.size === 0) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const dirtyIds = new Set(dirtyRowIds.current);
        const rowsToSave = data.filter(r => r && r.id && dirtyIds.has(r.id));
        const meaningfulRows = rowsToSave.filter(r => isMeaningfulRow(r));
        const emptiedRows = rowsToSave.filter(r => !isMeaningfulRow(r) && r && r.id && !String(r.id).startsWith('row-empty-'));

        emptiedRows.forEach(r => {
          deletedDocIdsRef.current.add(String(r.id));
        });

        const batch = writeBatch(db);
        let hasOps = false;

        // 1. Delete rows that were emptied or deleted
        if (deletedDocIdsRef.current.size > 0) {
          deletedDocIdsRef.current.forEach(delId => {
            if (delId && !delId.startsWith('row-empty-')) {
              batch.delete(doc(db, 'arrival_entries', delId));
              hasOps = true;
            }
          });
          deletedDocIdsRef.current.clear();
        }

        // 2. Save meaningful rows - preserve exact unique row.id to prevent collision
        if (meaningfulRows.length > 0) {
          meaningfulRows.forEach((row, idx) => {
            const existingId = row.id && !String(row.id).startsWith('row-empty-') ? String(row.id).replace(/^#/, '') : null;
            const cleanBill = row.billNo ? String(row.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
            const docId = existingId || (cleanBill ? `row-${currentSheetId}-${cleanBill}-${idx + 1}` : `row-${currentSheetId}-${idx + 1}-${Date.now()}`);
            const docRef = doc(db, 'arrival_entries', docId);
            batch.set(docRef, { ...row, id: docId, sheetId: currentSheetId, sheetName: currentSheet.name, lastUpdated: Date.now() }, { merge: true });
            hasOps = true;
          });
        }

        if (hasOps) {
          await batch.commit();
          invalidateCollectionCache('arrival_entries');
        }

        dirtyRowIds.current.clear();
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
        try {
          window.dispatchEvent(new CustomEvent('arrival-entry-updated'));
        } catch (e) {}
      } catch (err) {
        console.error('Autosave batch commit error:', err);
        setSaveStatus('failed');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, currentSheetId, currentSheet.name]);

  // Handle cell edit commit - supports rowId string or row index number
  const handleUpdateCell = useCallback((rowIdentifier: string | number, colId: string, val: any) => {
    saveToHistory();
    const newData = [...data];
    let idx = -1;
    if (typeof rowIdentifier === 'string') {
      idx = newData.findIndex(r => r && r.id === rowIdentifier);
    }
    if (idx === -1 && typeof rowIdentifier === 'number') {
      idx = rowIdentifier;
    }
    if (idx === -1 || !newData[idx]) return;

    let row = { ...newData[idx], [colId]: val, lastUpdated: Date.now() };

    // Standard business calculations if not overridden by explicit formula
    row = recalculateRowBusinessLogic(row);

    newData[idx] = row;
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

    // 8. Multi-column simultaneous filters with Excel/Google Sheets behavior
    Object.entries(columnFilters).forEach(([colId, filter]) => {
      if (!filter) return;
      const colDef = columns.find(c => c.id === colId);
      const colType = colDef?.type || (colId === 'noOfDays' ? 'number' : 'text');

      result = result.filter(row => {
        if (!row) return false;
        const rawVal = colId === 'noOfDays' ? getDaysPendingNum(row) : row[colId];

        // A. Filter by Values: Unique value checkbox selection
        if (filter.selectedValues && Array.isArray(filter.selectedValues)) {
          const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
          const key = isBlank ? '__BLANK__' : String(rawVal).trim();
          if (!filter.selectedValues.includes(key)) {
            return false;
          }
        }

        // B. Filter by Condition: Type-specific operator rule
        if (filter.operator && filter.operator !== 'none') {
          const op = filter.operator;
          const v1 = filter.value !== undefined ? String(filter.value).trim() : '';
          const v2 = filter.value2 !== undefined ? String(filter.value2).trim() : '';

          if (colType === 'date') {
            const rowD = parseAnyDate(rawVal);
            if (op === 'blank') return !rowD;
            if (op === 'notBlank') return !!rowD;
            if (!rowD) return false;

            rowD.setHours(0, 0, 0, 0);
            const tDate1 = parseAnyDate(v1);
            if (!tDate1) return true;
            tDate1.setHours(0, 0, 0, 0);

            const time = rowD.getTime();
            const t1 = tDate1.getTime();

            switch (op) {
              case 'equals': return time === t1;
              case 'before': return time < t1;
              case 'after': return time > t1;
              case 'onOrBefore': return time <= t1;
              case 'onOrAfter': return time >= t1;
              case 'between': {
                const tDate2 = parseAnyDate(v2);
                if (!tDate2) return time >= t1;
                tDate2.setHours(0, 0, 0, 0);
                const t2 = tDate2.getTime();
                const min = Math.min(t1, t2);
                const max = Math.max(t1, t2);
                return time >= min && time <= max;
              }
              default: return true;
            }
          } else if (colType === 'number' || colType === 'calc') {
            const num = parseFloat(String(rawVal ?? '').replace(/,/g, ''));
            const isNumNaN = isNaN(num);
            if (op === 'blank') return rawVal === undefined || rawVal === null || String(rawVal).trim() === '' || isNumNaN;
            if (op === 'notBlank') return !isNumNaN;
            if (isNumNaN) return false;

            const targetNum = parseFloat(v1);
            if (isNaN(targetNum)) return true;

            switch (op) {
              case 'equals': return num === targetNum;
              case 'notEquals': return num !== targetNum;
              case 'gt': return num > targetNum;
              case 'lt': return num < targetNum;
              case 'gte': return num >= targetNum;
              case 'lte': return num <= targetNum;
              case 'between': {
                const targetNum2 = parseFloat(v2);
                if (isNaN(targetNum2)) return num >= targetNum;
                const min = Math.min(targetNum, targetNum2);
                const max = Math.max(targetNum, targetNum2);
                return num >= min && num <= max;
              }
              default: return true;
            }
          } else {
            // Text comparison
            const str = String(rawVal ?? '').trim().toLowerCase();
            const target = v1.toLowerCase();
            const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';

            switch (op) {
              case 'blank': return isBlank;
              case 'notBlank': return !isBlank;
              case 'equals': return !isBlank && str === target;
              case 'notEquals': return isBlank || str !== target;
              case 'contains': return !isBlank && str.includes(target);
              case 'notContains': return isBlank || !str.includes(target);
              case 'startsWith': return !isBlank && str.startsWith(target);
              case 'endsWith': return !isBlank && str.endsWith(target);
              default: return true;
            }
          }
        }

        return true;
      });
    });

    // 9. Multi-column sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a ? a[sortConfig.colId] : '';
        const valB = b ? b[sortConfig.colId] : '';

        // Date comparison
        const colConfig = visibleColumns.find(c => c.id === sortConfig.colId);
        if (colConfig?.type === 'date' || sortConfig.colId === 'date' || sortConfig.colId === 'chqDt') {
          const timeA = dateToTimestamp(valA);
          const timeB = dateToTimestamp(valB);
          if (timeA !== timeB) {
            return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
          }
        }

        // Number comparison
        const numA = parseFloat(String(valA).replace(/,/g, ''));
        const numB = parseFloat(String(valB).replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
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
    sortConfig,
    visibleColumns
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
    if (!col) return;
    const targetRow = filteredData[r];
    if (col.id === 'billPhoto') {
      setBillPhotoModalState({ isOpen: true, rowIndex: r, row: targetRow });
      return;
    }

    setActiveCell({ r, c });
    setSelectionRange({ startR: r, startC: c, endR: r, endC: c });
    setIsEditing(true);

    const rawVal = targetRow ? targetRow[col.id] : '';
    setEditValue(rawVal !== undefined && rawVal !== null ? String(rawVal) : '');

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (inputRef.current.select) inputRef.current.select();
      }
    }, 10);
  }, [visibleColumns, filteredData]);

  const stopEditing = useCallback((save: boolean = true) => {
    if (save && activeCell && visibleColumns[activeCell.c]) {
      const targetRow = filteredData[activeCell.r];
      if (targetRow) {
        handleUpdateCell(targetRow.id || activeCell.r, visibleColumns[activeCell.c].id, editValue);
      }
    }
    setIsEditing(false);
  }, [activeCell, filteredData, visibleColumns, editValue, handleUpdateCell]);

  // Excel Copy (TSV) & Multi-Cell Paste
  const handleCopySelection = useCallback(() => {
    if (!activeCell) return;
    const startR = selectionRange ? Math.min(selectionRange.startR, selectionRange.endR) : activeCell.r;
    const endR = selectionRange ? Math.max(selectionRange.startR, selectionRange.endR) : activeCell.r;
    const startC = selectionRange ? Math.min(selectionRange.startC, selectionRange.endC) : activeCell.c;
    const endC = selectionRange ? Math.max(selectionRange.startC, selectionRange.endC) : activeCell.c;

    const rowsText: string[] = [];
    for (let r = startR; r <= endR; r++) {
      const row = filteredData[r];
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
  }, [activeCell, selectionRange, filteredData, visibleColumns]);

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

  // Auto-scroll grid horizontally and vertically to keep activeCell comfortably in view
  const ensureActiveCellVisible = useCallback((r: number, c: number) => {
    const container = gridContainerRef.current;
    if (!container) return;

    const ROW_HEADER_WIDTH = 48; // sticky row numbers on left
    const HEADER_HEIGHT = 44;     // sticky table headers on top
    const PADDING = 28;           // comfortable padding margin around cell

    // Horizontal calculation
    let colLeft = ROW_HEADER_WIDTH;
    for (let i = 0; i < c; i++) {
      colLeft += visibleColumns[i]?.width || 100;
    }
    const colWidth = visibleColumns[c]?.width || 100;
    const colRight = colLeft + colWidth;

    const viewportScrollLeft = container.scrollLeft;
    const viewportWidth = container.clientWidth;
    const visibleLeftBound = viewportScrollLeft + ROW_HEADER_WIDTH;
    const visibleRightBound = viewportScrollLeft + viewportWidth;

    if (colLeft - PADDING < visibleLeftBound) {
      const newScrollLeft = Math.max(0, colLeft - ROW_HEADER_WIDTH - PADDING);
      container.scrollLeft = newScrollLeft;
      if (topScrollRef.current) topScrollRef.current.scrollLeft = newScrollLeft;
    } else if (colRight + PADDING > visibleRightBound) {
      const newScrollLeft = colRight - viewportWidth + PADDING;
      container.scrollLeft = newScrollLeft;
      if (topScrollRef.current) topScrollRef.current.scrollLeft = newScrollLeft;
    }

    // Vertical calculation
    const cellTop = r * ROW_HEIGHT;
    const cellBottom = (r + 1) * ROW_HEIGHT;
    const viewportScrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const visibleTopBound = viewportScrollTop;
    const visibleBottomBound = viewportScrollTop + viewportHeight - HEADER_HEIGHT;

    if (cellTop - PADDING < visibleTopBound) {
      container.scrollTop = Math.max(0, cellTop - PADDING);
    } else if (cellBottom + PADDING > visibleBottomBound) {
      container.scrollTop = cellBottom - viewportHeight + HEADER_HEIGHT + PADDING;
    }
  }, [visibleColumns]);

  // Synchronize scroll position when active cell moves
  useEffect(() => {
    if (activeCell) {
      ensureActiveCellVisible(activeCell.r, activeCell.c);
    }
  }, [activeCell, ensureActiveCellVisible]);

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
          if (activeCell.r < filteredData.length - 1) setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
          else if (filteredData.length === data.length) addRow();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        stopEditing(true);
        if (e.shiftKey) {
          if (activeCell.c > 0) setActiveCell({ r: activeCell.r, c: activeCell.c - 1 });
        } else {
          if (activeCell.c < visibleColumns.length - 1) setActiveCell({ r: activeCell.r, c: activeCell.c + 1 });
          else if (activeCell.r < filteredData.length - 1) setActiveCell({ r: activeCell.r + 1, c: 0 });
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
        if (r < filteredData.length - 1) {
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
        } else if (filteredData.length === data.length) {
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

      case 'Home': {
        e.preventDefault();
        const targetR = (e.ctrlKey || e.metaKey) ? 0 : r;
        const targetC = 0;
        setActiveCell({ r: targetR, c: targetC });
        if (e.shiftKey) {
          setSelectionRange(prev => ({
            startR: prev ? prev.startR : r,
            startC: prev ? prev.startC : c,
            endR: targetR,
            endC: targetC
          }));
        } else {
          setSelectionRange({ startR: targetR, startC: targetC, endR: targetR, endC: targetC });
        }
        break;
      }

      case 'End': {
        e.preventDefault();
        const targetR = (e.ctrlKey || e.metaKey) ? Math.max(0, filteredData.length - 1) : r;
        const targetC = visibleColumns.length - 1;
        setActiveCell({ r: targetR, c: targetC });
        if (e.shiftKey) {
          setSelectionRange(prev => ({
            startR: prev ? prev.startR : r,
            startC: prev ? prev.startC : c,
            endR: targetR,
            endC: targetC
          }));
        } else {
          setSelectionRange({ startR: targetR, startC: targetC, endR: targetR, endC: targetC });
        }
        break;
      }

      case 'PageUp': {
        e.preventDefault();
        const pageSize = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 2);
        const nextR = Math.max(0, r - pageSize);
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
        break;
      }

      case 'PageDown': {
        e.preventDefault();
        const pageSize = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 2);
        const nextR = Math.min(Math.max(0, filteredData.length - 1), r + pageSize);
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
        break;
      }

      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          if (c > 0) {
            const nextC = c - 1;
            setActiveCell({ r, c: nextC });
            setSelectionRange({ startR: r, startC: nextC, endR: r, endC: nextC });
          } else if (r > 0) {
            const nextR = r - 1;
            const nextC = visibleColumns.length - 1;
            setActiveCell({ r: nextR, c: nextC });
            setSelectionRange({ startR: nextR, startC: nextC, endR: nextR, endC: nextC });
          }
        } else {
          if (c < visibleColumns.length - 1) {
            const nextC = c + 1;
            setActiveCell({ r, c: nextC });
            setSelectionRange({ startR: r, startC: nextC, endR: r, endC: nextC });
          } else if (r < filteredData.length - 1) {
            const nextR = r + 1;
            setActiveCell({ r: nextR, c: 0 });
            setSelectionRange({ startR: nextR, startC: 0, endR: nextR, endC: 0 });
          } else if (filteredData.length === data.length) {
            addRow();
            const nextR = r + 1;
            setActiveCell({ r: nextR, c: 0 });
            setSelectionRange({ startR: nextR, startC: 0, endR: nextR, endC: 0 });
          }
        }
        break;
      }

      case 'Enter':
      case 'F2':
        e.preventDefault();
        startEditing(r, c);
        break;

      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        saveToHistory();
        const nextData = [...data];
        const startR = selectionRange ? Math.min(selectionRange.startR, selectionRange.endR) : r;
        const endR = selectionRange ? Math.min(Math.max(selectionRange.startR, selectionRange.endR), filteredData.length - 1) : r;
        const startC = selectionRange ? Math.min(selectionRange.startC, selectionRange.endC) : c;
        const endC = selectionRange ? Math.min(Math.max(selectionRange.startC, selectionRange.endC), visibleColumns.length - 1) : c;

        for (let rowIdx = startR; rowIdx <= endR; rowIdx++) {
          const targetRow = filteredData[rowIdx];
          if (!targetRow) continue;
          const realIdx = nextData.findIndex(item => item && item.id === targetRow.id);
          if (realIdx === -1) continue;

          const updatedRow = { ...nextData[realIdx] };
          for (let colIdx = startC; colIdx <= endC; colIdx++) {
            const col = visibleColumns[colIdx];
            if (col && col.id) {
              updatedRow[col.id] = '';
              if (col.id === 'billNo') {
                updatedRow.billPhoto = '';
              }
            }
          }
          const recalculated = recalculateRowBusinessLogic(updatedRow);
          nextData[realIdx] = recalculated;
          if (recalculated.id) {
            dirtyRowIds.current.add(recalculated.id);
            if (!isMeaningfulRow(recalculated) && !String(recalculated.id).startsWith('row-empty-')) {
              deletedDocIdsRef.current.add(String(recalculated.id));
            }
          }
        }
        setData(nextData);
        break;
      }

      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          startEditing(r, c);
          setEditValue(e.key);
        }
        break;
    }
  };

  const handleDeleteSingleRow = useCallback((filteredRowIdx: number) => {
    saveToHistory();
    const targetRow = filteredData[filteredRowIdx];
    if (!targetRow) return;

    if (targetRow.id && !String(targetRow.id).startsWith('row-empty-')) {
      deletedDocIdsRef.current.add(String(targetRow.id));
    }

    const defaultDate = getDefaultDateForSheet(currentSheet.name);
    const replacementEmptyRow = {
      id: `row-empty-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: defaultDate,
      sheetId: currentSheetId,
      sheetName: currentSheet.name
    };

    const nextData = data.filter(r => r && r.id !== targetRow.id);
    if (nextData.length < INITIAL_ROWS) {
      nextData.push(replacementEmptyRow);
    }

    setData(nextData);
    setGridKey(k => k + 1);
  }, [data, filteredData, currentSheetId, currentSheet.name, saveToHistory, setData]);

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

  // Merge Sheets helper handlers
  const toggleSheetForMerge = (sheetId: string) => {
    setSelectedSheetsForMerge(prev => {
      if (prev.includes(sheetId)) {
        return prev.filter(id => id !== sheetId);
      } else {
        return [...prev, sheetId];
      }
    });
  };

  const moveMergeSheet = (index: number, direction: 'up' | 'down') => {
    setSelectedSheetsForMerge(prev => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const selectAllSheetsForMerge = () => {
    setSelectedSheetsForMerge(sheets.map(s => s.id));
  };

  const clearAllSheetsForMerge = () => {
    setSelectedSheetsForMerge([]);
  };

  // Export current sheet only (.xlsx)
  const exportCurrentSheet = () => {
    const preparedData = (currentSheet.data || [])
      .filter(row => isMeaningfulRow(row))
      .map(row => {
        const obj: Record<string, any> = {};
        visibleColumns.forEach(col => {
          let val = row[col.id];
          if (isFormula(val)) {
            const evaluated = evaluateFormula(val, currentSheet.data, currentSheet.data.indexOf(row));
            val = evaluated.error ? evaluated.error : evaluated.result;
          }
          if (col.type === 'date' && val) {
            val = formatDateDisplay(val);
          }
          obj[col.label] = val !== undefined && val !== null ? val : '';
        });
        return obj;
      });

    if (preparedData.length === 0) {
      alert(`No records to export in ${currentSheet.name}.`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(preparedData);
    const workbook = XLSX.utils.book_new();
    const cleanSheetName = (currentSheet.name || 'Arrival_Audit').substring(0, 31).replace(/[:\\/?*\[\]]/g, '_');
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const fileCleanName = (currentSheet.name || 'Arrivals').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Arrival_${fileCleanName}_${dd}-${mm}-${yyyy}.xlsx`);
    setIsExportModalOpen(false);
  };

  // Export merged sheets (ONE WORKSHEET ONLY, Header once at row 0, rows appended in sequence)
  const exportMergedSheets = () => {
    if (selectedSheetsForMerge.length === 0) {
      alert('Please select at least one sheet to merge and export.');
      return;
    }

    const headers = visibleColumns.map(col => col.label);
    const allRows: any[][] = [];

    selectedSheetsForMerge.forEach(sheetId => {
      const sheet = sheets.find(s => s.id === sheetId);
      if (!sheet || !Array.isArray(sheet.data)) return;

      const meaningfulRows = sheet.data.filter(row => isMeaningfulRow(row));
      meaningfulRows.forEach(row => {
        const rowValues = visibleColumns.map(col => {
          let val = row[col.id];
          if (isFormula(val)) {
            const evaluated = evaluateFormula(val, sheet.data, sheet.data.indexOf(row));
            val = evaluated.error ? evaluated.error : evaluated.result;
          }
          if (col.type === 'date' && val) {
            val = formatDateDisplay(val);
          }
          return val !== undefined && val !== null ? val : '';
        });
        allRows.push(rowValues);
      });
    });

    if (allRows.length === 0) {
      alert('None of the selected sheets contain meaningful records to export.');
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
    const workbook = XLSX.utils.book_new();
    // Exactly ONE worksheet only
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged_Arrivals');

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    XLSX.writeFile(workbook, `Arrivals_Merged_${dd}-${mm}-${yyyy}.xlsx`);
    setIsExportModalOpen(false);
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

    const newSheetId = `sheet-${sheetName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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

    // Mark as loaded in loadedSheetIdsRef so loadSheetData won't try to overwrite or wipe it
    loadedSheetIdsRef.current.add(newSheetId);

    setSheets(prev => {
      const next = [...prev, newSheet];
      const sorted = [...next].sort((a, b) => {
        const parseKey = (name: string) => {
          const parts = name.trim().split(' ');
          if (parts.length === 2) {
            const m = [
              'january', 'february', 'march', 'april', 'may', 'june',
              'july', 'august', 'september', 'october', 'november', 'december'
            ].indexOf(parts[0].toLowerCase());
            const y = parseInt(parts[1], 10);
            if (m !== -1 && !isNaN(y)) return y * 100 + m;
          }
          return 999999;
        };
        return parseKey(a.name) - parseKey(b.name);
      });
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(sorted));
      return sorted;
    });

    localStorage.setItem('arrival_entry_data_v4', JSON.stringify(initialRows));
    setCurrentSheetId(newSheetId);
    setGridKey(k => k + 1);
    setIsAddSheetModalOpen(false);
    setNewSheetInputName('');
  };

  // Delete sheet and purge all imported / created rows belonging to it from Firestore and local state
  const handleConfirmDeleteSheet = async (targetSheet: Sheet) => {
    if (sheets.length <= 1) {
      alert('Cannot delete the only remaining sheet.');
      setSheetToDelete(null);
      return;
    }

    setIsDeletingSheet(true);
    const toDelId = targetSheet.id;
    const toDelName = targetSheet.name;

    try {
      // 1. Collect all document IDs from local sheet data
      const docIdsToDelete = new Set<string>();
      (targetSheet.data || []).forEach(row => {
        if (row && row.id && !String(row.id).startsWith('row-empty-')) {
          docIdsToDelete.add(String(row.id));
        }
        if (row && row.billNo) {
          const cleanBill = String(row.billNo).trim().replace(/[^a-zA-Z0-9_-]/g, '');
          if (cleanBill) {
            docIdsToDelete.add(`row-${toDelId}-${cleanBill}`);
          }
        }
      });

      // 2. Query Firestore arrival_entries for all docs matching this sheetId, sheetName, or Month date
      try {
        const qBySheetId = query(collection(db, 'arrival_entries'), where('sheetId', '==', toDelId));
        const snap1 = await getDocs(qBySheetId);
        snap1.forEach(d => docIdsToDelete.add(d.id));

        if (toDelName) {
          const qBySheetName = query(collection(db, 'arrival_entries'), where('sheetName', '==', toDelName));
          const snap2 = await getDocs(qBySheetName);
          snap2.forEach(d => docIdsToDelete.add(d.id));
        }

        // Also check all documents in arrival_entries whose date matches toDelName (Month + Year)
        const allArrivalsSnap = await getDocs(collection(db, 'arrival_entries'));
        allArrivalsSnap.forEach(d => {
          const dData = d.data();
          if (dData) {
            const matchesSheetId = dData.sheetId === toDelId;
            const matchesSheetName = dData.sheetName === toDelName;
            const matchesDateMonth = dData.date && getMonthYearFromDate(dData.date) === toDelName;
            if (matchesSheetId || matchesSheetName || matchesDateMonth) {
              docIdsToDelete.add(d.id);
            }
          }
        });
      } catch (e) {
        console.warn('Notice querying Firestore for sheet deletion:', e);
      }

      // 3. Batch delete all identified documents in Firestore (max 400 per batch)
      if (docIdsToDelete.size > 0) {
        const docIdArray = Array.from(docIdsToDelete);
        const BATCH_SIZE = 400;
        for (let i = 0; i < docIdArray.length; i += BATCH_SIZE) {
          const chunk = docIdArray.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'arrival_entries', id));
          });
          await batch.commit();
        }
      }

      // 4. Invalidate collection cache so in-memory getCollectionDocs returns fresh data!
      invalidateCollectionCache('arrival_entries');

      // 5. Invalidate cache ref so this sheet is not loaded again
      loadedSheetIdsRef.current.delete(toDelId);

      // 6. Update local sheets state and localStorage
      const remainingSheets = sheets.filter(s => s.id !== toDelId);
      setSheets(remainingSheets);
      localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(remainingSheets));

      // 7. Switch active sheet if current sheet was deleted
      if (currentSheetId === toDelId) {
        const nextActive = remainingSheets[0];
        const nextId = nextActive ? nextActive.id : 'sheet-1';
        setCurrentSheetId(nextId);
        if (nextActive) {
          localStorage.setItem('arrival_entry_data_v4', JSON.stringify(nextActive.data));
        }
      }

      setGridKey(k => k + 1);

      try {
        window.dispatchEvent(new CustomEvent('arrival-entry-updated'));
      } catch (e) {}

    } catch (err) {
      console.error('Error deleting sheet and its data:', err);
      alert('Encountered an error while deleting sheet data from database.');
    } finally {
      setIsDeletingSheet(false);
      setSheetToDelete(null);
    }
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
    if (!activeCell || !filteredData[activeCell.r] || !visibleColumns[activeCell.c]) return '';
    const colId = visibleColumns[activeCell.c].id;
    return filteredData[activeCell.r][colId] ?? '';
  }, [activeCell, filteredData, visibleColumns]);

  return (
    <div className="w-full flex-1 flex flex-col h-full max-h-full min-h-0 bg-surface-container-lowest overflow-hidden select-none relative">
      
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
            onClick={() => setIsExportModalOpen(true)}
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
        key={`grid-viewport-${gridKey}`}
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleGridScroll}
        className="flex-1 min-h-0 overflow-auto bg-surface-container-lowest focus:outline-none scrollbar-thin select-none relative"
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

                  {/* Excel-Style Column Filter Component */}
                  <ExcelColumnFilter
                    column={col}
                    activeFilter={columnFilters[col.id]}
                    dataset={data}
                    isOpen={openFilterColId === col.id}
                    onClose={() => setOpenFilterColId(null)}
                    onApply={(newFilter) => {
                      setColumnFilters(prev => {
                        const next = { ...prev };
                        if (newFilter) {
                          next[col.id] = newFilter;
                        } else {
                          delete next[col.id];
                        }
                        return next;
                      });
                    }}
                    onSort={(dir) => {
                      setSortConfig({ colId: col.id, direction: dir });
                    }}
                    currentSort={sortConfig?.colId === col.id ? sortConfig.direction : null}
                    parseAnyDate={parseAnyDate}
                    formatDateToDDMMYYYY={formatDateToDDMMYYYY}
                    getDaysPendingNum={getDaysPendingNum}
                  />
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
                    "w-12 h-full border-r border-outline-variant/60 text-[10px] font-mono font-black flex items-center justify-center sticky left-0 z-20 cursor-pointer select-none group/row",
                    activeCell?.r === rIdx ? "bg-primary text-on-primary" : "bg-surface-container-high text-secondary"
                  )}
                >
                  <span className="group-hover/row:hidden">{rIdx + 1}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSingleRow(rIdx);
                    }}
                    className="hidden group-hover/row:flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-500/15 p-1 rounded cursor-pointer transition-colors"
                    title={`Delete row ${rIdx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                    displayVal = formatDateDisplay(rawVal);
                  }

                  // Days Pending formatting and cell badge styling
                  let daysBadgeClass: string | null = null;
                  if (col.id === 'noOfDays') {
                    // Check if row has an explicit preserved or imported value for noOfDays
                    const explicitVal = row?.noOfDays !== undefined && row?.noOfDays !== null && String(row?.noOfDays).trim() !== ''
                      ? String(row.noOfDays).trim()
                      : (row?.payment !== undefined && row?.payment !== null && String(row?.payment).trim() !== '' && !row?.noOfDays
                          ? String(row.payment).trim()
                          : '');

                    const hasDate = !!(row && row.date && isValidDate(row.date));
                    const daysNum = getDaysPendingNum(row);

                    if (explicitVal) {
                      displayVal = explicitVal;
                      const matchNum = explicitVal.match(/\d+/);
                      const numForBadge = matchNum ? parseInt(matchNum[0], 10) : NaN;
                      if (!isNaN(numForBadge)) {
                        if (numForBadge >= 0 && numForBadge <= 14) {
                          daysBadgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                        } else if (numForBadge >= 15 && numForBadge <= 28) {
                          daysBadgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                        } else if (numForBadge >= 29) {
                          daysBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/50 dark:border-rose-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none";
                        }
                      }
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
                                handleUpdateCell(row.id || rIdx, col.id, e.target.value);
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
                      ) : col.id === 'noOfDayRec' ? (
                        displayVal === 'Cleared' ? (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none">
                            Cleared
                          </span>
                        ) : displayVal === 'Not Cleared' ? (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/50 font-bold px-2 py-0.5 rounded text-[11px] leading-tight select-none">
                            Not Cleared
                          </span>
                        ) : (
                          <span className="text-secondary font-bold text-[11px]">
                            {String(displayVal ?? '')}
                          </span>
                        )
                      ) : col.id === 'billNo' ? (
                        <div className="flex items-center justify-between w-full h-full gap-1 overflow-hidden group/bill">
                          <span className="truncate font-mono font-bold">
                            {String(displayVal ?? '')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBillPhotoModalState({ isOpen: true, rowIndex: rIdx, row });
                            }}
                            className={cn(
                              "shrink-0 p-1 rounded-md transition-all cursor-pointer flex items-center gap-0.5",
                              row?.billPhoto
                                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-xs"
                                : "text-secondary/40 hover:text-primary hover:bg-primary/10 opacity-70 group-hover/bill:opacity-100"
                            )}
                            title={row?.billPhoto ? "View attached bill photo/document" : "Attach bill photo/document"}
                          >
                            {row?.billPhoto ? (
                              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Camera className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
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

          {/* Empty / No Matching Records State */}
          {filteredData.length === 0 && (
            <div className="absolute inset-x-0 top-24 flex flex-col items-center justify-center p-12 text-center z-10 pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-secondary mb-3 shadow-sm">
                <Filter className="w-6 h-6 opacity-40" />
              </div>
              <h3 className="text-sm font-black text-on-surface mb-1">No matching records found</h3>
              <p className="text-xs text-secondary mb-4 max-w-sm">
                No rows match your current column filters or search criteria.
              </p>
              <button
                onClick={handleClearQuickFilters}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Summary Bar & Sheet Tabs */}
      <div className="bg-surface border-t border-outline-variant px-4 py-2 flex items-center justify-between gap-4 shrink-0 text-xs select-none sticky bottom-0 z-30 shadow-xs">
        
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
                Are you sure you want to delete <span className="font-black text-on-surface">"{sheetToDelete.name}"</span>? All imported and recorded arrivals on this sheet will be permanently deleted from the database.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingSheet}
                  onClick={() => setSheetToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingSheet}
                  onClick={() => handleConfirmDeleteSheet(sheetToDelete)}
                  className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingSheet ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Data...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Sheet & Data</span>
                    </>
                  )}
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
        onImportComplete={(importedRows, mode, targetSheetNameParam) => {
          // Stable sort imported rows oldest to newest by Arrival Date
          const sortedImported = sortArrivalRowsOldestToNewest(importedRows).map(normalizeRowDaysAndStatus);

          // Determine target sheet:
          // 1. If targetSheetNameParam was explicitly provided from the Excel tab/sheet, prefer it.
          // 2. Otherwise use the active currentSheet.
          let resolvedTargetName = targetSheetNameParam || currentSheet.name;
          let targetSheetIdToActivate = currentSheetId;

          // Check if a sheet with this name already exists
          const existingSheet = sheets.find(s => s.name.toLowerCase() === resolvedTargetName.toLowerCase() || s.id === currentSheetId);
          if (existingSheet) {
            resolvedTargetName = existingSheet.name;
            targetSheetIdToActivate = existingSheet.id;
          } else {
            targetSheetIdToActivate = `sheet-${resolvedTargetName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          }

          // Ensure every imported row is assigned to the target sheet
          const preparedImported = sortedImported.map((row, rIdx) => ({
            ...row,
            sheetId: targetSheetIdToActivate,
            sheetName: resolvedTargetName,
            id: row.id || `row-${targetSheetIdToActivate}-${rIdx + 1}`
          }));

          // Update sheets directly and preserve all rows without scattering or dropping!
          setSheets(prevSheets => {
            const targetSheet = prevSheets.find(s => s.id === targetSheetIdToActivate || s.name.toLowerCase() === resolvedTargetName.toLowerCase());
            const currentNonEmpty = (targetSheet?.data || []).filter(r => isMeaningfulRow(r));
            const baseCurrent = mode === 'overwrite' ? [] : currentNonEmpty;

            const finalMeaningful = [...baseCurrent, ...preparedImported];
            const emptyPaddingCount = Math.max(0, INITIAL_ROWS - finalMeaningful.length);
            const finalData = [...finalMeaningful];
            const defaultDate = getDefaultDateForSheetName(resolvedTargetName);
            for (let i = 0; i < emptyPaddingCount; i++) {
              finalData.push({
                id: `row-empty-${Date.now()}-${finalData.length}-${Math.random().toString(36).substring(2, 6)}`,
                date: defaultDate,
                sheetId: targetSheetIdToActivate,
                sheetName: resolvedTargetName
              });
            }

            let found = false;
            const nextSheets = prevSheets.map(s => {
              if (s.id === targetSheetIdToActivate || s.name.toLowerCase() === resolvedTargetName.toLowerCase()) {
                found = true;
                return {
                  ...s,
                  id: targetSheetIdToActivate,
                  name: resolvedTargetName,
                  data: finalData
                };
              }
              return s;
            });

            if (!found) {
              nextSheets.push({
                id: targetSheetIdToActivate,
                name: resolvedTargetName,
                data: finalData
              });
            }

            localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(nextSheets));
            localStorage.setItem('arrival_entry_data_v4', JSON.stringify(finalData));
            return nextSheets;
          });

          // Switch active sheet to the one containing the imported rows
          setCurrentSheetId(targetSheetIdToActivate);

          // Reset all filters & search immediately so imported rows are not filtered out
          setColumnFilters({});
          setQuickSearch('');
          setQuickShopLoc('All');
          setQuickRoad('All');
          setQuickStatus('All');
          setQuickDaysOp('all');
          setQuickDaysVal('');
          setQuickDaysVal2('');
          setSelectedDueArea('All');
          setSortConfig(null);

          // Reset scroll to top
          setScrollTop(0);
          if (gridContainerRef.current) {
            gridContainerRef.current.scrollTop = 0;
          }

          // Invalidate Firestore cache ref so future sheet changes load fresh data
          loadedSheetIdsRef.current.clear();

          // Force virtual grid to remount and re-render without manual scroll or filter clicks
          setGridKey(k => k + 1);

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
          const targetId = billPhotoModalState.row?.id || billPhotoModalState.rowIndex;
          handleUpdateCell(targetId, 'billPhoto', photoUrl);
        }}
        onRemovePhoto={() => {
          const targetId = billPhotoModalState.row?.id || billPhotoModalState.rowIndex;
          handleUpdateCell(targetId, 'billPhoto', '');
        }}
      />

      {/* Export XLS Modal (Current Sheet or Merge Sheets) */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-xl text-on-surface overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base tracking-tight">Export Arrival Records</h3>
                    <p className="text-[11px] text-secondary font-medium">Download as Excel workbook (.xlsx)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1.5 text-secondary hover:text-on-surface hover:bg-surface-container rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="px-6 pt-4 pb-2 shrink-0">
                <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/60 gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setExportTab('current')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer',
                      exportTab === 'current'
                        ? 'bg-surface text-primary shadow-xs font-black'
                        : 'text-secondary hover:text-on-surface'
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Current Sheet Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportTab('merge')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer',
                      exportTab === 'merge'
                        ? 'bg-surface text-emerald-600 shadow-xs font-black'
                        : 'text-secondary hover:text-on-surface'
                    )}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Merge Sheets & Export</span>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-3 overflow-y-auto flex-1 space-y-4">
                {exportTab === 'current' ? (
                  <div className="py-2 space-y-4">
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-secondary">Active Sheet</span>
                        <h4 className="text-base font-black text-on-surface flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-primary" />
                          {currentSheet.name}
                        </h4>
                        <p className="text-xs text-secondary">
                          Contains {(currentSheet.data || []).filter(r => isMeaningfulRow(r)).length} recorded arrivals
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-500/20">
                          Ready to export
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-secondary leading-relaxed bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/40">
                      Exports all valid records from <span className="font-bold text-on-surface">{currentSheet.name}</span> with all visible columns, values, and calculated totals.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-on-surface">Select & Reorder Sheets to Merge</h4>
                        <p className="text-[11px] text-secondary">Output will be ONE single flat worksheet with a single header row</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllSheetsForMerge}
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-outline text-xs">•</span>
                        <button
                          type="button"
                          onClick={clearAllSheetsForMerge}
                          className="text-[11px] font-bold text-secondary hover:text-on-surface cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Ordered Sheet List: selected sheets displayed in order of selectedSheetsForMerge, then unselected sheets */}
                    <div className="border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/60 bg-surface-container-lowest max-h-64 overflow-y-auto">
                      {[
                        ...selectedSheetsForMerge.map(id => sheets.find(s => s.id === id)).filter(Boolean) as typeof sheets,
                        ...sheets.filter(s => !selectedSheetsForMerge.includes(s.id))
                      ].map(sheet => {
                        const isSelected = selectedSheetsForMerge.includes(sheet.id);
                        const seqIndex = selectedSheetsForMerge.indexOf(sheet.id);
                        const rowCount = (sheet.data || []).filter(r => isMeaningfulRow(r)).length;

                        return (
                          <div
                            key={sheet.id}
                            className={cn(
                              'px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors',
                              isSelected ? 'bg-surface hover:bg-surface-container-low/50' : 'opacity-60 bg-surface-container-low/30'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleSheetForMerge(sheet.id)}
                                className="cursor-pointer text-primary focus:outline-none"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-secondary" />
                                )}
                              </button>

                              {isSelected ? (
                                <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-700 text-[11px] font-black flex items-center justify-center shrink-0">
                                  #{seqIndex + 1}
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-md bg-surface-container text-secondary text-[11px] font-bold flex items-center justify-center shrink-0">
                                  -
                                </span>
                              )}

                              <div className="min-w-0">
                                <span className="text-xs font-black text-on-surface truncate block">
                                  {sheet.name}
                                </span>
                                <span className="text-[10px] text-secondary font-medium">
                                  {rowCount} records
                                </span>
                              </div>
                            </div>

                            {/* Reordering Controls (Only active for selected sheets) */}
                            {isSelected && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={seqIndex === 0}
                                  onClick={() => moveMergeSheet(seqIndex, 'up')}
                                  title="Move Up in export sequence"
                                  className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={seqIndex === selectedSheetsForMerge.length - 1}
                                  onClick={() => moveMergeSheet(seqIndex, 'down')}
                                  title="Move Down in export sequence"
                                  className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      💡 Merged XLS generates <span className="font-bold">ONE worksheet only</span>. Headers appear once at row 0, and records will be appended in sequence #1, #2, etc. Empty padding rows are automatically excluded.
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest/50 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>

                {exportTab === 'current' ? (
                  <button
                    type="button"
                    onClick={exportCurrentSheet}
                    className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {currentSheet.name} (.xlsx)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={exportMergedSheets}
                    disabled={selectedSheetsForMerge.length === 0}
                    className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Merged XLS ({selectedSheetsForMerge.length} Sheets)</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
