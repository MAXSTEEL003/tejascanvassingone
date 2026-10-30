import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  CreditCard, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  Phone,
  MapPin,
  TrendingUp,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn, formatINR, getDeletedPlacedOrderIds, getDeletedProcurementIds } from '../lib/utils';
import { getCollectionDocs } from '../lib/firebase';
import { resolveBuyerProfile } from '../utils/poEmailTemplate';

export interface BuyerLedgerModalProps {
  buyerName: string | null;
  onClose: () => void;
  initialTab?: 'orders' | 'payments';
}

export default function BuyerLedgerModal({
  buyerName,
  onClose,
  initialTab = 'payments'
}: BuyerLedgerModalProps) {
  const navigate = useNavigate();
  const [activeHistoryTab, setActiveHistoryTab] = useState<'orders' | 'payments'>(initialTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPendingPaymentsOnly, setShowPendingPaymentsOnly] = useState<boolean>(false);
  const [showArrivedOrdersOnly, setShowArrivedOrdersOnly] = useState<boolean>(false);

  const [data, setData] = useState<{
    profile: any;
    orders: any[];
    payments: any[];
  } | null>(null);

  useEffect(() => {
    if (!buyerName) {
      setData(null);
      return;
    }

    setActiveHistoryTab(initialTab);
    setLoading(true);

    async function loadData() {
      const cleanBuyer = (buyerName || '').trim();
      const normBuyer = cleanBuyer.toUpperCase();

      // 1. Resolve Profile
      let profile: any = { 
        name: cleanBuyer, 
        email: `${cleanBuyer.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`, 
        phone: resolveBuyerProfile(cleanBuyer).phone ? `+91 ${resolveBuyerProfile(cleanBuyer).phone.replace(/^91/, '')}` : '+91 99453 51166', 
        address: 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022', 
        gstin: '29AAGCV7712M1ZP' 
      };

      try {
        const savedStakeholders = JSON.parse(localStorage.getItem('stakeholders_v2') || '{}');
        const buyers = savedStakeholders.buyers || [];
        const matched = buyers.find((b: any) => b.name?.trim().toUpperCase() === normBuyer);
        if (matched) {
          profile = { ...profile, ...matched };
        } else {
          const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
          const matchedCloud = cloudStakeholders.find((b: any) => b.name?.trim().toUpperCase() === normBuyer);
          if (matchedCloud) {
            profile = { ...profile, ...matchedCloud };
          }
        }
      } catch (e) {
        console.warn("Failed to load profile for buyer:", e);
      }

      // 2. Resolve Orders
      let merchantOrders: any[] = [];
      let uniquePlaced: any[] = [];
      try {
        const localRequests = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
        const cloudRequests = await getCollectionDocs('procurement_requests').catch(() => []);
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);

        const delPlaced = getDeletedPlacedOrderIds();
        const delProc = getDeletedProcurementIds();
        const isDeleted = (id: any) => {
          const norm = String(id || '').trim().toLowerCase().replace(/^#/, '');
          return delPlaced.has(norm) || delProc.has(norm);
        };

        const combinedPlaced = [...localPlaced, ...cloudPlaced];
        uniquePlaced = Array.from(new Map(combinedPlaced.filter(p => p && p.id && !isDeleted(p.id) && !isDeleted(p.purchaseOrderNo)).map(item => [item.id, item])).values());

        const combinedOrders = [...localRequests, ...cloudRequests, ...localPlaced, ...cloudPlaced];
        const uniqueOrders = Array.from(new Map(combinedOrders.filter(o => o && o.id && !isDeleted(o.id) && !isDeleted(o.purchaseOrderNo)).map(item => [item.id, item])).values());

        merchantOrders = uniqueOrders.filter(o => {
          if (!o) return false;
          const directMatch = o.buyer && String(o.buyer).trim().toUpperCase() === normBuyer;
          if (directMatch) return true;
          if (o.originalOrders && Array.isArray(o.originalOrders)) {
            return o.originalOrders.some((sub: any) => sub && sub.buyer && String(sub.buyer).trim().toUpperCase() === normBuyer);
          }
          return false;
        }).map(o => {
          // If this is a grouped order with suborders, extract suborder details for this buyer
          if (o.originalOrders && Array.isArray(o.originalOrders)) {
            const sub = o.originalOrders.find((s: any) => s && s.buyer && String(s.buyer).trim().toUpperCase() === normBuyer);
            if (sub) {
              return {
                ...o,
                id: sub.id || o.id,
                qty: Number(sub.qty || o.qty || 0),
                rate: Number(sub.rate || o.rate || 0),
                product: sub.product || sub.brand || o.product || o.brand || 'Premium Rice',
                supplier: sub.supplier || o.supplier || 'Direct Mill'
              };
            }
          }
          return {
            ...o,
            qty: Number(o.qty || 0),
            rate: Number(o.rate || 0),
            product: o.product || o.brand || o.items || 'Premium Rice',
            supplier: o.supplier || 'Direct Mill'
          };
        });
      } catch (e) {
        console.warn("Failed to load orders for buyer history:", e);
      }

      // 3. Resolve Commercial Ledger & Payments
      let merchantPaymentsList: any[] = [];
      try {
        const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
        
        let allArrivals = [...localArrivals];
        if (cloudArrivals && cloudArrivals.length > 0) {
          allArrivals = [...cloudArrivals, ...localArrivals];
        }

        const activeArrivals = allArrivals.filter(row => row && (row.partyName || row.millerName || row.billNo || row.qty));
        
        // Match arrivals for this buyer
        const arrivalEntries = activeArrivals.filter(row => {
          const rowParty = String(row.partyName || '').trim().toUpperCase();
          return rowParty === normBuyer || (rowParty && normBuyer.includes(rowParty));
        }).map((row, index) => {
          const calculatedNet = parseFloat(row.netAmt) || parseFloat(row.amount) || ((parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0)) || 0;
          const isCleared = row.noOfDayRec === 'Cleared';
          
          let daysOld = 0;
          if (row.date) {
            const arrDate = new Date(row.date);
            if (!isNaN(arrDate.getTime())) {
              arrDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffTime = today.getTime() - arrDate.getTime();
              daysOld = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            }
          }

          const cleanId = row.billNo 
            ? String(row.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '') 
            : `BIL-${index + 1001}`;

          return {
            id: cleanId,
            date: row.date || 'Historical',
            product: row.variety || row.brand || 'Premium Rice',
            qty: parseFloat(row.qty) || 0,
            rate: parseFloat(row.rate) || 0,
            amount: calculatedNet,
            status: isCleared ? 'Cleared' : 'Pending Settlement',
            type: 'Physical Cargo',
            daysOld: daysOld
          };
        });

        // Also include trade orders from placed_orders for this buyer that haven't arrived yet
        const tradeOrders = uniquePlaced.filter(p => {
          if (!p) return false;
          const directMatch = p.buyer && String(p.buyer).trim().toUpperCase() === normBuyer;
          if (directMatch) return true;
          if (p.originalOrders && Array.isArray(p.originalOrders)) {
            return p.originalOrders.some((sub: any) => sub && sub.buyer && String(sub.buyer).trim().toUpperCase() === normBuyer);
          }
          return false;
        }).map((p, idx) => {
          let pQty = Number(p.qty || 0);
          let pRate = Number(p.rate || 0);
          let pProduct = p.product || p.brand || 'Premium Rice';
          let pId = p.id;

          if (p.originalOrders && Array.isArray(p.originalOrders)) {
            const sub = p.originalOrders.find((s: any) => s && s.buyer && String(s.buyer).trim().toUpperCase() === normBuyer);
            if (sub) {
              pQty = Number(sub.qty || pQty);
              pRate = Number(sub.rate || pRate);
              pProduct = sub.product || sub.brand || pProduct;
              if (sub.id) pId = `${p.id} (${sub.id})`;
            }
          }

          const isCleared = p.paymentStatus === 'Received' || p.paymentStatus === 'Settled' || p.status === 'Settled';
          const calculatedNet = pQty * pRate;

          return {
            id: pId,
            date: p.date || p.purchaseOrderSentAt || 'Recent',
            product: pProduct,
            qty: pQty,
            rate: pRate,
            amount: calculatedNet,
            status: isCleared ? 'Cleared' : 'Pending Settlement',
            type: 'Trade Order',
            daysOld: 0
          };
        });

        merchantPaymentsList = [...tradeOrders, ...arrivalEntries];
      } catch (e) {
        console.warn("Failed to load payment history:", e);
      }

      setData({
        profile,
        orders: merchantOrders,
        payments: merchantPaymentsList
      });
      setLoading(false);
    }

    loadData();
  }, [buyerName, initialTab]);

  if (!buyerName) return null;

  const totalOrders = data?.orders.length || 0;
  const arrivedQty = data?.orders
    .filter(o => o.status === 'Arrived' || o.status === 'Accepted' || o.status === 'Completed')
    .reduce((sum, o) => sum + (Number(o.qty) || 0), 0) || 0;

  const settledPayments = data?.payments
    .filter(p => p.status === 'Cleared')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

  const outstandingBalance = data?.payments
    .filter(p => p.status !== 'Cleared')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

  const ordersToShow = showArrivedOrdersOnly
    ? (data?.orders || []).filter(o => o.status === 'Arrived' || o.status === 'Accepted' || o.status === 'Completed')
    : (data?.orders || []);

  const paymentsToShow = showPendingPaymentsOnly
    ? (data?.payments || []).filter(p => p.status !== 'Cleared')
    : (data?.payments || []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-surface border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 text-on-surface"
        >
          {/* Header */}
          <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between bg-surface-container-low">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg">
                {buyerName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'BM'}
              </div>
              <div>
                <h3 className="text-xl font-black text-on-surface flex items-center gap-2">
                  <span>{buyerName}</span>
                  <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-full tracking-widest leading-none border border-primary/15">
                    Authorized Buyer
                  </span>
                </h3>
                <p className="text-xs text-secondary mt-1 font-medium flex items-center gap-3 flex-wrap">
                  <span>GSTIN: <span className="font-mono font-bold text-on-surface">{data?.profile?.gstin || '29AAGCV7712M1ZP'}</span></span>
                  <span className="opacity-30">•</span>
                  <span>Phone: <span className="font-mono font-bold text-on-surface">{data?.profile?.phone || '+91 99453 51166'}</span></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/ledger?buyer=${encodeURIComponent(buyerName)}`);
                }}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                title="Open dedicated full-screen Ledger Management view"
              >
                <span>Full Ledger</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-surface-container rounded-full text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-secondary">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">Loading buyer ledger & commercial history...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial Stats Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Total Orders</p>
                  <h4 className="text-xl font-black text-on-surface mt-1">{totalOrders}</h4>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Arrived Cargo Qty</p>
                  <h4 className="text-xl font-black text-primary mt-1 font-mono">
                    {arrivedQty.toFixed(1)} <span className="text-[10px] uppercase text-secondary font-medium">QTL</span>
                  </h4>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Settled Payments</p>
                  <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    ₹ {formatINR(settledPayments)}
                  </h4>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Outstanding Balance</p>
                  <h4 className={cn(
                    "text-xl font-black mt-1 font-mono",
                    outstandingBalance > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600"
                  )}>
                    ₹ {formatINR(outstandingBalance)}
                  </h4>
                </div>
              </div>

              {/* Registered Address */}
              <div className="bg-primary/[0.03] border border-primary/10 p-3.5 rounded-2xl text-xs flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-primary uppercase tracking-wider text-[9px] block">Commercial Delivery Destination:</strong>
                  <span className="text-on-surface/80 font-medium">{data?.profile?.address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022'}</span>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('payments')}
                  className={cn(
                    "flex-1 pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer",
                    activeHistoryTab === 'payments'
                      ? "border-primary text-primary"
                      : "border-transparent text-secondary hover:text-on-surface"
                  )}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Commercial Ledger ({data?.payments.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHistoryTab('orders')}
                  className={cn(
                    "flex-1 pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer",
                    activeHistoryTab === 'orders'
                      ? "border-primary text-primary"
                      : "border-transparent text-secondary hover:text-on-surface"
                  )}
                >
                  <Package className="w-4 h-4" />
                  <span>Order History ({totalOrders})</span>
                </button>
              </div>

              {/* Panel Content */}
              <div className="min-h-[220px]">
                {activeHistoryTab === 'payments' ? (
                  <div className="space-y-3">
                    {/* Filter & Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-low/60 p-3 rounded-2xl border border-outline-variant/15">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          outstandingBalance > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                        )} />
                        <p className="text-xs font-bold text-on-surface">
                          {outstandingBalance > 0 
                            ? `Outstanding balance pending collection: ₹ ${formatINR(outstandingBalance)}`
                            : "All trade ledger entries are fully cleared and reconciled"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowPendingPaymentsOnly(prev => !prev)}
                          className={cn(
                            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer",
                            showPendingPaymentsOnly
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-surface text-secondary hover:text-on-surface border-outline-variant/30"
                          )}
                        >
                          {showPendingPaymentsOnly ? "Show All Entries" : "Pending Only"}
                        </button>
                      </div>
                    </div>

                    {/* Ledger Table */}
                    {paymentsToShow.length > 0 ? (
                      <div className="border border-outline-variant/20 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs bg-surface-container-lowest">
                          <thead>
                            <tr className="bg-surface-container-low text-secondary font-black uppercase tracking-wider text-[10px]">
                              <th className="p-3.5">Bill / Ref No</th>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Type</th>
                              <th className="p-3.5">Variety / Brand</th>
                              <th className="p-3.5 text-right font-mono">Volume</th>
                              <th className="p-3.5 text-right font-mono">Rate</th>
                              <th className="p-3.5 text-right font-mono">Amount</th>
                              <th className="p-3.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10 font-medium text-on-surface">
                            {paymentsToShow.map((p, pIdx) => (
                              <tr key={`${p.id}-${pIdx}`} className="hover:bg-primary/[0.02]">
                                <td className="p-3.5 font-mono font-bold text-primary">
                                  {p.id}
                                </td>
                                <td className="p-3.5 text-secondary">{p.date}</td>
                                <td className="p-3.5">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                    p.type === 'Trade Order' ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                  )}>
                                    {p.type || 'Trade Order'}
                                  </span>
                                </td>
                                <td className="p-3.5 font-semibold text-on-surface">{p.product}</td>
                                <td className="p-3.5 text-right font-mono font-bold">{p.qty.toFixed(2)} QTLS</td>
                                <td className="p-3.5 text-right font-mono text-secondary">₹ {formatINR(p.rate)}</td>
                                <td className="p-3.5 text-right font-mono font-black text-on-surface">₹ {formatINR(p.amount)}</td>
                                <td className="p-3.5 font-black">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 border",
                                    p.status === 'Cleared' 
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300/30"
                                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300/30"
                                  )}>
                                    <span className={cn("w-1 h-1 rounded-full", p.status === 'Cleared' ? "bg-emerald-500" : "bg-amber-500")} />
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-secondary bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40">
                        <CreditCard className="w-10 h-10 mx-auto text-secondary/40 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                          {showPendingPaymentsOnly ? "No pending payments found" : "No commercial ledger entries recorded"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Orders Filter */}
                    <div className="flex items-center justify-between bg-surface-container-low/60 p-3 rounded-2xl border border-outline-variant/15">
                      <p className="text-xs font-semibold text-secondary">
                        Showing {showArrivedOrdersOnly ? 'only arrived/completed' : 'all'} trade indents & orders
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowArrivedOrdersOnly(prev => !prev)}
                        className={cn(
                          "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer",
                          showArrivedOrdersOnly
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-surface text-secondary hover:text-on-surface border-outline-variant/30"
                        )}
                      >
                        {showArrivedOrdersOnly ? "Show All Orders" : "Arrived Only"}
                      </button>
                    </div>

                    {ordersToShow.length > 0 ? (
                      <div className="border border-outline-variant/20 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs bg-surface-container-lowest">
                          <thead>
                            <tr className="bg-surface-container-low text-secondary font-black uppercase tracking-wider text-[10px]">
                              <th className="p-3.5">Order Ref</th>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Product Variety</th>
                              <th className="p-3.5">Supplier Mill</th>
                              <th className="p-3.5 text-right font-mono">Volume</th>
                              <th className="p-3.5 text-right font-mono">Rate</th>
                              <th className="p-3.5 text-right font-mono">Total Value</th>
                              <th className="p-3.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10 font-medium text-on-surface">
                            {ordersToShow.map((o, oIdx) => {
                              const qty = Number(o.qty) || 0;
                              const rate = Number(o.rate) || 0;
                              const totalVal = qty * rate;

                              return (
                                <tr key={`${o.id}-${oIdx}`} className="hover:bg-primary/[0.02]">
                                  <td className="p-3.5 font-mono font-bold text-primary">{o.id}</td>
                                  <td className="p-3.5 text-secondary">{o.date || 'Recent'}</td>
                                  <td className="p-3.5 font-semibold text-on-surface">{o.product || 'Standard Rice'}</td>
                                  <td className="p-3.5 text-secondary font-medium">{o.supplier || 'Direct Mill'}</td>
                                  <td className="p-3.5 text-right font-mono font-bold">{qty.toFixed(2)} QTLS</td>
                                  <td className="p-3.5 text-right font-mono text-secondary">₹ {formatINR(rate)}</td>
                                  <td className="p-3.5 text-right font-mono font-black">₹ {formatINR(totalVal)}</td>
                                  <td className="p-3.5">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                      o.status === 'Pending Approval' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      o.status === 'Approved' || o.status === 'Accepted' || o.status === 'Arrived' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                      "bg-neutral-100 text-neutral-700 border-neutral-200"
                                    )}>
                                      {o.status || 'Active'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-secondary bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40">
                        <Package className="w-10 h-10 mx-auto text-secondary/40 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                          {showArrivedOrdersOnly ? "No arrived orders found" : "No orders found for this buyer"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/ledger?buyer=${encodeURIComponent(buyerName)}`);
              }}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Go to Ledger View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-neutral-200 dark:bg-neutral-800 hover:opacity-90 text-on-surface rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

