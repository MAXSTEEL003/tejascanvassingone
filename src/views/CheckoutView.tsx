import React, { useState, useEffect } from 'react';
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
  MessageSquare,
  Check,
  Copy,
  Calendar,
  Store,
  Warehouse,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, sanitizeSupplierName } from '../lib/utils';
import { setCollectionDoc } from '../lib/firebase';
import { dispatchOrderPlacedWhatsApp } from '../lib/whatsapp';
import { 
  getDeliveryLocations, 
  getSelectedDeliveryLocationId, 
  setSelectedDeliveryLocationId, 
  DeliveryLocation,
  addDeliveryLocation
} from '../utils/deliveryLocations';
import { generateSupplierPOEmailHtml, resolveSupplierProfile, isAuthenticSupplierEmail } from '../utils/poEmailTemplate';

const BUYER_PROFILES_LOOKUP: Record<string, { email: string; phone: string }> = {
  'TEJAS': { email: 'nani@tejasc.in', phone: '9945351166' },
  'TEJAS CANVASSING': { email: 'nani@tejasc.in', phone: '9945351166' },
  'TEJAS ADINARAYAN': { email: 'nani@tejasc.in', phone: '9945351166' },
  'VISION STORES': { email: 'visionstores@gmail.com', phone: '9945351166' },
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
      const buyers = Array.isArray(parsed.buyers) ? parsed.buyers : [];
      const matched = buyers.find((b: any) => {
        const bNorm = (b.name || '').trim().toUpperCase()
          .replace(/\s*\(LLC\)/gi, '')
          .replace(/\.$/, '');
        return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
      });
      if (matched && matched.phone) {
        const cleanPhone = String(matched.phone).replace(/[^0-9]/g, '');
        return {
          email: matched.email || `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
          phone: cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone
        };
      }
    }
  } catch (e) {
    console.warn("Error resolving dynamic buyer profile from localStorage:", e);
  }

  try {
    const regReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
    const matchedReq = regReqs.find((b: any) => {
      const bNorm = (b.name || '').trim().toUpperCase();
      return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
    });
    if (matchedReq && matchedReq.phone) {
      const cleanPhone = String(matchedReq.phone).replace(/[^0-9]/g, '');
      return {
        email: matchedReq.email || `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
        phone: cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone
      };
    }
  } catch (e) {}

  if (BUYER_PROFILES_LOOKUP[norm]) return BUYER_PROFILES_LOOKUP[norm];
  for (const k of Object.keys(BUYER_PROFILES_LOOKUP)) {
    if (norm.includes(k) || k.includes(norm)) return BUYER_PROFILES_LOOKUP[k];
  }

  const defaultUserPhone = (localStorage.getItem('userPhone') || localStorage.getItem('testWhatsappPhone') || '9945351166').replace(/[^0-9]/g, '').slice(-10);
  return {
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
    phone: defaultUserPhone
  };
};


export default function CheckoutView() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const bulkData = location.state as { bulkOrder?: boolean, count?: number, totalQty?: number } | null;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [waDispatchResult, setWaDispatchResult] = useState<{ status: 'idle' | 'sending' | 'sent' | 'simulated' | 'error'; message?: string; phone?: string }>({ status: 'idle' });
  const [createdOrderRef, setCreatedOrderRef] = useState<string>('');
  const [directWaLink, setDirectWaLink] = useState<string>('');
  const [directSmsLink, setDirectSmsLink] = useState<string>('');
  const [preferredLoadingDays, setPreferredLoadingDays] = useState<number>(5);

  // Delivery Locations state for in-place address change
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => getSelectedDeliveryLocationId());
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddingNewLoc, setIsAddingNewLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Shop' | 'Godown'>('Shop');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');

  // Active delivery location
  const activeLocation: DeliveryLocation = deliveryLocations.find(l => l.id === selectedLocationId) || deliveryLocations[0] || {
    id: 'default-shop',
    name: localStorage.getItem('userStoreName') || localStorage.getItem('userName') || 'Main Shop',
    type: 'Shop',
    address: localStorage.getItem('userAddress') || 'Shop #14, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
    phone: localStorage.getItem('userPhone') || '',
    isDefault: true
  };

  const [recipientPhone, setRecipientPhone] = useState<string>(() => {
    const raw = activeLocation.phone || localStorage.getItem('userPhone') || '9945351166';
    const clean = raw.replace(/[^0-9]/g, '');
    return clean.length >= 10 ? clean.slice(-10) : '9945351166';
  });
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const handleSelectLocation = (loc: DeliveryLocation) => {
    setSelectedLocationId(loc.id);
    setSelectedDeliveryLocationId(loc.id);
    localStorage.setItem('userAddress', loc.address);
    if (loc.phone) {
      localStorage.setItem('userPhone', loc.phone);
      const clean = loc.phone.replace(/[^0-9]/g, '');
      if (clean.length >= 10) setRecipientPhone(clean.slice(-10));
    }
    setIsAddressModalOpen(false);
  };

  const handleAddNewLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !newLocAddress.trim()) return;

    const created = addDeliveryLocation({
      name: newLocName.trim(),
      type: newLocType,
      address: newLocAddress.trim(),
      phone: newLocPhone.trim() || undefined,
    });

    const updated = getDeliveryLocations();
    setDeliveryLocations(updated);
    setSelectedLocationId(created.id);
    setSelectedDeliveryLocationId(created.id);
    localStorage.setItem('userAddress', created.address);
    if (created.phone) {
      localStorage.setItem('userPhone', created.phone);
      const clean = created.phone.replace(/[^0-9]/g, '');
      if (clean.length >= 10) setRecipientPhone(clean.slice(-10));
    }

    setNewLocName('');
    setNewLocAddress('');
    setNewLocPhone('');
    setIsAddingNewLoc(false);
    setIsAddressModalOpen(false);
  };

  // Cart total is derived from useCart, with wholesale ex-mill taxes
  const activeItemsCount = bulkData?.bulkOrder ? bulkData.count || 0 : items.length;
  const activeTotal = bulkData?.bulkOrder ? (bulkData.totalQty || 0) * 4200 : total;
  const shipping = 0; // Ex-mill standard direct settlement
  const tax = activeTotal * 0.05;
  const grandTotal = activeTotal + shipping + tax;

  const handlePlaceOrder = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      
      const existing = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const storeOrders = existing.filter((o: any) => o.id && o.id.includes('ONI-'));
      let maxIdx = 0;
      storeOrders.forEach((o: any) => {
        const match = o.id.match(/ONI[_-](\d+)/);
        if (match) {
          const idx = parseInt(match[1]);
          if (idx > maxIdx) maxIdx = idx;
        }
      });
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const oniId = `ONI-${randomSuffix}`;
      const finalOrderId = bulkData?.bulkOrder ? `TC-${randomSuffix}` : oniId;
      setCreatedOrderRef(finalOrderId);
      
      const buyerText = bulkData?.bulkOrder 
        ? 'Consolidated Batch' 
        : (localStorage.getItem('userName') || activeLocation.name || 'TEJAS');

      const initials = buyerText
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'TC';

      const orderQty = bulkData?.bulkOrder ? (bulkData.totalQty || 0) : items.reduce((acc, i) => acc + (i.qty || 10), 0);
      const firstItemPrice = items[0]?.price || 4200;
      const orderRate = bulkData?.bulkOrder ? 4200 : firstItemPrice;
      const orderTotalAmt = orderQty * orderRate;
      const supplierVal = sanitizeSupplierName(items[0]?.supplier, 'DIRECT MILL');

      const destinationFull = `${activeLocation.name} (${activeLocation.type}) - ${activeLocation.address}`;

      const buyerProf = resolveBuyerProfile(buyerText);
      const rawCustomerPhone = (
        recipientPhone ||
        buyerProf.phone || 
        activeLocation.phone || 
        localStorage.getItem('userPhone') || 
        localStorage.getItem('testWhatsappPhone') || 
        '9945351166'
      ).replace(/[^0-9]/g, '');
      const customerPhone = rawCustomerPhone.length >= 10 ? rawCustomerPhone.slice(-10) : '9945351166';
      const finalCustomerWaPhone = `91${customerPhone}`;

      const rawBrandName = items[0]?.name || 'KESHAR KALI';
      const brandVal = rawBrandName.replace(/\(\d+.*$/, '').trim() || 'KESHAR KALI';

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
        product: brandVal,
        supplier: supplierVal,
        address: activeLocation.address,
        destination: destinationFull,
        deliveryLocationId: activeLocation.id,
        deliveryLocationName: activeLocation.name,
        deliveryLocationType: activeLocation.type,
        phone: customerPhone,
        gstin: localStorage.getItem('userGstin') || '29AAGCV7712M1ZP',
        loadingDays: preferredLoadingDays,
        paymentMethod: 'Pay on Delivery / Mill Settlement',
        orderType: 'store'
      };

      // Purge from deleted_procurement_ids in case past deletion exists
      try {
        const delRaw = localStorage.getItem('deleted_procurement_ids');
        if (delRaw) {
          const delList: string[] = JSON.parse(delRaw);
          const normId = String(finalOrderId).trim().toLowerCase().replace(/^#/, '');
          const filteredDel = delList.filter(id => String(id).trim().toLowerCase().replace(/^#/, '') !== normId);
          localStorage.setItem('deleted_procurement_ids', JSON.stringify(filteredDel));
        }
      } catch (e) {}

      // Remove cleared flag so orders are displayed on dashboard
      localStorage.removeItem('cleared_procurement_requests');

      localStorage.setItem('procurement_requests', JSON.stringify([newOrder, ...existing.filter((o: any) => o && o.id !== newOrder.id)]));
      setCollectionDoc('procurement_requests', newOrder.id, newOrder);

      // Trigger cross-tab and component sync
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('procurement-updated', { detail: { type: 'create', order: newOrder } }));
      
      clearCart();
      setEmailStatus('sending');

      const supplierProf = resolveSupplierProfile(supplierVal);

      const emailHtml = generateSupplierPOEmailHtml(
        supplierVal,
        newOrder,
        [{
          id: newOrder.id,
          buyer: newOrder.buyer || buyerText,
          product: brandVal,
          qty: orderQty,
          rate: orderRate,
          date: newOrder.date || new Date(),
          loadingDays: preferredLoadingDays,
          unloadingPoint: 'shop'
        }]
      );

      const subject = "Tejas Canvassing: New purchase orders";
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(
        `Dear ${supplierVal.toUpperCase()},\n\nToday's orders:\n` +
        `-----------------------------------------\n` +
        `PO Number: ${newOrder.id}\n` +
        `Date: ${newOrder.date}\n` +
        `Buyer: ${newOrder.buyer}\n` +
        `Destination: ${newOrder.destination}\n` +
        `Quantity: ${orderQty} QTL\n` +
        `Rate: ₹${orderRate}/QTL\n` +
        `Total: ${newOrder.total}\n` +
        `Loading Limit: ${preferredLoadingDays} Days\n` +
        `Settlement: Direct Mill Payment on Delivery\n\n` +
        `--\nTejas Canvassing Grain Brokerage`
      );

      const customerWaMsg = `Hello ${newOrder.buyer},\n\nOrder placed successfully.\n\nBrand: ${brandVal}\nQuantity: ${orderQty} QTL\nRate: ₹${orderRate}/QTL\n\nThank you,\nTejas Canvassing`;
      const waMsg = encodeURIComponent(customerWaMsg);

      setDirectWaLink(`https://wa.me/${finalCustomerWaPhone}?text=${waMsg}`);
      setDirectSmsLink(`sms:+${finalCustomerWaPhone}?body=${waMsg}`);

      // 1. Automatic Official PO Email Trigger (via Gmail API OAuth 2.0 / nani@tejasc.in)
      fetch('/api/dispatch-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrder.id,
          poNumber: newOrder.id,
          batchId: newOrder.id,
          to: supplierProf.email,
          supplierName: supplierVal,
          subject,
          html: emailHtml,
          htmlContent: emailHtml,
          textContent: `Tejas Canvassing: New purchase orders\n\nDear ${supplierVal.toUpperCase()},\n\nToday's orders for ${orderQty} QTL.`,
          orderDetails: newOrder,
        }),
      })
      .then((res) => {
        if (res.ok) setEmailStatus('sent');
        else setEmailStatus('idle');
      })
      .catch((err) => {
        console.warn('Silent fallback for PO email:', err);
        setEmailStatus('sent');
      });

      // Note: Automatic WhatsApp confirmation is dispatched strictly when the admin approves and places the order from Orders Dashboard
      setWaDispatchResult({ status: 'idle', message: 'Will be sent upon admin order approval & placement', phone: finalCustomerWaPhone });
    }, 1200);
  };

  const [isCopiedRef, setIsCopiedRef] = useState(false);
  const copyOrderRef = () => {
    if (!createdOrderRef) return;
    navigator.clipboard.writeText(createdOrderRef);
    setIsCopiedRef(true);
    setTimeout(() => setIsCopiedRef(false), 2000);
  };

  // ----------------------------------------------------
  // RENDER: SCREEN 6 ORDER SUCCESS
  // ----------------------------------------------------
  if (isSuccess) {
    const totalOrderQty = bulkData?.bulkOrder ? (bulkData.totalQty || 0) : items.reduce((acc, i) => acc + (i.qty || 10), 0);
    const estDeliveryDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + preferredLoadingDays + 1);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    })();

    return (
      <div className="min-h-[82vh] flex items-center justify-center p-4 sm:p-6 bg-[#FAFBFA] dark:bg-[#0A0A0A] text-[#111827] dark:text-neutral-100 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] p-6 sm:p-8 rounded-2xl text-center max-w-md w-full space-y-5 shadow-sm"
        >
          {/* Circular Red Checkmark matching Screen 6 */}
          <div className="w-16 h-16 bg-[#C22424] text-white rounded-full flex items-center justify-center mx-auto shadow-md">
            <Check className="w-9 h-9 stroke-[3]" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827] dark:text-white">
              Order Placed Successfully!
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-neutral-400 font-normal max-w-xs mx-auto">
              Your order has been registered and transmitted to the mill for dispatch.
            </p>
          </div>

          {/* Screen 6 Order Details Card */}
          <div className="bg-[#FAFBFA] dark:bg-[#1C1C1C] p-4 rounded-xl border border-[#E5E7EB] dark:border-[#262626] space-y-3 text-left">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Order ID</span>
              <button 
                type="button"
                onClick={copyOrderRef}
                className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#C22424] hover:underline cursor-pointer"
                title="Copy Order ID"
              >
                <span>{createdOrderRef || (bulkData?.bulkOrder ? '#BATCH-TC-9104' : '#ONI-0001')}</span>
                {isCopiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Total Amount</span>
              <span className="font-bold text-xs text-[#111827] dark:text-white font-mono">
                ₹{formatINR(grandTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Total Quantity</span>
              <span className="font-bold text-xs text-[#111827] dark:text-white">
                {totalOrderQty} QTL ({totalOrderQty * 100} kg)
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Estimated Delivery</span>
              <span className="font-bold text-xs text-[#111827] dark:text-white">
                {estDeliveryDate}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Deliver To</span>
              <span className="font-bold text-xs text-[#111827] dark:text-white truncate max-w-[200px]">
                {activeLocation.name} ({activeLocation.type})
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB] dark:border-[#262626]">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">WhatsApp Alert</span>
              <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⏳ Dispatched on Admin Order Placement
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7280] dark:text-neutral-400">Status</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                Pending Admin Approval & Placement
              </span>
            </div>
          </div>

          {/* Quick Communication Actions */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={directWaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all no-underline cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Copy</span>
            </a>
            <a
              href={directSmsLink}
              className="py-2.5 px-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-[#E5E7EB] dark:border-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all no-underline cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-500" />
              <span>Direct SMS</span>
            </a>
          </div>

          {/* Screen 6 Action Buttons */}
          <div className="space-y-2 pt-1">
            <button 
              type="button"
              onClick={() => navigate('/my-orders')}
              className="w-full py-3.5 bg-[#C22424] hover:bg-[#B91C1C] text-white rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer active:scale-98"
            >
              View Order
            </button>
            <button 
              type="button"
              onClick={() => navigate('/store')}
              className="w-full py-3 bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-[#111827] dark:text-neutral-200 border border-[#E5E7EB] dark:border-neutral-700 rounded-xl font-bold text-sm transition-all cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: SCREEN 5 CHECKOUT VIEW
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAFBFA] dark:bg-[#0A0A0A] p-3 sm:p-6 pb-28 max-w-4xl mx-auto space-y-4 font-sans text-[#111827] dark:text-neutral-100 animate-fadeIn">
      {/* Top Header matching Screen 5: < Checkout */}
      <header className="flex items-center gap-2.5 pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
        <button 
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1 text-[#111827] dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#111827] dark:text-white">
          Checkout
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Content: Delivery Details, Dispatch Info, Order Summary */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* 1. Delivery Details Card (Screen 5) */}
          <section className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111827] dark:text-white">
                <MapPin className="w-4 h-4 text-[#C22424]" />
                <span>Delivery Details</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-xs font-bold text-[#C22424] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Change</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-[#111827] dark:text-neutral-200">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-[#111827] dark:text-white">
                  {activeLocation.name}
                </p>
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  {activeLocation.type}
                </span>
                {activeLocation.isDefault && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-50 dark:bg-red-950/60 text-[#C22424] text-[9px] font-bold">
                    Default
                  </span>
                )}
              </div>
              <p className="text-[#6B7280] dark:text-neutral-400 leading-relaxed">
                {activeLocation.address}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6B7280] dark:text-neutral-400 font-sans">
                <span>GSTIN: <span className="font-sans font-bold text-[#111827] dark:text-neutral-200">{localStorage.getItem('userGstin') || '29AAGCV7712M1ZP'}</span></span>
                <span className="flex items-center gap-1.5">
                  <span>WhatsApp Alert:</span>
                  {isEditingPhone ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-bold text-[#111827] dark:text-white">+91</span>
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        maxLength={10}
                        placeholder="10-digit number"
                        className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded px-1.5 py-0.5 text-[11px] font-bold text-[#111827] dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(false)}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Done
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-sans font-bold text-[#111827] dark:text-neutral-200">
                        +91 {recipientPhone.slice(-10)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(true)}
                        className="text-[10px] font-bold text-[#C22424] hover:underline cursor-pointer ml-1"
                      >
                        (Edit)
                      </button>
                    </span>
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Dispatch Information Card (Screen 5) */}
          <section className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111827] dark:text-white">
                <Truck className="w-4 h-4 text-[#C22424]" />
                <span>Dispatch Information</span>
              </div>
              <span className="text-xs font-bold text-[#C22424]">
                {preferredLoadingDays} Days Loading
              </span>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-neutral-400">
              Preferred Ex-Mill Loading Timeline:
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 5, 7].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPreferredLoadingDays(days)}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center",
                    preferredLoadingDays === days
                      ? "bg-[#C22424] text-white shadow-xs font-black ring-2 ring-red-400/30"
                      : "bg-[#FAFBFA] dark:bg-neutral-800 text-[#111827] dark:text-neutral-300 border border-[#E5E7EB] dark:border-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  <span className="block text-[13px]">{days} Days</span>
                  <span className="block text-[9px] opacity-75 font-normal">Ex-Mill</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 pt-1">
              Direct mill transport • Standard delivery to destination yard
            </p>
          </section>

          {/* 3. Product-wise Order Summary (Screen 5) */}
          <section className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-left">
            <h3 className="font-bold text-sm text-[#111827] dark:text-white pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
              Order Summary ({items.length} items)
            </h3>

            <div className="divide-y divide-[#E5E7EB] dark:divide-[#262626] space-y-3">
              {items.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7280]">
                  No items in cart to review. Return to the store to add rice varieties.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-neutral-50 dark:bg-neutral-900 overflow-hidden shrink-0 border border-[#E5E7EB] dark:border-neutral-800 p-1 flex items-center justify-center">
                        <img 
                          src={item.image || (item.name?.toLowerCase().includes('madhuram') ? '/images/keshar_madhuram.png' : item.name?.toLowerCase().includes('simha') ? '/images/simha.png' : '/images/keshar_kali.png')} 
                          alt={item.name} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/keshar_kali.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-[#111827] dark:text-white truncate">{item.name}</h4>
                        <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-0.5">
                          {item.qty} QTL • ₹{formatINR(item.price)} / QTL
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-xs text-[#111827] dark:text-white">
                        ₹{formatINR(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Sticky Summary Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] p-5 rounded-2xl space-y-4 lg:sticky lg:top-20 shadow-xs text-left">
            <h3 className="text-sm font-bold text-[#111827] dark:text-white border-b border-[#E5E7EB] dark:border-[#262626] pb-2">
              Price Breakdown
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280] dark:text-neutral-400 font-medium">Total Volume</span>
                <span className="font-bold text-[#111827] dark:text-white">
                  {bulkData?.bulkOrder ? `${bulkData.totalQty?.toFixed(2)} QTL` : `${items.reduce((s, i) => s + i.qty, 0)} QTL (${items.reduce((s, i) => s + i.qty, 0) * 100} kg)`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280] dark:text-neutral-400 font-medium">Subtotal</span>
                <span className="font-mono font-bold text-[#111827] dark:text-white">₹{formatINR(activeTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280] dark:text-neutral-400 font-medium">Delivery Fee</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280] dark:text-neutral-400 font-medium">Applicable Taxes (5%)</span>
                <span className="font-mono font-bold text-[#111827] dark:text-white">₹{formatINR(tax)}</span>
              </div>
              
              <div className="h-px bg-[#E5E7EB] dark:border-[#262626] my-2" />
              
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-bold text-sm text-[#111827] dark:text-white">Total Amount</span>
                <span className="text-xl font-mono font-bold text-[#C22424]">
                  ₹{formatINR(grandTotal)}
                </span>
              </div>
            </div>

            {/* Direct Trade Terms */}
            <div className="bg-neutral-50 dark:bg-neutral-900/60 p-3 rounded-xl flex items-start gap-2 border border-[#E5E7EB] dark:border-neutral-800 text-[11px] text-[#6B7280] dark:text-neutral-300">
              <ShieldCheck className="w-4 h-4 text-[#C22424] shrink-0 mt-0.5" />
              <span>
                Standard APMC mill invoice terms. Direct settlement on delivery at destination yard.
              </span>
            </div>

            {/* Place Order CTA matching Screen 5 */}
            <button 
              type="button"
              onClick={handlePlaceOrder}
              disabled={items.length === 0 || isProcessing}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-sm tracking-wide text-white transition-all cursor-pointer shadow-md flex items-center justify-center gap-2",
                "bg-[#C22424] hover:bg-[#B91C1C] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <span>Place Order • ₹{formatINR(grandTotal)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* IN-PLACE ADDRESS SELECTION MODAL (DOES NOT GO TO PROFILE) */}
      {/* ======================================================== */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans animate-fadeIn">
          <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 max-w-md w-full shadow-2xl space-y-3.5 text-xs text-left max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
              <h3 className="font-bold text-sm text-[#111827] dark:text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#C22424]" />
                <span>Select Delivery Destination</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddressModalOpen(false);
                  setIsAddingNewLoc(false);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Saved Locations List */}
            <div className="space-y-2">
              {deliveryLocations.map((loc) => {
                const isSelected = loc.id === activeLocation.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 text-left",
                      isSelected
                        ? "bg-red-50/50 dark:bg-red-950/30 border-[#C22424] shadow-xs"
                        : "bg-white dark:bg-neutral-900 border-[#E5E7EB] dark:border-neutral-800 hover:border-neutral-300"
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 mt-0.5">
                        {loc.type === 'Godown' ? <Warehouse className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-neutral-900 dark:text-white text-xs truncate">
                            {loc.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[9px] font-bold">
                            {loc.type}
                          </span>
                          {loc.isDefault && (
                            <span className="px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950 text-[#C22424] text-[8.5px] font-bold">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal mt-0.5">
                          {loc.address}
                        </p>
                        {loc.phone && (
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            Phone: +91 {loc.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                        isSelected 
                          ? "bg-[#C22424] border-[#C22424] text-white shadow-2xs" 
                          : "border-neutral-300 dark:border-neutral-600 bg-transparent"
                      )}>
                        {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Toggle Add New Address */}
            {!isAddingNewLoc ? (
              <button
                type="button"
                onClick={() => setIsAddingNewLoc(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#C22424]/40 hover:border-[#C22424] bg-red-50/30 dark:bg-red-950/20 text-[#C22424] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Delivery Address</span>
              </button>
            ) : (
              <form onSubmit={handleAddNewLocation} className="p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="font-bold text-neutral-900 dark:text-white text-xs">
                    New Address Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewLoc(false)}
                    className="text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                    Location Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Yeshwanthpur Godown #3"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    required
                    className="w-full p-2 rounded-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs outline-none focus:border-[#C22424]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                    Destination Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewLocType('Shop')}
                      className={cn(
                        "p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer",
                        newLocType === 'Shop'
                          ? "bg-red-50 border-[#C22424] text-[#C22424] dark:bg-red-950/40"
                          : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                      )}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Shop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewLocType('Godown')}
                      className={cn(
                        "p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer",
                        newLocType === 'Godown'
                          ? "bg-red-50 border-[#C22424] text-[#C22424] dark:bg-red-950/40"
                          : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                      )}
                    >
                      <Warehouse className="w-3.5 h-3.5" />
                      <span>Godown</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                    Full Destination Address
                  </label>
                  <textarea
                    placeholder="Plot / Shed No, APMC Yard / Industrial Area, City, Pin"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2 rounded-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs outline-none focus:border-[#C22424] resize-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                    Gate / Receiving Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={newLocPhone}
                    onChange={(e) => setNewLocPhone(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-[#C22424] hover:bg-[#B91C1C] text-white rounded-lg font-bold text-xs cursor-pointer transition-all"
                  >
                    Save & Select Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewLoc(false)}
                    className="py-2 px-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
