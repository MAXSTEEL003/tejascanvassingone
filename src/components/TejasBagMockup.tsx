import React, { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

interface TejasBagMockupProps {
  isPouring?: boolean;
  onViewVarieties?: () => void;
  className?: string;
}

export default function TejasBagMockup({
  isPouring = true,
  onViewVarieties,
  className = '',
}: TejasBagMockupProps) {
  const [selectedWeight, setSelectedWeight] = useState<'500g' | '5kg' | '25kg'>('500g');

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      
      {/* ── 1. FALLING GRAIN FUNNEL STREAM (Pouring directly into the open bag neck) ── */}
      {isPouring && (
        <div className="absolute -top-36 sm:-top-48 w-36 sm:w-48 h-40 sm:h-52 pointer-events-none z-35 flex flex-col items-center overflow-visible">
          {/* Central concentrated funnel of falling grains */}
          <div className="relative w-16 sm:w-20 h-full flex justify-center">
            {/* Soft volumetric stream glow */}
            <div
              className="absolute inset-0 blur-md opacity-70"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(254,243,199,0.95), transparent)',
              }}
            />

            {/* Individual animated falling grain SVG particles */}
            <svg viewBox="0 0 70 190" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="streamGrainGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="45%" stopColor="#FFF9EB" />
                  <stop offset="100%" stopColor="#F5E4C8" />
                </linearGradient>
                <filter id="grainGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.2" />
                </filter>
              </defs>

              {/* Instanced falling grains with staggered CSS keyframe delays */}
              {[
                { cx: 35, cy: 15, rx: 2.2, ry: 7, rot: -8, delay: '0s', dur: '0.75s' },
                { cx: 26, cy: 38, rx: 2, ry: 6.5, rot: 14, delay: '0.12s', dur: '0.72s' },
                { cx: 44, cy: 50, rx: 2.4, ry: 8, rot: -6, delay: '0.28s', dur: '0.8s' },
                { cx: 32, cy: 75, rx: 2.1, ry: 7.2, rot: 18, delay: '0.06s', dur: '0.68s' },
                { cx: 40, cy: 100, rx: 2.5, ry: 7.8, rot: -12, delay: '0.2s', dur: '0.78s' },
                { cx: 28, cy: 125, rx: 2.2, ry: 6.8, rot: 10, delay: '0.38s', dur: '0.74s' },
                { cx: 42, cy: 145, rx: 2.3, ry: 7.5, rot: -16, delay: '0.1s', dur: '0.7s' },
                { cx: 35, cy: 170, rx: 2.1, ry: 7, rot: 5, delay: '0.25s', dur: '0.76s' },
                { cx: 20, cy: 60, rx: 1.8, ry: 6, rot: -20, delay: '0.32s', dur: '0.73s' },
                { cx: 48, cy: 85, rx: 1.9, ry: 6.5, rot: 22, delay: '0.16s', dur: '0.81s' },
                { cx: 24, cy: 110, rx: 2, ry: 6.8, rot: -14, delay: '0.42s', dur: '0.71s' },
                { cx: 46, cy: 135, rx: 2.2, ry: 7.2, rot: 15, delay: '0.04s', dur: '0.77s' },
                { cx: 36, cy: 180, rx: 2.4, ry: 7.5, rot: -4, delay: '0.18s', dur: '0.72s' },
              ].map((g, i) => (
                <ellipse
                  key={i}
                  cx={g.cx}
                  cy={g.cy}
                  rx={g.rx}
                  ry={g.ry}
                  fill="url(#streamGrainGrad)"
                  filter="url(#grainGlow)"
                  transform={`rotate(${g.rot} ${g.cx} ${g.cy})`}
                  style={{
                    animation: `fallGrainStream ${g.dur} linear infinite ${g.delay}`,
                  }}
                />
              ))}
            </svg>
          </div>

          {/* Golden splash glints as grains settle into the bag mouth */}
          <div className="absolute bottom-1 flex items-center justify-center">
            <div className="w-10 h-2.5 bg-amber-200/90 rounded-full blur-xs animate-pulse" />
            <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>
      )}

      {/* ── 2. THE AUTHENTIC 3D TEJAS STAND-UP SACK / TOTE BAG ── */}
      <div className="relative z-20 flex flex-col items-center">

        {/* TOP WOVEN WEBBING CARRY HANDLE (3D Loop with stitch anchors & cast shadow) */}
        <div className="relative z-15 w-28 sm:w-32 h-16 sm:h-20 -mb-5 flex justify-center pointer-events-none">
          <svg viewBox="0 0 140 85" className="w-full h-full overflow-visible">
            <defs>
              {/* Handle Shadow onto bag top */}
              <filter id="handleShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0B1A11" floodOpacity="0.45" />
              </filter>
              <linearGradient id="handleGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#143120" />
                <stop offset="35%" stopColor="#224C34" />
                <stop offset="70%" stopColor="#2A5C3F" />
                <stop offset="100%" stopColor="#132F1E" />
              </linearGradient>
            </defs>

            {/* Back strap perspective rim */}
            <path
              d="M 38 85 C 38 28, 102 28, 102 85"
              stroke="#0C2014"
              strokeWidth="18"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />

            {/* Main 3D Front Woven Handle Ribbon */}
            <path
              d="M 36 85 C 36 20, 104 20, 104 85"
              stroke="url(#handleGrad)"
              strokeWidth="18"
              strokeLinecap="round"
              fill="none"
              filter="url(#handleShadow)"
            />

            {/* Woven Fabric Texture Stitch Pattern */}
            <path
              d="M 36 85 C 36 20, 104 20, 104 85"
              stroke="#3B7652"
              strokeWidth="8"
              strokeDasharray="5 3"
              strokeLinecap="round"
              fill="none"
            />

            {/* Handle Top Highlight (Sun reflection) */}
            <path
              d="M 52 28 C 62 23, 78 23, 88 28"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        {/* MAIN BAG 3D BODY WRAPPER */}
        <div className="relative w-[min(320px,calc(100vw-3.5rem))] sm:w-[380px] md:w-[420px] max-w-full transition-transform duration-300">

          {/* LEFT TOP CORNER TIE STRING (Twisted jute twine with tassel) */}
          <div className="absolute -left-6 top-7 z-30 pointer-events-none">
            <svg viewBox="0 0 45 35" className="w-9 h-7 drop-shadow-md">
              <path
                d="M 42 6 Q 25 2, 12 12 Q 4 20, 0 30"
                stroke="#B8A484"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 42 8 Q 28 9, 16 20 Q 10 26, 6 32"
                stroke="#9E8A68"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              {/* Tie Knot */}
              <circle cx="39" cy="7" r="3.2" fill="#8C7756" />
              <circle cx="39" cy="7" r="2.2" fill="#B39F7E" />
            </svg>
          </div>

          {/* RIGHT TOP CORNER TIE STRING */}
          <div className="absolute -right-6 top-7 z-30 pointer-events-none">
            <svg viewBox="0 0 45 35" className="w-9 h-7 drop-shadow-md scale-x-[-1]">
              <path
                d="M 42 6 Q 25 2, 12 12 Q 4 20, 0 30"
                stroke="#B8A484"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 42 8 Q 28 9, 16 20 Q 10 26, 6 32"
                stroke="#9E8A68"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              {/* Tie Knot */}
              <circle cx="39" cy="7" r="3.2" fill="#8C7756" />
              <circle cx="39" cy="7" r="2.2" fill="#B39F7E" />
            </svg>
          </div>

          {/* ── 3D PHYSICAL SACK STRUCTURE (Curved side silhouettes, fabric creases, rounded weighted base) ── */}
          <div
            className="relative rounded-t-[28px] rounded-b-[18px] shadow-2xl overflow-hidden border border-[#C5B393]/80"
            style={{
              background: 'linear-gradient(to right, #D8C6A5 0%, #EFE8D8 12%, #FAF6EE 50%, #EAE0CE 88%, #D4C09E 100%)',
              boxShadow: '0 35px 80px -15px rgba(15, 36, 24, 0.48), 0 15px 30px -5px rgba(0,0,0,0.22), inset 0 2px 4px rgba(255,255,255,0.7)',
            }}
          >
            {/* Top Collar / Open Sack Mouth where Grains Fall Into */}
            <div
              className="relative w-full h-7 sm:h-8 flex items-center justify-center border-b border-[#C0AC8A] shadow-inner"
              style={{
                background: 'linear-gradient(to bottom, #2B2319 0%, #4D3F2E 40%, #D4C1A0 100%)',
              }}
            >
              {/* Inner dark cavern where grains enter */}
              <div
                className="w-48 sm:w-56 h-3 rounded-[100%] bg-black/85 shadow-inner"
                style={{
                  boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.95)',
                }}
              />

              {/* Handle Anchor Stitch Boxes [X] */}
              <div className="absolute left-16 sm:left-20 top-1 w-4 h-4 border border-[#163824] bg-[#1C442D] flex items-center justify-center shadow-xs rounded-[1px]">
                <span className="text-[7px] text-[#A3D1B2] font-mono leading-none">✕</span>
              </div>
              <div className="absolute right-16 sm:right-20 top-1 w-4 h-4 border border-[#163824] bg-[#1C442D] flex items-center justify-center shadow-xs rounded-[1px]">
                <span className="text-[7px] text-[#A3D1B2] font-mono leading-none">✕</span>
              </div>
            </div>

            {/* Double Row Top Hem Stitching */}
            <div className="w-full py-1.5 px-4 bg-[#EADCC3] border-b border-[#D0BF9F] flex items-center justify-between text-[7px] font-mono tracking-widest text-[#7C694F] uppercase">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#8A7557]" />
                <span className="font-semibold">HEAVY PACK SACK · 100% SORTEX</span>
              </div>
              <span className="font-bold">APMC/KA/2008</span>
            </div>

            {/* Side Gusset 3D Perspectives (Folded Kraft / Burlap Sides) */}
            <div className="relative flex">
              
              {/* LEFT GUSSET: Shaded fold with vertical lettering */}
              <div
                className="w-6 sm:w-7 shrink-0 flex items-center justify-center relative border-r border-[#C7B594]"
                style={{
                  background: 'linear-gradient(to right, #BBA785 0%, #CFBDA0 70%, #DFCDB2 100%)',
                  boxShadow: 'inset -2px 0 5px rgba(0,0,0,0.1)',
                }}
              >
                <span
                  className="text-[7.5px] sm:text-[8px] font-black tracking-[0.3em] text-[#4A3D29]/75 uppercase whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  TEJAS CANVASSING
                </span>
              </div>

              {/* MAIN FRONT SACK FACE: Woven Canvas Linen Texture with Organic Lighting */}
              <div className="relative flex-1 bg-[#FCFAF4] px-4 sm:px-6 pt-4 pb-0 flex flex-col items-center">
                
                {/* Micro-woven linen textile texture overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply"
                  style={{
                    backgroundImage: `radial-gradient(#9E8A6A 0.7px, transparent 0.7px)`,
                    backgroundSize: '4px 4px',
                  }}
                />

                {/* Subtle organic cloth fold shadows on front panel */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    background: 'radial-gradient(ellipse 70% 30% at 50% 20%, rgba(0,0,0,0.15) 0%, transparent 70%), linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%, rgba(0,0,0,0.06) 100%)',
                  }}
                />

                {/* Top Row: Batch ID & Official 100% Vegetarian Green Emblem */}
                <div className="w-full flex items-center justify-between pb-1 mb-2 relative z-10">
                  <span className="text-[7.5px] font-mono tracking-widest text-[#8A7960] uppercase font-bold">
                    BATCH: TC-1121-HARYANA
                  </span>
                  
                  {/* Official Indian Vegetarian Symbol (Green circle in square) */}
                  <div
                    className="w-4 h-4 sm:w-4.5 sm:h-4.5 border-[1.8px] border-[#1C6839] flex items-center justify-center p-[2px] bg-white rounded-[2px] shadow-xs"
                    title="100% Vegetarian Certified"
                  >
                    <div className="w-full h-full rounded-full bg-[#1C6839]" />
                  </div>
                </div>

                {/* ── BRANDING: 3-LEAF SPROUT + "Tejas CANVASSING" + TAGLINE ── */}
                <div className="flex flex-col items-center text-center my-0.5 relative z-10">
                  
                  {/* 3-Leaf Sprout Crest Logo */}
                  <svg viewBox="0 0 60 45" className="w-10 h-7.5 sm:w-12 sm:h-9 mb-1">
                    {/* Left Leaf */}
                    <path
                      d="M 30 38 C 21 34, 11 23, 13 11 C 23 11, 28 23, 30 38 Z"
                      fill="#1A3A27"
                    />
                    {/* Center Leaf (Upright) */}
                    <path
                      d="M 30 38 C 26 21, 27 7, 30 2 C 33 7, 34 21, 30 38 Z"
                      fill="#265239"
                    />
                    {/* Right Leaf */}
                    <path
                      d="M 30 38 C 39 34, 49 23, 47 11 C 37 11, 32 23, 30 38 Z"
                      fill="#1A3A27"
                    />
                    {/* Center Stem */}
                    <path
                      d="M 30 38 L 30 44"
                      stroke="#1A3A27"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* "Tejas" Elegant Classic Serif */}
                  <h3
                    style={{ fontFamily: 'var(--font-serif)' }}
                    className="text-[#112619] text-3xl sm:text-4xl md:text-[42px] font-bold tracking-tight leading-none"
                  >
                    Tejas
                  </h3>

                  {/* "CANVASSING" Tracked Bold Sans */}
                  <span className="text-[#193A24] text-[10.5px] sm:text-[12px] font-black tracking-[0.32em] uppercase mt-1">
                    CANVASSING
                  </span>

                  {/* Authentic Tagline */}
                  <p
                    style={{ fontFamily: 'var(--font-serif)' }}
                    className="text-[#4E4436] text-[10px] sm:text-[11px] italic font-normal tracking-wide mt-1"
                  >
                    “More Than Rice. A Stronger Tomorrow.”
                  </p>
                </div>

                {/* ── CENTER TRANSPARENT BASMATI RICE WINDOW WITH GREEN TERRACE ARTWORK ── */}
                <div className="relative w-full h-28 sm:h-34 my-2.5 rounded-xl overflow-hidden border border-[#D0C0A2] shadow-inner flex flex-col justify-end bg-stone-100">
                  
                  {/* Real Packed Basmati Rice Grains Texture behind the window */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80')`,
                      filter: 'contrast(1.08) brightness(1.04)',
                    }}
                  />

                  {/* Glossy Plastic Packaging Specular Sheen (Curved highlight reflecting light) */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(125deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 30%, transparent 60%, rgba(0,0,0,0.08) 100%)',
                    }}
                  />

                  {/* Rolling Green Terrace Hills Illustration (At bottom of window) */}
                  <div className="relative z-10 w-full h-12 pointer-events-none">
                    <svg viewBox="0 0 320 60" preserveAspectRatio="none" className="w-full h-full">
                      {/* Back Layer (Light Meadow Green) */}
                      <path
                        d="M 0 35 Q 80 12, 160 28 T 320 18 L 320 60 L 0 60 Z"
                        fill="#8EA876"
                        opacity="0.9"
                      />
                      {/* Middle Layer (Forest Green) */}
                      <path
                        d="M 0 42 Q 95 24, 190 38 T 320 30 L 320 60 L 0 60 Z"
                        fill="#527B46"
                        opacity="0.92"
                      />
                      {/* Foreground Layer (Deep Emerald) */}
                      <path
                        d="M 0 50 Q 110 32, 220 44 T 320 38 L 320 60 L 0 60 Z"
                        fill="#275330"
                      />
                    </svg>
                  </div>

                  {/* ── THE ROUND RICE BOWL (Heaped with grains, overlapping window bottom in 3D) ── */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-20 w-22 sm:w-26 h-22 sm:h-26 flex items-center justify-center">
                    <div
                      className="relative w-full h-full rounded-full border-[3px] border-[#3B281B] shadow-2xl overflow-hidden flex items-center justify-center"
                      style={{
                        background: 'radial-gradient(circle, #FFFDF9 0%, #F6EBDB 65%, #D6C4AD 100%)',
                        boxShadow: '0 10px 22px rgba(0,0,0,0.4), inset 0 2px 6px rgba(0,0,0,0.25)',
                      }}
                    >
                      {/* Detailed raw basmati grains mounded in the bowl */}
                      <div
                        className="absolute inset-0 bg-cover bg-center rounded-full"
                        style={{
                          backgroundImage: `url('https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80')`,
                          transform: 'scale(1.3)',
                        }}
                      />

                      {/* 3D Ceramic Rim Specular Highlight */}
                      <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
                      <div
                        className="absolute top-1 left-2 w-10 h-4 rounded-full bg-white/40 blur-xs pointer-events-none"
                        style={{ transform: 'rotate(-25deg)' }}
                      />
                    </div>
                  </div>

                </div>

                {/* Spacing under bowl for deep green footer band */}
                <div className="h-6 sm:h-7 w-full" />

              </div>

              {/* RIGHT GUSSET: Highlighted fold with vertical lettering */}
              <div
                className="w-6 sm:w-7 shrink-0 flex items-center justify-center relative border-l border-[#C7B594]"
                style={{
                  background: 'linear-gradient(to left, #BBA785 0%, #CFBDA0 70%, #DFCDB2 100%)',
                  boxShadow: 'inset 2px 0 5px rgba(0,0,0,0.06)',
                }}
              >
                <span
                  className="text-[7.5px] sm:text-[8px] font-black tracking-[0.3em] text-[#4A3D29]/75 uppercase whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  TEJAS CANVASSING
                </span>
              </div>

            </div>

            {/* ── 3. DEEP FOREST GREEN FOOTER BAND (Haryana Map + 1121 Basmati + Weight) ── */}
            <div
              className="relative z-10 w-full py-3 sm:py-3.5 px-4 sm:px-5 flex items-center justify-between border-t border-[#29563C]"
              style={{
                background: 'linear-gradient(135deg, #11291C 0%, #193D2A 60%, #1F4A34 100%)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.12)',
              }}
            >
              {/* Left: Haryana State Outline Map Contour Graphic */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 sm:w-10 h-9 sm:h-11 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 60 70" className="w-full h-full filter drop-shadow-xs">
                    {/* Haryana Geographical Contour */}
                    <path
                      d="M 28 6 C 36 8, 48 14, 52 24 C 54 34, 48 42, 44 48 C 40 56, 32 64, 24 64 C 16 64, 12 56, 10 46 C 8 36, 12 24, 18 14 Z"
                      fill="#78A682"
                      opacity="0.88"
                      stroke="#B8DCBF"
                      strokeWidth="1.6"
                    />
                    {/* Golden Star Pin on Karnal/Taraori Rice Belt */}
                    <circle cx="28" cy="30" r="3" fill="#FBBF24" />
                    <circle cx="28" cy="30" r="5" stroke="#FBBF24" strokeWidth="1" fill="none" className="animate-ping" />
                  </svg>
                </div>

                {/* Center / Left Product Details */}
                <div className="flex flex-col text-left">
                  <span
                    style={{ fontFamily: 'var(--font-serif)' }}
                    className="text-white text-sm sm:text-base font-bold leading-tight tracking-wide"
                  >
                    1121 Basmati Rice
                  </span>
                  <span className="text-[#E8CD8A] text-[9.5px] sm:text-[10.5px] font-bold tracking-wider uppercase">
                    Premium Grade
                  </span>
                  <span className="text-white/80 text-[8.5px] sm:text-[9.5px] font-light tracking-wide">
                    Origin: Haryana, India
                  </span>
                </div>
              </div>

              {/* Right: Net Weight Pill Badge */}
              <div className="flex items-center">
                <div
                  className="px-2.5 sm:px-3 py-1 rounded-full border border-white/70 bg-white/12 text-white font-mono text-[10.5px] sm:text-xs font-bold tracking-wider shadow-sm"
                  title="Packaging Weight"
                >
                  <span>({selectedWeight})</span>
                </div>
              </div>

            </div>

            {/* Bottom Fold Flaps (Heavy Base weighted on stone) */}
            <div
              className="w-full h-2.5 border-t border-black/40"
              style={{
                background: 'linear-gradient(to bottom, #0D2016 0%, #06110B 100%)',
              }}
            />

          </div>

          {/* Interactive Pack Size Selector Buttons directly beneath the bag */}
          <div className="flex items-center justify-center gap-2 mt-3 z-30 relative">
            <span className="text-[9.5px] font-mono text-stone-700 uppercase font-bold tracking-wider bg-white/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
              Pack Size:
            </span>
            {(['500g', '5kg', '25kg'] as const).map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => setSelectedWeight(wt)}
                className={`px-2.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                  selectedWeight === wt
                    ? 'bg-[#153A25] text-amber-300 shadow-md scale-105 border border-amber-400/40'
                    : 'bg-white/80 text-stone-700 hover:bg-white border border-stone-300 shadow-2xs'
                }`}
              >
                {wt}
              </button>
            ))}
          </div>

        </div>

        {/* ── 3. THE 3D ROUND LIMESTONE / TRAVERTINE PEDESTAL PLINTH ── */}
        <div className="relative -mt-4 w-76 sm:w-96 md:w-[450px] flex flex-col items-center pointer-events-none">
          
          {/* Radial Contact Floor Shadow under the bag */}
          <div
            className="w-60 sm:w-76 h-9 rounded-full blur-md opacity-80"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(10, 24, 15, 0.98) 0%, rgba(10, 24, 15, 0.45) 50%, transparent 75%)',
            }}
          />

          {/* 3D Cylindrical Pedestal */}
          <div className="relative w-full h-14 sm:h-18 -mt-4">
            {/* Top Beveled Oval Surface */}
            <div
              className="w-full h-9 sm:h-11 rounded-[100%] border border-stone-300 shadow-md"
              style={{
                background: 'linear-gradient(130deg, #F5F3EC 0%, #E5E1D5 50%, #D2CCC0 100%)',
                boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.9), 0 4px 10px rgba(0,0,0,0.08)',
              }}
            />
            {/* Shaded Cylindrical Side Wall */}
            <div
              className="w-full h-7 sm:h-9 -mt-5 sm:-mt-6 rounded-b-3xl border-x border-b border-stone-400/80"
              style={{
                background: 'linear-gradient(to bottom, #D2CCC0 0%, #BAB3A5 60%, #A49D8E 100%)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
              }}
            />
          </div>

          {/* Large Soft Cast Shadow onto Table Surface */}
          <div
            className="w-88 sm:w-[500px] h-12 rounded-full blur-xl opacity-50 -mt-4"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(25, 25, 20, 0.85) 0%, transparent 70%)',
            }}
          />

        </div>

      </div>

      {/* ── 4. CALL TO ACTION "VIEW RICE VARIETIES" ── */}
      {onViewVarieties && (
        <div className="mt-8 relative z-30 flex flex-col items-center">
          <button
            type="button"
            onClick={onViewVarieties}
            className="group inline-flex items-center justify-center gap-3 px-9 sm:px-12 py-4 text-xs sm:text-sm font-extrabold tracking-widest uppercase rounded-full shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer hover:scale-105 border border-amber-400/40"
            style={{
              background: 'linear-gradient(135deg, #0F2618 0%, #1A3E28 100%)',
              color: '#FFFFFF',
              boxShadow: '0 12px 38px rgba(15, 38, 24, 0.5)',
            }}
          >
            <span>VIEW RICE VARIETIES</span>
            <ChevronRight
              size={16}
              className="text-amber-400 group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>
      )}

    </div>
  );
}
