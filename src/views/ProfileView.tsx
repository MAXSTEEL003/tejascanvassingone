import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, MapPin, ShieldCheck, Phone, Check, Copy,
  CheckCircle2, Plus, Trash2, LogOut, Lock, Edit3, Save, 
  Warehouse, Store, ExternalLink, Activity
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
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
    const val = localStorage.getItem('userName');
    if (val && (val.includes('V.K') || val.includes('VK FOODS'))) return 'Authorized Merchant';
    return val || 'Authorized Merchant';
  });
  const [profPhone, setProfPhone] = useState(() => localStorage.getItem('userPhone') || '9342380981');
  const [profGstin, setProfGstin] = useState(() => localStorage.getItem('userGstin') || '29AAGCV7712M1ZP');
  const [profAddress, setProfAddress] = useState(() => localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
  const [isProfileLocked, setIsProfileLocked] = useState(() => localStorage.getItem('profileLocked') === 'true');
  const [activeTab, setActiveTab] = useState<'credentials' | 'locations' | 'preferences'>('credentials');
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setTimeout(() => setCopiedField(null), 2200);
  };

  const handleSaveProfile = () => {
    localStorage.setItem('userName', profName.trim());
    localStorage.setItem('userPhone', profPhone.trim());
    localStorage.setItem('userGstin', profGstin.trim());
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
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userGstin');
    localStorage.removeItem('userAddress');
    sessionStorage.clear();
    window.dispatchEvent(new Event('role-changed'));
    window.dispatchEvent(new Event('storage'));
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-3 sm:p-4 max-w-2xl mx-auto space-y-4 pb-28 text-slate-900 dark:text-slate-100 font-sans">
      {/* Executive Merchant Identity Banner */}
      <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/60 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-[#0e3c2b] to-[#1a6649] text-white flex items-center justify-center font-black text-lg shadow-md ring-2 ring-emerald-500/20 shrink-0">
              {profName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'VK'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate max-w-full" title={profName}>
                  {profName}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Merchant
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
                GSTIN: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{profGstin}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            id="profile-signout-btn"
            onClick={handleSignOut}
            className="shrink-0 py-2 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-rose-200/80 dark:border-rose-900/60 active:scale-95 shadow-xs whitespace-nowrap"
            title="Sign Out of Merchant Account"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap font-bold">Sign Out</span>
          </button>
        </div>

        {/* Quick Highlights Ribbon */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-slate-100 dark:border-emerald-950/50">
          <div className="bg-slate-50 dark:bg-[#071510] rounded-xl p-3 text-left border border-slate-100 dark:border-emerald-950/40">
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
              Registered Sites
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
              {locations.length} Delivery Locations
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-[#071510] rounded-xl p-3 text-left border border-slate-100 dark:border-emerald-950/40">
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
              Account Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 block whitespace-nowrap">
                Active & Working
              </span>
            </div>
          </div>
        </div>

        {/* Toast feedback pill */}
        {(copiedField || successMsg) && (
          <div className="mt-3 bg-[#0e3c2b] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 border border-emerald-400/40 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{copiedField ? `${copiedField} copied to clipboard!` : successMsg}</span>
          </div>
        )}
      </div>

      {/* Segmented Tab Header */}
      <div className="flex bg-slate-100 dark:bg-neutral-900 p-1 rounded-2xl border border-slate-200/80 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={cn(
            "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
            activeTab === 'credentials'
              ? "bg-white dark:bg-[#0a1b14] text-emerald-800 dark:text-emerald-300 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Business KYC</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('locations')}
          className={cn(
            "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
            activeTab === 'locations'
              ? "bg-white dark:bg-[#0a1b14] text-emerald-800 dark:text-emerald-300 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Delivery Sites ({locations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={cn(
            "flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
            activeTab === 'preferences'
              ? "bg-white dark:bg-[#0a1b14] text-emerald-800 dark:text-emerald-300 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Trade Security</span>
        </button>
      </div>

      {/* Tab 1: Business Credentials */}
      {activeTab === 'credentials' && (
        <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/60 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-emerald-950/50">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Commercial Profile</h2>
              <p className="text-[11px] text-slate-400">Used for automated Mill Purchase Orders & Invoicing</p>
            </div>
            {!isProfileLocked && (
              <button
                type="button"
                onClick={() => {
                  if (isEditMode) {
                    handleSaveProfile();
                  } else {
                    setIsEditMode(true);
                  }
                }}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isEditMode ? (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Merchant Legal Name */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                Registered Merchant Trade Name
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-bold"
                />
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#071510] border border-slate-100 dark:border-emerald-950/40 text-xs font-bold text-slate-900 dark:text-white">
                  <span>{profName}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profName, 'Trade Name')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* GSTIN Number */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                GSTIN Number (Tax Identifier)
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={profGstin}
                  onChange={(e) => setProfGstin(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#071510] border border-slate-100 dark:border-emerald-950/40 text-xs font-mono font-bold text-slate-900 dark:text-white">
                  <span>{profGstin}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profGstin, 'GSTIN')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Registered Phone */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                Billing & WhatsApp Dispatch Number
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-bold"
                />
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#071510] border border-slate-100 dark:border-emerald-950/40 text-xs font-bold text-slate-900 dark:text-white">
                  <span>+91 {profPhone}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profPhone, 'Phone')}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Registered Address */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                APMC Principal Place of Business
              </label>
              {isEditMode ? (
                <textarea
                  rows={2}
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-medium"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#071510] border border-slate-100 dark:border-emerald-950/40 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {profAddress}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Delivery Sites & Godowns */}
      {activeTab === 'locations' && (
        <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/60 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-emerald-950/50">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Registered Delivery Points</h2>
              <p className="text-[11px] text-slate-400">Truck unloading locations for mill dispatch</p>
            </div>
            {!isAddingLocation && (
              <button
                type="button"
                onClick={() => setIsAddingLocation(true)}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Site</span>
              </button>
            )}
          </div>

          {isAddingLocation && (
            <form onSubmit={handleCreateDestination} className="p-4 bg-slate-50 dark:bg-neutral-900 rounded-2xl space-y-3 border border-slate-200 dark:border-neutral-800 text-xs">
              <h3 className="font-black text-slate-900 dark:text-white text-xs">Register New Unloading Site</h3>
              <input
                type="text"
                placeholder="Site Title (e.g., Godown 2 - Outer Ring Road)"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white"
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewLocType('Shop')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg font-bold text-xs cursor-pointer border",
                    newLocType === 'Shop' ? "bg-emerald-800 text-white border-emerald-800" : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300"
                  )}
                >
                  Retail / Wholesale Shop
                </button>
                <button
                  type="button"
                  onClick={() => setNewLocType('Godown')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg font-bold text-xs cursor-pointer border",
                    newLocType === 'Godown' ? "bg-emerald-800 text-white border-emerald-800" : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300"
                  )}
                >
                  Storage Godown
                </button>
              </div>
              <textarea
                placeholder="Detailed Unloading Address"
                value={newLocAddress}
                onChange={(e) => setNewLocAddress(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white"
                rows={2}
                required
              />
              <input
                type="text"
                placeholder="Contact Person Phone at Site"
                value={newLocPhone}
                onChange={(e) => setNewLocPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#143e2e] text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-[#0f3225] transition-colors"
                >
                  Save Unloading Site
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingLocation(false)}
                  className="py-2 px-4 bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2.5">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="bg-slate-50 dark:bg-[#071510] border border-slate-200/60 dark:border-emerald-950/40 rounded-2xl p-3.5 text-xs flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-xs">{loc.name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      {loc.type}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{loc.address}</p>
                  {loc.phone && (
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3" />
                      <span>{loc.phone}</span>
                    </p>
                  )}
                </div>

                {locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer shrink-0"
                    title="Delete Site"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Trade Security & Settings */}
      {activeTab === 'preferences' && (
        <div className="bg-white dark:bg-[#0a1b14] border border-slate-200/80 dark:border-emerald-950/60 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Security & Audit Controls</h2>
            <p className="text-[11px] text-slate-400">Manage account locking and dispatch protections</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#071510] border border-slate-100 dark:border-emerald-950/40 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Profile Modification Lock</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Prevent accidental edits to GSTIN and billing legal identity</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextState = !isProfileLocked;
                  setIsProfileLocked(nextState);
                  localStorage.setItem('profileLocked', String(nextState));
                }}
                className={cn(
                  "py-1.5 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer border",
                  isProfileLocked 
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800" 
                    : "bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-neutral-700"
                )}
              >
                {isProfileLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
