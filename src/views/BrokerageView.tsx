import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Calendar, 
  Warehouse, 
  Percent, 
  Award, 
  ExternalLink, 
  Clock, 
  Search, 
  ArrowLeft,
  Filter,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Calculator,
  X,
  ChevronDown,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, sanitizeSupplierName, cleanMerchantDisplayName } from '../lib/utils';
import { auth, getCollectionDocs } from '../lib/firebase';

interface CommissionLine {
  id: string;
  date: string;
  billNo: string;
  isVerifiedBill: boolean;
  brand: string;
  riceType: string;
  product: string;
  supplier: string;
  qty: number;
  rate: number;
  value: number;
  commission: number;
  formula: string;
}

const isNidhiSupplier = (supplier: string): boolean => {
  const norm = (supplier || '').trim().toUpperCase();
  return norm.includes('NIDHI') || norm.includes('NIDHHI') || norm.includes('MIDHI') || norm.includes('NIDI');
};

export default function BrokerageView() {
  const navigate = useNavigate();
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [dbProcurements, setDbProcurements] = useState<any[]>([]);
  const [dbArrivals, setDbArrivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const buyerName = localStorage.getItem('userName') || 'Authorized Merchant';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch original placed orders and procurement requests
        const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        
        const cloudProcurements = await getCollectionDocs('procurement_requests').catch(() => []);
        const localProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');

        // Fetch arrival entries from cloud and local storage
        const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
        const localArrivalsFlat = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        
        const localArrivalsSheets: any[] = [];
        try {
          const rawSheets = localStorage.getItem('arrival_entry_sheets_v4');
          if (rawSheets) {
            const parsedSheets = JSON.parse(rawSheets);
            if (Array.isArray(parsedSheets)) {
              parsedSheets.forEach((s: any) => {
                if (s && Array.isArray(s.data)) {
                  localArrivalsSheets.push(...s.data);
                }
              });
            }
          }
        } catch (e) {}

        const allArrivals = [...cloudArrivals, ...localArrivalsFlat, ...localArrivalsSheets];

        setDbOrders([...cloudPlaced, ...localPlaced]);
        setDbProcurements([...cloudProcurements, ...localProcurements]);
        setDbArrivals(allArrivals);
      } catch (err) {
        console.error('Failed to load brokerage orders:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter orders related to logged-in merchant
  const merchantOrders = React.useMemo(() => {
    const rawList = [...dbOrders, ...dbProcurements];
    // Deduplicate by ID
    const uniqueMap = new Map();
    rawList.forEach(item => {
      if (item && item.id) {
        uniqueMap.set(item.id, item);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());
    const mName = (buyerName || '').trim().toLowerCase();
    
    return uniqueList.filter((order: any) => {
      const topBuyerMatch = order.buyer && typeof order.buyer === 'string' && order.buyer.trim().toLowerCase() === mName;
      const subBuyerMatch = order.originalOrders && Array.isArray(order.originalOrders) && 
        order.originalOrders.some((sub: any) => sub.buyer && typeof sub.buyer === 'string' && sub.buyer.trim().toLowerCase() === mName);
      return topBuyerMatch || subBuyerMatch;
    });
  }, [dbOrders, dbProcurements, buyerName]);

  // Compute precise commission items with arrival entry bill and variety resolution
  const commissionLines = React.useMemo(() => {
    const lines: CommissionLine[] = [];

    // Helper to resolve bill number and matching arrival row
    const resolveArrivalMatch = (order: any, sub?: any, supplierName?: string) => {
      const orderIdNorm = String(order?.id || '').trim().toLowerCase().replace(/^#/, '');
      const parentIdNorm = String(order?.parentBatchId || '').trim().toLowerCase().replace(/^#/, '');
      const subIdNorm = sub?.id ? String(sub.id).trim().toLowerCase().replace(/^#/, '') : '';

      // Match against arrival entries by purchaseOrderNo
      const match = dbArrivals.find((row: any) => {
        if (!row) return false;
        const po = String(row.purchaseOrderNo || '').trim().toLowerCase().replace(/^#/, '');
        if (!po) return false;
        return (
          po === orderIdNorm ||
          (parentIdNorm && po === parentIdNorm) ||
          (subIdNorm && po === subIdNorm)
        );
      });

      if (match?.billNo && String(match.billNo).trim()) {
        return { billNo: String(match.billNo).trim(), isVerifiedBill: true, matchingArrival: match };
      }

      // Secondary match by Supplier and Buyer Party name if PO was unlinked
      const supNorm = sanitizeSupplierName(supplierName || sub?.supplier || order?.supplier || '', '').toLowerCase();
      const buyerNorm = (buyerName || '').trim().toLowerCase();
      const secondaryMatch = dbArrivals.find((row: any) => {
        if (!row?.billNo || !String(row.billNo).trim()) return false;
        const rowMiller = sanitizeSupplierName(row.millerName || '', '').toLowerCase();
        const rowParty = String(row.partyName || '').trim().toLowerCase();
        return rowMiller && rowParty && rowMiller === supNorm && rowParty === buyerNorm;
      });

      if (secondaryMatch?.billNo && String(secondaryMatch.billNo).trim()) {
        return { billNo: String(secondaryMatch.billNo).trim(), isVerifiedBill: true, matchingArrival: secondaryMatch };
      }

      // Check explicit direct actual bill on order
      if (order?.actualSupplierBillNo && String(order.actualSupplierBillNo).trim()) {
        return { billNo: String(order.actualSupplierBillNo).trim(), isVerifiedBill: true, matchingArrival: match || secondaryMatch };
      }
      if (sub?.actualSupplierBillNo && String(sub.actualSupplierBillNo).trim()) {
        return { billNo: String(sub.actualSupplierBillNo).trim(), isVerifiedBill: true, matchingArrival: match || secondaryMatch };
      }

      const fallback = (sub && sub.billNo) || order?.billNo || order?.id || 'N/A';
      return { billNo: fallback, isVerifiedBill: false, matchingArrival: match || secondaryMatch };
    };

    // Helper to resolve brand name and rice type for variety breakdown
    const resolveVarietyInfo = (order: any, sub?: any, matchingArrival?: any, supplierName?: string) => {
      let brand = (
        matchingArrival?.brand ||
        sub?.brand ||
        order?.brand ||
        ''
      ).trim();

      let riceType = (
        matchingArrival?.item ||
        matchingArrival?.variety ||
        sub?.riceType ||
        sub?.variety ||
        sub?.product ||
        order?.riceType ||
        order?.variety ||
        order?.items ||
        order?.product ||
        ''
      ).trim();

      // If riceType contains known brand names
      const knownBrands = ['KESHAR KALI', 'NIDHI', 'PULKIT', 'DOUBLE DEER', 'LAL MAHAL', 'INDIA GATE', 'DAAWAT', 'HERITAGE'];
      if (!brand) {
        const fullTxt = `${riceType} ${supplierName || ''} ${order?.supplier || ''}`.toUpperCase();
        for (const b of knownBrands) {
          if (fullTxt.includes(b)) {
            brand = b;
            break;
          }
        }
      }

      // Filter out generic placeholder phrases
      if (
        !riceType || 
        riceType.toLowerCase() === 'bulk grain lot' || 
        riceType.toLowerCase() === 'grain' ||
        riceType.toLowerCase() === 'rice'
      ) {
        if (brand.toUpperCase().includes('KESHAR KALI')) {
          riceType = 'Sona Masoori Raw Rice';
        } else if (brand.toUpperCase().includes('NIDHI')) {
          riceType = '1121 Steam Basmati Rice';
        } else {
          riceType = '1121 Raw Basmati Rice';
        }
      }

      if (!brand || brand.toLowerCase() === 'bulk grain lot') {
        const supUpper = (supplierName || order?.supplier || '').toUpperCase();
        if (supUpper.includes('NIDHI')) {
          brand = 'NIDHI';
        } else if (supUpper.includes('PULKIT')) {
          brand = 'PULKIT';
        } else {
          brand = 'KESHAR KALI';
        }
      }

      return { brand, riceType };
    };

    merchantOrders.forEach((order: any) => {
      const orderDate = order.date || '12 June, 2026';
      
      if (order.originalOrders && Array.isArray(order.originalOrders)) {
        order.originalOrders.forEach((sub: any, subIdx: number) => {
          const qty = parseFloat(sub.qty) || 0;
          const rate = parseFloat(sub.rate) || 0;
          const product = sub.product || 'Grain';
          const supplier = sanitizeSupplierName(sub.supplier || order.supplier, 'DIRECT MILL');
          const value = qty * rate;
          const { billNo, isVerifiedBill, matchingArrival } = resolveArrivalMatch(order, sub, supplier);
          const { brand, riceType } = resolveVarietyInfo(order, sub, matchingArrival, supplier);
          
          let commission = 0;
          let formula = '';
          const isNidhi = isNidhiSupplier(supplier);
          
          if (isNidhi) {
            commission = value * 0.01;
            formula = `1.0% of Value (₹${formatINR(value)})`;
          } else {
            commission = qty * 11;
            formula = `${qty.toLocaleString()} QTLS × ₹11`;
          }

          lines.push({
            id: `${order.id}-${subIdx}`,
            date: orderDate,
            billNo,
            isVerifiedBill,
            brand,
            riceType,
            product,
            supplier,
            qty,
            rate,
            value,
            commission,
            formula
          });
        });
      } else {
        // Simple/legacy order fallback
        let qty = parseFloat(order.qty) || 0;
        if (qty === 0 && order.items) {
          const match = order.items.match(/(\d+)\s*QTLS/i);
          if (match) {
            qty = parseFloat(match[1]);
          }
        }
        if (qty === 0) qty = 50;

        let rate = 4200;
        if (order.total) {
          const cleanTotal = parseFloat(String(order.total).replace(/[^\d.]/g, '')) || 0;
          if (cleanTotal > 0) {
            rate = cleanTotal / qty;
          }
        }
        const value = qty * rate;
        const supplier = sanitizeSupplierName(order.supplier, 'DIRECT MILL');
        const { billNo, isVerifiedBill, matchingArrival } = resolveArrivalMatch(order, undefined, supplier);
        const { brand, riceType } = resolveVarietyInfo(order, undefined, matchingArrival, supplier);
        
        let commission = 0;
        let formula = '';
        const isNidhi = isNidhiSupplier(supplier);
        
        if (isNidhi) {
          commission = value * 0.01;
          formula = `1.0% of Value (₹${formatINR(value)})`;
        } else {
          commission = qty * 11;
          formula = `${qty.toLocaleString()} QTLS × ₹11`;
        }

        lines.push({
          id: `${order.id}-0`,
          date: orderDate,
          billNo,
          isVerifiedBill,
          brand,
          riceType,
          product: order.items || 'Bulk Grain Lot',
          supplier,
          qty,
          rate,
          value,
          commission,
          formula
        });
      }
    });

    return lines.sort((a, b) => b.date.localeCompare(a.date));
  }, [merchantOrders, dbArrivals, buyerName]);

  // Extract unique suppliers list
  const uniqueSuppliers = React.useMemo(() => {
    const set = new Set<string>();
    commissionLines.forEach(line => {
      if (line.supplier) set.add(line.supplier);
    });
    return Array.from(set);
  }, [commissionLines]);

  // Filter lines based on search input and supplier filter
  const filteredLines = React.useMemo(() => {
    return commissionLines.filter(line => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        String(line.billNo ?? '').toLowerCase().includes(q) ||
        String(line.product ?? '').toLowerCase().includes(q) ||
        String(line.supplier ?? '').toLowerCase().includes(q);
        
      const matchesSupplier = supplierFilter === 'all' || line.supplier === supplierFilter;

      return matchesSearch && matchesSupplier;
    });
  }, [commissionLines, searchQuery, supplierFilter]);

  // Total summary aggregates
  const totalQtls = React.useMemo(() => filteredLines.reduce((sum, c) => sum + c.qty, 0), [filteredLines]);
  const totalValue = React.useMemo(() => filteredLines.reduce((sum, c) => sum + c.value, 0), [filteredLines]);
  const totalCommission = React.useMemo(() => filteredLines.reduce((sum, c) => sum + c.commission, 0), [filteredLines]);

  // Breakdown metrics
  const nidhiCommission = React.useMemo(() => {
    return filteredLines
      .filter(l => isNidhiSupplier(l.supplier))
      .reduce((sum, c) => sum + c.commission, 0);
  }, [filteredLines]);

  const otherCommission = React.useMemo(() => {
    return filteredLines
      .filter(l => !isNidhiSupplier(l.supplier))
      .reduce((sum, c) => sum + c.commission, 0);
  }, [filteredLines]);

  // Staggering animation configuration
  const listVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFA] dark:bg-[#0A0A0A] text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-3 sm:py-4 pb-28 space-y-2.5 sm:space-y-3">
        
        {/* Navigation & Header - Compact & Definitive */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              type="button"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/store');
                }
              }}
              className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-all cursor-pointer text-neutral-700 dark:text-neutral-300 shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-neutral-900 dark:text-white leading-none">
                  Brokerage Ledger
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-red-50 dark:bg-red-950/40 text-[#C22424] border border-red-200/60 dark:border-red-900/40">
                  APMC
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              type="button"
              onClick={() => window.print()}
              className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              title="Print Ledger"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
              <span className="hidden xs:inline">Print</span>
            </button>
          </div>
        </div>

        {/* ULTRA-COMPACT AMOUNT TO PAY HERO CARD */}
        <div className="bg-[#C22424] text-white rounded-xl p-2.5 sm:p-3 shadow-2xs border border-[#A81F1F] font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div>
                <span className="text-[8px] font-extrabold uppercase tracking-widest text-rose-200 block leading-tight font-sans">
                  Total Brokerage Payable
                </span>
                <span className="text-xl sm:text-2xl font-black font-sans tracking-tight text-white leading-tight">
                  ₹ {formatINR(totalCommission)}
                </span>
              </div>
              <span className="text-[9.5px] text-rose-200 font-sans font-bold bg-black/20 px-2 py-0.5 rounded-full">
                {filteredLines.length} Bill{filteredLines.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Inline Micro Badges */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 text-center sm:text-left font-sans">
              <div className="bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-rose-200 text-[8px] font-bold block leading-none font-sans">Nidhi 1%</span>
                <strong className="text-white text-[11px] font-bold font-sans leading-none mt-0.5 block">₹{formatINR(nidhiCommission)}</strong>
              </div>
              <div className="bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-rose-200 text-[8px] font-bold block leading-none font-sans">APMC ₹11</span>
                <strong className="text-white text-[11px] font-bold font-sans leading-none mt-0.5 block">₹{formatINR(otherCommission)}</strong>
              </div>
              <div className="bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-rose-200 text-[8px] font-bold block leading-none font-sans">Volume</span>
                <strong className="text-white text-[11px] font-bold font-sans leading-none mt-0.5 block">{totalQtls.toLocaleString()} Q</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Controls - Sleek & Full Width */}
        <div className="flex items-center gap-1.5 font-sans">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0 flex items-center">
            <Search className="absolute left-2.5 w-3 h-3 text-neutral-400 shrink-0" />
            <input 
              type="text" 
              placeholder="Search Bill #, Mill or Variety..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 bg-neutral-100 dark:bg-neutral-800/80 border-0 rounded-full text-[10.5px] font-medium text-neutral-900 dark:text-white outline-none focus:ring-1 focus:ring-[#C22424]/40 shadow-2xs transition-all placeholder:text-[10.5px] placeholder:text-neutral-400 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Mill Filter Pill - Exact Matching Font */}
          <div className="flex items-center shrink-0 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-full px-2.5 py-0.5 shadow-2xs font-sans">
            <Filter className="w-2.5 h-2.5 text-neutral-400 mr-1.5 shrink-0" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="font-sans antialiased text-neutral-900 dark:text-neutral-100 text-[10.5px] font-bold bg-transparent outline-none cursor-pointer max-w-[95px] xs:max-w-[130px] truncate py-0.5"
            >
              <option value="all" className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-white font-sans">All Mills</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup} className="bg-white dark:bg-[#141414] text-neutral-900 dark:text-white font-sans">{sup}</option>
              ))}
            </select>
          </div>

          {/* Expand / Collapse All */}
          {filteredLines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const isAllExpanded = filteredLines.every(l => expandedCardIds[l.id]);
                if (isAllExpanded) {
                  setExpandedCardIds({});
                } else {
                  const allExpanded: Record<string, boolean> = {};
                  filteredLines.forEach(l => { allExpanded[l.id] = true; });
                  setExpandedCardIds(allExpanded);
                }
              }}
              className="text-[9.5px] font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 cursor-pointer shrink-0 transition-all select-none font-sans"
            >
              {filteredLines.every(l => expandedCardIds[l.id]) ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>

        {/* Card-Based Brokerage Ledger (Ultra-compact Accordion Dropdowns) */}
        {loading ? (
          <div className="py-12 text-center space-y-2 font-sans">
            <span className="w-5 h-5 mx-auto block border-2 border-[#C22424] border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-400 text-[10.5px] font-bold uppercase tracking-wider font-sans">Loading ledger...</p>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-white dark:bg-[#141414] rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#262626] p-5 shadow-xs font-sans">
            <div className="w-8 h-8 bg-red-50 dark:bg-red-950/40 text-[#C22424] rounded-lg flex items-center justify-center border border-red-200">
              <Calculator className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-0.5 max-w-sm">
              <p className="text-xs font-bold text-neutral-900 dark:text-white tracking-tight font-sans">No Brokerage Accruals Found</p>
              <p className="text-neutral-500 dark:text-neutral-400 text-[10.5px] leading-relaxed font-sans">
                No commission entries match your query.
              </p>
            </div>
            {(searchQuery.trim() !== '' || supplierFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSupplierFilter('all'); }}
                className="mt-1 px-2.5 py-0.5 bg-[#C22424] hover:bg-[#A81F1F] text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-2xs font-sans"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 font-sans">
            {filteredLines.map((line) => {
              const isNidhiLine = isNidhiSupplier(line.supplier);
              const isExpanded = !!expandedCardIds[line.id];

              return (
                <div
                  key={line.id}
                  className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl overflow-hidden shadow-2xs hover:border-[#C22424]/40 transition-all text-left font-sans"
                >
                  {/* PREVIEW ROW: Strictly Date, Miller Name, Next to it Amount + Dropdown Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleCard(line.id)}
                    className="w-full px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors select-none font-sans"
                  >
                    {/* Left: Date • Miller Name */}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-sans font-medium shrink-0">
                        {line.date}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700 select-none text-xs leading-none">•</span>
                      <span className="text-[11.5px] sm:text-xs font-bold text-neutral-900 dark:text-white uppercase truncate font-sans">
                        {line.supplier}
                      </span>
                    </div>

                    {/* Right: Next to it, Amount & Dropdown Arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs sm:text-[13px] font-black text-[#C22424] dark:text-[#E05252] font-sans tracking-tight leading-none">
                        ₹ {formatINR(line.commission)}
                      </span>
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-neutral-400 transition-transform duration-200",
                        isExpanded && "rotate-180 text-[#C22424]"
                      )}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>

                  {/* EXPANDED DROPDOWN: Bill No (with Arrival Entry status), Formula, Brand Name + Rice Type, Volume, Rate, Value */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-neutral-100 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#101010] font-sans"
                      >
                        <div className="p-2.5 sm:p-3 space-y-2 text-left font-sans">
                          {/* Row 1: Bill No & Commission Formula */}
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0 font-sans">
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                                Bill No:
                              </span>
                              <span className={cn(
                                "font-sans px-1.5 py-0.5 rounded text-[11px] font-bold border",
                                line.isVerifiedBill 
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                  : "bg-red-50 dark:bg-red-950/40 text-[#C22424] dark:text-[#E05252] border-red-200/60 dark:border-red-900/40"
                              )}>
                                #{line.billNo}
                              </span>
                              {line.isVerifiedBill && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-bold font-sans">
                                  <Check className="w-2.5 h-2.5" />
                                  Arrival Linked
                                </span>
                              )}
                            </div>

                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase font-sans shrink-0",
                              isNidhiLine 
                                ? "bg-red-50 dark:bg-red-950/40 text-[#C22424] dark:text-[#E05252] border border-red-200/50 dark:border-red-900/40" 
                                : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                            )}>
                              {line.formula}
                            </span>
                          </div>

                          {/* Row 2: Commodity Variety (Brand Name + Rice Type) */}
                          <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] flex-wrap font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-neutral-400">Brand:</span>
                              <span className="font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded text-[10.5px]">
                                {line.brand}
                              </span>
                            </div>
                            <span className="text-neutral-300 dark:text-neutral-700 select-none">•</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-neutral-400">Rice Type:</span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {line.riceType}
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Volume, Rate & Total Lot Value Breakdown */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-neutral-200/60 dark:border-neutral-800 text-[10px] font-sans">
                            <div className="bg-white dark:bg-neutral-800/80 p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-700/60">
                              <span className="text-neutral-400 text-[8px] block uppercase font-sans">Volume</span>
                              <strong className="text-neutral-900 dark:text-white font-bold font-sans">{line.qty.toLocaleString()} QTLS</strong>
                            </div>
                            <div className="bg-white dark:bg-neutral-800/80 p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-700/60">
                              <span className="text-neutral-400 text-[8px] block uppercase font-sans">Rate / Q</span>
                              <strong className="text-neutral-900 dark:text-white font-bold font-sans">₹{formatINR(line.rate)}</strong>
                            </div>
                            <div className="bg-white dark:bg-neutral-800/80 p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-700/60">
                              <span className="text-neutral-400 text-[8px] block uppercase font-sans">Lot Value</span>
                              <strong className="text-neutral-900 dark:text-white font-bold font-sans">₹{formatINR(line.value)}</strong>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
