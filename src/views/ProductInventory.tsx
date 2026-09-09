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
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import { getCollectionDocs, syncCollection, db, deleteCollectionDoc } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

const DEFAULT_SUPPLIERS = [
  'ANNAPURNA RICE & AGRO INDUSTRIES'
];

const initialProducts: any[] = [];

const PRESET_GRAIN_IMAGES = [
  { label: 'Premium Sona Masoori Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOz5qOiTIVul9CR5oE14q5nszk1V5hX6LO1BlqBfqDPEX3K5oVnvONQXpQ47jbYfTH820mSETx41SM4t9HZJXQv_OjP5OeYgO-gUsr3WEKAx6HOrXgdMJ1ccjCOxrN6450eET-pDA0jXCMRum_L_20H0l9RkB8ViMzoa9O1xnt9qTcnAu0k5yAmZ-qiIAaztD1UJa0TiUVOrAb7w9N_qGxQILHklk-XFKkXHP8JBU3cNeRi84OX492lyKUdsJf12KwAL_hq6JvuOZj' },
  { label: 'Jasmine Rice Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-zw5USNmhSWJ7W6KYNTxtxlvbucTGBqM91aYmN9ZxAlgvZIBCtLu_HO1Y6j9huJHOUICTW230tfwmeYNZI89Quj-o1n6dnY7tVzThXMjnw50G_5ZUVyBb9v-fkOlF3OOsh5q8N6x1ZNmKG64sKYprqc-gQ5WdOd8ZKy7r_r44wx2qzB0srt6O205GYTyY5is626j2iSoylgKkn9ktJSrD1UhQuuITJU9Ka26Vej9j0oHRlpcaqL73YbujaFhOQ7Ly71Qt9ofGdr' },
  { label: 'Basmati Rice Bag', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBm-XMaGdzxCjePQf6HZQOYwr69Zxd_uImfU8ASz83aco_TNkafvvB-t0733UI0fDTWC3wi9pQSVnG9w3qwPRkWNJtZFfCchbPI9xjyqSb9veIK4ypfBYDZwvKvlc9BKauhSKHl5r33cNwMa_vB5-KtU-2NWfwjBT2BBro7NA2hMwxtu9OaCg4Od4Gp0_NkBdnV_kOLR5mkQnZZdf9IJ8vI_GZT2CJ0DED3KfwlWc2HJooTd6KuSiu0vEWJXK80aG9OVARp4OxxFi52' }
];

export default function ProductInventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filter & Modal State
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('default');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Delete Confirmation Modal & Toast State
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  const [suppliersList, setSuppliersList] = useState<string[]>(DEFAULT_SUPPLIERS);

  // Navigation Tab inside Inventory View: 'inventory' | 'merchant_control'
  const [activeInventoryTab, setActiveInventoryTab] = useState<'inventory' | 'merchant_control'>('inventory');

  // Dynamic Merchant Store Controls State
  const [adminHeroSlides, setAdminHeroSlides] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tejas_hero_slides');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'slide-1',
        tagline: "FROM OUR FIELDS TO YOUR TABLE",
        title: "The Finest Rice for a Healthier Tomorrow",
        subtitle: "Premium aged Basmati & daily staples, directly certified from premier APMC milling centers.",
        badge: "🌾 Royal Harvest",
        image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        bgGradient: "from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb] dark:from-[#0d2118] dark:via-[#11291f] dark:to-[#0c1e16]"
      },
      {
        id: 'slide-2',
        tagline: "100% NATURALLY AGED & POLISHED",
        title: "Silky Sona Masoori & Fragrant Jasmine",
        subtitle: "Lightweight, aromatic texture trusted by premier restaurants and households.",
        badge: "✨ Master Grade Aroma",
        image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
        bgGradient: "from-[#fef7ee] via-[#faead1] to-[#f5dfb8] dark:from-[#1c180e] dark:via-[#262013] dark:to-[#171309]"
      }
    ];
  });

  const [adminTickerMessages, setAdminTickerMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tejas_ticker_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 't1', text: '🌾 NEW ARRIVAL: Fresh Sona Masoori 2026 Batch Stock Arrived at APMC Yard!', active: true, type: 'new_arrival' },
      { id: 't2', text: '⚡ SPECIAL RATE TODAY: 1121 Sella Rice Ex-Mill Rate Updated', active: true, type: 'rate_update' },
      { id: 't3', text: '🚚 APMC EXPRESS DISPATCH: Guaranteed 24-48 Hr Mill Loading', active: true, type: 'announcement' }
    ];
  });

  const [adminRateListGraphic, setAdminRateListGraphic] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tejas_rate_list_graphic');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
      title: 'Daily APMC Market Rate Chart',
      noticeText: 'Latest wholesale paddy & rice rates updated ex-mill Ludhiana & APMC Yard Bangalore.'
    };
  });

  const [adminHeroProductId, setAdminHeroProductId] = useState<string>(() => {
    return localStorage.getItem('tejas_hero_product_id') || 'PRD-1001';
  });

  // Ticker form state
  const [newTickerText, setNewTickerText] = useState('');
  
  // Slide Form / Modal state
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any>(null);
  const [slideForm, setSlideForm] = useState({
    tagline: 'SPECIAL PROMOTION',
    title: 'New Season Harvest Arrived',
    subtitle: 'Direct mill loading with verified APMC certificates.',
    image: PRESET_GRAIN_IMAGES[0].url,
    bgGradient: 'from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb] dark:from-[#0d2118] dark:via-[#11291f] dark:to-[#0c1e16]'
  });

  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Save all admin merchant view settings to Cloud & Local Storage
  const handlePublishMerchantControls = async () => {
    setIsPublishing(true);
    setPublishSuccessMsg('');

    try {
      // 1. Local storage sync
      localStorage.setItem('tejas_hero_slides', JSON.stringify(adminHeroSlides));
      localStorage.setItem('tejas_ticker_messages', JSON.stringify(adminTickerMessages));
      localStorage.setItem('tejas_rate_list_graphic', JSON.stringify(adminRateListGraphic));
      localStorage.setItem('tejas_hero_product_id', adminHeroProductId);

      // 2. Cloud sync to Firestore
      const storeConfigData = {
        id: 'main_config',
        heroSlides: adminHeroSlides,
        tickerMessages: adminTickerMessages,
        rateListGraphic: adminRateListGraphic,
        heroProductId: adminHeroProductId,
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
    price: '',
    status: 'Active',
    image: PRESET_GRAIN_IMAGES[0].url,
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
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

      // 7. Delete from Firestore asynchronously
      await Promise.allSettled([
        deleteDoc(doc(db, 'product_inventory', targetId)),
        deleteDoc(doc(db, 'product_inventory', rawNorm)),
        deleteDoc(doc(db, 'product_inventory', `#${rawNorm}`))
      ]);
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
    } else {
      local = initialProducts.filter(p => !isDeleted(p.id));
    }

    setProducts(local);

    try {
      const data = await getCollectionDocs('product_inventory');
      if (Array.isArray(data)) {
        const validDocs = data.filter((p: any) => p && p.id && !isDeleted(p.id));
        const combinedMap = new Map();
        local.forEach((p: any) => combinedMap.set(p.id, p));
        validDocs.forEach((p: any) => combinedMap.set(p.id, p));
        const sorted = Array.from(combinedMap.values()).sort((a: any, b: any) => (a?.id || '').localeCompare(b?.id || ''));
        setProducts(sorted);
        localStorage.setItem('product_inventory', JSON.stringify(sorted));
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
        const deletedSet = new Set(deletedIds.map(id => String(id).trim().toLowerCase().replace(/^#/, '')));

        const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
        const cloudDocs = await getCollectionDocs('stakeholders').catch(() => []);

        const supSet = new Set<string>(DEFAULT_SUPPLIERS);
        if (cached && Array.isArray(cached.suppliers)) {
          cached.suppliers.forEach((s: any) => {
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
        setSuppliersList(Array.from(supSet).sort());
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
      await syncCollection('product_inventory', updated);
    } catch (err) {
      console.error("Failed to sync inventory to database:", err);
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

  // Pricing statistics
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
      price: parseFloat(newProduct.price) || 4100.00,
      status: newProduct.status,
      image: newProduct.image,
      supplier: newProduct.supplier || (suppliersList[0] || 'ANNAPURNA RICE & AGRO INDUSTRIES')
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
      price: '',
      status: 'Active',
      image: PRESET_GRAIN_IMAGES[0].url,
      supplier: suppliersList[0] || 'ANNAPURNA RICE & AGRO INDUSTRIES'
    });

    try {
      await syncCollection('product_inventory', updated);
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
      supplier: editingProduct.supplier || (suppliersList[0] || 'ANNAPURNA RICE & AGRO INDUSTRIES')
    };

    const updated = products.map(p => p?.id === updatedProd.id ? updatedProd : p);
    setProducts(updated);
    localStorage.setItem('product_inventory', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { updatedProd } }));

    setIsEditModalOpen(false);
    setEditingProduct(null);

    try {
      await syncCollection('product_inventory', updated);
    } catch (err) {
      console.error("Failed to Sync Updated Product:", err);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingProduct((prev: any) => ({ ...prev, image: reader.result as string }));
        } else {
          setNewProduct((prev: any) => ({ ...prev, image: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, isEdit: boolean) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingProduct((prev: any) => ({ ...prev, image: reader.result as string }));
        } else {
          setNewProduct((prev: any) => ({ ...prev, image: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
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
          <div className="flex gap-3">
            <button 
              onClick={() => setShowFilters(prev => !prev)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl border shadow-sm text-xs font-black uppercase tracking-wider transition-all",
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
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/10 hover:bg-emerald-700 active:scale-95 transition-all text-xs font-black uppercase tracking-wider"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Arrival Entry
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-xs font-black uppercase tracking-wider"
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
              "px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
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
              "px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
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
        className="hidden md:block liquid-glass rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
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
                  <td colSpan={6} className="py-16 text-center space-y-3">
                    <Inbox className="w-12 h-12 text-secondary/30 mx-auto" />
                    <p className="text-sm font-bold text-secondary">No products match active filters</p>
                    <p className="text-xs text-secondary/60">Try updating your filters or reset search query.</p>
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => (
                  <tr key={p.id} className="interactive-tr group border-b border-outline-variant/10 cursor-pointer">
                    <td 
                      className={cn("px-8 py-4", !isEmployee && "cursor-pointer hover:bg-primary/[0.01]")}
                      onClick={() => !isEmployee && handleOpenEditModal(p)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0 shadow-inner border border-outline-variant/30 relative group/img">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover/img:scale-105 transition-all" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <span className="font-extrabold text-sm block text-on-surface uppercase group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {p.name}
                            {!isEmployee && <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-secondary" />}
                          </span>
                          <span className="text-[10px] font-black text-secondary/60 uppercase font-mono">ID: {p.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm font-bold text-secondary">{p.brand}</td>
                    <td className="px-8 py-4 text-xs font-semibold text-secondary/80 max-w-[200px] truncate uppercase">{p.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES'}</td>
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
                            className="p-2 text-secondary hover:text-primary transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleRequestDelete(p, e)}
                            title="Delete Product"
                            className="p-2 text-secondary hover:text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
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
                  <h4 className="font-extrabold text-on-surface text-sm uppercase truncate leading-tight flex items-center gap-1.5">
                    {p.name}
                    {!isEmployee && <Edit className="w-3.5 h-3.5 text-secondary" />}
                  </h4>
                  <p className="text-[10px] font-bold text-secondary/70 uppercase tracking-wider mt-0.5">Type: {p.brand} • <span className="font-mono">{p.id}</span></p>
                  <p className="text-[9px] font-extrabold text-primary/80 uppercase tracking-wider mt-0.5">Supplier: {p.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES'}</p>
                </div>
                
                {/* Status Badge */}
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black border transition-all",
                  p.status === 'Active' ? "bg-emerald-50 text-emerald-650 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30" : 
                  p.status === 'Restocking' ? "bg-amber-50 text-amber-650 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30" :
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(p);
                      }}
                      className="px-3 py-1.5 border border-amber-600/20 bg-amber-650/5 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider min-h-[38px] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Edit className="w-3 h-3" />
                      Modify
                    </button>
                    <button 
                      onClick={(e) => handleRequestDelete(p, e)}
                      className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider min-h-[38px] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'AVERAGE PRICE INDEX', value: `₹ ${formatINR(averagePrice)}`, icon: TrendingUp, delta: '+12% WoW' },
          { label: 'TOTAL SKU COUNT', value: String(products.length), icon: Package, delta: null },
          { label: 'REGIONAL HUBS', value: '05', icon: MapPin, delta: null },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
            transition={{ duration: 0.48, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-glass p-8 rounded-3xl flex flex-col justify-between h-[160px] border border-outline-variant/30 shadow-sm hover:border-primary/20 transition-all duration-300 interactive-card"
          >
             <div className="flex items-center justify-between">
              <stat.icon className="w-8 h-8 text-primary p-2 bg-primary/10 rounded-xl" />
              {stat.delta && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{stat.delta}</span>}
            </div>
            <div>
              <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-on-surface mt-1">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>
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
                Control scrolling banner slides, publish rate chart graphics, broadcast live new arrival announcements, and select today's featured hero product.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {publishSuccessMsg && (
                <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-3 py-2 rounded-xl border border-emerald-400/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {publishSuccessMsg}
                </span>
              )}
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

            {/* MODULE 1: Live Ticker Announcements ("New Product Arrived" Broadcasts) */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Header Ticker Marquee
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Live Broadcast Messages
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {adminTickerMessages.length} Messages
                </span>
              </div>

              {/* Add New Ticker Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTickerText.trim()) return;
                  const newT = {
                    id: `t-${Date.now()}`,
                    text: newTickerText.trim(),
                    active: true,
                    type: 'announcement'
                  };
                  setAdminTickerMessages(prev => [newT, ...prev]);
                  setNewTickerText('');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newTickerText}
                  onChange={(e) => setNewTickerText(e.target.value)}
                  placeholder="e.g. 🌾 NEW ARRIVAL: Premium Keshar Kali Stock Live!"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#143e2e] hover:bg-[#0e2f22] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  + Add Alert
                </button>
              </form>

              {/* Ticker List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {adminTickerMessages.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-50 dark:bg-[#07130e] border border-slate-200/80 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTickerMessages(prev =>
                            prev.map(x => x.id === t.id ? { ...x, active: !x.active } : x)
                          );
                        }}
                        className={cn(
                          "w-3 h-3 rounded-full shrink-0 cursor-pointer transition-all",
                          t.active ? "bg-emerald-500 shadow-xs" : "bg-slate-300 dark:bg-neutral-700"
                        )}
                        title={t.active ? "Click to deactivate" : "Click to activate"}
                      />
                      <span className={cn("font-medium truncate", t.active ? "text-slate-900 dark:text-white" : "text-slate-400 line-through")}>
                        {t.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminTickerMessages(prev => prev.filter(x => x.id !== t.id));
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* MODULE 2: Daily Rate Sheet Graphic & Banner */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Paddy & Rice Rate Sheet
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Rate Sheet Banner & Notice
                  </h3>
                </div>
              </div>

              {/* Graphic Banner Image URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Rate Sheet Banner Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminRateListGraphic?.imageUrl || ''}
                    onChange={(e) => setAdminRateListGraphic((prev: any) => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/25"
                  />
                </div>

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block pt-1">
                  Rate Announcement Summary / Note
                </label>
                <input
                  type="text"
                  value={adminRateListGraphic?.noticeText || ''}
                  onChange={(e) => setAdminRateListGraphic((prev: any) => ({ ...prev, noticeText: e.target.value }))}
                  placeholder="e.g. Daily market rates updated ex-mill Ludhiana & Mandi Bangalore."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/25"
                />
              </div>

              {/* Preview Box */}
              {adminRateListGraphic?.imageUrl && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                  <img
                    src={adminRateListGraphic.imageUrl}
                    alt="Rate Chart Preview"
                    className="w-14 h-14 object-cover rounded-xl border border-amber-400/40 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 text-xs space-y-0.5">
                    <span className="font-bold text-amber-900 dark:text-amber-300 block">
                      Live Rate Sheet Preview
                    </span>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70 truncate">
                      {adminRateListGraphic.noticeText || 'Notice text here'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* MODULE 3: Spotlight Hero Product Selection */}
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

            {/* MODULE 4: Hero Carousel Moving Window Banners */}
            <div className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Header Carousel
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Moving Image Banner Slides ({adminHeroSlides.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlide(null);
                    setSlideForm({
                      tagline: 'NEW HARVEST ARRIVED',
                      title: 'Premium Basmati & Daily Staples',
                      subtitle: 'Direct mill loading certified from APMC hubs.',
                      image: PRESET_GRAIN_IMAGES[0].url,
                      bgGradient: 'from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb] dark:from-[#0d2118] dark:via-[#11291f] dark:to-[#0c1e16]'
                    });
                    setIsSlideModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-[#143e2e] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Add Slide
                </button>
              </div>

              {/* List of Carousel Slides */}
              <div className="space-y-3">
                {adminHeroSlides.map((slide, idx) => (
                  <div
                    key={slide.id || idx}
                    className="p-3 bg-slate-50 dark:bg-[#07130e] border border-slate-200/80 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-neutral-800 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 text-left space-y-0.5">
                        <span className="text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400 block truncate">
                          {slide.tagline}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">
                          {slide.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {slide.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSlide(slide);
                          setSlideForm({
                            tagline: slide.tagline || '',
                            title: slide.title || '',
                            subtitle: slide.subtitle || '',
                            image: slide.image || '',
                            bgGradient: slide.bgGradient || 'from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb]'
                          });
                          setIsSlideModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminHeroSlides(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ADD / EDIT BANNER SLIDE MODAL */}
      <AnimatePresence>
        {isSlideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45 backdrop-blur-[4px]">
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="bg-white dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-left relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-normal text-slate-900 dark:text-white">
                  {editingSlide ? 'Edit Carousel Slide' : 'Add New Moving Banner Slide'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingSlide) {
                    setAdminHeroSlides(prev => prev.map(s => s.id === editingSlide.id ? { ...s, ...slideForm } : s));
                  } else {
                    const newS = {
                      id: `slide-${Date.now()}`,
                      ...slideForm
                    };
                    setAdminHeroSlides(prev => [...prev, newS]);
                  }
                  setIsSlideModalOpen(false);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Tagline Header
                  </label>
                  <input
                    type="text"
                    required
                    value={slideForm.tagline}
                    onChange={(e) => setSlideForm(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="e.g. 100% NATURALLY AGED"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Slide Headline / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={slideForm.title}
                    onChange={(e) => setSlideForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Silky Sona Masoori & Fragrant Jasmine"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Subtext Description
                  </label>
                  <input
                    type="text"
                    required
                    value={slideForm.subtitle}
                    onChange={(e) => setSlideForm(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Direct procurement with guaranteed APMC delivery."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Slide Image URL
                  </label>
                  <input
                    type="text"
                    required
                    value={slideForm.image}
                    onChange={(e) => setSlideForm(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSlideModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#143e2e] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#0e2f22] cursor-pointer"
                  >
                    Save Slide
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Select Supplier</label>
                  <select 
                    value={newProduct.supplier || suppliersList[0] || 'ANNAPURNA RICE & AGRO INDUSTRIES'}
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
                  <label className="text-[9px] font-black uppercase tracking-widest text-secondary block text-left">Select Supplier</label>
                  <select 
                    value={editingProduct.supplier || suppliersList[0] || 'ANNAPURNA RICE & AGRO INDUSTRIES'}
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
    </div>
  );
}
