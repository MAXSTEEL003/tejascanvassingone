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
  ArrowRight,
  Calculator
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { auth, getCollectionDocs } from '../lib/firebase';

interface CommissionLine {
  id: string;
  date: string;
  billNo: string;
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  
  const buyerName = localStorage.getItem('userName') || 'V.K FOODS';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch original placed orders and procurement requests
        const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        
        const cloudProcurements = await getCollectionDocs('procurement_requests').catch(() => []);
        const localProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');

        setDbOrders([...cloudPlaced, ...localPlaced]);
        setDbProcurements([...cloudProcurements, ...localProcurements]);
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

  // Compute precise commission items
  const commissionLines = React.useMemo(() => {
    const lines: CommissionLine[] = [];

    merchantOrders.forEach((order: any) => {
      const orderDate = order.date || '12 June, 2026';
      const billNo = order.id || 'N/A';
      
      if (order.originalOrders && Array.isArray(order.originalOrders)) {
        order.originalOrders.forEach((sub: any, subIdx: number) => {
          const qty = parseFloat(sub.qty) || 0;
          const rate = parseFloat(sub.rate) || 0;
          const product = sub.product || 'Grain';
          const supplier = sub.supplier || order.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES';
          const value = qty * rate;
          
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
        const supplier = order.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES';
        
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
  }, [merchantOrders]);

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
        (line.billNo || '').toLowerCase().includes(q) ||
        (line.product || '').toLowerCase().includes(q) ||
        (line.supplier || '').toLowerCase().includes(q);
        
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#030d0a] text-slate-900 dark:text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-5 pb-28 space-y-3.5 sm:space-y-4">
        
        {/* Navigation & Header */}
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
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-serif text-lg sm:text-xl font-normal tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Brokerage Ledger
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Payable settlements for <span className="font-bold text-emerald-800 dark:text-emerald-300">{buyerName}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button 
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white dark:bg-[#051310] border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Print
            </button>
            <button 
              type="button"
              onClick={() => navigate('/placed-orders')}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              Orders Hub
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* PRIMARY FOCUS: COMPACT AMOUNT TO PAY HERO CARD */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-[#041a13] text-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-emerald-700/30 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 bg-emerald-400/15 border border-emerald-400/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                Total Amount to Pay
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                  ₹ {formatINR(totalCommission)}
                </span>
                <span className="text-xs text-emerald-200/70 font-medium">
                  ({filteredLines.length} bill{filteredLines.length === 1 ? '' : 's'})
                </span>
              </div>
            </div>

            {/* Compressed Inline Secondary Breakdown - 3-col responsive */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2.5 sm:pt-0 border-t sm:border-t-0 sm:border-l border-emerald-700/40 sm:pl-5 text-xs">
              <div className="bg-emerald-950/40 sm:bg-transparent rounded-xl p-2 sm:p-0 border border-emerald-500/10 sm:border-0">
                <p className="text-[9.5px] sm:text-[10px] text-emerald-300/70 font-medium leading-tight">Nidhi (1%)</p>
                <p className="font-bold font-mono text-white text-xs sm:text-sm mt-0.5">₹ {formatINR(nidhiCommission)}</p>
              </div>
              <div className="bg-emerald-950/40 sm:bg-transparent rounded-xl p-2 sm:p-0 border border-emerald-500/10 sm:border-0">
                <p className="text-[9.5px] sm:text-[10px] text-emerald-300/70 font-medium leading-tight">Others (₹11/Q)</p>
                <p className="font-bold font-mono text-white text-xs sm:text-sm mt-0.5">₹ {formatINR(otherCommission)}</p>
              </div>
              <div className="bg-emerald-950/40 sm:bg-transparent rounded-xl p-2 sm:p-0 border border-emerald-500/10 sm:border-0">
                <p className="text-[9.5px] sm:text-[10px] text-emerald-300/70 font-medium leading-tight">Total Volume</p>
                <p className="font-bold font-mono text-white text-xs sm:text-sm mt-0.5">{totalQtls.toLocaleString()} Q</p>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal 1-Line Policy Mandate */}
        <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 px-1 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Accrual Policy: ₹11/QTL standard APMC mills • 1.0% invoice for Nidhi Agros.</span>
        </div>

        {/* Filters Controls */}
        <div className="bg-white dark:bg-[#051310] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shadow-2xs">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input 
              type="text" 
              placeholder="Search Bill No, Supplier, or Variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs w-full text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mill:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer flex-1 sm:flex-initial"
            >
              <option value="all">All Mills</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Card-Based Brokerage Ledger (No table, zero horizontal scroll) */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <span className="w-7 h-7 mx-auto block border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Loading ledger entries...</p>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="bg-white dark:bg-[#051310] border border-dashed border-emerald-500/25 rounded-2xl p-8 sm:p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">No Brokerage Accruals Found</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                No commission entries match your search. Active merchant orders will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredLines.map((line) => {
              const isNidhiLine = isNidhiSupplier(line.supplier);
              return (
                <div
                  key={line.id}
                  className="bg-white dark:bg-[#061510] border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3"
                >
                  {/* Top Bar: Bill & Formula */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-neutral-850 pb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md text-xs font-black shrink-0">
                        {line.billNo}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono truncate">
                        {line.date}
                      </span>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono shrink-0",
                      isNidhiLine 
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                    )}>
                      {line.formula}
                    </span>
                  </div>

                  {/* Middle: Mill & Variety */}
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                      {line.supplier}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                      {line.product}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>Volume: <strong className="font-mono text-slate-800 dark:text-slate-200">{line.qty.toLocaleString()} QTLS</strong></span>
                      <span>•</span>
                      <span>Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">₹{formatINR(line.rate)}</strong></span>
                    </div>
                  </div>

                  {/* Bottom: Clear Amount to Pay */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-neutral-850 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount to Pay
                    </span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      ₹ {formatINR(line.commission)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
