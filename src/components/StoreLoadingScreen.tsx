import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wheat } from 'lucide-react';

interface StoreLoadingScreenProps {
  minDurationMs?: number;
}

interface QuoteItem {
  quote: string;
  source: string;
  context?: string;
}

const STORE_QUOTES: QuoteItem[] = [
  {
    quote: "Annadata Sukhibhava — Honoring the hands that till the soil, and the trust that feeds the nation.",
    source: "Ancient Proverb",
    context: "Dedicated to the farmers of the Tungabhadra Basin",
  },
  {
    quote: "Trust is not built in a single deal, but in every honest bag weighed, loaded, and delivered.",
    source: "M. Adinarayan",
    context: "Founder, Tejas Canvassing · Est. 2008",
  },
  {
    quote: "In every single grain of rice lies the quiet patience of the earth, the sun, and the flowing river.",
    source: "Grain Proverb",
    context: "Gangavathi Rice Valley",
  },
  {
    quote: "A merchant’s greatest currency is his word; unbroken grain quality is its truest proof.",
    source: "Mandi Trading Wisdom",
    context: "APMC Market Yard",
  },
  {
    quote: "From fertile paddy fields to retail counters — purity and prosperity go hand in hand.",
    source: "Trade Creed",
    context: "Keshar Kali & JMR Flagship Heritage",
  },
  {
    quote: "Fair business creates enduring friendships that outlast market fluctuations across generations.",
    source: "B2B Philosophy",
    context: "Rooted in mutual respect",
  },
  {
    quote: "May today’s procurement bring abundance to your store and satisfaction to every home.",
    source: "Daily Merchant Wish",
    context: "Wishing you prosperous trading",
  },
];

function getTimeGreeting(): string {
  try {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Welcome';
  } catch {
    return 'Welcome';
  }
}

export default function StoreLoadingScreen({ minDurationMs = 850 }: StoreLoadingScreenProps) {
  const [quoteItem] = useState<QuoteItem>(() => {
    const idx = Math.floor(Math.random() * STORE_QUOTES.length);
    return STORE_QUOTES[idx];
  });

  const [greeting] = useState<string>(() => {
    const base = getTimeGreeting();
    try {
      const storedName = localStorage.getItem('userName');
      if (storedName && storedName.trim() && storedName !== 'Merchant') {
        return `${base}, ${storedName.trim()}`;
      }
    } catch {
      // ignore
    }
    return `${base} & Welcome`;
  });

  return (
    <div 
      id="store-loading-screen"
      className="min-h-[78vh] w-full flex items-center justify-center p-5 sm:p-8 relative font-sans select-none bg-[#fafaf9] dark:bg-[#07110c] text-slate-900 dark:text-white transition-colors duration-300"
    >
      {/* Calm, warm subtle background tint */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.04)_0%,transparent_70%)] pointer-events-none" />

      {/* Elegant Quiet Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-lg w-full bg-white/90 dark:bg-[#0c1611]/90 border border-amber-200/60 dark:border-amber-900/30 rounded-3xl p-7 sm:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-md text-center space-y-7"
      >
        {/* Simple, Non-Flashy Clean Logo Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50/60 dark:bg-emerald-950/40 border border-amber-200/80 dark:border-amber-600/30 p-2 shadow-2xs flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Tejas Canvassing" 
              className="w-10 h-10 object-contain rounded-lg" 
            />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold tracking-[0.2em] text-amber-700 dark:text-amber-400 uppercase block">
              TEJAS CANVASSING · EST. 2008
            </span>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {greeting}
            </h2>
          </div>
        </div>

        {/* Thoughtful Literary Quote Section */}
        <div className="relative px-2 sm:px-4 py-1">
          {/* Subtle quotation glyph */}
          <span className="text-4xl sm:text-5xl font-serif text-amber-500/25 dark:text-amber-400/20 select-none block leading-none -mb-3 font-italic">
            “
          </span>

          <p className="font-serif italic text-lg sm:text-xl text-slate-800 dark:text-amber-50/95 leading-relaxed font-normal tracking-wide">
            {quoteItem.quote}
          </p>

          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Wheat className="w-3.5 h-3.5 text-amber-600/70 dark:text-amber-400/70 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {quoteItem.source}
            </span>
            {quoteItem.context && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-400 italic">
                  {quoteItem.context}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Calm, Dignified Status (No flashy looping bars or meters) */}
        <div className="pt-2 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
              Opening wholesale rice catalogue...
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
