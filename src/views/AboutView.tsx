import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, X, Globe, Phone, Mail, MapPin,
  ArrowRight, ArrowUpRight, Sprout, Factory, FlaskConical, Package, Ship,
  Leaf, Award, Truck, ShieldCheck, ChevronLeft, ChevronRight,
  Send, MessageCircle, LogIn, UserPlus, Download, Sparkles, CheckCircle2, Star, User, Clock, Quote
} from "lucide-react";
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import PwaInstallModal from "../components/PwaInstallModal";
import AboutScrollExperience from "../components/AboutScrollExperience";

// ── Animated count hook ──
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

// ── Scroll-triggered visibility hook ──
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Trust Strip Stats ──
const trustStats = [
  { value: 2008, label: "Est. 2008", sub: "Owner: M. Adinarayan", prefix: "", suffix: "" },
  { value: 300, label: "Happy Customers", sub: "Wholesale & Retail", prefix: "", suffix: "+" },
  { value: 3, label: "States Covered", sub: "KA · TN · AP", prefix: "", suffix: "" },
  { value: 17, label: "Years of Trust", sub: "Mill Suppliers", prefix: "", suffix: "+" },
];

// ── Supply Chain Steps ──
const supplySteps = [
  { id: 1, title: "Trusted Supplier Partnerships", detail: "Direct procurement from our network of verified millers and trusted farm suppliers across Karnataka, Tamil Nadu, and Andhra Pradesh.", icon: Sprout, color: "#22C55E" },
  { id: 2, title: "Precision Processing", detail: "Optical color sorting and state-of-the-art milling technology preserve grain integrity, aroma, and whiteness uniformity.", icon: Factory, color: "#F59E0B" },
  { id: 3, title: "Quality Verification", detail: "Every consignment is checked for moisture levels, grain length, broken ratio, and cleanliness before loading.", icon: FlaskConical, color: "#60A5FA" },
  { id: 4, title: "Hygienic Packaging", detail: "Secure, moisture-proof packaging in 25 kg and 50 kg non-woven and BOPP bags designed for long shelf life.", icon: Package, color: "#A78BFA" },
  { id: 5, title: "Delivery to KA, TN & Andhra", detail: "Direct logistics network ensuring fast, reliable delivery to APMC yards, mandis, and godowns across South India.", icon: Ship, color: "#34D399" },
];

// ── Why Choose Us Features ──
const FIELD_IMAGE = "https://images.unsplash.com/photo-1761446261012-527815651ded?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZ3JpY3VsdHVyZSUyMGdyYWluJTIwZmFybWluZyUyMGxhbmRzY2FwZSUyMGdvbGRlbiUyMHN1bnJpc2UlMjBjaW5lbWF0aWMlMjBhZXJpYWx8ZW58MXx8fHwxNzcxNzg0NTE2fDA&ixlib=rb-4.1.0&q=80&w=1080";
const features = [
  { id: 1, title: "Established Since 2008", description: "Founded by M. Adinarayan in 2008, Tejas Canvassing has over 17 years of trusted canvassing experience in APMC Yard Yeshwanthpur.", icon: User, accent: "#C9A158" },
  { id: 2, title: "Over 300 Happy Customers", description: "Serving over 300 satisfied wholesale buyers, retailers, and distributors with transparent pricing and dependable supply.", icon: Award, accent: "#34D399" },
  { id: 3, title: "Flagship Brands: Keshar Kali, JMR, Simha", description: "We are renowned for our signature Keshar Kali Kollam, JMR Steam & Raw, and Simha Urad Dal staple lines.", icon: Star, accent: "#F59E0B" },
  { id: 4, title: "Serving KA, Tamil Nadu & Andhra", description: "Comprehensive distribution network covering all major mandis and APMC yards across Karnataka, Tamil Nadu, and Andhra Pradesh.", icon: Truck, accent: "#60A5FA" },
  { id: 5, title: "Network of Trusted Suppliers", description: "Direct ties with top-tier millers and farm suppliers eliminate unnecessary markups while guaranteeing origin purity.", icon: ShieldCheck, accent: "#A78BFA" },
  { id: 6, title: "On-Time Dispatch & Delivery", description: "Dedicated transport coordination ensures every truck consignment arrives safely on schedule with complete documentation.", icon: Clock, accent: "#FB923C" },
];

// ── Regional Focus ──
const MARKET_IMAGE = "https://images.unsplash.com/photo-1759272548470-d0686d071036?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMHNoaXBwaW5nJTIwY29udGFpbmVyJTIwcG9ydCUyMGdsb2JhbCUyMGxvZ2lzdGljc3xlbnwxfHx8fDE3NzE3ODQ1MTh8MA&ixlib=rb-4.1.0&q=80&w=1080";
const regions = [
  { name: "Karnataka (APMC HQ)", markets: ["Bengaluru · APMC Yeshwanthpur", "Mysuru", "Hubballi", "Belagavi", "Davanagere"], color: "#C9A158", pct: 55 },
  { name: "Tamil Nadu", markets: ["Chennai Mandis", "Coimbatore APMC", "Madurai", "Tiruchirappalli", "Salem"], color: "#34D399", pct: 30 },
  { name: "Andhra Pradesh", markets: ["Vijayawada", "Guntur Mandi", "Visakhapatnam", "Miryalaguda", "Hyderabad"], color: "#60A5FA", pct: 45 },
];

// ── Testimonials ──
const testimonials = [
  { id: 1, quote: "We've been procuring Keshar Kali and JMR rice from M. Adinarayan sir at Tejas Canvassing for years. Over 300 traders in our market trust their quality and timely dispatch.", name: "Ramesh Gowda", role: "Wholesale Merchant", company: "APMC Yard Yeshwanthpur, Bengaluru", initials: "RG", accentColor: "#C9A158" },
  { id: 2, quote: "Their Simha Urad Dal and Keshar Kali Kollam are our top sellers in Chennai. Honest weight, clean bags, and trusted suppliers make Tejas Canvassing our #1 choice.", name: "S. Murugan", role: "Distributor", company: "Chennai Wholesale Market, Tamil Nadu", initials: "SM", accentColor: "#34D399" },
  { id: 3, quote: "Tejas Canvassing has been supplying our network across Andhra and Karnataka since 2008. Reliable pricing and M. Adinarayan sir's business integrity are unmatched.", name: "K. Venkateshwarlu", role: "Commission Agent", company: "Vijayawada Mandi, Andhra Pradesh", initials: "KV", accentColor: "#60A5FA" },
];

const navLinks = [
  { label: "Grain Journey", href: "#grain-journey", isRoute: false },
  { label: "Process", href: "#process" },
  { label: "Why Us", href: "#why-us" },
  { label: "Regions", href: "#global-presence" },
  { label: "Contact", href: "#contact" },
];

// ─── Animation Variants ───
const fadeUp = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } };
const fadeLeft = { hidden: { opacity: 0, x: -28 }, visible: { opacity: 1, x: 0 } };
const fadeRight = { hidden: { opacity: 0, x: 28 }, visible: { opacity: 1, x: 0 } };
const scaleIn = { hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } };
const staggerContainer = { visible: { transition: { staggerChildren: 0.09 } } };

// ─── Section Header component ───
function SectionLabel({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-px w-6" style={{ background: "var(--gold)" }} />
      <span style={{ fontSize: "9.5px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
        {text}
      </span>
    </div>
  );
}

// ─── Animated Stat Card ───
function AnimatedStatCard({ stat, delay }: { stat: typeof trustStats[0]; delay: number }) {
  const { ref, visible } = useScrollReveal(0.3);
  const counted = useCountUp(stat.value, 1600, visible);
  return (
    <motion.div
      ref={ref}
      variants={scaleIn}
      initial="hidden"
      animate={visible ? "visible" : "hidden"}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center text-center p-5 sm:p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group cursor-default"
    >
      {/* Hover shimmer */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,161,88,0.14) 0%, transparent 70%)" }} />
      <span style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(26px, 5vw, 52px)", fontWeight: 400, color: "#ffffff", lineHeight: 1 }}>
        {stat.prefix}{counted.toLocaleString()}{stat.suffix}
      </span>
      <div className="w-8 h-px my-3" style={{ background: "var(--gold)" }} />
      <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
        {stat.label}
      </span>
      <span style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
        {stat.sub}
      </span>
    </motion.div>
  );
}

// ─── Process Timeline Step ───
function TimelineStep({ step, index, visible }: { step: typeof supplySteps[0]; index: number; visible: boolean }) {
  const Icon = step.icon;
  return (
    <motion.div
      variants={fadeLeft}
      initial="hidden"
      animate={visible ? "visible" : "hidden"}
      transition={{ duration: 0.55, delay: index * 0.10, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-4 p-4 rounded-2xl border bg-stone-50/80 border-stone-200/80 group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at 0% 50%, ${step.color}14 0%, transparent 70%)` }} />
      <div
        className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110"
        style={{ background: step.color + "22", color: step.color, border: `1.5px solid ${step.color}40` }}
      >
        <Icon size={18} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: step.color + "20", color: step.color }}>
            0{step.id}
          </span>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontWeight: 600, color: "#111827" }}>
            {step.title}
          </h3>
        </div>
        <p style={{ fontSize: "12px", fontWeight: 300, color: "#6B7280", lineHeight: 1.6 }}>
          {step.detail}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Feature Bento Card ───
function FeatureCard({ feat, index, visible }: { feat: typeof features[0]; index: number; visible: boolean }) {
  const Icon = feat.icon;
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate={visible ? "visible" : "hidden"}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="p-6 rounded-2xl border border-[#c9a158]/25 bg-[#0d2318]/85 backdrop-blur-xl shadow-lg group relative overflow-hidden cursor-default"
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 20%, ${feat.accent}1a 0%, transparent 65%)` }} />
      {/* Top accent line */}
      <div className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${feat.accent}, transparent)` }} />
      <div
        className="w-11 h-11 mb-4 flex items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
        style={{ background: feat.accent + "18", border: `1.5px solid ${feat.accent}40`, color: feat.accent }}
      >
        <Icon size={20} />
      </div>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "19px", fontWeight: 500, color: "#ffffff", marginBottom: "6px" }}>
        {feat.title}
      </h3>
      <p style={{ fontSize: "12px", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
        {feat.description}
      </p>
      <div className="mt-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
        <div className="w-3 h-px" style={{ background: feat.accent }} />
        <span style={{ fontSize: "9.5px", color: feat.accent, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Learn More
        </span>
      </div>
    </motion.div>
  );
}

export default function AboutView() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [testiIndex, setTestiIndex] = useState(0);
  const [testiDir, setTestiDir] = useState(1);
  const [formData, setFormData] = useState({ name: "", company: "", email: "", phone: "", riceType: "Keshar Kali (Kollam Raw)", quantity: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedInMerchant] = useState(() => !!localStorage.getItem('userRole'));

  // Scroll-triggered section refs
  const trustRef = useRef<HTMLElement>(null);
  const processRef = useRef<HTMLElement>(null);
  const whyRef = useRef<HTMLElement>(null);
  const regionsRef = useRef<HTMLElement>(null);

  const trustInView = useInView(trustRef, { once: true, margin: "-80px" });
  const processInView = useInView(processRef, { once: true, margin: "-80px" });
  const whyInView = useInView(whyRef, { once: true, margin: "-80px" });
  const regionsInView = useInView(regionsRef, { once: true, margin: "-80px" });

  // Testimonial auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setTestiDir(1);
      setTestiIndex(i => (i + 1) % testimonials.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const goToTesti = (next: number, dir: number) => {
    setTestiDir(dir);
    setTestiIndex(next);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
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
    window.open(`https://wa.me/919916416995?text=${encodeURIComponent(msg)}`, "_blank");
    setIsSubmitting(false);
  };

  const currentTesti = testimonials[testiIndex];

  return (
    <div className="font-sans text-stone-800 min-h-screen flex flex-col selection:bg-amber-400 selection:text-emerald-950 pb-[env(safe-area-inset-bottom,0px)]" style={{ background: "var(--warm-bg)", fontFamily: "var(--font-sans)" }}>
      <PwaInstallModal isOpen={isPwaModalOpen} onClose={() => setIsPwaModalOpen(false)} />

      {/* ── Floating Navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2 sm:py-3 px-2.5 sm:px-6">
        <div
          className="max-w-[1280px] mx-auto px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl sm:rounded-full transition-all duration-300 flex items-center justify-between"
          style={{
            background: isScrolled ? "rgba(10, 26, 17, 0.97)" : "rgba(7, 19, 13, 0.90)",
            backdropFilter: "blur(28px) saturate(200%)",
            WebkitBackdropFilter: "blur(28px) saturate(200%)",
            boxShadow: isScrolled ? "0 8px 32px -4px rgba(0,0,0,0.6), inset 0 1px 1px 0 rgba(255,255,255,0.12)" : "0 8px 32px -4px rgba(0,0,0,0.4), inset 0 1px 1px 0 rgba(255,255,255,0.15)",
            borderColor: isScrolled ? "rgba(201, 161, 88, 0.4)" : "rgba(255, 255, 255, 0.18)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 group cursor-pointer select-none shrink-0">
            <div className="relative shrink-0">
              <img src="/logo.png" alt="Tejas Canvassing Logo" className="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded-xl p-0.5 border border-amber-400/40 bg-white/10 transition-transform duration-300 group-hover:scale-105 shadow-xs" />
            </div>
            <div className="flex flex-col">
              <span className="tracking-wider transition-colors duration-300 font-bold leading-tight whitespace-nowrap text-white" style={{ fontFamily: "var(--font-serif)", fontSize: "13px" }}>
                TEJAS CANVASSING
              </span>
              <span className="tracking-[0.14em] uppercase transition-colors duration-300 leading-none mt-0.5 whitespace-nowrap" style={{ fontSize: "7px", color: "var(--gold)", fontWeight: 600 }}>
                Est. 2008 · M. Adinarayan
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              link.isRoute ? (
                <button key={link.label} type="button" onClick={() => navigate(link.href)}
                  className="transition-all duration-200 relative group text-[11px] font-bold uppercase tracking-[0.18em] cursor-pointer flex items-center gap-1 text-amber-300 hover:text-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{link.label}</span>
                  <span className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full" style={{ background: "var(--gold)" }} />
                </button>
              ) : (
                <a key={link.label} href={link.href}
                  className="transition-all duration-200 relative group text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 hover:text-amber-300">
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full" style={{ background: "var(--gold)" }} />
                </a>
              )
            ))}
            <button onClick={() => setIsPwaModalOpen(true)} className="px-3 py-1.5 rounded-full border border-amber-400/30 bg-white/10 hover:bg-white/20 text-white transition-all duration-300 text-[10.5px] font-bold tracking-wider uppercase flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md">
              <Download className="w-3 h-3 text-amber-400" />
              <span>Install App</span>
            </button>
            <button onClick={() => navigate('/login')} className="px-4 py-1.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-[11px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 cursor-pointer shadow-md" style={{ background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)", color: "var(--brand-dark)" }}>
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          </div>

          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button onClick={() => navigate('/login')} className="px-2.5 py-1.5 rounded-full transition-all duration-300 active:scale-95 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 cursor-pointer shadow-sm shrink-0" style={{ background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 100%)", color: "var(--brand-dark)" }}>
              <LogIn className="w-3 h-3" />
              <span>Log In</span>
            </button>
            <button className="p-1.5 transition-colors duration-200 rounded-full cursor-pointer hover:bg-white/10 shrink-0 text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle navigation menu">
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Glass Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-3 z-50 flex flex-col justify-between lg:hidden rounded-3xl p-5 sm:p-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl border border-white/20 overflow-y-auto"
            style={{ background: "rgba(13, 35, 24, 0.97)", backdropFilter: "blur(32px) saturate(200%)", fontFamily: "var(--font-serif)" }}>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain rounded-lg border border-amber-400/40 p-0.5 bg-white/10" />
                <span className="text-white font-bold text-sm tracking-wider">TEJAS CANVASSING</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-white/70"><X size={22} /></button>
            </div>
            <nav className="flex flex-col items-center gap-5 py-4">
              {navLinks.map((link, i) => (
                link.isRoute ? (
                  <motion.button key={link.label} type="button" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    onClick={() => { setIsMobileMenuOpen(false); navigate(link.href); }}
                    className="text-amber-300 hover:text-white transition-colors text-2xl font-medium tracking-wide text-center cursor-pointer flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" /><span>{link.label}</span>
                  </motion.button>
                ) : (
                  <motion.a key={link.label} href={link.href} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    onClick={() => setIsMobileMenuOpen(false)} className="text-white/90 hover:text-amber-300 transition-colors text-2xl font-light tracking-wide text-center">
                    {link.label}
                  </motion.a>
                )
              ))}
              <div className="w-full pt-4 border-t border-white/10 flex flex-col gap-3">
                <button onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }} className="w-full py-3.5 text-emerald-950 bg-amber-400 font-sans font-extrabold text-xs uppercase tracking-widest rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                  <LogIn size={16} /><span>Login to Portal</span>
                </button>
                {!isLoggedInMerchant && (
                  <button onClick={() => { setIsMobileMenuOpen(false); navigate('/signup'); }} className="w-full py-2.5 text-white/80 bg-white/5 border border-white/10 font-sans font-semibold text-[11px] uppercase tracking-wider rounded-full flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                    <UserPlus size={14} /><span>New Merchant Registration</span>
                  </button>
                )}
                <button onClick={() => { setIsMobileMenuOpen(false); setIsPwaModalOpen(true); }} className="w-full py-3 text-white/90 bg-white/10 border border-white/20 font-sans font-semibold text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                  <Download size={14} className="text-amber-400" /><span>Install App</span>
                </button>
              </div>
            </nav>
            <div className="text-center text-[10px] text-white/40 tracking-wider">Owner: M. Adinarayan · APMC Yard Yeshwanthpur</div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow pt-0">

        {/* ── 1. SCROLL EXPERIENCE (pinned hero) ── */}
        <AboutScrollExperience />

        {/* ── Quick CTA strip ── */}
        <section className="py-4 sm:py-5 relative z-20 border-t border-b border-white/10" style={{ background: "#0A160F" }}>
          <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-center gap-4">
            <a href="#contact" className="inline-flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-full text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md shadow-xs">
              <span>Request Quote</span><ArrowRight size={13} />
            </a>
            <a href="tel:+919916416995" className="inline-flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-full text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/25 transition-all cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md shadow-xs">
              <Phone size={12} /><span>Call Now</span>
            </a>
          </div>
        </section>

        {/* ── 2. TRUST STRIP ── */}
        <section ref={trustRef} className="py-16 relative z-20" style={{ background: "var(--brand-dark)" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <motion.div className="flex items-center justify-center gap-3 mb-10" initial={{ opacity: 0 }} animate={trustInView ? { opacity: 1 } : {}} transition={{ duration: 0.6 }}>
              <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(90deg, transparent, rgba(201,161,88,0.5))" }} />
              <SectionLabel text="Tejas Canvassing Highlights" />
              <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(270deg, transparent, rgba(201,161,88,0.5))" }} />
            </motion.div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {trustStats.map((stat, i) => (
                <AnimatedStatCard key={stat.label} stat={stat} delay={i * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. SUPPLY CHAIN & MILLING PROCESS ── */}
        <section id="process" ref={processRef} style={{ background: "#ffffff", padding: "80px 0 100px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <motion.div className="mb-12" variants={fadeUp} initial="hidden" animate={processInView ? "visible" : "hidden"} transition={{ duration: 0.6 }}>
              <SectionLabel text="Suppliers & Process" />
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#0D1F15", lineHeight: 1.1 }}>
                Trusted Suppliers to<br /><span style={{ fontStyle: "italic" }}>Your APMC Yard</span>
              </h2>
            </motion.div>

            <div className="grid lg:grid-cols-5 gap-6 items-stretch">
              {/* Brand Panel */}
              <motion.div className="lg:col-span-2 relative overflow-hidden rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-xl border border-amber-400/20"
                variants={scaleIn} initial="hidden" animate={processInView ? "visible" : "hidden"} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                style={{ minHeight: "380px", background: "var(--brand-dark)" }}>
                {/* Animated rotating glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,161,88,0.18) 0%, transparent 60%)" }} />
                <img src="/logo.png" alt="Tejas Canvassing Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl p-2 border-2 border-amber-400/50 bg-white/10 backdrop-blur-md mb-5 shadow-xl" />
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, letterSpacing: "0.18em", color: "#ffffff" }}>TEJAS CANVASSING</div>
                <div style={{ fontSize: "8.5px", letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase", fontWeight: 700, marginTop: "4px" }}>Owner: M. Adinarayan · Est. 2008</div>
                <div className="mt-6 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md max-w-xs">
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.85)" }}>
                    "17+ Years of Business Integrity & Over 300 Happy Customers"
                  </p>
                </div>
                {/* Floating badges */}
                <div className="absolute top-4 right-4 flex flex-col gap-1.5">
                  {["Keshar Kali", "JMR Steam", "Simha Urad"].map(brand => (
                    <span key={brand} className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wide" style={{ background: "rgba(201,161,88,0.18)", color: "var(--gold)", border: "1px solid rgba(201,161,88,0.3)" }}>
                      {brand}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Timeline Steps */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                {supplySteps.map((step, i) => (
                  <TimelineStep key={step.id} step={step} index={i} visible={processInView} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. WHY CHOOSE US ── */}
        <section id="why-us" ref={whyRef} className="relative overflow-hidden py-24" style={{ background: "#0d2318" }}>
          <div className="absolute inset-0 z-0 opacity-15">
            <img src={FIELD_IMAGE} alt="Field" className="w-full h-full object-cover" />
          </div>
          {/* Animated gradient orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(201,161,88,0.07) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 70%)" }} />

          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10">
            <motion.div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
              variants={fadeUp} initial="hidden" animate={whyInView ? "visible" : "hidden"} transition={{ duration: 0.6 }}>
              <div>
                <SectionLabel text="Why Choose Tejas Canvassing" />
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#ffffff" }}>
                  The Tejas <span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>Advantage</span>
                </h2>
              </div>
              <motion.a href="#contact" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-amber-400/40 text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <span>Get a Quote</span><ArrowRight size={13} />
              </motion.a>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feat, i) => (
                <FeatureCard key={feat.id} feat={feat} index={i} visible={whyInView} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. REGIONAL SERVICE LOCATIONS ── */}
        <section id="global-presence" ref={regionsRef} style={{ background: "#ffffff", padding: "80px 0 100px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeLeft} initial="hidden" animate={regionsInView ? "visible" : "hidden"} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
                <SectionLabel text="Our Service Locations" />
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 60px)", fontWeight: 400, color: "#0D1F15", marginBottom: "12px" }}>
                  Serving <span style={{ fontStyle: "italic" }}>Karnataka, Tamil Nadu & Andhra</span>
                </h2>
                <p style={{ fontSize: "13.5px", fontWeight: 300, color: "#6B7280", lineHeight: 1.7, marginBottom: "28px" }}>
                  With headquarters at APMC Yard Yeshwanthpur, we provide dedicated rice canvassing across South India.
                </p>
                <div className="space-y-4">
                  {regions.map((reg, i) => (
                    <motion.div key={reg.name} className="p-4 rounded-2xl flex flex-col gap-3 bg-stone-50 border border-stone-200/80 group hover:shadow-md transition-all duration-300"
                      variants={fadeUp} initial="hidden" animate={regionsInView ? "visible" : "hidden"}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: reg.color, boxShadow: `0 0 8px ${reg.color}66` }} />
                        <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontWeight: 600, color: "#111827" }}>{reg.name}</h4>
                        <span className="ml-auto text-[10px] font-bold" style={{ color: reg.color }}>{reg.pct}% share</span>
                      </div>
                      {/* Animated progress bar */}
                      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: reg.color }}
                          initial={{ width: 0 }} animate={regionsInView ? { width: `${reg.pct}%` } : { width: 0 }}
                          transition={{ duration: 1.1, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} />
                      </div>
                      <p style={{ fontSize: "11.5px", color: "#6B7280", fontWeight: 300, lineHeight: 1.5 }}>
                        {reg.markets.join(" · ")}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div className="relative aspect-[16/10] sm:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
                variants={fadeRight} initial="hidden" animate={regionsInView ? "visible" : "hidden"} transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
                <img src={MARKET_IMAGE} alt="Wholesale Market" className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                {/* Floating card */}
                <motion.div className="absolute bottom-4 left-4 p-4 rounded-2xl text-white shadow-xl border border-white/20 bg-[#0d2318]/90 backdrop-blur-md"
                  initial={{ opacity: 0, y: 16 }} animate={regionsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.5 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "40px", fontWeight: 500, lineHeight: 1 }}>
                    300<span style={{ color: "var(--gold)" }}>+</span>
                  </div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", fontWeight: 600, marginTop: "2px" }}>
                    Happy Customers (KA · TN · AP)
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── 7. TESTIMONIALS ── */}
        <section style={{ padding: "80px 0 100px", background: "var(--warm-bg)" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="flex items-center justify-between gap-4 mb-10">
              <div>
                <SectionLabel text="Client Testimonials" />
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px, 5.5vw, 60px)", fontWeight: 400, color: "#0D1F15" }}>
                  Trusted by <span style={{ fontStyle: "italic" }}>300+ Merchants</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                  onClick={() => goToTesti(testiIndex === 0 ? testimonials.length - 1 : testiIndex - 1, -1)}
                  className="w-10 h-10 border border-stone-300 flex items-center justify-center rounded-full text-slate-700 bg-white shadow-sm hover:shadow-md transition-all">
                  <ChevronLeft size={16} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                  onClick={() => goToTesti(testiIndex === testimonials.length - 1 ? 0 : testiIndex + 1, 1)}
                  className="w-10 h-10 border border-stone-300 flex items-center justify-center rounded-full text-slate-700 bg-white shadow-sm hover:shadow-md transition-all">
                  <ChevronRight size={16} />
                </motion.button>
              </div>
            </div>

            <AnimatePresence mode="wait" custom={testiDir}>
              <motion.div key={currentTesti.id}
                custom={testiDir}
                initial={{ opacity: 0, x: testiDir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: testiDir * -40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="p-8 sm:p-14 rounded-3xl shadow-lg border border-[#c9a158]/25 bg-white/90 backdrop-blur-xl relative overflow-hidden">
                {/* Accent line */}
                <div className="absolute top-0 left-12 right-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${currentTesti.accentColor}80, transparent)` }} />
                {/* Big quote mark */}
                <div className="absolute top-6 right-8 opacity-[0.07]" style={{ fontFamily: "var(--font-serif)", fontSize: "120px", lineHeight: 1, color: currentTesti.accentColor, userSelect: "none" }}>
                  "
                </div>
                <Quote size={28} style={{ color: currentTesti.accentColor, marginBottom: "16px", opacity: 0.7 }} />
                <blockquote style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 3.5vw, 26px)", fontStyle: "italic", color: "#1F2937", lineHeight: 1.55, marginBottom: "28px" }}>
                  "{currentTesti.quote}"
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-serif text-base font-bold shadow-sm border-2" style={{ background: currentTesti.accentColor + "22", color: currentTesti.accentColor, borderColor: currentTesti.accentColor + "44" }}>
                    {currentTesti.initials}
                  </div>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{currentTesti.name}</h4>
                    <p style={{ fontSize: "11.5px", color: "#6B7280" }}>{currentTesti.role} · {currentTesti.company}</p>
                  </div>
                  <div className="ml-auto flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} fill={currentTesti.accentColor} style={{ color: currentTesti.accentColor }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {testimonials.map((t, i) => (
                <motion.button key={t.id} onClick={() => goToTesti(i, i > testiIndex ? 1 : -1)}
                  className="rounded-full transition-all duration-300 cursor-pointer"
                  animate={{ width: i === testiIndex ? 20 : 8, height: 8, background: i === testiIndex ? "#C9A158" : "#D1D5DB" }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. CONTACT / INQUIRY FORM ── */}
        <section id="contact" style={{ background: "var(--brand-dark)", padding: "80px 0 100px" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-5 gap-12">
              <motion.div className="lg:col-span-2 text-white" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
                <SectionLabel text="Get a Quote" />
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(30px, 6vw, 54px)", fontWeight: 400, lineHeight: 1.1, marginBottom: "16px" }}>
                  Let's Build a<br /><span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>Supply Partnership</span>
                </h2>
                <p style={{ fontSize: "13.5px", fontWeight: 300, color: "rgba(255,255,255,0.72)", lineHeight: 1.7, marginBottom: "28px" }}>
                  Connect directly with M. Adinarayan & Tejas Canvassing for wholesale pricing on Keshar Kali, JMR, and Simha lines.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: MapPin, text: "123, 4th Main Rd, APMC Yard, Yeshwanthpur, Bengaluru 560022" },
                    { icon: Phone, text: "+91 9916416995 / +91 9342380981" },
                    { icon: Mail, text: "tejascanvassing@gmail.com" },
                  ].map(({ icon: Icon, text }) => (
                    <motion.div key={text} className="flex items-start gap-3 text-xs text-white/90 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 cursor-default group"
                      whileHover={{ x: 3 }}>
                      <Icon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span className="leading-relaxed">{text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* WhatsApp CTA */}
                <motion.a href="https://wa.me/919916416995" target="_blank" rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2.5 px-5 py-3 rounded-full text-[11px] font-extrabold tracking-wider uppercase cursor-pointer shadow-lg"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff" }}
                  whileHover={{ scale: 1.04, boxShadow: "0 8px 24px rgba(37,211,102,0.35)" }} whileTap={{ scale: 0.97 }}>
                  <MessageCircle size={15} /><span>Chat on WhatsApp</span>
                </motion.a>
              </motion.div>

              {/* Form Panel */}
              <motion.div className="lg:col-span-3 p-7 sm:p-10 rounded-3xl shadow-xl border border-white/15 bg-white/5 backdrop-blur-2xl relative overflow-hidden"
                initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
                {/* Top shimmer line */}
                <div className="absolute top-0 left-8 right-8 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,161,88,0.6), transparent)" }} />
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "#ffffff", marginBottom: "22px" }}>Inquiry Details</h3>
                <form onSubmit={handleFormSubmit} className="space-y-4 text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      { label: "Full Name", key: "name", type: "text", placeholder: "M. Ramesh" },
                      { label: "Company Name", key: "company", type: "text", placeholder: "Ganesh Traders" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[9.5px] uppercase tracking-widest text-white/60 block mb-1 font-semibold">{f.label}</label>
                        <input required={f.key === "name"} type={f.type} value={(formData as any)[f.key]}
                          onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white text-xs outline-none focus:border-amber-400 focus:bg-white/12 backdrop-blur-md transition-all duration-200 placeholder:text-white/25" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      { label: "Email Address", key: "email", type: "email", placeholder: "you@example.com" },
                      { label: "Phone / WhatsApp", key: "phone", type: "tel", placeholder: "+91 98450 XXXXX" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[9.5px] uppercase tracking-widest text-white/60 block mb-1 font-semibold">{f.label}</label>
                        <input required type={f.type} value={(formData as any)[f.key]}
                          onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white text-xs outline-none focus:border-amber-400 focus:bg-white/12 backdrop-blur-md transition-all duration-200 placeholder:text-white/25" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/60 block mb-1 font-semibold">Brand / Variety</label>
                      <select value={formData.riceType} onChange={e => setFormData({ ...formData, riceType: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-[#0d2318] border border-white/15 text-white text-xs outline-none focus:border-amber-400 backdrop-blur-md transition-all duration-200">
                        <option>Keshar Kali (Kollam Raw)</option>
                        <option>JMR (HMT &amp; Raw)</option>
                        <option>Simha Urad Dal (Sortex Pulses)</option>
                        <option>Mahendra Cow (Kollam)</option>
                        <option>Basmati 1121</option>
                        <option>Sona Masoori</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9.5px] uppercase tracking-widest text-white/60 block mb-1 font-semibold">Quantity (MT)</label>
                      <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="e.g. 50"
                        className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white text-xs outline-none focus:border-amber-400 focus:bg-white/12 backdrop-blur-md transition-all duration-200 placeholder:text-white/25" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9.5px] uppercase tracking-widest text-white/60 block mb-1 font-semibold">Additional Requirements</label>
                    <textarea rows={3} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Packaging (25kg/50kg), delivery location..."
                      className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white text-xs outline-none focus:border-amber-400 resize-none transition-all duration-200 placeholder:text-white/25" />
                  </div>
                  <motion.button type="submit" disabled={isSubmitting}
                    className="w-full py-4 text-[#0d2318] font-extrabold text-xs uppercase tracking-widest rounded-full shadow-xl flex items-center justify-center gap-2 cursor-pointer mt-2 relative overflow-hidden disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, #C9A158 0%, #E8C97A 50%, #C9A158 100%)", backgroundSize: "200% 100%" }}
                    whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(201,161,88,0.4)" }}
                    whileTap={{ scale: 0.97 }}>
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-[#0d2318]/30 border-t-[#0d2318] rounded-full animate-spin" />
                    ) : (
                      <><Send size={14} /><span>Send Inquiry to WhatsApp</span></>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer style={{ background: "var(--dark-bg)", color: "#9CA3AF" }}>
        <div style={{ padding: "56px 0" }}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
              <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <div className="flex items-center gap-3 mb-5">
                  <img src="/logo.png" alt="Tejas Canvassing" className="w-10 h-10 object-contain rounded-xl p-1 border border-amber-400/40 bg-white/10 shadow-md" />
                  <div>
                    <span className="text-white tracking-widest block" style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600 }}>TEJAS CANVASSING</span>
                    <span className="text-[9.5px] text-amber-400 font-semibold tracking-wider block">Owner: M. Adinarayan · Est. 2008</span>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "#6B7280", maxWidth: "340px", lineHeight: 1.7 }}>
                  Serving over 300 happy customers across Karnataka, Tamil Nadu, and Andhra Pradesh with flagship brands like Keshar Kali, JMR, and Simha.
                </p>
                {/* Divider */}
                <div className="mt-6 h-px w-24" style={{ background: "linear-gradient(90deg, rgba(201,161,88,0.5), transparent)" }} />
              </motion.div>

              {[
                { title: "Flagship Brands", delay: 0.1, items: [{ label: "⭐ Keshar Kali Kollam", href: "#grain-journey", highlight: true }, { label: "⭐ JMR Steam & Raw", href: "#grain-journey", highlight: true }, { label: "⭐ Simha Urad Dal", href: "#grain-journey", highlight: true }] },
                { title: "Access", delay: 0.2, items: [{ label: "Buyer / Merchant Log In", href: "/login", highlight: true }, { label: "Register Wholesale Buyer", href: "/signup", highlight: false }, { label: "Employee & Operations Desk", href: "/employee-login", highlight: false }, { label: "Executive Admin Portal", href: "/admintejas1679", highlight: false }] },
                { title: "Contact APMC Desk", delay: 0.3, isContact: true }
              ].map((col, i) => (
                <motion.div key={col.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: col.delay }}>
                  <h5 className="text-white mb-4 uppercase tracking-widest text-[9.5px] font-semibold">{col.title}</h5>
                  {col.isContact ? (
                    <p className="text-xs text-gray-400 leading-relaxed">
                      123, 4th Main Rd, APMC Yard,<br />Yeshwanthpur, Bengaluru 560022<br />
                      <a href="tel:+919916416995" className="text-amber-400 hover:text-amber-300 transition-colors">Ph: +91 9916416995</a>
                    </p>
                  ) : (
                    <ul className="space-y-2 text-xs text-gray-400">
                      {col.items?.map(item => (
                        <li key={item.label}>
                          <button onClick={() => navigate(item.href)} className={`hover:text-white text-left cursor-pointer transition-colors block ${item.highlight ? "text-amber-300" : "text-gray-400"}`}>
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-center text-[11px] text-gray-500 gap-3 text-center sm:text-left border-t border-white/5">
          <p>© 2026 Tejas Canvassing Pvt. Ltd. Founded by M. Adinarayan (2008).</p>
          <div className="flex items-center gap-3 text-gray-400">
            <span>300+ Happy Customers</span><span>•</span><span>Karnataka · TN · AP</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
