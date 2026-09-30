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

export default function PendingLoadings() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OperationalPO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // Modals
  const [selectedBuyerForModal, setSelectedBuyerForModal] = useState<string | null>(null);
  const [selectedPoForModal, setSelectedPoForModal] = useState<OperationalPO | null>(null);

  // Load orders from canonical operational order service
  const loadOrdersData = async () => {
    setIsLoading(true);
    try {
      const allOrders = await fetchOperationalOrders();
      // Keep only POs where arrival has NOT been recorded (arrivalQtl === 0 or pending load exists)
      const pendingOnly = allOrders.filter(po => po.arrivalQtl === 0 || po.status === 'Pending Loading');
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

  // Unique lists for Dropdown Filters
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

  // Filtered Pending Loadings (runs locally in-memory with zero Firestore reads)
  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      // 1. Search Query (PO number, Buyer, Supplier, Brand)
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
    const buyersSet = new Set<string>();
    const suppliersSet = new Set<string>();

    filteredOrders.forEach(o => {
      if (o.buyer) buyersSet.add(o.buyer);
      if (o.supplier) suppliersSet.add(o.supplier);
    });

    return {
      totalOrders: filteredOrders.length,
      totalPendingQtl,
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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#fafaf9] dark:bg-[#07110c] text-slate-900 dark:text-slate-100 font-sans antialiased">
      
      {/* 1. Header Workspace Bar */}
      <div className="bg-white/80 dark:bg-[#0a1610]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 md:px-8 py-4 shrink-0 sticky top-0 z-20 transition-colors">
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
              onClick={loadOrdersData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-rose-500/40 hover:text-rose-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
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

        {/* 2. Compact Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending Orders
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {metrics.totalOrders}
              </span>
              <Clock className="w-4 h-4 text-rose-500 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Awaiting Arrival</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total Pending QTL
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.totalPendingQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[10px] font-bold text-amber-600">QTL</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Volume in Transit</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Buyers Waiting
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.uniqueBuyers}
              </span>
              <User className="w-4 h-4 text-slate-400 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Consignees</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Suppliers / Millers
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {metrics.uniqueSuppliers}
              </span>
              <Building2 className="w-4 h-4 text-slate-400 opacity-60" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Dispatch Origins</span>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
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
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0a1610] border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-3">
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
              const groupPendingQtl = group.items.reduce((s, it) => s + it.poQtl, 0);

              return (
                <div key={group.dateKey} className="space-y-2">
                  {/* Daily Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                        {group.dateKey}
                      </h2>
                      <span className="text-[11px] text-slate-500 font-bold">
                        ({group.items.length} {group.items.length === 1 ? 'Pending PO' : 'Pending POs'})
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-500">
                      Pending Volume: <strong className="text-rose-600 dark:text-rose-400">{groupPendingQtl.toLocaleString()} QTL</strong>
                    </div>
                  </div>

                  {/* Clean Operational Table: Date | PO No. | Buyer | Supplier/Miller | Brand | PO QTL | Rate / QTL */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0a1610] shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-50/75 dark:bg-neutral-900/60 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">PO No.</th>
                          <th className="py-3 px-4">Buyer</th>
                          <th className="py-3 px-4">Supplier / Miller</th>
                          <th className="py-3 px-4">Brand</th>
                          <th className="py-3 px-4 text-right">PO QTL</th>
                          <th className="py-3 px-4 text-right">Rate / QTL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {group.items.map(po => (
                          <tr 
                            key={po.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            {/* Date (Short: e.g. 30 Sep) */}
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                              {po.dateShort}
                            </td>

                            {/* PO No (Clickable for PO details) */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedPoForModal(po)}
                                className="font-mono font-black text-rose-600 dark:text-rose-400 hover:underline hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                                title="Click to view PO details"
                              >
                                <span>{po.poNumber}</span>
                              </button>
                            </td>

                            {/* Buyer (Clickable for Buyer Mini Profile) */}
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setSelectedBuyerForModal(po.buyer)}
                                className="font-bold text-slate-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 hover:underline text-left cursor-pointer transition-colors"
                                title={`View buyer profile for ${po.buyer}`}
                              >
                                {po.buyer}
                              </button>
                            </td>

                            {/* Supplier / Miller */}
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                              {po.supplier}
                            </td>

                            {/* Brand */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200/60 dark:border-white/10">
                                {po.brand}
                              </span>
                            </td>

                            {/* PO QTL */}
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                              {po.poQtl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </td>

                            {/* Rate / QTL */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {po.rate > 0 ? `₹ ${formatINR(po.rate)}` : '—'}
                            </td>
                          </tr>
                        ))}
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
                          <td className="py-2 px-2.5 font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{ro.poNumber}</td>
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
                    navigate(`/ledger?buyer=${encodeURIComponent(buyerProfileData.name)}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
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
              className="bg-white dark:bg-[#0a1610] border border-slate-200/90 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-lg text-slate-900 dark:text-white space-y-5"
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
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">
                  Pending Loading
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
                  <span className="font-black text-rose-700 dark:text-rose-400">
                    {formatQtl(selectedPoForModal.poQtl)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 font-mono">
                  <span className="text-slate-500 font-sans font-medium">Recorded Arrival Quantity:</span>
                  <span className="font-bold text-slate-400 italic">
                    0 QTL (Not Recorded)
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

    </div>
  );
}
