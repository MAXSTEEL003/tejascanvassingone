import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Trash2, ArrowRight, X, ChevronRight, Store, ArrowUpRight
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { cn, formatINR } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function GlobalCartDrawer() {
  const navigate = useNavigate();
  const { items, isOpen, setIsOpen, updateQty, removeItem, clearCart } = useCart();

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const handleProceedToCheckout = () => {
    setIsOpen(false);
    navigate('/checkout');
  };

  const handleViewFullBag = () => {
    setIsOpen(false);
    navigate('/bag');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          {/* Backdrop with click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Sliding Drawer: On mobile full width, on desktop 420px */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="w-full sm:w-[420px] max-w-full bg-white dark:bg-[#0A0A0A] sm:border-l border-[#E5E7EB] dark:border-[#262626] shadow-2xl flex flex-col justify-between h-full sm:rounded-l-2xl overflow-hidden font-sans text-neutral-900 dark:text-neutral-100"
            >
              {/* Mobile Drag Indicator Bar */}
              <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

              {/* Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between bg-white dark:bg-[#0A0A0A] shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#C22424]/10 text-[#C22424] dark:text-[#E05252] flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white truncate">
                        Your Cart
                      </h3>
                      {items.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C22424]/10 text-[#C22424] dark:text-[#E05252] font-mono">
                          {items.length} item{items.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate">
                      Tejas Canvassing • Wholesale B2B
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#141414] rounded-xl transition-all cursor-pointer shrink-0"
                  title="Close Cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 p-4">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] flex items-center justify-center text-neutral-400">
                      <ShoppingBag className="w-7 h-7" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      Your procurement cart is empty
                    </p>
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed font-normal">
                      Explore our wholesale grain catalog and add items to your cart.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setIsOpen(false); navigate('/store'); }}
                      className="mt-2 px-4 py-2 bg-[#C22424] hover:bg-[#A81F1F] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5" />
                      Explore Catalog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Action Bar */}
                    <div className="flex justify-between items-center pb-2 border-b border-dashed border-[#E5E7EB] dark:border-[#262626]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Added Items ({items.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleViewFullBag}
                          className="text-[11px] font-bold text-[#C22424] dark:text-[#E05252] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Full Bag</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                        <button 
                          type="button"
                          onClick={clearCart} 
                          className="text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Cart Items List */}
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        className="p-3 bg-neutral-50/70 dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] space-y-2.5 relative text-left"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {item.image ? (
                              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#1C1C1C] p-1 flex items-center justify-center">
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-full h-full object-contain" 
                                  referrerPolicy="no-referrer" 
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#1C1C1C] flex items-center justify-center text-neutral-400">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                ₹{formatINR(item.price)} <span className="text-[9px]">/ QTL</span>
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg cursor-pointer transition-colors shrink-0"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quantity controller & Subtotal */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB]/70 dark:border-[#262626]">
                          {/* Quantity stepper */}
                          <div className="flex items-center bg-white dark:bg-[#1C1C1C] border border-[#E5E7EB] dark:border-[#262626] rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateQty(item.id, Math.max(1, item.qty - 5))}
                              className="px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                updateQty(item.id, isNaN(val) ? 0 : Math.max(1, val));
                              }}
                              className="w-12 text-center bg-transparent border-none text-xs font-bold font-mono text-neutral-900 dark:text-white p-0 focus:ring-0 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateQty(item.id, item.qty + 5)}
                              className="px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Item Subtotal */}
                          <div className="text-right">
                            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block leading-none">Subtotal</span>
                            <span className="text-xs font-black font-mono text-neutral-900 dark:text-white">
                              ₹{formatINR(item.qty * item.price)}
                            </span>
                          </div>
                        </div>

                        {/* Quick bulk presets */}
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-[8px] font-bold text-neutral-400 uppercase font-mono">Quick Add:</span>
                          <div className="flex items-center gap-1">
                            {[25, 50, 100].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                onClick={() => updateQty(item.id, item.qty + delta)}
                                className="text-[9px] font-bold px-2 py-0.5 bg-neutral-100 dark:bg-[#1C1C1C] hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-[#E5E7EB] dark:border-[#262626] text-neutral-700 dark:text-neutral-300 rounded transition-all cursor-pointer font-mono"
                              >
                                +{delta}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed Footer: Order Summary & Proceed to Checkout */}
              {items.length > 0 && (
                <div className="p-4 bg-white dark:bg-[#0A0A0A] border-t border-[#E5E7EB] dark:border-[#262626] space-y-3 shadow-xl shrink-0">
                  {/* Summary Rows */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-neutral-500 dark:text-neutral-400">
                      <span>Total Quantity</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                        {totalQty} QTL ({totalQty * 100} kg)
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-neutral-500 dark:text-neutral-400">
                      <span>Delivery Location</span>
                      <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        Selected at Checkout
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB] dark:border-[#262626]">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">Estimated Subtotal</span>
                      <span className="text-base font-black font-mono text-[#C22424] dark:text-[#E05252]">
                        ₹{formatINR(subtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Proceed to Checkout CTA */}
                  <button
                    type="button"
                    onClick={handleProceedToCheckout}
                    className="w-full py-3 bg-[#C22424] hover:bg-[#A81F1F] active:scale-[0.99] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                    <span>Direct B2B Mill Fulfillment</span>
                    <button
                      type="button"
                      onClick={handleViewFullBag}
                      className="text-[#C22424] dark:text-[#E05252] hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <span>Open Full Bag View</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
