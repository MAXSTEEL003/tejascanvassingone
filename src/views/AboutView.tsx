import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  Award, 
  Truck, 
  Scale, 
  Building2, 
  Sparkles, 
  MessageSquare, 
  FileCheck, 
  ChevronRight, 
  ExternalLink, 
  Check, 
  Star,
  Layers,
  ShoppingBag,
  LogIn,
  Receipt,
  Wallet,
  TrendingUp,
  HelpCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TejasBotanicalLogo } from './LoginView';

// Portfolio products from tejascanvassing.com
interface ProductItem {
  id: string;
  name: string;
  category: 'basmati' | 'kollam' | 'sona' | 'pulses' | 'specialty';
  badge: string;
  image: string;
  description: string;
  highlights: string[];
}

const PRODUCTS: ProductItem[] = [
  {
    id: 'kollam-raw',
    name: 'Kollam Raw Rice',
    category: 'kollam',
    badge: 'South India Favorite',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    description: 'Pure Kollam raw rice known for its naturally soft texture, bright white grain and excellent cooking quality. A staple for households across South India.',
    highlights: ['Naturally Soft Texture', 'Bright White Grain', 'Daily Meal Perfection']
  },
  {
    id: 'kollam-steam',
    name: 'Kollam Raw & Steam Rice',
    category: 'kollam',
    badge: 'Consistent Batch Quality',
    image: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80',
    description: 'A trusted name offering both Kollam raw and steam varieties. Consistent quality and superior taste make it a favourite among retailers and households.',
    highlights: ['Low Moisture Content', 'Superior Swell Ratio', 'Zero Adulteration']
  },
  {
    id: 'hmt-rice',
    name: 'HMT · Steam · Raw · Kollam',
    category: 'specialty',
    badge: 'Versatile Staple',
    image: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=800&q=80',
    description: 'A versatile brand offering HMT steam, raw and Kollam raw rice — catering to the widest range of cooking preferences across all wholesale markets.',
    highlights: ['Multiple Processing Options', 'Uniform Grains', 'High Demand SKU']
  },
  {
    id: 'basmati-1121',
    name: 'Basmati 1121 & 1509',
    category: 'basmati',
    badge: 'Export Grade 8.35mm+',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    description: 'Premium Basmati 1121 with extra-long grains, rich natural aroma and fluffy non-sticky texture. Ideal for biryani, pulao and fine dining preparations.',
    highlights: ['Extra-Long 8.35mm+', 'Non-Sticky Fluffiness', 'Aged 12-24 Months']
  },
  {
    id: 'scented-rice',
    name: 'Aromatic Scented Rice',
    category: 'specialty',
    badge: 'Delicate Natural Fragrance',
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80',
    description: 'A fragrant, naturally scented rice variety prized for its delicate aroma and light texture. Perfect for aromatic rice dishes, festive platters, and everyday cooking.',
    highlights: ['Natural Aroma Compound', 'Delicate Texture', 'Festive Favorite']
  },
  {
    id: 'sona-masoori',
    name: 'Sona Masoori · Steam · KNM',
    category: 'sona',
    badge: 'Low Starch Medium Grain',
    image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80',
    description: 'Offering Sona Masoori raw, steam rice and KNM steam — a comprehensive range for diverse market needs, known for its lightness and consistent quality.',
    highlights: ['Easy Digestibility', 'Low Glycemic Index', 'Fastest Moving SKU']
  },
  {
    id: 'urad-dal',
    name: 'Premium Sortex Urad Dal',
    category: 'pulses',
    badge: 'Farm Cleaned Staples',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    description: 'High-quality Urad Dal sourced from premium farms. Clean, well-sorted and packed for long shelf life — a must-have for any wholesale staples portfolio.',
    highlights: ['Laser Sortex Cleaned', 'High Protein Yield', 'Extended Shelf Life']
  }
];

const APP_WORKFLOW_STEPS = [
  {
    step: '01',
    label: 'Mandi Rates',
    title: 'Live Mandi Quotes & Variety Specifications',
    badge: 'Step 1 · Discovery & Daily Quotes',
    icon: TrendingUp,
    description: 'Track daily spot quotes per Quintal (100 kg) and Metric Ton directly from APMC Yeshwanthpur and sourcing mills across Karnataka, Andhra Pradesh, Maharashtra, and North India.',
    points: [
      'Real-time mandi rates with daily price trend movements',
      'Detailed grain specifications: moisture % (12.5%–14%), broken grain % (<2%), grain length (mm)',
      'Satake laser Sortex certification and mill origin transparency',
      'View available dispatch lots ready for immediate mill loading'
    ],
    preview: {
      tag: 'Live Trade Quote',
      title: 'Kollam Raw Rice · 2026 Season Batch',
      price: '₹ 4,150 / Qtl',
      metric: '₹ 41,500 / Metric Ton',
      detail1: 'Moisture: 13.2% · Broken: 1.8% · 2x Polish',
      detail2: 'Origin: Gangavathi Mills, Koppal District',
      status: 'Ready for Dispatch (120 MT available)'
    }
  },
  {
    step: '02',
    label: 'Bulk Orders',
    title: 'Wholesale Truckload & Custom Bag Booking',
    badge: 'Step 2 · Procurement & Bag Customization',
    icon: ShoppingBag,
    description: 'Place direct wholesale consignments from half truckload (10–12 MT) to full interstate truckloads (20–25 MT or 50 MT) in seconds with locked-in prices.',
    points: [
      'Choose packaging type: 25kg / 50kg non-woven branded bags, high-barrier BOPP, or master sacks',
      'Input delivery destination APMC yard, godown address, and preferred delivery date',
      'Instant price-lock protecting merchants from midday mandi fluctuations',
      'Clear minimum order thresholds with transparent bulk tier discounts'
    ],
    preview: {
      tag: 'Truckload Consignment',
      title: 'Full Truckload Booking · 25.0 Metric Tons',
      price: '500 Bags × 50 kg',
      metric: 'Consignment Value: ₹ 10,37,500',
      detail1: 'Packaging: Branded High-Barrier Non-Woven Bags',
      detail2: 'Delivery Destination: Godown #14, Yeshwanthpur APMC',
      status: 'Reserved & Allocated at Mill Warehouse'
    }
  },
  {
    step: '03',
    label: 'Digital Patti',
    title: 'Automated Digital Patti & Commercial Transparency',
    badge: 'Step 3 · Accounting & Invoice Patti',
    icon: Receipt,
    description: 'Eliminate confusion with automated digital Mandi Patti generation. Every expense line is itemized transparently with zero hidden markups.',
    points: [
      'Clear breakdown: Base Grain Cost + APMC Mandi Cess (1.5%) + Hammali Loading (₹12/bag)',
      'Interstate freight allocation calculated per tonne-kilometer',
      'Transparent broker canvassing commission (0.5% – 1.0%) with official patti numbering',
      'Downloadable PDF patti invoice and instant shareable summary on WhatsApp'
    ],
    preview: {
      tag: 'Mandi Digital Patti #PAT-2026-0842',
      title: 'Tejas Canvassing Official Commission Patti',
      price: 'Net Amount: ₹ 10,37,500',
      metric: 'Brokerage Fee (0.75%): ₹ 7,781',
      detail1: 'Base Commodity: ₹10,12,500 | APMC Cess (1.5%): ₹15,188',
      detail2: 'Hammali Loading (500 bags @ ₹12): ₹6,000 | Freight: Paid by Buyer',
      status: 'Official APMC Brokerage Document · GSTIN Compliant'
    }
  },
  {
    step: '04',
    label: 'Lorry Transit',
    title: 'Real-Time Lorry Dispatch & Weight Verification',
    badge: 'Step 4 · Dispatch & Highway Transit',
    icon: Truck,
    description: 'Monitor your consignment in real-time as it moves from the processing mill to your wholesale godown with verified weighbridge slips.',
    points: [
      'Live milestone updates: "Mill Loading" → "Weighbridge Out" → "Highway Transit" → "Gate Arrival"',
      'Instant access to driver contact number, truck license plate, and government e-way bill',
      'Digital weighbridge slips documenting tare weight, gross weight, and certified net weight',
      'Toll crossing and transit alerts straight to your trade dashboard'
    ],
    preview: {
      tag: 'Lorry Transit Dispatch',
      title: 'Ashok Leyland 10-Tyre (KA-01-AK-7842)',
      price: 'Net Cargo: 25,020 kg (Verified)',
      metric: 'Gross: 38,420 kg · Tare: 13,400 kg',
      detail1: 'Driver: Manjunath Gowda (+91 98450-XXXXX)',
      detail2: 'e-Way Bill: #291847192841 · Mill Gate Pass: GP-9821',
      status: 'In Transit · Approving Electronic Gate Pass'
    }
  },
  {
    step: '05',
    label: 'Merchant Ledger',
    title: 'Running Ledger, Advances & Credit Statements',
    badge: 'Step 5 · Settlement & Account Statements',
    icon: Wallet,
    description: 'Maintain a pristine, audit-ready financial ledger. Reconcile advances, invoice debits, weighing adjustments, and credit line terms in one unified hub.',
    points: [
      'Running trade balance tracking total purchases, payments disbursed, and payable balance',
      'Token advance tracking with verified RTGS / NEFT payment confirmations within minutes',
      'Rolling credit terms (15 to 30 days) for verified regular wholesale merchants',
      'Monthly audit-ready PDF account statements for tax and APMC audit filing'
    ],
    preview: {
      tag: 'Merchant Account Ledger',
      title: 'Wholesale Trade Account · V.K FOODS',
      price: 'Credit Limit: ₹ 80.0 Lakh',
      metric: 'Current Due: ₹ 7,50,000 (Within 15-day term)',
      detail1: 'Total Purchases (FY 2025-26): ₹ 1.48 Crore',
      detail2: 'Last Payment: ₹ 10,00,000 via RTGS (Ref: UTR-981247)',
      status: 'Pristine APMC Credit Standing · AAA Grade'
    }
  }
];

export default function AboutView() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeAppStep, setActiveAppStep] = useState<number>(0);
  
  // Inquiry form states
  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    city: '',
    variety: 'Basmati 1121 & 1509',
    volume: '10 to 25 MT',
    notes: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const filteredProducts = selectedCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === selectedCategory);

  const handleWhatsAppSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `*New Enquiry — Tejas Canvassing*\n*Name:* ${formState.name || 'Merchant'}\n*Phone:* ${formState.phone || 'N/A'}\n*Destination City:* ${formState.city || 'Karnataka'}\n*Rice / Product:* ${formState.variety}\n*Volume:* ${formState.volume}\n*Notes:* ${formState.notes || 'Interested in wholesale procurement.'}`;
    window.open(`https://wa.me/919916416995?text=${encodeURIComponent(text)}`, '_blank');
    setFormSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#050e0a] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR                                                             */}
      {/* ========================================================================= */}
      <nav className="sticky top-0 z-50 bg-[#fafaf9]/95 dark:bg-[#050e0a]/95 backdrop-blur-md border-0 shadow-none px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Identity */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <TejasBotanicalLogo className="w-8 h-8 text-[#143e2e] dark:text-emerald-400 group-hover:scale-105 transition-transform" />
            <div>
              <span className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#143e2e] dark:text-white block leading-none">
                Tejas Canvassing
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] text-slate-500 dark:text-emerald-400/80 font-semibold block mt-0.5">
                Premium Rice Dealers · Est. 2010
              </span>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#understanding-app" className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
              <span>How App Works</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">New User</span>
            </a>
            <a href="#products" className="hover:text-[#143e2e] dark:hover:text-emerald-400 transition-colors">Products</a>
            <a href="#process" className="hover:text-[#143e2e] dark:hover:text-emerald-400 transition-colors">Process</a>
            <a href="#why-us" className="hover:text-[#143e2e] dark:hover:text-emerald-400 transition-colors">Why Us</a>
            <a href="#domestic-reach" className="hover:text-[#143e2e] dark:hover:text-emerald-400 transition-colors">Domestic Reach</a>
            <a href="#contact" className="hover:text-[#143e2e] dark:hover:text-emerald-400 transition-colors">Contact</a>
          </div>

          {/* Right Action Portal Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 rounded-full bg-[#143e2e] hover:bg-[#0f2e22] text-white text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In to App</span>
            </button>
          </div>

        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <header className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-8 border-b border-slate-200/80 dark:border-emerald-950/40">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-80 bg-emerald-500/5 blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#143e2e]/5 dark:bg-emerald-500/10 border border-[#143e2e]/15 dark:border-emerald-500/20 text-[#143e2e] dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <span>🌿</span>
            <span>Premium Quality Rice Dealers · APMC Yard Yeshwanthpur</span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-slate-900 dark:text-white leading-[1.1] max-w-4xl mx-auto">
            Connecting the finest rice-growing regions with wholesale markets across India.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
            Sourcing the finest Basmati, Sona Masoori and premium rice varieties directly from farms to wholesale markets across India. Trusted by 150+ partners in 20+ states.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-xl bg-[#143e2e] hover:bg-[#0f2e22] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In to Wholesale Portal</span>
            </button>
            <a
              href="#understanding-app"
              className="px-6 py-3 rounded-xl bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2"
            >
              <span>Understand How App Works</span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </a>
            <button
              onClick={() => navigate('/intro')}
              className="px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[#143e2e] dark:text-emerald-300 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Interactive App Tour</span>
            </button>
          </div>

          {/* Editorial Hero Visual Banner */}
          <div className="pt-8 sm:pt-12">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-emerald-950/60 aspect-[16/8] sm:aspect-[21/9]">
              <img
                src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1600&q=85"
                alt="Aerial Rice Paddy Field"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6 sm:p-10">
                <div className="text-left text-white max-w-xl">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300 block mb-1">
                    Direct Farm Sourcing
                  </span>
                  <p className="font-serif text-2xl sm:text-3xl font-normal leading-snug">
                    "Quality without compromise, supply without disruption."
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 pt-6 text-left">
            {[
              { val: '15+', label: 'Years of Market Excellence', sub: 'Est. 2010 in APMC Yard' },
              { val: '150+', label: 'Wholesale Partners', sub: 'Distributors & Millers' },
              { val: '20+', label: 'States Covered', sub: 'Pan-India Distribution' },
              { val: '50,000 MT', label: 'Annual Supply Capacity', sub: 'High Volume Procurement' },
              { val: '7 Checkpoints', label: 'Quality Guarantee', sub: 'FSSAI, ISO 22000' }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40 shadow-xs">
                <span className="font-serif text-2xl sm:text-3xl font-normal text-[#143e2e] dark:text-emerald-400 block">
                  {stat.val}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1">
                  {stat.label}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {stat.sub}
                </span>
              </div>
            ))}
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2.5 FIRST-TIME USER GUIDE: UNDERSTANDING THE APP (`#understanding-app`)     */}
      {/* ========================================================================= */}
      <section id="understanding-app" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto border-b border-slate-200/80 dark:border-emerald-950/40 scroll-mt-20">
        <div className="space-y-4 text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 text-[#143e2e] dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>First-Time User Guide · Platform Operations</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white">
            Understanding the Tejas Canvassing App
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Built specifically for wholesale rice merchants, commission agents, and millers. From discovering live mandi rates to booking truckloads, tracking lorries, and settling digital patti invoices — here is how the platform operates.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-10">
          {APP_WORKFLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeAppStep === idx;
            return (
              <button
                key={step.step}
                type="button"
                onClick={() => setActiveAppStep(idx)}
                className={cn(
                  "p-3.5 rounded-2xl text-left transition-all border cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[90px]",
                  isActive
                    ? "bg-[#143e2e] dark:bg-[#0f2e22] text-white border-[#143e2e] shadow-md scale-[1.02]"
                    : "bg-white dark:bg-[#0a1811] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-emerald-950/60 hover:border-emerald-400/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    isActive ? "text-emerald-300" : "text-slate-400"
                  )}>
                    Step {step.step}
                  </span>
                  <Icon className={cn(
                    "w-4 h-4",
                    isActive ? "text-emerald-300" : "text-slate-400"
                  )} />
                </div>
                <div className="mt-2">
                  <span className="font-bold text-xs block leading-tight">
                    {step.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Showcase Card */}
        {(() => {
          const currentStepData = APP_WORKFLOW_STEPS[activeAppStep];
          return (
            <div className="bg-white dark:bg-[#0a1811] rounded-3xl border border-slate-200/90 dark:border-emerald-950/60 p-6 sm:p-10 shadow-sm transition-all">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left Content Column */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#143e2e] dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest border border-emerald-200/60 dark:border-emerald-800/40">
                      {currentStepData.badge}
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 dark:text-white leading-snug">
                      {currentStepData.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      {currentStepData.description}
                    </p>
                  </div>

                  {/* Functional Points */}
                  <div className="space-y-3 pt-2">
                    {currentStepData.points.map((point, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Navigation within guide */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-neutral-900">
                    <button
                      type="button"
                      disabled={activeAppStep === 0}
                      onClick={() => setActiveAppStep(prev => Math.max(0, prev - 1))}
                      className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Previous Step
                    </button>
                    <button
                      type="button"
                      disabled={activeAppStep === APP_WORKFLOW_STEPS.length - 1}
                      onClick={() => setActiveAppStep(prev => Math.min(APP_WORKFLOW_STEPS.length - 1, prev + 1))}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#143e2e] hover:bg-[#0f2e22] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right Simulation Preview Column */}
                <div className="lg:col-span-5">
                  <div className="p-6 rounded-2xl bg-[#fafaf9] dark:bg-[#06120d] border border-slate-200 dark:border-emerald-950/80 shadow-inner relative overflow-hidden">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-neutral-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        {currentStepData.preview.tag}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="py-4 space-y-3">
                      <h4 className="font-serif text-lg font-normal text-slate-900 dark:text-white">
                        {currentStepData.preview.title}
                      </h4>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#0a1811] border border-slate-200/70 dark:border-emerald-950/60 space-y-1">
                        <span className="font-serif text-2xl font-bold text-[#143e2e] dark:text-emerald-400 block">
                          {currentStepData.preview.price}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                          {currentStepData.preview.metric}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#143e2e] dark:bg-emerald-400" />
                          <span>{currentStepData.preview.detail1}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#143e2e] dark:bg-emerald-400" />
                          <span>{currentStepData.preview.detail2}</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>{currentStepData.preview.status}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* First-Time User CTA Action Card */}
        <div className="mt-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#143e2e] to-[#0a2319] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-emerald-800/40">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300 block">
              Ready To Procure?
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-normal leading-snug">
              Sign In to Your Wholesale Trade Desk
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Log in with your merchant credentials to browse live mill inventories, configure customized bags, lock in daily rates, and download your digital patti invoices.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-[#143e2e] font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Trade Desk</span>
            </button>
            <button
              onClick={() => navigate('/intro')}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-900/90 text-white font-semibold text-xs sm:text-sm border border-emerald-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Interactive Tour</span>
            </button>
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 3. PRODUCTS PORTFOLIO SECTION (`#products`)                               */}
      {/* ========================================================================= */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="space-y-4 text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#143e2e]/5 dark:bg-emerald-500/10 text-[#143e2e] dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-widest">
            Premium Commodity Offerings
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white">
            Our Rice Portfolio
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Every brand we carry is rigorously selected for quality, consistency and market trust — from aromatic Basmati to everyday Kollam raw rice.
          </p>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {[
              { id: 'all', label: 'All Varieties' },
              { id: 'basmati', label: 'Basmati 1121 & 1509' },
              { id: 'kollam', label: 'Kollam Raw & Steam' },
              { id: 'sona', label: 'Sona Masoori' },
              { id: 'specialty', label: 'HMT & Scented' },
              { id: 'pulses', label: 'Sortex Pulses' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
                  selectedCategory === cat.id
                    ? "bg-[#143e2e] text-white shadow-xs"
                    : "bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-800 hover:border-slate-400"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="group bg-white dark:bg-[#0a1811] rounded-3xl overflow-hidden border border-slate-200/90 dark:border-emerald-950/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Product Photo */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                    {prod.badge}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-6 space-y-3">
                  <h3 className="font-serif text-2xl font-normal text-slate-900 dark:text-white leading-tight">
                    {prod.name}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {prod.description}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-1.5 pt-1">
                    {prod.highlights.map((hl, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={() => {
                    setFormState(prev => ({ ...prev, variety: prod.name }));
                    const contactElem = document.getElementById('contact');
                    if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-[#143e2e] text-slate-800 hover:text-white dark:bg-neutral-850 dark:hover:bg-emerald-900/60 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Request Wholesale Quote</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Custom Sourcing Card */}
          <div className="bg-[#143e2e] text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-md">
            <div className="space-y-3">
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-emerald-300 text-[10px] font-bold uppercase tracking-widest inline-block">
                Tailored Procurement
              </span>
              <h3 className="font-serif text-3xl font-normal leading-tight">
                Looking for a Specific Grain Variety?
              </h3>
              <p className="text-xs sm:text-[13px] text-white/80 leading-relaxed font-normal">
                "We also source any type of rice according to customer needs." Whether you require specific moisture grading, custom packaging, or regional specialties (BPT, RNR, IR-64, or Brown Rice), our network delivers.
              </p>
            </div>
            
            <div className="pt-6">
              <a
                href="#contact"
                className="w-full py-3 rounded-xl bg-white text-[#143e2e] hover:bg-slate-100 text-xs font-bold transition-all text-center block"
              >
                Specify Custom Requirements
              </a>
            </div>
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 4. PROCESS & SUPPLY CHAIN (`#process`)                                     */}
      {/* ========================================================================= */}
      <section id="process" className="py-16 sm:py-24 bg-white dark:bg-[#07130e] border-y border-slate-200/80 dark:border-emerald-950/40 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              End-to-End Supply Chain
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
              We maintain complete control over the supply chain.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              From procurement agreements with farmers to delivery at wholesale markets and distributors across India. This end-to-end visibility ensures consistent quality and reliable supply.
            </p>
          </div>

          {/* 4-Step Process Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Direct Farm Procurement',
                desc: 'Direct procurement from contracted farms across the finest rice-growing belts — Punjab, Andhra Pradesh, and Tamil Nadu. Eliminates intermediaries for fair, traceable grain.',
                icon: ShieldCheck
              },
              {
                step: '02',
                title: 'State-of-the-Art Satake Milling',
                desc: 'Satake milling and optical color sorting preserve grain integrity, natural aroma, and whiteness uniformity without breakage.',
                icon: Building2
              },
              {
                step: '03',
                title: 'Rigorous Lab Quality Testing',
                desc: 'Every batch is tested across 7 checkpoints: moisture content, purity percentage, grain length elongation, broken grain ratio, and food safety compliance.',
                icon: FileCheck
              },
              {
                step: '04',
                title: 'Pan-India Wholesale Logistics',
                desc: 'Pan-India logistics with reliable transport partners — ensuring on-time delivery to wholesale markets, mandis, and distributors across 20+ states.',
                icon: Truck
              }
            ].map((p, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#fafaf9] dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-3xl text-emerald-800 dark:text-emerald-400 font-normal">
                    {p.step}
                  </span>
                  <p.icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="font-serif text-xl font-normal text-slate-900 dark:text-white">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. WHY PARTNER WITH US (`#why-us`)                                         */}
      {/* ========================================================================= */}
      <section id="why-us" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Why Partner With Us
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white">
            Built on Transparency, Reliability, and Scale.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            We don't just supply rice — we build long-term supply partnerships built on transparency, reliability, and shared commercial success across India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: '200+ Contracted Farms',
              desc: 'We operate direct procurement agreements with 200+ certified farms across India, eliminating middlemen and ensuring fair, traceable supply.',
              icon: '🌾'
            },
            {
              title: '7-Step Quality Checkpoints',
              desc: 'Our 7-step quality assurance protocol guarantees identical standards across every delivery, batch after batch, every season.',
              icon: '🔬'
            },
            {
              title: '50,000 MT Annual Capacity',
              desc: '50,000 MT annual capacity with efficient logistics and just-in-time delivery — built for retailers, distributors and wholesale buyers across India.',
              icon: '📦'
            },
            {
              title: 'Margin-Protecting Pricing',
              desc: 'Farm-to-market optimization allows us to price premium rice at rates that protect your margins and keep your customers happy.',
              icon: '💰'
            },
            {
              title: 'FSSAI & ISO Certified',
              desc: 'FSSAI, ISO 22000, and HACCP compliance across all products. Every single grain meets India’s highest food safety standards.',
              icon: '🏆'
            },
            {
              title: 'Dedicated Logistics Coordinators',
              desc: 'Dedicated logistics coordinators ensure every order arrives on schedule with full documentation and batch quality certificates.',
              icon: '⏱️'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-white dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40 shadow-xs space-y-3"
            >
              <span className="text-2xl block">{item.icon}</span>
              <h3 className="font-serif text-xl font-normal text-slate-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. DOMESTIC REACH & DISTRIBUTION NETWORK (`#domestic-reach`)               */}
      {/* ========================================================================= */}
      <section id="domestic-reach" className="py-16 sm:py-24 bg-slate-900 text-white px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              Pan-India Distribution
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight leading-tight">
              Trusted by 150+ Partners in 20+ States
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
              With a dedicated distribution network, strong relationships with mandis and wholesale markets, and reliable logistics, we deliver consistently to every major rice market across India.
            </p>
          </div>

          {/* Regional Hub Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                region: 'Karnataka (Headquarters)',
                hub: 'APMC Yard, Yeshwanthpur',
                coverage: 'Bengaluru, Mysuru, Hubballi, Belagavi, Davanagere, Shimoga',
                notes: 'Primary canvassing headquarters and direct APMC yard distribution'
              },
              {
                region: 'Maharashtra & West',
                hub: 'Vashi APMC & Pune Mandi',
                coverage: 'Mumbai, Pune, Nagpur, Nashik, Kolhapur',
                notes: 'Dedicated Basmati & Sona Masoori retail chain supply'
              },
              {
                region: 'Tamil Nadu & South',
                hub: 'Chennai & Madurai APMC',
                coverage: 'Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem',
                notes: 'Kollam raw, steam, and Ponni rice wholesale fulfillment'
              },
              {
                region: 'Delhi NCR & North',
                hub: 'Delhi Wholesale Mandis',
                coverage: 'New Delhi, Noida, Gurugram, Jaipur, Lucknow',
                notes: 'Direct Punjab & Haryana farm Basmati 1121 and 1509 allocations'
              },
              {
                region: 'Andhra Pradesh & Telangana',
                hub: 'Hyderabad & Miryalaguda',
                coverage: 'Hyderabad, Warangal, Vijayawada, Guntur, Rajahmundry',
                notes: 'Premium Sona Masoori steam and raw paddy milling centers'
              },
              {
                region: 'Gujarat & Rajasthan',
                hub: 'Ahmedabad & Surat Mandis',
                coverage: 'Ahmedabad, Surat, Vadodara, Rajkot, Jaipur',
                notes: 'High-volume commercial dining and catering supply partnerships'
              }
            ].map((market, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{market.region}</span>
                </div>
                <h4 className="font-serif text-lg font-normal text-white">
                  {market.hub}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  <strong className="text-white font-semibold">Key Markets:</strong> {market.coverage}
                </p>
                <p className="text-[11px] text-slate-400 italic pt-1">
                  {market.notes}
                </p>
              </div>
            ))}
          </div>

          {/* Testimonial Quote */}
          <div className="p-8 rounded-3xl bg-emerald-950/40 border border-emerald-800/40 max-w-4xl mx-auto space-y-4 text-center">
            <div className="flex justify-center text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <blockquote className="font-serif text-xl sm:text-2xl font-normal leading-relaxed text-slate-200">
              "We've been sourcing Basmati from Tejas Canvassing for over four years. Their consistency in quality and delivery reliability is genuinely unmatched in the Indian wholesale market."
            </blockquote>
            <div className="text-xs text-emerald-300 font-semibold">
              Procurement Manager · Delhi Wholesale Traders, New Delhi
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. CONTACT & INQUIRY FORM (`#contact`)                                    */}
      {/* ========================================================================= */}
      <section id="contact" className="py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Info Column */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Start a Partnership
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
              Get in Touch with Tejas Canvassing
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Share your requirements and our team will respond with pricing, availability, and delivery options within one business day.
            </p>

            {/* Direct Contact Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40">
                <MapPin className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Headquarters</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    APMC Yard, Yeshwanthpur,<br />
                    Bengaluru, Karnataka 560022
                  </p>
                  <a 
                    href="https://maps.app.goo.gl/TZcms2SCaaN6GC2SA" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40">
                <Phone className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Phone & WhatsApp</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    +91 9916416995 / +91 9342380981
                  </p>
                  <a 
                    href="https://wa.me/919916416995" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <span>Chat on WhatsApp Business</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-[#0a1811] border border-slate-200/80 dark:border-emerald-950/40">
                <Mail className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Direct Email</span>
                  <a 
                    href="mailto:tejascanvassing@gmail.com" 
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400"
                  >
                    tejascanvassing@gmail.com
                  </a>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Response within 24 business hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Inquiry Form */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0a1811] p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-emerald-950/50 shadow-md">
            <h3 className="font-serif text-2xl font-normal text-slate-900 dark:text-white mb-2">
              Wholesale Supply Inquiry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-normal">
              Fill in your specifications below or submit directly to our WhatsApp procurement desk.
            </p>

            {formSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-serif text-xl text-emerald-900 dark:text-emerald-200">
                  Enquiry Transmitted Successfully
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Our trading desk at APMC Yeshwanthpur will verify market rates and contact you shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setFormSubmitted(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                >
                  Send Another Enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleWhatsAppSend} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Your Name / Trading Firm
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={e => setFormState({ ...formState, name: e.target.value })}
                      placeholder="e.g. V.K Foods, Ramesh Trading"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Phone Number (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      required
                      value={formState.phone}
                      onChange={e => setFormState({ ...formState, phone: e.target.value })}
                      placeholder="+91 98450 XXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Product / Variety
                    </label>
                    <select
                      value={formState.variety}
                      onChange={e => setFormState({ ...formState, variety: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20"
                    >
                      <option value="Basmati 1121 & 1509">Basmati 1121 & 1509</option>
                      <option value="Kollam Raw Rice">Kollam Raw Rice</option>
                      <option value="Kollam Raw & Steam">Kollam Raw & Steam</option>
                      <option value="Sona Masoori Steam & KNM">Sona Masoori Steam & KNM</option>
                      <option value="HMT Steam & Raw">HMT Steam & Raw</option>
                      <option value="Aromatic Scented Rice">Aromatic Scented Rice</option>
                      <option value="Sortex Urad Dal">Sortex Urad Dal</option>
                      <option value="Custom Variety Sourcing">Custom Variety Sourcing</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Estimated Volume (Metric Tons)
                    </label>
                    <select
                      value={formState.volume}
                      onChange={e => setFormState({ ...formState, volume: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20"
                    >
                      <option value="1 to 5 MT (Sample Batch)">1 to 5 MT (Sample Batch)</option>
                      <option value="10 to 25 MT (1 Truckload)">10 to 25 MT (1 Full Truckload)</option>
                      <option value="50 to 100 MT">50 to 100 MT</option>
                      <option value="100+ MT (Bulk Contract)">100+ MT (Bulk Contract)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Destination City / Mandi Port
                  </label>
                  <input
                    type="text"
                    value={formState.city}
                    onChange={e => setFormState({ ...formState, city: e.target.value })}
                    placeholder="e.g. Yeshwanthpur APMC, Vashi APMC, Chennai Mandi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Additional Specifications or Packing Preferences
                  </label>
                  <textarea
                    rows={3}
                    value={formState.notes}
                    onChange={e => setFormState({ ...formState, notes: e.target.value })}
                    placeholder="Describe your packaging preferences (25kg/50kg non-woven or jute), delivery timeline, or specific moisture/broken percentage requirements..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafaf9] dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/20 resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-6 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Transmit Enquiry to WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormSubmitted(true);
                    }}
                    className="py-3 px-6 rounded-xl bg-[#143e2e] hover:bg-[#0f2e22] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Submit Form</span>
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="border-t border-slate-200 dark:border-emerald-950/60 bg-white dark:bg-[#030906] py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            <div className="flex items-center gap-2.5">
              <TejasBotanicalLogo className="w-8 h-8 text-[#143e2e] dark:text-emerald-400" />
              <div>
                <span className="font-serif text-xl font-normal text-slate-900 dark:text-white">
                  Tejas Canvassing
                </span>
                <span className="text-[9px] tracking-[0.25em] text-slate-400 uppercase font-semibold block">
                  Wholesale Rice Trading
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
              <a href="#products" className="hover:text-[#143e2e] dark:hover:text-emerald-400">Products</a>
              <a href="#process" className="hover:text-[#143e2e] dark:hover:text-emerald-400">Supply Chain</a>
              <a href="#why-us" className="hover:text-[#143e2e] dark:hover:text-emerald-400">Why Us</a>
              <a href="#domestic-reach" className="hover:text-[#143e2e] dark:hover:text-emerald-400">Reach</a>
              <a href="#contact" className="hover:text-[#143e2e] dark:hover:text-emerald-400">Contact</a>
              <span className="text-slate-300 dark:text-neutral-800">|</span>
              <button onClick={() => navigate('/store')} className="hover:underline text-[#143e2e] dark:text-emerald-400 font-semibold cursor-pointer">
                Store
              </button>
              <button onClick={() => navigate('/login')} className="hover:underline text-[#143e2e] dark:text-emerald-400 font-semibold cursor-pointer">
                Merchant Login
              </button>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-neutral-900 pt-6 text-[11px] text-slate-400">
            <p>
              © 2025 Tejas Canvassing Pvt. Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <span>FSSAI Certified</span>
              <span>•</span>
              <span>ISO 22000 Compliant</span>
              <span>•</span>
              <span>APMC Yard, Yeshwanthpur</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
