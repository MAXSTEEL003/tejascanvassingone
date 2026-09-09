import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  ArrowRight, 
  Search, 
  Layers, 
  Warehouse, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  MapPin, 
  ShoppingBag,
  DollarSign,
  Briefcase,
  HelpCircle,
  Clock,
  Eye,
  Info,
  Sparkles,
  Award,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Calendar,
  Building,
  Check,
  X,
  Loader2,
  Percent,
  Filter,
  ArrowUpDown,
  Truck,
  Package,
  Scale,
  Droplets,
  BadgeCheck,
  Heart,
  Star,
  Menu,
  LayoutGrid,
  Home,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { auth, getCollectionDocs, setCollectionDoc, createLedgerEntriesForOrder, addCollectionDoc } from '../lib/firebase';
import { useCart } from '../context/CartContext';
import RicePouchGraphic from '../components/RicePouchGraphic';
import { getDeliveryLocations, getSelectedDeliveryLocationId, setSelectedDeliveryLocationId, DeliveryLocation } from '../utils/deliveryLocations';

// Static base products styled after Grainly reference collection
const BASE_PRODUCTS = [
  { 
    id: 'prod-basmati', 
    name: 'Organic Basmati Rice', 
    category: 'Basmati', 
    price: 5400, 
    pricePerKg: 320, 
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', 
    about: 'Aromatic. Fluffy. Exceptional. Naturally aged long grain.',
    tagline: 'Aromatic. Fluffy. Exceptional.',
    rating: 5.0,
    reviewsCount: 324,
    isBestSeller: true,
    variant: 'basmati' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  },
  { 
    id: 'prod-jasmine', 
    name: 'Jasmine Rice', 
    category: 'Jasmine', 
    price: 5200, 
    pricePerKg: 280,
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80', 
    about: 'Delicate aroma for everyday meals with a tender floral scent.',
    tagline: 'Delicate aroma for everyday meals.',
    rating: 4.9,
    reviewsCount: 218,
    isBestSeller: false,
    variant: 'jasmine' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  },
  { 
    id: 'prod-sona', 
    name: 'Sona Masoori Rice', 
    category: 'Sona Masoori', 
    price: 4900, 
    pricePerKg: 240,
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', 
    about: 'Light & Healthy. Easy to digest aged Indian staple.',
    tagline: 'Light & Healthy. Easy to digest.',
    rating: 4.9,
    reviewsCount: 196,
    isBestSeller: true,
    variant: 'sona' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  },
  { 
    id: 'prod-brown', 
    name: 'Brown Rice', 
    category: 'Brown', 
    price: 5100, 
    pricePerKg: 260,
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1596797882870-8c33deeac224?auto=format&fit=crop&w=600&q=80', 
    about: 'Whole Grain Goodness with unpolished nutritious outer bran.',
    tagline: 'Whole Grain Goodness. High fiber.',
    rating: 4.8,
    reviewsCount: 142,
    isBestSeller: false,
    variant: 'brown' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  },
  { 
    id: 'prod-sella', 
    name: '1121 Sella Rice', 
    category: 'Basmati', 
    price: 5400, 
    pricePerKg: 290,
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', 
    about: 'World-renowned extra long grain parboiled basmati rice with exceptional fluffiness.',
    tagline: 'Royal extra long grain. Superior elongation.',
    rating: 4.9,
    reviewsCount: 275,
    isBestSeller: true,
    variant: 'sella' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  },
  { 
    id: 'prod-keshar', 
    name: 'Organic Keshar Kali Rice', 
    category: 'Organic', 
    price: 6200, 
    pricePerKg: 310,
    unit: 'kg', 
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80', 
    about: 'Traditional fine grain heritage rice milled under natural organic standards.',
    tagline: 'Heritage harvest. Distinctive aroma.',
    rating: 4.9,
    reviewsCount: 163,
    isBestSeller: false,
    variant: 'raw' as const,
    defaultQty: 50,
    defaultBuyers: ['V.K FOODS'],
    supplier: 'ANNAPURNA RICE & AGRO INDUSTRIES'
  }
];

// Helper to provide commercial-grade grain specifications for B2B buyers
const getProductSpecs = (product: any) => {
  const cat = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();

  if (cat.includes('1121') || name.includes('1121')) {
    return {
      packaging: '26 KG / 50 KG BOPP Bags',
      grade: 'Extra Long 8.35 mm Sortex',
      moisture: '< 12.0% Max Moisture',
      dispatch: '24-48 Hrs Ex-Mill'
    };
  }
  if (cat.includes('sona masoori') || name.includes('sona')) {
    return {
      packaging: '26 KG Laminated Bags',
      grade: 'Aged 12+ Months Old Raw',
      moisture: '< 12.5% Max Moisture',
      dispatch: 'Immediate Ex-Mill'
    };
  }
  if (cat.includes('brown') || cat.includes('organic') || name.includes('brown')) {
    return {
      packaging: '25 KG Vacuum Sealed Bags',
      grade: '100% Unpolished Organic',
      moisture: '< 11.5% Max Moisture',
      dispatch: '24-48 Hrs Ex-Mill'
    };
  }
  return {
    packaging: '26 KG Branded Bags',
    grade: 'Silky Sortex (< 4% Broken)',
    moisture: '< 12.5% Max Moisture',
    dispatch: '24-48 Hrs Ex-Mill'
  };
};

const HERO_SLIDES = [
  {
    tagline: "FROM OUR FIELDS TO YOUR TABLE",
    title: "The Finest Rice for a Healthier Tomorrow",
    subtitle: "Premium aged Basmati & daily staples, directly certified from premier APMC milling centers.",
    badge: "🌾 Royal Harvest",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    bgGradient: "from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb] dark:from-[#0d2118] dark:via-[#11291f] dark:to-[#0c1e16]",
    badgeColor: "text-emerald-800 dark:text-emerald-300"
  },
  {
    tagline: "100% NATURALLY AGED & POLISHED",
    title: "Silky Sona Masoori & Fragrant Jasmine",
    subtitle: "Lightweight, aromatic texture trusted by premier restaurants and households.",
    badge: "✨ Master Grade Aroma",
    image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    bgGradient: "from-[#fef7ee] via-[#faead1] to-[#f5dfb8] dark:from-[#1c180e] dark:via-[#262013] dark:to-[#171309]",
    badgeColor: "text-amber-800 dark:text-amber-300"
  },
  {
    tagline: "UNPOLISHED FIBER & NUTRITION",
    title: "Organic Brown & Single-Origin Paddy",
    subtitle: "Full-bran whole grains packed with essential minerals and wholesome crunch.",
    badge: "🌱 100% Whole Grain",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
    bgGradient: "from-[#f4f7ed] via-[#e2ebd2] to-[#cddbb8] dark:from-[#141d11] dark:via-[#1c2717] dark:to-[#10170d]",
    badgeColor: "text-lime-800 dark:text-lime-300"
  },
  {
    tagline: "DIRECT MILL-TO-MERCHANT SETTLEMENT",
    title: "Wholesale APMC Lots & Guaranteed Delivery",
    subtitle: "Direct procurement with automated logistics tracking and verified digital receipts.",
    badge: "🚚 Direct Mill Logistics",
    image: "https://images.unsplash.com/photo-1610444319455-802521c750dc?auto=format&fit=crop&w=800&q=80",
    bgGradient: "from-[#ecf3f8] via-[#d6e7f2] to-[#bee0eb] dark:from-[#0d1c24] dark:via-[#122530] dark:to-[#0a151c]",
    badgeColor: "text-sky-800 dark:text-sky-300"
  }
];

export default function StoreManagement() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(() => {
    try {
      return localStorage.getItem('userRole') || 'merchant';
    } catch {
      return 'merchant';
    }
  });

  useEffect(() => {
    const handleRoleUpdate = () => {
      try {
        setUserRole(localStorage.getItem('userRole') || 'merchant');
      } catch {}
    };
    window.addEventListener('storage', handleRoleUpdate);
    window.addEventListener('role-changed', handleRoleUpdate);
    return () => {
      window.removeEventListener('storage', handleRoleUpdate);
      window.removeEventListener('role-changed', handleRoleUpdate);
    };
  }, []);

  const isLoggedIn = !!auth.currentUser || !!userRole;
  const isMerchant = userRole === 'merchant';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [dbProcurements, setDbProcurements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Dynamic Admin Store Config states
  const [heroSlides, setHeroSlides] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tejas_hero_slides');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return HERO_SLIDES;
  });

  const [tickerMessages, setTickerMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tejas_ticker_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 't1', text: '🌾 NEW ARRIVAL: Fresh Sona Masoori 2026 Batch Stock Arrived at APMC Yard!', active: true, type: 'new_arrival' },
      { id: 't2', text: '⚡ SPECIAL RATE TODAY: 1121 Sella Rice Ex-Mill Rate Updated', active: true, type: 'rate_update' },
      { id: 't3', text: '🚚 APMC EXPRESS DISPATCH: Guaranteed 24-48 Hr Mill Loading', active: true, type: 'announcement' }
    ];
  });

  const [rateListGraphic, setRateListGraphic] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tejas_rate_list_graphic');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.imageUrl) return parsed;
      }
    } catch {}
    return {
      imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
      title: 'Daily APMC Market Rate Chart',
      noticeText: 'Latest wholesale paddy & rice rates updated ex-mill Ludhiana & APMC Yard Bangalore.'
    };
  });

  const [heroProductId, setHeroProductId] = useState<string>(() => {
    return localStorage.getItem('tejas_hero_product_id') || 'prod-basmati';
  });

  const [showRateChartModal, setShowRateChartModal] = useState(false);

  // Sync Store Config from Firestore & LocalStorage
  useEffect(() => {
    async function loadStoreConfig() {
      try {
        const cloudDocs = await getCollectionDocs('store_config').catch(() => []);
        if (cloudDocs && cloudDocs.length > 0) {
          const mainConfig = cloudDocs.find((d: any) => d.id === 'main_config');
          if (mainConfig) {
            if (Array.isArray(mainConfig.heroSlides) && mainConfig.heroSlides.length > 0) {
              setHeroSlides(mainConfig.heroSlides);
              localStorage.setItem('tejas_hero_slides', JSON.stringify(mainConfig.heroSlides));
            }
            if (Array.isArray(mainConfig.tickerMessages) && mainConfig.tickerMessages.length > 0) {
              setTickerMessages(mainConfig.tickerMessages);
              localStorage.setItem('tejas_ticker_messages', JSON.stringify(mainConfig.tickerMessages));
            }
            if (mainConfig.rateListGraphic) {
              setRateListGraphic(mainConfig.rateListGraphic);
              localStorage.setItem('tejas_rate_list_graphic', JSON.stringify(mainConfig.rateListGraphic));
            }
            if (mainConfig.heroProductId) {
              setHeroProductId(mainConfig.heroProductId);
              localStorage.setItem('tejas_hero_product_id', mainConfig.heroProductId);
            }
          }
        }
      } catch (err) {
        console.warn('Unable to fetch cloud store config:', err);
      }
    }
    loadStoreConfig();

    const handleConfigUpdate = () => {
      try {
        const savedSlides = localStorage.getItem('tejas_hero_slides');
        if (savedSlides) setHeroSlides(JSON.parse(savedSlides));

        const savedTickers = localStorage.getItem('tejas_ticker_messages');
        if (savedTickers) setTickerMessages(JSON.parse(savedTickers));

        const savedRateList = localStorage.getItem('tejas_rate_list_graphic');
        if (savedRateList) setRateListGraphic(JSON.parse(savedRateList));

        const savedHero = localStorage.getItem('tejas_hero_product_id');
        if (savedHero) setHeroProductId(savedHero);
      } catch (e) {}
    };

    window.addEventListener('storage', handleConfigUpdate);
    window.addEventListener('store-config-updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('storage', handleConfigUpdate);
      window.removeEventListener('store-config-updated', handleConfigUpdate);
    };
  }, []);

  // Support & Complaint Box States
  const [compSubject, setCompSubject] = useState('');
  const [compMessage, setCompMessage] = useState('');
  const [isSubmittingComp, setIsSubmittingComp] = useState(false);
  const [compSuccessMsg, setCompSuccessMsg] = useState('');

  // Support & Complaint Box Submit Handler
  const handleSendComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compSubject.trim() || !compMessage.trim()) return;

    setIsSubmittingComp(true);
    setCompSuccessMsg('');

    try {
      const userEmail = auth.currentUser?.email || localStorage.getItem('userEmail') || 'merchant.test@riceaggregator.com';
      const userId = auth.currentUser?.uid || localStorage.getItem('userId') || 'unauthorized-merchant';
      const userName = localStorage.getItem('userName') || 'V.K FOODS';

      const ticket = {
        merchantId: userId,
        merchantName: userName,
        merchantEmail: userEmail,
        subject: compSubject.trim(),
        message: compMessage.trim(),
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      const result = await addCollectionDoc('complaints', ticket);
      setCompSuccessMsg(`Your support request has been logged successfully! Ticket ID: ${result?.id || 'TKT-' + Math.floor(Math.random() * 10000)}`);
      setCompSubject('');
      setCompMessage('');

      setTimeout(() => {
        setCompSuccessMsg('');
      }, 7000);
    } catch (err) {
      console.error('Error submitting support ticket:', err);
    } finally {
      setIsSubmittingComp(false);
    }
  };

  // Shopping Cart & Ordering States (Optimised for Quick Mobile Checkout using shared CartContext)
  const { items, isOpen: isCartOpen, setIsOpen: setIsCartOpen, addItem, removeItem, updateQty, clearCart } = useCart();

  const cart = React.useMemo(() => {
    return items.map(item => {
      const prod = productsList.find(p => p.id === item.id) || {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: 'Premium',
        about: '',
        unit: 'qtls'
      };
      return {
        product: prod,
        qty: item.qty
      };
    });
  }, [items, productsList]);

  const [loadingDays, setLoadingDays] = useState(3);
  const [buyerName, setBuyerName] = useState(() => {
    return localStorage.getItem('userName') || 'V.K FOODS';
  });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any[] | null>(null);
  const [cartStep, setCartStep] = useState<'edit' | 'review'>('edit');

  useEffect(() => {
    if (isCartOpen) {
      setCartStep('edit');
    }
  }, [isCartOpen]);
  
  const [addedProduct, setAddedProduct] = useState<{ id: string; name: string; qty: number } | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  
  // Custom Merchant Dashboard Tab & Name states
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-orders'>('catalog');
  const [isEditingBuyer, setIsEditingBuyer] = useState(false);
  const [tempBuyerName, setTempBuyerName] = useState('');

  // Grainly UI state: quantity per product, wishlist, search toggle, and carousel slide
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({
    'prod-1': 50,
    'prod-2': 50,
    'prod-3': 50,
    'prod-4': 50,
    'prod-5': 50,
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('user_wishlist') || '[]');
    } catch {
      return [];
    }
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-cycle hero carousel slides every 4.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const [qtyModalProduct, setQtyModalProduct] = useState<any | null>(null);
  const [modalQtyValue, setModalQtyValue] = useState<number>(10);

  const getProductQty = (productId: string): number => {
    return productQuantities[productId] ?? 10;
  };

  const setProductQty = (productId: string, val: number) => {
    const cleanVal = Math.max(1, isNaN(val) ? 1 : Math.floor(val));
    setProductQuantities(prev => ({ ...prev, [productId]: cleanVal }));
  };

  const openQtyModal = (product: any, initialQty?: number) => {
    setQtyModalProduct(product);
    setModalQtyValue(initialQty || getProductQty(product.id) || 10);
  };

  const toggleWishlist = (id: string) => {
    setWishlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('user_wishlist', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAddToCartProduct = (product: any, customQty?: number) => {
    const qty = customQty !== undefined ? customQty : getProductQty(product.id);
    const price = product.price || 3850;
    
    addItem({
      id: product.id,
      name: product.name,
      price: price,
      qty: qty,
      image: product.image,
      supplier: product.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES'
    }, false);

    setJustAddedId(product.id);
    setTimeout(() => {
      setJustAddedId(null);
    }, 1800);
  };

  const [isSupportOpen, setIsSupportOpen] = useState(false);
  
  // Extra buyer profile states
  const [phone, setPhone] = useState(() => localStorage.getItem('userPhone') || '');
  const [tempPhone, setTempPhone] = useState('');
  
  const [gstin, setGstin] = useState(() => localStorage.getItem('userGstin') || '');
  const [tempGstin, setTempGstin] = useState('');
  
  const [address, setAddress] = useState(() => localStorage.getItem('userAddress') || 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022');
  const [tempAddress, setTempAddress] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');

  // Synchronize temporary states
  useEffect(() => {
    setTempBuyerName(buyerName);
    setTempPhone(phone);
    setTempGstin(gstin);
    setTempAddress(address);
  }, [buyerName, phone, gstin, address, isEditingBuyer]);

  // Fetch Firestore details for current active merchant
  useEffect(() => {
    async function loadActiveMerchantProfile() {
      try {
        const userEmail = localStorage.getItem('userEmail') || auth.currentUser?.email || '';
        const currentUid = auth.currentUser?.uid;
        if (!userEmail && !currentUid) return;

        const docs = await getCollectionDocs('stakeholders').catch(() => []);
        if (docs && docs.length > 0) {
          const found = docs.find((d: any) => 
            (currentUid && d.id === currentUid) ||
            (userEmail && d.email?.toLowerCase() === userEmail.toLowerCase())
          );
          if (found) {
            const resolvedName = found.name || localStorage.getItem('userName') || 'Merchant Store';
            const resolvedPhone = found.phone || localStorage.getItem('userPhone') || '';
            const resolvedGstin = found.gstin || localStorage.getItem('userGstin') || '';
            const resolvedAddr = found.address || localStorage.getItem('userAddress') || 'APMC Yard, Yeshwanthpur, Bangalore';

            setBuyerName(resolvedName);
            setPhone(resolvedPhone);
            setGstin(resolvedGstin);
            setAddress(resolvedAddr);
            
            localStorage.setItem('userName', resolvedName);
            localStorage.setItem('userPhone', resolvedPhone);
            localStorage.setItem('userGstin', resolvedGstin);
            localStorage.setItem('userAddress', resolvedAddr);
          }
        }
      } catch (err) {
        console.warn('Error fetching active merchant profile:', err);
      }
    }
    loadActiveMerchantProfile();
  }, []);

  // Listen for storage events (e.g., from header profile updates) to keep active page states updated dynamically
  useEffect(() => {
    const handleStorageUpdate = () => {
      setBuyerName(localStorage.getItem('userName') || 'Merchant Store');
      setPhone(localStorage.getItem('userPhone') || '');
      setGstin(localStorage.getItem('userGstin') || '');
      setAddress(localStorage.getItem('userAddress') || 'APMC Yard, Yeshwanthpur, Bangalore');
    };
    
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('profile-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('profile-updated', handleStorageUpdate);
    };
  }, [setBuyerName]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileSuccessMessage('');
    try {
      const userEmail = localStorage.getItem('userEmail') || auth.currentUser?.email || 'merchant.test@riceaggregator.com';
      const currentUid = auth.currentUser?.uid || `usr-${Date.now()}`;
      
      const updatedStakeholder = {
        id: currentUid,
        name: tempBuyerName.trim() || 'V.K FOODS',
        type: 'buyers',
        phone: tempPhone.trim() || '9342380981',
        email: userEmail,
        gstin: tempGstin.trim().toUpperCase() || '29AAGCV7712M1ZP',
        address: tempAddress.trim() || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
        status: 'Active',
        credit: '₹ 80.0 Lakh',
        updatedAt: new Date().toISOString()
      };

      // 1. Save to Firestore
      await setCollectionDoc('stakeholders', currentUid, updatedStakeholder);

      // 2. Dual write state
      setBuyerName(updatedStakeholder.name);
      setPhone(updatedStakeholder.phone);
      setGstin(updatedStakeholder.gstin);
      setAddress(updatedStakeholder.address);

      // 3. Local Storage Sync
      localStorage.setItem('userName', updatedStakeholder.name);
      localStorage.setItem('userPhone', updatedStakeholder.phone);
      localStorage.setItem('userGstin', updatedStakeholder.gstin);
      localStorage.setItem('userAddress', updatedStakeholder.address);

      // 4. Update memory cache stakeholders_v2
      const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
      if (cached) {
        let updatedBuyers = cached.buyers || [];
        updatedBuyers = updatedBuyers.filter((b: any) => b.id !== currentUid && b.email?.toLowerCase() !== userEmail.toLowerCase());
        updatedBuyers.push(updatedStakeholder);
        cached.buyers = updatedBuyers;
        localStorage.setItem('stakeholders_v2', JSON.stringify(cached));
      }

      setProfileSuccessMessage('Enterprise profile persisted to cloud!');
      setTimeout(() => {
        setProfileSuccessMessage('');
        setIsEditingBuyer(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to write profile details to cloud:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Load products from inventory on mount and sync on updates
  useEffect(() => {
    const listProducts = async () => {
      try {
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

        const isDeleted = (p: any) => {
          if (!p) return true;
          const pid = String(p.id || '').trim().toLowerCase().replace(/^#/, '');
          const pName = String(p.name || '').trim().toLowerCase();
          return deletedSet.has(pid) || deletedSet.has(pName);
        };

        const live = await getCollectionDocs('product_inventory').catch(() => []);
        const rawLocal = localStorage.getItem('product_inventory');
        let local: any[] = [];
        if (rawLocal) {
          try {
            local = JSON.parse(rawLocal);
          } catch (e) {}
        }

        const combinedMap = new Map();
        local.forEach((p: any) => {
          if (p && !isDeleted(p)) combinedMap.set(p.id, p);
        });
        (live || []).forEach((p: any) => {
          if (p && !isDeleted(p)) combinedMap.set(p.id, p);
        });

        const activeList = Array.from(combinedMap.values());

        // Load registered suppliers to map supplier names accurately
        const rawStakeholders = localStorage.getItem('stakeholders_v2');
        let registeredSuppliers: any[] = [];
        if (rawStakeholders) {
          try {
            const parsed = JSON.parse(rawStakeholders);
            if (Array.isArray(parsed.suppliers)) registeredSuppliers = parsed.suppliers;
          } catch (e) {}
        }
        const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
        (cloudStakeholders || []).forEach((cs: any) => {
          if (cs && (cs.type === 'suppliers' || String(cs.id || '').startsWith('SUP')) && cs.name) {
            const exists = registeredSuppliers.find(s => s.id === cs.id);
            if (!exists) registeredSuppliers.push(cs);
          }
        });

        // Supplier resolver helper
        const resolveSupplier = (rawSupplier?: string, supplierId?: string) => {
          if (supplierId) {
            const match = registeredSuppliers.find(s => s.id === supplierId);
            if (match && match.name) return match.name;
          }
          if (rawSupplier) {
            const matchById = registeredSuppliers.find(s => s.id === rawSupplier);
            if (matchById && matchById.name) return matchById.name;
            const matchByName = registeredSuppliers.find(s => s.name?.trim().toLowerCase() === rawSupplier.trim().toLowerCase());
            if (matchByName && matchByName.name) return matchByName.name;
            return rawSupplier;
          }
          const primarySup = registeredSuppliers.find(s => s.status !== 'Inactive' && s.name);
          return primarySup ? primarySup.name : 'ANNAPURNA RICE & AGRO INDUSTRIES';
        };

        if (activeList.length > 0) {
          const mapped = activeList.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.brand || 'Premium',
            price: parseFloat(p.price) || 0,
            unit: p.unit || 'qtls',
            image: p.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBm-XMaGdzxCjePQf6HZQOYwr69Zxd_uImfU8ASz83aco_TNkafvvB-t0733UI0fDTWC3wi9pQSVnG9w3qwPRkWNJtZFfCchbPI9xjyqSb9veIK4ypfBYDZwvKvlc9BKauhSKHl5r33cNwMa_vB5-KtU-2NWfwjBT2BBro7NA2hMwxtu9OaCg4Od4Gp0_NkBdnV_kOLR5mkQnZZdf9IJ8vI_GZT2CJ0DED3KfwlWc2HJooTd6KuSiu0vEWJXK80aG9OVARp4OxxFi52',
            about: p.about || `Choice ${p.name} under ${p.brand || 'premium'} quality. Cultivated responsibly and milled using advanced methods.`,
            defaultQty: p.defaultQty || 500,
            defaultBuyers: p.defaultBuyers || ['Local Distributor', 'APMC Retailer'],
            supplier: resolveSupplier(p.supplier, p.supplierId)
          }));
          setProductsList(mapped);
        } else {
          // Strictly show only active inventory products. When empty, show No Products Available.
          setProductsList([]);
        }
      } catch (err) {
        console.error("Failed to load products from database:", err);
        setProductsList([]);
      }
    };
    listProducts();

    const handleInventoryChange = () => {
      listProducts();
    };

    window.addEventListener('storage', handleInventoryChange);
    window.addEventListener('inventory-updated', handleInventoryChange);
    window.addEventListener('stakeholders-updated', handleInventoryChange);
    return () => {
      window.removeEventListener('storage', handleInventoryChange);
      window.removeEventListener('inventory-updated', handleInventoryChange);
      window.removeEventListener('stakeholders-updated', handleInventoryChange);
    };
  }, []);

  // Stagger animation variables
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 35 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 14 } }
  };

  // Fetch Firestore + Local Storage orders & requests to auto-calculate dynamic buyers and quantities
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load placed orders
        const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        
        // Load procurement requests
        const cloudProcurements = await getCollectionDocs('procurement_requests').catch(() => []);
        const localProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');

        setDbOrders([...cloudPlaced, ...localPlaced]);
        setDbProcurements([...cloudProcurements, ...localProcurements]);
      } catch (err) {
        console.error('Failed to load store metadata:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute dynamic quantity & buyers list per product
  const getProductStats = (productName: string, baseQty: number, baseBuyers: string[]) => {
    let extraQty = 0;
    const extraBuyers = new Set<string>();

    // 1. Check procurement requests
    dbProcurements.forEach(item => {
      if (item.product && item.product.toLowerCase().trim() === productName.toLowerCase().trim()) {
        extraQty += parseFloat(item.qty) || 0;
        if (item.buyer) extraBuyers.add(item.buyer);
      }
    });

    // 2. Check placed orders
    dbOrders.forEach(item => {
      if (item.originalOrders && Array.isArray(item.originalOrders)) {
        item.originalOrders.forEach((orig: any) => {
          if (
            (item.items && item.items.toLowerCase().includes(productName.toLowerCase())) ||
            (orig.product && orig.product.toLowerCase().trim() === productName.toLowerCase().trim())
          ) {
            extraQty += parseFloat(orig.qty) || 0;
            if (orig.buyer) extraBuyers.add(orig.buyer);
          }
        });
      } else {
        const descMatch = item.items && item.items.toLowerCase().includes(productName.toLowerCase());
        const prodMatch = item.product && item.product.toLowerCase().trim() === productName.toLowerCase().trim();
        if (descMatch || prodMatch) {
          if (item.qty) {
            extraQty += parseFloat(item.qty) || 0;
          } else if (item.items) {
            const qtyRegex = /(\d+)\s*qtls/i.exec(item.items);
            if (qtyRegex) extraQty += parseFloat(qtyRegex[1]) || 0;
          }
          if (item.buyer) extraBuyers.add(item.buyer);
        }
      }
    });

    const finalBuyers = Array.from(new Set([...baseBuyers, ...Array.from(extraBuyers)]));
    return {
      qty: baseQty + extraQty,
      buyers: finalBuyers
    };
  };

  // Cart Actions (Optimised for easy mobile use with numeric increment/decrement helpers)
  const handleAddToCart = (product: any) => {
    const qty = productQuantities[product.id] || 50;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: qty,
      image: product.image,
      supplier: product.supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES'
    });
    
    // Set feedback states that let users choose when to open the cart
    setAddedProduct({ id: product.id, name: product.name, qty: qty });
    setJustAddedId(product.id);
    
    const btnTimeout = setTimeout(() => {
      setJustAddedId(null);
    }, 2000);

    const bannerTimeout = setTimeout(() => {
      setAddedProduct(null);
    }, 5000);

    return () => {
      clearTimeout(btnTimeout);
      clearTimeout(bannerTimeout);
    };
  };

  const handleUpdateCartQty = (productId: string, newQty: number) => {
    updateQty(productId, newQty);
  };

  const handleRemoveFromCart = (productId: string) => {
    removeItem(productId);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsPlacingOrder(true);

    try {
      // 1. Group cart items by supplier
      const itemsBySupplier: Record<string, typeof cart> = {};
      cart.forEach(item => {
        const supplier = item.product?.supplier || (item as any).supplier || 'ANNAPURNA RICE & AGRO INDUSTRIES';
        if (!itemsBySupplier[supplier]) {
          itemsBySupplier[supplier] = [];
        }
        itemsBySupplier[supplier].push(item);
      });

      const placedGroupedOrders: any[] = [];

      // 2. Generate separate PO for each supplier
      for (const [supplier, supplierItems] of Object.entries(itemsBySupplier)) {
        const batchId = `TC-${Math.floor(1000 + Math.random() * 9000)}`;
        const totalQty = supplierItems.reduce((sum, item) => sum + item.qty, 0);
        const totalAmt = supplierItems.reduce((sum, item) => sum + (item.qty * item.product.price), 0);

        // Sub items compatible with system schemas
        const subOrders = supplierItems.map(item => ({
          id: `TC-SUB-${Math.floor(100000 + Math.random() * 900000)}`,
          buyer: buyerName || 'V.K FOODS',
          qty: item.qty,
          rate: item.product.price,
          product: item.product.name,
          supplier: supplier,
          status: 'Placed',
          loadingDays: loadingDays
        }));

        const initials = (buyerName || 'V.K FOODS')
          .split(' ')
          .filter(Boolean)
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'VK';

        const avgRate = Number((totalAmt / (totalQty || 1)).toFixed(2));
        const firstProduct = supplierItems[0]?.product.name || 'Premium Rice';

        const groupedOrder = {
          id: batchId,
          date: (() => {
            const d = new Date();
            const day = d.getDate();
            const monthNames = [
              'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
            ];
            const m = monthNames[d.getMonth()];
            const yyyy = d.getFullYear();
            return `${day}-${m}-${yyyy}`;
          })(),
          items: `${supplierItems.map(si => `${si.product.name} (${si.qty} QTLS)`).join(', ')}`,
          total: `₹ ${formatINR(totalAmt)}`,
          status: 'Awaiting Settlement',
          progress: 5,
          origin: supplier.includes('ANNAPURNA') ? 'Ludhiana, PB' : supplier.includes('SAI TEJA') ? 'Nalgonda, TS' : 'Punjab Hub',
          destination: 'APMC Yard, Bangalore',
          buyer: buyerName || 'V.K FOODS',
          supplier: supplier,
          originalOrders: subOrders,
          purchaseOrderSent: true,
          purchaseOrderSentAt: new Date().toISOString(),
          loadingDays: loadingDays,
          gstin: gstin || '29AAGCV7712M1ZP',
          phone: phone || '9342380981',
          address: address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
          qty: totalQty,
          rate: avgRate,
          product: firstProduct,
          initials: initials,
          urgency: 'Standard',
          color: 'zinc'
        };

        // Save ONLY to active requests array (procurement_requests) so it shows up in main orders dashboard for admin approval
        const pendingOrder = {
          ...groupedOrder,
          status: 'Pending Approval'
        };

        await setCollectionDoc('procurement_requests', batchId, pendingOrder);

        const existingProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
        localStorage.setItem('procurement_requests', JSON.stringify([pendingOrder, ...existingProcurements]));

        placedGroupedOrders.push(pendingOrder);

        // Auto-dispatch WhatsApp & SMS notifications
        const storeBuyerPhone = phone || localStorage.getItem('userPhone') || '9342380981';
        const storeBuyerName = buyerName || localStorage.getItem('userName') || 'Merchant Store Buyer';
        const storeWhatsappMsg = `Hello ${storeBuyerName},\n\nYour procurement request ${batchId} for ${totalQty} QTLS (${firstProduct}) has been submitted successfully on Tejas Canvassing!\n\nSupplier: ${supplier}\nTotal: ₹ ${formatINR(totalAmt)}\n\nOur brokerage desk is processing your order.`;

        fetch('/api/dispatch-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: storeBuyerPhone,
            buyerName: storeBuyerName,
            message: storeWhatsappMsg
          })
        }).catch(err => console.warn('Store WhatsApp dispatch note:', err?.message || err));

        fetch('/api/dispatch-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: storeBuyerPhone,
            recipientName: storeBuyerName,
            message: `Tejas Canvassing: Procurement request ${batchId} for ${totalQty} QTLS has been registered. Total: ₹${formatINR(totalAmt)}.`
          })
        }).catch(err => console.warn('Store SMS dispatch note:', err?.message || err));
      }

      setIsCartOpen(false);
      setTimeout(() => {
        setOrderSuccess(placedGroupedOrders);
        clearCart();
      }, 350);

      // Refresh dynamic listings stats
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const cloudProcurements = await getCollectionDocs('procurement_requests').catch(() => []);
      const localProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      setDbOrders([...cloudPlaced, ...localPlaced]);
      setDbProcurements([...cloudProcurements, ...localProcurements]);

    } catch (error) {
      console.error('Error placing grouped orders', error);
      alert('An error occurred while placing your order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Extract clean categories for user filter pills
  const availableCategories = React.useMemo(() => {
    const set = new Set<string>();
    productsList.forEach(p => {
      const c = (p.category || '').toLowerCase();
      if (c.includes('1121')) set.add('1121 Sella');
      else if (c.includes('sona masoori') || c.includes('sona')) set.add('Sona Masoori');
      else if (c.includes('brown') || c.includes('organic')) set.add('Organic Brown');
      else if (c.includes('sella')) set.add('Sella Rice');
      else if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [productsList]);

  const filteredProducts = React.useMemo(() => {
    let list = productsList.filter(p => {
      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = !q || (
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.about || '').toLowerCase().includes(q) ||
        (p.supplier && (p.supplier || '').toLowerCase().includes(q))
      );

      let matchesCat = true;
      if (selectedCategory !== 'All') {
        const cat = (p.category || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        if (selectedCategory === 'Basmati' || selectedCategory === '1121 Sella') {
          matchesCat = cat.includes('basmati') || name.includes('basmati') || name.includes('1121') || name.includes('sella');
        } else if (selectedCategory === 'Jasmine') {
          matchesCat = cat.includes('jasmine') || name.includes('jasmine');
        } else if (selectedCategory === 'Sona Masoori') {
          matchesCat = cat.includes('sona') || name.includes('sona');
        } else if (selectedCategory === 'Brown') {
          matchesCat = cat.includes('brown') || name.includes('brown');
        } else if (selectedCategory === 'Organic') {
          matchesCat = cat.includes('organic') || name.includes('organic') || name.includes('keshar');
        } else {
          matchesCat = p.category === selectedCategory || cat.includes(selectedCategory.toLowerCase());
        }
      }

      return matchesSearch && matchesCat;
    });

    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }

    return list;
  }, [productsList, searchQuery, selectedCategory, sortBy]);

  // Filter merchant local orders
  const merchantOrdersList = React.useMemo(() => {
    const rawList = [...dbOrders, ...dbProcurements];
    // Deduplicate by id
    const uniqueMap = new Map();
    rawList.forEach(item => {
      if (item && item.id) {
        uniqueMap.set(item.id, item);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());
    const mName = (buyerName || '').trim().toLowerCase();
    
    // Filter strictly by matching buyerName
    const filtered = uniqueList.filter((order: any) => {
      const topBuyerMatch = order.buyer && typeof order.buyer === 'string' && order.buyer.trim().toLowerCase() === mName;
      const subBuyerMatch = order.originalOrders && Array.isArray(order.originalOrders) && 
        order.originalOrders.some((sub: any) => sub.buyer && typeof sub.buyer === 'string' && sub.buyer.trim().toLowerCase() === mName);
      return topBuyerMatch || subBuyerMatch;
    });

    // Sort newest first chronologically with high precision
    const parseCustomDate = (obj: any): number => {
      if (!obj) return 0;
      const dateStr = obj.purchaseOrderSentAt || obj.createdAt || obj.date;
      if (!dateStr) return 0;
      if (typeof dateStr === 'number') return dateStr;
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      return 0;
    };

    return filtered.sort((a, b) => {
      const timeA = parseCustomDate(a);
      const timeB = parseCustomDate(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [dbOrders, dbProcurements, buyerName]);

  // Total quantity ordered by local merchant
  const totalMerchantVolume = React.useMemo(() => {
    return merchantOrdersList.reduce((sum, order) => {
      let orderQty = 0;
      if (order.originalOrders && Array.isArray(order.originalOrders)) {
        orderQty = order.originalOrders.reduce((s: number, sub: any) => s + (parseFloat(sub.qty) || 0), 0);
      } else if (order.items) {
        const match = order.items.match(/(\d+)\s*QTLS/i);
        if (match) {
          orderQty = parseFloat(match[1]) || 0;
        }
      }
      return sum + orderQty;
    }, 0);
  }, [merchantOrdersList]);

  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>(() => getDeliveryLocations());
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => getSelectedDeliveryLocationId());
  const [isDispatchSelectorOpen, setIsDispatchSelectorOpen] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleUpdate = () => {
      setDeliveryLocations(getDeliveryLocations());
      setSelectedLocationId(getSelectedDeliveryLocationId());
    };
    window.addEventListener('delivery_locations_updated', handleUpdate);
    window.addEventListener('selected_delivery_location_changed', handleUpdate);
    return () => {
      window.removeEventListener('delivery_locations_updated', handleUpdate);
      window.removeEventListener('selected_delivery_location_changed', handleUpdate);
    };
  }, []);

  const STORE_CATEGORIES = [
    { id: 'All', label: 'All Varieties' },
    { id: 'Basmati', label: 'Basmati' },
    { id: 'Sona Masoori', label: 'Sona Masoori' },
    { id: 'Jasmine', label: 'Jasmine' },
    { id: 'Brown', label: 'Brown Rice' },
    { id: 'Organic', label: 'Organic' }
  ];

  // Restrict Store strictly to Merchant role (admin and employee cannot browse store)
  if (userRole === 'admin' || userRole === 'employee' || userRole === 'officer') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white dark:bg-[#111915] border border-amber-900/15 dark:border-amber-950/40 p-8 rounded-3xl shadow-xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Restricted Portal Access
            </span>
            <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
              Merchant Store Only
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              The TEJAS CANVASSING B2B Store catalog and ordering flow can only be accessed by verified <strong>Merchants & Wholesale Buyers</strong>. Administrators and Staff manage order fulfilment and inventory from the Operations Dashboard.
            </p>
          </div>
          <div className="pt-3 flex flex-col gap-2.5">
            <button
              onClick={() => {
                localStorage.setItem('userRole', 'merchant');
                localStorage.setItem('userName', 'V.K FOODS');
                window.dispatchEvent(new Event('role-changed'));
                window.dispatchEvent(new Event('storage'));
                navigate('/store');
              }}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              Switch to Merchant (View Store)
            </button>
            <button
              onClick={() => navigate(userRole === 'admin' ? '/dashboard' : '/inventory')}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Return to {userRole === 'admin' ? 'Admin Dashboard' : 'Staff Inventory'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[85vh] w-full flex items-center justify-center p-6 relative overflow-hidden font-sans select-none" style={{ background: "radial-gradient(circle at 50% 30%, #0d2318 0%, #06100c 100%)" }}>
        {/* Ambient Glowing Glass Orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Apple Glass Frosted Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-sm w-full bg-white/10 dark:bg-emerald-950/40 border border-white/25 dark:border-amber-400/30 p-8 rounded-3xl shadow-[0_16px_48px_0_rgba(0,0,0,0.4)] backdrop-blur-2xl text-center space-y-6"
        >
          {/* Logo with Glowing Aura */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-400 to-emerald-500 animate-spin blur-md opacity-60" style={{ animationDuration: '4s' }} />
            <div className="relative w-16 h-16 rounded-2xl bg-[#0d2318] border border-amber-400/50 p-2 shadow-inner flex items-center justify-center">
              <img src="/logo.png" alt="Tejas Canvassing Logo" className="w-12 h-12 object-contain rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-wider text-white font-serif uppercase">
              TEJAS CANVASSING
            </h2>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-300">
              Est. 2008 · M. Adinarayan
            </p>
          </div>

          {/* Loading Bar & Pulse Indicator */}
          <div className="space-y-3.5 pt-2">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5 border border-white/15">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400 rounded-full"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/80 font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Syncing APMC Store Catalog & Live Rates...</span>
            </div>
          </div>

          <div className="text-[10px] text-white/50 tracking-widest uppercase border-t border-white/10 pt-3">
            Keshar Kali · JMR · Simha Flagship Lines
          </div>
        </motion.div>
      </div>
    );
  }

  const activeDeliveryLocation = deliveryLocations.find(l => l.id === selectedLocationId) || deliveryLocations[0];

  return (
    <div className="w-full bg-[#fafaf9] dark:bg-[#07100c] font-sans overflow-x-hidden p-0 relative transition-colors duration-300 text-slate-900 dark:text-slate-100 pb-28 sm:pb-32">
      
      {/* --- PHONE APP MAIN CONTENT CONTAINER --- */}
      <div className="w-full px-3 py-3 space-y-3.5">

        {/* --- COMPACT USER GREETING & STATUS ROW --- */}
        <div className="space-y-2">
          {/* Greeting: "Hi, Company Name" */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Hi,</span>
              <span className="text-emerald-700 dark:text-emerald-400">{buyerName || 'TEJAS CANVASSING'}</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Trade Hub
            </span>
          </div>

          {/* Controls: Destination Selector & Search Bar */}
          <div className="flex flex-row items-center gap-2">
            {/* Dispatch Destination Selector Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsDispatchSelectorOpen(prev => !prev)}
                className="group inline-flex items-center gap-1.5 bg-white dark:bg-[#0c1813] hover:bg-slate-50 dark:hover:bg-[#11221b] border border-slate-200/90 dark:border-neutral-800 px-2 py-1.5 rounded-xl text-xs shadow-2xs transition-all cursor-pointer text-left"
                title="Change Delivery Destination"
              >
                <div className="w-5 h-5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  {activeDeliveryLocation?.type === 'Godown' ? (
                    <Warehouse className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div className="flex flex-col text-left min-w-0 pr-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    Dispatch To
                  </span>
                  <span className="font-bold text-[11px] text-slate-900 dark:text-white truncate max-w-[85px] xs:max-w-[110px] mt-0.5">
                    {activeDeliveryLocation?.name || 'Main Delivery Hub'}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition-transform duration-200 shrink-0",
                  isDispatchSelectorOpen ? "rotate-180 text-emerald-600" : ""
                )} />
              </button>

              {/* Dropdown Menu for Saved Destinations */}
              <AnimatePresence>
                {isDispatchSelectorOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDispatchSelectorOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-1.5 w-64 xs:w-72 bg-white dark:bg-[#071510] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 z-50 space-y-1 text-left"
                    >
                      <div className="px-2 py-1 border-b border-slate-100 dark:border-neutral-800/80 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Saved Destinations
                        </span>
                        <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {deliveryLocations.length} Available
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 py-1 no-scrollbar scrollbar-none">
                        {deliveryLocations.map((loc) => {
                          const isSelected = loc.id === (activeDeliveryLocation?.id || selectedLocationId);
                          return (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => {
                                setSelectedLocationId(loc.id);
                                setSelectedDeliveryLocationId(loc.id);
                                setIsDispatchSelectorOpen(false);
                              }}
                              className={cn(
                                "w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-1.5 cursor-pointer border",
                                isSelected
                                  ? "bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-950 dark:text-white"
                                  : "hover:bg-slate-50 dark:hover:bg-neutral-800/60 border-transparent text-slate-700 dark:text-slate-300"
                              )}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-xs truncate">{loc.name}</span>
                                  <span className={cn(
                                    "text-[8px] font-extrabold uppercase px-1 py-0.2 rounded font-mono",
                                    loc.type === 'Godown' ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  )}>
                                    {loc.type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">
                                  {loc.address}
                                </p>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
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

            {/* Integrated Search Bar & View Rates Button */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0 flex items-center">
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Basmati, Sona..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/25 shadow-2xs transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 w-4 h-4 flex items-center justify-center text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer rounded-full bg-slate-100 dark:bg-neutral-800"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowRateChartModal(true)}
                className="shrink-0 px-3 py-1.5 bg-[#143e2e] dark:bg-emerald-600 hover:bg-[#0d2b20] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border border-emerald-700/40"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">View Daily Rates</span>
                <span className="sm:hidden">Rates</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- LIVE SCROLLING ANNOUNCEMENT TICKER BAR (Controlled by Admin) --- */}
        {tickerMessages.some((t: any) => t.active !== false) && (
          <div className="w-full bg-[#143e2e] text-white rounded-xl px-3 py-1.5 shadow-xs flex items-center gap-2 overflow-hidden border border-emerald-800/50">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/20 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
              Live Alert
            </span>
            <div className="flex-1 overflow-hidden relative">
              <div className="animate-marquee whitespace-nowrap inline-flex items-center gap-6 text-[11px] font-medium text-emerald-100">
                {tickerMessages.filter((t: any) => t.active !== false).map((t: any, idx: number) => (
                  <span key={t.id || idx} className="inline-flex items-center gap-1.5">
                    <span>{t.text}</span>
                    <span className="text-emerald-500 font-mono">•</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- DAILY MARKET RATE SHEET BANNER (Controlled by Admin) --- */}
        {rateListGraphic && rateListGraphic.imageUrl && (
          <div className="w-full bg-amber-50 dark:bg-[#15120a] border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-amber-300/60 shadow-xs">
                <img
                  src={rateListGraphic.imageUrl}
                  alt={rateListGraphic.title || 'Rate Chart'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 space-y-0.5 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-950/80 px-1.5 py-0.2 rounded font-mono">
                    Daily Rates
                  </span>
                  <span className="text-[9px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                    Updated Today
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-amber-100 truncate">
                  {rateListGraphic.title || 'Daily Market Rate Sheet'}
                </h3>
                <p className="text-[10px] text-slate-600 dark:text-amber-200/70 truncate">
                  {rateListGraphic.noticeText || 'Click View Rates to compare yesterday vs today pricing'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRateChartModal(true)}
              className="shrink-0 px-2.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <Eye className="w-3 h-3" />
              <span>View Rates</span>
            </button>
          </div>
        )}

        {/* --- COMPACT FEATURED HERO CAROUSEL (Controlled by Admin) --- */}
        {heroSlides && heroSlides.length > 0 && (
          <div className={cn(
            "relative w-full rounded-2xl overflow-hidden shadow-xs border border-emerald-900/10 dark:border-emerald-900/30 transition-all duration-500 bg-gradient-to-r",
            (heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).bgGradient || "from-[#ebf5ef] via-[#d7edd9] to-[#c1e2cb]"
          )}>
            <div className="relative z-10 p-3 flex flex-row items-center justify-between gap-2.5">
              {/* Left Editorial Copy */}
              <div className="space-y-1 text-left flex-1 min-w-0">
                <span className="text-[8px] font-extrabold tracking-wider text-[#0e4835] dark:text-emerald-400 uppercase block truncate">
                  {(heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).tagline}
                </span>

                <h2 className="font-serif italic text-base sm:text-lg font-normal text-[#0a3526] dark:text-emerald-50 tracking-tight leading-tight line-clamp-1">
                  {(heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).title}
                </h2>

                <p className="text-[10px] text-slate-700 dark:text-emerald-200/80 font-medium line-clamp-1 leading-snug">
                  {(heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).subtitle}
                </p>

                <div className="pt-0.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('rice-collection');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0e4835] hover:bg-[#093526] active:scale-95 text-white font-bold text-[9.5px] rounded-full shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Shop</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                      className="p-1 rounded-full bg-white/70 dark:bg-black/30 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                      title="Previous Slide"
                    >
                      <ChevronLeft className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSlide(prev => (prev + 1) % heroSlides.length)}
                      className="p-1 rounded-full bg-white/70 dark:bg-black/30 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                      title="Next Slide"
                    >
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Cycling Image */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 aspect-square flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeSlide}
                      src={(heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).image}
                      alt={(heroSlides[activeSlide % heroSlides.length] || HERO_SLIDES[0]).title}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-full object-cover rounded-full shadow-md border-2 border-white/90 dark:border-emerald-950/80"
                      referrerPolicy="no-referrer"
                    />
                  </AnimatePresence>
                </div>

                {/* Dots */}
                <div className="flex items-center gap-1 mt-1.5">
                  {heroSlides.map((_: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      className={cn(
                        "h-1 rounded-full transition-all cursor-pointer",
                        (activeSlide % heroSlides.length) === idx 
                          ? "w-3 bg-[#0e4835] dark:bg-emerald-400" 
                          : "w-1 bg-slate-300 dark:bg-neutral-700"
                      )}
                      title={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- HORIZONTAL CATEGORY CHIPS (Mobile App Native: smooth horizontal swipe, no side lines) --- */}
        <div className="w-full overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar scrollbar-none scroll-smooth select-none">
            {STORE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs flex items-center gap-1 active:scale-95 shrink-0",
                    isSelected
                      ? "bg-[#0e4835] dark:bg-emerald-600 text-white shadow-xs"
                      : "bg-white dark:bg-[#0c1813] text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-850"
                  )}
                >
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- SECTION HEADER: OUR RICE COLLECTION --- */}
        <div id="rice-collection" className="flex items-center justify-between pt-1">
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-normal text-slate-900 dark:text-white tracking-tight leading-tight">
              Our Rice Collection
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {filteredProducts.length} Premium Wholesale Varieties
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#0e4835] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <span>All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* --- MOBILE PRODUCT CARDS (2-Column Phone App Layout) --- */}
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center space-y-3 bg-white dark:bg-[#0c1813] rounded-3xl border border-dashed border-slate-200 dark:border-neutral-800 p-8 shadow-xs">
            <div className="w-12 h-12 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-xs">
              <Store className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">No Products Available</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                Currently, there are no grain products listed in the store catalog. Products added by the administrator in Product Inventory will appear here for purchase.
              </p>
            </div>
            {selectedCategory !== 'All' || searchQuery.trim() !== '' ? (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-1 px-4 py-2 bg-[#0e4835] hover:bg-[#0a3526] text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
              >
                Reset Search Filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {filteredProducts.map((product) => {
              const currentQty = getProductQty(product.id);
              const unitPrice = product.price || 3850;
              const isFavorited = wishlist.includes(product.id);
              const inCartItem = items.find(i => i.id === product.id);

              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-[#0c1813] rounded-2xl border border-slate-200/80 dark:border-neutral-800/80 shadow-2xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden relative group"
                >
                  {/* Top Image Graphic Area */}
                  <div className="relative w-full overflow-hidden bg-[#fbfbfa] dark:bg-[#12221b]">
                    {/* Hero Product of the Day Badge (Set by Admin) */}
                    {(product.id === heroProductId || String(product.id).toLowerCase() === String(heroProductId).toLowerCase()) && (
                      <span className="absolute top-2 left-2 z-20 bg-amber-500 text-slate-950 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-amber-300 animate-pulse">
                        <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                        Hero Product
                      </span>
                    )}

                    {/* Best Seller Pill Badge (If not Hero) */}
                    {product.isBestSeller && !(product.id === heroProductId || String(product.id).toLowerCase() === String(heroProductId).toLowerCase()) && (
                      <span className="absolute top-2 left-2 z-20 bg-[#0e4835] text-white text-[7.5px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        Best Seller
                      </span>
                    )}

                    {/* Wishlist Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-white/85 dark:bg-black/40 backdrop-blur-xs text-slate-400 hover:text-rose-500 transition-colors shadow-xs cursor-pointer"
                      title={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
                    >
                      <Heart className={cn("w-3.5 h-3.5 transition-transform active:scale-125", isFavorited ? "fill-rose-500 text-rose-500" : "")} />
                    </button>

                    {/* Grainly Stand-up Pouch Sack and Rice Bowl Graphic */}
                    <RicePouchGraphic 
                      name={product.name} 
                      variant={product.variant || 'basmati'} 
                      isBrownRice={(product.category || '').toLowerCase().includes('brown') || (product.name || '').toLowerCase().includes('brown')}
                    />
                  </div>

                  {/* Card Editorial Content */}
                  <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1">
                    <div>
                      {/* Mill Name toggling card expansion */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCardIds(prev => ({ ...prev, [product.id]: !prev[product.id] }));
                        }}
                        className="w-full flex items-center justify-between gap-1 text-left cursor-pointer mb-0.5 pb-0.5 border-b border-dashed border-slate-200/80 dark:border-neutral-800"
                        title="Click to view full grain specifications"
                      >
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
                          {product.supplier || 'ANNAPURNA RICE MILL'}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-slate-400 shrink-0">
                          {expandedCardIds[product.id] ? 'Hide' : 'Specs'}
                          <ChevronDown className={cn("w-2 h-2 transition-transform duration-200", expandedCardIds[product.id] ? "rotate-180 text-emerald-600" : "")} />
                        </span>
                      </button>

                      <h3 
                        onClick={() => {
                          setExpandedCardIds(prev => ({ ...prev, [product.id]: !prev[product.id] }));
                        }}
                        className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1 leading-snug cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      >
                        {product.name}
                      </h3>
                      
                      {/* 5-Star Rating */}
                      <div className="flex items-center gap-0.5 mt-0.5 text-amber-400">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span className="text-[9.5px] text-slate-600 dark:text-slate-300 font-bold ml-0.5">
                          5.0
                        </span>
                        <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-medium ml-0.5">
                          ({product.reviewsCount || 210})
                        </span>
                      </div>

                      {/* Price Display */}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                          ₹{formatINR(unitPrice)}
                        </span>
                        <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-medium">
                          / Qty
                        </span>
                      </div>

                      {/* Expanded Grain Specifications */}
                      <AnimatePresence>
                        {expandedCardIds[product.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-1.5 pt-1.5 border-t border-slate-100 dark:border-neutral-800 text-left space-y-1"
                          >
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl p-2 border border-emerald-500/20 space-y-1 text-[8.5px]">
                              <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-300">
                                <span className="flex items-center gap-1">
                                  <BadgeCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  Grade
                                </span>
                                <span className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-mono text-[7.5px] font-bold">
                                  LOT-A+
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1 pt-0.5 text-slate-600 dark:text-slate-300">
                                <div>
                                  <span className="text-slate-400 block text-[7.5px]">Grain</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {product.variant === 'basmati' ? '8.35 mm' : product.variant === 'jasmine' ? '7.15 mm' : '5.40 mm'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[7.5px]">Moisture</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">&lt; 12%</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mobile App Cart Action: Interactive Stepper or + ADD button with Quantity Selector */}
                    <div className="pt-1">
                      {inCartItem ? (
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-0.5 h-7 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (inCartItem.qty <= 5) {
                                removeItem(product.id);
                              } else {
                                updateQty(product.id, inCartItem.qty - 5);
                              }
                            }}
                            className="w-6.5 h-full flex items-center justify-center font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 rounded-lg active:scale-95 text-xs select-none cursor-pointer"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => openQtyModal(product, inCartItem.qty)}
                            className="font-mono font-black text-[10.5px] text-emerald-900 dark:text-emerald-200 px-1 hover:underline cursor-pointer"
                            title="Click to edit quantity"
                          >
                            {inCartItem.qty} QTLS
                          </button>
                          <button
                            type="button"
                            onClick={() => updateQty(product.id, inCartItem.qty + 5)}
                            className="w-6.5 h-full flex items-center justify-center font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 rounded-lg active:scale-95 text-xs select-none cursor-pointer"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 w-full">
                          {/* Compact inline quantity adjuster */}
                          <div className="flex items-center bg-slate-100 dark:bg-[#081510] border border-slate-200/90 dark:border-emerald-950/60 rounded-lg p-0.5 h-7">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = getProductQty(product.id);
                                const next = Math.max(1, current - (current > 10 ? 5 : 1));
                                setProductQty(product.id, next);
                              }}
                              className="w-4 sm:w-4.5 h-full flex items-center justify-center font-black text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs cursor-pointer select-none"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openQtyModal(product, getProductQty(product.id));
                              }}
                              className="px-1 font-mono font-black text-[10px] text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer"
                              title="Click to select exact quantity"
                            >
                              {getProductQty(product.id)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = getProductQty(product.id);
                                const next = current + (current >= 10 ? 5 : 1);
                                setProductQty(product.id, next);
                              }}
                              className="w-4 sm:w-4.5 h-full flex items-center justify-center font-black text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs cursor-pointer select-none"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          {/* ADD Button with chosen quantity */}
                          <button
                            type="button"
                            onClick={() => handleAddToCartProduct(product)}
                            className="flex-1 py-1 px-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10.5px] flex items-center justify-center gap-0.5 shadow-2xs transition-all cursor-pointer active:scale-95 h-7"
                            title={`Add ${getProductQty(product.id)} QTLS`}
                          >
                            <Plus className="w-3 h-3 shrink-0" />
                            <span>ADD</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- COLLAPSIBLE SUPPORT DESK CARD --- */}
        {isMerchant && (
          <div className="bg-white dark:bg-[#0c1813] rounded-2xl border border-slate-200/80 dark:border-neutral-800 shadow-2xs overflow-hidden text-left mt-3">
            <button
              type="button"
              onClick={() => setIsSupportOpen(prev => !prev)}
              className="w-full p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-850/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Direct Procurement Desk
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                <span>{isSupportOpen ? 'Close' : 'Need Help?'}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isSupportOpen ? "rotate-180" : "")} />
              </div>
            </button>

            <AnimatePresence>
              {isSupportOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-neutral-800/80 space-y-2.5"
                >
                  {compSuccessMsg && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>{compSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSendComplaint} className="space-y-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Subject / Concern
                      </label>
                      <input
                        type="text"
                        required
                        value={compSubject}
                        onChange={(e) => setCompSubject(e.target.value)}
                        placeholder="e.g. Bulk dispatch request, rate inquiry"
                        className="w-full bg-slate-50 dark:bg-neutral-850 border border-slate-200 dark:border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Message
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={compMessage}
                        onChange={(e) => setCompMessage(e.target.value)}
                        placeholder="Write your note or question..."
                        className="w-full bg-slate-50 dark:bg-neutral-850 border border-slate-200 dark:border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end pt-0.5">
                      <button
                        type="submit"
                        disabled={isSubmittingComp}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingComp ? "Sending..." : "Submit Inquiry"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Minimal App Footer */}
        <footer className="w-full py-4 text-center text-slate-400 dark:text-slate-500 text-[10px] font-medium space-y-0.5">
          <p className="font-black text-slate-700 dark:text-slate-300">TEJAS CANVASSING</p>
          <p>Wholesale Rice Canvassing & Trade Platform</p>
        </footer>

      </div>



      {/* Thank you for ordering Split Confirmation Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none p-4 md:py-12 py-4 font-sans">
          <div 
            onClick={() => setOrderSuccess(null)}
            className="fixed inset-0 bg-[#06140d]/80 backdrop-blur-md transition-opacity" 
          />

          <motion.div 
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-2xl bg-[#fafdfb] dark:bg-[#06140d] border border-emerald-500/15 dark:border-emerald-950/60 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden z-10"
          >
            {/* Top Confetti Ambient glow */}
            <div className="absolute top-[-30%] left-[-10%] w-[120%] h-[50%] bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

            <div className="text-center space-y-2 relative z-10">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/80 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 dark:text-white tracking-tight">
                Thank You For Your Order!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Your B2B procurement order has been partitioned and routed to the corresponding rice mills:
              </p>
            </div>

            {/* Split Orders details */}
            <div className="space-y-4 relative z-10 max-h-[320px] overflow-y-auto pr-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/70 dark:text-emerald-300/60 border-b border-emerald-500/15 dark:border-emerald-950/30 pb-2">
                Partitioned Split Grouping Logs ({orderSuccess.length} Separate Purchases)
              </p>

              {orderSuccess.map((order) => (
                <div key={order.id} className="p-4 bg-white dark:bg-[#071911] border border-emerald-500/10 dark:border-emerald-950/45 rounded-2xl shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-emerald-900/80 dark:text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-lg">
                      ORDER ID: <span className="text-emerald-600 font-mono">{order.id}</span>
                    </span>
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Awaiting Settlement
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-emerald-900/70 dark:text-emerald-300/70">
                    <div>
                      <p className="text-[8px] font-black uppercase text-emerald-900/40 leading-none">Grain Products</p>
                      <p className="font-bold text-emerald-950 dark:text-emerald-50 mt-1">{order.items}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-emerald-900/40 leading-none">Supplier Mill</p>
                      <p className="font-bold text-emerald-650 dark:text-emerald-400 mt-1 uppercase font-mono tracking-tight">{order.supplier}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-500/10 dark:border-emerald-950/20 grid grid-cols-3 gap-2 text-[10px] font-bold">
                    <div>
                      <p className="text-[8px] font-black uppercase text-emerald-900/40 font-bold">Buyer</p>
                      <p className="text-emerald-950 dark:text-emerald-100">{order.buyer}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-emerald-900/40 font-bold">Loading Limit</p>
                      <p className="text-emerald-950 dark:text-emerald-100 font-mono">{order.loadingDays} Days</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase text-emerald-900/40 font-bold">Group Total</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-black font-mono">{order.total}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete action */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 relative z-10 justify-end">
              <button
                type="button"
                onClick={() => navigate('/placed-orders')}
                className="w-full sm:w-auto px-5 py-3 border border-emerald-500/20 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/10 font-bold rounded-2xl text-xs uppercase tracking-widest text-center cursor-pointer"
              >
                View My Placed Orders
              </button>
              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#0b1c12] dark:bg-emerald-100 text-[#faf8f5] dark:text-[#0e0c0a] font-black rounded-2xl text-xs uppercase tracking-widest text-center cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Non-intrusive floating success toast when grain added to bag */}
      {addedProduct && (
        <div className="fixed bottom-24 right-4 sm:right-6 lg:right-8 z-50 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0b1c12] dark:bg-[#071911] text-[#fafdfb] dark:text-[#ebfdf5] p-4 rounded-2xl shadow-2xl border border-emerald-500/20 dark:border-emerald-950/20 flex items-center gap-3 max-w-sm"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/20">
              <Check className="w-4 h-4" />
            </div>
            <div className="text-left font-sans min-w-0 pr-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-450 dark:text-emerald-400 leading-none mb-1">Successfully Added</p>
              <p className="text-xs font-black leading-tight truncate">
                {addedProduct.qty} QTLS of {addedProduct.name}
              </p>
              <p className="text-[10px] text-emerald-200/50 dark:text-emerald-100/50 mt-0.5 leading-normal">
                Review inside bag when ready.
              </p>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 cursor-pointer font-sans"
            >
              Open Bag
            </button>
          </motion.div>
        </div>
      )}

      {/* Small Floating Cart Icon to Open Cart with live count & subtotal */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.button
            id="store-floating-cart-btn"
            initial={{ scale: 0, opacity: 0, y: 15 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              y: 0,
              transition: { type: "spring", stiffness: 450, damping: 25 }
            }}
            exit={{ scale: 0, opacity: 0, y: 15 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCartOpen(true)}
            className={cn(
              "fixed bottom-20 right-3.5 sm:right-6 z-40 bg-[#143e2e] dark:bg-emerald-600 text-white rounded-full p-2.5 pl-3 pr-3.5 shadow-[0_12px_32px_rgba(20,62,46,0.38)] dark:shadow-[0_12px_32px_rgba(16,185,129,0.38)] border border-emerald-400/30 flex items-center gap-2 cursor-pointer font-sans select-none backdrop-blur-md transition-all",
              justAddedId && "ring-4 ring-emerald-400/60 scale-105"
            )}
            title="Open Bag & Review Order"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4 text-emerald-100" />
              <span className="absolute -top-2 -right-2.5 bg-rose-500 text-white text-[8.5px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                {items.reduce((sum, item) => sum + item.qty, 0)}
              </span>
            </div>
            <div className="text-left flex flex-col leading-none">
              <span className="text-[10px] font-bold text-white tracking-tight">Open Bag</span>
              <span className="text-[8px] font-mono font-medium text-emerald-200">
                ₹{formatINR(items.reduce((acc, item) => acc + item.price * item.qty, 0))}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quick Wholesale Quantity Selector Modal */}
      <AnimatePresence>
        {qtyModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQtyModalProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#07130e] border border-slate-200 dark:border-emerald-950/80 rounded-2xl p-4 shadow-2xl space-y-3.5 font-sans z-10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Wholesale Order Quantity
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                    {qtyModalProduct.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    ₹{formatINR(qtyModalProduct.price || 3850)} / Quintal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQtyModalProduct(null)}
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Quick preset chips */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Quick Select Preset (Quintals)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 25, 50, 100, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setModalQtyValue(preset)}
                      className={cn(
                        "py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer select-none",
                        modalQtyValue === preset
                          ? "bg-[#143e2e] dark:bg-emerald-600 text-white border-transparent shadow-xs"
                          : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500"
                      )}
                    >
                      {preset} Q
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom interactive Stepper */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Adjust Quantity (Quintals)
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => Math.max(1, prev - 10))}
                    className="px-2 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg hover:text-emerald-600 cursor-pointer active:scale-95"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => Math.max(1, prev - 1))}
                    className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg hover:text-emerald-600 cursor-pointer active:scale-95"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={modalQtyValue}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setModalQtyValue(isNaN(v) ? 1 : Math.max(1, v));
                    }}
                    className="flex-1 text-center font-mono font-black text-base bg-transparent text-slate-900 dark:text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => prev + 1)}
                    className="w-7 h-7 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg hover:text-emerald-600 cursor-pointer active:scale-95"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => prev + 10)}
                    className="px-2 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg hover:text-emerald-600 cursor-pointer active:scale-95"
                  >
                    +10
                  </button>
                </div>
              </div>

              {/* Subtotal preview */}
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Order Estimation</span>
                  <p className="text-[11px] font-semibold text-emerald-950 dark:text-emerald-200">
                    {modalQtyValue} Quintals × ₹{formatINR(qtyModalProduct.price || 3850)}
                  </p>
                </div>
                <span className="text-sm font-black font-mono text-emerald-800 dark:text-emerald-300">
                  ₹{formatINR(modalQtyValue * (qtyModalProduct.price || 3850))}
                </span>
              </div>

              {/* Apply / Add Action Button */}
              <button
                type="button"
                onClick={() => {
                  setProductQty(qtyModalProduct.id, modalQtyValue);
                  const inCart = items.find(i => i.id === qtyModalProduct.id);
                  if (inCart) {
                    updateQty(qtyModalProduct.id, modalQtyValue);
                  } else {
                    handleAddToCartProduct(qtyModalProduct, modalQtyValue);
                  }
                  setQtyModalProduct(null);
                }}
                className="w-full py-2.5 bg-[#143e2e] dark:bg-emerald-600 hover:bg-[#0e2c20] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm {modalQtyValue} QTLS (₹{formatINR(modalQtyValue * (qtyModalProduct.price || 3850))})</span>
              </button>
            </motion.div>
          </div>
        )}

        {/* Yesterday vs Today Rate Comparison Modal */}
        {showRateChartModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 text-left relative max-h-[90vh] flex flex-col"
            >
              <button
                type="button"
                onClick={() => setShowRateChartModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Daily Wholesale Rate Board
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Live Rate Movement
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-normal text-slate-900 dark:text-white tracking-tight">
                  Daily Product Rate Comparison
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Yesterday vs Today ex-mill & wholesale market prices per Quintal.
                </p>
              </div>

              {/* Date Legend Pills */}
              <div className="flex items-center gap-2 text-[11px] font-bold py-1 border-b border-slate-200/80 dark:border-neutral-800">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300">
                  Yesterday: {new Date(Date.now() - 86400000).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Today: {new Date().toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* Product Rate Comparison List */}
              <div className="overflow-y-auto flex-1 space-y-2 pr-1 max-h-[50vh]">
                {productsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 bg-slate-50 dark:bg-neutral-900/50 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-neutral-800">
                    <Store className="w-8 h-8 text-amber-500/80" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No Products in Inventory</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                      There are currently no active products in the inventory to display rate comparisons. Products added by admin in Product Inventory will appear here with daily trends.
                    </p>
                  </div>
                ) : (
                  productsList.map((product, idx) => {
                    const todayRate = Number(product.price) || 0;
                    const yesterdayRate = typeof product.yesterdayPrice === 'number'
                      ? product.yesterdayPrice
                      : (todayRate > 0 ? (idx % 3 === 0 ? todayRate - 50 : idx % 3 === 1 ? todayRate + 40 : todayRate) : 0);
                    const diff = todayRate - yesterdayRate;

                    return (
                      <div 
                        key={product.id || idx}
                        className="p-3 sm:p-3.5 bg-slate-50 dark:bg-[#0c1a14] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left shadow-2xs hover:border-emerald-500/30 transition-all"
                      >
                        {/* Left Info */}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {product.name}
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              {product.category || 'Standard'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            Supplier: {product.supplier || 'Direct Mill'}
                          </p>
                        </div>

                        {/* Right Comparison Grid */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-200/60 dark:border-neutral-800/80 pt-2 sm:pt-0 shrink-0">
                          {/* Yesterday Rate */}
                          <div className="text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                              Yesterday
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                              ₹ {formatINR(yesterdayRate)} / Qtl
                            </span>
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-neutral-700 shrink-0" />

                          {/* Today Rate */}
                          <div className="text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                              Today
                            </span>
                            <span className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white">
                              ₹ {formatINR(todayRate)} / Qtl
                            </span>
                          </div>

                          {/* Trend Pill */}
                          <div className="min-w-[75px] text-right">
                            {diff > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                +₹{diff}
                              </span>
                            ) : diff < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                                <TrendingDown className="w-3 h-3 text-rose-500" />
                                -₹{Math.abs(diff)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-lg">
                                Stable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRateChartModal(false)}
                  className="px-5 py-2 bg-[#143e2e] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-[#0d2b20] cursor-pointer transition-all active:scale-95"
                >
                  Close Rate Board
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
