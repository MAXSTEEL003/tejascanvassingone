import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { CartProvider, useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import CommandPalette from '../components/CommandPalette';
import GlobalCartDrawer from '../components/GlobalCartDrawer';
import { auth, setCollectionDoc, getCollectionDocs, getSingleDoc } from '../lib/firebase';
import { getVerifiedUserRole, performSecureLogout } from '../lib/auth';
import { cn } from '../lib/utils';
import { Store, Package, LogOut, Percent, User, Building, Phone, X, Check, Sun, Moon, Search, Plus, Trash2, Warehouse, MapPin, ShoppingBasket, ShoppingBag, Building2, ShieldCheck, Edit3, Lock, Unlock, Settings, CheckCircle2, Copy, Calendar, Clock, Download, ClipboardList, Truck, Menu, Bell, LayoutGrid, Home, Calculator, TrendingUp } from 'lucide-react';
import { getDeliveryLocations, saveDeliveryLocations, addDeliveryLocation, removeDeliveryLocation, DeliveryLocation, getSelectedDeliveryLocationId, setSelectedDeliveryLocationId } from '../utils/deliveryLocations';
import PwaInstallModal from '../components/PwaInstallModal';
import MerchantNotificationsModal from '../components/MerchantNotificationsModal';
import { getBroadcastNotifications, getReadNotificationIds } from '../utils/storeNotifications';

function MerchantHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleThemeSync = () => {
      const saved = localStorage.getItem('theme');
      setIsDark(saved ? saved === 'dark' : true);
    };
    window.addEventListener('theme-changed', handleThemeSync);
    return () => window.removeEventListener('theme-changed', handleThemeSync);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    window.dispatchEvent(new Event('theme-changed'));
  };

  // Notifications State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  useEffect(() => {
    const updateUnread = async () => {
      try {
        const allNotifs = await getBroadcastNotifications();
        const readIds = getReadNotificationIds();
        const count = allNotifs.filter(n => !readIds.includes(n.id)).length;
        setUnreadNotifCount(count);
      } catch {}
    };
    updateUnread();
    window.addEventListener('broadcast-notifications-updated', updateUnread);
    window.addEventListener('broadcast-notifications-read', updateUnread);
    window.addEventListener('storage', updateUnread);
    return () => {
      window.removeEventListener('broadcast-notifications-updated', updateUnread);
      window.removeEventListener('broadcast-notifications-read', updateUnread);
      window.removeEventListener('storage', updateUnread);
    };
  }, []);

  // Delivery Locations State
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [selectedLocId, setSelectedLocId] = useState<string>(() => getSelectedDeliveryLocationId());
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Shop' | 'Godown'>('Shop');
  const [newLocAddress, setNewLocAddress] = useState('');

  useEffect(() => {
    const handleLocUpdate = () => {
      setDeliveryLocations(getDeliveryLocations());
      setSelectedLocId(getSelectedDeliveryLocationId());
    };
    const handleOpenPicker = () => {
      setIsLocDropdownOpen(true);
    };
    window.addEventListener('delivery_locations_updated', handleLocUpdate);
    window.addEventListener('selected_delivery_location_changed', handleLocUpdate);
    window.addEventListener('open-dispatch-selector', handleOpenPicker);
    window.addEventListener('open-location-picker', handleOpenPicker);
    return () => {
      window.removeEventListener('delivery_locations_updated', handleLocUpdate);
      window.removeEventListener('selected_delivery_location_changed', handleLocUpdate);
      window.removeEventListener('open-dispatch-selector', handleOpenPicker);
      window.removeEventListener('open-location-picker', handleOpenPicker);
    };
  }, []);

  const activeLocation = deliveryLocations.find(l => l.id === selectedLocId) || deliveryLocations[0];

  const handleCreateLoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !newLocAddress.trim()) return;
    const created = addDeliveryLocation({
      name: newLocName.trim(),
      type: newLocType,
      address: newLocAddress.trim(),
    });
    setDeliveryLocations(getDeliveryLocations());
    setSelectedLocId(created.id);
    setSelectedDeliveryLocationId(created.id);
    setNewLocName('');
    setNewLocAddress('');
    setIsAddingLoc(false);
    setIsLocDropdownOpen(false);
  };

  // Listen for custom open-profile-drawer events and route to /profile
  useEffect(() => {
    const handleOpenProfile = () => navigate('/profile');
    window.addEventListener('open-profile-drawer', handleOpenProfile);
    return () => window.removeEventListener('open-profile-drawer', handleOpenProfile);
  }, [navigate]);

  const { items: cartItems, setIsOpen: setIsCartOpen } = useCart();
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <>
      {/* Seamless App Bar Header with safe area notch protection */}
      <header className="sticky top-0 z-40 w-full ios-notch-header bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md font-sans border-b border-[#E5E7EB] dark:border-[#262626]">
        <div className="px-3.5 sm:px-6 h-14 flex justify-between items-center w-full max-w-5xl mx-auto">
          {/* Brand Identity: Left on mobile & desktop */}
          <div 
            onClick={() => navigate('/store')}
            className="flex items-center gap-2.5 cursor-pointer select-none group md:mr-auto"
            title="TEJAS CANVASSING - Wholesale Rice Exchange"
          >
            {/* Red Leaf Emblem */}
            <div className="w-8 h-8 rounded-full bg-[#C22424] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                <span className="font-sans text-sm font-extrabold tracking-tight text-neutral-900 dark:text-white leading-none">
                  Tejas
                </span>
                <span className="font-sans text-[11px] font-black tracking-widest text-[#C22424] uppercase leading-none">
                  CANVASSING
                </span>
              </div>
              <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block mt-0.5">
                Rice Merchants & Brokers
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {[
              { label: 'Home', path: '/store', icon: Home },
              { label: 'Brokerage', path: '/brokerage', icon: Calculator },
              { label: 'Cart', path: '/bag', icon: ShoppingBag, count: cartItemCount },
              { label: 'Orders', path: '/my-orders', icon: Package },
              { label: 'Profile', path: '/profile', icon: User },
            ].map((link) => {
              const isActive = (link.path === '/store' && location.pathname === '/store') ||
                (link.path === '/my-orders' && (location.pathname === '/my-orders' || location.pathname === '/placed-orders')) ||
                (link.path !== '/store' && link.path !== '/my-orders' && location.pathname === link.path);
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    isActive
                      ? "bg-[#C22424] text-white shadow-2xs"
                      : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                  {typeof link.count === 'number' && link.count > 0 && (
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-[#C22424] text-white"
                    )}>
                      {link.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Tools: Location symbol (Left of Bell), Notification Bell, Theme toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Delivery Location Symbol Button (Left of Notification Bell) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLocDropdownOpen(prev => !prev)}
                className="w-9 h-9 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-all cursor-pointer relative"
                title={`Dispatch Location: ${activeLocation?.name || 'Main Shop'}`}
                aria-label="Select Delivery Location"
              >
                <MapPin className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                <span className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#C22424]" />
              </button>

              {/* Location Selector Dropdown */}
              <AnimatePresence>
                {isLocDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => {
                        setIsLocDropdownOpen(false);
                        setIsAddingLoc(false);
                      }} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-72 xs:w-80 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl shadow-xl p-2.5 z-50 space-y-2 text-left"
                    >
                      <div className="px-1 py-0.5 border-b border-neutral-100 dark:border-[#262626] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C22424]" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
                            Dispatch Location
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddingLoc(p => !p)}
                          className="text-[8.5px] font-bold text-[#C22424] hover:text-[#B91C1C] flex items-center gap-0.5 cursor-pointer bg-red-50 dark:bg-red-950/40 hover:bg-red-100 px-2 py-0.5 rounded-lg border border-red-200 dark:border-red-900/40 transition-all"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{isAddingLoc ? 'Cancel' : 'Add Shop'}</span>
                        </button>
                      </div>

                      {/* Inline Add Location Form */}
                      {isAddingLoc && (
                        <form onSubmit={handleCreateLoc} className="p-2 bg-red-50/40 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-[8px] font-black uppercase text-neutral-900 dark:text-neutral-200">
                            <span>Register Location</span>
                            <div className="flex items-center gap-1 bg-white/80 dark:bg-black/40 p-0.5 rounded border border-neutral-200 dark:border-neutral-800">
                              <button
                                type="button"
                                onClick={() => setNewLocType('Shop')}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[7.5px] font-bold cursor-pointer transition-all",
                                  newLocType === 'Shop' ? "bg-[#C22424] text-white" : "text-neutral-600 dark:text-neutral-300"
                                )}
                              >
                                🏬 Shop
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewLocType('Godown')}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[7.5px] font-bold cursor-pointer transition-all",
                                  newLocType === 'Godown' ? "bg-[#C22424] text-white" : "text-neutral-600 dark:text-neutral-300"
                                )}
                              >
                                🏭 Godown
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Shop / Godown Name (e.g. Branch 2)"
                            value={newLocName}
                            onChange={(e) => setNewLocName(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-lg outline-none font-bold text-neutral-900 dark:text-white"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Delivery Address / APMC Shed"
                            value={newLocAddress}
                            onChange={(e) => setNewLocAddress(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-lg outline-none font-medium text-neutral-900 dark:text-white"
                            required
                          />
                          <div className="flex justify-end gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setIsAddingLoc(false)}
                              className="px-2 py-0.5 text-[8.5px] text-neutral-500 hover:text-neutral-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2.5 py-0.5 bg-[#C22424] hover:bg-[#B91C1C] text-white text-[8.5px] font-black rounded-lg cursor-pointer shadow-2xs active:scale-95 transition-all"
                            >
                              Save & Select
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="max-h-52 overflow-y-auto space-y-1 py-0.5 no-scrollbar scrollbar-none">
                        {deliveryLocations.map((loc) => {
                          const isSelected = loc.id === (activeLocation?.id || selectedLocId);
                          return (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => {
                                setSelectedLocId(loc.id);
                                setSelectedDeliveryLocationId(loc.id);
                                setIsLocDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-1.5 cursor-pointer border",
                                isSelected
                                  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-neutral-900 dark:text-white font-bold"
                                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60 border-transparent text-neutral-700 dark:text-neutral-300"
                              )}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-xs truncate">{loc.name}</span>
                                  <span className={cn(
                                    "text-[8px] font-extrabold uppercase px-1 py-0.5 rounded font-mono",
                                    loc.type === 'Godown' ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-red-50 dark:bg-red-950/60 text-[#C22424]"
                                  )}>
                                    {loc.type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1 leading-snug">
                                  {loc.address}
                                </p>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#C22424] shrink-0 mt-0.5 stroke-[2.5]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Bell notification */}
            <button
              type="button"
              onClick={() => setIsNotifModalOpen(true)}
              className="w-9 h-9 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-all cursor-pointer relative"
              title="Store Notifications & Announcements"
              aria-label="Store Notifications"
            >
              <Bell className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#C22424] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-slate-200 border border-neutral-200 dark:border-neutral-700 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Merchant Notifications Modal */}
      <MerchantNotificationsModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        onUnreadCountChange={setUnreadNotifCount}
      />

    </>
  );
}

function MerchantBottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);

  const isTabActive = (tab: string) => {
    if (tab === 'home') {
      return location.pathname === '/store' || location.pathname === '/shop' || location.pathname === '/';
    }
    if (tab === 'brokerage') {
      return location.pathname === '/brokerage';
    }
    if (tab === 'cart') {
      return location.pathname === '/bag' || location.pathname === '/cart';
    }
    if (tab === 'orders') {
      return location.pathname === '/my-orders' || location.pathname === '/placed-orders' || location.pathname === '/orders';
    }
    if (tab === 'profile') {
      return location.pathname === '/profile';
    }
    return false;
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#E5E7EB] dark:border-[#262626] pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <nav 
        id="floating-bottom-nav"
        className="w-full max-w-md mx-auto px-2 py-1.5 flex items-center justify-around font-sans"
      >
        {/* Home */}
        <button
          id="floating-nav-home"
          type="button"
          onClick={() => navigate('/store')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer border-0 outline-none select-none",
            isTabActive('home')
              ? "text-[#C22424] font-bold" 
              : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
          )}
        >
          <Home className={cn("w-5 h-5", isTabActive('home') && "stroke-[2.5]")} />
          <span className="text-[10px] tracking-tight leading-none">Home</span>
        </button>

        {/* Brokerage */}
        <button
          id="floating-nav-brokerage"
          type="button"
          onClick={() => navigate('/brokerage')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer border-0 outline-none select-none",
            isTabActive('brokerage')
              ? "text-[#C22424] font-bold" 
              : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
          )}
        >
          <Calculator className={cn("w-5 h-5", isTabActive('brokerage') && "stroke-[2.5]")} />
          <span className="text-[10px] tracking-tight leading-none">Brokerage</span>
        </button>

        {/* Cart */}
        <button
          id="floating-nav-cart"
          type="button"
          onClick={() => navigate('/bag')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 relative transition-colors cursor-pointer border-0 outline-none select-none",
            isTabActive('cart')
              ? "text-[#C22424] font-bold" 
              : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
          )}
        >
          <div className="relative">
            <ShoppingBag className={cn("w-5 h-5", isTabActive('cart') && "stroke-[2.5]")} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#C22424] text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                {totalCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight leading-none">Cart</span>
        </button>

        {/* Orders */}
        <button
          id="floating-nav-orders"
          type="button"
          onClick={() => navigate('/my-orders')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer border-0 outline-none select-none",
            isTabActive('orders')
              ? "text-[#C22424] font-bold" 
              : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
          )}
        >
          <Package className={cn("w-5 h-5", isTabActive('orders') && "stroke-[2.5]")} />
          <span className="text-[10px] tracking-tight leading-none">Orders</span>
        </button>

        {/* Profile */}
        <button
          id="floating-nav-profile"
          type="button"
          onClick={() => navigate('/profile')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors cursor-pointer border-0 outline-none select-none",
            isTabActive('profile')
              ? "text-[#C22424] font-bold" 
              : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
          )}
        >
          <User className={cn("w-5 h-5", isTabActive('profile') && "stroke-[2.5]")} />
          <span className="text-[10px] tracking-tight leading-none">Profile</span>
        </button>
      </nav>
    </div>
  );
}

function EmployeeHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName') || 'Logistics Operations Staff';

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    try {
      await performSecureLogout();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    navigate('/login?portal=employee');
  };

  return (
    <header className="sticky top-0 z-40 w-full ios-notch-header bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#262626] shadow-2xs font-sans">
      <div className="px-3.5 sm:px-6 h-14 flex items-center justify-between max-w-5xl mx-auto w-full">
        {/* Brand & Employee Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            onClick={() => navigate('/employee/dashboard')}
            className="w-8 h-8 rounded-xl bg-[#C22424] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
          >
            <Warehouse className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-[#C22424] dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded font-mono">
                Field Operations
              </span>
            </div>
            <h2 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
              {userName}
            </h2>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { 
              label: 'Schedule', 
              path: '/employee/schedule',
              active: location.pathname === '/employee/schedule' || location.pathname === '/employee/dashboard' || location.pathname === '/employee' || location.pathname === '/schedule' || location.pathname === '/tasks'
            },
            { 
              label: 'Rates', 
              path: '/employee/rates',
              active: location.pathname === '/employee/rates' || location.pathname === '/inventory'
            },
            { 
              label: 'Profile', 
              path: '/employee/profile',
              active: location.pathname === '/employee/profile'
            },
          ].map(tab => {
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  tab.active
                    ? "bg-[#C22424] text-white shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-pwa-install-modal'))}
            className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-[#C22424] dark:bg-red-950/40 dark:text-red-300 border border-red-200/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Download App / PWA"
          >
            <Download className="w-4 h-4 text-[#C22424]" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-800 text-neutral-700 dark:text-slate-200 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function EmployeeBottomBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isScheduleActive = 
    location.pathname === '/employee/schedule' || 
    location.pathname === '/employee/dashboard' || 
    location.pathname === '/employee' || 
    location.pathname === '/schedule' || 
    location.pathname === '/tasks';

  const isRatesActive = 
    location.pathname === '/employee/rates' || 
    location.pathname === '/inventory';

  const isProfileActive = 
    location.pathname === '/employee/profile';

  const tabs = [
    { label: 'Schedule', path: '/employee/schedule', icon: Calendar, active: isScheduleActive },
    { label: 'Rates', path: '/employee/rates', icon: TrendingUp, active: isRatesActive },
    { label: 'Profile', path: '/employee/profile', icon: User, active: isProfileActive },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#E5E7EB] dark:border-[#262626] pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <nav className="w-full max-w-md mx-auto px-6 py-1.5 flex items-center justify-around font-sans">
        {tabs.map((tab) => {
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-colors cursor-pointer border-0 outline-none select-none",
                tab.active 
                  ? "text-[#C22424] font-bold" 
                  : "text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-medium"
              )}
            >
              <tab.icon className={cn("w-5 h-5", tab.active && "stroke-[2.5]")} />
              <span className="text-[10px] tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MainLayoutContent({ onSearchClick }: { onSearchClick: () => void }) {
  const location = useLocation();
  const [role, setRole] = useState<'admin' | 'employee' | 'merchant' | string>(() => {
    try {
      return getVerifiedUserRole() || 'merchant';
    } catch {
      return 'merchant';
    }
  });

  useEffect(() => {
    const handleRoleSync = () => {
      try {
        setRole(getVerifiedUserRole() || 'merchant');
      } catch {
        setRole('merchant');
      }
    };
    window.addEventListener('storage', handleRoleSync);
    window.addEventListener('role-changed', handleRoleSync);
    return () => {
      window.removeEventListener('storage', handleRoleSync);
      window.removeEventListener('role-changed', handleRoleSync);
    };
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) return saved === 'true';
    } catch {}
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }
    };
    // Initial check
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    try {
      localStorage.setItem('sidebar_collapsed', String(collapsed));
    } catch {}
  };

  // 1. Employee role: strictly renders Employee portal (Schedule, Rates, Profile)
  if (role === 'employee') {
    const employeeAllowedPaths = [
      '/employee',
      '/employee/dashboard',
      '/employee/schedule',
      '/employee/rates',
      '/employee/profile',
      '/inventory',
      '/schedule',
      '/tasks'
    ];
    if (!employeeAllowedPaths.includes(location.pathname)) {
      return <Navigate to="/employee/schedule" replace />;
    }

    return (
      <div className="w-full min-h-dvh bg-[#FAFBFA] dark:bg-[#0A0A0A] flex flex-col items-center text-neutral-900 dark:text-neutral-100 font-sans antialiased">
        <div className="w-full max-w-4xl min-h-dvh bg-[#FAFBFA] dark:bg-[#0A0A0A] relative flex flex-col">
          <EmployeeHeader />
          <main className="flex-1 w-full relative pb-20 p-3 sm:p-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, scale: 0.99, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.01, y: -4 }}
                transition={{ 
                  duration: 0.28, 
                  ease: [0.22, 1, 0.36, 1] 
                }}
                className="w-full h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          <EmployeeBottomBar />
        </div>
      </div>
    );
  }

  // 2. Merchant role: strictly renders Merchant portal (Store, My Orders, Brokerage, Bag, Profile)
  if (role === 'merchant') {
    const merchantAllowedPaths = ['/store', '/shop', '/bag', '/cart', '/checkout', '/my-orders', '/brokerage', '/profile'];
    if (!merchantAllowedPaths.includes(location.pathname)) {
      return <Navigate to="/store" replace />;
    }

    return (
      <div className="w-full min-h-dvh bg-[#FAFBFA] dark:bg-[#0A0A0A] flex flex-col items-center text-neutral-900 dark:text-neutral-100 font-sans antialiased">
        <div className="w-full max-w-4xl min-h-dvh bg-[#FAFBFA] dark:bg-[#0A0A0A] relative flex flex-col">
          <MerchantHeader onSearchClick={onSearchClick} />
          <main className="flex-1 w-full relative pb-20">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, scale: 0.99, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.01, y: -4 }}
                transition={{ 
                  duration: 0.28, 
                  ease: [0.22, 1, 0.36, 1] 
                }}
                className="w-full h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          <MerchantBottomBar />
        </div>
      </div>
    );
  }

  // 3. Admin portal (Sidebar + Navbar) as standard executive console
  // Admin NEVER sees MerchantHeader, MerchantBottomBar, EmployeeHeader, or any Bag/Store UI
  const adminForbiddenPaths = ['/store', '/shop', '/bag', '/cart', '/checkout', '/my-orders', '/brokerage'];
  if (role === 'admin' && adminForbiddenPaths.includes(location.pathname)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div 
      data-admin-portal="true" 
      className={cn(
        "bg-[#fbfbfa] dark:bg-[#07110c] text-slate-900 dark:text-slate-100 admin-font font-sf antialiased relative selection:bg-amber-500/20 selection:text-amber-900 dark:selection:text-amber-300",
        location.pathname === '/arrival-entry' 
          ? "h-screen max-h-screen overflow-hidden flex flex-col" 
          : "min-h-screen"
      )}
    >
      {/* Subtle Ambient Translucent Glow for Light & Dark Mode Depth */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-amber-400/10 to-emerald-400/5 dark:from-amber-400/5 dark:to-emerald-500/5 blur-3xl opacity-70" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-500/8 to-amber-300/5 dark:from-emerald-500/5 dark:to-transparent blur-3xl opacity-60" />
      </div>

      <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={handleToggleSidebar} />
      
      {/* Mobile sidebar backdrop overlay to close sidebar on interactive tap */}
      {!isSidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity cursor-pointer"
          onClick={() => handleToggleSidebar(true)}
        />
      )}

      <Navbar 
        onSearchClick={onSearchClick} 
        isSidebarCollapsed={isSidebarCollapsed} 
        onToggleSidebar={() => handleToggleSidebar(!isSidebarCollapsed)}
      />
      <main className={cn(
        "pt-[calc(4rem+env(safe-area-inset-top,0px))] relative transition-all duration-300 z-10",
        location.pathname === '/arrival-entry' 
          ? "h-screen max-h-screen overflow-hidden flex flex-col" 
          : "min-h-[calc(100vh-64px)]",
        isSidebarCollapsed ? "ml-0 md:ml-20" : "ml-0 md:ml-64"
      )}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.99, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.01, y: -4 }}
            transition={{ 
              duration: 0.35, 
              ease: [0.22, 1, 0.36, 1] 
            }}
            className={cn("w-full", location.pathname === '/arrival-entry' ? "h-full flex-1 flex flex-col min-h-0 overflow-hidden" : "h-full")}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function MainLayout() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenPwa = () => setIsPwaModalOpen(true);
    window.addEventListener('open-pwa-install-modal', handleOpenPwa);
    return () => window.removeEventListener('open-pwa-install-modal', handleOpenPwa);
  }, []);

  return (
    <>
      <MainLayoutContent onSearchClick={() => setIsCommandPaletteOpen(true)} />
      <CommandPalette isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />
      <PwaInstallModal isOpen={isPwaModalOpen} onClose={() => setIsPwaModalOpen(false)} />
    </>
  );
}

