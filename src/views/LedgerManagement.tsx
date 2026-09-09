import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  Briefcase,
  FileText,
  RefreshCw,
  Copy,
  Check,
  X,
  ChevronDown,
  Truck,
  Trash2,
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection, deleteCollectionDoc } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface LedgerEntry {
  id: string;
  purchaseOrderNo: string;
  date: string;
  partyName: string;
  partyType: 'Supplier' | 'Buyer'; // 'Supplier' = Miller, 'Buyer' = Shop
  qty: number;
  rate?: number;
  amount: number;
  status: 'Placed' | 'Arrived';
  originalPartyName?: string;
  isLifted?: boolean;
  billNo?: string;
  notes?: string;
}

const parseLedgerDate = (obj: any): number => {
  if (!obj) return 0;
  if (typeof obj.purchaseOrderSentAt === 'number') return obj.purchaseOrderSentAt;
  if (typeof obj.createdAt === 'number') return obj.createdAt;
  
  const raw = obj.purchaseOrderSentAt || obj.createdAt || obj.date;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;

  const str = String(raw).trim();
  if (!str) return 0;

  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch.map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  // Check DD-Mon-YYYY (e.g. 10-Jun-2026 or 10-JUN-2026)
  const monMatch = str.match(/^(\d{1,2})[/-]([A-Za-z]+)[/-](\d{4})$/);
  if (monMatch) {
    const d = Number(monMatch[1]);
    const y = Number(monMatch[3]);
    const mStr = monMatch[2].toLowerCase();
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = months.findIndex(m => mStr.startsWith(m));
    if (mIdx !== -1) {
      const date = new Date(y, mIdx, d);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
  }

  const date = new Date(str);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatDateToDDMMYYYY = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch.map(Number);
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${String(d).padStart(2, '0')}-${monthNames[m - 1]}-${y}`;
  }

  const date = parseLedgerDate({ date: val });
  if (date > 0) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${m}-${yyyy}`;
  }
  return str;
};

const seedLedgers: LedgerEntry[] = [];

export default function LedgerManagement() {
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'suppliers' | 'buyers'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Placed' | 'Arrived'>('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [modalSupplierFilter, setModalSupplierFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<{ name: string; type: 'Supplier' | 'Buyer' } | null>(null);

  // Whole ledger deletion state
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState<string | null>(null);

  // Helper to check if a specific ID was previously marked deleted
  const getDeletedLedgerIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem('deleted_ledger_ids');
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
      }
    } catch (e) {}
    return new Set();
  };

  const isDeletedEntry = (id: string, po?: string, partyName?: string, partyType?: string) => {
    if (!id) return false;
    const deletedSet = getDeletedLedgerIds();
    const normId = String(id).trim().toLowerCase().replace(/^#/, '');
    if (deletedSet.has(normId)) return true;
    if (po && partyName && partyType) {
      const composite = `${String(po).trim().toLowerCase()}_${String(partyName).trim().toLowerCase()}_${String(partyType).toLowerCase()}`;
      if (deletedSet.has(composite)) return true;
    }
    return false;
  };

  // Reset modal supplier filter when selected party changes
  useEffect(() => {
    setModalSupplierFilter('all');
  }, [selectedParty]);

  // Reset main supplier filter when active tab changes
  useEffect(() => {
    setSelectedSupplierFilter('all');
  }, [activeTab]);

  // Dynamic selection list of all suppliers in the ledger for filtering
  const uniqueSuppliers = React.useMemo(() => {
    const set = new Set<string>();
    ledgers.forEach(l => {
      if (l.partyType === 'Supplier') {
        set.add(l.partyName);
      }
    });
    return Array.from(set).sort();
  }, [ledgers]);

  const drillDownData = React.useMemo(() => {
    if (!selectedParty) return null;
    const name = selectedParty.name;
    const type = selectedParty.type;

    // 1. Get all ledger entries where this party is involved
    const partyEntries = ledgers.filter(l => l.partyName === name && l.partyType === type);

    // 2. Discover counterpart information for each PO
    const counterparts = new Map<string, { arrivedQty: number; pendingQty: number; entries: any[] }>();

    partyEntries.forEach(entry => {
      // Find the opposite entry in the ledger with the same PO
      const opposite = ledgers.find(l => l.purchaseOrderNo === entry.purchaseOrderNo && l.partyType !== type);
      const counterpartName = opposite ? opposite.partyName : (type === 'Supplier' ? 'Unknown Buyer' : 'Unknown Supplier');

      const existing = counterparts.get(counterpartName) || { arrivedQty: 0, pendingQty: 0, entries: [] };
      
      const qty = Number(entry.qty) || 0;
      if (entry.status === 'Arrived') {
        existing.arrivedQty += qty;
      } else {
        existing.pendingQty += qty;
      }

      existing.entries.push({
        id: entry.id,
        date: entry.date,
        po: entry.purchaseOrderNo,
        qty: entry.qty,
        rate: entry.rate || (entry.qty > 0 ? Math.round(entry.amount / entry.qty) : 0),
        amount: entry.amount,
        status: entry.status,
      });

      counterparts.set(counterpartName, existing);
    });

    const counterpartList = Array.from(counterparts.entries()).map(([cpName, info]) => ({
      name: cpName,
      arrivedQty: info.arrivedQty,
      pendingQty: info.pendingQty,
      entries: info.entries.sort((a, b) => parseLedgerDate(b) - parseLedgerDate(a))
    }));

    // Overall stats for this party
    const totalArrived = partyEntries.filter(e => e.status === 'Arrived').reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
    const totalPending = partyEntries.filter(e => e.status === 'Placed').reduce((sum, e) => sum + (Number(e.qty) || 0), 0);

    return {
      name,
      type,
      totalArrived,
      totalPending,
      counterparts: counterpartList,
      history: partyEntries.sort((a, b) => parseLedgerDate(b) - parseLedgerDate(a))
    };
  }, [selectedParty, ledgers]);

  const fetchLedgers = async () => {
    setIsLoading(true);
    try {
      const isClearedAll = localStorage.getItem('ledger_cleared_all') === 'true';

      // Fetch from Firestore
      const dbLedgers = await getCollectionDocs('ledgers');
      
      // Ensure we match localstorage fallback as well
      const localLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');
      
      const mergedMap = new Map<string, LedgerEntry>();
      
      // Load seed data first ONLY IF whole ledger was NOT cleared
      if (!isClearedAll) {
        seedLedgers.forEach(l => {
          if (!isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) {
            mergedMap.set(l.id, l);
          }
        });
      }
      
      // Overwrite with localstorage
      localLedgers.forEach((l: any) => {
        if (l && l.id && !isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) {
          mergedMap.set(l.id, l);
        }
      });
      
      // Overwrite with db ledgers
      dbLedgers.forEach((l: any) => {
        if (l && l.id && !isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) {
          mergedMap.set(l.id, l);
        }
      });

      // Load placed_orders map to check for lifted/redirected loads
      const savedOrders = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const poMap = new Map<string, any>();
      savedOrders.forEach((o: any) => {
        if (o && o.id) poMap.set(String(o.id).trim().toUpperCase().replace(/^#/, ''), o);
      });

      // Deduplicate entries by composite key (PO + partyName + partyType + qty + amount + status)
      const dedupMap = new Map<string, LedgerEntry>();
      mergedMap.forEach(l => {
        if (!l || !l.partyName) return;
        if (isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) return;
        
        const po = (l.purchaseOrderNo || '').trim().toUpperCase().replace(/^#/, '');
        const matchingOrder = poMap.get(po);

        if (l.partyType === 'Buyer' && matchingOrder) {
          const isLifted = !!(matchingOrder.liftingRecords?.length > 0 || matchingOrder.currentShop || matchingOrder.redirectedShop);
          const redirectedShop = matchingOrder.currentShop || matchingOrder.redirectedShop || matchingOrder.liftingRecords?.[0]?.shopName;
          
          if (isLifted && redirectedShop) {
            l.originalPartyName = l.originalPartyName || l.partyName;
            l.partyName = redirectedShop;
            l.isLifted = true;
            if (matchingOrder.actualSupplierBillNo) l.billNo = matchingOrder.actualSupplierBillNo;
            l.notes = `LIFTED TO ${redirectedShop} (EX: ${l.originalPartyName})`;
          }
        }

        const name = (l.partyName || '').trim().toLowerCase();
        const type = l.partyType;
        const qty = (Number(l.qty) || 0).toFixed(2);
        const amt = (Number(l.amount) || 0).toFixed(2);
        const status = l.status || '';

        const dupKey = `${po}_${name}_${type}_${qty}_${amt}_${status}`;
        if (!dedupMap.has(dupKey)) {
          dedupMap.set(dupKey, l);
        }
      });

      const sorted = Array.from(dedupMap.values()).sort((a, b) => {
        const timeA = parseLedgerDate(a);
        const timeB = parseLedgerDate(b);
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      setLedgers(sorted);
      
      // Sync back to localstorage for fallback consistency
      localStorage.setItem('ledgers', JSON.stringify(sorted));
    } catch (err) {
      console.error("Failed to load ledgers:", err);
      const isClearedAll = localStorage.getItem('ledger_cleared_all') === 'true';
      if (isClearedAll) {
        setLedgers([]);
        localStorage.setItem('ledgers', '[]');
      } else {
        const localLedgers = JSON.parse(localStorage.getItem('ledgers') || '[]');
        if (localLedgers.length === 0) {
          const dedupSeed = new Map<string, LedgerEntry>();
          seedLedgers.forEach(l => {
            if (isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) return;
            const dupKey = `${(l.purchaseOrderNo||'').trim().toUpperCase()}_${(l.partyName||'').trim().toLowerCase()}_${l.partyType}_${(Number(l.qty)||0).toFixed(2)}_${(Number(l.amount)||0).toFixed(2)}_${l.status||''}`;
            if (!dedupSeed.has(dupKey)) dedupSeed.set(dupKey, l);
          });
          const sortedSeeds = Array.from(dedupSeed.values()).sort((a, b) => {
            const timeA = parseLedgerDate(a);
            const timeB = parseLedgerDate(b);
            if (timeA !== timeB) return timeB - timeA;
            return String(b.id || '').localeCompare(String(a.id || ''));
          });
          setLedgers(sortedSeeds);
          localStorage.setItem('ledgers', JSON.stringify(sortedSeeds));
        } else {
          const dedupLocal = new Map<string, LedgerEntry>();
          localLedgers.forEach((l: any) => {
            if (!l || !l.partyName) return;
            if (isDeletedEntry(l.id, l.purchaseOrderNo, l.partyName, l.partyType)) return;
            const dupKey = `${(l.purchaseOrderNo||'').trim().toUpperCase()}_${(l.partyName||'').trim().toLowerCase()}_${l.partyType}_${(Number(l.qty)||0).toFixed(2)}_${(Number(l.amount)||0).toFixed(2)}_${l.status||''}`;
            if (!dedupLocal.has(dupKey)) dedupLocal.set(dupKey, l);
          });
          const sortedLocal = Array.from(dedupLocal.values()).sort((a: any, b: any) => {
            const timeA = parseLedgerDate(a);
            const timeB = parseLedgerDate(b);
            if (timeA !== timeB) return timeB - timeA;
            return String(b.id || '').localeCompare(String(a.id || ''));
          });
          setLedgers(sortedLocal);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWholeLedger = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (deletePassword.trim() !== 'tejas') {
      setPasswordError("Incorrect authorization password. Please enter 'tejas' to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    setPasswordError(null);

    try {
      // Collect all IDs to wipe from Firestore
      const idsToDelete = new Set<string>();
      ledgers.forEach(l => {
        if (l.id) idsToDelete.add(l.id);
      });
      seedLedgers.forEach(s => {
        if (s.id) idsToDelete.add(s.id);
      });

      // 1. Mark entire ledger as permanently cleared
      localStorage.setItem('ledger_cleared_all', 'true');
      localStorage.setItem('ledgers', '[]');

      // 2. Also register all existing IDs in deleted_ledger_ids for persistent blocking
      const rawDel = localStorage.getItem('deleted_ledger_ids') || '[]';
      let delArr: string[] = [];
      try { delArr = JSON.parse(rawDel); } catch (e) { delArr = []; }
      Array.from(idsToDelete).forEach(id => {
        const raw = String(id).replace(/^#/, '');
        [id, raw, `#${raw}`, id.toLowerCase(), raw.toLowerCase()].forEach(v => {
          if (v && !delArr.includes(v)) delArr.push(v);
        });
      });
      localStorage.setItem('deleted_ledger_ids', JSON.stringify(delArr));

      // 3. Reset component state
      setLedgers([]);
      setSelectedParty(null);
      setIsDeleteAllModalOpen(false);
      setDeletePassword('');
      setShowPassword(false);

      // 4. Show success confirmation toast
      setDeleteSuccessToast("Whole commercial ledger data has been permanently deleted.");
      setTimeout(() => setDeleteSuccessToast(null), 5000);

      // 5. Broadcast storage events
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('ledger-updated', { detail: { clearedAll: true } }));

      // 6. Delete all ledger documents from Firestore asynchronously
      const deletePromises: Promise<any>[] = [];
      Array.from(idsToDelete).forEach(id => {
        const raw = String(id).replace(/^#/, '');
        deletePromises.push(deleteCollectionDoc('ledgers', id));
        deletePromises.push(deleteCollectionDoc('ledgers', raw));
        deletePromises.push(deleteCollectionDoc('ledgers', `#${raw}`));
      });
      await Promise.allSettled(deletePromises);
    } catch (err) {
      console.error("Failed to delete whole ledger:", err);
      setPasswordError("An unexpected error occurred while clearing ledger data. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
    window.addEventListener('storage', fetchLedgers);
    return () => window.removeEventListener('storage', fetchLedgers);
  }, []);

  const handleCopy = (po: string) => {
    navigator.clipboard.writeText(po);
    setCopiedId(po);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Pre-build supplier PO map for O(1) lookup
  const poSupplierMap = useMemo(() => {
    const map = new Map<string, string>();
    ledgers.forEach(l => {
      if (l.partyType === 'Supplier' && l.purchaseOrderNo) {
        map.set(l.purchaseOrderNo, l.partyName);
      }
    });
    return map;
  }, [ledgers]);

  // Memoized Filtered Ledgers
  const filteredLedgers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return ledgers.filter(entry => {
      // Tab Filter
      if (activeTab === 'suppliers' && entry.partyType !== 'Supplier') return false;
      if (activeTab === 'buyers' && entry.partyType !== 'Buyer') return false;

      // Status Filter
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;

      // Supplier Filter
      if (selectedSupplierFilter !== 'all') {
        if (entry.partyType === 'Supplier') {
          if (entry.partyName !== selectedSupplierFilter) return false;
        } else {
          const entrySupplier = poSupplierMap.get(entry.purchaseOrderNo);
          if (entrySupplier !== selectedSupplierFilter) return false;
        }
      }

      // Search query
      if (q !== '') {
        const matchPo = entry.purchaseOrderNo.toLowerCase().includes(q);
        const matchName = entry.partyName.toLowerCase().includes(q);
        const matchType = entry.partyType.toLowerCase().includes(q);
        return matchPo || matchName || matchType;
      }

      return true;
    }).sort((a, b) => {
      const timeA = parseLedgerDate(a);
      const timeB = parseLedgerDate(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [ledgers, activeTab, statusFilter, selectedSupplierFilter, searchQuery, poSupplierMap]);

  // Memoized Stats & Chart Data
  const { totalSupplierVolume, totalSupplierAmount, totalBuyerVolume, totalBuyerAmount, chartData } = useMemo(() => {
    let supVol = 0;
    let supAmt = 0;
    let buyVol = 0;
    let buyAmt = 0;

    ledgers.forEach(e => {
      if (e.partyType === 'Supplier') {
        supVol += Number(e.qty) || 0;
        supAmt += Number(e.amount) || 0;
      } else {
        buyVol += Number(e.qty) || 0;
        buyAmt += Number(e.amount) || 0;
      }
    });

    const chartMap = new Map<string, { name: string; SupplierVal: number; BuyerVal: number }>();
    ledgers.slice(0, 8).forEach(e => {
      const existing = chartMap.get(e.purchaseOrderNo) || { name: e.purchaseOrderNo.replace('BATCH-', ''), SupplierVal: 0, BuyerVal: 0 };
      if (e.partyType === 'Supplier') {
        existing.SupplierVal += e.amount;
      } else {
        existing.BuyerVal += e.amount;
      }
      chartMap.set(e.purchaseOrderNo, existing);
    });

    return {
      totalSupplierVolume: supVol,
      totalSupplierAmount: supAmt,
      totalBuyerVolume: buyVol,
      totalBuyerAmount: buyAmt,
      chartData: Array.from(chartMap.values())
    };
  }, [ledgers]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Commercial Ledger
          </h1>
          <p className="text-secondary text-sm font-medium mt-1">
            Real-time balance book recording all incoming commodity volume and financial settlements across suppliers (Millers) and shops (Buyers).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              setIsDeleteAllModalOpen(true);
              setDeletePassword('');
              setPasswordError(null);
              setShowPassword(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-black transition-all border border-red-500/25 shadow-sm hover:border-red-500/40 cursor-pointer"
            title="Delete Whole Commercial Ledger"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Delete Whole Ledger</span>
          </button>
          <NavLink
            to="/pending-loadings"
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black transition-all border border-amber-500/30 shadow-sm"
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Loadings
          </NavLink>
          <button 
            onClick={fetchLedgers}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold transition-all border border-outline-variant/30"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            Sync Book
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Miller overall QTLS */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Miller Volume (Suppliers)</span>
              <span className="text-2xl font-black tracking-tight mt-1 block">{(totalSupplierVolume ?? 0).toFixed(2)} QTLS</span>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 mt-4 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3 h-3" /> Aggregated inbound grain weight
          </span>
        </motion.div>

        {/* Miller overall Amount */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Miller Accounts Liability</span>
              <span className="text-2xl font-black tracking-tight mt-1 text-primary block">₹ {formatINR(totalSupplierAmount)}</span>
            </div>
            <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-secondary mt-4 block font-semibold">
            Based on current purchase order contracts
          </span>
        </motion.div>

        {/* Shop overall QTLS */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Shop Volume (Buyers)</span>
              <span className="text-2xl font-black tracking-tight mt-1 block">{(totalBuyerVolume ?? 0).toFixed(2)} QTLS</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 mt-4 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3 h-3" /> Aggregated outbound fulfillment weight
          </span>
        </motion.div>

        {/* Shop overall Amount */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
          transition={{ duration: 0.48, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border flex flex-col justify-between interactive-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">Shop Accounts Receivable</span>
              <span className="text-2xl font-black tracking-tight mt-1 text-emerald-600 block">₹ {formatINR(totalBuyerAmount)}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-secondary mt-4 block font-semibold">
            Pending merchant collection audits
          </span>
        </motion.div>
      </div>

      {/* Recharts Trade Flow */}
      {chartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 22, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass p-6 rounded-3xl premium-border-high"
        >
          <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Contract Values by Purchase Order
          </h2>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 300, height: 200 }}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`} />
                <Tooltip 
                  formatter={(val: number) => [`₹ ${formatINR(val)}`, '']}
                  contentStyle={{ background: '#1e1e1e', borderColor: '#333', borderRadius: '12px', color: '#fff' }}
                />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar name="Miller Contract Value" dataKey="SupplierVal" fill="#e11d48" radius={[6, 6, 0, 0]} />
                <Bar name="Shop Billing Value" dataKey="BuyerVal" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Main ledger Table view */}
      <div className="space-y-6">
        {/* Search, Filter, Tabs controllers */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Tabs */}
          <div className="flex bg-surface-container rounded-2xl p-1 gap-1 border border-outline-variant/20 self-start md:self-auto w-full md:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all w-full md:w-auto",
                activeTab === 'all' ? 'bg-on-background text-background' : 'hover:bg-on-background/5 text-secondary'
              )}
            >
              All Ledgers
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all w-full md:w-auto",
                activeTab === 'suppliers' ? 'bg-on-background text-background' : 'hover:bg-on-background/5 text-secondary'
              )}
            >
              Miller (Suppliers)
            </button>
            <button
              onClick={() => setActiveTab('buyers')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all w-full md:w-auto",
                activeTab === 'buyers' ? 'bg-on-background text-background' : 'hover:bg-on-background/5 text-secondary'
              )}
            >
              Shop (Buyers)
            </button>
          </div>

          {/* Search bar and Dropdown */}
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-center">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
              <input 
                type="text"
                placeholder="Search PO No, or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/25 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary transition-all"
              />
            </div>

             <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-44">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-surface-container border border-outline-variant/25 rounded-2xl pl-11 pr-10 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Placed">Fulfillment: Placed</option>
                  <option value="Arrived">Fulfillment: Arrived</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none" />
              </div>

              {(activeTab === 'buyers' || activeTab === 'all') && (
                <div className="relative w-full md:w-56">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
                  <select
                    value={selectedSupplierFilter}
                    onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/25 rounded-2xl pl-11 pr-10 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer font-bold"
                  >
                    <option value="all">All Suppliers</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table itself */}
        <motion.div 
          initial={{ opacity: 0, y: 22, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass rounded-3xl premium-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container/30 text-[10px] font-black uppercase tracking-widest text-secondary text-left">
                  <th className="py-4.5 px-6">Date</th>
                  <th className="py-4.5 px-6">Purchase Order No</th>
                  <th className="py-4.5 px-6">Party Name</th>
                  <th className="py-4.5 px-6">Type</th>
                  <th className="py-4.5 px-6 text-right">Volume</th>
                  <th className="py-4.5 px-6 text-right">Rate / Qtl</th>
                  <th className="py-4.5 px-6 text-right">Amount</th>
                  <th className="py-4.5 px-6 text-center">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                <AnimatePresence mode="popLayout">
                  {filteredLedgers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-xs text-secondary font-medium">
                        {ledgers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-secondary border border-outline-variant/20">
                              <BookOpen className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-sm text-on-surface">Commercial Ledger is Empty</p>
                            <p className="text-xs text-secondary max-w-sm">
                              All commercial ledger records have been wiped. New entries will log automatically when procurement batches arrive or are placed.
                            </p>
                          </div>
                        ) : (
                          "No ledger entries found matching active filters."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLedgers.map((entry) => (
                      <motion.tr 
                        key={entry.id}
                        layoutId={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="interactive-tr cursor-pointer"
                      >
                        <td className="py-4 px-6 text-xs text-on-surface font-semibold">
                          {formatDateToDDMMYYYY(entry.date)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 group">
                            <span className="font-mono text-xs font-bold text-secondary bg-surface-container px-2 py-1 rounded">
                              {entry.purchaseOrderNo}
                            </span>
                            <button
                              onClick={() => handleCopy(entry.purchaseOrderNo)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded transition-all text-secondary"
                              title="Copy PO Number"
                            >
                              {copiedId === entry.purchaseOrderNo ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td 
                          className="py-4 px-6 text-xs text-on-surface hover:text-primary cursor-pointer transition-all"
                          title="Click to view full transaction balance and history"
                          onClick={() => setSelectedParty({ name: entry.partyName, type: entry.partyType })}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 group/link flex-wrap">
                              <span className="font-black">{entry.partyName}</span>
                              {(entry.isLifted || entry.notes?.includes('LIFTED')) && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black tracking-widest text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase">
                                  <Truck className="w-3 h-3 text-purple-600 shrink-0" />
                                  LIFTED TO {entry.partyName} {entry.originalPartyName ? `(EX: ${entry.originalPartyName})` : ''}
                                </span>
                              )}
                              <span className="text-[9px] font-black tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded opacity-0 group-hover/link:opacity-100 transition-all uppercase">
                                Ledger ➔
                              </span>
                            </div>
                            {(() => {
                              if (entry.partyType === 'Buyer') {
                                const supplierName = ledgers.find(l => l.purchaseOrderNo === entry.purchaseOrderNo && l.partyType === 'Supplier')?.partyName;
                                if (supplierName) {
                                  return (
                                    <span className="text-[10px] text-secondary font-medium flex items-center gap-1">
                                      <span className="text-[9px] font-black uppercase text-secondary/60 tracking-wider">From:</span>
                                      <span className="font-semibold text-on-surface/80 bg-surface-container px-1.5 py-0.5 rounded">{supplierName}</span>
                                    </span>
                                  );
                                }
                              } else {
                                const buyerName = ledgers.find(l => l.purchaseOrderNo === entry.purchaseOrderNo && l.partyType === 'Buyer')?.partyName;
                                if (buyerName) {
                                  return (
                                    <span className="text-[10px] text-secondary font-medium flex items-center gap-1">
                                      <span className="text-[9px] font-black uppercase text-secondary/60 tracking-wider">To:</span>
                                      <span className="font-semibold text-on-surface/80 bg-surface-container px-1.5 py-0.5 rounded">{buyerName}</span>
                                    </span>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {entry.partyType === 'Supplier' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5 rounded-full uppercase border border-red-200/50">
                              <ArrowDownLeft className="w-3 h-3" /> Supplier (Miller)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase border border-emerald-200/50">
                              <ArrowUpRight className="w-3 h-3" /> Buyer (Shop)
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-right font-semibold text-secondary">
                          {(Number(entry.qty) || 0).toFixed(2)} QTLS
                        </td>
                        <td className="py-4 px-6 text-xs text-right font-mono font-bold text-primary">
                          ₹ {formatINR(entry.rate || (entry.qty > 0 ? Math.round(entry.amount / entry.qty) : 0))}
                        </td>
                        <td className="py-4 px-6 text-xs font-black text-right text-on-surface">
                          ₹ {formatINR(entry.amount)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {entry.status === 'Arrived' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-2.5 py-1 rounded-full uppercase">
                              <CheckCircle className="w-3 h-3" /> Received
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2.5 py-1 rounded-full uppercase animate-pulse">
                              <Clock className="w-3 h-3" /> In Transit
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Interactive Party Drill-down Detail Modal */}
      <AnimatePresence>
        {selectedParty && drillDownData && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-outline-variant/50 w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-outline-variant/30 bg-surface-container/50 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      drillDownData.type === 'Supplier' 
                        ? "text-red-600 bg-red-50 border-red-200/50 dark:bg-red-950/20 dark:text-red-400" 
                        : "text-emerald-600 bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400"
                    )}>
                      {drillDownData.type === 'Supplier' ? 'Supplier / Miller' : 'Buyer / Shop'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-on-surface tracking-tight">
                    {drillDownData.name}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedParty(null)}
                  className="p-2 hover:bg-on-background/5 rounded-full transition-all text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
                {/* Visual Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="interactive-card p-5 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10 flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Arrived / Received Quantity</span>
                    <span className="text-3xl font-black text-on-surface mt-2">{(Number(drillDownData.totalArrived) || 0).toFixed(2)} QTLS</span>
                    <span className="text-[10px] text-secondary mt-1 font-semibold">Volume safely delivered and audited</span>
                  </div>
                  <div className="interactive-card p-5 rounded-2xl bg-amber-500/[0.03] border border-amber-500/10 flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending / In-Transit Quantity</span>
                    <span className="text-3xl font-black text-on-surface mt-2">{(Number(drillDownData.totalPending) || 0).toFixed(2)} QTLS</span>
                    <span className="text-[10px] text-secondary mt-1 font-semibold">Volume placed but currently on route</span>
                  </div>
                </div>

                {/* Counterparts matching: relationship view */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/60 p-4 rounded-2xl border border-outline-variant/20">
                    <h3 className="text-xs font-black uppercase tracking-widest text-secondary flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-primary" />
                      Interactive Counterparty Partnerships & Statuses
                    </h3>

                    {drillDownData.type === 'Buyer' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Filter Supplier:</span>
                        <div className="relative">
                          <select
                            value={modalSupplierFilter}
                            onChange={(e) => setModalSupplierFilter(e.target.value)}
                            className="bg-surface-container border border-outline-variant/30 rounded-xl pl-3 pr-8 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer font-bold"
                          >
                            <option value="all">All Suppliers</option>
                            {drillDownData.counterparts.map(cp => (
                              <option key={cp.name} value={cp.name}>{cp.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {(() => {
                      const filteredCounterparts = drillDownData.counterparts.filter((cp) => {
                        if (drillDownData.type !== 'Buyer') return true;
                        return modalSupplierFilter === 'all' || cp.name === modalSupplierFilter;
                      });

                      if (filteredCounterparts.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs text-secondary font-medium bg-surface-container-low/20 rounded-2xl border border-dashed border-outline-variant/30">
                            No transactions found for the selected supplier.
                          </div>
                        );
                      }

                      return filteredCounterparts.map((cp) => (
                        <div key={cp.name} className="interactive-card p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/40 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
                            <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full bg-primary" />
                               {cp.name}
                            </span>
                            <div className="flex gap-4 text-[10px] font-black uppercase">
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Arrived: <strong className="text-on-surface font-mono text-xs font-bold">{(Number(cp.arrivedQty) || 0).toFixed(2)}</strong> QT</span>
                              <span className="text-amber-700 dark:text-amber-400 font-bold">Pending: <strong className="text-on-surface font-mono text-xs font-bold">{(Number(cp.pendingQty) || 0).toFixed(2)}</strong> QT</span>
                            </div>
                          </div>

                          {/* Partnership contract records list */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[9px] font-black uppercase text-secondary/70 tracking-widest">
                                  <th className="py-1">PO Number</th>
                                  <th className="py-1">Date</th>
                                  <th className="py-1 text-right">Volume</th>
                                  <th className="py-1 text-right">Rate / Qtl</th>
                                  <th className="py-1 text-right">Amount</th>
                                  <th className="py-1 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cp.entries.map((entry: any, index: number) => (
                                  <tr key={index} className="border-t border-outline-variant/10">
                                    <td className="py-2.5 font-mono font-bold text-primary">{entry.po}</td>
                                    <td className="py-2.5 text-secondary">{formatDateToDDMMYYYY(entry.date)}</td>
                                    <td className="py-2.5 text-right font-mono font-bold">{(Number(entry.qty) || 0).toFixed(2)} QTLS</td>
                                    <td className="py-2.5 text-right font-mono font-bold text-primary">₹ {formatINR(entry.rate || (entry.qty > 0 ? Math.round(entry.amount / entry.qty) : 0))}</td>
                                    <td className="py-2.5 text-right font-mono">₹ {formatINR(entry.amount)}</td>
                                    <td className="py-2.5 text-center col-span-1">
                                      {entry.status === 'Arrived' ? (
                                        <span className="text-[8px] font-black tracking-widest leading-none bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded uppercase font-bold">Arrived</span>
                                      ) : (
                                        <span className="text-[8px] font-black tracking-widest leading-none bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded uppercase animate-pulse font-bold">Pending</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Close Panel */}
              <div className="p-4 bg-surface-container border-t border-outline-variant/30 flex justify-end">
                <button 
                  onClick={() => setSelectedParty(null)}
                  className="px-6 py-2.5 bg-on-background text-background rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  Close Document
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Protected Delete Whole Ledger Confirmation Modal */}
      <AnimatePresence>
        {isDeleteAllModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-surface border border-red-500/40 dark:border-red-500/50 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-outline-variant/20 bg-gradient-to-br from-red-500/15 via-surface to-surface flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-on-surface">
                    Delete Whole Ledger Data
                  </h3>
                  <p className="text-xs text-secondary font-medium">
                    Permanent action. Authorization password verification is required to erase all ledger records.
                  </p>
                </div>
              </div>

              {/* Data Summary to be cleared */}
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Scope of Data Deletion</span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    You are about to permanently purge the entire commercial ledger database, including all supplier grain receipts, buyer shop deliveries, lifting notes, and financial balances.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-500/15 text-center">
                    <div className="p-2 bg-surface rounded-xl border border-outline-variant/20">
                      <span className="block text-[9px] uppercase tracking-wider text-secondary font-bold">Records</span>
                      <span className="font-mono font-black text-sm text-on-surface">{ledgers.length}</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-outline-variant/20">
                      <span className="block text-[9px] uppercase tracking-wider text-secondary font-bold">Total Volume</span>
                      <span className="font-mono font-black text-sm text-on-surface">{(totalSupplierVolume + totalBuyerVolume).toFixed(1)} Q</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-outline-variant/20">
                      <span className="block text-[9px] uppercase tracking-wider text-secondary font-bold">Total Value</span>
                      <span className="font-mono font-black text-sm text-on-surface">₹ {formatINR(totalSupplierAmount + totalBuyerAmount)}</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleDeleteWholeLedger} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-primary" />
                        <span>Master Authorization Password</span>
                      </span>
                      <span className="text-[10px] text-secondary/80 font-normal">
                        Password required: <span className="font-bold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">tejas</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={deletePassword}
                        onChange={(e) => {
                          setDeletePassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        placeholder="Enter password (tejas)"
                        autoFocus
                        required
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-xs text-on-surface focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="font-semibold">{passwordError}</span>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeleteAllModalOpen(false);
                        setDeletePassword('');
                        setPasswordError(null);
                        setShowPassword(false);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-secondary hover:bg-surface-container transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isDeleting || !deletePassword.trim()}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md flex items-center gap-2 cursor-pointer",
                        deletePassword.trim() 
                          ? "bg-red-600 hover:bg-red-700 active:scale-95 shadow-red-600/20" 
                          : "bg-red-600/50 cursor-not-allowed"
                      )}
                    >
                      {isDeleting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Wiping Ledger...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Authorize & Delete Whole Ledger</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Success Toast */}
      <AnimatePresence>
        {deleteSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-400/30 text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4 text-emerald-100 shrink-0" />
            <span>{deleteSuccessToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
