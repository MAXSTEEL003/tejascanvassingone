import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Send, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Sparkles, 
  Megaphone, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  BroadcastNotification, 
  NotificationType, 
  getBroadcastNotifications, 
  createBroadcastNotification, 
  deleteBroadcastNotification,
  formatRelativeTime 
} from '../utils/storeNotifications';

interface AdminBroadcastNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: any[];
}

export default function AdminBroadcastNoticeModal({
  isOpen,
  onClose,
  products = []
}: AdminBroadcastNoticeModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [noticeType, setNoticeType] = useState<NotificationType>('price_increase');
  const [selectedVariety, setSelectedVariety] = useState<string>('');
  const [rateChange, setRateChange] = useState<string>('+₹50 / Qtl');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'inactive_merchants'>('all');
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<BroadcastNotification[]>([]);

  // Unique product varieties for dropdown
  const uniqueVarieties = Array.from(
    new Set(products.map(p => p?.name || p?.brand).filter(Boolean))
  );

  const applyTemplate = (type: NotificationType, varietyName = selectedVariety, rateDelta = rateChange) => {
    const varText = varietyName || 'Select Rice Variety';
    switch (type) {
      case 'price_increase':
        setTitle(varietyName ? `Rate Revision: Price Increase on ${varietyName}` : 'Market Price Revision Notice');
        setMessage(
          varietyName 
            ? `Due to fresh APMC paddy auction trends, the ex-mill rates for ${varietyName} are revised upwards by ${rateDelta || '₹50/Qtl'} effective immediately. Please confirm current orders to secure existing inventory.`
            : `Due to fresh APMC paddy auction trends, rates for select varieties have increased by ${rateDelta || '₹50/Qtl'}. Kindly review updated catalog pricing before booking.`
        );
        break;
      case 'price_drop':
        setTitle(varietyName ? `Special Rate Offer on ${varietyName}` : 'Limited-Time Rate Reduction');
        setMessage(
          varietyName
            ? `Special mill clearance lot available! ${varietyName} rates reduced by ${rateDelta || '₹40/Qtl'} for full truckload dispatches this week.`
            : `Special volume discounts currently active on select prime APMC lots. Place orders today for priority mill allotment.`
        );
        break;
      case 'reminder':
        setTitle('We Miss You — Replenishment Reminder');
        setMessage(
          'Haven\'t placed a replenishment order recently? Fresh aged paddy arrivals are in stock at the APMC yard. Book your orders early to avoid weekend dispatch delays.'
        );
        break;
      case 'new_stock':
        setTitle(varietyName ? `Fresh Stock Arrival: New Crop ${varietyName}` : 'Fresh 2026 Crop Lots In Stock');
        setMessage(
          varietyName
            ? `Freshly milled 2026 harvest of ${varietyName} is now ready for dispatch directly from premier Gangavathi/Raichur mills. Premium silky polish & superior grain elongation.`
            : 'New harvest lots have arrived directly from mill partners. View the catalog to place wholesale indents with live delivery tracking.'
        );
        break;
      default:
        setTitle('Market & Logistics Announcement');
        setMessage('Important operational notice regarding dispatch schedules and delivery commitments.');
        break;
    }
  };

  useEffect(() => {
    if (isOpen) {
      applyTemplate(noticeType);
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    const list = await getBroadcastNotifications();
    setHistoryList(list);
  };

  const handleTypeSelect = (type: NotificationType) => {
    setNoticeType(type);
    applyTemplate(type, selectedVariety, rateChange);
  };

  const handleVarietyChange = (v: string) => {
    setSelectedVariety(v);
    applyTemplate(noticeType, v, rateChange);
  };

  const handleRateChangeChange = (r: string) => {
    setRateChange(r);
    applyTemplate(noticeType, selectedVariety, r);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSending(true);
    try {
      await createBroadcastNotification({
        title: title.trim(),
        message: message.trim(),
        type: noticeType,
        variety: selectedVariety || undefined,
        rateChange: (noticeType === 'price_increase' || noticeType === 'price_drop') ? rateChange : undefined,
        targetAudience
      });

      setSuccessToast('Notification broadcasted to all merchants successfully!');
      await loadHistory();
      setTimeout(() => setSuccessToast(null), 3000);
      setActiveTab('history');
    } catch (err) {
      console.error('Error broadcasting notification:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBroadcastNotification(id);
    await loadHistory();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-2xl bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-5 border-b border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between bg-white dark:bg-[#141414]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-[#C22424] flex items-center justify-center border border-red-200 dark:border-red-900/40">
                  <Megaphone className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    Broadcast Store Notification
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Send real-time alerts to all merchants (price increases, inactivity reminders, new arrivals)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-[#E5E7EB] dark:border-[#262626] flex gap-2 pt-2 bg-neutral-50/60 dark:bg-neutral-900/40">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={cn(
                  "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer",
                  activeTab === 'create'
                    ? "border-[#C22424] text-[#C22424]"
                    : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Compose Notice
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('history'); loadHistory(); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'history'
                    ? "border-[#C22424] text-[#C22424]"
                    : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <span>Active Broadcasts</span>
                <span className="px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-800 rounded-full text-[10px]">
                  {historyList.length}
                </span>
              </button>
            </div>

            {/* Success Toast */}
            {successToast && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successToast}</span>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'create' ? (
                <form onSubmit={handleSend} className="space-y-4 text-left">
                  {/* Preset Template Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Select Notification Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'price_increase', label: 'Price Increase', icon: TrendingUp, color: 'text-red-600' },
                        { id: 'price_drop', label: 'Special Offer', icon: TrendingDown, color: 'text-emerald-600' },
                        { id: 'reminder', label: 'Order Reminder', icon: Clock, color: 'text-amber-600' },
                        { id: 'new_stock', label: 'New Stock', icon: Sparkles, color: 'text-blue-600' },
                      ].map(t => {
                        const Icon = t.icon;
                        const isSelected = noticeType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTypeSelect(t.id as any)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer",
                              isSelected 
                                ? "bg-red-50/50 dark:bg-red-950/40 border-[#C22424] shadow-xs" 
                                : "bg-white dark:bg-[#181818] border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                            )}
                          >
                            <Icon className={cn("w-4 h-4", t.color)} />
                            <span className={cn("text-xs font-bold", isSelected ? "text-[#C22424]" : "text-neutral-700 dark:text-neutral-300")}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Variety & Rate Row (for price alerts & new arrivals) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        Target Rice Variety (Optional)
                      </label>
                      <select
                        value={selectedVariety}
                        onChange={(e) => handleVarietyChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#E5E7EB] dark:border-[#262626] rounded-xl text-xs font-medium outline-none focus:border-[#C22424] cursor-pointer"
                      >
                        <option value="">-- General (All Varieties) --</option>
                        {uniqueVarieties.map((v, i) => (
                          <option key={i} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    {(noticeType === 'price_increase' || noticeType === 'price_drop') && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          Rate Adjustment Amount
                        </label>
                        <input
                          type="text"
                          value={rateChange}
                          onChange={(e) => handleRateChangeChange(e.target.value)}
                          placeholder="e.g. +₹50 / Qtl"
                          className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#E5E7EB] dark:border-[#262626] rounded-xl text-xs font-medium outline-none focus:border-[#C22424]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Notification Title
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Rate Revision: Sonamasuri Price Increase"
                      className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#E5E7EB] dark:border-[#262626] rounded-xl text-xs font-bold outline-none focus:border-[#C22424]"
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Notification Message Body
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter the full message details shown to merchants..."
                      className="w-full p-3 bg-white dark:bg-[#1a1a1a] border border-[#E5E7EB] dark:border-[#262626] rounded-xl text-xs leading-relaxed outline-none focus:border-[#C22424]"
                    />
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Target Audience
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetAudience('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          targetAudience === 'all'
                            ? "bg-[#C22424] text-white border-[#C22424]"
                            : "bg-white dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800"
                        )}
                      >
                        Everyone (All Store Merchants)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetAudience('inactive_merchants')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          targetAudience === 'inactive_merchants'
                            ? "bg-[#C22424] text-white border-[#C22424]"
                            : "bg-white dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800"
                        )}
                      >
                        Merchants Not Ordered Recently
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSending || !title.trim() || !message.trim()}
                      className="w-full py-3 bg-[#C22424] hover:bg-[#B91C1C] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSending ? 'Transmitting Broadcast...' : 'Broadcast to All Merchants'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* History List */
                <div className="space-y-3">
                  {historyList.length === 0 ? (
                    <div className="py-12 text-center text-neutral-400 text-xs">
                      No active broadcasts found. Use the Compose tab to send your first notification.
                    </div>
                  ) : (
                    historyList.map(item => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#181818] space-y-2 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 uppercase">
                              {item.type.replace('_', ' ')}
                            </span>
                            {item.variety && (
                              <span className="text-[10px] font-bold text-[#C22424]">
                                🌾 {item.variety}
                              </span>
                            )}
                            {item.rateChange && (
                              <span className="text-[10px] font-bold bg-red-50 text-[#C22424] px-1.5 py-0.5 rounded">
                                {item.rateChange}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-400">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-1 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Delete broadcast"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                          {item.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 border-t border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between text-xs text-neutral-500">
              <span>Instantly reflects in the merchant store bell icon</span>
              <button
                type="button"
                onClick={onClose}
                className="font-bold text-neutral-700 dark:text-neutral-300 hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
