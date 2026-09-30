import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  User, 
  Tag, 
  RefreshCw, 
  X, 
  ChevronRight,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { 
  OperationalPO, 
  fetchOperationalOrders, 
  formatQtl, 
  formatDifference 
} from '../utils/orderOperations';

export default function LedgerManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OperationalPO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedBuyer, setSelectedBuyer] = useState<string>(() => searchParams.get('buyer') || 'all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'pending'>('all');

  // Modal States
  const [selectedBuyerForModal, setSelectedBuyerForModal] = useState<string | null>(null);
  const [selectedPoForModal, setSelectedPoForModal] = useState<OperationalPO | null>(null);

  // Synchronize URL param for buyer if set externally
  useEffect(() => {
    const b = searchParams.get('buyer');
    if (b) {
      setSelectedBuyer(b);
    }
  }, [searchParams]);

  // Load orders on mount
  const loadOrdersData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchOperationalOrders();
      setOrders(data);
    } catch (e) {
      console.error('Failed to load operational ledger orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersData();
  }, []);

  // Unique Lists for Dropdown Filters
  const uniqueBuyers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.buyer) set.add(o.buyer); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.supplier) set.add(o.supplier); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.brand) set.add(o.brand); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  // Date boundary helpers for Date Filter
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filtered Orders (runs 100% locally in-memory with zero Firestore reads)
  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      // 1. Search Query (across PO number, Buyer, Supplier/Miller, Brand, Bill number)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const poNoMatch = po.poNumber.toLowerCase().includes(q);
        const buyerMatch = po.buyer.toLowerCase().includes(q);
        const supMatch = po.supplier.toLowerCase().includes(q);
        const brandMatch = po.brand.toLowerCase().includes(q);
        const billMatch = po.billNo ? po.billNo.toLowerCase().includes(q) : false;

        if (!poNoMatch && !buyerMatch && !supMatch && !brandMatch && !billMatch) {
          return false;
        }
      }

      // 2. Buyer Filter
      if (selectedBuyer !== 'all' && po.buyer.toLowerCase() !== selectedBuyer.toLowerCase()) {
        return false;
      }

      // 3. Supplier Filter
      if (selectedSupplier !== 'all' && po.supplier.toLowerCase() !== selectedSupplier.toLowerCase()) {
        return false;
      }

      // 4. Brand Filter
      if (selectedBrand !== 'all' && po.brand.toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      // 5. Status / Pending Filter
      if (statusFilter === 'arrived' && po.status !== 'Arrived') {
        return false;
      }
      if (statusFilter === 'pending' && po.status !== 'Pending Loading' && po.status !== 'Partial Arrival') {
        return false;
      }

      // 6. Date Filter
      if (dateRange === 'today') {
        if (po.dateTimestamp < todayStart) return false;
      } else if (dateRange === 'yesterday') {
        if (po.dateTimestamp < yesterdayStart || po.dateTimestamp >= todayStart) return false;
      } else if (dateRange === 'week') {
        if (po.dateTimestamp < weekStart) return false;
      } else if (dateRange === 'month') {
        if (po.dateTimestamp < monthStart) return false;
      } else if (dateRange === 'custom' && customDate) {
        // match YYYY-MM-DD
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
    statusFilter, 
    dateRange, 
    customDate,
    todayStart,
    yesterdayStart,
    weekStart,
    monthStart
  ]);

  // Daily Order Visual Grouping (Section 2)
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

    // Sort groups chronologically (newest date first)
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredOrders]);

  // Operational Summary Metrics (Section 9)
  const summary = useMemo(() => {
    let totalPoQtl = 0;
    let totalArrivalQtl = 0;
    let pendingLoadingsCount = 0;
    let pendingQtl = 0;

    filteredOrders.forEach(po => {
      totalPoQtl += po.poQtl;
      totalArrivalQtl += po.arrivalQtl;
      if (po.status === 'Pending Loading' || po.status === 'Partial Arrival') {
        pendingLoadingsCount += 1;
        pendingQtl += Math.max(0, po.poQtl - po.arrivalQtl);
      }
    });

    return {
      totalOrders: filteredOrders.length,
      totalPoQtl,
      totalArrivalQtl,
      pendingLoadings: pendingLoadingsCount,
      pendingQtl
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
    if (statusFilter !== 'all') count++;
    return count;
  }, [searchQuery, dateRange, selectedBuyer, selectedSupplier, selectedBrand, statusFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateRange('all');
    setCustomDate('');
    setSelectedBuyer('all');
    setSelectedSupplier('all');
    setSelectedBrand('all');
    setStatusFilter('all');
    if (searchParams.get('buyer')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('buyer');
      setSearchParams(nextParams);
    }
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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#fafaf9] dark:bg-[#07110c] text-slate-900 dark:text-slate-100 font-sans antialiased">
      
      {/* 1. Header Workspace Bar */}
      <div className="bg-white/80 dark:bg-[#0a1610]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 md:px-8 py-4 shrink-0 sticky top-0 z-20 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Purchase Order Ledger
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/10">
                    Operational View
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Chronological Daily Ledger • One Row Per Purchase Order
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <button
              onClick={loadOrdersData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-amber-500/40 hover:text-amber-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refresh ledger data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-amber-500")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">

        {/* 2. Top Operational Summary Cards (Section 9) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total Orders
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {summary.totalOrders.toLocaleString()}
              </span>
              <Package className="w-4 h-4 text-slate-400 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">In selected view</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total PO QTL
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {summary.totalPoQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">QTL</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Contracted Volume</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total Arrival QTL
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {summary.totalArrivalQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Recorded at Mill/Shop</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending Loadings
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {summary.pendingLoadings}
              </span>
              <Clock className="w-4 h-4 text-rose-500 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Awaiting Arrival</span>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending QTL
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">
                {summary.pendingQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">QTL</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Volume in transit</span>
          </div>
        </div>

        {/* 3. Operational Search & Filter Bar (Sections 3 & 4) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
          {/* Prominent Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders by PO number, buyer, supplier/miller, brand, or bill number..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
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

          {/* Quick Filters Row */}
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
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                selectedBuyer !== 'all'
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 text-amber-900 dark:text-amber-300"
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
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                selectedSupplier !== 'all'
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 text-amber-900 dark:text-amber-300"
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
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                selectedBrand !== 'all'
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 text-amber-900 dark:text-amber-300"
                  : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <option value="all">All Brands ({uniqueBrands.length})</option>
              {uniqueBrands.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>

            {/* Status / Pending Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                statusFilter !== 'all'
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 text-amber-900 dark:text-amber-300"
                  : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <option value="all">All Statuses</option>
              <option value="arrived">Arrived Orders Only</option>
              <option value="pending">Pending Loading Only</option>
            </select>

            {/* Clear Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Daily Order Organization (Section 1 & 2) */}
        {groupedOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-400 mx-auto">
              <Search className="w-5 h-5 opacity-50" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">No Matching Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No purchase orders match your active search or filter criteria. Try adjusting or clearing your filters.
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedOrders.map(group => {
              const groupPoTotal = group.items.reduce((s, it) => s + it.poQtl, 0);
              const groupArrTotal = group.items.reduce((s, it) => s + it.arrivalQtl, 0);

              return (
                <div key={group.dateKey} className="space-y-2">
                  {/* Daily Date Header with Subtotals */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                        {group.dateKey}
                      </h2>
                      <span className="text-[11px] text-slate-500 font-bold">
                        ({group.items.length} {group.items.length === 1 ? 'Order' : 'Orders'})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-slate-500">
                        PO: <strong className="text-slate-800 dark:text-slate-200">{groupPoTotal.toLocaleString()} QTL</strong>
                      </span>
                      <span className="text-slate-300 dark:text-neutral-700">•</span>
                      <span className="text-slate-500">
                        Arrival: <strong className="text-emerald-600 dark:text-emerald-400">{groupArrTotal.toLocaleString()} QTL</strong>
                      </span>
                    </div>
                  </div>

                  {/* Orders Table for this Date */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0a1610] shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50/75 dark:bg-neutral-900/60 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-3.5">Date</th>
                          <th className="py-3 px-3.5">PO No.</th>
                          <th className="py-3 px-3.5">Buyer</th>
                          <th className="py-3 px-3.5">Supplier / Miller</th>
                          <th className="py-3 px-3.5">Brand</th>
                          <th className="py-3 px-3.5 text-right">PO QTL</th>
                          <th className="py-3 px-3.5 text-right">Arrival QTL</th>
                          <th className="py-3 px-3.5 text-right">Rate / QTL</th>
                          <th className="py-3 px-3.5 text-right">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {group.items.map(po => {
                          const diff = formatDifference(po.difference);

                          return (
                            <tr 
                              key={po.id}
                              className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              {/* Date */}
                              <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                {po.date}
                              </td>

                              {/* PO No (Clickable for PO Detail) */}
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedPoForModal(po)}
                                  className="font-mono font-black text-amber-600 dark:text-amber-400 hover:underline hover:text-amber-700 inline-flex items-center gap-1 cursor-pointer"
                                  title="Click to view PO details"
                                >
                                  <span>{po.poNumber}</span>
                                </button>
                              </td>

                              {/* Buyer (Clickable for Buyer Mini Profile) */}
                              <td className="py-3 px-3.5">
                                <button
                                  onClick={() => setSelectedBuyerForModal(po.buyer)}
                                  className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline text-left cursor-pointer transition-colors"
                                  title={`View buyer profile for ${po.buyer}`}
                                >
                                  {po.buyer}
                                </button>
                              </td>

                              {/* Supplier / Miller */}
                              <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300">
                                {po.supplier}
                              </td>

                              {/* Brand */}
                              <td className="py-3 px-3.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200/60 dark:border-white/10">
                                  {po.brand}
                                </span>
                              </td>

                              {/* PO QTL */}
                              <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                                {po.poQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                              </td>

                              {/* Arrival QTL */}
                              <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                                {po.arrivalQtl > 0 ? (
                                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                                    {po.arrivalQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-bold italic">
                                    0
                                  </span>
                                )}
                              </td>

                              {/* Rate / QTL */}
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {po.rate > 0 ? `₹ ${formatINR(po.rate)}` : '—'}
                              </td>

                              {/* Difference (Quantity only, NO monetary calculation) */}
                              <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">
                                {po.arrivalQtl === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Pending Load</span>
                                  </span>
                                ) : (
                                  <span className={cn("text-xs", diff.colorClass)}>
                                    {diff.text}
                                  </span>
                                )}
                              </td>
                            </tr>
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
              className="bg-white dark:bg-[#0a1610] border border-slate-200/90 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-2xl text-slate-900 dark:text-white space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
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
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Orders
                  </span>
                  <span className="text-lg font-black font-mono">
                    {buyerProfileData.totalOrders}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total PO QTL
                  </span>
                  <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400">
                    {buyerProfileData.totalPoQtl.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Arrived
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {buyerProfileData.totalArrivalQtl.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pending QTL
                  </span>
                  <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                    {buyerProfileData.pendingQtl.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Suppliers Ordered From */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Suppliers & Millers Contracted With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {buyerProfileData.suppliers.map(s => (
                    <span 
                      key={s} 
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10"
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Recent Orders
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-neutral-900 text-[9px] font-black uppercase text-slate-500">
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">PO</th>
                        <th className="py-2 px-2.5">Supplier</th>
                        <th className="py-2 px-2.5">Brand</th>
                        <th className="py-2 px-2.5 text-right">PO QTL</th>
                        <th className="py-2 px-2.5 text-right">Arrival</th>
                        <th className="py-2 px-2.5 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-[11px]">
                      {buyerProfileData.recentOrders.map(ro => (
                        <tr key={ro.id}>
                          <td className="py-2 px-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">{ro.dateShort}</td>
                          <td className="py-2 px-2.5 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{ro.poNumber}</td>
                          <td className="py-2 px-2.5 font-sans font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{ro.supplier}</td>
                          <td className="py-2 px-2.5 font-sans text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{ro.brand}</td>
                          <td className="py-2 px-2.5 text-right font-black text-slate-900 dark:text-white">{ro.poQtl}</td>
                          <td className="py-2 px-2.5 text-right font-black text-emerald-600">{ro.arrivalQtl}</td>
                          <td className="py-2 px-2.5 text-right text-slate-600 dark:text-slate-400">{ro.rate > 0 ? `₹${ro.rate}` : '—'}</td>
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
                    setSelectedBuyer(buyerProfileData.name);
                    setSelectedBuyerForModal(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>View All Orders for {buyerProfileData.name}</span>
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
              className="bg-white dark:bg-[#0a1610] border border-slate-200/90 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-lg text-slate-900 dark:text-white space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    <FileText className="w-5 h-5" />
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
                  selectedPoForModal.status === 'Arrived'
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : selectedPoForModal.status === 'Partial Arrival'
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                )}>
                  {selectedPoForModal.status}
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
                  <span className="text-slate-500 font-sans font-medium">Original PO Quantity:</span>
                  <span className="font-black text-amber-700 dark:text-amber-400">
                    {formatQtl(selectedPoForModal.poQtl)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Recorded Arrival Quantity:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatQtl(selectedPoForModal.arrivalQtl)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Difference:</span>
                  <span className={cn("text-xs font-black", formatDifference(selectedPoForModal.difference).colorClass)}>
                    {formatDifference(selectedPoForModal.difference).text}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Historical Rate / QTL:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedPoForModal.rate > 0 ? `₹ ${formatINR(selectedPoForModal.rate)}` : '—'}
                  </span>
                </div>

                {selectedPoForModal.billNo && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500 font-medium">Arrival Bill No:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedPoForModal.billNo}</span>
                  </div>
                )}
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

    </div>
  );
}
