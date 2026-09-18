import React from 'react';

interface RicePouchProps {
  name: string;
  variant: 'basmati' | 'jasmine' | 'sona' | 'brown' | 'sella' | 'raw';
  isBrownRice?: boolean;
}

export default function RicePouchGraphic({ name, variant, isBrownRice = false }: RicePouchProps) {
  // Theme palette based on variety matching user reference image
  const theme = React.useMemo(() => {
    switch (variant) {
      case 'jasmine':
        return {
          bagBg: 'from-[#4a151b] via-[#661e26] to-[#380e13]',
          textColor: '#f5e4c3',
          subColor: '#d6b896',
          label: 'JASMINE RICE',
          tagline: 'Fragrant & Soft',
          accent: '#e6be8a',
          sealColor: '#2b0a0d',
          riceType: 'white'
        };
      case 'sona':
        return {
          bagBg: 'from-[#b88628] via-[#d69f33] to-[#996e1b]',
          textColor: '#2d1c0b',
          subColor: '#4a3219',
          label: 'SONA MASURI',
          tagline: 'Light & Healthy',
          accent: '#ffffff',
          sealColor: '#805912',
          riceType: 'white'
        };
      case 'brown':
        return {
          bagBg: 'from-[#3e2417] via-[#5c3722] to-[#2f190e]',
          textColor: '#f1dfd3',
          subColor: '#cfb5a5',
          label: 'BROWN RICE',
          tagline: 'Whole Grain Goodness',
          accent: '#dfc2b0',
          sealColor: '#241309',
          riceType: 'brown'
        };
      case 'sella':
        return {
          bagBg: 'from-[#143d2c] via-[#1e5840] to-[#0f2e21]',
          textColor: '#f5ebd0',
          subColor: '#c9bca0',
          label: 'SELLA 1121',
          tagline: 'Royal Extra Long',
          accent: '#e9caa1',
          sealColor: '#0a2117',
          riceType: 'white'
        };
      case 'raw':
        return {
          bagBg: 'from-[#ece5d8] via-[#f7f2ea] to-[#ded5c5]',
          textColor: '#2b2118',
          subColor: '#635344',
          label: 'KESHAR KALI',
          tagline: 'Heritage Aroma',
          accent: '#b89445',
          sealColor: '#cfc4b0',
          riceType: 'white'
        };
      case 'basmati':
      default:
        return {
          bagBg: 'from-[#ebe2d0] via-[#f5ede0] to-[#dfd3bd]',
          textColor: '#1a3324',
          subColor: '#4d5d52',
          label: 'BASMATI RICE',
          tagline: 'Premium Long Grain',
          accent: '#1a3324',
          sealColor: '#cdc0a8',
          riceType: 'white'
        };
    }
  }, [variant]);

  return (
    <div className="relative w-full aspect-[4/3] flex items-center justify-center p-3 sm:p-4 select-none overflow-hidden bg-gradient-to-b from-[#fbfbfa] to-[#f4f5f2] dark:from-[#181d1a] dark:to-[#121614]">
      {/* Soft Ground Shadow */}
      <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 w-[85%] h-5 bg-black/10 dark:bg-black/40 blur-md rounded-full pointer-events-none" />

      {/* Container holding Pouch and Wooden Rice Bowl */}
      <div className="relative w-full max-w-[280px] h-full flex items-end justify-center">
        
        {/* --- STAND-UP POUCH SACK --- */}
        <div 
          className={`relative z-10 w-[54%] h-[88%] rounded-t-xl rounded-b-lg bg-gradient-to-br ${theme.bagBg} shadow-xl flex flex-col justify-between p-2 sm:p-2.5 -translate-x-4 transition-transform duration-300 group-hover:-translate-y-1`}
          style={{
            clipPath: 'polygon(6% 0%, 94% 0%, 98% 97%, 92% 100%, 8% 100%, 2% 97%)',
            boxShadow: '0 12px 24px -6px rgba(0,0,0,0.18)'
          }}
        >
          {/* Top Seal Strip */}
          <div 
            className="w-full h-2 rounded-xs border-b border-black/15 flex items-center justify-center gap-1 opacity-75"
            style={{ backgroundColor: theme.sealColor }}
          >
            <div className="w-4 h-0.5 rounded-full bg-black/30" />
          </div>

          {/* Bag Graphic Content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-1 sm:py-2">
            {/* Grainly Wheat Logo on Pouch */}
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                <path d="M12 2L14 7L12 12L10 7L12 2Z" fill="#d4af37" />
                <path d="M14 7L18 10L14 13L13 9L14 7Z" fill="#e9c349" />
                <path d="M10 7L6 10L10 13L11 9L10 7Z" fill="#d4af37" />
                <path d="M12 12V22" stroke="#22543d" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span 
                className="font-serif text-[8.5px] sm:text-[10px] font-bold tracking-tight leading-none uppercase"
                style={{ color: theme.textColor }}
              >
                TEJAS CANVASSING
              </span>
            </div>

            {/* Rice Variety Label */}
            <h4 
              className="font-serif text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wider leading-tight"
              style={{ color: theme.textColor }}
            >
              {theme.label}
            </h4>
            <p 
              className="text-[6.5px] sm:text-[8px] font-semibold tracking-wide uppercase mt-0.5 opacity-90"
              style={{ color: theme.subColor }}
            >
              {theme.tagline}
            </p>

            {/* Botanical Landscape Emblem Illustration on pouch */}
            <div className="my-1.5 sm:my-2 w-10 sm:w-12 h-6 sm:h-7 rounded-full border border-black/10 flex items-center justify-center relative overflow-hidden bg-white/10">
              <svg viewBox="0 0 48 24" className="w-full h-full opacity-60">
                <path d="M0 24 Q12 14 24 24 Q36 12 48 24" fill="none" stroke={theme.accent} strokeWidth="1" />
                <path d="M6 24 Q18 8 30 24" fill="none" stroke={theme.accent} strokeWidth="0.8" />
                <circle cx="24" cy="8" r="3" fill={theme.accent} opacity="0.7" />
              </svg>
            </div>

            {/* Net Weight Badge on Bag */}
            <div className="flex items-center gap-1 opacity-75">
              <span className="text-[6px] sm:text-[7px] font-mono font-bold tracking-tighter" style={{ color: theme.subColor }}>
                100% ORGANIC • NON-GMO
              </span>
            </div>
          </div>

          {/* Bottom Bag Fold Accent */}
          <div className="w-full h-1 bg-black/10 rounded-full" />
        </div>

        {/* --- WOODEN BOWL WITH RICE GRAINS --- */}
        <div className="relative z-20 w-[48%] h-[56%] translate-x-2 -translate-y-1 flex items-end justify-center">
          {/* Wooden Bowl Outer Rim */}
          <div className="relative w-full aspect-[1.3/1] bg-gradient-to-b from-[#6b4226] via-[#52311c] to-[#3a2012] rounded-b-[40px] rounded-t-[14px] shadow-2xl p-1 sm:p-1.5 border-t border-[#8c5632] flex items-start justify-center overflow-visible">
            
            {/* Wooden Texture Grain Rim */}
            <div className="absolute inset-x-1 top-0.5 h-1.5 rounded-full bg-[#8c5632]/80 border-b border-[#3a2012]" />

            {/* Mound of Rice Grains Inside Bowl */}
            <div 
              className={`relative -top-3 w-[92%] h-[68%] rounded-t-full rounded-b-md shadow-inner flex items-center justify-center overflow-hidden ${
                theme.riceType === 'brown' || isBrownRice
                  ? 'bg-gradient-to-b from-[#c2a488] via-[#a88667] to-[#826145]'
                  : 'bg-gradient-to-b from-[#ffffff] via-[#f7f8f6] to-[#e4e7e2]'
              }`}
            >
              {/* Rice Kernel Texture Highlights */}
              <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:3px_3px]" />
              
              {/* Distinctive Raw Grain Kernels */}
              <div className="w-full h-full flex flex-wrap gap-0.5 items-center justify-center p-1 opacity-85">
                {[...Array(24)].map((_, i) => (
                  <div 
                    key={i}
                    className={`h-2 rounded-full shadow-xs transform ${
                      i % 3 === 0 ? 'rotate-45 w-0.5' : i % 2 === 0 ? '-rotate-30 w-1' : 'rotate-12 w-0.5'
                    } ${
                      theme.riceType === 'brown' || isBrownRice 
                        ? 'bg-[#e2c7ac]' 
                        : 'bg-white'
                    }`} 
                  />
                ))}
              </div>
            </div>

            {/* Scattered Grains outside the bowl */}
            <div className="absolute -bottom-1 -left-2 flex gap-1 pointer-events-none opacity-80">
              <div className={`w-1.5 h-0.5 rounded-full rotate-12 ${theme.riceType === 'brown' ? 'bg-[#a88667]' : 'bg-white shadow-xs'}`} />
              <div className={`w-1 h-0.5 rounded-full -rotate-45 ${theme.riceType === 'brown' ? 'bg-[#826145]' : 'bg-white shadow-xs'}`} />
            </div>
            <div className="absolute -bottom-0.5 -right-2 flex gap-1 pointer-events-none opacity-80">
              <div className={`w-1.5 h-0.5 rounded-full -rotate-12 ${theme.riceType === 'brown' ? 'bg-[#a88667]' : 'bg-white shadow-xs'}`} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
