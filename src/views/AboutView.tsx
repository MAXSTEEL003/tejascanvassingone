import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Menu, X, Globe, Phone, Mail, MapPin, Linkedin, Instagram, Twitter, 
  ArrowRight, ArrowUpRight, Sprout, Factory, FlaskConical, Package, Ship, 
  Leaf, Award, Truck, TrendingDown, ShieldCheck, Clock, ChevronLeft, ChevronRight, 
  Send, MessageCircle, LogIn, UserPlus, Download, Sparkles, CheckCircle2, Star, User, Info, ChefHat, ShoppingBag,
  Search, SlidersHorizontal, Tag, Eye, ChevronDown, ChevronUp, Calculator, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PwaInstallModal from "../components/PwaInstallModal";
import { getCollectionDocs } from "../lib/firebase";

// ── Deterministic Distinct Brand Image Resolver ──
export function resolveBrandImage(name: string = "", rawImage?: string): string {
  const norm = (name || "").toLowerCase().trim();
  
  // 1. Strict priority for local verified brand assets in /public/images/
  if (norm.includes("keshar kali") || norm.includes("kali")) return "/images/keshar_kali.png";
  if (norm.includes("jmr")) return "/images/jmr.jpg";
  if (norm.includes("simha") || norm.includes("urad") || norm.includes("dal")) return "/images/simha.png";
  if (norm.includes("cow") || norm.includes("mahendra")) return "/images/cow.jpg";
  if (norm.includes("bellric") || norm.includes("1121") || norm.includes("basmati")) return "/images/bellric.png";
  if (norm.includes("keshar madhuram") || norm.includes("madhuram")) return "/images/keshar_madhuram.png";

  // 2. If a clean, non-duplicate custom image was provided that isn't the repetitive Google placeholder
  if (
    rawImage &&
    typeof rawImage === "string" &&
    rawImage.trim() !== "" &&
    !rawImage.includes("aida-public") &&
    !rawImage.includes("AB6AXuCOz5q")
  ) {
    return rawImage;
  }

  // 3. Known staple varieties with verified distinctive photography
  if (norm.includes("vnt") || norm.includes("anuram") || norm.includes("knm")) {
    return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("bpt") || norm.includes("5204")) {
    return "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("telangana") || norm.includes("rnr") || norm.includes("sugar") || norm.includes("low gi")) {
    return "https://images.unsplash.com/photo-1568651316335-e110ebf156d1?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("jeera") || norm.includes("samba") || norm.includes("seeraga")) {
    return "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("hmt")) {
    return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("ponni")) {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";
  }
  if (norm.includes("sona masoori")) {
    return "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80";
  }

  // 4. Stable deterministic fallback pool so no two varieties duplicate
  const pool = [
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1568651316335-e110ebf156d1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  ];
  let code = 0;
  for (let i = 0; i < norm.length; i++) code += norm.charCodeAt(i);
  return pool[Math.abs(code) % pool.length];
}

// ── Hero Config ──
const HERO_IMAGE = "https://images.unsplash.com/photo-1763397929062-eb0582008877?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaWNlJTIwcGFkZHklMjBmaWVsZCUyMGdvbGRlbiUyMHN1bnJpc2UlMjBjaW5lbWF0aWMlMjBhZXJpYWx8ZW58MXx8fHwxNzcxNzg0NTE2fDA&ixlib=rb-4.1.0&q=80&w=1920";

// ── Trust Strip Stats ──
const trustStats = [
  { value: "Est. 2008", label: "Owner: M. Adinarayan" },
  { value: "300+", label: "Happy Customers" },
  { value: "3 States", label: "KA · TN · AP" },
  { value: "Trusted", label: "Mill Suppliers" },
];

export interface ProductItem {
  id: number | string;
  name: string;
  type: string;
  isFamous: boolean;
  badge: string;
  description: string;
  image: string;
  tags: string[];
  origin: string;
  price?: number;
  unit?: string;
  supplier?: string;
  history?: string;
  sourcingLocation?: string;
  cookingSpecs?: string[];
  packagingOptions?: string;
}

// ── Products List ──
const products: ProductItem[] = [
  {
    id: 1,
    name: "Keshar Kali",
    type: "Kollam Raw Rice",
    isFamous: true,
    badge: "⭐ Famous Flagship Brand",
    description: "Our world-famous Keshar Kali Kollam raw rice, renowned across Karnataka, Tamil Nadu, and Andhra for its naturally soft texture, bright white grain, and unmatched cooking quality.",
    image: "/images/keshar_kali.png",
    tags: ["Keshar Kali", "Famous Brand", "Kollam Raw"],
    origin: "Maharashtra & South India",
    history: "Keshar Kali has been Tejas Canvassing's premier signature brand since 2008. Hand-selected from top South Asian millers, it has built a 17-year reputation among 300+ merchants for zero-adulteration and bright white kernel purity.",
    sourcingLocation: "Gangavathi & Koppal Belt, Karnataka · APMC Yard Yeshwanthpur Desk",
    cookingSpecs: ["Grain Swell Ratio: 3.8x", "Moisture Content: 12.8%", "100% Laser Sortex Cleaned", "Double Polish Bright Kernel"],
    packagingOptions: "25 kg & 50 kg Branded Non-Woven Bags with High-Barrier Inner Liner"
  },
  {
    id: 2,
    name: "JMR",
    type: "HMT · Steam · Raw · Kollam",
    isFamous: true,
    badge: "⭐ Famous Flagship Brand",
    description: "Our highly sought-after JMR brand offering HMT steam, raw, and Kollam raw rice varieties — trusted by over 300 happy wholesale customers.",
    image: "/images/jmr.jpg",
    tags: ["JMR Brand", "Famous Staples", "HMT Steam"],
    origin: "Miryalaguda & Andhra",
    history: "JMR is a staple favorite in wholesale markets across Chennai, Bengaluru, and Vijayawada. Known for uniform grain length and minimal broken ratio, it is the fastest-moving SKU for commercial caterers and retailers.",
    sourcingLocation: "Miryalaguda Milling Hub, Andhra Pradesh & Telangana",
    cookingSpecs: ["Medium Grain Slender", "Moisture: 13.0%", "Easy Digestibility Low Starch", "Steam & Raw Options"],
    packagingOptions: "25 kg, 50 kg Jute & BOPP Woven Master Sacks"
  },
  {
    id: 3,
    name: "Simha",
    type: "Urad Dal",
    isFamous: true,
    badge: "⭐ Famous Flagship Brand",
    description: "Our premium Simha Urad Dal — laser-cleaned, well-sorted, and famous for its high protein yield and extended shelf life across wholesale markets.",
    image: "/images/simha.png",
    tags: ["Simha Brand", "Famous Urad Dal", "Sortex Cleaned"],
    origin: "Karnataka, India",
    history: "Simha Urad Dal is famous for high batter fluffiness and fermentation performance, making it the preferred choice for South Indian tiffin centers and commercial idli/dosa batter manufacturers.",
    sourcingLocation: "North Karnataka Pulse Mills & APMC Canvassing Desk",
    cookingSpecs: ["99.9% Laser Sortex Cleaned", "Zero Stone & Chalky Grain", "High Protein Yield", "Extended Shelf Storage"],
    packagingOptions: "30 kg & 50 kg Master Wholesale Bags"
  },
  {
    id: 4,
    name: "Mahendra Cow",
    type: "Kollam Raw & Steam Rice",
    isFamous: false,
    badge: "Trusted Quality",
    description: "A trusted name offering both Kollam raw and steam varieties with consistent quality and superior taste for retailers and households.",
    image: "/images/cow.jpg",
    tags: ["Kollam Raw", "Steam Rice", "Trusted Supplier"],
    origin: "Miryalaguda, India",
    history: "Mahendra Cow delivers reliable everyday family rice with predictable cooking parameters, ensuring retail merchants get repeat customer satisfaction.",
    sourcingLocation: "Miryalaguda & Raichur Mills",
    cookingSpecs: ["Moisture: 13.2%", "Broken < 2%", "Soft Non-Sticky Cook"],
    packagingOptions: "25 kg & 50 kg Branded Bags"
  },
  {
    id: 5,
    name: "Bellric",
    type: "Basmati 1121",
    isFamous: false,
    badge: "Export Grade 8.35mm+",
    description: "Premium Basmati 1121 with extra-long grains, rich natural aroma and fluffy non-sticky texture. Ideal for biryani and pulao.",
    image: "/images/bellric.png",
    tags: ["Basmati 1121", "Long Grain", "Aromatic"],
    origin: "Punjab & North India",
    history: "Aged for 12–24 months in temperature-controlled warehouses, Bellric Basmati elongates over 2x upon cooking with delicate natural aroma.",
    sourcingLocation: "Punjab & Haryana Basmati Belt",
    cookingSpecs: ["Avg Grain Length: 8.35mm+", "Aged 12-24 Months", "Elongation Ratio: 2.2x", "Rich Natural Aroma"],
    packagingOptions: "10 kg, 25 kg & 50 kg Premium BOPP Bags"
  },
  {
    id: 6,
    name: "Keshar Madhuram",
    type: "Scented Rice",
    isFamous: false,
    badge: "Delicate Fragrance",
    description: "A fragrant, naturally scented rice variety prized for its delicate aroma and light texture, perfect for festive dishes.",
    image: "/images/keshar_madhuram.png",
    tags: ["Scented Variety", "Aromatic", "Premium"],
    origin: "Maharashtra, India",
    history: "Harvested from aromatic rice fields, Keshar Madhuram brings delicate natural fragrance to festive dining and authentic rice platters.",
    sourcingLocation: "Maharashtra Aromatic Belt",
    cookingSpecs: ["Natural Aroma Compound", "Light Digestible Grain", "Delicate Texture"],
    packagingOptions: "25 kg Branded Packs"
  },
  {
    id: 7,
    name: "VNT Anuram",
    type: "Sona Masoori · Steam · KNM",
    isFamous: false,
    badge: "Daily Staple",
    description: "Offering Sona Masoori raw, steam rice and KNM steam — known for its lightness, easy digestibility, and consistent batch quality.",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    tags: ["Sona Masoori", "Steam Rice", "KNM Steam"],
    origin: "Andhra Pradesh, India",
    history: "VNT Anuram Sona Masoori is ideal for low-glycemic, light daily meals, widely distributed across Karnataka and Andhra APMC yards.",
    sourcingLocation: "Guntur & Krishna Delta, Andhra Pradesh",
    cookingSpecs: ["Medium Grain Lightness", "Low Glycemic Index", "Uniform Steam Processing"],
    packagingOptions: "25 kg & 50 kg Bags"
  },
  {
    id: 8,
    name: "BPT Deluxe",
    type: "Sona Masoori Raw Old",
    isFamous: false,
    badge: "1+ Year Aged",
    description: "Authentic BPT 5204 aged Sona Masoori raw rice. Elongates elegantly without sticking, prized by families and quality-conscious caterers.",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    tags: ["BPT 5204", "Aged Rice", "Sona Masoori"],
    origin: "Raichur & Kurnool",
    history: "Sourced from the Tungabhadra river basin, BPT 5204 is aged naturally for over 12 months to achieve the coveted dry fluffiness essential for traditional South Indian meals.",
    sourcingLocation: "Raichur & Sindhanur Paddy Belts",
    cookingSpecs: ["Aged > 12 Months", "Moisture: 12.5%", "High Volume Cook Expansion"],
    packagingOptions: "25 kg & 50 kg Premium Woven Bags"
  },
  {
    id: 9,
    name: "Telangana Sona (RNR)",
    type: "Low Glycemic Index (GI 51.5)",
    isFamous: false,
    badge: "Sugar-Friendly",
    description: "Scientifically proven low-GI fine grain rice (RNR 15048). Great for wellness-focused consumers and diabetic diet regimes.",
    image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80",
    tags: ["RNR 15048", "Low GI", "Healthy Diet"],
    origin: "Telangana & Miryalaguda",
    history: "Developed by PJTSAU, Telangana Sona has a certified low Glycemic Index of 51.5, offering all the joy of eating rice without insulin spikes.",
    sourcingLocation: "Nalgonda & Karimnagar Certified Farms",
    cookingSpecs: ["Glycemic Index: 51.5", "Slender Fine Grain", "Rich in Resistant Starch"],
    packagingOptions: "10 kg, 25 kg & 50 kg BOPP Packaging"
  },
  {
    id: 10,
    name: "Jeera Samba",
    type: "Seeraga Samba Fragrant Rice",
    isFamous: false,
    badge: "Biryani Special",
    description: "Tiny ovular scented grains with an alluring herbal aroma. The authentic choice for traditional Dindigul and Ambur biryani.",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80",
    tags: ["Seeraga Samba", "Biryani Rice", "Aromatic"],
    origin: "Tamil Nadu, India",
    history: "Revered as the Prince of Rice in Southern India, Jeera Samba absorbs rich masala broths thoroughly while remaining light and aromatic.",
    sourcingLocation: "Thanjavur & Delta Region, Tamil Nadu",
    cookingSpecs: ["Grain Size: 4.5mm Micro Oval", "Distinctive Natural Scent", "High Sauce Absorption"],
    packagingOptions: "25 kg Master Sacks"
  }
];

// ── Supply Chain Steps ──
const supplySteps = [
  {
    id: 1,
    title: "Trusted Supplier Partnerships",
    detail: "Direct procurement from our network of verified millers and trusted farm suppliers across Karnataka, Tamil Nadu, and Andhra Pradesh.",
    icon: Sprout,
  },
  {
    id: 2,
    title: "Precision Processing",
    detail: "Optical color sorting and state-of-the-art milling technology preserve grain integrity, aroma, and whiteness uniformity.",
    icon: Factory,
  },
  {
    id: 3,
    title: "Quality Verification",
    detail: "Every consignment is checked for moisture levels, grain length, broken ratio, and cleanliness before loading.",
    icon: FlaskConical,
  },
  {
    id: 4,
    title: "Hygienic Packaging",
    detail: "Secure, moisture-proof packaging in 25 kg and 50 kg non-woven and BOPP bags designed for long shelf life.",
    icon: Package,
  },
  {
    id: 5,
    title: "Delivery to Karnataka, TN & Andhra",
    detail: "Direct logistics network ensuring fast, reliable delivery to APMC yards, mandis, and godowns across South India.",
    icon: Ship,
  },
];

// ── Why Choose Us Features ──
const FIELD_IMAGE = "https://images.unsplash.com/photo-1761446261012-527815651ded?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZ3JpY3VsdHVyZSUyMGdyYWluJTIwZmFybWluZyUyMGxhbmRzY2FwZSUyMGdvbGRlbiUyMHN1bnJpc2UlMjBjaW5lbWF0aWMlMjBhZXJpYWx8ZW58MXx8fHwxNzcxNzg0NTE2fDA&ixlib=rb-4.1.0&q=80&w=1080";
const features = [
  {
    id: 1,
    title: "Established Since 2008",
    description: "Founded by M. Adinarayan in 2008, Tejas Canvassing has over 17 years of trusted canvassing experience in APMC Yard Yeshwanthpur.",
    icon: User,
  },
  {
    id: 2,
    title: "Over 300 Happy Customers",
    description: "Serving over 300 satisfied wholesale buyers, retailers, and distributors with transparent pricing and dependable supply.",
    icon: Award,
  },
  {
    id: 3,
    title: "Famous Brands: Keshar Kali, JMR, Simha",
    description: "We are renowned for our signature Keshar Kali Kollam, JMR Steam & Raw, and Simha Urad Dal staple lines.",
    icon: Star,
  },
  {
    id: 4,
    title: "Serving Karnataka, Tamil Nadu & Andhra",
    description: "Comprehensive distribution network covering all major mandis and APMC yards across Karnataka, Tamil Nadu, and Andhra Pradesh.",
    icon: Truck,
  },
  {
    id: 5,
    title: "Network of Trusted Suppliers",
    description: "Direct ties with top-tier millers and farm suppliers eliminate unnecessary markups while guaranteeing origin purity.",
    icon: ShieldCheck,
  },
  {
    id: 6,
    title: "On-Time Dispatch & Delivery",
    description: "Dedicated transport coordination ensures every truck consignment arrives safely on schedule with complete documentation.",
    icon: Clock,
  },
];

// ── Regional Focus ──
const MARKET_IMAGE = "https://images.unsplash.com/photo-1759272548470-d0686d071036?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMHNoaXBwaW5nJTIwY29udGFpbmVyJTIwcG9ydCUyMGdsb2JhbCUyMGxvZ2lzdGljc3xlbnwxfHx8fDE3NzE3ODQ1MTh8MA&ixlib=rb-4.1.0&q=80&w=1080";
const regions = [
  {
    name: "Karnataka (APMC Yard HQ)",
    markets: ["Bengaluru · APMC Yeshwanthpur", "Mysuru", "Hubballi", "Belagavi", "Davanagere"],
    color: "var(--gold)",
  },
  {
    name: "Tamil Nadu",
    markets: ["Chennai Mandis", "Coimbatore APMC", "Madurai", "Tiruchirappalli", "Salem"],
    color: "#34D399",
  },
  {
    name: "Andhra Pradesh",
    markets: ["Vijayawada", "Guntur Mandi", "Visakhapatnam", "Miryalaguda", "Hyderabad"],
    color: "#60A5FA",
  },
];

// ── Testimonials ──
const testimonials = [
  {
    id: 1,
    quote: "We've been procuring Keshar Kali and JMR rice from M. Adinarayan sir at Tejas Canvassing for years. Over 300 traders in our market trust their quality and timely dispatch.",
    name: "Ramesh Gowda",
    role: "Wholesale Merchant",
    company: "APMC Yard Yeshwanthpur, Bengaluru",
    initials: "RG",
    accentColor: "var(--gold)",
  },
  {
    id: 2,
    quote: "Their Simha Urad Dal and Keshar Kali Kollam are our top sellers in Chennai. Honest weight, clean bags, and trusted suppliers make Tejas Canvassing our #1 choice.",
    name: "S. Murugan",
    role: "Distributor",
    company: "Chennai Wholesale Market, Tamil Nadu",
    initials: "SM",
    accentColor: "#34D399",
  },
  {
    id: 3,
    quote: "Tejas Canvassing has been supplying our network across Andhra and Karnataka since 2008. Reliable pricing and M. Adinarayan sir's business integrity are unmatched.",
    name: "K. Venkateshwarlu",
    role: "Commission Agent",
    company: "Vijayawada Mandi, Andhra Pradesh",
    initials: "KV",
    accentColor: "#60A5FA",
  },
];

const navLinks = [
  { label: "Famous Brands", href: "#products" },
  { label: "Process", href: "#process" },
  { label: "Why Us", href: "#why-us" },
  { label: "Regions", href: "#global-presence" },
];

export default function AboutView() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Products filtering, search & density state
  const [allProducts, setAllProducts] = useState<ProductItem[]>(products);
  const [productCategory, setProductCategory] = useState<string>("all");
  const [productSearch, setProductSearch] = useState<string>("");
  const [viewDensity, setViewDensity] = useState<"grid" | "list">("grid");

  // In-Place Brand Card Expansion & Calculator states
  const [expandedCardId, setExpandedCardId] = useState<number | string | null>(null);
  const [cardActiveTab, setCardActiveTab] = useState<Record<string | number, 'specs' | 'origin' | 'calc'>>({});
  const [cardQuantities, setCardQuantities] = useState<Record<string | number, number>>({});
  const [modalTab, setModalTab] = useState<'specs' | 'heritage' | 'calc' | 'packaging'>('specs');
  const [modalQty, setModalQty] = useState<number>(50);

  // Live Inventory Sync from Firestore & LocalStorage
  useEffect(() => {
    let isMounted = true;
    const loadLiveProducts = async () => {
      try {
        const rawDel = localStorage.getItem('deleted_product_inventory_ids');
        const delSet = rawDel ? new Set(JSON.parse(rawDel).map((id: string) => String(id).trim().toLowerCase().replace(/^#/, ''))) : new Set();
        
        const isDeleted = (id: string) => {
          const s = String(id || '').trim().toLowerCase().replace(/^#/, '');
          if (s.startsWith('prod-')) return true;
          return delSet.has(s);
        };

        const cloudDocs = await getCollectionDocs('product_inventory').catch(() => []);
        const localRaw = localStorage.getItem('product_inventory');
        let localDocs: any[] = [];
        try {
          if (localRaw) localDocs = JSON.parse(localRaw);
        } catch {}

        const liveMap = new Map<string, any>();
        [...cloudDocs, ...localDocs].forEach((p: any) => {
          if (!p || !p.id || isDeleted(p.id)) return;
          const pid = String(p.id).trim().toLowerCase().replace(/^#/, '');
          liveMap.set(pid, p);
        });

        // Merge live prices or data with base heritage products
        const merged: ProductItem[] = products.map((item) => {
          const match = Array.from(liveMap.values()).find((lp: any) => {
            const lName = String(lp.name || '').toLowerCase();
            const lBrand = String(lp.brand || '').toLowerCase();
            const iName = item.name.toLowerCase();
            return lName.includes(iName) || iName.includes(lName) || lBrand.includes(iName) || iName.includes(lBrand);
          });
          if (match) {
            return {
              ...item,
              price: match.price ? parseFloat(match.price) : undefined,
              unit: match.unit || 'qtls',
              supplier: match.supplier || undefined,
              image: resolveBrandImage(item.name, match.image || item.image)
            };
          }
          return {
            ...item,
            image: resolveBrandImage(item.name, item.image)
          };
        });

        // Add any unique live inventory products
        liveMap.forEach((lp: any) => {
          const lpName = String(lp.name || '').trim().toLowerCase();
          const exists = merged.some((m) => {
            const mName = m.name.trim().toLowerCase();
            return mName === lpName || (lp.id && String(m.id).toLowerCase() === String(lp.id).toLowerCase());
          });
          if (!exists && lp.name) {
            merged.push({
              id: lp.id,
              name: lp.name,
              type: lp.brand || lp.category || 'Special Grade',
              isFamous: false,
              badge: lp.brand || 'Verified APMC',
              description: lp.about || `${lp.name} carefully canvassed from verified milling partners with strict moisture and laser sortex standards.`,
              image: resolveBrandImage(lp.name, lp.image),
              tags: [lp.brand || 'Rice Variety', 'Sortex Cleaned', 'APMC Sourced'],
              origin: lp.supplier || 'South India APMC Mills',
              price: lp.price ? parseFloat(lp.price) : undefined,
              unit: lp.unit || 'qtls',
              supplier: lp.supplier,
              history: `${lp.name} is canvassed through Tejas Canvassing network of vetted South Indian rice mills with rigorous optical sorting.`,
              sourcingLocation: lp.supplier ? `Procured direct from ${lp.supplier}` : 'South India APMC Milling Belt',
              cookingSpecs: ['100% Optical Sortex Cleaned', 'Moisture Controlled', 'High Volume Swell'],
              packagingOptions: '25 kg & 50 kg Standard Mill Bags'
            });
          }
        });

        if (isMounted) {
          setAllProducts(merged);
        }
      } catch (err) {
        console.warn('Live products load error in AboutView:', err);
      }
    };

    loadLiveProducts();
    return () => { isMounted = false; };
  }, []);

  // Filtered products calculation
  const filteredProducts = React.useMemo(() => {
    return allProducts.filter((p) => {
      // 1. Search Query
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const matches = 
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(q)));
        if (!matches) return false;
      }

      // 2. Category Filter
      if (productCategory === 'all') return true;
      if (productCategory === 'famous') return p.isFamous;
      if (productCategory === 'kollam_raw') {
        const t = (p.type + ' ' + p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return t.includes('kollam') || t.includes('raw');
      }
      if (productCategory === 'steam') {
        const t = (p.type + ' ' + p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return t.includes('steam') || t.includes('hmt') || t.includes('knm');
      }
      if (productCategory === 'sona') {
        const t = (p.type + ' ' + p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return t.includes('sona') || t.includes('bpt') || t.includes('masoori') || t.includes('rnr');
      }
      if (productCategory === 'basmati') {
        const t = (p.type + ' ' + p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return t.includes('basmati') || t.includes('scented') || t.includes('madhuram') || t.includes('samba') || t.includes('seeraga');
      }
      if (productCategory === 'pulses') {
        const t = (p.type + ' ' + p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        return t.includes('dal') || t.includes('urad') || t.includes('pulse');
      }
      return true;
    });
  }, [allProducts, productCategory, productSearch]);

  // Testimonials state
  const [testiIndex, setTestiIndex] = useState(0);

  // Inquiry Form state
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    riceType: "Keshar Kali (Kollam Raw)",
    quantity: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if merchant is currently registered / signed in
  const [isLoggedInMerchant, setIsLoggedInMerchant] = useState(() => {
    return !!localStorage.getItem('userRole');
  });

  // Force Light Theme by Default for About Us
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    
    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const handleAuthSync = () => {
      setIsLoggedInMerchant(!!localStorage.getItem('userRole'));
    };
    window.addEventListener('storage', handleAuthSync);
    window.addEventListener('role-changed', handleAuthSync);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener('storage', handleAuthSync);
      window.removeEventListener('role-changed', handleAuthSync);
    };
  }, []);

  const goToTesti = (next: number) => {
    setTestiIndex(next);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    const msg = [
      `*New Enquiry — Tejas Canvassing*`,
      `*Owner:* M. Adinarayan (Est. 2008)`,
      ``,
      `*Name:* ${formData.name}`,
      `*Company:* ${formData.company || "N/A"}`,
      `*Email:* ${formData.email}`,
      `*Phone:* ${formData.phone || "N/A"}`,
      `*Product/Brand:* ${formData.riceType}`,
      `*Quantity Needed:* ${formData.quantity || "N/A"}`,
      `*Message:* ${formData.message || "N/A"}`,
    ].join("\n");

    const waUrl = `https://wa.me/919916416995?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
    setIsSubmitting(false);
  };

  const currentTesti = testimonials[testiIndex];

  return (
    <div className="font-sans text-stone-800 min-h-screen flex flex-col selection:bg-amber-400 selection:text-emerald-950 pb-[env(safe-area-inset-bottom,0px)]" style={{ background: "var(--warm-bg)", fontFamily: "var(--font-sans)" }}>
      <PwaInstallModal isOpen={isPwaModalOpen} onClose={() => setIsPwaModalOpen(false)} />

      {/* ── Apple Glass Mobile-Optimized Floating Navigation Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2 sm:py-3 px-2.5 sm:px-6">
        <div 
          className="max-w-[1280px] mx-auto px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl sm:rounded-full transition-all duration-300 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.18)]"
          style={{
            background: isScrolled ? "rgba(255, 255, 255, 0.92)" : "rgba(8, 20, 14, 0.85)",
            backdropFilter: "blur(28px) saturate(200%)",
            WebkitBackdropFilter: "blur(28px) saturate(200%)",
            boxShadow: isScrolled 
              ? "0 4px 20px -2px rgba(0,0,0,0.08), inset 0 1px 1px 0 rgba(255,255,255,0.9)"
              : "0 8px 32px -4px rgba(0,0,0,0.35), inset 0 1px 1px 0 rgba(255,255,255,0.2)",
            borderColor: isScrolled ? "rgba(201, 161, 88, 0.25)" : "rgba(255, 255, 255, 0.18)",
            borderWidth: "1px",
            borderStyle: "solid"
          }}
        >

          {/* Brand Identity with Rounded Logo Border */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group cursor-pointer select-none">
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="Tejas Canvassing Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl p-0.5 border border-amber-400/40 bg-white/10 transition-transform duration-300 group-hover:scale-105 shadow-xs"
              />
            </div>
            <div className="flex flex-col">
              <span
                className="tracking-wider transition-colors duration-300 font-bold leading-tight truncate max-w-[135px] xs:max-w-[180px] sm:max-w-none"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "13.5px",
                  color: isScrolled ? "#0D2318" : "#ffffff",
                }}
              >
                TEJAS CANVASSING
              </span>
              <span
                className="tracking-[0.14em] uppercase transition-colors duration-300 leading-none mt-0.5"
                style={{
                  fontSize: "7.5px",
                  color: isScrolled ? "var(--gold)" : "rgba(255,255,255,0.75)",
                  fontWeight: 600
                }}
              >
                Est. 2008 · M. Adinarayan
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-all duration-200 relative group text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: isScrolled ? "#374151" : "rgba(255,255,255,0.9)",
                }}
              >
                {link.label}
                <span
                  className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                  style={{ background: "var(--gold)" }}
                />
              </a>
            ))}

            {/* Install App Button */}
            <button
              onClick={() => setIsPwaModalOpen(true)}
              className="px-3 py-1.5 rounded-full border transition-all duration-300 text-[10.5px] font-bold tracking-wider uppercase flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
              style={{
                borderColor: isScrolled ? "rgba(201,161,88,0.4)" : "rgba(255,255,255,0.3)",
                color: isScrolled ? "var(--brand-dark)" : "#ffffff",
                background: isScrolled ? "rgba(201,161,88,0.12)" : "rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Download className="w-3 h-3 text-amber-400" />
              <span>Install App</span>
            </button>

            {/* Log In Button */}
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-[11px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
              style={{
                background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                color: "var(--brand-dark)",
              }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          </div>

          {/* Right Mobile Actions - Clean & Perfectly Proportioned */}
          <div className="flex lg:hidden items-center gap-1.5">
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 rounded-full transition-all duration-300 active:scale-95 text-[10.5px] font-extrabold tracking-wider uppercase flex items-center gap-1 cursor-pointer shadow-sm"
              style={{
                background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                color: "var(--brand-dark)",
              }}
            >
              <LogIn className="w-3 h-3" />
              <span>Log In</span>
            </button>

            <button
              className="p-1.5 transition-colors duration-200 rounded-full cursor-pointer hover:bg-white/10 shrink-0"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ color: isScrolled ? "#111827" : "#ffffff" }}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Glass Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-3 z-50 flex flex-col justify-between lg:hidden rounded-3xl p-6 shadow-2xl border border-white/20"
            style={{ 
              background: "rgba(13, 35, 24, 0.95)", 
              backdropFilter: "blur(32px) saturate(200%)",
              fontFamily: "var(--font-serif)" 
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain rounded-lg border border-amber-400/40 p-0.5 bg-white/10" />
                <span className="text-white font-bold text-sm tracking-wider">TEJAS CANVASSING</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-white/70">
                <X size={22} />
              </button>
            </div>

            <nav className="flex flex-col items-center gap-5 py-4">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-white/90 hover:text-amber-300 transition-colors text-2xl font-light tracking-wide text-center"
                >
                  {link.label}
                </motion.a>
              ))}
              
              <div className="w-full pt-4 border-t border-white/10 flex flex-col gap-3">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); navigate(isLoggedInMerchant ? '/store' : '/signup'); }}
                  className="w-full py-3.5 text-emerald-950 bg-amber-400 font-sans font-extrabold text-xs uppercase tracking-widest rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {isLoggedInMerchant ? <LogIn size={16} /> : <UserPlus size={16} />}
                  <span>{isLoggedInMerchant ? "Log In to Webstore" : "Sign Up"}</span>
                </button>

                <button
                  onClick={() => { setIsMobileMenuOpen(false); setIsPwaModalOpen(true); }}
                  className="w-full py-3 text-white/90 bg-white/10 border border-white/20 font-sans font-semibold text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download size={14} className="text-amber-400" />
                  <span>Install App</span>
                </button>
              </div>
            </nav>

            <div className="text-center text-[10px] text-white/40 tracking-wider">
              Owner: M. Adinarayan · APMC Yard Yeshwanthpur
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow pt-0">
        
        {/* ── 1. CINEMATIC MOBILE HERO SECTION ── */}
        <section className="relative flex items-end overflow-hidden min-h-[100dvh]" style={{ background: "#08140e" }}>
          <div className="absolute inset-0 z-0 bg-[#08140e]">
            <img
              src={HERO_IMAGE}
              alt="Aerial Rice Paddy Field"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 40%" }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(8,20,14,0.94) 0%, rgba(8,20,14,0.75) 55%, rgba(8,20,14,0.45) 100%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(8,20,14,0.9) 0%, transparent 65%)" }} />
          </div>

          <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-8 pb-14 pt-28 sm:pt-36">
            <div className="max-w-[780px]">
              
              {/* Mobile Eyebrow Badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 shadow-sm border border-white/20 max-w-full"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: "0 0 8px rgba(251,191,36,0.8)" }} />
                <span className="truncate" style={{ fontSize: "9.5px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold-light)", fontWeight: 700 }}>
                  Owner: M. Adinarayan · Est. 2008
                </span>
              </motion.div>

              {/* Mobile Scaled Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-white mb-4 leading-tight"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(36px, 7.5vw, 84px)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                }}
              >
                Tejas Canvassing
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-8 text-xs sm:text-base text-white/85 font-light leading-relaxed max-w-lg"
              >
                Founded in 2008 by M. Adinarayan, Tejas Canvassing is renowned for famous flagship brands — <span className="font-semibold text-amber-300">Keshar Kali</span>, <span className="font-semibold text-amber-300">JMR</span>, and <span className="font-semibold text-amber-300">Simha</span> — delivered across Karnataka, Tamil Nadu, and Andhra Pradesh. Trusted by over 300 happy wholesale buyers.
              </motion.p>

              {/* Subtle Small Install App Button (Non-Distracting) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="mb-3"
              >
                <button
                  onClick={() => setIsPwaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[10.5px] font-bold tracking-wider uppercase rounded-full border border-white/25 bg-white/10 text-amber-300 backdrop-blur-md hover:bg-white/20 transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <Download size={13} className="text-amber-400" />
                  <span>Install App</span>
                </button>
              </motion.div>

              {/* Main Hero Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-10"
              >
                <button
                  onClick={() => navigate(isLoggedInMerchant ? '/store' : '/signup')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 px-7 py-3.5 text-xs font-extrabold tracking-widest uppercase rounded-full shadow-xl cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                    color: "var(--brand-dark)",
                    boxShadow: "0 6px 24px rgba(201,161,88,0.4)",
                  }}
                >
                  {isLoggedInMerchant ? (
                    <>
                      <LogIn size={15} />
                      <span>Log In to Webstore</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      <span>Sign Up</span>
                    </>
                  )}
                </button>

                <a
                  href="#contact"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 px-6 py-3.5 text-xs font-semibold tracking-widest uppercase rounded-full text-white border border-white/30 backdrop-blur-xl shadow-md cursor-pointer bg-white/10 hover:bg-white/20"
                >
                  <span>Request Quote</span>
                  <ArrowRight size={14} />
                </a>
              </motion.div>

              {/* Mobile 2x2 Stat Grid */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl"
              >
                {[
                  { value: "Est. 2008", label: "Year Founded" },
                  { value: "300+", label: "Happy Customers" },
                  { value: "3 States", label: "KA · TN · AP" },
                  { value: "Trusted", label: "Mill Partners" },
                ].map((stat) => (
                  <div key={stat.label} className="p-2.5 text-center rounded-xl bg-white/5 border border-white/10">
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 600, color: "#ffffff", display: "block" }}>
                      {stat.value}
                    </span>
                    <span style={{ fontSize: "8.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                      {stat.label}
                    </span>
                  </div>
                ))}
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── 2. TRUST STRIP ── */}
        <section className="py-12 relative z-20" style={{ background: "var(--brand-dark)" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px flex-1 bg-white/10 max-w-[80px]" />
              <span style={{ fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                Tejas Canvassing Highlights
              </span>
              <div className="h-px flex-1 bg-white/10 max-w-[80px]" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {trustStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center justify-center text-center p-5 sm:p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
                >
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(26px, 5vw, 48px)", fontWeight: 400, color: "#ffffff", marginBottom: "4px" }}>
                    {stat.value}
                  </span>
                  <div className="w-6 h-px mb-2" style={{ background: "var(--gold)" }} />
                  <span style={{ fontSize: "9.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. PRODUCT SHOWCASE (COMPACT HIGH-DENSITY PORTFOLIO) ── */}
        <section id="products" className="py-10 sm:py-16 md:py-20" style={{ background: "var(--warm-bg)" }}>
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8">
            
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                  <span className="text-[9.5px] uppercase tracking-[0.2em] font-bold text-amber-700">
                    Portfolio & Live Catalog (Tap for Specs)
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl sm:text-3xl md:text-5xl font-normal text-[#0D1F15] leading-tight">
                  Famous Brands & Rice Varieties
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 font-light mt-1 max-w-xl">
                  Direct mill canvassing across Karnataka, Tamil Nadu, and Andhra Pradesh since 2008.
                </p>
              </div>

              {/* View and Count summary */}
              <div className="flex items-center gap-2 self-start md:self-end">
                <span className="text-[11px] font-semibold text-stone-600 bg-white/80 border border-stone-200/80 px-2.5 py-1 rounded-lg shadow-2xs">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Variety' : 'Varieties'}
                </span>
                <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    onClick={() => setViewDensity("grid")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      viewDensity === "grid" 
                        ? "bg-[#0d2318] text-amber-300 shadow-2xs" 
                        : "text-stone-500 hover:text-stone-900"
                    }`}
                    title="Grid View"
                  >
                    <span>Grid</span>
                  </button>
                  <button
                    onClick={() => setViewDensity("list")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      viewDensity === "list" 
                        ? "bg-[#0d2318] text-amber-300 shadow-2xs" 
                        : "text-stone-500 hover:text-stone-900"
                    }`}
                    title="Compact List View"
                  >
                    <span>List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Search Controls Bar */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-stone-200/80 shadow-xs mb-6 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search brand, grain variety, origin (e.g. Keshar Kali, JMR, Sona, Urad)..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills (Horizontal scrolling for mobile) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pt-0.5 text-xs">
                {[
                  { id: "all", label: "All Varieties" },
                  { id: "famous", label: "⭐ Famous Brands" },
                  { id: "kollam_raw", label: "Kollam & Raw" },
                  { id: "steam", label: "Steam & HMT" },
                  { id: "sona", label: "Sona Masoori" },
                  { id: "basmati", label: "Basmati & Scented" },
                  { id: "pulses", label: "Pulses & Dal" },
                ].map((cat) => {
                  const isActive = productCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setProductCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? "bg-[#0d2318] text-amber-300 shadow-sm ring-1 ring-amber-400/40"
                          : "bg-stone-100/80 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900"
                      }`}
                    >
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Cards Layout */}
            {filteredProducts.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-2xl bg-white border border-stone-200 shadow-xs max-w-md mx-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-stone-900 text-base mb-1">No Varieties Found</h3>
                <p className="text-xs text-stone-500 mb-4">
                  No products matched your search "{productSearch}" in this category.
                </p>
                <button
                  onClick={() => {
                    setProductSearch("");
                    setProductCategory("all");
                  }}
                  className="px-4 py-2 bg-[#0d2318] text-amber-300 text-xs font-bold rounded-xl shadow-xs hover:bg-[#122e20] transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewDensity === "grid" ? (
              /* High-Density Responsive Grid with Smooth In-Place Expansion */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4.5 items-start">
                {filteredProducts.map((product) => {
                  const isFamous = !!product.isFamous;
                  const isExpanded = expandedCardId === product.id;
                  const activeTab = cardActiveTab[product.id] || 'specs';
                  const qty = cardQuantities[product.id] || 50;
                  const unitPrice = product.price || 3450;
                  const estimatedTotal = (qty * (unitPrice / 2)); // 50kg bag estimate
                  const resolvedImg = resolveBrandImage(product.name, product.image);

                  return (
                    <article
                      key={product.id}
                      className={`group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 bg-white border ${
                        isExpanded
                          ? "ring-2 ring-amber-400 shadow-xl border-amber-400 bg-gradient-to-b from-amber-50/25 via-white to-stone-50/50"
                          : isFamous 
                            ? "border-amber-400/80 shadow-xs hover:shadow-md hover:border-amber-400 ring-1 ring-amber-400/20" 
                            : "border-stone-200/90 shadow-2xs hover:shadow-md hover:border-stone-300"
                      }`}
                    >
                      {/* Product Media */}
                      <div className="relative overflow-hidden h-36 sm:h-44 bg-stone-100">
                        <img
                          src={resolvedImg}
                          alt={product.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = resolveBrandImage(product.name);
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                        
                        {/* Gradient Shadow for Legibility */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

                        {/* Top-Right: Famous or Badge */}
                        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                          {isFamous ? (
                            <span className="px-2 py-0.5 bg-amber-400 text-emerald-950 text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-full shadow-md flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-emerald-950" />
                              <span>Famous Brand</span>
                            </span>
                          ) : product.badge ? (
                            <span className="px-2 py-0.5 bg-white/95 backdrop-blur-md text-stone-700 text-[8px] font-bold rounded-md shadow-xs border border-stone-200/60">
                              {product.badge}
                            </span>
                          ) : null}
                        </div>

                        {/* Top-Left: Origin */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md text-white text-[8px] font-semibold rounded-md shadow-xs flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-amber-300" />
                            <span className="truncate max-w-[120px]">{product.origin}</span>
                          </span>
                        </div>

                        {/* Bottom-Left: Live Wholesale Price */}
                        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                          {product.price ? (
                            <span className="px-2 py-0.5 bg-emerald-950/90 backdrop-blur-md text-amber-300 text-[9.5px] font-black rounded-md flex items-center gap-1 shadow-md border border-amber-400/40">
                              ₹{product.price.toLocaleString('en-IN')}/{product.unit || 'qtl'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-amber-200 text-[8.5px] font-bold rounded-md border border-white/10">
                              APMC Benchmark
                            </span>
                          )}
                        </div>

                        {/* Bottom-Right: Quick Full Inspector Button */}
                        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(product);
                            }}
                            title="Open Full Screen Inspector"
                            className="p-1.5 bg-white/90 text-stone-800 hover:bg-white hover:text-black rounded-full flex items-center justify-center backdrop-blur-md shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Product Card Core Content */}
                      <div className="p-3 sm:p-4 flex flex-col justify-between flex-grow">
                        <div>
                          {/* Grain Type / Subtitle */}
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-800 truncate">
                              {product.type}
                            </span>
                            <span className="text-[9px] font-medium text-stone-400 truncate">
                              {product.cookingSpecs?.[0]?.split(':')[0] || 'Laser Sortex'}
                            </span>
                          </div>
                          
                          {/* Product Name */}
                          <h3 
                            style={{ fontFamily: "var(--font-serif)" }} 
                            className="text-base sm:text-lg font-bold text-stone-900 truncate leading-snug"
                          >
                            {product.name}
                          </h3>

                          {/* Clamped Description */}
                          <p className="text-[11px] sm:text-xs text-stone-600 leading-relaxed mt-1 font-normal line-clamp-2">
                            {product.description}
                          </p>
                        </div>
                        
                        {/* Interactive Expand / Collapse Toggle Bar */}
                        <div className="pt-2.5 mt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                              isExpanded
                                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                : "bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-900"
                            }`}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
                                <span>Hide Specs</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
                                <span>Inspect & Quote</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className="text-[10.5px] font-bold text-emerald-800 hover:text-amber-700 transition-colors flex items-center gap-0.5 cursor-pointer ml-auto"
                          >
                            <span>Details</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        </div>

                        {/* Smooth Animated In-Place Expansion Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="overflow-hidden mt-3 pt-3 border-t border-amber-200/80"
                            >
                              {/* Sub-Tabs */}
                              <div className="flex rounded-lg p-0.5 bg-stone-100/90 text-[10px] font-bold text-stone-600 mb-2.5">
                                <button
                                  type="button"
                                  onClick={() => setCardActiveTab(prev => ({ ...prev, [product.id]: 'specs' as const }))}
                                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                                    activeTab === 'specs' ? "bg-white text-stone-900 shadow-2xs" : "hover:text-stone-900"
                                  }`}
                                >
                                  ⚡ Specs
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCardActiveTab(prev => ({ ...prev, [product.id]: 'origin' as const }))}
                                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                                    activeTab === 'origin' ? "bg-white text-stone-900 shadow-2xs" : "hover:text-stone-900"
                                  }`}
                                >
                                  🏛️ Origin
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCardActiveTab(prev => ({ ...prev, [product.id]: 'calc' as const }))}
                                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                                    activeTab === 'calc' ? "bg-amber-400 text-emerald-950 shadow-2xs font-extrabold" : "hover:text-stone-900"
                                  }`}
                                >
                                  🧮 Wholesale
                                </button>
                              </div>

                              {/* Tab 1: Specs */}
                              {activeTab === 'specs' && (
                                <div className="space-y-1.5 p-2 rounded-xl bg-amber-50/40 border border-amber-200/60 text-[10.5px]">
                                  <div className="grid grid-cols-1 gap-1">
                                    {(product.cookingSpecs || ["100% Laser Sortex Cleaned", "Moisture: <13%", "Natural Aged Kernel", "Zero Stones/Foreign Seeds"]).map((spec, sIdx) => (
                                      <div key={sIdx} className="flex items-center gap-1.5 text-stone-700">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                        <span className="truncate">{spec}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {product.packagingOptions && (
                                    <div className="pt-1.5 border-t border-amber-200/50 flex items-center gap-1 text-stone-500 text-[9.5px]">
                                      <Package className="w-3 h-3 text-amber-700 shrink-0" />
                                      <span className="truncate">{product.packagingOptions}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab 2: Origin & Heritage */}
                              {activeTab === 'origin' && (
                                <div className="space-y-1.5 p-2 rounded-xl bg-stone-50 border border-stone-200 text-[10.5px]">
                                  <p className="text-stone-700 leading-snug">
                                    {product.history || product.description}
                                  </p>
                                  {product.sourcingLocation && (
                                    <div className="pt-1.5 border-t border-stone-200 flex items-start gap-1 text-emerald-800 text-[9.5px] font-semibold">
                                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{product.sourcingLocation}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab 3: Wholesale Calculator & Instant Dispatch */}
                              {activeTab === 'calc' && (
                                <div className="p-2.5 rounded-xl bg-emerald-950 text-white space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-stone-300 font-medium">Order Quantity:</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setCardQuantities(prev => ({ ...prev, [product.id]: Math.max(10, qty - 10) }))}
                                        className="w-6 h-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center font-bold text-sm cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <span className="font-bold text-amber-300 text-xs min-w-[55px] text-center">
                                        {qty} Bags
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setCardQuantities(prev => ({ ...prev, [product.id]: qty + 10 }))}
                                        className="w-6 h-6 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center font-bold text-sm cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10.5px]">
                                    <span className="text-stone-300">Est. Total:</span>
                                    <span className="font-black text-amber-300 text-xs">
                                      ₹{Math.round(estimatedTotal).toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const text = `Hello Tejas Canvassing, I would like to inquire about wholesale order for ${product.name} (${qty} bags). Please share latest APMC rate, mill discount, and delivery timeline.`;
                                        window.open(`https://wa.me/919916416995?text=${encodeURIComponent(text)}`, '_blank');
                                      }}
                                      className="py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      <span>WhatsApp</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData(prev => ({ ...prev, riceType: product.name }));
                                        const el = document.getElementById('contact');
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                      }}
                                      className="py-1.5 px-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>Fill Quote</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* Compact Horizontal List View with Interactive Specs Dropdown */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
                {filteredProducts.map((product) => {
                  const isFamous = !!product.isFamous;
                  const isExpanded = expandedCardId === product.id;
                  const qty = cardQuantities[product.id] || 50;
                  const unitPrice = product.price || 3450;
                  const estimatedTotal = (qty * (unitPrice / 2));
                  const resolvedImg = resolveBrandImage(product.name, product.image);

                  return (
                    <article
                      key={product.id}
                      className={`group flex flex-col rounded-2xl overflow-hidden bg-white border p-3 transition-all duration-200 ${
                        isExpanded 
                          ? "border-amber-400 ring-2 ring-amber-400 shadow-md bg-amber-50/15" 
                          : isFamous 
                            ? "border-amber-400/80 ring-1 ring-amber-400/20 hover:shadow-sm" 
                            : "border-stone-200/80 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative w-24 sm:w-28 h-24 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-100">
                          <img
                            src={resolvedImg}
                            alt={product.name}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = resolveBrandImage(product.name);
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isFamous && (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-400 text-emerald-950 text-[7.5px] font-black rounded shadow-xs flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-emerald-950" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col justify-between flex-grow min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[8.5px] uppercase tracking-wider font-bold text-amber-800 truncate">
                                {product.type}
                              </span>
                              <span className="text-[8px] text-stone-400 truncate">
                                {product.origin}
                              </span>
                            </div>
                            <h3 style={{ fontFamily: "var(--font-serif)" }} className="text-sm sm:text-base font-bold text-stone-900 truncate">
                              {product.name}
                            </h3>
                            <p className="text-[11px] text-stone-500 line-clamp-2 leading-snug mt-0.5">
                              {product.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-stone-100 text-[10px]">
                            {product.price ? (
                              <span className="font-extrabold text-emerald-900">
                                ₹{product.price.toLocaleString('en-IN')}/{product.unit || 'qtl'}
                              </span>
                            ) : (
                              <span className="text-stone-400 truncate">{product.cookingSpecs?.[0] || 'Wholesale APMC'}</span>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedCardId(isExpanded ? null : product.id)}
                                className="text-[10px] font-bold text-amber-800 bg-amber-100/70 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              >
                                {isExpanded ? "Close" : "Specs"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedProduct(product)}
                                className="font-bold text-emerald-800 hover:text-amber-600 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Inspect</span> <ArrowUpRight className="w-3 h-3 text-amber-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable specs in list view */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2.5 pt-2.5 border-t border-amber-200/80 text-xs space-y-2"
                          >
                            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                              {(product.cookingSpecs || ["100% Laser Sortex", "Moisture: <13%"]).map((spec, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1 text-stone-700">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">{spec}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <span className="text-stone-500 font-medium">Wholesale Estimate ({qty} bags):</span>
                              <span className="font-bold text-emerald-900">₹{Math.round(estimatedTotal).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const text = `Hello Tejas Canvassing, inquiring about ${product.name} (${qty} bags wholesale). Please send APMC quote.`;
                                  window.open(`https://wa.me/919916416995?text=${encodeURIComponent(text)}`, '_blank');
                                }}
                                className="flex-1 py-1 px-2 bg-emerald-600 text-white rounded text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp Order</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, riceType: product.name }));
                                  const el = document.getElementById('contact');
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="flex-1 py-1 px-2 bg-amber-400 text-emerald-950 rounded text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Get Quote</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </article>
                  );
                })}
              </div>
            )}

          </div>
        </section>

        {/* ── 4. SUPPLY CHAIN (ROUNDED LOGO) ── */}
        <section id="process" style={{ background: "#ffffff", padding: "72px 0 96px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                  Suppliers & Process
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#0D1F15", lineHeight: 1.1 }}>
                Trusted Suppliers to<br />
                <span style={{ fontStyle: "italic" }}>Your APMC Yard</span>
              </h2>
            </div>

            <div className="grid lg:grid-cols-5 gap-6 items-stretch">
              
              {/* Brand Glass Column with Rounded Logo */}
              <div
                className="lg:col-span-2 relative overflow-hidden rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-lg border border-white/20"
                style={{ minHeight: "360px", background: "var(--brand-dark)" }}
              >
                <img 
                  src="/logo.png" 
                  alt="Tejas Canvassing Logo" 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl p-2 border-2 border-amber-400/50 bg-white/10 backdrop-blur-md mb-5 shadow-xl" 
                />
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, letterSpacing: "0.18em", color: "#ffffff" }}>
                  TEJAS CANVASSING
                </div>
                <div style={{ fontSize: "8.5px", letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase", fontWeight: 700, marginTop: "4px" }}>
                  Owner: M. Adinarayan · Est. 2008
                </div>
                
                <div className="mt-6 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md max-w-xs">
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.85)" }}>
                    "17+ Years of Business Integrity & Over 300 Happy Customers"
                  </p>
                </div>
              </div>

              {/* Timeline Cards */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                {supplySteps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div 
                      key={step.id} 
                      className="flex items-start gap-4 p-4 rounded-xl border bg-stone-50/70 border-stone-200/80"
                    >
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1b4332] text-amber-300 shrink-0 shadow-xs">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#111827", marginBottom: "2px" }}>
                          {step.title}
                        </h3>
                        <p style={{ fontSize: "12px", fontWeight: 300, color: "#6B7280", lineHeight: 1.6 }}>
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        </section>

        {/* ── 5. WHY CHOOSE US ── */}
        <section id="why-us" className="relative overflow-hidden py-20" style={{ background: "#0d2318" }}>
          <div className="absolute inset-0 z-0 opacity-20">
            <img src={FIELD_IMAGE} alt="Field" className="w-full h-full object-cover" />
          </div>

          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10">
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                  Why Choose Tejas Canvassing
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#ffffff" }}>
                The Tejas <span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>Advantage</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div 
                    key={feat.id} 
                    className="p-6 rounded-2xl border border-[#c9a158]/30 bg-[#0d2318]/90 backdrop-blur-xl shadow-lg"
                  >
                    <div className="w-10 h-10 mb-4 flex items-center justify-center rounded-xl bg-[#c9a158]/15 border border-[#c9a158]/35 text-[#c9a158] shadow-xs">
                      <Icon size={20} />
                    </div>
                    <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 500, color: "#ffffff", marginBottom: "6px" }}>
                      {feat.title}
                    </h3>
                    <p style={{ fontSize: "12px", fontWeight: 300, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                      {feat.description}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ── 6. REGIONAL SERVICE LOCATIONS ── */}
        <section id="global-presence" style={{ background: "#ffffff", padding: "72px 0 96px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                  <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                    Our Service Locations
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#0D1F15", marginBottom: "12px" }}>
                  Serving <span style={{ fontStyle: "italic" }}>Karnataka, Tamil Nadu & Andhra</span>
                </h2>
                <p style={{ fontSize: "13.5px", fontWeight: 300, color: "#6B7280", lineHeight: 1.7, marginBottom: "24px" }}>
                  With headquarters at APMC Yard Yeshwanthpur, we provide dedicated rice canvassing across South India.
                </p>

                <div className="space-y-3">
                  {regions.map((reg) => (
                    <div 
                      key={reg.name} 
                      className="p-4 rounded-xl flex items-start gap-3 bg-stone-50 border border-stone-200/80"
                    >
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: reg.color }} />
                      <div>
                        <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontWeight: 600, color: "#111827" }}>
                          {reg.name}
                        </h4>
                        <p style={{ fontSize: "11.5px", color: "#6B7280", fontWeight: 300, lineHeight: 1.5, marginTop: "2px" }}>
                          {reg.markets.join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative aspect-[16/10] sm:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                <img src={MARKET_IMAGE} alt="Wholesale Market" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div 
                  className="absolute bottom-4 left-4 p-4 rounded-xl text-white shadow-xl border border-white/20 bg-[#0d2318]/90 backdrop-blur-md"
                >
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 500, lineHeight: 1 }}>
                    300<span style={{ color: "var(--gold)" }}>+</span>
                  </div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", fontWeight: 600, marginTop: "2px" }}>
                    Happy Customers (KA · TN · AP)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. TESTIMONIALS ── */}
        <section style={{ padding: "72px 0 96px", background: "var(--warm-bg)" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                  <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                    Client Testimonials
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px, 5.5vw, 60px)", fontWeight: 400, color: "#0D1F15" }}>
                  Trusted by <span style={{ fontStyle: "italic" }}>300+ Merchants</span>
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => goToTesti(testiIndex === 0 ? testimonials.length - 1 : testiIndex - 1)}
                  className="w-9 h-9 border border-stone-300 flex items-center justify-center rounded-full text-slate-700 bg-white shadow-xs"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => goToTesti(testiIndex === testimonials.length - 1 ? 0 : testiIndex + 1)}
                  className="w-9 h-9 border border-stone-300 flex items-center justify-center rounded-full text-slate-700 bg-white shadow-xs"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div 
              className="p-6 sm:p-12 rounded-2xl shadow-lg border border-[#c9a158]/30 bg-white/90 backdrop-blur-xl"
            >
              <blockquote style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 4vw, 26px)", fontStyle: "italic", color: "#1F2937", lineHeight: 1.5, marginBottom: "24px" }}>
                "{currentTesti.quote}"
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-serif text-base font-bold shadow-xs bg-[#c9a158]/20 text-[#9A7A3E]">
                  {currentTesti.initials}
                </div>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{currentTesti.name}</h4>
                  <p style={{ fontSize: "11.5px", color: "#6B7280" }}>{currentTesti.role} · {currentTesti.company}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. MOBILE-FIRST INQUIRY FORM ── */}
        <section id="contact" style={{ background: "var(--brand-dark)", padding: "72px 0 96px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-5 gap-10">
              
              <div className="lg:col-span-2 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                  <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                    Get a Quote
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 54px)", fontWeight: 400, lineHeight: 1.1, marginBottom: "16px" }}>
                  Let's Build a<br />
                  <span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>Supply Partnership</span>
                </h2>
                <p style={{ fontSize: "13.5px", fontWeight: 300, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: "24px" }}>
                  Connect directly with M. Adinarayan & Tejas Canvassing for wholesale pricing on Keshar Kali, JMR, and Simha lines.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-xs text-white/90 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">123, 4th Main Rd, APMC Yard, Yeshwanthpur, Bengaluru 560022</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/90 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>+91 9916416995 / +91 9342380981</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/90 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>tejascanvassing@gmail.com</span>
                  </div>
                </div>
              </div>

              {/* Form Panel */}
              <div 
                className="lg:col-span-3 p-6 sm:p-10 rounded-2xl shadow-xl border border-white/20 bg-white/5 backdrop-blur-2xl"
              >
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "#ffffff", marginBottom: "20px" }}>
                  Inquiry Details
                </h3>

                <form onSubmit={handleFormSubmit} className="space-y-4 text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Full Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Company Name</label>
                      <input
                        required
                        type="text"
                        value={formData.company}
                        onChange={e => setFormData({...formData, company: e.target.value})}
                        placeholder="Global Foods Ltd."
                        className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Email Address</label>
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="john@example.com"
                        className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Phone / WhatsApp</label>
                      <input
                        required
                        type="tel"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+91 98450 XXXXX"
                        className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Brand / Variety</label>
                      <select
                        value={formData.riceType}
                        onChange={e => setFormData({...formData, riceType: e.target.value})}
                        className="w-full px-3.5 py-3 rounded-xl bg-[#0d2318] border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      >
                        <option value="Keshar Kali (Famous Kollam)">Keshar Kali (Famous Kollam Raw)</option>
                        <option value="JMR (Famous HMT & Raw)">JMR (Famous HMT & Raw)</option>
                        <option value="Simha Urad Dal (Famous Pulses)">Simha Urad Dal (Famous Pulses)</option>
                        <option value="Mahendra Cow (Kollam)">Mahendra Cow (Kollam)</option>
                        <option value="Basmati 1121">Basmati 1121</option>
                        <option value="Sona Masoori">Sona Masoori</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Quantity (MT)</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={e => setFormData({...formData, quantity: e.target.value})}
                        placeholder="e.g. 50"
                        className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9.5px] uppercase tracking-widest text-white/70 block mb-1 font-semibold">Additional Requirements</label>
                    <textarea
                      rows={3}
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                      placeholder="Describe packaging preferences (25kg/50kg), delivery location..."
                      className="w-full px-3.5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs outline-none focus:border-amber-400 resize-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-300 text-[#0d2318] font-extrabold text-xs uppercase tracking-widest rounded-full shadow-xl flex items-center justify-center gap-2 cursor-pointer mt-4 active:scale-95"
                  >
                    <Send size={14} />
                    <span>Send Inquiry to WhatsApp</span>
                  </button>
                </form>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* ── EXPANDED PRODUCT DETAILS MODAL (APPLE GLASS) ── */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative bg-[#0d2318]/92 text-white rounded-3xl overflow-hidden shadow-2xl border border-amber-400/40 max-w-2xl w-full z-10 max-h-[90vh] flex flex-col my-auto backdrop-blur-2xl"
              style={{
                fontFamily: "var(--font-sans)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(245, 158, 11, 0.15)"
              }}
            >
              {/* Modal Header Bar */}
              <div className="relative h-48 sm:h-60 shrink-0 overflow-hidden bg-stone-900">
                <img 
                  src={resolveBrandImage(selectedProduct.name, selectedProduct.image)} 
                  alt={selectedProduct.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = resolveBrandImage(selectedProduct.name);
                  }}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d2318] via-[#0d2318]/60 to-black/30" />
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2.5 rounded-full bg-black/60 text-white/80 hover:text-white backdrop-blur-md border border-white/20 cursor-pointer transition-all hover:scale-105"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>

                {/* Header Title & Badges */}
                <div className="absolute bottom-3 sm:bottom-4 left-4 sm:left-6 right-4 sm:right-6 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-widest text-amber-300 font-extrabold px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 backdrop-blur-md">
                        {selectedProduct.type}
                      </span>
                      <span className="text-[10px] text-stone-300 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        {selectedProduct.origin}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl sm:text-3xl font-bold text-white leading-tight truncate">
                      {selectedProduct.name}
                    </h3>
                    {selectedProduct.price ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-400 text-emerald-950 font-black text-xs sm:text-sm rounded-md shadow-md flex items-center gap-1">
                          ₹{selectedProduct.price.toLocaleString('en-IN')}/{selectedProduct.unit || 'qtl'}
                        </span>
                        {selectedProduct.supplier && (
                          <span className="text-[10.5px] text-amber-200/90 truncate">
                            Via {selectedProduct.supplier}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {selectedProduct.isFamous && (
                    <span className="px-3 py-1 bg-amber-400 text-emerald-950 font-black text-[10px] uppercase tracking-wider rounded-full flex items-center gap-1 shadow-lg shrink-0">
                      <Star className="w-3.5 h-3.5 fill-emerald-950" />
                      <span>Famous Brand</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Navigation Sub-Tabs */}
              <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'specs', label: '⚡ Specs & Sortex' },
                  { id: 'heritage', label: '🏛️ Origin & Mill' },
                  { id: 'calc', label: '🧮 Wholesale Order' },
                  { id: 'packaging', label: '📦 Packaging Formats' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      modalTab === tab.id
                        ? "bg-amber-400 text-emerald-950 shadow-md font-extrabold"
                        : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-grow max-h-[50vh]">
                {/* 1. Grain & Cooking Specs */}
                {modalTab === 'specs' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <ChefHat className="w-4 h-4" />
                        <span>Sortex Purity & Cooking Parameters</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {(selectedProduct.cookingSpecs || [
                          "Grain Swell Ratio: 3.8x High Volume",
                          "Moisture Content: 12.8% strictly tested",
                          "100% Optical Laser Sortex Cleaned",
                          "Double Polish Silk Texture Kernel"
                        ]).map((spec, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-white/90 bg-white/5 p-2 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{spec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Sourcing Mill Location & Heritage */}
                {modalTab === 'heritage' && (
                  <div className="space-y-3">
                    {selectedProduct.history && (
                      <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                          <Sparkles className="w-4 h-4" />
                          <span>Brand History & Reputation</span>
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed font-light">
                          {selectedProduct.history}
                        </p>
                      </div>
                    )}

                    {selectedProduct.sourcingLocation && (
                      <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                          <MapPin className="w-4 h-4" />
                          <span>Milling Hub & APMC Desk</span>
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed font-light">
                          {selectedProduct.sourcingLocation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Wholesale Calculator & Instant Dispatch */}
                {modalTab === 'calc' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-400/30 backdrop-blur-md space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-200 font-semibold">Order Volume (Bags):</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModalQty(Math.max(10, modalQty - 10))}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center text-base cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <span className="font-black text-amber-300 text-sm min-w-[70px] text-center">
                            {modalQty} Bags
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalQty(modalQty + 10)}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center text-base cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                        <span className="text-stone-300">Estimated Wholesale Total:</span>
                        <span className="font-extrabold text-amber-300 text-base">
                          ₹{Math.round(modalQty * ((selectedProduct.price || 3450) / 2)).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const text = `Hello Tejas Canvassing, I would like to place/inquire about a wholesale order for ${selectedProduct.name} (${modalQty} bags). Please share official APMC contract rate, delivery date, and freight details.`;
                          window.open(`https://wa.me/919916416995?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Order {modalQty} Bags on WhatsApp</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Packaging Formats */}
                {modalTab === 'packaging' && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                      <Package className="w-4 h-4" />
                      <span>Standard Packaging & Bag Formats</span>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed font-light">
                      {selectedProduct.packagingOptions || "25 kg & 50 kg Moisture-Proof BOPP & Non-Woven Branded Bags with Inner Liner"}
                    </p>
                  </div>
                )}

                {/* Action CTAs */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 border-t border-white/10">
                  <button
                    onClick={() => {
                      const brandName = selectedProduct.name;
                      setSelectedProduct(null);
                      setFormData(prev => ({ ...prev, riceType: brandName }));
                      const contactElem = document.getElementById('contact');
                      if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-400 to-amber-300 text-[#0d2318] font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-transform"
                  >
                    <Send size={14} />
                    <span>Inquire Wholesale Quote for {selectedProduct.name}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      navigate('/login');
                    }}
                    className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all"
                  >
                    <ShoppingBag size={14} className="text-amber-300" />
                    <span>Merchant Store</span>
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <footer style={{ background: "var(--dark-bg)", color: "#9CA3AF" }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "48px 0" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/logo.png" alt="Tejas Canvassing" className="w-10 h-10 object-contain rounded-xl p-1 border border-amber-400/40 bg-white/10 shadow-md" />
                  <div>
                    <span className="text-white tracking-widest block" style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600 }}>
                      TEJAS CANVASSING
                    </span>
                    <span className="text-[9.5px] text-amber-400 font-semibold tracking-wider block">
                      Owner: M. Adinarayan · Est. 2008
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "#6B7280", maxWidth: "340px", lineHeight: 1.7 }}>
                  Serving over 300 happy customers across Karnataka, Tamil Nadu, and Andhra Pradesh with famous brands like Keshar Kali, JMR, and Simha.
                </p>
              </div>

              <div>
                <h5 className="text-white mb-3 uppercase tracking-widest text-[9.5px] font-semibold">Famous Brands</h5>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li><a href="#products" className="hover:text-white text-amber-300">⭐ Keshar Kali Kollam</a></li>
                  <li><a href="#products" className="hover:text-white text-amber-300">⭐ JMR Steam & Raw</a></li>
                  <li><a href="#products" className="hover:text-white text-amber-300">⭐ Simha Urad Dal</a></li>
                </ul>
              </div>

              <div>
                <h5 className="text-white mb-3 uppercase tracking-widest text-[9.5px] font-semibold">Wholesale Portal</h5>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li><button onClick={() => navigate('/login')} className="hover:text-white text-amber-300 text-left cursor-pointer font-bold">🛒 Merchant Log In & Webstore</button></li>
                  <li><button onClick={() => navigate('/admintejas1679')} className="hover:text-white text-left cursor-pointer">Admin Access</button></li>
                  <li><button onClick={() => navigate('/employee1977')} className="hover:text-white text-left cursor-pointer">Employee Portal</button></li>
                </ul>
              </div>

              <div>
                <h5 className="text-white mb-3 uppercase tracking-widest text-[9.5px] font-semibold">Contact APMC Desk</h5>
                <p className="text-xs text-gray-400 leading-relaxed">
                  123, 4th Main Rd, APMC Yard,<br />
                  Yeshwanthpur, Bengaluru 560022<br />
                  Ph: +91 9916416995
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-center text-[11px] text-gray-500 gap-3 text-center sm:text-left">
          <p>© 2025 Tejas Canvassing Pvt. Ltd. Founded by M. Adinarayan (2008).</p>
          <div className="flex items-center gap-3 text-gray-400">
            <span>300+ Happy Customers</span>
            <span>•</span>
            <span>Karnataka · TN · AP</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
