import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { CartProvider, useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import CommandPalette from '../components/CommandPalette';
import GlobalCartDrawer from '../components/GlobalCartDrawer';
import { auth, setCollectionDoc, getCollectionDocs } from '../lib/firebase';
import { cn } from '../lib/utils';
import { Store, Package, LogOut, Percent, User, Building, Phone, X, Check, Sun, Moon, Search, Plus, Trash2, Warehouse, MapPin, ShoppingBasket, Building2, ShieldCheck, Edit3, Lock, Unlock, Settings, CheckCircle2, Copy, Calendar, Clock, Download } from 'lucide-react';
import { getDeliveryLocations, saveDeliveryLocations, addDeliveryLocation, removeDeliveryLocation, DeliveryLocation } from '../utils/deliveryLocations';
import PwaInstallModal from '../components/PwaInstallModal';

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

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profName, setProfName] = useState(() => localStorage.getItem('userName') || 'V.K FOODS');
  const [profPhone, setProfPhone] = useState(() => localStorage.getItem('userPhone') || '9342380981');
  const [profGstin, setProfGstin] = useState(() => localStorage.getItem('userGstin') || '29AAGCV7712M1ZP');
  const [profAddress, setProfAddress] = useState(() => localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
  const [isProfileLocked, setIsProfileLocked] = useState(() => localStorage.getItem('profileLocked') === 'true');
  const [activeProfileTab, setActiveProfileTab] = useState<'credentials' | 'locations' | 'preferences'>('credentials');
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [locations, setLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Shop' | 'Godown'>('Godown');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');
  const [newLocGstin, setNewLocGstin] = useState('');

  // Subscribe to auth state updates to guarantee correct ID on mount & login
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch and update database profile details as soon as active user changes or mounts
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const userEmail = currentUser?.email || localStorage.getItem('userEmail') || '';
        const currentUid = currentUser?.uid || auth.currentUser?.uid || '';
        if (!userEmail && !currentUid) return;

        const docs = await getCollectionDocs('stakeholders').catch(() => []);
        if (docs && docs.length > 0) {
          const found = docs.find((d: any) => 
            (currentUid && d.id === currentUid) ||
            (userEmail && d.email?.toLowerCase() === userEmail.toLowerCase())
          );
          if (found) {
            localStorage.setItem('userName', found.name || 'V.K FOODS');
            localStorage.setItem('userPhone', found.phone || '9342380981');
            localStorage.setItem('userGstin', found.gstin || '29AAGCV7712M1ZP');
            localStorage.setItem('userAddress', found.address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
            localStorage.setItem('profileLocked', found.profileLocked ? 'true' : 'false');
            
            setProfName(found.name || 'V.K FOODS');
            setProfPhone(found.phone || '9342380981');
            setProfGstin(found.gstin || '29AAGCV7712M1ZP');
            setProfAddress(found.address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
            setIsProfileLocked(!!found.profileLocked);
            
            // Dispatch synchronization signals
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('profile-updated'));
          }
        }
      } catch (err) {
        console.warn('Silent error retrieving user profile in header:', err);
      }
    }

    fetchUserProfile();
  }, [currentUser]);

  // Sync profile data when opened or changed globally
  useEffect(() => {
    if (isProfileOpen) {
      setProfName(localStorage.getItem('userName') || 'V.K FOODS');
      setProfPhone(localStorage.getItem('userPhone') || '9342380981');
      setProfGstin(localStorage.getItem('userGstin') || '29AAGCV7712M1ZP');
      setProfAddress(localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
      setIsProfileLocked(localStorage.getItem('profileLocked') === 'true');
      setLocations(getDeliveryLocations());
    }
  }, [isProfileOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      window.dispatchEvent(new Event('role-changed'));
      window.dispatchEvent(new Event('storage'));
      navigate('/login');
    } catch (err) {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      window.dispatchEvent(new Event('role-changed'));
      window.dispatchEvent(new Event('storage'));
      navigate('/login');
    }
  };

  // Listen for custom open-profile-drawer events from bottom bar
  useEffect(() => {
    const handleOpenProfile = () => setIsProfileOpen(true);
    window.addEventListener('open-profile-drawer', handleOpenProfile);
    return () => window.removeEventListener('open-profile-drawer', handleOpenProfile);
  }, []);

  const { items: cartItems, setIsOpen: setIsCartOpen } = useCart();
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <>
      {/* Seamless App Bar Header - Unifies with main screen without any separating line */}
      <header className="sticky top-0 z-40 w-full px-3.5 sm:px-4 py-3 bg-[#fafaf9] dark:bg-[#07110c] flex justify-between items-center font-sans border-0 shadow-none">
        
        {/* Brand Identity & Verified Merchant */}
        <div className="flex items-center gap-2.5">
          <div 
            onClick={() => navigate('/store')}
            className="flex items-center gap-2 cursor-pointer select-none group"
            title="TEJAS CANVASSING"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/70 flex items-center justify-center text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <path d="M12 2L14 7L12 12L10 7L12 2Z" fill="#d4af37" />
                <path d="M14 7L18 10L14 13L13 9L14 7Z" fill="#e9c349" />
                <path d="M10 7L6 10L10 13L11 9L10 7Z" fill="#d4af37" />
                <path d="M12 12V22" stroke="#0e4835" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-sans text-sm font-black tracking-tight text-slate-900 dark:text-white leading-none whitespace-nowrap">
                TEJAS CANVASSING
              </h1>
            </div>
          </div>
        </div>

        {/* Right Tools: Download App, Dark/Light Mode, Logout */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Download App / Add to Home Screen Button */}
          <button
            onClick={() => window.dispatchEvent(new Event('open-pwa-install-modal'))}
            className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-xs"
            title="Download App / Add to Home Screen"
            aria-label="Download App"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-850 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-neutral-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-xs"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-800" />
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-xs"
            title="Sign out from session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Sliding Profile Drawer */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="fixed inset-0 bg-[#020b08]/70 backdrop-blur-md z-[70] transition-opacity"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] max-w-full bg-[#fafdfc]/98 dark:bg-[#06140e]/98 backdrop-blur-2xl border-l border-slate-200/90 dark:border-emerald-950/70 shadow-[-25px_0_60px_rgba(0,0,0,0.4)] z-[80] flex flex-col font-sans overflow-hidden text-left"
            >
              {/* Executive Merchant Identity Header */}
              <div className="relative p-5 pb-4 border-b border-slate-200/80 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-900/[0.06] via-transparent to-teal-900/[0.04] dark:from-emerald-950/50 dark:to-transparent">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Merchant Crest Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0e3c2b] to-[#1a6649] text-white flex items-center justify-center font-black text-base shadow-md ring-2 ring-emerald-500/25">
                        {profName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'VK'}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-[#06140e]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                          {profName}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Verified Buyer
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
                        <span>GSTIN: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{profGstin}</span></span>
                      </p>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer border border-transparent shadow-2xs"
                    title="Close Profile"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Key Metrics Quick Ribbon */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-emerald-950/40">
                  <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/70 dark:border-emerald-950/70 rounded-xl p-2 text-left">
                    <span className="text-[8.5px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                      Trade Credit
                    </span>
                    <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                      ₹ 80.0 L
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/70 dark:border-emerald-950/70 rounded-xl p-2 text-left">
                    <span className="text-[8.5px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                      Saved Sites
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {locations.length} Locations
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/70 dark:border-emerald-950/70 rounded-xl p-2 text-left">
                    <span className="text-[8.5px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                      Account Tier
                    </span>
                    <span className="text-xs font-black text-amber-700 dark:text-amber-400 mt-0.5 block">
                      APMC Tier-1
                    </span>
                  </div>
                </div>

                {/* Toast Notification Pill */}
                <AnimatePresence>
                  {(copiedField || successMsg) && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#0e3c2b] text-white text-[10.5px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 z-20 border border-emerald-400/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{copiedField ? `${copiedField} copied to clipboard!` : successMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Segmented Tab Navigation */}
                <div className="flex bg-slate-100/90 dark:bg-neutral-900/90 p-1 rounded-xl mt-3 border border-slate-200/70 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setActiveProfileTab('credentials')}
                    className={cn(
                      "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none",
                      activeProfileTab === 'credentials'
                        ? "bg-white dark:bg-neutral-800 text-emerald-800 dark:text-emerald-300 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Business KYC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileTab('locations')}
                    className={cn(
                      "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none",
                      activeProfileTab === 'locations'
                        ? "bg-white dark:bg-neutral-800 text-emerald-800 dark:text-emerald-300 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Godowns ({locations.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileTab('preferences')}
                    className={cn(
                      "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none",
                      activeProfileTab === 'preferences'
                        ? "bg-white dark:bg-neutral-800 text-emerald-800 dark:text-emerald-300 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Preferences</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Tab Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* --- TAB 1: BUSINESS KYC & TAX CREDENTIALS --- */}
                {activeProfileTab === 'credentials' && (
                  <div className="space-y-4">
                    {/* View/Edit Mode Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {isEditMode ? "Edit Profile Information" : "Commercial Credentials"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditMode(!isEditMode)}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isEditMode ? "Cancel Editing" : "Edit Details"}</span>
                      </button>
                    </div>

                    {!isEditMode ? (
                      /* READ-ONLY VERIFIED CREDENTIALS VIEW */
                      <div className="space-y-3">
                        {/* Business Name Card */}
                        <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-emerald-600" />
                              Registered Firm / Business Name
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified</span>
                          </div>
                          <p className="text-sm font-black text-slate-900 dark:text-white pt-0.5">
                            {profName}
                          </p>
                        </div>

                        {/* GSTIN Card with 1-click Copy */}
                        <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <span>Goods & Services Tax (GSTIN)</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[9px]">
                              Active
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white tracking-widest">
                              {profGstin}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(profGstin, 'GSTIN')}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                              title="Copy GSTIN"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            State Code: 29 (Karnataka) • Applicable for e-Invoicing & B2B ITC credit
                          </p>
                        </div>

                        {/* Phone Card */}
                        <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              Registered Phone Number
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified Line</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              +91 {profPhone}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(profPhone, 'Phone Number')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                              title="Copy Phone Number"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Number</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Registered line for receiving automated dispatch updates and PO notifications
                          </p>
                        </div>

                        {/* Primary Registered Address Card */}
                        <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              Principal Logistics Billing Address
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(profAddress, 'Address')}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                            {profAddress}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* EDITABLE CREDENTIALS FORM */
                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Registered Business Name
                          </label>
                          <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={profName}
                              onChange={(e) => setProfName(e.target.value)}
                              placeholder="e.g. V.K FOODS"
                              className="w-full bg-white dark:bg-[#0a1b14] border border-slate-200 dark:border-emerald-950/80 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Tax / GSTIN Number
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black font-mono text-emerald-600">GST</span>
                            <input
                              type="text"
                              value={profGstin}
                              onChange={(e) => setProfGstin(e.target.value.toUpperCase())}
                              placeholder="e.g. 29AAGCV7712M1ZP"
                              className="w-full bg-white dark:bg-[#0a1b14] border border-slate-200 dark:border-emerald-950/80 rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 uppercase tracking-wider"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Procurement Desk Phone
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="tel"
                              value={profPhone}
                              onChange={(e) => setProfPhone(e.target.value)}
                              placeholder="e.g. 9342380981"
                              className="w-full bg-white dark:bg-[#0a1b14] border border-slate-200 dark:border-emerald-950/80 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Principal Delivery Address
                          </label>
                          <textarea
                            rows={3}
                            value={profAddress}
                            onChange={(e) => setProfAddress(e.target.value)}
                            placeholder="Enter full logistics address..."
                            className="w-full bg-white dark:bg-[#0a1b14] border border-slate-200 dark:border-emerald-950/80 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                          />
                        </div>

                        {/* Save Button */}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={async () => {
                            setIsSaving(true);
                            setSuccessMsg('');
                            try {
                              const userEmail = localStorage.getItem('userEmail') || auth.currentUser?.email || 'merchant.test@riceaggregator.com';
                              const currentUid = auth.currentUser?.uid || `usr-${Date.now()}`;
                              
                              const updatedStakeholder = {
                                id: currentUid,
                                name: profName.trim() || 'V.K FOODS',
                                type: 'buyers',
                                phone: profPhone.trim() || '9342380981',
                                email: userEmail,
                                gstin: profGstin.trim().toUpperCase() || '29AAGCV7712M1ZP',
                                address: profAddress.trim() || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
                                status: 'Active',
                                credit: '₹ 80.0 Lakh',
                                profileLocked: true,
                                updatedAt: new Date().toISOString()
                              };

                              await setCollectionDoc('stakeholders', currentUid, updatedStakeholder);

                              localStorage.setItem('userName', updatedStakeholder.name);
                              localStorage.setItem('userPhone', updatedStakeholder.phone);
                              localStorage.setItem('userGstin', updatedStakeholder.gstin);
                              localStorage.setItem('userAddress', updatedStakeholder.address);
                              localStorage.setItem('profileLocked', 'true');

                              const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
                              if (cached) {
                                let updatedBuyers = cached.buyers || [];
                                updatedBuyers = updatedBuyers.filter((b: any) => b.id !== currentUid && b.email?.toLowerCase() !== userEmail.toLowerCase());
                                updatedBuyers.push(updatedStakeholder);
                                cached.buyers = updatedBuyers;
                                localStorage.setItem('stakeholders_v2', JSON.stringify(cached));
                              }

                              setIsProfileLocked(true);
                              setIsEditMode(false);

                              window.dispatchEvent(new Event('storage'));
                              window.dispatchEvent(new Event('profile-updated'));

                              setSuccessMsg('Coordinates updated and locked!');
                              setTimeout(() => setSuccessMsg(''), 2500);
                            } catch (e) {
                              console.error('Error saving profile:', e);
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSaving ? "Saving Coordinates..." : "Save & Verify Information"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* --- TAB 2: GODOWNS & SHOPS MANAGEMENT --- */}
                {activeProfileTab === 'locations' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Delivery Units & Godowns</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Configure multiple godowns, branch shops, and unit GSTs
                        </p>
                      </div>
                      {!isAddingLocation && (
                        <button
                          type="button"
                          onClick={() => setIsAddingLocation(true)}
                          className="px-2.5 py-1.5 bg-[#0e3c2b] dark:bg-emerald-600 hover:bg-[#0a2f22] text-white rounded-xl text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Location</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Register Location Form */}
                    <AnimatePresence>
                      {isAddingLocation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3.5 bg-white dark:bg-[#0a1b14] border border-emerald-500/30 rounded-2xl shadow-sm space-y-3 text-left overflow-hidden"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              Register New Godown / Shop
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsAddingLocation(false)}
                              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                              Unit / Facility Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Yeshwanthpur Godown #2, Branch Store"
                              value={newLocName}
                              onChange={(e) => setNewLocName(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                              Facility Category
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setNewLocType('Godown')}
                                className={cn(
                                  "flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                  newLocType === 'Godown'
                                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                                    : "bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-neutral-800"
                                )}
                              >
                                <Warehouse className="w-3.5 h-3.5" />
                                <span>Godown / Depot</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewLocType('Shop')}
                                className={cn(
                                  "flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                  newLocType === 'Shop'
                                    ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                                    : "bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-neutral-800"
                                )}
                              >
                                <Building className="w-3.5 h-3.5" />
                                <span>Retail / Wholesale Shop</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                              Complete Logistics Delivery Address
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Plot / Shed number, street, city, pin code..."
                              value={newLocAddress}
                              onChange={(e) => setNewLocAddress(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                Contact Phone
                              </label>
                              <input
                                type="tel"
                                placeholder="e.g. 9845012345"
                                value={newLocPhone}
                                onChange={(e) => setNewLocPhone(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center justify-between">
                                <span>Unit GSTIN</span>
                                <span className="text-[8px] text-emerald-600">Optional</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 29AAGCV7712M1ZP"
                                value={newLocGstin}
                                onChange={(e) => setNewLocGstin(e.target.value.toUpperCase())}
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingLocation(false);
                                setNewLocGstin('');
                              }}
                              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!newLocName.trim() || !newLocAddress.trim()) return;
                                addDeliveryLocation({
                                  name: newLocName.trim(),
                                  type: newLocType,
                                  address: newLocAddress.trim(),
                                  phone: newLocPhone.trim() || profPhone,
                                  gstin: newLocGstin.trim().toUpperCase() || profGstin,
                                  isDefault: false
                                });
                                setLocations(getDeliveryLocations());
                                setNewLocName('');
                                setNewLocAddress('');
                                setNewLocPhone('');
                                setNewLocGstin('');
                                setIsAddingLocation(false);
                                setSuccessMsg('New facility location registered!');
                                setTimeout(() => setSuccessMsg(''), 2000);
                              }}
                              disabled={!newLocName.trim() || !newLocAddress.trim()}
                              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs"
                            >
                              Save Location
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Registered Units Card List */}
                    <div className="space-y-2.5">
                      {locations.map((loc) => (
                        <div
                          key={loc.id}
                          className="p-3 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-2 text-left transition-all hover:border-emerald-500/40"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                loc.type === 'Godown'
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              )}>
                                {loc.type === 'Godown' ? (
                                  <Warehouse className="w-4 h-4" />
                                ) : (
                                  <Building className="w-4 h-4" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {loc.name}
                                  </span>
                                  <span className={cn(
                                    "text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase",
                                    loc.type === 'Godown'
                                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                      : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                  )}>
                                    {loc.type}
                                  </span>
                                  {loc.isDefault && (
                                    <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                                      Default Billing Unit
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!loc.isDefault && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeDeliveryLocation(loc.id);
                                  setLocations(getDeliveryLocations());
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                title="Remove Facility"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium pl-9">
                            {loc.address}
                          </p>

                          {/* Extra Badges: GSTIN & Phone */}
                          <div className="flex items-center gap-2 pl-9 pt-1 flex-wrap">
                            {loc.gstin && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(loc.gstin!, 'Unit GSTIN')}
                                className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer"
                                title="Click to copy Unit GSTIN"
                              >
                                <span className="font-sans font-semibold text-slate-400 text-[8px] uppercase">GST:</span>
                                <span>{loc.gstin}</span>
                                <Copy className="w-2.5 h-2.5 opacity-60" />
                              </button>
                            )}

                            {loc.phone && (
                              <a
                                href={`tel:${loc.phone}`}
                                className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-neutral-850 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-neutral-750 hover:text-emerald-600"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>{loc.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- TAB 3: APP PREFERENCES & ACCOUNT SECURITY --- */}
                {activeProfileTab === 'preferences' && (
                  <div className="space-y-4">
                    {/* Theme Mode Preference */}
                    <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Appearance Theme
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isDark) toggleTheme();
                          }}
                          className={cn(
                            "py-2 px-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all",
                            !isDark
                              ? "bg-emerald-50 border-emerald-500/50 text-emerald-900 font-black shadow-2xs"
                              : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-300 font-bold"
                          )}
                        >
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span className="text-xs">Light Mode</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isDark) toggleTheme();
                          }}
                          className={cn(
                            "py-2 px-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all",
                            isDark
                              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200 font-black shadow-2xs"
                              : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-300 font-bold"
                          )}
                        >
                          <Moon className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs">Dark Mode</span>
                        </button>
                      </div>
                    </div>

                    {/* Account Security & Lock */}
                    <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Profile Coordinates Protection
                      </span>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {isProfileLocked ? "Profile Coordinates Locked" : "Profile Unlocked for Edit"}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Prevents accidental modification of verified commercial coordinates.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextLocked = !isProfileLocked;
                            setIsProfileLocked(nextLocked);
                            localStorage.setItem('profileLocked', nextLocked ? 'true' : 'false');
                            window.dispatchEvent(new Event('profile-updated'));
                          }}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1",
                            isProfileLocked
                              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                              : "bg-amber-50 dark:bg-amber-950/60 border-amber-500/40 text-amber-800 dark:text-amber-300"
                          )}
                        >
                          {isProfileLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          <span>{isProfileLocked ? "Locked" : "Unlocked"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Session Metadata */}
                    <div className="p-3.5 bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl shadow-2xs space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Authentication Metadata
                      </span>
                      <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-neutral-800/80">
                        <span className="text-slate-500">User Email:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {localStorage.getItem('userEmail') || auth.currentUser?.email || 'tejasadinarayan@gmail.com'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-neutral-800/80">
                        <span className="text-slate-500">Assigned Role:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                          Merchant / Buyer
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Database Sync:</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Online & Cloud Synced
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-200/80 dark:border-emerald-950/60 bg-slate-50/50 dark:bg-[#040f0c] space-y-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all cursor-pointer border border-rose-200/80 dark:border-rose-900/40 flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MerchantBottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, setIsOpen } = useCart();
  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="fixed bottom-3.5 sm:bottom-4 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pointer-events-none">
      <nav 
        id="floating-bottom-nav"
        className="pointer-events-auto w-full max-w-sm sm:max-w-md bg-white/94 dark:bg-[#07130e]/94 backdrop-blur-2xl rounded-full border border-slate-200/80 dark:border-emerald-950/60 p-2 px-3 sm:px-4 flex items-center justify-around shadow-[0_14px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.65)] ring-1 ring-black/5 dark:ring-white/5 font-sans transition-all"
      >
        <button
          id="floating-nav-shop"
          onClick={() => navigate('/store')}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-full transition-all cursor-pointer border-0 outline-none active:scale-95 select-none",
            location.pathname === '/store' 
              ? "bg-[#143e2e] dark:bg-emerald-500/25 text-white dark:text-emerald-200 font-bold shadow-xs py-1.5 px-3.5 scale-105" 
              : "bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium py-1.5 px-2.5"
          )}
        >
          <Store className="w-4 h-4" />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Shop</span>
        </button>

        <button
          id="floating-nav-orders"
          onClick={() => navigate('/placed-orders')}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-full transition-all cursor-pointer border-0 outline-none active:scale-95 select-none",
            location.pathname === '/placed-orders' 
              ? "bg-[#143e2e] dark:bg-emerald-500/25 text-white dark:text-emerald-200 font-bold shadow-xs py-1.5 px-3.5 scale-105" 
              : "bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium py-1.5 px-2.5"
          )}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Orders</span>
        </button>

        <button
          id="floating-nav-brokerage"
          onClick={() => navigate('/brokerage')}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-full transition-all cursor-pointer border-0 outline-none active:scale-95 select-none",
            location.pathname === '/brokerage' 
              ? "bg-[#143e2e] dark:bg-emerald-500/25 text-white dark:text-emerald-200 font-bold shadow-xs py-1.5 px-3.5 scale-105" 
              : "bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium py-1.5 px-2.5"
          )}
        >
          <Percent className="w-4 h-4" />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Brokerage</span>
        </button>

        <button
          id="floating-nav-bag"
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-full relative transition-all cursor-pointer border-0 bg-transparent outline-none active:scale-95 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium select-none"
        >
          <div className="relative">
            <ShoppingBasket className="w-4 h-4" />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[8px] font-black min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center shadow-xs">
                {totalCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Bag</span>
        </button>

        <button
          id="floating-nav-profile"
          onClick={() => window.dispatchEvent(new Event('open-profile-drawer'))}
          className="flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-full transition-all cursor-pointer border-0 bg-transparent outline-none active:scale-95 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium select-none"
        >
          <User className="w-4 h-4" />
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Profile</span>
        </button>
      </nav>
    </div>
  );
}

function EmployeeHeader() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Logistics Employee';

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
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      window.dispatchEvent(new Event('role-changed'));
      window.dispatchEvent(new Event('storage'));
      navigate('/login');
    } catch (err) {
      localStorage.removeItem('userRole');
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#07130e]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-neutral-800 px-4 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Warehouse className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-mono">
              Field Operations
            </span>
          </div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {userName}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-pwa-install-modal'))}
          className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 cursor-pointer transition-all border border-amber-500/20 flex items-center gap-1.5"
          title="Download App / Add to Home Screen"
        >
          <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-extrabold">App</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer transition-all"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer transition-all border border-rose-500/20"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function EmployeeBottomBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: 'Inventory', path: '/inventory', icon: Package },
    { label: 'Arrivals', path: '/arrival-entry', icon: Warehouse },
    { label: 'Pending', path: '/pending-loadings', icon: Clock },
    { label: 'Schedule', path: '/schedule', icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#07130e]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-neutral-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg max-w-none sm:max-w-md md:max-w-lg mx-auto">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer",
              isActive 
                ? "text-amber-600 dark:text-amber-400 font-extrabold scale-105" 
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <tab.icon className={cn("w-5 h-5", isActive && "text-amber-500")} />
            <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MainLayoutContent({ onSearchClick }: { onSearchClick: () => void }) {
  const location = useLocation();
  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem('userRole') || 'admin';
    } catch {
      return 'admin';
    }
  });

  useEffect(() => {
    const handleRoleSync = () => {
      try {
        setRole(localStorage.getItem('userRole') || 'admin');
      } catch {}
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

  if (role === 'merchant') {
    return (
      <div className="min-h-dvh bg-[#fafaf9] dark:bg-[#07110c] sm:bg-slate-100/70 sm:dark:bg-[#030906] flex justify-center text-slate-900 dark:text-slate-100 font-sans antialiased">
        <div className="w-full max-w-none sm:max-w-md md:max-w-lg min-h-dvh bg-[#fafaf9] dark:bg-[#07110c] sm:shadow-2xl relative flex flex-col border-none sm:border-x border-slate-200/60 dark:border-emerald-950/40">
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

  if (role === 'employee') {
    return (
      <div className="min-h-dvh bg-[#fafaf9] dark:bg-[#07110c] sm:bg-slate-100/70 sm:dark:bg-[#030906] flex justify-center text-slate-900 dark:text-slate-100 font-sans antialiased">
        <div className="w-full max-w-none sm:max-w-md md:max-w-lg min-h-dvh bg-[#fafaf9] dark:bg-[#07110c] sm:shadow-2xl relative flex flex-col border-none sm:border-x border-slate-200/60 dark:border-emerald-950/40">
          <EmployeeHeader />
          <main className="flex-1 w-full relative pb-20 p-2 sm:p-3">
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

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={handleToggleSidebar} />
      
      {/* Mobile sidebar backdrop overlay to close sidebar on interactive tap */}
      {!isSidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/35 backdrop-blur-xs z-50 transition-opacity cursor-pointer"
          onClick={() => handleToggleSidebar(true)}
        />
      )}

      <Navbar 
        onSearchClick={onSearchClick} 
        isSidebarCollapsed={isSidebarCollapsed} 
        onToggleSidebar={() => handleToggleSidebar(!isSidebarCollapsed)}
      />
      <main className={cn(
        "pt-16 min-h-[calc(100vh-64px)] relative transition-all duration-300",
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
            className="w-full h-full"
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
    <CartProvider>
      <MainLayoutContent onSearchClick={() => setIsCommandPaletteOpen(true)} />
      <GlobalCartDrawer />
      <CommandPalette isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />
      <PwaInstallModal isOpen={isPwaModalOpen} onClose={() => setIsPwaModalOpen(false)} />
    </CartProvider>
  );
}

