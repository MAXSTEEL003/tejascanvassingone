import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Menu, X, Globe, Phone, Mail, MapPin, Linkedin, Instagram, Twitter, 
  ArrowRight, ArrowUpRight, Sprout, Factory, FlaskConical, Package, Ship, 
  Leaf, Award, Truck, TrendingDown, ShieldCheck, Clock, ChevronLeft, ChevronRight, 
  Send, MessageCircle, LogIn, UserPlus, Download, Sparkles, CheckCircle2, Star, User, Info, ChefHat, ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PwaInstallModal from "../components/PwaInstallModal";

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
  id: number;
  name: string;
  type: string;
  isFamous: boolean;
  badge: string;
  description: string;
  image: string;
  tags: string[];
  origin: string;
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
    image: "/images/vnt_anuram.jpg",
    tags: ["Sona Masoori", "Steam Rice", "KNM Steam"],
    origin: "Andhra Pradesh, India",
    history: "VNT Anuram Sona Masoori is ideal for low-glycemic, light daily meals, widely distributed across Karnataka and Andhra APMC yards.",
    sourcingLocation: "Guntur & Krishna Delta, Andhra Pradesh",
    cookingSpecs: ["Medium Grain Lightness", "Low Glycemic Index", "Uniform Steam Processing"],
    packagingOptions: "25 kg & 50 kg Bags"
  },
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
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-2.5 px-3 sm:px-6">
        <div 
          className="max-w-[1280px] mx-auto px-4 py-2.5 rounded-full transition-all duration-300 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] border border-white/40"
          style={{
            background: isScrolled ? "rgba(248, 244, 238, 0.92)" : "rgba(13, 35, 24, 0.8)",
            backdropFilter: "blur(28px) saturate(200%)",
            WebkitBackdropFilter: "blur(28px) saturate(200%)",
            boxShadow: isScrolled 
              ? "inset 0 1px 1px 0 rgba(255,255,255,0.9), 0 8px 24px -6px rgba(0,0,0,0.1)"
              : "inset 0 1px 1px 0 rgba(255,255,255,0.25), 0 8px 24px -6px rgba(0,0,0,0.3)",
            borderColor: isScrolled ? "rgba(201, 161, 88, 0.35)" : "rgba(255, 255, 255, 0.25)"
          }}
        >

          {/* Brand Identity with Rounded Logo Border */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group cursor-pointer select-none">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Tejas Canvassing Logo"
                className="w-9 h-9 object-contain rounded-xl p-0.5 border border-amber-400/40 bg-white/10 transition-transform duration-300 group-hover:scale-105 shadow-sm"
              />
            </div>
            <div>
              <div
                className="tracking-widest transition-colors duration-300 leading-none"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  color: isScrolled ? "#0D2318" : "#ffffff",
                }}
              >
                TEJAS CANVASSING
              </div>
              <div
                className="tracking-[0.16em] uppercase transition-colors duration-300 mt-0.5"
                style={{
                  fontSize: "7.5px",
                  color: isScrolled ? "var(--gold)" : "rgba(255,255,255,0.75)",
                  fontWeight: 600
                }}
              >
                Est. 2008 · M. Adinarayan
              </div>
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
              className="px-3.5 py-2 rounded-full border transition-all duration-300 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
              style={{
                borderColor: isScrolled ? "rgba(201,161,88,0.4)" : "rgba(255,255,255,0.35)",
                color: isScrolled ? "var(--brand-dark)" : "#ffffff",
                background: isScrolled ? "rgba(201,161,88,0.15)" : "rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Install App</span>
            </button>

            {/* Log In Button */}
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-[11px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
              style={{
                background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                color: "var(--brand-dark)",
              }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          </div>

          {/* Right Mobile Actions - Clean & Mobile Native */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3.5 py-1.5 rounded-full transition-all duration-300 active:scale-95 text-[10.5px] font-extrabold tracking-wider uppercase flex items-center gap-1 cursor-pointer shadow-md"
              style={{
                background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                color: "var(--brand-dark)",
              }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>

            <button
              className="p-1.5 transition-colors duration-200 rounded-full cursor-pointer hover:bg-white/10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ color: isScrolled ? "#111827" : "#ffffff" }}
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
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

        {/* ── 3. PRODUCT SHOWCASE (TAP PRODUCT CARD TO EXPAND DETAILS) ── */}
        <section id="products" style={{ background: "var(--warm-bg)", padding: "72px 0 96px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px w-6" style={{ background: "var(--gold)" }} />
                <span style={{ fontSize: "9.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                  Our Famous Portfolio Brands (Tap Card for Details)
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 64px)", fontWeight: 400, color: "#0D1F15", lineHeight: 1.1 }}>
                Famous Brands:<br />
                <span style={{ fontStyle: "italic", color: "var(--gold-dark)" }}>Keshar Kali · JMR · Simha</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {products.map((product) => (
                <article
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 border bg-white/90 shadow-md relative cursor-pointer hover:shadow-xl hover:-translate-y-1"
                  style={{
                    borderColor: product.isFamous ? "rgba(201, 161, 88, 0.7)" : "rgba(0,0,0,0.08)",
                  }}
                >
                  {product.isFamous && (
                    <div className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-amber-400 text-emerald-950 text-[9px] font-extrabold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-emerald-950" />
                      <span>Famous Brand</span>
                    </div>
                  )}

                  <div className="relative overflow-hidden h-52">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#0d2318]/85 backdrop-blur-md text-white text-[8.5px] uppercase tracking-widest font-bold rounded-full border border-white/20">
                      {product.origin}
                    </div>
                    
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/60 backdrop-blur-md text-amber-300 text-[9.5px] font-semibold rounded-full flex items-center gap-1 border border-white/20">
                      <Info className="w-3 h-3" />
                      <span>Tap for History & Specs</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-grow p-5">
                    <span style={{ fontSize: "8.5px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-dark)", fontWeight: 700, marginBottom: "4px" }}>
                      {product.type}
                    </span>
                    <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 600, color: "#111827", marginBottom: "6px" }}>
                      {product.name}
                    </h3>
                    <p style={{ fontSize: "12.5px", fontWeight: 300, color: "#6B7280", lineHeight: 1.6, marginBottom: "16px" }} className="flex-grow">
                      {product.description}
                    </p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 text-[10.5px] font-bold text-emerald-800">
                      <span>View Full Specifications</span>
                      <ArrowUpRight className="w-4 h-4 text-amber-600" />
                    </div>
                  </div>
                </article>
              ))}
            </div>

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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#0d2318] text-white rounded-3xl overflow-hidden shadow-2xl border border-amber-400/40 max-w-2xl w-full z-10 max-h-[90vh] flex flex-col my-auto"
            >
              {/* Modal Header Bar */}
              <div className="relative h-48 sm:h-56 shrink-0 overflow-hidden">
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d2318] via-[#0d2318]/50 to-transparent" />
                
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white/80 hover:text-white backdrop-blur-md border border-white/20 cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-amber-300 font-extrabold block mb-1">
                      {selectedProduct.type}
                    </span>
                    <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "28px" }} className="font-semibold text-white leading-none">
                      {selectedProduct.name}
                    </h3>
                  </div>
                  {selectedProduct.isFamous && (
                    <span className="px-3 py-1 bg-amber-400 text-emerald-950 font-black text-[9px] uppercase tracking-wider rounded-full flex items-center gap-1 shadow-md">
                      <Star className="w-3 h-3 fill-emerald-950" />
                      <span>Famous Brand</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-grow">
                {/* 1. History & Heritage */}
                {selectedProduct.history && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>History & Brand Heritage</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-light">
                      {selectedProduct.history}
                    </p>
                  </div>
                )}

                {/* 2. Sourcing Mill Location */}
                {selectedProduct.sourcingLocation && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Sourcing Mill Location & Origin</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-light">
                      {selectedProduct.sourcingLocation}
                    </p>
                  </div>
                )}

                {/* 3. Cooking & Grain Specs */}
                {selectedProduct.cookingSpecs && (
                  <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>Grain & Cooking Specifications</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {selectedProduct.cookingSpecs.map((spec, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-white/85">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{spec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Packaging Formats */}
                {selectedProduct.packagingOptions && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                      <Package className="w-3.5 h-3.5" />
                      <span>Packaging & Dispatch Formats</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-light">
                      {selectedProduct.packagingOptions}
                    </p>
                  </div>
                )}

                {/* Action CTA */}
                <button
                  onClick={() => {
                    const brandName = selectedProduct.name;
                    setSelectedProduct(null);
                    setFormData(prev => ({ ...prev, riceType: brandName }));
                    const contactElem = document.getElementById('contact');
                    if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-300 text-[#0d2318] font-extrabold text-xs uppercase tracking-widest rounded-full shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Send size={14} />
                  <span>Inquire Wholesale Quote for {selectedProduct.name}</span>
                </button>
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
