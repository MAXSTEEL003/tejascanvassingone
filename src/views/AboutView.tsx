import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Menu, X, Globe, Phone, Mail, MapPin, 
  ArrowRight, ArrowUpRight, Sprout, Factory, FlaskConical, Package, Ship, 
  Leaf, Award, Truck, ShieldCheck, ChevronLeft, ChevronRight, 
  Send, MessageCircle, LogIn, UserPlus, Download, Sparkles, CheckCircle2, Star, User, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PwaInstallModal from "../components/PwaInstallModal";
import AboutScrollExperience from "../components/AboutScrollExperience";
import { getCollectionDocs } from "../lib/firebase";

// ── Trust Strip Stats ──
const trustStats = [
  { value: "Est. 2008", label: "Owner: M. Adinarayan" },
  { value: "300+", label: "Happy Customers" },
  { value: "3 States", label: "KA · TN · AP" },
  { value: "Trusted", label: "Mill Suppliers" },
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
    title: "Flagship Brands: Keshar Kali, JMR, Simha",
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
  { label: "Grain Journey", href: "#grain-journey", isRoute: false },
  { label: "Process", href: "#process" },
  { label: "Why Us", href: "#why-us" },
  { label: "Regions", href: "#global-presence" },
  { label: "Contact", href: "#contact" },
];

export default function AboutView() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

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

  // Sync scroll and merchant auth state
  useEffect(() => {
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
          className="max-w-[1280px] mx-auto px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl sm:rounded-full transition-all duration-300 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]"
          style={{
            background: isScrolled ? "rgba(10, 26, 17, 0.95)" : "rgba(7, 19, 13, 0.90)",
            backdropFilter: "blur(28px) saturate(200%)",
            WebkitBackdropFilter: "blur(28px) saturate(200%)",
            boxShadow: "0 8px 32px -4px rgba(0,0,0,0.5), inset 0 1px 1px 0 rgba(255,255,255,0.15)",
            borderColor: isScrolled ? "rgba(201, 161, 88, 0.4)" : "rgba(255, 255, 255, 0.2)",
            borderWidth: "1px",
            borderStyle: "solid"
          }}
        >

          {/* Brand Identity with Rounded Logo Border */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 group cursor-pointer select-none shrink-0">
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="Tejas Canvassing Logo"
                className="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded-xl p-0.5 border border-amber-400/40 bg-white/10 transition-transform duration-300 group-hover:scale-105 shadow-xs"
              />
            </div>
            <div className="flex flex-col">
              <span
                className="tracking-wider transition-colors duration-300 font-bold leading-tight whitespace-nowrap text-white"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "13px",
                }}
              >
                TEJAS CANVASSING
              </span>
              <span
                className="tracking-[0.14em] uppercase transition-colors duration-300 leading-none mt-0.5 whitespace-nowrap"
                style={{
                  fontSize: "7px",
                  color: "var(--gold)",
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
              link.isRoute ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => navigate(link.href)}
                  className="transition-all duration-200 relative group text-[11px] font-bold uppercase tracking-[0.18em] cursor-pointer flex items-center gap-1 text-amber-300 hover:text-amber-200"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{link.label}</span>
                  <span
                    className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                    style={{ background: "var(--gold)" }}
                  />
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="transition-all duration-200 relative group text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 hover:text-amber-300"
                >
                  {link.label}
                  <span
                    className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                    style={{ background: "var(--gold)" }}
                  />
                </a>
              )
            ))}

            {/* Install App Button */}
            <button
              onClick={() => setIsPwaModalOpen(true)}
              className="px-3 py-1.5 rounded-full border border-amber-400/30 bg-white/10 hover:bg-white/20 text-white transition-all duration-300 text-[10.5px] font-bold tracking-wider uppercase flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md"
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
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="px-2.5 py-1.5 rounded-full transition-all duration-300 active:scale-95 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
              style={{
                background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)",
                color: "var(--brand-dark)",
              }}
            >
              <LogIn className="w-3 h-3" />
              <span>Log In</span>
            </button>

            <button
              className="p-1.5 transition-colors duration-200 rounded-full cursor-pointer hover:bg-white/10 shrink-0 text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
            className="fixed inset-3 z-50 flex flex-col justify-between lg:hidden rounded-3xl p-5 sm:p-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl border border-white/20 overflow-y-auto"
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
                link.isRoute ? (
                  <motion.button
                    key={link.label}
                    type="button"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => { setIsMobileMenuOpen(false); navigate(link.href); }}
                    className="text-amber-300 hover:text-white transition-colors text-2xl font-medium tracking-wide text-center cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>{link.label}</span>
                  </motion.button>
                ) : (
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
                )
              ))}
              
              <div className="w-full pt-4 border-t border-white/10 flex flex-col gap-3">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }}
                  className="w-full py-3.5 text-emerald-950 bg-amber-400 font-sans font-extrabold text-xs uppercase tracking-widest rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <LogIn size={16} />
                  <span>Login to Portal</span>
                </button>

                {!isLoggedInMerchant && (
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); navigate('/signup'); }}
                    className="w-full py-2.5 text-white/80 bg-white/5 border border-white/10 font-sans font-semibold text-[11px] uppercase tracking-wider rounded-full flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <UserPlus size={14} />
                    <span>New Merchant Registration</span>
                  </button>
                )}

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
        
        {/* ── 1. CONTINUOUS SCROLL ANIMATION (EXACTLY AS IN THE VIDEO) ── */}
        <AboutScrollExperience />

        {/* ── 2. QUICK ACTION: REQUEST QUOTE ── */}
        <section className="py-4 sm:py-5 relative z-20 border-t border-b border-white/10" style={{ background: "#0A160F" }}>
          <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-center">
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-full text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md shadow-xs"
            >
              <span>Request Quote</span>
              <ArrowRight size={13} />
            </a>
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

        {/* ── 3. SUPPLY CHAIN & MILLING PROCESS ── */}
        
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
                        <option value="Keshar Kali (Kollam Raw)">Keshar Kali (Kollam Raw)</option>
                        <option value="JMR (HMT & Raw)">JMR (HMT & Raw)</option>
                        <option value="Simha Urad Dal">Simha Urad Dal (Sortex Pulses)</option>
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
                  Serving over 300 happy customers across Karnataka, Tamil Nadu, and Andhra Pradesh with flagship brands like Keshar Kali, JMR, and Simha.
                </p>
              </div>

              <div>
                <h5 className="text-white mb-3 uppercase tracking-widest text-[9.5px] font-semibold">Flagship Brands</h5>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li><a href="#grain-journey" className="hover:text-white text-amber-300">⭐ Keshar Kali Kollam</a></li>
                  <li><a href="#grain-journey" className="hover:text-white text-amber-300">⭐ JMR Steam & Raw</a></li>
                  <li><a href="#grain-journey" className="hover:text-white text-amber-300">⭐ Simha Urad Dal</a></li>
                </ul>
              </div>

              <div>
                <h5 className="text-white mb-3 uppercase tracking-widest text-[9.5px] font-semibold">Access</h5>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li>
                    <button 
                      onClick={() => navigate('/login')} 
                      className="hover:text-white text-amber-300 text-left cursor-pointer font-bold transition-colors block"
                    >
                      Buyer / Merchant Log In
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => navigate('/signup')} 
                      className="hover:text-white text-gray-300 text-left cursor-pointer transition-colors block"
                    >
                      Register Wholesale Buyer
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => navigate('/employee-login')} 
                      className="hover:text-white text-emerald-400 font-semibold text-left cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Employee & Operations Desk
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => navigate('/admintejas1679')} 
                      className="hover:text-white text-gray-400 text-left cursor-pointer transition-colors block text-[11px]"
                    >
                      Executive Admin Portal
                    </button>
                  </li>
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
