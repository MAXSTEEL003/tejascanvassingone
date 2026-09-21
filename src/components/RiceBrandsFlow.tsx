import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ChevronRight, Award, ShieldCheck, ArrowRight, ArrowUpRight, Scale, Wheat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface BrandItem {
  id: string;
  name: string;
  category: string;
  tagline: string;
  badge: string;
  image: string;
  accentColor: string;
  accentBg: string;
  borderGlow: string;
  origin: string;
  keySpec: string;
  rating: string;
  description: string;
  features: string[];
}

export const TEJAS_BRANDS: BrandItem[] = [
  {
    id: 'keshar-kali',
    name: 'Keshar Kali',
    category: 'Flagship Kollam Raw Rice',
    tagline: 'The 17-Year Legend in Every Grain',
    badge: 'Premier Flagship Brand',
    image: '/images/keshar_kali.png',
    accentColor: '#D97706',
    accentBg: 'rgba(217, 119, 6, 0.12)',
    borderGlow: 'rgba(245, 158, 11, 0.35)',
    origin: 'Gangavathi & Tungabhadra Belt',
    keySpec: '3.8x Volume Expansion · Aged Raw',
    rating: '5.0 ★ (300+ APMC Merchants)',
    description: 'Our most revered signature brand since 2008. Sourced directly from premier South Asian millers, delivering crystal-white brilliance and zero chalkiness.',
    features: ['100% Sortex Cleaned', 'Silky Aromatic Texture', 'Aged to Perfection', 'APMC Certified']
  },
  {
    id: 'jmr',
    name: 'JMR Brand',
    category: 'HMT Steam · Raw · Kollam',
    tagline: 'Wholesale Standard of South India',
    badge: 'Top Wholesale Volume',
    image: '/images/jmr.jpg',
    accentColor: '#059669',
    accentBg: 'rgba(5, 150, 105, 0.12)',
    borderGlow: 'rgba(16, 185, 129, 0.35)',
    origin: 'Miryalaguda Milling Hub',
    keySpec: 'Non-Sticky · High Cooking Yield',
    rating: '4.9 ★ (Commercial Kitchen Choice)',
    description: 'Trusted by over 300 catering houses, hotels, and retail merchants. Highly consistent HMT steam and Kollam raw grains with immaculate uniformity.',
    features: ['Zero Broken Grains', 'High Starch Stability', 'Direct Mill Procurement', 'Double Polished']
  },
  {
    id: 'simha',
    name: 'Simha Brand',
    category: 'Sortex Urad Dal & Specialty Grains',
    tagline: 'Supreme Fermentation & Batter Yield',
    badge: 'High Batter Yield',
    image: '/images/simha.png',
    accentColor: '#DC2626',
    accentBg: 'rgba(220, 38, 38, 0.12)',
    borderGlow: 'rgba(239, 68, 68, 0.35)',
    origin: 'North Karnataka Sourcing',
    keySpec: 'Maximum Fluff · Pure Protein',
    rating: '4.9 ★ (Idli/Dosa Specialist)',
    description: 'Celebrated across Karnataka and Tamil Nadu for South Indian batters. Selected for rapid soaking, immaculate whiteness, and unmatched batter expansion.',
    features: ['Machine Grated & Cleaned', 'Superior Foam Volume', 'Zero Foreign Matter', 'Pristine White']
  },
  {
    id: 'keshar-madhuram',
    name: 'Keshar Madhuram',
    category: 'Premium Sona Masoori',
    tagline: 'Sweet Aroma, Low Starch Everyday Luxury',
    badge: 'Daily Table Favorite',
    image: '/images/keshar_madhuram.png',
    accentColor: '#B45309',
    accentBg: 'rgba(180, 83, 9, 0.12)',
    borderGlow: 'rgba(217, 119, 6, 0.35)',
    origin: 'Kurnool & Raichur Basin',
    keySpec: 'Light & Easy Digestibility',
    rating: '4.8 ★ (Retail Bestseller)',
    description: 'Hand-picked Sona Masoori kernels known for subtle fragrance, soft fluffy grains, and light, nutritious dining suitable for everyday households.',
    features: ['Low Glycemic Index', 'Subtle Natural Fragrance', 'Uniform Medium Grain', 'Farm Fresh Harvest']
  },
  {
    id: 'bellric',
    name: 'Bellric Brand',
    category: '1121 Royal Basmati & Long Grain',
    tagline: 'Royal Feast · Extra Slender Kernel',
    badge: 'Royal Banquet Grade',
    image: '/images/bellric.png',
    accentColor: '#2563EB',
    accentBg: 'rgba(37, 99, 235, 0.12)',
    borderGlow: 'rgba(59, 130, 246, 0.35)',
    origin: 'Haryana & Taraori Rice Belt',
    keySpec: '8.35mm Kernel · 2.4x Elongation',
    rating: '5.0 ★ (Biryani Specialists)',
    description: 'Supreme 1121 Basmati grains that elongate gracefully without curving or clumping. The royal hallmark for grand caterers and luxury dining.',
    features: ['Extra Long Grain (8.35mm)', 'Non-Sticky Slender Cut', '2-Year Aged Stocks', 'Export Specification']
  }
];

interface RiceBrandsFlowProps {
  onViewVarieties?: () => void;
  activeBrandId?: string;
  onSelectBrand?: (brand: BrandItem) => void;
}

export default function RiceBrandsFlow({
  onViewVarieties,
  activeBrandId,
  onSelectBrand
}: RiceBrandsFlowProps) {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState<BrandItem>(() => {
    if (activeBrandId) {
      const found = TEJAS_BRANDS.find(b => b.id === activeBrandId);
      if (found) return found;
    }
    return TEJAS_BRANDS[0];
  });

  const handleBrandClick = (brand: BrandItem) => {
    setSelectedBrand(brand);
    if (onSelectBrand) {
      onSelectBrand(brand);
    }
  };

  const handleOrderWholesale = () => {
    const role = localStorage.getItem('userRole');
    if (role === 'merchant') {
      navigate('/store');
    } else {
      navigate('/store');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center select-none relative z-20 px-2 sm:px-4">
      
      {/* ── HEADER BANNER: RICE FLOW TO BRANDS ── */}
      <div className="text-center mb-4 sm:mb-6 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-900 dark:text-amber-200 text-[10.5px] font-mono font-bold uppercase tracking-wider mb-2 shadow-xs backdrop-blur-md">
          <Wheat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>05 / Verified Flagship Brands</span>
        </div>
        <h2 
          style={{ fontFamily: 'var(--font-serif)' }}
          className="text-2xl sm:text-4xl font-normal text-stone-900 dark:text-stone-100 tracking-tight leading-tight"
        >
          Rice Flowing Directly to Our Iconic Brands
        </h2>
        <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
          Every grain from sortex milling is graded and packaged under our trusted proprietary brands, distributed across 300+ wholesale merchants.
        </p>
      </div>

      {/* ── INTERACTIVE BRAND TILES (Direct Flow Targets) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-3 w-full mb-3 sm:mb-6">
        {TEJAS_BRANDS.map((brand) => {
          const isSelected = selectedBrand.id === brand.id;
          return (
            <button
              key={brand.id}
              type="button"
              onClick={() => handleBrandClick(brand)}
              className={`group relative flex flex-col items-center p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer text-left ${
                isSelected
                  ? 'bg-white dark:bg-stone-900/90 shadow-xl ring-2 scale-102 -translate-y-0.5 sm:-translate-y-1'
                  : 'bg-white/70 dark:bg-stone-900/50 hover:bg-white dark:hover:bg-stone-900/80 shadow-sm hover:shadow-md'
              }`}
              style={{
                borderColor: isSelected ? brand.accentColor : 'transparent',
                boxShadow: isSelected ? `0 12px 28px -6px ${brand.borderGlow}` : undefined
              }}
            >
              {/* Dynamic Rice Flow Cascade Particle Glow when selected */}
              {isSelected && (
                <div 
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8.5px] sm:text-[9px] font-mono font-bold tracking-wider uppercase text-white shadow-sm flex items-center gap-1 z-30 animate-pulse"
                  style={{ background: brand.accentColor }}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Active Flow</span>
                </div>
              )}

              {/* Brand Pack Authentic Image Container */}
              <div className="relative w-full aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden mb-1.5 sm:mb-2 bg-gradient-to-b from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-950 flex items-center justify-center p-1 sm:p-2 border border-stone-200 dark:border-stone-800">
                <img
                  src={brand.image}
                  alt={brand.name}
                  className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                
                {/* Luminous sheen across image on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>

              {/* Brand Title & Info */}
              <div className="w-full">
                <div className="flex items-center justify-between gap-1">
                  <h3 
                    style={{ fontFamily: 'var(--font-serif)' }}
                    className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-base leading-tight truncate"
                  >
                    {brand.name}
                  </h3>
                </div>
                
                <p className="text-[9.5px] sm:text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                  {brand.category}
                </p>

                <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
                  <span 
                    className="text-[8.5px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ 
                      backgroundColor: brand.accentBg, 
                      color: brand.accentColor 
                    }}
                  >
                    {brand.badge}
                  </span>
                  
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900' : 'text-stone-400'
                  }`}>
                    <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── SELECTED BRAND FEATURE SPOTLIGHT CARD ── */}
      <div 
        className="w-full rounded-xl sm:rounded-3xl p-3 sm:p-6 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-6 relative overflow-hidden"
        style={{
          boxShadow: `0 20px 45px -12px ${selectedBrand.borderGlow}`
        }}
      >
        {/* Ambient Top Glow Line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${selectedBrand.accentColor}, transparent)` }}
        />

        {/* Left Side: Brand Visual with Pack Details */}
        <div className="flex items-center gap-3 sm:gap-6 w-full md:w-auto">
          <div className="relative w-16 h-16 sm:w-28 sm:h-28 shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-b from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-950 p-1.5 sm:p-2 border border-stone-200 dark:border-stone-800 flex items-center justify-center shadow-inner">
            <img
              src={selectedBrand.image}
              alt={selectedBrand.name}
              className="w-full h-full object-contain drop-shadow-lg"
            />
            <div 
              className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-md flex items-center justify-center text-[10px] sm:text-xs"
              title="Verified APMC Quality"
            >
              🌾
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 
                style={{ fontFamily: 'var(--font-serif)' }}
                className="text-base sm:text-2xl font-bold text-stone-900 dark:text-stone-100"
              >
                {selectedBrand.name}
              </h3>
              <span 
                className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{ 
                  backgroundColor: selectedBrand.accentBg, 
                  color: selectedBrand.accentColor 
                }}
              >
                {selectedBrand.badge}
              </span>
            </div>

            <p className="text-[11px] sm:text-sm text-stone-600 dark:text-stone-300 font-medium mt-0.5 sm:mt-1">
              {selectedBrand.tagline}
            </p>

            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 mt-1 sm:mt-2 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                <span>{selectedBrand.keySpec}</span>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                <span>{selectedBrand.rating}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Wholesale Quality Standard Badge */}
        <div className="flex flex-col items-center md:items-start w-full md:w-auto">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400 font-bold mb-1">
            APMC Wholesale Supply:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-stone-800 dark:text-stone-200 font-medium bg-stone-100/90 dark:bg-stone-800/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Direct Mill Bags · APMC Certified Lot</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('why-us');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else navigate('/store');
            }}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer"
          >
            Why Choose Us
          </button>

          <button
            type="button"
            onClick={handleOrderWholesale}
            className="group px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
            style={{
              background: `linear-gradient(135deg, #11291C 0%, ${selectedBrand.accentColor} 100%)`
            }}
          >
            <span>Order Wholesale Lot</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

    </div>
  );
}
