import { 
  Search, 
  Bell, 
  Settings, 
  X, 
  Trash2, 
  ArrowRight, 
  ShoppingBasket, 
  Moon, 
  Sun, 
  Menu,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Send,
  User,
  Sliders,
  Download
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState, useRef } from 'react';

export default function Navbar({ 
  onSearchClick, 
  isSidebarCollapsed = false,
  onToggleSidebar
}: { 
  onSearchClick?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const { items, total, isOpen, setIsOpen, removeItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {
      console.warn('Storage theme write warning:', e);
    }
  }, [isDark]);

  useEffect(() => {
    const handleThemeSync = () => {
      try {
        const saved = localStorage.getItem('theme');
        setIsDark(saved ? saved === 'dark' : true);
      } catch {}
    };
    window.addEventListener('theme-changed', handleThemeSync);
    return () => window.removeEventListener('theme-changed', handleThemeSync);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    } catch {}
    window.dispatchEvent(new Event('theme-changed'));
  };

  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem('userRole') || 'admin';
    } catch {
      return 'admin';
    }
  });

  const [userName, setUserName] = useState(() => {
    try {
      const r = localStorage.getItem('userRole') || 'admin';
      return localStorage.getItem('userName') || (r === 'admin' ? 'Tejas Canvassing' : r === 'merchant' ? 'V.K FOODS' : 'Procurement Staff');
    } catch {
      return 'Tejas Canvassing';
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const r = localStorage.getItem('userRole') || 'admin';
        setRole(r);
        setUserName(localStorage.getItem('userName') || (r === 'admin' ? 'Tejas Canvassing' : r === 'merchant' ? 'V.K FOODS' : 'Procurement Staff'));
      } catch {}
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  const roleLabel = role === 'admin' ? 'Global Procurement' : role === 'officer' ? 'Operations Officer' : role === 'employee' ? 'Warehouse Staff' : 'Merchant Buyer';
  const showSearch = role === 'admin' || role === 'officer';

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  // State-driven notifications with interactive mark-as-read and clear
  const [notificationsList, setNotificationsList] = useState([
    {
      id: '1',
      title: 'WhatsApp PO Dispatched',
      description: 'Order notification prepared for V.K FOODS (9840618506).',
      time: 'Just now',
      unread: true,
      type: 'dispatch',
      path: '/settings'
    },
    {
      id: '2',
      title: 'Shipment Arrival Logged',
      description: '24 QTLS KESHAR KALI arrived from ANNAPURNA RICE & AGRO.',
      time: '18m ago',
      unread: true,
      type: 'arrival',
      path: '/arrival-entry'
    },
    {
      id: '3',
      title: 'Payment Record Updated',
      description: '₹3,40,000 NEFT entry recorded for V.K FOODS.',
      time: '1h ago',
      unread: false,
      type: 'payment',
      path: '/payments'
    }
  ]);

  const unreadCount = notificationsList.filter(n => n.unread).length;

  const handleMarkAllRead = () => {
    setNotificationsList(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleNotificationClick = (notif: typeof notificationsList[0]) => {
    setNotificationsList(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    setIsNotifOpen(false);
    navigate(notif.path);
  };

  return (
    <>
      <header className={cn(
        "fixed top-0 right-0 h-16 px-4 md:px-6 bg-surface/95 backdrop-blur-xl border-0 shadow-none flex justify-between items-center z-40 transition-all duration-300 left-0 w-full md:w-auto",
        isSidebarCollapsed ? "md:left-20" : "md:left-64"
      )}>
        <div className="flex items-center gap-2 flex-1 max-w-sm mr-2">
          {/* Mobile hamburger navigation bar toggle */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-secondary hover:bg-surface-container rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5 text-on-surface" />
          </button>

          {showSearch ? (
            <div 
              onClick={onSearchClick}
              className="flex-1 relative cursor-pointer group"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
              <input 
                type="text" 
                readOnly
                placeholder="Search..." 
                value=""
                onChange={() => {}}
                className="w-full bg-surface-container-low hover:bg-surface-container hover:shadow-inner border border-outline-variant/40 hover:border-outline-variant rounded-xl py-2 pl-10 pr-4 md:pr-16 text-xs sm:text-sm outline-none transition-all cursor-pointer text-on-surface"
              />
              <div className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 bg-surface-container-high border border-outline-variant px-1.5 py-0.5 rounded-md text-[9px] text-secondary font-mono pointer-events-none select-none">
                <span>{isMac ? '⌘' : 'Ctrl'}</span><span>K</span>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Download / Add to Home Screen Button */}
          <button
            onClick={() => window.dispatchEvent(new Event('open-pwa-install-modal'))}
            className="px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
            title="Download App / Add to Home Screen"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Install App</span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 text-secondary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Night Mode"}
          >
            {isDark ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications Dropdown Button */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsSettingsMenuOpen(false);
              }}
              className={cn(
                "p-2 rounded-lg transition-all relative cursor-pointer",
                isNotifOpen 
                  ? "bg-primary/10 text-primary ring-2 ring-primary/20" 
                  : "text-secondary hover:bg-surface-container hover:text-on-surface"
              )}
              title="Notifications & Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface animate-pulse" />
              )}
            </button>

            {/* Notification Popover */}
            <AnimatePresence>
              {isNotifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-high border border-outline-variant rounded-2xl shadow-2xl z-50 overflow-hidden text-on-surface font-sans"
                >
                  <div className="p-4 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Notifications</h4>
                        <p className="text-[10px] text-secondary">{unreadCount} unread procurement updates</p>
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-outline-variant/30 max-h-80 overflow-y-auto">
                    {notificationsList.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          "p-3.5 hover:bg-surface-container transition-colors cursor-pointer flex gap-3 items-start",
                          notif.unread ? "bg-primary/[0.04]" : ""
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-xl shrink-0 mt-0.5",
                          notif.type === 'dispatch' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                          notif.type === 'arrival' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}>
                          {notif.type === 'dispatch' ? <Send className="w-3.5 h-3.5" /> :
                           notif.type === 'arrival' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-on-surface truncate">{notif.title}</p>
                            <span className="text-[9px] text-secondary whitespace-nowrap">{notif.time}</span>
                          </div>
                          <p className="text-[11px] text-secondary mt-0.5 leading-snug">{notif.description}</p>
                        </div>
                        {notif.unread && (
                          <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-surface-container border-t border-outline-variant/50 flex gap-2">
                    <button
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate('/settings');
                      }}
                      className="flex-1 py-2 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      PO & WhatsApp Dispatcher
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings Button & Quick Menu */}
          <div className="relative" ref={settingsRef}>
            <button 
              onClick={() => {
                setIsSettingsMenuOpen(!isSettingsMenuOpen);
                setIsNotifOpen(false);
              }}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer relative",
                isSettingsMenuOpen || location.pathname === '/settings'
                  ? "bg-primary/10 text-primary ring-2 ring-primary/20" 
                  : "text-secondary hover:bg-surface-container hover:text-on-surface"
              )}
              title="Settings & System Preferences"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Quick Settings Dropdown */}
            <AnimatePresence>
              {isSettingsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 bg-surface-container-high border border-outline-variant rounded-2xl shadow-2xl z-50 overflow-hidden text-on-surface font-sans"
                >
                  <div className="p-4 border-b border-outline-variant/50 bg-surface-container flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Quick Settings</h4>
                        <p className="text-[10px] text-secondary">System configuration</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold rounded-xl hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Sliders className="w-4 h-4 text-primary" />
                        PO & Notification Settings
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        navigate('/users');
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold rounded-xl hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-emerald-500" />
                        Stakeholders & Buyers
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        navigate('/patti');
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold rounded-xl hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-teal-500" />
                        Patti Ledger & Print Setup
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                    </button>

                    <button
                      onClick={() => {
                        toggleTheme();
                        setIsSettingsMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold rounded-xl hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
                        Theme: {isDark ? 'Dark Mode' : 'Light Mode'}
                      </span>
                      <span className="text-[10px] text-secondary uppercase font-semibold">Toggle</span>
                    </button>
                  </div>

                  <div className="p-2.5 bg-surface-container border-t border-outline-variant/50">
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      Open Full Settings
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-outline-variant mx-1" />

          {/* User Profile Info */}
          <div 
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 cursor-pointer p-1 rounded-xl hover:bg-surface-container transition-colors"
            title="Account & Profile Settings"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-on-surface">{userName}</p>
              <p className="text-[10px] text-secondary uppercase font-semibold">{roleLabel}</p>
            </div>
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIq0tLEZQFll3PlxDAWYU5NZDulRQuTkou4IdyJPF7J7ToGRePTsWb-9HGpBfjMIJATQi_xfNihKS4ndbgoB5Fk4zubHFLRrCOxO9SZEqlcu6xM8C_GKwTvQPEuvmE0nRolDYLqEp2zlX9WC-HYM7KopOezQrtNToQ8Bh_kCq2NKayN3rcIugwabuwGzZnpRvkp0Jn2jFpFZV5_AgNEmi-h5jFnKxOYKmj8K7Ot-o329rSj-5TbhG1xm6HNoZaADmIqKv9Q8o4Dipd" 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-outline-variant"
            />
          </div>
        </div>
      </header>
    </>
  );
}
