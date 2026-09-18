import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Download,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Activity,
  X,
  Building,
  Calendar,
  Check,
  MapPin,
  FileSpreadsheet,
  Inbox,
  RefreshCw,
  Undo2,
  TrendingUp,
  Coins,
  Printer,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  ChevronRight,
  FileText,
  Calculator,
  MessageSquare,
  Truck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection } from '../lib/firebase';
import { PRELOADED_TRANSACTIONS } from '../lib/analyticsEngine';

const BUYER_PROFILES_LOOKUP: Record<string, { email: string; phone: string }> = {
  'G.K.UDYOG': { email: 'hr_hk2005@yahoo.com', phone: '8880088844' },
  'PCB TRADERS': { email: 'pcbtraders@gmail.com', phone: '9844446638' },
  'RAGHURAM ENTERPRISES': { email: 'raghuram.enterprises@gmail.com', phone: '9980137079' },
  'CATER PURE ESSENTIALS PVT LTD': { email: 'info@caterpure.com', phone: '8884135349' },
  'P.V.N ENTERPRISES': { email: 'pvn_ent@yahoo.com', phone: '9916620960' },
  'SRI SIDDALINGESHWARA TRADERS': { email: 'srisiddalinga@yahoo.com', phone: '9060740448' },
  'RICE HOUSE IND.': { email: 'contact@ricehouse.in', phone: '9885231021' },
  'RICE HOUSE IND': { email: 'contact@ricehouse.in', phone: '9885231021' },
  'SELECT MART CORP.': { email: 'procurement@selectmart.co.in', phone: '9120658422' },
  'SELECT MART CORP': { email: 'procurement@selectmart.co.in', phone: '9120658422' },
  'BLUE FIELDS LOGISTICS': { email: 'freight@bluefields.com', phone: '9788112233' },
  'NORTH DELTA TRADING': { email: 'orders@northdelta.in', phone: '9001237890' },
  'VALLEY MILLS CO.': { email: 'valley.mills@gmail.com', phone: '8095112233' },
  'VALLEY MILLS CO': { email: 'valley.mills@gmail.com', phone: '8095112233' },
};

const resolveBuyerProfile = (buyerName: string) => {
  const norm = (buyerName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  try {
    const saved = localStorage.getItem('stakeholders_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const buyers = parsed.buyers || [];
      const matched = buyers.find((b: any) => {
        const bNorm = (b.name || '').trim().toUpperCase()
          .replace(/\s*\(LLC\)/gi, '')
          .replace(/\.$/, '');
        return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
      });
      if (matched) {
        return {
          email: matched.email || `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
          phone: matched.phone || '9845012345'
        };
      }
    }
  } catch (e) {
    console.warn("Error resolving dynamic buyer profile from localStorage:", e);
  }

  if (BUYER_PROFILES_LOOKUP[norm]) return BUYER_PROFILES_LOOKUP[norm];
  for (const k of Object.keys(BUYER_PROFILES_LOOKUP)) {
    if (norm.includes(k) || k.includes(norm)) return BUYER_PROFILES_LOOKUP[k];
  }
  return {
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
    phone: '9845012345'
  };
};

const getPastDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const formatDateToDDMMYYYY = (val: any): string => {
  if (!val) return '';
  let d: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [dd, mm, yyyy] = String(val).split('/');
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else if (/^\d{1,2}-[A-Za-z]+-\d{4}$/i.test(val)) {
    return val;
  } else {
    d = new Date(val);
  }

  if (!isNaN(d.getTime())) {
    const day = d.getDate();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return val;
};

const generateEmptyArrivalRows = (count: number = 100): any[] => {
  return Array(count).fill(0).map((_, i) => ({
    id: `row-empty-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
    date: ''
  }));
};

const generateDefaultArrivalRows = () => {
  return generateEmptyArrivalRows(100);
};

// Memoized table row component for maximum render performance during typing and searching
interface PaymentRowProps {
  txn: any;
  isSelected: boolean;
  onSelect: (txn: any) => void;
  onOpenPayment: (txn: any) => void;
  onReversePayment: (txn: any) => void;
  onGeneratePatti: (txn: any) => void;
}

const PaymentRow = memo(function PaymentRow({ 
  txn, 
  isSelected, 
  onSelect, 
  onOpenPayment, 
  onReversePayment,
  onGeneratePatti
}: PaymentRowProps) {
  
  const isCleared = txn.status === 'Cleared';
  const over60 = txn.daysOutstanding > 60;
  const isShipmentArrived = true; // Arrived Orders view only lists already arrived orders

  return (
    <React.Fragment>
      <tr 
        onClick={() => onSelect(txn)}
        className={cn(
          "interactive-tr border-l-4 group/row cursor-pointer select-none",
          isCleared 
            ? "border-l-emerald-500 hover:border-l-emerald-600 dark:bg-neutral-900/10" 
            : "border-l-amber-500 hover:border-l-amber-600 dark:bg-neutral-900/30"
        )}
      >
        {/* Date Field */}
        <td className="p-4 text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/row:text-primary transition-colors">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span>{formatDateToDDMMYYYY(txn.date)}</span>
          </div>
        </td>

        {/* Bill No (Unconditional for arrived orders) */}
        <td className="p-4 text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
          <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg border border-amber-500/20">
            {txn.billNo || 'N/A'}
          </span>
        </td>

        {/* Trade Partners Details */}
        <td className="p-4">
          <div className="flex flex-col gap-1 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/20">
                Buyer
              </span>
              <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                {txn.buyer}
              </span>
              {txn.isLifted && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[8px] font-black tracking-widest uppercase"
                  title={`Redirected Load${txn.originalBuyer ? ` from ${txn.originalBuyer}` : ''}`}
                >
                  <Truck className="w-3 h-3 text-purple-600 shrink-0" />
                  LIFTED {txn.originalBuyer ? `(ex: ${txn.originalBuyer})` : ''}
                </span>
              )}
              {txn.isDiscrepancy && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[8px] font-black tracking-widest uppercase cursor-help"
                  title={`Reconciliation discrepancy: Ordered ${txn.orderedWeight} QTLS, Arrived ${txn.qty} QTLS`}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                  Diff: {txn.difference > 0 ? '+' : ''}{txn.difference.toFixed(2)} QTLS
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 pl-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Origin:</span>
              <span className="truncate max-w-[220px]">{txn.supplier}</span>
            </div>
          </div>
        </td>

        {/* Net Cost Column */}
        <td className="p-4 text-right">
          <span className="font-black font-mono text-xs text-neutral-900 dark:text-white">
            ₹{formatINR(txn.amount)}
          </span>
        </td>

        {/* Settlement Status Trackers */}
        <td className="p-4">
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
              isCleared 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40'
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isCleared ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
              {isCleared ? 'CLEARED' : 'PENDING'}
            </span>
            {txn.daysOutstanding !== undefined && txn.daysOutstanding > 0 && (
              <span className={cn(
                "text-[9px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded",
                isCleared 
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10" 
                  : over60 
                    ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 font-black animate-pulse" 
                    : "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"
              )}>
                {isCleared 
                  ? `${txn.daysOutstanding}d to settle` 
                  : `${txn.daysOutstanding}d outstanding`
                }
              </span>
            )}
          </div>
        </td>

        {/* Premium Action Buttons */}
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {!isCleared ? (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onOpenPayment(txn); 
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm hover:shadow",
                  isShipmentArrived 
                    ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-500/10" 
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700/50 cursor-not-allowed"
                )}
                title={isShipmentArrived ? "Log settlement payment" : "Locked: Payments can only be collected after the shipment arrives"}
              >
                {isShipmentArrived ? "Log Credit" : "Locked"}
              </button>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); onReversePayment(txn); }}
                className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-neutral-200/50 dark:border-neutral-700/50 inline-flex items-center gap-1"
                title="Mark this transaction back as outstanding"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              onClick={(e) => { 
                e.stopPropagation();
                const buyerProfile = resolveBuyerProfile(txn.buyer);
                const formattedAmt = formatINR(txn.amount);
                const formattedDate = formatDateToDDMMYYYY(txn.date);
                const text = `Hello *${txn.buyer}*,\n\nThis is a friendly payment reminder from *Tejas Canvassing*.\n\n📋 *Outstanding Balance Details*:\n📦 *Bill No*: ${txn.billNo || 'N/A'}\n⚖️ *Quantity*: ${txn.qty} QTLS\n🌾 *Supplier*: ${txn.supplier}\n📅 *Arrival Date*: ${formattedDate}\n⏳ *Outstanding*: ${txn.daysOutstanding} Days\n\n💰 *Total Outstanding Amount*: *₹${formattedAmt}*\n\nPlease process this payment as soon as possible. Thank you for your continued partnership!\n\nBest regards,\n*Tejas Canvassing*`;
                const waUrl = `https://api.whatsapp.com/send?phone=91${buyerProfile.phone}&text=${encodeURIComponent(text)}`;
                window.open(waUrl, '_blank');
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer border border-transparent"
              title="Send pending payment details via WhatsApp to buyer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onGeneratePatti(txn); 
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/10"
            >
              <Calculator className="w-3.5 h-3.5" />
              Patti
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable Digital Ledger Receipt Paper */}
      <AnimatePresence>
        {isSelected && (
          <tr>
            <td colSpan={6} className="p-0 bg-neutral-50/50 dark:bg-neutral-950/10">
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-5 md:p-8">
                  {/* Digital Document Receipt Layout */}
                  <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xl max-w-3xl mx-auto overflow-hidden">
                    
                    {/* Approved Watermark Stamp */}
                    <div className="absolute right-6 top-24 pointer-events-none select-none z-10 origin-center rotate-12 opacity-15 dark:opacity-20">
                      <div className={cn(
                        "border-4 border-dashed px-4 py-2 font-mono text-xs font-black uppercase rounded-xl tracking-widest",
                        isCleared ? "border-emerald-600 text-emerald-600" : "border-amber-600 text-amber-600"
                      )}>
                        {isCleared ? 'LEDGER APPROVED • CR' : 'LEDGER PENDING • DEB'}
                        <div className="text-[8px] text-center mt-1">GRAIN SECURE OS</div>
                      </div>
                    </div>

                    {/* Receipt Tear Border effect at top */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-800 to-transparent flex" />

                    {/* Receipt Content Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 pb-6 border-b border-dashed border-neutral-200 dark:border-neutral-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
                            Arrived Cargo & Ledger
                          </span>
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">Invoice: {txn.id}</span>
                        </div>
                        <h4 className="text-base font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-primary shrink-0" />
                          Official Trade Dispatch Statement
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Authorized contract bill generated under official grain procurement and agricultural clearance codes.
                        </p>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">Audit Date</span>
                        <span className="text-xs font-extrabold text-neutral-700 dark:text-neutral-300 font-mono">{formatDateToDDMMYYYY(txn.date)}</span>
                      </div>
                    </div>

                    {/* Ledger Financial Summary Table */}
                    <div className="py-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-950/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
                          <h5 className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Trade Partner Details</h5>
                          <div className="text-xs space-y-1">
                            <p className="text-neutral-600 dark:text-neutral-400">
                              Buyer Party Name: <strong className="text-neutral-800 dark:text-neutral-200 uppercase font-black">{txn.buyer}</strong>
                            </p>
                            <p className="text-neutral-600 dark:text-neutral-400">
                              Origin Supplier: <strong className="text-neutral-800 dark:text-neutral-200 font-bold">{txn.supplier}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-neutral-50 dark:bg-neutral-950/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
                          <h5 className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Logistics Mapping</h5>
                          <div className="text-xs space-y-1">
                            {txn.isArrival ? (
                              <>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                  Delivery Hub: <strong className="text-neutral-800 dark:text-neutral-200">{txn.place || 'Punjab Trade Hub'}</strong>
                                </p>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                  Specific Shop/Yard: <strong className="text-neutral-800 dark:text-neutral-200">{txn.area || 'Platform Yard B'}</strong>
                                </p>
                              </>
                            ) : (
                              <p className="text-neutral-500 italic">Advanced cargo dispatch. Pre-arrival contract documentation validated.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line Item Bill Receipt styling */}
                      <div className="bg-neutral-50 dark:bg-neutral-950/30 rounded-2xl border border-neutral-150 dark:border-neutral-800/80 p-5 font-mono text-xs space-y-3">
                        <div className="flex justify-between font-black pb-2 border-b border-neutral-200 dark:border-neutral-800">
                          <span>ITEM / VOL DETAILS</span>
                          <span>RATE</span>
                          <span className="text-right">TOTAL</span>
                        </div>
                        
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                          <span>
                            {txn.qty ? `${txn.qty} QTL` : '1 Batch'} • Grain Brand Cargo
                          </span>
                          <span>
                            {txn.rate ? `₹${formatINR(txn.rate)}/QTL` : 'Flat Contract'}
                          </span>
                          <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                            ₹{formatINR(txn.qty * (txn.rate || 0) || txn.amount)}
                          </span>
                        </div>

                        {txn.shortage > 0 && (
                          <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                            <span>Less: Weight Shortage Deduction</span>
                            <span>-</span>
                            <span>- ₹{formatINR(txn.shortage)}</span>
                          </div>
                        )}

                        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex justify-between font-black text-sm text-neutral-800 dark:text-neutral-100">
                          <span>NET RECIEVED SETTLEMENT</span>
                          <span className="text-right text-primary font-bold">
                            ₹{formatINR(txn.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Ledger clearance report section */}
                      {isCleared ? (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none">Bank Settlement Approved</p>
                              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-1">
                                Electronic Transfer cleared in <strong className="text-emerald-600">{txn.daysOutstanding} Days</strong>
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-xs font-mono space-y-1 text-right border-t sm:border-t-0 sm:border-l border-emerald-250 dark:border-emerald-900/10 pt-2 sm:pt-0 sm:pl-4">
                            <p className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider leading-none">UTR / Ref Number</p>
                            <p className="font-extrabold text-neutral-800 dark:text-neutral-200 leading-tight">{txn.chqNo || 'RTGS-994855'}</p>
                            {txn.bank && <p className="text-[9px] text-neutral-400 font-semibold">{txn.bank}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/10 rounded-2xl border border-rose-100 dark:border-rose-950/30 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/20 flex items-center justify-center text-rose-500 shrink-0">
                            <Clock className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest leading-none">Awaiting Settlement</p>
                            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-1">
                              This cargo dispatch has remained unpaid for <strong className="text-rose-600 font-extrabold">{txn.daysOutstanding} Days</strong> since delivery.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Mock Barcode generated via clean custom CSS stripes */}
                      <div className="pt-4 flex flex-col items-center justify-center gap-1.5 opacity-60">
                        <div className="flex items-center gap-[1px] h-8 max-w-xs justify-center shrink-0">
                          {Array(42).fill(0).map((_, bIdx) => {
                            const widths = [1, 2, 3, 4];
                            const randomWidth = widths[(bIdx + (txn.id.charCodeAt(0) || bIdx)) % widths.length];
                            const isGap = bIdx % 3 === 0 && bIdx % 5 !== 0;
                            return (
                              <div 
                                key={bIdx} 
                                className="bg-neutral-800 dark:bg-neutral-200 h-full rounded-sm"
                                style={{ width: isGap ? '0.5px' : `${randomWidth}px`, opacity: isGap ? 0 : 1 }} 
                              />
                            );
                          })}
                        </div>
                        <span className="text-[8px] font-mono tracking-widest text-neutral-400 dark:text-neutral-500 uppercase uppercase">
                          SECURE-TRADE-AUTH-CERTIFIER-{txn.id}
                        </span>
                      </div>
                    </div>

                    {/* Receipt Footer Action */}
                    <div className="pt-4 border-t border-dashed border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                      <span className="text-[9px] text-neutral-400 uppercase font-mono">Digitally Audited Ledger OS</span>
                      <button 
                        onClick={() => window.print()}
                        className="h-8 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Document
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </React.Fragment>
  );
});

export default function PaymentTracking() {
  const navigate = useNavigate();
  const [arrivalRows, setArrivalRows] = useState<any[]>([]);
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cleared' | 'discrepancy' | 'lifted'>('all');
  const [warningAlert, setWarningAlert] = useState<string | null>(null);
  
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    bank: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    shortage: '0',
    method: 'RTGS',
    refNo: '',
    discountPercent: 0,
    discountAmount: '0'
  });

  // Calculate pending days for an arrival record on-the-fly
  const calculatePendingDays = useCallback((row: any) => {
    if (!row || !row.date) return 0;
    const isCleared = row.noOfDayRec === 'Cleared';
    const arrDate = new Date(row.date);
    if (isNaN(arrDate.getTime())) return 0;
    
    arrDate.setHours(0, 0, 0, 0);
    
    if (isCleared && row.chqDt) {
      const chqDate = new Date(row.chqDt);
      if (!isNaN(chqDate.getTime())) {
        chqDate.setHours(0, 0, 0, 0);
        const diffTime = chqDate.getTime() - arrDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays : 0;
      }
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - arrDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }, []);

  const loadData = async () => {
    setCloudStatus('syncing');
    try {
      // 1. Fetch live and local placed orders
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      const combinedPlaced = [...localPlaced, ...cloudPlaced];
      const uniquePlaced = Array.from(new Map(combinedPlaced.map(item => [item.id, item])).values());
      setPlacedOrders(uniquePlaced);

      // 2. Fetch live and local arrival entries
      const localArrival = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      const cloudArrival = await getCollectionDocs('arrival_entries').catch(() => []);
      
      let finalArrival = [...localArrival];
      if (cloudArrival && cloudArrival.length > 0) {
        // Build fully-filled Excel 30-row structure or maintain cloud rows size
        const grid = Array(Math.max(30, cloudArrival.length, localArrival.length)).fill(0).map((_, i) => {
          return localArrival[i] || { date: new Date().toISOString().split('T')[0] };
        });
        
        cloudArrival.forEach(row => {
          const idx = parseInt(row.id.replace('row-', ''));
          if (!isNaN(idx) && idx >= 0) {
            const { id, ...cloudRow } = row;
            const localRow = grid[idx];
            
            // Only overwrite local with cloud if cloud has real data and is newer, or if local is empty/unset
            const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
            const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));
            const isCloudDummy = cloudRow.billNo === '1042';

            let shouldOverwrite = false;
            if (isCloudDummy) {
              shouldOverwrite = false;
            } else if (!isLocalReal && isCloudReal) {
              shouldOverwrite = true;
            } else if (isLocalReal && isCloudReal) {
              const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
              const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
              if (cloudTime > localTime || !localRow.lastUpdated) {
                shouldOverwrite = true;
              }
            } else if (!isLocalReal && !isCloudReal) {
              shouldOverwrite = true;
            }

            if (shouldOverwrite) {
              grid[idx] = cloudRow;
            }
          }
        });
        finalArrival = grid;
      }

      const hasDummy = finalArrival.some(row => row && row.billNo === '1042');
      if (hasDummy) {
        finalArrival = generateEmptyArrivalRows(100);
        localStorage.setItem('arrival_entry_data_v4', JSON.stringify(finalArrival));
      }

      setArrivalRows(finalArrival);
      setCloudStatus('synced');
    } catch (err) {
      console.error("Failed to load pipeline records:", err);
      setCloudStatus('error');
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    
    // Command palette listen event
    const handleGotoArrival = () => {
      loadData();
    };
    window.addEventListener('goto-arrival-event', handleGotoArrival);
    
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('goto-arrival-event', handleGotoArrival);
    };
  }, []);

  // Filter and map contract & physical orders - Arrived Orders entered in the Arrival Entry database
  const contractTxns = useMemo(() => {
    const orderByIdMap = new Map<string, any>();
    const orderByBillMap = new Map<string, any>();
    placedOrders.forEach((p: any) => {
      if (!p) return;
      if (p.id) orderByIdMap.set(String(p.id).trim(), p);
      if (p.billNo) orderByBillMap.set(String(p.billNo).trim().toLowerCase(), p);
    });

    return arrivalRows
      .map((row, index) => {
        // Filter out empty Excel spacer lines
        if (!row || (!row.partyName && !row.millerName && !row.billNo && !row.qty)) {
          return null;
        }

        // Fast lookup for matching placed order
        let matchingOrder: any = null;
        if (row.purchaseOrderNo) {
          matchingOrder = orderByIdMap.get(String(row.purchaseOrderNo).trim());
        }
        if (!matchingOrder && row.billNo) {
          matchingOrder = orderByBillMap.get(String(row.billNo).trim().toLowerCase());
        }
        if (!matchingOrder) {
          const rowParty = String(row.partyName || '').toLowerCase().trim();
          const rowMiller = String(row.millerName || '').toLowerCase().trim();
          if (rowParty && rowMiller) {
            matchingOrder = placedOrders.find((p: any) => {
              if (!p) return false;
              const orderBuyer = String(p.buyer || '').toLowerCase().trim();
              const orderSupplier = String(p.supplier || '').toLowerCase().trim();
              return orderBuyer && orderSupplier &&
                (rowParty.includes(orderBuyer) || orderBuyer.includes(rowParty)) &&
                (rowMiller.includes(orderSupplier) || orderSupplier.includes(rowMiller));
            });
          }
        }

        const calculatedNet = parseFloat(row.netAmt) || parseFloat(row.amount) || ((parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0)) || 0;
        const hasAnyChqDetail = 
          (row.chqAm && parseFloat(row.chqAm) > 0) ||
          (row.chqNo && String(row.chqNo).trim() !== '') ||
          (row.chqDt && String(row.chqDt).trim() !== '') ||
          (row.bank && String(row.bank).trim() !== '');

        const isCleared = row.noOfDayRec === 'Cleared' || 
                          hasAnyChqDetail || 
                          (matchingOrder && (matchingOrder.paymentStatus === 'Received' || matchingOrder.paymentStatus === 'Settled'));
        const daysCount = calculatePendingDays(row);

        const rawBill = row.billNo || matchingOrder?.billNo || '';
        const cleanedBill = String(rawBill).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '');
        const finalBill = cleanedBill || 'N/A';

        // WEIGHT RECONCILIATION CALCULATION
        let orderedWeight = 0;
        let isDiscrepancy = false;
        let discrepancyType: 'none' | 'shortage' | 'excess' = 'none';
        let difference = 0;

        if (matchingOrder) {
          if (matchingOrder.originalOrders && matchingOrder.originalOrders.length > 0) {
            // Find sub-order with matching buyer
            const subOrder = matchingOrder.originalOrders.find((sub: any) => {
              const rowParty = String(row.partyName || '').toLowerCase().trim();
              const subBuyer = String(sub.buyer || '').toLowerCase().trim();
              return rowParty === subBuyer || rowParty.includes(subBuyer) || subBuyer.includes(rowParty);
            });
            if (subOrder) {
              orderedWeight = parseFloat(subOrder.qty) || parseFloat(subOrder.totalQty) || 0;
            } else {
              orderedWeight = (parseFloat(matchingOrder.qty) || parseFloat(matchingOrder.totalQty) || 0) / matchingOrder.originalOrders.length;
            }
          } else {
            orderedWeight = parseFloat(matchingOrder.qty) || parseFloat(matchingOrder.totalQty) || 0;
          }

          const arrivedWeight = parseFloat(row.qty) || 0;
          if (orderedWeight > 0 && Math.abs(arrivedWeight - orderedWeight) > 0.01) {
            isDiscrepancy = true;
            difference = arrivedWeight - orderedWeight;
            discrepancyType = difference < 0 ? 'shortage' : 'excess';
          }
        }

        const isLifted = !!(
          (matchingOrder && matchingOrder.liftingRecords && matchingOrder.liftingRecords.length > 0) ||
          (matchingOrder && (matchingOrder.currentShop || matchingOrder.redirectedShop)) ||
          (row && (row.billNo?.includes('-LFT') || row.billNo?.startsWith('LFT-') || row.isLifted || row.redirectedTo))
        );
        const liftingRecord = matchingOrder?.liftingRecords?.[0] || null;

        // Redirected shop / new buyer name
        const redirectedShop = liftingRecord?.shopName || matchingOrder?.currentShop || matchingOrder?.redirectedShop || row?.redirectedTo || (row?.isLifted && row?.partyName ? row.partyName : null);
        
        // Original buyer before lifting
        const originalBuyer = liftingRecord?.originalBuyer || row?.originalBuyer || (matchingOrder?.buyer && matchingOrder.buyer !== redirectedShop ? matchingOrder.buyer : (row?.partyName !== redirectedShop ? row?.partyName : ''));

        // Primary buyer name to collect payment from
        const resolvedBuyer = isLifted && redirectedShop ? redirectedShop : (row?.partyName || matchingOrder?.buyer || 'Not Assigned');

        return {
          id: matchingOrder?.id || (row.purchaseOrderNo ? String(row.purchaseOrderNo) : null) || (cleanedBill ? cleanedBill : `ARR-${index + 1001}`),
          originalIndex: index,
          isArrival: true,
          date: row.date || matchingOrder?.date || new Date().toISOString().split('T')[0],
          billNo: finalBill,
          buyer: resolvedBuyer,
          supplier: row.millerName || matchingOrder?.supplier || 'Not Assigned',
          place: row.place || matchingOrder?.address || '',
          area: row.area || '',
          amount: calculatedNet,
          qty: parseFloat(row.qty) || 0,
          rate: parseFloat(row.rate) || 0,
          shortage: parseFloat(row.shortage) || 0,
          chqAm: parseFloat(row.chqAm) || 0,
          chqNo: row.chqNo || '',
          chqDt: row.chqDt || '',
          bank: row.bank || '',
          status: isCleared ? 'Cleared' : 'Awaiting Settlement',
          daysOutstanding: daysCount,
          rawRow: row,
          matchingArrival: row,
          rawOrder: matchingOrder || null,
          orderedWeight,
          isDiscrepancy,
          discrepancyType,
          difference,
          isLifted,
          liftingRecord,
          originalBuyer,
          redirectedShop
        };
      })
      .filter((txn): txn is any => txn !== null);
  }, [placedOrders, arrivalRows, calculatePendingDays]);

  const overdueTxns = useMemo(() => {
    return contractTxns.filter(txn => txn.status !== 'Cleared' && txn.daysOutstanding > 60);
  }, [contractTxns]);

  // Aggregate Operational Multi-Metrics
  const financialSummary = useMemo(() => {
    let pendingAmt = 0;
    let clearedAmt = 0;
    let totalAmt = 0;
    let discrepancyCount = 0;
    let totalDifference = 0;

    contractTxns.forEach(txn => {
      totalAmt += txn.amount;
      if (txn.status === 'Cleared') {
        clearedAmt += txn.amount;
      } else {
        pendingAmt += txn.amount;
      }
      if (txn.isDiscrepancy) {
        discrepancyCount++;
        totalDifference += Math.abs(txn.difference);
      }
    });

    return {
      pendingAmt,
      clearedAmt,
      totalAmt,
      discrepancyCount,
      totalDifference
    };
  }, [contractTxns]);

  const liftedSummary = useMemo(() => {
    let pendingAmt = 0;
    let clearedAmt = 0;
    let totalAmt = 0;
    let count = 0;

    contractTxns.forEach(txn => {
      if (txn.isLifted) {
        count++;
        totalAmt += txn.amount;
        if (txn.status === 'Cleared') {
          clearedAmt += txn.amount;
        } else {
          pendingAmt += txn.amount;
        }
      }
    });

    return { count, pendingAmt, clearedAmt, totalAmt };
  }, [contractTxns]);

  // Handle fuzzy searching and quick filters with memoization
  const filteredTxns = useMemo(() => {
    const currentList = contractTxns;
    
    const parseCustomDate = (obj: any): number => {
      if (!obj) return 0;
      const dateStr = obj.purchaseOrderSentAt || obj.createdAt || obj.date;
      if (!dateStr) return 0;
      if (typeof dateStr === 'number') return dateStr;
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      return 0;
    };

    const filtered = currentList.filter(txn => {
      // 1. Text Searching filter
      const query = searchQuery.toLowerCase().trim();
      const matchText = query === '' || 
        txn.buyer.toLowerCase().includes(query) ||
        txn.supplier.toLowerCase().includes(query) ||
        txn.id.toLowerCase().includes(query) ||
        (txn.place && txn.place.toLowerCase().includes(query)) ||
        (txn.area && txn.area.toLowerCase().includes(query)) ||
        (txn.originalBuyer && txn.originalBuyer.toLowerCase().includes(query));

      if (!matchText) return false;

      // 2. Status Category filter
      if (statusFilter === 'pending') {
        return txn.status !== 'Cleared';
      }
      if (statusFilter === 'cleared') {
        return txn.status === 'Cleared';
      }
      if (statusFilter === 'discrepancy') {
        return txn.isDiscrepancy;
      }
      if (statusFilter === 'lifted') {
        return txn.isLifted;
      }

      return true;
    });

    return [...filtered].sort((a: any, b: any) => {
      const timeA = parseCustomDate(a);
      const timeB = parseCustomDate(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [contractTxns, searchQuery, statusFilter]);

  const handleGeneratePatti = useCallback((txn: any) => {
    // 1. Get the underlying arrival entry (either from txn.rawRow if it is an arrival entry, or txn.matchingArrival if it is a contract order)
    const arrival = txn.isArrival ? txn.rawRow : txn.matchingArrival;
    
    // Helper function to dynamically check and match column keys of the arrival entry row
    const getArrivalValue = (possibleKeys: string[], fallback: string = ''): string => {
      if (!arrival) return fallback;
      for (const key of possibleKeys) {
        if (key in arrival && arrival[key] !== null && arrival[key] !== undefined) {
          return String(arrival[key]);
        }
      }
      return fallback;
    };

    // 2. Perform exact & alias structural matching between arrival columns and Patti form fields
    const millerName = getArrivalValue(['millerName', 'miller', 'supplier'], txn.supplier || '');
    const partyName = getArrivalValue(['partyName', 'party', 'buyer'], txn.buyer || '');
    const arrivalDt = getArrivalValue(['date', 'arrivalDt', 'arrival_date'], txn.date || '');
    const rateQty = getArrivalValue(['qty', 'rateQty', 'quantity'], String(txn.qty || '100'));
    const rateRate = getArrivalValue(['rate', 'rateRate', 'price'], String(txn.rate || '4200'));
    
    // Deductions & Charges matching columns:
    const lorrySmall = getArrivalValue(['lh', 'lorrySmall', 'lorry_hire', 'freight'], '0');
    const sellerCom = getArrivalValue(['cc', 'sellerCom', 'commission'], '0');
    const discountAmount = getArrivalValue(['tds', 'discountAmount', 'discount'], '0');
    const manualShortage = getArrivalValue(['shortage', 'manualShortage', 'shortage_val'], '0');
    const qDiff = getArrivalValue(['diffIn', 'qDiff', 'diff_in', 'quality_difference'], '0');
    
    // Total gross calculation matching original amount
    const qtyNum = parseFloat(rateQty) || 0;
    const rateNum = parseFloat(rateRate) || 0;
    const computedAmount = qtyNum * rateNum;
    const rateAmount = getArrivalValue(['amount', 'rateAmount', 'total'], computedAmount.toFixed(2));
    
    // 3. Mathematical Alignment: Calculate dynamic discountPct such that the dynamic computation computes the exact same TDS amount
    const amtForDiscount = parseFloat(rateAmount) || computedAmount || 1;
    const tdsVal = parseFloat(discountAmount) || 0;
    const computedPct = amtForDiscount > 0 ? (tdsVal / amtForDiscount) : 0;
    
    // Settlement options
    const chqAm = getArrivalValue(['chqAm', 'chq_am', 'cheque_amount', 'chequeAmount'], '0');
    const chqNo = getArrivalValue(['chqNo', 'chq_no', 'cheque_no', 'chequeNumber'], '');
    const chqDt = getArrivalValue(['chqDt', 'chq_dt', 'cheque_date', 'chequeDate'], '');
    const bank = getArrivalValue(['bank', 'bank_name'], '');
    const billNumber = getArrivalValue(['billNo', 'bill_no', 'billNo', 'billNumber'], txn.billNo || '');

    // 4. Recount summary items for explicit client-side sync
    const expensesSumVal = (parseFloat(lorrySmall) || 0) + 
                           tdsVal + 
                           (parseFloat(sellerCom) || 0) + 
                           (parseFloat(manualShortage) || 0) + 
                           (parseFloat(qDiff) || 0);

    const netAmountVal = amtForDiscount - expensesSumVal;

    // Prefill object directly matched by column structures
    const prefill = {
      millerName,
      partyName,
      arrivalDt,
      rateQty,
      rateRate,
      rateAmount: rateAmount || String(computedAmount.toFixed(2)),
      lorrySmall,
      discountPct: String(computedPct.toFixed(6)), // Use 6 decimals of precision to get exact percentage mapping
      discountAmount: String(tdsVal),
      sellerCom,
      manualShortage,
      qDiff,
      expensesSum: String(expensesSumVal.toFixed(2)),
      netAmount: String(netAmountVal.toFixed(2)),
      chqAm,
      chqNo,
      chqDt,
      bank,
      remarks: `Matched Column Patti ledger generated from Entry: ${txn.id}`,
      billNo: billNumber ? [billNumber, '', '', '', '', '', '', ''] : ['', '', '', '', '', '', '', ''],
      billNumber
    };

    localStorage.setItem('patti_prefill', JSON.stringify(prefill));
    navigate('/patti');
  }, [navigate]);

  // Handler functions wrapped in useCallback to keep memoizations of PaymentTable rows stable
  const handleOpenPaymentModal = useCallback((txn: any) => {
    const isShipmentArrived = txn.isArrival || (txn.rawOrder && txn.rawOrder.status === 'Arrived');
    if (!isShipmentArrived) {
      setWarningAlert(`Payment collection for ${txn.id} is blocked. Payments can only be collected/logged after the cargo shipment is marked as Arrived on the Placed Orders page.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Shortage is removed as the pending quantity will later arrive
    const autoShortageVal = 0;

    // Auto-select discount percentage based on credit timeline (Outstanding Days)
    const defaultDiscountPercent = txn.daysOutstanding <= 14 ? 4
                                 : txn.daysOutstanding <= 21 ? 3
                                 : txn.daysOutstanding <= 30 ? 2
                                 : txn.daysOutstanding <= 45 ? 1
                                 : 0;

    const defaultDiscountAmount = Math.round((txn.amount * defaultDiscountPercent) / 100);
    const initialNetAmount = Math.max(0, txn.amount - defaultDiscountAmount);

    setWarningAlert(null);
    setSelectedTxn(txn);
    setPaymentData({
      bank: txn.bank || '',
      date: txn.chqDt || new Date().toISOString().split('T')[0],
      amount: String(initialNetAmount),
      shortage: '0',
      method: 'RTGS',
      refNo: txn.chqNo || '',
      discountPercent: defaultDiscountPercent,
      discountAmount: String(defaultDiscountAmount)
    });
    setShowPaymentModal(true);
  }, []);

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxn) return;

    setCloudStatus('syncing');

    try {
      const shortageVal = parseFloat(paymentData.shortage) || 0;
      const ccVal = parseFloat(paymentData.discountAmount) || 0;

      if (selectedTxn.isArrival) {
        // 1. Direct Physical Shipment update in arrivalRows
        const originalIndex = selectedTxn.originalIndex;
        if (originalIndex !== undefined && originalIndex !== null && originalIndex >= 0) {
          const updatedGrid = [...arrivalRows];
          const currentAmt = parseFloat(updatedGrid[originalIndex].amount) || 0;
          const currentLh = parseFloat(updatedGrid[originalIndex].lh) || 0;
          const currentTds = parseFloat(updatedGrid[originalIndex].tds) || 0;
          const currentDiffIn = parseFloat(updatedGrid[originalIndex].diffIn) || 0;

          updatedGrid[originalIndex] = {
            ...updatedGrid[originalIndex],
            noOfDayRec: 'Cleared',
            chqAm: parseFloat(paymentData.amount) || selectedTxn.amount,
            chqNo: paymentData.refNo || '',
            chqDt: paymentData.date,
            bank: paymentData.bank,
            shortage: shortageVal,
            cc: ccVal,
            netAmt: (currentAmt - currentLh - ccVal - currentTds - shortageVal - currentDiffIn - (parseFloat(paymentData.amount) || selectedTxn.amount)).toFixed(2),
            lastUpdated: Date.now()
          };
          updatedGrid[originalIndex].noOfDays = calculatePendingDays(updatedGrid[originalIndex]);

          setArrivalRows(updatedGrid);
          localStorage.setItem('arrival_entry_data_v4', JSON.stringify(updatedGrid));
          await syncCollection('arrival_entries', updatedGrid).catch(() => {});
        }

        // 2. Also keep matching placed order in lockstep if it exists
        const matchingPlaced = placedOrders.find(p => {
          if (selectedTxn.rawRow?.purchaseOrderNo && String(p.id).trim() === String(selectedTxn.rawRow.purchaseOrderNo).trim()) return true;
          if (selectedTxn.billNo && p.billNo && String(p.billNo).trim().toLowerCase() === String(selectedTxn.billNo).trim().toLowerCase()) return true;
          return false;
        });

        if (matchingPlaced) {
          const updatedPlaced = placedOrders.map((p: any) => {
            if (p.id === matchingPlaced.id) {
              return {
                ...p,
                paymentStatus: 'Received',
                paymentDetails: {
                  bank: paymentData.bank,
                  date: paymentData.date,
                  amount: parseFloat(paymentData.amount),
                  method: paymentData.method,
                  refNo: paymentData.refNo,
                  shortage: shortageVal,
                  discountAmount: ccVal,
                  discountPercent: paymentData.discountPercent
                }
              };
            }
            return p;
          });
          setPlacedOrders(updatedPlaced);
          localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
          await syncCollection('placed_orders', updatedPlaced).catch(() => {});
        }
      } else {
        // 1. Placed order batch payout update
        const updatedPlaced = placedOrders.map((p: any) => {
          if (p.id === selectedTxn.id) {
            return {
              ...p,
              paymentStatus: 'Received',
              paymentDetails: {
                bank: paymentData.bank,
                date: paymentData.date,
                amount: parseFloat(paymentData.amount),
                method: paymentData.method,
                refNo: paymentData.refNo,
                shortage: shortageVal,
                discountAmount: ccVal,
                discountPercent: paymentData.discountPercent
              }
            };
          }
          return p;
        });

        setPlacedOrders(updatedPlaced);
        localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
        await syncCollection('placed_orders', updatedPlaced).catch(() => {});

        // 2. Also keep matching arrival entry row in lockstep if it exists
        if (selectedTxn.matchingArrival) {
          const matchingIndex = arrivalRows.findIndex(row => {
            if (!row) return false;
            if (row.purchaseOrderNo && String(row.purchaseOrderNo).trim() === String(selectedTxn.id).trim()) return true;
            if (row.billNo && selectedTxn.billNo && String(row.billNo).trim().toLowerCase() === String(selectedTxn.billNo).trim().toLowerCase()) return true;
            return false;
          });

          if (matchingIndex !== -1) {
            const updatedGrid = [...arrivalRows];
            const currentAmt = parseFloat(updatedGrid[matchingIndex].amount) || 0;
            const currentLh = parseFloat(updatedGrid[matchingIndex].lh) || 0;
            const currentTds = parseFloat(updatedGrid[matchingIndex].tds) || 0;
            const currentDiffIn = parseFloat(updatedGrid[matchingIndex].diffIn) || 0;

            updatedGrid[matchingIndex] = {
              ...updatedGrid[matchingIndex],
              noOfDayRec: 'Cleared',
              chqAm: parseFloat(paymentData.amount) || selectedTxn.amount,
              chqNo: paymentData.refNo || '',
              chqDt: paymentData.date,
              bank: paymentData.bank,
              shortage: shortageVal,
              cc: ccVal,
              netAmt: (currentAmt - currentLh - ccVal - currentTds - shortageVal - currentDiffIn - (parseFloat(paymentData.amount) || selectedTxn.amount)).toFixed(2),
              lastUpdated: Date.now()
            };
            updatedGrid[matchingIndex].noOfDays = calculatePendingDays(updatedGrid[matchingIndex]);

            setArrivalRows(updatedGrid);
            localStorage.setItem('arrival_entry_data_v4', JSON.stringify(updatedGrid));
            await syncCollection('arrival_entries', updatedGrid).catch(() => {});
          }
        }
      }

      window.dispatchEvent(new Event('storage'));
      setShowPaymentModal(false);
      setSelectedTxn(null);
      setCloudStatus('synced');
    } catch (err) {
      console.error("Error confirming payment:", err);
      setCloudStatus('error');
    }
  };

  const handleReversePayment = useCallback(async (txn: any) => {
    if (!txn) return;
    setCloudStatus('syncing');

    try {
      if (txn.isArrival) {
        // 1. Direct Physical Shipment payment reversal in arrivalRows
        const originalIndex = txn.originalIndex;
        if (originalIndex !== undefined && originalIndex !== null && originalIndex >= 0) {
          const updatedGrid = [...arrivalRows];
          updatedGrid[originalIndex] = {
            ...updatedGrid[originalIndex],
            noOfDayRec: 'Not Cleared',
            chqAm: '',
            chqNo: '',
            chqDt: '',
            bank: '',
            lastUpdated: Date.now()
          };
          updatedGrid[originalIndex].noOfDays = calculatePendingDays(updatedGrid[originalIndex]);

          setArrivalRows(updatedGrid);
          localStorage.setItem('arrival_entry_data_v4', JSON.stringify(updatedGrid));
          await syncCollection('arrival_entries', updatedGrid).catch(() => {});
        }

        // 2. Also reverse matching placed order payment in lockstep if it exists
        const matchingPlaced = placedOrders.find(p => {
          if (txn.rawRow?.purchaseOrderNo && String(p.id).trim() === String(txn.rawRow.purchaseOrderNo).trim()) return true;
          if (txn.billNo && p.billNo && String(p.billNo).trim().toLowerCase() === String(txn.billNo).trim().toLowerCase()) return true;
          return false;
        });

        if (matchingPlaced) {
          const updatedPlaced = placedOrders.map((p: any) => {
            if (p.id === matchingPlaced.id) {
              return {
                ...p,
                paymentStatus: 'Awaiting Settlement',
                paymentDetails: undefined
              };
            }
            return p;
          });
          setPlacedOrders(updatedPlaced);
          localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
          await syncCollection('placed_orders', updatedPlaced).catch(() => {});
        }
      } else {
        // 1. Reverse Placed Order Payment
        const updatedPlaced = placedOrders.map((p: any) => {
          if (p.id === txn.id) {
            return {
              ...p,
              paymentStatus: 'Awaiting Settlement',
              paymentDetails: undefined
            };
          }
          return p;
        });

        setPlacedOrders(updatedPlaced);
        localStorage.setItem('placed_orders', JSON.stringify(updatedPlaced));
        await syncCollection('placed_orders', updatedPlaced).catch(() => {});

        // 2. Reverse Matching Arrival Entry
        if (txn.matchingArrival) {
          const matchingIndex = arrivalRows.findIndex(row => {
            if (!row) return false;
            if (row.purchaseOrderNo && String(row.purchaseOrderNo).trim() === String(txn.id).trim()) return true;
            if (row.billNo && txn.billNo && String(row.billNo).trim().toLowerCase() === String(txn.billNo).trim().toLowerCase()) return true;
            return false;
          });

          if (matchingIndex !== -1) {
            const updatedGrid = [...arrivalRows];
            updatedGrid[matchingIndex] = {
              ...updatedGrid[matchingIndex],
              noOfDayRec: 'Not Cleared',
              chqAm: '',
              chqNo: '',
              chqDt: '',
              bank: '',
              lastUpdated: Date.now()
            };
            updatedGrid[matchingIndex].noOfDays = calculatePendingDays(updatedGrid[matchingIndex]);

            setArrivalRows(updatedGrid);
            localStorage.setItem('arrival_entry_data_v4', JSON.stringify(updatedGrid));
            await syncCollection('arrival_entries', updatedGrid).catch(() => {});
          }
        }
      }

      window.dispatchEvent(new Event('storage'));
      setSelectedTxn(null);
      setCloudStatus('synced');
    } catch (err) {
      console.error("Error reversing payment status:", err);
      setCloudStatus('error');
    }
  }, [arrivalRows, placedOrders, calculatePendingDays]);

  const toggleRowSelected = useCallback((txn: any) => {
    setSelectedTxn((prev: any) => (prev?.id === txn.id ? null : txn));
  }, []);

  const exportCurrentPipeline = () => {
    const headers = [
      "DATE",
      "BILL/TXN ID",
      "BUYER NAME (PARTY)",
      "SUPPLIER NAME (MILLER)",
      "BUYER LOCATION",
      "TOTAL AMOUNT",
      "PENDING OUTSTANDING DAYS",
      "PAYMENT STATUS"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredTxns.map(t => {
        const location = t.isArrival ? `"${t.place || ''}${t.area ? ` - ${t.area}` : ''}"` : "N/A";
        const outstanding = t.isArrival ? `${t.daysOutstanding} Days` : "N/A";
        return [
          t.date,
          t.id,
          `"${t.buyer}"`,
          `"${t.supplier}"`,
          location,
          `₹${t.amount}`,
          outstanding,
          t.status
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trade_payment_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
              Financial Matrix
            </span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1.5",
              cloudStatus === 'synced' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              cloudStatus === 'syncing' ? "bg-primary/5 text-primary border border-primary/10 animate-pulse" :
              "bg-rose-50 text-rose-500 border border-rose-100"
            )}>
              <RefreshCw className={cn("w-3 h-3", cloudStatus === 'syncing' && "animate-spin")} />
              {cloudStatus === 'synced' ? 'Live Cloud Synced' : cloudStatus === 'syncing' ? 'Syncing...' : 'Disconnected/Local'}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Payment Hub & Ledger</h1>
          <p className="text-secondary text-sm font-medium">
            Monitor, reconcile, and credit physical grain shipments alongside escrow-secured contracts.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportCurrentPipeline}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-white rounded-2xl shadow-sm transition-all text-xs font-black uppercase tracking-widest hover:scale-[1.01]"
          >
            <Download className="w-4 h-4" />
            Export CSV Audit
          </button>
        </div>
      </div>

      {/* Alert Notification banner */}
      <AnimatePresence>
        {warningAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 text-amber-800 dark:text-amber-400 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-md overflow-hidden relative text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider">Payments Restriction Rule</p>
                <p className="text-xs font-semibold">{warningAlert}</p>
              </div>
            </div>
            <button 
              onClick={() => setWarningAlert(null)}
              className="p-1 px-3 hover:bg-amber-500/20 rounded-lg text-xs font-bold font-mono transition-colors shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overdue Alerts (> 60 Days) */}
      {overdueTxns.length > 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-500/15 rounded-2xl p-4 shadow-sm overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-rose-500/10">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-lg shrink-0 animate-pulse">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  High-Risk Overdue Accounts
                  <span className="bg-rose-500 text-white text-[8px] uppercase font-black px-1.5 py-0.5 rounded-full">
                    {overdueTxns.length} Aging &gt; 60 Days
                  </span>
                </h3>
                <p className="text-rose-700/80 dark:text-rose-300/80 text-[10px] font-semibold">
                  Standard credit cycle exceeded. Followup recommended.
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[9px] text-rose-500 font-extrabold uppercase tracking-wider block">Total Overdue</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono">
                ₹{formatINR(overdueTxns.reduce((sum, item) => sum + item.amount, 0))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {overdueTxns.map((txn, index) => (
              <div 
                key={`${txn.id || 'overdue'}-${index}`}
                className="border border-rose-500/10 hover:border-rose-500/25 bg-white/40 dark:bg-neutral-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm relative group transition-all"
              >
                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[9px] font-bold font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                      {txn.id}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-tight text-white bg-rose-600 px-1.5 py-0.5 rounded">
                      {txn.daysOutstanding}d overdue
                    </span>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 line-clamp-1 uppercase">
                      {txn.buyer}
                    </h4>
                    <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-bold truncate">
                      {txn.supplier}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-neutral-100/60 dark:border-neutral-800/60">
                  <div className="text-left">
                    <span className="text-[7px] text-neutral-400 uppercase font-black block leading-none">Receivable</span>
                    <span className="text-[11px] font-black text-neutral-950 dark:text-white font-mono">
                      ₹{formatINR(txn.amount)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenPaymentModal(txn)}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm"
                  >
                    Collect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/15 rounded-xl p-3 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  Overdue Payments Tracker
                  <span className="bg-emerald-600 text-white text-[8px] uppercase font-black px-1.5 py-0.5 rounded-full">
                    0 Overdue Payments
                  </span>
                </h3>
                <p className="text-emerald-700/80 dark:text-emerald-300/80 text-[10px] font-semibold">
                  Excellent health. No arrived transactions are aging beyond the standard 60-day cycle.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Financial Overview Cards - Bento Presentation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { 
            label: 'Outstanding Settlements', 
            value: `₹${formatINR(financialSummary.pendingAmt)}`, 
            icon: AlertCircle, 
            sub: 'Owed by Buyers for Arrived Orders', 
            color: 'text-amber-500',
            border: 'hover:border-amber-500/30',
            bg: 'bg-amber-50 dark:bg-amber-950/20',
            filterKey: 'pending' as const
          },
          { 
            label: 'Total Liquid Cleared', 
            value: `₹${formatINR(financialSummary.clearedAmt)}`, 
            icon: ShieldCheck, 
            sub: 'Completed Bank Receipts', 
            color: 'text-emerald-600',
            border: 'hover:border-emerald-500/30',
            bg: 'bg-emerald-50 dark:bg-emerald-950/20',
            filterKey: 'cleared' as const
          },
          { 
            label: 'Total Arrived Volume', 
            value: `₹${formatINR(financialSummary.totalAmt)}`, 
            icon: Coins, 
            sub: 'Cumulative Value of Entered Cargo', 
            color: 'text-primary',
            border: 'hover:border-primary/40',
            bg: 'bg-primary/5',
            filterKey: 'all' as const
          },
          { 
            label: 'Reconciliation Flags', 
            value: `${financialSummary.discrepancyCount} Alerts`, 
            icon: AlertTriangle, 
            sub: `${financialSummary.totalDifference.toFixed(2)} QTLS Discrepancy Vol`, 
            color: 'text-rose-500 dark:text-rose-400',
            border: 'hover:border-rose-500/30',
            bg: 'bg-rose-50 dark:bg-rose-950/20',
            filterKey: 'discrepancy' as const
          },
          { 
            label: 'Lifted Orders Payments', 
            value: `₹${formatINR(liftedSummary.totalAmt)}`, 
            icon: Truck, 
            sub: `${liftedSummary.count} Redirected Vehicle Loads`, 
            color: 'text-purple-600 dark:text-purple-400',
            border: 'hover:border-purple-500/30',
            bg: 'bg-purple-50 dark:bg-purple-950/20',
            filterKey: 'lifted' as const
          },
        ].map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setStatusFilter(card.filterKey)}
            className={cn(
              "border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between h-[175px] p-5 rounded-3xl shadow-sm relative overflow-hidden group interactive-card bg-white dark:bg-neutral-900/40 cursor-pointer",
              card.border,
              statusFilter === card.filterKey && "ring-2 ring-purple-500/30 border-purple-500"
            )}
          >
            <div className="flex justify-between items-start">
               <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-105 duration-200", card.bg)}>
                  <card.icon className={cn("w-5 h-5", card.color)} />
               </div>
               <span className="text-[9px] font-black tracking-widest uppercase text-neutral-400 dark:text-neutral-500">Ledger</span>
            </div>
            <div className="text-left mt-2">
               <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{card.label}</p>
               <h3 className="text-xl font-black text-neutral-900 dark:text-white font-mono leading-none">{card.value}</h3>
               <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 mt-1.5">{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Pipeline Panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        
        {/* Pipeline Controls */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
             
             {/* Consolidated Title Indicator */}
             <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-950 px-4 py-2.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-800">
               <CreditCard className="w-4 h-4 text-primary shrink-0" />
               <span className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
                 Arrived Orders Ledger ({contractTxns.length})
               </span>
             </div>

             {/* Search and Quick Filters */}
             <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                
                {/* Robust Search Box */}
                <div className="relative flex-1 lg:flex-none lg:w-64">
                   <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                   <input 
                     type="text" 
                     placeholder="Quick search pipeline..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl py-2 pl-10 pr-8 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400" 
                   />
                   {searchQuery && (
                     <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100">
                       <X className="w-3.5 h-3.5" />
                     </button>
                   )}
                </div>

                {/* Filter segments */}
                <div className="flex border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs bg-neutral-50 dark:bg-neutral-950 p-0.5">
                  {(['all', 'pending', 'cleared', 'discrepancy', 'lifted'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "px-3 py-1.5 font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                        statusFilter === st 
                          ? "bg-white dark:bg-neutral-900 text-primary shadow-sm" 
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-850"
                      )}
                    >
                      {st === 'lifted' && <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                      {st === 'all' ? 'All' : st === 'pending' ? 'Pending' : st === 'cleared' ? 'Cleared' : st === 'discrepancy' ? 'Discrepancies' : 'Lifted Orders'}
                    </button>
                  ))}
                </div>
             </div>
          </div>

          {/* Guidelines info banners */}
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-1000 px-4 py-3 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-left">
              <span className="p-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-bold text-primary font-mono text-[10px]">INFO</span>
              <p className="text-[11px] font-medium leading-tight">
                <span>Showing consolidated arrived shipments from the <strong>Arrival Entries Spreadsheet</strong> and <strong>Placed Orders</strong>, ready for payment clearance and collection.</span>
              </p>
            </div>
            <span className="font-extrabold text-neutral-800 dark:text-neutral-100 whitespace-nowrap shrink-0 text-[10px] uppercase tracking-widest bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded-lg ml-4">
              {filteredTxns.length} Listed
            </span>
          </div>
        </div>

        {statusFilter === 'lifted' && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  Lifted / Redirected Vehicle Orders Payment Registry
                </h4>
                <p className="text-[11px] font-medium text-purple-700/80 dark:text-purple-300/80">
                  Showing payments specifically for orders redirected to new shops after delivery refusal by original buyers. Total Value: <strong>₹{formatINR(liftedSummary.totalAmt)}</strong> ({liftedSummary.count} Redirected Loads)
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                Outstanding Lifted Owed
              </p>
              <p className="text-base font-black font-mono text-purple-900 dark:text-purple-100">
                ₹{formatINR(liftedSummary.pendingAmt)}
              </p>
            </div>
          </div>
        )}

        {/* Dense Spreadsheet Grain Grid / Table */}
        <div className="overflow-x-auto">
          {filteredTxns.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center text-neutral-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-sm font-black text-neutral-700 dark:text-neutral-300">No matching payment logs found</p>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">Try adjusting your active query or resetting status filters to find missing invoices.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest border-b border-neutral-200 dark:border-neutral-850">
                  <th className="p-4 pl-6">Arrival Date</th>
                  <th className="p-4">Bill No</th>
                  <th className="p-4">Entity Log (Buyer & Supplier Source)</th>
                  <th className="p-4 text-right">Net Bill Amount</th>
                  <th className="p-4 text-center">Settlement Status</th>
                  <th className="p-4 pr-6 text-right">Audit Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-150 dark:divide-neutral-800/60">
                {filteredTxns.map((txn, index) => (
                  <PaymentRow 
                    key={`${txn.id}-${index}`}
                    txn={txn}
                    isSelected={selectedTxn?.id === txn.id}
                    onSelect={toggleRowSelected}
                    onOpenPayment={handleOpenPaymentModal}
                    onReversePayment={handleReversePayment}
                    onGeneratePatti={handleGeneratePatti}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Enter Payment / Secure Payout Settlement Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedTxn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-md">
            <motion.div 
               initial={{ scale: 0.96, opacity: 0, y: 15 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.96, opacity: 0, y: 15 }}
               transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
               className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 dark:border-neutral-800"
            >
               {/* Modal Header */}
               <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
                        <DollarSign className="w-5 h-5" />
                     </div>
                     <div className="text-left">
                        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Commercial Treasury Vault</h3>
                        <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-100">Log Settlement: {selectedTxn.id}</h4>
                     </div>
                  </div>
                  <button 
                    onClick={() => setShowPaymentModal(false)} 
                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded-full transition-colors"
                  >
                     <X className="w-5 h-5 text-neutral-400" />
                  </button>
               </div>
               
               {/* Payout Form */}
               <form onSubmit={handleUpdatePayment} className="p-6 space-y-5">
                  
                  {/* Ledger Summary Info Drawer */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-1000 border border-neutral-250/20 dark:border-neutral-800 rounded-2xl text-xs space-y-2 text-left">
                    {selectedTxn.isLifted && (
                      <div className="p-2.5 mb-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-black uppercase text-[10px] text-purple-700 dark:text-purple-300">
                          <Truck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          LIFTED LOAD — COLLECT FROM NEW BUYER
                        </div>
                        <p className="text-[11px] font-medium leading-tight">
                          Collecting payment from <strong>{selectedTxn.buyer}</strong> {selectedTxn.originalBuyer ? `(Redirected load ex: ${selectedTxn.originalBuyer})` : ''}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-500 uppercase tracking-wider text-[9px]">Buyer Party (Collecting From):</span>
                      <span className="font-black text-neutral-800 dark:text-neutral-100 uppercase">{selectedTxn.buyer}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-500 uppercase tracking-wider text-[9px]">Outstanding Aging Period:</span>
                      <span className="text-rose-500 font-extrabold font-mono">{selectedTxn.daysOutstanding} Days Pending</span>
                    </div>
                    {selectedTxn.isArrival && (
                      <div className="flex justify-between items-center border-t border-neutral-200 dark:border-neutral-850 pt-2 mt-2">
                        <span className="font-bold text-neutral-500 uppercase tracking-wider text-[9px]">Total Cargo Weight:</span>
                        <span className="font-black text-primary font-mono">{selectedTxn.qty} QTLS</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 text-left">
                     
                     {/* Segmented Payment instrument Selector */}
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-1">Instrument Route</label>
                        <div className="flex gap-1.5 p-1 bg-neutral-150 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-850">
                           {['RTGS', 'NEFT', 'Cheque', 'Cash'].map(m => (
                              <button 
                                 key={m} 
                                 type="button"
                                 onClick={() => setPaymentData({...paymentData, method: m})}
                                 className={cn(
                                    "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                    paymentData.method === m 
                                      ? "bg-white dark:bg-neutral-850 text-primary shadow-sm" 
                                      : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                                 )}
                              >
                                 {m}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-3">
                        
                        {/* Deposit/Clearance Bank */}
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-1">Issuing Bank Reference</label>
                           <div className="relative group">
                              <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary transition-colors shrink-0" />
                              <input 
                                 required
                                 type="text" 
                                 placeholder="e.g. State Bank of India, Khanna Central" 
                                 value={paymentData.bank}
                                 onChange={(e) => setPaymentData({...paymentData, bank: e.target.value})}
                                 className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-neutral-900 dark:text-neutral-100"
                              />
                           </div>
                        </div>

                        {/* Reference / UTR string */}
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-1">UTR Sequence / Instrument No.</label>
                           <input 
                              required
                              type="text" 
                              placeholder="e.g. UTR-994825591" 
                              value={paymentData.refNo}
                              onChange={(e) => setPaymentData({...paymentData, refNo: e.target.value})}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-neutral-900 dark:text-neutral-100"
                           />
                        </div>

                        {/* Date and Shortage Weight Adjustments */}
                        {/* Date field */}
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-1">Clearing Date</label>
                           <div className="relative group">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary transition-colors shrink-0" />
                              <input 
                                 required
                                 type="date" 
                                 value={paymentData.date}
                                 onChange={(e) => setPaymentData({...paymentData, date: e.target.value})}
                                 className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-neutral-900 dark:text-neutral-100"
                              />
                           </div>
                        </div>

                        {/* Cash Discount Percentage & Calculated Discount Amount */}
                        <div className="space-y-2.5 p-3.5 bg-blue-50/40 dark:bg-neutral-950/40 border border-blue-500/10 dark:border-neutral-850 rounded-2xl">
                           <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                 Cash Discount (CC Column)
                              </label>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 font-mono">
                                 ₹{parseFloat(paymentData.discountAmount).toLocaleString('en-IN')} Calculated
                              </span>
                           </div>
                           
                           {/* Beautiful Selection Grid of Pills */}
                           <div className="flex gap-1.5">
                              {[4, 3, 2, 1, 0].map(pct => {
                                 const isSelected = paymentData.discountPercent === pct;
                                 const label = pct === 0 ? 'No Disc' : `${pct}%`;
                                 return (
                                    <button
                                       key={pct}
                                       type="button"
                                       onClick={() => {
                                          const discountAmt = Math.round((selectedTxn.amount * pct) / 100);
                                          const newNetAmt = Math.max(0, selectedTxn.amount - discountAmt);
                                          setPaymentData({
                                             ...paymentData,
                                             discountPercent: pct,
                                             discountAmount: String(discountAmt),
                                             amount: String(newNetAmt)
                                          });
                                       }}
                                       className={cn(
                                          "flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer",
                                          isSelected
                                             ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/10"
                                             : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                       )}
                                    >
                                       {label}
                                    </button>
                                 );
                              })}
                           </div>

                           {/* Custom Manual Discount input for override precision */}
                           <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/40 mt-1">
                              <div className="space-y-1">
                                 <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Custom Discount %</span>
                                 <input
                                    type="number"
                                    placeholder="e.g. 1.5"
                                    value={paymentData.discountPercent || ''}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       const pct = parseFloat(val) || 0;
                                       const discountAmt = Math.round((selectedTxn.amount * pct) / 100);
                                       const newNetAmt = Math.max(0, selectedTxn.amount - discountAmt);
                                       setPaymentData({
                                          ...paymentData,
                                          discountPercent: pct,
                                          discountAmount: String(discountAmt),
                                          amount: String(newNetAmt)
                                       });
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-black outline-none focus:ring-1 focus:ring-blue-500/20 text-neutral-800 dark:text-neutral-200"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Discount Amt (₹)</span>
                                 <input
                                    type="number"
                                    placeholder="0"
                                    value={paymentData.discountAmount}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       const parsedAmt = parseFloat(val) || 0;
                                       const newNetAmt = Math.max(0, selectedTxn.amount - parsedAmt);
                                       const estimatedPct = selectedTxn.amount > 0 ? parseFloat(((parsedAmt / selectedTxn.amount) * 100).toFixed(2)) : 0;
                                       setPaymentData({
                                          ...paymentData,
                                          discountAmount: val,
                                          discountPercent: estimatedPct,
                                          amount: String(newNetAmt)
                                       });
                                    }}
                                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-black outline-none focus:ring-1 focus:ring-blue-500/20 text-right text-neutral-800 dark:text-neutral-200"
                                 />
                              </div>
                           </div>
                        </div>

                        {/* Actual amount to receive ledger clearance */}
                        <div className="space-y-2 bg-emerald-500/10 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/20 mt-2">
                           <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Net Cleared Bank Amount (₹)</label>
                             <button
                               type="button"
                               onClick={() => setPaymentData({...paymentData, amount: String(selectedTxn.amount)})}
                               className="text-[9px] font-black uppercase text-primary tracking-wider hover:underline flex items-center gap-1 transition-all"
                             >
                                <Sparkles className="w-3 h-3 shrink-0" />
                                Settlement Full Balance
                             </button>
                           </div>
                           <input 
                              required
                              type="number" 
                              placeholder="0.00" 
                              value={paymentData.amount}
                              onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                              className="w-full bg-white dark:bg-neutral-900 border border-emerald-600/30 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-emerald-600 font-mono text-right"
                           />
                        </div>

                     </div>
                  </div>

                  <button 
                     type="submit" 
                     className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.008]"
                  >
                     <Check className="w-4 h-4" />
                     Commit & Reconcile Account
                  </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
