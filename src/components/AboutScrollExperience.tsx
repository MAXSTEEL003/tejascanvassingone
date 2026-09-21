import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RiceBrandsFlow from './RiceBrandsFlow';

interface VarietyItem {
  id: string;
  name: string;
  tag: string;
  badge: string;
  length: string;
  elongation: string;
  moisture: string;
  origin: string;
  grainRx: number;
  grainRy: number;
  scaleLabel: string;
  isPulse?: boolean;
  colorGradient: { start: string; mid: string; end: string };
}

const VARIETIES: VarietyItem[] = [
  {
    id: 'basmati',
    name: '1121 Basmati',
    tag: 'Long Grain',
    badge: 'Extra Slender',
    length: '8.35 mm',
    elongation: '2.4x',
    moisture: '11.5%',
    origin: 'Punjab & Haryana',
    grainRx: 9,
    grainRy: 56,
    scaleLabel: '8.35 mm · Extra Long Slender',
    colorGradient: { start: '#FFFFFF', mid: '#FEF3C7', end: '#D97706' }
  },
  {
    id: 'keshar-kali',
    name: 'Keshar Kali',
    tag: 'Kollam Raw',
    badge: 'Flagship Brand',
    length: '5.40 mm',
    elongation: '3.8x',
    moisture: '12.8%',
    origin: 'Gangavathi Belt',
    grainRx: 14.5,
    grainRy: 44,
    scaleLabel: '5.40 mm · Medium Plump Pearl',
    colorGradient: { start: '#FFFFFF', mid: '#FDE68A', end: '#F59E0B' }
  },
  {
    id: 'jmr',
    name: 'JMR Brand',
    tag: 'HMT Steam',
    badge: 'Wholesale Favorite',
    length: '5.20 mm',
    elongation: '3.2x',
    moisture: '13.0%',
    origin: 'Miryalaguda Milling',
    grainRx: 12,
    grainRy: 41,
    scaleLabel: '5.20 mm · Medium Slender Cut',
    colorGradient: { start: '#FFFFFF', mid: '#E0E7FF', end: '#059669' }
  },
  {
    id: 'sona-masoori',
    name: 'Sona Masoori',
    tag: 'Medium Grain',
    badge: 'Low Starch',
    length: '5.10 mm',
    elongation: '3.0x',
    moisture: '12.5%',
    origin: 'Kurnool & Raichur',
    grainRx: 10.5,
    grainRy: 38,
    scaleLabel: '5.10 mm · Fine Delicate Kernel',
    colorGradient: { start: '#FFFFFF', mid: '#FEF9C3', end: '#B45309' }
  },
  {
    id: 'bellric',
    name: 'Bellric Raw',
    tag: 'Daily Table',
    badge: 'Silky Texture',
    length: '5.35 mm',
    elongation: '2.8x',
    moisture: '12.6%',
    origin: 'Karnataka APMC',
    grainRx: 13,
    grainRy: 43,
    scaleLabel: '5.35 mm · Uniform Table Grain',
    colorGradient: { start: '#FFFFFF', mid: '#F5F5F4', end: '#2563EB' }
  },
  {
    id: 'simha',
    name: 'Simha Urad',
    tag: 'Sortex Dal',
    badge: 'High Batter Yield',
    length: '4.10 mm',
    elongation: 'N/A',
    moisture: '10.8%',
    origin: 'North Karnataka',
    grainRx: 18,
    grainRy: 26,
    isPulse: true,
    scaleLabel: '4.10 mm · Oval Sortex Dal Pulse',
    colorGradient: { start: '#FFFFFF', mid: '#F1F5F9', end: '#DC2626' }
  }
];

export default function AboutScrollExperience() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);
  scrollProgressRef.current = scrollProgress;
  const [selectedVariety, setSelectedVariety] = useState<VarietyItem>(VARIETIES[0]);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Responsive screen size detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track scroll position of the multi-viewport container
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const totalScrollable = rect.height - windowHeight;
          if (totalScrollable > 0) {
            const raw = -rect.top / totalScrollable;
            const clamped = Math.min(Math.max(raw, 0), 1);
            setScrollProgress(clamped);
            scrollProgressRef.current = clamped;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Jump to specific scene in scroll journey
  const jumpToScene = (targetProgress: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const totalScrollable = rect.height - windowHeight;
    const targetY = window.scrollY + rect.top + targetProgress * totalScrollable;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const scrollToProducts = () => {
    const el = document.getElementById('products');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/store');
    }
  };

  // ── Falling Grains Canvas (Scene 4: Cascade of grains) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Optimized grain particles definition for fluid mobile performance
    const isSmallScreen = window.innerWidth < 768;
    const grainCount = isSmallScreen ? 45 : 110;
    const grains = Array.from({ length: grainCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 1.5 - height * 0.5,
      speedY: 2.5 + Math.random() * 3.8,
      speedX: (Math.random() - 0.5) * 1.0,
      length: isSmallScreen ? (10 + Math.random() * 8) : (14 + Math.random() * 10),
      width: isSmallScreen ? (3 + Math.random() * 2) : (4 + Math.random() * 2.5),
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      alpha: 0.4 + Math.random() * 0.6,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const prog = scrollProgressRef.current;
      // Render actively during Scene 4 (Cascade) and Scene 5 (Bag Pouring)
      if (prog >= 0.64 && prog <= 1.0) {
        const streamIntensity = Math.min(
          Math.max((prog - 0.64) / 0.10, 0),
          1.0
        );

        // Target columns for brands across the screen width
        const brandLanes = [
          width * 0.12,
          width * 0.31,
          width * 0.50,
          width * 0.69,
          width * 0.88
        ];
        const isPouringIntoBrands = prog >= 0.81;
        const brandTargetY = height * 0.48;

        grains.forEach((grain, idx) => {
          grain.y += grain.speedY * (1 + (prog - 0.64) * 2.0);
          grain.x += grain.speedX;
          grain.angle += grain.rotSpeed;

          // Organic flow toward flagship brand columns as grains approach Scene 5
          if (isPouringIntoBrands) {
            const laneIndex = idx % brandLanes.length;
            const targetX = brandLanes[laneIndex];
            const diffX = targetX - grain.x;
            grain.x += diffX * 0.04;

            if (grain.y > brandTargetY - 70) {
              grain.speedX *= 0.85;
            }
          }

          // Loop particles when they fall off screen or when they reach the brand showcase
          const hasReachedBrand = isPouringIntoBrands && grain.y > brandTargetY + 30;
          if (grain.y > height + 20 || hasReachedBrand) {
            grain.y = isPouringIntoBrands ? -20 - Math.random() * 40 : -20;
            const laneIndex = idx % brandLanes.length;
            grain.x = isPouringIntoBrands
              ? brandLanes[laneIndex] + (Math.random() - 0.5) * (width * 0.16)
              : Math.random() * width;
          }

          ctx.save();
          ctx.translate(grain.x, grain.y);
          ctx.rotate(grain.angle);

          // Grain body
          ctx.fillStyle = `rgba(252, 246, 235, ${grain.alpha * streamIntensity})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, grain.length * 0.5, grain.width * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Interpolation helper for opacities and scales across phases
  const getSceneAlpha = (enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) => {
    if (scrollProgress <= enterStart) return enterStart === 0 ? 1 : 0;
    if (scrollProgress >= exitEnd) return exitEnd === 1 ? 1 : 0;
    if (scrollProgress >= enterEnd && scrollProgress <= exitStart) return 1;
    if (scrollProgress < enterEnd) {
      if (enterEnd === enterStart) return 1;
      return (scrollProgress - enterStart) / (enterEnd - enterStart);
    }
    if (exitEnd === exitStart) return 0;
    return (exitEnd - scrollProgress) / (exitEnd - exitStart);
  };

  const scene1Alpha = getSceneAlpha(0.00, 0.00, 0.15, 0.20);
  const scene2Alpha = getSceneAlpha(0.18, 0.23, 0.38, 0.43);
  const scene3Alpha = getSceneAlpha(0.40, 0.45, 0.60, 0.65);
  const scene4Alpha = getSceneAlpha(0.62, 0.67, 0.79, 0.83);
  const scene5Alpha = getSceneAlpha(0.80, 0.85, 1.00, 1.00);

  // Dynamic values
  const fieldScale = 1 + scrollProgress * 0.35;
  const orbitRotation = (scrollProgress - 0.2) * 450; // Rotates smoothly with scroll

  return (
    <div
      ref={containerRef}
      id="grain-journey"
      className="relative w-full"
      style={{ height: '420vh' }}
    >
      {/* Pinned Sticky Stage */}
      <div className="sticky top-0 h-screen h-[100dvh] w-full overflow-hidden bg-[#0D1F15] select-none">

        {/* ── SCENE 1: FROM THE FIELD ── */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: scene1Alpha,
            display: scene1Alpha <= 0.01 ? 'none' : 'block',
            pointerEvents: scene1Alpha > 0.4 ? 'auto' : 'none',
          }}
        >
          {/* High-res Sunset Golden Paddy Field Background with Deep Contrast Grading */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-100 ease-out"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=2200&q=85')`,
              transform: `scale(${fieldScale})`,
              filter: 'brightness(0.48) contrast(1.22) saturate(1.15)',
              objectPosition: 'center 40%',
            }}
          />

          {/* Deep Cinematic Atmosphere Overlays ensuring 100% text contrast & visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05110A]/95 via-[#081810]/75 to-[#05110A]/95" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#06140C]/50 to-[#040D07]/90" />

          {/* Scene 1 Text Typography matching the video */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-12 sm:pt-0">
            <div className="max-w-4xl mx-auto flex flex-col items-center">
              
              {/* High-Contrast Eyebrow Badge (Clearly visible above the headline) */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 sm:mb-6 border border-amber-400/50 bg-[#07170E]/90 backdrop-blur-xl shadow-2xl">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10.5px] sm:text-xs uppercase tracking-[0.25em] text-amber-300 font-bold font-mono">
                  Origin & Sourcing · Estd. 2008
                </span>
              </div>

              {/* Exact Serif Headline with High-Contrast Text Shadows */}
              <h1
                style={{ fontFamily: 'var(--font-serif)' }}
                className="text-white text-3xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight leading-[1.08] mb-4 sm:mb-5 drop-shadow-[0_6px_30px_rgba(0,0,0,0.95)]"
              >
                FROM THE FIELD
              </h1>

              {/* Clean Subtitle with Strong Text Legibility */}
              <p className="text-stone-200 text-sm sm:text-lg md:text-xl font-light tracking-wide max-w-xl mx-auto drop-shadow-[0_3px_14px_rgba(0,0,0,0.9)]">
                Every grain begins with where it is grown.
              </p>

              {/* Sub-context description */}
              <div className="mt-6 sm:mt-8 inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/55 border border-white/15 backdrop-blur-md text-amber-200/95 text-xs sm:text-sm font-medium shadow-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Karnataka · Tamil Nadu · Andhra Pradesh Basin</span>
              </div>
            </div>

            {/* Scroll Down Prompt at bottom */}
            <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/80">
              <span className="text-[9.5px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-amber-300">
                Scroll to explore journey
              </span>
              <div className="w-4 h-7 sm:w-5 sm:h-8 rounded-full border-2 border-white/50 flex items-start justify-center p-1">
                <div className="w-1.5 h-2 bg-amber-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* ── SCENE 2: SELECTED WITH CARE & ORBITAL VARIETY CAROUSEL ── */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: scene2Alpha,
            display: scene2Alpha <= 0.01 ? 'none' : 'block',
            pointerEvents: scene2Alpha > 0.3 ? 'auto' : 'none',
          }}
        >
          {/* Hands holding golden harvested grains in field background (Matching Reference Image) */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=2200&q=85')`,
              filter: 'brightness(0.78) contrast(1.15)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A160F]/95 via-[#0D1F15]/85 to-[#0A160F]/95" />

          <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-8 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-8 lg:gap-12 pt-16 sm:pt-20 lg:py-16">
            {/* Left Content: Typography + Grain Spec Card (positioned a little below) */}
            <div className="w-full lg:w-5/12 text-left pt-6 sm:pt-10 lg:pt-8 shrink-0">
              <h2
                style={{ fontFamily: 'var(--font-serif)' }}
                className="text-white text-2xl sm:text-4xl lg:text-6xl font-normal tracking-tight leading-tight mb-1.5 sm:mb-3.5"
              >
                SELECTED WITH CARE
              </h2>

              <p className="text-white/80 text-xs sm:text-sm md:text-base font-light leading-relaxed mb-2.5 sm:mb-5 line-clamp-2 sm:line-clamp-none">
                Harvested at peak maturity from verified fertile riverbeds. Every panicle is hand-checked for kernel density, natural translucency, and optimal moisture content before entering Sortex canvassing.
              </p>

              {/* Unified Single Display: Compact Grain Inspection & Spec Card (Small, fitted for mobile UI) */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#081810]/90 sm:bg-white/10 backdrop-blur-xl border border-amber-400/40 text-white max-w-md shadow-2xl">
                <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 pb-1.5 border-b border-white/15">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-amber-300 font-mono font-bold shrink-0">
                      Inspecting:
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                      {selectedVariety.name}
                    </h3>
                    <span className="text-[8.5px] sm:text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-medium shrink-0">
                      {selectedVariety.scaleLabel}
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-stone-300 font-mono shrink-0">
                    {selectedVariety.origin}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div className="p-1 sm:p-1.5 rounded-lg bg-black/40 border border-white/10">
                    <span className="text-[7.5px] sm:text-[8.5px] uppercase tracking-wider text-white/60 block font-mono">Length</span>
                    <span className="text-[10.5px] sm:text-xs font-bold text-amber-300 font-mono">
                      {selectedVariety.length}
                    </span>
                  </div>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-black/40 border border-white/10">
                    <span className="text-[7.5px] sm:text-[8.5px] uppercase tracking-wider text-white/60 block font-mono">Elongation</span>
                    <span className="text-[10.5px] sm:text-xs font-bold text-emerald-300 font-mono">
                      {selectedVariety.elongation}
                    </span>
                  </div>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-black/40 border border-white/10">
                    <span className="text-[7.5px] sm:text-[8.5px] uppercase tracking-wider text-white/60 block font-mono">Moisture</span>
                    <span className="text-[10.5px] sm:text-xs font-bold text-sky-300 font-mono">
                      {selectedVariety.moisture}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: 3D Orbital Model (Placed higher as requested) */}
            <div className="w-full lg:w-7/12 flex-1 lg:flex-initial flex items-center justify-center relative min-h-[260px] sm:min-h-[400px] -mt-5 sm:-mt-8 lg:-mt-12 pb-2 sm:pb-0">
              {/* Tilted Orbit Ring Canvas/CSS */}
              <div
                className="relative w-[280px] sm:w-[390px] md:w-[470px] h-[220px] sm:h-[340px] md:h-[430px] flex items-center justify-center"
                style={{
                  perspective: '1000px',
                }}
              >
                {/* 3D Tilted Elliptical Ring Outline */}
                <div
                  className="absolute inset-0 rounded-full border border-amber-400/35 shadow-[0_0_40px_rgba(251,191,36,0.18)]"
                  style={{
                    transform: `rotateX(66deg) rotateZ(${orbitRotation}deg)`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Subtle orbiting dashed inner ring */}
                  <div className="absolute inset-3 rounded-full border border-dashed border-white/20" />
                </div>

                {/* Center Gleaming Grain with Proportional Custom Size & Shape */}
                <div className="relative z-30 flex flex-col items-center">
                  <div className="relative w-16 h-28 sm:w-20 sm:h-32 flex items-center justify-center">
                    {/* Glowing halo tailored to variety color */}
                    <div 
                      className="absolute inset-0 rounded-full blur-xl animate-pulse opacity-60" 
                      style={{ background: selectedVariety.colorGradient.end }}
                    />
                    
                    {/* Translucent Rice/Pulse Grain SVG */}
                    <svg viewBox="0 0 60 130" className="w-full h-full drop-shadow-[0_0_20px_rgba(251,191,36,0.85)] transition-all duration-500 ease-out">
                      <defs>
                        <linearGradient id={`centerGrainGrad-${selectedVariety.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={selectedVariety.colorGradient.start} />
                          <stop offset="50%" stopColor={selectedVariety.colorGradient.mid} />
                          <stop offset="100%" stopColor={selectedVariety.colorGradient.end} />
                        </linearGradient>
                      </defs>
                      {selectedVariety.isPulse ? (
                        <g className="transition-all duration-500 ease-out">
                          <ellipse
                            cx="30"
                            cy="65"
                            rx={selectedVariety.grainRx}
                            ry={selectedVariety.grainRy}
                            fill={`url(#centerGrainGrad-${selectedVariety.id})`}
                            className="transition-all duration-500 ease-out"
                          />
                          {/* Pulse Hilum Seam */}
                          <path
                            d="M 30 46 Q 28 65 30 84"
                            stroke="rgba(0,0,0,0.2)"
                            strokeWidth="1.5"
                            fill="none"
                          />
                        </g>
                      ) : (
                        <g className="transition-all duration-500 ease-out">
                          <ellipse
                            cx="30"
                            cy="65"
                            rx={selectedVariety.grainRx}
                            ry={selectedVariety.grainRy}
                            fill={`url(#centerGrainGrad-${selectedVariety.id})`}
                            transform="rotate(-3 30 65)"
                            className="transition-all duration-500 ease-out"
                          />
                          {/* Polished inner spine scaled to length */}
                          <path
                            d={`M 28 ${65 - selectedVariety.grainRy * 0.72} Q 30 65 28 ${65 + selectedVariety.grainRy * 0.72}`}
                            stroke="rgba(255,255,255,0.75)"
                            strokeWidth="1.5"
                            fill="none"
                            className="transition-all duration-500 ease-out"
                          />
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                {/* Orbiting Variety Pills around the ring with non-obstructing wide clearance */}
                {VARIETIES.map((variety, idx) => {
                  const angle = (idx / VARIETIES.length) * Math.PI * 2 + (orbitRotation * Math.PI) / 180;
                  const radiusX = isMobile ? 116 : 205; // Generous clearance tailored to screen size
                  const radiusY = isMobile ? 48 : 95;  // Clear vertical clearance below and above center grain
                  const x = Math.cos(angle) * radiusX;
                  const y = Math.sin(angle) * radiusY;
                  const isSelected = selectedVariety.id === variety.id;
                  const isBack = Math.sin(angle) < -0.15;
                  const depthZ = isSelected ? 40 : isBack ? 10 : 25;
                  const depthOpacity = isSelected ? 1 : isBack ? 0.65 : 0.95;
                  const depthScale = isMobile 
                    ? (isSelected ? 0.96 : isBack ? 0.78 : 0.88)
                    : (isSelected ? 1.08 : isBack ? 0.88 : 0.98);

                  return (
                    <button
                      key={variety.id}
                      type="button"
                      onClick={() => setSelectedVariety(variety)}
                      className={`absolute transition-all duration-300 cursor-pointer rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold backdrop-blur-md shadow-xl border flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950 border-amber-300 font-bold ring-2 ring-amber-300 shadow-amber-400/40'
                          : 'bg-black/75 text-white/90 border-white/20 hover:bg-black/90 hover:border-amber-400/60'
                      }`}
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${depthScale})`,
                        zIndex: depthZ,
                        opacity: depthOpacity,
                      }}
                    >
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: variety.colorGradient.end }}
                      />
                      <span>{variety.name}</span>
                      <span className="text-[9px] font-mono opacity-80">
                        {variety.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── SCENE 3: MACRO GRAIN & TECHNICAL INSPECTION CALLOUTS ── */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: scene3Alpha,
            display: scene3Alpha <= 0.01 ? 'none' : 'block',
            pointerEvents: scene3Alpha > 0.3 ? 'auto' : 'none',
          }}
        >
          {/* High-Resolution Macro Rice Grain Laboratory & Studio Background (No plain white) */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-100 ease-out"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=2200&q=85')`,
              filter: 'brightness(0.92) contrast(1.15)',
              transform: `scale(${1 + (scrollProgress - 0.44) * 0.15})`,
            }}
          />
          {/* Warm Golden Atmosphere Overlays ensuring crystal-clear text & pointer legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#F7F2E7]/88 via-[#FAF6EE]/78 to-[#EFE6D8]/90 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-radial-at-c from-amber-200/20 via-transparent to-stone-900/15" />

          <div className="relative z-10 h-full max-w-6xl mx-auto px-4 sm:px-8 flex flex-col items-center justify-center pt-16 sm:pt-0">
            
            {/* Top Scene Marker */}
            <div className="text-center mb-4 sm:mb-6">
              <h2
                style={{ fontFamily: 'var(--font-serif)' }}
                className="text-stone-900 text-xl xs:text-2xl sm:text-4xl font-normal mt-0.5 sm:mt-1"
              >
                Anatomy of Pure Perfection
              </h2>
            </div>

            {/* Macro Grain Canvas & Pointers Wrapper */}
            <div className="relative w-full max-w-[680px] h-[320px] sm:h-[420px] flex items-center justify-center">

              {/* Central Photorealistic Macro Rice Grain */}
              <div className="relative flex items-center justify-center">
                {/* Radial Soft Ambient Contact Shadow */}
                <div
                  className="absolute -bottom-6 w-48 sm:w-64 h-8 rounded-full blur-md opacity-30"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(30,20,10,0.8) 0%, transparent 70%)',
                  }}
                />

                {/* The Macro Grain (Translucent PBR styling) */}
                <svg
                  viewBox="0 0 100 240"
                  className="w-20 xs:w-24 sm:w-32 md:w-36 h-auto drop-shadow-2xl filter"
                >
                  <defs>
                    <linearGradient id="macroGrainTranslucent" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="25%" stopColor="#FFFDF7" />
                      <stop offset="65%" stopColor="#F5ECE0" />
                      <stop offset="90%" stopColor="#EAD8BE" />
                      <stop offset="100%" stopColor="#DBC39E" />
                    </linearGradient>

                    {/* Subsurface glow effect */}
                    <radialGradient id="subsurfaceGlow" cx="45%" cy="40%" r="60%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                      <stop offset="40%" stopColor="rgba(254,243,199,0.5)" />
                      <stop offset="100%" stopColor="rgba(217,119,6,0.1)" />
                    </radialGradient>
                  </defs>

                  {/* Main Translucent Rice Body */}
                  <ellipse
                    cx="50"
                    cy="120"
                    rx="26"
                    ry="102"
                    fill="url(#macroGrainTranslucent)"
                    transform="rotate(-4 50 120)"
                  />
                  <ellipse
                    cx="48"
                    cy="115"
                    rx="22"
                    ry="96"
                    fill="url(#subsurfaceGlow)"
                    transform="rotate(-4 50 120)"
                  />

                  {/* Pearlescent Surface Reflection Ridge */}
                  <path
                    d="M 46 30 Q 52 110 45 205"
                    stroke="rgba(255, 255, 255, 0.95)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Fine grain polish line */}
                  <path
                    d="M 38 45 Q 42 120 37 185"
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>

                {/* Grain Center Target Dots */}
                <div className="absolute top-[28%] left-[53%] w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B] ring-2 ring-white animate-ping" />
                <div className="absolute top-[52%] left-[45%] w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_#059669] ring-2 ring-white animate-ping" />
                <div className="absolute bottom-[28%] right-[44%] w-2.5 h-2.5 rounded-full bg-amber-600 shadow-[0_0_8px_#D97706] ring-2 ring-white animate-ping" />
              </div>

              {/* ── CALLOUT 1: LONG GRAIN (Top Left) ── */}
              <div
                className="absolute top-1 left-1 sm:top-2 sm:left-6 md:left-10 max-w-[145px] xs:max-w-[175px] sm:max-w-[210px] text-left transition-all duration-300"
                style={{
                  transform: `translateY(${(1 - scene3Alpha) * 15}px)`,
                }}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] xs:text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900">
                    LONG GRAIN
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-md text-[10px] sm:text-[11px] text-stone-600 space-y-0.5">
                  <div className="font-semibold text-stone-800 leading-tight">8.35 mm Length</div>
                  <div className="text-[9px] sm:text-[10px] text-stone-500 leading-tight">2.2x Cook Expansion</div>
                </div>
                {/* SVG Pointer Line to Grain Apex */}
                <svg className="hidden sm:block absolute top-6 -right-24 w-28 h-16 pointer-events-none">
                  <path
                    d="M 5 15 L 60 15 L 105 45"
                    stroke="#D97706"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    fill="none"
                  />
                  <circle cx="105" cy="45" r="3" fill="#D97706" />
                </svg>
              </div>

              {/* ── CALLOUT 2: QUALITY GRADE (Bottom Left) ── */}
              <div
                className="absolute bottom-1 left-1 sm:bottom-2 sm:left-6 md:left-10 max-w-[145px] xs:max-w-[175px] sm:max-w-[210px] text-left transition-all duration-300"
                style={{
                  transform: `translateY(${(1 - scene3Alpha) * -15}px)`,
                }}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-600" />
                  <span className="text-[10px] xs:text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900">
                    QUALITY GRADE
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-md text-[10px] sm:text-[11px] text-stone-600 space-y-0.5">
                  <div className="font-semibold text-stone-800 leading-tight">100% Sortex Cleaned</div>
                  <div className="text-[9px] sm:text-[10px] text-stone-500 leading-tight">Zero Chalkiness</div>
                </div>
                {/* SVG Pointer Line to Grain Body */}
                <svg className="hidden sm:block absolute bottom-6 -right-24 w-28 h-16 pointer-events-none">
                  <path
                    d="M 5 45 L 55 45 L 105 15"
                    stroke="#059669"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    fill="none"
                  />
                  <circle cx="105" cy="15" r="3" fill="#059669" />
                </svg>
              </div>

              {/* ── CALLOUT 3: PREMIUM GRADE (Bottom Right) ── */}
              <div
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-6 md:right-10 max-w-[145px] xs:max-w-[175px] sm:max-w-[210px] text-right transition-all duration-300"
                style={{
                  transform: `translateY(${(1 - scene3Alpha) * -15}px)`,
                }}
              >
                <div className="flex items-center justify-end gap-1 sm:gap-1.5 mb-1">
                  <span className="text-[10px] xs:text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900">
                    PREMIUM GRADE
                  </span>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-600" />
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-md text-[10px] sm:text-[11px] text-stone-600 space-y-0.5">
                  <div className="font-semibold text-stone-800 leading-tight">11.5% Moisture</div>
                  <div className="text-[9px] sm:text-[10px] text-stone-500 leading-tight">Double Silky Polish</div>
                </div>
                {/* SVG Pointer Line to Translucent Body */}
                <svg className="hidden sm:block absolute bottom-6 -left-24 w-28 h-16 pointer-events-none">
                  <path
                    d="M 105 45 L 55 45 L 5 15"
                    stroke="#D97706"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    fill="none"
                  />
                  <circle cx="5" cy="15" r="3" fill="#D97706" />
                </svg>
              </div>

            </div>
          </div>
        </div>

        {/* ── SCENE 4: CASCADE OF FALLING GRAINS ── */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: scene4Alpha,
            display: scene4Alpha <= 0.01 ? 'none' : 'block',
          }}
        >
          {/* Solid Opaque Base to guarantee Scene 3 elements never bleed through */}
          <div className="absolute inset-0 bg-[#FAF6EE]" />

          {/* Authentic Rice Grains Background (Identical texture to Scene 3) */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-100 ease-out"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=2200&q=85')`,
              filter: 'brightness(0.94) contrast(1.12)',
              transform: `scale(${1 + (scrollProgress - 0.67) * 0.12})`,
            }}
          />
          {/* Warm Golden Atmosphere Overlays blending with Scene 3 & smoothly leading to Scene 5 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#F7F2E7]/82 via-[#FAF6EE]/72 to-[#EFE6D8]/88" />
          <div className="absolute inset-0 bg-radial-at-c from-amber-100/25 via-transparent to-stone-900/10" />
          
          <div className="relative z-10 h-full flex flex-col items-center justify-start pt-24 sm:pt-28 text-center px-4">
            <h2
              style={{ fontFamily: 'var(--font-serif)' }}
              className="text-stone-900 text-3xl sm:text-5xl font-normal mt-1 max-w-xl drop-shadow-xs tracking-tight"
            >
              Purity in Every Pour
            </h2>
            <p className="text-stone-700 text-xs sm:text-sm font-medium mt-2 max-w-md leading-relaxed">
              From individual sortex grading to precision packaging, millions of pure consistent grains flowing directly into our wholesale flagship brands.
            </p>
          </div>
        </div>

        {/* Canvas for Falling Grains (Runs during Scene 4 & converges into Scene 5) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        />

        {/* ── SCENE 5: TEJAS CANVASSING SACK ON PEDESTAL & "VIEW RICE VARIETIES" ── */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: scene5Alpha,
            display: scene5Alpha <= 0.01 ? 'none' : 'block',
            pointerEvents: scene5Alpha > 0.4 ? 'auto' : 'none',
          }}
        >
          {/* Golden Sun-Drenched Paddy Field with Warm Grain Texture */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-[#FAF6EE]">
            <img
              src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=2000&q=80"
              alt="Golden Paddy Field Horizon"
              className="w-full h-full object-cover scale-105 filter blur-[2px]"
              style={{ objectPosition: 'center 45%' }}
            />
            {/* Warm Golden Atmosphere blending seamlessly with the rice cascade */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(247,242,231,0.82) 0%, rgba(250,246,238,0.72) 35%, rgba(239,230,216,0.85) 75%, rgba(225,214,196,0.95) 100%)',
              }}
            />

            {/* Subtle Rice Texture Overlay grounding the showcase in authentic grain */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=2200&q=85')`,
              }}
            />


          </div>

          <div className="relative z-20 h-full max-w-5xl mx-auto px-3 sm:px-4 flex flex-col items-center justify-center pt-16 sm:pt-20 pb-4 sm:pb-6 overflow-y-auto no-scrollbar">
            
            {/* The Authentic Rice Brands Flow Showcase with Grains Pouring Directly Into Iconic Brands */}
            <RiceBrandsFlow
              onViewVarieties={scrollToProducts}
            />

          </div>
        </div>

        {/* ── SCENE PROGRESSION TRACKER (Dots HUD on right) ── */}
        <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-3">
          {[
            { label: 'Field', progress: 0.05 },
            { label: 'Harvest', progress: 0.32 },
            { label: 'Grain Anatomy', progress: 0.56 },
            { label: 'Cascade', progress: 0.75 },
            { label: 'Our Brands', progress: 0.92 },
          ].map((step, i) => {
            const isActive =
              (i === 0 && scrollProgress < 0.2) ||
              (i === 1 && scrollProgress >= 0.2 && scrollProgress < 0.44) ||
              (i === 2 && scrollProgress >= 0.44 && scrollProgress < 0.68) ||
              (i === 3 && scrollProgress >= 0.68 && scrollProgress < 0.83) ||
              (i === 4 && scrollProgress >= 0.83);

            return (
              <button
                key={i}
                type="button"
                onClick={() => jumpToScene(step.progress)}
                className="p-1 cursor-pointer"
                aria-label={`Jump to stage ${i + 1}`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'bg-amber-400 scale-125 ring-4 ring-amber-400/25'
                      : scrollProgress > 0.45 && scrollProgress < 0.85
                      ? 'bg-stone-300 hover:bg-stone-500'
                      : 'bg-white/30 hover:bg-white/60'
                  }`}
                />
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
