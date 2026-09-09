import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Clock, 
  MapPin, 
  Search, 
  ChevronRight, 
  Layers, 
  Share2, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Send, 
  Terminal, 
  Loader2,
  FileCheck2,
  X,
  MessageSquare,
  Building,
  CheckCircle2,
  XCircle,
  Filter,
  Printer,
  Download,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ArrowLeft,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, setCollectionDoc, deleteCollectionDoc, markLedgerEntriesAsArrived, autoCreateArrivalEntryForIncomingLog, updateLedgersForLifting } from '../lib/firebase';
import { generateSupplierPOEmailHtml, generateSupplierPOA4PrintHtml, printPoDocument, resolveBuyerProfile, formatPoDate } from '../utils/poEmailTemplate';

const BUYER_PROFILES: Record<string, { address: string; gstin: string; phone: string; email: string }> = {
  'V.K FOODS': {
    address: '88th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
    gstin: '29AAUBJ618M1Z8',
    phone: '9840618506',
    email: 'vkfoods@gmail.com',
  },
  'V.K. FOODS': {
    address: '88th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
    gstin: '29AAUBJ618M1Z8',
    phone: '9840618506',
    email: 'vkfoods@gmail.com',
  },
  'VK FOODS': {
    address: '88th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
    gstin: '29AAUBJ618M1Z8',
    phone: '9840618506',
    email: 'vkfoods@gmail.com',
  }
};

const SUPPLIER_PROFILES: Record<string, { name: string; contact: string; email: string; phone: string; gstin: string; address: string }> = {
  'ANNAPURNA RICE & AGRO INDUSTRIES': {
    name: 'ANNAPURNA RICE & AGRO INDUSTRIES',
    contact: 'Srinivas Rao',
    email: 'contact@annapurnarice.com',
    phone: '9440188941',
    gstin: '37AAICA1234A1Z1',
    address: 'D.No. 4-12, Industrial Area, West Godavari, Andhra Pradesh - 534328'
  }
};

const getSupplierProfile = (supplierName: string) => {
  const norm = (supplierName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  // 1. Check dynamic stakeholders stored in localStorage (stakeholders / stakeholders_v2 / users)
  try {
    for (const key of ['stakeholders_v2', 'stakeholders', 'registered_suppliers', 'users']) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        const suppliersList = Array.isArray(parsed) 
          ? parsed 
          : (parsed.suppliers || parsed.users || []);
        
        const matched = suppliersList.find((s: any) => {
          const sName = (s.name || s.businessName || s.displayName || s.userName || '').trim().toUpperCase();
          return sName && (sName === norm || sName.includes(norm) || norm.includes(sName));
        });

        if (matched && matched.email) {
          return {
            name: matched.name || supplierName,
            email: matched.email,
            phone: matched.phone || '9440188941',
            contact: matched.contact || matched.contactPerson || '',
            gstin: matched.gstin || '',
            address: matched.address || ''
          };
        }
      }
    }
  } catch (e) {
    console.warn('Error reading dynamic supplier profile from storage:', e);
  }

  // 2. Check static dictionary
  if (SUPPLIER_PROFILES[norm]) {
    return SUPPLIER_PROFILES[norm];
  }
  for (const k of Object.keys(SUPPLIER_PROFILES)) {
    if (norm.includes(k) || k.includes(norm)) {
      return SUPPLIER_PROFILES[k];
    }
  }

  // 3. Fallback
  return {
    name: supplierName || 'Supplier',
    email: 'contact@annapurnarice.com',
    phone: '9440188941',
    contact: 'Operations Desk',
    gstin: '37AAICA1234A1Z1',
    address: 'Industrial APMC Commercial Hub'
  };
};

const getBuyerProfile = (buyerName: string) => {
  const norm = (buyerName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');
    
  if (BUYER_PROFILES[norm]) {
    return BUYER_PROFILES[norm];
  }
  
  for (const k of Object.keys(BUYER_PROFILES)) {
    if (norm.includes(k) || k.includes(norm)) {
      return BUYER_PROFILES[k];
    }
  }

  let code = 0;
  for (let i = 0; i < norm.length; i++) {
    code = (code + norm.charCodeAt(i)) % 10000;
  }
  const randomPhone = `984${String(code).padStart(4, '0')}${String((code * 17) % 1000).padStart(3, '0')}`;
  const mockGSTIN = `29AA${String.fromCharCode(65 + (code % 26))}${String.fromCharCode(65 + ((code + 7) % 26))}${String.fromCharCode(65 + ((code + 15) % 26))}${code}M1Z${code % 10}`;
  
  return {
    address: `${10 + (code % 90)}th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022`,
    gstin: mockGSTIN,
    phone: randomPhone,
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
  };
};

const formatDateLong = (dateStr: string | any): string => {
  if (!dateStr) {
    return '12-Jun-2026';
  }
  let cleanDateStr = String(dateStr);
  
  if (/^\d{1,2}-[A-Za-z]+-\d{4}$/i.test(cleanDateStr)) {
    return cleanDateStr;
  }

  let parsed: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDateStr)) {
    const [dd, mm, yyyy] = cleanDateStr.split('/');
    parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else {
    parsed = new Date(cleanDateStr);
  }

  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[parsed.getMonth()];
    const yyyy = parsed.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return cleanDateStr;
};

const getMerchantStatus = (status: string) => {
  const norm = String(status || '').toLowerCase().trim();
  if (norm === 'pending approval' || norm === 'awaiting settlement') {
    return {
      text: 'Processing',
      className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25'
    };
  }
  if (norm === 'awaiting grouping' || norm === 'accepted') {
    return {
      text: 'Accepted',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
    };
  }
  if (norm === 'rejected') {
    return {
      text: 'Under Review',
      className: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30'
    };
  }
  if (norm === 'in transit') {
    return {
      text: 'In Transit',
      className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25'
    };
  }
  if (norm === 'arrived' || norm === 'delivered' || norm === 'settled') {
    return {
      text: 'Arrived',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
    };
  }
  return {
    text: status || 'Processing',
    className: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-200'
  };
};

function MerchantOrdersView({ 
  orders, 
  isLoading, 
  onRefresh,
}: { 
  orders: any[], 
  isLoading: boolean, 
  onRefresh: () => void,
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PROCESSING' | 'TRANSIT' | 'ARRIVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const isMerchant = (localStorage.getItem('userRole') || 'admin') === 'merchant';

  // Metric Aggregations
  const totalQtls = orders.reduce((sum, order) => {
    const qty = order.originalOrders 
      ? order.originalOrders.reduce((subSum: number, sub: any) => subSum + (parseFloat(sub.qty) || 0), 0)
      : (parseFloat(order.qty) || 50);
    return sum + qty;
  }, 0);

  const inTransitCount = orders.filter(o => {
    const s = String(o.status || '').toLowerCase();
    const p = o.progress || 0;
    return s === 'in transit' || (p >= 50 && p < 100);
  }).length;

  const arrivedCount = orders.filter(o => {
    const s = String(o.status || '').toLowerCase();
    const p = o.progress || 0;
    return s === 'arrived' || s === 'delivered' || p >= 100;
  }).length;

  const processingCount = Math.max(0, orders.length - inTransitCount - arrivedCount);

  // Filtered orders list
  const filteredOrders = orders.filter(order => {
    const s = String(order.status || '').toLowerCase();
    const p = order.progress || 0;
    const isArrived = s === 'arrived' || s === 'delivered' || p >= 100;
    const isTransit = s === 'in transit' || (p >= 50 && p < 100);
    const isProcessing = !isArrived && !isTransit;

    if (statusFilter === 'PROCESSING' && !isProcessing) return false;
    if (statusFilter === 'TRANSIT' && !isTransit) return false;
    if (statusFilter === 'ARRIVED' && !isArrived) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBill = (order.billNo || order.id || '').toLowerCase().includes(q);
      const matchItems = (order.items || '').toLowerCase().includes(q);
      const matchSupplier = (order.supplier || '').toLowerCase().includes(q);
      if (!matchBill && !matchItems && !matchSupplier) return false;
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-5 pb-28 space-y-3.5 sm:space-y-4 font-sans">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#07140f] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
        <div className="space-y-1">
          <button 
            type="button"
            onClick={() => navigate('/store')}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-all cursor-pointer border-0 bg-transparent py-0.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Grain Store
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-serif text-lg sm:text-xl font-normal tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Order Tracking & Logistics
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Live dispatch updates for <span className="font-bold text-emerald-800 dark:text-emerald-300">{localStorage.getItem('userName') || 'Merchant Store'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                Refresh
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={() => navigate('/brokerage')}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            Brokerage Ledger
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Compressed Mobile-Optimized Executive Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-white dark:bg-[#0c1813] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Orders</span>
          <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">{orders.length}</span>
        </div>
        <div className="bg-white dark:bg-[#0c1813] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Volume</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">{totalQtls.toLocaleString()} <span className="text-[10px] font-sans font-bold">QTLS</span></span>
        </div>
        <div className="bg-white dark:bg-[#0c1813] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">In Transit</span>
          <span className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400">{inTransitCount}</span>
        </div>
        <div className="bg-white dark:bg-[#0c1813] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Arrived / Done</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-300">{arrivedCount}</span>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      {orders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {[
              { id: 'ALL', label: `All (${orders.length})` },
              { id: 'PROCESSING', label: `Processing (${processingCount})` },
              { id: 'TRANSIT', label: `In Transit (${inTransitCount})` },
              { id: 'ARRIVED', label: `Arrived (${arrivedCount})` },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  statusFilter === f.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white dark:bg-[#0a1511] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-neutral-800 hover:bg-slate-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bill ID, rice type..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0a1511] border border-slate-200/80 dark:border-neutral-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
          </div>
        </div>
      )}

      {isLoading && orders.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
          <p className="text-secondary text-sm font-bold">Connecting secure logistics nodes...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-[#040f0c] border border-emerald-900/10 dark:border-emerald-950/40 rounded-3xl p-12 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-500/10">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-emerald-950 dark:text-emerald-50">No Orders Tracked</h3>
            <p className="text-secondary text-xs max-w-sm mx-auto leading-relaxed">
              You haven't placed any grain shipments from the store catalog yet. Choose from our catalog and place an order to register tracking.
            </p>
          </div>
          <button
            onClick={() => navigate('/store')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer border-0"
          >
            Open Grain Store
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#07140f] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-8 text-center space-y-3 shadow-2xs">
          <Package className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No orders match the search or filter criteria.</p>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {filteredOrders.map((order, idx) => {
            const isExpanded = expandedId === order.id;
            
            // Map status string to active tracking step
            const statusStr = String(order.status || '').toLowerCase().trim();
            const progress = order.progress || 5;

            // Milestones
            const hasConfirmed = true;
            const hasApproved = statusStr !== 'awaiting settlement' && statusStr !== 'pending approval' && statusStr !== 'rejected';
            const hasTransit = statusStr === 'in transit' || progress >= 50 || statusStr === 'settled' || statusStr === 'arrived' || statusStr === 'delivered';
            const hasArrived = statusStr === 'arrived' || statusStr === 'delivered' || progress >= 100;

            const badgeInfo = getMerchantStatus(order.status);

            // Simple description message based on tracking level
            let deliveryText = "Your order is logged and awaiting supplier validation.";
            if (statusStr === 'rejected') {
              deliveryText = "Your order is under administrative review by the procurement desk.";
            } else if (hasArrived) {
              deliveryText = "Shipment successfully arrived at destination APMC Yard!";
            } else if (hasTransit) {
              deliveryText = "Truck is currently on the road. GPS logs update every hour.";
            } else if (hasApproved) {
              deliveryText = "Supplier confirmed and loaded items. Dispatching soon.";
            }

            const itemsCount = order.originalOrders ? order.originalOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || 0), 0) : (parseFloat(order.qty) || 50);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="bg-white dark:bg-[#06150f] border border-slate-200/90 dark:border-emerald-950/70 rounded-3xl p-4 sm:p-6 shadow-xs hover:shadow-md transition-all relative overflow-hidden text-left space-y-3.5"
              >
                {/* Visual Accent Ribbon */}
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1.5",
                  statusStr === 'rejected' ? "bg-amber-500" : hasArrived ? "bg-emerald-500" : hasTransit ? "bg-orange-500 animate-pulse" : "bg-emerald-400"
                )} />

                {/* Card Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-black uppercase text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                        ID: {order.billNo || order.id}
                      </span>
                      <span className={cn("text-[9.5px] font-sans font-black uppercase px-2.5 py-0.5 rounded-lg shadow-2xs", badgeInfo.className)}>
                        {badgeInfo.text}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-medium font-sans">
                        Placed on {formatDateLong(order.date)}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white truncate max-w-md uppercase tracking-tight">
                      {order.items || `Bulk Grain Lot (${itemsCount} QTLS)`}
                    </h4>
                  </div>

                  {/* Right Side Order Total Pill */}
                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 bg-slate-50 dark:bg-emerald-950/40 p-2.5 px-3.5 rounded-2xl border border-slate-100 dark:border-emerald-950/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Order Value</span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {order.total || `₹ ${formatINR(itemsCount * 4200)}`}
                    </span>
                  </div>
                </div>

                {/* Loading days Required Notice */}
                {order.loadingDays && statusStr !== 'rejected' && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-2.5 px-3.5 flex items-center gap-2 text-orange-950 dark:text-orange-200">
                    <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                    <p className="text-[11px] font-extrabold uppercase tracking-wide">
                      ⚡ Dispatch Target: Loading requested in {order.loadingDays} Day(s)
                    </p>
                  </div>
                )}

                {/* Tracker Timeline or Under Review Box */}
                {statusStr === 'rejected' ? (
                  <div className="my-3 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 rounded-2xl p-4 flex items-center gap-3 text-amber-900 dark:text-amber-200">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-black uppercase tracking-wider">Order Under Review</p>
                      <p className="text-[11.5px] font-medium leading-relaxed mt-0.5">
                        Your procurement request is currently under review by our trade administration desk.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="my-4 pt-1">
                    <div className="relative">
                      {/* Horizontal connector line */}
                      <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 dark:bg-neutral-800 -z-1" />
                      
                      {/* Active connector fill line */}
                      <div 
                        className={cn(
                          "absolute top-4 left-4 h-1 bg-emerald-500 -z-1 transition-all duration-500",
                          hasArrived ? "w-[92%]" : hasTransit ? "w-[61%]" : hasApproved ? "w-[31%]" : "w-0"
                        )} 
                      />

                      {/* Milestones container */}
                      <div className="flex justify-between items-center relative z-10">
                        {/* Step 1: Confirmed */}
                        <div className="flex flex-col items-center space-y-1.5 w-1/4">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                            hasConfirmed 
                              ? "bg-emerald-500 text-white shadow-sm scale-110" 
                              : "bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400"
                          )}>
                            <Clock className="w-4 h-4" />
                          </div>
                          <span className={cn(
                            "text-[9.5px] font-black uppercase tracking-wider text-center leading-tight",
                            hasConfirmed ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"
                          )}>
                            Placed
                          </span>
                        </div>

                        {/* Step 2: Approved / Loaded */}
                        <div className="flex flex-col items-center space-y-1.5 w-1/4">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                            hasApproved 
                              ? "bg-orange-500 text-white shadow-sm scale-110" 
                              : "bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400"
                          )}>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className={cn(
                            "text-[9.5px] font-black uppercase tracking-wider text-center leading-tight",
                            hasApproved ? "text-orange-600 dark:text-orange-400" : "text-slate-400"
                          )}>
                            Approved
                          </span>
                        </div>

                        {/* Step 3: Transit */}
                        <div className="flex flex-col items-center space-y-1.5 w-1/4">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                            hasTransit 
                              ? "bg-teal-500 text-white shadow-sm scale-110" 
                              : "bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400"
                          )}>
                            <Truck className="w-4 h-4" />
                          </div>
                          <span className={cn(
                            "text-[9.5px] font-black uppercase tracking-wider text-center leading-tight",
                            hasTransit ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
                          )}>
                            In Transit
                          </span>
                        </div>

                        {/* Step 4: Arrived */}
                        <div className="flex flex-col items-center space-y-1.5 w-1/4">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                            hasArrived 
                              ? "bg-emerald-600 text-white shadow-lg scale-115" 
                              : "bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400"
                          )}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <span className={cn(
                            "text-[9.5px] font-black uppercase tracking-wider text-center leading-tight",
                            hasArrived ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-slate-400"
                          )}>
                            Arrived
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub status details box */}
                <div className="bg-emerald-500/[0.04] dark:bg-emerald-950/20 rounded-2xl p-3 flex items-start gap-2.5 border border-emerald-500/15">
                  <div className="p-1 rounded-lg bg-white dark:bg-[#071912] border border-emerald-500/20 shrink-0 mt-0.5 shadow-2xs">
                    <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h5 className="text-[10.5px] font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">Logistics Update</h5>
                    <p className="text-slate-600 dark:text-slate-300 text-xs font-medium leading-relaxed mt-0.5">{deliveryText}</p>
                  </div>
                </div>

                {/* Card Footer Actions & Accordion Trigger */}
                <div className="border-t border-slate-100 dark:border-emerald-950/60 pt-3 flex flex-wrap justify-between items-center gap-2">
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    🚚 Supplier: <span className="text-slate-800 dark:text-slate-200 font-bold">{order.supplier || 'Annapurna Grains'}</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {!isMerchant && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await autoCreateArrivalEntryForIncomingLog(order.id, order);
                          navigate('/arrival-entry');
                        }}
                        className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                        title="Open Arrival Entry ledger spreadsheet"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        Arrival Entry
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}

                    <button 
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Breakdown"}</span>
                      <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
                    </button>
                  </div>
                </div>

                {/* Expandable Itemized Details Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-emerald-950/60 space-y-3 font-sans text-xs">
                        {/* Itemized Products */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Itemized Products & Rates
                          </span>
                          {order.originalOrders && order.originalOrders.length > 0 ? (
                            <div className="divide-y divide-slate-100 dark:divide-emerald-950/60 bg-slate-50 dark:bg-[#040f0c] rounded-2xl p-3 border border-slate-200/60 dark:border-emerald-950/60 space-y-1">
                              {order.originalOrders.map((sub: any, sidx: number) => (
                                <div key={`${sub.id || 'sub'}-${sidx}`} className="flex justify-between py-1.5 items-center first:pt-0 last:pb-0">
                                  <div className="leading-tight">
                                    <p className="font-extrabold text-slate-900 dark:text-white uppercase">{sub.product}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase font-mono mt-0.5">ID: {sub.id}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono font-black text-slate-900 dark:text-white text-xs">{sub.qty} QTLS</p>
                                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold font-mono">@ ₹ {formatINR(sub.rate)}/Qtl</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-[#040f0c] border border-slate-200/60 dark:border-emerald-950/60 rounded-2xl p-3">
                              <span className="font-extrabold text-slate-900 dark:text-white uppercase">{order.items || "Bulk Grain Lot"}</span>
                              <span className="font-mono font-black text-slate-900 dark:text-white">{itemsCount} QTLS</span>
                            </div>
                          )}
                        </div>

                        {/* Dispatch & Destination Route */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 dark:bg-[#040f0c] p-3 rounded-2xl border border-slate-200/60 dark:border-emerald-950/60">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Dispatch Origin</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{order.origin || 'Punjab Grain Hub'}</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Destination Yard</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{order.destination || 'APMC Yard, Bangalore'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const isOrderArrived = (order: any): boolean => {
  if (!order) return false;
  const statusStr = String(order.status || '').toLowerCase().trim();
  const progress = Number(order.progress) || 0;
  if (statusStr === 'arrived' || statusStr === 'delivered' || progress >= 100) {
    return true;
  }
  if (order.arrivalHistory && Array.isArray(order.arrivalHistory) && order.arrivalHistory.length > 0) {
    const totalArrived = order.arrivalHistory.reduce((sum: number, h: any) => sum + (Number(h.qty) || 0), 0);
    const ordered = Number(order.totalQty || order.qty) || 0;
    if (ordered > 0 && totalArrived >= ordered) return true;
  }
  return false;
};

export default function PlacedOrders() {
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole') || 'admin';
  const isMerchant = role === 'merchant';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPlacedOrders, setCurrentPlacedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'in_transit'>('all');
  const [showAutoSentBanner, setShowAutoSentBanner] = useState(false);

  // Delete whole placed orders modal states
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('just_placed_order') === 'true') {
      setShowAutoSentBanner(true);
      localStorage.removeItem('just_placed_order');
    }
  }, []);

  const totalVolumeAll = React.useMemo(() => {
    return currentPlacedOrders.reduce((sum, ord) => {
      const q = parseFloat(ord.totalQty || ord.items?.match(/\d+(\.\d+)?/)?.[0] || ord.qty || "0") || 0;
      return sum + q;
    }, 0);
  }, [currentPlacedOrders]);

  const totalValueAll = React.useMemo(() => {
    return currentPlacedOrders.reduce((sum, ord) => {
      if (ord.originalOrders && ord.originalOrders.length > 0) {
        return sum + ord.originalOrders.reduce((s: number, sub: any) => s + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 4200)), 0);
      }
      const raw = Number(ord.totalAmount) || (typeof ord.total === 'number' ? ord.total : parseFloat(String(ord.total || '').replace(/[^0-9.]/g, ''))) || 0;
      return sum + raw;
    }, 0);
  }, [currentPlacedOrders]);

  const allSuppliers = React.useMemo(() => {
    const suppliersSet = new Set<string>();
    currentPlacedOrders.forEach(o => {
      if (o.supplier) {
        suppliersSet.add(o.supplier);
      }
      if (o.originalOrders && Array.isArray(o.originalOrders)) {
        o.originalOrders.forEach((sub: any) => {
          const s = sub.supplier || sub.seller;
          if (s) suppliersSet.add(s);
        });
      }
    });
    return Array.from(suppliersSet).filter(Boolean).sort();
  }, [currentPlacedOrders]);

  const counts = React.useMemo(() => {
    let arrived = 0;
    let inTransit = 0;
    currentPlacedOrders.forEach(o => {
      if (isOrderArrived(o)) {
        arrived++;
      } else {
        inTransit++;
      }
    });
    return {
      all: currentPlacedOrders.length,
      arrived,
      inTransit
    };
  }, [currentPlacedOrders]);

  const filteredPlacedOrders = React.useMemo(() => {
    let list = currentPlacedOrders;

    // Arrived status filter
    if (statusFilter === 'arrived') {
      list = list.filter(o => isOrderArrived(o));
    } else if (statusFilter === 'in_transit') {
      list = list.filter(o => !isOrderArrived(o));
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      list = list.filter(o => {
        if (o.supplier && o.supplier.trim().toLowerCase() === supplierFilter.trim().toLowerCase()) {
          return true;
        }
        if (o.originalOrders && Array.isArray(o.originalOrders)) {
          return o.originalOrders.some((sub: any) => {
            const s = sub.supplier || sub.seller;
            return s && s.trim().toLowerCase() === supplierFilter.trim().toLowerCase();
          });
        }
        return false;
      });
    }
    return list;
  }, [currentPlacedOrders, statusFilter, supplierFilter]);

  // Modal states
  const [shareOrder, setShareOrder] = useState<any | null>(null);
  const [poOrder, setPoOrder] = useState<any | null>(null);
  const [a4PreviewOrder, setA4PreviewOrder] = useState<any | null>(null);
  const [a4PreviewSubOrders, setA4PreviewSubOrders] = useState<any[]>([]);
  const [arrivalConfirmOrder, setArrivalConfirmOrder] = useState<any | null>(null);
  const [arrivalQuantities, setArrivalQuantities] = useState<{[subId: string]: number}>({});
  const [arrivalRates, setArrivalRates] = useState<{[subId: string]: number}>({});
  const [actualSupplierBillNo, setActualSupplierBillNo] = useState<string>('');

  // Lifting To Modal state
  const [liftingOrder, setLiftingOrder] = useState<any | null>(null);
  const [liftingShopName, setLiftingShopName] = useState<string>('');
  const [liftingBillNo, setLiftingBillNo] = useState<string>('');
  const [liftingQtls, setLiftingQtls] = useState<string>('');
  const [liftingRate, setLiftingRate] = useState<string>('');
  const [liftingNotes, setLiftingNotes] = useState<string>('');
  const [isSavingLifting, setIsSavingLifting] = useState<boolean>(false);
  const [liftingScope, setLiftingScope] = useState<'whole' | 'suborders'>('whole');
  const [selectedSubOrderIds, setSelectedSubOrderIds] = useState<string[]>([]);

  // Form / Action states
  const [isCopied, setIsCopied] = useState(false);
  const [isMailCopied, setIsMailCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  // PO email form states
  const [poSender, setPoSender] = useState(() => localStorage.getItem('userEmail') || 'tejasadinarayan@gmail.com');
  const [poRecipient, setPoRecipient] = useState('');
  const [poSubject, setPoSubject] = useState('');
  const [isSendingPO, setIsSendingPO] = useState(false);
  const [poLogs, setPoLogs] = useState<string[]>([]);
  const [sendingSuccess, setSendingSuccess] = useState(false);

  // Load orders from Firestore + local fallback
  const parseCustomDate = (obj: any): number => {
    if (!obj) return 0;
    const dateStr = obj.purchaseOrderSentAt || obj.createdAt || obj.date;
    if (!dateStr) return 0;
    if (typeof dateStr === 'number') return dateStr;
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return parsed;
    return 0;
  };

  const sortNewestFirst = (arr: any[]) => {
    return [...arr].sort((a: any, b: any) => {
      const timeA = parseCustomDate(a);
      const timeB = parseCustomDate(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  };

  const buildUnifiedOrders = (
    placedList: any[], 
    procList: any[], 
    arrivalList: any[], 
    role: string | null, 
    merchantName: string
  ) => {
    const filterIgnored = (list: any[]) => (list || []).filter(
      (o: any) => o && o.id !== 'ORD-TC-1024' && !String(o.id).startsWith('#ORD-99') && !String(o.id).startsWith('TC-0000')
    );

    const validPlaced = filterIgnored(placedList);
    const validProc = filterIgnored(procList);

    // Collect all sub-order IDs wrapped in placed batch orders
    const placedSubOrderIds = new Set<string>();
    validPlaced.forEach((p: any) => {
      if (!p) return;
      if (p.id) placedSubOrderIds.add(String(p.id).trim().toLowerCase().replace(/^#/, ''));
      if (p.originalOrders && Array.isArray(p.originalOrders)) {
        p.originalOrders.forEach((sub: any) => {
          if (sub && sub.id) {
            placedSubOrderIds.add(String(sub.id).trim().toLowerCase().replace(/^#/, ''));
          }
        });
      }
    });

    const activeProc = validProc.filter((proc: any) => {
      if (!proc || !proc.id) return false;
      const normProcId = String(proc.id).trim().toLowerCase().replace(/^#/, '');
      return !placedSubOrderIds.has(normProcId);
    });

    let combined = [...validPlaced, ...activeProc];

    const uniqueMap = new Map<string, any>();
    combined.forEach(item => {
      if (!item || !item.id) return;
      const normKey = String(item.id).trim().toLowerCase().replace(/^#/, '');
      if (!uniqueMap.has(normKey)) {
        uniqueMap.set(normKey, item);
      }
    });

    let unique = Array.from(uniqueMap.values());

    if (role === 'merchant') {
      unique = unique.filter((order: any) => {
        const topBuyerMatch = order.buyer && order.buyer.trim().toLowerCase() === merchantName;
        const subBuyerMatch = order.originalOrders && Array.isArray(order.originalOrders) && 
          order.originalOrders.some((sub: any) => sub.buyer && sub.buyer.trim().toLowerCase() === merchantName);
        return topBuyerMatch || subBuyerMatch;
      });
    }

    const mappedUnique = unique.map((o: any) => {
      const matchingArrival = (arrivalList || []).find(row => 
        row && row.purchaseOrderNo && String(row.purchaseOrderNo).trim().toLowerCase().replace(/^#/, '') === String(o.id).trim().toLowerCase().replace(/^#/, '')
      );
      const obj = { ...o };
      const bNo = matchingArrival?.billNo || o.billNo;
      if (bNo) {
        obj.billNo = bNo;
      }
      return obj;
    });

    return sortNewestFirst(mappedUnique);
  };

  const handleDeleteWholePlacedOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePassword.trim() !== 'tejas') {
      setPasswordError('Incorrect authorization password. Deletion cancelled.');
      return;
    }

    setIsDeletingAll(true);
    setPasswordError(null);

    try {
      // 1. Delete all documents in placed_orders collection in Firestore
      const cloudDocs = await getCollectionDocs('placed_orders').catch(() => []);
      if (cloudDocs && cloudDocs.length > 0) {
        await Promise.all(
          cloudDocs.map(doc => deleteCollectionDoc('placed_orders', doc.id).catch(() => {}))
        );
      }

      // 2. Clear local storage records
      localStorage.removeItem('placed_orders');
      localStorage.setItem('placed_orders', '[]');
      localStorage.setItem('placed_orders_cleared_all', 'true');
      localStorage.setItem('cleared_placed_orders', 'true');

      // Also mark pending loadings cleared flag so pending loadings reflects the wipe
      localStorage.setItem('pending_loadings_cleared_all', 'true');
      localStorage.setItem('cleared_pending_loadings', 'true');

      // 3. Clear local state
      setCurrentPlacedOrders([]);
      setIsDeleteAllModalOpen(false);
      setDeletePassword('');
      setShowPassword(false);
      setToastMessage('All placed orders have been permanently deleted.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to wipe placed orders:', err);
      setPasswordError('Error deleting records from server. Please try again.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const loadOrders = async () => {
    try {
      const role = localStorage.getItem('userRole');
      const merchantName = (localStorage.getItem('userName') || 'V.K FOODS').trim().toLowerCase();

      const savedPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');

      // 1. Read local storage first for INSTANT local rendering (0ms delay)
      const savedProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');

      const localOrders = buildUnifiedOrders(savedPlaced, savedProcurements, localArrivals, role, merchantName);
      if (localOrders.length > 0) {
        setCurrentPlacedOrders(localOrders);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      // 2. Fetch Firestore documents in PARALLEL
      const [cloudPlaced, cloudProcurements, cloudArrivals] = await Promise.all([
        getCollectionDocs('placed_orders').catch(() => []),
        getCollectionDocs('procurement_requests').catch(() => []),
        getCollectionDocs('arrival_entries').catch(() => [])
      ]);

      let finalArrivals = [...localArrivals];
      if (cloudArrivals && cloudArrivals.length > 0) {
        const grid = Array(Math.max(30, cloudArrivals.length, localArrivals.length)).fill(0).map((_, i) => localArrivals[i] || {});
        cloudArrivals.forEach(row => {
          const idx = parseInt(row.id?.replace('row-', '') || '');
          if (!isNaN(idx) && idx >= 0) {
            const { id, ...cloudRow } = row;
            const localRow = grid[idx];
            const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
            const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));

            if (!isLocalReal && isCloudReal) {
              grid[idx] = row;
            } else if (isLocalReal && isCloudReal) {
              const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
              const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
              if (cloudTime > localTime || !localRow.lastUpdated) {
                grid[idx] = row;
              }
            }
          }
        });
        finalArrivals = grid.filter(g => g && Object.keys(g).length > 0);
      }

      const mergedPlaced = [...cloudPlaced, ...savedPlaced];
      const mergedProc = [...cloudProcurements, ...savedProcurements];

      const cloudOrders = buildUnifiedOrders(mergedPlaced, mergedProc, finalArrivals, role, merchantName);
      setCurrentPlacedOrders(cloudOrders);
    } catch (e) {
      console.error('Failed to load placed orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleOpenShare = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareOrder(order);
    
    const calculatedAmt = order.originalOrders && order.originalOrders.length > 0 
      ? order.originalOrders.reduce((sum: number, sub: any) => sum + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 4200)), 0)
      : null;
    const finalTotal = calculatedAmt !== null ? `₹ ${formatINR(calculatedAmt)}` : (typeof order.total === 'number' ? `₹ ${formatINR(order.total)}` : order.total);

    const message = `Dear Customer,\n\nWe are pleased to confirm that your procurement order has been placed successfully in our logistics pipeline!\n\nOrder Details:\n• Order ID: ${order.id}\n• Items: ${order.items}\n• Total Amount: ${finalTotal}\n• Shipment Status: ${order.status}\n• Location Routing: ${order.origin} ➔ ${order.destination}\n• Est Delivery Progress: ${order.progress}%\n\nThank you for choosing RiceAggregator and trusting our platform!\n--\nRiceAggregator Procurement Operations`;
    setShareMessage(message);
    setIsCopied(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(shareMessage);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleOpenPO = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setPoOrder(order);
    setPoSubject("Today's orders");
    
    const supplierName = order.supplier || order.origin || order.sellerName || 'ANNAPURNA RICE & AGRO INDUSTRIES';
    const supplierProfile = getSupplierProfile(supplierName);
    const inferredRecipient = (order.sellerEmail && order.sellerEmail.includes('@')) 
      ? order.sellerEmail 
      : (supplierProfile?.email || 'contact@annapurnarice.com');

    setPoRecipient(inferredRecipient);
    setPoSender(order.companyEmail || localStorage.getItem('userEmail') || 'tejasadinarayan@gmail.com');
    setSendingSuccess(false);
    setPoLogs([]);
  };

  const handleCopyEmailHTML = () => {
    if (!poOrder) return;
    const supplierName = poOrder.supplier || poOrder.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
    const subOrders = poOrder.originalOrders && poOrder.originalOrders.length > 0
      ? poOrder.originalOrders
      : [{
          id: poOrder.id,
          buyer: poOrder.buyer || "V.K FOODS",
          product: poOrder.items?.replace(/\(\d+.*$/, '').trim() || poOrder.product || "KESHAR KALI",
          qty: parseFloat(poOrder.qty || poOrder.items?.match(/\d+/)?.[0] || '80'),
          rate: parseFloat(poOrder.rate || '8400') || 8400,
          date: poOrder.date || new Date(),
          loadingDays: poOrder.loadingDays !== undefined ? poOrder.loadingDays : 0,
          unloadingPoint: poOrder.unloadingPoint || 'shop'
        }];

    const emailHtml = generateSupplierPOEmailHtml(supplierName, poOrder, subOrders);
    
    try {
      const blobHtml = new Blob([emailHtml], { type: 'text/html' });
      const blobText = new Blob([emailHtml.replace(/<[^>]*>?/gm, ' ')], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      navigator.clipboard.write(data);
    } catch (e) {
      navigator.clipboard.writeText(emailHtml);
    }
    setIsMailCopied(true);
    setTimeout(() => setIsMailCopied(false), 2000);
  };

  const handleOpenA4Preview = (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const subOrders = order.originalOrders && order.originalOrders.length > 0
      ? order.originalOrders
      : [{
          id: order.id,
          buyer: order.buyer || "V.K FOODS",
          product: order.items?.replace(/\(\d+.*$/, '').trim() || order.product || "KESHAR KALI",
          qty: parseFloat(order.qty || order.items?.match(/\d+/)?.[0] || '80'),
          rate: parseFloat(order.rate || '8400') || 8400,
          date: order.date || new Date(),
          loadingDays: order.loadingDays !== undefined ? order.loadingDays : 0,
          unloadingPoint: order.unloadingPoint || 'shop'
        }];

    setA4PreviewOrder(order);
    setA4PreviewSubOrders(subOrders);
  };

  const handleDownloadPoPdf = (order: any, subOrders: any[]) => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const supplierName = order?.supplier || order?.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
      const poRef = order?.id || 'PO-BATCH';
      const dateFormatted = formatPoDate(order?.date);
      
      // Header Logo
      doc.setFillColor(0, 132, 255);
      doc.roundedRect(14, 12, 12, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TC', 16.5, 20);

      // Brand Name
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('Tejas Canvassing', 30, 18);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Bangalore Grain Brokerage & Supply Chain Logistics • APMC Yard, Yeshwanthpur, Bangalore', 30, 23);

      // Right PO Info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PURCHASE ORDER', 196, 17, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`PO Ref: ${poRef}`, 196, 22, { align: 'right' });
      doc.text(`Date: ${dateFormatted}`, 196, 27, { align: 'right' });

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 32, 196, 32);

      // Supplier Info
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`DEAR ${supplierName.toUpperCase()},`, 14, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text("Today's consolidated orders issued under trade authorization:", 14, 45);

      // Table Data
      const tableData = subOrders.map((sub: any) => {
        const buyerName = sub.buyer || order?.buyer || 'V.K FOODS';
        const profile = resolveBuyerProfile(buyerName);
        const subDate = formatPoDate(sub.date || order?.date);
        const product = (sub.product || order?.product || 'KESHAR KALI').toUpperCase();
        const qty = `${sub.qty !== undefined ? sub.qty : 80}`;
        const rate = `${sub.rate !== undefined ? sub.rate : 8400}`;
        const loading = `Loading Days: ${sub.loadingDays !== undefined ? sub.loadingDays : 0}\nUnloading: ${sub.unloadingPoint || 'shop'}`;
        const buyerDetails = `${buyerName}\n${profile.address}\nGSTIN: ${profile.gstin} | Ph: ${profile.phone}`;

        return [subDate, buyerDetails, product, qty, rate, loading];
      });

      autoTable(doc, {
        startY: 49,
        head: [['DATE', 'BUYER & CONSIGNEE DETAILS', 'PRODUCT', 'QTY (QTL)', 'RATE (RS)', 'LOGISTICS']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left'
        },
        styles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          cellPadding: 3,
          valign: 'top',
          lineColor: [203, 213, 225],
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 70 },
          2: { cellWidth: 32 },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 26 }
        }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 150;

      // Total Volume
      const totalQty = subOrders.reduce((sum: number, s: any) => sum + (parseFloat(s.qty) || 0), 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Consolidated Volume: ${totalQty} Quintals`, 14, finalY + 8);

      // Terms
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Terms & Logistics Protocol: Goods must conform to standard moisture and grain analysis. Delivery to consignee address.', 14, finalY + 14);

      // Signatures
      doc.setDrawColor(203, 213, 225);
      doc.line(14, finalY + 36, 75, finalY + 36);
      doc.text('Authorized Signatory (Tejas Canvassing)', 14, finalY + 41);

      doc.line(135, finalY + 36, 196, finalY + 36);
      doc.text('Physical Ledger Filing / Acknowledgement', 135, finalY + 41);

      // Footer note
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('This official purchase order document serves as an authentic trade ledger copy generated by Tejas Canvassing.', 105, 287, { align: 'center' });

      doc.save(`PO_${poRef}_Tejas_Canvassing.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    }
  };

  const handleDirectPrintA4 = (order: any, subOrders: any[]) => {
    const supplierName = order?.supplier || order?.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
    printPoDocument(supplierName, order, subOrders);
    try {
      window.print();
    } catch (err) {
      console.warn("window.print call fallback:", err);
    }
  };

  const handleOpenStandaloneA4 = (order: any, subOrders: any[]) => {
    const supplierName = order?.supplier || order?.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
    const html = generateSupplierPOA4PrintHtml(supplierName, order, subOrders);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handlePrintPO = () => {
    if (!poOrder) return;
    handleOpenA4Preview(poOrder);
  };

  const handleSendPO = async () => {
    if (!poRecipient || !poSubject) return;
    setIsSendingPO(true);
    setPoLogs([]);
    
    setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Initializing Tejas Canvassing PO Dispatch Controller...`]);
    setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Connecting to SMTP and Phone Dispatch Gateway...`]);

    try {
      const supplierName = poOrder.supplier || poOrder.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
      const subOrders = poOrder.originalOrders && poOrder.originalOrders.length > 0
        ? poOrder.originalOrders
        : [{
            id: poOrder.id,
            buyer: poOrder.buyer || "V.K FOODS",
            product: poOrder.items?.replace(/\(\d+.*$/, '').trim() || poOrder.product || "KESHAR KALI",
            qty: parseFloat(poOrder.qty || poOrder.items?.match(/\d+/)?.[0] || '80'),
            rate: parseFloat(poOrder.rate || '8400') || 8400,
            date: poOrder.date || new Date(),
            loadingDays: poOrder.loadingDays !== undefined ? poOrder.loadingDays : 0,
            unloadingPoint: poOrder.unloadingPoint || 'shop'
          }];

      const calculatedAmt = subOrders.reduce((sum: number, sub: any) => sum + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 8400)), 0);
      const totalQty = subOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || 0), 0);

      // Generate exact visual layout matching reference specification
      const emailHtml = generateSupplierPOEmailHtml(supplierName, poOrder, subOrders);

      // 1. Dispatch PO to supplier via backend
      const poRes = await fetch('/api/dispatch-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: poRecipient,
          from: poSender || localStorage.getItem('userEmail') || 'tejasadinarayan@gmail.com',
          subject: poSubject,
          html: emailHtml,
          batchId: poOrder.id,
          supplierName: supplierName
        })
      });
      const poData = await poRes.json();
      setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SMTP Dispatch: ${poData.message || 'Success'} (Status: ${poData.status || 'OK'})`]);

      // 2. Dispatch WhatsApp confirmation to buyer / supplier phone
      const primaryBuyer = subOrders[0]?.buyer || poOrder.buyer || 'Buyer';
      const targetPhone = poOrder.phone || '9342380981';
      const whatsappMsg = `Tejas Canvassing Official PO: Batch ${poOrder.id} (${totalQty} QTLS) has been issued to supplier ${supplierName}. Total: ₹ ${formatINR(calculatedAmt)}. Delivery to: ${poOrder.destination || 'APMC Yard, Bangalore'}.`;

      const waRes = await fetch('/api/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetPhone,
          buyerName: primaryBuyer,
          message: whatsappMsg
        })
      });
      const waData = await waRes.json();
      setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Phone Message Dispatch: ${waData.message || 'Queued for delivery'} (${waData.status || 'OK'})`]);

      // 3. Dispatch SMS confirmation
      await fetch('/api/dispatch-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetPhone,
          recipientName: primaryBuyer,
          message: `Tejas Canvassing: PO ${poOrder.id} issued for ${totalQty} QTLS to ${supplierName}. Total ₹${formatINR(calculatedAmt)}.`
        })
      }).catch(() => {});

      const updatedOrder = {
        ...poOrder,
        purchaseOrderSent: true,
        purchaseOrderSentAt: new Date().toISOString(),
        companyEmail: poSender,
        sellerEmail: poRecipient
      };

      await setCollectionDoc('placed_orders', poOrder.id, updatedOrder);
      setCurrentPlacedOrders(prev => prev.map(o => o.id === poOrder.id ? updatedOrder : o));
      
      const saved = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedSaved = saved.map((o: any) => o.id === poOrder.id ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedSaved));

      setSendingSuccess(true);
    } catch (e: any) {
      console.error(e);
      setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Warning: ${e.message || 'Communication logged locally'}`]);
      setSendingSuccess(true);
    } finally {
      setIsSendingPO(false);
    }
  };

  const handleMarkAsArrived = async (
    orderId: string, 
    customQtys?: {[subId: string]: number}, 
    customRates?: {[subId: string]: number},
    billNoToUse?: string
  ) => {
    try {
      const targetOrder = currentPlacedOrders.find(o => o.id === orderId);
      if (!targetOrder) return;

      const finalBillNo = (billNoToUse || actualSupplierBillNo || targetOrder.actualSupplierBillNo || targetOrder.billNo || '').trim();

      const updatedOrder = {
        ...targetOrder,
        status: 'Arrived',
        progress: 100,
        billNo: finalBillNo || targetOrder.billNo,
        actualSupplierBillNo: finalBillNo || targetOrder.actualSupplierBillNo || targetOrder.billNo
      };

      // 1. Update React state IMMEDIATELY (0ms latency)
      setCurrentPlacedOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      
      // 2. Update localStorage IMMEDIATELY
      const saved = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedSaved = saved.map((o: any) => o.id === orderId ? updatedOrder : o);
      if (!updatedSaved.some((o: any) => o.id === orderId)) {
        updatedSaved.push(updatedOrder);
      }
      localStorage.setItem('placed_orders', JSON.stringify(updatedSaved));

      // 3. Ensure local Arrival Entry logs and sheets are updated FIRST
      await autoCreateArrivalEntryForIncomingLog(orderId, updatedOrder, customQtys, customRates, finalBillNo).catch(err => {
        console.error("Arrival Registry automatic auto-creation error:", err);
      });

      // 4. Fire-and-forget background cloud updates
      (async () => {
        try {
          await setCollectionDoc('placed_orders', orderId, updatedOrder);
          await markLedgerEntriesAsArrived(orderId, updatedOrder, customQtys, customRates).catch(err => {
            console.error("Ledger automatic arrival sync error:", err);
          });
        } catch (err) {
          console.error("Background arrival cloud sync failed:", err);
        }
      })();
    } catch (err) {
      console.error("Failed to mark order as arrived:", err);
    }
  };

  const handleOpenArrivalConfirm = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setArrivalConfirmOrder(order);
    setActualSupplierBillNo(order.actualSupplierBillNo || order.billNo || '');
    
    const qtyMap: {[key: string]: number} = {};
    const rateMap: {[key: string]: number} = {};
    
    if (order.originalOrders && order.originalOrders.length > 0) {
      order.originalOrders.forEach((sub: any, sIdx: number) => {
        const subId = sub.id || `sub-${sIdx}`;
        qtyMap[subId] = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
        rateMap[subId] = parseFloat(sub.rate) || 4200;
      });
    } else {
      const totalQty = parseFloat(order.items?.match(/\d+(\.\d+)?/)?.[0] || order.totalQty || "10");
      qtyMap[order.id] = totalQty;
      rateMap[order.id] = parseFloat(order.rate) || 4200;
    }
    
    setArrivalQuantities(qtyMap);
    setArrivalRates(rateMap);
  };

  const handleOpenLiftingModal = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setLiftingOrder(order);
    setLiftingShopName('');
    
    const defaultBillNo = order.actualSupplierBillNo || order.billNo 
      ? `${order.actualSupplierBillNo || order.billNo}-LFT` 
      : `LFT-${Math.floor(10000 + Math.random() * 90000)}`;
      
    setLiftingBillNo(defaultBillNo);
    
    const hasSubOrders = order.originalOrders && Array.isArray(order.originalOrders) && order.originalOrders.length > 0;
    
    if (hasSubOrders) {
      setLiftingScope('suborders');
      const allSubIds = order.originalOrders.map((sub: any, idx: number) => sub.id || `sub-${idx}`);
      setSelectedSubOrderIds(allSubIds);
      
      const totalSubQty = order.originalOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0), 0);
      const avgRate = order.originalOrders.length > 0 
        ? order.originalOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.rate) || 4200), 0) / order.originalOrders.length
        : parseFloat(order.rate) || 4200;
        
      setLiftingQtls(String(totalSubQty || 10));
      setLiftingRate(String(Math.round(avgRate) || 4200));
    } else {
      setLiftingScope('whole');
      setSelectedSubOrderIds([]);
      const totalQty = parseFloat(order.totalQty || order.items?.match(/\d+(\.\d+)?/)?.[0] || order.qty || "10");
      const totalRate = parseFloat(order.rate) || 4200;
      
      setLiftingQtls(String(totalQty || 10));
      setLiftingRate(String(totalRate || 4200));
    }
    
    setLiftingNotes('Customer denied receipt upon vehicle arrival. Stock redirected to new shop.');
  };

  const handleToggleSubOrderForLifting = (subId: string) => {
    if (!liftingOrder || !liftingOrder.originalOrders) return;
    
    let updated: string[];
    if (selectedSubOrderIds.includes(subId)) {
      updated = selectedSubOrderIds.filter(id => id !== subId);
    } else {
      updated = [...selectedSubOrderIds, subId];
    }
    setSelectedSubOrderIds(updated);

    const selectedSubs = liftingOrder.originalOrders.filter((sub: any, idx: number) => {
      const sId = sub.id || `sub-${idx}`;
      return updated.includes(sId);
    });

    const sumQty = selectedSubs.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0), 0);
    const avgRate = selectedSubs.length > 0
      ? selectedSubs.reduce((sum: number, sub: any) => sum + (parseFloat(sub.rate) || 4200), 0) / selectedSubs.length
      : parseFloat(liftingOrder.rate) || 4200;

    setLiftingQtls(String(sumQty));
    setLiftingRate(String(Math.round(avgRate)));
  };

  const handleSaveLifting = async () => {
    if (!liftingOrder || !liftingShopName.trim()) return;
    setIsSavingLifting(true);

    try {
      const orderId = liftingOrder.id;
      const qtlsVal = parseFloat(liftingQtls) || 0;
      const rateVal = parseFloat(liftingRate) || 0;
      const amountVal = qtlsVal * rateVal;

      let selectedSubOrdersList: any[] = [];
      if (liftingScope === 'suborders' && liftingOrder.originalOrders) {
        selectedSubOrdersList = liftingOrder.originalOrders.filter((sub: any, idx: number) => {
          const sId = sub.id || `sub-${idx}`;
          return selectedSubOrderIds.includes(sId);
        });
      }

      const newRecord = {
        id: `LFT-${Date.now()}`,
        orderId,
        originalBuyer: liftingOrder.buyer || liftingOrder.partyName || 'Original Buyer',
        shopName: liftingShopName.trim(),
        newBillNo: liftingBillNo.trim(),
        qtls: qtlsVal,
        rate: rateVal,
        totalAmount: amountVal,
        notes: liftingNotes.trim(),
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        timestamp: new Date().toISOString(),
        product: liftingOrder.product || 'Rice Grain Product',
        supplier: liftingOrder.supplier || 'Supplier',
        scope: liftingScope,
        selectedSubOrderIds: selectedSubOrderIds,
        selectedSubOrders: selectedSubOrdersList
      };

      const existingHistory = liftingOrder.liftingRecords || [];
      const updatedHistory = [newRecord, ...existingHistory];

      let updatedOriginalOrders = liftingOrder.originalOrders;
      if (liftingScope === 'suborders' && updatedOriginalOrders && Array.isArray(updatedOriginalOrders)) {
        updatedOriginalOrders = updatedOriginalOrders.map((sub: any, idx: number) => {
          const sId = sub.id || `sub-${idx}`;
          if (selectedSubOrderIds.includes(sId)) {
            return {
              ...sub,
              redirectedTo: liftingShopName.trim(),
              liftingBillNo: liftingBillNo.trim(),
              isLifted: true
            };
          }
          return sub;
        });
      }

      const updatedOrder = {
        ...liftingOrder,
        liftingRecords: updatedHistory,
        originalOrders: updatedOriginalOrders,
        currentShop: liftingShopName.trim(),
        lastLiftedAt: new Date().toISOString(),
        redirectedShop: liftingShopName.trim(),
        actualSupplierBillNo: liftingBillNo.trim() || liftingOrder.actualSupplierBillNo || liftingOrder.billNo
      };

      // 1. Update state
      setCurrentPlacedOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

      // 2. Save in placed_orders localStorage
      const saved = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedSaved = saved.map((o: any) => o.id === orderId ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedSaved));

      // 3. Save to global lifting_entries in localStorage
      const localLiftings = JSON.parse(localStorage.getItem('lifting_entries_v1') || '[]');
      localStorage.setItem('lifting_entries_v1', JSON.stringify([newRecord, ...localLiftings]));

      // 4. Update arrival entry ledger sheet with the new redirected shop and bill no
      await autoCreateArrivalEntryForIncomingLog(
        orderId, 
        {
          ...updatedOrder,
          buyer: liftingShopName.trim(),
          partyName: liftingShopName.trim(),
          billNo: liftingBillNo.trim()
        }, 
        { [orderId]: qtlsVal }, 
        { [orderId]: rateVal }, 
        liftingBillNo.trim()
      ).catch(err => console.error("Lifting arrival entry sync error:", err));

      // 4b. Also update buyer ledger records so payment and trade history are tracked under the new shop
      await updateLedgersForLifting(
        orderId,
        liftingShopName.trim(),
        liftingBillNo.trim(),
        newRecord,
        selectedSubOrderIds
      ).catch(err => console.error("Lifting ledgers update error:", err));

      // 5. Fire-and-forget background cloud updates
      (async () => {
        try {
          await setCollectionDoc('placed_orders', orderId, updatedOrder);
          await setCollectionDoc('lifting_entries', newRecord.id, newRecord);
        } catch (err) {
          console.error("Background lifting cloud sync failed:", err);
        }
      })();

      setLiftingOrder(null);
    } catch (err) {
      console.error("Error saving lifting details:", err);
    } finally {
      setIsSavingLifting(false);
    }
  };

  const renderDeleteAllModal = () => (
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
                  <h3 className="text-lg font-black text-on-surface tracking-tight">Delete Whole Placed Orders</h3>
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
                  Permanent action. Master authorization password verification is required to erase all placed order records.
                </p>
              </div>
            </div>

            {/* Scope Summary */}
            <form onSubmit={handleDeleteWholePlacedOrders} className="p-6 space-y-5">
              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>The following records will be permanently erased:</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                    <span className="text-[10px] font-bold text-secondary uppercase block">Orders</span>
                    <span className="text-sm font-black text-on-surface font-mono mt-0.5 block">{currentPlacedOrders.length}</span>
                  </div>
                  <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                    <span className="text-[10px] font-bold text-secondary uppercase block">Volume</span>
                    <span className="text-sm font-black text-on-surface font-mono mt-0.5 block">{totalVolumeAll.toFixed(1)} Q</span>
                  </div>
                  <div className="p-3 bg-surface rounded-xl border border-red-500/20 text-center">
                    <span className="text-[10px] font-bold text-secondary uppercase block">Value</span>
                    <span className="text-xs font-black text-on-surface font-mono mt-0.5 block">₹ {formatINR(totalValueAll)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-secondary leading-relaxed font-medium">
                  This will purge all placed order documents from both Cloud Firestore and browser storage. This operation cannot be reversed.
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
                      <span>Deleting Whole Placed Orders...</span>
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
  );

  const renderToast = () => (
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
  );

  if (isMerchant) {
    return (
      <>
        <MerchantOrdersView 
          orders={currentPlacedOrders} 
          isLoading={isLoading} 
          onRefresh={loadOrders}
        />
        {renderToast()}
      </>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">Logistics Pipeline</h1>
          <p className="text-secondary text-sm font-medium">Tracking and history of all procurement shipments with Firestore integration.</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-black transition-all border border-red-500/25 shadow-sm hover:border-red-500/40 cursor-pointer"
            title="Delete Whole Placed Orders"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Delete Whole Placed Orders</span>
          </button>
          <button 
            onClick={loadOrders}
            className="px-4 py-2 border border-outline-variant bg-surface rounded-xl text-xs font-black uppercase tracking-wider hover:bg-surface-container transition-all text-primary flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh Pipeline"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAutoSentBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-5 bg-gradient-to-r from-emerald-50 to-teal-500/10 dark:from-emerald-950/10 dark:to-teal-950/5 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md shadow-emerald-500/5 font-sans"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/25">
                <CheckCircle2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-black text-slate-950 dark:text-slate-100 leading-none">Order Grouped & Dispatched Automatically!</p>
                <p className="text-xs text-secondary/90 font-medium leading-relaxed max-w-2xl">
                  The system has automatically compiled your multipart purchase order (PO) and transmitted it via <strong className="text-emerald-700 dark:text-emerald-400 font-bold">SMTP Mail</strong> to the assigned supplier's inbox, and also dispatched an automated <strong className="text-emerald-700 dark:text-emerald-400 font-bold">WhatsApp notification</strong> to the buyer consignee(s).
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAutoSentBanner(false)}
              className="px-3 py-1.5 hover:bg-emerald-500/15 dark:hover:bg-emerald-400/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 transition-colors border border-emerald-500/15"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Control Bar with Arrived and Supplier Channels */}
      <motion.div 
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 liquid-glass p-4 rounded-2xl premium-border shadow-sm"
      >
        {/* Status / Arrived Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-secondary uppercase tracking-widest mr-1">
            <Filter className="w-4 h-4 text-primary" />
            <span>Filter:</span>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-2",
              statusFilter === 'all'
                ? "bg-primary text-on-primary border-primary shadow-sm"
                : "bg-surface text-secondary hover:bg-surface-container border-outline-variant/40"
            )}
          >
            <span>All Orders</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold",
              statusFilter === 'all' ? "bg-black/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-secondary"
            )}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('arrived')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-2",
              statusFilter === 'arrived'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                : "bg-surface text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 border-outline-variant/40"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Arrived</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold",
              statusFilter === 'arrived' ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
            )}>
              {counts.arrived}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('in_transit')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-2",
              statusFilter === 'in_transit'
                ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                : "bg-surface text-secondary hover:bg-surface-container border-outline-variant/40"
            )}
          >
            <Truck className="w-3.5 h-3.5 text-amber-500" />
            <span>In Transit</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold",
              statusFilter === 'in_transit' ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-secondary"
            )}>
              {counts.inTransit}
            </span>
          </button>
        </div>

        {/* Dropdown Selectors */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Status Dropdown Filter */}
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-surface-container text-on-surface text-xs font-bold px-3 py-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer tracking-wider"
            >
              <option value="all">📦 Status: All Orders</option>
              <option value="arrived">✅ Status: Arrived</option>
              <option value="in_transit">🚚 Status: In Transit</option>
            </select>
          </div>

          {/* Supplier Dropdown Filter */}
          {allSuppliers.length > 0 && (
            <div className="w-full sm:w-60">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full bg-surface-container text-on-surface text-xs font-bold px-3 py-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer tracking-wider"
              >
                <option value="all">🌐 All Regional Suppliers</option>
                {allSuppliers.map((sup) => (
                  <option key={sup} value={sup}>🌾 {sup}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-8 font-sans">
        <div className="col-span-12 space-y-6">
          {isLoading && currentPlacedOrders.length === 0 ? (
            <div className="p-16 text-center select-none bg-surface border border-outline-variant rounded-2xl flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-secondary">Retrieving online state logs...</p>
            </div>
          ) : currentPlacedOrders.length === 0 ? (
            <div className="p-16 text-center select-none bg-surface border border-dashed border-outline-variant rounded-2xl">
              <p className="text-sm text-secondary italic">No orders placed yet. Group active requests in the Orders view to begin.</p>
            </div>
          ) : filteredPlacedOrders.length === 0 ? (
            <div className="p-16 text-center select-none bg-surface border border-dashed border-outline-variant rounded-2xl space-y-3">
              <p className="text-xs text-secondary italic font-bold uppercase tracking-wider">
                {statusFilter === 'arrived' && supplierFilter !== 'all'
                  ? `No arrived shipments found for supplier "${supplierFilter}".`
                  : statusFilter === 'arrived'
                  ? 'No shipments with "Arrived" status found.'
                  : statusFilter === 'in_transit'
                  ? 'No shipments currently in transit.'
                  : `No shipments match supplier: "${supplierFilter}"`}
              </p>
              {(statusFilter !== 'all' || supplierFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSupplierFilter('all');
                  }}
                  className="px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            filteredPlacedOrders.map((order: any, idx: number) => {
              const calculatedAmt = order.originalOrders && order.originalOrders.length > 0 
                ? order.originalOrders.reduce((sum: number, sub: any) => sum + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 4200)), 0)
                : null;
              const displayTotalStr = calculatedAmt !== null ? `₹ ${formatINR(calculatedAmt)}` : (typeof order.total === 'number' ? `₹ ${formatINR(order.total)}` : order.total);

              return (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 22, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ y: -4, transition: { duration: 0.22, ease: "easeOut" } }}
                  transition={{ 
                    duration: 0.48, 
                    delay: idx * 0.05,
                    ease: [0.16, 1, 0.3, 1] 
                  }}
                  className="liquid-glass p-6 rounded-2xl flex flex-col gap-6 relative overflow-hidden group interactive-card premium-border"
                >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Expand controls */}
                  <div 
                    className="absolute top-0 right-0 w-12 h-16 bg-primary/5 opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10 rounded-bl-xl border-l border-b border-outline-variant/30"
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  >
                    <ChevronRight className={cn("w-5 h-5 text-primary transition-transform duration-500", expandedId === order.id && "rotate-90")} />
                  </div>

                  <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant">
                    {order.id.startsWith('TC') ? <Layers className="w-8 h-8 text-primary" /> : 
                     order.status === 'In Transit' ? <Truck className="w-8 h-8 text-primary" /> : <Package className="w-8 h-8 text-secondary" />}
                  </div>

                  <div className="flex-1 space-y-4 pr-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-black text-lg flex flex-wrap items-center gap-2">
                          {order.billNo || order.id}
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black",
                            order.status === 'In Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            (order.status === 'Pending Approval' || order.status === 'Awaiting Settlement') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          )}>
                            {order.status}
                          </span>
                          {order.purchaseOrderSent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                              PO Sent
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-secondary font-medium">{order.items}</p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-base font-black text-on-surface">{displayTotalStr}</p>
                        <p className="text-[10px] font-bold text-secondary uppercase italic">{order.date}</p>
                      </div>
                    </div>

                    {/* Supplier & Consignee Buyers Info Panel (Replacing Progress Bar) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low/60 dark:bg-neutral-900/40 p-4 rounded-xl border border-outline-variant/30">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black tracking-widest text-secondary uppercase block">
                          🌾 Primary Supplier Channel
                        </span>
                        <p className="text-xs font-black text-on-surface uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-550" />
                          {order.supplier || (order.originalOrders && order.originalOrders[0]?.supplier) || 'Annapurna Grains'}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black tracking-widest text-secondary uppercase block">
                          👥 Registered Buyers (Consignees)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(order.buyer 
                            ? [order.buyer]
                            : (order.originalOrders && Array.isArray(order.originalOrders))
                              ? Array.from(new Set(order.originalOrders.map((sub: any) => sub.buyer).filter(Boolean)))
                              : ['Unassigned Buyer']
                          ).map((buyerName: string, bIdx) => (
                            <span 
                              key={bIdx} 
                              className="px-2.5 py-1 rounded bg-[#faf8f5] dark:bg-black border border-outline-variant text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide"
                            >
                              {buyerName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Automated Dispatch Indicators */}
                    <div className="flex flex-col sm:flex-row gap-2 p-2.5 bg-emerald-550/[0.03] dark:bg-emerald-500/[0.01] rounded-xl border border-emerald-500/10 text-[10px] text-emerald-800 dark:text-emerald-400 font-bold tracking-tight uppercase">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Email auto-sent to supplier: <strong className="text-on-surface font-black ml-1">{order.supplier || (order.originalOrders && order.originalOrders[0]?.supplier) || 'Annapurna Grains'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>WhatsApp auto-sent to buyer: <strong className="text-on-surface font-black ml-1">{order.buyer || 'Multiple Buyers'}</strong></span>
                      </div>
                    </div>

                    {order.liftingRecords && order.liftingRecords.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-700 dark:text-purple-300 text-xs font-bold">
                        <Truck className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="flex-1">
                          <strong>Lifted / Redirected to:</strong> {order.currentShop || order.liftingRecords[0]?.shopName} • 
                          <span className="font-mono ml-1">Bill #: {order.liftingRecords[0]?.newBillNo}</span> • 
                          <span className="font-mono ml-1">{order.liftingRecords[0]?.qtls} QTLS @ ₹{formatINR(order.liftingRecords[0]?.rate)}/QTL</span>
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-outline-variant/10">
                      <div className="flex items-center gap-4 text-[11px] font-black">
                        <div className="flex items-center gap-1 text-secondary">
                          <MapPin className="w-3 h-3 text-secondary/70" />
                          {order.origin || 'Punjab, PB'}
                        </div>
                        <div className="w-4 h-px bg-outline-variant/40" />
                        <div className="flex items-center gap-1 text-primary">
                          <MapPin className="w-3 h-3 text-primary/70" />
                          {order.destination || 'Consolidated Hub'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Share summary button */}
                        <button 
                          onClick={(e) => handleOpenShare(order, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/[0.06] hover:bg-secondary/[0.12] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-secondary border border-secondary/15"
                          title="Share order summary to customer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share Summary
                        </button>
                        
                        {/* Send PO to seller button */}
                        <button 
                          onClick={(e) => handleOpenPO(order, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/[0.06] hover:bg-primary/[0.12] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-primary border border-primary/15"
                          title="Send Purchase Order email to Seller"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {order.purchaseOrderSent ? "PO Resend" : "Send PO"}
                        </button>

                        {/* Direct Print A4 PO for filing */}
                        <button 
                          onClick={(e) => handleOpenA4Preview(order, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer shadow-sm hover:shadow"
                          title="Print Purchase Order on A4 Sheet for Paperwork / Filing"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          Print A4
                        </button>

                        {/* Mark as arrived button */}
                        {order.status !== 'Arrived' ? (
                          <button 
                            onClick={(e) => handleOpenArrivalConfirm(order, e)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/[0.1] hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-600/20"
                            title="Mark order as Arrived and complete logistics pipeline"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Arrived
                          </button>
                        ) : !isMerchant ? (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              await autoCreateArrivalEntryForIncomingLog(order.id, order);
                              navigate('/arrival-entry');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200/50 transition-all cursor-pointer"
                            title="This order is marked as arrived. Click to view or edit details in the Arrival Entry spreadsheet."
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Arrived • Go to Arrival Entry
                            <ChevronRight className="w-3 h-3 ml-0.5 text-emerald-500" />
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Arrived
                          </span>
                        )}

                        {/* Lifting To button */}
                        <button 
                          type="button"
                          onClick={(e) => handleOpenLiftingModal(order, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-purple-500/20 shadow-sm cursor-pointer"
                          title="If customer denies arrival, redirect truck load to another shop"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          {order.liftingRecords && order.liftingRecords.length > 0 ? `Lifting To (${order.liftingRecords.length})` : "Lifting To"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedId === order.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="pt-6 border-t border-outline-variant/30 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Batch Summary & Individual Payment Tracking</h4>
                       {order.purchaseOrderSentAt && (
                         <span className="text-[9px] text-secondary font-mono italic">
                           PO sent on: {new Date(order.purchaseOrderSentAt).toLocaleString()}
                         </span>
                       )}
                     </div>
                     <div className="space-y-2">
                      {order.originalOrders?.map((sub: any, sIdx: number) => {
                        const subQty = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
                        const subRate = parseFloat(sub.rate) || 4200;
                        const subAmount = subQty * subRate;
                        const subProduct = sub.product || "1121 Sella Rice";
                        const subSupplier = sub.supplier || sub.seller || order.supplier || "Amritsar Grain Export Ltd.";

                        return (
                          <div key={`${sub.id}-${sIdx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10 gap-4">
                            <div className="flex items-start gap-4">
                               <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-[9px] font-black text-primary border border-outline-variant shadow-sm px-1 text-center leading-tight shrink-0 mt-1">
                                 {sub.id.replace('TC-', '').replace('#', '')}
                               </div>
                               <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-on-surface">{sub.buyer}</p>
                                    <span className="text-[9px] font-mono text-secondary bg-surface-container border border-outline-variant/30 px-1.5 py-0.5 rounded">
                                      {subProduct}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-secondary font-medium">
                                    Supplier: <strong className="text-on-surface">{subSupplier}</strong>
                                  </p>
                                  <p className="text-xs font-semibold text-secondary/80">
                                    Price: <span className="font-bold text-primary font-mono">{subQty.toFixed(2)} QTLS</span> @ <span className="font-bold font-mono">₹{formatINR(subRate)} / QTL</span>
                                  </p>
                               </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-outline-variant/10 pt-3 sm:pt-0">
                               <div className="text-left sm:text-right">
                                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">Subtotal Amount</p>
                                  <p className="text-sm font-black text-on-surface font-mono">₹ {formatINR(subAmount)}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">Pay Status</p>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border block w-fit",
                                    sub.status === 'Settled' || sub.paymentStatus === 'Received' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                  )}>
                                    {sub.status || sub.paymentStatus || 'Awaiting Proof'}
                                  </span>
                                </div>
                            </div>
                          </div>
                        );
                      })}
                      {!order.originalOrders && (
                         <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
                            <p className="text-xs text-secondary italic">Individual tracking unavailable for legacy records.</p>
                         </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: SHARE CUSTOMER SUMMARY & DEFAULT MESSAGING */}
      <AnimatePresence>
        {shareOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <MessageSquare className="w-5 h-5" />
                  <h3 className="font-black text-lg">Share Order Summary</h3>
                </div>
                <button 
                  onClick={() => setShareOrder(null)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors text-secondary hover:text-on-surface"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-secondary">Target Recipient</p>
                  <p className="text-sm font-bold text-on-surface bg-surface-container-low px-3  py-2 rounded-xl border border-outline-variant/30">
                    {shareOrder.buyer || 'Unified Logistics Client'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black uppercase tracking-widest text-secondary">Default CRM Messaging Template</label>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">CRM Ready</span>
                  </div>
                  <textarea
                    rows={8}
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    className="w-full p-4 bg-surface-container border border-outline-variant rounded-xl outline-none text-xs font-bold text-on-surface leading-five font-sans focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <p className="text-[10px] text-secondary font-medium tracking-tight leading-normal">
                    This default summary is formatted dynamically and is copyable to facilitate quick client routing via external messengers.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-surface-container border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Check className={cn("w-4 h-4 text-emerald-500 transition-opacity", isCopied ? "opacity-100" : "opacity-0")} />
                  <span className={cn("text-[11px] font-black text-emerald-600 uppercase transition-opacity", isCopied ? "opacity-100" : "opacity-0")}>
                    Copied to clipboard!
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyMessage}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-container rounded-xl border border-outline-variant text-xs font-black uppercase tracking-wider transition-all text-on-surface"
                  >
                    <Copy className="w-4 h-4 text-secondary" />
                    {isCopied ? "Copied" : "Copy Message"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: SEND PURCHASE ORDER TO SELLER FROM COMPANY MAIL */}
      <AnimatePresence>
        {poOrder && (() => {
          const rawSupplierName = poOrder.supplier || (poOrder.originalOrders && poOrder.originalOrders[0]?.supplier) || poOrder.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES';
          const supplierName = rawSupplierName === 'Consolidated Hub' ? 'ANNAPURNA RICE & AGRO INDUSTRIES' : rawSupplierName;

          const poOrderCalculatedAmt = poOrder.originalOrders && poOrder.originalOrders.length > 0
            ? poOrder.originalOrders.reduce((sum: number, sub: any) => sum + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 4200)), 0)
            : null;
          const poOrderDisplayTotal = poOrderCalculatedAmt !== null ? `₹ ${formatINR(poOrderCalculatedAmt)}` : (typeof poOrder.total === 'number' ? `₹ ${formatINR(poOrder.total)}` : poOrder.total);

          const subOrders = poOrder.originalOrders && poOrder.originalOrders.length > 0
            ? poOrder.originalOrders
            : [{
                id: poOrder.id,
                buyer: poOrder.buyer || "G.K.UDYOG",
                product: poOrder.items?.replace(/\(\d+.*$/, '').trim() || "KESHAR KALI",
                qty: parseFloat(poOrder.items?.match(/\d+/)?.[0] || '24'),
                rate: 8000,
                date: poOrder.date || '12 June, 2026',
                loadingDays: 0,
                unloadingPoint: 'shop'
              }];

          const handleCopyEmailHTML = () => {
            const htmlContainer = document.getElementById('po-email-preview-container');
            if (!htmlContainer) return;
            const htmlContent = htmlContainer.innerHTML;
            const textContent = `Tejas Canvassing\nBangalore\n\nDear ${supplierName.toUpperCase()},\n\nToday's orders:\n\n` + 
              subOrders.map((s: any) => {
                const profile = getBuyerProfile(s.buyer);
                return `- ${s.buyer} (${s.product || 'KESHAR KALI'}): ${s.qty} QTLS @ Rate ${s.rate || 8000}\n  Address: ${profile.address}\n  GSTIN: ${profile.gstin} | Phone: ${profile.phone}`;
              }).join('\n\n');
            
            if (navigator.clipboard && window.ClipboardItem) {
              const blobHTML = new Blob([htmlContent], { type: 'text/html' });
              const blobText = new Blob([textContent], { type: 'text/plain' });
              const item = new ClipboardItem({
                'text/html': blobHTML,
                'text/plain': blobText
              });
              navigator.clipboard.write([item]).then(() => {
                setIsMailCopied(true);
                setTimeout(() => setIsMailCopied(false), 2000);
              }).catch(err => {
                console.error("Failed to copy rich HTML email:", err);
                navigator.clipboard.writeText(htmlContent);
                setIsMailCopied(true);
                setTimeout(() => setIsMailCopied(false), 2000);
              });
            } else {
              navigator.clipboard.writeText(htmlContent);
              setIsMailCopied(true);
              setTimeout(() => setIsMailCopied(false), 2000);
            }
          };

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline-variant flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="w-5 h-5" />
                  <h3 className="font-black text-lg">Send Purchase Order (PO)</h3>
                </div>
                <button 
                  onClick={() => setPoOrder(null)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors text-secondary hover:text-on-surface"
                  disabled={isSendingPO}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
                {!sendingSuccess ? (
                  <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSendPO(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Company Mail (From)</label>
                        <div className="relative group">
                          <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                          <input 
                            type="email"
                            required
                            value={poSender}
                            onChange={(e) => setPoSender(e.target.value)}
                            placeholder="tejasadinarayan@gmail.com"
                            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Seller Mail (To)</label>
                        <div className="relative group">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                          <input 
                            type="email"
                            required
                            value={poRecipient}
                            onChange={(e) => setPoRecipient(e.target.value)}
                            placeholder="seller@punjabgrains.com"
                            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary">PO Subject Line</label>
                      <input 
                        type="text"
                        required
                        value={poSubject}
                        onChange={(e) => setPoSubject(e.target.value)}
                        placeholder="Subject"
                        className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>

                    {/* High-Fidelity Official Mail Live Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Formatted Email Content (Desktop Preview)</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePrintPO}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-sm border border-slate-700 cursor-pointer"
                            title="Print Purchase Order formatted for A4 physical filing sheet"
                          >
                            <Printer className="w-3.5 h-3.5 text-white" />
                            Print A4 Sheet
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyEmailHTML}
                            className="flex items-center gap-1.5 px-3 py-1 bg-primary/[0.06] hover:bg-primary/[0.12] rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-primary border border-primary/15"
                            title="Copy rich format email payload to clipboard"
                          >
                            {isMailCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied Rich Mail!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-primary" />
                                Copy Rich Mail
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Desktop Email Sandbox Wrapper */}
                      <div className="border border-outline-variant bg-surface-container rounded-xl p-4 md:p-6 shadow-inner space-y-4">
                        {/* Email Envelope Header */}
                        <div className="bg-surface/85 backdrop-blur-sm p-3 rounded-lg border border-outline-variant/30 text-[10px] space-y-1 text-secondary font-bold">
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">From:</span> <span className="text-on-surface">{poSender}</span></div>
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">To:</span> <span className="text-on-surface">{poRecipient}</span></div>
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">Subject:</span> <span className="text-on-surface select-all">{poSubject}</span></div>
                        </div>

                        {/* Exact copy of user-supplied image inside email body */}
                        <div 
                          id="po-email-preview-container"
                          className="bg-white p-6 md:p-10 rounded-lg shadow-md border border-[#dddddd] text-slate-800 text-left overflow-x-auto select-text"
                          style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                        >
                          {/* Top row with Logo and Business details */}
                          <div className="flex items-center justify-between pb-3 border-b border-[#dddddd]">
                            <div className="flex items-center gap-3">
                              {/* Blue TC logo box */}
                              <div className="w-10 h-10 bg-[#0091ff] flex items-center justify-center rounded text-white font-sans font-black text-lg select-none">
                                TC
                              </div>
                              <div className="text-left font-sans">
                                <h3 className="text-base font-extrabold text-slate-900 leading-tight tracking-tight">Tejas Canvassing</h3>
                                <p className="text-[10px] text-slate-500 leading-none font-medium">Bangalore</p>
                              </div>
                            </div>
                          </div>

                          {/* Subject reference greeting */}
                          <div className="pt-6 pb-2">
                            <p className="text-[11px] text-slate-800 font-extrabold font-sans uppercase mb-1">
                              DEAR {supplierName.toUpperCase()},
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium font-sans">
                              Today's orders:
                            </p>
                          </div>

                          {/* Pixel Perfect Tabular layout identical to the reference design */}
                          <div className="w-full my-4">
                            <table className="w-full border-collapse border border-[#dddddd] font-sans text-[10.5px]">
                              <thead>
                                <tr className="bg-[#f2f2f2] text-slate-700 font-extrabold border-b border-[#dddddd]">
                                  <th className="p-2 border border-[#dddddd] text-left uppercase tracking-wider font-extrabold" style={{ width: '13%' }}>Date</th>
                                  <th className="p-2 border border-[#dddddd] text-left uppercase tracking-wider font-extrabold" style={{ width: '42%' }}>Buyer</th>
                                  <th className="p-2 border border-[#dddddd] text-left uppercase tracking-wider font-extrabold" style={{ width: '15%' }}>Product</th>
                                  <th className="p-2 border border-[#dddddd] text-right uppercase tracking-wider font-extrabold" style={{ width: '10%' }}>Qty (quintals)</th>
                                  <th className="p-2 border border-[#dddddd] text-right uppercase tracking-wider font-extrabold" style={{ width: '10%' }}>Rate (per qtl.)</th>
                                  <th className="p-2 border border-[#dddddd] text-left uppercase tracking-wider font-extrabold" style={{ width: '10%' }}>Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#dddddd] text-[#334155]">
                                {subOrders.map((sub: any, sIdx: number) => {
                                  const profile = resolveBuyerProfile(sub.buyer || poOrder.buyer || 'V.K FOODS');
                                  const subQty = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 80;
                                  const subRate = parseFloat(sub.rate) || 8400;
                                  const subProduct = (sub.product || poOrder.product || "KESHAR KALI").toUpperCase();
                                  const loadingDays = sub.loadingDays !== undefined ? sub.loadingDays : 0;
                                  const unloadingPoint = sub.unloadingPoint || 'shop';

                                  return (
                                    <tr key={sIdx} className="align-top bg-white font-medium hover:bg-slate-50/40 transition-colors">
                                      <td className="p-3 border border-[#dddddd] text-slate-600 font-sans tracking-wide">
                                        {formatPoDate(sub.date || poOrder.date)}
                                      </td>
                                      <td className="p-3 border border-[#dddddd] text-left space-y-1.5 font-sans">
                                        <div className="font-extrabold text-slate-900 uppercase tracking-wide">{sub.buyer || 'V.K FOODS'}</div>
                                        <div className="text-[9.5px] text-slate-500 leading-normal max-w-sm">{profile.address}</div>
                                        <div className="text-[9.5px] text-slate-500 space-y-0.5 pt-1.5 border-t border-slate-100">
                                          <div><span className="font-bold text-slate-800">GSTIN:</span> <span className="font-mono font-bold select-all text-slate-700">{profile.gstin}</span></div>
                                          <div><span className="font-bold text-slate-800">Phone:</span> <span className="select-all font-bold text-slate-700">{profile.phone}</span></div>
                                          <div><span className="font-bold text-slate-800">Email:</span> <a href={`mailto:${profile.email}`} className="text-[#0091ff] hover:underline font-bold select-all">{profile.email}</a></div>
                                        </div>
                                      </td>
                                      <td className="p-3 border border-[#dddddd] font-extrabold text-slate-800 uppercase tracking-wider select-all">
                                        {subProduct}
                                      </td>
                                      <td className="p-3 border border-[#dddddd] text-right font-extrabold font-mono text-slate-800 select-all">
                                        {subQty}
                                      </td>
                                      <td className="p-3 border border-[#dddddd] text-right font-extrabold font-mono text-slate-800 select-all">
                                        {subRate}
                                      </td>
                                      <td className="p-3 border border-[#dddddd] text-left space-y-1 text-[9.5px] text-slate-500 font-sans">
                                        <div>
                                          <span className="font-extrabold text-slate-800">No of days for loading:</span> <strong className="text-[#0091ff] font-bold">{loadingDays}</strong>
                                        </div>
                                        <div>
                                          <span className="font-extrabold text-slate-800">Unloading Point:</span> <strong>{unloadingPoint}</strong>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Bottom metadata */}
                          <div className="mt-4 pt-3 border-t border-slate-100 text-[9px] text-slate-400 font-medium italic select-none">
                            This transaction confirmation was dynamically encoded and transmitted securely under Tejas Canvassing authorization protocols.
                          </div>
                        </div>
                      </div>
                    </div>

                    {isSendingPO && (
                      <div className="bg-[#121214] text-emerald-400 p-4 rounded-xl border border-emerald-900/30 font-mono text-[10px] space-y-1.5 shadow-2xl h-44 overflow-y-auto">
                        <p className="text-gray-400 flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5 text-primary" /> SMTP Logs:
                        </p>
                        {poLogs.map((log, lIdx) => (
                          <div key={lIdx} className="leading-tight animate-fade-in opacity-95">
                            {log}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 text-white italic pt-1 animate-pulse">
                          <span>■</span>
                          <span>Processing...</span>
                        </div>
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="py-12 select-none flex flex-col items-center justify-center gap-4 text-center pb-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400">
                      <Check className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 col-span-12">
                      <h4 className="font-black text-lg text-on-surface">Purchase Order Dispatched!</h4>
                      <p className="text-xs text-secondary max-w-md">
                        The purchase order was successfully compiled as a high-fidelity multipart document and transmitted via SMTP to <strong className="text-primary">{poRecipient}</strong>.
                      </p>
                    </div>
                    <div className="mt-4 w-full max-w-sm bg-surface-container rounded-xl p-3 border border-outline-variant flex items-center justify-between text-[10px] font-black uppercase text-secondary">
                      <span>Gateway ID:</span>
                      <span className="font-mono text-primary select-all">sg.841920-cert-rtx</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-surface-container border-t border-outline-variant shrink-0 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const phoneVal = (poOrder?.phone || '9342380981').replace(/[^0-9]/g, '');
                    const waDigits = phoneVal.length === 10 ? `91${phoneVal}` : phoneVal;
                    const totalVolume = subOrders.reduce((sum: number, s: any) => sum + (parseFloat(s.qty) || 0), 0);
                    const poWaText = encodeURIComponent(`Tejas Canvassing PO ${poOrder?.id}: Today's consolidated orders issued to ${supplierName}. Total Volume: ${totalVolume} QTLS.\nRecipient: ${poRecipient}`);
                    const poBodyText = encodeURIComponent(`DEAR ${supplierName.toUpperCase()},\n\nPlease find Purchase Order ${poOrder?.id} for ${totalVolume} QTLS compiled by Tejas Canvassing.\n\nItems:\n${subOrders.map((s: any) => `- ${s.buyer}: ${s.product || 'Rice'} (${s.qty} QTLS @ ₹${s.rate})`).join('\n')}\n\nTerms: Loading days: ${poOrder?.loadingDays || 5}`);
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(poRecipient)}&su=${encodeURIComponent(poSubject)}&body=${poBodyText}`;
                    const mailtoUrl = `mailto:${encodeURIComponent(poRecipient)}?subject=${encodeURIComponent(poSubject)}&body=${poBodyText}`;

                    return (
                      <>
                        <a
                          href={`https://api.whatsapp.com/send?phone=${waDigits}&text=${poWaText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-500/30 flex items-center gap-1.5 no-underline"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                          WhatsApp PO
                        </a>
                        <a
                          href={gmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-all border border-rose-500/30 flex items-center gap-1.5 no-underline"
                        >
                          <Mail className="w-4 h-4 text-rose-600" />
                          Open Gmail
                        </a>
                        <a
                          href={mailtoUrl}
                          className="px-3.5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-all border border-blue-500/30 flex items-center gap-1.5 no-underline"
                        >
                          <ExternalLink className="w-4 h-4 text-blue-600" />
                          Default Mail
                        </a>
                      </>
                    );
                  })()}
                </div>

                {!sendingSuccess ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrintPO}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer border border-slate-700"
                      title="Print A4 Purchase Order for filing"
                    >
                      <Printer className="w-4 h-4 text-white" />
                      Print A4 Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoOrder(null)}
                      className="px-4 py-2.5 bg-surface hover:bg-surface-container rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-outline-variant text-on-surface"
                      disabled={isSendingPO}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendPO}
                      className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-primary/15 flex items-center gap-2 cursor-pointer"
                      disabled={isSendingPO || !poRecipient}
                    >
                      {isSendingPO ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Dispatching (SMTP & Phone)...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Dispatch Official PO
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handlePrintPO}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer border border-slate-700"
                      title="Print A4 Purchase Order for filing"
                    >
                      <Printer className="w-4 h-4 text-white" />
                      Print A4 Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoOrder(null)}
                      className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Done & Close
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL 3: CONFIRM ARRIVED QUANTITY & RATE FOR EACH SUB-ORDER */}
      <AnimatePresence>
        {arrivalConfirmOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline-variant flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="font-black text-lg">Confirm Arrival Details</h3>
                </div>
                <button 
                  onClick={() => setArrivalConfirmOrder(null)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors text-secondary hover:text-on-surface"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    Verify actual arrival quantities and settlement rates.
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed font-medium">
                    If any buyer/supplier order has arrived with less quantity than originally placed, the ledger will automatically be updated to show the <strong>arrived portion</strong>, and a <strong>pending balance ledger entry</strong> will be kept of the remaining quantity of the buyer & supplier at the original rate to track balance pending to be loaded.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Target Dispatch Item / Batch</span>
                    <span className="text-xs font-mono font-bold text-primary">ID: {arrivalConfirmOrder.billNo || arrivalConfirmOrder.id}</span>
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-surface-container/60 rounded-xl border border-outline-variant/40">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary block">
                      Actual Supplier Bill No (Received in Billing)
                    </label>
                    <input 
                      type="text"
                      value={actualSupplierBillNo}
                      onChange={(e) => setActualSupplierBillNo(e.target.value)}
                      placeholder="e.g. BIL-9842 / INV-2026-001"
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                    />
                    <p className="text-[10px] text-secondary">
                      This supplier bill number will be saved to the order and recorded directly into the Arrival Entry registry.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {arrivalConfirmOrder.originalOrders && arrivalConfirmOrder.originalOrders.length > 0 ? (
                      arrivalConfirmOrder.originalOrders.map((sub: any, sIdx: number) => {
                        const subId = sub.id || `sub-${sIdx}`;
                        const origQty = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
                        const origRate = parseFloat(sub.rate) || 4200;
                        const subProduct = sub.product || "Premium Rice";
                        const currentQty = arrivalQuantities[subId] !== undefined ? arrivalQuantities[subId] : origQty;
                        const currentRate = arrivalRates[subId] !== undefined ? arrivalRates[subId] : origRate;

                        return (
                          <div key={subId} className="p-4 bg-surface-container/40 rounded-xl border border-outline-variant/30 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-on-surface uppercase">{sub.buyer}</h4>
                                <p className="text-[10px] text-secondary font-semibold">{subProduct} • {sub.supplier || "Supplier"}</p>
                              </div>
                              <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary border border-outline-variant/30">
                                Original: {origQty} QTLS @ ₹{origRate}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Arrived Qty (QTLS)</label>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={origQty}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setArrivalQuantities(prev => ({ ...prev, [subId]: isNaN(val) ? 0 : val }));
                                  }}
                                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                                />
                                {currentQty < origQty && (
                                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-wide">
                                    Balance Pending: {(origQty - currentQty).toFixed(2)} QTLS
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Settlement Rate (₹/QTL)</label>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={currentRate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setArrivalRates(prev => ({ ...prev, [subId]: isNaN(val) ? 0 : val }));
                                  }}
                                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Fallback for single order without sub-orders
                      (() => {
                        const origQty = parseFloat(arrivalConfirmOrder.items?.match(/\d+(\.\d+)?/)?.[0] || arrivalConfirmOrder.totalQty || "10");
                        const origRate = parseFloat(arrivalConfirmOrder.rate) || 4200;
                        const currentQty = arrivalQuantities[arrivalConfirmOrder.id] !== undefined ? arrivalQuantities[arrivalConfirmOrder.id] : origQty;
                        const currentRate = arrivalRates[arrivalConfirmOrder.id] !== undefined ? arrivalRates[arrivalConfirmOrder.id] : origRate;

                        return (
                          <div className="p-4 bg-surface-container/40 rounded-xl border border-outline-variant/30 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-on-surface uppercase">{arrivalConfirmOrder.buyer || "Standard Buyer"}</h4>
                                <p className="text-[10px] text-secondary font-semibold">{arrivalConfirmOrder.product || "Premium Grains"}</p>
                              </div>
                              <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary border border-outline-variant/30">
                                Original: {origQty} QTLS @ ₹{origRate}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Arrived Qty (QTLS)</label>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={origQty}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setArrivalQuantities(prev => ({ ...prev, [arrivalConfirmOrder.id]: isNaN(val) ? 0 : val }));
                                  }}
                                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                                />
                                {currentQty < origQty && (
                                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-wide">
                                    Balance Pending: {(origQty - currentQty).toFixed(2)} QTLS
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Settlement Rate (₹/QTL)</label>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={currentRate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setArrivalRates(prev => ({ ...prev, [arrivalConfirmOrder.id]: isNaN(val) ? 0 : val }));
                                  }}
                                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container border-t border-outline-variant shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setArrivalConfirmOrder(null)}
                  className="px-4 py-2.5 bg-surface hover:bg-surface-container rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-outline-variant text-on-surface text-center"
                >
                  Cancel
                </button>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      const orderId = arrivalConfirmOrder.id;
                      await handleMarkAsArrived(orderId, arrivalQuantities, arrivalRates, actualSupplierBillNo);
                      setArrivalConfirmOrder(null);
                    }}
                    className="px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-emerald-600/20"
                  >
                    <Check className="w-4 h-4" />
                    Confirm & Stay
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const orderId = arrivalConfirmOrder.id;
                      await handleMarkAsArrived(orderId, arrivalQuantities, arrivalRates, actualSupplierBillNo);
                      setArrivalConfirmOrder(null);
                      navigate('/arrival-entry');
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Proceed to Arrival Entry
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: LIFTING TO (REDIRECT VEHICLE TO NEW SHOP) */}
      <AnimatePresence>
        {liftingOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline-variant flex items-center justify-between shrink-0 bg-purple-500/5">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Truck className="w-5 h-5" />
                  <h3 className="font-black text-lg">Lifting / Redirect To New Shop</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setLiftingOrder(null)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors text-secondary hover:text-on-surface"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Customer Refusal / Vehicle Redirection Log
                  </p>
                  <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 leading-relaxed font-medium">
                    If the original customer (<strong>{liftingOrder.buyer || liftingOrder.partyName || 'Customer'}</strong>) denies taking delivery upon vehicle arrival, enter the replacement shop details below to lift and redirect the vehicle load.
                  </p>
                </div>

                <div className="space-y-4">
                  {liftingOrder.originalOrders && liftingOrder.originalOrders.length > 0 && (
                    <div className="space-y-2 p-3.5 bg-surface-container/60 rounded-xl border border-outline-variant">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                        Lifting Scope / Order Selection
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLiftingScope('whole');
                            const allSubIds = liftingOrder.originalOrders.map((sub: any, idx: number) => sub.id || `sub-${idx}`);
                            setSelectedSubOrderIds(allSubIds);
                            const totalSubQty = liftingOrder.originalOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0), 0);
                            setLiftingQtls(String(totalSubQty));
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer",
                            liftingScope === 'whole'
                              ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                              : "bg-surface border-outline-variant text-secondary hover:text-on-surface"
                          )}
                        >
                          Whole Order ({liftingOrder.originalOrders.length} Suborders)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiftingScope('suborders')}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer",
                            liftingScope === 'suborders'
                              ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                              : "bg-surface border-outline-variant text-secondary hover:text-on-surface"
                          )}
                        >
                          Select Specific Sub-Orders
                        </button>
                      </div>

                      {liftingScope === 'suborders' && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-outline-variant/60">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-secondary uppercase tracking-wider">
                              Select Sub-Orders to Lift ({selectedSubOrderIds.length} / {liftingOrder.originalOrders.length} selected)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const allIds = liftingOrder.originalOrders.map((s: any, idx: number) => s.id || `sub-${idx}`);
                                  setSelectedSubOrderIds(allIds);
                                  const sumQty = liftingOrder.originalOrders.reduce((sum: number, sub: any) => sum + (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0), 0);
                                  setLiftingQtls(String(sumQty));
                                }}
                                className="text-purple-600 dark:text-purple-400 hover:underline text-[10px] font-black uppercase"
                              >
                                Select All
                              </button>
                              <span className="text-outline-variant">•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubOrderIds([]);
                                  setLiftingQtls("0");
                                }}
                                className="text-rose-500 hover:underline text-[10px] font-black uppercase"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {liftingOrder.originalOrders.map((sub: any, sIdx: number) => {
                              const subId = sub.id || `sub-${sIdx}`;
                              const isSelected = selectedSubOrderIds.includes(subId);
                              const qtyVal = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
                              const rateVal = parseFloat(sub.rate) || 4200;

                              return (
                                <div
                                  key={subId}
                                  onClick={() => handleToggleSubOrderForLifting(subId)}
                                  className={cn(
                                    "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs",
                                    isSelected
                                      ? "bg-purple-500/10 border-purple-500/40 text-purple-900 dark:text-purple-200"
                                      : "bg-surface border-outline-variant/40 text-secondary hover:border-outline-variant"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input 
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}} // handled by parent div
                                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500/20 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold truncate text-on-surface">
                                        {sub.buyer || `Suborder #${sIdx + 1}`}
                                      </p>
                                      <p className="text-[10px] text-secondary font-mono">
                                        {sub.product || 'Rice Product'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <p className="font-black text-purple-700 dark:text-purple-300">
                                      {qtyVal} QTLS
                                    </p>
                                    <p className="text-[10px] text-secondary">
                                      @ ₹{rateVal}/QTL
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                      Shop Name (New Destination) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text"
                      value={liftingShopName}
                      onChange={(e) => setLiftingShopName(e.target.value)}
                      placeholder="e.g. M/S SRI LAKSHMI TRADERS & CO"
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-on-surface"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                        New Bill No <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text"
                        value={liftingBillNo}
                        onChange={(e) => setLiftingBillNo(e.target.value)}
                        placeholder="e.g. LFT-98102"
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-mono font-bold outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-on-surface"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                        Lifted Volume (QTLS) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="number"
                        step="any"
                        min="0"
                        value={liftingQtls}
                        onChange={(e) => setLiftingQtls(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-mono font-bold outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-on-surface"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                      New Agreed Rate (₹/QTL) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      value={liftingRate}
                      onChange={(e) => setLiftingRate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-mono font-bold outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-on-surface"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                      Notes / Redirection Reason
                    </label>
                    <textarea 
                      value={liftingNotes}
                      onChange={(e) => setLiftingNotes(e.target.value)}
                      rows={2}
                      placeholder="Reason for vehicle lifting/redirection..."
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-medium outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-on-surface resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container border-t border-outline-variant shrink-0 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setLiftingOrder(null)}
                  className="px-4 py-2.5 bg-surface hover:bg-surface-container rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-outline-variant text-on-surface text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!liftingShopName.trim() || isSavingLifting}
                  onClick={handleSaveLifting}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-purple-600/15 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingLifting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm Lifting & Redirect
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: A4 PURCHASE ORDER PRINT & FILING STUDIO */}
      <AnimatePresence>
        {a4PreviewOrder && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-[#1e293b] border border-slate-700 w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] print:max-h-none print:border-none print:shadow-none print:w-full print:bg-white print:rounded-none"
            >
              {/* Modal Top Control Bar (Hidden on Print) */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-600/30">
                    TC
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
                      Purchase Order A4 Document
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {a4PreviewOrder.id || 'PO-BATCH'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Official trade ledger copy • Formatted for standard 210mm &times; 297mm A4 Paper &amp; PDF Filing
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectPrintA4(a4PreviewOrder, a4PreviewSubOrders)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
                    title="Print directly to physical printer or Save as PDF (Ctrl+P)"
                  >
                    <Printer className="w-4 h-4" />
                    Print A4 (Ctrl+P)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPoPdf(a4PreviewOrder, a4PreviewSubOrders)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
                    title="Generate and download high-resolution A4 PDF document"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenStandaloneA4(a4PreviewOrder, a4PreviewSubOrders)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    title="Open document in a dedicated standalone browser window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    New Tab
                  </button>

                  <button
                    type="button"
                    onClick={() => setA4PreviewOrder(null)}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable A4 Document View Canvas */}
              <div className="p-4 sm:p-8 bg-slate-800/80 overflow-y-auto flex-1 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible">
                {/* Physical A4 Sheet Container */}
                <div 
                  id="a4-printable-po-document"
                  className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-[14mm] rounded-lg shadow-2xl border border-slate-200 flex flex-col justify-between font-sans print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:max-w-full"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-900">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-[#0084ff] text-white font-black text-2xl flex items-center justify-center rounded-lg shadow-sm">
                          TC
                        </div>
                        <div>
                          <h1 className="text-xl font-black text-slate-950 tracking-tight leading-tight">
                            Tejas Canvassing
                          </h1>
                          <p className="text-[11px] text-slate-600 font-semibold leading-tight">
                            Bangalore Grain Brokerage &amp; Supply Chain Logistics &bull; APMC Yard, Yeshwanthpur, Bangalore - 560022
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black uppercase text-slate-950 tracking-wider">
                          PURCHASE ORDER
                        </div>
                        <div className="text-[11px] font-mono font-bold text-blue-700">
                          Ref: {a4PreviewOrder.id || 'PO-BATCH'}
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold">
                          Date: {formatPoDate(a4PreviewOrder.date)}
                        </div>
                      </div>
                    </div>

                    {/* Salutation */}
                    <div className="mb-4">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-950">
                        DEAR {(a4PreviewOrder.supplier || a4PreviewOrder.origin || 'ANNAPURNA RICE & AGRO INDUSTRIES').toUpperCase()},
                      </div>
                      <div className="text-[11px] text-slate-600 font-bold mt-0.5">
                        Today's consolidated orders issued under trade authorization:
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border-collapse border border-slate-800 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 border-b border-slate-800">
                            <th className="p-2.5 border border-slate-800 text-left font-black uppercase w-[14%]">DATE</th>
                            <th className="p-2.5 border border-slate-800 text-left font-black uppercase w-[38%]">BUYER &amp; CONSIGNEE</th>
                            <th className="p-2.5 border border-slate-800 text-left font-black uppercase w-[16%]">PRODUCT</th>
                            <th className="p-2.5 border border-slate-800 text-right font-black uppercase w-[11%]">QTY (QTL)</th>
                            <th className="p-2.5 border border-slate-800 text-right font-black uppercase w-[11%]">RATE (₹)</th>
                            <th className="p-2.5 border border-slate-800 text-left font-black uppercase w-[10%]">LOGISTICS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a4PreviewSubOrders.map((sub: any, sIdx: number) => {
                            const buyerName = sub.buyer || a4PreviewOrder.buyer || 'V.K FOODS';
                            const profile = resolveBuyerProfile(buyerName);
                            const subDate = formatPoDate(sub.date || a4PreviewOrder.date);
                            const product = (sub.product || a4PreviewOrder.product || 'KESHAR KALI').toUpperCase();
                            const qty = sub.qty !== undefined ? sub.qty : 80;
                            const rate = sub.rate !== undefined ? sub.rate : 8400;
                            const loadingDays = sub.loadingDays !== undefined ? sub.loadingDays : 0;
                            const unloadingPoint = sub.unloadingPoint || 'shop';

                            return (
                              <tr key={sIdx} className="border-b border-slate-800">
                                <td className="p-2.5 border border-slate-800 font-semibold align-top whitespace-nowrap">
                                  {subDate}
                                </td>
                                <td className="p-2.5 border border-slate-800 align-top">
                                  <div className="font-black text-slate-950 uppercase text-xs">
                                    {buyerName}
                                  </div>
                                  <div className="text-[10px] text-slate-600 leading-tight mt-0.5">
                                    {profile.address}
                                  </div>
                                  <div className="mt-1.5 pt-1 border-t border-dashed border-slate-300 text-[9.5px] text-slate-700 leading-tight">
                                    <span><strong>GSTIN:</strong> {profile.gstin}</span>
                                    <span className="mx-1">&bull;</span>
                                    <span><strong>Phone:</strong> {profile.phone}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 border border-slate-800 font-black text-slate-950 uppercase align-top">
                                  {product}
                                </td>
                                <td className="p-2.5 border border-slate-800 text-right font-black font-mono text-slate-950 align-top text-xs">
                                  {qty}
                                </td>
                                <td className="p-2.5 border border-slate-800 text-right font-black font-mono text-slate-950 align-top text-xs">
                                  {rate}
                                </td>
                                <td className="p-2.5 border border-slate-800 text-left text-[10px] align-top">
                                  <div>Loading: <strong>{loadingDays}d</strong></div>
                                  <div className="text-[9.5px] text-slate-600 mt-0.5">Unload: <strong>{unloadingPoint}</strong></div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-black border-t-2 border-slate-800">
                            <td colSpan={3} className="p-2.5 border border-slate-800 text-right uppercase">
                              Total Volume (Quintals):
                            </td>
                            <td className="p-2.5 border border-slate-800 text-right font-mono text-xs text-blue-700">
                              {a4PreviewSubOrders.reduce((sum: number, s: any) => sum + (parseFloat(s.qty) || 0), 0)}
                            </td>
                            <td colSpan={2} className="p-2.5 border border-slate-800 text-left text-[10px] text-slate-500 font-normal italic">
                              Official consolidated procurement
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Protocol and Terms */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-700 leading-relaxed space-y-1">
                      <p className="font-bold text-slate-900 uppercase tracking-wide">
                        Terms &amp; Operational Instructions:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                        <li>Lorry loading must be completed within stipulated loading days.</li>
                        <li>Grain quality must strictly comply with agreed moisture and specification certificates.</li>
                        <li>Delivery challans and e-Way bills must explicitly mention buyer GSTIN credentials.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Signatures & Filing */}
                  <div className="mt-8 pt-4 border-t border-slate-300">
                    <div className="grid grid-cols-2 gap-8 text-[10px]">
                      <div>
                        <div className="h-12 flex items-end">
                          <span className="font-mono text-[9px] text-slate-400">[DIGITALLY STAMPED &amp; VERIFIED]</span>
                        </div>
                        <div className="border-t border-slate-800 pt-1 font-black uppercase text-slate-900">
                          Authorized Signatory (Tejas Canvassing)
                        </div>
                        <div className="text-[9px] text-slate-500">APMC Yard, Yeshwanthpur</div>
                      </div>
                      <div>
                        <div className="h-12 flex items-end">
                          <span className="text-[9.5px] text-slate-500">File Ref: TC-PO-{a4PreviewOrder.id?.slice(-4) || '102'} / Date: {formatPoDate(new Date())}</span>
                        </div>
                        <div className="border-t border-slate-800 pt-1 font-black uppercase text-slate-900">
                          Physical Ledger Filing &amp; Audit
                        </div>
                        <div className="text-[9px] text-slate-500">Grain Brokerage Central Archives</div>
                      </div>
                    </div>

                    <div className="mt-6 text-center text-[9px] text-slate-400 italic">
                      This official purchase order document serves as an authentic trade ledger copy generated by Tejas Canvassing.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderDeleteAllModal()}
      {renderToast()}
    </div>
  );
}
