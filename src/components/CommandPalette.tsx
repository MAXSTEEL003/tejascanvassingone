import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  FileSpreadsheet, 
  CreditCard, 
  BookOpen, 
  Calculator, 
  Users, 
  BarChart3, 
  ClipboardList, 
  Calendar,
  Bell, 
  Command, 
  CornerDownLeft, 
  X,
  FileText,
  BadgeAlert,
  Archive,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs } from '../lib/firebase';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  category: 'Pages' | 'Customer Orders' | 'Placed Orders' | 'Products' | 'Inventory Arrivals';
  title: string;
  subtitle?: string;
  path: string;
  icon?: React.ComponentType<any>;
  metadata?: any;
}

export default function CommandPalette({ isOpen, setIsOpen }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [procurementOrders, setProcurementOrders] = useState<any[]>([]);
  const [placedOrders, setPlacedOrders] = useState<any[]>([]);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all indexable data
  const loadIndexableData = async () => {
    setIsLoading(true);
    try {
      // 1. Load Products (Firestore + Spring fallback)
      const prdDocs = await getCollectionDocs('product_inventory');
      const fallbackProducts = [
        { id: 'PRD-1001', name: 'KESHAR MADHURAM', brand: 'Raw Rice', price: 5200.00, status: 'Active' },
        { id: 'PRD-1002', name: 'JMR', brand: 'Steam Rice', price: 4800.00, status: 'Active' },
        { id: 'PRD-1003', name: 'VAISHNAVI', brand: 'Steam Rice', price: 5100.00, status: 'Active' },
        { id: 'PRD-1004', name: 'KESHAR KALI', brand: 'Sella Rice', price: 6200.00, status: 'Active' },
      ];
      setProducts(prdDocs && prdDocs.length > 0 ? prdDocs : fallbackProducts);

      // 2. Load Procurement Orders (Customer/Requests)
      const cloudReqs = await getCollectionDocs('procurement_requests');
      const localReqs = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const combinedReqs = [...cloudReqs, ...localReqs]
        .filter((o: any) => o && o.id && !String(o.id).startsWith('#ORD-99') && !String(o.id).startsWith('TC-0000'));
      const uniqueReqs = Array.from(new Map(combinedReqs.map(item => [item.id, item])).values());
      setProcurementOrders(uniqueReqs);

      // 3. Load Placed Orders (Corporate / Contracts)
      const cloudPlaced = await getCollectionDocs('placed_orders');
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const combinedPlaced = [...cloudPlaced, ...localPlaced]
        .filter((o: any) => o && o.id && o.id !== 'ORD-TC-1024' && !String(o.id).startsWith('#ORD-99') && !String(o.id).startsWith('TC-0000'));
      const uniquePlaced = Array.from(new Map(combinedPlaced.map(item => [item.id, item])).values());
      setPlacedOrders(uniquePlaced);

      // 4. Load Inventory Arrivals (Excel-style ledger entries)
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      setArrivals(localArrivals.filter((r: any) => r && (r.billNo || r.millerName || r.partyName)));

    } catch (e) {
      console.error('Command Palette indexing failed. Proceeding with local cache.', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Load data when opened
  useEffect(() => {
    if (isOpen) {
      loadIndexableData();
      setSearch('');
      setSelectedIndex(0);
      // Timeout to ensure modal has transitioned in before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Pre-compiled list of direct navigation links
  const navigationShortcuts: CommandItem[] = [
    { id: 'nav-dashboard', category: 'Pages', title: 'Sales Order Dashboard', subtitle: 'Pipeline requests, order placement & custom approvals', path: '/dashboard', icon: ShoppingCart },
    { id: 'nav-placed-orders', category: 'Pages', title: 'Placed Contracts & Shipments', subtitle: 'Logistics tracking, supplier maps and PO dispatches', path: '/placed-orders', icon: Package },
    { id: 'nav-inventory', category: 'Pages', title: 'Catalog & Inventory stock', subtitle: 'Modify grain products, prices, and replenishment flags', path: '/inventory', icon: Warehouse },
    { id: 'nav-arrival-entry', category: 'Pages', title: 'Live Arrival Records Spreadsheet', subtitle: 'Excel ledger grid for incoming mill billing accounts', path: '/arrival-entry', icon: FileSpreadsheet },
    { id: 'nav-payments', category: 'Pages', title: 'Aging & Overdue Payments', subtitle: 'Receive overdue billing trackers and automated alerts', path: '/payments', icon: CreditCard },
    { id: 'nav-ledger', category: 'Pages', title: 'Accounts Ledger', subtitle: 'Reconciliation tables, party transactions, and statements', path: '/ledger', icon: BookOpen },
    { id: 'nav-patti', category: 'Pages', title: 'Commercial Patti Calculation Ledger', subtitle: 'Run market fees, purchase weights and billing formulas', path: '/patti', icon: Calculator },
    { id: 'nav-users', category: 'Pages', title: 'Customer & Partner Directory', subtitle: 'Contact records for buyers, millers, employees and agents', path: '/users', icon: Users },
    { id: 'nav-analytics', category: 'Pages', title: 'Analytics Insights', subtitle: 'Data visualizations of sales distribution and price trackers', path: '/analytics', icon: BarChart3 },
    { id: 'nav-schedule', category: 'Pages', title: 'Work Schedule & Reminders', subtitle: 'Google Calendar style work schedule, reminders & staff tasks', path: '/schedule', icon: Calendar },
    { id: 'nav-settings', category: 'Pages', title: 'App Settings & Alerts', subtitle: 'Manage low-stock levels, text alerts, and notification lists', path: '/settings', icon: Bell }
  ];

  // Compile other types of content into searchable command items
  const indexedItems = useMemo(() => {
    const list: CommandItem[] = [...navigationShortcuts];

    // Map Customer/Procurement Orders (Dashboard)
    procurementOrders.forEach(o => {
      list.push({
        id: `po-${o.id}`,
        category: 'Customer Orders',
        title: `${o.id} • ${o.buyer || 'Unknown Buyer'}`,
        subtitle: `Request for ${o.qty || 0} QTLs of ${o.product || 'Grain'} • Status: ${o.status || 'Pending'}`,
        path: '/dashboard', // Navigates to dashboard, can be highlighted
        icon: FileText,
        metadata: { id: o.id, ...o }
      });
    });

    // Map Placed Orders / Contracts
    placedOrders.forEach(po => {
      const displayTotal = po.total || (po.netAmt ? `₹ ${formatINR(po.netAmt)}` : '');
      const locStr = (po.origin && po.destination) ? ` • ${po.origin} ➔ ${po.destination}` : '';
      list.push({
        id: `contract-${po.id}`,
        category: 'Placed Orders',
        title: `Contract ID: ${po.id}`,
        subtitle: `Grain: ${po.items || 'Rice Brand'} • Vol Total: ${displayTotal}${locStr} • ${po.status || 'Active'}`,
        path: po.id && !po.id.startsWith('TC-0') ? `/order/${po.id}` : '/placed-orders',
        icon: Package,
        metadata: { id: po.id, ...po }
      });
    });

    // Map Catalog Products
    products.forEach(p => {
      list.push({
        id: `prd-${p.id}`,
        category: 'Products',
        title: `${p.name} (${p.id})`,
        subtitle: `Brand: ${p.brand || 'Unbranded'} • Base Price: ₹ ${formatINR(p.price || 0)}/QTL • Status: ${p.status || 'Active'}`,
        path: '/inventory',
        icon: Archive,
        metadata: { id: p.id, ...p }
      });
    });

    // Map Live Ledger Arrivals
    arrivals.forEach((arr, idx) => {
      const desc = `${arr.qty ? arr.qty + ' QTLS' : ''} • Bill #${arr.billNo || 'N/A'} • Supplier: ${arr.millerName || 'Unassigned'}`;
      list.push({
        id: `arrival-row-${idx}`,
        category: 'Inventory Arrivals',
        title: `${arr.partyName || 'Unknown Buyer'} • Bill Ref: ${arr.billNo || '#' + idx}`,
        subtitle: desc + ` • Pending: ${arr.noOfDays ? arr.noOfDays + ' Days' : 'Not Settled'}`,
        path: '/arrival-entry',
        icon: FileSpreadsheet,
        metadata: { ...arr }
      });
    });

    return list;
  }, [products, procurementOrders, placedOrders, arrivals]);

  // Filter based on search input
  const filteredItems = useMemo(() => {
    if (!(search || '').trim()) return navigationShortcuts; // Show navigation routes when empty
    const q = (search || '').toLowerCase().trim();
    return indexedItems.filter(item => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchSubtitle = (item.subtitle || '').toLowerCase().includes(q);
      const matchCat = (item.category || '').toLowerCase().includes(q);
      const matchId = (item.id || '').toLowerCase().includes(q);
      return matchTitle || matchSubtitle || matchCat || matchId;
    });
  }, [search, indexedItems]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle clicking on an item
  const handleItemSelect = (item: CommandItem) => {
    setIsOpen(false);
    navigate(item.path);

    // If it's a specific order or catalog item, trigger a search filter or visual highlight on that page
    if (item.category === 'Products' && item.metadata?.name) {
      // Set localized query
      sessionStorage.setItem('goto_search_query', item.metadata.id);
      window.dispatchEvent(new Event('goto-search-event'));
    } else if (item.category === 'Customer Orders' && item.metadata?.id) {
      sessionStorage.setItem('goto_search_query', item.metadata.id);
      window.dispatchEvent(new Event('goto-search-event'));
    } else if (item.category === 'Inventory Arrivals' && item.metadata?.billNo) {
      sessionStorage.setItem('goto_arrival_bill', item.metadata.billNo);
      window.dispatchEvent(new Event('goto-arrival-event'));
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleItemSelect(filteredItems[selectedIndex]);
      }
    }
  };

  // Group items by category to make it extremely clear
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Flat list order index to find absolute index from grouped map for selected highlighting
  const itemFlatIndices = useMemo(() => {
    const flat: string[] = [];
    Object.keys(groupedItems).forEach(cat => {
      groupedItems[cat].forEach(item => {
        flat.push(item.id);
      });
    });
    return flat;
  }, [groupedItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay background with modern thick glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-[9999]"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette container */}
          <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-24 px-4 overflow-y-auto pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -20 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              ref={containerRef}
              className="w-full max-w-2xl bg-white dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col pointer-events-auto"
              onKeyDown={handleKeyDown}
            >
              {/* Search Bar Input Header */}
              <div className="relative border-b border-neutral-100 dark:border-neutral-800 p-4 shrink-0 flex items-center justify-between">
                <div className="flex-1 flex items-center gap-3">
                  <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search records, grain brands, bill numbers or pages..."
                    className="w-full bg-transparent border-none text-neutral-800 dark:text-neutral-100 text-sm outline-none placeholder-neutral-400 font-medium py-1"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-lg px-2 py-0.5 font-bold uppercase tracking-widest hidden sm:inline-block">
                    ESC to close
                  </span>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Results Area */}
              <div className="flex-1 max-h-[420px] overflow-y-auto p-2 scrollbar-thin">
                {isLoading && filteredItems.length === 0 ? (
                  <div className="p-12 text-center text-sm text-neutral-400 flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span>Indexing logistics ledger...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
                    <BadgeAlert className="w-8 h-8 text-neutral-400 mb-1" />
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No matches found for "{search}"</p>
                    <p className="text-xs text-neutral-400 max-w-sm">No matched orders, items or ledger records. Try adjusting your query keywords.</p>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {Object.keys(groupedItems).map((catName) => (
                      <div key={catName} className="space-y-1">
                        {/* Section Category Title */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[10px] font-black text-primary/8 pointer-events-none tracking-widest uppercase dark:text-primary/70">
                            {catName}
                          </span>
                          <span className="text-[8px] text-neutral-400 dark:text-neutral-500 font-mono">
                            {groupedItems[catName].length} Result{groupedItems[catName].length > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Section Items */}
                        <div className="space-y-0.5">
                          {groupedItems[catName].map((item) => {
                            // Find flat list active index for rendering backgrounds
                            const flatIndex = itemFlatIndices.indexOf(item.id);
                            const isSelected = flatIndex === selectedIndex;
                            const IconComponent = item.icon || FileText;

                            return (
                              <div
                                key={item.id}
                                onClick={() => handleItemSelect(item)}
                                onMouseEnter={() => setSelectedIndex(flatIndex)}
                                className={cn(
                                  "w-full flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer select-none text-left",
                                  isSelected 
                                    ? "bg-primary text-white shadow-md shadow-primary/10 scale-[1.006]" 
                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200"
                                )}
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className={cn(
                                    "p-2 rounded-lg shrink-0 flex items-center justify-center transition-colors",
                                    isSelected 
                                      ? "bg-white/20 text-white" 
                                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                                  )}>
                                    <IconComponent className="w-4 h-4 shrink-0" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold leading-normal truncate">
                                      {item.title}
                                    </h4>
                                    {item.subtitle && (
                                      <p className={cn(
                                        "text-[10px] leading-normal font-medium mt-0.5 truncate",
                                        isSelected ? "text-white/80" : "text-neutral-400 dark:text-neutral-500"
                                      )}>
                                        {item.subtitle}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  {isSelected ? (
                                    <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white animate-fade-in">
                                      <span>Select</span>
                                      <CornerDownLeft className="w-3 h-3" />
                                    </div>
                                  ) : (
                                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700 transition-transform" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Command Bar Footer Guide */}
              <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-850 p-3 shrink-0 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 select-none">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-medium select-none">
                    <kbd className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-720 rounded px-1.5 py-0.5 font-mono shadow-sm">▲</kbd>
                    <kbd className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-720 rounded px-1.5 py-0.5 font-mono shadow-sm">▼</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1 font-medium select-none">
                    <kbd className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-720 rounded px-1.5 py-0.5 font-mono shadow-sm">Enter</kbd>
                    Open Page
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span className="font-semibold tracking-wider uppercase">Procurement OS</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
