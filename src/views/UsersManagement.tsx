import { 
  ShieldCheck, 
  UserPlus, 
  Mail, 
  MapPin, 
  Building2, 
  UserCircle, 
  Briefcase, 
  X, 
  Phone, 
  AlertCircle, 
  Edit2, 
  Save, 
  CheckCircle2, 
  Info,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Lock,
  Users,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection, auth, setCollectionDoc, deleteCollectionDoc } from '../lib/firebase';
import { manageEmployeeServer } from '../lib/auth';
import ExcelMerchantImportModal from '../components/ExcelMerchantImportModal';

type Category = 'suppliers' | 'buyers' | 'employees';

const initialStakeholders = {
  suppliers: [],
  buyers: [],
  employees: [
    { id: 'EMP-01', name: 'Vikram Singh', role: 'Regional Manager', email: 'v.singh@riceaggregator.com', status: 'On Duty', address: 'Punjab Hub' },
    { id: 'EMP-02', name: 'Ananya Sharma', role: 'Procurement Officer', email: 'a.sharma@riceaggregator.com', status: 'Remote', address: 'HQ Office' },
    { id: 'EMP-03', name: 'Sarah Joseph', role: 'Logistics Analyst', email: 's.joseph@riceaggregator.com', status: 'On Duty', address: 'Bangalore Office' }
  ]
};

export default function UsersManagement() {
  const [activeTab, setActiveTab] = useState<Category>('buyers');
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [stakeholders, setStakeholders] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('stakeholders_v2');
      const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');

      if (saved) {
        const parsed = JSON.parse(saved);
        const suppliersList = Array.isArray(parsed.suppliers) && parsed.suppliers.length > 0 
          ? parsed.suppliers 
          : (Array.isArray(regSuppliers) ? regSuppliers : []);
        const buyersList = Array.isArray(parsed.buyers) ? parsed.buyers : [];

        return {
          suppliers: suppliersList,
          buyers: buyersList,
          employees: Array.isArray(parsed.employees) ? parsed.employees : initialStakeholders.employees
        };
      } else if (Array.isArray(regSuppliers) && regSuppliers.length > 0) {
        return {
          suppliers: regSuppliers,
          buyers: [],
          employees: initialStakeholders.employees
        };
      }
    } catch {}
    return initialStakeholders;
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

  // Password visibility controls for employee management
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

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
    username: '',
    password: '',
    category: 'buyers' as Category
  });

  // Buyer filter: 'all' | 'pending' | 'active'
  const [buyerFilter, setBuyerFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load registered profiles from Firestore stakeholders and local registration requests
  const syncRegisteredCloudStakeholders = async () => {
    try {
      const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
      const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      // Clean legacy placeholder ids 'sup-01' and 'buy-01' so real stakeholders are never suppressed
      const cleanedDeletedIds = deletedIds.filter(id => {
        const n = String(id).trim().toLowerCase().replace(/^#/, '');
        return n !== 'sup-01' && n !== 'buy-01';
      });
      if (cleanedDeletedIds.length !== deletedIds.length) {
        localStorage.setItem('deleted_stakeholder_ids', JSON.stringify(cleanedDeletedIds));
      }
      const deletedSet = new Set(cleanedDeletedIds.map(id => String(id).trim().toLowerCase().replace(/^#/, '')));

      // Also read local buyer registration requests, registered suppliers, and legacy stakeholders
      const localBuyerRequests = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
      const localSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
      const localStakeholdersRaw = localStorage.getItem('stakeholders');
      let localLegacyStakeholders: any[] = [];
      if (localStakeholdersRaw) {
        try {
          const parsed = JSON.parse(localStakeholdersRaw);
          if (Array.isArray(parsed)) localLegacyStakeholders = parsed;
          else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.suppliers)) localLegacyStakeholders.push(...parsed.suppliers);
            if (Array.isArray(parsed.buyers)) localLegacyStakeholders.push(...parsed.buyers);
          }
        } catch {}
      }

      const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
      const cloudSuppliers = await getCollectionDocs('suppliers').catch(() => []);
      const cloudBuyerRequests = await getCollectionDocs('buyer_registration_requests').catch(() => []);

      const combinedStakeholders = [
        ...cloudStakeholders,
        ...cloudSuppliers,
        ...cloudBuyerRequests,
        ...localBuyerRequests,
        ...localSuppliers,
        ...localLegacyStakeholders
      ];

      if (combinedStakeholders.length > 0) {
        setStakeholders((prev: any) => {
          const buyers = [...(prev.buyers || [])];
          const suppliers = [...(prev.suppliers || [])];
          const employees = [...(prev.employees || [])];

          combinedStakeholders.forEach((cs: any) => {
            if (!cs || (!cs.id && !cs.name)) return;
            const normId = String(cs.id || '').trim().toLowerCase().replace(/^#/, '');
            if (normId && deletedSet.has(normId)) {
              return; // Skip deleted stakeholder
            }

            const rawType = String(cs.type || cs.category || cs.role || '').toLowerCase();
            const idUpper = String(cs.id || '').toUpperCase();

            const isSupplier = rawType === 'suppliers' || rawType === 'supplier' || idUpper.startsWith('SUP') || idUpper.startsWith('CLD-SUP');
            const isEmployee = rawType === 'employees' || rawType === 'employee' || idUpper.startsWith('EMP') || idUpper.startsWith('CLD-EMP');

            if (isSupplier) {
              const idx = suppliers.findIndex((s: any) => 
                (cs.id && s.id === cs.id) || 
                (cs.email && cs.email.trim() && s.email && s.email.trim().toLowerCase() === cs.email.trim().toLowerCase()) ||
                (cs.name && cs.name.trim() && s.name && s.name.trim().toLowerCase() === cs.name.trim().toLowerCase())
              );
              if (idx !== -1) {
                suppliers[idx] = { ...suppliers[idx], ...cs, type: 'suppliers' };
              } else {
                suppliers.push({ ...cs, id: cs.id || `SUP-${Date.now()}`, type: 'suppliers' });
              }
            } else if (isEmployee) {
              const idx = employees.findIndex((e: any) => 
                (cs.id && e.id === cs.id) || 
                (cs.email && cs.email.trim() && e.email && e.email.trim().toLowerCase() === cs.email.trim().toLowerCase()) ||
                (cs.username && e.username && cs.username.toLowerCase() === e.username.toLowerCase())
              );
              if (idx !== -1) {
                employees[idx] = { ...employees[idx], ...cs, type: 'employees' };
              } else {
                employees.push({ ...cs, id: cs.id || `EMP-${Date.now()}`, type: 'employees' });
              }
            } else {
              // Buyers
              const idx = buyers.findIndex((b: any) => 
                (cs.id && b.id === cs.id) || 
                (cs.email && cs.email.trim() && b.email && b.email.trim().toLowerCase() === cs.email.trim().toLowerCase()) ||
                (cs.name && cs.name.trim() && b.name && b.name.trim().toLowerCase() === cs.name.trim().toLowerCase())
              );
              if (idx !== -1) {
                buyers[idx] = { ...buyers[idx], ...cs, type: 'buyers' };
              } else {
                buyers.unshift({ ...cs, id: cs.id || `BUY-${Date.now()}`, type: 'buyers' });
              }
            }
          });

          const synced = { buyers, suppliers, employees };
          try {
            localStorage.setItem('stakeholders_v2', JSON.stringify(synced));
            if (suppliers.length > 0) {
              localStorage.setItem('registered_suppliers', JSON.stringify(suppliers));
            }
          } catch (e) {}

          return synced;
        });
      }
    } catch (err) {
      console.warn('Error loading stakeholders collection:', err);
    }
  };

  const handleApproveBuyer = (buyer: any) => {
    if (!buyer) return;
    const updatedBuyers = (stakeholders.buyers || []).map((b: any) => {
      if (b.id === buyer.id) {
        return { 
          ...b, 
          status: 'Active', 
          credit: b.credit || '₹ 50.0 Lakh',
          approvedAt: new Date().toISOString() 
        };
      }
      return b;
    });

    const updatedStakeholders = { ...stakeholders, buyers: updatedBuyers };
    setStakeholders(updatedStakeholders);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updatedStakeholders));

    // Update in buyer_registration_requests
    try {
      const localReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
      const updatedReqs = localReqs.map((r: any) => r.id === buyer.id ? { ...r, status: 'Active' } : r);
      localStorage.setItem('buyer_registration_requests', JSON.stringify(updatedReqs));
    } catch {}

    // Cloud sync
    setCollectionDoc('stakeholders', buyer.id, { 
      ...buyer, 
      status: 'Active', 
      credit: buyer.credit || '₹ 50.0 Lakh',
      approvedAt: new Date().toISOString(), 
      type: 'buyers' 
    }).catch(() => {});
    setCollectionDoc('buyer_registration_requests', buyer.id, { 
      ...buyer, 
      status: 'Active', 
      approvedAt: new Date().toISOString() 
    }).catch(() => {});

    if (selectedUser && selectedUser.id === buyer.id) {
      setSelectedUser({ ...selectedUser, status: 'Active', credit: selectedUser.credit || '₹ 50.0 Lakh' });
    }

    setActionSuccessMsg(`Approved buyer ${buyer.name}! Account is now Active.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: 'buyers', user: { ...buyer, status: 'Active' } } }));
  };

  const handleRejectBuyer = (buyerId: string) => {
    const updatedBuyers = (stakeholders.buyers || []).filter((b: any) => b.id !== buyerId);
    const updatedStakeholders = { ...stakeholders, buyers: updatedBuyers };
    setStakeholders(updatedStakeholders);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updatedStakeholders));

    try {
      const localReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
      const updatedReqs = localReqs.filter((r: any) => r.id !== buyerId);
      localStorage.setItem('buyer_registration_requests', JSON.stringify(updatedReqs));
    } catch {}

    deleteCollectionDoc('buyer_registration_requests', buyerId).catch(() => {});

    if (selectedUser && selectedUser.id === buyerId) {
      setSelectedUser(null);
    }

    setActionSuccessMsg(`Buyer registration request rejected.`);
    setTimeout(() => setActionSuccessMsg(null), 3000);

    window.dispatchEvent(new Event('storage'));
  };

  const handleImportMerchantsComplete = (imported: any[], mode: 'merge' | 'replace') => {
    setStakeholders((prev: any) => {
      let nextBuyers: any[] = [];
      if (mode === 'replace') {
        nextBuyers = imported;
      } else {
        const existing = [...(prev.buyers || [])];
        imported.forEach((imp: any) => {
          const idx = existing.findIndex((e: any) => 
            (e.id && e.id === imp.id) || 
            (e.name && e.name.toLowerCase().trim() === imp.name.toLowerCase().trim()) ||
            (e.gstin && imp.gstin && e.gstin.toLowerCase().trim() === imp.gstin.toLowerCase().trim())
          );
          if (idx !== -1) {
            existing[idx] = { ...existing[idx], ...imp };
          } else {
            existing.push(imp);
          }
        });
        nextBuyers = existing;
      }

      const updated = {
        ...prev,
        buyers: nextBuyers
      };

      try {
        localStorage.setItem('stakeholders_v2', JSON.stringify(updated));
      } catch (e) {}

      // Gentle background cloud sync in small batches to preserve browser responsiveness
      setTimeout(async () => {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < imported.length; i += CHUNK_SIZE) {
          const chunk = imported.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(m => setCollectionDoc('stakeholders', m.id, m).catch(() => {}))
          );
          await new Promise(r => setTimeout(r, 100));
        }
      }, 500);

      setActionSuccessMsg(`Successfully imported ${imported.length} buyers! Total buyers: ${nextBuyers.length}`);
      setTimeout(() => setActionSuccessMsg(null), 5000);

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: 'buyers' } }));

      return updated;
    });
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

            let shouldOverwrite = false;
            if (!isLocalReal && isCloudReal) {
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
    
    // Calculate next sequential ID safely based on maximum existing numerical suffix
    const existingList = stakeholders[newUser.category] || [];
    let nextNum = 1;
    existingList.forEach((item: any) => {
      const match = String(item?.id || '').match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }
    });
    const id = `${prefix}-${nextNum.toString().padStart(2, '0')}`;

    // Ensure the new ID is not blocked by stale deleted_stakeholder_ids
    try {
      const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
      if (rawDeleted) {
        const deletedIds: string[] = JSON.parse(rawDeleted);
        const normNewId = id.trim().toLowerCase().replace(/^#/, '');
        const cleaned = deletedIds.filter(d => String(d).trim().toLowerCase().replace(/^#/, '') !== normNewId);
        localStorage.setItem('deleted_stakeholder_ids', JSON.stringify(cleaned));
      }
    } catch (e) {}
    
    const isEmployee = newUser.category === 'employees';
    const generatedUsername = (newUser.username || '').trim().toLowerCase() || newUser.name.trim().toLowerCase().replace(/\s+/g, '_');
    const assignedPassword = (newUser.password || '').trim() || 'emp1977';

    if (isEmployee) {
      // Securely hash and store credentials on the Express server
      manageEmployeeServer('create', {
        id,
        name: newUser.name,
        username: generatedUsername,
        password: assignedPassword,
        role: newUser.role || 'Operations Staff',
        email: newUser.email ? newUser.email.trim() : `${generatedUsername}@riceaggregator.com`
      }).catch(err => console.warn('Error syncing employee credentials to server:', err));
    }

    const entry = {
      id,
      name: newUser.name,
      email: newUser.email ? newUser.email.trim() : '',
      phone: newUser.phone,
      gstin: newUser.gstin || 'N/A',
      address: newUser.address || (isEmployee ? 'Tejas Canvassing Operations' : ''),
      road: newUser.category === 'buyers' ? (newUser.road || '') : undefined,
      status: isEmployee ? 'On Duty' : 'Active',
      type: newUser.category,
      ...(isEmployee ? { 
        role: newUser.role || 'Operations Staff',
        username: generatedUsername,
        password: assignedPassword,
        assignedPassword: assignedPassword,
      } : { 
        contact: newUser.contact 
      }),
      ...(newUser.category === 'buyers' ? { credit: newUser.credit || '₹ 50.0 Lakh' } : {})
    };

    const updated = {
      ...stakeholders,
      [newUser.category]: [entry, ...(stakeholders[newUser.category] || [])]
    };
    setStakeholders(updated);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updated));

    if (newUser.category === 'suppliers') {
      try {
        const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
        const updatedReg = [entry, ...regSuppliers.filter((s: any) => s.id !== id && s.name !== entry.name)];
        localStorage.setItem('registered_suppliers', JSON.stringify(updatedReg));
      } catch (e) {}
    }

    // Sync sanitized stakeholder profile to Firestore cloud storage (never store plain passwords in cloud)
    const { password: _p, assignedPassword: _ap, ...cloudStakeholder } = entry as any;
    setCollectionDoc('stakeholders', entry.id, { ...cloudStakeholder, type: newUser.category }).catch(err => {
      console.error("Error creating stakeholder in cloud:", err);
    });

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: newUser.category, user: entry } }));

    setActionSuccessMsg(`${newUser.category === 'suppliers' ? 'Supplier' : newUser.category === 'buyers' ? 'Buyer' : 'Staff'} "${newUser.name}" successfully onboarded!`);
    setTimeout(() => setActionSuccessMsg(null), 4000);

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
      username: '',
      password: '',
      category: newUser.category
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const isEmployee = activeTab === 'employees';
    const userToSave: any = {
      ...selectedUser,
      email: selectedUser.email ? selectedUser.email.trim() : '',
      ...(isEmployee ? {
        username: (selectedUser.username || '').trim().toLowerCase() || selectedUser.name.trim().toLowerCase().replace(/\s+/g, '_'),
        role: (selectedUser.role || '').trim() || 'Staff'
      } : {})
    };

    if (isEmployee) {
      if (selectedUser.password) {
        userToSave.password = selectedUser.password;
        userToSave.assignedPassword = selectedUser.password;
      }
      manageEmployeeServer('update', {
        id: selectedUser.id,
        name: userToSave.name,
        username: userToSave.username,
        password: selectedUser.password || userToSave.password || 'emp1977',
        role: userToSave.role,
        email: userToSave.email,
        phone: userToSave.phone
      }).catch(err => console.warn('Error updating employee credentials on server:', err));
    }

    const previousUser = (stakeholders[activeTab] || []).find((item: any) => item.id === selectedUser.id);
    const oldName = previousUser?.name?.trim();
    const newName = userToSave.name?.trim();

    const currentList = stakeholders[activeTab] || [];
    const updatedList = currentList.map((item: any) => {
      if (item.id === userToSave.id) {
        return userToSave;
      }
      return item;
    });
    const updatedStakeholders = {
      ...stakeholders,
      [activeTab]: updatedList
    };
    setStakeholders(updatedStakeholders);
    setSelectedUser(userToSave);
    localStorage.setItem('stakeholders_v2', JSON.stringify(updatedStakeholders));

    // Sync to Firestore cloud storage (never store plain passwords in cloud)
    const { password: _p, assignedPassword: _ap, ...cloudUserToSave } = userToSave as any;
    setCollectionDoc('stakeholders', userToSave.id, { ...cloudUserToSave, type: activeTab }).catch(err => {
      console.error("Error updating stakeholder in cloud:", err);
    });

    // If a supplier was renamed, propagate the new supplier name to all associated products in product_inventory
    if (activeTab === 'suppliers') {
      try {
        const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
        const updatedReg = regSuppliers.map((s: any) => s.id === userToSave.id ? userToSave : s);
        localStorage.setItem('registered_suppliers', JSON.stringify(updatedReg));
      } catch (e) {}
    }

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

    if (category === 'suppliers') {
      try {
        const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
        const updatedReg = regSuppliers.filter((s: any) => s.id !== userId);
        localStorage.setItem('registered_suppliers', JSON.stringify(updatedReg));
      } catch (e) {}
    }

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
        deleteCollectionDoc('stakeholders_v2', rawId)
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
  }, [selectedUser, allOrders, allArrivals]);

  const pendingBuyerCount = (stakeholders.buyers || []).filter(
    (b: any) => b && (b.status === 'Pending Approval' || b.status === 'pending')
  ).length;

  const stakeholderStats = React.useMemo(() => {
    const buyers = stakeholders.buyers || [];
    const suppliers = stakeholders.suppliers || [];
    const employees = stakeholders.employees || [];
    const total = buyers.length + suppliers.length + employees.length;
    const activeBuyers = buyers.filter((b: any) => b && b.status !== 'Pending Approval' && b.status !== 'pending').length;
    const pending = buyers.filter((b: any) => b && (b.status === 'Pending Approval' || b.status === 'pending')).length;
    return {
      total,
      buyersCount: buyers.length,
      activeBuyers,
      pendingBuyers: pending,
      suppliersCount: suppliers.length,
      employeesCount: employees.length
    };
  }, [stakeholders]);

  const tabs = [
    { 
      id: 'buyers', 
      label: 'Buyers', 
      icon: UserCircle,
      badge: pendingBuyerCount > 0 ? `${pendingBuyerCount} Pending` : null
    },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'employees', label: 'Employees', icon: Briefcase },
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, buyerFilter, tableSearch]);

  const filteredItems = (stakeholders[activeTab] || []).filter((item: any) => {
    if (!item) return false;
    if (activeTab === 'buyers') {
      if (buyerFilter === 'pending') {
        return item.status === 'Pending Approval' || item.status === 'pending';
      }
      if (buyerFilter === 'active') {
        return item.status !== 'Pending Approval' && item.status !== 'pending';
      }
    }
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      const name = String(item.name || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const gstin = String(item.gstin || '').toLowerCase();
      const road = String(item.road || '').toLowerCase();
      const address = String(item.address || '').toLowerCase();
      const phone = String(item.phone || item.mobile || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const mandi = String(item.mandi || '').toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        gstin.includes(q) ||
        road.includes(q) ||
        address.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        mandi.includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* Toast Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
            Relationship Registry
          </span>
          <h1 className="text-3xl font-black tracking-tight mt-1 text-on-surface">Stakeholder Directory</h1>
          <p className="text-secondary text-sm font-medium mt-1">Manage institutional profiles, active supplier GSTIN credentials, and buyer billing properties.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsExcelImportOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-variant rounded-xl shadow-sm hover:border-primary/40 active:scale-95 transition-all text-xs font-black uppercase tracking-widest cursor-pointer btn-tactile"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Import from Excel
          </button>
          <button 
            onClick={() => { setNewUser(prev => ({ ...prev, category: activeTab })); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-xs font-black uppercase tracking-widest cursor-pointer btn-tactile"
          >
            <UserPlus className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>
      </div>

      {/* 4 Floating Hero Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Total Stakeholders</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-on-surface">{stakeholderStats.total}</span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Full Network
            </span>
          </div>
          <p className="text-[11px] text-secondary mt-1">Institutional rice ecosystem</p>
        </div>

        <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Registered Buyers</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <UserCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-on-surface">{stakeholderStats.buyersCount}</span>
            {stakeholderStats.pendingBuyers > 0 ? (
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                {stakeholderStats.pendingBuyers} Pending
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                All Verified
              </span>
            )}
          </div>
          <p className="text-[11px] text-secondary mt-1">Wholesale trading entities</p>
        </div>

        <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Suppliers & Mills</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-on-surface">{stakeholderStats.suppliersCount}</span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Ex-Mill Partners
            </span>
          </div>
          <p className="text-[11px] text-secondary mt-1">Verified APMC milling units</p>
        </div>

        <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Operations Team</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-on-surface">{stakeholderStats.employeesCount}</span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              On Duty
            </span>
          </div>
          <p className="text-[11px] text-secondary mt-1">Logistics & admin staff</p>
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
              "flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-all btn-tactile cursor-pointer",
              activeTab === tab.id 
                ? "border-primary text-primary" 
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <tab.icon className="w-4 h-3.5" />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-stone-950 animate-pulse">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Buyer Alert Banner */}
      {activeTab === 'buyers' && pendingBuyerCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
            </span>
            <div>
              <p className="text-xs font-black uppercase text-amber-900 dark:text-amber-200">
                {pendingBuyerCount} New Buyer Registration Request{pendingBuyerCount > 1 ? 's' : ''} Awaiting Review
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                Buyers who registered online need admin verification before order dispatches can proceed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBuyerFilter('pending')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                buyerFilter === 'pending'
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/30"
              )}
            >
              Filter Pending ({pendingBuyerCount})
            </button>
            {buyerFilter === 'pending' && (
              <button
                onClick={() => setBuyerFilter('all')}
                className="text-xs text-amber-800 dark:text-amber-300 underline font-bold cursor-pointer"
              >
                Show All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-Filters for Wholesale Buyers */}
      {activeTab === 'buyers' && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setBuyerFilter('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              buyerFilter === 'all'
                ? "bg-primary text-white shadow-xs"
                : "bg-surface-container text-secondary hover:text-on-surface"
            )}
          >
            All Buyers ({(stakeholders.buyers || []).length})
          </button>
          <button
            type="button"
            onClick={() => setBuyerFilter('pending')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              buyerFilter === 'pending'
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-surface-container text-secondary hover:text-on-surface",
              pendingBuyerCount > 0 && buyerFilter !== 'pending' && "text-amber-700 bg-amber-500/10 border border-amber-500/30"
            )}
          >
            <span>Pending Approval</span>
            {pendingBuyerCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black flex items-center justify-center">
                {pendingBuyerCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setBuyerFilter('active')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              buyerFilter === 'active'
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-surface-container text-secondary hover:text-on-surface"
            )}
          >
            Active & Approved ({(stakeholders.buyers || []).filter((b: any) => b.status !== 'Pending Approval' && b.status !== 'pending').length})
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        {/* Main Stakeholder Table */}
        <div className={cn(
          "col-span-12 transition-all duration-300",
          selectedUser ? "lg:col-span-7" : "lg:col-span-9"
        )}>
          <div className="floating-card liquid-glass rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm">
            {/* Table Search & Pagination Toolbar */}
            <div className="p-4 bg-surface-container-low/60 border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab} by name, GSTIN, road, phone...`}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface placeholder:text-secondary/50 font-bold outline-none focus:border-primary/50 transition-all"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-secondary font-bold">
                <span>{filteredItems.length} {activeTab}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-surface-container border border-outline-variant/30 rounded-lg px-2.5 py-1 text-xs font-bold text-on-surface outline-none cursor-pointer"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/20 text-[10px] font-black text-secondary uppercase tracking-widest">
                    <th className="p-5">Name / Legal Entity</th>
                    <th className="p-5">{activeTab === 'employees' ? 'Role & Assigned Login' : 'GSTIN & Address'}</th>
                    <th className="p-5">Communication Info</th>
                    {activeTab === 'buyers' && <th className="p-5">Status & Credit</th>}
                    <th className="p-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-secondary text-xs">
                        {tableSearch ? (
                          <div>
                            <p className="font-bold text-on-surface">No {activeTab} matched "{tableSearch}"</p>
                            <button 
                              onClick={() => setTableSearch('')}
                              className="text-primary text-xs underline mt-1.5 cursor-pointer font-bold"
                            >
                              Clear Search
                            </button>
                          </div>
                        ) : activeTab === 'buyers' ? (
                          <div className="space-y-3">
                            <p className="font-bold text-on-surface text-sm">No buyers currently registered in directory</p>
                            <p className="text-[11px] text-secondary max-w-sm mx-auto">
                              You can import all 547 Mandi Buyers from your Excel workbook or preloaded directory.
                            </p>
                            <button
                              onClick={() => setIsExcelImportOpen(true)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-md hover:opacity-90"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                              Import Mandi Directory
                            </button>
                          </div>
                        ) : (
                          <p className="font-bold">No {activeTab} found.</p>
                        )}
                      </td>
                    </tr>
                  )}
                  {paginatedItems.map((item: any) => (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        setSelectedUser(item);
                        setIsEditing(false);
                      }}
                      className={cn(
                        "interactive-tr group cursor-pointer",
                        selectedUser?.id === item.id ? "bg-primary/[0.04] border-l-4 border-l-primary" : "",
                        (item.status === 'Pending Approval' || item.status === 'pending') && "bg-amber-500/[0.03]"
                      )}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border group-hover:scale-105 transition-transform",
                            (item.status === 'Pending Approval' || item.status === 'pending')
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : "bg-primary/5 text-primary border-primary/10"
                          )}>
                            {item.name.replace(/[^\w\s]/g, '').split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'SH'}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-on-surface leading-tight uppercase">{item.name}</p>
                            <p className="text-[10px] text-secondary/60 font-bold tracking-wider mt-0.5 font-mono">{item.id}</p>
                            {activeTab === 'buyers' && (
                              <div className="mt-1">
                                {item.status === 'Pending Approval' || item.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                                    Awaiting Approval
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Active
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-5 text-xs">
                        {activeTab === 'employees' ? (
                          <div className="space-y-1">
                            <span className="font-extrabold text-primary block">{item.role || 'Operations Staff'}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                                <Key className="w-2.5 h-2.5" />
                                @{item.username || item.name.toLowerCase().replace(/\s+/g, '_')}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                <Lock className="w-2.5 h-2.5" />
                                Password Set
                              </span>
                            </div>
                          </div>
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
                        {item.phone && (
                          <div className="flex items-center gap-1.5 font-bold">
                            <Phone className="w-3.5 h-3.5 opacity-50" />
                            <span className="font-mono text-on-surface">{item.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 font-bold">
                          <Mail className="w-3.5 h-3.5 opacity-50" />
                          <span>{item.email || (activeTab === 'employees' ? <span className="text-secondary/50 font-normal italic">Email not assigned</span> : 'N/A')}</span>
                        </div>
                      </td>

                      {activeTab === 'buyers' && (
                        <td className="p-5">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full block text-center">
                              {item.credit || '₹ 50.0 L'}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {activeTab === 'buyers' && (item.status === 'Pending Approval' || item.status === 'pending') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveBuyer(item);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="Approve Buyer Registration"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(item);
                              setIsEditing(true);
                            }}
                            className="p-2 hover:bg-surface-container rounded-lg transition-colors flex items-center justify-center text-secondary hover:text-primary cursor-pointer btn-tactile"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete({ id: item.id, name: item.name, category: activeTab });
                            }}
                            className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center justify-center text-secondary hover:text-rose-600 cursor-pointer btn-tactile"
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
            {/* Pagination Controls & Total Footer */}
            <div className="p-3.5 bg-surface-container-low/40 border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-secondary">
              <div>
                {filteredItems.length > 0 ? (
                  <span>
                    Showing <span className="text-on-surface font-mono">{(currentPage - 1) * pageSize + 1}</span> - <span className="text-on-surface font-mono">{Math.min(currentPage * pageSize, filteredItems.length)}</span> of <span className="text-on-surface font-mono">{filteredItems.length}</span> {activeTab}
                  </span>
                ) : (
                  <span>0 {activeTab} listed</span>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="text-on-surface font-mono font-bold px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
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
              className="floating-card bg-surface border border-outline-variant/30 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
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
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">
                      {activeTab === 'employees' ? 'Staff Full Name' : 'Legal Entity Name'}
                    </label>
                    <input 
                      required
                      type="text" 
                      value={selectedUser.name}
                      onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold outline-none font-sans"
                    />
                  </div>

                  {activeTab === 'employees' && (
                    <div className="p-3.5 bg-primary/5 rounded-2xl border border-primary/15 space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <Key className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Employee Portal Credentials</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Assigned Login Username</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary font-mono font-bold text-xs">@</span>
                          <input 
                            required
                            type="text" 
                            placeholder="e.g. vikram_singh"
                            value={selectedUser.username || ''}
                            onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                            className="w-full bg-surface-container border border-outline-variant/40 rounded-xl pl-8 pr-4 py-2.5 text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <p className="text-[9px] text-secondary/70">Used by the employee to log in to the canvassing portal.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-secondary">Assigned Login Password</label>
                        <div className="relative">
                          <input 
                            required
                            type={showEditPassword ? "text" : "password"} 
                            placeholder="Assign password (e.g. emp1977)"
                            value={selectedUser.password !== undefined ? selectedUser.password : (selectedUser.assignedPassword || '')}
                            onChange={(e) => setSelectedUser({...selectedUser, password: e.target.value, assignedPassword: e.target.value})}
                            className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 pr-10 py-2.5 text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface"
                          >
                            {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">
                      {activeTab === 'employees' ? 'Email Address (Optional)' : 'Email Address'}
                    </label>
                    <input 
                      required={activeTab !== 'employees'}
                      type="email" 
                      placeholder={activeTab === 'employees' ? 'Optional (Not required for employee login)' : 'contact@entity.com'}
                      value={selectedUser.email || ''}
                      onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-bold font-mono outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-secondary">
                      {activeTab === 'employees' ? 'Contact Mobile Phone' : 'Phone Number'}
                    </label>
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
                        placeholder="e.g. Quality Control Lead / Field Officer"
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
                  {/* Pending Approval Action Card for Buyers */}
                  {activeTab === 'buyers' && (selectedUser.status === 'Pending Approval' || selectedUser.status === 'pending') && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wide">New Buyer Registration - Action Needed</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-relaxed">
                        This wholesale buyer registered through the portal. Approve this account to activate their default credit line (₹ 50.0 Lakh) and allow immediate trading.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleApproveBuyer(selectedUser)}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve Account
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectBuyer(selectedUser.id)}
                          className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

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

                    <div className="p-3 bg-surface-container-low rounded-2xl space-y-2.5 border border-outline-variant/20 text-[10.5px]">
                      {activeTab === 'employees' && (
                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/15 space-y-2 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-primary font-black uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                              <Key className="w-3 h-3" />
                              Portal Login Credentials
                            </span>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                              Active Staff Account
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-primary/10">
                            <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Username:</span>
                            <span className="font-mono font-black text-primary text-xs">
                              @{selectedUser.username || selectedUser.name?.toLowerCase().replace(/\s+/g, '_')}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Password:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-on-surface text-xs">
                                •••••••• (Encrypted)
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                                Secure PBKDF2
                              </span>
                            </div>
                          </div>

                          {selectedUser.role && (
                            <div className="flex justify-between items-center pt-1 border-t border-primary/10">
                              <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Designation:</span>
                              <span className="font-bold text-on-surface">{selectedUser.role}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedUser.phone && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Contact Phone:</span>
                          <span className="font-mono font-bold text-on-surface">{selectedUser.phone}</span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-secondary font-black uppercase text-[8px] tracking-wider">Email Address:</span>
                        <span className={cn("font-mono font-bold", selectedUser.email ? "text-[#0091ff]" : "text-secondary/50 font-normal italic")}>
                          {selectedUser.email || (activeTab === 'employees' ? 'Not required for staff' : 'N/A')}
                        </span>
                      </div>

                      {activeTab !== 'employees' && selectedUser.gstin && selectedUser.gstin !== 'N/A' && (
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
                      {activeTab !== 'employees' && selectedUser.pan && (
                        <div className="flex justify-between">
                          <span className="text-secondary font-black uppercase text-[8px] tracking-wider">PAN Card:</span>
                          <span className="font-mono font-bold text-on-surface">{selectedUser.pan}</span>
                        </div>
                      )}
                      {activeTab !== 'employees' && selectedUser.address && (
                        <div className="pt-1 border-t border-outline-variant/10">
                          <p className="text-secondary font-black uppercase text-[8px] tracking-wider mb-0.5">Address:</p>
                          <p className="text-on-surface/80 font-medium leading-normal">{selectedUser.address}</p>
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

              <form onSubmit={handleCreateStakeholder} className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">
                    {newUser.category === 'employees' ? 'Employee Staff Name' : 'Legal Name / Entity'}
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder={newUser.category === 'employees' ? 'e.g. Vikram Singh' : 'e.g. RELIANCE AGRI HUB'} 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">
                    {newUser.category === 'employees' ? 'Email ID (Optional)' : 'Email ID'}
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline select-none mt-px" />
                    <input 
                      required={newUser.category !== 'employees'}
                      type="email" 
                      placeholder={newUser.category === 'employees' ? 'Optional for staff' : 'contact@entity.com'} 
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">
                    {newUser.category === 'employees' ? 'Staff Contact Mobile' : 'Phone Number'}
                  </label>
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
                  <>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Designation / Role</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Quality Control Lead / Field Officer" 
                        value={newUser.role}
                        onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Assign Login Username</label>
                      <div className="relative group">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline select-none mt-px" />
                        <input 
                          type="text" 
                          placeholder="e.g. vikram_singh (auto if blank)" 
                          value={newUser.username}
                          onChange={(e) => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-xs font-bold font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-secondary px-1">Assign Login Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline select-none mt-px" />
                        <input 
                          type="text" 
                          placeholder="e.g. emp1977 (default: emp1977)" 
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-xs font-bold font-mono outline-none"
                        />
                      </div>
                    </div>
                  </>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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

      <ExcelMerchantImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImportComplete={handleImportMerchantsComplete}
        existingCount={stakeholders.buyers?.length || 0}
      />
    </div>
  );
}
