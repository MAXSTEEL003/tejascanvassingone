import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Trash2, ArrowRight, X, Building, MapPin, 
  CheckCircle2, Loader2, ShieldCheck, Warehouse, Check, Store,
  MessageSquare, Mail, Plus
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { cn, formatINR } from '../lib/utils';
import { setCollectionDoc } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { getDeliveryLocations, getSelectedDeliveryLocationId, setSelectedDeliveryLocationId, DeliveryLocation } from '../utils/deliveryLocations';

export default function GlobalCartDrawer() {
  const navigate = useNavigate();
  const { items, isOpen, setIsOpen, updateQty, removeItem, clearCart } = useCart();
  
  const [cartStep, setCartStep] = useState<'edit' | 'review'>('edit');
  const [buyerName, setBuyerName] = useState(() => localStorage.getItem('userName') || 'Merchant Store');
  const [loadingDays, setLoadingDays] = useState<number>(5);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any[] | null>(null);

  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => getSelectedDeliveryLocationId());

  // Dynamically resolve primary supplier from stakeholders cache
  const defaultSupplier = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('stakeholders_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.suppliers) && parsed.suppliers[0]?.name) {
          return parsed.suppliers[0].name;
        }
      }
    } catch (e) {}
    return 'ANNAPURNA RICE & AGRO INDUSTRIES';
  }, [isOpen]);

  // Sync profile/buyer name and delivery locations whenever opened
  useEffect(() => {
    if (isOpen) {
      setBuyerName(localStorage.getItem('userName') || 'Merchant Store');
      setDeliveryLocations(getDeliveryLocations());
      setSelectedLocationId(getSelectedDeliveryLocationId());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      setDeliveryLocations(getDeliveryLocations());
      setSelectedLocationId(getSelectedDeliveryLocationId());
    };
    window.addEventListener('delivery_locations_updated', handleUpdate);
    window.addEventListener('selected_delivery_location_changed', handleUpdate);
    return () => {
      window.removeEventListener('delivery_locations_updated', handleUpdate);
      window.removeEventListener('selected_delivery_location_changed', handleUpdate);
    };
  }, []);

  // Map cart items with matched product metadata
  const cartList = React.useMemo(() => {
    return items.map((item) => ({
      product: {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: 'Sona Masoori',
        supplier: item.supplier || defaultSupplier
      },
      qty: item.qty
    }));
  }, [items, defaultSupplier]);

  const totalQty = cartList.reduce((sum, item) => sum + item.qty, 0);
  const totalValuation = cartList.reduce((sum, item) => sum + (item.qty * item.product.price), 0);

  // Group cart items by supplier
  const supplierGroups = React.useMemo(() => {
    const acc: Record<string, typeof cartList> = {};
    cartList.forEach(item => {
      const supplier = item.product.supplier;
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(item);
    });
    return acc;
  }, [cartList]);

  const handlePlaceOrder = async () => {
    if (cartList.length === 0) return;
    setIsPlacingOrder(true);

    try {
      const placedGroupedOrders: any[] = [];
      const userPhone = localStorage.getItem('userPhone') || '';
      const userGstin = localStorage.getItem('userGstin') || '';
      const userAddress = localStorage.getItem('userAddress') || 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022';

      for (const [supplier, supplierItems] of Object.entries(supplierGroups)) {
        const batchId = `TC-${Math.floor(1000 + Math.random() * 9000)}`;
        const grpQty = supplierItems.reduce((sum, item) => sum + item.qty, 0);
        const grpAmt = supplierItems.reduce((sum, item) => sum + (item.qty * item.product.price), 0);

        const subOrders = supplierItems.map(item => ({
          id: `TC-SUB-${Math.floor(100000 + Math.random() * 900000)}`,
          buyer: buyerName || 'Merchant Store',
          qty: item.qty,
          rate: item.product.price,
          product: item.product.name,
          supplier: supplier,
          status: 'Placed',
          loadingDays: loadingDays
        }));

        const initials = (buyerName || 'Merchant Store')
          .split(' ')
          .filter(Boolean)
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'VK';

        const avgRate = Number((grpAmt / (grpQty || 1)).toFixed(2));
        const firstProduct = supplierItems[0]?.product.name || 'Premium Rice';

        const d = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateFormatted = `${d.getDate()}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;

        const chosenLocation = deliveryLocations.find(l => l.id === selectedLocationId) || deliveryLocations[0];
        const finalAddress = chosenLocation?.address || userAddress;
        const finalDestination = chosenLocation ? `${chosenLocation.name} (${chosenLocation.type})` : 'APMC Yard, Bangalore';

        const groupedOrder = {
          id: batchId,
          date: dateFormatted,
          items: supplierItems.map(si => `${si.product.name} (${si.qty} QTLS)`).join(', '),
          total: `₹ ${formatINR(grpAmt)}`,
          status: 'Pending Approval',
          progress: 5,
          origin: supplier.includes('ANNAPURNA') ? 'Ludhiana, PB' : supplier.includes('SAI TEJA') ? 'Nalgonda, TS' : 'Punjab Hub',
          destination: finalDestination,
          buyer: buyerName || 'V.K FOODS',
          supplier: supplier,
          originalOrders: subOrders,
          purchaseOrderSent: true,
          purchaseOrderSentAt: new Date().toISOString(),
          loadingDays: loadingDays,
          gstin: userGstin,
          phone: userPhone,
          address: finalAddress,
          deliveryLocationId: chosenLocation?.id,
          deliveryLocationName: chosenLocation?.name,
          deliveryLocationType: chosenLocation?.type,
          qty: grpQty,
          rate: avgRate,
          product: firstProduct,
          initials: initials,
          urgency: 'Standard',
          color: 'zinc'
        };

        await setCollectionDoc('procurement_requests', batchId, groupedOrder).catch(() => {});

        const existingProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
        localStorage.setItem('procurement_requests', JSON.stringify([groupedOrder, ...existingProcurements]));

        placedGroupedOrders.push(groupedOrder);

        // Auto-dispatch WhatsApp & SMS notifications to buyer for each PO
        const buyerWhatsappMsg = `Hello ${buyerName || 'Valued Buyer'},\n\nYour split Purchase Order ${batchId} for ${grpQty} QTLS has been registered on the Tejas Canvassing platform.\n\nSupplier: ${supplier}\nTotal: ₹ ${formatINR(grpAmt)}\nItems: ${supplierItems.map(si => `${si.product.name} (${si.qty} QTLS)`).join(', ')}\n\nThank you for working with Tejas Canvassing!`;
        
        fetch('/api/dispatch-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userPhone,
            buyerName: buyerName || 'Buyer',
            message: buyerWhatsappMsg
          })
        }).catch(err => console.warn('Drawer WhatsApp note:', err?.message || err));

        fetch('/api/dispatch-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userPhone,
            recipientName: buyerName || 'Buyer',
            message: `Tejas Canvassing: PO ${batchId} registered for ${grpQty} QTLS from ${supplier}. Total ₹${formatINR(grpAmt)}.`
          })
        }).catch(err => console.warn('Drawer SMS note:', err?.message || err));
      }

      setIsOpen(false);
      setOrderSuccess(placedGroupedOrders);
      clearCart();
      setCartStep('edit');
    } catch (err) {
      console.error('Failed placing split orders:', err);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop with click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-[#040f0c]/60 backdrop-blur-sm transition-opacity"
            />

            {/* Sliding Drawer: On mobile max-w-[92vw] so it never completely swallows screen, sm:w-[420px] */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-3 sm:pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-[92vw] sm:w-[420px] max-w-full bg-[#fcfbf9] dark:bg-[#07140f] border-l border-emerald-900/15 dark:border-emerald-950/60 shadow-2xl flex flex-col justify-between h-full rounded-l-3xl overflow-hidden font-sans text-emerald-950 dark:text-emerald-50"
              >
                {/* Mobile Drag Indicator Bar */}
                <div className="w-12 h-1 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

                {/* Header */}
                <div className="px-4 sm:px-5 py-3.5 border-b border-emerald-500/15 dark:border-emerald-950/60 flex items-center justify-between bg-white dark:bg-[#07140f] shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">Procurement Cart</h3>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">TEJAS CANVASSING • Wholesale Direct</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl transition-all cursor-pointer shrink-0"
                    title="Close Cart"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Stepper */}
                {cartList.length > 0 && (
                  <div className="px-4 sm:px-5 py-2 border-b border-slate-200/80 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/60 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    <button
                      onClick={() => setCartStep('edit')}
                      className={cn(
                        "pb-0.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                        cartStep === 'edit' ? "border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold" : "border-transparent text-slate-400 dark:text-slate-500"
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold font-mono",
                        cartStep === 'edit' ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-slate-300"
                      )}>1</span>
                      Cart Items ({totalQty})
                    </button>

                    <span className="text-slate-300 dark:text-neutral-700 font-mono text-[9px]">❯</span>

                    <button
                      onClick={() => setCartStep('review')}
                      className={cn(
                        "pb-0.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                        cartStep === 'review' ? "border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold" : "border-transparent text-slate-400 dark:text-slate-500"
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold font-mono",
                        cartStep === 'review' ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-slate-300"
                      )}>2</span>
                      Mill Split ({Object.keys(supplierGroups).length} POs)
                    </button>
                  </div>
                )}

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                  {cartList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 p-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <ShoppingBag className="w-7 h-7" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-900/60 dark:text-emerald-300/60">Your procurement bag is empty</p>
                      <p className="text-[11px] text-emerald-950/60 dark:text-emerald-300/50 max-w-xs leading-relaxed font-medium">Add grain loads from the catalog to place split supplier orders directly.</p>
                      <button
                        onClick={() => { setIsOpen(false); navigate('/store'); }}
                        className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Store className="w-3.5 h-3.5" />
                        Explore Store
                      </button>
                    </div>
                  ) : cartStep === 'edit' ? (
                    /* STEP 1: ITEM EDITING & QUANTITIES */
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center pb-1 border-b border-dashed border-emerald-500/15">
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-emerald-900/60 dark:text-emerald-300/50">Active Grain Items ({cartList.length})</p>
                        <button 
                          onClick={clearCart} 
                          className="text-[9px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      {cartList.map((item) => (
                        <motion.div
                          key={item.product.id}
                          layout
                          className="p-3 bg-white dark:bg-[#0b1c15] rounded-2xl border border-emerald-500/15 dark:border-emerald-950/50 shadow-sm space-y-2 relative text-left"
                        >
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="absolute top-2.5 right-2.5 text-rose-500/70 hover:text-rose-600 bg-rose-500/10 p-1.5 rounded-lg cursor-pointer transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="pr-7 text-left">
                            <span className="text-[8px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase font-mono">
                              {item.product.category}
                            </span>
                            <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                              {item.product.name}
                            </h4>
                            <p className="text-[8.5px] font-bold text-emerald-900/60 dark:text-emerald-300/50 font-mono mt-0.5 truncate">
                              MILL: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{item.product.supplier}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-500/10 dark:border-emerald-950/30">
                            <div>
                              <p className="text-[8px] font-black uppercase text-emerald-900/40 dark:text-emerald-300/40 leading-none">Rate</p>
                              <p className="text-xs font-black text-emerald-950 dark:text-emerald-50 mt-0.5">₹{formatINR(item.product.price)} <span className="text-[8px] font-normal text-emerald-800/60 dark:text-emerald-300/50">/qtl</span></p>
                            </div>

                            {/* Quantity controller */}
                            <div className="flex items-center bg-emerald-500/[0.04] dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-950/60 rounded-lg overflow-hidden shrink-0">
                              <button
                                type="button"
                                onClick={() => updateQty(item.product.id, Math.max(1, item.qty - 10))}
                                className="px-2.5 py-1 hover:bg-emerald-500/20 text-xs font-black text-emerald-900 dark:text-emerald-200 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  updateQty(item.product.id, isNaN(val) ? 0 : Math.max(1, val));
                                }}
                                className="w-12 text-center bg-transparent border-none text-[11px] font-black font-mono text-emerald-950 dark:text-emerald-50 p-0 focus:ring-0 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateQty(item.product.id, item.qty + 10)}
                                className="px-2.5 py-1 hover:bg-emerald-500/20 text-xs font-black text-emerald-900 dark:text-emerald-200 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Quick bulk increment buttons */}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {[-100, -50, 50, 100].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                onClick={() => updateQty(item.product.id, Math.max(10, item.qty + delta))}
                                className="text-[8.5px] font-bold px-2 py-0.5 bg-emerald-500/[0.05] hover:bg-emerald-500/15 border border-emerald-500/15 text-emerald-900 dark:text-emerald-300 rounded-md transition-all cursor-pointer font-mono"
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    /* STEP 2: SPLIT REVIEW (SUPER COMPACT FORM, MAXIMUM SPACE FOR BILL CONTENTS) */
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-2.5 text-left"
                    >
                      {/* Shop / Godown Delivery Destination Picker */}
                      <div className="p-2.5 bg-white dark:bg-[#0b1c15] border border-emerald-500/15 dark:border-emerald-950/50 rounded-2xl space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[8.5px] font-black uppercase text-emerald-900/60 dark:text-emerald-300/60 border-b border-emerald-500/10 pb-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-emerald-600" /> Dispatch Destination (Shop / Godown)
                          </span>
                          <span className="text-[8px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-mono">
                            {deliveryLocations.length} Registered
                          </span>
                        </div>

                        <div className="space-y-1">
                          <select
                            value={selectedLocationId}
                            onChange={(e) => {
                              setSelectedLocationId(e.target.value);
                              setSelectedDeliveryLocationId(e.target.value);
                            }}
                            className="w-full px-2.5 py-1.5 bg-emerald-500/[0.04] dark:bg-emerald-950/40 border border-emerald-500/20 dark:border-emerald-950/60 rounded-xl text-xs font-bold text-emerald-950 dark:text-emerald-100 outline-none cursor-pointer"
                          >
                            {deliveryLocations.map((loc) => (
                              <option key={loc.id} value={loc.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-neutral-900">
                                {loc.name} ({loc.type})
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const curLoc = deliveryLocations.find(l => l.id === selectedLocationId) || deliveryLocations[0];
                            return curLoc ? (
                              <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium px-1 line-clamp-1 truncate">
                                📍 {curLoc.address}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* Compact Buyer & Days Limit Box inside scroll view */}
                      <div className="p-2.5 bg-white dark:bg-[#0b1c15] border border-emerald-500/15 dark:border-emerald-950/50 rounded-2xl space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[8.5px] font-black uppercase text-emerald-900/60 dark:text-emerald-300/60 border-b border-emerald-500/10 pb-1">
                          <span className="flex items-center gap-1"><Building className="w-2.5 h-2.5 text-emerald-600" /> Buyer Details</span>
                          <span className="flex items-center gap-1 text-[8px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-mono"><MapPin className="w-2.5 h-2.5" /> APMC Yard</span>
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 pt-0.5">
                          {/* Buyer Firm Name */}
                          <div className="col-span-8">
                            <label className="text-[7.5px] font-black uppercase tracking-wider text-emerald-900/60 dark:text-emerald-300/60 block mb-0.5">
                              Buyer Firm Name
                            </label>
                            <input
                              type="text"
                              value={buyerName}
                              onChange={(e) => setBuyerName(e.target.value)}
                              placeholder="e.g. V.K FOODS"
                              className="w-full px-2 py-1 bg-emerald-500/[0.03] dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-950/60 rounded-lg text-xs font-bold text-emerald-950 dark:text-emerald-100 outline-none focus:border-emerald-500"
                              required
                            />
                          </div>

                          {/* Loading Days Limit */}
                          <div className="col-span-4">
                            <label className="text-[7.5px] font-black uppercase tracking-wider text-emerald-900/60 dark:text-emerald-300/60 block mb-0.5">
                              Days Limit
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={loadingDays}
                              onChange={(e) => setLoadingDays(Math.max(1, parseInt(e.target.value) || 3))}
                              className="w-full px-1.5 py-1 bg-emerald-500/[0.03] dark:bg-emerald-950/30 border border-emerald-500/20 dark:border-emerald-950/60 rounded-lg text-xs font-black font-mono text-emerald-950 dark:text-emerald-100 outline-none focus:border-emerald-500 text-center"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Header for Bills */}
                      <p className="text-[9px] font-black uppercase tracking-wider text-emerald-900/70 dark:text-emerald-300/60 pt-0.5">
                        Supplier Bill Partition ({Object.keys(supplierGroups).length} Mill POs)
                      </p>

                      {/* Supplier PO Bills (Primary Bill Contents given maximum room) */}
                      <div className="space-y-2">
                        {Object.entries(supplierGroups).map(([supplier, supplierItems]) => {
                          const grpQty = supplierItems.reduce((acc, curr) => acc + curr.qty, 0);
                          const grpAmt = supplierItems.reduce((acc, curr) => acc + (curr.qty * curr.product.price), 0);
                          return (
                            <div
                              key={supplier}
                              className="bg-white dark:bg-[#0b1c15] border border-emerald-500/15 dark:border-emerald-950/50 rounded-2xl p-2.5 space-y-2 shadow-xs"
                            >
                              {/* Supplier Header */}
                              <div className="flex justify-between items-center bg-emerald-500/[0.06] dark:bg-emerald-500/[0.03] p-1.5 rounded-xl border border-emerald-500/10">
                                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                  <Warehouse className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="text-[9px] font-black text-emerald-950 dark:text-emerald-100 uppercase truncate">
                                    {supplier}
                                  </span>
                                </div>
                                <span className="text-[7.5px] font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-wider bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase shrink-0">
                                  PO Draft
                                </span>
                              </div>

                              {/* Bill Items List */}
                              <div className="space-y-1 divide-y divide-dashed divide-emerald-500/10 dark:divide-emerald-950/30">
                                {supplierItems.map((si) => (
                                  <div key={si.product.id} className="flex justify-between items-center pt-1 first:pt-0">
                                    <div className="min-w-0 pr-2">
                                      <p className="text-[10.5px] font-black text-emerald-950 dark:text-emerald-50 truncate">{si.product.name}</p>
                                      <p className="text-[8.5px] text-emerald-900/60 dark:text-emerald-300/60 font-medium">
                                        {si.qty} QTLS @ ₹{formatINR(si.product.price)}
                                      </p>
                                    </div>
                                    <span className="font-mono text-xs text-emerald-950 dark:text-emerald-100 font-black shrink-0">
                                      ₹{formatINR(si.qty * si.product.price)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Bill Subtotal */}
                              <div className="pt-1.5 border-t border-emerald-500/10 dark:border-emerald-950/30 flex justify-between items-center text-[9px] font-medium text-emerald-900/70 dark:text-emerald-300/60">
                                <span>Vol: <strong className="font-mono font-black text-emerald-950 dark:text-emerald-100">{grpQty} QTLS</strong></span>
                                <span>Valuation: <strong className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-[11px]">₹{formatINR(grpAmt)}</strong></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Security Protocol Badge */}
                      <div className="p-2 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-xl flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <p className="text-[8px] text-emerald-900/70 dark:text-emerald-300/60 leading-tight">
                          Auto-partitioned PO drafts map directly into digital canvassing rules.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Lightweight Compact Fixed Footer */}
                <div className="p-3 bg-white dark:bg-[#05110d] border-t border-emerald-500/15 dark:border-emerald-950/60 space-y-2 shadow-xl shrink-0">
                  {cartStep === 'edit' ? (
                    <>
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-emerald-900/60 dark:text-emerald-300/60 text-[10px] uppercase tracking-wider">Total ({totalQty} QTLS):</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-black">
                          ₹{formatINR(totalValuation)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCartStep('review')}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Proceed to Split Review
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-emerald-900/60 dark:text-emerald-300/60 text-[9.5px] uppercase tracking-wider">Total Valuation:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-black">
                          ₹{formatINR(totalValuation)}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setCartStep('edit')}
                          className="col-span-1 py-2 border border-emerald-500/20 text-emerald-900/70 dark:text-emerald-200 hover:bg-emerald-500/10 text-[9.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                        >
                          Back
                        </button>

                        <button
                          onClick={handlePlaceOrder}
                          disabled={isPlacingOrder || cartList.length === 0}
                          type="button"
                          className="col-span-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-[9.5px] uppercase tracking-wider transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isPlacingOrder ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Placing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Authorize Contract Split
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Success Confirmation Modal */}
      <AnimatePresence>
        {orderSuccess && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderSuccess(null)}
              className="fixed inset-0 bg-[#040f0c]/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#fafdfb] dark:bg-[#071911] border border-emerald-500/20 dark:border-emerald-950/60 rounded-3xl shadow-2xl p-5 space-y-3.5 text-center z-10 text-emerald-950 dark:text-emerald-50 overflow-hidden"
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 mx-auto border border-emerald-500/20">
                <Check className="w-6 h-6 font-black" />
              </div>

              <div>
                <h2 className="text-lg font-black tracking-tight text-emerald-955 dark:text-emerald-50">
                  Split Orders Placed Successfully!
                </h2>
                <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/60 mt-0.5">
                  Your procurement request was partitioned into {orderSuccess.length} distinct supplier agreements.
                </p>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto text-left pr-1">
                {orderSuccess.map((order) => {
                  const phoneNum = (order.phone || '9342380981').replace(/[^0-9]/g, '');
                  const waDigits = phoneNum.length === 10 ? `91${phoneNum}` : phoneNum;
                  const waText = encodeURIComponent(`Tejas Canvassing PO ${order.id}: ${order.qty} QTLS ${order.product} confirmed for ${order.buyer} from ${order.supplier}. Total: ${order.total}`);
                  return (
                    <div key={order.id} className="p-3 bg-white dark:bg-[#0b1c15] border border-emerald-500/15 rounded-xl text-xs space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center font-mono font-bold">
                        <span className="text-emerald-600 font-extrabold">{order.id}</span>
                        <span className="text-emerald-950 dark:text-emerald-100">{order.total}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-emerald-900/80 dark:text-emerald-200/80 truncate">{order.items}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-500/10">
                        <p className="text-[9px] font-mono text-emerald-600/80 uppercase truncate max-w-[140px]">{order.supplier}</p>
                        <div className="flex gap-1.5">
                          <a
                            href={`https://api.whatsapp.com/send?phone=${waDigits}&text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 rounded text-[9px] font-bold hover:bg-emerald-600/20 flex items-center gap-1 no-underline"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            WhatsApp
                          </a>
                          <a
                            href={`sms:+${waDigits}?body=${waText}`}
                            className="px-2 py-1 bg-blue-600/10 text-blue-700 dark:text-blue-300 rounded text-[9px] font-bold hover:bg-blue-600/20 flex items-center gap-1 no-underline"
                          >
                            <Mail className="w-2.5 h-2.5" />
                            SMS
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setOrderSuccess(null)}
                  className="flex-1 py-2 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs font-black uppercase rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                    navigate('/placed-orders');
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl shadow-md cursor-pointer"
                >
                  View Orders
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
