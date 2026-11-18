import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  User, 
  Building2, 
  FileText, 
  Package, 
  Truck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  MessageSquare,
  ExternalLink,
  Coins,
  Phone,
  ArrowUpRight,
  Printer,
  Download,
  Plus,
  Layers,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getDeletedArrivalIds } from '../lib/utils';
import { 
  OperationalPO, 
  fetchOperationalOrders, 
  formatQtl, 
  formatDifference,
  invalidateOperationalOrdersCache 
} from '../utils/orderOperations';
import { 
  getCollectionDocs, 
  setCollectionDoc, 
  markLedgerEntriesAsArrived 
} from '../lib/firebase';
import { 
  getMonthYearFromDate, 
  getCurrentMonthYearSheetName 
} from '../utils/arrivalSheetsManager';
import PrintEntriesPdfModal from '../components/PrintEntriesPdfModal';

export default function PendingLoadings() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OperationalPO[]>(() => {
    try {
      const cached = localStorage.getItem('cached_operational_orders');
      if (cached) {
        const all: OperationalPO[] = JSON.parse(cached);
        return all.filter(po => (po.poQtl > po.arrivalQtl) || po.status === 'Pending Loading' || po.status === 'Partial Arrival' || po.arrivalQtl === 0);
      }
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('cached_operational_orders');
      if (cached && JSON.parse(cached).length > 0) return false;
    } catch {}
    return true;
  });

  // Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // Modals & Expansion State
  const [selectedBuyerForModal, setSelectedBuyerForModal] = useState<string | null>(null);
  const [selectedPoForModal, setSelectedPoForModal] = useState<OperationalPO | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [copiedPoNumber, setCopiedPoNumber] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [viewingMillerBill, setViewingMillerBill] = useState<{ url: string; billNo: string; poNumber: string } | null>(null);

  // Separate Arrival Entry Modal State (Commodity Canvassing Manual Arrival)
  const [arrivalModalPo, setArrivalModalPo] = useState<OperationalPO | null>(null);
  const [arrivalModalTab, setArrivalModalTab] = useState<'manual' | 'existing'>('manual');
  const [manualArrivedQty, setManualArrivedQty] = useState<string>('');
  const [manualArrivalDate, setManualArrivalDate] = useState<string>('');
  const [manualBillNo, setManualBillNo] = useState<string>('');
  const [manualVehicleNo, setManualVehicleNo] = useState<string>('');
  const [manualRate, setManualRate] = useState<string>('');
  const [manualRemarks, setManualRemarks] = useState<string>('');
  const [manualSendWa, setManualSendWa] = useState<boolean>(true);
  const [isSavingArrival, setIsSavingArrival] = useState<boolean>(false);

  // Existing entries state for Tab 2
  const [existingArrivalSearch, setExistingArrivalSearch] = useState<string>('');
  const [existingArrivalRows, setExistingArrivalRows] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  // Load orders from canonical operational order service
  const loadOrdersData = async (forceFresh: boolean | any = true) => {
    setIsLoading(true);
    try {
      const fresh = typeof forceFresh === 'boolean' ? forceFresh : true;
      const allOrders = await fetchOperationalOrders(fresh);
      // Keep only POs where arrival has NOT been recorded, partial arrival, or pending load exists
      const pendingOnly = allOrders.filter(po => (po.poQtl > po.arrivalQtl) || po.status === 'Pending Loading' || po.status === 'Partial Arrival' || po.arrivalQtl === 0);
      setOrders(pendingOnly);
    } catch (e) {
      console.error('Failed to load pending loadings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersData();
  }, []);

  // Reactively reload when orders are placed or deleted from Placed Orders
  useEffect(() => {
    let timer: any = null;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        loadOrdersData(true);
      }, 300);
    };
    window.addEventListener('operational-orders-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('operational-orders-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Unique lists for Dropdown Filters
  const uniqueBuyers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o?.buyer) set.add(o.buyer); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o?.supplier) set.add(o.supplier); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o?.brand) set.add(o.brand); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  // Date boundary helpers for Date Filter
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filtered Pending Loadings (runs locally in-memory with zero Firestore reads)
  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      if (!po) return false;

      // 1. Search Query (PO number, Buyer, Supplier, Brand)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const poNo = (po.poNumber || '').toLowerCase();
        const subId = (po.subOrderId || '').toLowerCase();
        const buyer = (po.buyer || '').toLowerCase();
        const sup = (po.supplier || '').toLowerCase();
        const brand = (po.brand || '').toLowerCase();
        const bill = (po.billNo || '').toLowerCase();

        const poNoMatch = poNo.includes(q) || subId.includes(q);
        const buyerMatch = buyer.includes(q);
        const supMatch = sup.includes(q);
        const brandMatch = brand.includes(q);
        const billMatch = bill.includes(q);

        if (!poNoMatch && !buyerMatch && !supMatch && !brandMatch && !billMatch) {
          return false;
        }
      }

      // 2. Buyer Filter
      if (selectedBuyer !== 'all' && (po.buyer || '').toLowerCase() !== selectedBuyer.toLowerCase()) {
        return false;
      }

      // 3. Supplier Filter
      if (selectedSupplier !== 'all' && (po.supplier || '').toLowerCase() !== selectedSupplier.toLowerCase()) {
        return false;
      }

      // 4. Brand Filter
      if (selectedBrand !== 'all' && (po.brand || '').toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      // 5. Date Filter
      if (dateRange === 'today') {
        if (po.dateTimestamp < todayStart) return false;
      } else if (dateRange === 'yesterday') {
        if (po.dateTimestamp < yesterdayStart || po.dateTimestamp >= todayStart) return false;
      } else if (dateRange === 'week') {
        if (po.dateTimestamp < weekStart) return false;
      } else if (dateRange === 'month') {
        if (po.dateTimestamp < monthStart) return false;
      } else if (dateRange === 'custom' && customDate) {
        const targetDate = new Date(customDate);
        if (!isNaN(targetDate.getTime())) {
          const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
          const targetEnd = targetStart + 86400000;
          if (po.dateTimestamp < targetStart || po.dateTimestamp >= targetEnd) return false;
        }
      }

      return true;
    });
  }, [
    orders, 
    searchQuery, 
    selectedBuyer, 
    selectedSupplier, 
    selectedBrand, 
    dateRange, 
    customDate,
    todayStart,
    yesterdayStart,
    weekStart,
    monthStart
  ]);

  // Group Chronologically by PO Date (Section 2)
  const groupedOrders = useMemo(() => {
    const groups: { [dateKey: string]: { dateKey: string; timestamp: number; items: OperationalPO[] } } = {};

    filteredOrders.forEach(po => {
      const key = po.dateGroupKey || po.date;
      if (!groups[key]) {
        groups[key] = {
          dateKey: key,
          timestamp: po.dateTimestamp,
          items: []
        };
      }
      groups[key].items.push(po);
    });

    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredOrders]);

  // Operational Metrics
  const metrics = useMemo(() => {
    const totalPendingQtl = filteredOrders.reduce((sum, o) => sum + o.poQtl, 0);
    const totalEstimatedValue = filteredOrders.reduce((sum, o) => sum + (o.poQtl * (o.rate || 0)), 0);
    const buyersSet = new Set<string>();
    const suppliersSet = new Set<string>();

    filteredOrders.forEach(o => {
      if (o.buyer) buyersSet.add(o.buyer);
      if (o.supplier) suppliersSet.add(o.supplier);
    });

    return {
      totalOrders: filteredOrders.length,
      totalPendingQtl,
      totalEstimatedValue,
      uniqueBuyers: buyersSet.size,
      uniqueSuppliers: suppliersSet.size
    };
  }, [filteredOrders]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (dateRange !== 'all') count++;
    if (selectedBuyer !== 'all') count++;
    if (selectedSupplier !== 'all') count++;
    if (selectedBrand !== 'all') count++;
    return count;
  }, [searchQuery, dateRange, selectedBuyer, selectedSupplier, selectedBrand]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateRange('all');
    setCustomDate('');
    setSelectedBuyer('all');
    setSelectedSupplier('all');
    setSelectedBrand('all');
  };

  // Buyer Mini Profile Data (Section 7)
  const buyerProfileData = useMemo(() => {
    if (!selectedBuyerForModal) return null;
    const buyerName = selectedBuyerForModal;
    const buyerOrders = orders.filter(o => o.buyer.toLowerCase() === buyerName.toLowerCase());

    let totalPo = 0;
    let totalArrived = 0;
    let pending = 0;
    const suppliersSet = new Set<string>();

    buyerOrders.forEach(o => {
      totalPo += o.poQtl;
      totalArrived += o.arrivalQtl;
      pending += Math.max(0, o.poQtl - o.arrivalQtl);
      if (o.supplier) suppliersSet.add(o.supplier);
    });

    const recentOrders = [...buyerOrders]
      .sort((a, b) => b.dateTimestamp - a.dateTimestamp)
      .slice(0, 8);

    return {
      name: buyerName,
      totalOrders: buyerOrders.length,
      totalPoQtl: totalPo,
      totalArrivalQtl: totalArrived,
      pendingQtl: pending,
      suppliers: Array.from(suppliersSet),
      recentOrders
    };
  }, [selectedBuyerForModal, orders]);

  // Load existing manual arrival entries from local sheets & Firestore
  const loadExistingArrivalEntries = async (targetPo: OperationalPO) => {
    setIsLoadingExisting(true);
    try {
      const list: any[] = [];
      // 1. Read from localStorage sheets
      try {
        const sheetsRaw = localStorage.getItem('arrival_entry_sheets_v4') || localStorage.getItem('arrival_sheets');
        if (sheetsRaw) {
          const sheets = JSON.parse(sheetsRaw);
          if (Array.isArray(sheets)) {
            sheets.forEach(s => {
              if (Array.isArray(s.data)) {
                s.data.forEach((r: any) => {
                  if (r && (Number(r.qty) > 0 || r.partyName || r.billNo || r.millerName)) {
                    list.push({ ...r, sheetId: s.id, sheetName: s.name });
                  }
                });
              }
            });
          }
        }
      } catch {}

      // 2. Read single table fallback
      try {
        const single = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        if (Array.isArray(single)) {
          single.forEach((r: any) => {
            if (r && (Number(r.qty) > 0 || r.partyName || r.billNo || r.millerName)) {
              if (!list.some(x => x.id && x.id === r.id)) {
                list.push(r);
              }
            }
          });
        }
      } catch {}

      // 3. Cloud arrival entries
      try {
        const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
        if (Array.isArray(cloudArrivals)) {
          cloudArrivals.forEach((r: any) => {
            if (r && (Number(r.qty) > 0 || r.partyName || r.billNo || r.millerName)) {
              const existingIdx = list.findIndex(x => x.id === r.id);
              if (existingIdx === -1) {
                list.push(r);
              } else {
                list[existingIdx] = { ...list[existingIdx], ...r };
              }
            }
          });
        }
      } catch {}

      // 4. Deduplicate and filter out deleted arrivals
      const deletedArrivals = getDeletedArrivalIds();
      const uniqueMap = new Map<string, any>();
      list.forEach((r, idx) => {
        const rId = String(r.id || '').trim().toLowerCase();
        const rBill = String(r.billNo || '').trim().toLowerCase();
        if (rId && deletedArrivals.has(rId)) return;
        if (rBill && deletedArrivals.has(rBill)) return;

        const key = r.id || `${r.purchaseOrderNo || ''}_${r.billNo || ''}_${r.partyName || ''}_${r.qty || 0}_${idx}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, r);
        }
      });

      const activeList = Array.from(uniqueMap.values());

      // 5. Prioritize entries matching this buyer or without PO
      activeList.sort((a, b) => {
        const targetBuyerNorm = (targetPo.buyer || '').toLowerCase().trim();
        const aParty = String(a.partyName || a.buyer || '').toLowerCase().trim();
        const bParty = String(b.partyName || b.buyer || '').toLowerCase().trim();
        const aPartyMatch = targetBuyerNorm && aParty.includes(targetBuyerNorm);
        const bPartyMatch = targetBuyerNorm && bParty.includes(targetBuyerNorm);
        if (aPartyMatch && !bPartyMatch) return -1;
        if (!aPartyMatch && bPartyMatch) return 1;

        const aUnlinked = !a.purchaseOrderNo || a.purchaseOrderNo === targetPo.poNumber;
        const bUnlinked = !b.purchaseOrderNo || b.purchaseOrderNo === targetPo.poNumber;
        if (aUnlinked && !bUnlinked) return -1;
        if (!aUnlinked && bUnlinked) return 1;

        return String(b.date || '').localeCompare(String(a.date || ''));
      });

      setExistingArrivalRows(activeList);
    } catch (err) {
      console.error('Failed to load existing arrival entries:', err);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleOpenArrivalModal = (po: OperationalPO, tab: 'manual' | 'existing' = 'manual') => {
    setArrivalModalPo(po);
    setArrivalModalTab(tab);
    setExistingArrivalSearch('');

    const remQty = Math.max(0, po.poQtl - po.arrivalQtl);
    setManualArrivedQty(String(remQty > 0 ? remQty : po.poQtl));
    setManualArrivalDate(new Date().toISOString().split('T')[0]);
    setManualBillNo(po.billNo || (po as any).actualSupplierBillNo || '');
    setManualVehicleNo((po as any).vehicleNo || (po as any).truckNo || '');
    setManualRate(po.rate > 0 ? String(po.rate) : '');
    setManualRemarks(po.arrivalQtl > 0 ? 'Remaining balance arrival' : 'Separate arrival entry');
    setManualSendWa(true);

    loadExistingArrivalEntries(po);
  };

  const filteredExistingArrivals = useMemo(() => {
    if (!existingArrivalSearch.trim()) return existingArrivalRows;
    const q = existingArrivalSearch.toLowerCase().trim();
    return existingArrivalRows.filter((r: any) => {
      const party = String(r.partyName || r.buyer || '').toLowerCase();
      const miller = String(r.millerName || r.seller || '').toLowerCase();
      const bill = String(r.billNo || '').toLowerCase();
      const date = String(r.date || '').toLowerCase();
      const brand = String(r.brand || '').toLowerCase();
      const poNo = String(r.purchaseOrderNo || '').toLowerCase();
      return party.includes(q) || miller.includes(q) || bill.includes(q) || date.includes(q) || brand.includes(q) || poNo.includes(q);
    });
  }, [existingArrivalRows, existingArrivalSearch]);

  const handleSaveManualArrival = async () => {
    if (!arrivalModalPo) return;
    const qtyNum = parseFloat(manualArrivedQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Please enter a valid arrived quantity greater than 0 QTL.');
      return;
    }

    setIsSavingArrival(true);
    try {
      const po = arrivalModalPo;
      const arrivalDate = manualArrivalDate || new Date().toISOString().split('T')[0];
      const targetMonthYear = getMonthYearFromDate(arrivalDate) || getCurrentMonthYearSheetName();
      const expectedSheetId = `sheet-${targetMonthYear.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const cleanBill = manualBillNo.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      const canonicalEntryId = cleanBill 
        ? `row-${expectedSheetId}-${cleanBill}-${po.subOrderId || Date.now()}`
        : `row-${expectedSheetId}-manual-${Date.now()}`;

      const rateNum = parseFloat(manualRate) || po.rate || 0;
      const amountVal = qtyNum * rateNum;

      // 1. Prepare new arrival entry record
      const newArrivalRecord: any = {
        id: canonicalEntryId,
        date: arrivalDate,
        purchaseOrderNo: po.poNumber,
        mainPoNo: po.poNumber,
        subOrderId: po.subOrderId || undefined,
        millerName: po.supplier,
        seller: po.supplier,
        place: 'MIRYALGUDA',
        brand: po.brand,
        partyName: po.buyer,
        noOfDays: 0,
        noOfDayRec: 'Not Cleared',
        area: 'APMC Market Yard',
        billNo: manualBillNo.trim(),
        vehicleNo: manualVehicleNo.trim(),
        truckNo: manualVehicleNo.trim(),
        qty: qtyNum,
        rate: rateNum,
        amount: amountVal.toFixed(2),
        lh: 0,
        lhPerQtl: 0,
        cc: 0,
        tds: 0,
        shortage: 0,
        diffIn: 0,
        netAmt: amountVal.toFixed(2),
        chqAm: 0,
        chqNo: '',
        chqDt: '',
        bank: '',
        isLifted: false,
        remarks: manualRemarks.trim() || 'Manual separate arrival entry for pending PO',
        lastUpdated: new Date().toISOString()
      };

      // 2. Insert into arrival_entry_sheets_v4 in localStorage
      try {
        const rawSheets = localStorage.getItem('arrival_entry_sheets_v4') || localStorage.getItem('arrival_sheets');
        let sheets: any[] = [];
        if (rawSheets) {
          try { sheets = JSON.parse(rawSheets); } catch { sheets = []; }
        }
        if (!Array.isArray(sheets) || sheets.length === 0) {
          const localSingle = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
          sheets = [{ id: expectedSheetId, name: targetMonthYear, data: Array.isArray(localSingle) ? localSingle : [] }];
        }

        let sheetIdx = sheets.findIndex(s => s && (s.name?.toLowerCase() === targetMonthYear.toLowerCase() || s.id === expectedSheetId));
        if (sheetIdx === -1) {
          sheets.push({ id: expectedSheetId, name: targetMonthYear, data: [] });
          sheetIdx = sheets.length - 1;
        }

        const grid = Array.isArray(sheets[sheetIdx].data) ? [...sheets[sheetIdx].data] : [];
        const blankIdx = grid.findIndex((r: any) => !r || (!r.purchaseOrderNo && !r.partyName && !r.millerName && (!r.qty || parseFloat(r.qty) === 0)));
        if (blankIdx !== -1) {
          grid[blankIdx] = newArrivalRecord;
        } else {
          grid.push(newArrivalRecord);
        }
        sheets[sheetIdx].data = grid;
        localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(sheets));
        localStorage.setItem('arrival_entry_data_v4', JSON.stringify(grid));
      } catch (e) {
        console.error('Failed to update local arrival sheets:', e);
      }

      // Also persist entry in Firestore
      setCollectionDoc('arrival_entries', canonicalEntryId, newArrivalRecord).catch(err => {
        console.error('Cloud arrival entry save error:', err);
      });

      // 3. Update placed_orders in localStorage & Firestore
      let updatedTargetOrder: any = null;
      try {
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        if (Array.isArray(localPlaced)) {
          const updatedPlaced = localPlaced.map((ord: any) => {
            const normParent = (ord.purchaseOrderNo || ord.id || '').toUpperCase().replace(/^#/, '');
            const normPo = po.poNumber.toUpperCase().replace(/^#/, '');
            const isTargetOrder = normParent === normPo || ord.id === po.id || ord.id === (po.rawOrder?.parentOrderId || po.rawOrder?.id);

            if (ord.originalOrders && Array.isArray(ord.originalOrders)) {
              let matchedSub = false;
              const updatedSubs = ord.originalOrders.map((sub: any, sIdx: number) => {
                const subId = sub.id || sub.supplierSubOrderNo || `sub-${sIdx}`;
                const isSubMatch = (po.subOrderId && (subId === po.subOrderId || sub.id === po.subOrderId)) ||
                                  (isTargetOrder && sub.buyer && String(sub.buyer).toLowerCase() === String(po.buyer).toLowerCase());
                if (isSubMatch) {
                  matchedSub = true;
                  const priorArrived = Number(sub.arrivedQty) || 0;
                  const newTotalArrived = priorArrived + qtyNum;
                  const subTargetQty = Number(sub.qty || sub.totalQty) || po.poQtl;
                  const isFull = newTotalArrived >= subTargetQty;
                  return {
                    ...sub,
                    arrivedQty: newTotalArrived,
                    isArrived: isFull,
                    status: isFull ? 'Arrived' : 'Partial Arrival',
                    actualSupplierBillNo: manualBillNo.trim() || sub.actualSupplierBillNo,
                    vehicleNo: manualVehicleNo.trim() || sub.vehicleNo,
                    arrivedAt: arrivalDate
                  };
                }
                return sub;
              });

              if (matchedSub || isTargetOrder) {
                const allArrived = updatedSubs.every((s: any) => s.isArrived === true || s.status === 'Arrived');
                const anyArrived = updatedSubs.some((s: any) => (Number(s.arrivedQty) || 0) > 0 || s.isArrived === true);
                const updated = {
                  ...ord,
                  originalOrders: updatedSubs,
                  status: allArrived ? 'Arrived' : (anyArrived ? 'Partial Arrival' : ord.status),
                  isArrived: allArrived,
                  actualSupplierBillNo: manualBillNo.trim() || ord.actualSupplierBillNo,
                  vehicleNo: manualVehicleNo.trim() || ord.vehicleNo,
                  lastUpdated: new Date().toISOString()
                };
                updatedTargetOrder = updated;
                setCollectionDoc('placed_orders', ord.id, updated).catch(() => {});
                return updated;
              }
            } else if (isTargetOrder) {
              const priorArrived = Number(ord.arrivedQty) || 0;
              const newTotalArrived = priorArrived + qtyNum;
              const ordTargetQty = Number(ord.qty || ord.totalQty) || po.poQtl;
              const isFull = newTotalArrived >= ordTargetQty;
              const updated = {
                ...ord,
                arrivedQty: newTotalArrived,
                isArrived: isFull,
                status: isFull ? 'Arrived' : 'Partial Arrival',
                actualSupplierBillNo: manualBillNo.trim() || ord.actualSupplierBillNo,
                vehicleNo: manualVehicleNo.trim() || ord.vehicleNo,
                arrivedAt: arrivalDate,
                lastUpdated: new Date().toISOString()
              };
              updatedTargetOrder = updated;
              setCollectionDoc('placed_orders', ord.id, updated).catch(() => {});
              return updated;
            }
            return ord;
          });

          localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
        }
      } catch (e) {
        console.error('Failed to update placed_orders:', e);
      }

      // 4. Mark ledgers as arrived
      if (updatedTargetOrder) {
        markLedgerEntriesAsArrived(po.poNumber, updatedTargetOrder, undefined, undefined, po.subOrderId).catch(err => {
          console.error('Ledger arrival sync error:', err);
        });
      }

      // 5. Invalidate cache & notify views
      invalidateOperationalOrdersCache();
      window.dispatchEvent(new CustomEvent('operational-orders-updated'));
      window.dispatchEvent(new CustomEvent('ledgers-updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      // 6. Optionally trigger WhatsApp
      if (manualSendWa) {
        const remainingAfter = Math.max(0, po.poQtl - (po.arrivalQtl + qtyNum));
        const billStr = manualBillNo.trim() ? `\n📄 Mill / Lorry Bill: *${manualBillNo.trim()}*` : '';
        const lorryStr = manualVehicleNo.trim() ? `\n🚛 Truck / Vehicle: *${manualVehicleNo.trim()}*` : '';
        
        const waText = `Hello *${po.buyer}*,\n\nUpdate from *Tejas Canvassing* regarding PO *${po.poNumber}*:\n\n*Your remaining order is arriving!*\n\n🌾 Brand: *${po.brand}*\n⚖️ Newly Arrived Load: *${formatQtl(qtyNum)} QTL*\n📋 Total Contracted PO: *${formatQtl(po.poQtl)} QTL* (Total Arrived: *${formatQtl(po.arrivalQtl + qtyNum)} QTL*${remainingAfter > 0 ? `, Remaining Balance: *${formatQtl(remainingAfter)} QTL*` : ', Fulfilled ✓'})\n🏢 Supplier Mill: *${po.supplier}*${billStr}${lorryStr}\n\nYour shipment has arrived at the destination APMC Yard. We are unloading now.\n\nThank you,\n*Tejas Canvassing*`;
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank');
      }

      // 7. Close modal and reload
      setArrivalModalPo(null);
      await loadOrdersData(true);
    } catch (err) {
      console.error('Failed to save manual arrival entry:', err);
      alert('Failed to save arrival entry. Please try again.');
    } finally {
      setIsSavingArrival(false);
    }
  };

  const handleSelectExistingArrival = async (selectedRow: any) => {
    if (!arrivalModalPo || !selectedRow) return;
    setIsSavingArrival(true);
    try {
      const po = arrivalModalPo;
      const arrivedQty = parseFloat(selectedRow.qty) || 0;
      const billNo = String(selectedRow.billNo || '').trim();
      const vehicleNo = String(selectedRow.vehicleNo || selectedRow.truckNo || '').trim();
      const arrivalDate = selectedRow.date || new Date().toISOString().split('T')[0];

      // 1. Update this arrival row in sheets with poNumber and subOrderId
      try {
        const rawSheets = localStorage.getItem('arrival_entry_sheets_v4') || localStorage.getItem('arrival_sheets');
        if (rawSheets) {
          const sheets = JSON.parse(rawSheets);
          if (Array.isArray(sheets)) {
            let modified = false;
            sheets.forEach(s => {
              if (Array.isArray(s.data)) {
                s.data.forEach((r: any, idx: number) => {
                  if (r && (r.id === selectedRow.id || (r.billNo === selectedRow.billNo && r.partyName === selectedRow.partyName && r.qty === selectedRow.qty))) {
                    s.data[idx] = {
                      ...r,
                      purchaseOrderNo: po.poNumber,
                      mainPoNo: po.poNumber,
                      subOrderId: po.subOrderId || undefined,
                      partyName: po.buyer,
                      millerName: po.supplier || r.millerName,
                      brand: po.brand || r.brand,
                      lastUpdated: new Date().toISOString()
                    };
                    modified = true;
                  }
                });
              }
            });
            if (modified) {
              localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(sheets));
            }
          }
        }

        // Also update in single table
        const single = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        if (Array.isArray(single)) {
          let singleMod = false;
          single.forEach((r: any, idx: number) => {
            if (r && (r.id === selectedRow.id || (r.billNo === selectedRow.billNo && r.partyName === selectedRow.partyName))) {
              single[idx] = {
                ...r,
                purchaseOrderNo: po.poNumber,
                mainPoNo: po.poNumber,
                subOrderId: po.subOrderId || undefined,
                partyName: po.buyer,
                millerName: po.supplier || r.millerName,
                brand: po.brand || r.brand,
                lastUpdated: new Date().toISOString()
              };
              singleMod = true;
            }
          });
          if (singleMod) {
            localStorage.setItem('arrival_entry_data_v4', JSON.stringify(single));
          }
        }
      } catch (e) {
        console.error('Failed to update arrival sheet row:', e);
      }

      // Also update in Firestore arrival_entries
      if (selectedRow.id) {
        setCollectionDoc('arrival_entries', selectedRow.id, {
          ...selectedRow,
          purchaseOrderNo: po.poNumber,
          mainPoNo: po.poNumber,
          subOrderId: po.subOrderId || undefined,
          partyName: po.buyer,
          millerName: po.supplier || selectedRow.millerName,
          brand: po.brand || selectedRow.brand,
          lastUpdated: new Date().toISOString()
        }).catch(() => {});
      }

      // 2. Update placed_orders with newly linked arrived qty
      let updatedTargetOrder: any = null;
      try {
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        if (Array.isArray(localPlaced)) {
          const updatedPlaced = localPlaced.map((ord: any) => {
            const normParent = (ord.purchaseOrderNo || ord.id || '').toUpperCase().replace(/^#/, '');
            const normPo = po.poNumber.toUpperCase().replace(/^#/, '');
            const isTargetOrder = normParent === normPo || ord.id === po.id || ord.id === (po.rawOrder?.parentOrderId || po.rawOrder?.id);

            if (ord.originalOrders && Array.isArray(ord.originalOrders)) {
              let matchedSub = false;
              const updatedSubs = ord.originalOrders.map((sub: any, sIdx: number) => {
                const subId = sub.id || sub.supplierSubOrderNo || `sub-${sIdx}`;
                const isSubMatch = (po.subOrderId && (subId === po.subOrderId || sub.id === po.subOrderId)) ||
                                  (isTargetOrder && sub.buyer && String(sub.buyer).toLowerCase() === String(po.buyer).toLowerCase());
                if (isSubMatch) {
                  matchedSub = true;
                  const priorArrived = Number(sub.arrivedQty) || 0;
                  const newTotalArrived = priorArrived + arrivedQty;
                  const subTargetQty = Number(sub.qty || sub.totalQty) || po.poQtl;
                  const isFull = newTotalArrived >= subTargetQty;
                  return {
                    ...sub,
                    arrivedQty: newTotalArrived,
                    isArrived: isFull,
                    status: isFull ? 'Arrived' : 'Partial Arrival',
                    actualSupplierBillNo: billNo || sub.actualSupplierBillNo,
                    vehicleNo: vehicleNo || sub.vehicleNo,
                    arrivedAt: arrivalDate
                  };
                }
                return sub;
              });

              if (matchedSub || isTargetOrder) {
                const allArrived = updatedSubs.every((s: any) => s.isArrived === true || s.status === 'Arrived');
                const anyArrived = updatedSubs.some((s: any) => (Number(s.arrivedQty) || 0) > 0 || s.isArrived === true);
                const updated = {
                  ...ord,
                  originalOrders: updatedSubs,
                  status: allArrived ? 'Arrived' : (anyArrived ? 'Partial Arrival' : ord.status),
                  isArrived: allArrived,
                  actualSupplierBillNo: billNo || ord.actualSupplierBillNo,
                  vehicleNo: vehicleNo || ord.vehicleNo,
                  lastUpdated: new Date().toISOString()
                };
                updatedTargetOrder = updated;
                setCollectionDoc('placed_orders', ord.id, updated).catch(() => {});
                return updated;
              }
            } else if (isTargetOrder) {
              const priorArrived = Number(ord.arrivedQty) || 0;
              const newTotalArrived = priorArrived + arrivedQty;
              const ordTargetQty = Number(ord.qty || ord.totalQty) || po.poQtl;
              const isFull = newTotalArrived >= ordTargetQty;
              const updated = {
                ...ord,
                arrivedQty: newTotalArrived,
                isArrived: isFull,
                status: isFull ? 'Arrived' : 'Partial Arrival',
                actualSupplierBillNo: billNo || ord.actualSupplierBillNo,
                vehicleNo: vehicleNo || ord.vehicleNo,
                arrivedAt: arrivalDate,
                lastUpdated: new Date().toISOString()
              };
              updatedTargetOrder = updated;
              setCollectionDoc('placed_orders', ord.id, updated).catch(() => {});
              return updated;
            }
            return ord;
          });

          localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
        }
      } catch (e) {
        console.error('Failed to update placed_orders for linked arrival:', e);
      }

      // 3. Mark ledgers as arrived
      if (updatedTargetOrder) {
        markLedgerEntriesAsArrived(po.poNumber, updatedTargetOrder, undefined, undefined, po.subOrderId).catch(() => {});
      }

      // 4. Invalidate cache & notify
      invalidateOperationalOrdersCache();
      window.dispatchEvent(new CustomEvent('operational-orders-updated'));
      window.dispatchEvent(new CustomEvent('ledgers-updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      setArrivalModalPo(null);
      await loadOrdersData(true);
    } catch (err) {
      console.error('Failed to link arrival entry:', err);
      alert('Failed to link arrival entry. Please try again.');
    } finally {
      setIsSavingArrival(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#fafaf9] dark:bg-[#09090b] text-slate-900 dark:text-slate-100 font-sans antialiased">
      
      {/* 1. Header Workspace Bar */}
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 md:px-8 py-4 shrink-0 sticky top-0 z-20 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Pending Loadings
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                    Awaiting Physical Arrival
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Orders Dispatched • Automatically Removed When Arrival Entry is Recorded
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs btn-tactile active:scale-95"
              title="Print entries as PDF with buyer, supplier, and month filters"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PDF</span>
            </button>
            <button
              onClick={loadOrdersData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-rose-500/40 hover:text-rose-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 btn-tactile"
              title="Refresh pending loadings"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-rose-500")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">

        {/* 2. Compact Operational Metrics - Premium Floating Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <motion.div 
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="floating-card p-4 rounded-2xl border border-rose-200/60 dark:border-rose-900/30 shadow-2xs space-y-1 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending Orders
            </span>
            <div className="flex items-baseline justify-between relative z-10">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {metrics.totalOrders}
              </span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">Awaiting Physical Arrival</span>
          </motion.div>

          <motion.div 
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="floating-card p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/30 shadow-2xs space-y-1 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Volume in Transit
            </span>
            <div className="flex items-baseline justify-between relative z-10">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.totalPendingQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">Total Contracted QTL</span>
          </motion.div>

          <motion.div 
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="floating-card p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 shadow-2xs space-y-1 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Estimated Pipeline
            </span>
            <div className="flex items-baseline justify-between relative z-10">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{formatINR(metrics.totalEstimatedValue)}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">Cargo Value in Movement</span>
          </motion.div>

          <motion.div 
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="floating-card p-4 rounded-2xl border border-sky-200/60 dark:border-sky-900/30 shadow-2xs space-y-1 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-sky-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Consignees & Mills
            </span>
            <div className="flex items-baseline justify-between relative z-10">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.uniqueBuyers} <span className="text-xs font-normal text-slate-400">/ {metrics.uniqueSuppliers} Mills</span>
              </span>
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">Active Trade Counterparts</span>
          </motion.div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pending loadings by PO number, buyer, supplier/miller, or brand..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mr-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-neutral-900 rounded-xl p-0.5 border border-slate-200/60 dark:border-neutral-800 text-xs">
              {(['all', 'today', 'yesterday', 'week', 'month'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setDateRange(tab);
                    setCustomDate('');
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer",
                    dateRange === tab 
                      ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  {tab === 'all' ? 'All Dates' : tab === 'week' ? '7 Days' : tab === 'month' ? 'This Month' : tab}
                </button>
              ))}
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateRange('custom');
                }}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-bold rounded-lg bg-transparent text-slate-600 dark:text-slate-300 border-0 focus:outline-none cursor-pointer",
                  dateRange === 'custom' && "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white"
                )}
                title="Pick custom date"
              />
            </div>

            {/* Buyer Dropdown */}
            <select
              value={selectedBuyer}
              onChange={(e) => setSelectedBuyer(e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/20",
                selectedBuyer !== 'all'
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-rose-900 dark:text-rose-300"
                  : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <option value="all">All Buyers ({uniqueBuyers.length})</option>
              {uniqueBuyers.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Supplier / Miller Dropdown */}
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/20",
                selectedSupplier !== 'all'
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-rose-900 dark:text-rose-300"
                  : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <option value="all">All Suppliers ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Brand Dropdown */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/20",
                selectedBrand !== 'all'
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-rose-900 dark:text-rose-300"
                  : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <option value="all">All Brands ({uniqueBrands.length})</option>
              {uniqueBrands.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Operational List (Section 5) */}
        {groupedOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#121214] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              All Contracted Cargo Has Arrived
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no purchase orders awaiting physical arrival. Recorded arrivals are tracked in the Purchase Order Ledger.
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear Active Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedOrders.map(group => {
              const groupPendingQtl = group.items.reduce((s, it) => s + Math.max(0, it.poQtl - it.arrivalQtl), 0);

              return (
                <div key={group.dateKey} className="space-y-2">
                  {/* Daily Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {group.dateKey}
                      </h2>
                      <span className="text-xs text-slate-500 font-medium">
                        ({group.items.length} {group.items.length === 1 ? 'Pending PO' : 'Pending POs'})
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-500 font-medium">
                      Pending Volume: <strong className="text-rose-600 dark:text-rose-400 font-semibold">{groupPendingQtl.toLocaleString()} QTL</strong>
                    </div>
                  </div>

                  {/* Clean Operational Table: Date | PO No. | Buyer | Supplier/Miller | Brand | PO QTL | Arrival QTL | Pending QTL | Rate / QTL */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121214] shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50/75 dark:bg-neutral-900/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="w-9 py-3.5 px-2 text-center"></th>
                          <th className="py-3.5 px-3.5">Date</th>
                          <th className="py-3.5 px-3.5">PO No.</th>
                          <th className="py-3.5 px-3.5">Buyer</th>
                          <th className="py-3.5 px-3.5">Supplier / Miller</th>
                          <th className="py-3.5 px-3.5">Brand</th>
                          <th className="py-3.5 px-3.5 text-right">PO QTL</th>
                          <th className="py-3.5 px-3.5 text-right">Arrival QTL</th>
                          <th className="py-3.5 px-3.5 text-right">Pending QTL</th>
                          <th className="py-3.5 px-3.5 text-right">Rate / QTL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {group.items.map(po => {
                          const isExpanded = expandedPoId === po.id;
                          const estVal = Math.max(0, po.poQtl - po.arrivalQtl) * (po.rate || 0);

                          return (
                            <React.Fragment key={po.id}>
                              <tr 
                                className={cn(
                                  "hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors cursor-pointer",
                                  isExpanded && "bg-rose-500/5 dark:bg-rose-500/10"
                                )}
                                onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                              >
                                {/* Dropdown Chevron Toggle */}
                                <td className="w-9 py-3.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedPoId(isExpanded ? null : po.id);
                                    }}
                                    className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all btn-tactile cursor-pointer"
                                    title={isExpanded ? "Collapse row" : "Expand order details"}
                                  >
                                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180 text-rose-500")} />
                                  </button>
                                </td>

                                {/* Date (Short: e.g. 30 Sep) */}
                                <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-xs font-medium">
                                  {po.dateShort}
                                </td>

                                {/* PO No (Clickable for PO details) */}
                                <td className="py-3.5 px-3.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPoForModal(po);
                                    }}
                                    className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400 hover:underline hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer btn-tactile"
                                    title="Click to view PO details"
                                  >
                                    <span>{po.subOrderId ? `${po.subOrderId} (${po.poNumber})` : po.poNumber}</span>
                                  </button>
                                </td>

                                {/* Buyer (Clickable for Buyer Mini Profile) */}
                                <td className="py-3.5 px-3.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBuyerForModal(po.buyer);
                                    }}
                                    className="font-semibold text-xs text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline text-left cursor-pointer transition-colors btn-tactile"
                                    title={`View buyer profile for ${po.buyer}`}
                                  >
                                    {po.buyer}
                                  </button>
                                </td>

                                {/* Supplier / Miller */}
                                <td className="py-3.5 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                  <div>{po.supplier}</div>
                                  {((po as any).vehicleNo || (po as any).truckNo) && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-bold">
                                      <Truck className="w-3 h-3 shrink-0" />
                                      <span>{(po as any).vehicleNo || (po as any).truckNo}</span>
                                    </div>
                                  )}
                                </td>

                                {/* Brand */}
                                <td className="py-3.5 px-3.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200/60 dark:border-white/10">
                                    {po.brand}
                                  </span>
                                </td>

                                {/* PO QTL */}
                                <td className="py-3.5 px-3.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-white whitespace-nowrap">
                                  {po.poQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </td>

                                {/* Arrival QTL (Green if excess/fulfilled, Red if less) */}
                                <td className="py-3.5 px-3.5 text-right font-mono text-xs whitespace-nowrap">
                                  {po.arrivalQtl > po.poQtl ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400" title="Excess Quantity Arrived">
                                      {po.arrivalQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                    </span>
                                  ) : po.arrivalQtl < po.poQtl && po.arrivalQtl > 0 ? (
                                    <span className="font-bold text-rose-600 dark:text-rose-400" title="Less Quantity Arrived (Shortfall)">
                                      {po.arrivalQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                    </span>
                                  ) : po.arrivalQtl === 0 ? (
                                    <span className="font-bold text-rose-600 dark:text-rose-400" title="Awaiting Arrival">
                                      0
                                    </span>
                                  ) : (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400" title="Full Quantity Arrived">
                                      {po.arrivalQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                    </span>
                                  )}
                                </td>

                                {/* Pending QTL (Red if pending/shortfall, Green if excess) */}
                                <td className="py-3.5 px-3.5 text-right whitespace-nowrap font-mono text-xs">
                                  {po.arrivalQtl > po.poQtl ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 inline-block">
                                      +{ (po.arrivalQtl - po.poQtl).toLocaleString('en-IN', { maximumFractionDigits: 1 }) } QTL (Excess)
                                    </span>
                                  ) : po.arrivalQtl < po.poQtl ? (
                                    <span className="font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 inline-block">
                                      { (po.poQtl - po.arrivalQtl).toLocaleString('en-IN', { maximumFractionDigits: 1 }) } QTL (Pending)
                                    </span>
                                  ) : (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 inline-block">
                                      0 QTL (Fulfilled)
                                    </span>
                                  )}
                                </td>

                                {/* Rate / QTL */}
                                <td className="py-3.5 px-3.5 text-right font-mono font-semibold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {po.rate > 0 ? `₹ ${formatINR(po.rate)}` : '—'}
                                </td>
                              </tr>

                              {/* Dropdown Drawer Bento Row */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr className="table-dropdown-drawer">
                                    <td colSpan={10} className="p-0">
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.22, ease: "easeInOut" }}
                                        className="overflow-hidden p-4 sm:p-5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                          {/* Card 1: PO & Valuation Snapshot */}
                                          <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-white/10 space-y-2 text-left shadow-2xs">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5" />
                                                Order Contract
                                              </span>
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                                {po.arrivalQtl > po.poQtl ? 'Excess Arrived' : po.arrivalQtl > 0 ? 'Partial Arrival' : 'Awaiting Arrival'}
                                              </span>
                                            </div>
                                            <div>
                                              <p className="text-xs font-mono font-black text-slate-900 dark:text-white">
                                                {po.subOrderId ? `${po.subOrderId} • ${po.poNumber}` : po.poNumber}
                                              </p>
                                              <p className="text-[11px] text-slate-500">Contract Date: {po.date}</p>
                                            </div>
                                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1">
                                              <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">Contracted PO:</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">{po.poQtl} QTL</span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">Recorded Arrival:</span>
                                                <span className={cn(
                                                  "font-mono font-bold",
                                                  po.arrivalQtl > po.poQtl ? "text-emerald-600 dark:text-emerald-400" : po.arrivalQtl < po.poQtl ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                                )}>{po.arrivalQtl} QTL</span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">Pending / Excess:</span>
                                                <span className={cn(
                                                  "font-mono font-bold",
                                                  po.arrivalQtl > po.poQtl ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                )}>
                                                  {po.arrivalQtl > po.poQtl ? `+${po.arrivalQtl - po.poQtl} QTL (Excess)` : `${po.poQtl - po.arrivalQtl} QTL (Pending)`}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">Agreed Rate:</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">{po.rate > 0 ? `₹ ${formatINR(po.rate)} / QTL` : 'Market'}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-slate-200 dark:border-white/10">
                                                <span className="text-slate-500 font-bold">Est. Value:</span>
                                                <span className="font-mono font-black text-rose-600 dark:text-rose-400">₹ {formatINR(estVal)}</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Card 2: Consignee & Direct Contact */}
                                          <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-white/10 space-y-2 text-left shadow-2xs">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" />
                                                Consignee Buyer
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => setSelectedBuyerForModal(po.buyer)}
                                                className="text-[10px] font-bold text-sky-600 hover:underline cursor-pointer btn-tactile"
                                              >
                                                Mini Profile
                                              </button>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-snug">{po.buyer}</p>
                                            <p className="text-[11px] text-slate-500">Destination APMC Market Yard</p>
                                            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                                              {(() => {
                                                const remBalance = Math.max(0, po.poQtl - po.arrivalQtl);
                                                const isRemainingLoad = po.arrivalQtl > 0;
                                                return (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const billInfo = po.billNo || (po as any).actualSupplierBillNo ? `\n📄 Mill / Lorry Bill: *${po.billNo || (po as any).actualSupplierBillNo}*` : '';
                                                      const lorryInfo = (po as any).vehicleNo || (po as any).truckNo ? `\n🚛 Lorry / Truck No: *${(po as any).vehicleNo || (po as any).truckNo}*` : '';
                                                      
                                                      let text = '';
                                                      if (isRemainingLoad) {
                                                        text = `Hello *${po.buyer}*,\n\nUpdate from *Tejas Canvassing* regarding PO *${po.poNumber}*:\n\n*Your remaining order is arriving!*\n\n🌾 Brand: *${po.brand}*\n⚖️ Remaining Balance Arriving: *${formatQtl(remBalance)} QTL*\n📋 Total Contracted PO: *${formatQtl(po.poQtl)} QTL* (Previously Received: *${formatQtl(po.arrivalQtl)} QTL*)\n🏢 Supplier Mill: *${po.supplier}*${billInfo}${lorryInfo}\n\nYour remaining shipment has been dispatched and is arriving at the destination APMC Yard. We will notify you immediately once unloaded.\n\nThank you,\n*Tejas Canvassing*`;
                                                      } else {
                                                        text = `Hello *${po.buyer}*,\n\nUpdate from *Tejas Canvassing* regarding PO *${po.poNumber}*:\n\n*Your order is arriving!*\n\n🌾 Brand: *${po.brand}*\n⚖️ Quantity Arriving: *${formatQtl(po.poQtl)} QTL*\n🏢 Supplier Mill: *${po.supplier}*${billInfo}${lorryInfo}\n\nYour shipment has been dispatched and is arriving at the destination APMC Yard. We will notify you immediately once unloaded.\n\nThank you,\n*Tejas Canvassing*`;
                                                      }
                                                      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                                                      window.open(waUrl, '_blank');
                                                    }}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm btn-tactile cursor-pointer"
                                                  >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    <span>{isRemainingLoad ? 'WhatsApp: Remaining Order Arriving' : 'WhatsApp: Order Arriving'}</span>
                                                  </button>
                                                );
                                              })()}
                                            </div>
                                          </div>

                                          {/* Card 3: Mill Origin & Grain Specs */}
                                          <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-white/10 space-y-2 text-left shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                              <Building2 className="w-3.5 h-3.5" />
                                              Mill & Grain Specs
                                            </span>
                                            <div>
                                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase line-clamp-2">{po.supplier}</p>
                                              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Mill Origin Dispatch</p>
                                            </div>
                                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1 text-xs">
                                              <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Variety Brand:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{po.brand}</span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Lorry / Bill Ref:</span>
                                                <span className="font-mono text-slate-600 dark:text-slate-400">{po.billNo || (po as any).actualSupplierBillNo || 'Assigned on Arrival'}</span>
                                              </div>
                                              {Boolean((po as any).vehicleNo || (po as any).truckNo) && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-slate-500">Dispatch Lorry:</span>
                                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{(po as any).vehicleNo || (po as any).truckNo}</span>
                                                </div>
                                              )}
                                              {Boolean((po as any).driverPhone) && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-slate-500">Driver Phone:</span>
                                                  <a href={`tel:${(po as any).driverPhone}`} className="font-mono text-sky-600 dark:text-sky-400 hover:underline">{(po as any).driverPhone}</a>
                                                </div>
                                              )}
                                              {Boolean((po as any).acknowledgedByMiller) && (
                                                <div className="flex justify-between items-center">
                                                  <span className="text-slate-500">Mill Status:</span>
                                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Acknowledged</span>
                                                </div>
                                              )}
                                              {(() => {
                                                const rawSub = (po as any).rawOrder?.originalOrders?.find((s: any) => 
                                                  (s.buyer && String(s.buyer).toLowerCase() === String(po.buyer || '').toLowerCase()) || s.id === po.subOrderId
                                                );
                                                const billPhotoUrl = (po as any).billPhoto || (po as any).billPhotoUrl || (po as any).billAttachment || rawSub?.billPhoto || rawSub?.billPhotoUrl;
                                                const billNumber = po.billNo || (po as any).actualSupplierBillNo || rawSub?.actualSupplierBillNo || rawSub?.billNo || 'Consignment Bill';

                                                if (!billPhotoUrl) return null;

                                                return (
                                                  <div className="pt-1 flex items-center justify-between">
                                                    <span className="text-slate-500 font-medium">Mill Bill:</span>
                                                    <button
                                                      type="button"
                                                      onClick={() => setViewingMillerBill({
                                                        url: billPhotoUrl,
                                                        billNo: billNumber,
                                                        poNumber: po.poNumber
                                                      })}
                                                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                                    >
                                                      <FileText className="w-3 h-3" />
                                                      <span>View Mill Bill</span>
                                                    </button>
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          </div>

                                          {/* Card 4: Separate Arrival Entry for Pending Order */}
                                          {(() => {
                                            const remQty = Math.max(0, po.poQtl - po.arrivalQtl);
                                            return (
                                              <div className="p-4 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-white/10 space-y-2 text-left shadow-2xs flex flex-col justify-between">
                                                <div>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                                      <Truck className="w-3.5 h-3.5" />
                                                      Separate Arrival Entry
                                                    </span>
                                                    <span className={cn(
                                                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                      remQty > 0
                                                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                                    )}>
                                                      {remQty > 0 ? `${formatQtl(remQty)} Pending` : 'Fulfilled'}
                                                    </span>
                                                  </div>
                                                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                                    Manual arrival without raising a new PO
                                                  </p>

                                                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 space-y-1 text-xs">
                                                    <div className="flex justify-between items-center">
                                                      <span className="text-slate-500">Pending Balance:</span>
                                                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                                        {formatQtl(remQty)} QTL
                                                      </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                      <span className="text-slate-500">Previously Arrived:</span>
                                                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatQtl(po.arrivalQtl)} QTL
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="pt-2 space-y-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenArrivalModal(po, 'manual')}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm btn-tactile cursor-pointer"
                                                  >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Input New Arrived Qty</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenArrivalModal(po, 'existing')}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition-all btn-tactile cursor-pointer"
                                                  >
                                                    <Layers className="w-3.5 h-3.5" />
                                                    <span>Select from Manual Entries</span>
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </motion.div>
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Buyer Mini Profile Panel / Modal (Section 7) */}
      <AnimatePresence>
        {selectedBuyerForModal && buyerProfileData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-[#121214] border border-slate-200/90 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-2xl text-slate-900 dark:text-white space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {buyerProfileData.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Commercial Buyer Profile • Aggregate Operational History
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBuyerForModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Total Orders
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {buyerProfileData.totalOrders}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Total PO QTL
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                    {buyerProfileData.totalPoQtl.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Total Arrived
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {buyerProfileData.totalArrivalQtl.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Pending QTL
                  </span>
                  <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    {buyerProfileData.pendingQtl.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Suppliers Ordered From */}
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Suppliers & Millers Contracted With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {buyerProfileData.suppliers.map(s => (
                    <span 
                      key={s} 
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10"
                    >
                      {s}
                    </span>
                  ))}
                  {buyerProfileData.suppliers.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No suppliers recorded.</span>
                  )}
                </div>
              </div>

              {/* Recent Orders Table */}
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Recent Orders
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-neutral-900 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">PO</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Brand</th>
                        <th className="py-2.5 px-3 text-right">PO QTL</th>
                        <th className="py-2.5 px-3 text-right">Arrival</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-xs">
                      {buyerProfileData.recentOrders.map(ro => (
                        <tr key={ro.id}>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium">{ro.dateShort}</td>
                          <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{ro.poNumber}</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{ro.supplier}</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{ro.brand}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{ro.poQtl}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{ro.arrivalQtl}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-slate-400">{ro.rate > 0 ? `₹${ro.rate}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedBuyerForModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigate(`/ledger?buyer=${encodeURIComponent(buyerProfileData.name)}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>View All Orders in Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. PO Detail Modal (Section 8) */}
      <AnimatePresence>
        {selectedPoForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-[#121214] border border-slate-200/90 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-lg text-slate-900 dark:text-white space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {selectedPoForModal.poNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Date: {selectedPoForModal.date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPoForModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                <span className="text-xs font-bold text-slate-500">Loading / Arrival Status:</span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                  selectedPoForModal.arrivalQtl > selectedPoForModal.poQtl
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : selectedPoForModal.arrivalQtl > 0
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                )}>
                  {selectedPoForModal.arrivalQtl > selectedPoForModal.poQtl 
                    ? 'Excess Arrived' 
                    : selectedPoForModal.arrivalQtl > 0 
                    ? 'Partial Arrival' 
                    : 'Pending Loading'}
                </span>
              </div>

              {/* Details Key-Value List */}
              <div className="space-y-2.5 text-xs divide-y divide-slate-100 dark:divide-white/5">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 font-medium">Buyer:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedPoForModal.buyer}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 font-medium">Supplier / Miller:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedPoForModal.supplier}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 font-medium">Brand:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white">
                    {selectedPoForModal.brand}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Contracted PO Quantity:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatQtl(selectedPoForModal.poQtl)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Recorded Arrival Quantity:</span>
                  <span className={cn(
                    "font-bold",
                    selectedPoForModal.arrivalQtl > selectedPoForModal.poQtl
                      ? "text-emerald-600 dark:text-emerald-400 font-black"
                      : selectedPoForModal.arrivalQtl < selectedPoForModal.poQtl
                      ? "text-rose-600 dark:text-rose-400 font-black"
                      : "text-emerald-600 dark:text-emerald-400 font-black"
                  )}>
                    {selectedPoForModal.arrivalQtl > 0 ? formatQtl(selectedPoForModal.arrivalQtl) : '0 QTL (Not Recorded)'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Pending / Excess Quantity:</span>
                  <span className={cn(
                    "text-xs font-black px-2 py-0.5 rounded-md",
                    selectedPoForModal.arrivalQtl > selectedPoForModal.poQtl
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                      : selectedPoForModal.arrivalQtl < selectedPoForModal.poQtl
                      ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
                      : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                  )}>
                    {selectedPoForModal.arrivalQtl > selectedPoForModal.poQtl
                      ? `+${(selectedPoForModal.arrivalQtl - selectedPoForModal.poQtl).toLocaleString('en-IN', { maximumFractionDigits: 1 })} QTL (Excess)`
                      : selectedPoForModal.arrivalQtl < selectedPoForModal.poQtl
                      ? `${(selectedPoForModal.poQtl - selectedPoForModal.arrivalQtl).toLocaleString('en-IN', { maximumFractionDigits: 1 })} QTL (Pending)`
                      : '0 QTL (Fulfilled)'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Historical Rate / QTL:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedPoForModal.rate > 0 ? `₹ ${formatINR(selectedPoForModal.rate)}` : '—'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedPoForModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Separate Arrival Entry Modal (Manual Arrival or Select from Existing Arrival Entries) */}
      <AnimatePresence>
        {arrivalModalPo && (
          <div 
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => { if (!isSavingArrival) setArrivalModalPo(null); }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 relative shadow-2xl overflow-hidden text-left my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                      <Truck className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        Separate Arrival Entry
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          {arrivalModalPo.poNumber}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Record newly arrived quantity for this pending order without creating a new PO
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingArrival}
                  onClick={() => setArrivalModalPo(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Order Context Strip */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Buyer</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{arrivalModalPo.buyer}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Mill / Supplier</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{arrivalModalPo.supplier}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Brand</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{arrivalModalPo.brand}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Pending Balance</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 block">
                    {formatQtl(Math.max(0, arrivalModalPo.poQtl - arrivalModalPo.arrivalQtl))} QTL
                  </span>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setArrivalModalTab('manual')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    arrivalModalTab === 'manual'
                      ? "bg-white dark:bg-neutral-900 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input New Arrived Qty (Manual)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArrivalModalTab('existing')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    arrivalModalTab === 'existing'
                      ? "bg-white dark:bg-neutral-900 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Select from Manual Entries ({existingArrivalRows.length})</span>
                </button>
              </div>

              {/* Tab 1: Manual Arrival Input */}
              {arrivalModalTab === 'manual' && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Newly Arrived Qty */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Newly Arrived Quantity (QTL) <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const rem = Math.max(0, arrivalModalPo.poQtl - arrivalModalPo.arrivalQtl);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setManualArrivedQty(String(rem))}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 cursor-pointer"
                                >
                                  Fill Full Remaining ({formatQtl(rem)} QTL)
                                </button>
                                {rem > 10 && (
                                  <button
                                    type="button"
                                    onClick={() => setManualArrivedQty(String(Math.round(rem / 2)))}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  >
                                    Half ({Math.round(rem / 2)} QTL)
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={manualArrivedQty}
                        onChange={(e) => setManualArrivedQty(e.target.value)}
                        placeholder="e.g. 200"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white font-mono text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Arrival Date */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Arrival Date
                      </label>
                      <input
                        type="date"
                        value={manualArrivalDate}
                        onChange={(e) => setManualArrivalDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Mill / Lorry Bill No */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        Mill / Lorry Bill No
                      </label>
                      <input
                        type="text"
                        value={manualBillNo}
                        onChange={(e) => setManualBillNo(e.target.value)}
                        placeholder="e.g. BIL-104 or LR-8821"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Truck / Vehicle No */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        Truck / Vehicle No
                      </label>
                      <input
                        type="text"
                        value={manualVehicleNo}
                        onChange={(e) => setManualVehicleNo(e.target.value)}
                        placeholder="e.g. KA-01-AB-1234"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500 uppercase"
                      />
                    </div>

                    {/* Settled Rate / QTL */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Settled Rate (₹ / QTL)
                      </label>
                      <input
                        type="number"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        placeholder={arrivalModalPo.rate > 0 ? String(arrivalModalPo.rate) : "4200"}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Remarks / Notes */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Remarks / Unloading Notes
                      </label>
                      <input
                        type="text"
                        value={manualRemarks}
                        onChange={(e) => setManualRemarks(e.target.value)}
                        placeholder="e.g. Remaining balance load unloaded at APMC yard"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* WhatsApp Notification Checkbox */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={manualSendWa}
                        onChange={(e) => setManualSendWa(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-neutral-700"
                      />
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>Send WhatsApp Arrival Notice to buyer ({arrivalModalPo.buyer}): &quot;Your remaining order is arriving!&quot;</span>
                    </label>
                  </div>

                  {/* Summary of Impact */}
                  {(() => {
                    const enteredQty = parseFloat(manualArrivedQty) || 0;
                    const newTotalArrived = arrivalModalPo.arrivalQtl + enteredQty;
                    const newRemaining = Math.max(0, arrivalModalPo.poQtl - newTotalArrived);
                    const isFulfilled = newTotalArrived >= arrivalModalPo.poQtl && arrivalModalPo.poQtl > 0;
                    const calculatedAmt = enteredQty * (parseFloat(manualRate) || arrivalModalPo.rate || 0);

                    return (
                      <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-slate-500 block">After saving this entry:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Total Arrived: <strong className="font-mono text-purple-700 dark:text-purple-300">{formatQtl(newTotalArrived)} QTL</strong> • Remaining: <strong className="font-mono text-rose-600 dark:text-rose-400">{formatQtl(newRemaining)} QTL</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {calculatedAmt > 0 && (
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              ₹ {formatINR(calculatedAmt)}
                            </span>
                          )}
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            isFulfilled
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                          )}>
                            {isFulfilled ? 'Order Will Be Fulfilled' : 'Partial Arrival'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                    <button
                      type="button"
                      disabled={isSavingArrival}
                      onClick={() => setArrivalModalPo(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingArrival}
                      onClick={handleSaveManualArrival}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md btn-tactile cursor-pointer disabled:opacity-50"
                    >
                      {isSavingArrival ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Arrival Entry...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save Arrival Entry &amp; Update PO</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Select from Existing Manual Entries */}
              {arrivalModalTab === 'existing' && (
                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={existingArrivalSearch}
                      onChange={(e) => setExistingArrivalSearch(e.target.value)}
                      placeholder="Search manual entries by Buyer, Mill, Bill No, Date..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {isLoadingExisting ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <p className="text-xs">Scanning manual arrival records...</p>
                    </div>
                  ) : filteredExistingArrivals.length === 0 ? (
                    <div className="py-8 text-center space-y-3 bg-slate-50 dark:bg-neutral-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6">
                      <Package className="w-8 h-8 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No matching arrival entries found</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          You can switch to &quot;Input New Arrived Qty&quot; to log a fresh arrival entry for this pending PO.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setArrivalModalTab('manual')}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Switch to Input New Arrived Qty
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                      {filteredExistingArrivals.map((row: any, idx: number) => {
                        const isBuyerMatch = arrivalModalPo.buyer && row.partyName && row.partyName.toLowerCase().includes(arrivalModalPo.buyer.toLowerCase());
                        const isLinkedToThis = row.purchaseOrderNo === arrivalModalPo.poNumber;
                        const isUnlinked = !row.purchaseOrderNo;

                        return (
                          <div 
                            key={row.id || idx}
                            className={cn(
                              "p-3 rounded-xl border text-xs transition-all space-y-2",
                              isLinkedToThis 
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                : isBuyerMatch
                                ? "bg-purple-50/30 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900/40"
                                : "bg-white dark:bg-neutral-900 border-slate-200 dark:border-white/5"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900 dark:text-white uppercase">
                                    {row.partyName || 'Unspecified Party'}
                                  </span>
                                  {isBuyerMatch && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                                      Matching Buyer
                                    </span>
                                  )}
                                  {isUnlinked && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                                      Unlinked
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                                  <span>📅 {row.date || '—'}</span>
                                  <span>🏢 {row.millerName || row.seller || 'Direct Mill'}</span>
                                  <span>🌾 {row.brand || 'Rice'}</span>
                                  {row.billNo && <span className="font-mono">📄 Bill: {row.billNo}</span>}
                                  {(row.vehicleNo || row.truckNo) && <span className="font-mono">🚛 {row.vehicleNo || row.truckNo}</span>}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-sm block">
                                  {formatQtl(Number(row.qty) || 0)} QTL
                                </span>
                                {row.rate > 0 && (
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    @ ₹{row.rate}/QTL
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400 truncate max-w-[280px]">
                                {row.sheetName ? `Sheet: ${row.sheetName}` : ''} {row.remarks ? `• ${row.remarks}` : ''}
                              </span>

                              <button
                                type="button"
                                disabled={isSavingArrival}
                                onClick={() => handleSelectExistingArrival(row)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Select &amp; Link to this PO</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      disabled={isSavingArrival}
                      onClick={() => setArrivalModalPo(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Export / Print Modal */}
      <PrintEntriesPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        reportType="pending_loadings"
        title="Pending Loadings"
        entries={orders}
      />

      {/* Mill Consignment Attached Bill Viewer Modal */}
      {viewingMillerBill && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setViewingMillerBill(null)}
        >
          <div 
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-4 sm:p-5 space-y-3 relative shadow-2xl overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <span>Mill Attached Consignment Bill</span>
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Bill Ref: {viewingMillerBill.billNo} • PO: {viewingMillerBill.poNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingMillerBill(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-center p-2">
              <img 
                src={viewingMillerBill.url} 
                alt="Mill Consignment Bill" 
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">Attached directly by Miller via Miller Portal</span>
              <div className="flex items-center gap-2">
                <a
                  href={viewingMillerBill.url}
                  download={`Mill_Bill_${viewingMillerBill.billNo || 'document'}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Bill</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewingMillerBill(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
