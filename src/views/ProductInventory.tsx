import { 
  Filter, 
  Search, 
  Plus, 
  Edit, 
  TrendingUp, 
  Package, 
  MapPin, 
  Check, 
  X, 
  FileSpreadsheet, 
  ArrowDownAZ, 
  ArrowUpZA, 
  Coins, 
  Percent, 
  Inbox,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Copy,
  Building2,
  ShoppingBag,
  ArrowUpRight,
  Share2,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import { getCollectionDocs, syncCollection, db, deleteCollectionDoc, setCollectionDoc } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import AdminBroadcastNoticeModal from '../components/AdminBroadcastNoticeModal';

const DEFAULT_SUPPLIERS: string[] = [];

// Products are strictly loaded from Firebase Firestore (product_inventory).
// No hardcoded or mock products are used.
const initialProducts: any[] = [];

const PRESET_GRAIN_IMAGES = [
  { label: 'Premium Sona Masoori Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOz5qOiTIVul9CR5oE14q5nszk1V5hX6LO1BlqBfqDPEX3K5oVnvONQXpQ47jbYfTH820mSETx41SM4t9HZJXQv_OjP5OeYgO-gUsr3WEKAx6HOrXgdMJ1ccjCOxrN6450eET-pDA0jXCMRum_L_20H0l9RkB8ViMzoa9O1xnt9qTcnAu0k5yAmZ-qiIAaztD1UJa0TiUVOrAb7w9N_qGxQILHklk-XFKkXHP8JBU3cNeRi84OX492lyKUdsJf12KwAL_hq6JvuOZj' },
  { label: 'Jasmine Rice Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-zw5USNmhSWJ7W6KYNTxtxlvbucTGBqM91aYmN9ZxAlgvZIBCtLu_HO1Y6j9huJHOUICTW230tfwmeYNZI89Quj-o1n6dnY7tVzThXMjnw50G_5ZUVyBb9v-fkOlF3OOsh5q8N6x1ZNmKG64sKYprqc-gQ5WdOd8ZKy7r_r44wx2qzB0srt6O205GYTyY5is626j2iSoylgKkn9ktJSrD1UhQuuITJU9Ka26Vej9j0oHRlpcaqL73YbujaFhOQ7Ly71Qt9ofGdr' },
  { label: 'Basmati Rice Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBm-XMaGdzxCjePQf6HZQOYwr69Zxd_uImfU8ASz83aco_TNkafvvB-t0733UI0fDTWC3wi9pQSVnG9w3qwPRkWNJtZFfCchbPI9xjyqSb9veIK4ypfBYDZwvKvlc9BKauhSKHl5r33cNwMa_vB5-KtU-2NWfwjBT2BBro7NA2hMwxtu9OaCg4Od4Gp0_NkBdnV_kOLR5mkQnZZdf9IJ8vI_GZT2CJ0DED3KfwlWc2HJooTd6KuSiu0vEWJXK80aG9OVARp4OxxFi52' }
];

export default function ProductInventory() {
  const [products, setProducts] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('product_inventory');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('product_inventory');
      if (raw && JSON.parse(raw).length > 0) return false;
    } catch {}
    return true;
  });
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [userRole, setUserRole] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userRole');
    }
    return null;
  });

  // Filter & Modal State
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('default');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Delete Confirmation Modal & Toast State
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Table row dropdown expansion & copy state
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [copiedProdId, setCopiedProdId] = useState<string | null>(null);

  const [suppliersList, setSuppliersList] = useState<string[]>(DEFAULT_SUPPLIERS);

  // Navigation Tab inside Inventory View: 'inventory' | 'merchant_control'
  const [activeInventoryTab, setActiveInventoryTab] = useState<'inventory' | 'merchant_control'>('inventory');

  // Dynamic Merchant Store Controls State

  const [adminHeroProductId, setAdminHeroProductId] = useState<string>(() => {
    return localStorage.getItem('tejas_hero_product_id') || '';
  });

  // Curated Store Categories state
  const [adminStoreCategories, setAdminStoreCategories] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tejas_store_categories');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'Basmati', name: 'Basmati Rice', description: 'Long grain aromatic aged rice', count: '12 Varieties', active: true },
      { id: 'Sona Masoori', name: 'Sona Masoori', description: 'Medium grain everyday staple', count: '8 Varieties', active: true },
      { id: 'IR64', name: 'IR64 Rice', description: 'Long grain parboiled & raw', count: '6 Varieties', active: true },
      { id: 'Ponni', name: 'Ponni Rice', description: 'South Indian favorite staple', count: '5 Varieties', active: true },
      { id: 'Parboiled', name: 'Parboiled Rice', description: 'Nutritious processed rice', count: '7 Varieties', active: true },
      { id: 'Broken', name: 'Broken Rice', description: 'Economical commercial grade', count: '4 Varieties', active: true }
    ];
  });

  // Merchant Complaints & Inquiries state
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);

  const loadComplaints = async () => {
    setIsLoadingComplaints(true);
    try {
      const docs = await getCollectionDocs('complaints').catch(() => []);
      if (Array.isArray(docs)) {
        setComplaintsList(docs.sort((a: any, b: any) => {
          const tA = new Date(a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt || 0).getTime();
          return tB - tA;
        }));
      }
    } catch (e) {
      console.warn("Failed to load complaints:", e);
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  const handleUpdateComplaintStatus = async (ticketId: string, newStatus: 'Pending' | 'In Progress' | 'Resolved') => {
    try {
      const updated = complaintsList.map(c => c.id === ticketId ? { ...c, status: newStatus } : c);
      setComplaintsList(updated);
      await setCollectionDoc('complaints', ticketId, { status: newStatus, lastUpdated: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    }
  };

  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Save all admin merchant view settings to Cloud & Local Storage
  const handlePublishMerchantControls = async () => {
    setIsPublishing(true);
    setPublishSuccessMsg('');

    try {
      // 1. Local storage sync
      localStorage.setItem('tejas_hero_product_id', adminHeroProductId);
      localStorage.setItem('tejas_store_categories', JSON.stringify(adminStoreCategories));

      // 2. Cloud sync to Firestore
      const storeConfigData = {
        id: 'main_config',
        heroProductId: adminHeroProductId,
        storeCategories: adminStoreCategories,
        updatedAt: new Date().toISOString()
      };
      await syncCollection('store_config', [storeConfigData]).catch(e => console.warn("Cloud store_config sync note:", e));

      // 3. Dispatch global events
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('store-config-updated'));

      setPublishSuccessMsg('Merchant View Controls successfully published live!');
      setTimeout(() => setPublishSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to publish merchant store settings:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: 'Sona Masoori',
    price: '',
    status: 'Active',
    image: PRESET_GRAIN_IMAGES[0].url,
    supplier: '',
    isBestSeller: false,
    promoBadge: ''
  });

  const handleRequestDelete = (product: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!product) return;
    setProductToDelete(product);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const targetProduct = productToDelete;
    const targetId = String(targetProduct.id || '').trim();
    const targetName = targetProduct.name || 'Product';
    setIsDeleting(true);

    try {
      // 1. Update deleted IDs in localStorage (store all variations: raw, normalized, lowercase, hash-prefixed)
      const rawDel = localStorage.getItem('deleted_product_inventory_ids') || '[]';
      let arr: string[] = [];
      try {
        arr = JSON.parse(rawDel);
      } catch (e) {
        arr = [];
      }
      const rawNorm = targetId.replace(/^#/, '');
      const variations = [
        targetId,
        rawNorm,
        `#${rawNorm}`,
        targetId.toLowerCase(),
        rawNorm.toLowerCase(),
        `#${rawNorm.toLowerCase()}`
      ];
      variations.forEach(v => {
        if (v && !arr.includes(v)) arr.push(v);
      });
      localStorage.setItem('deleted_product_inventory_ids', JSON.stringify(arr));

      // 2. Immediate optimistic state update
      const updated = products.filter(p => {
        if (!p) return false;
        const pid = String(p.id || '').trim().toLowerCase().replace(/^#/, '');
        const tid = rawNorm.toLowerCase();
        if (pid === tid) return false;
        if (p.id === targetId || p.id === rawNorm) return false;
        return true;
      });
      setProducts(updated);
      localStorage.setItem('product_inventory', JSON.stringify(updated));

      // 3. Close edit modal if open
      setIsEditModalOpen(false);
      setEditingProduct(null);

      // 4. Close delete confirmation modal
      setProductToDelete(null);

      // 5. Notify user
      setDeleteToast(`"${targetName}" was permanently removed from inventory.`);
      setTimeout(() => setDeleteToast(null), 4000);

      // 6. Broadcast storage update event to synchronise across all views/tabs
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { deletedId: targetId, name: targetName } }));

      // 7. Delete from Firestore asynchronously with hardened multi-key cleanup
      await deleteCollectionDoc('product_inventory', targetId);
    } catch (err) {
      console.error("Failed to delete product from database:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadInventory = async () => {
    let deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('deleted_product_inventory_ids');
      if (rawDel) {
        const arr = JSON.parse(rawDel);
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            const s = String(id).trim().toLowerCase();
            deletedSet.add(s);
            deletedSet.add(s.replace(/^#/, ''));
          });
        }
      }
    } catch (e) {}

    const isDeleted = (id: string) => {
      const s = String(id || '').trim().toLowerCase();
      if (s.startsWith('prod-')) return true; // Exclude all legacy mock products
      return deletedSet.has(s) || deletedSet.has(s.replace(/^#/, ''));
    };

    const rawLocal = localStorage.getItem('product_inventory');
    let local: any[] = [];
    if (rawLocal) {
      try {
        local = JSON.parse(rawLocal).filter((p: any) => p && p.id && !isDeleted(p.id));
      } catch (e) {
        local = [];
      }
    }

    setProducts(local);

    try {
      const data = await getCollectionDocs('product_inventory');
      if (Array.isArray(data)) {
        const validDocs = data.filter((p: any) => p && p.id && !isDeleted(p.id));
        const combinedMap = new Map();
        validDocs.forEach((p: any) => combinedMap.set(p.id, p));
        // Only merge local optimistic properties for items that actually exist in Firestore
        local.forEach((p: any) => {
          if (combinedMap.has(p.id)) {
            const existing = combinedMap.get(p.id) || {};
            combinedMap.set(p.id, { ...existing, ...p });
          }
        });
        const sorted = Array.from(combinedMap.values()).sort((a: any, b: any) => (a?.id || '').localeCompare(b?.id || ''));
        setProducts(sorted);
        localStorage.setItem('product_inventory', JSON.stringify(sorted));

        // Auto-select hero product if current is invalid
        setAdminHeroProductId(prev => {
          if (prev && sorted.some(p => p.id === prev)) return prev;
          return sorted[0]?.id || '';
        });
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load registered suppliers for dropdown
  useEffect(() => {
    async function loadSuppliers() {
      try {
        const rawDel = localStorage.getItem('deleted_stakeholder_ids');
        const deletedIds: string[] = rawDel ? JSON.parse(rawDel) : [];
        const deletedSet = new Set(
          deletedIds
            .map(id => String(id).trim().toLowerCase().replace(/^#/, ''))
            .filter(id => id !== 'sup-01' && id !== 'buy-01')
        );

        const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
        const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
        const cloudDocs = await getCollectionDocs('stakeholders').catch(() => []);

        const supSet = new Set<string>();
        if (cached && Array.isArray(cached.suppliers)) {
          cached.suppliers.forEach((s: any) => {
            if (s && s.name && !deletedSet.has(String(s.id || '').toLowerCase())) {
              supSet.add(s.name.trim());
            }
          });
        }
        if (Array.isArray(regSuppliers)) {
          regSuppliers.forEach((s: any) => {
            if (s && s.name && !deletedSet.has(String(s.id || '').toLowerCase())) {
              supSet.add(s.name.trim());
            }
          });
        }
        if (cloudDocs && cloudDocs.length > 0) {
          cloudDocs.forEach((d: any) => {
            if (!d || !d.name || deletedSet.has(String(d.id || '').toLowerCase())) return;
            const type = d.type || (d.id?.startsWith('SUP') ? 'suppliers' : 'buyers');
            if (type === 'suppliers') {
              supSet.add(d.name.trim());
            }
          });
        }
        const loadedList = Array.from(supSet).sort();
        setSuppliersList(loadedList);

        // Auto-assign primary supplier to products that have no supplier specified
        if (loadedList.length > 0) {
          const primarySup = loadedList[0];
          setProducts(prev => {
            let changed = false;
            const updated = prev.map(p => {
              if (!p) return p;
              const cur = (p.supplier || '').trim();
              if (!cur) {
                changed = true;
                return { ...p, supplier: primarySup };
              }
              return p;
            });
            if (changed) {
              try {
                localStorage.setItem('product_inventory', JSON.stringify(updated));
                const changedProds = updated.filter(p => p && p.supplier === primarySup);
                for (const cp of changedProds) {
                  setCollectionDoc('product_inventory', cp.id, cp).catch(() => {});
                }
              } catch (e) {}
            }
            return updated;
          });
        }
      } catch (e) {
        console.warn("Failed to load suppliers in ProductInventory:", e);
      }
    }
    loadSuppliers();

    const handleSupplierSync = () => {
      loadSuppliers();
    };

    window.addEventListener('storage', handleSupplierSync);
    window.addEventListener('stakeholders-updated', handleSupplierSync);
    return () => {
      window.removeEventListener('storage', handleSupplierSync);
      window.removeEventListener('stakeholders-updated', handleSupplierSync);
    };
  }, []);

  useEffect(() => {
    setUserRole(localStorage.getItem('userRole'));
    loadInventory();

    const handleSync = () => {
      loadInventory();
    };

    const handleGotoSearch = () => {
      const pendingQuery = sessionStorage.getItem('goto_search_query');
      if (pendingQuery) {
        setSearchQuery(pendingQuery);
        sessionStorage.removeItem('goto_search_query');
      }
    };
    handleGotoSearch(); // Run on mount
    window.addEventListener('goto-search-event', handleGotoSearch);
    window.addEventListener('storage', handleSync);
    window.addEventListener('inventory-updated', handleSync);
    return () => {
      window.removeEventListener('goto-search-event', handleGotoSearch);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('inventory-updated', handleSync);
    };
  }, []);

  const isEmployee = userRole === 'employee';

  const startEditing = (pId: string, field: string, value: any) => {
    if (isEmployee) return;
    setEditingCell({ id: pId, field });
    setEditValue(String(value));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    
    const parsedVal = editingCell.field === 'price' ? (parseFloat(editValue) || 0) : editValue;

    const updated = products.map(p => {
      if (p?.id === editingCell.id) {
        return { ...p, [editingCell.field]: parsedVal };
      }
      return p;
    });
    setProducts(updated);
    localStorage.setItem('product_inventory', JSON.stringify(updated));
    setEditingCell(null);

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { updatedProduct: editingCell } }));

    try {
      const editedItem = updated.find(p => p?.id === editingCell.id);
      if (editedItem) {
        await setCollectionDoc('product_inventory', editedItem.id, editedItem);
      }
    } catch (err) {
      console.error("Failed to sync edited product to database:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  // Filtered and Sorted list computation
  const processedProducts = useMemo(() => {
    let list = (products || []).filter(Boolean);

    // Status filter
    if (filterStatus !== 'All') {
      list = list.filter(p => p?.status === filterStatus);
    }

    // Brand filter
    if (filterBrand !== '') {
      list = list.filter(p => p?.brand === filterBrand);
    }

    // Keyword Search (Brand Name, Type, ID, Supplier)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p?.name && String(p.name).toLowerCase().includes(q)) || 
        (p?.brand && String(p.brand).toLowerCase().includes(q)) || 
        (p?.id && String(p.id).toLowerCase().includes(q)) ||
        (p?.supplier && String(p.supplier).toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortOrder === 'price_asc') {
      list.sort((a, b) => (parseFloat(a?.price) || 0) - (parseFloat(b?.price) || 0));
    } else if (sortOrder === 'price_desc') {
      list.sort((a, b) => (parseFloat(b?.price) || 0) - (parseFloat(a?.price) || 0));
    } else if (sortOrder === 'name_asc') {
      list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    }

    return list;
  }, [products, filterStatus, filterBrand, searchQuery, sortOrder]);

  // Unique brands list for filters
  const uniqueBrands = useMemo(() => {
    return Array.from(new Set((products || []).map(p => p?.brand).filter(Boolean)));
  }, [products]);

  // Pricing & Catalog statistics
  const inventoryStats = useMemo(() => {
    const total = (products || []).length;
    const active = (products || []).filter(p => p?.status === 'Active').length;
    const restocking = (products || []).filter(p => p?.status === 'Restocking').length;
    const suppliers = new Set((products || []).map(p => p?.supplier).filter(Boolean)).size;
    return { total, active, restocking, suppliers };
  }, [products]);

  const handleCopyProductSpec = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🌾 *${p.name}* (${p.brand})\n💰 Ex-Mill Rate: ₹${formatINR(p.price)}/Qtl\n🏭 Mill: ${p.supplier || suppliersList[0] || 'Direct Mill'}\n📦 Status: ${p.status}`;
    navigator.clipboard.writeText(text);
    setCopiedProdId(p.id);
    setTimeout(() => setCopiedProdId(null), 2500);
  };

  const averagePrice = useMemo(() => {
    if (!products || products.length === 0) return 0;
    const valid = products.filter(Boolean);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, p) => acc + (parseFloat(p?.price) || 0), 0);
    return Math.round(sum / valid.length);
  }, [products]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
    const product = {
      id,
      name: newProduct.name,
      brand: newProduct.brand || 'Premium Sella',
      category: newProduct.category || newProduct.brand || 'Sona Masoori',
      price: parseFloat(newProduct.price) || 4100.00,
      status: newProduct.status,
      image: newProduct.image,
      supplier: newProduct.supplier || (suppliersList[0] || ''),
      isBestSeller: !!newProduct.isBestSeller,
      promoBadge: newProduct.promoBadge || ''
    };

    const updated = [product, ...products];
    setProducts(updated);
    localStorage.setItem('product_inventory', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { newProduct: product } }));

    setIsAddModalOpen(false);
    setNewProduct({
      name: '',
      brand: '',
      category: 'Sona Masoori',
      price: '',
      status: 'Active',
      image: PRESET_GRAIN_IMAGES[0].url,
      supplier: suppliersList[0] || '',
      isBestSeller: false,
      promoBadge: ''
    });

    try {
      await setCollectionDoc('product_inventory', product.id, product);
    } catch (err) {
      console.error("Failed to Sync Added Product:", err);
    }
  };

  const handleOpenEditModal = (product: any) => {
    if (isEmployee) return;
    setEditingProduct({ ...product });
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    const parsedPrice = parseFloat(editingProduct.price) || 0;
    const updatedProd = {
      ...editingProduct,
      price: parsedPrice,
      supplier: editingProduct.supplier || (suppliersList[0] || ''),
      category: editingProduct.category || editingProduct.brand || 'Sona Masoori',
      isBestSeller: !!editingProduct.isBestSeller,
      promoBadge: editingProduct.promoBadge || ''
    };

    const updated = products.map(p => p?.id === updatedProd.id ? updatedProd : p);
    setProducts(updated);
    localStorage.setItem('product_inventory', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { updatedProd } }));

    setIsEditModalOpen(false);
    setEditingProduct(null);

    try {
      await setCollectionDoc('product_inventory', updatedProd.id, updatedProd);
    } catch (err) {
      console.error("Failed to Sync Updated Product:", err);
    }
  };

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              resolve(dataUrl);
              return;
            }
          } catch {}
          resolve(event.target?.result as string);
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        // Fallback
        resolve('');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImageFile(file);
      if (compressed) {
        if (isEdit) {
          setEditingProduct((prev: any) => ({ ...prev, image: compressed }));
        } else {
          setNewProduct((prev: any) => ({ ...prev, image: compressed }));
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, isEdit: boolean) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const compressed = await compressImageFile(file);
      if (compressed) {
        if (isEdit) {
          setEditingProduct((prev: any) => ({ ...prev, image: compressed }));
        } else {
          setNewProduct((prev: any) => ({ ...prev, image: compressed }));
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex gap-2 text-[10px] font-bold text-secondary mb-2">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-primary uppercase">Products</span>
          </nav>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Product Inventory</h1>
          <p className="text-secondary text-sm font-medium mt-1">
            {isEmployee 
              ? "View-only regional rice commodity listings, synchronized live with corporate offices." 
              : "Manage rice commodities and procurement pricing across all regions."}
          </p>
        </div>
        {!isEmployee && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => setActiveInventoryTab(prev => prev === 'merchant_control' ? 'inventory' : 'merchant_control')}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm text-xs font-black uppercase tracking-wider transition-all cursor-pointer btn-tactile",
                activeInventoryTab === 'merchant_control'
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                  : "bg-surface border-outline-variant hover:bg-surface-container text-on-surface"
              )}
              title="Toggle Merchant View & Store Banner Controls"
            >
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{activeInventoryTab === 'merchant_control' ? '← Inventory Stock' : 'Store & Banners'}</span>
            </button>
            <button 
              onClick={() => setIsBroadcastModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#C22424] text-white rounded-xl shadow-md shadow-red-600/20 hover:bg-[#B91C1C] transition-all text-xs font-black uppercase tracking-wider cursor-pointer btn-tactile"
              title="Broadcast price updates or reminders to all merchants"
            >
              <Megaphone className="w-4 h-4" />
              <span>Broadcast Notice</span>
            </button>
            <button 
              onClick={() => setShowFilters(prev => !prev)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl border shadow-sm text-xs font-black uppercase tracking-wider transition-all cursor-pointer btn-tactile",
                showFilters 
                  ? "bg-primary/10 text-primary border-primary/20" 
                  : "bg-surface border-outline-variant hover:bg-surface-container"
              )}
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
            <button 
              onClick={() => window.location.href = '/arrival-entry'}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/10 hover:bg-emerald-700 transition-all text-xs font-black uppercase tracking-wider cursor-pointer btn-tactile"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Arrival Entry
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all text-xs font-black uppercase tracking-wider cursor-pointer btn-tactile"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        )}
      </div>

      {/* Admin Executive Navigation Tabs: Product Inventory vs Merchant Controls */}
      {!isEmployee && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-[#0c1813] rounded-2xl border border-slate-200 dark:border-neutral-800 text-xs font-bold w-full md:w-auto self-start my-2">
          <button
            type="button"
            onClick={() => setActiveInventoryTab('inventory')}
            className={cn(
              "px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer btn-tactile",
              activeInventoryTab === 'inventory'
                ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Product Inventory & Stock ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInventoryTab('merchant_control')}
            className={cn(
              "px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer btn-tactile",
              activeInventoryTab === 'merchant_control'
                ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Merchant View & Banner Control Terminal</span>
          </button>
        </div>
      )}

      {/* TAB A: PRODUCT INVENTORY & STOCK */}
      {activeInventoryTab === 'inventory' && (
        <>
          {/* 4 Floating Hero Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Catalog Commodities</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-black text-on-surface">{inventoryStats.total}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {inventoryStats.active} Active
                </span>
              </div>
              <p className="text-[11px] text-secondary mt-1">Live active commodities on roster</p>
            </div>

            <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Avg Ex-Mill Benchmark</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black text-on-surface">₹{formatINR(averagePrice)}</span>
                <span className="text-[11px] font-bold text-secondary">/ Qtl</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">Weighted baseline across all grades</p>
            </div>

            <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Milling Hubs & Suppliers</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-black text-on-surface">{inventoryStats.suppliers}</span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  {uniqueBrands.length} Varieties
                </span>
              </div>
              <p className="text-[11px] text-secondary mt-1">Direct verified APMC procurement routes</p>
            </div>

            <div className="floating-card liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Store Visibility</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-black text-on-surface">100%</span>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  Live Cloud Sync
                </span>
              </div>
              <p className="text-[11px] text-secondary mt-1">Realtime merchant catalog dispatch</p>
            </div>
          </div>

          {/* Slide-Down Expandable Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm">
              {/* Keyword text search */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Keyword Search</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60" />
                  <input 
                    type="text" 
                    placeholder="Search brand, type, supplier, ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Lifecycle Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl py-2 px-3 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Restocking">Restocking</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>

              {/* Brand Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Type (Rice Variety)</label>
                <select 
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl py-2 px-3 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">All Types</option>
                  {uniqueBrands.map((b, i) => (
                    <option key={i} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Sorting Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Arrange Index</label>
                <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl py-2 px-3 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="default">Default (ID)</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Product: A to Z</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop and Tablet View Table */}
      <motion.div 
        initial={{ opacity: 0, y: 22, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:block floating-card liquid-glass rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                <th className="w-12 px-4 py-4 text-center font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30"></th>
                <th className="px-8 py-4 text-left font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">BRAND NAME</th>
                <th className="px-8 py-4 text-left font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">TYPE</th>
                <th className="px-8 py-4 text-left font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">SUPPLIER</th>
                <th className="px-8 py-4 text-right font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">PRICE (₹/QTLS)</th>
                <th className="px-8 py-4 text-center font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">STATUS</th>
                {!isEmployee && <th className="px-8 py-4 text-right font-bold text-[10px] text-secondary tracking-widest border-b border-outline-variant/30">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={isEmployee ? 6 : 7} className="py-16 text-center space-y-3">
                    <Inbox className="w-12 h-12 text-secondary/30 mx-auto" />
                    <p className="text-sm font-bold text-secondary">No products match active filters</p>
                    <p className="text-xs text-secondary/60">Try updating your filters or reset search query.</p>
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => {
                  const isExpanded = expandedProductId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr 
                        className={cn(
                          "interactive-tr group border-b border-outline-variant/10 cursor-pointer transition-colors",
                          isExpanded && "bg-primary/[0.04] dark:bg-primary/[0.06]"
                        )}
                      >
                        <td className="w-12 px-4 py-4 text-center" onClick={(e) => { e.stopPropagation(); setExpandedProductId(isExpanded ? null : p.id); }}>
                          <button
                            type="button"
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer btn-tactile",
                              isExpanded 
                                ? "bg-primary text-white shadow-sm" 
                                : "text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            )}
                            title={isExpanded ? "Collapse specifications" : "Expand specifications drawer"}
                          >
                            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                          </button>
                        </td>
                        <td 
                          className={cn("px-8 py-4", !isEmployee && "cursor-pointer hover:bg-primary/[0.01]")}
                          onClick={() => !isEmployee && handleOpenEditModal(p)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0 shadow-inner border border-outline-variant/30 relative group/img">
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover/img:scale-105 transition-all" referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-sm text-on-surface uppercase group-hover:text-primary transition-colors flex items-center gap-1">
                                  {p.name}
                                  {!isEmployee && <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-secondary" />}
                                </span>
                                {p.isBestSeller && (
                                  <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-black px-1.5 py-0.5 rounded-full lowercase tracking-tight">
                                    ★ best seller
                                  </span>
                                )}
                                {p.promoBadge && (
                                  <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-tight">
                                    {p.promoBadge}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-secondary/60 uppercase font-mono">ID: {p.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm font-bold text-secondary">{p.brand}</td>
                        <td className="px-8 py-4 text-xs font-semibold text-secondary/80 max-w-[200px] truncate uppercase">{p.supplier || suppliersList[0] || 'DIRECT MILL'}</td>
                        <td 
                          className={cn(
                            "px-8 py-4 text-right",
                            !isEmployee && "cursor-pointer group/cell"
                          )}
                          onClick={() => !isEmployee && startEditing(p.id, 'price', p.price)}
                        >
                          {editingCell?.id === p.id && editingCell.field === 'price' ? (
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <input 
                                autoFocus
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                                className="w-24 bg-surface dark:bg-black p-1 text-right border border-primary rounded font-black text-sm outline-none"
                              />
                            </div>
                          ) : (
                            <span className={cn(
                              "font-black text-sm text-on-surface",
                              !isEmployee && "group-hover/cell:text-primary transition-colors"
                            )}>
                              ₹ {formatINR(p.price)}
                            </span>
                          )}
                        </td>
                        <td 
                          className={cn(
                            "px-8 py-4 text-center",
                            !isEmployee && "cursor-pointer group/cell"
                          )}
                          onClick={() => !isEmployee && startEditing(p.id, 'status', p.status)}
                        >
                          {editingCell?.id === p.id && editingCell.field === 'status' ? (
                            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                              <select 
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                                className="bg-surface dark:bg-black p-1 border border-primary rounded text-[10px] font-black outline-none"
                              >
                                <option value="Active">Active</option>
                                <option value="Restocking">Restocking</option>
                                <option value="Discontinued">Discontinued</option>
                              </select>
                            </div>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black border transition-all",
                              p.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30" : 
                              p.status === 'Restocking' ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30" :
                              "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                            )}>
                              {p.status}
                            </span>
                          )}
                        </td>
                        {!isEmployee && (
                          <td className="px-8 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleOpenEditModal(p)}
                                title="Edit Product"
                                className="p-2 text-secondary hover:text-primary transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer btn-tactile"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => handleRequestDelete(p, e)}
                                title="Delete Product"
                                className="p-2 text-secondary hover:text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer btn-tactile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Animated Dropdown Drawer Row */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr key={`${p.id}-drawer`} className="table-dropdown-drawer">
                            <td colSpan={isEmployee ? 6 : 7} className="p-0">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="p-5 md:p-6 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  {/* Bento 1: Grain Specification & Bag Visual */}
                                  <div className="p-4 rounded-2xl bg-surface/90 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                                          <Package className="w-3.5 h-3.5 text-primary" />
                                          Grain Specification
                                        </span>
                                        <span className="text-[9px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-secondary">
                                          {p.id}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant/40 shadow-inner">
                                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                        <div>
                                          <h5 className="font-black text-sm text-on-surface uppercase leading-snug">{p.name}</h5>
                                          <p className="text-xs text-primary font-bold">{p.brand}</p>
                                          <p className="text-[11px] text-secondary mt-0.5">50 KG Standard APMC Lot</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                                      <span className="text-[10px] text-secondary font-medium">Standard Trading Lot:</span>
                                      <span className="text-[10px] font-bold text-on-surface">Quintals (100 KG)</span>
                                    </div>
                                  </div>

                                  {/* Bento 2: Procurement Source & Origin */}
                                  <div className="p-4 rounded-2xl bg-surface/90 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                                          <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                                          Procurement Source
                                        </span>
                                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded">
                                          Verified APMC
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-[10px] uppercase font-bold text-secondary">Milling Facility / Partner</p>
                                          <p className="text-xs font-black text-on-surface uppercase truncate">{p.supplier || suppliersList[0] || 'Direct Mill Partner'}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase font-bold text-secondary">Dispatch Origin Cluster</p>
                                          <p className="text-xs font-semibold text-secondary flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-secondary" />
                                            Karnataka & Andhra Rice Belt
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] uppercase font-bold text-secondary">Grading Protocol</p>
                                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Machine Sorted • Moisture &lt; 12.5%</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                                      <span className="text-[10px] text-secondary font-medium">Current Status:</span>
                                      <span className={cn(
                                        "text-[10px] font-black uppercase",
                                        p.status === 'Active' ? "text-emerald-600" : "text-amber-600"
                                      )}>
                                        {p.status}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Bento 3: Pricing Structure Breakdown */}
                                  <div className="p-4 rounded-2xl bg-surface/90 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                                          Pricing Structure
                                        </span>
                                        <span className="text-[9px] font-black bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded">
                                          Ex-Mill Net
                                        </span>
                                      </div>
                                      <div className="space-y-2.5">
                                        <div className="flex items-baseline justify-between">
                                          <span className="text-[11px] text-secondary font-medium">Per Quintal (100kg):</span>
                                          <span className="text-sm font-black text-on-surface">₹ {formatINR(p.price)}</span>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                          <span className="text-[11px] text-secondary font-medium">Per 50kg Bag (Approx):</span>
                                          <span className="text-xs font-bold text-on-surface">₹ {formatINR(Math.round(p.price / 2))}</span>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                          <span className="text-[11px] text-secondary font-medium">Per Metric Ton (10 Qtl):</span>
                                          <span className="text-xs font-bold text-on-surface">₹ {formatINR(Math.round(p.price * 10))}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] text-secondary">
                                      <span>Tax Compliance:</span>
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">APMC Mandi Bylaw</span>
                                    </div>
                                  </div>

                                  {/* Bento 4: Quick Action Command Desk */}
                                  <div className="p-4 rounded-2xl bg-surface/90 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                                          Operational Actions
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopyProductSpec(p, e)}
                                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface transition-all cursor-pointer btn-tactile"
                                        >
                                          {copiedProdId === p.id ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                                              <span className="text-emerald-500">Spec Copied to Clipboard</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-3.5 h-3.5 text-secondary" />
                                              <span>Copy Commodity Spec</span>
                                            </>
                                          )}
                                        </button>
                                        {!isEmployee && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); handleOpenEditModal(p); }}
                                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold transition-all cursor-pointer btn-tactile"
                                            >
                                              <Edit className="w-3.5 h-3.5" />
                                              <span>Edit Commodity Pricing</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setIsBroadcastModalOpen(true)}
                                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer btn-tactile"
                                            >
                                              <Megaphone className="w-3.5 h-3.5" />
                                              <span>Broadcast Rate Update</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {!isEmployee && (
                                      <div className="pt-2 border-t border-outline-variant/30 flex justify-end">
                                        <button
                                          type="button"
                                          onClick={(e) => handleRequestDelete(p, e)}
                                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Delete Commodity</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-4 border-t border-outline-variant bg-surface-container-low/30 flex items-center justify-between font-medium">
          <p className="text-[11px] text-secondary">Showing {processedProducts.length} computed products</p>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 border border-outline-variant rounded-xl text-xs hover:bg-surface transition-all disabled:opacity-50" disabled>Previous</button>
            <button className="px-4 py-1.5 border border-outline-variant rounded-xl text-xs hover:bg-surface transition-all">Next</button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Card Feed View - Perfect for warehouse employees on their phones */}
      <div className="block md:hidden space-y-4">
        {processedProducts.length === 0 ? (
          <div className="liquid-glass p-12 text-center rounded-3xl space-y-3">
            <Inbox className="w-10 h-10 text-secondary/30 mx-auto" />
            <p className="text-sm font-bold text-secondary">No products match Active Filters</p>
          </div>
        ) : (
          processedProducts.map((p, pIdx) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
              transition={{ duration: 0.4, delay: pIdx * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="liquid-glass rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col gap-3 relative cursor-pointer interactive-card"
              onClick={() => !isEmployee && handleOpenEditModal(p)}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant/30">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-extrabold text-on-surface text-sm uppercase truncate leading-tight flex items-center gap-1">
                      {p.name}
                      {!isEmployee && <Edit className="w-3.5 h-3.5 text-secondary" />}
                    </h4>
                    {p.isBestSeller && (
                      <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[8.5px] font-black px-1.5 py-0.2 rounded-full lowercase tracking-tight">
                        ★ best seller
                      </span>
                    )}
                    {p.promoBadge && (
                      <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[8.5px] font-black px-1.5 py-0.2 rounded-full tracking-tight">
                        {p.promoBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-secondary/70 uppercase tracking-wider mt-0.5">Type: {p.brand} • <span className="font-mono">{p.id}</span></p>
                  <p className="text-[9px] font-extrabold text-primary/80 uppercase tracking-wider mt-0.5">Supplier: {p.supplier || suppliersList[0] || 'DIRECT MILL'}</p>
                </div>
                
                {/* Status Badge */}
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black border transition-all",
                  p.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30" : 
                  p.status === 'Restocking' ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30" :
                  "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                )}>
                  {p.status}
                </span>
              </div>

              <div className="flex justify-between items-center bg-surface-container-low/50 dark:bg-neutral-900/20 px-3 py-2.5 rounded-xl border border-outline-variant/20 mt-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-secondary uppercase tracking-widest leading-none">Price / QTLS</span>
                  <span className="font-black text-sm mt-1 text-on-surface">₹ {formatINR(p.price)}</span>
                </div>

                {!isEmployee && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleCopyProductSpec(p, e)}
                      className="px-2.5 py-1.5 border border-outline-variant/30 bg-surface text-secondary hover:text-on-surface rounded-xl text-[10px] font-black uppercase tracking-wider min-h-[38px] flex items-center justify-center gap-1.5 btn-tactile cursor-pointer"
                      title="Copy Spec"
                    >
                      {copiedProdId === p.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(p);
                      }}
                      className="px-3 py-1.5 border border-amber-600/20 bg-amber-500/10 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider min-h-[38px] flex items-center justify-center gap-1.5 btn-tactile cursor-pointer"
                    >
                      <Edit className="w-3 h-3" />
                      Modify
                    </button>
                    <button 
                      onClick={(e) => handleRequestDelete(p, e)}
                      className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider min-h-[38px] flex items-center justify-center gap-1.5 btn-tactile cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {!isEmployee && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'AVERAGE PRICE INDEX', value: `₹ ${formatINR(averagePrice)}`, icon: TrendingUp, delta: '+12% WoW', desc: 'Active procurement weighted price' },
            { label: 'TOTAL SKU COUNT', value: String(products.length), icon: Package, delta: null, desc: 'Verified catalog varieties' },
            { label: 'REGIONAL HUBS', value: '05 Milling Zones', icon: MapPin, delta: null, desc: 'KA, AP, PB, HR, TN logistics routes' },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -4, transition: { duration: 0.22, ease: "easeOut" } }}
              transition={{ duration: 0.48, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="floating-card liquid-glass p-6 rounded-3xl flex flex-col justify-between border border-outline-variant/30 shadow-sm hover:border-primary/30 transition-all duration-300 interactive-card relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.delta && <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">{stat.delta}</span>}
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-black text-on-surface mt-1">{stat.value}</h3>
                <p className="text-[11px] text-secondary mt-0.5">{stat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </>
      )}

      {/* TAB B: MERCHANT VIEW & BANNER CONTROL TERMINAL */}
      {activeInventoryTab === 'merchant_control' && (
        <div className="space-y-6 text-left">
          
          {/* Top Hero Card & Live Publish Action */}
          <div className="bg-gradient-to-r from-[#143e2e] via-[#0d2a1f] to-[#07130e] text-white p-6 rounded-3xl border border-emerald-800/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/20">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Live Merchant Terminal Manager
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-normal text-white">
                Customize Merchant Store Experience
              </h2>
              <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
                Spotlight today's featured hero product, manage store categories, and respond to merchant inquiries.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {publishSuccessMsg && (
                <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-3 py-2 rounded-xl border border-emerald-400/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {publishSuccessMsg}
                </span>
              )}
              <a
                href="/store"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-2xl border border-white/20 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                title="Open Live Store in new tab"
              >
                <Eye className="w-4 h-4 text-emerald-300" />
                <span>Preview Store ↗</span>
              </a>
              <button
                type="button"
                onClick={handlePublishMerchantControls}
                disabled={isPublishing}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Publish Changes Live</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid Layout: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* MODULE 1: Spotlight Hero Product Selection */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Store Highlight
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Select Hero Product of the Day
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the primary featured grain commodity to display with the gold 🌟 HERO PRODUCT spotlight badge on the merchant store.
              </p>

              <select
                value={adminHeroProductId}
                onChange={(e) => setAdminHeroProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/25"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.brand || p.category}) — ₹{formatINR(p.price)}
                  </option>
                ))}
              </select>
            </div>

            {/* MODULE 2: Curated Grain Categories Manager */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Store Catalog
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Curated Rice Categories ({adminStoreCategories.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Enter new category name (e.g. Keshar Kali, Brown Rice):');
                    if (!name || !name.trim()) return;
                    const newCat = {
                      id: name.trim(),
                      name: name.trim(),
                      description: 'Direct APMC procurement',
                      count: 'New Varieties',
                      active: true
                    };
                    setAdminStoreCategories(prev => [...prev, newCat]);
                  }}
                  className="px-3 py-1.5 bg-[#143e2e] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Add Category
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                {adminStoreCategories.map((cat, idx) => (
                  <div
                    key={cat.id || idx}
                    className="p-3 bg-slate-50 dark:bg-[#07130e] border border-slate-200/80 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminStoreCategories(prev =>
                            prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c)
                          );
                        }}
                        className={cn(
                          "w-3 h-3 rounded-full shrink-0 cursor-pointer transition-all",
                          cat.active ? "bg-emerald-500 shadow-xs" : "bg-slate-300 dark:bg-neutral-700"
                        )}
                        title={cat.active ? "Active in store (click to hide)" : "Hidden in store (click to activate)"}
                      />
                      <div className="min-w-0">
                        <span className={cn("font-bold block truncate", cat.active ? "text-slate-900 dark:text-white" : "text-slate-400 line-through")}>
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {cat.description || cat.count || 'Store category'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
                        {cat.count || 'Active'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminStoreCategories(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MODULE 3: Merchant Support & Inquiries Terminal */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400">
                    Live Helpdesk
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Merchant Inquiries & Tickets ({complaintsList.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={loadComplaints}
                  disabled={isLoadingComplaints}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className={cn("w-2 h-2 rounded-full bg-sky-500", isLoadingComplaints && "animate-spin")} />
                  <span>Refresh</span>
                </button>
              </div>

              {complaintsList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#07130e] border border-slate-200/80 dark:border-neutral-800 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Pending Merchant Tickets</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">All customer inquiries & loading support requests are resolved.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 text-xs">
                  {complaintsList.map((ticket, i) => (
                    <div
                      key={ticket.id || i}
                      className="p-3 bg-slate-50 dark:bg-[#07130e] border border-slate-200/80 dark:border-neutral-800 rounded-2xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {ticket.subject || 'Support Inquiry'}
                        </span>
                        <select
                          value={ticket.status || 'Pending'}
                          onChange={(e) => handleUpdateComplaintStatus(ticket.id, e.target.value as any)}
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-bold border outline-none cursor-pointer",
                            ticket.status === 'Resolved' ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" :
                            ticket.status === 'In Progress' ? "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300" :
                            "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          )}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                        {ticket.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-neutral-800/60">
                        <span>{ticket.merchantName || ticket.merchantEmail || 'Merchant'}</span>
                        <span>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}



      {/* ADD PRODUCT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45 backdrop-blur-[4px]">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="bg-surface dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] border border-outline-variant/30 font-sans"
            >
              <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/50 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Publish New Grain Asset</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors text-secondary cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Brand Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Royal Heritage" 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Type (Rice Variety)</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Basmati, Sona Masoori" 
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Store Category</label>
                  <select 
                    value={newProduct.category || 'Sona Masoori'}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    {Array.from(new Set(['Sona Masoori', 'Basmati', 'IR64', 'Ponni', 'Parboiled', 'Broken', 'Organic', 'Commercial', ...(adminStoreCategories || []).map((c: any) => c.name || c.id)])).map((catName) => (
                      <option key={catName} value={catName}>{catName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Select Supplier</label>
                  <select 
                    value={newProduct.supplier || suppliersList[0] || ''}
                    onChange={(e) => setNewProduct({...newProduct, supplier: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    {suppliersList.map((s, i) => (
                      <option key={i} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Price per QTLS (INR)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="e.g. 4200" 
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-mono text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Standard Bag Visual</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_GRAIN_IMAGES.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNewProduct({...newProduct, image: img.url})}
                        className={cn(
                          "p-2 rounded-xl border relative overflow-hidden transition-all text-left",
                          newProduct.image === img.url 
                            ? "border-primary bg-primary/[0.05]" 
                            : "border-outline-variant bg-surface"
                        )}
                      >
                        <div className="w-full h-12 rounded bg-surface-container overflow-hidden mb-1">
                          <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[9px] font-bold text-secondary leading-none truncate">{img.label}</p>
                        {newProduct.image === img.url && (
                          <div className="absolute right-1 top-1 bg-primary text-white p-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Drag & Drop Upload Container */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, false)}
                    className="mt-3 border-2 border-dashed border-outline-variant/60 rounded-2xl p-4 text-center hover:border-primary/50 transition-colors bg-surface-container-low/40 relative group"
                  >
                    <input 
                      type="file" 
                      id="add-image-upload" 
                      accept="image/*" 
                      onChange={(e) => handleImageFileChange(e, false)} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="add-image-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-1"
                    >
                      <Upload className="w-5 h-5 text-secondary/60 group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-extrabold text-secondary hover:text-primary transition-colors block uppercase tracking-wider">
                        Drag image here or click to browse
                      </span>
                      <span className="text-[8px] text-secondary/50 font-bold block">Supports PNG, JPG, WEBP, or SVG</span>
                    </label>
                  </div>

                  {/* Custom URL Paste Option */}
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[8px] text-secondary/50 font-extrabold uppercase tracking-widest block text-left">- OR PASTE CUSTOM IMAGE URL -</span>
                    <input 
                      type="url" 
                      placeholder="e.g. https://example.com/rice_image.jpg"
                      value={newProduct.image.startsWith('data:') ? '' : newProduct.image}
                      onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs font-bold outline-none text-on-surface text-left"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Publish Status</label>
                  <select 
                    value={newProduct.status}
                    onChange={(e) => setNewProduct({...newProduct, status: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    <option value="Active">Active</option>
                    <option value="Restocking">Restocking</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>

                {/* Store Promotional Controls */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Store Promotional Badge</label>
                  <select 
                    value={newProduct.promoBadge || ''}
                    onChange={(e) => setNewProduct({...newProduct, promoBadge: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    <option value="">None (Standard Listing)</option>
                    <option value="🌾 Fresh 2026 Batch">🌾 Fresh 2026 Batch</option>
                    <option value="⚡ Special Ex-Mill Rate">⚡ Special Ex-Mill Rate</option>
                    <option value="⭐ Best Seller">⭐ Best Seller</option>
                    <option value="🔥 Hot Stock">🔥 Hot Stock</option>
                    <option value="🚚 Fast Dispatch">🚚 Fast Dispatch</option>
                    <option value="💎 Premium Aged">💎 Premium Aged</option>
                  </select>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-on-surface block text-left">Feature as Best Seller</span>
                    <span className="text-[10px] text-secondary block text-left">Highlights product with best-seller badge on store front</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={!!newProduct.isBestSeller}
                    onChange={(e) => setNewProduct({...newProduct, isBestSeller: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Register Grain to Inventory
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT PRODUCT MODAL */}
      <AnimatePresence>
        {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45 backdrop-blur-[4px]">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="bg-surface dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] border border-outline-variant/30 font-sans"
            >
              <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/50 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Update Grain Asset Details</h3>
                </div>
                <button onClick={() => { setIsEditModalOpen(false); setEditingProduct(null); }} className="p-2 hover:bg-surface-container rounded-full transition-colors text-secondary cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Brand Name</label>
                  <input 
                    required
                    type="text" 
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Type (Rice Variety)</label>
                  <input 
                    required
                    type="text" 
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-sans text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Store Category</label>
                  <select 
                    value={editingProduct.category || editingProduct.brand || 'Sona Masoori'}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    {Array.from(new Set(['Sona Masoori', 'Basmati', 'IR64', 'Ponni', 'Parboiled', 'Broken', 'Organic', 'Commercial', ...(adminStoreCategories || []).map((c: any) => c.name || c.id)])).map((catName) => (
                      <option key={catName} value={catName}>{catName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Select Supplier</label>
                  <select 
                    value={editingProduct.supplier || suppliersList[0] || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, supplier: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    {suppliersList.map((s, i) => (
                      <option key={i} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Price per QTLS (INR)</label>
                  <input 
                    required
                    type="number" 
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold outline-none font-mono text-on-surface text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Standard Bag Visual</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_GRAIN_IMAGES.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEditingProduct({...editingProduct, image: img.url})}
                        className={cn(
                          "p-2 rounded-xl border relative overflow-hidden transition-all text-left",
                          editingProduct.image === img.url 
                            ? "border-primary bg-primary/[0.05]" 
                            : "border-outline-variant bg-surface"
                        )}
                      >
                        <div className="w-full h-12 rounded bg-surface-container overflow-hidden mb-1">
                          <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[9px] font-bold text-secondary leading-none truncate">{img.label}</p>
                        {editingProduct.image === img.url && (
                          <div className="absolute right-1 top-1 bg-primary text-white p-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Drag & Drop Upload Container */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, true)}
                    className="mt-3 border-2 border-dashed border-outline-variant/60 rounded-2xl p-4 text-center hover:border-primary/50 transition-colors bg-surface-container-low/40 relative group"
                  >
                    <input 
                      type="file" 
                      id="edit-image-upload" 
                      accept="image/*" 
                      onChange={(e) => handleImageFileChange(e, true)} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="edit-image-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-1"
                    >
                      <Upload className="w-5 h-5 text-secondary/60 group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-extrabold text-secondary hover:text-primary transition-colors block uppercase tracking-wider">
                        Drag image here or click to browse
                      </span>
                      <span className="text-[8px] text-secondary/50 font-bold block">Supports PNG, JPG, WEBP, or SVG</span>
                    </label>
                  </div>

                  {/* Custom URL Paste Option */}
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[8px] text-secondary/50 font-extrabold uppercase tracking-widest block text-left">- OR PASTE CUSTOM IMAGE URL -</span>
                    <input 
                      type="url" 
                      placeholder="e.g. https://example.com/rice_image.jpg"
                      value={editingProduct.image.startsWith('data:') ? '' : editingProduct.image}
                      onChange={(e) => setEditingProduct({...editingProduct, image: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs font-bold outline-none text-on-surface text-left"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">Publish Status</label>
                  <select 
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({...editingProduct, status: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    <option value="Active">Active</option>
                    <option value="Restocking">Restocking</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </div>

                {/* Store Promotional Controls */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Store Promotional Badge</label>
                  <select 
                    value={editingProduct.promoBadge || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, promoBadge: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-3 text-xs font-bold outline-none cursor-pointer text-on-surface"
                  >
                    <option value="">None (Standard Listing)</option>
                    <option value="🌾 Fresh 2026 Batch">🌾 Fresh 2026 Batch</option>
                    <option value="⚡ Special Ex-Mill Rate">⚡ Special Ex-Mill Rate</option>
                    <option value="⭐ Best Seller">⭐ Best Seller</option>
                    <option value="🔥 Hot Stock">🔥 Hot Stock</option>
                    <option value="🚚 Fast Dispatch">🚚 Fast Dispatch</option>
                    <option value="💎 Premium Aged">💎 Premium Aged</option>
                  </select>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-on-surface block text-left">Feature as Best Seller</span>
                    <span className="text-[10px] text-secondary block text-left">Highlights product with best-seller badge on store front</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={!!editingProduct.isBestSeller}
                    onChange={(e) => setEditingProduct({...editingProduct, isBestSeller: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={(e) => handleRequestDelete(editingProduct, e)}
                    className="flex-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Update Product Asset
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-[6px]">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              className="bg-surface dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-md border border-rose-500/20 p-6 font-sans space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 shrink-0 border border-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-on-surface uppercase tracking-tight">Delete Product?</h3>
                  <p className="text-xs font-semibold text-secondary/80 mt-1 leading-relaxed">
                    Are you sure you want to remove this product from inventory? This action is permanent.
                  </p>
                </div>
              </div>

              {/* Product preview card */}
              <div className="p-3.5 bg-surface-container-low/80 dark:bg-neutral-800/40 rounded-2xl border border-outline-variant/30 flex items-center gap-3.5">
                {productToDelete.image && (
                  <div className="w-12 h-12 rounded-xl bg-surface overflow-hidden shrink-0 border border-outline-variant/40">
                    <img src={productToDelete.image} alt={productToDelete.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-xs text-on-surface uppercase truncate">{productToDelete.name}</h4>
                  <p className="text-[10px] font-bold text-secondary/70 uppercase mt-0.5">
                    {productToDelete.brand} • <span className="font-mono">{productToDelete.id}</span>
                  </p>
                  <p className="text-[10px] font-extrabold text-primary uppercase truncate mt-0.5">
                    {productToDelete.supplier}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-secondary uppercase block">Rate</span>
                  <span className="text-xs font-black text-on-surface">₹ {formatINR(productToDelete.price)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteProduct}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <span>Deleting...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm Delete</span>
                    </>
                  )}
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
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[70] bg-surface dark:bg-neutral-900 border border-emerald-500/30 text-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold font-sans"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span>{deleteToast}</span>
            <button 
              onClick={() => setDeleteToast(null)}
              className="p-1 hover:bg-surface-container rounded-lg text-secondary ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Broadcast Notice Modal */}
      <AdminBroadcastNoticeModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        products={products}
      />
    </div>
  );
}
