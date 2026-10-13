import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Store, 
  ArrowRight, 
  Search, 
  Layers, 
  Warehouse, 
  TrendingUp, 
  TrendingDown,
  MapPin, 
  Eye, 
  Sparkles, 
  Plus, 
  Minus,
  CheckCircle2, 
  Check, 
  X, 
  BadgeCheck, 
  Heart, 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ShoppingBag,
  SlidersHorizontal,
  Share2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { auth, getCollectionDocs, setCollectionDoc, addCollectionDoc } from '../lib/firebase';
import { useCart } from '../context/CartContext';
import RicePouchGraphic from '../components/RicePouchGraphic';
import { getDeliveryLocations, getSelectedDeliveryLocationId, setSelectedDeliveryLocationId, DeliveryLocation, addDeliveryLocation } from '../utils/deliveryLocations';

// Products in the store are strictly driven by Firebase Firestore (product_inventory).
// No mock or hardcoded products are used.
const BASE_PRODUCTS: any[] = [];

// Curated Rice Categories with High Quality Imagery (matching mobile app reference Screen 2)
export const POPULAR_CATEGORIES = [
  {
    id: 'Basmati',
    name: 'Basmati Rice',
    description: 'Long grain aromatic rice',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80',
    count: '12 Varieties'
  },
  {
    id: 'Sona Masoori',
    name: 'Sona Masoori',
    description: 'Medium grain everyday staple',
    image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=300&q=80',
    count: '8 Varieties'
  },
  {
    id: 'IR64',
    name: 'IR64 Rice',
    description: 'Long grain parboiled & raw',
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80',
    count: '6 Varieties'
  },
  {
    id: 'Ponni',
    name: 'Ponni Rice',
    description: 'South Indian favorite staple',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=300&q=80',
    count: '5 Varieties'
  },
  {
    id: 'Parboiled',
    name: 'Parboiled Rice',
    description: 'Nutritious processed rice',
    image: 'https://images.unsplash.com/photo-1610444319455-802521c750dc?auto=format&fit=crop&w=300&q=80',
    count: '7 Varieties'
  },
  {
    id: 'Broken',
    name: 'Broken Rice',
    description: 'Economical commercial grade',
    image: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=300&q=80',
    count: '4 Varieties'
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

function ProductCardMedia({ product }: { product: any }) {
  const [imgError, setImgError] = useState(false);

  // Reset imgError state if product image prop changes
  useEffect(() => {
    setImgError(false);
  }, [product.image]);

  if (product.image && !imgError) {
    return (
      <div className="w-full h-28 sm:h-36 relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-neutral-900/90 dark:to-neutral-950 p-1.5 sm:p-2">
        <img
          src={product.image}
          alt={product.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <RicePouchGraphic 
      name={product.name} 
      variant={product.variant || 'basmati'} 
      isBrownRice={(product.category || '').toLowerCase().includes('brown') || (product.name || '').toLowerCase().includes('brown')}
    />
  );
}

function cleanMerchantDisplayName(name: string): string {
  if (!name) return 'Merchant';
  let s = name.trim();
  if (s.includes('@')) {
    const prefix = s.split('@')[0];
    if (/^\d{10,}$/.test(prefix)) {
      return `+91 ${prefix.slice(-10)}`;
    }
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  if (/^\d{10,}$/.test(s)) {
    return `+91 ${s.slice(-10)}`;
  }
  return s;
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get('tab') || 'home';
  const categoryParam = searchParams.get('category');

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(categoryParam || 'All');

  useEffect(() => {
    const searchParamVal = searchParams.get('search');
    if (searchParamVal !== null) {
      setSearchQuery(searchParamVal);
    }
  }, [searchParams]);

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else if (activeTabParam !== 'categories') {
      setSelectedCategory('All');
    }
  }, [categoryParam, activeTabParam]);

  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [dbProcurements, setDbProcurements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('product_inventory');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => p && p.id && !String(p.id).startsWith('prod-'));
        }
      }
    } catch {}
    return [];
  });

  // Registered suppliers list state
  const [registeredSuppliers, setRegisteredSuppliers] = useState<any[]>(() => {
    try {
      const rawStakeholders = localStorage.getItem('stakeholders_v2');
      if (rawStakeholders) {
        const parsed = JSON.parse(rawStakeholders);
        if (Array.isArray(parsed.suppliers)) return parsed.suppliers;
      }
    } catch {}
    return [];
  });

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
    return localStorage.getItem('tejas_hero_product_id') || '';
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
      const userName = localStorage.getItem('userName') || 'Registered Merchant';

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
    return localStorage.getItem('userName') || 'Registered Merchant';
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
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
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
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);
  const [detailQtyValue, setDetailQtyValue] = useState<number>(25);

  const openProductDetails = (product: any) => {
    setSelectedProductDetails(product);
    setDetailQtyValue(getProductQty(product.id) || 25);
  };

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
      supplier: product.supplier || registeredSuppliers[0]?.name || 'DIRECT MILL'
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
  const [email, setEmail] = useState(() => localStorage.getItem('userEmail') || 'tejasadinarayan@gmail.com');
  const [tempEmail, setTempEmail] = useState('');
  
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
        name: tempBuyerName.trim() || 'Registered Merchant',
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
          if (pid.startsWith('prod-')) return true; // Purge all legacy template mock products
          return pid ? deletedSet.has(pid) : false;
        };

        const live = await getCollectionDocs('product_inventory').catch(() => []);
        const rawLocal = localStorage.getItem('product_inventory');
        let local: any[] = [];
        if (rawLocal) {
          try {
            local = JSON.parse(rawLocal);
          } catch (e) {}
        }

        const getNormKey = (p: any) => {
          if (!p) return '';
          return String(p.id || p.name || '').trim().toLowerCase().replace(/^#/, '');
        };

        // Strictly show only products present in Firebase Firestore!
        const combinedMap = new Map();
        (live || []).forEach((p: any) => {
          if (p && !isDeleted(p) && !String(p.id || '').startsWith('prod-')) {
            const k = getNormKey(p);
            if (k) combinedMap.set(k, p);
          }
        });

        // Overlay local products only if they match an actual product or were just updated in admin
        local.forEach((p: any) => {
          if (p && !isDeleted(p) && !String(p.id || '').startsWith('prod-')) {
            const k = getNormKey(p);
            if (k) {
              const existing = combinedMap.get(k) || {};
              combinedMap.set(k, { ...existing, ...p });
            }
          }
        });

        const activeList = Array.from(combinedMap.values());

        // Load registered suppliers to map supplier names accurately
        const rawStakeholders = localStorage.getItem('stakeholders_v2');
        let loadedSuppliers: any[] = [];
        if (rawStakeholders) {
          try {
            const parsed = JSON.parse(rawStakeholders);
            if (Array.isArray(parsed.suppliers)) loadedSuppliers = parsed.suppliers;
          } catch (e) {}
        }
        const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
        (cloudStakeholders || []).forEach((cs: any) => {
          if (cs && (cs.type === 'suppliers' || String(cs.id || '').startsWith('SUP')) && cs.name) {
            const exists = loadedSuppliers.find(s => s.id === cs.id);
            if (!exists) loadedSuppliers.push(cs);
          }
        });

        setRegisteredSuppliers(loadedSuppliers);

        // Supplier resolver helper
        const resolveSupplier = (rawSupplier?: string, supplierId?: string) => {
          const activeSuppliers = loadedSuppliers.filter(s => s.status !== 'Inactive' && s.name && s.name.trim());

          // If admin has only 1 registered supplier, all store products belong to this supplier!
          if (activeSuppliers.length === 1) {
            return activeSuppliers[0].name.trim();
          }

          if (supplierId) {
            const match = activeSuppliers.find(s => s.id === supplierId);
            if (match && match.name) return match.name.trim();
          }

          if (rawSupplier && rawSupplier.trim()) {
            const matchById = activeSuppliers.find(s => s.id === rawSupplier);
            if (matchById && matchById.name) return matchById.name.trim();
            const matchByName = activeSuppliers.find(s => s.name?.trim().toLowerCase() === rawSupplier.trim().toLowerCase());
            if (matchByName && matchByName.name) return matchByName.name.trim();
            if (activeSuppliers.length === 0) return rawSupplier.trim();
          }

          const primarySup = activeSuppliers[0];
          return primarySup ? primarySup.name.trim() : (rawSupplier && rawSupplier.trim() ? rawSupplier.trim() : 'DIRECT MILL');
        };

        if (activeList.length > 0) {
          const mapped = activeList.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.brand || p.category || 'Premium',
            price: parseFloat(p.price) || 0,
            unit: p.unit || 'qtls',
            image: p.image || '',
            about: p.about || `Choice ${p.name} under ${p.brand || 'premium'} quality. Cultivated responsibly and milled using advanced methods.`,
            defaultQty: p.defaultQty || 50,
            defaultBuyers: p.defaultBuyers || ['Local Distributor', 'APMC Retailer'],
            supplier: resolveSupplier(p.supplier, p.supplierId)
          }));
          setProductsList(mapped);
          localStorage.setItem('product_inventory', JSON.stringify(mapped));

          // Set hero product if not set or invalid
          setHeroProductId(prev => {
            if (prev && mapped.some(p => p.id === prev)) return prev;
            return mapped[0]?.id || '';
          });
        } else {
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
    let isMounted = true;
    async function loadData() {
      const startTime = Date.now();
      try {
        // Load placed orders
        const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
        const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
        
        // Load procurement requests
        const cloudProcurements = await getCollectionDocs('procurement_requests').catch(() => []);
        const localProcurements = JSON.parse(localStorage.getItem('procurement_requests') || '[]');

        if (isMounted) {
          setDbOrders([...cloudPlaced, ...localPlaced]);
          setDbProcurements([...cloudProcurements, ...localProcurements]);
        }
      } catch (err) {
        console.error('Failed to load store metadata:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
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
      supplier: product.supplier || registeredSuppliers[0]?.name || 'DIRECT MILL'
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
        const sel = selectedCategory.toLowerCase();
        matchesCat = cat === sel || cat.includes(sel) || name.includes(sel);
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
  const [isAddingHeaderLocation, setIsAddingHeaderLocation] = useState(false);
  const [headerLocName, setHeaderLocName] = useState('');
  const [headerLocType, setHeaderLocType] = useState<'Shop' | 'Godown'>('Shop');
  const [headerLocAddress, setHeaderLocAddress] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const handleCreateHeaderLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerLocName.trim() || !headerLocAddress.trim()) return;
    const created = addDeliveryLocation({
      name: headerLocName.trim(),
      type: headerLocType,
      address: headerLocAddress.trim(),
    });
    setDeliveryLocations(getDeliveryLocations());
    setSelectedLocationId(created.id);
    setSelectedDeliveryLocationId(created.id);
    setHeaderLocName('');
    setHeaderLocAddress('');
    setIsAddingHeaderLocation(false);
    setIsDispatchSelectorOpen(false);
  };

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

  const STORE_CATEGORIES = React.useMemo(() => {
    const list = [{ id: 'All', label: 'All Varieties' }];
    const added = new Set<string>(['All']);
    productsList.forEach(p => {
      const c = (p.category || p.brand || '').trim();
      if (c && !added.has(c)) {
        added.add(c);
        list.push({ id: c, label: c });
      }
    });
    return list;
  }, [productsList]);

  // If non-merchant visits the store, allow full browsing with an unobtrusive preview banner
  const isAdminOrStaff = userRole === 'admin' || userRole === 'employee' || userRole === 'officer';

  if (loading && productsList.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="w-8 h-8 rounded-full border-3 border-emerald-600/30 border-t-emerald-600 animate-spin" />
      </div>
    );
  }

  const activeDeliveryLocation = deliveryLocations.find(l => l.id === selectedLocationId) || deliveryLocations[0];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full bg-[#FAFBFA] dark:bg-[#0A0A0A] font-sans overflow-x-hidden p-0 relative transition-colors duration-300 text-neutral-900 dark:text-neutral-100 pb-28 sm:pb-32"
    >
      {/* Admin/Staff Store Preview Banner */}
      {isAdminOrStaff && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold flex items-center gap-1.5 text-[11px]">
            <Store className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            Admin Preview Mode — Browsing B2B Store catalog as Merchant
          </span>
          <button
            type="button"
            onClick={() => navigate(userRole === 'admin' ? '/dashboard' : '/inventory')}
            className="font-bold underline hover:text-amber-950 dark:hover:text-amber-200 text-[11px] cursor-pointer ml-2 shrink-0"
          >
            Return to {userRole === 'admin' ? 'Dashboard' : 'Inventory'}
          </button>
        </div>
      )}
      
      {/* --- PHONE APP MAIN CONTENT CONTAINER --- */}
      <div className="w-full px-3 py-3 space-y-3.5">

        {/* --- COMPACT USER GREETING & STATUS ROW --- */}
        <div className="space-y-2">
          {/* Greeting: "Hi, Company Name", Selected Location & Compact View Rates Button */}
          <div className="flex items-center justify-between gap-1.5 px-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-neutral-900 dark:text-white flex items-center gap-1 min-w-0 truncate shrink-0">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Hi,</span>
                <span className="text-[#C22424] dark:text-[#E03131] truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[200px]">
                  {cleanMerchantDisplayName(buyerName)}
                </span>
              </h1>

              {/* Location selected badge directly next to merchant name */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-location-picker'))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800/90 hover:bg-red-50 dark:hover:bg-red-950/40 border border-neutral-200 dark:border-neutral-700/80 text-[10px] sm:text-[11px] font-bold text-neutral-700 dark:text-neutral-300 hover:text-[#C22424] dark:hover:text-red-400 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] cursor-pointer transition-all active:scale-95 shrink-0"
                title={`Selected Delivery Destination: ${activeDeliveryLocation?.name || 'Main Shop'}. Click to switch.`}
              >
                <MapPin className="w-2.5 h-2.5 text-[#C22424] shrink-0" />
                <span className="truncate">{activeDeliveryLocation?.name || 'Main Shop'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowRateChartModal(true)}
              className="px-2.5 py-1 rounded-full bg-[#C22424] hover:bg-[#A81F1F] text-white text-[10.5px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0"
              title="View Daily Market Rates"
            >
              <Eye className="w-3 h-3" />
              <span>View Rates</span>
            </button>
          </div>

          {/* Integrated Clean Full-Width Search Bar */}
          <div className="relative w-full flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rice varieties..."
              className="w-full pl-8 pr-8 py-1.5 bg-neutral-100 dark:bg-neutral-800/80 border-0 rounded-full text-[11px] font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[#C22424]/30 shadow-2xs transition-all placeholder:text-[11px] placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* --- VIEW SWITCHER: SCREEN 2 (CATEGORIES) VS SCREEN 1 & 10 (HOME & PRODUCTS) --- */}
        {activeTabParam === 'categories' ? (
          /* ============================================================== */
          /* SCREEN 2: CATEGORIES SCREEN (Matching Reference Screen 2)      */
          /* ============================================================== */
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                  Categories
                </h1>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Select a category to view wholesale varieties
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center cursor-pointer hover:bg-neutral-200 transition-colors"
                title="Search rice catalog"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {POPULAR_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchParams({ category: cat.id });
                  }}
                  className="p-3 bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E7EB] dark:border-[#262626] flex items-center justify-between gap-3 shadow-xs hover:border-[#C22424]/50 hover:shadow-sm transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700">
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="min-w-0 text-left">
                      <h3 className="font-extrabold text-sm text-neutral-900 dark:text-white truncate group-hover:text-[#C22424] transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {cat.description}
                      </p>
                      <span className="text-[10px] font-bold text-[#C22424] mt-0.5 inline-block">
                        {cat.count}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-[#C22424] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* SCREEN 1 & SCREEN 10: HOME STOREFRONT & CATEGORY PRODUCTS      */
          /* ============================================================== */
          <>




            {/* --- SCREEN 10: HORIZONTAL CATEGORY CHIPS --- */}
            <div className="w-full overflow-hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar scrollbar-none scroll-smooth select-none">
                {['All', 'Basmati', 'Sona Masoori', 'IR64', 'Ponni', 'Parboiled', 'Broken'].map((catName) => {
                  const isSelected = (selectedCategory === catName) || (catName === 'All' && selectedCategory === 'All');
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(catName);
                        if (catName === 'All') {
                          searchParams.delete('category');
                          setSearchParams(searchParams);
                        } else {
                          setSearchParams({ category: catName });
                        }
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs flex items-center gap-1 active:scale-95 shrink-0",
                        isSelected
                          ? "bg-[#C22424] text-white shadow-xs font-bold"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      <span>{catName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div id="rice-collection" />

            {/* --- RESPONSIVE PRODUCT CARDS (2-Col Mobile, 3-Col Tablet, 4-Col Desktop) --- */}
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-white dark:bg-[#141414] rounded-2xl border border-dashed border-[#E5E7EB] dark:border-[#262626] p-6 shadow-xs">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-950/40 text-[#C22424] rounded-xl flex items-center justify-center border border-red-200 shadow-xs">
                  <Store className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 max-w-sm">
                  <p className="text-xs font-bold text-neutral-900 dark:text-white tracking-tight">No Products Available</p>
                  <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
                    Currently, there are no grain products matching your selection.
                  </p>
                </div>
                {selectedCategory !== 'All' || searchQuery.trim() !== '' ? (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSearchParams({}); }}
                    className="mt-1 px-3.5 py-1.5 bg-[#C22424] hover:bg-[#A81C1C] text-white rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    Reset Filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                {filteredProducts.map((product) => {
                  const unitPrice = product.price || 3850;
                  const isFavorited = wishlist.includes(product.id);
                  const inCartItem = items.find(i => i.id === product.id);

                  return (
                    <div
                      key={product.id}
                      className="bg-white dark:bg-[#141414] rounded-xl sm:rounded-2xl border border-[#E5E7EB] dark:border-[#262626] shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden relative group"
                    >
                      {/* Top Image Graphic Area - Click to open product details */}
                      <div 
                        onClick={() => openProductDetails(product)}
                        className="relative w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-neutral-50 dark:bg-neutral-800/60 cursor-pointer flex items-center justify-center"
                      >
                        {/* Best Seller Pill Badge */}
                        {product.isBestSeller && (
                          <span className="absolute top-1.5 left-1.5 z-20 bg-[#C22424] text-white text-[7.5px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs">
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
                          className="absolute top-1.5 right-1.5 z-20 p-1 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-xs text-neutral-400 hover:text-rose-500 transition-colors shadow-2xs cursor-pointer"
                          title={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
                        >
                          <Heart className={cn("w-3 h-3 transition-transform active:scale-125", isFavorited ? "fill-rose-500 text-rose-500" : "")} />
                        </button>

                        {/* Product Photo */}
                        <ProductCardMedia product={product} />
                      </div>

                      {/* Card Content */}
                      <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1">
                        <div>
                          <h3 
                            onClick={() => openProductDetails(product)}
                            className="font-bold text-xs text-neutral-900 dark:text-white line-clamp-1 leading-snug cursor-pointer hover:text-[#C22424] transition-colors text-left"
                            title={product.name}
                          >
                            {product.name}
                          </h3>
                          
                          {/* Grade Subtitle */}
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1 text-left mt-0.5">
                            {product.variant ? `Grade A • ${product.variant}` : product.category || 'Premium Sortex'}
                          </p>

                          {/* In Stock Indicator */}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                              In Stock
                            </span>
                          </div>
                        </div>

                        {/* Price & Add to Cart Action */}
                        <div className="flex items-center justify-between pt-1 mt-1 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="text-left">
                            <span className="text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white tracking-tight">
                              ₹{formatINR(unitPrice)}
                            </span>
                            <span className="text-[8.5px] text-neutral-400 dark:text-neutral-500 font-medium block leading-none mt-0.5">
                              / QTL
                            </span>
                          </div>

                          {/* Red Plus Button or Mini Stepper */}
                          {inCartItem ? (
                            <div className="flex items-center bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-full px-1 py-0.5 gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (inCartItem.qty <= 5) removeItem(product.id);
                                  else updateQty(product.id, inCartItem.qty - 5);
                                }}
                                className="text-[#C22424] font-black text-xs px-0.5 cursor-pointer hover:scale-110 active:scale-90"
                                title="Decrease"
                              >
                                -
                              </button>
                              <span className="text-[9.5px] font-bold text-[#C22424] font-mono">
                                {inCartItem.qty}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQty(product.id, inCartItem.qty + 5);
                                }}
                                className="text-[#C22424] font-black text-xs px-0.5 cursor-pointer hover:scale-110 active:scale-90"
                                title="Increase"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCartProduct(product, 5);
                              }}
                              className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-[#C22424] hover:bg-[#A81C1C] text-white flex items-center justify-center shadow-2xs cursor-pointer active:scale-90 transition-transform"
                              title="Add to Cart"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
            className="relative w-full max-w-2xl bg-[#fafdfb] dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden z-10"
          >
            {/* Top Confetti Ambient glow */}
            <div className="absolute top-[-30%] left-[-10%] w-[120%] h-[50%] bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />

            <div className="text-center space-y-2 relative z-10">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-950/80 rounded-full flex items-center justify-center text-[#C22424] mx-auto border border-red-200 dark:border-red-900 shadow-sm">
                <Check className="w-7 h-7 text-[#C22424]" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-neutral-900 dark:text-white tracking-tight">
                Thank You For Your Order!
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
                Your B2B procurement order has been partitioned and routed to the corresponding rice mills:
              </p>
            </div>

            {/* Split Orders details */}
            <div className="space-y-4 relative z-10 max-h-[320px] overflow-y-auto pr-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400 border-b border-[#E5E7EB] dark:border-[#262626] pb-2">
                Partitioned Split Grouping Logs ({orderSuccess.length} Separate Purchases)
              </p>

              {orderSuccess.map((order) => (
                <div key={order.id} className="p-4 bg-white dark:bg-[#1C1C1C] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 rounded-lg">
                      ORDER ID: <span className="text-[#C22424] font-mono">{order.id}</span>
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
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase font-mono tracking-tight">{order.supplier}</p>
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
                onClick={() => navigate('/my-orders')}
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
            className="bg-[#141414] text-white p-3.5 rounded-2xl shadow-2xl border border-[#262626] flex items-center gap-3 max-w-sm"
          >
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-[#C22424] shrink-0 border border-red-500/30">
              <Check className="w-4 h-4 text-[#C22424]" />
            </div>
            <div className="text-left font-sans min-w-0 pr-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#C22424] leading-none mb-1">Successfully Added</p>
              <p className="text-xs font-black leading-tight truncate">
                {addedProduct.qty} QTLS of {addedProduct.name}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5 leading-normal">
                Review inside cart when ready.
              </p>
            </div>
            <button 
              onClick={() => navigate('/bag')}
              className="px-3 py-1.5 bg-[#C22424] hover:bg-[#B91C1C] text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 cursor-pointer font-sans"
            >
              Open Cart
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
            onClick={() => navigate('/bag')}
            className={cn(
              "fixed bottom-20 right-3.5 sm:right-6 z-40 bg-[#C22424] hover:bg-[#B91C1C] text-white rounded-full p-2.5 pl-3 pr-3.5 shadow-[0_12px_32px_rgba(194,36,36,0.38)] border border-red-400/30 flex items-center gap-2 cursor-pointer font-sans select-none backdrop-blur-md transition-all",
              justAddedId && "ring-4 ring-red-400/60 scale-105"
            )}
            title="Open Bag & Review Order"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4 text-white" />
              <span className="absolute -top-2 -right-2.5 bg-neutral-900 dark:bg-black text-white text-[8.5px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                {items.reduce((sum, item) => sum + item.qty, 0)}
              </span>
            </div>
            <div className="text-left flex flex-col leading-none">
              <span className="text-[10px] font-bold text-white tracking-tight">Open Cart</span>
              <span className="text-[8px] font-mono font-medium text-red-100">
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
              className="relative w-full max-w-sm bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-4 shadow-2xl space-y-3.5 font-sans z-10"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {qtyModalProduct.image && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[#E5E7EB] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900 p-1 flex items-center justify-center">
                      <img src={qtyModalProduct.image} alt={qtyModalProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#C22424] block truncate">
                      Wholesale Order Quantity
                    </span>
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white leading-tight mt-0.5 truncate">
                      {qtyModalProduct.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                      ₹{formatINR(qtyModalProduct.price || 3850)} / Quintal
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQtyModalProduct(null)}
                  className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg cursor-pointer text-xs shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Quick preset chips */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
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
                          ? "bg-[#C22424] text-white border-transparent shadow-xs"
                          : "bg-neutral-50 dark:bg-neutral-900 border-[#E5E7EB] dark:border-[#262626] text-neutral-700 dark:text-neutral-300 hover:border-[#C22424]"
                      )}
                    >
                      {preset} Q
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom interactive Stepper */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                  Adjust Quantity (Quintals)
                </label>
                <div className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-900 border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => Math.max(1, prev - 10))}
                    className="px-2 py-1 text-[10px] font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:text-[#C22424] cursor-pointer active:scale-95"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => Math.max(1, prev - 1))}
                    className="w-7 h-7 flex items-center justify-center text-xs font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:text-[#C22424] cursor-pointer active:scale-95"
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
                    className="flex-1 text-center font-mono font-black text-base bg-transparent text-neutral-900 dark:text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => prev + 1)}
                    className="w-7 h-7 flex items-center justify-center text-xs font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:text-[#C22424] cursor-pointer active:scale-95"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalQtyValue(prev => prev + 10)}
                    className="px-2 py-1 text-[10px] font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:text-[#C22424] cursor-pointer active:scale-95"
                  >
                    +10
                  </button>
                </div>
              </div>

              {/* Subtotal preview */}
              <div className="p-2.5 bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400">Order Estimation</span>
                  <p className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-200">
                    {modalQtyValue} Quintals × ₹{formatINR(qtyModalProduct.price || 3850)}
                  </p>
                </div>
                <span className="text-sm font-black font-mono text-[#C22424] dark:text-red-400">
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
                className="w-full py-2.5 bg-[#C22424] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm {modalQtyValue} QTLS (₹{formatINR(modalQtyValue * (qtyModalProduct.price || 3850))})</span>
              </button>
            </motion.div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCREEN 3: PRODUCT DETAILS MODAL (Matching Reference Screen 3)   */}
        {/* ============================================================== */}
        <AnimatePresence>
          {selectedProductDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedProductDetails(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className="relative w-full max-w-md bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 font-sans z-10 text-left max-h-[92vh] overflow-y-auto no-scrollbar"
              >
                {/* Modal Top Action Bar */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedProductDetails(null)}
                    className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
                    title="Back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: selectedProductDetails.name,
                            text: `Wholesale Rice: ${selectedProductDetails.name} at ₹${selectedProductDetails.price || 3850}/QTL`,
                            url: window.location.href,
                          }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          alert('Product link copied to clipboard!');
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
                      title="Share product"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(selectedProductDetails.id)}
                      className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
                      title="Wishlist"
                    >
                      <Heart className={cn("w-4 h-4 transition-transform active:scale-125", wishlist.includes(selectedProductDetails.id) ? "fill-rose-500 text-rose-500" : "")} />
                    </button>
                  </div>
                </div>

                {/* Hero Product Image with Carousel Dots */}
                <div className="w-full flex flex-col items-center">
                  <div className="w-full h-44 sm:h-52 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700 flex items-center justify-center overflow-hidden p-2 relative">
                    <ProductCardMedia product={selectedProductDetails} />
                  </div>
                  {/* Dot Indicators */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-4 h-1.5 rounded-full bg-[#C22424]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  </div>
                </div>

                {/* Title & Pill Badge & Price */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white leading-tight">
                      {selectedProductDetails.name}
                    </h2>
                    <span className="bg-red-50 text-[#C22424] border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      Best Seller
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    {selectedProductDetails.variant ? `Grade A • ${selectedProductDetails.variant}` : selectedProductDetails.category || 'Sortex Milling'}
                  </p>

                  <div className="pt-1">
                    <span className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                      ₹{formatINR(selectedProductDetails.price || 11200)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1 font-medium">
                      / QTL (100 kg)
                    </span>
                  </div>
                </div>

                {/* Specifications 2x2 Grid */}
                <div className="space-y-1.5 pt-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                    Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 rounded-xl">
                      <span className="text-[9.5px] uppercase font-bold text-neutral-400 block">Origin</span>
                      <span className="font-bold text-neutral-900 dark:text-white mt-0.5 block">
                        {selectedProductDetails.origin || 'Punjab / APMC Yard'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 rounded-xl">
                      <span className="text-[9.5px] uppercase font-bold text-neutral-400 block">Grain Length</span>
                      <span className="font-bold text-neutral-900 dark:text-white mt-0.5 block">
                        {selectedProductDetails.variant === 'basmati' ? '8.35 mm' : '6.40 mm'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 rounded-xl">
                      <span className="text-[9.5px] uppercase font-bold text-neutral-400 block">Purity</span>
                      <span className="font-bold text-neutral-900 dark:text-white mt-0.5 block">
                        95% Sortex Clean
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 rounded-xl">
                      <span className="text-[9.5px] uppercase font-bold text-neutral-400 block">Moisture</span>
                      <span className="font-bold text-neutral-900 dark:text-white mt-0.5 block">
                        &lt; 12% Max
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1 pt-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                    Description
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-normal">
                    {selectedProductDetails.about || "Premium aged 1121 Basmati Rice with exceptional grain elongation, exquisite aroma, and fluffy non-sticky texture after cooking. Sourced directly from verified milling hubs."}
                  </p>
                </div>

                {/* Sticky Bottom Actions: Stepper and Red Add to Cart Button */}
                <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
                  {/* Stepper */}
                  <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailQtyValue(prev => Math.max(1, prev - (prev > 10 ? 5 : 1)))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-black text-sm flex items-center justify-center hover:bg-neutral-50 active:scale-95 cursor-pointer shadow-xs"
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-xs text-neutral-900 dark:text-white min-w-10 text-center">
                      {detailQtyValue} QTL
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailQtyValue(prev => prev + (prev >= 10 ? 5 : 1))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-black text-sm flex items-center justify-center hover:bg-neutral-50 active:scale-95 cursor-pointer shadow-xs"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setProductQty(selectedProductDetails.id, detailQtyValue);
                      const inCart = items.find(i => i.id === selectedProductDetails.id);
                      if (inCart) {
                        updateQty(selectedProductDetails.id, detailQtyValue);
                      } else {
                        handleAddToCartProduct(selectedProductDetails, detailQtyValue);
                      }
                      setSelectedProductDetails(null);
                    }}
                    className="flex-1 py-3 bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Old Rates vs New Rates Comparison Modal */}
        {showRateChartModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl p-3.5 sm:p-4 max-w-lg w-full shadow-2xl text-left relative max-h-[85vh] flex flex-col font-sans"
            >
              {/* Header: Minimal Title + Close */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-black uppercase tracking-wider text-[#C22424]">
                  Market Rates (₹/Qtl)
                </span>
                <button
                  type="button"
                  onClick={() => setShowRateChartModal(false)}
                  className="w-7 h-7 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Table Column Labels for Instant 1-Second Glance */}
              <div className="grid grid-cols-12 gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg">
                <span className="col-span-6">Variety</span>
                <span className="col-span-3 text-right">Old</span>
                <span className="col-span-3 text-right text-neutral-700 dark:text-neutral-200">New</span>
              </div>

              {/* Ultra-Clean Rates List */}
              <div className="overflow-y-auto flex-1 divide-y divide-neutral-100 dark:divide-neutral-800/60 pr-0.5 max-h-[55vh] no-scrollbar">
                {productsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                    No rates available
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
                        className="grid grid-cols-12 gap-1 items-center px-2.5 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 rounded-lg transition-colors text-left"
                      >
                        {/* Variety Name */}
                        <div className="col-span-6 min-w-0 pr-1">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate block">
                            {product.name}
                          </span>
                        </div>

                        {/* Old Rate */}
                        <div className="col-span-3 text-right">
                          <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500 line-through">
                            ₹{formatINR(yesterdayRate)}
                          </span>
                        </div>

                        {/* New Rate + Diff */}
                        <div className="col-span-3 text-right flex flex-col items-end leading-none">
                          <span className="text-xs sm:text-[13px] font-mono font-black text-neutral-900 dark:text-white">
                            ₹{formatINR(todayRate)}
                          </span>
                          {diff !== 0 && (
                            <span className={cn(
                              "text-[9.5px] font-mono font-black mt-0.5",
                              diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Minimal Dismiss */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowRateChartModal(false)}
                  className="px-4 py-1.5 bg-[#C22424] hover:bg-[#A81F1F] text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
