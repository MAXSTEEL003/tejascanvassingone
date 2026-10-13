import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Sparkles, 
  Megaphone, 
  CheckCheck, 
  ShoppingBag, 
  ArrowRight,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { 
  BroadcastNotification, 
  getBroadcastNotifications, 
  getReadNotificationIds, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  formatRelativeTime 
} from '../utils/storeNotifications';

interface MerchantNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function MerchantNotificationsModal({
  isOpen,
  onClose,
  onUnreadCountChange,
}: MerchantNotificationsModalProps) {
  const [notifications, setNotifications] = useState<BroadcastNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => getReadNotificationIds());
  const [activeFilter, setActiveFilter] = useState<'all' | 'price' | 'reminder'>('all');
  const navigate = useNavigate();

  const loadData = async () => {
    const list = await getBroadcastNotifications();
    setNotifications(list);
    const reads = getReadNotificationIds();
    setReadIds(reads);
    const unread = list.filter(n => !reads.includes(n.id)).length;
    onUnreadCountChange?.(unread);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('broadcast-notifications-updated', handleUpdate);
    window.addEventListener('broadcast-notifications-read', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('broadcast-notifications-updated', handleUpdate);
      window.removeEventListener('broadcast-notifications-read', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    markAllNotificationsAsRead(allIds);
    setReadIds(allIds);
    onUnreadCountChange?.(0);
  };

  const handleItemClick = (n: BroadcastNotification) => {
    markNotificationAsRead(n.id);
    setReadIds(prev => [...prev, n.id]);
    if (n.variety) {
      onClose();
      navigate(`/store?search=${encodeURIComponent(n.variety)}`);
    }
  };

  const filtered = notifications.filter(n => {
    if (activeFilter === 'price') {
      return n.type === 'price_increase' || n.type === 'price_drop';
    }
    if (activeFilter === 'reminder') {
      return n.type === 'reminder';
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const getTypeBadge = (type: BroadcastNotification['type']) => {
    switch (type) {
      case 'price_increase':
        return {
          icon: TrendingUp,
          label: 'Price Increase',
          badgeClass: 'bg-red-50 text-[#C22424] border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40',
          iconBg: 'bg-red-50 text-[#C22424] dark:bg-red-950/60 dark:text-red-400'
        };
      case 'price_drop':
        return {
          icon: TrendingDown,
          label: 'Price Drop / Offer',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40',
          iconBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
        };
      case 'reminder':
        return {
          icon: Clock,
          label: 'Order Reminder',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40',
          iconBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
        };
      case 'new_stock':
        return {
          icon: Sparkles,
          label: 'Fresh Stock Arrival',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40',
          iconBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
        };
      default:
        return {
          icon: Megaphone,
          label: 'Market Notice',
          badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
          iconBg: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Transparent Backdrop to close on click outside */}
          <div
            onClick={onClose}
            className="fixed inset-0 z-45 bg-black/25 dark:bg-black/50 backdrop-blur-[2px] transition-opacity"
            aria-hidden="true"
          />

          {/* Floating Card Popover Container */}
          <div className="fixed inset-x-3 top-14 sm:inset-x-auto sm:right-4 md:right-8 lg:right-16 sm:top-16 z-50 flex justify-end pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
              className="pointer-events-auto w-full sm:w-[380px] md:w-[410px] max-h-[82vh] bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col backdrop-blur-xl"
            >
              {/* Floating Header */}
              <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between bg-white/90 dark:bg-[#141414]/90 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/50 text-[#C22424] flex items-center justify-center border border-red-200/50 dark:border-red-900/40 shrink-0">
                    <Bell className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xs font-bold text-neutral-900 dark:text-white leading-tight">
                        Notifications
                      </h2>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#C22424] text-white text-[9px] font-black leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                      Market & price updates
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[9.5px] font-bold text-[#C22424] hover:text-[#B91C1C] flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 transition-colors cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-2.5 h-2.5" />
                      <span>Read all</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Filter Tabs */}
              <div className="px-3 py-1.5 bg-neutral-50/70 dark:bg-neutral-900/40 border-b border-[#E5E7EB] dark:border-[#262626] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: `All (${notifications.length})` },
                  { id: 'price', label: 'Rates & Deals' },
                  { id: 'reminder', label: 'Reminders' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id as any)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap",
                      activeFilter === f.id
                        ? "bg-[#C22424] text-white shadow-2xs"
                        : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 hover:bg-neutral-100"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Scrollable Small Cards List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 no-scrollbar">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                      <Bell className="w-5 h-5 opacity-50" />
                    </div>
                    <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      No notifications yet
                    </h3>
                    <p className="text-[10px] text-neutral-400 max-w-[220px] mx-auto leading-tight">
                      Admin price shifts and replenishment alerts will pop up here.
                    </p>
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isRead = readIds.includes(item.id);
                    const badge = getTypeBadge(item.type);
                    const Icon = badge.icon;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer relative text-left group shadow-xs hover:shadow-md",
                          isRead
                            ? "bg-white dark:bg-[#181818] border-neutral-200/70 dark:border-neutral-800/80 hover:border-neutral-300 opacity-80"
                            : "bg-red-50/25 dark:bg-red-950/20 border-red-200/90 dark:border-red-900/60 hover:border-[#C22424] hover:bg-red-50/40"
                        )}
                      >
                        {/* Card Header Tag Row */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={cn("px-1.5 py-0.2 rounded-md text-[8.5px] font-black uppercase tracking-wider border flex items-center gap-1", badge.badgeClass)}>
                              <Icon className="w-2.5 h-2.5" />
                              {badge.label}
                            </span>
                            {item.variety && (
                              <span className="px-1.5 py-0.2 rounded-md text-[8.5px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                🌾 {item.variety}
                              </span>
                            )}
                            {item.rateChange && (
                              <span className="px-1.5 py-0.2 rounded-md text-[8.5px] font-black bg-red-100 dark:bg-red-900/60 text-[#C22424] dark:text-red-300">
                                {item.rateChange}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9.5px] text-neutral-400 dark:text-neutral-500 font-medium whitespace-nowrap">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                            {!isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C22424] shrink-0" title="Unread" />
                            )}
                          </div>
                        </div>

                        {/* Card Body */}
                        <h4 className="text-[11.5px] font-bold text-neutral-900 dark:text-white leading-snug line-clamp-1">
                          {item.title}
                        </h4>
                        <p className="text-[10.5px] text-neutral-600 dark:text-neutral-300 leading-normal mt-0.5 line-clamp-2">
                          {item.message}
                        </p>

                        {/* Card Footer Action */}
                        {item.variety && (
                          <div className="mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                            <span className="text-[9.5px] text-neutral-400 group-hover:text-[#C22424] transition-colors flex items-center gap-1 font-bold">
                              <ShoppingBag className="w-2.5 h-2.5" />
                              View {item.variety}
                            </span>
                            <ArrowRight className="w-2.5 h-2.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform text-[#C22424]" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Floating Footer */}
              <div className="px-3 py-2 bg-neutral-50/80 dark:bg-neutral-900/60 border-t border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between text-[10px] text-neutral-400">
                <span className="font-semibold">
                  APMC Canvassing Alerts
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-bold text-[#C22424] hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
