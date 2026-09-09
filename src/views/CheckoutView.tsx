import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { 
  ChevronLeft, 
  MapPin, 
  CreditCard, 
  Truck, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  Layers,
  Building,
  Mail,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { setCollectionDoc } from '../lib/firebase';

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

const SUPPLIER_PROFILES_LOOKUP: Record<string, { email: string; phone: string }> = {
  'ANNAPURNA RICE & AGRO INDUSTRIES': { email: 'contact@annapurnarice.com', phone: '9440188941' },
  'SAI TEJA PARBOILED RICE MILLS (P) LTD': { email: 'saitejaparboiled@gmail.com', phone: '9848123456' },
  'RIDDHE SIDDHE RICE INDUSTRIES PVT LTD': { email: 'sales@riddhesiddhe.in', phone: '7001234567' },
  'NIDHI AGROS': { email: 'nidhiagros.trade@yahoo.com', phone: '9885123459' },
  'VAISHNAVI FOOD PRODUCTS PVT LTD': { email: 'vaishnavifoods.sales@gmail.com', phone: '9985901234' },
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

const resolveSupplierProfile = (supplierName: string) => {
  const norm = (supplierName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  try {
    const saved = localStorage.getItem('stakeholders_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const suppliers = parsed.suppliers || [];
      const matched = suppliers.find((s: any) => {
        const sNorm = (s.name || '').trim().toUpperCase()
          .replace(/\s*\(LLC\)/gi, '')
          .replace(/\.$/, '');
        return sNorm === norm || sNorm.includes(norm) || norm.includes(sNorm);
      });
      if (matched) {
        return {
          email: matched.email || 'contact@annapurnarice.com',
          phone: matched.phone || '9440188941'
        };
      }
    }
  } catch (e) {
    console.warn("Error resolving dynamic supplier profile from localStorage:", e);
  }

  if (SUPPLIER_PROFILES_LOOKUP[norm]) return SUPPLIER_PROFILES_LOOKUP[norm];
  for (const k of Object.keys(SUPPLIER_PROFILES_LOOKUP)) {
    if (norm.includes(k) || k.includes(norm)) return SUPPLIER_PROFILES_LOOKUP[k];
  }
  return {
    email: 'contact@annapurnarice.com',
    phone: '9440188941'
  };
};

export default function CheckoutView() {
  const { items, total, setIsOpen, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const bulkData = location.state as { bulkOrder?: boolean, count?: number, totalQty?: number } | null;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [createdOrderRef, setCreatedOrderRef] = useState<string>('');
  const [directWaLink, setDirectWaLink] = useState<string>('');
  const [directSmsLink, setDirectSmsLink] = useState<string>('');

  // Cart total is derived from useCart, but we'll add some dummy taxes/shipping
  const activeItemsCount = bulkData?.bulkOrder ? bulkData.count || 0 : items.length;
  const activeTotal = bulkData?.bulkOrder ? (bulkData.totalQty || 0) * 4200 : total; // Using $4200 as proxy rate for bulk

  const shipping = activeItemsCount > 0 ? 1200 : 0;
  const tax = activeTotal * 0.05;
  const grandTotal = activeTotal + shipping + tax;

  const handlePlaceOrder = () => {
    setIsProcessing(true);
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      
      // Save order to history for Dashboard
      const existing = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      
      // Calculate next sequential ONI- index for buyer store orders
      const storeOrders = existing.filter((o: any) => o.id && o.id.includes('ONI-'));
      let maxIdx = 0;
      storeOrders.forEach((o: any) => {
        const match = o.id.match(/ONI[_-](\d+)/);
        if (match) {
          const idx = parseInt(match[1]);
          if (idx > maxIdx) maxIdx = idx;
        }
      });
      const nextNum = maxIdx + 1;
      const oniId = `ONI-${String(nextNum).padStart(4, '0')}`;
      const finalOrderId = bulkData?.bulkOrder ? `TC-${Math.floor(1000 + Math.random() * 9000)}` : `#${oniId}`;
      setCreatedOrderRef(finalOrderId);
      
      const buyerText = bulkData?.bulkOrder 
        ? 'Consolidated Batch' 
        : (localStorage.getItem('userName') || 'V.K FOODS');

      const initials = buyerText
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'VK';

      const orderQty = bulkData?.bulkOrder ? (bulkData.totalQty || 0) : items.reduce((acc, i) => acc + (i.qty || 10), 0);
      const firstItemPrice = items[0]?.price || 4200;
      const orderRate = bulkData?.bulkOrder ? 4200 : firstItemPrice;
      const orderTotalAmt = orderQty * orderRate;
      const supplierVal = items[0]?.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES';

      const newOrder = {
        id: finalOrderId,
        buyer: buyerText,
        date: (() => {
          const d = new Date();
          const day = d.getDate();
          const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
          ];
          const m = monthNames[d.getMonth()];
          const yyyy = d.getFullYear();
          return `${day}-${m}-${yyyy}`;
        })(),
        qty: orderQty,
        rate: orderRate,
        total: `₹ ${formatINR(orderTotalAmt)}`,
        urgency: 'Normal',
        status: 'Pending Approval',
        initials,
        color: 'zinc',
        product: items[0]?.name || 'Premium Rice',
        supplier: supplierVal,
        address: localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
        phone: localStorage.getItem('userPhone') || '9342380981',
        gstin: localStorage.getItem('userGstin') || '29AAGCV7712M1ZP'
      };

      localStorage.setItem('procurement_requests', JSON.stringify([newOrder, ...existing]));
      setCollectionDoc('procurement_requests', newOrder.id, newOrder);
      
      // Clear cart on successful order
      clearCart();

      // Trigger actual back-end notifications (with graceful fallback logs)
      setEmailStatus('sending');

      const supplierProf = resolveSupplierProfile(supplierVal);
      const buyerProf = resolveBuyerProfile(buyerText);

      const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b;">
  <h2 style="color: #0f766e; margin-top: 0; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">OFFICIAL PURCHASE ORDER</h2>
  <p><strong>PO Number:</strong> ${newOrder.id}</p>
  <p><strong>Date of Issue:</strong> ${newOrder.date}</p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <h3 style="color: #0f766e;">Supplier Details</h3>
  <p><strong>Name:</strong> ${supplierVal}</p>
  <p><strong>Email:</strong> ${supplierProf.email}</p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <h3 style="color: #0f766e;">Billing & Delivery Destination</h3>
  <p><strong>Authorized Broker Agency:</strong> Tejas Canvassing</p>
  <p><strong>Deliver To:</strong> ${newOrder.buyer}</p>
  <p><strong>Delivery Address:</strong> ${newOrder.address}</p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
    <thead>
      <tr style="background-color: #f8fafc; text-align: left;">
        <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">Product Specification</th>
        <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: right;">Quantity</th>
        <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: right;">Rate (Per QTL)</th>
        <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: right;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${newOrder.product}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${newOrder.qty} QTLS</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹ ${formatINR(newOrder.rate)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f766e;">${newOrder.total}</td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top: 24px; font-size: 11px; color: #64748b; text-align: center;">
    This is an automatically generated purchase order from Tejas Canvassing.
  </div>
</div>`;

      const whatsappText = `Hello ${buyerText},\n\nYour active procurement indent ${newOrder.id} has been successfully registered on the Tejas Canvassing platform!\n\n📋 *Indent Details*:\n🌾 Brand Specification: ${newOrder.product}\n⚖️ Requested Qty: ${newOrder.qty} QTLS\n🏢 Targeted Supplier: ${supplierVal}\n\nOur brokerage desk will group your request into a consolidated Purchase Order shortly.\n\nThank you for working with Tejas Canvassing!\nFor quick updates, use our mobile portal.`;

      // Set fallback direct URLs
      const cleanPhoneDigits = (buyerProf.phone || '9342380981').replace(/[^0-9]/g, '');
      const waDigits = cleanPhoneDigits.length === 10 ? `91${cleanPhoneDigits}` : cleanPhoneDigits;
      setDirectWaLink(`https://api.whatsapp.com/send?phone=${waDigits}&text=${encodeURIComponent(whatsappText)}`);
      setDirectSmsLink(`sms:+${waDigits}?body=${encodeURIComponent(whatsappText)}`);

      // 1. Dispatch WhatsApp confirmation to buyer via backend
      fetch('/api/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: buyerProf.phone,
          buyerName: buyerText,
          message: whatsappText
        })
      })
      .then(res => res.json())
      .then(data => {
        console.log('WhatsApp response:', data);
        if (data.directUrl) setDirectWaLink(data.directUrl);
        setEmailStatus('sent');
      })
      .catch(err => {
        console.warn('WhatsApp dispatch note:', err?.message || err);
        setEmailStatus('sent');
      });

      // 2. Dispatch SMS confirmation to buyer via backend
      fetch('/api/dispatch-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: buyerProf.phone,
          recipientName: buyerText,
          message: `Tejas Canvassing: Your Indent ${newOrder.id} for ${newOrder.qty} QTLS ${newOrder.product} has been registered successfully.`
        })
      }).catch(err => console.warn('SMS dispatch note:', err?.message || err));
    }, 1000);
  };

  const supplierName = items[0]?.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES';
  const supplierProfile = resolveSupplierProfile(supplierName);

  const buyerName = bulkData?.bulkOrder ? 'Consolidated Batch' : (localStorage.getItem('userName') || 'V.K FOODS');
  const buyerProfile = resolveBuyerProfile(buyerName);

  if (isSuccess) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center p-8 bg-[#faf8f5] dark:bg-[#040f0c] text-emerald-950 dark:text-emerald-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-[#051310] border border-emerald-900/10 dark:border-emerald-950/40 p-12 rounded-3xl text-center max-w-lg space-y-6 shadow-xl"
        >
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/30 shadow-inner">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-emerald-955 dark:text-emerald-50">Order Grouped & Placed!</h1>
            <p className="text-emerald-900/60 dark:text-emerald-250/50 font-medium text-xs">
              Your consolidated purchase order (PO) is being dispatched automatically.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {emailStatus === 'sending' ? (
              <motion.div 
                key="sending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-500/[0.03] p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Kicking off system dispatch routers...</span>
              </motion.div>
            ) : emailStatus === 'sent' ? (
              <motion.div 
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                {/* Brokerage Queue indicator */}
                <div className="bg-emerald-500/[0.04] p-3.5 rounded-2xl border border-emerald-500/25 flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-500/20">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Brokerage Pool Registered</p>
                    <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 mt-0.5">
                      Indent queued for bulk batch grouping with:
                    </p>
                    <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 font-sans uppercase tracking-wider">{supplierName}</p>
                  </div>
                </div>

                {/* WhatsApp dispatch indicator */}
                <div className="bg-orange-500/[0.04] p-3.5 rounded-2xl border border-orange-500/25 flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center text-orange-600 shrink-0 border border-orange-500/20">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">WhatsApp Confirmation to Buyer</p>
                    <p className="text-xs font-semibold text-emerald-955 dark:text-emerald-100 mt-0.5">
                      Registration confirmation transmitted to:
                    </p>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono select-all">+91 {buyerProfile.phone}</p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="bg-[#faf8f5] dark:bg-[#071612] p-4 rounded-xl text-left border border-emerald-900/10 dark:border-emerald-950/40 flex items-center gap-4">
             <div className="w-10 h-10 bg-white dark:bg-emerald-950/20 rounded-lg flex items-center justify-center shadow-sm">
                <PackageCheck className="w-6 h-6 text-emerald-600" />
             </div>
             <div>
                <p className="text-[10px] font-black text-emerald-900/60 dark:text-emerald-200/50 uppercase tracking-widest">Order Reference</p>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50">{createdOrderRef || (bulkData?.bulkOrder ? '#BATCH-TC-9104' : '#ONI-0001')}</p>
             </div>
          </div>

          {/* Real Phone Actions & WhatsApp Launcher */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={directWaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center no-underline"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Open in WhatsApp
            </a>
            <a
              href={directSmsLink}
              className="py-3 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center no-underline"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              Send Direct SMS
            </a>
          </div>

          <button 
            onClick={() => navigate('/placed-orders')}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Track in Pipeline
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#040f0c] p-4 sm:p-8 pb-32 max-w-7xl mx-auto space-y-8 text-emerald-950 dark:text-emerald-50">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-full transition-colors border-0 bg-transparent cursor-pointer text-emerald-950 dark:text-emerald-50"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{bulkData?.bulkOrder ? 'Consolidated Procurement' : 'Finalize Procurement'}</h1>
          <p className="text-emerald-900/60 dark:text-emerald-250/50 text-sm font-medium">{bulkData?.bulkOrder ? 'Reviewing batch shipment requirements.' : 'Review your items and select delivery terms.'}</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Items Review */}
          <section className="bg-white dark:bg-[#051310] border border-emerald-900/10 dark:border-emerald-950/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-emerald-950/10 dark:border-emerald-950/40 bg-emerald-500/[0.02] flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs text-emerald-900/65 dark:text-emerald-400">
                {bulkData?.bulkOrder ? <Layers className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                {bulkData?.bulkOrder ? `Grouped Batch (${bulkData.count} Entities)` : `Cart Items (${items.length})`}
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {bulkData?.bulkOrder ? (
                 <div className="p-8 bg-emerald-500/5 rounded-2xl border border-dashed border-emerald-500/20 space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white dark:bg-[#071d19] rounded-full flex items-center justify-center shadow-sm border border-emerald-500/25">
                          <Layers className="w-6 h-6 text-emerald-600" />
                       </div>
                       <div>
                          <p className="text-sm font-black text-emerald-955 dark:text-emerald-100">Consolidated Batch Request</p>
                          <p className="text-xs text-emerald-900/60 dark:text-emerald-250/50">Merging {bulkData.count} individual procurement intents into a single shipment line.</p>
                       </div>
                    </div>
                    <div className="flex justify-between items-center py-4 border-t border-emerald-500/10">
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-45 text-emerald-900/50 dark:text-emerald-350/50">Cumulative Volume</span>
                       <span className="text-sm font-black text-emerald-955 dark:text-emerald-50">{bulkData.totalQty?.toFixed(2)} QTLS</span>
                    </div>
                 </div>
              ) : items.length === 0 ? (
                <p className="p-8 text-center text-emerald-900/60 dark:text-emerald-250/50 text-sm italic">No items selected for procurement.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-6 items-center">
                    <div className="w-16 h-16 rounded-xl bg-emerald-500/5 overflow-hidden shrink-0 border border-emerald-900/10">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-100">{item.name}</h4>
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5 mt-0.5 mb-1">
                        <Building className="w-3 h-3" />
                        {item.supplier || 'Annapurna Grains'}
                      </p>
                      <p className="text-xs text-emerald-900/60 dark:text-emerald-250/50 font-medium">{item.qty} QTLS × ₹{formatINR(item.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-950 dark:text-emerald-50">₹{formatINR(item.price * item.qty)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Shipping & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white dark:bg-[#051310] border border-emerald-900/10 dark:border-emerald-950/40 p-8 rounded-2xl space-y-6 shadow-sm">
              <h3 className="font-black flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-950 dark:text-emerald-100">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Delivery Address
              </h3>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl relative">
                <CheckCircle2 className="absolute top-4 right-4 w-5 h-5 text-emerald-600" />
                <p className="font-bold text-sm text-emerald-955 dark:text-emerald-100">Dubai HQ Terminal</p>
                <p className="text-xs text-emerald-900/60 dark:text-emerald-250/50 mt-1 leading-relaxed">
                  Gate 4, Jebel Ali Free Zone,<br />
                  Dubai, United Arab Emirates
                </p>
              </div>
              <button className="w-full py-3 bg-transparent border border-emerald-900/10 dark:border-emerald-950/40 text-emerald-955 dark:text-emerald-100 hover:bg-emerald-500/5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Change Destination
              </button>
            </section>

            <section className="bg-white dark:bg-[#051310] border border-emerald-900/10 dark:border-emerald-950/40 p-8 rounded-2xl space-y-6 shadow-sm">
              <h3 className="font-black flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-955 dark:text-emerald-100">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Payment Instrument
              </h3>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-emerald-900 dark:bg-emerald-850 rounded flex items-center justify-center">
                    <span className="text-[8px] font-black text-white italic">INSTA-PAY</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-955 dark:text-emerald-50">Aggregator Credit</p>
                    <p className="text-[10px] text-emerald-900/60 dark:text-emerald-250/50">Limit: ₹ 5.4Cr Available</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              </div>
              <button className="w-full py-3 bg-transparent border border-emerald-900/10 dark:border-emerald-950/40 text-emerald-955 dark:text-emerald-100 hover:bg-emerald-500/5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Switch Payment Method
              </button>
            </section>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white dark:bg-[#051310] border border-emerald-900/10 dark:border-emerald-950/40 p-8 rounded-3xl space-y-8 sticky top-24 shadow-sm">
            <h3 className="text-xl font-black text-emerald-955 dark:text-emerald-50">Order Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-900/60 dark:text-emerald-250/50 font-medium uppercase tracking-wider text-[10px]">Net Value</span>
                <span className="font-bold">₹{formatINR(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-900/60 dark:text-emerald-250/50 font-medium uppercase tracking-wider text-[10px]">Logistics Fee</span>
                <span className="font-bold">₹{formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-900/60 dark:text-emerald-250/50 font-medium uppercase tracking-wider text-[10px]">IGST / Taxes</span>
                <span className="font-bold">₹{formatINR(tax)}</span>
              </div>
              <div className="h-px bg-emerald-900/10 dark:bg-emerald-950/40 my-4" />
              <div className="flex justify-between items-end">
                <span className="font-black text-emerald-900/65 dark:text-emerald-400 uppercase tracking-widest text-xs">Total Amount</span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">₹{formatINR(grandTotal)}</span>
              </div>
            </div>

            <div className="bg-emerald-500/5 p-4 rounded-xl flex items-start gap-3 border border-emerald-500/20">
               <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
               <p className="text-[10px] text-emerald-900/60 dark:text-emerald-250/50 font-medium leading-relaxed">
                  Funds are held in Escrow until delivery confirmation is signed at the destination hub.
               </p>
            </div>

            <button 
              onClick={handlePlaceOrder}
              disabled={items.length === 0 || isProcessing}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-sm relative overflow-hidden transition-all duration-300 cursor-pointer border-0",
                "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-550/30",
                "disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed",
                isProcessing && "text-transparent"
              )}
            >
              Confirm & Place Order
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>

            <div className="text-center">
               <p className="text-[10px] text-emerald-900/60 dark:text-emerald-350/50 font-black uppercase tracking-widest flex items-center justify-center gap-1">
                  <Truck className="w-3 h-3" />
                  Average Delivery: 12-14 Days
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
