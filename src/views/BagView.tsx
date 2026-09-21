import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Trash2, ArrowRight, MapPin, CheckCircle2, 
  Loader2, Store, Warehouse, Plus, Truck, Share2, Copy, Check, X,
  ChevronLeft, AlertCircle, ShieldCheck
} from 'lucide-react';
import { useCart, CartItem } from '../context/CartContext';
import { cn, formatINR } from '../lib/utils';
import { setCollectionDoc } from '../lib/firebase';
import { 
  getDeliveryLocations, 
  getSelectedDeliveryLocationId, 
  setSelectedDeliveryLocationId, 
  DeliveryLocation,
  addDeliveryLocation
} from '../utils/deliveryLocations';

export default function BagView() {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, clearCart, updateItemLocation, updateAllLocations } = useCart();
  
  const [buyerName, setBuyerName] = useState(() => localStorage.getItem('userName') || 'Merchant Store');
  const [loadingDays, setLoadingDays] = useState<number>(5);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any[] | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Delivery locations
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [globalLocationId, setGlobalLocationId] = useState<string>(() => getSelectedDeliveryLocationId());

  // Add location modal
  const [isAddLocOpen, setIsAddLocOpen] = useState(false);
  const [addLocTargetItemId, setAddLocTargetItemId] = useState<string | null>(null);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Shop' | 'Godown'>('Shop');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');

  useEffect(() => {
    setBuyerName(localStorage.getItem('userName') || 'Merchant Store');
    setDeliveryLocations(getDeliveryLocations());
    setGlobalLocationId(getSelectedDeliveryLocationId());
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setDeliveryLocations(getDeliveryLocations());
      setGlobalLocationId(getSelectedDeliveryLocationId());
    };
    window.addEventListener('delivery_locations_updated', handleUpdate);
    window.addEventListener('selected_delivery_location_changed', handleUpdate);
    return () => {
      window.removeEventListener('delivery_locations_updated', handleUpdate);
      window.removeEventListener('selected_delivery_location_changed', handleUpdate);
    };
  }, []);

  // Helper to get location for an item
  const getItemLocation = (item: CartItem): DeliveryLocation => {
    const locId = item.deliveryLocationId || globalLocationId;
    return deliveryLocations.find(l => l.id === locId) || deliveryLocations[0] || {
      id: 'default-shop',
      name: 'Main Shop',
      type: 'Shop',
      address: 'APMC Yard, Bangalore',
      isDefault: true
    };
  };

  // Totals: Rate is strictly per Qty
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Change location for single item
  const handleItemLocationChange = (itemId: string, locationId: string) => {
    if (locationId === '__add_new__') {
      setAddLocTargetItemId(itemId);
      setIsAddLocOpen(true);
      return;
    }
    const loc = deliveryLocations.find(l => l.id === locationId);
    if (!loc) return;
    updateItemLocation(itemId, loc.id, {
      name: loc.name,
      address: loc.address,
      type: loc.type,
    });
  };

  // Change global location for all items
  const handleGlobalLocationChange = (locationId: string) => {
    if (locationId === '__add_new__') {
      setAddLocTargetItemId(null);
      setIsAddLocOpen(true);
      return;
    }
    const loc = deliveryLocations.find(l => l.id === locationId);
    if (!loc) return;
    setGlobalLocationId(loc.id);
    setSelectedDeliveryLocationId(loc.id);
    updateAllLocations(loc.id, {
      name: loc.name,
      address: loc.address,
      type: loc.type,
    });
  };

  // Save new delivery address
  const handleCreateLocation = (e: React.FormEvent) => {
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

    if (addLocTargetItemId) {
      updateItemLocation(addLocTargetItemId, created.id, {
        name: created.name,
        address: created.address,
        type: created.type,
      });
    } else {
      setGlobalLocationId(created.id);
      setSelectedDeliveryLocationId(created.id);
      updateAllLocations(created.id, {
        name: created.name,
        address: created.address,
        type: created.type,
      });
    }

    setNewLocName('');
    setNewLocAddress('');
    setNewLocPhone('');
    setIsAddLocOpen(false);
    setAddLocTargetItemId(null);
  };

  // Place order: Strictly NO payment method asked!
  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setIsPlacingOrder(true);

    try {
      const orderBatchId = `PO-${Date.now().toString().slice(-6)}`;
      const timestamp = new Date().toISOString();
      const userPhone = localStorage.getItem('userPhone') || '9342380981';
      const userEmail = localStorage.getItem('userEmail') || '';

      const placedOrders = items.map((item, idx) => {
        const itemLoc = getItemLocation(item);
        const destinationText = itemLoc 
          ? `${itemLoc.name} (${itemLoc.type}) - ${itemLoc.address}`
          : 'Direct Mill Delivery';

        return {
          id: `${orderBatchId}-${idx + 1}`,
          orderBatchId,
          productName: item.name,
          brand: item.brand || item.name,
          variety: item.variety || 'Rice',
          supplier: item.supplier || 'DIRECT MILL',
          qty: item.qty,
          rate: item.price, // Rate is per Qty
          rateUnit: 'Qty',
          total: item.price * item.qty,
          weight: item.weight || '26kg',
          status: 'Order Placed',
          buyerName,
          buyerPhone: userPhone,
          buyerEmail: userEmail,
          destination: destinationText,
          deliveryLocationId: itemLoc?.id,
          deliveryLocationName: itemLoc?.name,
          deliveryLocationType: itemLoc?.type,
          loadingDays,
          paymentMethod: 'Pay on Delivery / Mill Settlement',
          createdAt: timestamp,
        };
      });

      // Save to local storage
      try {
        const existingRaw = localStorage.getItem('placed_orders');
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem('placed_orders', JSON.stringify([...placedOrders, ...existing]));
      } catch (err) {
        console.warn('Storage warning:', err);
      }

      // Sync to Firebase
      for (const ord of placedOrders) {
        try {
          await setCollectionDoc('orders', ord.id, ord);
        } catch (fbErr) {
          console.warn('Firebase error:', fbErr);
        }
      }

      clearCart();
      setOrderSuccess(placedOrders);
    } catch (err) {
      console.error('Order error:', err);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // WhatsApp share
  const handleShareWhatsApp = () => {
    if (!orderSuccess || orderSuccess.length === 0) return;
    const batchId = orderSuccess[0]?.orderBatchId;
    let msg = `*ORDER CONFIRMATION: ${batchId}*\n`;
    msg += `Buyer: ${buyerName}\n`;
    msg += `Loading Time: ${loadingDays} Days\n`;
    msg += `Payment: Pay on Delivery (No Advance)\n\n`;
    msg += `*ITEMS:*\n`;

    orderSuccess.forEach((o, i) => {
      msg += `${i + 1}. ${o.productName}\n`;
      msg += `   Qty: ${o.qty} | Rate: ₹${o.rate} / Qty\n`;
      msg += `   Total: ₹${formatINR(o.total)}\n`;
      msg += `   Deliver to: ${o.destination}\n\n`;
    });

    const grand = orderSuccess.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalQ = orderSuccess.reduce((sum, o) => sum + Number(o.qty || 0), 0);
    msg += `*Total Qty:* ${totalQ} Qty\n*Total Amount:* ₹${formatINR(grand)}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopySummary = () => {
    if (!orderSuccess || orderSuccess.length === 0) return;
    const batchId = orderSuccess[0]?.orderBatchId;
    let text = `ORDER: ${batchId}\nBuyer: ${buyerName}\nLoading: ${loadingDays} Days\n\n`;
    orderSuccess.forEach(o => {
      text += `• ${o.productName} - ${o.qty} Qty @ ₹${o.rate}/Qty = ₹${formatINR(o.total)} -> ${o.destination}\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // ----------------------------------------------------
  // RENDER: ORDER CONFIRMED SCREEN
  // ----------------------------------------------------
  if (orderSuccess) {
    const successBatchId = orderSuccess[0]?.orderBatchId;
    const successTotalVal = orderSuccess.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const successTotalQty = orderSuccess.reduce((sum, o) => sum + Number(o.qty || 0), 0);

    return (
      <div className="p-3 max-w-sm sm:max-w-md mx-auto pb-28 text-center space-y-4 font-sans animate-fadeIn">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mt-3 shadow-xs">
          <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Order Placed Successfully!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Order ID: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{successBatchId}</strong>
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-white dark:bg-[#0c1f17] border border-slate-200 dark:border-emerald-950 rounded-2xl p-3 text-left space-y-2.5 shadow-xs text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-emerald-950/50">
            <span className="font-bold text-slate-500">Items ({orderSuccess.length})</span>
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
              ₹{formatINR(successTotalVal)}
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {orderSuccess.map((ord) => (
              <div key={ord.id} className="p-2 rounded-xl bg-slate-50 dark:bg-emerald-950/30 border border-slate-100 dark:border-emerald-950/40 space-y-1">
                <div className="flex justify-between items-start font-bold">
                  <span className="text-slate-900 dark:text-white text-xs">{ord.productName}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">₹{formatINR(ord.total)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Qty: <strong>{ord.qty}</strong></span>
                  <span>Rate: <strong>₹{formatINR(ord.rate)} / Qty</strong></span>
                </div>
                <div className="text-[10.5px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1 pt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">Deliver to: {ord.destination}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-emerald-950/50 flex justify-between text-xs font-bold">
            <span>Total Qty:</span>
            <span className="font-mono text-slate-900 dark:text-white">{successTotalQty} Qty</span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No advance payment needed. Pay on delivery directly to mill.</span>
          </div>

          {/* Share & Copy */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share on WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate('/my-orders')}
            className="w-full py-3 rounded-xl bg-[#143e2e] hover:bg-[#0f3225] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View My Orders</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderSuccess(null);
              navigate('/store');
            }}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
          >
            Back to Rice Store
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: EMPTY BAG
  // ----------------------------------------------------
  if (items.length === 0) {
    return (
      <div className="p-4 max-w-sm mx-auto pb-28 text-center space-y-4 font-sans animate-fadeIn">
        <div className="w-12 h-12 bg-slate-100 dark:bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mt-12">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">Your Bag is Empty</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose rice varieties from the store to place your wholesale order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[#143e2e] hover:bg-[#0f3225] text-white font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-95"
        >
          <span>Browse Rice Store</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: MOBILE-OPTIMIZED BAG (COMPACT & SIMPLE)
  // ----------------------------------------------------
  return (
    <div className="p-3 max-w-md mx-auto space-y-2.5 pb-28 font-sans text-slate-900 dark:text-slate-100 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="p-1.5 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Back to Store"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white leading-none">
              My Bag
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {items.length} {items.length === 1 ? 'item' : 'items'} • {totalQty} Qty
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      {/* Global Delivery Address: Simple Words & Dropdown */}
      <div className="bg-emerald-50/80 dark:bg-[#0c1f17] border border-emerald-500/25 dark:border-emerald-900/50 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Deliver to:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setAddLocTargetItemId(null);
              setIsAddLocOpen(true);
            }}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            <span>Add Address</span>
          </button>
        </div>

        {/* Clean Dropdown */}
        <select
          value={globalLocationId}
          onChange={(e) => handleGlobalLocationChange(e.target.value)}
          className="w-full p-2 rounded-lg bg-white dark:bg-neutral-900 border border-emerald-500/30 dark:border-neutral-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
        >
          {deliveryLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.type === 'Shop' ? '🏪 Shop' : '🏭 Godown'}: {loc.name} ({loc.address.slice(0, 32)}...)
            </option>
          ))}
          <option value="__add_new__">+ Add New Delivery Address...</option>
        </select>
      </div>

      {/* Items List (Compact Mobile View) */}
      <div className="space-y-2">
        {items.map((item) => {
          const itLoc = getItemLocation(item);

          return (
            <div 
              key={item.id}
              className="bg-white dark:bg-[#0a1b14] border border-slate-200/90 dark:border-emerald-950/60 rounded-xl p-2.5 shadow-2xs space-y-2 text-xs"
            >
              {/* Product Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                    <span>{item.variety || 'Rice'}</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate max-w-[140px]">
                      {item.supplier || 'DIRECT MILL'}
                    </span>
                    <span>•</span>
                    {/* Explicitly state Rate is per Qty */}
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      Rate: ₹{formatINR(item.price)} / Qty
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                  title="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Per-Item Deliver To Dropdown (Simple words) */}
              <div className="bg-slate-50 dark:bg-neutral-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-500 shrink-0">Deliver to:</span>
                <select
                  value={itLoc.id}
                  onChange={(e) => handleItemLocationChange(item.id, e.target.value)}
                  className="flex-1 p-1 rounded bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer truncate"
                >
                  {deliveryLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.type === 'Shop' ? '🏪 Shop' : '🏭 Godown'}: {loc.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Address...</option>
                </select>
              </div>

              {/* Quantity Stepper & Item Total */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-neutral-800">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-500">Qty:</span>
                  <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 h-7">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, Math.max(1, item.qty - (item.qty > 10 ? 5 : 1)))}
                      className="w-6 h-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-black cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-700 select-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        updateQty(item.id, Math.max(0, val));
                      }}
                      className="w-11 text-center font-mono font-bold text-xs bg-transparent border-0 outline-none text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.qty + (item.qty >= 10 ? 5 : 1))}
                      className="w-6 h-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-black cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-700 select-none"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Add Chips */}
                  <div className="flex items-center gap-1 ml-0.5">
                    {[+10, +25].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + inc)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        +{inc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                    ₹{formatINR(item.price * item.qty)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading Days: Simple Tap Pills (No hard-to-use slider) */}
      <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/90 dark:border-emerald-950/60 rounded-xl p-2.5 shadow-2xs space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Loading Time:</span>
          </span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
            {loadingDays} Days
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          {[2, 3, 5, 7].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setLoadingDays(days)}
              className={cn(
                "py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                loadingDays === days
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              )}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Reassurance Banner: Explicitly NO payment method needed */}
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 flex items-center gap-2 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium">
          <strong className="block font-bold">No Payment Required at Order Time</strong>
          Payment is handled directly on delivery invoice terms with the mill.
        </div>
      </div>

      {/* Order Summary & One-Tap Place Order Button */}
      <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/90 dark:border-emerald-950/60 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Total Quantity</span>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {totalQty} Qty
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-500 block">Total Amount</span>
            <span className="text-base font-mono font-black text-emerald-700 dark:text-emerald-400">
              ₹{formatINR(totalAmount)}
            </span>
          </div>
        </div>

        {/* Place Order Directly (No payment method popup or gateway) */}
        <button
          type="button"
          disabled={isPlacingOrder}
          onClick={handlePlaceOrder}
          className="w-full py-3 rounded-xl bg-[#143e2e] hover:bg-[#0f3225] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          {isPlacingOrder ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Placing Order...</span>
            </>
          ) : (
            <>
              <span>Place Order ({totalQty} Qty)</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Modal: Add Delivery Address (Simple Words) */}
      {isAddLocOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans animate-fadeIn">
          <div className="bg-white dark:bg-[#0c1f17] border border-slate-200 dark:border-emerald-950 rounded-2xl p-4 max-w-sm w-full shadow-xl space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-emerald-950/40">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Add Delivery Address</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddLocOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-2.5">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Address Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Main Shop or Godown #1"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLocType('Shop')}
                    className={cn(
                      "p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer",
                      newLocType === 'Shop'
                        ? "bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                        : "bg-white dark:bg-neutral-900 border-slate-200 text-slate-600"
                    )}
                  >
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>Shop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLocType('Godown')}
                    className={cn(
                      "p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer",
                      newLocType === 'Godown'
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-white dark:bg-neutral-900 border-slate-200 text-slate-600"
                    )}
                  >
                    <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Godown</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Full Address
                </label>
                <textarea
                  placeholder="Plot/Shop No, APMC Yard, City"
                  value={newLocAddress}
                  onChange={(e) => setNewLocAddress(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs outline-none focus:border-emerald-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newLocPhone}
                  onChange={(e) => setNewLocPhone(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs outline-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#143e2e] text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-[#0f3225]"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddLocOpen(false)}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
