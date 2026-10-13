import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Trash2, ArrowRight, ChevronLeft, ChevronRight, Tag,
  ShieldCheck, PackageCheck, AlertCircle, Sparkles
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { cn, formatINR } from '../lib/utils';

export default function BagView() {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Totals: Rate is strictly per QTL
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = isCouponApplied ? Math.min(2500, Math.round(totalAmount * 0.02)) : 0;
  const estimatedTotal = Math.max(0, totalAmount - discountAmount);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (code === 'TEJAS50' || code === 'FIRSTMILL' || code === 'EXMILL') {
      setIsCouponApplied(true);
      setCouponError('');
    } else {
      setCouponError('Invalid promo code. Try "TEJAS50" or "EXMILL"');
    }
  };

  // ----------------------------------------------------
  // RENDER: EMPTY CART
  // ----------------------------------------------------
  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 max-w-sm mx-auto text-center space-y-4 font-sans text-neutral-900 dark:text-neutral-100 animate-fadeIn">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl flex items-center justify-center mx-auto text-neutral-400 dark:text-neutral-500 shadow-xs">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Your Cart is Empty</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
            Browse our verified rice catalog and add varieties to prepare your wholesale order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-[#C22424] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm cursor-pointer transition-all active:scale-95"
        >
          <span>Browse Rice Store</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: CLEAN CART (MATCHING DESIGN REFERENCE SCREEN 4)
  // ----------------------------------------------------
  return (
    <div className="p-3.5 sm:p-5 max-w-md mx-auto space-y-3.5 pb-28 font-sans text-neutral-900 dark:text-neutral-100 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#262626]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="p-1 -ml-1 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Back to Store"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-none">
              Your Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs text-[#C22424] hover:text-[#B91C1C] font-bold cursor-pointer transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Items List (Screen 4 from Reference) */}
      <div className="space-y-2.5">
        {items.map((item) => {
          return (
            <div 
              key={item.id}
              className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-3 shadow-xs space-y-2 text-xs text-left"
            >
              {/* Product Header & Thumbnail */}
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shrink-0 flex items-center justify-center p-1">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                  ) : (
                    <ShoppingBag className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm leading-snug line-clamp-1">
                      {item.name}
                    </h3>
                    {/* Red Trash Button */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[#C22424] hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded-lg cursor-pointer shrink-0 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    {item.variety || 'Sortex Milling'} • ₹{formatINR(item.price)} / QTL
                  </p>

                  {/* Stepper & Total */}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-100 dark:border-[#262626]">
                    <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 gap-1.5 border border-neutral-200 dark:border-neutral-700">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, Math.max(1, item.qty - (item.qty > 10 ? 5 : 1)))}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                        title="Decrease"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white px-1">
                        {item.qty} QTL
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + (item.qty >= 10 ? 5 : 1))}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                        title="Increase"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
                        ₹{formatINR(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen 4 Apply Coupon Card */}
      <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-3 shadow-xs space-y-2">
        <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#C22424] flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Apply trade promo code..."
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            disabled={isCouponApplied}
            className="flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none uppercase font-mono"
          />
          {isCouponApplied ? (
            <button
              type="button"
              onClick={() => {
                setIsCouponApplied(false);
                setCouponCode('');
              }}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-white px-2 py-1.5 cursor-pointer"
            >
              Remove
            </button>
          ) : (
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#C22424] hover:bg-[#B91C1C] text-white text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              Apply
            </button>
          )}
        </form>
        {isCouponApplied && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Promo discount of ₹{formatINR(discountAmount)} applied!</span>
          </div>
        )}
        {couponError && (
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium px-1">
            {couponError}
          </p>
        )}
      </div>

      {/* Screen 4 Order Summary Card */}
      <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 shadow-xs space-y-2.5 text-xs text-left">
        <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-400">
          Order Summary
        </h3>
        
        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
          <span>Total Quantity</span>
          <span className="font-bold text-neutral-900 dark:text-white font-mono">
            {totalQty} QTL ({totalQty * 100} kg)
          </span>
        </div>

        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
          <span>Subtotal</span>
          <span className="font-bold text-neutral-900 dark:text-white font-mono">
            ₹{formatINR(totalAmount)}
          </span>
        </div>

        {isCouponApplied && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Trade Discount</span>
            <span className="font-bold font-mono">
              - ₹{formatINR(discountAmount)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
          <span>Delivery & Transport</span>
          <span className="font-semibold text-neutral-500 dark:text-neutral-400">
            Set at Checkout
          </span>
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-[#262626] flex justify-between items-baseline font-bold">
          <span className="text-sm text-neutral-900 dark:text-white">Estimated Amount</span>
          <span className="text-xl font-mono text-[#C22424] font-bold">
            ₹{formatINR(estimatedTotal)}
          </span>
        </div>

        {/* Single Primary Action: Proceed to Checkout */}
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="w-full py-3.5 mt-2 rounded-xl bg-[#C22424] hover:bg-[#B91C1C] text-white font-bold text-xs sm:text-sm tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          <span>Proceed to Checkout</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-500 pt-1 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
          <span>Wholesale PO • Select delivery location and verify on checkout</span>
        </p>
      </div>
    </div>
  );
}
