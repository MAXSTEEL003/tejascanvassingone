import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, MapPin, ShieldCheck, Phone, Check, Copy,
  CheckCircle2, Plus, Trash2, LogOut, Edit3, Save, ChevronRight,
  Package, Layers, ChevronDown, Bell, ExternalLink, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { performSecureLogout } from '../lib/auth';
import { cn } from '../lib/utils';
import { 
  getDeliveryLocations, 
  DeliveryLocation, 
  addDeliveryLocation, 
  removeDeliveryLocation 
} from '../utils/deliveryLocations';

export default function ProfileView() {
  const navigate = useNavigate();

  const [profName, setProfName] = useState(() => {
    return localStorage.getItem('userName') || 'Authorized Merchant';
  });
  const [profPhone, setProfPhone] = useState(() => localStorage.getItem('userPhone') || '');
  const [profGstin, setProfGstin] = useState(() => localStorage.getItem('userGstin') || '29AAGCV7712M1ZP');
  const [profAddress, setProfAddress] = useState(() => localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
  const [isProfileLocked, setIsProfileLocked] = useState(() => localStorage.getItem('profileLocked') === 'true');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Temporary form states for editing
  const [tempName, setTempName] = useState(profName);
  const [tempPhone, setTempPhone] = useState(profPhone);
  const [tempGstin, setTempGstin] = useState(profGstin);
  const [tempAddress, setTempAddress] = useState(profAddress);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded section state
  const [expandedSection, setExpandedSection] = useState<'business' | 'addresses' | null>(null);

  // Delivery Locations
  const [locations, setLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<'Shop' | 'Godown'>('Shop');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');

  useEffect(() => {
    setLocations(getDeliveryLocations());
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openEditModal = () => {
    setTempName(profName);
    setTempPhone(profPhone);
    setTempGstin(profGstin);
    setTempAddress(profAddress);
    setIsEditModalOpen(true);
  };

  const handleSaveModalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = tempName.trim() || 'Authorized Merchant';
    const finalPhone = tempPhone.trim().replace(/[^\d]/g, '');
    const finalGstin = tempGstin.trim().toUpperCase() || '29AAGCV7712M1ZP';
    const finalAddress = tempAddress.trim() || profAddress;

    setProfName(finalName);
    setProfPhone(finalPhone);
    setProfGstin(finalGstin);
    setProfAddress(finalAddress);

    localStorage.setItem('userName', finalName);
    localStorage.setItem('userPhone', finalPhone);
    localStorage.setItem('userGstin', finalGstin);
    localStorage.setItem('userAddress', finalAddress);

    setIsEditModalOpen(false);
    setIsEditMode(false);
    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(null), 2500);
    window.dispatchEvent(new Event('storage'));
  };

  const handleSaveProfile = () => {
    localStorage.setItem('userName', profName.trim());
    localStorage.setItem('userPhone', profPhone.trim());
    localStorage.setItem('userGstin', profGstin.trim().toUpperCase());
    localStorage.setItem('userAddress', profAddress.trim());
    setIsEditMode(false);
    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(null), 2500);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCreateDestination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !newLocAddress.trim()) return;
    addDeliveryLocation({
      name: newLocName.trim(),
      type: newLocType,
      address: newLocAddress.trim(),
      phone: newLocPhone.trim() || undefined,
    });
    setLocations(getDeliveryLocations());
    setNewLocName('');
    setNewLocAddress('');
    setNewLocPhone('');
    setIsAddingLocation(false);
    setSuccessMsg('Delivery location added!');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleDeleteLocation = (id: string) => {
    removeDeliveryLocation(id);
    setLocations(getDeliveryLocations());
  };

  const handleSignOut = async () => {
    try {
      await performSecureLogout();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    navigate('/login?portal=merchant', { replace: true });
  };

  const initialLetter = profName.trim().charAt(0).toUpperCase() || 'T';

  return (
    <div className="p-3 sm:p-5 max-w-xl mx-auto space-y-4 pb-28 text-[#111827] dark:text-slate-100 font-sans">
      {/* Top Header matching Screen 9: Profile */}
      <header className="pb-2 border-b border-[#E5E7EB] dark:border-neutral-800">
        <h1 className="text-xl font-bold tracking-tight text-[#111827] dark:text-white font-sans">
          Profile
        </h1>
      </header>

      {/* Screen 9: Identity Card (Clean, modern typography with NO font-mono) */}
      <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4 font-sans">
        {/* Circular Avatar in Crimson Red */}
        <div className="w-14 h-14 rounded-full bg-[#C22424] text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0 font-sans">
          {initialLetter}
        </div>

        <div className="min-w-0 flex-1 font-sans">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#111827] dark:text-white truncate font-sans" title={profName}>
              {profName}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider border border-emerald-200 dark:border-emerald-800 shrink-0 font-sans">
              Verified
            </span>
          </div>
          
          <div className="flex flex-col gap-0.5 mt-1 font-sans">
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-medium">
              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>+91 {profPhone}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600 dark:text-neutral-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>GSTIN: <span className="font-semibold text-neutral-900 dark:text-white tracking-wide">{profGstin}</span></span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openEditModal}
          className="p-2.5 text-[#C22424] hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer shrink-0 border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
          title="Edit Profile"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      {/* Toast Feedback */}
      {(copiedField || successMsg) && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md flex items-center gap-2 font-sans">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{copiedField ? `${copiedField} copied to clipboard!` : successMsg}</span>
        </div>
      )}

      {/* Screen 9: Grouped Menu Cards */}
      <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl divide-y divide-[#E5E7EB] dark:divide-[#262626] shadow-xs overflow-hidden font-sans">
        {/* 1. Business Information */}
        <div className="transition-colors font-sans">
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'business' ? null : 'business')}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer font-sans"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[#C22424] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 font-sans">
                <span className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white block font-sans">
                  Business Information
                </span>
                <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate font-sans">
                  GSTIN: {profGstin} • Trade registration
                </span>
              </div>
            </div>
            {expandedSection === 'business' ? (
              <ChevronDown className="w-4 h-4 text-[#6B7280] shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
            )}
          </button>

          {/* Expanded Business Information Details */}
          {expandedSection === 'business' && (
            <div className="p-4 pt-0 bg-slate-50/70 dark:bg-neutral-900/40 space-y-3 text-xs font-sans">
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-xs text-[#111827] dark:text-white font-sans">Commercial Profile</span>
                {!isProfileLocked && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="text-xs font-bold text-[#C22424] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile Details</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 font-sans">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7280] block mb-0.5 font-sans">
                    Merchant Trade Name
                  </label>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-[#E5E7EB] dark:border-neutral-700 font-bold text-xs font-sans">
                    <span>{profName}</span>
                    <button type="button" onClick={() => copyToClipboard(profName, 'Trade Name')} className="text-[#6B7280] hover:text-neutral-900 dark:hover:text-white cursor-pointer">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7280] block mb-0.5 font-sans">
                    GSTIN Number
                  </label>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-[#E5E7EB] dark:border-neutral-700 font-bold text-xs font-sans">
                    <span className="tracking-wide">{profGstin}</span>
                    <button type="button" onClick={() => copyToClipboard(profGstin, 'GSTIN')} className="text-[#6B7280] hover:text-neutral-900 dark:hover:text-white cursor-pointer">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7280] block mb-0.5 font-sans">
                    Contact Phone
                  </label>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-[#E5E7EB] dark:border-neutral-700 font-bold text-xs font-sans">
                    <span>+91 {profPhone}</span>
                    <button type="button" onClick={() => copyToClipboard(profPhone, 'Phone')} className="text-[#6B7280] hover:text-neutral-900 dark:hover:text-white cursor-pointer">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7280] block mb-0.5 font-sans">
                    Principal Yard Address
                  </label>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-[#E5E7EB] dark:border-neutral-700 text-[#4B5563] dark:text-neutral-300 text-xs font-sans leading-relaxed">
                    {profAddress}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Saved Addresses */}
        <div className="transition-colors">
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'addresses' ? null : 'addresses')}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[#C22424] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white block">
                  Saved Addresses
                </span>
                <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate">
                  {locations.length} delivery yards configured
                </span>
              </div>
            </div>
            {expandedSection === 'addresses' ? (
              <ChevronDown className="w-4 h-4 text-[#6B7280] shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
            )}
          </button>

          {/* Expanded Saved Addresses Details */}
          {expandedSection === 'addresses' && (
            <div className="p-4 pt-0 bg-slate-50/70 dark:bg-neutral-900/40 space-y-3 text-xs">
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-xs text-[#111827] dark:text-white">Delivery Locations</span>
                {!isAddingLocation && (
                  <button
                    type="button"
                    onClick={() => setIsAddingLocation(true)}
                    className="text-xs font-bold text-[#C22424] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New</span>
                  </button>
                )}
              </div>

              {isAddingLocation && (
                <form onSubmit={handleCreateDestination} className="p-3 bg-white dark:bg-neutral-800 rounded-xl space-y-2.5 border border-[#E5E7EB] dark:border-neutral-700">
                  <input
                    type="text"
                    placeholder="Location Name (e.g. APMC Shop #14)"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-[#E5E7EB] text-xs font-bold"
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewLocType('Shop')}
                      className={cn(
                        "flex-1 py-1 rounded-lg font-bold text-xs border cursor-pointer",
                        newLocType === 'Shop' ? "bg-[#C22424] text-white border-[#C22424]" : "bg-slate-50 border-[#E5E7EB]"
                      )}
                    >
                      Shop
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewLocType('Godown')}
                      className={cn(
                        "flex-1 py-1 rounded-lg font-bold text-xs border cursor-pointer",
                        newLocType === 'Godown' ? "bg-[#C22424] text-white border-[#C22424]" : "bg-slate-50 border-[#E5E7EB]"
                      )}
                    >
                      Godown
                    </button>
                  </div>
                  <textarea
                    placeholder="Full Address"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-[#E5E7EB] text-xs"
                    rows={2}
                    required
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-[#C22424] text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-[#B91C1C]"
                    >
                      Save Location
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingLocation(false)}
                      className="py-1.5 px-3 bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-[#E5E7EB] dark:border-neutral-700 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#111827] dark:text-white">{loc.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-neutral-700 text-[#6B7280] dark:text-slate-300 text-[10px] font-bold">
                          {loc.type}
                        </span>
                      </div>
                      <p className="text-[#6B7280] dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">{loc.address}</p>
                    </div>

                    {locations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-[#6B7280] hover:text-rose-600 p-1 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. My Orders Navigation */}
        <button
          type="button"
          onClick={() => navigate('/my-orders')}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[#C22424] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white block">
                My Orders
              </span>
              <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate">
                View order history & live logistics tracking
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
        </button>

        {/* 4. Brokerage & Financial Ledger */}
        <button
          type="button"
          onClick={() => navigate('/brokerage')}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[#C22424] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white block">
                Brokerage & Ledger
              </span>
              <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate">
                Direct mill accounts & outstanding statements
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
        </button>

        {/* 5. Direct APMC Broker Desk Support */}
        <a
          href="tel:+919916416995"
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer no-underline"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[#C22424] flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white block">
                Help & APMC Support
              </span>
              <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate">
                Direct APMC broker desk: +91 99164 16995
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
        </a>

        {/* 6. Logout */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#C22424] flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4 text-[#C22424]" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-[#C22424] block">
                Logout
              </span>
              <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block truncate">
                Sign out of merchant session
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#C22424] shrink-0" />
        </button>
      </div>

      {/* DEDICATED EDIT PROFILE MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl font-sans"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#C22424] flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white font-sans leading-none">
                      Edit Profile
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-sans">
                      Update trade registration & contact details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveModalProfile} className="p-4 space-y-3.5 font-sans">
                {/* Trade Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block font-sans">
                    Merchant Trade Name
                  </label>
                  <div className="relative flex items-center">
                    <Building2 className="absolute left-3 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="e.g. Sri Lakshmi Agro Traders"
                      className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C22424]/30 focus:border-[#C22424] transition-all font-sans"
                    />
                  </div>
                </div>

                {/* GSTIN */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block font-sans">
                    GSTIN Number
                  </label>
                  <div className="relative flex items-center">
                    <ShieldCheck className="absolute left-3 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={tempGstin}
                      onChange={(e) => setTempGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 29AAGCV7712M1ZP"
                      className="w-full pl-9 pr-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C22424]/30 focus:border-[#C22424] transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block font-sans">
                    Contact Phone Number
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-neutral-400 font-sans">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9845012345"
                      className="w-full pl-11 pr-3 py-2 text-xs font-semibold rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C22424]/30 focus:border-[#C22424] transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Yard Address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block font-sans">
                    Principal Yard Address
                  </label>
                  <div className="relative flex items-start">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                    <textarea
                      rows={2}
                      required
                      value={tempAddress}
                      onChange={(e) => setTempAddress(e.target.value)}
                      placeholder="e.g. No. 15, APMC Yard, Yeshwanthpur, Bangalore - 560022"
                      className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C22424]/30 focus:border-[#C22424] transition-all font-sans resize-none"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#C22424] hover:bg-[#A81F1F] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 font-sans"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl transition-all cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
