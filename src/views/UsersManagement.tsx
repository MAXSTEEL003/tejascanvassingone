import { 
  ShieldCheck, 
  UserPlus, 
  MoreVertical, 
  Mail, 
  MapPin, 
  Building2, 
  UserCircle, 
  Briefcase, 
  X, 
  Phone, 
  Globe, 
  FileText, 
  AlertCircle, 
  ArrowRight, 
  Edit2, 
  Save, 
  Coins, 
  CheckCircle2, 
  Info,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection, auth, setCollectionDoc, deleteCollectionDoc } from '../lib/firebase';

type Category = 'suppliers' | 'buyers' | 'employees';

const initialStakeholders = {
  suppliers: [],
  buyers: [],
  employees: []
};

export default function UsersManagement() {
  const [activeTab, setActiveTab] = useState<Category>('buyers');
  const [stakeholders, setStakeholders] = useState<any>(() => {
    const saved = localStorage.getItem('stakeholders_v2');
    return saved ? JSON.parse(saved) : initialStakeholders;
  });

  // Modal / Detail / Delete states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; category: Category } | null>(null);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Lists for calculations
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allArrivals, setAllArrivals] = useState<any[]>([]);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
    road: '',
    role: '',
    contact: '',
    credit: '',
    category: 'buyers' as Category
  });

  // Load registered profiles from Firestore stakeholders
  const syncRegisteredCloudStakeholders = async () => {
    try {
      const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
      const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      const deletedSet = new Set(deletedIds.map(id => String(id).trim().toLowerCase().replace(/^#/, '')));

      const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
      if (cloudStakeholders && cloudStakeholders.length > 0) {
        setStakeholders((prev: any) => {
          const buyers = [...(prev.buyers || [])];
          const suppliers = [...(prev.suppliers || [])];
          const employees = [...(prev.employees || [])];

          cloudStakeholders.forEach((cs: any) => {
            const normId = String(cs.id || '').trim().toLowerCase().replace(/^#/, '');
            if (deletedSet.has(normId)) {
              return; // Skip deleted stakeholder
            }

            const type = cs.type || 'buyers';
            if (type === 'buyers') {
              const idx = buyers.findIndex((b: any) => b.id === cs.id || b.email?.toLowerCase() === cs.email?.toLowerCase());
              if (idx !== -1) {
                buyers[idx] = { ...buyers[idx], ...cs };
              } else {
                buyers.push({ ...cs, id: cs.id || `CLD-BUY-${Date.now()}` });
              }
            } else if (type === 'suppliers') {
              const idx = suppliers.findIndex((s: any) => s.id === cs.id || s.email?.toLowerCase() === cs.email?.toLowerCase());
              if (idx !== -1) {
                suppliers[idx] = { ...suppliers[idx], ...cs };
              } else {
                suppliers.push({ ...cs, id: cs.id || `CLD-SUP-${Date.now()}` });
              }
            } else if (type === 'employees') {
              const idx = employees.findIndex((e: any) => e.id === cs.id || e.email?.toLowerCase() === cs.email?.toLowerCase());
              if (idx !== -1) {
                employees[idx] = { ...employees[idx], ...cs };
              } else {
                employees.push({ ...cs, id: cs.id || `CLD-EMP-${Date.now()}` });
              }
            }
          });

          return { buyers, suppliers, employees };
        });
      }
    } catch (err) {
      console.warn('Error loading stakeholders collection:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('stakeholders_v2', JSON.stringify(stakeholders));
  }, [stakeholders]);

  // Load pipeline lists to aggregate user stats dynamically on click
  const loadPipelineInfo = async () => {
    try {
      // Load current orders
      const localRequests = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const cloudRequests = await getCollectionDocs('procurement_requests').catch(() => []);
      const mergedReqs = [...localRequests, ...cloudRequests];
      const uniqueRequests = Array.from(new Map(mergedReqs.map(o => [o.id, o])).values());

      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      const mergedPlaced = [...localPlaced, ...cloudPlaced];
      const uniquePlaced = Array.from(new Map(mergedPlaced.map(o => [o.id, o])).values());

      setAllOrders([...uniqueRequests, ...uniquePlaced]);

      // Load physical arrivals
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
      
      let finalArr = [...localArrivals];
      if (cloudArrivals && cloudArrivals.length > 0) {
        const grid = Array(Math.max(30, cloudArrivals.length, localArrivals.length)).fill(0).map((_, i) => {
          return localArrivals[i] || {};
        });
        cloudArrivals.forEach(row => {
          const idx = parseInt(row.id?.replace('row-', '') || '');
          if (!isNaN(idx) && idx >= 0) {
            const { id, ...cloudRow } = row;
            const localRow = grid[idx];

            const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
            const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));
            const isCloudDummy = cloudRow.billNo === '1042';

            let shouldOverwrite = false;
            if (isCloudDummy) {
              shouldOverwrite = false;
            } else if (!isLocalReal && isCloudReal) {
              shouldOverwrite = true;
            } else if (isLocalReal && isCloudReal) {
              const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
              const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
              if (cloudTime > localTime || !localRow.lastUpdated) {
                shouldOverwrite = true;
              }
            } else if (!isLocalReal && !isCloudReal) {
              shouldOverwrite = true;
            }

            if (shouldOverwrite) {
              grid[idx] = row;
            }
          }
        });
        finalArr = grid.filter(g => g && Object.keys(g).length > 0);
      }
      setAllArrivals(finalArr);
    } catch (e) {
      console.error("Error loading user pipeline metrics:", e);
    }
  };

  useEffect(() => {
    syncRegisteredCloudStakeholders();
    loadPipelineInfo();
  }, []);

  const handleCreateStakeholder = (e: React.FormEvent) => {
    e.preventDefault();
    const prefix = newUser.category === 'suppliers' ? 'SUP' : newUser.category === 'buyers' ? 'BUY' : 'EMP';
    const id = `${prefix}-${(stakeholders[newUser.category].length + 1).toString().padStart(2, '0')}`;
    
    const entry = {
      id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      gstin: newUser.gstin || 'N/A',
      address: newUser.address,
      road: newUser.category === 'buyers' ? (newUser.road || '') : undefined,
      status: newUser.category === 'employees' ? 'On Duty' : 'Active',
      ...(newUser.category === 'employees' ? { role: newUser.role } : { contact: newUser.contact }),
      ...(newUser.category === 'buyers' ? { credit: newUser.credit || '₹ 50.0 Lakh' } : {})
    };

    const updated = {
      ...stakeholders,
      [newUser.category]: [entry, ...stakeholders[newUser.category]]
    };
    setStakeholders(updated);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updated));

    // Sync to Firestore cloud storage
    setCollectionDoc('stakeholders', entry.id, { ...entry, type: newUser.category }).catch(err => {
      console.error("Error creating stakeholder in cloud:", err);
    });

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: newUser.category, user: entry } }));

    setIsAddModalOpen(false);
    setNewUser({
      name: '',
      email: '',
      phone: '',
      gstin: '',
      address: '',
      road: '',
      role: '',
      contact: '',
      credit: '',
      category: newUser.category
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const previousUser = (stakeholders[activeTab] || []).find((item: any) => item.id === selectedUser.id);
    const oldName = previousUser?.name?.trim();
    const newName = selectedUser.name?.trim();

    const currentList = stakeholders[activeTab] || [];
    const updatedList = currentList.map((item: any) => {
      if (item.id === selectedUser.id) {
        return selectedUser;
      }
      return item;
    });
    const updatedStakeholders = {
      ...stakeholders,
      [activeTab]: updatedList
    };
    setStakeholders(updatedStakeholders);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updatedStakeholders));

    // Sync to Firestore cloud storage
    setCollectionDoc('stakeholders', selectedUser.id, { ...selectedUser, type: activeTab }).catch(err => {
      console.error("Error updating stakeholder in cloud:", err);
    });

    // If a supplier was renamed, propagate the new supplier name to all associated products in product_inventory
    if (activeTab === 'suppliers' && oldName && newName && oldName !== newName) {
      try {
        const rawInv = localStorage.getItem('product_inventory');
        let invList: any[] = rawInv ? JSON.parse(rawInv) : [];
        let invChanged = false;
        invList = invList.map((prod: any) => {
          if (!prod) return prod;
          const prodSup = prod.supplier ? String(prod.supplier).trim() : '';
          const prodSupId = prod.supplierId ? String(prod.supplierId).trim() : '';
          if (prodSup === oldName || prodSupId === selectedUser.id || prodSup === selectedUser.id) {
            invChanged = true;
            return {
              ...prod,
              supplier: newName,
              supplierId: selectedUser.id
            };
          }
          return prod;
        });
        if (invChanged) {
          localStorage.setItem('product_inventory', JSON.stringify(invList));
          syncCollection('product_inventory', invList).catch(err => {
            console.warn("Error syncing updated products with new supplier name to cloud:", err);
          });
        }
      } catch (err) {
        console.warn("Could not propagate supplier rename to products:", err);
      }
    }

    // Unconditionally trigger events so all other views (StoreManagement, ProductInventory, OrdersDashboard) refresh instantly
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { supplierUpdated: true, oldName, newName } }));
    window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: activeTab, updatedUser: selectedUser } }));

    // If this is the currently logged-in user, also sync the local session
    const currentEmail = auth.currentUser?.email;
    const isCurrentUser = (selectedUser.email && currentEmail && selectedUser.email.toLowerCase() === (currentEmail || '').toLowerCase()) || 
                          selectedUser.id === auth.currentUser?.uid ||
                          (selectedUser.name === localStorage.getItem('userName'));
    if (isCurrentUser) {
      localStorage.setItem('userName', selectedUser.name);
      localStorage.setItem('userPhone', selectedUser.phone);
      localStorage.setItem('userGstin', selectedUser.gstin || '29AAGCV7712M1ZP');
      localStorage.setItem('userAddress', selectedUser.address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
    }

    setIsEditing(false);
  };

  const handleDeleteStakeholder = async (userId: string, category: Category, userName: string) => {
    // 1. Update React state & localStorage
    setStakeholders((prev: any) => {
      const currentList = prev[category] || [];
      const updatedList = currentList.filter((item: any) => item.id !== userId);
      const updated = {
        ...prev,
        [category]: updatedList
      };
      localStorage.setItem('stakeholders_v2', JSON.stringify(updated));
      return updated;
    });

    // 2. Persistent tombstone in localStorage so cloud fetch ignores it
    try {
      const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
      const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedIds.includes(userId)) {
        deletedIds.push(userId);
        localStorage.setItem('deleted_stakeholder_ids', JSON.stringify(deletedIds));
      }
    } catch (e) {}

    // 3. Delete from Firestore collections
    try {
      const rawId = String(userId).replace(/^#/, '');
      await Promise.allSettled([
        deleteCollectionDoc('stakeholders', rawId),
        deleteCollectionDoc('stakeholders', `#${rawId}`),
        deleteCollectionDoc('stakeholders_v2', rawId),
        deleteCollectionDoc('stakeholders_v2', `#${rawId}`)
      ]);
    } catch (err) {
      console.warn("Error deleting stakeholder from Firestore:", err);
    }

    // 4. Clear selection if deleted user was active
    if (selectedUser?.id === userId) {
      setSelectedUser(null);
      setIsEditing(false);
    }

    setUserToDelete(null);
    setDeleteToast(`Stakeholder "${userName}" has been removed.`);
    setTimeout(() => {
      setDeleteToast(null);
    }, 4000);

    // 5. Broadcast storage event
    window.dispatchEvent(new Event('storage'));
  };

  // Compute pending metrics for details view
  const userMetrics = React.useMemo(() => {
    if (!selectedUser) return { pendingOrders: [], pendingPayments: [], orderTotal: 0, paymentTotal: 0 };

    const nameUpper = selectedUser.name.trim().toUpperCase();

    // 1. Pending orders
    // We look for any order that matches buyer name or supplier name and is not completely arrived/settled
    const pendingOrders = allOrders.filter(o => {
      const bMatch = o.buyer && o.buyer.trim().toUpperCase().includes(nameUpper);
      const sMatch = o.supplier && o.supplier.trim().toUpperCase().includes(nameUpper);
      const isNotSettled = o.status !== 'Arrived' && o.status !== 'Settled' && o.status !== 'Cleared';
      return (bMatch || sMatch) && isNotSettled;
    });

    // 2. Pending payments (from arrival_entries)
    // We look for any unchecked/uncleared arrivals where partyName or millerName matches stakeholder name
    const pendingPayments = allArrivals.map((row, index) => {
      const bMatch = row.partyName && row.partyName.trim().toUpperCase().includes(nameUpper);
      const sMatch = row.millerName && row.millerName.trim().toUpperCase().includes(nameUpper);
      const isUncleared = row.noOfDayRec !== 'Cleared';
      
        if ((bMatch || sMatch) && isUncleared && row.qty) {
          const amt = parseFloat(row.netAmt) || parseFloat(row.amount) || ((parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0)) || 0;
          const cleanBillId = row.billNo 
            ? String(row.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '') 
            : `ARR-${index + 1001}`;
          return {
            id: cleanBillId,
            date: row.date || 'N/A',
          commodity: row.variety || row.item || 'Sona Masoori',
          qty: parseFloat(row.qty) || 0,
          rate: parseFloat(row.rate) || 0,
          total: amt,
          buyer: row.partyName,
          supplier: row.millerName,
          daysOld: row.noOfDays || 0
        };
      }
      return null;
    }).filter((x): x is any => x !== null);

    const orderTotal = pendingOrders.reduce((sum, o) => {
      const amtStr = String(o.total || '0').replace(/[^\r\n0-9.]/g, '');
      const parsed = parseFloat(amtStr) || (o.qty && o.rate ? o.qty * o.rate : 0);
      return sum + parsed;
    }, 0);

    const paymentTotal = pendingPayments.reduce((sum, p) => sum + p.total, 0);

    return {
      pendingOrders,
      pendingPayments,
      orderTotal,
      paymentTotal
    };
  }, [selectedUser, allOrders, allImportsCombined => allArrivals]);

  const tabs = [
    { id: 'buyers', label: 'Buyers', icon: UserCircle },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'employees', label: 'Employees', icon: Briefcase },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto select-none">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
            Relationship Registry
          </span>
          <h1 className="text-3xl font-black tracking-tight mt-1 text-on-surface">Stakeholder Directory</h1>
          <p className="text-secondary text-sm font-medium mt-1">Manage institutional profiles, active supplier GSTIN credentials, and buyer billing properties.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { setNewUser(prev => ({ ...prev, category: activeTab })); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
          >
            <UserPlus className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Category);
              setSelectedUser(null);
              setIsEditing(false);
            }}
            className={cn(
              "flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-all",
              activeTab === tab.id 
                ? "border-primary text-primary" 
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <tab.icon className="w-4 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Main Stakeholder Table */}
        <div className={cn(
          "col-span-12 transition-all duration-300",
          selectedUser ? "lg:col-span-7" : "lg:col-span-9"
        )}>
          <div className="liquid-glass rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/20 text-[10px] font-black text-secondary uppercase tracking-widest">
                    <th className="p-5">Name / Legal Entity</th>
                    <th className="p-5">{activeTab === 'employees' ? 'Role' : 'GSTIN & Address'}</th>
                    <th className="p-5">Communication Info</th>
                    {activeTab === 'buyers' && <th className="p-5">Credit Appraisal</th>}
                    <th className="p-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {stakeholders[activeTab]?.map((item: any) => (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        setSelectedUser(item);
                        setIsEditing(false);
                      }}
                      className={cn(
                        "interactive-tr group cursor-pointer",
                        selectedUser?.id === item.id ? "bg-primary/[0.04] border-l-4 border-l-primary" : ""
                      )}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-xs border border-primary/10 group-hover:scale-105 transition-transform">
                            {item.name.replace(/[^\w\s]/g, '').split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'SH'}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-on-surface leading-tight uppercase">{item.name}</p>
                            <p className="text-[10px] text-secondary/60 font-bold tracking-wider mt-0.5 font-mono">{item.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 text-xs">
                        {activeTab === 'employees' ? (
                          <span className="font-extrabold text-primary">{item.role}</span>
                        ) : (
                          <div className="space-y-1 max-w-xs">
                            <p className="font-extrabold text-on-surface/90 font-mono text-[10.5px]">GSTIN: {item.gstin || 'N/A'}</p>
                            {activeTab === 'buyers' && item.road && (
                              <p className="text-primary font-bold text-[10.5px]">Road: {item.road}</p>
                            )}
                            <p className="text-secondary font-medium leading-normal text-[10.5px] line-clamp-1">{item.address || 'N/A'}</p>
                          </div>
                        )}
                      </td>

                      <td className="p-5 text-xs text-secondary space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Mail className="w-3.5 h-3.5 opacity-50" />
                          <span>{item.email}</span>
                        </div>
                        {item.phone && (
                          <div className="flex items-center gap-1.5 font-bold">
                            <Phone className="w-3.5 h-3.5 opacity-50" />
                            <span>{item.phone}</span>
                          </div>
                        )}
                      </td>

                      {activeTab === 'buyers' && (
                        <td className="p-5">
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full">{item.credit || '₹ 50.0 L'}</span>
                        </td>
                      )}

                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(item);
                              setIsEditing(true);
                            }}
                            className="p-2 hover:bg-surface-container rounded-lg transition-colors flex items-center justify-center text-secondary hover:text-primary cursor-pointer"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete({ id: item.id, name: item.name, category: activeTab });
                            }}
                            className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center justify-center text-secondary hover:text-rose-600 cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-surface-container-low/30 border-t border-outline-variant/10 text-[11px] font-bold text-secondary text-center">
              Total {activeTab.toUpperCase()} listed: {stakeholders[activeTab]?.length || 0}
            </div>
          </div>
        </div>

        {/* Concise Insights and Edit Profile Pane */}
        {(selectedUser || isEditing) && (
          <div className={cn(
            "col-span-12 transition-all duration-300",
            selectedUser ? "lg:col-span-5" : "lg:col-span-3"
          )}>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="panel-card bg-surface border border-outline-variant/30 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-outline-variant bg-surface-container-low/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                    {isEditing ? <Edit2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">
                    {isEditing ? "Modify Profile" : "Concise Trade Insights"}
                  </h3>
                </div>
                <button 
                  onClick={() => { setSelectedUser(null); setIsEditing(false); }}
                  className="p-1 px-1.5 hover:bg-surface-container rounded-lg text-secondary hover:text-on-surface leading-none text-xs font-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isEditing && selectedUser ? (
                // EDIT PROFILE MODE FORM
                <form onSubmit={handleUpdateUser} className="p-6 space-y-4 overflow-y-auto">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Legal Entity Name</label>
                    <input 
                      required
                      type="text" 
                      value={selectedUser.name}
                      onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Email Address</label>
                    <input 
                      required
                      type="email" 
                      value={selectedUser.email}
                      onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold font-mono outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Phone Number</label>
                    <input 
                      required
                      type="text" 
                      value={selectedUser.phone || ''}
                      onChange={(e) => setSelectedUser({...selectedUser, phone: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none font-mono"
                    />
                  </div>

                  {activeTab !== 'employees' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary">GSTIN Tax ID</label>
                        <input 
                          required
                          type="text" 
                          value={selectedUser.gstin || ''}
                          onChange={(e) => setSelectedUser({...selectedUser, gstin: e.target.value.toUpperCase()})}
                          className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold font-mono outline-none"
                        />
                      </div>

                      {activeTab === 'buyers' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Road</label>
                          <input 
                            type="text" 
                            placeholder="e.g. APMC Lane"
                            value={selectedUser.road || ''}
                            onChange={(e) => setSelectedUser({...selectedUser, road: e.target.value})}
                            className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Registered Billing Address</label>
                        <textarea 
                          required
                          rows={3}
                          value={selectedUser.address || ''}
                          onChange={(e) => setSelectedUser({...selectedUser, address: e.target.value})}
                          className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold leading-normal outline-none font-sans"
                        />
                      </div>
                    </>
                  )}

                  {activeTab === 'buyers' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Credit Appraisal Cap</label>
                      <input 
                        type="text" 
                        value={selectedUser.credit || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, credit: e.target.value})}
                        className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  {activeTab === 'employees' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Designation / Role</label>
                      <input 
                        type="text" 
                        value={selectedUser.role || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                        className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setUserToDelete({ id: selectedUser.id, name: selectedUser.name, category: activeTab })}
                      className="px-3.5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border border-rose-500/20 cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-surface-container hover:bg-neutral-200 dark:hover:bg-neutral-800 text-secondary py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-primary text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                // CONCISE DIRECT LIVE INSIGHT DRAWDOWN VIEW
                <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Stakeholder Details Capsule */}
                  <div className="space-y-3 pb-5 border-b border-outline-variant/30">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="text-base font-black text-on-surface uppercase leading-tight">{selectedUser.name}</h4>
                        <span className="text-[10px] font-mono font-bold text-outline uppercase tracking-wider">{selectedUser.id}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="p-1 px-2.5 bg-primary/[0.06] hover:bg-primary/[0.12] rounded-lg text-primary text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-primary/10 transition-colors cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button 
                          onClick={() => setUserToDelete({ id: selectedUser.id, name: selectedUser.name, category: activeTab })}
                          className="p-1 px-2.5 bg-rose-500/[0.08] hover:bg-rose-500/[0.16] rounded-lg text-rose-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-rose-500/20 transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-surface-container-low rounded-2xl space-y-2 border border-outline-variant/20 text-[10.5px]">
                      {selectedUser.phone && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Phone:</span>
                          <span className="font-mono font-bold text-on-surface">{selectedUser.phone}</span>
                        </div>
                      )}
                      {selectedUser.gstin && selectedUser.gstin !== 'N/A' && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">GSTIN:</span>
                          <span className="font-mono font-extrabold text-on-surface">{selectedUser.gstin}</span>
                        </div>
                      )}
                      {activeTab === 'buyers' && selectedUser.road && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Road:</span>
                          <span className="font-sans font-bold text-on-surface">{selectedUser.road}</span>
                        </div>
                      )}
                      {selectedUser.email && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Email:</span>
                          <span className="font-mono font-bold text-[#0091ff]">{selectedUser.email}</span>
                        </div>
                      )}
                       {selectedUser.pan && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">PAN Card:</span>
                          <span className="font-mono font-bold text-on-surface">{selectedUser.pan}</span>
                        </div>
                      )}
                      {selectedUser.state && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">State & Market:</span>
                          <span className="font-sans font-bold text-on-surface">{selectedUser.state} - {selectedUser.mandi || 'APMC'}</span>
                        </div>
                      )}
                      {selectedUser.address && (
                        <div className="pt-1 border-t border-outline-variant/10">
                          <p className="text-secondary font-black uppercase text-[8px] tracking-wider mb-0.5">Address:</p>
                          <p className="text-on-surface/80 font-medium leading-normal">{selectedUser.address}</p>
                        </div>
                      )}
                      {selectedUser.bankName && (
                        <div className="pt-1.5 border-t border-outline-variant/10 space-y-1">
                          <p className="text-secondary font-black uppercase text-[8px] tracking-wider">Settlement Financials:</p>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-secondary">Bank Name:</span>
                            <span className="font-sans font-bold text-on-surface">{selectedUser.bankName}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-secondary">Account No:</span>
                            <span className="font-mono font-bold text-on-surface">{selectedUser.accountNo}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-secondary">IFSC Code:</span>
                            <span className="font-mono font-bold text-on-surface">{selectedUser.ifsc}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeTab !== 'employees' ? (
                    <>
                      {/* PENDING ORDERS (CONCISE SUMMARY) */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-secondary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Pending Active Orders
                          </h4>
                          <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                            ₹ {formatINR(userMetrics.orderTotal)}
                          </span>
                        </div>

                        {userMetrics.pendingOrders.length === 0 ? (
                          <div className="p-4 bg-surface-container/30 border border-dashed border-outline-variant/30 rounded-2xl text-center text-[11px] text-secondary font-medium">
                            No active pending contract batches.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1">
                            {userMetrics.pendingOrders.map((o) => (
                              <div key={o.id} className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex justify-between items-start hover:border-primary/20 transition-all font-sans text-left interactive-card">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase font-mono text-primary select-all">{o.id}</span>
                                    <span className="text-[8px] font-bold text-secondary">{o.date}</span>
                                  </div>
                                  <p className="text-[10.5px] font-medium text-secondary truncate max-w-[150px]">{o.items || o.product || 'Rice Batch'}</p>
                                </div>
                                <div className="text-right">
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-orange-50 text-orange-600 border border-orange-100">
                                    {o.status}
                                  </span>
                                  <p className="text-[10.5px] font-mono font-black text-on-surface mt-1">
                                    {o.total ? String(o.total) : `₹ ${formatINR((o.qty || 0) * (o.rate || 0))}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PENDING PAYMENTS OUTSTANDING OVERVIEW */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-secondary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                            Outstanding Payouts
                          </h4>
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full select-all">
                            ₹ {formatINR(userMetrics.paymentTotal)}
                          </span>
                        </div>

                        {userMetrics.pendingPayments.length === 0 ? (
                          <div className="p-4 bg-surface-container/30 border border-dashed border-outline-variant/30 rounded-2xl text-center text-[11px] text-secondary font-medium">
                            All arrival shipments settled. No outstanding invoices.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1">
                            {userMetrics.pendingPayments.map((p) => (
                              <div key={p.id} className="p-3 bg-rose-500/[0.02] border border-rose-500/10 rounded-2xl flex justify-between items-start hover:border-rose-500/30 transition-all font-sans text-left interactive-card">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black font-mono text-rose-600 select-all">{p.id}</span>
                                    <span className="text-[8px] font-bold text-secondary">{p.date}</span>
                                  </div>
                                  <p className="text-[10.5px] font-medium text-secondary truncate max-w-[150px]">
                                    {p.commodity} • {p.qty} QTLS
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded font-mono">
                                    {p.daysOld} Days Overdue
                                  </span>
                                  <p className="text-[10.5px] font-mono font-black text-on-surface mt-1">
                                    ₹ {formatINR(p.total)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="text-xs font-bold text-on-surface">Employee Account Active</p>
                      <p className="text-[10px] text-secondary max-w-xs mx-auto">No personal outstanding trade orders or payment ledgers are mapped to regional staff profiles.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* CREATE NEW STAKEHOLDER MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-outline-variant/30 font-sans"
            >
              <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Onboard Stakeholder ({newUser.category})</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStakeholder} className="p-8 grid grid-cols-2 gap-6">
                {/* Entity Category Selector */}
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Directory Category</label>
                  <div className="flex border border-outline-variant/30 rounded-xl overflow-hidden">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setNewUser({...newUser, category: tab.id as Category})}
                        className={cn(
                          "flex-1 py-3 text-xs font-extrabold uppercase transition-all tracking-wider",
                          newUser.category === tab.id
                            ? "bg-primary text-white"
                            : "bg-surface text-secondary hover:bg-surface-container-low"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Legal Name / Entity</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. RELIANCE AGRI HUB" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Email ID</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline select-none mt-px" />
                    <input 
                      required
                      type="email" 
                      placeholder="contact@entity.com" 
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline select-none mt-px" />
                    <input 
                      required
                      type="text" 
                      placeholder="98XXXXXXXX" 
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                </div>

                {newUser.category === 'employees' ? (
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Designation / Role</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. QC Lead" 
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Contact Person</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Full Name" 
                        value={newUser.contact}
                        onChange={(e) => setNewUser({...newUser, contact: e.target.value})}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">GSTIN Number</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. 29AAAAA1111A1Z1" 
                        value={newUser.gstin}
                        onChange={(e) => setNewUser({...newUser, gstin: e.target.value.toUpperCase()})}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-mono"
                      />
                    </div>

                    {newUser.category === 'buyers' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Road</label>
                        <input 
                          type="text" 
                          placeholder="e.g. APMC Lane" 
                          value={newUser.road || ''}
                          onChange={(e) => setNewUser({...newUser, road: e.target.value})}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                        />
                      </div>
                    )}

                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Registered Address</label>
                      <textarea 
                        required
                        rows={2}
                        placeholder="Complete billing and shipping address..." 
                        value={newUser.address}
                        onChange={(e) => setNewUser({...newUser, address: e.target.value})}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold leading-normal outline-none font-sans"
                      />
                    </div>

                    {newUser.category === 'buyers' && (
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1 font-sans">Credit Appraisal Allowance</label>
                        <input 
                          type="text" 
                          placeholder="e.g. ₹ 75.0 Lakh" 
                          value={newUser.credit}
                          onChange={(e) => setNewUser({...newUser, credit: e.target.value})}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="col-span-2 pt-4">
                  <button 
                    type="submit" 
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    Onboard Asset to Directory
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-surface dark:bg-neutral-900 border border-outline-variant/40 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 font-sans"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-on-surface uppercase">Delete Stakeholder</h3>
                  <p className="text-xs text-secondary font-medium">This action will remove the stakeholder from the registry.</p>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-1.5">
                <p className="text-[11px] text-secondary font-medium">Are you sure you want to permanently delete this {userToDelete.category.slice(0, -1)}?</p>
                <p className="text-sm font-black text-on-surface uppercase tracking-tight">{userToDelete.name}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-mono font-bold text-outline uppercase bg-surface-container px-2 py-0.5 rounded-md">ID: {userToDelete.id}</span>
                  <span className="text-[10px] font-bold text-secondary uppercase bg-primary/5 px-2 py-0.5 rounded-md text-primary">{userToDelete.category}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-3 bg-surface-container hover:bg-neutral-200 dark:hover:bg-neutral-800 text-on-surface font-bold text-xs rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStakeholder(userToDelete.id, userToDelete.category, userToDelete.name)}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete User
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING SUCCESS TOAST */}
      <AnimatePresence>
        {deleteToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-outline-variant/30 font-sans text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{deleteToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
