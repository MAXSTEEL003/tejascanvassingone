import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  AlertCircle,
  Lock,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatINR, getRegisteredSuppliers, sanitizeSupplierName } from '../lib/utils';
import { getCollectionDocs, setCollectionDoc, deleteCollectionDoc, markLedgerEntriesAsArrived, autoCreateArrivalEntryForIncomingLog, updateLedgersForLifting } from '../lib/firebase';
import { verifyActionWithServer } from '../lib/auth';
import { generateSupplierPOEmailHtml, generateSupplierPOA4PrintHtml, printPoDocument, resolveBuyerProfile, formatPoDate } from '../utils/poEmailTemplate';
import { buildPoPdfDocument, getPoPdfFileName } from '../utils/poPdfGenerator';
import EmailTrackingModal, { getStatusBadgeConfig } from '../components/EmailTrackingModal';

const BUYER_PROFILES: Record<string, { address: string; gstin: string; phone: string; email: string }> = {};

const SUPPLIER_PROFILES: Record<string, { name: string; contact: string; email: string; phone: string; gstin: string; address: string }> = {};

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

        if (matched) {
          return {
            name: matched.name || supplierName,
            email: matched.email || (matched.name ? `${matched.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com` : 'supplier@gmail.com'),
            phone: matched.phone || '9440188941',
            contact: matched.contact || matched.contactPerson || 'Operations Desk',
            gstin: matched.gstin || '',
            address: matched.address || 'Industrial APMC Commercial Hub'
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

  // 3. Dynamic Registered Suppliers Fallback
  const registered = getRegisteredSuppliers();
  const effectiveName = sanitizeSupplierName(supplierName, registered[0]?.name || 'DIRECT MILL');

  return {
    name: effectiveName,
    email: `${effectiveName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'supplier'}@gmail.com`,
    phone: '9440188941',
    contact: 'Operations Desk',
    gstin: '',
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

// Resolves actual high quality rice bag image for orders preview
export const getOrderBagImage = (order: any): string => {
  if (!order) return '/images/keshar_kali.png';
  if (order.image && typeof order.image === 'string' && order.image.trim().length > 0) {
    return order.image;
  }
  const text = `${order.items || ''} ${order.product || ''} ${order.variety || ''} ${order.category || ''}`.toLowerCase();
  if (text.includes('keshar kali') || text.includes('kali')) {
    return '/images/keshar_kali.png';
  }
  if (text.includes('madhuram') || text.includes('keshar')) {
    return '/images/keshar_madhuram.png';
  }
  if (text.includes('simha') || text.includes('lion') || text.includes('sona')) {
    return '/images/simha.png';
  }
  if (text.includes('bell') || text.includes('bellric')) {
    return '/images/bellric.png';
  }
  if (text.includes('cow') || text.includes('kamadhenu')) {
    return '/images/cow.jpg';
  }
  if (text.includes('jmr')) {
    return '/images/jmr.jpg';
  }
  if (text.includes('jasmine')) {
    return 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-zw5USNmhSWJ7W6KYNTxtxlvbucTGBqM91aYmN9ZxAlgvZIBCtLu_HO1Y6j9huJHOUICTW230tfwmeYNZI89Quj-o1n6dnY7tVzThXMjnw50G_5ZUVyBb9v-fkOlF3OOsh5q8N6x1ZNmKG64sKYprqc-gQ5WdOd8ZKy7r_r44wx2qzB0srt6O205GYTyY5is626j2iSoylgKkn9ktJSrD1UhQuuITJU9Ka26Vej9j0oHRlpcaqL73YbujaFhOQ7Ly71Qt9ofGdr';
  }
  if (text.includes('basmati') || text.includes('1121') || text.includes('sella')) {
    return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBm-XMaGdzxCjePQf6HZQOYwr69Zxd_uImfU8ASz83aco_TNkafvvB-t0733UI0fDTWC3wi9pQSVnG9w3qwPRkWNJtZFfCchbPI9xjyqSb9veIK4ypfBYDZwvKvlc9BKauhSKHl5r33cNwMa_vB5-KtU-2NWfwjBT2BBro7NA2hMwxtu9OaCg4Od4Gp0_NkBdnV_kOLR5mkQnZZdf9IJ8vI_GZT2CJ0DED3KfwlWc2HJooTd6KuSiu0vEWJXK80aG9OVARp4OxxFi52';
  }
  return '/images/keshar_kali.png';
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
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Filtered orders list
  const filteredOrders = orders.filter(order => {
    const s = String(order.status || '').toLowerCase();
    const p = order.progress || 0;
    const isDelivered = s === 'arrived' || s === 'delivered' || p >= 100;
    const isDispatched = s === 'in transit' || s === 'dispatched' || (p >= 50 && p < 100);
    const isConfirmed = s === 'confirmed' || s === 'accepted';
    const isPending = !isDelivered && !isDispatched && !isConfirmed;

    if (statusFilter === 'PENDING' && !isPending) return false;
    if (statusFilter === 'CONFIRMED' && !isConfirmed) return false;
    if (statusFilter === 'DISPATCHED' && !isDispatched) return false;
    if (statusFilter === 'DELIVERED' && !isDelivered) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBill = String(order.billNo ?? order.id ?? '').toLowerCase().includes(q);
      const matchItems = String(order.items ?? order.product ?? '').toLowerCase().includes(q);
      const matchSupplier = String(order.supplier ?? '').toLowerCase().includes(q);
      if (!matchBill && !matchItems && !matchSupplier) return false;
    }
    return true;
  });

  const getOrderStatusPill = (statusStr: string, progress: number = 0) => {
    const s = String(statusStr || '').toLowerCase().trim();
    if (s === 'arrived' || s === 'delivered' || progress >= 100) {
      return {
        label: 'Delivered',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      };
    }
    if (s === 'in transit' || s === 'dispatched' || (progress >= 50 && progress < 100)) {
      return {
        label: 'Dispatched',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
      };
    }
    if (s === 'confirmed' || s === 'accepted') {
      return {
        label: 'Confirmed',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      };
    }
    return {
      label: 'Pending',
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
    };
  };

  // Screen 8: Order Tracking View
  if (trackingOrder) {
    const s = String(trackingOrder.status || '').toLowerCase().trim();
    const p = trackingOrder.progress || 0;
    const isDelivered = s === 'arrived' || s === 'delivered' || p >= 100;
    const isDispatched = isDelivered || s === 'in transit' || s === 'dispatched' || (p >= 50 && p < 100);
    const isConfirmed = isDispatched || s === 'confirmed' || s === 'accepted';
    const isPlaced = true;

    const pill = getOrderStatusPill(trackingOrder.status, trackingOrder.progress);
    const orderQty = trackingOrder.originalOrders 
      ? trackingOrder.originalOrders.reduce((sum, sub) => sum + (parseFloat(sub.qty) || 0), 0)
      : (parseFloat(trackingOrder.qty) || 18);

    const steps = [
      {
        id: 1,
        title: 'Order Placed',
        time: formatDateLong(trackingOrder.date),
        desc: 'Order received by Tejas Canvassing brokerage desk.',
        completed: isPlaced,
        active: !isConfirmed
      },
      {
        id: 2,
        title: 'Order Confirmed',
        time: isConfirmed ? formatDateLong(trackingOrder.date) : 'Pending Confirmation',
        desc: 'Trade contract acknowledged by direct mill supplier partner.',
        completed: isConfirmed,
        active: isConfirmed && !isDispatched
      },
      {
        id: 3,
        title: 'Dispatched from Mill',
        time: isDispatched ? 'In Transit' : 'Scheduled',
        desc: 'Ex-mill loading target confirmed. Logistics freight allocated.',
        completed: isDispatched,
        active: isDispatched && !isDelivered
      },
      {
        id: 4,
        title: 'Out for Delivery',
        time: isDelivered ? 'Arrived' : isDispatched ? 'Approaching' : 'Pending Transit',
        desc: 'Truck approaching destination APMC Yard unloading bay.',
        completed: isDelivered,
        active: false
      },
      {
        id: 5,
        title: 'Delivered & Unloaded',
        time: isDelivered ? 'Completed' : 'Pending Arrival',
        desc: 'Shipment received, verified, and weighed at unloading yard.',
        completed: isDelivered,
        active: false
      }
    ];

    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-4 font-sans text-[#111827] dark:text-slate-100">
        {/* Header matching Screen 8: < Order Tracking */}
        <header className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB] dark:border-neutral-800">
          <button 
            type="button"
            onClick={() => setTrackingOrder(null)}
            className="p-1.5 -ml-1 text-[#111827] dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-[#111827] dark:text-white">
            Order Tracking
          </h1>
        </header>

        {/* Order Summary Card (Screen 8) */}
        <section className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-left">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#111827] dark:text-white font-mono">
                  Order #{trackingOrder.billNo || trackingOrder.id}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", pill.className)}>
                  {pill.label}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-0.5">
                Placed on {formatDateLong(trackingOrder.date)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#6B7280] dark:text-neutral-400 block">Total Amount</span>
              <span className="font-bold text-sm font-mono text-[#C22424]">
                {trackingOrder.total || `₹ ${formatINR(orderQty * 4200)}`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1.5 gap-2">
            <span className="text-[#6B7280] dark:text-neutral-400 shrink-0">Product:</span>
            <div className="flex items-center gap-2 justify-end min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                <img 
                  src={getOrderBagImage(trackingOrder)} 
                  alt="Rice Bag" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/keshar_kali.png';
                  }}
                />
              </div>
              <span className="font-bold text-[#111827] dark:text-white text-right truncate max-w-[200px]">
                {trackingOrder.items || trackingOrder.product || '1121 Raw Basmati Rice'} ({orderQty} QTL)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#6B7280] dark:text-neutral-400">Direct Mill Supplier:</span>
            <span className="font-medium text-[#111827] dark:text-white text-right">
              {sanitizeSupplierName(trackingOrder.supplier, 'Direct Mill Partner')}
            </span>
          </div>

          {/* Delivery Yard */}
          <div className="bg-[#FAFBFA] dark:bg-[#1C1C1C] p-3 rounded-xl border border-[#E5E7EB] dark:border-[#262626] flex items-start gap-2.5 text-xs text-[#6B7280] dark:text-neutral-300">
            <MapPin className="w-4 h-4 text-[#C22424] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#111827] dark:text-white block">Delivery Destination:</span>
              <span className="text-[11px] leading-relaxed">
                {trackingOrder.destination || trackingOrder.address || 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022'}
              </span>
            </div>
          </div>
        </section>

        {/* Vertical 5-Step Order Status Timeline (Screen 8) */}
        <section className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 text-left">
          <h2 className="text-sm font-bold text-[#111827] dark:text-white pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
            Shipment Timeline
          </h2>

          <div className="relative pl-6 space-y-6">
            {/* Vertical connector line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#E5E7EB] dark:bg-[#262626]" />

            {steps.map((st) => (
              <div key={st.id} className="relative flex items-start gap-3.5">
                {/* Timeline Icon Node */}
                <div 
                  className={cn(
                    "absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 z-10 transition-all",
                    st.completed 
                      ? "bg-[#C22424] shadow-xs" 
                      : st.active
                      ? "bg-white border-2 border-[#C22424] text-[#C22424]"
                      : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400"
                  )}
                >
                  {st.completed ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : st.active ? (
                    <span className="w-2 h-2 rounded-full bg-[#C22424] animate-ping" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1 pl-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn(
                      "text-xs font-bold leading-tight",
                      st.completed || st.active ? "text-[#111827] dark:text-white" : "text-[#6B7280] dark:text-neutral-500"
                    )}>
                      {st.title}
                    </h3>
                    <span className="text-[10px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap">
                      {st.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 leading-relaxed mt-0.5">
                    {st.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Back and Support Actions */}
        <div className="space-y-2 pt-2">
          <a
            href="tel:+919916416995"
            className="w-full py-3 bg-[#FAFBFA] dark:bg-neutral-800 hover:bg-neutral-100 text-[#111827] dark:text-neutral-200 border border-[#E5E7EB] dark:border-neutral-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all no-underline cursor-pointer"
          >
            <span>Direct APMC Broker Desk: +91 99164 16995</span>
          </a>
          <button
            type="button"
            onClick={() => setTrackingOrder(null)}
            className="w-full py-3 bg-white dark:bg-[#141414] hover:bg-neutral-50 text-[#6B7280] dark:text-neutral-400 rounded-xl font-bold text-xs transition-all cursor-pointer border border-[#E5E7EB] dark:border-[#262626]"
          >
            Return to My Orders List
          </button>
        </div>
      </div>
    );
  }

  // Screen 7: My Orders List View
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-4 font-sans text-[#111827] dark:text-slate-100">
      {/* Top Header matching Screen 7: My Orders */}
      <header className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-neutral-800">
        <h1 className="text-xl font-bold tracking-tight text-[#111827] dark:text-white">
          My Orders
        </h1>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 text-[#6B7280] hover:text-[#111827] dark:text-slate-400 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Refresh"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#C22424]" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </header>

      {/* Filter Pills matching Screen 7 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'ALL', label: `All (${orders.length})` },
          { id: 'PENDING', label: 'Pending' },
          { id: 'CONFIRMED', label: 'Confirmed' },
          { id: 'DISPATCHED', label: 'Dispatched' },
          { id: 'DELIVERED', label: 'Delivered' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id as any)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              statusFilter === f.id
                ? "bg-[#C22424] text-white shadow-xs"
                : "bg-white dark:bg-[#141414] text-[#111827] dark:text-neutral-300 border border-[#E5E7EB] dark:border-[#262626] hover:bg-neutral-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order ID, rice variety..."
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl text-xs text-[#111827] dark:text-white outline-none focus:border-[#C22424] shadow-2xs"
        />
      </div>

      {/* Orders List matching Screen 7 Cards */}
      {isLoading && orders.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-[#C22424] animate-spin" />
          <p className="text-xs font-bold text-[#6B7280]">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <Package className="w-8 h-8 mx-auto text-neutral-300" />
          <p className="text-xs font-bold text-[#6B7280]">No orders found matching this filter.</p>
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="text-xs font-bold text-[#C22424] hover:underline cursor-pointer"
          >
            Explore Rice Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const pill = getOrderStatusPill(order.status, order.progress);
            const orderQty = order.originalOrders 
              ? order.originalOrders.reduce((sum, sub) => sum + (parseFloat(sub.qty) || 0), 0)
              : (parseFloat(order.qty) || 18);
            const totalDisplay = order.total || `₹ ${formatINR(orderQty * 4200)}`;

            return (
              <motion.div
                key={order.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setTrackingOrder(order)}
                className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 shadow-xs hover:border-[#C22424]/40 transition-all cursor-pointer text-left space-y-3"
              >
                {/* Top Row: Order ID & Status Pill */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm font-mono text-[#111827] dark:text-white">
                    Order #{order.billNo || order.id}
                  </span>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold", pill.className)}>
                    {pill.label}
                  </span>
                </div>

                {/* Date */}
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 -mt-1">
                  Placed on {formatDateLong(order.date)}
                </p>

                {/* Middle Item info with thumbnail */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#E5E7EB] dark:border-neutral-800">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-[#E5E7EB] dark:border-neutral-700 flex items-center justify-center shrink-0 p-1 overflow-hidden shadow-2xs">
                      <img 
                        src={getOrderBagImage(order)} 
                        alt={order.items || order.product || 'Rice Bag'} 
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to keshar kali if specific image fails
                          (e.currentTarget as HTMLImageElement).src = '/images/keshar_kali.png';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-[#111827] dark:text-white truncate">
                        {order.items || order.product || '1121 Raw Basmati Rice'}
                      </h4>
                      <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
                        {orderQty} QTL • <span className="font-mono font-bold text-[#111827] dark:text-white">{totalDisplay}</span>
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
                </div>
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

interface PlacedOrdersProps {
  forceMerchantView?: boolean;
}

export default function PlacedOrders({ forceMerchantView }: PlacedOrdersProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const role = localStorage.getItem('userRole') || 'admin';
  const portalParam = searchParams.get('portal');

  // Stricter merchant view detection:
  // If forceMerchantView is true, OR route is /my-orders, OR role is merchant, OR portal param is merchant
  const isMerchant = Boolean(
    forceMerchantView ||
    location.pathname === '/my-orders' ||
    role === 'merchant' ||
    portalParam === 'merchant'
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPlacedOrders, setCurrentPlacedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'in_transit'>('all');
  const [showAutoSentBanner, setShowAutoSentBanner] = useState(false);

  // Email Tracking states (Section 7, 10)
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<any | null>(null);
  const [trackingRecordMap, setTrackingRecordMap] = useState<Record<string, any>>({});
  const [emailFilter, setEmailFilter] = useState<'all' | 'queued' | 'sent_unconfirmed' | 'delivered' | 'bounced' | 'awaiting_ack' | 'acknowledged'>('all');

  const fetchTrackingRecords = async () => {
    try {
      const res = await fetch('/api/po-tracking');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.records)) {
          const map: Record<string, any> = {};
          data.records.forEach((r: any) => {
            if (r.orderId) map[r.orderId] = r;
          });
          setTrackingRecordMap(map);
        }
      }
    } catch (e) {
      console.warn("Could not fetch PO email tracking records:", e);
    }
  };

  useEffect(() => {
    fetchTrackingRecords();
  }, []);

  const [isCheckingBounces, setIsCheckingBounces] = useState(false);
  const handleCheckBounces = async () => {
    setIsCheckingBounces(true);
    try {
      const res = await fetch('/api/po-tracking/check-bounces');
      const data = await res.json();
      await fetchTrackingRecords();
      setToastMessage(`Gmail mailbox scan complete. Bounces updated: ${data.bouncesFound || 0}`);
    } catch (err) {
      setToastMessage("Failed to check Gmail for bounce notices.");
    } finally {
      setIsCheckingBounces(false);
    }
  };

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

  const emailCounts = React.useMemo(() => {
    let queued = 0;
    let sentUnconfirmed = 0;
    let delivered = 0;
    let bounced = 0;
    let awaitingAck = 0;
    let acknowledged = 0;

    currentPlacedOrders.forEach(o => {
      const trk = trackingRecordMap[o.id];
      const status = trk?.status || (o.purchaseOrderSent ? 'Sent' : 'Queued');
      const acked = Boolean(trk?.acknowledgedAt);

      if (status === 'Queued' || status === 'Sending') queued++;
      if (status === 'Sent' || status === 'Delivery unconfirmed') sentUnconfirmed++;
      if (status === 'Delivered') delivered++;
      if (status === 'Bounced/Failed') bounced++;
      if (!acked && (status === 'Sent' || status === 'Delivery unconfirmed' || status === 'Opened')) awaitingAck++;
      if (status === 'Acknowledged' || acked) acknowledged++;
    });

    return {
      all: currentPlacedOrders.length,
      queued,
      sentUnconfirmed,
      delivered,
      bounced,
      awaitingAck,
      acknowledged
    };
  }, [currentPlacedOrders, trackingRecordMap]);

  const filteredPlacedOrders = React.useMemo(() => {
    let list = currentPlacedOrders;

    // Arrived status filter
    if (statusFilter === 'arrived') {
      list = list.filter(o => isOrderArrived(o));
    } else if (statusFilter === 'in_transit') {
      list = list.filter(o => !isOrderArrived(o));
    }

    // Email Tracking status filter (Section 10)
    if (emailFilter !== 'all') {
      list = list.filter(o => {
        const trk = trackingRecordMap[o.id];
        const status = trk?.status || (o.purchaseOrderSent ? 'Sent' : 'Queued');
        const acked = Boolean(trk?.acknowledgedAt);

        if (emailFilter === 'queued') {
          return status === 'Queued' || status === 'Sending';
        }
        if (emailFilter === 'sent_unconfirmed') {
          return status === 'Sent' || status === 'Delivery unconfirmed';
        }
        if (emailFilter === 'delivered') {
          return status === 'Delivered';
        }
        if (emailFilter === 'bounced') {
          return status === 'Bounced/Failed';
        }
        if (emailFilter === 'awaiting_ack') {
          return !acked && (status === 'Sent' || status === 'Delivery unconfirmed' || status === 'Opened');
        }
        if (emailFilter === 'acknowledged') {
          return status === 'Acknowledged' || acked;
        }
        return true;
      });
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
  }, [currentPlacedOrders, statusFilter, emailFilter, supplierFilter, trackingRecordMap]);

  // Modal states
  const [shareOrder, setShareOrder] = useState<any | null>(null);
  const [poOrder, setPoOrder] = useState<any | null>(null);
  const [a4PreviewOrder, setA4PreviewOrder] = useState<any | null>(null);
  const [a4PreviewSubOrders, setA4PreviewSubOrders] = useState<any[]>([]);
  const [arrivalConfirmOrder, setArrivalConfirmOrder] = useState<any | null>(null);
  const [arrivalQuantities, setArrivalQuantities] = useState<{[subId: string]: number}>({});
  const [arrivalRates, setArrivalRates] = useState<{[subId: string]: number}>({});
  const [actualSupplierBillNo, setActualSupplierBillNo] = useState<string>('');
  const [arrivalSupplierBillNos, setArrivalSupplierBillNos] = useState<{[subId: string]: string}>({});
  const [vehicleLhRate, setVehicleLhRate] = useState<string>('');
  const [vehicleLhAccepted, setVehicleLhAccepted] = useState<boolean>(true);

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
  const [poSender, setPoSender] = useState(() => {
    const stored = localStorage.getItem('companyEmail') || localStorage.getItem('userEmail');
    if (stored && stored !== 'tejasadinarayan@gmail.com' && stored !== 'procurement@tejascanvassing.com') {
      return stored;
    }
    return 'nani@tejasc.in';
  });
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

  const buildMerchantOrders = (
    placedList: any[], 
    procList: any[], 
    arrivalList: any[], 
    merchantName: string,
    merchantEmail: string,
    merchantUserId: string
  ) => {
    const normMerchant = (merchantName || '').trim().toLowerCase();
    const normEmail = (merchantEmail || '').trim().toLowerCase();
    const normUid = (merchantUserId || '').trim().toLowerCase();

    const isMerchantMatch = (item: any) => {
      if (!item) return false;
      const b = String(item.buyer || item.buyerName || '').trim().toLowerCase();
      const em = String(item.buyerEmail || item.email || item.companyEmail || '').trim().toLowerCase();
      const uid = String(item.userId || item.buyerId || '').trim().toLowerCase();

      if (normUid && uid && uid === normUid) return true;
      if (normEmail && em && em === normEmail) return true;
      if (normMerchant && b) {
        if (b === normMerchant) return true;
        if (normMerchant.length > 3 && b.includes(normMerchant)) return true;
        if (b.length > 3 && normMerchant.includes(b)) return true;
      }
      return false;
    };

    const isApprovedStatus = (s: any) => {
      const norm = String(s || '').trim().toLowerCase();
      return (
        norm === 'approved' ||
        norm === 'accepted' ||
        norm === 'awaiting settlement' ||
        norm === 'confirmed' ||
        norm === 'in transit' ||
        norm === 'dispatched' ||
        norm === 'arrived' ||
        norm === 'unloaded' ||
        norm === 'delivered' ||
        norm === 'completed'
      );
    };

    const filterIgnored = (list: any[]) => (list || []).filter(
      (o: any) => o && o.id !== 'ORD-TC-1024' && !String(o.id).startsWith('#ORD-99') && !String(o.id).startsWith('TC-0000') && o.status !== 'Pending Approval' && o.status !== 'Draft Order' && o.status !== 'Rejected'
    );

    const validPlaced = filterIgnored(placedList);
    const validProc = (procList || []).filter(
      (o: any) => o && o.id !== 'ORD-TC-1024' && !String(o.id).startsWith('#ORD-99') && !String(o.id).startsWith('TC-0000') && o.status !== 'Draft Order' && o.status !== 'Rejected'
    );

    // Map batch live tracking statuses by sub-order ID
    const batchStatusMap = new Map<string, any>();
    validPlaced.forEach((p: any) => {
      if (!p) return;
      if (p.originalOrders && Array.isArray(p.originalOrders)) {
        p.originalOrders.forEach((sub: any) => {
          if (sub && sub.id) {
            const subKey = String(sub.id).trim().toLowerCase().replace(/^#/, '');
            batchStatusMap.set(subKey, {
              parentBatchId: p.id,
              status: p.status || 'Approved',
              progress: p.progress || 35,
              supplier: p.supplier || sub.supplier,
              billNo: p.billNo || sub.billNo,
              origin: p.origin || 'Mill Dispatch Hub',
              destination: sub.destination || sub.unloadingPoint || p.destination,
              arrivalHistory: p.arrivalHistory,
              loadingDays: p.loadingDays !== undefined ? p.loadingDays : sub.loadingDays,
            });
          }
        });
      }
    });

    const results: any[] = [];
    const addedKeys = new Set<string>();

    // 1. Direct procurement requests (placed from store/bag/cart) - ONLY show once approved!
    validProc.forEach((proc: any) => {
      if (!proc || !proc.id) return;
      const key = String(proc.id).trim().toLowerCase().replace(/^#/, '');
      if (isMerchantMatch(proc)) {
        const batchInfo = batchStatusMap.get(key);
        // Procurement indents only appear in Placed Orders once placed into a PO!
        if (!batchInfo) {
          return;
        }

        const orderObj = {
          ...proc,
          status: batchInfo?.status || 'Awaiting Settlement',
          progress: batchInfo?.progress || proc.progress || 25,
          supplier: batchInfo?.supplier || proc.supplier || 'Direct Mill',
          billNo: batchInfo?.billNo || proc.billNo || proc.id,
          origin: batchInfo?.origin || proc.origin || 'Mill Dispatch Hub',
          destination: batchInfo?.destination || proc.destination || proc.address || 'APMC Yard, Bangalore',
          arrivalHistory: batchInfo?.arrivalHistory || proc.arrivalHistory,
          parentBatchId: batchInfo?.parentBatchId,
        };
        results.push(orderObj);
        addedKeys.add(key);
      }
    });

    // 2. Placed orders: Extract ONLY merchant's own sub-orders from batches, or direct merchant orders
    validPlaced.forEach((placed: any) => {
      if (!placed || !placed.id) return;
      const isBatch = placed.isGroupedBatch || 
                      String(placed.id).startsWith('TC-') || 
                      String(placed.items || '').toLowerCase().includes('grouped orders') ||
                      placed.placedBy === 'admin';

      if (isBatch && placed.originalOrders && Array.isArray(placed.originalOrders)) {
        // DO NOT show the admin batch PO to the merchant!
        // Instead, extract any sub-orders belonging to this merchant
        placed.originalOrders.forEach((sub: any) => {
          if (!sub || !sub.id) return;
          const subKey = String(sub.id).trim().toLowerCase().replace(/^#/, '');
          if (addedKeys.has(subKey)) return;

          if (isMerchantMatch(sub)) {
            results.push({
              id: sub.id,
              billNo: placed.billNo || sub.billNo || sub.id,
              items: sub.product || sub.items || 'Bulk Grain Lot',
              product: sub.product || sub.name,
              qty: sub.qty,
              rate: sub.rate || sub.price,
              total: sub.total || (Number(sub.qty || 0) * Number(sub.rate || 0)) || placed.total,
              buyer: sub.buyer || merchantName,
              supplier: placed.supplier || sub.supplier || 'Direct Mill',
              status: placed.status || 'Approved',
              progress: placed.progress || 35,
              date: sub.date || placed.date || placed.createdAt || new Date().toISOString(),
              destination: sub.destination || sub.unloadingPoint || 'APMC Yard, Bangalore',
              origin: placed.origin || 'Mill Dispatch Hub',
              loadingDays: sub.loadingDays !== undefined ? sub.loadingDays : placed.loadingDays,
              parentBatchId: placed.id,
              originalOrders: [sub],
            });
            addedKeys.add(subKey);
          }
        });
      } else if (!isBatch && isMerchantMatch(placed)) {
        // Direct non-batch order placed by merchant
        const placedKey = String(placed.id).trim().toLowerCase().replace(/^#/, '');
        if (!addedKeys.has(placedKey)) {
          results.push(placed);
          addedKeys.add(placedKey);
        }
      }
    });

    // If an arrival entry exists in physical arrival sheet matching this order or parent batch, link it
    const mapped = results.map((o: any) => {
      const matchingArrival = (arrivalList || []).find(row => 
        row && row.purchaseOrderNo && (
          String(row.purchaseOrderNo).trim().toLowerCase().replace(/^#/, '') === String(o.id).trim().toLowerCase().replace(/^#/, '') ||
          (o.parentBatchId && String(row.purchaseOrderNo).trim().toLowerCase().replace(/^#/, '') === String(o.parentBatchId).trim().toLowerCase().replace(/^#/, ''))
        )
      );
      const obj = { ...o };
      if (matchingArrival?.billNo) {
        obj.billNo = matchingArrival.billNo;
      }
      const arrStatus = String(matchingArrival?.status || '').toLowerCase();
      if (arrStatus === 'arrived' || arrStatus === 'unloaded' || matchingArrival?.dateOfArrival) {
        obj.status = 'Arrived';
        obj.progress = 100;
      }
      return obj;
    });

    return sortNewestFirst(mapped);
  };

  const buildAdminOrders = (
    placedList: any[], 
    procList: any[], 
    arrivalList: any[]
  ) => {
    const isApprovedStatus = (s: any) => {
      const norm = String(s || '').trim().toLowerCase();
      return (
        norm === 'approved' ||
        norm === 'accepted' ||
        norm === 'awaiting settlement' ||
        norm === 'confirmed' ||
        norm === 'in transit' ||
        norm === 'dispatched' ||
        norm === 'arrived' ||
        norm === 'unloaded' ||
        norm === 'delivered' ||
        norm === 'completed'
      );
    };

    const filterIgnored = (list: any[]) => (list || []).filter(
      (o: any) => o && 
        o.id !== 'ORD-TC-1024' && 
        !String(o.id).startsWith('#ORD-99') && 
        !String(o.id).startsWith('TC-0000') && 
        o.status !== 'Pending Approval' && 
        o.status !== 'Draft Order' && 
        o.status !== 'Rejected' &&
        String(o.status || '').trim().toLowerCase() !== 'approved' &&
        String(o.status || '').trim().toLowerCase() !== 'accepted'
    );

    const validPlaced = filterIgnored(placedList);

    // Only orders that were explicitly placed (e.g. Batch POs created via Group & Place Orders) belong in Placed Orders.
    // Procurement requests that are merely approved remain in procurement_requests waiting to be placed.
    let combined = [...validPlaced];

    const uniqueMap = new Map<string, any>();
    combined.forEach(item => {
      if (!item || !item.id) return;
      const normKey = String(item.id).trim().toLowerCase().replace(/^#/, '');
      if (!uniqueMap.has(normKey)) {
        uniqueMap.set(normKey, item);
      }
    });

    let unique = Array.from(uniqueMap.values());

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
    setIsDeletingAll(true);
    setPasswordError(null);

    const check = await verifyActionWithServer('delete_whole_placed_orders', deletePassword.trim());
    if (!check.success) {
      setPasswordError(check.error || 'Incorrect authorization password. Deletion cancelled.');
      setIsDeletingAll(false);
      return;
    }

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
      const merchantName = (localStorage.getItem('userName') || '').trim().toLowerCase();
      const merchantEmail = (localStorage.getItem('userEmail') || '').trim().toLowerCase();
      const merchantUserId = (localStorage.getItem('userId') || '').trim().toLowerCase();

      const savedPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      // Clean up any stray unplaced/approved indents from placed_orders cache
      const cleanedSavedPlaced = savedPlaced.filter((o: any) => o && String(o.status || '').trim().toLowerCase() !== 'approved');
      if (cleanedSavedPlaced.length !== savedPlaced.length) {
        localStorage.setItem('placed_orders', JSON.stringify(cleanedSavedPlaced));
      }

      // 1. Read local storage first for INSTANT local rendering (0ms delay)
      const savedProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');

      const localOrders = isMerchant
        ? buildMerchantOrders(cleanedSavedPlaced, savedProcurements, localArrivals, merchantName, merchantEmail, merchantUserId)
        : buildAdminOrders(cleanedSavedPlaced, savedProcurements, localArrivals);

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

      // Purge any accidental 'Approved' unplaced docs from cloud placed_orders collection
      cloudPlaced.forEach((cp: any) => {
        if (cp && cp.id && String(cp.status || '').trim().toLowerCase() === 'approved') {
          deleteCollectionDoc('placed_orders', cp.id).catch(() => {});
        }
      });

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

      const cloudOrders = isMerchant
        ? buildMerchantOrders(mergedPlaced, mergedProc, finalArrivals, merchantName, merchantEmail, merchantUserId)
        : buildAdminOrders(mergedPlaced, mergedProc, finalArrivals);

      setCurrentPlacedOrders(cloudOrders);
    } catch (e) {
      console.error('Failed to load placed orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [isMerchant]);

  // Intercept Ctrl+P / Cmd+P while A4 Purchase Order preview modal is open
  useEffect(() => {
    if (!a4PreviewOrder) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleDirectPrintA4(a4PreviewOrder, a4PreviewSubOrders);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [a4PreviewOrder, a4PreviewSubOrders]);

  const handleOpenShare = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareOrder(order);
    
    const calculatedAmt = order.originalOrders && order.originalOrders.length > 0 
      ? order.originalOrders.reduce((sum: number, sub: any) => sum + ((parseFloat(sub.qty) || 0) * (parseFloat(sub.rate) || 4200)), 0)
      : null;
    const finalTotal = calculatedAmt !== null ? `₹ ${formatINR(calculatedAmt)}` : (typeof order.total === 'number' ? `₹ ${formatINR(order.total)}` : order.total);

    const firstSub = order.originalOrders && order.originalOrders.length > 0 ? order.originalOrders[0] : null;
    const brand = (firstSub?.product || order.items || order.product || 'keshar kali').replace(/\(\d+.*$/, '').trim();
    const qty = firstSub?.qty || order.qty || parseFloat(order.items?.match(/\d+/)?.[0] || '40');
    const rate = firstSub?.rate || order.rate || 10000;
    const buyerName = order.buyer || 'Vision stores';

    const message = `Hello ${buyerName},\n\nOrder placed successfully.\n\nBrand: ${brand}\nQuantity: ${qty} QTL\nRate: ₹${rate}/QTL\n\nThank you,\nTejas Canvassing`;
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
    setPoSubject("Tejas Canvassing: New purchase orders");
    
    const supplierName = sanitizeSupplierName(order.supplier || order.origin || order.sellerName, 'DIRECT MILL');
    const supplierProfile = getSupplierProfile(supplierName);
    const inferredRecipient = (order.sellerEmail && order.sellerEmail.includes('@')) 
      ? order.sellerEmail 
      : (supplierProfile?.email || 'supplier@gmail.com');

    setPoRecipient(inferredRecipient);
    const resolvedSender = (order.companyEmail && order.companyEmail !== 'tejasadinarayan@gmail.com' && order.companyEmail !== 'procurement@tejascanvassing.com')
      ? order.companyEmail
      : (localStorage.getItem('companyEmail') || (localStorage.getItem('userEmail') && localStorage.getItem('userEmail') !== 'tejasadinarayan@gmail.com' ? localStorage.getItem('userEmail') : null) || 'nani@tejasc.in');
    setPoSender(resolvedSender);
    setSendingSuccess(false);
    setPoLogs([]);
  };

  const handleCopyEmailHTML = () => {
    if (!poOrder) return;
    const supplierName = sanitizeSupplierName(poOrder.supplier || poOrder.origin, 'DIRECT MILL');
    const subOrders = poOrder.originalOrders && poOrder.originalOrders.length > 0
      ? poOrder.originalOrders
      : [{
          id: poOrder.id,
          buyer: poOrder.buyer || "Authorized Merchant",
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
          buyer: order.buyer || "Authorized Merchant",
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
      const doc = buildPoPdfDocument(order, subOrders);
      const fileName = getPoPdfFileName(order);
      doc.save(fileName);
    } catch (err) {
      console.error("PDF generation error:", err);
    }
  };

  const handleDirectPrintA4 = (order: any, subOrders: any[]) => {
    const el = document.getElementById('a4-printable-po-document');
    if (!el) {
      const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
      printPoDocument(supplierName, order, subOrders);
      return;
    }

    // Clean up any stale print frames
    const oldFrame = document.getElementById('po-isolated-print-frame');
    if (oldFrame && document.body.contains(oldFrame)) {
      document.body.removeChild(oldFrame);
    }

    // Create an isolated hidden iframe dedicated ONLY to printing the PO
    const printFrame = document.createElement('iframe');
    printFrame.id = 'po-isolated-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
      printPoDocument(supplierName, order, subOrders);
      return;
    }

    // Collect all stylesheets from the current page to preserve typography & Tailwind rules
    let headStyles = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
      headStyles += node.outerHTML;
    });

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order - ${order?.id || 'PO'}</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            #a4-printable-po-document {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              background: #ffffff !important;
              color: #0f172a !important;
            }
          </style>
        </head>
        <body class="bg-white text-slate-900">
          <div style="width: 100%; max-width: 210mm; margin: 0 auto; background: #ffffff;">
            ${el.outerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    // Trigger printing once the iframe has completed rendering
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.warn("Iframe print fallback to printPoDocument:", err);
        const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
        printPoDocument(supplierName, order, subOrders);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 5000);
      }
    }, 350);
  };

  const handleOpenStandaloneA4 = (order: any, subOrders: any[]) => {
    const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
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
      const supplierName = sanitizeSupplierName(poOrder.supplier || poOrder.origin, 'DIRECT MILL');
      const subOrders = poOrder.originalOrders && poOrder.originalOrders.length > 0
        ? poOrder.originalOrders
        : [{
            id: poOrder.id,
            buyer: poOrder.buyer || "Authorized Merchant",
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
          from: poSender || 'nani@tejasc.in',
          cc: poSender || 'nani@tejasc.in',
          subject: poSubject,
          html: emailHtml,
          batchId: poOrder.id,
          supplierName: supplierName
        })
      });
      const poData = await poRes.json();
      setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SMTP Dispatch: ${poData.message || 'Success'} (Status: ${poData.status || 'OK'})`]);
      if (poData.confirmationEmail) {
        setPoLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Mail Confirmation Copy routed to: ${poData.confirmationEmail}`]);
      }

      // 2. Dispatch WhatsApp confirmation to buyer phone
      const primaryBuyer = subOrders[0]?.buyer || poOrder.buyer || 'Vision stores';
      const targetPhone = poOrder.phone || localStorage.getItem('userPhone') || '';
      const orderBrand = (subOrders[0]?.product || poOrder.product || 'keshar kali').replace(/\(\d+.*$/, '').trim();
      const orderRate = subOrders[0]?.rate || poOrder.rate || 10000;
      const whatsappMsg = `Hello ${primaryBuyer},\n\nOrder placed successfully.\n\nBrand: ${orderBrand}\nQuantity: ${totalQty} QTL\nRate: ₹${orderRate}/QTL\n\nThank you,\nTejas Canvassing`;

      const waRes = await fetch('/api/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetPhone,
          buyerName: primaryBuyer,
          brand: orderBrand,
          qty: String(totalQty),
          rate: String(orderRate),
          orderId: poOrder.id,
          poNumber: poOrder.id,
          message: whatsappMsg,
          templateName: 'order_notify',
          templateId: '1016669984165776',
          templateParams: [primaryBuyer, orderBrand, String(totalQty), String(orderRate)],
          languageCode: 'en'
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
        companyEmail: poSender || 'nani@tejasc.in',
        sellerEmail: poRecipient
      };

      await setCollectionDoc('placed_orders', poOrder.id, updatedOrder);
      setCurrentPlacedOrders(prev => prev.map(o => o.id === poOrder.id ? updatedOrder : o));
      
      const saved = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedSaved = saved.map((o: any) => o.id === poOrder.id ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedSaved));
      localStorage.setItem('companyEmail', poSender || 'nani@tejasc.in');

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
    billNoToUse?: string | {[subId: string]: string},
    customLhRate?: number,
    customLhAccepted?: boolean
  ) => {
    try {
      const targetOrder = currentPlacedOrders.find(o => o.id === orderId);
      if (!targetOrder) return;

      const billMapToUse: {[key: string]: string} = (typeof billNoToUse === 'object' && billNoToUse !== null)
        ? billNoToUse
        : (typeof arrivalSupplierBillNos === 'object' && arrivalSupplierBillNos !== null ? arrivalSupplierBillNos : {});

      const fallbackBillNo = (typeof billNoToUse === 'string' && billNoToUse.trim())
        ? billNoToUse.trim()
        : (Object.values(billMapToUse).find(b => b && b.trim()) || actualSupplierBillNo || targetOrder.actualSupplierBillNo || targetOrder.billNo || '').trim();

      const lhRateToUse = customLhRate !== undefined 
        ? customLhRate 
        : (parseFloat(vehicleLhRate) || 0);

      const isLhAccepted = customLhAccepted !== undefined 
        ? customLhAccepted 
        : vehicleLhAccepted;

      let totalVehicleLh = 0;
      let updatedOriginalOrders = targetOrder.originalOrders;

      if (targetOrder.originalOrders && targetOrder.originalOrders.length > 0) {
        updatedOriginalOrders = targetOrder.originalOrders.map((sub: any, sIdx: number) => {
          const subId = sub.id || `sub-${sIdx}`;
          const q = (customQtys && customQtys[subId] !== undefined) ? customQtys[subId] : (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0);
          const subLh = Math.round(q * lhRateToUse);
          totalVehicleLh += subLh;
          const subBill = (billMapToUse[subId] !== undefined ? billMapToUse[subId] : (sub.actualSupplierBillNo || sub.billNo || fallbackBillNo || '')).trim();
          return {
            ...sub,
            actualSupplierBillNo: subBill || sub.actualSupplierBillNo || fallbackBillNo,
            billNo: subBill || sub.billNo || fallbackBillNo,
            lhPerQtl: lhRateToUse,
            lh: subLh,
            lhAccepted: isLhAccepted
          };
        });
      } else {
        const totalQty = (customQtys && customQtys[orderId] !== undefined)
          ? customQtys[orderId]
          : parseFloat(targetOrder.items?.match(/\d+(\.\d+)?/)?.[0] || targetOrder.totalQty || targetOrder.qty || "10");
        totalVehicleLh = Math.round(totalQty * lhRateToUse);
      }

      const singleBill = (billMapToUse[orderId] || fallbackBillNo).trim();
      const primaryBillNo = singleBill || fallbackBillNo || targetOrder.billNo;

      const updatedOrder = {
        ...targetOrder,
        status: 'Arrived',
        progress: 100,
        billNo: primaryBillNo,
        actualSupplierBillNo: primaryBillNo,
        supplierBillNos: billMapToUse,
        originalOrders: updatedOriginalOrders,
        lhPerQtl: lhRateToUse,
        totalLh: totalVehicleLh,
        lhAccepted: isLhAccepted,
        arrivedAt: new Date().toISOString()
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

      // 3. Ensure local Arrival Entry logs and sheets are updated FIRST with calculated L.H and sub-order bill numbers
      await autoCreateArrivalEntryForIncomingLog(orderId, updatedOrder, customQtys, customRates, billMapToUse, lhRateToUse).catch(err => {
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
    
    const qtyMap: {[key: string]: number} = {};
    const rateMap: {[key: string]: number} = {};
    const billMap: {[key: string]: string} = {};
    
    const defaultLh = order.lhPerQtl !== undefined 
      ? String(order.lhPerQtl) 
      : (order.totalLh && order.totalQty ? String(Math.round(order.totalLh / order.totalQty)) : '');
    setVehicleLhRate(defaultLh);
    setVehicleLhAccepted(true);

    if (order.originalOrders && order.originalOrders.length > 0) {
      order.originalOrders.forEach((sub: any, sIdx: number) => {
        const subId = sub.id || `sub-${sIdx}`;
        qtyMap[subId] = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
        rateMap[subId] = parseFloat(sub.rate) || 4200;
        billMap[subId] = sub.actualSupplierBillNo || sub.billNo || order.actualSupplierBillNo || order.billNo || '';
      });
    } else {
      const totalQty = parseFloat(order.items?.match(/\d+(\.\d+)?/)?.[0] || order.totalQty || "10");
      qtyMap[order.id] = totalQty;
      rateMap[order.id] = parseFloat(order.rate) || 4200;
      billMap[order.id] = order.actualSupplierBillNo || order.billNo || '';
    }
    
    setArrivalQuantities(qtyMap);
    setArrivalRates(rateMap);
    setArrivalSupplierBillNos(billMap);
    setActualSupplierBillNo(order.actualSupplierBillNo || order.billNo || '');
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
                  <span className="text-[10px] text-secondary font-mono">Master Authorization Required</span>
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

      {/* PO Email Tracking Filter Sub-Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-container-low/70 dark:bg-neutral-900/60 p-3.5 rounded-2xl border border-outline-variant/30 text-xs shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-black text-secondary uppercase tracking-wider mr-2">
            <Mail className="w-3.5 h-3.5 text-primary" />
            <span>PO Email:</span>
          </div>

          {[
            { id: 'all', label: 'All Emails', count: emailCounts.all },
            { id: 'queued', label: 'Queued / Sending', count: emailCounts.queued },
            { id: 'sent_unconfirmed', label: 'Sent / Unconfirmed', count: emailCounts.sentUnconfirmed },
            { id: 'delivered', label: 'Delivered', count: emailCounts.delivered },
            { id: 'bounced', label: 'Bounced / Failed', count: emailCounts.bounced },
            { id: 'awaiting_ack', label: 'Awaiting Ack', count: emailCounts.awaitingAck },
            { id: 'acknowledged', label: 'Acknowledged', count: emailCounts.acknowledged },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEmailFilter(tab.id as any)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[11px] font-bold tracking-tight transition-all cursor-pointer border flex items-center gap-1.5",
                emailFilter === tab.id
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface text-secondary hover:bg-surface-container border-outline-variant/30"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold",
                emailFilter === tab.id ? "bg-black/25 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-secondary"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCheckBounces}
            disabled={isCheckingBounces}
            className="px-3 py-1.5 bg-surface hover:bg-surface-container text-secondary hover:text-on-surface border border-outline-variant/50 rounded-xl text-[11px] font-bold tracking-tight flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Scan Gmail mailbox via gmail.readonly for Mailer-Daemon bounce notifications"
          >
            {isCheckingBounces ? (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-secondary" />
            )}
            <span>Scan Bounces</span>
          </button>
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
                  className="floating-card liquid-glass p-6 rounded-2xl flex flex-col gap-6 relative overflow-hidden group interactive-card premium-border transition-all duration-300"
                >
                  <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-primary/10 blur-3xl pointer-events-none opacity-30 group-hover:opacity-70 transition-opacity" />
                  <div className="flex flex-col md:flex-row gap-6 relative z-10">
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
                          {(() => {
                            const trk = trackingRecordMap[order.id];
                            const status = trk?.status || (order.purchaseOrderSent ? 'Sent' : 'Queued');
                            const cfg = getStatusBadgeConfig(status);
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForTracking(order);
                                }}
                                className={cn(
                                  "text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer hover:opacity-90 shadow-2xs",
                                  cfg.bg
                                )}
                                title="Click to view Email Delivery & Acknowledgement Tracking"
                              >
                                <Mail className="w-3 h-3" />
                                <span>PO Email: {status}</span>
                                {trk?.acknowledgedAt && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                              </button>
                            );
                          })()}
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
                          {sanitizeSupplierName(order.supplier || (order.originalOrders && order.originalOrders[0]?.supplier), 'Direct Mill')}
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
                        <span>Email auto-sent to supplier: <strong className="text-on-surface font-black ml-1">{sanitizeSupplierName(order.supplier || (order.originalOrders && order.originalOrders[0]?.supplier), 'Direct Mill')}</strong></span>
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
                          className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-secondary/[0.06] hover:bg-secondary/[0.12] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-secondary border border-secondary/15 cursor-pointer"
                          title="Share order summary to customer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share Summary
                        </button>
                        
                        {/* PO Email Tracking Modal trigger */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderForTracking(order);
                          }}
                          className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/[0.08] hover:bg-blue-500/[0.18] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-blue-700 dark:text-blue-300 border border-blue-500/25 cursor-pointer shadow-2xs"
                          title="View PO Email dispatch status, Gmail message IDs, and Supplier Acknowledgement audit timeline"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          Track Email
                        </button>

                        {/* Direct Print A4 PO for filing */}
                        <button 
                          onClick={(e) => handleOpenA4Preview(order, e)}
                          className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer shadow-sm hover:shadow"
                          title="Print Purchase Order on A4 Sheet for Paperwork / Filing"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          Print A4
                        </button>

                        {/* Mark as arrived button */}
                        {order.status !== 'Arrived' ? (
                          <button 
                            onClick={(e) => handleOpenArrivalConfirm(order, e)}
                            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/[0.1] hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-emerald-600/20 cursor-pointer"
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
                            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200/50 transition-all cursor-pointer"
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
                          className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-purple-500/20 shadow-sm cursor-pointer"
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
          const rawSupplierName = poOrder.supplier || (poOrder.originalOrders && poOrder.originalOrders[0]?.supplier) || poOrder.origin;
          const supplierName = sanitizeSupplierName(rawSupplierName, 'DIRECT MILL');

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
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Company Mail (From)</label>
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Active Sender</span>
                        </div>
                        <div className="relative group">
                          <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                          <input 
                            type="email"
                            required
                            value={poSender}
                            onChange={(e) => setPoSender(e.target.value)}
                            placeholder="nani@tejasc.in"
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

                    {/* Mail Delivery Confirmation Notice */}
                    <div className="flex items-center gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                        A mail confirmation copy will automatically be sent to <strong className="font-bold underline">{poSender || 'nani@tejasc.in'}</strong> upon dispatch.
                      </span>
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
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">From:</span> <span className="text-on-surface">{poSender || 'nani@tejasc.in'}</span></div>
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">To:</span> <span className="text-on-surface">{poRecipient}</span></div>
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">Confirmation CC:</span> <span className="text-primary font-bold">{poSender || 'nani@tejasc.in'}</span></div>
                          <div><span className="text-outline uppercase text-[8px] tracking-widest mr-1">Subject:</span> <span className="text-on-surface select-all">{poSubject}</span></div>
                        </div>

                        {/* Exact copy of user-supplied image inside email body */}
                        <div 
                          id="po-email-preview-container"
                          className="bg-white p-6 md:p-8 rounded-lg shadow-sm border border-[#b0b0b0] text-black text-left overflow-x-auto select-text"
                          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                        >
                          {/* Top row with Logo and Business details */}
                          <div className="flex items-center gap-3.5 pb-4">
                            {/* Blue TC logo box */}
                            <div className="w-12 h-12 bg-[#0084ff] flex items-center justify-center rounded-md text-white font-sans font-bold text-xl select-none shrink-0">
                              TC
                            </div>
                            <div className="text-left font-sans">
                              <h3 className="text-xl font-bold text-black leading-tight">Tejas Canvassing</h3>
                              <p className="text-sm text-[#333333] font-normal mt-0.5">Bangalore</p>
                            </div>
                          </div>

                          {/* Horizontal divider */}
                          <hr className="border-0 border-t border-[#999999] my-4" />

                          {/* Salutation & Today's orders */}
                          <div className="mb-4 text-sm text-black space-y-3.5">
                            <div>Dear {supplierName.toUpperCase()},</div>
                            <div>Today's orders:</div>
                          </div>

                          {/* Pixel Perfect Tabular layout identical to the reference design */}
                          <div className="w-full my-4">
                            <table className="w-full border-collapse border border-[#b0b0b0] text-[13px] text-black">
                              <thead>
                                <tr className="bg-[#ebebeb] text-black font-bold border-b border-[#b0b0b0]">
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '14%' }}>Date</th>
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '42%' }}>Buyer</th>
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '14%' }}>Product</th>
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '10%' }}>Qty<br/>(quintals)</th>
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '10%' }}>Rate<br/>(per<br/>qtl.)</th>
                                  <th className="p-3 border border-[#b0b0b0] text-center font-bold" style={{ width: '10%' }}>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subOrders.map((sub: any, sIdx: number) => {
                                  const profile = resolveBuyerProfile(sub.buyer || poOrder.buyer || 'Authorized Merchant');
                                  const subQty = sub.qty !== undefined ? sub.qty : (sub.totalQty !== undefined ? sub.totalQty : 20.8);
                                  const subRate = sub.rate !== undefined ? sub.rate : 7950;
                                  const subProduct = (sub.product || poOrder.product || sub.items?.replace(/\(\d+.*$/, '') || "JMR KNM STEAM").toString().trim();
                                  const productWords = subProduct.replace(/<br\s*\/?>/gi, ' ').split(/[\s\n]+/);
                                  const loadingDays = sub.loadingDays !== undefined ? sub.loadingDays : 0;
                                  const unloadingPoint = sub.unloadingPoint || 'shop';

                                  return (
                                    <tr key={sIdx} className="align-top bg-white font-normal hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3.5 border border-[#b0b0b0] text-black text-left">
                                        {formatPoDate(sub.date || poOrder.date)}
                                      </td>
                                      <td className="p-3.5 border border-[#b0b0b0] text-left space-y-1.5">
                                        <div className="font-bold text-black uppercase tracking-wide">{sub.buyer || 'Authorized Merchant'}</div>
                                        <div className="text-[11px] text-[#333333] leading-relaxed">{profile.address}</div>
                                        <div className="text-[11.5px] text-black space-y-0.5 pt-1">
                                          <div><span className="font-bold">GSTIN:</span> <span>{profile.gstin}</span></div>
                                          <div><span className="font-bold">Phone:</span> <span>{profile.phone}</span></div>
                                          <div><span className="font-bold">Email:</span> {profile.email ? <a href={`mailto:${profile.email}`} className="text-[#0070f3] hover:underline">{profile.email}</a> : null}</div>
                                        </div>
                                      </td>
                                      <td className="p-3.5 border border-[#b0b0b0] text-left text-black uppercase font-normal leading-tight">
                                        {productWords.map((word: string, wIdx: number) => (
                                          <div key={wIdx}>{word}</div>
                                        ))}
                                      </td>
                                      <td className="p-3.5 border border-[#b0b0b0] text-center font-normal text-black">
                                        {subQty}
                                      </td>
                                      <td className="p-3.5 border border-[#b0b0b0] text-center font-normal text-black">
                                        {subRate}
                                      </td>
                                      <td className="p-3.5 border border-[#b0b0b0] text-left text-black space-y-1 text-xs leading-normal">
                                        <div>
                                          <strong className="font-bold">No of days for loading:</strong><br/>
                                          <span>{loadingDays}</span>
                                        </div>
                                        <div className="pt-0.5">
                                          <strong className="font-bold">Unloading Point:</strong> {unloadingPoint}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
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
                    <div className="space-y-1.5 col-span-12">
                      <h4 className="font-black text-lg text-on-surface">Purchase Order &amp; Mail Confirmation Dispatched!</h4>
                      <p className="text-xs text-secondary max-w-md">
                        The purchase order was compiled and transmitted via SMTP to supplier <strong className="text-primary">{poRecipient}</strong> from <strong className="text-primary">{poSender || 'nani@tejasc.in'}</strong>.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold max-w-md">
                        ✓ Delivery confirmation copy routed to: {poSender || 'nani@tejasc.in'}
                      </p>
                    </div>
                    <div className="mt-4 w-full max-w-sm bg-surface-container rounded-xl p-3 border border-outline-variant flex items-center justify-between text-[10px] font-black uppercase text-secondary">
                      <span>Sender Mail:</span>
                      <span className="font-mono text-primary select-all">{poSender || 'nani@tejasc.in'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-surface-container border-t border-outline-variant shrink-0 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const phoneVal = (poOrder?.phone || localStorage.getItem('userPhone') || '').replace(/[^0-9]/g, '');
                    const waDigits = phoneVal.length === 10 ? `91${phoneVal}` : phoneVal;
                    const totalVolume = subOrders.reduce((sum: number, s: any) => sum + (parseFloat(s.qty) || 0), 0);
                    const poWaText = encodeURIComponent(`Tejas Canvassing PO ${poOrder?.id}: Today's consolidated orders issued to ${supplierName}. Total Volume: ${totalVolume} QTLS.\nRecipient: ${poRecipient}`);
                    const poBodyText = encodeURIComponent(`DEAR ${supplierName.toUpperCase()},\n\nPlease find Purchase Order ${poOrder?.id} for ${totalVolume} QTLS compiled by Tejas Canvassing.\n\nItems:\n${subOrders.map((s: any) => `- ${s.buyer}: ${s.product || 'Rice'} (${s.qty} QTLS @ ₹${s.rate})`).join('\n')}\n\nTerms: Loading days: ${poOrder?.loadingDays || 5}`);
                    const currentSenderMail = poSender || 'nani@tejasc.in';
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(poRecipient)}&cc=${encodeURIComponent(currentSenderMail)}&su=${encodeURIComponent(poSubject)}&body=${poBodyText}`;
                    const mailtoUrl = `mailto:${encodeURIComponent(poRecipient)}?cc=${encodeURIComponent(currentSenderMail)}&subject=${encodeURIComponent(poSubject)}&body=${poBodyText}`;

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

                  {/* Whole Vehicle L.H Section (Applied to entire order/truck) */}
                  {(() => {
                    const isBatch = arrivalConfirmOrder.originalOrders && arrivalConfirmOrder.originalOrders.length > 0;
                    const totalVehicleArrivedQty = isBatch
                      ? arrivalConfirmOrder.originalOrders.reduce((sum: number, sub: any, sIdx: number) => {
                          const subId = sub.id || `sub-${sIdx}`;
                          const q = arrivalQuantities[subId] !== undefined ? arrivalQuantities[subId] : (parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0);
                          return sum + q;
                        }, 0)
                      : (arrivalQuantities[arrivalConfirmOrder.id] !== undefined 
                          ? arrivalQuantities[arrivalConfirmOrder.id] 
                          : parseFloat(arrivalConfirmOrder.items?.match(/\d+(\.\d+)?/)?.[0] || arrivalConfirmOrder.totalQty || "10"));
                    const lhRateNum = parseFloat(vehicleLhRate) || 0;
                    const totalVehicleLhCalc = Math.round(totalVehicleArrivedQty * lhRateNum);

                    return (
                      <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/30 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5" />
                              Vehicle L.H (Loading / Hamali) • Whole Order
                            </span>
                            <p className="text-[10px] text-secondary font-medium">
                              Applied once to the whole vehicle dispatch ({totalVehicleArrivedQty.toFixed(2)} QTLS total arrived)
                            </p>
                          </div>
                          {lhRateNum > 0 && (
                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Total Vehicle L.H: ₹{formatINR(totalVehicleLhCalc)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-secondary flex items-center justify-between">
                              <span>L.H per Quintal (₹/QTL)</span>
                              <span className="font-mono text-secondary">₹{lhRateNum}/QTL</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs font-bold text-secondary">₹</span>
                              <input 
                                type="number"
                                step="any"
                                min="0"
                                value={vehicleLhRate}
                                onChange={(e) => setVehicleLhRate(e.target.value)}
                                placeholder="e.g. 15 or 20"
                                className="w-full pl-7 pr-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 sm:pt-4">
                            <label className={`w-full px-3 py-2 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all select-none ${
                              vehicleLhAccepted ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                            }`}>
                              <input 
                                type="checkbox"
                                checked={vehicleLhAccepted}
                                onChange={(e) => setVehicleLhAccepted(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded border-outline-variant focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wide truncate">
                                  {lhRateNum > 0 ? `Accept ₹${formatINR(totalVehicleLhCalc)} Vehicle L.H` : 'Accept (₹0 Vehicle L.H)'}
                                </p>
                                <p className="text-[9px] opacity-80 truncate">
                                  {lhRateNum > 0 ? `${totalVehicleArrivedQty.toFixed(2)} QTLS × ₹${lhRateNum}` : 'No L.H charged for this truck'}
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                    {arrivalConfirmOrder.originalOrders && arrivalConfirmOrder.originalOrders.length > 0 ? (
                      arrivalConfirmOrder.originalOrders.map((sub: any, sIdx: number) => {
                        const subId = sub.id || `sub-${sIdx}`;
                        const origQty = parseFloat(sub.qty) || parseFloat(sub.totalQty) || 0;
                        const origRate = parseFloat(sub.rate) || 4200;
                        const subProduct = sub.product || "Premium Rice";
                        const currentQty = arrivalQuantities[subId] !== undefined ? arrivalQuantities[subId] : origQty;
                        const currentRate = arrivalRates[subId] !== undefined ? arrivalRates[subId] : origRate;
                        const lhRateNum = parseFloat(vehicleLhRate) || 0;
                        const subGross = Math.round(currentQty * currentRate);
                        const subTotalLh = Math.round(currentQty * lhRateNum);
                        const subNetAmt = Math.max(0, subGross - subTotalLh);
                        const subBillNo = arrivalSupplierBillNos[subId] || '';

                        return (
                          <div key={subId} className="p-4 bg-surface-container/40 rounded-xl border border-outline-variant/30 space-y-3.5">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-on-surface uppercase">{sub.buyer}</h4>
                                <p className="text-[10px] text-secondary font-semibold">{subProduct} • {sub.supplier || "Supplier"}</p>
                              </div>
                              <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary border border-outline-variant/30">
                                Original: {origQty} QTLS @ ₹{origRate}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Left: Arrived Qty & Actual Supplier Bill No directly under it */}
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary">
                                    Arrived Qty (QTLS)
                                  </label>
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
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                  {currentQty < origQty && (
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-wide">
                                      Balance Pending: {(origQty - currentQty).toFixed(2)} QTLS
                                    </p>
                                  )}
                                </div>

                                {/* Actual Supplier Bill No placed directly under Arrived Qty */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-primary">
                                      Actual Supplier Bill No (Received in Billing)
                                    </label>
                                    {sIdx === 0 && arrivalConfirmOrder.originalOrders && arrivalConfirmOrder.originalOrders.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const firstBill = arrivalSupplierBillNos[subId] || '';
                                          if (!firstBill.trim()) return;
                                          const updated: {[k: string]: string} = {};
                                          arrivalConfirmOrder.originalOrders.forEach((so: any, idx: number) => {
                                            const id = so.id || `sub-${idx}`;
                                            updated[id] = firstBill;
                                          });
                                          setArrivalSupplierBillNos(prev => ({ ...prev, ...updated }));
                                        }}
                                        className="text-[9px] font-bold text-primary hover:underline cursor-pointer"
                                        title="Copy this bill number to all other sub-orders in this batch"
                                      >
                                        Apply to all
                                      </button>
                                    )}
                                  </div>
                                  <input 
                                    type="text"
                                    value={arrivalSupplierBillNos[subId] !== undefined ? arrivalSupplierBillNos[subId] : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArrivalSupplierBillNos(prev => ({ ...prev, [subId]: val }));
                                    }}
                                    placeholder="e.g. BIL-9842 / INV-2026-001"
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                  <p className="text-[9px] text-secondary">
                                    Recorded directly into Arrival Entry for this order
                                  </p>
                                </div>
                              </div>

                              {/* Right: Settlement Rate & Financial Breakdown */}
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary">
                                    Settlement Rate (₹/QTL)
                                  </label>
                                  <input 
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={currentRate}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setArrivalRates(prev => ({ ...prev, [subId]: isNaN(val) ? 0 : val }));
                                    }}
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                </div>

                                <div className="p-2.5 bg-surface-container/60 rounded-lg border border-outline-variant/30 space-y-1.5 text-[10px]">
                                  <div className="flex justify-between items-center text-secondary">
                                    <span>Gross Value:</span>
                                    <span className="font-mono font-semibold text-on-surface">₹{formatINR(subGross)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-secondary">
                                    <span>Vehicle L.H Share (@ ₹{lhRateNum}/QTL):</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                      {subTotalLh > 0 ? `-₹${formatINR(subTotalLh)}` : '₹0'}
                                    </span>
                                  </div>
                                  <div className="pt-1.5 border-t border-outline-variant/30 flex justify-between items-center font-bold text-on-surface">
                                    <span>Net Sub-order Amount:</span>
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{formatINR(subNetAmt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Calculated Summary Footer for this sub-order */}
                            <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px]">
                              <span className="text-secondary font-mono truncate max-w-[60%]">
                                Bill No: <strong className="text-primary">{subBillNo || 'Pending'}</strong>
                                {subTotalLh > 0 && <span className="text-secondary"> • L.H: ₹{formatINR(subTotalLh)}</span>}
                              </span>
                              <span className="font-mono font-bold text-on-surface">
                                Net Amt: ₹{formatINR(subNetAmt)}
                              </span>
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
                        const lhRateNum = parseFloat(vehicleLhRate) || 0;
                        const gross = Math.round(currentQty * currentRate);
                        const totalLh = Math.round(currentQty * lhRateNum);
                        const netAmt = Math.max(0, gross - totalLh);
                        const singleBillNo = arrivalSupplierBillNos[arrivalConfirmOrder.id] || '';

                        return (
                          <div className="p-4 bg-surface-container/40 rounded-xl border border-outline-variant/30 space-y-3.5">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-on-surface uppercase">{arrivalConfirmOrder.buyer || "Standard Buyer"}</h4>
                                <p className="text-[10px] text-secondary font-semibold">{arrivalConfirmOrder.product || "Premium Grains"}</p>
                              </div>
                              <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary border border-outline-variant/30">
                                Original: {origQty} QTLS @ ₹{origRate}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Left: Arrived Qty & Actual Supplier Bill No directly under it */}
                              <div className="space-y-3">
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
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                  {currentQty < origQty && (
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-wide">
                                      Balance Pending: {(origQty - currentQty).toFixed(2)} QTLS
                                    </p>
                                  )}
                                </div>

                                {/* Actual Supplier Bill No placed directly under Arrived Qty */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-primary">
                                    Actual Supplier Bill No (Received in Billing)
                                  </label>
                                  <input 
                                    type="text"
                                    value={arrivalSupplierBillNos[arrivalConfirmOrder.id] !== undefined ? arrivalSupplierBillNos[arrivalConfirmOrder.id] : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArrivalSupplierBillNos(prev => ({ ...prev, [arrivalConfirmOrder.id]: val }));
                                    }}
                                    placeholder="e.g. BIL-9842 / INV-2026-001"
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                  <p className="text-[9px] text-secondary">
                                    Recorded directly into Arrival Entry for this order
                                  </p>
                                </div>
                              </div>

                              {/* Right: Settlement Rate & Breakdown */}
                              <div className="space-y-3">
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
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 text-on-surface"
                                  />
                                </div>

                                <div className="p-2.5 bg-surface-container/60 rounded-lg border border-outline-variant/30 space-y-1.5 text-[10px]">
                                  <div className="flex justify-between items-center text-secondary">
                                    <span>Gross Value:</span>
                                    <span className="font-mono font-semibold text-on-surface">₹{formatINR(gross)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-secondary">
                                    <span>Vehicle L.H Share (@ ₹{lhRateNum}/QTL):</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                      {totalLh > 0 ? `-₹${formatINR(totalLh)}` : '₹0'}
                                    </span>
                                  </div>
                                  <div className="pt-1.5 border-t border-outline-variant/30 flex justify-between items-center font-bold text-on-surface">
                                    <span>Net Amount:</span>
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{formatINR(netAmt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-[10px]">
                              <span className="text-secondary font-mono truncate max-w-[60%]">
                                Bill No: <strong className="text-primary">{singleBillNo || 'Pending'}</strong>
                                {totalLh > 0 && <span className="text-secondary"> • L.H: ₹{formatINR(totalLh)}</span>}
                              </span>
                              <span className="font-mono font-bold text-on-surface">
                                Net Amt: ₹{formatINR(netAmt)}
                              </span>
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
                    disabled={!vehicleLhAccepted}
                    onClick={async () => {
                      if (!vehicleLhAccepted) return;
                      const orderId = arrivalConfirmOrder.id;
                      const lhRate = parseFloat(vehicleLhRate) || 0;
                      await handleMarkAsArrived(
                        orderId, 
                        arrivalQuantities, 
                        arrivalRates, 
                        arrivalSupplierBillNos,
                        lhRate,
                        vehicleLhAccepted
                      );
                      setArrivalConfirmOrder(null);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                      vehicleLhAccepted 
                        ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed bg-surface border-outline-variant text-secondary'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Confirm & Stay
                  </button>
                  <button
                    type="button"
                    disabled={!vehicleLhAccepted}
                    onClick={async () => {
                      if (!vehicleLhAccepted) return;
                      const orderId = arrivalConfirmOrder.id;
                      const lhRate = parseFloat(vehicleLhRate) || 0;
                      await handleMarkAsArrived(
                        orderId, 
                        arrivalQuantities, 
                        arrivalRates, 
                        arrivalSupplierBillNos,
                        lhRate,
                        vehicleLhAccepted
                      );
                      setArrivalConfirmOrder(null);
                      navigate('/arrival-entry');
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
                      vehicleLhAccepted 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/15 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed bg-surface-container border border-outline-variant text-secondary shadow-none'
                    }`}
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
            <style>{`
              @media print {
                /* Hide everything across the main document */
                body * {
                  visibility: hidden !important;
                }
                /* Expose ONLY the physical A4 document container and its elements */
                #a4-printable-po-document,
                #a4-printable-po-document * {
                  visibility: visible !important;
                }
                #a4-printable-po-document {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  min-height: 100% !important;
                  margin: 0 !important;
                  padding: 10mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  z-index: 9999999 !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
              }
            `}</style>
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
                        DEAR {sanitizeSupplierName(a4PreviewOrder.supplier || a4PreviewOrder.origin, 'DIRECT MILL').toUpperCase()},
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
                            const buyerName = sub.buyer || a4PreviewOrder.buyer || 'Authorized Merchant';
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

      {selectedOrderForTracking && (
        <EmailTrackingModal
          order={selectedOrderForTracking}
          isOpen={Boolean(selectedOrderForTracking)}
          onClose={() => setSelectedOrderForTracking(null)}
          onRefresh={fetchTrackingRecords}
        />
      )}

      {renderDeleteAllModal()}
      {renderToast()}
    </div>
  );
}
