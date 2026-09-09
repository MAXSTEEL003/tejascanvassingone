import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Truck, 
  Package, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronRight, 
  FileSpreadsheet, 
  BookOpen, 
  Plus, 
  X,
  ChevronDown,
  Layers,
  Building2,
  Calendar,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, NavLink } from 'react-router-dom';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, deleteCollectionDoc } from '../lib/firebase';

interface PendingLoadingItem {
  id: string;
  poNumber: string;
  subOrderId?: string;
  date: string;
  supplier: string;
  buyer: string;
  brand: string;
  orderedQty: number;
  arrivedQty: number;
  pendingQty: number;
  rate: number;
  totalAmount: number;
  arrivalHistory?: Array<{ date: string; billNo?: string; qty: number; rate?: number }>;
}

const SEED_PENDING_LOADINGS: PendingLoadingItem[] = [];

export default function PendingLoadings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingLoadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [copiedPo, setCopiedPo] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PendingLoadingItem | null>(null);

  // Delete whole pending loadings modal states
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleDeleteWholePendingLoadings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePassword.trim() !== 'tejas') {
      setPasswordError('Incorrect authorization password. Deletion cancelled.');
      return;
    }

    setIsDeletingAll(true);
    setPasswordError(null);

    try {
      // 1. Delete all placed orders from Firestore since pending loadings are calculated from them
      const cloudDocs = await getCollectionDocs('placed_orders').catch(() => []);
      if (cloudDocs && cloudDocs.length > 0) {
        await Promise.all(
          cloudDocs.map(doc => deleteCollectionDoc('placed_orders', doc.id).catch(() => {}))
        );
      }

      // 2. Mark pending loadings & placed orders as cleared in localStorage
      localStorage.setItem('pending_loadings_cleared_all', 'true');
      localStorage.setItem('cleared_pending_loadings', 'true');
      localStorage.removeItem('placed_orders');
      localStorage.setItem('placed_orders', '[]');
      localStorage.setItem('placed_orders_cleared_all', 'true');

      // 3. Clear local state
      setItems([]);
      setIsDeleteAllModalOpen(false);
      setDeletePassword('');
      setShowPassword(false);
      setToastMessage('All pending loading records have been permanently deleted.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to wipe pending loadings:', err);
      setPasswordError('Error deleting records from server. Please try again.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const fetchPendingLoadings = async () => {
    setLoading(true);
    try {
      // Get deleted IDs
      let deletedSet = new Set<string>();
      try {
        const rawDel = localStorage.getItem('deleted_procurement_ids');
        if (rawDel) {
          const arr = JSON.parse(rawDel);
          if (Array.isArray(arr)) {
            deletedSet = new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
          }
        }
      } catch (e) {}

      // Check if user explicitly purged pending loadings
      const isCleared = localStorage.getItem('pending_loadings_cleared_all') === 'true' || localStorage.getItem('placed_orders_cleared_all') === 'true';
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');

      if (isCleared && localPlaced.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      } else if (localPlaced.length > 0 && isCleared) {
        localStorage.removeItem('pending_loadings_cleared_all');
        localStorage.removeItem('cleared_pending_loadings');
        localStorage.removeItem('placed_orders_cleared_all');
      }

      // 1. Fetch PLACED ORDERS ONLY (from local storage and Firestore cloud)
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);

      // 2. Fetch arrival entries to determine arrived vs pending load volumes
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
      const allArrivals = [...localArrivals, ...cloudArrivals];

      // Build map of total arrived qty by purchase order no
      const arrivedMap = new Map<string, { totalQty: number; history: any[] }>();
      allArrivals.forEach((arr: any) => {
        if (!arr) return;
        const poKey = (arr.purchaseOrderNo || arr.poNo || '').trim().toUpperCase();
        if (!poKey) return;

        const qty = Number(arr.qty) || 0;
        if (!arrivedMap.has(poKey)) {
          arrivedMap.set(poKey, { totalQty: 0, history: [] });
        }
        const record = arrivedMap.get(poKey)!;
        record.totalQty += qty;
        record.history.push({
          date: arr.date || 'Today',
          billNo: arr.billNo || 'N/A',
          qty: qty,
          rate: Number(arr.rate) || 0
        });
      });

      const isDeletedOrInvalid = (ord: any) => {
        if (!ord || !ord.id) return true;
        if (ord.status === 'Rejected') return true;
        const norm = String(ord.id).trim().toLowerCase().replace(/^#/, '');
        return deletedSet.has(norm);
      };

      // Deduplicate placed orders across cloud & local storage
      const uniquePlacedMap = new Map<string, any>();
      [...cloudPlaced, ...localPlaced].forEach((ord: any) => {
        if (!ord || isDeletedOrInvalid(ord)) return;
        const normKey = String(ord.id || ord.purchaseOrderNo || '').trim().toUpperCase().replace(/^#/, '');
        if (!normKey) return;
        if (!uniquePlacedMap.has(normKey)) {
          uniquePlacedMap.set(normKey, ord);
        }
      });

      let placedOrdersList = Array.from(uniquePlacedMap.values());

      // If no placed orders exist yet in storage, fallback to seed placed orders
      if (placedOrdersList.length === 0) {
        if (isCleared) {
          setItems([]);
          setLoading(false);
          return;
        }
        placedOrdersList = SEED_PENDING_LOADINGS.map(s => ({
          id: s.poNumber,
          purchaseOrderNo: s.poNumber,
          date: s.date,
          supplier: s.supplier,
          buyer: s.buyer,
          product: s.brand,
          brand: s.brand,
          qty: s.orderedQty,
          totalQty: s.orderedQty,
          rate: s.rate,
          totalAmount: s.totalAmount
        }));
      }

      const itemsMap = new Map<string, PendingLoadingItem>();

      // Process placed orders to extract commercial ledger details (PO, Quantity, Rate, Amount)
      placedOrdersList.forEach((ord: any) => {
        const po = (ord.purchaseOrderNo || ord.id || '').trim().toUpperCase();
        const normPoKey = po.replace(/^#/, '');

        // If placed order is a consolidated batch containing multiple sub-contracts:
        if (ord.originalOrders && Array.isArray(ord.originalOrders) && ord.originalOrders.length > 1) {
          ord.originalOrders.forEach((sub: any, sIdx: number) => {
            const subId = sub.id ? String(sub.id).trim().toUpperCase() : `SUB-${sIdx + 1}`;
            const subKey = `${po}_${subId}`;
            const supplier = sub.supplier || sub.seller || ord.supplier || ord.seller || 'ANNAPURNA RICE & AGRO INDUSTRIES';
            const buyer = sub.buyer || sub.partyName || ord.buyer || 'V.K FOODS';
            const brand = sub.product || sub.brand || ord.product || ord.brand || '1121 Sella Rice';
            const orderedQty = Number(sub.qty || sub.totalQty) || 0;
            if (orderedQty <= 0) return;

            let rate = Number(sub.rate || sub.pricePerUnit) || Number(ord.rate) || 4200;
            const arrData = arrivedMap.get(subId) || arrivedMap.get(po) || arrivedMap.get(normPoKey) || { totalQty: 0, history: [] };
            const arrivedQty = arrData.totalQty;
            const pendingQty = Math.max(0, orderedQty - arrivedQty);

            itemsMap.set(subKey, {
              id: `PL-${subKey}`,
              poNumber: po,
              subOrderId: subId,
              date: sub.date || ord.date || 'Today',
              supplier,
              buyer,
              brand,
              orderedQty,
              arrivedQty,
              pendingQty,
              rate,
              totalAmount: orderedQty * rate,
              arrivalHistory: arrData.history
            });
          });
        } else {
          // Single placed order contract
          const supplier = ord.supplier || ord.seller || (ord.originalOrders?.[0]?.supplier) || 'ANNAPURNA RICE & AGRO INDUSTRIES';
          const buyer = ord.buyer || ord.partyName || (ord.originalOrders?.[0]?.buyer) || 'V.K FOODS';
          const brand = ord.product || ord.brand || (ord.originalOrders?.[0]?.product) || ord.items?.replace(/\(\d+.*$/, '').trim() || '1121 Sella Rice';
          
          let orderedQty = Number(ord.qty || ord.totalQty) || 0;
          if (orderedQty <= 0 && ord.items) {
            orderedQty = parseFloat(ord.items.match(/\d+(\.\d+)?/)?.[0] || '0');
          }
          if (orderedQty <= 0) return;

          let rate = Number(ord.rate) || (ord.originalOrders?.[0]?.rate ? Number(ord.originalOrders[0].rate) : 0);
          if (!rate || rate <= 0) {
            const rawAmt = Number(ord.totalAmount) || parseFloat(String(ord.total || '').replace(/[^0-9.]/g, ''));
            rate = rawAmt && orderedQty ? Math.round(rawAmt / orderedQty) : 4200;
          }

          const arrData = arrivedMap.get(po) || arrivedMap.get(normPoKey) || { totalQty: 0, history: [] };
          const arrivedQty = arrData.totalQty;
          const pendingQty = Math.max(0, orderedQty - arrivedQty);

          itemsMap.set(po, {
            id: `PL-${po}`,
            poNumber: po,
            date: ord.date || 'Today',
            supplier,
            buyer,
            brand,
            orderedQty,
            arrivedQty,
            pendingQty,
            rate,
            totalAmount: orderedQty * rate,
            arrivalHistory: arrData.history
          });
        }
      });

      const parseDateMs = (dStr: string) => {
        if (!dStr || dStr === 'Today' || dStr === 'N/A') return Date.now();
        if (dStr.includes('/')) {
          const parts = dStr.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day).getTime();
          }
        }
        if (dStr.includes('-')) {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
            } else if (parts[2].length === 4) {
              const day = parseInt(parts[0], 10);
              const year = parseInt(parts[2], 10);
              const monthParsed = parseInt(parts[1], 10);
              const month = isNaN(monthParsed) ? new Date(`${parts[1]} 1, 2000`).getMonth() : monthParsed - 1;
              return new Date(year, month, day).getTime();
            }
          }
        }
        const parsed = Date.parse(dStr);
        return isNaN(parsed) ? Date.now() : parsed;
      };

      const role = localStorage.getItem('userRole');
      const merchantName = (localStorage.getItem('userName') || 'V.K FOODS').trim().toLowerCase();

      let itemsArray = Array.from(itemsMap.values());
      if (role === 'merchant') {
        itemsArray = itemsArray.filter(i => (i.buyer || '').trim().toLowerCase() === merchantName);
      }

      // Sort by date ascending (oldest first for prompt dispatch resolution)
      itemsArray.sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
      setItems(itemsArray);
    } catch (err) {
      console.error("Failed to calculate pending loadings:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLoadings();
  }, []);

  const handleCopyPo = (po: string) => {
    navigator.clipboard.writeText(po);
    setCopiedPo(po);
    setTimeout(() => setCopiedPo(null), 2000);
  };

  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.supplier));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!item) return false;
      const itemSupplier = (item.supplier || '').toLowerCase();
      const supFilter = (supplierFilter || '').toLowerCase();
      if (supplierFilter !== 'all' && itemSupplier !== supFilter) {
        return false;
      }
      if ((searchQuery || '').trim() !== '') {
        const q = (searchQuery || '').toLowerCase();
        return (
          (item.poNumber || '').toLowerCase().includes(q) ||
          (item.supplier || '').toLowerCase().includes(q) ||
          (item.buyer || '').toLowerCase().includes(q) ||
          (item.brand || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, supplierFilter, searchQuery]);

  const stats = useMemo(() => {
    let totalOrdered = 0;
    let totalArrived = 0;
    let totalPending = 0;
    let pendingCount = 0;

    items.forEach(i => {
      totalOrdered += i.orderedQty;
      totalArrived += i.arrivedQty;
      totalPending += i.pendingQty;
      if (i.pendingQty > 0) pendingCount++;
    });

    return {
      totalOrdered,
      totalArrived,
      totalPending,
      pendingCount
    };
  }, [items]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <NavLink to="/ledger" className="text-xs font-bold text-secondary hover:text-primary flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Ledger Accounts
            </NavLink>
            <span className="text-xs text-secondary/40">/</span>
            <span className="text-xs font-bold text-primary">Pending Loadings</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            Pending Loadings & Placed Orders Ledger
          </h1>
          <p className="text-secondary text-sm font-medium mt-1">
            Commercial ledger for placed orders tracking contracted quantities, arrival logs, rates per quintal, and pending load balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              setIsDeleteAllModalOpen(true);
              setDeletePassword('');
              setPasswordError(null);
              setShowPassword(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-black transition-all border border-red-500/25 shadow-sm hover:border-red-500/40 cursor-pointer"
            title="Delete Whole Pending Loadings Data"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Delete Whole Pending Loadings</span>
          </button>
          <button 
            onClick={() => navigate('/arrival-entry')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-primary/15 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Record Arrival
          </button>
          <button 
            onClick={fetchPendingLoadings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold transition-all border border-outline-variant/30 cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sync Loadings
          </button>
        </div>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Total Ordered Volume</span>
              <span className="text-2xl font-black tracking-tight mt-1 block">{(stats.totalOrdered).toFixed(2)} QTLS</span>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-secondary mt-4 block font-semibold">
            Aggregated indent contracts placed
          </span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Total Arrived Volume</span>
              <span className="text-2xl font-black tracking-tight mt-1 text-emerald-600 block">{(stats.totalArrived).toFixed(2)} QTLS</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 mt-4 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3 h-3" /> Received at depot / warehouse
          </span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl border border-amber-500/30 bg-amber-500/[0.03] flex flex-col justify-between shadow-lg shadow-amber-500/5 interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block">Net Pending Loading</span>
              <span className="text-2xl font-black tracking-tight mt-1 text-amber-600 dark:text-amber-400 block">{(stats.totalPending).toFixed(2)} QTLS</span>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <Truck className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-4 font-bold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Quantity awaiting dispatch
          </span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Pending Orders Count</span>
              <span className="text-2xl font-black tracking-tight mt-1 block">{stats.pendingCount} POs</span>
            </div>
            <div className="p-2.5 bg-surface-container text-secondary rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-secondary mt-4 block font-semibold">
            Contracts with partial or 0 arrival
          </span>
        </motion.div>
      </div>

      {/* Main Table Controls & Content */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input 
              type="text"
              placeholder="Search PO Number, supplier, buyer or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/25 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/25 rounded-2xl pl-11 pr-10 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer font-bold"
              >
                <option value="all">All Suppliers / Millers</option>
                {suppliersList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <motion.div 
          initial={{ opacity: 0, y: 22, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass rounded-3xl premium-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container/30 text-[10px] font-black uppercase tracking-widest text-secondary">
                  <th className="py-4.5 px-6">Purchase Order</th>
                  <th className="py-4.5 px-6">Supplier (Miller)</th>
                  <th className="py-4.5 px-6">Buyer (Shop)</th>
                  <th className="py-4.5 px-6">Product Grade / Brand</th>
                  <th className="py-4.5 px-6 text-right">Ordered Qty</th>
                  <th className="py-4.5 px-6 text-right">Arrived Qty</th>
                  <th className="py-4.5 px-6 text-right">Pending Qty</th>
                  <th className="py-4.5 px-6 text-right">Rate / Qtl</th>
                  <th className="py-4.5 px-6 text-right">Total Amount</th>
                  <th className="py-4.5 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                <AnimatePresence mode="popLayout">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-secondary border border-outline-variant/30">
                            <Clock className="w-7 h-7 text-amber-500/80" />
                          </div>
                          <p className="font-black text-base text-on-surface">Pending Loadings is Empty</p>
                          <p className="text-xs text-secondary max-w-sm">
                            All pending loading records have been wiped. New entries will log automatically when orders are placed and tracked.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-secondary font-medium">
                        No pending loading records found matching active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      return (
                        <motion.tr 
                          key={item.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="interactive-tr hover:bg-surface-container/40 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 group">
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                                {item.poNumber}
                              </span>
                              <button
                                onClick={() => handleCopyPo(item.poNumber)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container rounded transition-all text-secondary"
                                title="Copy PO Number"
                              >
                                {copiedPo === item.poNumber ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-secondary font-semibold block mt-1">
                              {item.date}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-xs text-on-surface">
                            {item.supplier}
                          </td>
                          <td className="py-4 px-6 text-xs text-secondary font-semibold">
                            {item.buyer}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-extrabold text-on-surface bg-surface-container px-2.5 py-1 rounded-lg">
                              {item.brand}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs text-right font-mono font-bold text-secondary">
                            {(item.orderedQty).toFixed(2)} QTLS
                          </td>
                          <td className="py-4 px-6 text-xs text-right font-mono font-bold text-emerald-600">
                            {(item.arrivedQty).toFixed(2)} QTLS
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={cn(
                              "text-xs font-mono font-black px-2.5 py-1 rounded-lg inline-block",
                              item.pendingQty > 0 
                                ? "text-amber-700 bg-amber-500/10 dark:text-amber-400" 
                                : "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400"
                            )}>
                              {(item.pendingQty).toFixed(2)} QTLS
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs text-right font-mono font-bold text-on-surface">
                            ₹ {formatINR(item.rate)}
                            <span className="text-[10px] text-secondary block font-normal">/ Qtl</span>
                          </td>
                          <td className="py-4 px-6 text-xs text-right font-mono font-black text-on-surface">
                            ₹ {formatINR(item.totalAmount)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-primary transition-all border border-outline-variant/30 cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Details & Re-Order Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-outline-variant/50 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-outline-variant/30 bg-surface-container/50 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono">
                    {selectedItem.poNumber}
                  </span>
                  <h3 className="text-xl font-black text-on-surface">
                    Placed Order Ledger Details
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-on-background/5 rounded-full text-secondary cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-container rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-secondary block">Supplier (Miller)</span>
                    <span className="font-extrabold text-sm text-on-surface block">{selectedItem.supplier}</span>
                  </div>
                  <div className="p-4 bg-surface-container rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-secondary block">Buyer (Shop)</span>
                    <span className="font-extrabold text-sm text-on-surface block">{selectedItem.buyer}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10">
                    <span className="text-[10px] font-black uppercase tracking-wider text-secondary block">Ordered</span>
                    <span className="text-sm sm:text-base font-black text-primary font-mono mt-1 block">{(selectedItem.orderedQty).toFixed(2)} QT</span>
                  </div>
                  <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">Arrived</span>
                    <span className="text-sm sm:text-base font-black text-emerald-600 font-mono mt-1 block">{(selectedItem.arrivedQty).toFixed(2)} QT</span>
                  </div>
                  <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">Pending</span>
                    <span className="text-sm sm:text-base font-black text-amber-600 font-mono mt-1 block">{(selectedItem.pendingQty).toFixed(2)} QT</span>
                  </div>
                  <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/30">
                    <span className="text-[10px] font-black uppercase tracking-wider text-secondary block">Rate / Qtl</span>
                    <span className="text-sm sm:text-base font-black text-on-surface font-mono mt-1 block">₹ {formatINR(selectedItem.rate)}</span>
                  </div>
                  <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/30">
                    <span className="text-[10px] font-black uppercase tracking-wider text-secondary block">Total Amount</span>
                    <span className="text-sm sm:text-base font-black text-on-surface font-mono mt-1 block">₹ {formatINR(selectedItem.totalAmount)}</span>
                  </div>
                </div>

                {/* Arrival Logs */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-primary" /> Logged Arrival Batches
                  </h4>
                  {selectedItem.arrivalHistory && selectedItem.arrivalHistory.length > 0 ? (
                    <div className="border border-outline-variant/30 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-container text-[10px] font-black uppercase text-secondary">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Bill No</th>
                            <th className="p-3 text-right">Qty Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {selectedItem.arrivalHistory.map((h, idx) => (
                            <tr key={idx}>
                              <td className="p-3 font-semibold text-on-surface">{h.date}</td>
                              <td className="p-3 font-mono text-secondary">{h.billNo || 'N/A'}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">{(h.qty).toFixed(2)} QTLS</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-surface-container/50 text-center text-xs text-secondary">
                      No arrival batches logged for this Purchase Order yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-outline-variant/30 bg-surface-container/30 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    navigate('/arrival-entry');
                  }}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-primary/15 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Log Arrival Batch
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Whole Pending Loadings Confirmation Modal */}
      <AnimatePresence>
        {isDeleteAllModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-outline-variant/60 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-outline-variant/30 bg-surface-container/50 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-black text-on-surface tracking-tight">Delete Whole Pending Loadings</h3>
                    <button
                      onClick={() => {
                        setIsDeleteAllModalOpen(false);
                        setDeletePassword('');
                        setPasswordError(null);
                        setShowPassword(false);
                      }}
                      className="p-1.5 hover:bg-surface-container rounded-xl text-secondary hover:text-on-surface transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    Permanent action. Master authorization password verification is required to wipe all pending loadings.
                  </p>
                </div>
              </div>

              {/* Scope Summary */}
              <form onSubmit={handleDeleteWholePendingLoadings} className="p-6 space-y-5">
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>The following loading records will be permanently erased:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                      <span className="text-[10px] font-bold text-secondary uppercase block">Contracts</span>
                      <span className="text-sm font-black text-on-surface font-mono mt-0.5 block">{items.length}</span>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                      <span className="text-[10px] font-bold text-secondary uppercase block">Pending Volume</span>
                      <span className="text-sm font-black text-on-surface font-mono mt-0.5 block">{stats.totalPending.toFixed(1)} Q</span>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                      <span className="text-[10px] font-bold text-secondary uppercase block">Contract Value</span>
                      <span className="text-xs font-black text-on-surface font-mono mt-0.5 block">₹ {formatINR(items.reduce((s, i) => s + i.totalAmount, 0))}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-secondary leading-relaxed font-medium">
                    This will purge all placed order documents and pending loading ledger contracts across Cloud Firestore and browser cache.
                  </p>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      Enter Master Password to Confirm
                    </span>
                    <span className="text-[10px] text-secondary font-mono">Required: tejas</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Enter password..."
                      autoFocus
                      className="w-full bg-surface-container border border-outline-variant/50 rounded-xl px-4 py-2.5 text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-red-500 transition-colors pr-10 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-[11px] text-red-500 font-bold flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      {passwordError}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteAllModalOpen(false);
                      setDeletePassword('');
                      setPasswordError(null);
                      setShowPassword(false);
                    }}
                    disabled={isDeletingAll}
                    className="px-5 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-bold text-secondary hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingAll || !deletePassword}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingAll ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting Whole Pending Loadings...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Delete All</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 bg-neutral-900 text-white border border-neutral-700 shadow-2xl px-5 py-3.5 rounded-2xl flex items-center gap-3 text-xs font-bold"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
